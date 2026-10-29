<!-- gloria-doc-version: 0.3.103 -->

# Using Gloria

[Gloria](https://gloria.dev) keeps agent-written code aligned with intent. It
watches the places where implementation drifts from what the team wants —
dependencies, shared skills, project documents — and gives you, the coding
agent, tools to keep them in sync. This project has adopted Gloria: the
triggers below are commitments the team has made, not suggestions. When a
trigger matches the task you are doing, take the corresponding action.

Gloria is available two ways, and both apply to you:

- **MCP tools** on the `gloria` server (dependencies, skills library,
  documents, Doc Holiday).
- **Agent skills** installed with the Gloria plugin (invoke them by name; do
  not improvise their workflows by hand).

**Vocabulary — "register" and "sync" mean call a Gloria tool.** When the user
says **"register"** or **"sync"** a resource **with Gloria** — a dependency, a
project, a coding standard, a rule, a snippet, a document — they mean: call the
matching Gloria MCP tool (`put_dependency`, `register_project`,
`register_standard`, `put_rule`, `put_snippet`, `put_document`), **not** perform
the underlying action informally or just edit a file. "Register this dependency"
→ `put_dependency`; "sync my project with Gloria" → `register_project` (via the
`documenting-service-dependencies` skill); "register our standards" → the
`extracting-coding-standards` skill's `register_standard` / `put_rule` /
`put_snippet` flow. If a request names one of these resources with "register" or
"sync", route it to the corresponding tool or skill below.

## Start of every session

One cheap check, done as early as possible — before other Gloria work, and
regardless of what the task turns out to be:

**Check this file isn't stale.** Call `get_info` (cheap) and compare its
`latestAgentDocVersion` field to the `gloria-doc-version` stamped at the top
of this file. If newer, tell the user and offer to re-run `setting-up-gloria`
— see "Keeping this file current" below.

If this org also uses Miranda (token-cost tracking), its plugin's own
`.miranda/USING-MIRANDA.md` — installed by the `setting-up-usage-tracking`
skill — has its own "start of every session" obligation (declaring the work
item via `tag_session_work_item`). That lives there, not here.

## Keeping this file current

This file is written by the `setting-up-gloria` skill and stamped with the
plugin version that shipped it (see the first line). Check it for staleness
at the start of every session (see above), not just the first time some
other task happens to call a Gloria tool. Never edit this file by hand — it
is replaced verbatim on refresh.

## When to use Gloria

| The moment in your work                                                                                       | Required action                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You added, removed, or swapped an external service, SaaS API, SDK, or API client                              | Update the dependency inventory: run the `documenting-service-dependencies` skill, or for a single obvious change sync directly with `put_dependency` / `delete_dependency` |
| You changed how an internal system is reached (new database, queue, internal API, or a changed endpoint/auth) | Same as above — internal dependencies are monitored too                                                                                                                     |
| The user asks what this project depends on, or whether a vendor/service is healthy                            | `list_dependencies` / `get_dependency` — answer from Gloria's inventory, not just from reading code                                                                         |
| You are about to author a new agent skill, or the user asks "do we have a skill for X?"                       | `search_skills` FIRST. Only author when nothing fits; follow the `using-the-skills-library` skill                                                                           |
| You built a skill or workflow worth reusing across the org                                                    | Publish it: `publish_skill` (see `using-the-skills-library`)                                                                                                                |
| The user wants a skill from an external marketplace the org subscribes to                                     | `list_marketplaces`, then `install_skill`                                                                                                                                   |
| You produced a durable project document (dependency inventory, architecture map, docs site map)               | Store it with `put_document` so teammates and other agents see it                                                                                                           |
| A Gloria tool reports the project is not registered                                                           | `get_info`, then offer `register_project`                                                                                                                                   |
| The user updated the Gloria plugin, or this file looks wrong or stale                                         | Offer to re-run `setting-up-gloria`                                                                                                                                         |
| The user asks for documentation to be written or updated via Doc Holiday                                      | Use the `doc_holiday_*` tools (see below)                                                                                                                                   |

## MCP tools reference

All tools run as the authenticated user against their active organization.
Reads need `inventory:read` (any member); writes need `inventory:write`;
`publish_skill` needs admin (`settings:manage`).

**Org & projects**

- `get_info` — org id/name/slug plus `latestAgentDocVersion`. Cheap; call it
  first when you need org context or a staleness check.
- `register_project` — register this repo as a gloria.dev project.
- `list_projects` — the org's registered projects.

**Dependencies (Canary)**

- `put_dependency` — create/update a dependency and its health-check
  definition. May return a Configure-secrets link when a check needs a
  credential; pass that link to the user, never ask for the secret in chat.
- `get_dependency`, `list_dependencies` — inventory and current status.
- `delete_dependency` — remove a dependency that no longer exists in code.

**Skills library**

- `search_skills` — search the org's library; always precedes authoring.
- `get_skill` — fetch a skill bundle (latest or a specific version).
- `publish_skill` — publish an immutable new version org-wide.
- `list_skill_versions` — a skill's version history.
- `list_marketplaces`, `install_skill` — external marketplaces the org
  subscribes to, and installing from them via the host agent's native
  mechanism.

**Documents**

- `put_document` — store a Markdown document against the project.

**Doc Holiday** (documentation automation; requires the org's Doc Holiday API
key, configured in gloria.dev Settings)

- Browse: `doc_holiday_list_publications`, `doc_holiday_get_publication`,
  `doc_holiday_list_conversations`, `doc_holiday_list_conversation_turns`,
  `doc_holiday_get_conversation_turn`,
  `doc_holiday_list_conversation_comments`,
  `doc_holiday_get_conversation_diffs`.
- Act: `doc_holiday_request_documentation` (new docs from a prompt),
  `doc_holiday_request_work` (follow-up work on a conversation).

## Skills reference

Invoke these by name when their trigger matches; each skill contains its own
full workflow.

- `documenting-service-dependencies` — map and document every external and
  internal service dependency, with health checks, and sync them to Gloria.
  Trigger: dependency changes; "document our integrations"; "what does this
  connect to?"
- `using-the-skills-library` — search/publish/install org skills. Trigger:
  about to author a skill; "do we already have a skill for this?"; sharing a
  reusable skill.
- `identifying-skills-for-a-project` — inventory the skills a project uses
  and recommend gaps. Trigger: "what skills would help this project?"
- `defining-the-documentation-site-map` — plan a Diátaxis-organized docs site
  from the source. Trigger: "what should our docs contain?"
- `setting-up-gloria` — wire Gloria into a repo (this file + instruction-file
  section) and offer registration. Trigger: "set up gloria"; plugin updated;
  this file missing or stale.

## First-time and recovery

- **Project not registered** — `register_project` needs `inventory:write`.
  Offer it once; if the user declines, continue without syncing.
- **MCP auth fails** — the user must log in to the `gloria` server: Claude
  Code `/mcp` → gloria → authenticate; Codex `codex mcp login gloria`;
  OpenCode follows its MCP auth flow. Until then, skills still work — queue
  the sync and mention it.
- **This file is missing, stale, or contradicts the tools you see** — trust
  the live MCP server, and offer to re-run `setting-up-gloria`.
