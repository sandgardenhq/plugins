---
name: deriving-agent-code-style
description: Use when asked to turn a codebase's linter, formatter, and compiler configuration into agent-facing code style instructions — "write code style rules for agents", "summarize our lint rules as best practices", "add a Code Style section to CLAUDE.md / AGENTS.md", "what conventions should an agent follow in this repo". Reads every config layer per package, detects where linting silently doesn't run, mines observed conventions from the source, and emits an imperative Code Style section with each rule labeled by what enforces it.
---

# Deriving Agent Code Style from a Codebase

## Overview

Translate what a repo's toolchain **enforces** and its source **practices** into imperative
instructions a coding agent can follow while writing — a "Code Style & Formatting" section for
`CLAUDE.md` / `AGENTS.md`.

**Core principle: the configs are the spec, and every claim is verified per package.** Never
write a rule from a remembered default, and never generalize a root config to the whole repo
without reading each package's overrides. The most valuable findings are usually the
_discrepancies_ — a package whose linter silently skips files, a root flag three packages turn
off — because those are exactly where an agent's assumptions will be wrong.

## When to Use

- "Turn our lint rules into coding best practices / agent instructions"
- "Write the code style section of CLAUDE.md / AGENTS.md"
- Onboarding an agent to a repo whose conventions live only in configs and code
- After a lint/formatter migration, to regenerate the agent-facing rules

**Don't use for:** designing or changing lint configs themselves; enforcing style in review
(run the linters); documenting architecture (this is style/mechanics only).

## Process

### Step 1 — Inventory every config layer

Find them all before reading any. Search the whole tree (monorepos hide per-package configs):

| Layer              | Files to look for                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatter          | `.prettierrc*`, `prettier.config.*`, `biome.json*`, `.editorconfig`, `rustfmt.toml`, `pyproject.toml [tool.black/ruff]`, `gofmt` (implicit) |
| Linter             | `eslint.config.*`, `.eslintrc*`, `.oxlintrc*`, `biome.json*`, `ruff.toml`, `.golangci.yml`, `clippy.toml`, `stylelint*`                     |
| Compiler-as-linter | `tsconfig*.json`, `pyproject.toml [tool.mypy]`, compiler warning flags in build files                                                       |
| Orchestration      | root `package.json`/`Makefile`/`turbo.json`/CI workflows — how lint/format actually run                                                     |
| Stated rules       | `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` — conventions humans already wrote down                                                         |

Read **every** linter config individually, even when they look copy-pasted. In this repo,
three of four packages wire `typescript-eslint` and one doesn't — a one-line difference that
changes what "lint passes" means.

### Step 2 — Read the compiler config as style rules

Strictness flags are writing instructions in disguise. Translate each into what the agent must
do at the keyboard, e.g. (TypeScript):

| Flag                         | Instruction it becomes                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| `strict`                     | Handle `null`/`undefined` explicitly; no implicit `any`            |
| `noUncheckedIndexedAccess`   | Treat `arr[i]` / `record[k]` as `T \| undefined`; guard, never `!` |
| `noFallthroughCasesInSwitch` | Every non-empty `case` ends in `break`/`return`/`throw`            |
| `verbatimModuleSyntax`       | Write `import type { X }` for type-only imports                    |
| `module`/`type: module`      | ESM only — `import`/`export`, never `require`                      |
| `paths`                      | Use the aliases (`@scope/pkg/*`, `@/*`), not `../../..` chains     |

### Step 3 — Build the per-package rule matrix

For each rule, record **where it applies**. Check every package's config for overrides of the
root before writing "always" or "everywhere":

- A root `tsconfig` flag a package sets to `false` (e.g. `verbatimModuleSyntax` off for
  bundler compatibility) → the rule is "convention everywhere, hard error in package X".
- A rule present in one package only (e.g. `argsIgnorePattern: "^_"` in one ESLint config) →
  say which package enforces it and whether to follow it repo-wide anyway.
- Language-specific gotchas that make configs non-additive (e.g. a package-level tsconfig
  `types` array **replaces** the root list rather than merging).

