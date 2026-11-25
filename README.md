# Engineering Hub, template (v5)

One engine, many hubs: the engine files come from this repo and are updated in place with
`tools/hub-update.sh`; each project keeps only its content (`content/`, `assets/img/`).
Never edit engine files inside a hub; fix them here, tag a release, and update the hubs.

## What a hub expects from its workspace

The hub reads a workspace made from the agentic engineering template (`ikarimmagdy/agentic-engineering-template`),
which carries the rules these pages rely on: each phase's diagrams in `outputs/diagrams/<phase>/v<N>-<date>.md` with
titles starting by kind (Visual mode, diagrams inside sections), the Floorplan code map in `outputs/floorplan/`,
`## ` / `<h2>` sections in long documents, version indexes, no laptop paths (publishing refuses them), `impact.json`
per work item (System), and `usage/agent-runs/` for shared agent counts (Home). A workspace adopting the hub, or work
written before these rules, runs `python3 tools/hub_check.py` and `/hub-review all` there to come in line.

## A hub without a passcode (5.18.3)

- `"passcode": false` in `brand.json` opens the hub with no passcode page and no Sign out, for a host that is only on
  the internal network. Leaving `passcode` out still means the `changeme` default.

## Static hosts: no loop API from index.html (5.18.2)

- A static host answers `/api/loop` with `index.html` and 200. The hub took that for the local loop API, polled
  `/api/loop/runs` and Home failed blank after the password. A loop API answer must now be JSON; agent runs default
  to an empty list.

## No organisation names in the engine (5.18.1)

- The intake examples read `your-org/<repo>#<n>` and the agent design examples name no team, so a hub never shows
  another organisation's name. The engine also ships inside the agentic workspace template as its `hub/` folder.

## Sections with their diagrams, sectioned HTML documents (5.18.0)

- A phase's documents and their sections are labelled: **Documents of this phase** above the buttons, **Sections of
  <document>** above the side menu.
- **Design:** each section of the design shows the diagrams that explain it above its text (Sequence diagrams in
  "Sequence", the data model in "Data", deployment in "Deployment", patterns in "How it works"; `lib/sections.ts`
  `matchDiagrams`, by the kind a diagram title starts with, else by shared words). A section with more than two
  diagrams shows them one at a time behind chips. **Visual** keeps the same side menu with only the sections that have
  diagrams; diagrams no section fits get a page each under **More diagrams**. The menu marks sections with ◇ and a count.
- **Visual** on the other phase tabs is one diagram per page with a side menu, grouped by kind (Journey, States, ...),
  instead of one long page.
- **HTML documents** (architecture, network matrices, environment documents) show one `<h2>` section at a time with a
  side menu built from the document's own headings, on the work item and in System > Documents; "Open the whole page"
  keeps the full document a click away.

## System: the system first, documents as a library (5.17.0)

- **System** opens on the **Map**: every lens up to **How it grew** shows the one system model merged from every work
  item's `impact.json`, nothing else. The work items' own HTML documents (architecture, network matrices, environment
  documents, code maps) moved from the first tab and from the top of Communication matrix and Infrastructure into a
  last tab, **Documents**: a library with a filter by kind and by work item. Communication matrix and Infrastructure
  point to the documents of their kind in one line.
- The work item control is **Highlight a work item** (a chip shows which one and clears it); on Documents it picks
  whose documents to list. `/system/architecture` redirects to `/system/documents` with the same query; a component
  found in search opens on the Map.

## Top people, recent news, People and News pages (5.16.0)

- **Home:** **Top people using AI** sits beside the AI chart: the ten who use it most (AI-assisted commits plus agent
  pull requests), one bar each in the chart colours, a star for anyone new to AI this month, and a link to **People**.
  **Recent news** replaces the inspiration cards: highlights first (speed through the loop, quality reached, diagrams,
  code maps, first AI-assisted commits, first agent pull requests merged), each with its detail, and a link to **News**.
  The people cards left Home for the People page.
- **People** (`/people`): the top ten as detailed cards (commits, AI-assisted, agent pull requests, agent runs, AI
  share, weekly trend, first AI-assisted commit, work items started, repos, achievements), everyone else in a table;
  using AI or everyone, sort by use of AI, AI-assisted commits, commits, agent pull requests or name; `?q=` finds one.
