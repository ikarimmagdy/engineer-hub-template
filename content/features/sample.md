<h2 id="prod"><span class="step">1</span> Product view</h2>

**What it is.** One sentence on the feature. **User story.** As a [user], I want [capability] so that [value].

| Who | Why it matters |
|---|---|
| User | ... |
| Business | ... |

<h2 id="brd"><span class="step">2</span> Business requirements (BRD)</h2>

| Item | Detail |
|---|---|
| Objective | ... |
| Success metrics | ... |
| Business rules | ... |
| In scope / Out of scope | ... |
| Stakeholders | ... |

<h2 id="prd"><span class="step">3</span> Product requirements (PRD)</h2>

**Functional requirements**
1. ...

**Acceptance (given/when/then)** ...
**States & edge cases:** loading, success, error, empty. **Dependencies:** ...

<h2 id="ux"><span class="step">4</span> UX &amp; UI</h2>
<p class="hint">Theme and layout notes.</p>

- Page layout structure: ...

<div id="mockup-slot" data-url="app / screen" data-h="560"></div>

<h2 id="tech"><span class="step">5</span> Technical implementation</h2>

```mermaid
sequenceDiagram
  participant U as Client
  participant A as api
  U->>A: request
  A-->>U: response
```

**APIs** — table of Endpoint | Service | Request to Response.
**Database impact** — tables/columns/migrations.
**Repos & files touched** — which repos and files.
**Implementation plan (ready to build)** — numbered steps.

<h2 id="impl"><span class="step">6</span> Implementation status</h2>

| Area | Where | Notes |
|---|---|---|
| UI | ... | ... |
| API | ... | ... |

<h2 id="secperf"><span class="step">7</span> Security &amp; performance</h2>

- Security: ...
- Performance: ...

<h2 id="test"><span class="step">8</span> Test cases</h2>

**Acceptance criteria** ...

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | Happy path | ... | ... |