### Step 4 — Detect config-vs-reality gaps

This is where a naive pass fails. For each package, confirm the linter actually lints the
source it appears to cover:

- **Parser gaps:** ESLint 9 without the `typescript-eslint` parser **silently skips every
  `.ts` file** — `eslint .` exits clean while linting nothing. Equivalents exist in other
  ecosystems (missing plugin, wrong `files` glob).
- **Ignore gaps:** an `ignores` entry that swallows real source, not just generated output.
- **Wiring gaps:** a lint script that exists but isn't in CI, or a package missing from the
  orchestrator's lint task.

When unsure, prove it: drop a deliberate violation (an unused variable, an explicit `any`)
into a covered file and run the package's lint command. Clean output on a dirty file = gap.
Revert the probe. Every gap found goes in the output as a warning ("a clean lint in X proves
nothing — rely on the compiler and tests there"), because an agent will otherwise treat that
green check as evidence.

### Step 5 — Mine observed conventions from the source

Configs don't capture everything agents copy. Sample several real source files per package and
extract the conventions in actual use: file naming (kebab vs Pascal, and exceptions by
directory), export naming, test file placement and naming, import style (extensions, barrels,
aliases vs relative), comment register (JSDoc on exports? why-comments in configs?), and
domain idioms (schema/DAO layering, error-handling shape, date representation). Reconcile with
what `CLAUDE.md`/`CONTRIBUTING.md` already states — and note where stated rules and observed
code disagree rather than silently picking one.

### Step 6 — Write the section

Rules for the output itself:

- **Imperative, second person.** "Never use `any`; take `unknown` and narrow" — not "the
  config enables `no-explicit-any`". The agent needs instructions, not a config tour.
- **Label each rule's authority:** enforced (a tool errors), stated (humans wrote it down), or
  observed (convention in the code). An agent may bend an observed convention with reason; it
  must never bend an enforced rule.
- **Quote real values** from the configs (line width, quote style, thresholds). No remembered
  defaults.
- **List the never-edit files:** everything lint-ignored because it's generated, with the
  regenerate command for each.
- **End with the verify commands** — the exact lint/format/build invocations that must pass
  before claiming done — plus any Step 4 caveats about what a clean run does _not_ prove.
- Skeleton: Formatting → Language/compiler rules → Linter rules (per package where they
  differ) → framework-specific rules → naming & layout conventions → never-edit files →
  verify-before-done.

Default output location: a standalone doc (e.g. `docs/AGENT_CODE_STYLE.md`) ready to paste
into `CLAUDE.md`/`AGENTS.md`, unless asked to edit those files directly. Note in the doc that
the configs win if the two ever disagree.

## Common Mistakes

| Mistake                                                             | Fix                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Reading root configs and generalizing ("enforced in every package") | Read each package's config; build the Step 3 matrix before writing "always"       |
| Describing configs instead of instructing the agent                 | Every bullet starts with a verb aimed at the writer of the next diff              |
| Trusting remembered tool defaults                                   | Quote the actual config value or run the tool to check                            |
| Assuming `lint` passing means the code was linted                   | Step 4: verify coverage per package; probe with a deliberate violation if unsure  |
| Only reading configs and skipping the source                        | Configs miss naming, layout, test placement, comment register — sample real files |
| Mixing enforced rules and conventions without labels                | Tag each rule: enforced / stated / observed                                       |
| Omitting the verify commands                                        | Close with the exact commands and their caveats                                   |

## Quality Checklist

- [ ] Every config file in the repo located and read (per package, not just root)
- [ ] Compiler strictness flags translated into writing instructions
- [ ] Per-package differences called out explicitly; no unverified "everywhere"
- [ ] Lint coverage gaps detected and flagged with their consequence
- [ ] Observed conventions sampled from real source in each package
- [ ] All rules imperative and labeled by authority
- [ ] Generated never-edit files listed with regenerate commands
- [ ] Verify-before-done command block included
- [ ] Output passes the repo's own formatter