- **News** (`/news`): every event by kind (highlights, speed, quality, diagrams, code maps, new to AI, agent pull
  requests, agents, work started, approvals) and by when (this week, earlier this month, before).
- `sync_insights.py` writes up to 80 events with a `detail` line, adds work started, approvals (one line per person,
  work item and day) and first agent pull requests merged, and keeps every highlight before routine events.

## Workspace insights on Home, weekly digest (5.15.0)

- `tools/sync_insights.py` (run by `sync.sh`) writes `content/data/insights.json`: the last 12 weeks of git history of
  the workspace and every cloned repo of `repos.yaml` (commits per week, repo and person; AI-assisted when the message
  says `Co-Authored-By: Claude` or "Generated with Claude Code"), their pull requests through `gh` (agent pull request:
  "Claude Code" in the description, or an `agent/` or `<KEY>/T<n>` branch), agent runs, adoption per repo group and
  events for the inspiration cards. Bots are left out, name spellings of one person merged, people by name only (no
  email or login is written).
- **Home** opens with six headline tiles (each with a 12-week trend and the change on the week before), inspiration
  cards from real events, **AI-assisted work week by week** (commits or pull requests), **Agents at work** (runs per
  agent, an estimate of time saved, stated as an assumption), **The loop** (work per phase, median days per gate from
  the items that went through it live) and **Most active repos**; then one feed **What is happening** (needs someone,
  approvals, phase moves, agent runs) under the filter bar; **People using agents** (cards, alphabetical, no ranking,
  achievements) and **Adoption by repo group** close it. Charts follow the dataviz rules (validated series colours
  `--series-1`, `--series-2` in both themes, legends, tooltips, a table view).
- **Weekly digest** (`/insights`): the same in one page, **Copy for Slack** and **Print**.
- Team agent numbers: `tools/share_usage.py --push` shares a person's daily run counts (agent and count only) into the
  workspace folder named by brand.json `usageDir`; without it the agent numbers are this laptop's.

## Each phase in pictures, code map (5.14.0)

- **Visual mode:** each phase tab of a work item (Findings, Requirements, Design, Tasks, Tests) has a **Document /
  Visual** switch (`?mode=visual`); Visual shows the phase's diagrams (`components/PhaseVisual.tsx`): the newest
  `outputs/diagrams/<phase>/v<N>-<date>.md` of the work item, any version one click away. Every step of **Where this
  work is in the loop** has a **Diagrams** tab too, so Deploy and Maintain (no tab of their own) show theirs. Wide
  diagrams keep their natural size and scroll sideways instead of shrinking to the column.
- `tools/sync_loop.py` copies every version of `outputs/diagrams/<phase>/` and lists them in `loop.json` as
  `diagrams` per phase. What each phase draws is the workspace's convention (`specs/README.md`, "Diagrams"); the
  phase commands write them.
