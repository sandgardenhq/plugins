#!/usr/bin/env node
// Stamped at publish time by .github/workflows/publish-marketplace.yml — the
// source tree always reads "DEV"; the published copy carries the real
// version, exactly like USING-GLORIA.md's gloria-doc-version stamp.
export const INSTALLED_VERSION = "0.3.89"

export const LATEST_VERSION_URL = "https://gloria.dev/api/plugin-version"

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

export function formatNudge(installedVersion, latestVersion) {
  if (compareVersions(installedVersion, latestVersion) >= 0) return null
  return (
    `The gloria.dev plugin is out of date (installed ${installedVersion}, latest ${latestVersion}). ` +
    "Tell the user now: update the gloria plugin, then start a new session."
  )
}

export async function checkVersion({ installedVersion, fetchLatest }) {
  try {
    const latest = await fetchLatest()
    return formatNudge(installedVersion, latest)
  } catch {
    // Network hiccups (and malformed responses that reach formatNudge) must
    // never block session start.
    return null
  }
}

/* v8 ignore start -- real network call, exercised only by a live hook subprocess, not unit tests */
async function fetchLatestVersion() {
  const res = await fetch(LATEST_VERSION_URL)
  if (!res.ok) throw new Error(`plugin-version check failed: ${res.status}`)
  const body = await res.json()
  return body.latest
}
/* v8 ignore stop */

export async function main({
  installedVersion = INSTALLED_VERSION,
  fetchLatest = fetchLatestVersion,
  write = (s) => process.stdout.write(s),
} = {}) {
  const message = await checkVersion({ installedVersion, fetchLatest })
  if (!message) return
  write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: message,
      },
    }),
  )
}

/* v8 ignore start -- exercised by a real hook subprocess, not unit tests */
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
/* v8 ignore stop */
