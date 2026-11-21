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
                                    loop-config "docs" are listed in loop.json only: build.mjs mirrors
                                    them into content/kb-src

Status comes only from spec.py (status.json, tasks.md). This script adds nothing to it.
Standard library only, Python 3.9+.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
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


def scope_css(css: str, scope: str) -> str:
    """Prefix every rule of a document's stylesheet with a scope class so its figures can sit inside a hub page."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        sel = sel.strip()
        if not sel or sel.startswith("@"):
            continue
        parts = [x.strip() for x in sel.split(",")]
        parts = [f"{scope}" if x in (":root", "html", "body") else f"{scope} {x}" for x in parts]
        out.append(f"{', '.join(parts)}{{{body.strip()}}}")
    return "\n".join(out)


def extract_figures() -> dict:
    """loop-config "attachments" entries with "sections": copy those sections of a versioned HTML document
    (text, tables, diagrams) with the document's CSS scoped, so each lands natively on the page it belongs to."""
    cfg_p = C / "data" / "loop-config.json"
    if not cfg_p.exists():
        return {}
    cfg = json.loads(cfg_p.read_text(encoding="utf-8"))
    out = {}
    for spec_dir, by_area in (cfg.get("attachments") or {}).items():
        for area, docs in by_area.items():
            for i, d in enumerate(docs):
                if not d.get("sections"):
                    continue
                src = HUB / d["src"]
                if not src.exists():
                    print(f"figures: {d['src']} not found (run node build.mjs once)", file=sys.stderr)
                    continue
                t = src.read_text(encoding="utf-8")
                css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", t, re.S))
                key = f"fig-{abs(hash(d['src'])) % 10**8}"
                figs = []
                for sid in d["sections"]:
                    m = re.search(r'<section id="' + re.escape(sid) + r'"[^>]*>(.*?)</section>', t, re.S)
                    if not m:
                        continue
                    h = re.search(r"<h2[^>]*>(.*?)</h2>", m.group(1), re.S)
                    # the whole section (text, tables and diagrams), so the document is distributed, not framed
                    figs.append({"title": re.sub(r"<[^>]+>", "", h.group(1)).strip() if h else sid, "html": m.group(0)})
                out.setdefault(spec_dir, {}).setdefault(area, []).append(
                    {"title": d["title"], "src": d["src"], "scope": key, "css": scope_css(css, "." + key), "figures": figs})
    return out


def page_kind(text: str) -> str:
    """What a whole-page document is about, from its id, folder or title: the System page groups them by it."""
    t = text.lower()
    if re.search(r"matrix|connectivity|firewall|network", t):
        return "matrix"
    if re.search(r"infra|environment|deploy|topolog|cluster|platform", t):
        return "infra"
    if re.search(r"architect|design|c4|system", t):
        return "architecture"
    return "other"


def doc_title(f: Path) -> str:
    t = f.read_text(encoding="utf-8", errors="replace")[:20000]
    m = re.search(r"<title[^>]*>(.*?)</title>", t, re.S) or re.search(r"<h1[^>]*>(.*?)</h1>", t, re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""


def ignored(f: Path) -> bool:
    """True when git ignores the file in its repo: a local draft, never shared."""
    r = subprocess.run(["git", "check-ignore", "-q", str(f)], cwd=f.parent, capture_output=True)
    return r.returncode == 0


def spec_pages(cfg: dict, d: Path, name: str, dest: Path) -> list:
    """loop-config "pages": whole self-contained HTML documents shown as full pages of a spec (own menu, tabs,
    inline JS, CSS and SVG kept), one entry each in the spec page and under the spec in the side menu.
    "src" is relative to the spec folder (a file, or a versioned folder whose latest v<N>-<date>.html is used);
    a path starting with content/ is relative to the hub app instead.
    Every outputs/<folder>/ of the spec that holds a v<N>-<date>.html is added too, even when the config does not
    list it, so a work item's architecture, communication matrix or environment document always reaches the hub."""
    out = []
    entries = list((cfg.get("pages") or {}).get(name, []))
    listed = {(e.get("src") or "").strip("/") for e in entries}
    for sub in sorted(x for x in (d / "outputs").iterdir() if x.is_dir()) if (d / "outputs").is_dir() else []:
        if f"outputs/{sub.name}" not in listed and any(not ignored(f) for f in sub.glob("v*-*.html")):
            # a Floorplan map (/build) is the code map of the work item's repos
            fp = sub.name == "floorplan"
            entries.append({"id": sub.name, "src": f"outputs/{sub.name}", "phase": "build" if fp else "design", "auto": True,
                            **({"kind": "code-map", "title": "Code map (Floorplan)"} if fp else {})})
    for p in entries:
        pid, raw = p.get("id"), p.get("src") or ""
        if not pid or not raw:
            continue
        src = (HUB / raw) if raw.startswith("content/") else (d / raw)
        if src.is_dir():
            # a gitignored draft lives on one laptop only: the hub never shows it (nor publishes it)
            vs = sorted((f for f in src.glob("v*-*.html") if not ignored(f)), key=lambda f: (int((re.match(r"v(\d+)-", f.name) or [0, 0])[1]), f.name))
            src = vs[-1] if vs else None
        if not src or not src.is_file():
            print(f"pages: {name} {pid}: {raw} not found", file=sys.stderr)
            continue
        (dest / "pages").mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest / "pages" / f"{pid}.html")
        title = p.get("title") or (doc_title(src) if p.get("auto") else "") or pid.replace("-", " ").capitalize()
        out.append({"id": pid, "title": title, "kind": p.get("kind") or page_kind(f"{pid} {raw} {title}"),
                    "file": f"content/specs/{name}/pages/{pid}.html", "version": src.name, "phase": p.get("phase"),
                    "source": raw.rstrip("/") + ("/" + src.name if not raw.endswith(".html") else "")})
    return out


