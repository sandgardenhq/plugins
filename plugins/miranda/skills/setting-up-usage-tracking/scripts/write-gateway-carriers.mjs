#!/usr/bin/env node
// Writes Miranda's gateway carriers into a coding agent's own config (#1889;
// design §5 of docs/plans/2026-10-27-ai-gateway-import-design.md). Run by the
// setting-up-usage-tracking skill. Dependency-free: it ships inside the
// published plugin and runs on the developer's machine with plain `node`.
//
// It only ever adds Miranda's identifying values. It never writes a base URL
// or a credential: pointing the agent at the gateway is the customer's job.

import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { homedir as osHomedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

/** The gateways a carrier can be written for: core's `GatewayType` ids. */
export const GATEWAYS = ["litellm", "cloudflare-ai-gateway", "bifrost", "otlp", "openrouter"]

/** Header names per header-logging gateway: [machine, project]. */
const HEADER_CARRIERS = {
  litellm: ["Miranda-Machine", "Miranda-Project"],
  bifrost: ["x-bf-lh-miranda-machine", "x-bf-lh-miranda-project"],
}

/** Cloudflare logs no request headers, only `cf-aig-metadata`'s JSON. */
const CF_METADATA_HEADER = "cf-aig-metadata"
const CF_MACHINE_KEY = "miranda_machine"
const CF_PROJECT_KEY = "miranda_project"
const CF_AGENT_KEY = "miranda_agent"
const CF_MAX_ENTRIES = 5

/** OTLP resource attributes, set through `OTEL_RESOURCE_ATTRIBUTES`. */
const OTEL_MACHINE_KEY = "miranda.machine.id"
const OTEL_PROJECT_KEY = "miranda.project"
const OTEL_AGENT_KEY = "miranda.agent"

/** Every header name a gateway carrier owns, lowercased. Removed before a
 *  write, so a re-run, a changed value, or a switch to another gateway never
 *  leaves two carriers behind. */
const MIRANDA_HEADER_NAMES = new Set(
  Object.values(HEADER_CARRIERS)
    .flat()
    .map((name) => name.toLowerCase()),
)
const MIRANDA_CF_KEYS = new Set([CF_MACHINE_KEY, CF_PROJECT_KEY, CF_AGENT_KEY])
const MIRANDA_OTEL_KEYS = new Set([OTEL_MACHINE_KEY, OTEL_PROJECT_KEY, OTEL_AGENT_KEY])

/** A refusal the skill relays to the user verbatim. Nothing was written. */
function refuse(message) {
  const error = new Error(message)
  error.name = "CarrierRefusal"
  return error
}

/** How `gateway` carries the Miranda values (design §5). */
function carrierKind(gateway) {
  if (gateway === "openrouter") {
    throw refuse(
      "OpenRouter has no Miranda carrier: it doesn't pass custom request headers through to " +
        "the records Miranda imports, so nothing written here would reach Miranda. Run the " +
        "Miranda collector on this machine instead; its copy of the session is the one counted.",
    )
  }
  if (gateway in HEADER_CARRIERS) return "headers"
  if (gateway === "cloudflare-ai-gateway") return "cf-aig-metadata"
  if (gateway === "otlp") return "otel"
  throw refuse(`Unknown gateway "${gateway}". Use one of: ${GATEWAYS.join(", ")}.`)
}

// --- values -----------------------------------------------------------------

/** The machine id's only valid form: the collector's lowercase UUID. The
 *  server ignores anything else as no signal (design §5). */
const MACHINE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The server's cap on a project carrier value (design §5). */
const MAX_PROJECT_LENGTH = 512

/** Refuse values the server would discard, before anything is written. */
export function validateCarrierValues({ machineId, project }) {
  if (typeof machineId !== "string" || !MACHINE_ID_PATTERN.test(machineId)) {
    throw refuse(
      `"${machineId}" isn't a valid machine id: Miranda only accepts the collector's lowercase UUID.`,
    )
  }
  if (typeof project !== "string" || project.trim() === "") {
    throw refuse("The project is empty: run this inside a repository with an origin remote.")
  }
  if (project.length > MAX_PROJECT_LENGTH) {
    throw refuse(
      `The project URL is longer than ${MAX_PROJECT_LENGTH} characters, which Miranda ignores.`,
    )
  }
}

/** GitHub `owner/repo` shorthand. */
const GITHUB_SHORTHAND = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
/** scp-like SSH remotes, `git@github.com:owner/repo.git`. */
const SCP_LIKE_SSH = /^[\w.-]+@([\w.-]+):(.+)$/

function stripGitSuffixAndSlash(path) {
  return path.replace(/\.git\/*$/i, "").replace(/\/+$/, "")
}

/**
 * A port of core's `normalizeRepoUrl` (packages/core/src/inventory-schema.ts),
 * which the server resolves a project with; a parity test pins the two
 * together. `URL.host` drops any userinfo, so a credential in the remote
 * never reaches a config file.
 */
export function normalizeRepoUrl(input) {
  const trimmed = input.trim()
  if (GITHUB_SHORTHAND.test(trimmed)) return `https://github.com/${trimmed}`
  const scp = SCP_LIKE_SSH.exec(trimmed)
  if (scp !== null) return `https://${scp[1]}/${stripGitSuffixAndSlash(scp[2])}`
  try {
    const url = new URL(trimmed)
    if (url.protocol === "ssh:" || url.protocol === "git:" || url.protocol === "git+ssh:") {
      return `https://${url.host}${stripGitSuffixAndSlash(url.pathname)}`
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.protocol}//${url.host}${stripGitSuffixAndSlash(url.pathname)}`
    }
    return trimmed
  } catch {
    return trimmed
  }
}

/** The gateway a base URL points at, when its host says so; else null and
 *  the skill asks. Self-hosted gateways (LiteLLM, Bifrost) have no fixed
 *  host, so only the hosted ones are inferred. */
export function inferGateway(baseUrl) {
  let host
  try {
    host = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host === "gateway.ai.cloudflare.com") return "cloudflare-ai-gateway"
  if (host === "openrouter.ai" || host.endsWith(".openrouter.ai")) return "openrouter"
  return null
}

// --- machine id -------------------------------------------------------------
//
// The machine value is the collector's own enrolment id, so the server
// resolves a gateway request's user through the same `machine_owner` row the
// collector's ingest uses. This mirrors packages/collector/src/state.ts; keep
// the two in step.

/** Full-path overrides of the collector's home, highest precedence first. */
const HOME_OVERRIDE_VARS = ["SANDGARDEN_HOME", "GLORIA_HOME"]

/** The entries whose presence tells the collector its one-time `~/.gloria`
 *  migration is done (MIGRATED_STATE_ENTRIES in state.ts). */
const MIGRATION_GATE_ENTRIES = [
  "config.json",
  "machine.json",
  "usage-cursors.json",
  "usage-queue",
  "work-item-throttle.json",
  "sync-debounce.json",
  "heartbeat.json",
  "declared-work-item.json",
]

function envPath(env, homedir, name) {
  const raw = env[name]
  if (raw === undefined || raw === "") return null
  return raw.startsWith("~/") ? join(homedir, raw.slice(2)) : raw
}

function homeOverride(env, homedir) {
  for (const name of HOME_OVERRIDE_VARS) {
    const value = envPath(env, homedir, name)
    if (value !== null) return value
  }
  return null
}

/** The collector's state directory: `SANDGARDEN_HOME` → `GLORIA_HOME` →
 *  `$XDG_CONFIG_HOME/sandgarden` → `~/.config/sandgarden`. */
export function collectorHome(env, homedir) {
  return (
    homeOverride(env, homedir) ??
    join(envPath(env, homedir, "XDG_CONFIG_HOME") ?? join(homedir, ".config"), "sandgarden")
  )
}

/** The id in a machine.json, or null when there is no file. Refuses a file
 *  it can't use: replacing it would give the machine a second identity. */
function readMachineFile(file) {
  if (!existsSync(file)) return null
  let machineId
  try {
    machineId = JSON.parse(readFileSync(file, "utf8"))?.machineId
  } catch {
    machineId = undefined
  }
  if (typeof machineId !== "string" || !MACHINE_ID_PATTERN.test(machineId)) {
    throw refuse(
      `${file} doesn't hold a lowercase UUID machineId, so it was left alone. Replacing it ` +
        "would give this machine a second identity. Fix or remove it, then re-run.",
    )
  }
  return machineId
}

/**
 * This machine's id: the collector's `machine.json`; else, before the
 * collector's one-time migration has run, the pre-rename `~/.gloria` id (read
 * only: writing machine.json would close the migration gate and strand the
 * legacy config.json); else a fresh UUID v4 written in the collector's
 * format, so a collector installed later reuses it.
 */
export function resolveMachineId({ env, homedir }) {
  const home = collectorHome(env, homedir)
  const file = join(home, "machine.json")
  const existing = readMachineFile(file)
  if (existing !== null) return { machineId: existing, source: "existing", file }

  const legacyFile = join(homedir, ".gloria", "machine.json")
  const migrationPending =
    homeOverride(env, homedir) === null &&
    !MIGRATION_GATE_ENTRIES.some((name) => existsSync(join(home, name)))
  if (migrationPending) {
    const legacy = readMachineFile(legacyFile)
    if (legacy !== null) return { machineId: legacy, source: "legacy", file: legacyFile }
  }

  const machineId = randomUUID()
  mkdirSync(home, { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify({ machineId }, null, 2))
    renameSync(tmp, file)
  } finally {
    rmSync(tmp, { force: true })
  }
  return { machineId, source: "minted", file }
}

// --- header lists -----------------------------------------------------------
//
// Each agent keeps its headers in a different format, but all of them are an
// ordered list of { name, value } entries. Entries the merge doesn't touch are
// returned as the same objects, so a format can keep their original text.

function isNamed(entry, name) {
  return entry.name.toLowerCase() === name
}

/** Parse a `cf-aig-metadata` value as a JSON object, or null. */
function parseMetadata(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Miranda's `cf-aig-metadata` entries merged into the customer's, Miranda's
 *  first: behind Cloudflare Access, `cf.user_id` evicts the LAST entry. */
function mergedMetadata(existing, { machineId, project, agent }) {
  let customer = {}
  if (existing !== undefined) {
    const parsed = parseMetadata(existing.value)
    if (parsed === null) {
      throw refuse(
        `The existing ${CF_METADATA_HEADER} header isn't a JSON object, so it was left alone. ` +
          "Fix it, then re-run.",
      )
    }
    customer = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => !MIRANDA_CF_KEYS.has(key)),
    )
  }
  const merged = {
    [CF_MACHINE_KEY]: machineId,
    [CF_PROJECT_KEY]: project,
    [CF_AGENT_KEY]: agent,
    ...customer,
  }
  if (Object.keys(merged).length > CF_MAX_ENTRIES) {
    throw refuse(
      `${CF_METADATA_HEADER} holds at most five entries. Miranda needs three, and this agent ` +
        `already sends ${Object.keys(customer).length} of its own (${Object.keys(customer).join(", ")}). ` +
        "Remove enough of them to leave room, then re-run. Nothing was written.",
    )
  }
  return JSON.stringify(merged)
}

/** The customer's `cf-aig-metadata` with any Miranda entries removed: the
 *  entry unchanged when it has none, null when nothing of theirs is left. */
function withoutMirandaMetadata(entry) {
  const parsed = parseMetadata(entry.value)
  if (parsed === null || !Object.keys(parsed).some((key) => MIRANDA_CF_KEYS.has(key))) return entry
  const customer = Object.entries(parsed).filter(([key]) => !MIRANDA_CF_KEYS.has(key))
  return customer.length === 0
    ? null
    : { name: entry.name, value: JSON.stringify(Object.fromEntries(customer)) }
}

/**
 * Merge the gateway's carrier into an agent's header list. Every Miranda
 * carrier already there is removed first; the customer's own headers are
 * kept, in order.
 */
export function mergeCarrierHeaders(entries, { gateway, machineId, project, agent }) {
  const kind = carrierKind(gateway)
  if (kind === "otel") throw refuse("OTLP is carried by resource attributes, not headers.")
  const kept = entries.filter((entry) => !MIRANDA_HEADER_NAMES.has(entry.name.toLowerCase()))
  if (kind === "cf-aig-metadata") {
    const existing = kept.find((entry) => isNamed(entry, CF_METADATA_HEADER))
    const value = mergedMetadata(existing, { machineId, project, agent })
    return [
      ...kept.filter((entry) => !isNamed(entry, CF_METADATA_HEADER)),
      { name: CF_METADATA_HEADER, value },
    ]
  }
  const [machineHeader, projectHeader] = HEADER_CARRIERS[gateway]
  return [
    ...kept
      .map((entry) => (isNamed(entry, CF_METADATA_HEADER) ? withoutMirandaMetadata(entry) : entry))
      .filter((entry) => entry !== null),
    { name: machineHeader, value: machineId },
    { name: projectHeader, value: project },
  ]
}

/** `Name: Value` lines, as Claude Code's `ANTHROPIC_CUSTOM_HEADERS` holds
 *  them. Each entry keeps its original line. */
function parseHeaderLines(text) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const colon = line.indexOf(":")
      return colon === -1
        ? { name: line.trim(), value: "", line }
        : { name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim(), line }
    })
}

