# Engineering Hub, template (v5)

One engine, many hubs: the engine files come from this repo and are updated in place with
`tools/hub-update.sh`; each project keeps only its content (`content/`, `assets/img/`).
Never edit engine files inside a hub; fix them here, tag a release, and update the hubs.

## v5 (5.0.0): one web app, the v4 page retired

The hub is a React app (source in `web/`, built with `cd web && npm ci && npm run build`, which
places `index.html` and `assets/app/` at the template root). It reads the same `content/`
contract as v4: `brand.json`, `manifest.json` (from `node build.mjs`), `data/loop.json`
(`tools/sync_loop.py`), `data/system.json` (`tools/sync_system.py`), the spec copies under
`content/specs/`, sections and the library. v4 hash links (`#/loop`, `#/spec/...`, section ids)
redirect to their v5 pages. `hub-update.sh` removes the v4 files listed in `tools/engine-retired.txt`.

Views: Home, Work (board and table, one page per work item with the phases as tabs and an
Impact tab), Quality, **System**, Environments, Knowledge.

### System: the picture every work item adds to

Each spec in the workspace records what it changes in `outputs/impact.json` (components, flows,
infrastructure, screens, use cases, decisions, and where in the code). The workspace's
`tools/impact.py json` merges them over `repos.yaml` and `docs/architecture/baseline.json`;
`tools/sync_system.py` writes the result to `content/data/system.json`. The hub shows:

- on a work item, the Impact tab: its part of the system map coloured by change, its
  communication-matrix rows, infrastructure, screens, use cases and the files and branches it touches;
- under System (`#/system`): the whole map by layer, the communication matrix, infrastructure,
  screens, use cases, and how the system grew, work item by work item. Click any component for
  what it talks to and every change made to it.

Local preview against a hub: `cd web && HUB_DIR=<hub folder> npx vite` (port 8906).

The v4 notes below still describe the content contract and `build.mjs`.

## v4: the agentic engineering loop as the front door

A hub can open on the loop instead of the overview. It displays a workspace made from the
agentic engineering project template (`specs/<KEY>-<slug>/`, `tools/spec.py`) and never holds
its own status: phase, approvals and tasks come only from `spec.py`.

| Page | Route | Source |
|---|---|---|
| The loop: intakes (idea, tracker ticket, GitHub issue, PR), the phases with command, tools and gate, every spec by phase | `#/loop` | `content/data/loop-config.json` + `content/data/loop.json` |
| One piece of work, fixed tabs: Overview, Intent, Code review (per area), Findings, Feedback, Spec, Design, Tasks, Tests, History; each phase links to its command in the loop diagram (`#/loop/cmd/<name>`) | `#/spec/<dir>/<tab>` | the spec's files, copied by `tools/sync_loop.py` |
| Findings across work, all or by review area (architecture, infra, APIs, data, localization, UI/UX, security, tests) | `#/findings/<area>` | each spec's `outputs/findings.json` |

Set up: in `brand.json` add `"home": "loop"` and `"workspace": "<path to the workspace from this folder>"`;
copy `content/data/loop-config.json` and name your MCP servers and tools in it; then
`python3 tools/sync_loop.py && node build.mjs`. Add the loop pages to `content/nav.json`
(`#/loop`, `#/findings/all`, one `#/spec/<dir>/overview` per spec).

Brand additions: `markSvg` (SVG used as favicon and gate mark), `logoDark`, and `home` (also the
topbar link). Extension scripts can add pages through `window.HUB_ROUTES`, wide pages through
`window.HUB_WIDE` and search entries through `window.HUB_SEARCH`, using the helpers on `window.Hub`.

## Side menu

Built only from `content/nav.json` and the data, so content changes show after `node build.mjs`.
Groups collapse (remembered per browser) and the group holding the open page always opens. The
open page is highlighted, including its child pages (`#/spec/X/design` lights `#/spec/X`; a
section lights its `parent` from `sections.json`, or the entry its eyebrow names). Badges come from
the data: counts (features, ADRs, gaps, docs, open questions, ...), open findings per review area
(`#/findings/<area>`), and a test page's latest pass rate read from its lede (`latest <run> 61/61`).
A Work group (`fromLoop`) lists every spec under its phase in loop order, all seven phases shown.
Left out automatically: entries whose page does not exist or whose module is off, repeats of a
route already listed, and loopback links (`127.0.0.1`, `localhost`) when the hub is not served from
this machine. Keys: `/` filters the menu, arrows move, left / right close and open a group, `[`
collapses the menu to an icon rail on desktop. Below 1000px it is an off-canvas drawer.

