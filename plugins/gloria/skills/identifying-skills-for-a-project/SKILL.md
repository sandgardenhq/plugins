---
name: identifying-skills-for-a-project
description: Use when asked which agent skills a project already uses and which additional ones would help the people and agents working on it, or to stock your org's gloria.dev skills library from a project's needs. Inventories the skills in play (session list + `.claude/` config + CLAUDE.md), profiles the stack, recommends the gaps, then — only with consent — saves the useful ones to the library by reusing, copying, or authoring a bundle, and offers a local or global install.
---

# Identifying Skills for a Project

## Overview

Run inside a coding agent on a target project to answer two questions and act on them:

1. **What agent skills are already in play here?**
2. **What additional skills would help the people and agents working on this project?** — then get the useful ones into your org's **gloria.dev skills library**, and optionally install them locally.

**Core principle: ground every recommendation in the project's actual stack and workflows, reuse before you author, and never write to the shared library (or the user's disk) without consent.**

The library search/publish mechanics live in a separate skill. **REQUIRED SUB-SKILL:** use `using-the-skills-library` for `search_skills` / `get_skill` / `publish_skill`. To author a brand-new bundle, **REQUIRED SUB-SKILL:** `writing-skills`.

## When to Use

- "What skills does this project use, and what's missing?"
- "Seed our skills library from this repo."
- Onboarding a project and you want the right agent skills available to everyone on it.

Not for: documenting service dependencies (use `documenting-service-dependencies`); project-only conventions that belong in `CLAUDE.md`, not a shared skill.

## The Three Buckets

Classify every skill into exactly one — this is the spine of the report:

| Bucket                              | Meaning                                    | Action                                                 |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| **In play**                         | Available to this project today            | Report it. Nothing to publish.                         |
| **Useful — already in the library** | A recommended skill the org already has    | Reuse / install. Don't duplicate.                      |
| **Useful — missing**                | A recommended skill not yet in the library | Copy an available bundle, or author one, then publish. |

**"Available in your session" is not the same as "in use by the project."** A skill the project's `.claude/` or `CLAUDE.md` references is in use; a skill merely present in your session is only _available_. Report them distinctly.

## Process

### 1. Inventory the skills in play

From three concrete signals:

- **Your session's skill list** — every skill currently available to you.
- **`.claude/` config** — `.claude/skills/` (installed local skills), and `.claude/settings.json` / `settings.local.json` for enabled **plugins / marketplaces** (skills the org already gets wholesale — e.g. a `superpowers` plugin) and `.mcp.json` servers.
- **`CLAUDE.md`** (root and nested) — skills and runbooks it names or implies.

Separate _in-use_ (referenced by config/CLAUDE.md) from _merely available_ (in your session only).

### 2. Profile the project

Read the signals that reveal recurring work: `package.json`/manifests and scripts, lockfiles, framework/infra config (`next.config`, `vercel.json`, `wrangler.toml`, Dockerfiles), `prisma/`, `.github/workflows/`, payment/auth/webhook code, datastore and queue usage, test setup. The recommendations must come from what the project actually does, not guesswork.

### 3. Recommend the gaps — with criteria

A skill is worth recommending only if it is **all** of:

- **Grounded** — maps to a real, recurring workflow you saw in step 2 (a payment-webhook flow, a migration procedure, a deploy runbook), not a hypothetical.
- **Reusable** — generalizes across org projects; not Acme-specific trivia or anything containing secrets/internal hostnames.
- **Not already covered** — by a library skill (step 4) or by a plugin/marketplace the org already enables (step 1). **Don't re-publish skills the org gets from a shared plugin** (e.g. the `superpowers` set) — they're already everywhere.
- **Authorable with confidence** — you understand it well enough to write or vet it.

Rank: strong (publish) vs. propose-and-ask (thinner / opinionated / overlapping).

### 4. Check the library before proposing anything missing

