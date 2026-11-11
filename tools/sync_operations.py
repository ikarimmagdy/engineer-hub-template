#!/usr/bin/env python3
"""Build the hub's Operation Center from the workspace's operations-center/ folder.

  python3 tools/sync_operations.py [--workspace PATH]

Reads, when they exist:
  operations-center/processes/<id>.md   one operational process (front matter + sections, see below)
  operations-center/journeys/<id>.md    an ordered path through processes (e.g. engineer onboarding)
  operations-center/desks/<KEY>.md      a service desk: what it covers, how its tickets flow
  operations-center/roles.md            who holds each role now (front matter as-of, window; one "## <Role>" section
                                        per role with "- key:", "- kind: fixed|relative", "- desks:", "- matches: a; b",
                                        "- now: Name (Title, 7 tickets); Name (12 tickets)", "- evidence:", "- note:")

and writes content/data/operations.json. No operations-center/ folder: nothing is written and an old
operations.json is removed, so the hub hides the page. PATH defaults to brand.json "workspace".

A process file:
  ---
  id: new-subdomain
  title: Request a new domain or subdomain
  category: domains-dns
  desk: ISD
  request-type: DNS request
  approvals: Line manager (the business need); Infra lead (naming and zone)
  executed-by: Infra network team
  lead-time: one to three days
  confidence: high
  evidence: ISD-12, ISD-40
  depends: tls-certificate
  leads-to: waf-rule
  ---
  ## When you need it      one paragraph
  ## You provide           bullets
  ## Steps                 "1. <actor role> → <action>" per line, in order
  ## Goes wrong when       bullets
  ## An agent can help     paragraph or bullets
Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
OUT = HUB / "content" / "data" / "operations.json"
SECTIONS = {"when you need it": "when", "you provide": "provide", "steps": "steps", "goes wrong when": "wrong",
            "an agent can help": "agent", "notes": "notes", "overview": "overview", "how tickets flow": "flow",
            "request types": "requestTypes"}


def workspace(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    brand = json.loads((HUB / "content" / "brand.json").read_text(encoding="utf-8"))
    if not brand.get("workspace"):
        sys.exit("brand.json has no workspace; pass --workspace")
    return (HUB / brand["workspace"]).resolve()


def parse(text: str) -> tuple[dict, dict]:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    front = {}
    for line in (m.group(1).splitlines() if m else []):
        if ":" in line:
            k, v = line.split(":", 1)
            front[k.strip().lower()] = v.strip()
    body = text[m.end():] if m else text
    parts, cur = {}, None
    for line in body.splitlines():
        h = re.match(r"^##\s+(.+?)\s*$", line)
        if h:
            cur = SECTIONS.get(h.group(1).lower(), h.group(1).lower())
            parts[cur] = []
        elif cur is not None:
            parts[cur].append(line)
    return front, {k: "\n".join(v).strip() for k, v in parts.items()}


def bullets(s: str) -> list[str]:
    return [re.sub(r"^\s*(?:[-*]|\d+[.)])\s+", "", l).strip() for l in s.splitlines() if re.match(r"^\s*(?:[-*]|\d+[.)])\s+", l)]


def steps(s: str) -> list[dict]:
    """"<actor> → <action>"; a step without an actor is an approval step ("Approvers") or done by the previous actor."""
    out = []
    for b in bullets(s):
        a = re.split(r"\s*(?:→|->)\s*", b, maxsplit=1)
        if len(a) == 2 and len(a[0]) <= 60:
            out.append({"actor": a[0].strip(), "action": a[1].strip()})
        else:
            prev = out[-1]["actor"] if out else "Requester"
            out.append({"actor": "Approvers" if re.search(r"approv|sign[- ]?off", b, re.I) else prev, "action": b})
    return out


def split(v: str, sep: str = ",") -> list[str]:
    return [x.strip() for x in v.split(sep) if x.strip()]


def approvals(v: str) -> list[dict]:
    out = []
    for a in split(v, ";"):
        m = re.match(r"^(.*?)\s*\((.*)\)\s*$", a)
        out.append({"role": m.group(1), "checks": m.group(2)} if m else {"role": a, "checks": ""})
    return out


def roles(path: Path) -> dict:
    """roles.md: the wordings the process files use for a role, and who holds it now (names and titles only)."""
    if not path.exists():
        return {"asOf": "", "window": "", "roles": []}
    f, _ = parse(path.read_text(encoding="utf-8"))
    out = []
    for block in re.split(r"^## ", path.read_text(encoding="utf-8"), flags=re.M)[1:]:
        label, _, body = block.partition("\n")
        kv = {m.group(1).lower(): m.group(2).strip() for m in re.finditer(r"^- ([a-z]+):\s*(.*)$", body, flags=re.M)}
        holders = []
        for h in split(kv.get("now", ""), ";"):
            m = re.match(r"(.+?)\s*\((.*)\)\s*$", h)
            name, extra = (m.group(1), m.group(2)) if m else (h, "")
            n = re.search(r"(\d+)\s+tickets?", extra)
            title = re.sub(r",?\s*\d+\s+tickets?", "", extra).strip(" ,")
            holders.append({"name": name.strip(), "title": title or None, "tickets": int(n.group(1)) if n else None})
        out.append({"key": kv.get("key", label.strip().lower()), "label": label.strip(), "kind": kv.get("kind", "fixed"),
                    "desks": split(kv.get("desks", "")), "matches": split(kv.get("matches", ""), ";"), "holders": holders,
                    "evidence": split(kv.get("evidence", "")), "note": kv.get("note", "")})
    return {"asOf": f.get("as-of", ""), "window": f.get("window", ""), "roles": out}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    ws = workspace(ap.parse_args().workspace)
    oc = ws / "operations-center"
    if not oc.is_dir():
        if OUT.exists():
            OUT.unlink()
        print(f"operations: no operations-center/ in {ws}")
        return

    processes = []
    for p in sorted((oc / "processes").glob("*.md")):
        f, s = parse(p.read_text(encoding="utf-8"))
        processes.append({
            "id": f.get("id", p.stem), "title": f.get("title", p.stem), "category": f.get("category", "other"),
            "desk": f.get("desk", ""), "requestType": f.get("request-type", ""), "approvals": approvals(f.get("approvals", "")),
            "executedBy": f.get("executed-by", ""), "leadTime": f.get("lead-time", ""), "confidence": f.get("confidence", ""),
            "evidence": split(f.get("evidence", "")), "depends": split(f.get("depends", "")), "leadsTo": split(f.get("leads-to", "")),
            "when": s.get("when", ""), "provide": bullets(s.get("provide", "")), "steps": steps(s.get("steps", "")),
            "wrong": bullets(s.get("wrong", "")), "agent": s.get("agent", ""), "notes": s.get("notes", ""),
            "path": str(p.relative_to(ws)),
        })
    ids = {x["id"] for x in processes}
    journeys = []
    for p in sorted((oc / "journeys").glob("*.md")):
        f, s = parse(p.read_text(encoding="utf-8"))
        path = []
        for b in bullets(s.get("steps", "")):
            m = re.search(r"\bprocess:\s*([a-z0-9-]+)", b)
            path.append({"text": re.sub(r"\s*\(?\bprocess:\s*[a-z0-9-]+\)?", "", b).strip(" ,;|"), "process": m.group(1) if m and m.group(1) in ids else None})
        journeys.append({"id": f.get("id", p.stem), "title": f.get("title", p.stem), "who": f.get("who", ""),
                         "overview": s.get("overview", ""), "steps": path, "path": str(p.relative_to(ws))})
    desks = []
    for p in sorted((oc / "desks").glob("*.md")):
        f, s = parse(p.read_text(encoding="utf-8"))
        key = f.get("key", p.stem)
        desks.append({"key": key, "name": f.get("name", key), "covers": f.get("covers", ""), "overview": s.get("overview", ""),
                      "flow": s.get("flow", ""), "requestTypes": bullets(s.get("requestTypes", "")),
                      "processes": [x["id"] for x in processes if x["desk"] == key or key in split(x["desk"], "|")],
                      "path": str(p.relative_to(ws))})
    readme = (oc / "README.md").read_text(encoding="utf-8") if (oc / "README.md").exists() else ""
    lede = next((l.strip() for l in re.sub(r"^#.*$", "", readme, flags=re.M).split("\n\n") if l.strip()), "")
    out = {"generated": dt.date.today().isoformat(), "workspace": ws.name, "lede": lede,
           "processes": processes, "journeys": journeys, "desks": desks, "people": roles(oc / "roles.md")}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"operations: {len(processes)} processes, {len(journeys)} journeys, {len(desks)} desks, {len(out['people']['roles'])} roles from {oc}")


if __name__ == "__main__":
    main()
