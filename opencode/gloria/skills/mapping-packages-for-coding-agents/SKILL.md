---
name: mapping-packages-for-coding-agents
description: Use when you need to tell a coding agent which package (or workspace, or layer) a change belongs in — "generate package-routing guidance", "add a Package Routing section to CLAUDE.md / AGENTS.md", "when should the agent use each package", "map our monorepo for agents", "which package does this change go in". Reads the codebase, derives the internal dependency graph and each package's role, and emits an imperative, agent-facing routing block (per-package "put here / not here" + a decision table) grounded in the actual code.
---

# Mapping Packages for Coding Agents

## Overview

Analyze a codebase and produce **package-routing guidance for a coding agent**: a compact, imperative block — destined for `CLAUDE.md` / `AGENTS.md` — that answers one question for every change an agent might make: **"which package does this belong in?"**

It is a sibling to `documenting-service-dependencies`, `defining-the-documentation-site-map`, and `identifying-skills-for-a-project`: a Markdown skill that runs inside a coding agent, reads the codebase, and emits filesystem Markdown — **no D1 dependency** for local/agent use.

**Core principle: derive the routing from the code — the internal dependency graph and each package's real role — not from a template or from prose alone.** The output is _routing instructions_ (where does a change go?), not _documentation_ (what is in each package?). Every line must change a routing decision or be cut.

| Output                                                                                         | Contents                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PACKAGE_ROUTING.md` (or a `## Package Routing` section pasted into `CLAUDE.md` / `AGENTS.md`) | The dependency direction + the one or two hard rules that govern boundaries; a per-package block (one-line "what it is" → "put here when" triggers → "do NOT put here" boundary); a quick decision table; the common cross-package change shape. |

Emit the block by default. **Offer to insert it into `CLAUDE.md` / `AGENTS.md`, but ask before editing those files** — they are load-bearing. Default to writing/printing the standalone block and letting the user place it.

## The routing-vs-description rule (the most important step)

An agent already reads the code; it doesn't need you to re-list what each package _contains_. It needs to decide **where a new change goes**. So write every bullet as a **trigger or symptom**, phrased from the change's point of view:

- ✅ "Adding or changing a database query, schema, or domain rule" → routes the change.
- ❌ "Contains the DAOs, Zod schemas, and statement builders" → describes the package; helps nobody route.

Test each line: _"Does this help an agent pick this package over another for a specific change?"_ If not, delete it. This single rule is what separates useful routing guidance from a package README.

## What good routing guidance contains

1. **Dependency direction, stated first.** The one-way graph (who depends on whom) is the spine of every routing decision. State it in one sentence and name the consequence: _changes to shared meaning/data land in the most-depended-on package first; the packages that depend on it are thin._
2. **The one or two hard rules that govern boundaries.** The invariants an agent will otherwise violate (e.g. "all data access goes through package X," "no HTTP/UI concerns in the shared package"). Lead with these; they prevent the most damage.
3. **Per-package blocks**, each with:
   - a **one-line "what it is"** (role, not feature list);
   - **"Put here when you are…"** — imperative, trigger-based bullets, with **representative** files/globs (`*-dao.ts`, `app/api/**/route.ts`), never an exhaustive file dump;
   - **"Do NOT put here"** — the negative boundary, each item redirecting to the correct package.
4. **A quick decision table** — "change is about X → package" — for one-glance lookup.
5. **The common cross-package shape.** Most real changes span two packages (e.g. shared package → transport). Name that shape so the agent expects it.

## Process

1. **Detect the packages (the routing targets).** Find the workspace boundaries — don't assume `/packages/*`:
   - JS/TS: root `package.json` `workspaces`, `pnpm-workspace.yaml`, `bun`/`turbo.json`, `nx.json`, `lerna.json`, tsconfig `references`.
   - Other stacks: Cargo workspace members, `go.work`, Gradle/Maven modules, Python `pyproject`/namespace packages.
   - **Single-package repo?** There are no packages to route between — route across the top-level **layers/modules/directories** instead (e.g. `handlers/` vs `domain/` vs `db/`), and say so explicitly. The rest of this skill applies with "package" read as "module."

2. **Build the internal dependency graph.** For each package, read its manifest for **internal** deps (`workspace:*`, `@scope/*`, module paths) and **confirm with real imports** (grep for cross-package import specifiers). Draw the arrows: who depends on whom. The most-depended-on package with no internal deps of its own is the **shared/domain leaf**; packages that depend on it and are depended on by nothing are **entrypoints**. This graph, not intuition, decides routing.

