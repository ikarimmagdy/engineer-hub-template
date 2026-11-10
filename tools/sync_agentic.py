#!/usr/bin/env python3
"""Describe a workspace's agentic setup for the hub's architecture view.

  python3 tools/sync_agentic.py [--workspace PATH]

Reads the workspace's .claude/ (commands, agents, hooks, rules, skills, settings) and .mcp.json,
and writes content/data/agentic.json: one node per command, agent, tool, hook, rule and skill,
and an edge only where a command file names an agent or tool. Nothing is inferred beyond that.
PATH defaults to brand.json "workspace". Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
C = HUB / "content"

# tool id -> (label, kind, pattern that counts as "this command uses it")
TOOLS = {
    "atlassian": ("Atlassian MCP", "MCP", r"atlassian|\bjira\b|confluence"),
    "figma": ("Figma MCP", "MCP", r"\bfigma\b"),
    "gh": ("GitHub (gh CLI)", "CLI", r"\bgh (?:pr|issue|api|repo)\b"),
    "beyondbase": ("BeyondBase MCP", "Plugin", r"beyondbase"),
    "playwright": ("Playwright MCP", "MCP", r"playwright"),
    "mobile": ("Mobile MCP", "MCP", r"mobile mcp|mobile-mcp|bin/sim|maestro"),
    "microsoft-learn": ("Microsoft Learn MCP", "MCP", r"microsoft[- ]learn"),
    "spec-py": ("tools/spec.py", "Tool", r"spec\.py"),
}
# spec files a command writes or reads, as they appear in command text
FILES = [("inputs", r"inputs/"), ("intent", r"intent\.md"), ("review", r"outputs/review"),
         ("findings", r"findings\.json"), ("spec", r"\bspec\.md"), ("design", r"plan\.md|data-model\.md|contracts/"),
         ("tasks", r"tasks\.md"), ("tests", r"test-plan\.md|test-runs"), ("release", r"release-notes"),
         ("runbook", r"runbook"), ("feedback", r"outputs/feedback"), ("adr", r"docs/adr|\badr\b")]
FILE_LABEL = {"inputs": "inputs/ (sources)", "intent": "intent.md", "review": "outputs/review/<area>.md",
              "findings": "outputs/findings.json", "spec": "spec.md", "design": "plan.md, data-model.md, contracts/",
              "tasks": "tasks.md (branches, PRs)", "tests": "test-plan.md, test runs", "release": "release notes",
              "runbook": "runbook", "feedback": "outputs/feedback/", "adr": "docs/adr/ (ADRs)"}


def front(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    out = {}
    for line in (m.group(1).splitlines() if m else []):
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def body(text: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)


def mcp_servers(ws: Path, mcp: dict, settings: dict, commands: list) -> list:
    """Every MCP server the workspace configures: transport, endpoint, sign-in and who uses it.
    Header and env values are never copied, only their names."""
    notes = {}
    md = ws / "CLAUDE.md"
    for line in (md.read_text(encoding="utf-8").splitlines() if md.exists() else []):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        m = re.match(r"^`?(?:plugin )?`?([\w.-]+)`?$", cells[0]) if len(cells) >= 3 and line.lstrip().startswith("|") else None
        if m:
            notes[m.group(1)] = {"for": cells[1], "signIn": cells[2]}
    used = lambda name: [c["name"] for c in commands if name in c["tools"]]
    out = []
    for name, cfg in mcp.items():
        http = cfg.get("type") in ("http", "sse") or "url" in cfg
        pkg = next((a for a in cfg.get("args", []) if not a.startswith("-")), "")
        out.append({"name": name, "transport": "http" if http else "stdio",
                    "endpoint": cfg.get("url") if http else " ".join([cfg.get("command", ""), pkg]).strip(),
                    "headers": sorted((cfg.get("headers") or {}).keys()), "env": sorted((cfg.get("env") or {}).keys()),
                    "for": notes.get(name, {}).get("for", ""), "signIn": notes.get(name, {}).get("signIn", ""),
                    "source": ".mcp.json", "usedBy": used(name)})
    markets = settings.get("extraKnownMarketplaces") or {}
    for key, on in (settings.get("enabledPlugins") or {}).items():
        if not on:
            continue
        name, market = (key.split("@") + [""])[:2]
        repo = ((markets.get(market) or {}).get("source") or {}).get("repo", "")
        out.append({"name": name, "transport": "plugin", "endpoint": repo, "headers": [], "env": [],
                    "for": notes.get(name, {}).get("for", ""), "signIn": notes.get(name, {}).get("signIn", ""),
                    "source": ".claude/settings.json enabledPlugins", "usedBy": used(name)})
    return out


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    brand = json.loads((C / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace"):
        sys.exit('No workspace: pass --workspace or set brand.json "workspace"')
    return (HUB / brand["workspace"]).resolve()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    ws = workspace(ap.parse_args().workspace)
    cl = ws / ".claude"
    if not cl.exists():
        sys.exit(f"{cl} not found")

    agents = []
    for p in sorted((cl / "agents").glob("*.md")):
        text = p.read_text(encoding="utf-8")
        f = front(text)
        a = {"id": "agent:" + p.stem, "name": f.get("name", p.stem), "description": f.get("description", ""),
             "tools": f.get("tools", ""), "path": str(p.relative_to(ws))}
        # a team agent (team: in its front matter) is also launchable from the hub's Agent studio
        if f.get("team"):
            split = lambda k, sep=",": [x.strip() for x in f.get(k, "").split(sep) if x.strip()]
            a.update({"team": f["team"], "family": f.get("family", ""), "scope": split("scope"),
                      "modes": split("modes") or ["ask"], "starters": split("starters", "|"), "mcp": split("mcp"), "mcpTools": split("mcp-tools"),
                      "access": split("access", "|"), "build": f.get("build", ""), "prompt": body(text).strip()})
        agents.append(a)
    agent_names = [a["name"] for a in agents]

    settings = json.loads((cl / "settings.json").read_text(encoding="utf-8")) if (cl / "settings.json").exists() else {}
    mcp = json.loads((ws / ".mcp.json").read_text(encoding="utf-8")).get("mcpServers", {}) if (ws / ".mcp.json").exists() else {}
    plugins = [k.split("@")[0] for k, on in (settings.get("enabledPlugins") or {}).items() if on]

    commands, edges, used_tools = [], [], set()
    for p in sorted((cl / "commands").glob("*.md")):
        text = p.read_text(encoding="utf-8")
        f, b = front(text), body(text).lower()
        cid = "cmd:" + p.stem
        ag = [n for n in agent_names if re.search(r"\b" + re.escape(n) + r"\b", b)]
        tl = [t for t, (_, _, pat) in TOOLS.items() if re.search(pat, b)]
        fl = [k for k, pat in FILES if re.search(pat, b)]
        ph = re.match(r"phase (\d)", f.get("description", "").lower())
        commands.append({"id": cid, "name": "/" + p.stem, "description": f.get("description", ""),
                         "args": f.get("argument-hint", ""), "phase": int(ph.group(1)) if ph else None,
                         "agents": ag, "tools": tl, "files": fl, "path": str(p.relative_to(ws))})
        calls = sorted({m for m in re.findall(r"(?<![\w/])/([a-z][a-z-]+)\b", b) if m != p.stem and (cl / "commands" / f"{m}.md").exists()})
        commands[-1]["calls"] = ["/" + m for m in calls]
        edges += [[cid, "cmd:" + m] for m in calls]
        edges += [[cid, "agent:" + a] for a in ag] + [[cid, "tool:" + t] for t in tl] + [[cid, "file:" + k] for k in fl]
        used_tools.update(tl)

    tools = []
    for t, (label, kind, _) in TOOLS.items():
        configured = (t in mcp) or (t == "beyondbase" and "beyondbase" in plugins) or t in ("gh", "spec-py")
        if configured or t in used_tools:
            tools.append({"id": "tool:" + t, "name": label, "kind": kind, "configured": configured, "used": t in used_tools,
                          "source": ".mcp.json" if t in mcp else (".claude/settings.json enabledPlugins" if t == "beyondbase" else "")})

    servers = mcp_servers(ws, mcp, settings, commands)

    hooks = []
    for event, groups in (settings.get("hooks") or {}).items():
        for g in groups:
            for h in g.get("hooks", []):
                m = re.search(r"hooks/([\w.-]+\.py)", h.get("command", ""))
                if not m:
                    continue
                src = (cl / "hooks" / m.group(1))
                doc = re.search(r'"""(.*?)"""', src.read_text(encoding="utf-8"), re.S) if src.exists() else None
                # one node per hook script: a script on several events (agent-log on Pre and PostToolUse) lists them all
                same = next((x for x in hooks if x["id"] == "hook:" + m.group(1)[:-3]), None)
                if same:
                    same["event"] = ", ".join(dict.fromkeys(same["event"].split(", ") + [event]))
                    continue
                hooks.append({"id": "hook:" + m.group(1)[:-3], "name": m.group(1), "event": event, "matcher": g.get("matcher", ""),
                              "description": " ".join((doc.group(1) if doc else "").split())[:400], "path": f".claude/hooks/{m.group(1)}"})
    rules = [{"id": "rule:" + p.stem, "name": p.stem, "path": str(p.relative_to(ws)),
              "description": next((l.strip("# ").strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip()), "")}
             for p in sorted((cl / "rules").glob("*.md"))]
    skills = [{"id": "skill:" + d.name, "name": d.name, "path": str(d.relative_to(ws)),
               "description": front((d / "SKILL.md").read_text(encoding="utf-8")).get("description", "") if (d / "SKILL.md").exists() else ""}
              for d in sorted((cl / "skills").glob("*")) if d.is_dir()]
    files = [{"id": "file:" + k, "name": FILE_LABEL[k]} for k, _ in FILES if any(["file:" + k == e[1] for e in edges])]
    constitution = sorted(str(p.relative_to(ws)) for p in (ws / "constitution").glob("*.md")) if (ws / "constitution").exists() else []

    out = {"generated": dt.date.today().isoformat(), "workspace": ws.name, "commands": commands, "agents": agents,
           "tools": tools, "mcpServers": servers, "files": files, "hooks": hooks, "rules": rules, "skills": skills, "constitution": constitution,
           "edges": edges}
    (C / "data").mkdir(parents=True, exist_ok=True)
    (C / "data" / "agentic.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"agentic: {len(commands)} commands, {len(agents)} agents, {len(tools)} tools, {len(hooks)} hooks, "
          f"{len(rules)} rules, {len(skills)} skills, {len(edges)} edges from {ws}")


if __name__ == "__main__":
    main()
