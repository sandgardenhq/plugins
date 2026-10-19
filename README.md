<h1 align="center">Sandgarden plugins</h1>

<p align="center">
  <strong>gloria.dev, Miranda, and Doc Holiday for your coding agent — from one marketplace.</strong>
</p>

---

This is the plugin marketplace for **[Sandgarden](https://sandgarden.com)**'s products. One repo serves multiple coding agents — [Claude Code](https://code.claude.com/docs/en/plugins), [OpenAI Codex](https://learn.chatgpt.com/docs/plugins), [OpenCode](https://opencode.ai), and [Cursor](https://cursor.com) — and three plugins, each installable on its own:

| Plugin            | Product                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`gloria`**      | [gloria.dev](https://gloria.dev) — keeps an agent-written codebase aligned with intent: dependency monitoring, skills, standards, and more. |
| **`miranda`**     | [Miranda](https://miranda.co) — tracks coding-agent token cost and attributes it to the GitHub issue the work was for.                      |
| **`doc-holiday`** | [Doc Holiday](https://doc.holiday) — plans, generates, and maintains your docs from the code that is the source of truth.                   |

This repo also hosts the **Miranda usage collector**: its GitHub [Releases](https://github.com/sandgardenhq/plugins/releases), its signed self-update manifest, and its standalone installer — see [Install the collector without a coding agent](#install-the-collector-without-a-coding-agent).

**[Get started →](#install)**

## Install

Pick your agent, then install whichever plugins you want. Each command below is run from inside that agent unless noted.

### Claude Code

```text
/plugin marketplace add sandgardenhq/plugins
/plugin install gloria@sandgarden
/plugin install miranda@sandgarden
/plugin install doc-holiday@sandgarden
```

The first command registers this marketplace; each `install` adds one plugin. If the install summary says `Run /reload-plugins to activate.`, run that. The first MCP call — or `/mcp` — opens a one-time browser sign-in.

### OpenAI Codex

```bash
codex plugin marketplace add sandgardenhq/plugins   # in your shell
```

Then, inside Codex, run `/plugins`, install the plugins you want, and start a new session — a plugin's skills and tools load at session start. Finally, complete the one-time OAuth handshake for each plugin's MCP server:

```bash
codex mcp login gloria        # in your shell — and/or miranda, doc-holiday
```

Install from the Codex CLI or the ChatGPT desktop app. [Codex's IDE extension does not support plugins.](https://learn.chatgpt.com/docs/plugins)

The `gloria` plugin also ships a `SessionStart` hook that nudges you when a newer version is available — run `/hooks` inside Codex once after installing and trust it, or the nudge never fires.

#### Windows: allow writes to the collector's state directory

**Do this before setting up usage tracking** (the `gloria` and `miranda` plugins both run the collector). On Windows, Codex's sandbox is selected process-wide (`windows.sandbox`) and child processes inherit it, so both the collector's hooks and the setup skill's own credential write are blocked from the collector's state directory — which lives outside any workspace root. The symptom is silent: the plugin installs, MCP sign-in succeeds, and no usage data is ever recorded.

Add that directory as a writable root in `%USERPROFILE%\.codex\config.toml`:

```toml
[sandbox_workspace_write]
writable_roots = ['C:\Users\<you>\.config\sandgarden']
```

Use TOML **single** quotes — they're literal strings, so the backslashes stay as typed. Double quotes would require escaping every one of them.

`C:\Users\<you>\.config\sandgarden` is the default. If you've set either override, use that path instead — the collector resolves its state directory in this order:

1. `SANDGARDEN_HOME` — full path, used as-is
2. `GLORIA_HOME` — full path, deprecated alias of the above
3. `%XDG_CONFIG_HOME%\sandgarden`
4. `C:\Users\<you>\.config\sandgarden`

macOS and Linux need no such step: Codex sandboxes each command individually there rather than the whole process tree, so hook commands are unaffected.

### OpenCode

OpenCode installs plugins from npm. Add the ones you want to your `opencode.json` (global `~/.config/opencode/opencode.json` or a project-local `opencode.json`), then restart OpenCode:

```json
{ "plugin": ["@sandgarden/gloria", "@sandgarden/miranda", "@sandgarden/doc-holiday"] }
```

Each package registers its skills and its MCP server; `@sandgarden/gloria` and `@sandgarden/miranda` also run the usage collector on session start and idle. The first MCP call opens a one-time browser sign-in — follow OpenCode's own MCP auth prompt. Pin a version the npm way (`@sandgarden/gloria@<version>`).

### Cursor

This repo ships a real Cursor plugin (`.cursor-plugin/`) for each product, bundling the same skills and MCP server as the Claude/Codex plugin. Cursor has no individual-user self-service "add a marketplace repo" command yet, so clone this repo once and copy each plugin you want into Cursor's local plugins directory. Re-run the same commands to update:

```bash
git -C ~/.cursor/plugins/sources/sandgarden pull || git clone https://github.com/sandgardenhq/plugins.git ~/.cursor/plugins/sources/sandgarden
mkdir -p ~/.cursor/plugins/local
for plugin in gloria miranda doc-holiday; do   # keep only the ones you want
  rm -rf ~/.cursor/plugins/local/$plugin
  cp -R ~/.cursor/plugins/sources/sandgarden/plugins/$plugin ~/.cursor/plugins/local/$plugin
done
```

Copy rather than symlink. [Cursor's docs recommend a symlink](https://cursor.com/docs/plugins), but Cursor does not load a symlinked local plugin — see [cursor/plugins#35](https://github.com/cursor/plugins/issues/35), still open. A real directory works.

Restart Cursor or run **Developer: Reload Window**, then open Cursor's Customize sidebar and enable the plugins if they aren't already on. The first MCP call opens a one-time browser sign-in.

On a Team or Enterprise plan, Cursor discovers a local plugin only while **Allow Local Plugin Imports** is on (Dashboard → Settings → Security & Identity → Marketplace and Plugins); it is off by default on Enterprise. An admin can instead import this repo once for everyone: Dashboard → Plugins → Team Marketplaces → **Add Marketplace** → **Import from Repo** → `sandgardenhq/plugins`.

Cursor's collector hooks are wired but currently report no usage data — Cursor's local session storage doesn't carry reliable token counts yet.

## Updating

| Agent        | Command                                                         |
| ------------ | --------------------------------------------------------------- |
| Claude Code  | `/plugin marketplace update sandgarden` then `/reload-plugins`  |
| OpenAI Codex | `codex plugin marketplace upgrade sandgarden` (restart Codex)   |
| OpenCode     | `rm -rf ~/.cache/opencode/node_modules/@sandgarden` and restart |
| Cursor       | Re-run the [Cursor install commands](#cursor) (pull + copy)     |

Third-party marketplaces have auto-update off by default in Claude Code — open `/plugin` → **Marketplaces** and enable auto-update for `sandgarden` to skip the manual step.

## The `gloria` plugin

gloria.dev keeps an agent-written codebase aligned with intent. Agents write the code; gloria.dev makes sure it's the code you want. Each tool is driven by a project's own source code — continuously comparing what was actually built against what you intended, and surfacing where the two have drifted apart.

**Canary** (dependency monitoring) discovers every internal and external dependency a project relies on, turns each one into a continuous health check, and notifies you the moment a dependency goes down, starts erroring more than usual, or gets unexpectedly expensive. The **skills library** is a versioned, org-wide coding-agent skill registry with external-marketplace subscriptions and adoption tracking. **Feature Map** is a living map between how you understand a feature and the code that implements it. **Coding Standards** codifies your team's conventions as checkable rules tied to canonical snippets, and flags drift on every change. **Debugging** connects to your log provider so an agent can find the spike, group the errors, and map the stack trace to source.

Installing the plugin gives your agent these skills and wires up the hosted MCP server:

| Skill                                    | What it does                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`setting-up-a-project`**               | For a brand-new project with no CLAUDE.md yet: interviews it (purpose, tech stack, TDD rules, git practices), writes CLAUDE.md, then offers to chain into `setting-up-gloria`. |
| **`setting-up-gloria`**                  | For a project that's already set up: writes the `.gloria/USING-GLORIA.md` agent playbook, adds a Gloria section to `CLAUDE.md`/`AGENTS.md`, and offers project registration.   |
| **`documenting-service-dependencies`**   | Scans a codebase and produces dependency inventories plus copy-paste health-check definitions — the discovery step behind Canary.                                              |
| **`identifying-skills-for-a-project`**   | Inventories the agent skills a project already uses and recommends the gaps worth filling.                                                                                     |
| **`using-the-skills-library`**           | Drives the gloria.dev skills library: search the org library before authoring a skill, and publish reusable skills org-wide.                                                   |
| **`extracting-coding-standards`**        | Derives rules and canonical snippets from a codebase's conventions and registers them with gloria's Coding Standards library.                                                  |
| **`using-coding-standards`**             | Write-time discipline: finds the canonical snippet for what you're about to write, adopts or adapts it, and leaves provenance.                                                 |
| **`checking-coding-standards`**          | Checks code against a project's registered Coding Standards — diff-scoped, metadata, or full-audit — and reports drift findings.                                               |
| **`debugging-production-errors`**        | Investigates production errors through gloria's log tools: find the spike, group the errors, correlate with the deploy, map the stack trace to source.                         |
| **`investigating-production-incidents`** | Wraps `debugging-production-errors` with a durable investigation folder — evidence saved to `evidence/`, findings written to `INVESTIGATION.md`.                               |
| **`deriving-agent-code-style`**          | Turns a codebase's linter/formatter/compiler config into an imperative, agent-facing Code Style section, each rule labeled by what enforces it.                                |
| **`mapping-packages-for-coding-agents`** | Derives a monorepo's internal dependency graph and package roles into agent-facing "put here / not here" routing guidance.                                                     |

The plugin registers the remote **gloria.dev MCP server** at `https://mcp.gloria.dev/mcp` (Streamable HTTP) under the name **gloria**. The server is OAuth-protected; the first request triggers a one-time browser sign-in. The plugin also runs the [usage collector](#the-usage-collector), so a gloria-only install still tracks token usage.

**Once installed**, ask your agent to **set up gloria in this repo**. That invokes `setting-up-gloria`, which — with your permission — writes `.gloria/USING-GLORIA.md` (the playbook that tells every coding agent when to use Gloria's tools and skills), adds a short Gloria section to your `CLAUDE.md`/`AGENTS.md` pointing at it, and offers to register the project with gloria.dev. Re-run it after plugin updates to refresh the playbook. Then ask your agent to **document the project's service dependencies** — `documenting-service-dependencies` produces the inventory and health checks and registers them, and Canary takes it from there.

## The `miranda` plugin

Miranda tracks coding-agent token usage per machine and attributes cost to the GitHub issue the work was actually for, so a team can see what a feature or bug fix cost in agent time, not just an undifferentiated total. It shares its backend with gloria.dev — a project registered in gloria is already a project in Miranda — but needs no gloria plugin.

| Component                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill** `setting-up-usage-tracking` | Wires `.miranda/USING-MIRANDA.md` and an evergreen instruction-file section into a repo, then mints this machine's usage-collector credential.                                                                                                                                                                                                                                                                                                                                    |
| **The usage collector**               | See [The usage collector](#the-usage-collector).                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **MCP server** `miranda`              | The gloria.dev MCP server's scoped `/miranda` endpoint: `tag_session_work_item`, `enable_usage_tracking`, your own cost and workflow reads (`get_my_spend`, `get_my_issue_spend`, `get_my_effectiveness`, `get_my_workflow`), attribution repair (`get_my_tracking_status`, `assign_my_session_work_item`), the managers-only team scoreboard (`get_team_effectiveness`, `settings:manage`), plus project registration. Every `get_my_*` read answers about you, never your team. |

The plugin registers the remote MCP server at `https://mcp.gloria.dev/miranda` (Streamable HTTP) under the name **miranda**. The server is OAuth-protected; the first request triggers a one-time browser sign-in.

**Once installed**, ask your agent:

```text
Set up usage tracking in this repo
```

That invokes `setting-up-usage-tracking`, which wires `.miranda/USING-MIRANDA.md` into your project and mints this machine's usage-collector credential.

## The `doc-holiday` plugin

Doc Holiday turns your codebase into a documentation site and keeps it current. You plan the information architecture, Doc Holiday writes and maintains the pages — each reconciled against the source of truth in the code. gloria.dev exposes Doc Holiday to coding agents through nine `doc_holiday_*` MCP tools (authenticated by a per-org key) and these skills:

| Skill                                     | What it does                                                                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`defining-the-documentation-site-map`** | Scans the source and emits a Diátaxis-organized documentation site map plus a per-page content plan and a Mermaid hierarchy.                                                                                      |
| **`writing-doc-holiday-prompts`**         | Turns a documentation site map + per-page content plan into ready-to-run `@doc.holiday` create/update prompts, plus reusable Instruction Library entries.                                                         |
| **`capturing-documentation-screenshots`** | Drives a browser to capture real product-UI screenshots for docs pages, crops out chrome/PII, and wires them in — plus exact capture instructions for shots (terminal, IDE, native dialogs) it can't take itself. |

The plugin registers the remote **gloria.dev MCP server** at `https://mcp.gloria.dev/mcp` (Streamable HTTP) under the name **doc-holiday**. The server is OAuth-protected; the first request triggers a one-time browser sign-in.

## The usage collector

The `gloria` and `miranda` plugins both ship hooks that feed token cost tracking. On `Stop`/`SessionEnd` the collector syncs the session's own transcript; on `SessionStart` it sweeps this machine's local session stores (Claude Code, Codex, and OpenCode) for anything recorded since the last sweep. Installing both plugins runs the hooks twice, which is fine — redundant work, not double-counted data.

There is nothing to install: the first hook fire downloads a compiled collector binary for your platform (~50 MB, once per collector release) from this repo's GitHub [Releases](https://github.com/sandgardenhq/plugins/releases), verifies it against SHA-256 checksums pinned into the plugin at publish time, and caches it under `bin/` in the collector's state directory (`$XDG_CONFIG_HOME/sandgarden`, defaulting to `~/.config/sandgarden`). If the download can't complete (offline, unsupported platform), the hook exits silently and retries on a later session.

**What it reports:** token usage per model request (model, token counts, timestamps, session and request ids), a random per-machine identifier, and this machine's **hostname, operating system, and architecture**, so you can tell your machines apart in the dashboard. Work-item cost attribution additionally reads your session's own `git remote` to resolve which project it belongs to. To extract those numbers it reads your local session files (which contain conversation content), but it never transmits message content, prompts, or code, and, unless workflow events are on (below), no file paths.

**Workflow events — off by default.** Your organization admin can turn workflow collection on for the whole organization in Miranda's settings; until they do, the collector reports token usage exactly as described here and nothing more. When it is on, the collector also reports the **structure, not content**, of each session it already reads: sizes, names, and flags, never a prompt, a reply, a file body, a tool's output, or a full shell command (only its first word and its class). These are the event kinds:

- `session_start`: branch, repository, entrypoint; the directory as a hash
- `session_end`: why it ended and how long it ran
- `human_turn`: prompt size and slash-command name, never the prompt
- `assistant_turn`: model, effort, stop reason and size, never the reply
- `model_request`: the token counts already reported today
- `tool_call`: tool name, argument names, repo-relative file path, and a shell command's first word only, plus the names of any wrappers a hook added to it before it ran (such as `rtk`)
- `tool_result`: error flag, size, exit code and test counts, never the output
- `project_facts`: manifest and instruction file names, sizes and hashes, and the MCP server names the repo's agent config files declare
- `skill_invoked`: skill name and whether it came from a plugin, the project, or the user
- `subagent_spawned`: subagent type, model override and whether it ran in the background, never its prompt
- `plan_mode`: entering or leaving plan mode, never the plan
- `compaction`: whether a context compaction was automatic or manual, and the context size before it
- `vcs_event`: commit, push, PR create or merge, or rebase, with PR and issue numbers only, never a branch, message or remote
- `hook_fired`: hook name, the first word of the hook's own command (such as `rtk`), and whether it blocked, never its arguments or output
- `mcp_tool_call`: MCP server and tool name, never arguments or results
- `machine_facts`: the MCP server names the session's agent has configured on the machine, and whether each is on, never their commands, URLs, headers or env

**The hooks are inert until you configure them.** With no config present they exit 0 immediately (never interrupting your session) and log a one-line setup hint to `collector.log` in the state directory. Nothing is collected or sent. To configure them, run `setting-up-usage-tracking` (Miranda) or `setting-up-gloria` (gloria) — either calls the `enable_usage_tracking` tool, which mints a write-only usage-ingest key for your org, and writes it to `$XDG_CONFIG_HOME/sandgarden/config.json` (`~/.config/sandgarden/config.json` when `XDG_CONFIG_HOME` is unset):

```json
{
  "ingestToken": "<ingestToken from the tool result>"
}
```

No base URL is needed: the collector defaults to `https://gloria.dev`. From the next session on, the hooks report usage automatically; offline batches queue in the state directory and drain on a later run.

## Install the collector without a coding agent

The collector is also a standalone background service. Installed this way it needs no plugin, no coding agent and — except for the system installers — no administrator. Every channel installs the same binary and ends in the same place: the collector runs, notices it is not connected to an organization yet, and prompts you to sign in (or run `miranda-collector setup`).

| Platform       | Command                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| macOS, Linux   | `curl -fsSL https://miranda.co/install.sh \| sh`                                               |
| macOS, Linux   | `brew install sandgardenhq/tap/miranda-collector` then `brew services start miranda-collector` |
| Windows        | `winget install Sandgarden.MirandaCollector`                                                   |
| Debian, Ubuntu | `sudo dpkg -i miranda-collector_<version>_amd64.deb`                                           |
| Fedora, RHEL   | `sudo rpm -i miranda-collector-<version>.x86_64.rpm`                                           |

The `.deb` and `.rpm` place the binary and a systemd **user** unit but never enable it — that is your call to make, per user:

```sh
systemctl --user enable --now miranda-collector.service
loginctl enable-linger "$USER"   # keep collecting while you are logged out
```

Every artifact — the installers, the `.pkg`, the MSI and the raw binaries — is attached to this repository's [Releases](https://github.com/sandgardenhq/plugins/releases).

### Fleet installation

`MirandaCollector-<version>.pkg` and `MirandaCollector-<version>.msi` are built for management tools. Both install per machine in system context with no configuration profile, and neither needs a user to be signed in at install time:

- **macOS** (Jamf, Kandji, Intune): push the `.pkg`. It installs the binary, places a global LaunchAgent, and starts the collector in the session of whoever is signed in — or at the next login if nobody is.
- **Windows** (Intune, SCCM): push the MSI, or run `msiexec /i MirandaCollector-<version>.msi /qn`. It registers a scheduled task that starts the collector at any user's logon, running as that user.

Each user is prompted to sign in the first time the collector runs in their session; nothing is collected until they do.

### Managing an installed collector

```sh
miranda-collector daemon status      # mechanism, running version, connection
miranda-collector setup              # connect this machine to your org
miranda-collector token create --label cloud | pbcopy   # a key for cloud machines; not saved here
miranda-collector daemon install     # register the per-user service
miranda-collector daemon uninstall   # unregister it
```

## Uninstalling

Removing a plugin from your coding agent does not stop the collector: it
runs as a background service of its own. To remove it from a machine:

1. **Remove the `gloria` and `miranda` plugins** from each coding agent they
   are installed in — both ship the same collector. While either is installed,
   its hooks download the collector again at the next session.
2. **Remove the collector** for your account:

   ```sh
   miranda-collector uninstall                 # everything, including the credential
   miranda-collector uninstall --keep-config   # keep config.json, for a reinstall
   ```

   If you only ever installed the plugin, `miranda-collector` is not on your
   `PATH`: run the copy the plugin cached instead,
   `~/.config/sandgarden/bin/miranda-collector uninstall`.

   It stops the daemon, unregisters the per-user service
   (`~/Library/LaunchAgents/co.miranda.collector.plist` on macOS, the systemd
   user unit / crontab lines / autostart entry on Linux), and deletes the
   collector's state directory (`$XDG_CONFIG_HOME/sandgarden`, defaulting to
   `~/.config/sandgarden` — config, cached binaries, queue, log), the binary
   `install.sh` put in `~/.local/bin` (or `$MIRANDA_INSTALL_DIR`, if you set it
   when installing — set it again here), and a legacy `~/.gloria`. It prints
   every path it removed; running it again reports nothing to remove.

3. **If the `.pkg` was installed** (fleet/MDM — the command above says so when
   it finds one), remove it as an administrator:

   ```sh
   sudo miranda-collector uninstall --system
   ```

   That stops `co.miranda.collector.system` in every signed-in session and
   removes `/Library/LaunchAgents/co.miranda.collector.system.plist`,
   `/usr/local/bin/miranda-collector`, `/usr/local/libexec/miranda-collector/`
   and the `co.miranda.collector` package receipt. Run it after step 2 —
   it deletes the `miranda-collector` command that step uses.

4. **Revoke the machine's ingest key.** Deleting `config.json` does not
   deactivate the key: revoke it on [miranda.co](https://miranda.co) under
   **Account → Collector keys**.

Homebrew installs are removed with `brew services stop miranda-collector`
and `brew uninstall miranda-collector`. On Windows, remove **Miranda
Collector** from Settings → Apps.

## Links

- gloria.dev — <https://gloria.dev>
- Miranda — <https://miranda.co>
- Doc Holiday — <https://doc.holiday>
- MCP server — <https://mcp.gloria.dev/mcp> (gloria, doc-holiday) · <https://mcp.gloria.dev/miranda> (miranda)

---

<p align="center"><sub>© Sandgarden, Inc. · gloria@sandgarden.com</sub></p>