function formatHeaderLines(entries) {
  return entries.map((entry) => entry.line ?? `${entry.name}: ${entry.value}`).join("\n")
}

// --- OTEL resource attributes -----------------------------------------------

/** OpenTelemetry's baggage-octet set, minus `%` (the escape itself). Anything
 *  else in a value is percent-encoded. */
function isBaggageOctet(char) {
  const code = char.charCodeAt(0)
  return (
    code === 0x21 ||
    (code >= 0x23 && code <= 0x2b && code !== 0x25) ||
    (code >= 0x2d && code <= 0x3a) ||
    (code >= 0x3c && code <= 0x5b) ||
    (code >= 0x5d && code <= 0x7e)
  )
}

function encodeAttributeValue(value) {
  return [...value].map((char) => (isBaggageOctet(char) ? char : encodeURIComponent(char))).join("")
}

function attributeKey(entry) {
  const separator = entry.indexOf("=")
  const raw = (separator === -1 ? entry : entry.slice(0, separator)).trim()
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Merge Miranda's three attributes into an `OTEL_RESOURCE_ATTRIBUTES`
 *  list, keeping the customer's entries verbatim. */
export function mergeResourceAttributes(existing, { machineId, project, agent }) {
  const kept = existing
    .split(",")
    .filter((entry) => entry.trim() !== "" && !MIRANDA_OTEL_KEYS.has(attributeKey(entry)))
  const added = [
    [OTEL_MACHINE_KEY, machineId],
    [OTEL_PROJECT_KEY, project],
    [OTEL_AGENT_KEY, agent],
  ].map(([key, value]) => `${key}=${encodeAttributeValue(value)}`)
  return [...kept, ...added].join(",")
}

// --- JSON config files ------------------------------------------------------

function readJsonObject(file) {
  if (!existsSync(file)) return {}
  const text = readFileSync(file, "utf8")
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw refuse(`${file} isn't valid JSON, so it was left alone. Fix or remove it, then re-run.`)
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw refuse(`${file} isn't a JSON object, so it was left alone.`)
  }
  return parsed
}