On desktop the side menu holds only the Work group; every other `nav.json` group is a drop-down in
the menu bar under the top bar. Below 1000px all groups sit in the drawer. Spec titles wrap to two
lines. Spec documents (`pages`) are not menu entries: every spec page shows them in a Documents bar under
the phases, and a page whose id equals a review area (`architecture`) is also embedded at the top
of that area's tab, above the code review notes.

## Spec documents (full pages)

A spec can show whole self-contained HTML documents (an architecture document, a communication
matrix) as full pages with their own menu, tabs and inline scripts, instead of slicing their
sections into review areas. Declare them in `content/data/loop-config.json`:

```json
"pages": {
  "<spec dir>": [
    { "id": "architecture", "title": "Architecture", "src": "outputs/architecture" },
    { "id": "communication-matrix", "title": "Communication matrix", "src": "outputs/communication-matrix" }
  ]
}
```

- `src` is relative to the spec folder in the workspace: a file, or a versioned folder whose
  highest `v<N>-<YYYY-MM-DD>.html` is used (`index.html` is ignored). A path starting with
  `content/` is relative to the hub instead. `tools/sync_loop.py` copies it to
  `content/specs/<dir>/pages/<id>.html` and lists it in `loop.json` (`pages`, with the version).
- Route `#/spec/<dir>/page/<id>[/<section-id>]`: the document fills the viewport in a frame,
  opened at `#<section-id>` when given; the document's own hash changes are written back into the
  hub URL, so every view has a shareable hub link. Each page is listed under its spec in the side
  menu, in the spec page's aside (Documents) and in search.
- Document rules: one self-contained file (inline CSS, SVG and JS; scripts only from
  cdnjs.cloudflare.com; no fetch of other files). Views are `<section id>` with an `<h2>` and read
  stacked without JS; a side menu switches them by `location.hash` (`hashchange`). Colours are CSS
  custom properties on `:root`, with dark values under `:root[data-theme="dark"]` and
  `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}`: the hub sets
  `<html data-theme>` in the frame to follow its theme toggle. Fluid width (no fixed page width;
  `max-width` 1440px or less, centred), works from 360px, own scrolling inside the document
  (`body` scrolls; sticky, not fixed, side menu). Inline SVG uses `viewBox` with `width:100%` and
  colours from the tokens or `currentColor`. Fonts: Poppins and JetBrains Mono (Google Fonts) or
  the system stack.
- `"phase": "<phase key>"` on a page also makes it a tab of that phase, framed, with a link to
  the full page.
- The older `attachments` (sections of a document copied into a review area) still work.

## Phase documents (`docs`)

Documents that already exist in the hub's own repo (an initiative README with its updates log,
a gap analysis, user stories, an implementation plan, a folder of design screenshots) become tabs
of the phase they belong to, rendered with the hub's markdown renderer, and cards in the
Documents bar. Declare them in `content/data/loop-config.json`:

```json
"docs": {
  "<spec dir>": [
    { "id": "overview", "title": "Initiative summary", "phase": "intent", "src": "engineering-hub/KEY-1/README.md" },
    { "id": "gap-analysis", "title": "Gap analysis", "phase": "intent", "src": "engineering-hub/KEY-1/gap-analysis" },
    { "id": "team-feedback", "title": "Team feedback", "phase": "intent", "src": "engineering-hub/KEY-1/gap-analysis", "match": "team-feedback" },
    { "id": "designs", "title": "Figma designs", "phase": "design", "src": "engineering-hub/KEY-1/designs" }
  ]
}
```

- `src` is relative to the repo root (`brand.json` `repoRoot`): a `.md` or `.html` file, or a
  folder. A folder shows its newest exact `v<N>-<YYYY-MM-DD>` file (else the newest `v<N>-…`
  companion, else `README.md` / `index.html`), and lists every other file as a version, newest
  first. `match` is a regex on file names that narrows the folder. A folder with only images is
  a gallery. Paths under a `test-data` folder are refused (personal data).
- `tools/sync_loop.py` lists them in `loop.json` (`docs`, with the version and every version
  file); `build.mjs` mirrors any that sit outside `docsDir` and `kbRoots` into `content/kb-src`.
- Route `#/spec/<dir>/<phase>/doc:<id>[/<version file>]`. Markdown renders natively; HTML is
  framed and themed. Relative links and images resolve like knowledge-base documents, and a link
  to any version of a phase document (from a spec tab or the knowledge base) opens that tab.
