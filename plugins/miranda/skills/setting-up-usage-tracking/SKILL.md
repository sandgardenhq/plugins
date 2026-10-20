---
name: setting-up-usage-tracking
description: Use when installing the Miranda plugin into a repo ("set up token tracking", "enable usage tracking", "install miranda"), when a repo is missing .miranda/USING-MIRANDA.md or the miranda section in CLAUDE.md/AGENTS.md, or after a Miranda plugin update to refresh a stale doc — copies the canonical USING-MIRANDA.md agent doc into the repo, wires an evergreen Miranda section into the agent instruction files (with the user's permission), enrols this machine for usage collection, and registers the current repository as a Miranda project if it isn't one. Idempotent; safe to re-run.
---

# Setting Up Usage Tracking

## Overview

Wire Miranda into the current repo so every coding agent that works here
declares the GitHub issue it's working on and this machine's token usage
gets collected. Two files carry that:

1. **`.miranda/USING-MIRANDA.md`** — the agent playbook, copied verbatim
   from the `USING-MIRANDA.md` that sits next to this SKILL.md (the skill's
   base directory). Committed to the repo.
2. **A marked section in the repo's agent instruction files** (`CLAUDE.md`
   and/or `AGENTS.md`) that points unconditionally at the doc. The section is
   evergreen — it names no features, so it never changes across Miranda
   releases; only the doc does.

Then, once those are wired, enrol this machine so the collector daemon the
Miranda plugin installs actually starts reporting usage, and make sure this
repository is a Miranda project — the collector attributes a session to a
project only when the session's `origin` remote matches one of a project's repositories, so an
unregistered repository's spend all lands in **Unassigned**.

Never modify the user's files without showing them exactly what will change
and getting a yes first. Registering the repository writes no file, and is
done without asking (step 6).

## What the collector reports

Tell the user this when you propose enrolling a machine (step 2). It is what
they are consenting to.

- **Always:** token usage per model request (model, token counts,
  timestamps, session and request ids), a random per-machine id, and this
  machine's hostname, OS, and architecture. Never message content.
- **Only if the organization turns it on:** the workflow events below.

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

## The instruction-file section

Insert this text exactly, markers included. The markers are how re-runs find
and replace the section instead of duplicating it.

```markdown
<!-- miranda:start -->

## Miranda

This project uses [Miranda](https://miranda.co) to track coding-agent
token cost and attribute it to the GitHub issues the work was for.

Before starting work in this repo, read `.miranda/USING-MIRANDA.md`. It
explains the one thing required at the start of every session — declaring
the work item — plus the Miranda MCP tools available to you. Treat it as a
commitment the team has made, not a suggestion.

<!-- miranda:end -->
```

## Workflow

### 1. Detect state

- Find the repo root (`git rev-parse --show-toplevel`; fall back to the
  working directory if not a git repo).
- Locate the shipped doc: the `USING-MIRANDA.md` in this skill's base
  directory. If it is missing, stop and tell the user the plugin install
  looks broken — do not synthesize the doc from memory.
- Check what already exists at the repo root:
  - `.miranda/USING-MIRANDA.md` — present?
  - `CLAUDE.md`, `AGENTS.md` — which exist, and does each already contain a
    `<!-- miranda:start -->` ... `<!-- miranda:end -->` block?
  - **Is this machine already enrolled?** Look for the collector's
    `config.json`, in **both** places, in this order:

    1. `$XDG_CONFIG_HOME/sandgarden/config.json`, defaulting to
       `~/.config/sandgarden/config.json` when `XDG_CONFIG_HOME` is unset;
    2. `~/.gloria/config.json` — the pre-rename location. A machine set up
       before the rename still has its credential here; the collector
       migrates it automatically on its next run, so this counts as
       "already enabled" too.

    Either one present means usage tracking is already on for this machine
    (per-machine, not per-repo) and step 5 is a no-op — say so rather than
    re-minting a key.

    **Richer answer, when the collector binary is reachable:**
    `daemon status` additionally reports which service supervises the
    collector and whether a daemon is running. **The binary is not on
    `PATH`** — nothing puts it there. The plugin's download stub caches it
    inside the state directory, so invoke it by path, or through the stub:

    ```sh
    # the stub, which is what every hook uses (works even before the first
    # download); <plugin> is the installed plugin's root directory
    sh <plugin>/collector/stub.sh daemon status

    # or the cached binary directly, if one is there already
    ls ~/.config/sandgarden/bin/     # miranda-collector, or miranda-collector-<version>
    ~/.config/sandgarden/bin/miranda-collector daemon status
    ```

    Substitute whichever path `collectorHome()` resolves to (`SANDGARDEN_HOME`
    → the deprecated `GLORIA_HOME` → `$XDG_CONFIG_HOME/sandgarden` →
    `~/.config/sandgarden`). `daemon status` always exits 0, so "not
    enrolled" is not an error. Treat this as extra detail for the report in
    step 7, not as the enrolment test — the `config.json` check above is the
    one that has to work on every machine.

