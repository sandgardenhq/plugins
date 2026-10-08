---
name: extracting-coding-standards
description: Use to set up or register gloria Coding Standards for a project. Fires for plain requests to register or sync standards with gloria — "register our coding standards with gloria", "sync our conventions with gloria", "save our rules to gloria", "register our coding conventions" — and to derive them — "extract our coding standards", "derive rules and snippets from this repo", "set up the standards library". Orchestrates deriving-agent-code-style and mapping-packages-for-coding-agents, structures their findings into stable rules (slug ids, authority labels, scope, evidence), mines one canonical placeholder-ized snippet per rule-implied pattern, registers everything via the gloria MCP tools (register_standard, put_rule, put_snippet) with per-item approval, and renders a version-stamped Coding Standards section into CLAUDE.md/AGENTS.md.
---

# Extracting Coding Standards from a Codebase

## "Register" / "sync" means call the gloria MCP tools

When the user says **"register"**, **"registering"**, or **"sync"** our coding
standards, rules, conventions, or snippets **with gloria** (e.g. "register our
coding standards", "sync our conventions with gloria", "save our rules to
gloria"), that means **calling the gloria MCP tools** — `register_standard` to
ensure the standard exists, then `put_rule` per rule and `put_snippet` per
snippet (with per-item approval) — **not** just writing them into `CLAUDE.md` or
a doc. The registered library is the source of truth `checking-coding-standards`
flags violations against; getting the rules and snippets into gloria via those
tools is the point of this skill.

## Overview

Turn a repo's coding intent — configs, written conventions, and the consistent-but-unwritten
patterns in its source — into gloria's checkable form: **rules** (imperative instructions with
stable identities) and **snippets** (canonical exemplars of the patterns the rules imply),
registered in the project's standards library and rendered ambiently into `CLAUDE.md`/`AGENTS.md`.

**Core principle: every rule traces to evidence, and nothing is registered without the user
seeing it first.** A rule you cannot point at a config, a doc, or a set of source files is a
guess, not a standard. The registered library is the source of truth checkers will flag
violations against — polluting it with invented rules turns every future check run into noise.

## When to Use

- First-time Coding Standards setup for a project ("extract/register our standards")
- Re-extraction after a big convention shift (new lint setup, architecture change)
- Adding snippet coverage for a pattern the library missed

**Don't use for:** checking code against already-registered standards (use
`checking-coding-standards`); consulting snippets while writing (use `using-coding-standards`);
deriving style rules without registering them (use `deriving-agent-code-style` alone).

**Requires:** the gloria MCP server connected, and the project registered
(`register_project` / `list_projects` to confirm the slug).

## Process

### Step 1 — Gather the raw derivations

