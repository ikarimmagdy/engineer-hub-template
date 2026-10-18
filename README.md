# Engineering Hub, template

A reusable, branded internal engineering portal. Drop it into any project to give the
team one place for: an overview, a roadmap task-board, per-feature dossiers (product,
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

Everything brand-specific is in `content/brand.json` (colours, logo, name, font) and
`assets/img/logo.png`. The CSS reads brand colours at runtime, so no CSS edit is
needed. The soft access passcode is `PASSCODE` near the top of `assets/js/hub.js`
(change it, or remove the gate for an open site).

## Add content

| Thing | File(s) |
|---|---|
| A feature | add an entry to `content/data/features.json`, write `content/features/<id>.md` (copy `features/sample.md`, 8 sections) and `content/mockups/<id>.html` (copy `mockups/sample.html`) |
| Roadmap board | feature `status` (built / partial / planned / next / future) drives the columns; extra non-feature items go in `content/data/roadmapExtra.json` |
| Decisions | `content/data/adrs.json` |
| Gaps / defects | `content/data/gaps.json` + `content/data/summary.json` |
| Security / performance | `content/data/security.json`, `content/data/performance.json` |
| GTM / production readiness | `content/data/gtm.json` (items grouped by `workstream`) |
| Section pages | `content/sections/*.md` (product, architecture, infra, cicd, observability, security, performance, accounts, changelog) |
| Knowledge base | automatic: `build.mjs` scans `docsDir` and links every `.md` |
| Navigation | `content/nav.json` |

Then run `node build.mjs` and re-deploy. To keep it current automatically, run the
build and sync in CI on merge to your main branch.

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
content/kb-src/        (generated) your repo docs, copied in so they render in the hub
```

Libraries (marked, mermaid) load from cdnjs at runtime; everything else is local.
