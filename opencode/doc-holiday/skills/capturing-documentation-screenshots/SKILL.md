---
name: capturing-documentation-screenshots
description: Use when a documentation site needs real screenshots — "take the screenshots in SCREENSHOT_PLAN.md", "add screenshots to these docs", "screenshot the web app for the docs", "this page needs a picture of the dashboard", "get me terminal screenshots for this guide". Reads (or writes) a page-by-page screenshot plan, drives a browser to capture real product-UI screenshots, crops out chrome/PII, saves them under a per-page directory, and wires `![alt](...)` references into the docs at the exact spot. For shots it cannot generate itself (terminal output, IDE/editor state, native dialogs), it pre-wires the image path into the docs and hands the human an exact per-file capture list so dropping the file in requires no follow-up edit.
---

# Capturing Documentation Screenshots

## Overview

Turn a documentation site's prose-only pages into pages backed by real screenshots, without ever inventing or mocking a screenshot. This is a sibling to `defining-the-documentation-site-map` (decides what pages/content exist) and `writing-doc-holiday-prompts` (turns that plan into Doc Holiday prompts): those two produce **words**; this skill produces and wires in the **pictures** those words point at. Doc Holiday itself is a remote, text-only service — it cannot open a browser or a terminal — so a coding agent with browser automation (and a human for anything outside the browser) is what actually produces the images.

**Core principle: every screenshot is either genuinely captured by this skill, or explicitly handed to the human to capture — never faked, never described-in-place-of.** If you can't produce a shot yourself, say so precisely (exact save path, exact content) rather than skip it or draw a mockup.

## Two capture paths

| Path                     | Who captures it                                         | Examples                                                                                                                  |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Browser-reachable UI** | You, via browser automation (e.g. Playwright MCP tools) | The product's own web app: dashboards, forms, settings, tables                                                            |
| **Everything else**      | The human, from your exact written instructions         | Terminal/CLI output, chat responses inside a coding agent, an IDE/editor view, a native OS dialog, another local app's UI |

Never try to fake the second category with a rendered mockup or a description-as-image. Hand it off cleanly instead (see "Requesting shots you can't capture" below).

## Inputs

- A **screenshot plan** — if one exists (e.g. `SCREENSHOT_PLAN.md`), read it: it should already rank pages/spots by how much a screenshot would help versus reading fine as pure prose. If none exists, write one first: read every doc page, and for each spot needing an image note the **priority** (High = readers will be lost or slowed without it — first-run setup, a dashboard described only in prose; Medium = helpful but the prose stands on its own; Low = nice-to-have) and a one-line description of what the shot should show.
- The **live product** the screenshots come from — usually a real account/org, not a seeded demo. Ask the human which org/project to use if it's ambiguous, and warn them if the account looks too empty to produce a meaningful shot (an empty dashboard is a wasted screenshot).
- **Authentication you can't complete yourself.** If sign-in needs an email link, a passkey tap, or an OAuth screen only the human can see, tell them exactly what to do (e.g. "sign in at `/sign-in` with GitHub/Google/email, then tell me `done`") and wait — don't attempt to guess credentials or bypass the flow.

## Process

1. **Build or load the plan.** Confirm the ranked list of screenshot spots and what each should depict. Track each page/section as a task if the plan is large enough to lose track of otherwise.

2. **Get into the product with real data.** Navigate to the live app. If authentication needs a human step, ask for it and wait for confirmation before continuing. Once in, check the account actually has data worth screenshotting (a registered project, a real dependency, an installed skill, etc.) — ask the human if you should navigate to a specific org/project rather than screenshot whatever sparse state exists.

3. **Set a consistent viewport before capturing anything.** Resize the browser to one fixed size (e.g. 1440×900) for every shot in the batch so the docs don't end up with visibly mismatched screenshot dimensions.

4. **Snapshot before you click.** Clicking an element by a guessed description string (`"Add channel button"`) frequently fails with "does not match any elements." Take an accessibility snapshot first, find the real ref for the element you want, and click by that ref. Re-snapshot after any navigation — refs from a stale snapshot will error too.

5. **Capture, then read the result back.** Take the screenshot, then read the image file back before moving on — confirm it actually shows what the plan asked for (right page, right state, e.g. an expanded row rather than the collapsed default) before treating the task as done.

6. **Crop for framing and privacy, not just aesthetics.** Use whatever cropping tool is actually available — check before assuming: Pillow/PIL may not be installed even where Python is; ImageMagick (`magick in.png -crop WxH+X+Y +repage out.png`) is a reliable fallback. Get exact pixel dimensions first (e.g. `sips -g pixelWidth -g pixelHeight`) so the crop rectangle is deliberate, not guessed. Spot-check a representative sample of the crops by reading them back before finalizing.