/** Write `next` only if it differs from what is on disk. */
function writeJsonIfChanged(file, before, next) {
  if (existsSync(file) && JSON.stringify(before) === JSON.stringify(next)) {
    return { status: "unchanged", file }
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n")
  return { status: "written", file }
}

// --- Claude Code ------------------------------------------------------------

/**
 * Claude Code: `env.ANTHROPIC_CUSTOM_HEADERS` in the repository's
 * `.claude/settings.local.json` (per user, per project, kept out of git).
 * Claude Code resolves `env` by settings precedence with no merge, so both
 * values go here together, merged with whatever headers the file already
 * sends. The committed `.claude/settings.json` is never touched. OTLP's
 * carrier is `OTEL_RESOURCE_ATTRIBUTES` in the same `env` block.
 */
export function writeClaudeCodeCarrier({ repoRoot, gateway, machineId, project }) {
  const values = { gateway, machineId, project, agent: "claude-code" }
  const kind = carrierKind(gateway)
  validateCarrierValues(values)
  const file = join(repoRoot, ".claude", "settings.local.json")
  const before = readJsonObject(file)
  const env = { ...(before.env ?? {}) }
  if (kind === "otel") {
    env.OTEL_RESOURCE_ATTRIBUTES = mergeResourceAttributes(
      env.OTEL_RESOURCE_ATTRIBUTES ?? "",
      values,
    )
  } else {
    const headers = parseHeaderLines(env.ANTHROPIC_CUSTOM_HEADERS ?? "")
    env.ANTHROPIC_CUSTOM_HEADERS = formatHeaderLines(mergeCarrierHeaders(headers, values))
  }
  return writeJsonIfChanged(file, before, { ...before, env })
}

/** OTLP's carrier is an environment variable of the exporter; only Claude
 *  Code's settings file has an `env` block to hold it. */
function otlpNotInConfig(where) {
  return refuse(
    `${where} has no resource-attribute setting. Set OTEL_RESOURCE_ATTRIBUTES in the ` +
      "environment of whatever exports your OTLP traces instead.",
  )
}

// --- Codex ------------------------------------------------------------------
//
// Codex reads `model_providers` only from the user config ($CODEX_HOME,
// default ~/.codex): project `.codex/config.toml` ignores it. So the carrier
// goes on the customer's own custom provider block there. This is a narrow
// line editor, not a TOML parser: it rewrites one `http_headers = { … }`
// line, or inserts one, and refuses any shape it can't rewrite safely.

/** Provider ids Codex reserves; a custom block can't reuse them, so they
 *  can't carry headers. */
const CODEX_BUILTIN_PROVIDERS = new Set(["openai", "ollama", "lmstudio"])

const CODEX_CUSTOM_PROVIDER_GUIDANCE =
  "Codex can only send extra headers from a custom provider: a [model_providers.<id>] " +
  "block in config.toml whose base_url points at your gateway, selected with " +
  'model_provider = "<id>". Create that block (pointing Codex at the gateway is yours to ' +
  "do), then re-run with its id."

/** A TOML basic string (double-quoted), escaped. */
function tomlString(value) {
  return JSON.stringify(value)
}

/** A table header line's dotted key, as plain segments, or null. */
function tableHeaderKey(line) {
  const match = /^\s*\[\s*([^[\]]+?)\s*\]\s*(#.*)?$/.exec(line)
  if (match === null) return null
  return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+)/g)].map((part) =>
    part[1] !== undefined ? JSON.parse(`"${part[1]}"`) : (part[2] ?? part[3]),
  )
}