### 2. Propose and ask permission — once

Tell the user precisely what will happen, in one message, and ask a single
yes/no. Cover only the actions actually needed, e.g.:

- create (or replace) `.miranda/USING-MIRANDA.md`;
- insert the Miranda section into `CLAUDE.md` and `AGENTS.md` (or "replace
  the existing Miranda section in ...");
- create `AGENTS.md` containing the section, when neither instruction file
  exists;
- enrol this machine for usage tracking, if it is not already, saying what
  the collector reports (see "What the collector reports").

If everything is already current, say so and skip to step 6.
Registering the repository is not part of this yes/no — step 6 does it
without asking. If the user
declines the file edits, stop — do not partially apply.

### 3. Write the doc

Copy the shipped `USING-MIRANDA.md` to `.miranda/USING-MIRANDA.md`
**verbatim** (create the `.miranda/` directory if needed). Do not edit,
reformat, or "improve" the content — refreshes must stay a pure file copy.

### 4. Wire the instruction files

For each of `CLAUDE.md` and `AGENTS.md` that exists at the repo root:

- If it contains a marker block, replace everything from
  `<!-- miranda:start -->` through `<!-- miranda:end -->` (inclusive) with
  the section above.
- Otherwise append the section at the end of the file, preceded by one blank
  line.

If neither file exists, create `AGENTS.md` containing only the section
(AGENTS.md is the cross-agent standard; Claude Code reads it too).

### 5. Enable token-usage tracking

Only when step 1 found this machine **unenrolled**.

**Prefer browser enrolment.** Both paths below hand the machine its
credential without this session ever seeing a secret, which is why they come
first:

- **Approve the collector's own sign-in prompt.** A daemon running without a
  credential surfaces a native "Sign in to Miranda" dialog on its first idle
  start (and at most once a day after that); approving it completes the
  browser handshake and writes `config.json` itself. Nothing for you to do but
  tell the user it is waiting for them.
- **Run the collector's `setup` verb** (by path or through the stub, per step 1
  — it is not on `PATH`). It prints a miranda.co URL with a short one-time
  code, opens the browser, and writes the same `config.json` once the user
  approves the machine while signed in. It also registers the daemon's service
  if the machine has none.

**Fall back to minting through MCP** — the steps below — for an agent that
cannot open a browser or drive an interactive terminal, and for a headless
machine. On a headless machine you can also hand the minted key straight to
the collector with `setup --token <ingestToken>`, which writes the same
`config.json` for you rather than you writing it by hand.

**Check before offering one**: `daemon status` (invoked as step 1 describes) is
how you find out what this build of the collector can do, and a collector
predating #1227 answers an unrecognised `setup` verb with usage and a non-zero
exit — go straight to the fallback if so. Whichever path runs, the result is
the same `config.json` — never do two of them.

#### Fallback: minting the credential through MCP

1. Call the `miranda` MCP tool **`enable_usage_tracking`**, always passing a
   `machineLabel` — never omit it. Clerk key names must be unique per org,
   and omitting `machineLabel` falls back to a non-unique default name, so a
   second machine (or a re-run after a partial failure) collides with an
   already-minted key and the call fails with a Clerk `409 token_creation_conflict`.
   Generate a default that's unique per machine, e.g. the hostname plus a
   short random or timestamp suffix (`<hostname>-<4 random hex chars>`), and
   use that unless the user asks for a friendlier label — if they supply
   one, keep it unique the same way (append a short suffix) rather than
   passing their label bare. It mints a write-only, org-scoped Clerk API key
   and returns `{ apiBaseUrl, ingestToken }` plus write instructions.
2. Write `$XDG_CONFIG_HOME/sandgarden/config.json` — `~/.config/sandgarden/config.json`
   when `XDG_CONFIG_HOME` is unset — directly from the tool result, merging
   with any existing keys in the file. The directory is per-machine, not
   per-repo, and shared with the gloria plugin if that's also installed:

   ```json
   {
     "ingestToken": "<ingestToken from the tool result>"
   }
   ```

   Leave the tool's `apiBaseUrl` out of the file: the collector defaults to
   `https://gloria.dev`, the only production host. Write it only when it is
   something else, i.e. a local or dev stack.

   **Never echo the `ingestToken` into the conversation, logs, or any other
   file** — write it straight to the config file. The secret is shown
   exactly once; a compromised or lost key is revoked from the Clerk
   organization settings, and re-running the tool mints a fresh one.

   Work-item cost attribution needs no config beyond this: the collector
   resolves which gloria/Miranda project a session belongs to itself, per
   session, from that session's own `git remote` — never from a value in
   this file, so one machine works correctly across as many
   gloria-registered repos as the developer has checked out. The collector
   needs no runtime install: the plugin's first hook fire downloads a
   compiled, checksum-verified collector binary for this platform (~50 MB,
   once per collector release) and caches it under `bin/` in that same
   directory.

   **Manual fallback (MCP not connected on this machine):** any org member
   can mint the key from a machine that _does_ have the `miranda` MCP server
   connected (the credential is per-machine, so mint one per machine), or an
   org admin can create an API key with scope `usage:ingest` for the
   organization in Clerk and supply it the same way. Have the user write the
   file themselves — never ask them to paste the secret into the chat.

