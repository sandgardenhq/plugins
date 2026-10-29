import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Published as the npm package @sandgarden/gloria (#813): the bundled skills
// and the collector download stub ship inside the package, beside this file —
// scripts/publish-marketplace/stage.mjs assembles it. In the monorepo neither
// exists here, so the skills path is empty and spawnCollector's existsSync
// guard silently no-ops during local dev. #403: gloria and miranda each bundle
// their own stub — a gloria-only install must still track usage.
const skillsDir = path.resolve(__dirname, "skills")
const collectorStubPath = path.resolve(__dirname, "collector/stub.sh")

// Stamped at publish time by scripts/publish-marketplace/stage.mjs — the
// source tree always reads "DEV", exactly like check-plugin-version's hook.
const INSTALLED_VERSION = "0.3.103"
const LATEST_VERSION_URL = "https://gloria.dev/api/plugin-version"

// Local, dependency-free comparison for this repo's simple `x.y.z` versions
// (no npm semver package is used anywhere in this repo). The unstamped "DEV"
// placeholder (the source-tree value before publish-time stamping) always
// compares as lower than any real version, so it always nudges.
function compareVersions(a, b) {
  if (a === "DEV" && b === "DEV") return 0
  if (a === "DEV") return -1
  if (b === "DEV") return 1

  const partsA = a.split(".").map(Number)
  const partsB = b.split(".").map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

export function formatVersionNudge(installedVersion, latestVersion) {
  if (compareVersions(installedVersion, latestVersion) >= 0) return null
  return `The gloria.dev plugin is out of date (installed ${installedVersion}, latest ${latestVersion}). Update it, then start a new session.`
}

/**
 * Mutate an OpenCode config object to wire up gloria.dev: register the bundled
 * skills directory and the remote gloria.dev MCP server. Idempotent and
 * non-clobbering — a user-defined gloria MCP entry wins.
 */
export function applyGloriaConfig(config, dir = skillsDir) {
  config.skills = config.skills || {}
  config.skills.paths = config.skills.paths || []
  if (!config.skills.paths.includes(dir)) config.skills.paths.push(dir)
  config.mcp = config.mcp || {}
  config.mcp.gloria = config.mcp.gloria || {
    type: "remote",
    url: "https://mcp.gloria.dev/mcp",
    enabled: true,
  }
  return config
}

/**
 * Fire-and-forget call into the collector, via the download stub.
 *
 * This runs IN-PROCESS with OpenCode (unlike Claude Code's spawned hook
 * process), and a first run can download a ~50 MB collector binary — so the
 * child is detached and unref'd rather than awaited, and every failure
 * (missing stub, spawn error) is swallowed: a collector bug must never block
 * or slow an OpenCode session.
 *
 * The stub is POSIX sh, not node (#761) — the collector must not require a
 * JS runtime on the host. On Windows that needs `sh` on PATH (Git for
 * Windows' Unix tools); without it the spawn errors and is swallowed, the
 * same silent no-op a missing `node` produced before.
 */
function spawnCollector(args, spawnImpl, stubPath) {
  try {
    if (!fs.existsSync(stubPath)) return
    const child = spawnImpl("sh", [stubPath, ...args], {
      detached: true,
      stdio: "ignore",
    })
    child.on("error", () => {})
    child.unref()
  } catch {
    // Must never block or crash the session.
  }
}

/**
 * Session start: the same `hook-session-start` entrypoint Claude Code's
 * SessionStart hook uses. Since #847 that entrypoint does not sweep — it makes
 * sure this machine has a collector DAEMON, installing the per-user service
 * the first time, and the daemon's own watcher on OpenCode's storage directory
 * is what ingests the session.
 *
 * OpenCode keeps its sessions in SQLite rather than in a transcript file, so
 * there is no path a spool trigger could name; the watcher is the whole of the
 * handoff here.
 */
export function startCollectorSession(spawnImpl = spawn, stubPath = collectorStubPath) {
  spawnCollector(["hook-session-start"], spawnImpl, stubPath)
}

/**
 * Per-turn: `daemon ensure` and nothing else.
 *
 * `session.idle` fires once per TURN, and the session-start entrypoint above
 * runs a whole bootstrap — a service-registration probe (a subprocess on Linux
 * and Windows), a config load, the nudges. That is a session-start's worth of
 * work to pay for every turn. All this handler actually owes the collector is
 * "is a daemon up?", which is one lock-file read when the answer is yes.
 */
export function ensureCollectorDaemon(spawnImpl = spawn, stubPath = collectorStubPath) {
  spawnCollector(["daemon", "ensure"], spawnImpl, stubPath)
}

// OpenCode plugin entry. The `config` hook receives OpenCode's config singleton;
// mutations here are visible when skills and MCP servers are resolved later.
// The `client` param is OpenCode's plugin client, used by the session.created
// hook to surface a version nudge (see formatVersionNudge above). `spawnImpl`
// and `stubPath` exist for test injection only — production callers never
// pass them, so they default to the real child_process.spawn and the shared
// collector stub path.
export const gloria = async ({ client, spawnImpl = spawn, stubPath = collectorStubPath } = {}) => ({
  config: async (config) => {
    applyGloriaConfig(config)
  },
  "session.created": async () => {
    startCollectorSession(spawnImpl, stubPath)
    try {
      const res = await fetch(LATEST_VERSION_URL)
      if (!res.ok) return
      const { latest } = await res.json()
      const message = formatVersionNudge(INSTALLED_VERSION, latest)
      if (message) await client?.app?.log({ service: "gloria", level: "warn", message })
    } catch {
      // Network hiccups must never block session start.
    }
  },
  // Closest OpenCode analog to Claude Code's per-turn Stop hook: fires once
  // the agent loop finishes a turn and is waiting on the user again. Cheap on
  // purpose — see ensureCollectorDaemon.
  "session.idle": async () => {
    ensureCollectorDaemon(spawnImpl, stubPath)
  },
})

export default gloria