- **Code map:** an `outputs/floorplan/v<N>-<date>.html` (a [Floorplan](https://github.com/haydenschmitty/floorplan)
  map of the work item's repos, saved by `/build`) becomes a page of kind `code-map`, shown in the Build phase's
  Visual mode and on System > Architecture.

## Filters and long lists on Home and Work (5.13.0)

- One filter bar on **Home** and **Work** (`components/WorkFilter.tsx`), kept in the URL: **Work item** (type a ticket,
  idea key or name; suggestions list every item as "KEY · title"), **Phase**, **Needs** (waiting for approval, blocked
  tasks, critical findings), **Type** (idea, Jira ticket, GitHub issue, pull request), **Started by** and **Repo**.
- **Board:** five cards per column, then "Show N more"; **Detailed** or **Compact** cards (one line: key, title and a
  dot for what needs attention), remembered per browser; any column collapses to its title.
- **Table:** 25 rows a page and a header that stays in view.
- **Home:** "Act on these first" and "Recent activity" show their first items with "Show all"; **In flight** is grouped
  by phase, four per phase, with a link to the rest on Work.

## The loop on the work item, actions per step, chat (5.12.0)

- **Work board** cards show the whole title, the next step, tasks and criteria meters, repos, open findings, the
  updated date and, on the local hub, the agent working on the item now. **Hide empty columns** (remembered per
  browser) drops phases with no work; the columns share the width, so fewer columns mean wider cards.
- A work item's **Overview** opens with **Where this work is in the loop** (`components/LoopCycle.tsx`): the seven
  steps as one cycle (done, current, not reached; gates; the agents of each step; live and last runs; Maintain
  feeding back into Intent). Pick a step for what it does, its gate, what it hands over, **Who works on it** (agents,
  tools, runs) and **Building blocks** (you and context, the recipe, the model and subagents, what is enforced, what
  it reaches and hands over), read from the workspace's `.claude` wiring.
- **Actions per step** on the local hub: approve the gate, accept and move on, revalidate (`spec.py check`), rerun
  the step's command with an optional note, send the work back a phase, reopen a done step (both with a reason that
  `spec.py phase --note` records). Reruns are `/intent`, `/gap`, `/spec`, `/design` and `/tasks` only: no shell,
  writes inside the work item (and `docs/adr/` for `/design`), the hub's copy refreshed when the run ends, nothing
  shared until a gate is approved. Build, test, deploy and maintain commands are shown to copy into the terminal.
- **Chat** (`/chat`, and a **Chat** tab on every work item): read-only conversations with Claude on the local hub,
  each message resuming the conversation's Claude Code session; kept in the workspace's `.claude/state/hub-chats/`.
- Work item keys with a prefix (`FP-IDEA-3`) are accepted by the loop API.

## One request, ways side by side, MCP map (5.11.0)

- **The cycle** and **The loop** are one section, **One request, end to end**: a map with steps 1 to 5 once, steps 6
  to 12 as a ring (the agent loop, repeated until the model answers) and 13 the answer. `/agents/how/loop` redirects.
- **Ways to build** opens with the three ways side by side (`WaysMap`): the same job as boxes coloured by who owns
  each step (model, our code, a check), the harness loop drawn, and the reach all three share.
- **Reaching systems (MCP)** opens with a map from the model through the MCP client, hook, stdio, server and
  credentials to the API or the database and back, and a glossary of every term (meaning, where it is here) whose
  row lights with its step. **Calling an API** and **Checking a database** are now **API path** and **Database path**.
- Drawings in `pages/AgentsMaps.tsx`.

## Architecture documents on the System page (5.10.0)

- `sync_loop.py` adds every `outputs/<folder>/` of a work item that holds a `v<N>-<date>.html` as a page, even when
  `loop-config.json` does not list it, titled from the document and tagged `kind` (architecture, matrix, infra,
  other); listed pages keep their own title and can set `kind`.
- **System** opens on a new **Architecture** tab: every work item's architecture, network and environment documents,
  read in place full width with all their diagrams (pick from the list; open full page or in the work item).
  **Communication matrix** shows the per-environment network matrices first, then who talks to whom grouped by
  "from → to" pair (no paging). **Infrastructure** shows the environment documents first. The **Map** is drawn full
  width instead of shrunk to the window height.
- A work item's **Impact** tab opens on **Documents** when it has any (`components/SpecPages.tsx`).

## Who holds each role (5.9.0)

- `tools/sync_operations.py` reads the workspace's `operations-center/roles.md` (one section per role: the wordings the
  processes use, who holds it now, example tickets) into `operations.json` `people`.
- A process flow shows, under each lane's role, who holds it now (two names, hover for ticket counts); approvals show
  "now: <names>". Roles that depend on the requester say "depends on who asks". A note under the flow gives the window
  and date and where to correct it.

## Operation Center tabs and breadcrumbs (5.8.2)

- The three tabs are back on top (Processes, Journeys, Service desks); the side menu lists only the open tab's items
  (areas, journeys, desks).
- Breadcrumbs on every Operation Center page. A process opened from a journey or a desk keeps that trail
  (`?from=journey:<id>` or `?from=desk:<key>`, kept across its Workflow, Before you ask and Related tabs), so one click
  returns to the journey; from the catalog the trail is the process's area.

## Linked flows, the blocks map (5.8.1)

- A step flow and the text under it share one selected step (`components/FlowScope.tsx`): the text a step is about
  lights up, and clicking that text selects its step. Each section starts again at step 1 (the scope is keyed per
  section). The mapping of steps to text is `ANCHORS` in `pages/AgentsFlows.tsx`.