Per `using-the-skills-library`: `search_skills` with **2–3 synonym queries** per candidate (the substring query matches name/description only), **and** narrow with the `tags` filter (AND semantics) to catch relevant skills a substring query would miss — a no-args `search_skills` lists every skill and surfaces the tags already in use. `get_skill` on near-matches to read scope. A match → move it to the _already-in-library_ bucket. This is what prevents duplicate publishes.

Remember the org ships **pre-seeded with gloria.dev system skills** (read-only, author `gloria.dev`). They're a third "already covered" source alongside the enabled plugins/marketplaces from step 1 — a candidate satisfied by a seeded system skill belongs in _already-in-library_, not _missing_, and must not be re-authored (a republish over a system skill is rejected with `409`).

### 5. Assemble each missing-but-useful bundle

Three ways to produce a bundle — prefer the cheapest that fits:

| Path       | When                                                                                                          | How                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reuse**  | Already in the library                                                                                        | Nothing to assemble — just install (step 7).                                                                                                                                     |
| **Copy**   | A good bundle exists on disk (an available session/local skill the library lacks and you're allowed to share) | Locate its `SKILL.md` + supporting files (search `~/.claude/skills`, `.claude/skills`, plugin caches) and copy the files verbatim into staging. Scrub anything project-specific. |
| **Author** | No suitable source exists                                                                                     | Write a new bundle via `writing-skills`, grounded in the step-2 evidence.                                                                                                        |

Stage bundle files under the workspace's gitignored **`.context/skills/<slug>/`** so nothing lands in the project's git tree by accident.

### 6. Confirm, then publish

**Stop and show the user the proposed list** (each bucket, each bundle's path = reuse/copy/author, and the actual `SKILL.md` for new ones). **Ask explicitly whether to save them to the gloria.dev skills library before publishing.** Publishing writes a new immutable version to a shared, org-wide resource — do it only on consent, one skill at a time, via `publish_skill` (see `using-the-skills-library` for slug derivation and the admin/versioning rules). Then verify with `search_skills`/`get_skill`.

### 7. Offer a local install

Independently of publishing, **ask the user whether to install each kept skill locally**, and where:

- **Project-local** → `<project>/.claude/skills/<slug>/SKILL.md` (+ supporting files). Available to anyone (and any agent) working in this repo. Ask whether to commit it or leave it gitignored.
- **Global** → `~/.claude/skills/<slug>/SKILL.md`. Available across all of the user's projects.

For an **org-authored or gloria.dev** skill, installing = writing the staged bundle files into the chosen directory. **External marketplace skills are different** — their content is never copied; if a kept skill came from a `marketplace:<id>` source (its `search_skills` summary carries `source`/`plugin`/`supportedAgents`), don't write files. Install it through the host agent's native marketplace via `install_skill` per `using-the-skills-library` Workflow C, and note it pulls in the whole plugin.

Publishing to the library and installing locally are separate choices — a user may want one, both, or neither.

## Output

A short report with the three buckets, plus — for what the user approved — the published library versions and any local installs. Name what you **excluded** and why (already covered by a plugin, too project-specific, couldn't author with confidence).

## Common Mistakes

- ❌ Treating session-available skills as "in use" — they're only available until config/CLAUDE.md references them.
- ❌ Recommending generic skills the org already gets from a shared plugin/marketplace (re-publishing `superpowers`-style skills).
- ❌ Authoring a bundle from scratch when an equivalent already exists in the library or on disk to copy — search and reuse first.
- ❌ Publishing without the explicit save-to-library consent gate, or skipping the separate local-install offer entirely.
- ❌ Recommendations ungrounded in the project — pulled from the stack name, not from code/config/workflows you actually read.
- ❌ Putting project-specific conventions or secrets into a shared skill. Those belong in `CLAUDE.md`.
- ❌ Staging bundle files into the project tree instead of the gitignored `.context/skills/`.