function sameKey(a, b) {
  return a !== null && a.length === b.length && a.every((segment, i) => segment === b[i])
}

/** The top-level `model_provider`, read from before the first table. */
function activeCodexProvider(lines) {
  for (const line of lines) {
    if (/^\s*\[/.test(line)) return null
    const match = /^\s*model_provider\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/.exec(line)
    if (match !== null) return match[1] !== undefined ? JSON.parse(`"${match[1]}"`) : match[2]
  }
  return null
}

/** Parse the inside of a one-line inline table of string values into header
 *  entries, or null if it isn't that shape. */
function parseInlineHeaders(body) {
  const entries = []
  const pair =
    /\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+))\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(,|$)/y
  let index = 0
  while (index < body.length && body.slice(index).trim() !== "") {
    pair.lastIndex = index
    const match = pair.exec(body)
    if (match === null) return null
    const name = match[1] !== undefined ? JSON.parse(`"${match[1]}"`) : (match[2] ?? match[3])
    const value = match[4] !== undefined ? JSON.parse(`"${match[4]}"`) : match[5]
    entries.push({ name, value })
    index = pair.lastIndex
    if (match[6] === "") break
  }
  return entries
}

function formatInlineHeaders(entries) {
  const pairs = entries.map((entry) => `${tomlString(entry.name)} = ${tomlString(entry.value)}`)
  return `{ ${pairs.join(", ")} }`
}

