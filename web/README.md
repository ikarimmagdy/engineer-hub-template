# Hub front-end (React)

The v5 front-end over the hub's `content/` data. Run it from this folder:

```
npm ci
npx vite --port 8906        # HUB_DIR defaults to the parent hub folder
```

## Questions and their linkage (`#/questions`)

- **All questions**: filter by who answers, status, priority, category, text, or one linked work id
  (`#/questions?work=<id>`). The tiles count open questions per answerer. Open a question to see why it matters,
  the answer, the work it holds up (its `blocks` ids resolved to features by `fid` or `id`, work items by key, gaps
  by id) and the gaps whose text names it.
- **Work and questions** (`#/questions/linkage`): work waiting on open questions, work where some questions are already
  answered, and work released because every linked question is answered (the resolved links, with answer dates).
- **On a work item**: the Overview tab shows a Questions panel with what it waits on and what was answered for it.

## Editing (local only)

When the hub runs on the dev or preview server, `hub-data-api.ts` mounts `POST /api/data/<file>` for loopback
clients only, and the pages show "Editing on". You can:

| File | Change |
|---|---|
| `questions.json` | status, answer, answered on, priority, linked ids (`blocks`), question text, ask who, category, why; add a question (next id, `raised` today, status open) |
| `gaps.json` | status; append a dated note to the summary |
| `features.json` | roadmap stage (`lifecycle`, from `lifecycle.json`) and status |

Values for status, priority, category and stage must be ones the file (or `lifecycle.json`) already uses. Each write
keeps the file's indentation and escaping, so a change is a one-line diff; commit it like any other content change.
`?dryRun=1` validates an operation without writing. A statically served hub has no API and is read-only.

Operations (JSON body):

```
{ "op": "update", "id": "Q-012", "set": { "status": "answered", "answer": "...", "answeredOn": "2026-11-07" } }
{ "op": "append", "id": "G-160", "field": "summary", "text": "Synctera replied" }
{ "op": "add", "item": { "question": "...", "askWho": "...", "category": "...", "priority": "P1", "blocks": ["M2"] } }
```

Sign-in and writes on a hosted hub are phase 2 of the redesign (`docs/hub-redesign`).