Run the two analysis skills (or reuse their prior output if it exists and is current — check
that the configs it cites haven't changed since):

1. **`deriving-agent-code-style`** — configs → imperative style rules, each already labeled
   enforced / stated / observed with per-package scope.
2. **`mapping-packages-for-coding-agents`** — package map: what each package owns, its layering,
   and the architectural patterns in use.

Also read `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` directly: stated rules that never made
it into configs (data-access discipline, commit conventions, domain-model placement) are prime
rule material the style derivation may have skimmed.

### Step 2 — Structure findings into rules

Convert each finding into a rule object:

| Field         | What it must be                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ruleId`      | Stable kebab-case slug naming the _behavior_, not the tool: `all-d1-access-via-daos`, not `eslint-rule-37`. This is the identity per-finding history hangs off — pick it as if it will live for years. |
| `instruction` | Imperative, second person, self-contained: an agent reading only this line knows what to do.                                                                                                           |
| `authority`   | `enforced` — a tool blocks violations (lint error, compile error, CI gate). `stated` — written in CLAUDE.md/docs but nothing blocks it. `observed` — consistent in the source, written nowhere.        |
| `scope`       | Globs and/or package paths where the rule applies. Omit only for genuinely repo-wide rules.                                                                                                            |
| `evidence`    | The files the rule was derived from: the config that enforces it, the doc that states it, or the source files that exhibit it.                                                                         |

Worked examples from gloria.dev itself:

```json
{
  "ruleId": "all-d1-access-via-daos",
  "instruction": "Route every D1/R2 query through a @gloria/core DAO; never write raw SQL, db.prepare(), or bucket.get/put in packages/web or packages/mcp.",
  "authority": "stated",
  "scope": { "packages": ["packages/web", "packages/mcp", "packages/jobs"] },
  "evidence": { "sources": ["CLAUDE.md"] }
}
```

```json
{
  "ruleId": "sql-only-in-statement-builders",
  "instruction": "Keep SQL strings exclusively inside pure *Statement(...) builder functions that return { sql, params }; DAOs execute builders and map rows, never embed SQL.",
  "authority": "observed",
  "scope": { "packages": ["packages/core"] },
  "evidence": {
    "sources": ["packages/core/src/skill-statements.ts", "packages/core/src/skill-dao.ts"]
  }
}
```

```json
{
  "ruleId": "unix-timestamps-for-dates",
  "instruction": "Store all dates as Unix-second integers, never strings; name columns *_at and domain fields *At.",
  "authority": "stated",
  "scope": {},
  "evidence": {
    "sources": ["CLAUDE.md", "packages/web/migrations/0003_projects_dependencies_documents.sql"]
  }
}
```

Where a stated rule and observed practice disagree, create the rule from the stated intent and
note the discrepancy in the instruction's evidence — do not silently pick the code's side.

### Step 3 — Mine exemplar snippets

For each **architectural pattern the rules imply** — "a DAO", "a statement builder + row
transformer", "an API route with Zod validation", "a D1 migration", "a Workers vitest test" —
find the best real instance in the repo and distill it:

1. **Pick the exemplar deliberately.** The best instance is complete, current, and idiomatic —
   usually a recently-touched file the team would point a new hire at, not the oldest or
   largest one.
2. **Placeholder-ize.** Replace the instance-specific parts (entity names, table names, field
   lists) with `TODO:` markers naming what goes there. Everything structural stays verbatim.
3. **Header comment** stating purpose and usage in two lines.
4. **Cross-link**: list the `ruleId`s the snippet embodies — a DAO snippet embodies
   `all-d1-access-via-daos` and `sql-only-in-statement-builders`.
5. `snippetId` is a stable kebab-case slug for the pattern (`d1-dao`, `api-route-zod`), and
   `language` the file's language (`typescript`, `sql`).

One canonical snippet per pattern. Two competing exemplars for the same pattern means the repo
has drift — pick the intended one and let `checking-coding-standards` flag the other.

### Step 4 — Register with per-item approval

Present the full rule and snippet list to the user grouped by authority, each with its evidence,
and ask for a batch approval ("register all", or exclude items by id). **Never register anything
the user has not seen** — a blanket "I trust you, skip the review" given _before_ the list
existed does not count; the user must see what "everything" is. Then, via the gloria MCP tools:

1. `register_standard { projectSlug }` — ensures the standard exists.
2. `put_rule { projectSlug, ruleId, instruction, authority, scope, evidence }` per approved rule.
3. `put_snippet { projectSlug, snippetId, language, name, description, code, placeholders, ruleIds }`
   per approved snippet.
4. `get_standards { projectSlug }` — read back the final version number `N` for Step 5.

### Step 5 — Render the ambient section

Ask before editing `CLAUDE.md` / `AGENTS.md`. Then write (or replace) a `## Coding Standards`
section:

- Open with the stamp comment so a stale render is itself detectable drift:
  `<!-- gloria:standards v<N> -->`
- Rules imperative, second person, grouped by authority (`enforced` first), sub-grouped per
  package where scopes differ.
- The snippet nudge, replacing SGAI's runtime-injected nudge with an ambient one:
  > Before writing pattern-shaped code (a DAO, an API route, a migration…), call gloria
  > `find_snippets(language, query)` and adapt the canonical snippet. Mark adopted code with
  > `// gloria:snippet <project>/<snippet-id> (verbatim|adapted)`.
- Close with the verify-before-done commands from the style derivation.

Finally record the render: `register_standard { projectSlug, renderedStamp: N }`.

## Common Mistakes

| Mistake                                         | Fix                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Inventing rules with no evidence pointer        | Every rule cites the config/doc/source it came from; no citation → no rule                                         |
| Tool-shaped rule ids (`eslint-no-explicit-any`) | Name the behavior (`no-any-narrow-unknown`); ids outlive the toolchain                                             |
| Registering before the user approved            | Present the full list first; register only approved items                                                          |
| Snippets with instance details left in          | Placeholder-ize every customization point with a named `TODO:`                                                     |
| Snippet linked to no rule                       | If no rule implies the pattern, either add the (evidenced) rule or drop the snippet                                |
| Editing CLAUDE.md/AGENTS.md unasked             | Ask first; some repos generate those files                                                                         |
| Forgetting the rendered stamp                   | Without `<!-- gloria:standards vN -->` + `register_standard { renderedStamp }`, render_stale drift is undetectable |

## Quality Checklist

- [ ] Both derivation skills run (or their prior output verified current)
- [ ] Every rule has a stable behavior-named slug, imperative instruction, authority label, and evidence
- [ ] Stated-vs-observed disagreements surfaced, not silently resolved
- [ ] One placeholder-ized snippet per rule-implied pattern, cross-linked to its rules
- [ ] Per-item approval obtained before any `put_rule` / `put_snippet`
- [ ] `## Coding Standards` section rendered with the version stamp and snippet nudge (with permission)
- [ ] `register_standard` called with the rendered stamp
