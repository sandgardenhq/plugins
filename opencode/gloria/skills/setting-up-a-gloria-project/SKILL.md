---
name: setting-up-a-gloria-project
description: Use when setting up a new project with Gloria - a new or empty repo, or one whose CLAUDE.md or AGENTS.md is missing or thin, where the user wants Gloria too ("set up this project with gloria", "start a new gloria project") - surveys the repo, interviews the user, and authors CLAUDE.md plus an AGENTS.md tuned for Codex CLI, OpenCode, and Cursor, covering project purpose, tech stack, commands, TDD rules, and development practices, then runs every Gloria setup step (wiring, dependency sync, coding standards, skills). For a plain setup without Gloria, use `project-foundations:setting-up-a-project`. Distinct from `setting-up-gloria`, which wires Gloria into a project that's already set up.
---

# Setting up a Gloria Project

## Overview

Author the instruction files that define a project's purpose, commands, and development practices before writing code: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex CLI, OpenCode, and Cursor, plus the rule files both of them lean on. Then run every Gloria setup step on the project, so it leaves with Gloria fully configured.

**Core principle:** A well-configured project prevents rework and ensures consistency. Establishing guardrails upfront helps Claude Code work reliably, produce high-quality code, and avoid doom loops where code is written, broken, and rewritten repeatedly.

**When NOT to use:** an established repo that already has a mature CLAUDE.md - review and refine the existing file instead. If the repo is already set up and only needs Gloria wired in, use the `setting-up-gloria` skill directly instead of running this full interview.

**Bundled files:** `TDD.rules.md`, `git-commit-rules.md`, and `CLAUDE-specific-fuckups.md` ship in this skill's directory. If one is missing, stop and tell the user the plugin install looks broken - do not fetch it from anywhere else or reconstruct it from memory.

**Track each numbered step below as a todo** (`TodoWrite` in Claude Code, your plan or todo tool elsewhere).

**Commit after each section the user confirms** - one commit per section, throughout every step below.

## The Process

### 1. Survey the Repository

Read what the repo already says about itself before asking anything. Never ask a question the files answer.

```bash
ls -a                       # layout, and whether CLAUDE.md / AGENTS.md / .claude/ exist
cat README.md 2>/dev/null
```

Detect the stack from manifests and lockfiles:

| Evidence                                                                            | What it tells you                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `package.json` + `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lockb` | Language, package manager, scripts, test and lint tooling |
| `pyproject.toml` / `uv.lock` / `requirements.txt`                                   | Python packaging and tool config                          |
| `go.mod`                                                                            | Go module path and version                                |
| `Cargo.toml`                                                                        | Rust crate and workspace layout                           |
| `Makefile` / `Taskfile.yml` / `justfile`                                            | The commands people actually run                          |
| `.github/workflows/*.yml`                                                           | The commands CI actually runs - the most reliable source  |
| `Dockerfile` / `fly.toml` / `wrangler.jsonc` / `serverless.yml`                     | Deployment target                                         |

Then **confirm rather than interrogate**: "This looks like a TypeScript CLI on pnpm with Vitest and ESLint - right?" Ask only about what the repo cannot tell you.

Handle what you find:

- **Empty repo, no manifests** - nothing to survey. Go to step 2 and ask everything.
- **CLAUDE.md or AGENTS.md exists but is thin** - merge into it. Read it first, keep the user's existing wording, add only the missing sections. Never overwrite a file you have not read.
- **CLAUDE.md exists and is mature** - stop and offer to review and refine it instead of running this skill.
- **AGENTS.md is a symlink to CLAUDE.md** - replace it with a real file in step 7. A symlink cannot carry the adaptations the other agents need.

Also ask which agents will work in this repo (Claude Code, Codex CLI, OpenCode, Cursor). Step 7 writes `AGENTS.md` for the latter three; write it by default unless the user says Claude Code is the only agent that will ever touch the project.

### 2. Define the Project Purpose

Ask questions to determine:

1. **What should this project be called?** Get a name and brief description.
2. **What problem does this solve?** Understand the pain point, who experiences it, and why existing solutions are inadequate.
3. **How will it work?** Get a high-level explanation of the approach or mechanism.

Document the answers in CLAUDE.md under a `## Project Overview` section:

