---
name: checking-coding-standards
description: Use to check code against a project's registered gloria Coding Standards. Fires for plain requests to compare code with the rules — "check this against our standards", "does this drift from our rules/conventions", "are we following our own standards", "review this for standards compliance", "check this PR against our standards", "run a standards check", "audit the repo for drift", "has our code drifted from the rules" — including before or after implementing a change in a project that has registered standards. Runs diff-scoped checks (the per-PR workhorse), cheap metadata checks (render stamp + rule-evidence staleness), or a full audit (snippet staleness included), and reports findings to the gloria drift ledger via report_check_run. Read-only: findings, never edits.
---

# Checking Code Against Standards

## "Check against our standards" is a gloria action; reporting means calling report_check_run

When the user asks to **check, audit, or compare** code **against the project's
standards / rules / conventions** — or asks whether code **drifts** from them —
that is this skill, driven by gloria's registered library (`get_standards`), not
an ad-hoc code review from memory. **Reporting** the findings — the sync half —
means **calling the gloria MCP tool `report_check_run`**, which records them to
gloria's drift ledger; it is not just printing a summary in chat. Load the
standards, evaluate, then `report_check_run` (even when findings are empty).

## Overview

The probe half of gloria Coding Standards: evaluate code against the project's registered rules
and snippet library, and report what has drifted to the backend ledger. The agent is the probe;
the backend is the ledger — **this skill never edits source, it only observes and reports.**

**Core principle: every finding traces to a specific rule or snippet id.** A finding that can't
name what it violates is a vibe, and vibes-based findings poison the ledger — they train people
to dismiss it.

## When to Use

- Reviewing a PR / branch in a project with registered standards (diff-scoped run)
- A periodic or on-demand whole-repo recalibration (full audit)
- Any check invocation at all (metadata checks ride along free)

**Don't use for:** fixing the violations (report first; fixing is a separate, explicitly
requested task); repos with no registered standards — confirm with `get_standards` and stop if
`version` is null.

## Process

### Step 0 — Load the standards

```
get_standards { projectSlug }   →  version N, rules[]
```

If `version` is null, there is nothing to check against — say so and suggest
`extracting-coding-standards`. Record `startedAt` (Unix seconds) now; every finding this run
produces must cite a `ruleId` or `snippetId` from what this call returned.

### Step 1 — Metadata checks (every run, cheap)

1. **Render staleness:** the stamp `<!-- gloria:standards v<M> -->` may live in `CLAUDE.md`,
   `AGENTS.md`, or a standalone file either of those points to (e.g. `CODING-STANDARDS.md`) —
   check all three and take the highest `M` found. `M < N`, or no stamp found anywhere, → one
   `render_stale` finding, detail naming both versions and which locations were checked.
2. **Rule-evidence staleness:** for each rule, check whether its `evidence.sources` files
   changed since the rule's `updatedAt` (`git log -1 --format=%ct -- <file>`). Changed →
   `rule_stale` finding for that `ruleId`. The rule may still be right — staleness means
   "re-derive and confirm", not "wrong".

### Step 2 — Pick the code scope

- **Diff-scoped (default):** the PR diff, or `git diff <last-checked>..HEAD` when invoked
  outside a PR. This is the workhorse — cheap enough to run per-PR.
- **Full audit (on demand / periodic):** every source file in scope of any rule. Also
  re-examines snippet exemplars (Step 4).

### Step 3 — Evaluate the code

For each changed (or in-audit) file, against each rule whose `scope` covers it:

- **`rule_violation`** — the code does what the instruction forbids (or omits what it
  requires). Finding: `ruleId`, `file`, `line`, and a detail quoting the offending shape.
- **`unattributed_duplication`** — the code re-implements a pattern that has a canonical
  snippet, with no `gloria:snippet` marker. Finding: `snippetId`, `file`, `line`.
- **Marker verification** — where a `gloria:snippet <project>/<id> (verbatim|adapted)` marker
  exists: the id must resolve (via `find_snippets` or `get_standards`) and the code must be a
  faithful adoption — structure matching, placeholders filled. A `(verbatim)` claim over a
  structurally changed body, or a marker pointing at a nonexistent snippet, is a
  `rule_violation`-grade finding against the snippet's linked rules (cite those `ruleId`s).

### Step 4 — Full audit extras

- Re-score known open findings: still true at today's code? (Ones that no longer reproduce
  will auto-resolve when you report without them.)
- **`snippet_stale`** — for each snippet, compare its structure to the repo's current dominant
  instances of that pattern. If the living code has moved on (new field conventions, changed
  layering) the exemplar is stale: finding with `snippetId` and what diverged.

### Step 5 — Apply the false-positive guardrails

Before reporting, drop any finding that:

1. **Names no rule/snippet id** — not reportable, ever.
2. **Is documented divergence** — an adjacent comment justifying deviation from a
   strong-match snippet or an `observed`-authority rule. That's intent, not drift.
   (`enforced` rules get no such exemption.)
3. **Has no coverage** — a language or pattern with no registered rule/snippet. Absence of a
   snippet is not a violation.

### Step 6 — Report

```
report_check_run {
  projectSlug, kind: "diff" | "audit" | "metadata",
  triggeredBy: "pr" | "manual" | "cron",
  standardsVersionChecked: N,
  scopeDetail: { diffRange?, prRef? },
  startedAt, completedAt,
  findings: [{ type, ruleId?, snippetId?, file?, line?, detail }]
}
```

Report even when findings are empty — a clean run resolves previously-open findings in its
scope and refreshes last-checked for the staleness cron. Then summarize for the user: counts
by type, the specific findings with file:line, and what auto-resolved.

## Common Mistakes

| Mistake                                         | Fix                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Findings with no rule/snippet id                | Guardrail 1: drop them; if the concern is real, propose a new rule instead           |
| Flagging documented divergence                  | Read the adjacent comment; `observed`/snippet divergence with a reason is intent     |
| Flagging uncovered languages/patterns           | No coverage → no finding                                                             |
| Fixing violations in the same run               | Read-only; report, then fix only on explicit request                                 |
| Skipping the report because findings were empty | Empty reports resolve stale findings and feed last-checked                           |
| Diff runs re-reporting old, unchanged findings  | Diff scope evaluates changed code; the ledger dedups by key, but keep detail current |
| Treating rule_stale as "rule is wrong"          | It means "evidence changed — re-derive and confirm"                                  |

## Quality Checklist

- [ ] `get_standards` loaded first; run aborted cleanly if no standards registered
- [ ] Metadata checks ran (stamp + evidence staleness)
- [ ] Every finding names its ruleId/snippetId with file:line where applicable
- [ ] Guardrails applied (no vibes findings, divergence honored, no-coverage silence)
- [ ] Markers verified against real snippets and faithfulness
- [ ] `report_check_run` submitted (even if empty) and the result summarized