3. **Classify each package's role** from its deps, its imports, and its scripts/config:
   - **Shared / domain** — depended on by others, depends on none internally (schemas, business logic, data access).
   - **Transport / entrypoint** — HTTP API, UI, MCP/RPC server, CLI, cron/queue worker. Identify which by framework signals (`next`, `wrangler`, MCP SDK, a CLI bin, `main`).
   - **Infra / config / tooling** — build, codegen, fixtures.

4. **Extract the hard rules — reconcile declared vs. actual.** Read `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING` for stated architectural rules ("all D1/R2 access through DAOs," "core never owns a binding"). **Verify each against the code** (grep that the shared package is the only one importing the db/client) and cite one or two representative files. Where a rule is declared but the code contradicts it, note the drift rather than parroting the doc. Where **no** rule is declared, derive the boundary from the graph (e.g. only the shared package imports the ORM → that _is_ the rule; state it).

5. **Write the per-package blocks** (anatomy above). Prefer **globs and 2–4 representative files** over exhaustive lists — the guidance must stay short and survive refactors. Every "put here" bullet is a trigger; every "do NOT" bullet redirects.

6. **Write the decision table and the cross-package shape.** Map the changes an agent actually makes to packages. Then state the dominant multi-package pattern ("shared schema+access → transport call site") so spanning changes aren't a surprise.

7. **Keep it at agent-instruction altitude.** This block loads into **every** agent turn once it's in `CLAUDE.md`. Be imperative and scannable; cut anything that reads like a README. If it's longer than a screen or two per package, you're describing, not routing.

8. **Report and offer placement.** Summarize the graph you derived, the hard rules (and any declared-vs-code drift), and offer to paste the block into `CLAUDE.md` / `AGENTS.md` — **asking first**.

## Output structure (the block)

Author it as a drop-in section so it pastes straight into an agent-instructions file:

```markdown
## Package Routing

Packages under `<workspace glob>`. Dependency direction is one-way: `A`, `B`, `C`
depend on `core`; `core` depends on none of them. **Decide which package a change
belongs in before writing code.** <the one hard rule that governs boundaries>.

### `core` (`packages/core`)

<one-line role>.

- Put here: <trigger>, <trigger> — representative files/globs.
- <Hard rule that lives here, e.g. the data-access rule>.
- Not here: <concern> (→ `A`), <concern> (→ `B`).

### `A` (`packages/a`)

<one-line role>.

- Put here: <trigger>, <trigger> — `app/api/**/route.ts`, …
- Not here: <concern> (→ `core`).

… (one block per package) …

### Quick routing

| Change is about…               | Package |
| ------------------------------ | ------- |
| <domain concept / data access> | `core`  |
| <HTTP endpoint / page>         | `A`     |
| <scheduled/background job>     | `B`     |
```

## Common Mistakes

- ❌ **Describing packages instead of routing changes.** Re-listing every file/type a package "contains." Rewrite each line as a trigger: _what change sends an agent here?_
- ❌ **Skipping the dependency graph.** Guessing layers from names instead of reading manifests + imports. The graph is the routing spine — derive it.
- ❌ **Exhaustive file dumps.** Listing all 80 files in a package. Use globs + a few representative files; this block must stay short and survive refactors.
- ❌ **Parroting CLAUDE.md without verifying.** Repeating a declared rule the code no longer follows. Reconcile declared vs. actual; cite a file; note drift.
- ❌ **No negative boundaries.** "Put here" lists with no "do NOT put here." The redirects are what stop misplacement.
- ❌ **Wrong altitude.** A prose essay per package. This loads every agent turn — keep it imperative and scannable, or it costs tokens on every request.
- ❌ **Assuming a monorepo.** Forcing package-routing onto a single-package repo. Route across layers/modules instead and say so.
- ❌ **Editing `CLAUDE.md` unprompted.** It's load-bearing. Emit the block and ask before inserting.

## Reference Example

A well-formed block leads with the dependency direction and the single governing rule, then gives each package a one-line role, a short trigger-based "put here" list (globs, not file dumps), and a redirecting "not here" line, and closes with a decision table. For the shape and voice to match, see the routing block this skill produces for a shared-core-plus-transport-layers monorepo: one leaf domain package that owns schemas + data access, and thin HTTP / MCP / scheduled-worker packages that depend on it — the routing rule ("data and domain logic go in the leaf; the others are doors to it") falls directly out of the dependency graph.