```markdown
## Project Overview

**Pantry Pal**: A CLI tool that suggests weeknight dinner recipes from ingredients already in the user's pantry.

### Problem

Home cooks waste food and time deciding what to make. Existing recipe apps assume a shopping trip rather than working with what is already on hand.

### Approach

A local ingredient inventory is matched against a recipe index. The tool ranks recipes by pantry coverage and prints the top matches along with a shopping list for any missing ingredients.
```

### 3. Define the Tech Stack

Ask about each area the survey did not already answer. Suggest defaults based on the language and runtime.

1. **Language and runtime** - What programming language? What version/runtime?
2. **Deployment target** - Where will this run? (CLI, web server, serverless, container, browser, etc.)
3. **Package manager** - How will dependencies be managed?
4. **Testing framework** - What will be used for TDD?
5. **Build tools** - How will the project be built/compiled?
6. **Linting and formatting** - What tools enforce code style?
7. **Key libraries** - Any specific libraries or frameworks required?
8. **Unique concerns** - Any other technical requirements? (database, auth, external APIs)

Defaults by language:

| Language           | Package Manager | Testing    | Linting           | Build          |
| ------------------ | --------------- | ---------- | ----------------- | -------------- |
| TypeScript/Node.js | pnpm            | Vitest     | ESLint + Prettier | esbuild or tsc |
| Python             | uv              | pytest     | Ruff              | -              |
| Go                 | go modules      | go test    | golangci-lint     | go build       |
| Rust               | cargo           | cargo test | clippy            | cargo build    |

Adjust suggestions based on deployment target and project needs. Document the result under `## Tech Stack`:

```markdown
## Tech Stack

- **Language**: [Language and version]
- **Runtime**: [Runtime environment]
- **Package Manager**: [Package manager]
- **Testing**: [Testing framework]
- **Linting**: [Linter and formatter]
- **Build**: [Build tool]
- **Key Libraries**: [List of essential libraries]
```

### 4. Record the Commands

The Commands section is the most-used part of a CLAUDE.md - Claude reads it before every test run, build, and lint. Get exact, runnable strings, copied verbatim from `package.json` scripts, the Makefile, or the CI workflow when those exist.

```markdown
## Commands

| Task         | Command                |
| ------------ | ---------------------- |
| Install      | `pnpm install`         |
| Test (once)  | `pnpm test`            |
| Test (watch) | `pnpm test --watch`    |
| Coverage     | `pnpm test --coverage` |
| Build        | `pnpm build`           |
| Lint         | `pnpm lint`            |
| Format       | `pnpm format`          |
| Typecheck    | `pnpm typecheck`       |
| Run locally  | `pnpm dev`             |
```

Omit rows that do not apply. These values fill the placeholders in `TDD.rules.md` (step 5) and the permission allowlist (step 7), so get them right here.

### 5. Establish Development Practices

#### TDD Rules (Mandatory)

TDD is non-negotiable for all projects set up with this skill.

