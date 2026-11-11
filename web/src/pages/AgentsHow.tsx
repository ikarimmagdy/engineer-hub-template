import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../components/ui';
import { AgentsBlocks, AgentsCycle, AgentsReach, AgentsWays } from './AgentsBuild';
import { AgentsDesign, AgentsExample } from './AgentsDesign';

export { AccessList, BUILDS } from './AgentsBuild';

/** How agents work: the building blocks, the cycle, the ways to build one, how it reaches data, and the guardrails. One subject per tab (ADR 0029). */
export const HOW_TABS = [['blocks', 'Building blocks'], ['design', 'Design and the loop'], ['example', 'Worked example'], ['cycle', 'The cycle'], ['loop', 'The loop'], ['ways', 'Ways to build'], ['reach', 'Reaching data'],
  ['apis', 'APIs'], ['databases', 'Databases'], ['guardrails', 'Guardrails']] as const;

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-6 text-base font-semibold first:mt-0">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 max-w-3xl text-sm leading-relaxed text-ink-2">{children}</p>;
const Code = ({ children }: { children: string }) => <pre className="mb-3 max-w-3xl overflow-auto rounded-md bg-sunk p-3 text-xs"><code>{children}</code></pre>;

function Box({ t, d, tone }: { t: string; d: string; tone?: 'model' | 'gate' | 'tool' }) {
  return (
    <div className={cx('min-w-0 rounded-lg border px-3 py-2', tone === 'model' ? 'border-run bg-run/5' : tone === 'gate' ? 'border-sev-medium bg-sev-medium/5' : tone === 'tool' ? 'border-ok bg-ok/5' : 'border-line-2 bg-paper')}>
      <div className="text-sm font-semibold">{t}</div>
      <div className="text-xs text-ink-3">{d}</div>
    </div>
  );
}
const Arrow = ({ label }: { label?: string }) => <div className="flex flex-col items-center justify-center px-1 text-[10px] text-ink-3"><span aria-hidden>&rarr;</span>{label}</div>;

export function AgentsHow({ tab }: { tab: string }) {
  if (tab === 'blocks') return <AgentsBlocks />;
  if (tab === 'design') return <AgentsDesign />;
  if (tab === 'example') return <AgentsExample />;
  if (tab === 'cycle') return <AgentsCycle />;
  if (tab === 'ways') return <AgentsWays />;
  if (tab === 'reach') return <AgentsReach />;
  if (tab === 'apis') return <Apis />;
  if (tab === 'databases') return <Databases />;
  if (tab === 'guardrails') return <Guardrails />;
  return <Loop />;
}

function Loop() {
  return (
    <div>
      <P>An agent is a model in a loop. The model never touches a system itself: it can only <strong>ask for a tool call</strong>. Claude Code checks the call against the run's permissions, runs the tool, and gives the model the result. The model then asks for the next call or writes the answer. What an agent can do is exactly the list of tools it is given, nothing more.</P>
      <div className="my-4 grid max-w-4xl grid-cols-[repeat(4,minmax(0,1fr)_auto)_minmax(0,1fr)] items-stretch gap-1">
        <Box t="Task" d="your question, the mode, the work item" />
        <Arrow />
        <Box t="Model" d="reads the agent file, the mode rules and recent commits; decides the next step" tone="model" />
        <Arrow label="asks for" />
        <Box t="Tool call" d='e.g. Grep "1003" in code/vm-selfcare-proxy' />
        <Arrow />
        <Box t="Permission check" d="is the tool on --tools? is the path inside the agent's directories? any deny rule?" tone="gate" />
        <Arrow label="allowed" />
        <Box t="Tool runs" d="the result goes back to the model, and the loop repeats" tone="tool" />
      </div>
      <P>Every step of that loop is what you see on a run: <em>What it touched</em> draws the tool calls by system, <em>Steps</em> lists them in order, a refused call shows as <span className="text-block">blocked</span>, and <em>How it ran</em> shows the exact command line that set the tools and permissions.</P>
      <H>What the hub gives each agent today</H>
      <div className="max-w-3xl overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-4">Layer</th><th className="py-1.5 pr-4">Set by</th><th className="py-1.5">Today</th></tr></thead>
        <tbody className="divide-y divide-line text-ink-2">
          <tr><td className="py-1.5 pr-4 font-medium">Instructions</td><td className="py-1.5 pr-4"><code>.claude/agents/&lt;name&gt;.md</code></td><td className="py-1.5">The role, what it knows, how it works, what it never does; plus the mode rules and the last 60 days of commits</td></tr>
          <tr><td className="py-1.5 pr-4 font-medium">Tools</td><td className="py-1.5 pr-4"><code>--tools</code></td><td className="py-1.5">Read, Grep, Glob. Propose mode adds Edit and Write.</td></tr>
          <tr><td className="py-1.5 pr-4 font-medium">Where</td><td className="py-1.5 pr-4">working directory, <code>--add-dir</code></td><td className="py-1.5">Its scope repos under <code>code/</code>, the workspace docs and work items. Anywhere else is refused.</td></tr>
          <tr><td className="py-1.5 pr-4 font-medium">Deny rules</td><td className="py-1.5 pr-4"><code>--settings</code></td><td className="py-1.5">Never <code>.env</code> files, keys, certificates, test data or backups, even inside its directories</td></tr>
          <tr><td className="py-1.5 pr-4 font-medium">Systems</td><td className="py-1.5 pr-4"><code>mcp:</code> in the agent file → <code>--mcp-config</code></td><td className="py-1.5">Per agent file: <code>notifications</code> (notification-messages, the notification-service API) and <code>localdb</code> (operations, member care and database agents, the local MariaDB restore). How it works: the next two tabs.</td></tr>
        </tbody>
      </table></div>
    </div>
  );
}