PHASE_NAMES = ("intent", "spec", "design", "build", "test", "deploy", "maintain")


def spec_diagrams(d: Path, name: str, dest: Path) -> dict:
    """outputs/diagrams/<phase>/v<N>-<date>.md: each phase in pictures (Mermaid), written by the phase commands.
    Every version is copied; the hub opens the newest and lists the others."""
    out = {}
    root = d / "outputs" / "diagrams"
    for phase in PHASE_NAMES:
        vs = sorted((root / phase).glob("v*-*.md"), key=lambda f: (int((re.match(r"v(\d+)-", f.name) or [0, 0])[1]), f.name)) if (root / phase).is_dir() else []
        if not vs:
            continue
        (dest / "diagrams" / phase).mkdir(parents=True, exist_ok=True)
        for f in vs:
            shutil.copy2(f, dest / "diagrams" / phase / f.name)
        out[phase] = {"file": f"content/specs/{name}/diagrams/{phase}/{vs[-1].name}", "version": vs[-1].name,
                      "versions": [f.name for f in reversed(vs)]}
    return out


VFILE = re.compile(r"^v(\d+)-(\d{4}-\d{2}-\d{2})(.*)\.(md|html?)$", re.I)
IMG = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")


def repo_root() -> Path:
    brand = json.loads((C / "brand.json").read_text(encoding="utf-8"))
    return (HUB / (brand.get("repoRoot") or "../..")).resolve()


def spec_docs(cfg: dict, name: str) -> list:
    """loop-config "docs": markdown or HTML documents of the hub's own repo shown as tabs of a phase of a spec
    and in its Documents bar. "src" is relative to the repo root (brand.json "repoRoot"): a file, or a folder
    whose newest v<N>-<date>.md|html is shown with every other file listed as a version ("match", a regex on
    the file name, narrows the folder); a folder with only images is a gallery. The hub reads the copies
    build.mjs mirrors into content/kb-src, so links and images resolve like knowledge-base documents."""
    repo, out = repo_root(), []
    for e in (cfg.get("docs") or {}).get(name, []):
        did, raw = e.get("id"), (e.get("src") or "").strip("/")
        src = repo / raw
        # test-data folders hold personal data and are never mirrored (build.mjs skips them too)
        if not did or not raw or "test-data" in Path(raw).parts or not src.exists():
            print(f"docs: {name} {did}: {raw} not found", file=sys.stderr)
            continue
        files = [src] if src.is_file() else [f for f in src.iterdir() if f.is_file() and f.suffix.lower() in (".md", ".html", ".htm") and f.name != "CLAUDE.md"]
        if e.get("match"):
            files = [f for f in files if re.search(e["match"], f.name)]
        vers = sorted((f for f in files if VFILE.match(f.name)), reverse=True,
                      key=lambda f: (int(VFILE.match(f.name)[1]), VFILE.match(f.name)[2], -len(f.name)))
        index = [f for f in files if f.name.lower() in ("readme.md", "index.html")]
        rest = sorted(f for f in files if f not in vers and f not in index)
        exact = [f for f in vers if not VFILE.match(f.name)[3]]
        main = (exact or vers or index or rest or [None])[0]
        images = sorted(f for f in src.iterdir() if f.suffix.lower() in IMG) if src.is_dir() and not files else []
        if not main and not images:
            print(f"docs: {name} {did}: no document in {raw}", file=sys.stderr)
            continue
        kb = lambda f: {"name": f.name, "file": "content/kb-src/" + f.relative_to(repo).as_posix()}
        out.append({"id": did, "title": e.get("title") or did.replace("-", " ").capitalize(), "phase": e.get("phase") or "intent",
                    "kind": "images" if not main else ("html" if main.suffix.lower().startswith(".htm") else "md"),
                    "source": raw, "file": kb(main)["file"] if main else None,
                    "version": main.name if main else f"{len(images)} images",
                    "versions": [kb(f) for f in vers + rest + index], "images": [kb(f) for f in images]})
    return out


