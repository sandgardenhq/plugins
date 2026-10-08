---
name: writing-doc-holiday-prompts
description: Use when you have a documentation site map / content plan and need the actual Doc Holiday instructions that generate and maintain the docs — "turn the site map into Doc Holiday prompts", "write the @doc.holiday prompts for our docs", "how do we make Doc Holiday build this docs site", "generate the create/update prompts for each page". Reads the planned IA (the output of `defining-the-documentation-site-map`) and the project's source, then emits, for every page, a ready-to-run `@doc.holiday` prompt with the right action, scope, Diátaxis mode, and target section — plus reusable Instruction Library entries for shared voice/style, ordered to match the IA, with maintenance/update prompts.
---

# Writing Doc Holiday Prompts

## Overview

Turn a documentation **site map + per-page content plan** into the concrete set of [**Doc Holiday**](https://doc.holiday/docs/) instructions that actually generate and maintain the docs site. This is the bridge between **planning** the docs and **producing** them: `defining-the-documentation-site-map` decides _what pages exist and what each should say_; this skill produces the _prompts that make Doc Holiday write them_.

It is a sibling to `defining-the-documentation-site-map`, `documenting-service-dependencies`, and `identifying-skills-for-a-project`: a Markdown skill that runs inside a coding agent, reads the codebase + the site-map artifacts, and emits filesystem Markdown — **no D1 dependency** for local/agent use.

**Core principle: every prompt is anchored to a real source-of-truth in the code and carries its page's Diátaxis mode.** A scope-less prompt, or one that lets Doc Holiday guess the mode, fails the job — the point is that a reference page reads as reference and a tutorial reads as a tutorial, each reconciled against the code it describes.

| File                                 | Contents                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DOC_HOLIDAY_PROMPTS.md`             | The ordered, copy-paste prompt set, grouped by section to match the IA. Each prompt is annotated with its **page**, **Diátaxis mode**, **scope**, **target section/publication**, and **attached Instruction-Library slots**, and is split into a **create** prompt and a **maintenance (`update`)** prompt. |
| `DOC_HOLIDAY_INSTRUCTION_LIBRARY.md` | The proposed reusable Instruction Library entries (brand voice, the intent-vs-implementation framing, one style entry per Diátaxis mode), each as paste-ready text with a note on **which slots/pages it attaches to**.                                                                                      |

Generate **both by default** and cross-link them (each prompt names the Instruction-Library entries it relies on; each entry lists the prompts/slots it serves).

**Write the prompts, not the pages.** The deliverable is the instruction set, not finished documentation — Doc Holiday writes the pages from these prompts. Do not hand-write page bodies.

## How Doc Holiday consumes these prompts

Get the command format exactly right — these strings are run verbatim.

- **Command format** — conversational: `@doc.holiday [action] [scope/details]`. The mention is **always literally `@doc.holiday`**.
- **Interaction channels** — the same prompt text works in the Admin UI "Create Work" chat, as an `@doc.holiday` mention in a GitHub issue/PR (or GitLab/Linear), or via an automated trigger (release, merge, workflow run). Write the prompt once; it is channel-agnostic.
- **Command categories** (this skill uses the first two):
  - **Create new documentation** — `@doc.holiday create new documentation about …`
  - **Update existing documentation** — `@doc.holiday update … `
  - _(Create release notes is out of scope here.)_
- **Scope** — every prompt (create **and** update) must name one: **file paths** (`/packages/mcp/`), a **commit range**, or the **current PR/MR context**. Pull the scope from the page's **Source of truth** field in the content plan. (A bare "time period" is _not_ a valid page scope — it anchors to no source of truth and is release-notes-shaped, which is out of scope here.)
- **Publications** — named documentation sets. A prompt targets a publication and a section path: `… for Publication "<name>"` landing at `<section/path>`.
- **Slots & the Instruction Library** — reusable global instruction prompts saved once in the **Instruction Library** and linked to publication **slots**, so shared guidance (brand voice, per-mode style) is applied consistently without repeating it in every prompt. Factor cross-cutting guidance into entries; reference them from prompts — don't inline them.

## Inputs (and what to do if they're missing)

This skill **consumes the artifacts of `defining-the-documentation-site-map`**:

- `DOCS_SITE_MAP.md` — the tree (sections → pages), each page's Diátaxis mode, weight, and `content/`-relative path.
- `DOCS_CONTENT_PLAN.md` — the per-page brief: **Mode, Audience, Question it answers, Outline, and Source of truth**. The Source-of-truth field is what becomes each prompt's scope.

**If those artifacts don't exist, do not invent them.** Run `defining-the-documentation-site-map` first to produce the map + plan, then resume here. Say so rather than guessing an IA — a prompt built on a guessed page is a guessed prompt.

Also read the **target Hugo site** (from the docs-site issue/repo) so section paths and the publication match the real IA, and the **project source** so you can confirm each Source-of-truth path still exists before emitting its prompt.

## One Publication, sections by slot (default)

Target **one Publication for the whole docs site** by default, with each page landing at its `content/`-relative **section path** from the site map; this keeps the IA in one place and lets one set of slots apply site-wide. Reach for **one Publication per tool/section** only when sections need genuinely different handling (separate triggers, separate owners, separate cadences) — and when you do, say why in the report. Either way, the **section path** in each prompt is what places the page in the Hugo site's hierarchy.

## Process

1. **Load and validate the inputs.** Read `DOCS_SITE_MAP.md` + `DOCS_CONTENT_PLAN.md`. If absent → run `defining-the-documentation-site-map` first. Confirm every page has a **Mode** and a **Source of truth**; a page missing either can't become a well-formed prompt and must be **flagged**, not papered over.

2. **Verify each source-of-truth against the code.** For every page, check that its Source-of-truth file paths / symbols still exist in the project. If a path is **missing or ambiguous**, flag the page (see step 6) instead of emitting a vague prompt — never widen the scope to "the whole repo" to cover an unknown.

3. **Derive the Instruction Library entries** (the cross-cutting guidance, written once):
   - **Brand voice** — the project's voice/tone (from README/CLAUDE.md), attached to **every** slot.
   - **Intent-vs-implementation framing** — the gloria.dev "the code is the source of truth for what was built; hold it against what you intended" model, where the docs should reflect it.
   - **One style entry per Diátaxis mode** — tutorial / how-to / reference / explanation, each encoding that mode's job (a tutorial guarantees a first success; reference is austere and structured like the API; explanation is read-once understanding with no task; how-to assumes competence). These are what keep each page in its mode.
     Note for each entry **which slots/pages it attaches to** (e.g. the reference-style entry → every `[R]` page's slot).

4. **Map each page to a create prompt.** For every page in the plan, write:
   `@doc.holiday create new documentation about <subject> in <scope>` — then the per-page guidance: its **Diátaxis mode**, **audience**, and **the question it answers**, the **target Publication _and_ the page's `content/`-relative section path** (both are required — a Publication name without a landing path doesn't place the page), and the **Instruction-Library slots** to apply. Name the mode and attach its style slot; do **not** re-type the mode's style rules in the prompt — the mode and the per-page question come from the brief, the shared voice/style comes from the attached slots.

5. **Handle coming-soon stubs.** For a page the site map marks `status: coming-soon` (a not-yet-shipped tool), emit a **lighter, explicitly-scoped stub prompt** — tell Doc Holiday to write a short placeholder that says the capability is coming and **not to invent feature content**. Never point a full "create new documentation" prompt at a tool that doesn't exist in code yet.

6. **Sequence the prompts to the IA.** Order: **overview/explanation pages first**, then **per-tool sections** (in the site map's weight order), then **cross-cutting guides and reference last** — matching the site map's hierarchy so earlier pages exist before later ones link to them. Within the file, group by section. Collect every page you couldn't scope into an explicit **"Flagged — missing/ambiguous source of truth"** list at the top, so a human resolves them rather than them silently becoming bad prompts.

7. **Emit the maintenance (`update`) prompts.** For **every** non-stub page, **always** emit the `@doc.holiday update …` prompt that re-reconciles it against the same scope as the code changes — this is unconditional, not optional. Additionally **wire automated triggers** (on merges/releases touching the page's source paths) so the reconciliation is ongoing per the docs' "maintained by Doc Holiday" goal — triggers are an _addition_ to the update prompt, never a substitute for it. The update prompt must itself carry an explicit scope (`@doc.holiday update <page> from <commit-range/paths>`); a bare `update <page>` is scope-less and not allowed.

8. **Emit the two artifacts** (structures below), cross-linked.

9. **Report**: the publication strategy you chose (and why), the order, the Instruction-Library entries and where they attach, and — prominently — the **flagged pages** (missing/ambiguous source of truth, or coming-soon) that need a human before they can run.

## `DOC_HOLIDAY_PROMPTS.md` structure

1. **Intro** — one paragraph: what this set builds, the target **Publication**, that prompts are copy-paste `@doc.holiday` instructions ordered to match the site map; a mode legend (`[T]`/`[H]`/`[R]`/`[E]`); links to `DOCS_SITE_MAP.md` and `DOC_HOLIDAY_INSTRUCTION_LIBRARY.md`.
2. **`## Flagged — needs a human first`** — the pages from steps 2/5/6 whose source-of-truth is missing/ambiguous (or that are coming-soon), with what's needed to resolve each. Put this **first** so it isn't missed.
3. **One `###` block per page, in IA order, grouped by section.** Each block:

   ````markdown
   ### tools/canary/mcp-reference.md — MCP reference [R] weight: 50

   - **Mode:** reference · **Audience:** an integrator wiring the MCP server.
   - **Question it answers:** "What MCP tools does Canary expose and what are their args?"
   - **Scope:** `/packages/mcp/` (source of truth from the content plan).
   - **Target:** Publication "gloria.dev docs" → `tools/canary/mcp-reference.md`.
   - **Slots:** brand-voice, reference-style.

   **Create**

   ```
   @doc.holiday create new documentation about the Canary MCP tools in /packages/mcp/ for Publication "gloria.dev docs", landing at tools/canary/mcp-reference.md. Write it as Diátaxis reference for an integrator wiring the MCP server, answering "what MCP tools does Canary expose and what are their args?". Apply the brand-voice and reference-style instruction slots (mode style comes from the slot, not this prompt).
   ```

   **Maintain**

   ```
   @doc.holiday update tools/canary/mcp-reference.md from changes in /packages/mcp/ — keep the tool index reconciled with the registered tool definitions.
   ```
   ````

   For a **coming-soon** page, replace the Create block with a stub prompt and **omit the Maintain block** — there is no source of truth to reconcile yet. Add the Maintain block (and the page's full create prompt) when the tool ships.

   ````markdown
   **Create (stub — tool not yet shipped)**

   ```
   @doc.holiday create new documentation about the planned "Cost Tracking" tool as a short coming-soon placeholder, landing at tools/cost-tracking/_index.md in Publication "gloria.dev docs". Say the capability is on the roadmap and do not invent feature details, commands, or APIs — there is no implementation to read yet.
   ```
   ````

## `DOC_HOLIDAY_INSTRUCTION_LIBRARY.md` structure

One `###` per entry. Each entry is **paste-ready instruction text** (the human pastes it into the Doc Holiday Instruction Library and links it to the named slots), plus an **Attaches to** line:

````markdown
### Reference style (Diátaxis)

**Attaches to:** the slot on every `[R]` page (e.g. `tools/canary/mcp-reference.md`, `reference/*`).

```
Write reference documentation: austere, structured to mirror the code/API it
documents, complete and accurate, and teaching nothing. Describe the machinery —
arguments, types, return values, errors — in a consistent order. No tutorials,
no narrative, no "why"; link out to how-to and explanation pages for those.
```
````

Include at minimum: **brand voice** (attaches to every slot), **intent-vs-implementation framing**, and the **four per-mode style entries** (tutorial / how-to / reference / explanation). Emit them as text for a human to paste into the Doc Holiday UI; do not assume an API path to register them.

## Common Mistakes

- ❌ **Scope-less prompts.** A `create new documentation` _or_ an `update` with no file paths / commit range / PR context. A bare `@doc.holiday update <page>` reads as self-scoping but isn't — every prompt's scope comes from the page's Source-of-truth field, no exceptions.
- ❌ **Publication named but no landing path.** Targeting `Publication "…"` without the page's `content/`-relative section path, so Doc Holiday can't place the page. Both are required on every create prompt.
- ❌ **Inventing a page or its scope.** Building a prompt for a page that isn't in the content plan, or widening scope to "the whole repo" to cover an unknown source of truth. Flag it instead.
- ❌ **Dropping the Diátaxis mode.** Letting Doc Holiday decide the mode, so a reference page comes back as a tutorial. The mode (and the question it answers) must ride in every prompt.
- ❌ **Repeating voice/style in every prompt.** Brand voice and per-mode style belong in **Instruction Library entries** linked to slots, referenced from prompts — not copy-pasted into each one.
- ❌ **Wrong mention or category.** Anything other than literal `@doc.holiday`, or an action that isn't `create new documentation` / `update`.
- ❌ **Out-of-order prompts.** Reference/guides before the overview and per-tool sections they depend on. Order to the site map's hierarchy.
- ❌ **Hallucinated coming-soon content.** A full create prompt aimed at an unbuilt tool. Emit an explicit stub prompt that forbids inventing features.
- ❌ **No maintenance.** Shipping only create prompts, so the site drifts from the code. Emit an `update` prompt for every non-stub page; trigger wiring is an addition, never a substitute.
- ❌ **Writing the pages.** Hand-authoring documentation bodies instead of the prompts that generate them.

## Reference Example

For a multi-tool product whose site map is **Overview → Getting started → Tools → Guides → Reference → Meta**, target one Publication, emit the overview/explanation prompts first, then one create + one maintain prompt per page in weight order (each scoped to that page's source of truth and carrying its mode), stub the not-yet-shipped Tools subsections, and factor brand voice + the four per-mode styles into Instruction Library entries attached to the matching slots. When the docs site already pins a different Publication layout or trigger setup, reconcile against **that** and record any divergence in the report.
