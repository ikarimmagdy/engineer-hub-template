#!/usr/bin/env python3
"""Feed the hub's loop pages from a workspace's specs/ (the agentic engineering loop).

  python3 tools/sync_loop.py [--workspace PATH]

The workspace is the repo that holds specs/<KEY>-<slug>/ and tools/spec.py (the project
template). PATH defaults to brand.json "workspace", resolved from this hub folder.

Writes, and never edits the workspace:
  content/data/loop.json            one entry per spec: spec.py json summary plus the files
                                    the hub can show (intent, spec, plan, tasks, tests,
                                    review areas, feedback batches, other outputs)
  content/specs/<dir>/...           copies of those markdown files and outputs/findings.json

Status comes only from spec.py (status.json, tasks.md). This script adds nothing to it.
Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
C = HUB / "content"
DOCS = {"intent": "intent.md", "spec": "spec.md", "plan": "plan.md", "data-model": "data-model.md",
        "tasks": "tasks.md", "test-plan": "test-plan.md"}
AREAS = ["scope", "architecture", "infra", "apis", "data", "localization", "ui-ux", "security", "tests"]


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    brand = json.loads((C / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace"):
        sys.exit('No workspace: pass --workspace or set brand.json "workspace"')
    return (HUB / brand["workspace"]).resolve()


def specs_json(ws: Path) -> list:
    tool = ws / "tools" / "spec.py"
    if not tool.exists():
        sys.exit(f"{tool} not found: is {ws} a workspace made from the project template?")
    out = subprocess.run([sys.executable, str(tool), "json"], cwd=ws, capture_output=True, text=True, check=True)
    return json.loads(out.stdout or "[]")


def is_filled(path: Path, template: Path) -> bool:
    """A spec file counts as written when it differs from the template beyond the placeholders."""
    if not path.exists():
        return False
    if not template.exists():
        return True
    norm = lambda t: "\n".join(l for l in t.splitlines() if "{{" not in l and l.strip())
    mine = [l for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    base = set(norm(template.read_text(encoding="utf-8")).splitlines())
    return any(l not in base for l in mine if not l.startswith("# "))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    ws = workspace(ap.parse_args().workspace)
    rows = specs_json(ws)
    out_dir = C / "specs"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    tpl = ws / "specs" / "_template"
    specs = []
    for r in rows:
        name = r.get("dir") or next((d.name for d in (ws / "specs").glob(f"{r['key']}-*") if d.is_dir()), r["key"])
        d = ws / "specs" / name
        dest = out_dir / name
        files = {}
        for k, f in DOCS.items():
            if (d / f).exists():
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(d / f, dest / f)
            files[k] = is_filled(d / f, tpl / f)
        review = []
        for area in AREAS:
            src = d / "outputs" / "review" / f"{area}.md"
            if src.exists():
                (dest / "review").mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest / "review" / src.name)
                review.append(area)
        feedback = []
        for src in sorted((d / "outputs" / "feedback").glob("v*.md"), reverse=True):
            (dest / "feedback").mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest / "feedback" / src.name)
            feedback.append(src.name)
        outputs = []
        for src in sorted((d / "outputs").glob("*.md")):
            (dest / "outputs").mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest / "outputs" / src.name)
            outputs.append(src.name)
        findings = d / "outputs" / "findings.json"
        if findings.exists():
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(findings, dest / "findings.json")
        inputs = sorted(p.name for p in (d / "inputs").iterdir() if p.is_file() and not p.name.startswith(".")) if (d / "inputs").exists() else []
        status = json.loads((d / "status.json").read_text(encoding="utf-8")) if (d / "status.json").exists() else {}
        listed = r.get("files")  # spec.py json may list the written files by name
        if isinstance(listed, list):
            files.update({k: f in listed for k, f in DOCS.items()})
        specs.append({**r, "dir": name, "files": files,
                      "review": review, "feedback": feedback, "outputs": outputs, "inputs": inputs,
                      "findingsFile": f"content/specs/{name}/findings.json" if findings.exists() else None,
                      "intake": r.get("intake", status.get("intake")), "approved": status.get("approved", r.get("approved")),
                      "tracker": status.get("tracker", r.get("tracker")), "sources": status.get("sources", []),
                      "repos": status.get("repos", []), "history": status.get("history", [])})
    loop = {"generated": dt.date.today().isoformat(), "workspace": ws.name, "specs": specs}
    (C / "data").mkdir(parents=True, exist_ok=True)
    (C / "data" / "loop.json").write_text(json.dumps(loop, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"loop: {len(specs)} specs from {ws}")


if __name__ == "__main__":
    main()
