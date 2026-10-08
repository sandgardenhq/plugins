---
name: defining-the-documentation-site-map
description: Use when you need to plan a project's documentation — "what should our docs contain and how should they be organized", "design the docs site map / IA", "lay out the docs site", "what pages do we need". Scans the source and emits a Diátaxis-organized site map (every page classified tutorial / how-to / reference / explanation) plus a per-page content plan and a Mermaid hierarchy, derived from the code and reconciled against the intended IA.
---

# Defining the Documentation Site Map

## Overview

Scan a project's source and produce a **documentation site map and content plan** for it, organized with the [**Diátaxis**](https://diataxis.fr) framework. This is the source-driven step that turns "given this codebase, what should its docs contain and how should they be organized?" into two Markdown artifacts a docs site (and a tool like Doc Holiday) can fill in and keep current.

It is a sibling to `documenting-service-dependencies` and `identifying-skills-for-a-project`: a Markdown skill that runs inside a coding agent, reads the codebase, and emits filesystem Markdown — **no D1 dependency** for local/agent use.

**Core principle: derive the map from the code, classify every page into exactly one Diátaxis mode, and keep the four modes separate.** A site map invented from a template, or one where a page mixes modes, fails the job.

| File                   | Contents                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DOCS_SITE_MAP.md`     | The annotated content tree (sections + pages, each tagged with its Diátaxis mode and ordering), a **Reconciliation with the intended IA** note, a Mermaid hierarchy diagram, a Diátaxis-balance check, and a **Coverage gaps** section. |
| `DOCS_CONTENT_PLAN.md` | One brief per page: mode, audience, the question it answers, an outline, and the **source-of-truth in the code** it must be reconciled against.                                                                                         |

Generate **both by default** and cross-link them (the site map links to the plan; each brief's heading matches its tree entry). Emit `content/`-relative paths and Hugo-ready front matter so the plan drops into a Hugo site, while the tree itself stays generator-agnostic.

**Plan, don't write the pages.** The deliverable is the map + briefs, not finished documentation. Only stub out empty Markdown pages if the user explicitly asks — say so rather than silently writing page bodies.

## The Diátaxis Classification Rule (the most important step)

Every proposed page is classified into **exactly one** of four modes. The mode is decided by the **user need** the page serves, not by its topic:

| Mode            | Orientation   | Serves                                    | The page's job                                                            |
| --------------- | ------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| **Tutorial**    | Learning      | A newcomer acquiring skills               | Teach through a guided, hand-held lesson with a guaranteed first success. |
| **How-to**      | Tasks         | A competent user solving one real problem | Give the steps to achieve a specific goal; assume competence.             |
| **Reference**   | Information   | A user looking something up               | Describe the machinery accurately; austere, structured like the code/API. |
| **Explanation** | Understanding | A user building a mental model            | Explain why, the design, the trade-offs; read-once orientation, no task.  |

### The discriminators that prevent misclassification

Most classification errors are tutorial↔how-to and reference↔explanation. Apply these tests:

- **Tutorial vs. how-to.** A tutorial _teaches a beginner_ via a curated lesson the author fully controls ("Run your first Canary check" — one blessed happy path, every step spelled out). A how-to _helps a competent user_ accomplish a real task they bring ("Add the MCP server to your agent"). The same topic is usually a how-to; reserve tutorial for the one or two genuine first-success journeys. **A task done N times for N variants is N how-tos in one mode — never one tutorial and the rest how-tos.** (Baseline error to avoid: "Install on Claude Code" tagged tutorial while "Install on Codex" tagged how-to. They are the same need — both how-to, or fold into one how-to with per-agent steps.)
- **Reference vs. explanation.** Reference _describes and lets you look up_ — it maps to the structure of the code (a tool index, a Zod-schema/domain-model table, a route map, a glossary) and teaches nothing. Explanation _makes you understand_ — the intent-vs-implementation model, an architecture overview, why the alert engine debounces. If it has a narrative and an opinion, it's explanation; if it's a lookup table, it's reference.
- **Section landing pages (`_index.md`) and "coming soon" stubs are explanation.** A landing page orients the reader to a section (read-once, no task, no lookup); a stub for an unshipped tool orients to a capability that doesn't exist yet. Both are `[E]`. They split into how-to/reference children as the section/tool fills in.

### Keep the four modes separate (enforce this)

- **Don't mix modes on a page.** A tutorial that drifts into an API table, or a how-to that explains the architecture, is two pages. Split it.
- **Don't smuggle a how-to into reference** ("how to…" steps inside a tool index) or **explanation into a tutorial** (design rationale mid-lesson). Move the foreign content to a page of its matching mode and cross-link.
- Address docs at the three levels Diátaxis names: **content** (what each page says — the brief), **style** (how it's written for its mode — set the tone expectation in the brief), and **architecture** (how pages are organized — the tree). The tree is architecture; the briefs carry content + style.

## Process

1. **Profile the codebase (derive, don't template).** Map the project's real surfaces — this is what the site map is built from, so be concrete:
   - **Entry points & public surfaces:** CLIs, **MCP tools** (their registered names/args), HTTP/REST APIs and routes, SDKs, the web UI's pages/flows.
   - **Distinct features/tools:** the product's separable capabilities (e.g. each home-page feature card / each shipping tool). Each becomes a section of the spine.
   - **Domain model & schemas:** Zod schemas, core types, the data model — these drive Reference pages.
   - **Configuration & setup:** install paths, env/bindings, auth, deploy — these drive Getting-started/How-to pages.
   - **Concepts & intent:** README/CLAUDE.md framing, the "why" — these drive Explanation pages.
     Use parallel search agents for breadth. The recommendations must come from what the project actually is, not its stack name.

2. **Find the intended IA, and reconcile against it.** Before inventing structure, look for an already-intended information architecture — a hand-authored site map in an issue/PR/`docs/` design, an existing docs tree, the home-page navigation, the product's own sectioning. **If one exists, adopt its shape and reconcile your derived map against it**: cover every section it names, and for any place you add, drop, rename, or reorder, **say so and why** in a "Reconciliation with the intended IA" note. If none exists, derive the spine from the features in step 1 and state that you did. _(A common, durable shape for a multi-tool product is Overview → Getting started → Tools (one subsection per feature/tool) → Guides → Reference → Meta; adopt the project's own intended IA where it has one, and otherwise use a shape like this as a starting point.)_

3. **Derive the site map.** A hierarchical tree of **sections → pages**. Make the product's distinct tools/features the **spine** (one section each); add cross-cutting sections for orientation (overview/concepts), onboarding (getting-started), cross-tool tasks (guides), lookups (reference), and meta. Tag **every page** with its Diátaxis mode and give it an integer **weight** for ordering within its section.

4. **Plan each page (the brief).** For every page, write a short brief with **all five** fields:
   - **Mode** — tutorial / how-to / reference / explanation (exactly one).
   - **Audience** — who it's for (newcomer, operator, integrator, maintainer).
   - **Question it answers** — the one user question, in the user's words.
   - **Outline** — 2–5 bullets of what it covers (kept within its mode).
   - **Source of truth** — the file(s)/symbol(s) in the code this page describes and must be **reconciled against** as the code changes. This is the intent-vs-implementation anchor; a page with no source of truth is either misplaced or a gap. **Exception:** an **intended-IA placeholder** — a section landing or a "coming soon" stub the intended IA (step 2) mandates for a capability not yet in code — is allowed without a code source of truth. Anchor it to its weak source (the home-page card / README mention), tag it `[E]`, and list it under **over-coverage** in the coverage gaps so it's tracked, not mistaken for a missing page.

5. **Flag coverage gaps.** Produce an explicit list, not prose asides:
   - **Features with no doc home** — a capability in step 1 that no page covers.
   - **Reference surfaces not yet indexed** — MCP tools, routes, schemas, channel/adapter types that exist in code but have no Reference page.
   - **Orphans / over-coverage** — proposed pages with no source of truth, or intended-IA sections the code doesn't yet justify.

6. **Emit the two docs** (structure below), cross-linked, with the Mermaid hierarchy and the balance check.

7. **Report**: the spine you chose and why, how you reconciled against the intended IA (and every divergence), the mode-balance, and the coverage gaps. Call out any classification calls that were close (tutorial vs how-to, reference vs explanation).

## `DOCS_SITE_MAP.md` structure

1. **Intro** — one paragraph: what the project is, that the map is derived from its source and organized by Diátaxis; a tag legend (`[T]` tutorial · `[H]` how-to · `[R]` reference · `[E]` explanation); a link to `DOCS_CONTENT_PLAN.md`.
2. **The tree** — a fenced code block, sections → pages, **each page line carrying its path (relative to the generator's `content/` root — write `tools/canary/_index.md`, not `content/tools/canary/_index.md`), title, mode tag, and weight**, e.g.:
   ```
   tools/canary/
   ├── _index.md            What Canary is & the discover→check→notify loop   [E]  weight: 10
   ├── health-checks.md     Authenticated check definitions & scheduling        [H]  weight: 30
   └── mcp-reference.md     MCP tools: list/get/put/delete dependency           [R]  weight: 50
   ```
3. **Reconciliation with the intended IA** — a short note: which intended-IA source you used (or that none existed and you derived the spine), and a bullet per divergence (added / removed / renamed / reordered) with the reason.
4. **`## Diátaxis balance`** — a count-per-mode table with a one-line read ("how-to-heavy is expected for operational tooling; the two tutorials are the only genuine first-success journeys"). A skew of _zero_ tutorials, or everything tagged one mode, is a smell — note it.
5. **`## Coverage gaps`** — the step-5 list.
6. **`## Hierarchy`** — a **Mermaid `graph TD`** of sections → pages (mode in each node label), consistent with the diagrams the sibling skills emit.

