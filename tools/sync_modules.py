#!/usr/bin/env python3
"""Knowledge packs for the hub's module agents: one per repo the workspace works on.

  python3 tools/sync_modules.py [--workspace PATH]

For every repo in the workspace's repos.yaml that is cloned under code/<name>/, reads only
metadata from git and the file tree: branch and last commit, the README's opening paragraph,
top-level folders, languages, entry points, API routes, test files, the runtime row of the
newest docs/env-catalog/ version, and the component, flows and work items of the system model
(content/data/system.json, so run after sync_system.py). Writes content/data/modules.json.
The module agent reads the code itself at question time; this pack tells it where to look.
Never copies file contents beyond the README paragraph. Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
C = HUB / "content"
SKIP = {".git", "node_modules", "build", "dist", "target", "Pods", "bin", "obj", ".gradle", ".idea", "vendor", "packages", "Derived"}
LANG = {".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".cs": "C#", ".rb": "Ruby", ".ts": "TypeScript", ".tsx": "TypeScript",
        ".js": "JavaScript", ".py": "Python", ".go": "Go", ".sql": "SQL", ".xml": "XML", ".yml": "YAML", ".yaml": "YAML", ".m": "Objective-C"}
ENTRY = re.compile(r"(^|/)(Program\.cs|Startup\.cs|Global\.asax\.cs|[A-Z]\w*Application\.(java|kt)|config\.ru|main\.(ts|go|py)|AppDelegate\.swift|"
                   r"[A-Z]\w*App\.swift|MainActivity\.kt|Application\.kt|app\.module\.ts|Web\.config)$")
ROUTES = r"@(Get|Post|Put|Delete|Patch|Request)Mapping|\[Http(Get|Post|Put|Delete|Patch)|\[OperationContract|^[[:space:]]*(get|post|put|delete|patch)[[:space:]]+['\":]|@(Get|Post|Put|Delete|Patch)\("
BOILERPLATE = re.compile(r"when you're done|this readme|hosted on a private|you can install|alternatively|still \d{3}|^update |^curl |^run |^to (run|build|install)", re.I)
SECRETISH = re.compile(r"password|secret|token|credential|apikey|api_key|connectionstring", re.I)


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).resolve()
    brand = json.loads((C / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace"):
        sys.exit('No workspace: pass --workspace or set brand.json "workspace"')
    return (HUB / brand["workspace"]).resolve()


def repos(ws: Path) -> list[dict]:
    out, cur = [], None
    f = ws / "repos.yaml"
    for line in (f.read_text(encoding="utf-8").splitlines() if f.exists() else []):
        m = re.match(r"^\s*-\s*name:\s*(\S+)", line)
        if m:
            cur = {"name": m.group(1)}
            out.append(cur)
            continue
        m = re.match(r"^\s+(group|stack|default|production):\s*(.+)$", line)
        if m and cur:
            cur[m.group(1)] = m.group(2).strip()
    return out


def git(repo: Path, *args: str) -> str:
    try:
        return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=60).stdout.strip()
    except Exception:
        return ""


def readme(repo: Path) -> str:
    f = next((p for p in sorted(repo.glob("README*")) if p.is_file()), None)
    if not f:
        return ""
    for block in re.split(r"\n\s*\n", f.read_text(encoding="utf-8", errors="replace")):
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines or re.match(r"^([-*+]|\d+[.)]|#|!|\[!|<|\||```|---|=)", lines[0]):
            continue
        text = " ".join(lines)
        # only the first prose paragraph: later ones are setup steps, not what the repo is
        ok = len(text) > 40 and not SECRETISH.search(text) and not BOILERPLATE.search(text) and not re.search(r"`|\*\*|https?://|\]\(", text[:120])
        return text[:600] if ok else ""
    return ""


def runtimes(ws: Path) -> dict:
    cat = sorted((ws / "docs" / "env-catalog").glob("v*-*.md"), key=lambda p: int(re.match(r"v(\d+)", p.name).group(1)))
    rows = {}
    if not cat:
        return rows
    for line in cat[-1].read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if line.lstrip().startswith("|") and len(cells) >= 5 and not set(cells[0]) <= set("-: "):
            rows[cells[0]] = {"runtime": cells[1], "port": cells[2], "run": cells[3], "tests": cells[4], "source": str(cat[-1].relative_to(ws))}
    return rows


def pack(r: dict, repo: Path, run: dict, system: dict | None) -> dict:
    files = [f for f in git(repo, "ls-files").splitlines() if not (set(Path(f).parts) & SKIP)]
    top = Counter(Path(f).parts[0] for f in files if len(Path(f).parts) > 1)
    langs = Counter(LANG[Path(f).suffix] for f in files if Path(f).suffix in LANG)
    routes = git(repo, "grep", "-c", "-E", ROUTES, "--", "*.java", "*.kt", "*.cs", "*.rb", "*.ts")
    is_test = lambda f: bool(re.search(r"(^|/)(tests?|spec|__tests__|UnitTest\w*|\w+Tests?)/|(Test|Tests|_spec|\.spec|\.test)\.\w+$", f))
    route_files = sorted(((int(n), p) for p, n in (l.rsplit(":", 1) for l in routes.splitlines() if ":" in l)
                          if not (set(Path(p).parts) & SKIP) and not is_test(p)), reverse=True)
    tests = [f for f in files if is_test(f)]
    out = {
        "id": r["name"], "name": r["name"], "group": r.get("group", ""), "stack": r.get("stack", ""),
        "default": r.get("default", ""), "production": r.get("production", ""),
        "branch": git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "head": dict(zip(("sha", "date", "subject"), (git(repo, "log", "-1", "--format=%h%x09%cs%x09%s").split("\t") + ["", "", ""])[:3])),
        "summary": readme(repo), "files": len(files),
        "folders": [{"name": k, "files": v} for k, v in top.most_common(12)],
        "languages": [{"name": k, "files": v} for k, v in langs.most_common(5)],
        "entryPoints": [f for f in files if ENTRY.search(f)][:12],
        "routes": sum(n for n, _ in route_files), "routeFiles": [{"path": p, "routes": n} for n, p in route_files[:10]],
        "tests": len(tests), "runtime": run.get(r["name"]),
    }
    if system:
        comp = next((c for c in system.get("components", []) if c.get("repo") == r["name"] or c["id"] == r["name"]), None)
        if comp:
            name = {c["id"]: c["name"] for c in system["components"]}
            flows = [f for f in system.get("flows", []) if comp["id"] in (f["from"], f["to"])]
            out["component"] = {"id": comp["id"], "name": comp["name"], "layer": comp["layer"], "summary": comp.get("summary", "")}
            out["talksTo"] = sorted({name.get(f["to"], f["to"]) for f in flows if f["from"] == comp["id"]})
            out["calledBy"] = sorted({name.get(f["from"], f["from"]) for f in flows if f["to"] == comp["id"]})
            out["changedBy"] = [{"key": c["key"], "change": c["change"], "summary": c["summary"]} for c in comp.get("changes", [])]
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    ws = workspace(ap.parse_args().workspace)
    out = C / "data" / "modules.json"
    listed = repos(ws)
    if not listed:
        out.unlink(missing_ok=True)
        print("modules: the workspace has no repos.yaml, no module agents")
        return
    sysf = C / "data" / "system.json"
    system = json.loads(sysf.read_text(encoding="utf-8")) if sysf.exists() else None
    run = runtimes(ws)
    mods = [pack(r, ws / "code" / r["name"], run, system) for r in listed if (ws / "code" / r["name"] / ".git").exists()]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"workspace": ws.name, "listed": len(listed), "modules": mods}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"modules: {len(mods)} of {len(listed)} repos cloned, packs written")


if __name__ == "__main__":
    main()
