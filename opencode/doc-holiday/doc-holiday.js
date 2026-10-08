import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Published as the npm package @sandgarden/doc-holiday (#813): the bundled
// skills ship inside the package, beside this file —
// scripts/publish-marketplace/stage.mjs assembles it.
const skillsDir = path.resolve(__dirname, "skills")

/**
 * Mutate an OpenCode config object to wire up Doc Holiday: register the bundled
 * skills directory and the remote gloria.dev MCP server (which hosts the
 * `doc_holiday_*` tools). Idempotent and non-clobbering — a user-defined
 * doc-holiday MCP entry wins.
 */
export function applyDocHolidayConfig(config, dir = skillsDir) {
  config.skills = config.skills || {}
  config.skills.paths = config.skills.paths || []
  if (!config.skills.paths.includes(dir)) config.skills.paths.push(dir)
  config.mcp = config.mcp || {}
  config.mcp["doc-holiday"] = config.mcp["doc-holiday"] || {
    type: "remote",
    url: "https://mcp.gloria.dev/mcp",
    enabled: true,
  }
  return config
}

// OpenCode plugin entry. The `config` hook receives OpenCode's config singleton;
// mutations here are visible when skills and MCP servers are resolved later.
// Unlike the gloria plugin, there is no `session.created` version nudge — Doc
// Holiday has no dedicated plugin-version endpoint to poll.
export const docHoliday = async () => ({
  config: async (config) => {
    applyDocHolidayConfig(config)
  },
})

export default docHoliday