## `DOCS_CONTENT_PLAN.md` structure

One `###` section per page, in tree order, each starting with **Hugo-ready front matter** (so it drops straight into a Hugo site), then the brief fields:

````markdown
### tools/canary/health-checks.md

```yaml
title: "Health checks"
weight: 30
diataxis: how-to
```

- **Audience:** an operator wiring up Canary.
- **Question it answers:** "How do I turn a discovered dependency into a scheduled, authenticated check?"
- **Outline:**
  - Picking a probe type from how the app authenticates.
  - Declaring secrets vs. attaching a connector.
  - Enabling the check and the schedule that runs it.
- **Source of truth:** `packages/core/src/probe.ts`, `packages/core/src/adapters/*`, `packages/jobs/src/schedule.ts`.
````

Emit the `diataxis` mode in **both** places — inline in the tree (the tag) **and** in front matter — so the tree stays scannable and the generated page self-declares its mode.

Front-matter keys: `title`, `weight`, and `diataxis` are required on every page. For a tool/section the intended IA marks **not yet shipped**, add `status: coming-soon` (and the generator's draft convention if it uses one) so the stub renders as a placeholder rather than finished docs. Paths in front matter and the tree are relative to `content/` — never include the `content/` prefix.

## Common Mistakes

- ❌ **Producing a template, not a derived map.** Pages that don't trace to a real surface in step 1 are guesses. Every page needs a source of truth or it's a gap, not a page.
- ❌ **Tutorial/how-to confusion.** Tagging the same task differently across variants, or calling a how-to a "tutorial" because it's introductory. One genuine guided lesson = tutorial; everything operational = how-to.
- ❌ **Reference/explanation confusion.** A narrative "how it works" tagged reference, or a lookup table tagged explanation. Reference describes and is looked-up; explanation is read-once understanding.
- ❌ **Mixing modes on one page.** A tutorial with an embedded API table, a how-to that explains the architecture. Split and cross-link.
- ❌ **Skipping reconciliation.** Inventing a structure when an intended IA already exists (an issue's site map, the home-page nav, an existing docs tree) — adopt it and document divergences instead.
- ❌ **Omitting the coverage-gaps section.** Burying uncertainty in prose. Features with no home and un-indexed reference surfaces must be an explicit list.
- ❌ **Briefs missing fields.** A brief without audience, the question it answers, or a source of truth is incomplete — those are what make the page reconcilable later.
- ❌ **No ordering / front matter.** Inline mode tags only, with no weight or `content/` paths, when the target generator (Hugo) needs them.
- ❌ **Writing the pages.** Filling in page bodies instead of planning. Stub empty pages only when explicitly asked.

## Reference Example

A well-formed target for a multi-tool product is **Overview → Getting started → Tools → Guides → Reference → Meta**, with one Tools subsection per feature/tool, shipping tools fully documented and not-yet-shipped tools stubbed as `[E]` placeholders. When a project already documents an intended IA of its own (an issue, a design doc, the home-page navigation, an existing docs tree), reconcile against **that** shape and record every divergence in the Reconciliation note, rather than imposing this one.