3. **Verify the write landed — never assume it did.** Read `config.json`
   back and confirm it parses and carries both keys. A sandboxed agent
   session can have this write refused: on Codex under Windows the sandbox is
   process-wide and inherited, and the collector's state directory is outside
   any workspace root. If the file is absent or unparseable, **do not report
   tracking as enabled.** Tell the user what to add to
   `%USERPROFILE%\.codex\config.toml`:

   ```toml
   [sandbox_workspace_write]
   writable_roots = ['C:\Users\<you>\.config\sandgarden']
   ```

   substituting whichever path `collectorHome()` resolves to for them
   (`SANDGARDEN_HOME` → `GLORIA_HOME` → `%XDG_CONFIG_HOME%\sandgarden` →
   `C:\Users\<you>\.config\sandgarden`). You cannot apply this edit
   yourself from a sandboxed session — `~/.codex` is a protected control
   directory, read-only to the agent even inside a writable root.

   Then say plainly that **the minted credential is gone**: `ingestToken` is
   shown exactly once, and it was never persisted. After they fix the config,
   re-run `enable_usage_tracking` with a **fresh, different** `machineLabel` —
   reusing the previous one collides with the already-minted key and fails
   with a Clerk `409 token_creation_conflict`.

Collection starts within a minute of that file appearing — the collector
daemon idles while it is missing and begins the moment it shows up, with no
restart. The daemon collects **Claude Code, Codex and OpenCode** usage from
this machine's local session stores whether or not any agent plugin fires, so
no further wiring is needed. See `USING-MIRANDA.md`'s "Codex, OpenCode, and
Cursor" section for per-agent notes.

### 6. Register this repository as a project

Run this after step 5, whichever enrolment path ran — and also when steps 2–5
had nothing to do. Do it **without asking**: the developer is setting up
tracking for exactly this repository, and registering it is the only way its
spend stops landing in Unassigned. Use the `miranda` MCP tools only.

1. **Read the remote.** At the repo root (`git rev-parse --show-toplevel`),
   run:

   ```sh
   git remote get-url origin | sed -E 's#://[^/@]*@#://#'
   ```

   The `sed` drops any userinfo (`user:token@`) before the URL is printed: an
   `https` remote can carry a credential, and it must never reach the
   transcript, a tool argument or the report. Use `origin` and nothing else —
   it is the only remote the collector reads. If this isn't a git repository,
   or the command prints nothing on stdout (no `origin` remote — git's
   `error: No such remote` goes to stderr), skip the rest of step 6 and say
   why in the report (e.g. "this repository has no `origin` remote, so there
   is no URL a project could match").

2. **Normalize it** the way the server does, so the comparison means what
   ingest means:
   - scp-like SSH, `git@host:owner/repo.git` → `https://host/owner/repo`;
   - `ssh://`, `git://` and `git+ssh://` URLs → `https://` on the same host
     (port included) and path; `http://` and `https://` keep their scheme;
   - drop any userinfo left, then a trailing `.git` (and any `/` after it),
     then any trailing `/`.

   Change nothing else — not even letter case.

3. **Look for a match.** A project owns a set of repositories. Call
   `list_projects`, normalize every URL in each project's `repoUrls` (the
   project's repositories, its primary first) the same way (older rows can
   carry a trailing `/` or `.git`), and compare exactly, case-sensitive —
   ingest matches the same way, so a case-only difference is not a match.
   Compare against all of them, not just the primary `repoUrl`: a repository
   attached to a project is that project's as much as its primary is. If a
   project matches, name the existing project — its name and slug (all of
   them, if more than one matches) — say spend from this repository is
   already attributed to it, and register nothing. Never overwrite an existing
   description, even a blank or weak one: a person may have written it, and
   they can edit it on the project's page.

