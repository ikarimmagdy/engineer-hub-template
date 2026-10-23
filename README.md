# Engineering Hub, template (v3)

One engine, many hubs: the engine files come from this repo and are updated in place with
`tools/hub-update.sh`; each project keeps only its content (`content/`, `assets/img/`).
Never edit engine files inside a hub; fix them here, tag a release, and update the hubs.

A reusable, branded internal engineering portal. Drop it into any project to give the
team one place for: an overview, **learning paths** (courses in sequence), a roadmap task-board, per-feature dossiers (product,
BRD, PRD, UX/mockup, technical, status, security/perf, tests), architecture,
infrastructure, CI/CD, observability, an ADR log, a gaps/quality board, security,
performance, a GTM / production-readiness board, and a knowledge base that links every
local doc in the repo.

It is a static site (HTML, CSS, one JS file) whose **content is data**: markdown +
JSON under `content/`. No framework, no build server. A small `build.mjs` assembles a
manifest and copies your repo docs in so they are viewable in the hub.

## Use it in a project (5 minutes)

1. Copy this folder into the project, for example `outputs/engineer-guide/`.
2. Edit `content/brand.json` with the project's brand:
   ```json
   { "name": "Acme", "logo": "assets/img/logo.png",
     "primary": "#006aa6", "primaryFill": "#00a4f1",
     "primaryLight": "#5fccff", "primaryDark": "#004261",
     "font": "'Montserrat', system-ui, sans-serif", "docsDir": "docs" }
   ```
   Drop the project logo at `assets/img/logo.png`. `docsDir` is the repo folder whose
   markdown should be linked into the Knowledge base (relative to the project root,
   which is two levels above this folder by default; adjust in `build.mjs` if you place
   it elsewhere).
3. Fill content (see below), then build:
   ```
   cd engineer-guide && node build.mjs
   ```
4. Preview locally (fetch needs HTTP):
   ```
   cd .. && python3 -m http.server 8799
   # open http://localhost:8799/engineer-guide/index.html?pass=changeme
   ```
5. Deploy: sync the folder to any static host (S3 + CloudFront, Netlify, etc.).

## Rebrand

Everything brand-specific is in `content/brand.json` (colours, logo, name, font,
passcode) and `assets/img/`. The CSS reads brand colours at runtime and `build.mjs`
writes the name, base href, fonts, favicon and logo into `index.html`, so no engine edit
is needed. Extra project CSS goes in an optional `content/brand.css` (linked after the
engine CSS when present).

## Add content

| Thing | File(s) |
|---|---|
| A feature | add an entry to `content/data/features.json`, write `content/features/<id>.md` (copy `features/sample.md`, 8 sections) and `content/mockups/<id>.html` (copy `mockups/sample.html`) |
| Roadmap board | columns are the stages in `content/data/lifecycle.json`; each feature's `lifecycle` places it (features without one derive it from `status`). Cards show `fid`, `version`, `seq`, `wave`, `type`, `reopened` and a copyable branch name `feature/<fid>-<slug>`. Filters: run state, area, version, type, reopened, search |
| Dispatch board | `#/dispatch`, computed from `lifecycle`, `dependsOn` (fids) and `repos` (`repo` locks a whole repo, `repo:area` only that area). Shows running, can-start-now (parallel-safe), waiting and why, plus a copyable Claude prompt per ticket. Same rules on the command line: `python3 tools/dispatch.py` | An open P0 question whose `blocks` names a ticket marks it Blocked once its dependencies are built, unless the feature lists that question in `startsWithout` (it can start, for example against a mock, and the question is only needed to finish).
| Environments | per ticket `env` in `features.json`: `{ "local": { "state", "date", "ref", "note" }, "dev": {...}, "demo": {...}, "prod": {...} }`, state `not-started` / `built` / `partial` / `deployed` / `verified` / `blocked`; environment names come from `lifecycle.json` `environments`. Cards show one chip per environment, the board filters by environment and state, the dossier has an Environments table. Without `env`, states are derived from `lifecycle` and drawn dashed |
| Ticket prompt | every feature with a `fid` gets a Tracking card and a generated Claude prompt (scope from `promptScope`, base branch from `baseBranch`). Paths, work log, evidence folder and agent names come from `brand.json` `prompt` |
| Third parties | `content/data/vendors.json`: each provider, vendor or partner with role, adapter placement, position (adopt / pilot / evaluate / hold / reject), strengths, risks, questions to ask, conflicts, decisions and roadmap items; optional write-up in `content/sections/third-parties.md`. Page `#/vendors` |
| Decisions from files | if `docs/adr/NNNN-slug.md` files exist (the `/adr` format, set `adrDir` in `brand.json`), the Decision log is built from them instead of `content/data/adrs.json` |
| Client feedback | optional `content/data/feedback.json` (`batches`, `items` with `fid`, `client`, `today`, `analysis`, `defects`, `fixes`) turns the Changelog into a searchable feedback list, development sequence and fix log; without it the Changelog is the plain `changelog.md` |
| Decisions | `content/data/adrs.json` |
| Gaps / defects | `content/data/gaps.json` + `content/data/summary.json` |
| Security / performance | `content/data/security.json`, `content/data/performance.json` |
| GTM / production readiness | `content/data/gtm.json` (items grouped by `workstream`) |
| Section pages | `content/sections/*.md` (product, architecture, infra, cicd, observability, security, performance, accounts, changelog) |
| Knowledge base | automatic: `build.mjs` scans `docsDir` and links every `.md`. Add more folders (Markdown, HTML, PDF) with `kbRoots` in `brand.json`; versioned folders contribute only their latest `v<N>-<date>` file |
| Learning paths | `content/learning/paths.json` (paths, each an ordered list of course ids or `course/lesson` refs) + one `content/learning/courses/<id>.json` per course + lesson files. See "Learning paths" below |
| Navigation | `content/nav.json` |

