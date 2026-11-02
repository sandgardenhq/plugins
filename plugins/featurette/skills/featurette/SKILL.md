---
name: featurette
description: Make a guide video of any website, steer its director, and personalize it per recipient, through Featurette's MCP server or HTTP API with an API key.
---

# Featurette

Featurette makes guide videos of websites: an explorer agent visits the site, a director
agent writes the script, voices it and cuts the footage into a video. A **project** holds one
site, its conversation with the director, and its rendered videos. A finished video can be
**personalized** for each recipient: a *variant* is a copy cut for one person or company,
answered as a public watch link the moment it is requested.

## Connecting

Both connections take an API key, minted on the API keys page (https://featurette.ai/api-keys) by a
member of the org. The key is the org's identity: every project, job and video it touches is
the org's, and every credit it spends is the org's.

**MCP** — `https://featurette.ai/mcp`, Streamable HTTP, the key as the Bearer credential:

```
claude mcp add --transport http featurette https://featurette.ai/mcp --header "Authorization: Bearer <key>"
```

In claude.ai, a custom connector with the URL above, **No sign-in**, and the request header
`Authorization` = `Bearer <key>`.

**HTTP** — `https://featurette.ai/api/v1`, JSON in and out, the same header:

```
curl -H "Authorization: Bearer <key>" https://featurette.ai/api/v1/projects
```

The tools below name the route that answers the same; the JSON is the same on both.

## How a video's life reads

`create_video` queues a run and answers with a **job** and, once a node has taken it, the
**project** it made. The run explores the site and renders a video over several minutes. Name
the request with `idempotency_key` (over HTTP, the `Idempotency-Key` header) and a repeat
answers the same job instead of starting another run.
`get_job` and `get_project` carry `status` (`queued`, `running`, `done` or `failed` for a
job; `idle`, `running` or `awaiting_user` for a project's director) and `message`, the last
thing the director said — what it is doing, what it showed, or a question it is waiting on.

`adjust_video` is a line to the director in the project's conversation: a change to the
script, the voice, the pace or a scene, or the answer to its question. It queues behind any
turn in flight and runs when the director is idle; its job settles when the turn ends, and the
project's videos and `message` show what came of it. A request for credentials cannot be
answered this way.

`share_video` publishes one of the project's rendered videos (a `video` of `get_project`) at a
public `share_url` anyone can open, with its `thumbnail_url` and `gif_url`; `get_project` lists
the file with that link from then on.

Videos made and adjusted through the API are free and carry the Featurette watermark;
`watermark` on each video says whether one still does. `unlock_video` removes it for one
credit. A video that may not match its script, music or sources any more is refused as
`stale_render` until the director renders it again. A clean video listed without a
`share_url` gets one from `unlock_video` again, at no cost. A later render marks the video
again, and unlocking that render is a new credit.

`create_variant` makes a personalized copy of the project's newest finished video for one
recipient, from the fields given, and answers at once with the public `share_url` and its
`thumbnail_url` and `gif_url`. The link shows the base video's picture and a pending line
until the variant's own video lands minutes later, then plays it. A variant costs one credit;
a repeat for the same `external_id` is the same variant and spends nothing. `get_variant`
follows it.

Errors are plain sentences: as `{error}` with the HTTP status, or as the tool's error result.
A refusal a program can act on also carries a code, as `code` over HTTP and as `[code: …]` in
a tool's error: `no_credits` (402), `stale_render` and `busy` (409, the director not idle),
`unlock_failed` (502, no credit used) and `billing_off` (503).

## Tools

### `list_projects`

The org's projects: id, name, the site's URL, the agent's state and the last thing the director said.

HTTP: `GET /api/v1/projects`.

No input.

### `get_project`

One project with its rendered videos (file, thumbnail, gif, the public link when shared), its state and the last thing the director said.

HTTP: `GET /api/v1/projects/:project_id`.

Input:
  - `project_id` (string, in the path) — the project's id

### `create_video`

Starts a video of a website: a new project explores the site and renders a guide. Answers with the job and the project id once a node has taken it; the video takes minutes.

HTTP: `POST /api/v1/prompt`, the input as the JSON body.

Input:
  - `url` (string) — the website's address
  - `prompt` (string, optional) — what the video is about and for whom; absent, a 30-second demo of the site
  - `idempotency_key` (string, optional) — a name for this request; a repeat under it answers the job the first call made (over HTTP, the Idempotency-Key header)

### `get_job`

A job's state (queued, running, done, failed), its project and the last thing the director said.

HTTP: `GET /api/v1/job/:job_id`.

Input:
  - `job_id` (string, in the path) — the job's id

### `adjust_video`

A message to the project's director in its conversation: what to change in the script, the voice, the pace or a scene, or the answer to a question it asked. Runs once the director is idle, after any turn in flight.

HTTP: `POST /api/v1/projects/:project_id/adjust`, the other fields as the JSON body.

Input:
  - `project_id` (string, in the path) — the project's id
  - `prompt` (string) — the message

### `share_video`

Publishes one of the project's rendered videos at a public watch link, with its thumbnail and gif. A video already shared answers the same link.

HTTP: `POST /api/v1/projects/:project_id/share`, the other fields as the JSON body.

Input:
  - `project_id` (string, in the path) — the project's id
  - `video` (string) — the render's file name, as get_project lists it

### `unlock_video`

Re-renders one of the project's videos without the watermark for one credit, and answers with it, a new public watch link to the clean copy and its pictures (links to the marked copy keep showing it), and the org's credits left. Status running while it still renders; get_project shows watermark false once done. The same video again spends nothing.

HTTP: `POST /api/v1/projects/:project_id/unlock`, the other fields as the JSON body.

Input:
  - `project_id` (string, in the path) — the project's id
  - `video` (string) — the rendered video's file name, as get_project lists it

### `create_variant`

A personalized copy of the project's finished video for one recipient, from the fields given. Answers at once with the public watch link and its pictures; the video lands under that link minutes later. Costs one credit; a repeat for the same external_id is the same variant, free.

HTTP: `POST /api/v1/projects/:project_id/variant`, the other fields as the JSON body (the body is {external_id?, prompt?, video?} with the fields beside them, flat).

Input:
  - `project_id` (string, in the path) — the project's id
  - `external_id` (string, optional) — the recipient's id in the caller's system (an email, a domain)
  - `prompt` (string, optional) — notes for the director on this recipient
  - `video` (string, optional) — the base render's file name; absent, the newest
  - `fields` (record, optional) — the recipient's fields, as the director sees them

### `get_variant`

A variant's state and links.

HTTP: `GET /api/v1/projects/:project_id/variant/:variant_id`.

Input:
  - `project_id` (string, in the path) — the project's id
  - `variant_id` (string, in the path) — the variant's id