4. **Register when nothing matches.** Call `register_project` with
   `{ "project": { "slug": …, "name": …, "description": …, "repoUrls": [<normalized URL>] } }`:
   - `name` — the repository name: the last path segment of the normalized
     URL (`https://github.com/sandgardenhq/gloria.dev` → `gloria.dev`);
   - `slug` — that name lowercased, every run of characters outside `a-z0-9`
     replaced by `-`, leading and trailing `-` trimmed (`gloria-dev`);
   - `description` — one or two plain sentences, at most about 300
     characters, saying what this project is and what it does, written from
     what you can read at the repo root: the README first, then the manifest's
     own description (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
     and the like), the agent instruction file, and the top-level layout. Be
     specific: say who or what it serves and the main things it does, e.g.
     "Next.js dashboard and Cloudflare Workers API that monitors a team's
     third-party service dependencies and alerts on outages." Not the
     project's name or its URL restated, no boilerplate ("A software
     project", "This repository contains code"), no markdown. Never claim a
     capability, user or integration the files don't show. If they show too
     little to say anything concrete, omit `description` rather than guess.
     The developer can edit it on the project's page afterwards.

   `register_project` **upserts by slug**: sending a slug some other project
   already has overwrites that project's name and repository. So if
   `list_projects` already has the slug — whatever its `repoUrls`, set or not —
   or the slug came out empty, use `<owner>-<repo>` built the same way
   (`sandgardenhq-gloria-dev`). `<owner>` is the path segment before the
   repository name (for `https://gitlab.com/group/sub/repo`, `sub`). If that is
   taken too, append a number to it — `<owner>-<repo>-2`, `-3`, … — until it
   is free. Slugs can't be changed later, so never guess past this rule.

   If the result's `status` is `"held_by"`, another project already holds
   this repository (it was attached after your `list_projects` call, or the
   comparison missed it): nothing was created. Name that project from
   `heldBy` (its slug and name), say this repository's spend is already
   attributed to it, and register nothing more.

   Registering never attaches: you can't tell from the code whether two
   repositories are one product, and attaching moves spend between projects.
   Never call `attach_project_repository` yourself.

5. **Report what happened** in step 7, from the result's `project` and
   `backfill`:
   - the `slug` it registered under (and the name, when it isn't the same as
     the slug);
   - the description it saved, quoted, so the developer can correct it on the
     project's page — or that you sent none, and why;
   - `backfill.status` `"ran"` with `sessionCount` above 0 — that many earlier
     sessions moved from Unassigned onto the project, worth `spendMicros` ÷
     1,000,000 dollars (round to cents), the earliest from `earliestSessionAt`
     (Unix seconds; show it as a date). When `unpriced` is true, some of that
     spend has no price yet, so the dollar figure is a lower bound — say so;
   - `"ran"` with `sessionCount` 0 — there was no earlier Unassigned spend
     from this repository to move;
   - `"failed"` — the project is saved, but its earlier spend didn't move;
     sessions from now on are attributed to it;
   - `"skipped"` — nothing moved;
   - in every case, spend from more than 80 days before today stays in
     Unassigned.

6. **Say how to attach instead.** After registering, tell the user that if
   this repository is part of an existing product rather than a product of
   its own, an org admin (`settings:manage`) can attach it to that product's
   project: on the new project's page in Miranda, **Merge into…** that
   project, which attaches this repository to it and moves the spend that
   just moved here along with it. (`attach_project_repository` attaches a
   repository no active project holds, so it won't take this one while the
   new project does — it's how an admin adds a repository that isn't
   registered yet.) Name the org's other projects from `list_projects` (name
   and slug; the first ten and how many more, if there are more than ten) so
   they can pick one. Skip this when the org had no other project.

If `list_projects` or `register_project` fails with a transient error (a
dropped connection, a timeout), retry it once. If it still fails, or the
`miranda` MCP server isn't connected, or the call returns an error — say so,
with the error, and carry on to the report. It doesn't undo the file edits or the enrolment.

### 7. Report

Summarize what changed (files created/updated, section inserted where,
usage tracking configured or already present, the project registered or
matched — or why the step was skipped — with what step 6 moved) and suggest
committing the changes, e.g. `chore: wire miranda agent doc into instruction
files`.

## Idempotency rules

- Re-running with identical content is a no-op; say "already current".
- Re-running in a repository that is already a project registers nothing:
  step 6 finds the match and names it.
- Marker blocks are always replaced in place, never duplicated. If a file
  somehow contains multiple marker blocks, replace the first and remove the
  rest, and mention it.
- Never touch anything outside the marker block in an instruction file, and
  never edit any other file.
- Never re-mint a usage-tracking credential when step 1 found a `config.json`
  in either location (including the pre-rename `~/.gloria/config.json`). Offer
  to add `machineLabel` or rotate only if the user asks.

## When to suggest this skill proactively

- The user just installed the Miranda plugin in a repo with no
  `.miranda/USING-MIRANDA.md` → offer initial setup.
- The user asks about token cost, usage tracking, or per-issue cost
  attribution and this machine has no collector `config.json` in either
  location → offer to set it up.