7. **Flag personal/identifying data before publishing, don't silently ship or silently omit it.** A live account will show a real name, email, or org name in places (skill authorship, alert-channel names, user avatars). Stop and ask: is this fine to publish as-is, is there an alternate view/page with neutral data, or does it need to be cropped/masked out? Don't decide unilaterally either way.

8. **Organize files predictably.** One directory per doc page/section (e.g. `static/screenshots/<page-slug>/`), descriptive filenames (`health-dashboard.png`, not `explore-deps.png` or `Screenshot 2026-...png`). Rename/move out of any scratch location you captured to first.

9. **Wire the image into the doc at the exact spot the plan called for**, with alt text descriptive enough to stand on its own (what's shown, not just a caption echoing nearby prose) — e.g. `![The dependency Health dashboard showing a status column and per-row expand controls](/screenshots/discover-dependencies/health-dashboard.png)`.

10. **For shots you can't capture yourself, wire the reference in FIRST, then request the file** (see below) — write the exact target path directly into the markdown before asking the human for it, so once they drop the file at that path it renders with zero follow-up edits.

11. **Verify the docs actually build with the new images** — run the project's site build (whatever generator it uses) and confirm the pages render and image references resolve (a broken path is a silent regression an SSG usually won't complain about). Clean up any generated build output afterward so it isn't committed.

12. **Clean the workspace.** Delete scratch screenshots left outside the final `static/screenshots/`-equivalent tree (stray files in the repo root, `.DS_Store`, etc.) before reporting done.

13. **Report, then stop before committing.** Summarize what was captured (count, pages touched), what's still needed from the human (with the exact list from step 10), and any privacy calls made — but don't stage, commit, or open a PR unless asked. Apply follow-up feedback (drop a shot, reuse one image across pages, reword the surrounding prompt/caption) precisely and re-verify the build after.

## Requesting shots you can't capture

For every screenshot outside the browser's reach, give the human one self-contained block — path, location, and precise capture instructions — so they can act without re-reading the whole doc page:

```
### N. `static/screenshots/<section>/<name>.png`
**Where it appears:** <Page name> → <section/step>.
**What to capture:** <exact action to take, exact state to be in, and what
must be visible in the shot — e.g. "the resulting screen must show the
`gloria` server entry and its authenticate prompt">.
```

Use PNG. Number them, and keep the list to genuinely uncapturable shots only — anything reachable by browser automation belongs in your own capture pass, not on this list.

## Common Mistakes

- ❌ **Faking an uncapturable screenshot** with a hand-drawn mockup, an ASCII rendering, or prose dressed up as a caption. If you can't capture it, hand it off — don't simulate it.
- ❌ **Clicking by description text without a snapshot first.** Guessed element strings fail unpredictably; always resolve a ref from a fresh snapshot.
- ❌ **Screenshotting an empty account** and calling it done. Sparse/seed-free data produces a screenshot that doesn't actually show what the doc claims — check first.
- ❌ **Publishing real personal data without asking.** A live org will leak names/emails into shots; that's a judgment call for the human, not a default.
- ❌ **Inconsistent viewport sizes** across a batch, producing a visibly mismatched set of images in the same doc.
- ❌ **Leaving scratch captures around** — un-cropped originals, stray root-level PNGs, `.DS_Store` — committed alongside the real assets.
- ❌ **Wiring in a placeholder path without also telling the human the exact path**, or telling them the shot without wiring the path in first — either way produces a follow-up edit that didn't need to happen.
- ❌ **Committing or opening a PR without being asked.** Capturing and wiring screenshots is not itself authorization to push.

## Reference Example

A docs site's Quickstart page describes running a tool's `get_info`-equivalent call but has no image of it. The plan marks it High priority. You can't generate the coding-agent's own chat transcript as a screenshot — it happens in the human's terminal/IDE — so you wire `![... ](/screenshots/quickstart/get-info-result.png)` into the markdown at the right spot, and hand the human: `static/screenshots/quickstart/get-info-result.png` — appears at Quickstart step 5 — "after running the tool call shown in that section, screenshot the chat showing the call and its result, with your org name and tool list visible." Meanwhile, the same page's "Register a project" step needs the actual New Project form and Projects list — both reachable in the browser — so you snapshot the org dashboard, resolve the "Add project" button's ref, click it, screenshot the resulting form, crop it to the relevant region, save it to `static/screenshots/register-a-project/new-project-form.png`, and wire it in directly. The build is verified once both categories are in place; nothing is committed until asked.