Then run `node build.mjs` and re-deploy. To keep it current automatically, run the
build and sync in CI on merge to your main branch.

## Learning paths

Courses in a deliberate order, so a new person learns the platform step by step instead of
reading documents at random. Three levels:

- **Path**: an ordered list of steps (`"steps": ["intro", "core-1", "core-2/03-ledger"]`). A step
  is a whole course or one lesson (`course/lesson`). Use several paths for different roles or a
  fast track.
- **Course** (`content/learning/courses/<id>.json`): `code`, `title`, `level`, `goal`, `outcomes`,
  `prereqs` (course ids), and ordered `lessons`.
- **Lesson**: `id`, `title`, `minutes`, `objectives`, `checks` (`[{ "q", "a" }]`, shown as
  "Check your understanding" with reveal answers), `sources`, and either `src` (a Markdown file in
  this folder) or `from` (an existing HTML lesson anywhere in the repo, relative to `repoRoot`;
  the build copies it into `content/learning-src/` and embeds it).

The hub shows each path as numbered steps with progress, a course page with outcomes,
prerequisites and a lesson list, and a lesson page with objectives, content, checkpoints,
mark complete and previous / next (the last lesson links to the next course in the path).
Progress is kept per browser in `localStorage`. The lesson shape that works best: The idea,
A concrete case, How it works in the platform, What goes wrong, The vocabulary, Where to look.

## Config reference (`brand.json`)

| Key | Meaning |
|---|---|
| `name`, `logo`, `primary*`, `font` | brand |
| `passcode` | soft-gate passcode (default `changeme`) |
| `repoRoot` | project root relative to this folder (default `../..`) |
| `docsDir` | Markdown docs folder scanned into the knowledge base |
| `kbRoots` | extra knowledge-base folders: `{ dir, group, types, latestOnly, exclude }` |
| `parties` | feature owners/areas: `{ "key": { "label", "color" } }` (filter chips and card chips) |
| `repoBase`, `codeDir`, `repos` | traceability to code clones (`codeDir` is also where `tools/dispatch.py` reads git state) |
| `prompt` | `{ workspace, worklog, evidenceDir, deploy, agents: { validator, tests, behavior, uiux, review }, branchPattern, depCheck, howToWorkTitle, howToWork: [lines], workflow: [lines] }` used in generated ticket prompts. `howToWork` / `workflow` replace the default blocks; lines may use `{fid}`, `{fidLower}`, `{hub}`, `{evidence}`, `{code}`, `{branch}`, `{baseBranch}`, `{promotion}`, `{worklog}`, `{deploy}`, `{feedbackStep}` |
| `logoDark` | logo for dark mode |
| `baseHref` | `<base href>` (default `./`; use `/hub/` when served at a path without a trailing slash) |
| `fontsUrl` | Google Fonts css2 URL for `font` |
| `markRadius`, `markStroke` | favicon and gate mark shape and plus colour |
| `repoUrls` | per-repo web URL overrides (`""` = no remote); repos may be nested paths such as `area/code/repo` |
| `adrDir` | ADR markdown folder (default `docs/adr`); files win over `adrs.json` |
| `defaultParty`, `roadmapSort` | initial roadmap / feature filter and sort (`fid`, `seq`, `run`, ...) |
| `modules` | switch pages on or off: `{ "learn": false, "releases": true }`. Without a flag a data page (`learn`, `releases`, `dispatch`, `stories`, `vendors`, `questions`) shows only when its data exists |
| `deploy` | `{ bucket, prefix, cloudfront, url }` read by `./sync.sh --deploy` |