function Apis() {
  return (
    <div>
      <P>An agent calls an API through a <strong>tool</strong> that wraps it. The standard way to give an agent tools for a system is an <strong>MCP server</strong>: a small program that lists its tools (name, description, typed inputs) and runs them when the model asks. The model reads the descriptions and decides when to call one. It never sees a URL or a token.</P>
      <div className="my-4 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1">
        <Box t="Model" d='asks: get_deploy_status(service: "notification", env: "dev")' tone="model" />
        <Arrow />
        <Box t="Permission check" d="mcp__deploy-status is allowed for this agent" tone="gate" />
        <Arrow />
        <Box t="MCP server" d="validates the input, calls the API with the engineer's own token, trims the answer" tone="tool" />
        <Arrow />
        <Box t="Our API" d="Argo CD, the pipeline, Selfcare UAT, a service catalog" />
      </div>
      <H>1. Write the server (the tools are the contract)</H>
      <Code>{`# deploy_status_mcp.py   pip install mcp
from mcp.server.fastmcp import FastMCP
import os, httpx

mcp = FastMCP("deploy-status")
ARGO = os.environ["ARGOCD_URL"]                 # by name; the value is in the engineer's environment

@mcp.tool()
def get_deploy_status(service: str, env: str) -> dict:
    """Sync and health of one service in one environment (dev, uat), from Argo CD.
    Read-only. Returns image tag, sync status, health and the last sync time."""
    if env not in ("dev", "uat"):
        raise ValueError("env must be dev or uat")   # production is not offered at all
    r = httpx.get(f"{ARGO}/api/v1/applications/{service}-{env}",
                  headers={"Authorization": f"Bearer {os.environ['ARGOCD_TOKEN']}"}, timeout=10)
    r.raise_for_status()
    a = r.json()
    return {"image": a["status"]["summary"]["images"][:1], "sync": a["status"]["sync"]["status"],
            "health": a["status"]["health"]["status"], "at": a["status"]["reconciledAt"]}

if __name__ == "__main__":
    mcp.run()`}</Code>
      <H>2. Register it for the team, then give it to one agent</H>
      <Code>{`// .mcp.json (workspace root): defines the server, no secret values
{ "mcpServers": { "deploy-status": { "type": "stdio", "command": "python3", "args": ["tools/mcp/deploy_status_mcp.py"],
                                     "env": { "ARGOCD_URL": "\${ARGOCD_URL}", "ARGOCD_TOKEN": "\${ARGOCD_TOKEN}" } } } }

# .claude/agents/platform-deploy.md front matter: only this agent gets it
mcp: deploy-status`}</Code>
      <P>From then on the hub loads only the servers an agent file names (<code>--strict-mcp-config --mcp-config</code> with those servers), allows their tools (<code>mcp__deploy-status</code>), and the run's <em>Can reach</em> row says <em>MCP server: deploy-status</em>. Claude Code in the terminal uses the same <code>.mcp.json</code>. See <Link to="/agents/mcp/design" className="underline">MCP servers</Link> for design and testing.</P>
      <H>Why not let the agent run curl</H>
      <P>A shell can call anything, with any token it can find, and Claude Code approves many read-looking commands by itself. A tool can do one thing, with checked inputs, and returns only what it should. That is why hub agents have no shell.</P>
    </div>
  );
}