/**
 * Codex: `http_headers` on the active custom `[model_providers.<id>]` block
 * of `$CODEX_HOME/config.toml`, merged with the headers it already sends.
 * `provider` overrides the top-level `model_provider`.
 */
export function writeCodexCarrier({ codexHome, gateway, machineId, project, provider }) {
  const values = { gateway, machineId, project, agent: "codex" }
  if (carrierKind(gateway) === "otel") throw otlpNotInConfig("Codex's config.toml")
  validateCarrierValues(values)
  const file = join(codexHome, "config.toml")
  if (!existsSync(file)) {
    throw refuse(
      `${file} doesn't exist, so Codex is on its built-in provider. ${CODEX_CUSTOM_PROVIDER_GUIDANCE}`,
    )
  }
  const text = readFileSync(file, "utf8")
  const lines = text.split("\n")
  const id = provider ?? activeCodexProvider(lines)
  if (id === null || CODEX_BUILTIN_PROVIDERS.has(id)) {
    throw refuse(
      `Codex is using the built-in provider "${id ?? "openai"}", which can't carry headers. ` +
        CODEX_CUSTOM_PROVIDER_GUIDANCE,
    )
  }

  const blockKey = ["model_providers", id]
  const start = lines.findIndex((line) => sameKey(tableHeaderKey(line), blockKey))
  if (start === -1) {
    throw refuse(`${file} has no [model_providers.${id}] block. ${CODEX_CUSTOM_PROVIDER_GUIDANCE}`)
  }
  if (lines.some((line) => sameKey(tableHeaderKey(line), [...blockKey, "http_headers"]))) {
    throw refuse(
      `[model_providers.${id}.http_headers] is a separate table, which this script doesn't ` +
        "rewrite. Add the headers to it by hand (see the Codex page of Miranda's gateway docs).",
    )
  }
  let end = lines.findIndex((line, i) => i > start && /^\s*\[/.test(line))
  if (end === -1) end = lines.length

  const headerLine = lines.findIndex(
    (line, i) => i > start && i < end && /^\s*http_headers\s*=/.test(line),
  )
  let next
  if (headerLine === -1) {
    let last = end - 1
    while (last > start && lines[last].trim() === "") last -= 1
    const merged = mergeCarrierHeaders([], values)
    next = [
      ...lines.slice(0, last + 1),
      `http_headers = ${formatInlineHeaders(merged)}`,
      ...lines.slice(last + 1),
    ]
  } else {
    const match = /^(\s*http_headers\s*=\s*)\{(.*)\}(\s*(#.*)?)$/.exec(lines[headerLine])
    const existing = match === null ? null : parseInlineHeaders(match[2])
    if (existing === null) {
      throw refuse(
        `The http_headers in [model_providers.${id}] isn't a one-line table of strings, which is ` +
          "the only shape this script rewrites. Add the headers by hand (see the Codex page of " +
          "Miranda's gateway docs).",
      )
    }
    const merged = mergeCarrierHeaders(existing, values)
    next = [...lines]
    next[headerLine] = `${match[1]}${formatInlineHeaders(merged)}${match[3]}`
  }

  const nextText = next.join("\n")
  if (nextText === text) return { status: "unchanged", file, provider: id }
  writeFileSync(file, nextText)
  return { status: "written", file, provider: id }
}

// --- OpenCode ---------------------------------------------------------------
//
// OpenCode merges its global and project configs, so headers on the
// repository's `opencode.json` provider entry merge with the provider the
// customer defined globally, and the project value stays per repository.

function providerIdsWithBaseUrl(config) {
  return Object.entries(config.provider ?? {})
    .filter(([, entry]) => typeof entry?.options?.baseURL === "string")
    .map(([id]) => id)
}

/**
 * OpenCode: `provider.<id>.options.headers` in the repository's
 * `opencode.json`, merged with the headers it already sends. Without
 * `provider`, the gateway provider is the one provider whose `baseURL` the
 * project or global config sets.
 */
export function writeOpenCodeCarrier({
  repoRoot,
  globalConfigFile,
  gateway,
  machineId,
  project,
  provider,
}) {
  const values = { gateway, machineId, project, agent: "opencode" }
  if (carrierKind(gateway) === "otel") throw otlpNotInConfig("OpenCode's opencode.json")
  validateCarrierValues(values)
  const file = join(repoRoot, "opencode.json")
  const before = readJsonObject(file)

  let id = provider
  if (id === undefined) {
    const candidates = [
      ...new Set([
        ...providerIdsWithBaseUrl(before),
        ...providerIdsWithBaseUrl(readJsonObject(globalConfigFile)),
      ]),
    ]
    if (candidates.length !== 1) {
      throw refuse(
        candidates.length === 0
          ? "No provider in opencode.json sets options.baseURL, so there is no gateway provider to " +
              "add headers to. Point a provider at your gateway first, then re-run."
          : `More than one provider sets options.baseURL (${candidates.join(", ")}). Re-run naming ` +
              "the one routed through your gateway.",
      )
    }
    id = candidates[0]
  }

  const entry = before.provider?.[id] ?? {}
  const options = entry.options ?? {}
  const existing = Object.entries(options.headers ?? {}).map(([name, value]) => ({ name, value }))
  const headers = Object.fromEntries(
    mergeCarrierHeaders(existing, values).map((header) => [header.name, header.value]),
  )
  const next = {
    ...before,
    provider: { ...before.provider, [id]: { ...entry, options: { ...options, headers } } },
  }
  return { ...writeJsonIfChanged(file, before, next), provider: id }
}

// --- CLI --------------------------------------------------------------------

const USAGE = `Usage:
  write-gateway-carriers.mjs machine-id
  write-gateway-carriers.mjs write --agent <claude-code|codex|opencode> --gateway <${GATEWAYS.join("|")}>
                                   [--repo <dir>] [--provider <id>] [--project <url>]
  write-gateway-carriers.mjs gateway-for <base-url>

Prints one JSON object on success (exit 0). A refusal prints its reason on
stderr and exits 2, having written nothing. Bad arguments exit 1.`

const WRITE_OPTIONS = {
  agent: { type: "string" },
  gateway: { type: "string" },
  repo: { type: "string" },
  provider: { type: "string" },
  project: { type: "string" },
}

/** The repository's `origin` URL, or null when it has none. */
function originUrl(repoRoot) {
  try {
    return execFileSync("git", ["-C", repoRoot, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

function writeFor(agent, { env, homedir, repoRoot, ...values }) {
  if (agent === "claude-code") return writeClaudeCodeCarrier({ repoRoot, ...values })
  if (agent === "codex") {
    const codexHome = envPath(env, homedir, "CODEX_HOME") ?? join(homedir, ".codex")
    return writeCodexCarrier({ codexHome, ...values })
  }
  if (agent === "opencode") {
    const configHome = envPath(env, homedir, "XDG_CONFIG_HOME") ?? join(homedir, ".config")
    const globalConfigFile = join(configHome, "opencode", "opencode.json")
    return writeOpenCodeCarrier({ repoRoot, globalConfigFile, ...values })
  }
  throw refuse(`No config writer for agent "${agent}". Use one of: claude-code, codex, opencode.`)
}

function runWrite(args, { env, homedir }) {
  const { values: flags } = parseArgs({ args, options: WRITE_OPTIONS, strict: true })
  if (flags.agent === undefined || flags.gateway === undefined) return null
  const repoRoot = flags.repo ?? process.cwd()
  const remote = flags.project ?? originUrl(repoRoot)
  if (remote === null || remote === "") {
    throw refuse(`${repoRoot} has no origin remote, so there is no project URL to send.`)
  }
  const project = normalizeRepoUrl(remote)
  // Validate before minting, so a refused run leaves no machine.json behind.
  carrierKind(flags.gateway)
  const { machineId } = resolveMachineId({ env, homedir })
  const result = writeFor(flags.agent, {
    env,
    homedir,
    repoRoot,
    gateway: flags.gateway,
    provider: flags.provider,
    machineId,
    project,
  })
  return { ...result, agent: flags.agent, gateway: flags.gateway, machineId, project }
}

function runCommand(args, deps) {
  const [command, ...rest] = args
  if (command === "machine-id" && rest.length === 0) return resolveMachineId(deps)
  if (command === "gateway-for" && rest.length === 1) return { gateway: inferGateway(rest[0]) }
  if (command === "write") return runWrite(rest, deps)
  return null
}

/** Run the CLI. Returns the exit code. */
export function main(args, { env, homedir, stdout, stderr }) {
  let result
  try {
    result = runCommand(args, { env, homedir })
  } catch (error) {
    if (error.name === "CarrierRefusal") {
      stderr(error.message)
      return 2
    }
    if (error.code?.startsWith("ERR_PARSE_ARGS")) result = null
    else throw error
  }
  if (result === null) {
    stderr(USAGE)
    return 1
  }
  stdout(JSON.stringify(result, null, 2))
  return 0
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2), {
    env: process.env,
    homedir: osHomedir(),
    stdout: (text) => process.stdout.write(text + "\n"),
    stderr: (text) => process.stderr.write(text + "\n"),
  })
}