Optional data files switch modules on by being present: `content/learning/paths.json`
(learning paths), `content/data/releases.json` (Releases page: `releases: [{ id, date, env,
title, tickets, notes, platforms: [{ platform, component, version, where, status }], build }]`),
`feedback.json` (client feedback changelog), `questions.json`, `vendors.json`,
`content/stories/*.json`. Comments are on when `content/comments-config.json` has
`"enabled": true`. Any `sections.json` entry without its own page renders as Markdown.

## File map

```
index.html            shell (gate, topbar, sidebar, content mount)
assets/css/hub.css     the hub theme (reads brand colours)
assets/css/mockup-kit.css  branded UI primitives for feature mockups
assets/js/hub.js       the engine (router, board, dashboards, markdown + mermaid, search)
build.mjs              assembles content/manifest.json and mirrors docs into content/kb-src
content/brand.json     brand config (edit this)
content/*.json         nav, overview, sections config
content/data/*.json    features, adrs, gaps, security, performance, gtm, summary, roadmapExtra
content/features/*.md  one dossier per feature (8 sections)
content/mockups/*.html one branded mockup per feature
content/sections/*.md  the long-form section pages
content/learning/      paths.json, courses/*.json, lesson markdown
content/kb-src/        (generated) your repo docs, copied in so they render in the hub
content/learning-src/  (generated) HTML lessons copied in from elsewhere in the repo
```

Also included: `content/comments-config.json`, `assets/js/comments.js` (comment widget),
`backend/comments/` (comments API), `sync.sh` (build/deploy), `ci/engineer-hub.yml`
(CI template). `content/kb-src/` and `content/manifest.json` are generated by the build.

## Link the hub to your code (traceability)

Cite source files in each dossier using **repo-prefixed paths**, e.g.
`your-api/src/thing.service.ts` or `your-web/src/views/Thing.vue`. At build time the hub
cross-checks every cited path against the clones in `code/` and produces the
**Traceability** page: *linked* (files exist), *drift* (a cited file is missing), or
*no link* (a built feature with no cited path). It also links each file to its exact
commit. Set `repoBase` (and optional `repos` allowlist) in `brand.json`; if `code/` is
absent the build just skips traceability. This is how you keep the hub honest as the
code changes: update the cited paths in the same change, rebuild, and the page shows any
drift.

## Comments

`assets/js/comments.js` adds a per-page comment widget (leave, reply, accept, resolve).
Until you deploy a backend it runs in local-demo mode (per-browser). To make comments
shared and readable, deploy `backend/comments/` (AWS SAM: HTTP API + Lambda + DynamoDB,
see its README) and set `apiUrl` in `content/comments-config.json`. Reviewer actions are
gated by `reviewerPasscode`.

## Automate (CI) and deploy

`./sync.sh` rebuilds; `./sync.sh --deploy` rebuilds and deploys to the S3 bucket, prefix
and CloudFront distribution in `brand.json` `deploy` (env `HUB_BUCKET`, `HUB_PREFIX`,
`HUB_CF` override). A hub with its own deploy script keeps it; the update never touches it. Copy `ci/engineer-hub.yml`
to your project's `.github/workflows/` and set the repo/secrets noted at its top, so a
push to your deploy branch rebuilds and ships the hub automatically.

Libraries (marked, mermaid) load from cdnjs at runtime; everything else is local.

## Update a hub to the latest template

From the hub folder:

```
tools/hub-update.sh                 # latest main
tools/hub-update.sh --ref v3.0.0    # a tagged version
tools/hub-update.sh --dry-run       # list the engine files that would change
```

It clones this repo (`HUB_TEMPLATE_REPO` overrides the URL, `HUB_TEMPLATE_DIR` uses a local
checkout), runs `tools/hub-migrate.mjs` (adds missing `brand.json` keys read from the old
engine files, never overwrites content), replaces only the files in
`tools/engine-files.txt`, records the version in `content/.template-version` and runs
`node build.mjs`. A hub that predates v3 has no `tools/hub-update.sh`; run the template's
copy once: `HUB_TEMPLATE_DIR=<checkout> <checkout>/tools/hub-update.sh <hub-dir>`.