- Each document is in search. The knowledge base still lists it.

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
   For a **loop hub** (the agentic engineering loop as the front door), also set
   `"workspace"` to the engineering workspace folder relative to this hub (a repo made
   from the agentic engineering project template: `specs/` and `tools/spec.py`). The hub
   then opens on `#/loop`; the nav groups Agentic loop, Work and Review areas come with the
   template's `content/nav.json`, and `content/data/loop-config.json` holds the Start here
   steps (set `start.exampleKey`, `start.org` and the clone commands for your project).
   `./sync.sh` reads the workspace. An existing hub gets the same groups and sections
   from `tools/hub-update.sh` once `"workspace"` is set (only what is missing is added).
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
| Knowledge base | automatic: `build.mjs` scans `docsDir` and links every `.md` except `CLAUDE.md`; a folder with exact `v<N>-<YYYY-MM-DD>.md` files lists only its highest version plus its `README.md` (older versions are still copied, so the index links work; run logs such as `v3-<date>-run.md` stay listed). Add more folders (Markdown, HTML, PDF) with `kbRoots` in `brand.json`; versioned folders contribute only their latest `v<N>-<date>` file |
| Learning paths | `content/learning/paths.json` (paths, each an ordered list of course ids or `course/lesson` refs) + one `content/learning/courses/<id>.json` per course + lesson files. See "Learning paths" below |
| Navigation | `content/nav.json`: groups of `{ title, icon, route, badge?, tone? }`. Group options: `collapsed` (starts closed; an `Archive…` group does by default), `fromLoop` (every spec in `loop.json`, grouped by phase, with criteria passing), `fromSections` (a section id prefix or list whose pages are appended). See "Side menu" below |

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
| `adrDir` | ADR markdown folder (default `docs/adr`, relative to `repoRoot`, may point into the workspace); files win over `adrs.json`, are copied into the knowledge base and open from the Decision log |
| `workspaceUrl` | web URL of the workspace repo's tree (e.g. `https://github.com/<org>/<repo>/blob/main`): a spec document's link to a workspace file the hub does not carry opens there; without it such links render as plain text |
| `defaultParty`, `roadmapSort` | initial roadmap / feature filter and sort (`fid`, `seq`, `run`, ...) |
| `modules` | switch pages on or off: `{ "learn": false, "releases": true }`. Without a flag a data page (`learn`, `releases`, `dispatch`, `stories`, `vendors`, `questions`) shows only when its data exists |
| `deploy` | `{ bucket, prefix, cloudfront, url }`, or a list of them each with a `name`, read by `./sync.sh --deploy [name]` (every target by default) |

Optional data files switch modules on by being present: `content/learning/paths.json`
(learning paths), `content/data/releases.json` (Releases page: `releases: [{ id, date, env,
title, tickets, notes, platforms: [{ platform, component, version, where, status }], build }]`),
`feedback.json` (client feedback changelog), `questions.json`, `vendors.json`,
`content/stories/*.json`. Any `sections.json` entry without its own page renders as Markdown; give it
`"base": "content/kb-src/<repo path of its source>"` when it is generated from a repo document, so
the source's relative links resolve.

Links in rendered documents: a relative link to a file the hub carries becomes a hub page (knowledge
base documents, spec intent, spec, design, tasks, test plan, reviews, feedback, contracts, outputs,
ADRs); a link to a file the hub does not carry renders as plain text with the path in its tooltip, so
no link is dead. Headings get GitHub-style ids, so `#anchor` links scroll within the document.

## File map

```
VERSION                engine version (hub-update.sh copies it; content/.template-version records the update)
index.html             the v5 app shell, built from web/
assets/app/            the v5 app bundle (built from web/, never edit)
assets/css/mockup-kit.css  branded UI primitives for feature mockups
web/                   the v5 app source (React + Vite), template only: cd web && npm run build
build.mjs              assembles content/manifest.json and mirrors docs into content/kb-src
sync.sh                sync_loop.py, sync_agentic.py, sync_system.py, then build.mjs (--deploy to S3)
tools/                 the sync scripts, hub-update.sh, engine-files.txt, engine-retired.txt
content/brand.json     brand config (edit this)
content/*.json         nav, overview, sections config
content/data/*.json    features, adrs, gaps, security, performance, gtm, summary, roadmapExtra;
                       loop.json and system.json are generated from the workspace
content/features/*.md  one dossier per feature (8 sections)
content/mockups/*.html one branded mockup per feature
content/sections/*.md  the long-form section pages
content/learning/      paths.json, courses/*.json, lesson markdown
content/kb-src/        (generated) your repo docs, copied in so they render in the hub
content/learning-src/  (generated) HTML lessons copied in from elsewhere in the repo
```

Also included: `ci/engineer-hub.yml` (CI template). `content/kb-src/` and
`content/manifest.json` are generated by the build. The hub has no backend and no database:
it is static files over `content/`.

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

## Automate (CI) and deploy

`./sync.sh` rebuilds; `./sync.sh --deploy` rebuilds and deploys to the S3 bucket, prefix
and CloudFront distribution of every target in `brand.json` `deploy` (`--deploy <name>` for one) (env `HUB_BUCKET`, `HUB_PREFIX`,
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
