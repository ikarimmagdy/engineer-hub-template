"""Share your agent-run counts with the team, by choice: daily counts per agent from this laptop's
.claude/state/agent-runs.jsonl, written to <workspace>/<usageDir>/<you>.json (brand.json "usageDir").

  python3 tools/share_usage.py [--push]

Counts only: the date, the agent and how many runs. Never a prompt, a question, a work item or a path. With --push
the file is committed alone and pushed, the way tools/spec.py shares a work item. sync_insights.py adds every shared
file to the Home page's agent numbers. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args()
    brand = json.loads((HUB / "content" / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace") or not brand.get("usageDir"):
        sys.exit('Set brand.json "workspace" and "usageDir" (the workspace folder that holds shared counts) first.')
    ws = (HUB / brand["workspace"]).resolve()
    who = subprocess.run(["git", "config", "user.name"], cwd=ws, capture_output=True, text=True).stdout.strip()
    if not who:
        sys.exit("Set git config user.name in the workspace first: the file is named after you.")
    days: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    f = ws / ".claude" / "state" / "agent-runs.jsonl"
    for line in f.read_text(encoding="utf-8").splitlines() if f.exists() else []:
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if r.get("event") == "start" and r.get("ts"):
            days[r["ts"][:10]][re.sub(r"[^\w:.-]", "", str(r.get("agent") or "unknown"))[:60]] += 1
    out = ws / brand["usageDir"] / f"{re.sub(r'[^a-z0-9]+', '-', who.lower()).strip('-')}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"person": who, "days": {d: dict(v) for d, v in sorted(days.items())}}, indent=1) + "\n", encoding="utf-8")
    total = sum(sum(v.values()) for v in days.values())
    print(f"usage: {total} agent runs over {len(days)} days written to {out.relative_to(ws)}")
    if a.push:
        rel = str(out.relative_to(ws))
        for cmd in (["git", "add", rel], ["git", "commit", "-q", "-m", f"usage: agent-run counts of {who}", "--", rel],
                    ["git", "pull", "-q", "--rebase", "--autostash"], ["git", "push", "-q"]):
            r = subprocess.run(cmd, cwd=ws, capture_output=True, text=True)
            if r.returncode and "nothing to commit" not in (r.stdout + r.stderr):
                sys.exit(f"share: {' '.join(cmd)} failed: {(r.stderr or r.stdout).strip()[:300]}")
        print("share: committed and pushed")


if __name__ == "__main__":
    main()