- Flows fit the width of the page instead of scrolling sideways; tables and lists under them use the full width.
- **Building blocks** opens with a map (`pages/AgentsBlocksMap.tsx`): every block where it sits (you, Claude Code,
  reach, our systems), coloured context, enforced, model or system, and the eleven numbered hand-offs of one request.
  The selected step draws its arrows and blocks and lights its row in the table.

## Side menus and step flows (5.8.0)

- **How agents work** moves its ten sections from a second tab row into a grouped side menu (Start here, How a run
  works, Building one, Reaching systems, Safety). Each section opens with a **step flow**: numbered circles coloured by
  who acts (you, the model, a hook, a tool, our system), a detail card for the selected step, previous and next, and
  Play. The worked example adds the real `/db` run as a second flow. The text stays below.
- **Operation Center** has one side menu for everything: processes by category, each journey, each service desk.
  Journeys show totals (steps, tickets, approvals, desks), a strip of numbered circles to jump to a step, and one card
  per step with a **Raise** row (desk, process, approvals, lead time) or a **Self-service** badge. Each desk has its own
  page: processes by area first, then how tickets flow, then the desk notes (the opening always shows, the rest opens
  in full on demand; no inner scrolling).
- Components: `components/SideNav.tsx`, `components/StepFlow.tsx`; flows in `pages/AgentsFlows.tsx`.
- Serve a hub with `HUB_DIR=<hub>/app PORT=<port> npx vite preview` from `web/` when agents should launch from it:
  launching, approving and moving phases need the local API, which a static server does not have.

## Activity shows why (5.7.3)

- A work item's **Activity** shows each event's note and, for a forced phase move, the gates that were skipped
  (`spec.py phase --force --note`).

## Built bundle (5.7.1)

- 5.6.0 to 5.7.0 were tagged without `npm run build` (`web/` → `index.html` and `assets/app/`), so hubs updated to them
  kept the 5.5.0 front end. 5.7.1 is the same source with the bundle built. Always release with `cd web && npm run build`.

## Who started a work item (5.7.0)

- The work item header and the **Where the work is** panel show **Started by** (name and date), and the Work board shows
  it on each card (Board) and as a sortable **Started by** column (Table). The value is `started_by` from the workspace's `spec.py json` (written by
  `spec.py new` from `git config user.name`; older items fall back to the first commit of their `status.json`).

## Design and the loop, worked example (5.6.0)

- **Agents > How agents work** gains **Design and the loop** (agentic design versus the agent loop versus the delivery
  loop, how they nest, building an agent through the loop, common confusions) and **Worked example** (the real content
  of every block for the notification agent and the local database agent, open by block, with a recorded run).
- **The loop** and **Checking a database** name the MCP servers the workspace now has instead of "none yet".

## How agents are built (5.5.0)

- **Agents > How agents work** gains four tabs before the existing ones (ADR 0029, one subject per tab): **Building
  blocks** (CLAUDE.md, rules, commands, agents, skills, hooks, MCP servers, settings, environment, memory, plugins:
  file, who starts it, context or enforced, with the workspace's own counts and names), **The cycle** (one request
  through every block, hooks named by event from the workspace), **Three ways to build** (agent harness, framework
  graph, deterministic service; when each fits, and the frameworks on a Java 21 / .NET 8 stack) and **Reaching data**
  (code, docs, API, database, logs, events; the seven steps to build an agent; how each team agent reaches data).
  `/agents/how` now opens on Building blocks.
- **Team agent front matter**: `build:` (harness, framework, service), `access:` (`|`-separated `kind: what`, kinds
  code, docs, api, db, logs, events, mcp; `(planned)` shows dimmed) and `mcp-tools:` (narrows each `mcp:` server to
  those tools on a hub run: a headless run cannot ask before a write, so list read tools). The About tab shows them,
  with the MCP servers and tools in Guardrails; `sync_agentic.py` and the local loop API carry them.
- Agent names title-case known acronyms (API, SOG, MCP, OTP, MNP, UAT, DB).

## Operation Center (5.4.0)

