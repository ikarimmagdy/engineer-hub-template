#!/usr/bin/env python3
"""Feed the hub's system map from a workspace's system impact (tools/impact.py).

  python3 tools/sync_system.py [--workspace PATH]

Runs `tools/impact.py json` in the workspace (every spec's outputs/impact.json merged over
repos.yaml and docs/architecture/baseline.json) and writes content/data/system.json. Screen
images are pointed at the copies tools/sync_loop.py made under content/specs/<dir>/review/,
or copied to content/specs/<dir>/impact/ when they live elsewhere in the spec folder.
A workspace without tools/impact.py gets no system map. Run after sync_loop.py.
Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
C = HUB / "content"


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).resolve()
    brand = json.loads((C / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace"):
        sys.exit('No workspace: pass --workspace or set brand.json "workspace"')
    return (HUB / brand["workspace"]).resolve()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    args = ap.parse_args()
    ws = workspace(args.workspace)
    out = C / "data" / "system.json"
    tool = ws / "tools" / "impact.py"
    if not tool.exists():
        out.unlink(missing_ok=True)
        print("system: the workspace has no tools/impact.py, no system map")
        return
    model = json.loads(subprocess.run([sys.executable, str(tool), "json"], cwd=ws, capture_output=True, text=True, check=True).stdout)
    for s in model.get("screens", []):
        img = s.get("image")
        if not img:
            continue
        parts = Path(img).parts  # specs/<dir>/outputs/review/<area>/<file>
        folder, rest = parts[1], Path(*parts[2:])
        if rest.parts[:2] == ("outputs", "review"):
            s["image"] = f"content/specs/{folder}/review/{Path(*rest.parts[2:]).as_posix()}"
        elif (ws / img).is_file():
            dest = C / "specs" / folder / "impact" / rest.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ws / img, dest)
            s["image"] = f"content/specs/{folder}/impact/{rest.name}"
        else:
            s["image"] = None
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, indent=1, ensure_ascii=False), encoding="utf-8")
    n = {k: len(model.get(k, [])) for k in ("components", "flows", "infra", "screens", "useCases", "works")}
    print("system: " + ", ".join(f"{v} {k}" for k, v in n.items()))


if __name__ == "__main__":
    main()
