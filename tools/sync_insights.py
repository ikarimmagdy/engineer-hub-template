"""Workspace insights for the hub's Home page: contributions, AI-assisted work, pull requests, agent runs, adoption.

  python3 tools/sync_insights.py [--workspace PATH] [--weeks 12] [--no-prs]

Writes content/data/insights.json from:
  - git history of the workspace and of every repo in repos.yaml cloned under code/ (last N weeks): commits per week,
    per repo and per person; a commit is AI-assisted when its message carries "Co-Authored-By: Claude" or
    "Generated with Claude Code";
  - pull requests of those repos through the gh CLI (skipped with --no-prs or when gh is not signed in); an agent pull
    request has "Claude Code" in its description or comes from an agent/ or <KEY>/T<n> branch;
  - agent runs: .claude/state/agent-runs.jsonl of this laptop, plus the shared daily counts in brand.json "usageDir"
    when the workspace has them (tools/share_usage.py writes them; counts only, never prompts);
  - status.json history of every work item (achievements, inspiration events).
People appear by name only: no email address or login leaves this script. Standard library only.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
C = HUB / "content"
AI_MARK = re.compile(r"co-authored-by:\s*claude|generated with \[?claude code", re.I)
AGENT_BRANCH = re.compile(r"^agent/|^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)?-\d+/T\d+", re.I)
KEY = re.compile(r"^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)?-\d+$")
SEP = "\x1f"
BOT = re.compile(r"bot\b|\[bot\]|dependabot|^app/|gitops-app|github-actions|renovate", re.I)
norm = lambda n: re.sub(r"[^a-z]", "", n.lower())  # noqa: E731  "Davor Stefanovski" and "DavorStefanovski" are one person
# rough, stated on the page as an assumption: what an agent run saves an engineer on average
MINUTES_PER_RUN = 15


def brand() -> dict:
    return json.loads((C / "brand.json").read_text(encoding="utf-8"))


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    b = brand()
    if not b.get("workspace"):
        sys.exit('No workspace: pass --workspace or set brand.json "workspace"')
    return (HUB / b["workspace"]).resolve()


def sh(args: list[str], cwd: Path, timeout: int = 120) -> str:
    try:
        r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.stdout if r.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def repo_names(ws: Path) -> list[str]:
    f = ws / "repos.yaml"
    return re.findall(r"^\s*-\s*name:\s*([\w.-]+)", f.read_text(encoding="utf-8"), re.M) if f.exists() else []


def week_of(d: dt.date) -> str:
    return (d - dt.timedelta(days=d.weekday())).isoformat()


def commits(path: Path, since: str) -> list[dict]:
    out = sh(["git", "log", f"--since={since}", "--no-merges", f"--format=%H{SEP}%an{SEP}%ae{SEP}%ad{SEP}%B%x1e", "--date=short"], path, 300)
    rows = []
    for rec in out.split("\x1e"):
        parts = rec.strip("\n").split(SEP)
        if len(parts) < 5:
            continue
        h, name, email, date, body = parts[0], parts[1], parts[2].lower(), parts[3], SEP.join(parts[4:])
        rows.append({"sha": h, "name": name, "email": email, "date": date, "ai": bool(AI_MARK.search(body))})
    return rows


def remote_slug(path: Path) -> str | None:
    url = sh(["git", "remote", "get-url", "origin"], path).strip()
    m = re.search(r"[:/]([\w.-]+)/([\w.-]+?)(?:\.git)?$", url)
    return f"{m.group(1)}/{m.group(2)}" if m else None


def prs(slug: str, since: str) -> list[dict]:
    out = sh(["gh", "pr", "list", "-R", slug, "--state", "all", "--limit", "300", "--search", f"created:>={since}",
              "--json", "number,author,state,createdAt,mergedAt,headRefName,body"], HUB, 120)
    try:
        rows = json.loads(out) if out else []
    except json.JSONDecodeError:
        return []
    return [{"repo": slug.split("/")[1], "number": p["number"], "login": (p.get("author") or {}).get("login") or "",
             "name": (p.get("author") or {}).get("name") or "", "state": p["state"].lower(), "created": p["createdAt"][:10],
             "merged": (p.get("mergedAt") or "")[:10] or None,
             "agent": bool(re.search(r"claude code", p.get("body") or "", re.I) or AGENT_BRANCH.search(p.get("headRefName") or ""))} for p in rows]


def agent_runs(ws: Path, since: str) -> list[dict]:
    f = ws / ".claude" / "state" / "agent-runs.jsonl"
    runs = {}
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if r.get("event") == "start" and r.get("ts", "")[:10] >= since:
                runs[r["id"]] = {"date": r["ts"][:10], "agent": r.get("agent") or "?", "key": r.get("key"), "source": r.get("source") or "claude-code"}
    return list(runs.values())


def shared_usage(ws: Path, since: str) -> tuple[list[dict], list[str]]:
    """Daily counts people chose to share (tools/share_usage.py): {"person": name, "days": {date: {agent: n}}}."""
    d = brand().get("usageDir")
    rows, people = [], []
    if not d or not (ws / d).is_dir():
        return rows, people
    for f in sorted((ws / d).glob("*.json")):
        try:
            u = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        people.append(u.get("person") or f.stem)
        for day, by in (u.get("days") or {}).items():
            if day >= since:
                for agent, n in by.items():
                    rows.extend({"date": day, "agent": agent, "person": u.get("person") or f.stem} for _ in range(int(n)))
    return rows, people


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace")
    ap.add_argument("--weeks", type=int, default=12)
    ap.add_argument("--no-prs", action="store_true")
    a = ap.parse_args()
    ws = workspace(a.workspace)
    today = dt.date.today()
    start = today - dt.timedelta(weeks=a.weeks)
    since = week_of(start)
    weeks = [week_of(start + dt.timedelta(weeks=i)) for i in range(a.weeks + 1)]
    weeks = sorted(set(weeks))

    # commits: the workspace plus every cloned repo of repos.yaml
    repos = [(ws.name, ws)] +[(r, ws / "code" / r) for r in repo_names(ws) if (ws / "code" / r / ".git").exists()]
    all_commits = []
    for name, path in repos:
        for c in commits(path, since):
            if not BOT.search(c["name"]) and not BOT.search(c["email"]):
                all_commits.append({**c, "repo": name})

    # one person per email; shown under the name they use most
    names_by_email = defaultdict(Counter)
    for c in all_commits:
        names_by_email[c["email"]][c["name"]] += 1
    display = {e: n.most_common(1)[0][0] for e, n in names_by_email.items()}
    # the same person can commit from several emails and spellings: merge on the name without spaces and case,
    # shown as the spelling with a space in it (a real name over a login) where there is one
    spelled = defaultdict(Counter)
    for e, n in names_by_email.items():
        for nm, k in n.items():
            spelled[norm(nm)][nm] += k
    pick = {k: sorted(v.items(), key=lambda x: (" " not in x[0], -x[1]))[0][0] for k, v in spelled.items()}
    person = lambda c: pick[norm(display[c["email"]])]  # noqa: E731

    by_week = {w: {"week": w, "total": 0, "ai": 0} for w in weeks}
    by_repo = defaultdict(lambda: {"total": 0, "ai": 0})
    people = defaultdict(lambda: {"commits": 0, "ai": 0, "repos": Counter(), "last": "", "firstAi": None, "weeks": Counter()})
    for c in all_commits:
        w = week_of(dt.date.fromisoformat(c["date"]))
        if w in by_week:
            by_week[w]["total"] += 1
            by_week[w]["ai"] += c["ai"]
        by_repo[c["repo"]]["total"] += 1
        by_repo[c["repo"]]["ai"] += c["ai"]
        p = people[person(c)]
        p["commits"] += 1
        p["ai"] += c["ai"]
        p["repos"][c["repo"]] += 1
        p["last"] = max(p["last"], c["date"])
        p["weeks"][w] += 1
        if c["ai"] and (not p["firstAi"] or c["date"] < p["firstAi"]):
            p["firstAi"], p["firstAiRepo"] = c["date"], c["repo"]

    # pull requests through gh
    pr_rows, pr_ok = [], False
    signed_in = not a.no_prs and subprocess.run(["gh", "auth", "status"], capture_output=True).returncode == 0
    if signed_in:
        slugs = sorted({s for s in (remote_slug(p) for _, p in repos) if s})
        for s in slugs:
            pr_rows += prs(s, since)
        pr_ok = True
    pr_week = {w: {"week": w, "total": 0, "agent": 0, "merged": 0} for w in weeks}
    pr_repo = defaultdict(lambda: {"total": 0, "agent": 0, "merged": 0})
    login_name = {}
    pr_rows = [p for p in pr_rows if not BOT.search(p["login"]) and not BOT.search(p["name"])]
    for p in pr_rows:
        w = week_of(dt.date.fromisoformat(p["created"]))
        if w in pr_week:
            pr_week[w]["total"] += 1
            pr_week[w]["agent"] += p["agent"]
        if p["merged"]:
            mw = week_of(dt.date.fromisoformat(p["merged"]))
            if mw in pr_week:
                pr_week[mw]["merged"] += 1
        pr_repo[p["repo"]]["total"] += 1
        pr_repo[p["repo"]]["agent"] += p["agent"]
        pr_repo[p["repo"]]["merged"] += bool(p["merged"])
        # match a GitHub author to a commit author by name, else keep their GitHub display name
        nm = pick.get(norm(p["name"])) or pick.get(norm(p["login"])) or p["name"] or p["login"]
        login_name[p["login"]] = nm
        people[nm].setdefault("prs", 0)
        people[nm]["prs"] = people[nm].get("prs", 0) + 1
        people[nm]["agentPrs"] = people[nm].get("agentPrs", 0) + p["agent"]
        people[nm]["agentMerged"] = people[nm].get("agentMerged", 0) + bool(p["agent"] and p["merged"])
        if p["agent"] and p["merged"] and (not people[nm].get("firstAgentPr") or p["merged"] < people[nm]["firstAgentPr"][0]):
            people[nm]["firstAgentPr"] = (p["merged"], p["repo"], p["number"])
        # someone seen only through pull requests still has repos, a last active day and a weekly trend
        people[nm]["repos"][p["repo"]] += 0 if people[nm]["commits"] else 1
        people[nm]["last"] = max(people[nm]["last"], p["merged"] or p["created"])
        if w in pr_week and not people[nm]["commits"]:
            people[nm]["weeks"][w] += 1

    # agent runs: this laptop, plus shared counts
    local = agent_runs(ws, since)
    shared, sharers = shared_usage(ws, since)
    runs = shared if shared else local
    run_week = Counter(week_of(dt.date.fromisoformat(r["date"])) for r in runs)
    run_agent = Counter(re.sub(r"^(team|command|module):", "", r["agent"]) for r in runs)
    this_week = week_of(today)

    # work items: who started, who approved, how fast
    loop = json.loads((C / "data" / "loop.json").read_text(encoding="utf-8")) if (C / "data" / "loop.json").exists() else {"specs": []}
    events, achievements = [], defaultdict(set)
    for s in loop["specs"]:
        h = s.get("history") or []
        created = next((x["date"] for x in h if x["event"].startswith("created")), None)
        for x in h:
            by = re.sub(r"\s*\(.*\)$", "", x.get("by") or "")
            if x["event"].startswith("approved") and by:
                achievements[by].add("Approved a gate")
            if x["event"] == "approved spec" and by:
                achievements[by].add("First spec approved")
        sb = (s.get("started_by") or {}).get("name")
        if sb:
            achievements[sb].add("Started a work item")
            people[sb].setdefault("started", [])
            people[sb]["started"] = sorted(set(people[sb].get("started", []) + [s["key"]]))
        phases = ["intent", "spec", "design", "build", "test", "deploy", "maintain"]
        if created and s.get("phase") in phases[3:]:
            moves = [x for x in h if re.match(rf"phase \w+ -> {s['phase']}", x["event"])]
            reached = moves[0]["date"] if moves else None
            # a work item recorded after the fact (forced moves, or every gate on its first day) is not a speed story
            honest = moves and not any(x.get("forced") for x in h if x["event"].startswith("phase"))
            if reached and honest and reached > created:
                days = (dt.date.fromisoformat(reached) - dt.date.fromisoformat(created)).days
                first = {}
                for x in h:  # each gate's first approval: a later re-approval is not a step forward
                    if x["event"].startswith("approved"):
                        first.setdefault(x["event"].replace("approved ", ""), x["date"])
                steps = [f"{g} approved {d}" for g, d in first.items()]
                events.append({"date": reached, "kind": "speed", "key": s["key"],
                               "text": f"{s['key']} went from intent to {s['phase']} in {days} day{'s' if days != 1 else ''}", "value": days,
                               "detail": f"{s.get('title', '')}. Started {created}; " + "; ".join(steps) + f"; {s['phase']} on {reached}."})
        if s.get("criteria", 0) > 1 and s.get("criteria_passing") == s.get("criteria"):
            events.append({"date": s.get("updated") or "", "kind": "quality", "key": s["key"], "text": f"{s['key']}: all {s['criteria']} acceptance criteria passing",
                           "detail": f"{s.get('title', '')}: every acceptance criterion has a passing test."})
        d = ws / "specs" / s["dir"] / "outputs" / "diagrams"
        per = {f.parent.name: len(re.findall(r"^```mermaid", f.read_text(encoding="utf-8"), re.M)) for f in sorted(d.glob("*/v*-*.md"))} if d.is_dir() else {}
        n = sum(per.values())
        if n:
            events.append({"date": s.get("updated") or "", "kind": "diagrams", "key": s["key"], "text": f"{n} diagrams explain {s['key']} in pictures",
                           "detail": f"{s.get('title', '')}: " + ", ".join(f"{v} for {k}" for k, v in per.items()) + ". Open a phase tab and switch to Visual."})
        if (ws / "specs" / s["dir"] / "outputs" / "floorplan").is_dir():
            events.append({"date": s.get("updated") or "", "kind": "map", "key": s["key"], "text": f"{s['key']} has a code map of its {len(s.get('repos') or [])} repos",
                           "detail": "Floorplan map of " + ", ".join(s.get("repos") or []) + ": parts, endpoints and the requests between them. Build phase, Visual."})
        for x in h:
            by = re.sub(r"\s*\(.*\)$", "", x.get("by") or "")
            if x["date"] < (today - dt.timedelta(days=30)).isoformat():
                continue
            if x["event"].startswith("created"):
                events.append({"date": x["date"], "kind": "started", "key": s["key"], "person": sb or by or None,
                               "text": f"{sb or by or 'Someone'} started {s['key']}", "detail": s.get("title", "")})
            elif x["event"].startswith("approved") and by:
                events.append({"date": x["date"], "kind": "approved", "key": s["key"], "person": by,
                               "text": f"{by} approved the {x['event'].replace('approved ', '')} of {s['key']}", "detail": s.get("title", "")})
    for nm, p in people.items():
        if p.get("firstAi"):
            achievements[nm].add("AI-assisted commits")
        if p.get("agentMerged"):
            achievements[nm].add("Agent pull request merged")
        if p.get("firstAi") and p["firstAi"] >= (today - dt.timedelta(days=30)).isoformat():
            events.append({"date": p["firstAi"], "kind": "new", "text": f"{nm} made a first AI-assisted commit", "person": nm,
                           "detail": f"In {p.get('firstAiRepo')}; {p['ai']} AI-assisted of {p['commits']} commits since."})
        fa = p.get("firstAgentPr")
        if fa and fa[0] >= (today - dt.timedelta(days=30)).isoformat():
            events.append({"date": fa[0], "kind": "pr", "text": f"{nm}'s first agent pull request merged", "person": nm,
                           "detail": f"{fa[1]} #{fa[2]}; {p.get('agentMerged', 0)} agent pull requests merged so far."})
    named = [(k, v) for k, v in run_agent.most_common() if k not in ("general-purpose", "Explore", "Plan", "claude-code-guide", "statusline-setup")]
    if named:
        top, n = named[0]
        events.append({"date": today.isoformat(), "kind": "agent", "text": f"{top} is the busiest agent: {n} runs in {a.weeks} weeks",
                       "detail": "Next: " + ", ".join(f"{k} {v}" for k, v in named[1:5]) + "." if len(named) > 1 else ""})
    # one line for one person's approvals of one work item on one day ("approved the intent, spec and design of X")
    merged, seen = [], {}
    for e in events:
        if e["kind"] != "approved":
            merged.append(e)
            continue
        k = (e["date"], e["key"], e["person"])
        gate = e["text"].split(" approved the ")[1].rsplit(" of ", 1)[0]
        if k in seen:
            seen[k]["gates"].append(gate)
        else:
            seen[k] = {**e, "gates": [gate]}
            merged.append(seen[k])
    for e in seen.values():
        g = e.pop("gates")
        e["text"] = f"{e['person']} approved the {' and '.join([', '.join(g[:-1]), g[-1]] if len(g) > 1 else g)} of {e['key']}"
    # highlights first, then the newest of the routine events, newest first within the page's list
    highlight = [e for e in merged if e["kind"] not in ("approved", "started")]
    routine = sorted((e for e in merged if e["kind"] in ("approved", "started")), key=lambda e: e.get("date") or "", reverse=True)
    events = sorted(highlight + routine[: max(0, 80 - len(highlight))], key=lambda e: e.get("date") or "", reverse=True)

    # adoption: repo groups the loop has touched
    touched = Counter(r for s in loop["specs"] for r in s.get("repos") or [])
    groups = defaultdict(lambda: {"repos": 0, "touched": 0, "names": []})
    if (ws / "repos.yaml").exists():
        cur = None
        for line in (ws / "repos.yaml").read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\s*-\s*name:\s*([\w.-]+)", line)
            if m:
                cur = m.group(1)
            g = re.match(r"^\s+group:\s*([\w.-]+)", line)
            if g and cur:
                gr = groups[g.group(1)]
                gr["repos"] += 1
                if touched.get(cur):
                    gr["touched"] += 1
                    gr["names"].append(cur)

    def person_out(nm: str, p: dict) -> dict:
        return {"name": nm, "commits": p.get("commits", 0), "ai": p.get("ai", 0), "prs": p.get("prs", 0), "agentPrs": p.get("agentPrs", 0),
                "repos": [r for r, _ in p.get("repos", Counter()).most_common(4)], "last": p.get("last") or None, "firstAi": p.get("firstAi"),
                "started": p.get("started", []), "weeks": [p.get("weeks", Counter()).get(w, 0) for w in weeks],
                "achievements": sorted(achievements.get(nm, set())), "agentRuns": sum(1 for r in shared if r.get("person") == nm)}

    out = {
        "generated": today.isoformat(), "weeks": weeks, "since": since,
        "commits": {"total": len(all_commits), "ai": sum(c["ai"] for c in all_commits), "byWeek": list(by_week.values()),
                    "byRepo": sorted(({"repo": r, **v} for r, v in by_repo.items()), key=lambda x: -x["total"])[:12],
                    "repos": len(repos)},
        "prs": {"available": pr_ok, "total": len(pr_rows), "merged": sum(1 for p in pr_rows if p["merged"]), "open": sum(1 for p in pr_rows if p["state"] == "open"),
                "agent": sum(p["agent"] for p in pr_rows), "agentMerged": sum(1 for p in pr_rows if p["agent"] and p["merged"]),
                "byWeek": list(pr_week.values()), "byRepo": sorted(({"repo": r, **v} for r, v in pr_repo.items()), key=lambda x: -x["total"])[:12]},
        "agents": {"source": "shared" if shared else "local", "sharedBy": sharers, "total": len(runs), "thisWeek": run_week.get(this_week, 0),
                   "byWeek": [{"week": w, "runs": run_week.get(w, 0)} for w in weeks], "byAgent": [{"agent": k, "runs": v} for k, v in run_agent.most_common(12)],
                   "minutesPerRun": MINUTES_PER_RUN},
        "people": sorted((person_out(nm, p) for nm, p in people.items() if p.get("commits") or p.get("prs") or p.get("started")), key=lambda x: x["name"].lower()),
        "adoption": [{"group": g, **v} for g, v in sorted(groups.items())],
        "events": events[:80],
    }
    (C / "data").mkdir(parents=True, exist_ok=True)
    (C / "data" / "insights.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"insights: {out['commits']['total']} commits ({out['commits']['ai']} AI-assisted) in {len(repos)} repos, "
          f"{out['prs']['total'] if pr_ok else 'no'} pull requests, {len(runs)} agent runs ({out['agents']['source']}), {len(out['people'])} people")


if __name__ == "__main__":
    main()