- **Operations page (`#/operations`)**, shown when the workspace has an `operations-center/` folder. It covers how
  engineering gets infrastructure, security and IT work done. Tabs: Processes (a catalog by category, searchable,
  paged), Journeys (an ordered path through processes, such as a new engineer's first week, each step linked to
  its process), and Service desks (what each desk covers and how its tickets flow).
- **A process** (`/operations/process/<id>/<workflow|prepare|related>`) shows where to ask, who does it, how long it
  usually takes, and:
  - a swimlane of its steps, one lane per role in the order they act, with approvals as diamonds;
  - who approves what;
  - what you provide, what goes wrong, where an agent can help;
  - related processes and the evidence tickets.
- **`tools/sync_operations.py`** reads `operations-center/processes/*.md`, `journeys/*.md` and `desks/*.md` (format
  in its docstring) into `content/data/operations.json`; `sync.sh` runs it. A step without an actor is an
  approval ("Approvers") or done by the previous actor.

## Start a work item from the hub (5.3.3)

- **How we work is three tabs (ADR 0029):** How it works (SDLC at a glance, the loop), In detail (the agentic graph;
  `cmd/`, `node/` and `flow/` links open here), Start a work item (`/knowledge/how-we-work/start`; the Work
  board's button points here).
- **Start a work item, on the local hub:** 1. Create the work item runs `tools/spec.py new <KEY> <slug> --intake
  <kind> --title --ref|--summary` in the workspace (which commits and shares the folder), via `POST /api/loop/start`.
  2. Write the intent with Claude runs `/intent` as an agent run (`agent: "intent"`): Read, Grep, Glob, Edit and
  Write, edits allowed only in `specs/<KEY>-<slug>/`, the workspace's `atlassian` and `figma` MCP servers with read
  tools only, no shell, so it cannot run `spec.py`, approve, move the phase or commit. It lists the links to
  record at the end of `intent.md`. The owner reviews and approves on the work item. A static hub shows the
  commands to paste.
- `sync_agentic.py`: a hook script on several events is one node (`agent-log` on Pre and PostToolUse had a
  duplicate id).

## Long pages split into tabs, how agents work (5.3.2)

- **ADR 0029 (engineering workspace): a page is at most two screens (1800 px at 1440×900); longer is split into
  tabs, one subject each, each a route.** Applied: Quality (`overview`, `findings` paged 20 at a time, `tests`);
  Agents gets a second route level (`/agents/<view>/<tab>`): one agent's `launch`, `about`, `available`; MCP
  servers `servers`, `what`, `design`, `build`, `ship` (the old `build-mcp` redirects); System map capped at one
  screen; Matrix one source layer at a time, paged; Timeline paged; the work item's handover opens the current
  phase only. A run opens as tabs: Answer, What it touched, Steps, Change, How it ran. `Pager` in `ui.tsx`.
- **How agents work (`#/agents/how/<loop|apis|databases|guardrails>`).** The model-tool-permission loop, how an
  agent calls an API or checks a database (through an MCP server built for it: named read-only tools, the
  person's token, a masked copy, an audit line per call), and which guardrails are enforced.
- **How it ran.** Each run records its directory, its exact command line and the instructions it was given
  (`launch` on the run).
- **`mcp:` in a team agent's front matter.** The hub loads only those servers from the workspace's `.mcp.json`
  (`--strict-mcp-config --mcp-config`), allows their tools (`mcp__<name>`), and shows them under Can reach.
  No team agent names one yet.
- Not done yet: the automatic page-height check the ADR asks for; pages were measured by hand at release.

## Agent studio (5.3.0, 5.3.1)

5.3.1:
- **What the agent is touching.** Each run shows the agent, every system it touched (a repo, the workspace docs,
  the work items, its worktree) with edges weighted by calls, coloured by kind, and the latest one animated, and a
  row of what it can reach and what it is not connected to (databases, clusters, MCP, internet, shell), stated by
  the server (`reach` on the run). Each step carries the `path` it looked at.
- **Reads stay in scope.** The read tools are no longer pre-approved in `--allowedTools`: Claude Code allows them
  in the working and added directories only, so a read anywhere else on the laptop is refused. Refusals come back
  as `blocked` steps, shown in red on the map. Team agents are told their repo paths, since a search of the
  workspace root skips the gitignored `code/`.
- **Launch guard and run list.** A double click launches once, and the same task does not launch while it is still
  running. The launch panel lists every run of that agent the server holds, so none get lost when you navigate away.
- **Where this agent is available.** Hub and Claude Code (available), embedded widget (`#/embed/<name>`, ask and
  plan modes, an iframe snippet; it runs where the hub runs), and Slack or Teams, Jira and support consoles (need
  agents hosted for the team).


- **Team agents (`#/agents/team`).** Every `.claude/agents/<name>.md` in the workspace with `team:` in its front
  matter (flat keys: `team`, `family`, `scope` repos, `modes` of ask, plan and propose, `starters` split by `|`).
  The same file is a Claude Code subagent. `tools/sync_agentic.py` carries the fields and the instructions into
  `agentic.json`, so a static hub shows the catalog read-only with the Claude Code command to run.
- **Launch (local hub).** `POST /api/loop/agent {agent: "team", name, mode, repo?, key?, question}`. Agents get no
  shell (`--tools Read Grep Glob`), since Claude Code auto-approves read-only commands such as `cat` that would get
  past the `Read` deny rules. They get the last 60 days of commits of their repos in the prompt instead. Ask
  answers with path:line evidence; plan writes pull-request-sized steps. Propose needs a work item in build or later
  with intent, spec and design approved (the spec gate), and edits a git worktree of one repo on a local
  `agent/<name>/<KEY>-<id>` branch in the system temp folder (Claude Code refuses edits under `.claude/`), with
  `Edit(./**)` only. Nothing is pushed. The run shows the diff, the command to take the branch, and Discard (removes
  the worktree and the branch).
- **Runs (`#/agents/runs`).** Everything launched from this hub, live, with an event history (a swimlane of every
  step over time, and the list of steps with offsets, kinds and the agent's notes), Stop, and every run in
  `.claude/state/agent-runs.jsonl`, including Claude Code subagents.
- **Create an agent (`#/agents/create`).** A form that writes `.claude/agents/<name>.md` (it refuses a name in use)
  and gives the command to share it. A static hub shows the file to copy.

## Proposed work (5.2.1)

A spec folder with a `.proposed.json` (`pr`, `url`, `author`, `title`, `branch`) is a work item that is still on an
open pull request. `sync_loop.py` carries it into `loop.json` as `proposed`, and the Work page and the work item
header mark it "proposed · PR #N · author" with a link to the PR. A shared hub's CI workspace sync lays these folders
in from the workspace's open pull requests, so everyone's work shows before it merges.

## Agents and the local loop (5.2.0)

- **Work item, Agents tab.** Each phase with its command, the subagents and MCP servers it uses (read from the
  workspace's command files), the files it hands to the next phase, and its gate with who approved it and when.
  On the local hub it also shows the agents working on the item now, from `.claude/state/agent-runs.jsonl`,
  which the workspace's `agent-log` hook writes on every subagent start and end (description and key only,
  never the prompt).
- **Gate panel.** The next step out of the current phase: approve the intent, spec or design, or move to the next
  phase. On the local hub the button runs `tools/spec.py approve|phase` in the workspace with your
  `git config user.name`, then `tools/sync_loop.py`. A workspace whose `spec.py` shares work items (5.2.2 and the
  project template) commits and pushes the work item; the panel says whether it did. A static hub
  shows the command to run instead.
- **Agents page (`#/agents`).** A Q&A agent per module, an on-call agent, the MCP servers the workspace configures
  (`agentic.json` `mcpServers`: transport, endpoint, sign-in, the commands that use each; header and env values are
  never copied), and a guide to building an MCP server.
- **Knowledge packs.** `tools/sync_modules.py` (run by `sync.sh` after `sync_system.py`) writes
  `content/data/modules.json`: per cloned repo, metadata only (branch, folders, languages, entry points, route
  files, tests, runtime row from `docs/env-catalog/`, the system-map component and its calls). Agents answer by
  reading the code at question time; nothing is trained.
- **How agents run.** Only on the local dev or preview server (`web/hub-loop-api.ts`, loopback clients only):
  `claude -p` with your own Claude Code login, tools limited to Read, Grep, Glob and read-only git, no MCP servers,
  reads of `.env`, key files and `test-data/` denied, project settings only, stopped after 10 minutes. Module
  agents run in `code/<repo>` with the workspace `docs/` added; the on-call agent runs in the workspace with every
  clone added.

## v5 (5.0.0): one web app, the v4 page retired

The hub is a React app (source in `web/`, built with `cd web && npm ci && npm run build`, which
places `index.html` and `assets/app/` at the template root). It reads the same `content/`
contract as v4: `brand.json`, `manifest.json` (from `node build.mjs`), `data/loop.json`
(`tools/sync_loop.py`), `data/system.json` (`tools/sync_system.py`), the spec copies under
`content/specs/`, sections and the library. v4 hash links (`#/loop`, `#/spec/...`, section ids)
redirect to their v5 pages. `hub-update.sh` removes the v4 files listed in `tools/engine-retired.txt`.

Views: Home, Work (board and table, one page per work item with the phases as tabs and an
Impact tab), **Architecture** (5.1.0, when `content/data/architecture.json` exists), Quality, **System**,
Environments, Knowledge.

### Architecture (5.1.0): how the system is built, clickable

`content/data/architecture.json` reaches the manifest as `architecture` (`node build.mjs`); the
Architecture page and its nav entry show only when it exists. Routes are
`#/architecture/<view>/<id>`, so every selection is a deep link:

- **Overview**: the summary, then a context map: people and partners, each region as a box holding
  the containers that run there, and the external systems, with lines from `talksTo` (and from each
  adapter's container to its external). Pick any box for a side panel (description, links, what it
  talks to, what calls it, its modules) and a link to its view. Filter by region (`?region=`).
- **Infrastructure**: regions side by side (stacked on a phone), each with its layers as rows of
  resource cards. Picking a resource highlights what it connects to and shows its type, stack,
  links and the containers running on it. `Compare layer by layer` (`?mode=compare`) lines the
  regions up per layer.
- **Application**: containers grouped by kind with region badges, repo and URLs; the container with
  the most modules opens its module list.
- **Modules**: a filterable list (`?q=`) and a dependency graph (arrows point at what a module
  depends on; picking one, `?focus=`, lights it and its neighbours). `#/architecture/modules/<id>` is
  the module page: description, package, endpoints (filter by method and text), tables, events,
  adapters, flows through it, what it depends on and what uses it, work items (to `#/work/<key>`
  when the hub has that item, else the tracker), decisions (to `#/knowledge/decisions/<id>`) and code paths.
- **Flows**: one diagram per flow, rendered with the hub's mermaid, with its modules and work items.

A search box on the page finds any node by name; every node is also in the global search (⌘K).
A work item named in a module's `workItems` (or a flow's) gets an Architecture panel on its overview.

Contract (every field optional; the page renders what exists):

```
{ "generated", "sources": [], "summary",
  "actors":     [{ "id", "name", "kind": "person|partner|ops", "description" }],
  "externals":  [{ "id", "name", "kind", "regions": [], "description" }],
  "regions":    [{ "id", "name", "cloud", "location", "account", "status", "description",
                   "layers": [{ "id", "name", "resources": [{ "id", "name", "type", "stack", "description",
                                                               "connects": [ids], "links": [{ "label", "url" }] }] }] }],
  "containers": [{ "id", "name", "kind": "service|web|mobile|console|job|simulator|hub", "tech", "repo",
                   "regions": [], "description", "runsOn": { "<region id>": "<resource id>" },
                   "talksTo": [ids], "urls": [{ "label", "url" }] }],
  "modules":    [{ "id", "name", "container", "package", "description", "dependsOn": [ids],
                   "endpoints": [{ "method", "path", "summary" }], "tables": [],
                   "events": { "publishes": [], "consumes": [] }, "adapters": [ids],
                   "workItems": [keys], "adrs": [ids], "code": [paths] }],
  "adapters":   [{ "id", "name", "external", "regions": [], "ports": [], "module", "code": [], "description" }],
  "flows":      [{ "id", "title", "description", "mermaid", "workItems": [], "modules": [] }] }
```

`summary` and every `description` render as Markdown. `talksTo` may name a container, an actor, an
external system or a module (drawn to the module's container). The template carries a sample in
`content/data/architecture.json`.

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
`content/data/architecture.json` (Architecture page, contract above), `feedback.json` (client feedback changelog), `questions.json`, `vendors.json`,
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