1. Confirm the coverage thresholds with the user. Defaults: 90% lines, functions, and statements; 85% branches. Record whatever they choose.
2. Ask how test files are named and located in this stack (for example `src/example.ts` → `src/__tests__/example.test.ts`, or Go's `example_test.go` beside the source).
3. Copy the bundled `TDD.rules.md` (in this skill's directory) to the **project root** as `TDD.rules.md`. Do not paste it into CLAUDE.md - it is about 150 lines, and CLAUDE.md loads into every session.
4. Replace every `{{PLACEHOLDER}}` in the copy:

   | Placeholder                     | Value                                                             |
   | ------------------------------- | ----------------------------------------------------------------- |
   | `{{TEST_COMMAND}}`              | Test (once), from step 4                                          |
   | `{{TEST_WATCH_COMMAND}}`        | Test (watch), from step 4                                         |
   | `{{COVERAGE_COMMAND}}`          | Coverage, from step 4                                             |
   | `{{BUILD_COMMAND}}`             | Build, from step 4                                                |
   | `{{LINT_COMMAND}}`              | Lint, from step 4                                                 |
   | `{{COVERAGE_THRESHOLD}}`        | Lines/functions/statements threshold                              |
   | `{{BRANCH_COVERAGE_THRESHOLD}}` | Branch threshold                                                  |
   | `{{TEST_FILE_CONVENTION}}`      | The naming and location rule, with two or three concrete examples |

   Delete the `**This file is a template.**` note at the top of the copy - its two lines name placeholders themselves, so the check below can never pass while they remain. Keep the "Referenced by `CLAUDE.md` and `AGENTS.md`" note under it.

5. Reference it from CLAUDE.md under `## Development Practices`:

```markdown
### Test-Driven Development

TDD is mandatory. **Read `TDD.rules.md` before writing any code.**

@TDD.rules.md
```

The `@` line is a Claude Code auto-import. The sentence above it is what makes the rules reachable in every other agent, which read the file as plain text - never rely on `@` alone.

If the bundled `TDD.rules.md` is missing, stop and tell the user the plugin install looks broken - do not fetch it from anywhere else or reconstruct it from memory.

**Verify no placeholder survives:** `grep -n '{{' TDD.rules.md` must return nothing.

#### Commit Rules (CRITICAL)

**This rule is non-negotiable.** Read the bundled `git-commit-rules.md` file (in this skill's directory) and copy it verbatim into `CLAUDE.md`, and into `AGENTS.md` in step 7. It is short, and it is the single home for commit discipline - `TDD.rules.md` points here rather than restating it. If the bundled `git-commit-rules.md` is missing, stop and tell the user the plugin install looks broken.

#### Claude-Specific Failure Patterns

Copy the bundled `CLAUDE-specific-fuckups.md` (in this skill's directory) to the **project root** verbatim - it has no placeholders to fill in.

Reference it from CLAUDE.md under `## Development Practices`:

```markdown
### Known Failure Patterns

Claude Code repeats certain mistakes because its training data lags the tools it uses. **Read `CLAUDE-specific-fuckups.md` before work that touches any of its entries.**

@CLAUDE-specific-fuckups.md
```

This file is Claude Code-specific - do not reference it from `AGENTS.md`. The other agents don't share Claude's training data, so the entries would be dead text there.

If the bundled `CLAUDE-specific-fuckups.md` is missing, stop and tell the user the plugin install looks broken - do not fetch it from anywhere else or reconstruct it from memory.

#### Git and Pull Request Workflow

Ask about each, and offer the default:

1. **Branching strategy** - Feature branches, trunk-based, or git worktrees?
2. **Branch naming** - Convention for naming branches (e.g., `feature/`, `fix/`, `chore/`)
3. **Worktrees** - If using worktrees, establish conventions for worktree location and naming
4. **Merge style** - Default: merge commits, never squash. Confirm before recording.
5. **Issue references** - Default: when working an issue, the PR description must note that the PR closes that issue number. Confirm before recording.

Document the answers under `## Development Practices`.

#### GitHub Actions Rules (if the project uses GitHub Actions)

If the project uses, or will use, GitHub Actions for CI/CD, apply this rule whenever authoring or editing workflow files:

**Never use an action pinned to the deprecated Node 20 runtime.** GitHub Actions is moving off Node 20 in favor of Node 24. When adding or updating a `uses:` step, always pick the action's latest major version rather than an older major still pinned to Node 20, and check the action's release notes/changelog if unsure whether it has moved to the Node 24 runtime.

Document this rule in CLAUDE.md under a `## CI/CD Practices` section (only if the project uses GitHub Actions):

```markdown
## CI/CD Practices

- Never use GitHub Actions pinned to the deprecated Node 20 runtime. Always use the latest major version of each action.
```

### 6. Document the Working Environment

Three short sections that save an agent from guessing:

```markdown
## Repository Layout

- `src/` - application code
- `src/__tests__/` - tests, mirroring `src/`
- `scripts/` - build and release tooling

## Environment

Copy `.env.example` to `.env` and fill in the values. Never commit `.env` or any
credential. Required variables: `DATABASE_URL`, `API_KEY`.

## Boundaries

Do not edit by hand:

- `dist/`, `*.generated.ts` - generated output; change the generator instead
- `pnpm-lock.yaml` - update via the package manager
```

Ask what is generated, vendored, or otherwise off-limits, and what secrets the project needs. Omit any section that has no content - an empty heading is worse than none.

### 7. Write the Files Each Agent Reads

#### AGENTS.md (Codex CLI, OpenCode, Cursor)

Claude Code reads `CLAUDE.md`. Codex CLI, OpenCode, and Cursor read `AGENTS.md`. Write both.

**Do not symlink them together.** They describe the same project but they are not the same document: `CLAUDE.md` leans on auto-imports and Claude Code's tool names, and neither survives the trip to another agent.

How `AGENTS.md` differs:

| Concern         | CLAUDE.md                          | AGENTS.md                                                                                                 |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Deep rule sets  | `@TDD.rules.md` auto-import        | A **Required Reading** list instructing the agent to open the files itself - nothing auto-loads           |
| Non-negotiables | Carried by the imported rule files | Condensed inline at the top, so the critical rules are present even if the agent never opens another file |
| Todo tracking   | `TodoWrite` by name                | "your plan or todo tool"                                                                                  |
| Permissions     | Points at `.claude/settings.json`  | An inline rule: run the Commands table freely, ask before anything else                                   |
| Shape           | Terse; imports carry the weight    | Flatter and self-contained                                                                                |

Template:

```markdown
# <Project Name> - Agent Instructions

Read this file before making any change. It applies to every agent working in this repo.

## Required Reading

These files are not loaded automatically. Open them yourself before writing code:

- `TDD.rules.md` - test-driven development rules. Mandatory, no exceptions.
- `VERIFICATION_PLAN.md` - how to prove a change actually works.

## Non-Negotiables

1. No production code without a failing test first. Full rules in `TDD.rules.md`.
2. Commit after every RED-GREEN-REFACTOR cycle. Never leave 30 minutes of work uncommitted.
3. A task is not done until tests pass, the build succeeds, and the linter is clean.
4. Run the commands in the Commands table freely. Ask first before anything that
   installs software, writes outside the repo, or reaches the network.
5. Track multi-step work in your plan or todo tool as you go.

## Project Overview

## Tech Stack

## Commands

## Repository Layout

## Environment

## Development Practices

## CI/CD Practices

## Boundaries

## Maintaining This File

`CLAUDE.md` and `AGENTS.md` describe the same project. When a project fact changes -
a command, the stack, the layout, a boundary - update both in the same commit.
```

The sections from `## Project Overview` down carry the same content as `CLAUDE.md`, written out in full rather than referenced. Write `## Development Practices` inline here: the git and PR workflow from step 5, plus the commit rules, with no `@` references anywhere in the file.

If a tool does not pick `AGENTS.md` up, check that tool's current documentation for its instruction-file path rather than guessing at one.

#### .claude/settings.json (Claude Code, optional)

Offer to create `.claude/settings.json` with an allowlist for the commands from step 4, so routine work does not trigger a prompt on every run. Offer, do not impose - ask before writing.

```json
{
  "permissions": {
    "allow": ["Bash(pnpm test:*)", "Bash(pnpm lint:*)", "Bash(pnpm build:*)"]
  }
}
```

Only list read-only or build/test commands. Never allowlist anything destructive or anything that publishes.

This file is Claude Code-specific. The other three agents configure permissions their own way and their schemas move - do not invent a `codex`, `opencode`, or `cursor` config file. `AGENTS.md` rule 4 above covers them in prose instead.

### 8. Write the Verification Plan

Use the `writing-verification-plans` skill to create a verification plan. If it is unavailable, write `VERIFICATION_PLAN.md` covering the acceptance scenarios that prove the project works against real systems, with success criteria and a pass/fail log.

Link it from CLAUDE.md:

```markdown
## Verification

Acceptance testing procedures: read `VERIFICATION_PLAN.md`.

@VERIFICATION_PLAN.md
```

In `AGENTS.md` it is already covered by the Required Reading list - no `@` line there.

### 9. Verify, Then Finish

Documentation that does not run is worse than none. Before this step's commit:

1. **Run every command in the Commands section.** Fix any that fail or do not exist.
2. **Check for unfilled placeholders:** `grep -n '{{' CLAUDE.md AGENTS.md TDD.rules.md` must return nothing.
3. **Check `AGENTS.md` carries no Claude Code-isms:** `grep -n '@\|TodoWrite\|\.claude/' AGENTS.md` should return nothing but ordinary prose. An `@TDD.rules.md` line that leaked in is dead text in Codex CLI, OpenCode, and Cursor.
4. **Check the two files agree** on commands, stack, layout, and boundaries. They are separate documents, so nothing enforces this but you.
5. **Confirm `AGENTS.md` is a real file, not a symlink:** `test -L AGENTS.md && echo "symlink - replace it"`.
6. **Re-read both files end to end** for contradictions between sections.
7. Use the `elements-of-style:writing-clearly-and-concisely` skill if available.
8. Commit.

### 10. Run the Gloria Setup Phase

CLAUDE.md and AGENTS.md are written and committed, so now wire the project fully into [Gloria](https://gloria.dev). Run every step below, in this order. Each step invokes an existing gloria skill, keeps that skill's consent gates, and commits its repo-side output before the next step starts. The phase's own steps are numbered 10.1-10.6, so they can't be confused with steps 1-9 above.

**Track each phase step as a todo**, alongside the todos from steps 1-9.

**Check sign-in first.** Call the `gloria` MCP tool `get_info`:

- It fails because the server is unreachable or you aren't authenticated: follow "Signed out" under the phase rules below.
- It returns an error saying there is no active org, or that your role can't read the org: show the user that error, then follow "Signed out" but give them the error instead of the sign-in instruction. Signing in again won't fix it.

1. **Wire Gloria in (10.1)** - invoke `setting-up-gloria`. It copies `.gloria/USING-GLORIA.md`, adds the Gloria section to CLAUDE.md and AGENTS.md, and resolves the project or registers it with `register_project`. Commit: `chore: wire gloria into the instruction files`.
2. **Refresh the project description and explainer (10.2)** - invoke `documenting-service-dependencies` for a **whole-repo pass**, not a single-dependency touch-up. In its "Describe" step, propose a new `description` even when one already exists. Its consent rule decides whether the new one replaces it. The whole-repo pass regenerates `PROJECT_EXPLAINER`, plus `PACKAGE_MAP` for a monorepo, and pushes them with `put_document`.
3. **Map dependencies and sync them (10.3)** - in that same whole-repo pass, write the four dependency docs, call `put_dependency` for each dependency and `put_document` for each doc, then confirm with `list_dependencies`. Commit the four docs: `docs: map service dependencies`. 10.2 and 10.3 are one invocation, but track and report them separately.
4. **Extract coding standards (10.4)** - invoke `extracting-coding-standards`. It runs `deriving-agent-code-style` and `mapping-packages-for-coding-agents`, registers the standard, rules, and snippets with per-item approval (`register_standard`, `put_rule`, `put_snippet`), and renders the stamped Coding Standards section into both CLAUDE.md and AGENTS.md. Commit: `docs: add the coding standards section`.
5. **Check coding standards (10.5)** - invoke `checking-coding-standards` for a **full audit** against the standards 10.4 registered. It reports with `report_check_run` even when it finds nothing. Record the drift run id it returns. If 10.4 registered no standard (nothing to extract, or its approval was declined), skip 10.5 and record why: there is nothing to audit and no drift run. The audit only reads code, so it has nothing to commit.
6. **Identify skills and author new ones (10.6)** - invoke `identifying-skills-for-a-project`. It inventories, recommends, and then reuses, copies, or authors the missing skills. With consent, it publishes them with `publish_skill` and offers an install. The gloria plugin's own skills, including the ones `.gloria/USING-GLORIA.md` names, are already covered, so don't recommend them as gaps. Look for what this project needs beyond them. Authoring a new skill needs `writing-skills`, a superpowers skill that the gloria plugin doesn't include. If `writing-skills` is unavailable, list each skill that would be authored with its rationale, and say what to install: the superpowers plugin. Commit only the project-local install paths the user chose to commit. Never commit the `.context/` staging directory, which a new repo doesn't ignore yet, so name the paths and never `git add -A`.

Phase rules:

- **Re-check the instruction files.** 10.1 and 10.4 edit CLAUDE.md and AGENTS.md after step 9 checked them. When the phase ends, re-run step 9's checks 2-6 on both files, fix anything they find, and commit the fix.
- **One final report.** End the phase with a single report:
  - each step's result;
  - what was written to the repo;
  - what was sent to gloria.dev: the project, N dependencies, N docs, the standard with N rules and N snippets, the drift run id, and the skills published or installed;
  - what was skipped, and why.
- **Signed out.** If the gloria MCP server is unavailable or not signed in, do only the repo-side work. That is 10.1's doc and Gloria sections and 10.3's four local dependency docs, each committed. Skip the rest: `PROJECT_EXPLAINER` and `PACKAGE_MAP` exist only on gloria.dev, and the Coding Standards stamp is the version of a registered standard. End the phase with the exact sign-in instruction for the user's agent:
  - Claude Code: run `/mcp`, select `gloria`, and authenticate.
  - Codex CLI: run `codex mcp login gloria` in your shell.
  - OpenCode and Cursor: the first gloria tool call opens a one-time browser sign-in.

  Say that 10.1-10.6 can be rerun once signed in. Give the final report, then go on to step 11. Never report a sync, registration, standard, drift run, or publish that didn't happen.

- **Registration declined.** If the user declines to register the project in 10.1, treat 10.2-10.6 as signed out: every server write in them needs the project, and `documenting-service-dependencies` would otherwise register it without asking. Do their repo-side work only, and report the rest as skipped because registration was declined.
- **A write is refused.** If the server refuses a write because of the user's role, record that step as skipped with the error, and continue. Don't retry it.
- **Empty or near-empty codebase.** Still run every step. When a code-derived step finds nothing, record "nothing to extract yet" for it. Never make up dependencies, rules, snippets, or skills to fill a step. The final report says which steps to rerun once the project has code, usually 10.2-10.6.
- **A declined consent gate skips that one step's write.** Record it as skipped with the reason, and continue with the next step.

### 11. Offer Next Steps

Ask if the user would like to start brainstorming requirements or an implementation plan. Use the `superpowers:brainstorming` skill (if available) or the `superpowers:writing-plans` skill (if available) if they say yes.

## The Finished Files

Sections in this order. Omit any that do not apply.

```text
CLAUDE.md                 (Claude Code)
# <Project Name>

## Project Overview       (problem, approach)
## Tech Stack
## Commands
## Repository Layout
## Environment
## Development Practices  (TDD → read + @TDD.rules.md, commit rules, git/PR workflow)
## CI/CD Practices        (only if GitHub Actions)
## Boundaries
## Verification           (read + @VERIFICATION_PLAN.md)
## Gloria                 (step 10: setting-up-gloria)
## Coding Standards       (step 10: extracting-coding-standards)
```

```text
AGENTS.md                 (Codex CLI, OpenCode, Cursor)
# <Project Name> - Agent Instructions

## Required Reading       (TDD.rules.md, VERIFICATION_PLAN.md - no @ imports)
## Non-Negotiables        (condensed inline; nothing auto-loads here)
## Project Overview       ┐
## Tech Stack             │
## Commands               │ same content as CLAUDE.md,
## Repository Layout      │ written out in full
## Environment            │
## Development Practices  │ (inline, not referenced)
## CI/CD Practices        │
## Boundaries             ┘
## Maintaining This File  (change one, change both, same commit)
## Gloria                 (step 10: setting-up-gloria)
## Coding Standards       (step 10: extracting-coding-standards)
```

Alongside them: `TDD.rules.md`, `CLAUDE-specific-fuckups.md`, `VERIFICATION_PLAN.md`, and optionally `.claude/settings.json`. Step 10 adds `.gloria/USING-GLORIA.md` and the four dependency docs.

## Key Principles

- **Survey before asking** - the repo answers most tech stack questions itself
- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **DRY ruthlessly** - Long rule sets live in their own file and get referenced, not pasted
- **Assume nothing auto-loads** - outside Claude Code, a file is read only if the instructions say to read it
- **Incremental validation** - Present each file in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense

## Common Mistakes

- Interviewing the user about a stack the lockfile and CI workflow already describe
- Overwriting an existing CLAUDE.md or AGENTS.md instead of merging into it
- Symlinking `AGENTS.md` to `CLAUDE.md` - it ships Claude Code's `@` imports and tool names to agents that understand neither
- Leaving an `@` reference in `AGENTS.md`, where it is dead text
- Writing `AGENT.md` instead of `AGENTS.md` - no agent reads the singular
- Letting the two files drift after a command or boundary changes
- Leaving `{{TEST_COMMAND}}` and friends unreplaced in the project's `TDD.rules.md`, or leaving its template note (which names them) at the top
- Pasting the full TDD rules into either file instead of pointing at `TDD.rules.md`
- Documenting commands without running them once to confirm they work
- Writing a whole file at once instead of validating section by section with the user
- Asking many questions in a single message and overwhelming the user
- Paraphrasing the TDD rules or commit rules instead of copying them verbatim

---

Ported from [britt/agent-skills](https://github.com/britt/agent-skills/tree/a048db47b7c92d921e4f3ab7583eca530d645e3a/skills/setting-up-a-project) at `a048db47` (MIT License), adapted for gloria.dev: bundled files are never fetched from the network, and step 10 runs the full Gloria setup phase.