function Databases() {
  return (
    <div>
      <P>Same pattern as an API: a database is reached only through an MCP server built for it. What makes it safe is what the server connects to and what its tools allow, not what the agent is told.</P>
      <div className="my-4 grid max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1">
        <Box t="Model" d='asks: subscriptions_stuck_in_port_in(older_than_days: 1)' tone="model" />
        <Arrow />
        <Box t="DB MCP server" d="named, parameterised queries; row limit, timeout, masking, audit line per call" tone="tool" />
        <Arrow />
        <Box t="Masked UAT copy" d="a database user with SELECT on approved views only; never production" />
      </div>
      <H>Rules for a database server</H>
      <ul className="mb-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-2">
        <li><strong>Where:</strong> a masked restore or UAT. No production personal data on a laptop, and none in an agent's context.</li>
        <li><strong>Who:</strong> a dedicated database user with <code>SELECT</code> on a few views. The server cannot write, because the user cannot.</li>
        <li><strong>What:</strong> prefer named queries (<code>subscriptions_stuck_in_port_in</code>) over a free <code>run_sql</code> tool. A named query is reviewed once and cannot be talked into a different one.</li>
        <li><strong>How much:</strong> a row limit (50), a statement timeout (5 s), and identifiers masked in the output (<code>9665******12</code>).</li>
        <li><strong>Trace:</strong> one audit line per call: who, which tool, the inputs, the row count.</li>
      </ul>
      <Code>{`# selfcare_uat_db_mcp.py   (shape of the server; connection by name from the environment)
QUERIES = {
  "subscriptions_stuck_in_port_in": """
      SELECT TOP (@limit) s.SubscriptionId, s.Brand, s.Status, s.UpdatedAt
      FROM reporting.v_mnp_requests s
      WHERE s.Status = 'PENDING' AND s.UpdatedAt < DATEADD(day, -@days, SYSUTCDATETIME())""",
}

@mcp.tool()
def subscriptions_stuck_in_port_in(older_than_days: int = 1) -> list[dict]:
    """Port-in requests still pending after N days, newest first, masked. Read-only, UAT copy only."""
    rows = run(QUERIES["subscriptions_stuck_in_port_in"], days=max(1, min(older_than_days, 30)), limit=50)
    audit("subscriptions_stuck_in_port_in", {"older_than_days": older_than_days}, len(rows))
    return [mask(r) for r in rows]`}</Code>
      <P>That is the shape for a shared copy (UAT, a masked restore served to the team). On a laptop the workspace has <code>localdb</code>: five read tools on the local MariaDB restore, a free <code>query</code> tool made safe by three enforced layers instead of named queries. The database user has SELECT only and no grant on the credential schemas; the server allows a personal column only in <code>COUNT()</code> or <code>IS NULL</code> and masks long numbers, emails and tokens; the <code>localdb-guard</code> hook allows one read statement and logs every call. The operations, member care and database agents name it in <code>mcp:</code>; <Link to="/agents/how/example" className="underline">Worked example</Link> shows every file and a real run.</P>
    </div>
  );
}

function Guardrails() {
  const rows: [string, string, string][] = [
    ['The agent file', 'What the agent is for and what it never does', 'Instructions only: they steer the model but enforce nothing'],
    ['Tools (--tools)', 'Which kinds of action exist at all', 'Enforced: a tool not on the list cannot be called'],
    ['Directories', 'Where reads and edits may happen', 'Enforced: anywhere else is refused (shows as blocked)'],
    ['Deny rules (--settings)', 'Secrets and personal test data', 'Enforced, even inside allowed directories'],
    ['MCP servers (mcp:)', 'Which systems, and with which tools', 'Enforced by what the server offers and by the account it uses'],
    ['Propose mode', 'Code changes', 'An isolated worktree on a local branch; it needs a work item in build; nothing is pushed'],
    ['Limits', 'Runaway runs', '10 minutes, then the run is stopped; Stop at any time'],
    ['Record', 'Accountability', 'Every run in .claude/state/agent-runs.jsonl, on its work item, with its exact command line'],
  ];
  return (
    <div className="max-w-4xl overflow-x-auto">
      <P>Only the enforced layers are guarantees. That is why access to a system is given as a tool with a narrow job, never as a sentence in the instructions.</P>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-4">Layer</th><th className="py-1.5 pr-4">Controls</th><th className="py-1.5">How strong</th></tr></thead>
        <tbody className="divide-y divide-line text-ink-2">{rows.map(([a, b, c]) => <tr key={a}><td className="py-1.5 pr-4 font-medium">{a}</td><td className="py-1.5 pr-4">{b}</td><td className="py-1.5">{c}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
