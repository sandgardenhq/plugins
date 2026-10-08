---
name: using-coding-standards
description: Use while writing code in a project with a registered gloria Coding Standards library — before implementing anything pattern-shaped (a DAO, an API route, a migration, a test harness, a channel adapter), and whenever CLAUDE.md carries a "## Coding Standards" section with a gloria:standards stamp. Also fires for "follow/use our standards while writing this", "write this the way we do", and "register/contribute this back as a snippet". Drives the write-time discipline: find_snippets before writing, adopt or adapt the canonical exemplar, leave a gloria:snippet provenance marker, contribute reusable shapes back via put_snippet, and justify deliberate divergence.
---

# Using Coding Standards While Writing

## "Register" / "contribute a snippet" means call put_snippet

Consulting the library is a gloria MCP call, not memory: **`find_snippets`**
before writing pattern-shaped code. And when the user says **"register"**,
**"contribute"**, or **"add" this back as a snippet** — or you produce a reusable
shape worth sharing — that means **calling the gloria MCP tool `put_snippet`**
(with the user's approval), not just leaving the code in place. The write-time
loop is: `find_snippets` → adopt/adapt → leave the `gloria:snippet` marker →
`put_snippet` for genuinely reusable new shapes.

## Overview

A project with a gloria standards library has already decided what its patterns look like.
This skill is the write-time half of the loop: **consult the library before writing
pattern-shaped code, copy the canonical exemplar instead of improvising, and leave a marker
so reuse is verifiable.**

**Core principle: the snippet is the decision, the marker is the receipt.** Adopting the
canonical snippet keeps the codebase converged; the provenance marker makes that reuse
greppable, so the checker verifies claimed reuse deterministically instead of guessing.

## When to Use

- About to write something pattern-shaped: a new DAO, statement builder, API route,
  migration, worker handler, test file, UI list component — any "another one of those"
- The repo's `CLAUDE.md`/`AGENTS.md` has a `## Coding Standards` section (the
  `<!-- gloria:standards vN -->` stamp is the tell)

**Don't use for:** genuinely one-off logic with no repeating shape; repos with no registered
standards (nothing to consult); extracting or checking standards (their own skills).

## Process

### Step 1 — Search before writing

Before writing the first line of a pattern-shaped change:

```
find_snippets { projectSlug, language, query }
```

Query with the pattern's name as the repo speaks it ("D1 DAO", "api route zod", "d1
migration"). The search ladders exact → contains → fuzzy, so a short natural phrase works.

### Step 2 — Decide on the ladder

| Match                                                          | Action                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Strong match** — the snippet is the shape you need           | Adopt it. Fill every `TODO:` placeholder. Marker: `(verbatim)`                                                                |
| **Partial match** — right pattern, needs structural adaptation | Adapt it. Keep the structural skeleton, change what must change, fill every placeholder. Marker: `(adapted)`                  |
| **No match, but the shape will recur**                         | Write it well, then contribute it back: `put_snippet` with placeholders and linked `ruleIds` (ask the user before publishing) |
| **No match, genuinely one-off**                                | Write normally. No marker, no contribution                                                                                    |

Never leave a `TODO:` placeholder unfilled in committed code — placeholders are the snippet's
customization points, and an unfilled one means the adaptation is incomplete.

### Step 3 — Leave the provenance marker

On the adopted/adapted unit (top of the function, class, or file section it produced), in the
language's comment syntax:

```
// gloria:snippet <project>/<snippet-id> (verbatim|adapted)
```

Exact grammar: the literal `gloria:snippet`, one space, the project slug, `/`, the snippet id,
one space, then `(verbatim)` or `(adapted)`. Examples:

```typescript
// gloria:snippet gloria-dev/d1-dao (adapted)
```

```sql
-- gloria:snippet gloria-dev/d1-migration (verbatim)
```

`verbatim` means structure copied with only placeholders filled; `adapted` means you changed
structure beyond the placeholders. When in doubt, `adapted`.

### Step 4 — Justify divergence

If a strong match exists but you deliberately deviate from it, say why in an adjacent comment:

```typescript
// gloria:snippet gloria-dev/d1-dao (adapted) — diverges: streaming read, so no
// row-array mapping; see #412
```

Documented divergence is legitimate for `observed`-authority rules and snippet patterns; the
checker treats it as intent, not drift. **`enforced` rules have no such escape hatch** — never
"diverge" from a rule a tool blocks.

## Common Mistakes

| Mistake                                        | Fix                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Writing the pattern from memory, then checking | `find_snippets` first — the snippet may encode decisions you'd re-litigate |
| Adopting without filling placeholders          | Every `TODO:` filled before the code is done                               |
| Marker on the wrong granularity                | Mark the unit the snippet produced, not the whole file it lives in         |
| Claiming `(verbatim)` after structural edits   | Structural change = `(adapted)`; the checker compares faithfulness         |
| Silent divergence from a strong match          | One comment line saying why; silence reads as unattributed duplication     |
| Contributing one-off code as a snippet         | Contribute only shapes that will recur; ask the user before `put_snippet`  |

## Quality Checklist

- [ ] `find_snippets` called before writing anything pattern-shaped
- [ ] Every adopted/adapted snippet carries a correctly-formed `gloria:snippet` marker
- [ ] Every `TODO:` placeholder filled
- [ ] Deliberate divergence justified in an adjacent comment
- [ ] Recurring new shapes offered back via `put_snippet` (with user approval)