def doc_to_section(src: Path, out: Path, source_label: str) -> None:
    """Write a hub markdown section holding a whole HTML document's sections natively (scoped CSS, no iframe)."""
    t = src.read_text(encoding="utf-8")
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", t, re.S))
    key = f"doc-{abs(hash(str(src))) % 10**8}"
    secs = re.findall(r"<section\b.*?</section>", t, re.S)
    out.write_text(f"Source: `{source_label}`\n\n<style>{scope_css(css, '.' + key)}</style>\n"
                   f'<div class="ws-doc {key}">\n' + "\n".join(secs) + "\n</div>\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workspace")
    ap.add_argument("--doc", nargs=3, metavar=("SRC_HTML", "OUT_MD", "LABEL"), help="render a whole HTML document natively into a section file and exit")
    args = ap.parse_args()
    if args.doc:
        doc_to_section(Path(args.doc[0]), Path(args.doc[1]), args.doc[2])
        print(f"doc: {args.doc[1]}")
        return
    ws = workspace(args.workspace)
    rows = specs_json(ws)
    out_dir = C / "specs"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    tpl = ws / "specs" / "_template"
    specs = []
    cfg_p = C / "data" / "loop-config.json"
    loop_cfg = json.loads(cfg_p.read_text(encoding="utf-8")) if cfg_p.exists() else {}
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
            imgs = d / "outputs" / "review" / area
            if imgs.is_dir():
                (dest / "review" / area).mkdir(parents=True, exist_ok=True)
                for img in imgs.iterdir():
                    if img.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"):
                        shutil.copy2(img, dest / "review" / area / img.name)
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
        contracts = []
        for src in sorted((d / "contracts").glob("*")) if (d / "contracts").exists() else []:
            if src.is_file() and src.suffix in (".yaml", ".yml", ".json", ".md") and src.name != "README.md":
                (dest / "contracts").mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest / "contracts" / src.name)
                contracts.append(src.name)
        findings = d / "outputs" / "findings.json"
        groups = {}
        if findings.exists():
            rows = json.loads(findings.read_text(encoding="utf-8")).get("findings", [])
            for field in ("type", "component", "team"):
                c = {}
                for x in rows:
                    c[x.get(field) or "Not set"] = c.get(x.get(field) or "Not set", 0) + 1
                groups["by" + field.capitalize()] = dict(sorted(c.items(), key=lambda kv: -kv[1]))
        if findings.exists():
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(findings, dest / "findings.json")
        inputs = sorted(p.name for p in (d / "inputs").iterdir() if p.is_file() and not p.name.startswith(".")) if (d / "inputs").exists() else []
        status = json.loads((d / "status.json").read_text(encoding="utf-8")) if (d / "status.json").exists() else {}
        listed = r.get("files")  # spec.py json may list the written files by name
        if isinstance(listed, list):
            files.update({k: True for k, f in DOCS.items() if f in listed})  # spec.py may not track every file; keep our own check for the rest
        if groups:
            r = {**r, "findings": {**(r.get("findings") or {}), **groups}}
        # a spec that exists only on an open pull request (laid in by the shared hub's workspace sync)
        prop = d / ".proposed.json"
        if prop.exists():
            r = {**r, "proposed": json.loads(prop.read_text(encoding="utf-8"))}
        specs.append({**r, "dir": name, "files": files,
                      "review": review, "feedback": feedback, "contracts": contracts, "outputs": outputs, "inputs": inputs,
                      "findingsFile": f"content/specs/{name}/findings.json" if findings.exists() else None,
                      "intake": r.get("intake", status.get("intake")), "approved": status.get("approved", r.get("approved")),
                      "tracker": status.get("tracker", r.get("tracker")), "sources": status.get("sources", []),
                      "repos": status.get("repos", []), "history": status.get("history", []),
                      "pages": spec_pages(loop_cfg, d, name, dest), "docs": spec_docs(loop_cfg, name),
                      "diagrams": spec_diagrams(d, name, dest)})
    figures = extract_figures()
    loop = {"generated": dt.date.today().isoformat(), "workspace": ws.name, "specs": specs, "figures": figures}
    (C / "data").mkdir(parents=True, exist_ok=True)
    (C / "data" / "loop.json").write_text(json.dumps(loop, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"loop: {len(specs)} specs from {ws}")


if __name__ == "__main__":
    main()
