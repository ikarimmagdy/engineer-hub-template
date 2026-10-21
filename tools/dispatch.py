#!/usr/bin/env python3
"""Dispatch status for the Engineering Hub (same rules as the hub #/dispatch page).

Reads content/data/features.json and the git state of code/ clones, then prints:
which tickets are running, done, waiting (and why), and which can start now in parallel.
Also flags drift between the board and git (branch active but ticket not in progress).
Usage: python3 <hub>/tools/dispatch.py [--json]
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
HUB = os.path.dirname(HERE)
def _json(p, d):
    try: return json.load(open(os.path.join(HUB, p)))
    except Exception: return d
BRAND = _json('content/brand.json', {})
ROOT = os.path.normpath(os.path.join(HUB, BRAND.get('repoRoot', os.path.join('..', '..'))))
CODE = os.path.join(ROOT, BRAND.get('codeDir', 'code'))
ORDER = [s['key'] for s in _json('content/data/lifecycle.json', {}).get('stages', [])] or ['backlog', 'in-progress', 'dev-complete', 'verified', 'deployed-dev', 'deployed-demo', 'deployed-prod']
rank = lambda s: ORDER.index(s) if s in ORDER else 0
DONE = _json('content/data/lifecycle.json', {}).get('doneStage', 'dev-complete')
QUESTIONS = _json('content/data/questions.json', [])

def git(repo, *args):
    try:
        return subprocess.check_output(['git', '-C', os.path.join(CODE, repo), *args], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ''

def main():
    F = json.load(open(os.path.join(HUB, 'content/data/features.json')))
    F = [f for f in F if f.get('fid')]
    by = {f['fid']: f for f in F}
    tickets = sorted([f for f in F if f.get('seq') or f.get('repos')], key=lambda f: f.get('seq') or 999)
    running = [f for f in F if f.get('lifecycle') == 'in-progress']
    held = {}
    for f in running:
        for r in f.get('repos', []):
            held.setdefault(r, []).append(f['fid'])
    def split(x):
        return (x.split(':', 1) + [''])[:2] if (':' in x and not x.startswith('aws:')) else [x, '']
    def clashes(a, b):
        (ra, aa), (rb, ab) = split(a), split(b)
        return ra == rb and (not aa or not ab or aa == ab)
    # open P0 questions that name a ticket in "blocks" stop it once its dependencies are built
    p0 = lambda fid: [q.get('id') for q in QUESTIONS if (q.get('status') or 'open') == 'open' and q.get('priority') == 'P0' and fid in (q.get('blocks') or [])]
    rows = []
    for f in tickets:
        st = f.get('lifecycle', 'backlog'); repos = f.get('repos', [])
        if st == 'in-progress': state, why = 'running', ''
        elif f.get('paused') and rank(st) < rank(DONE): state, why = 'paused', ''
        elif rank(st) >= rank(DONE): state, why = 'done', st
        else:
            unmet = [d for d in f.get('dependsOn', []) if rank(by.get(d, {}).get('lifecycle', 'backlog')) < rank(DONE)]
            hold = {}
            for r in repos:
                for k, hs in held.items():
                    if clashes(k, r):
                        for h in hs:
                            if h != f['fid']: hold.setdefault(h, []).append(r)
            clash = [f"{h} ({', '.join(xs)})" for h, xs in hold.items()]
            if unmet: state, why = 'wait', 'needs ' + ', '.join(unmet) + ' dev-complete'
            elif clash: state, why = 'wait', 'repos in use by ' + '; '.join(clash)
            elif [q for q in p0(f['fid']) if q not in (f.get('startsWithout') or [])]:
                state, why = 'blocked', 'open P0 question ' + ', '.join(q for q in p0(f['fid']) if q not in (f.get('startsWithout') or []))
            elif f.get('gate') == 'cost-approval': state, why = 'go', 'stops at cost approval'
            else: state, why = 'go', ''
        rows.append(dict(fid=f['fid'], seq=f.get('seq'), wave=f.get('wave'), title=f['title'], stage=st, state=state, why=why, repos=repos))
    go = [r for r in rows if r['state'] == 'go']
    for a in go:
        a['notWith'] = [b['fid'] for b in go if b is not a and any(clashes(x, y) for x in a['repos'] for y in b['repos'])]
    # git activity per repo
    activity = {}
    for repo in sorted({split(r)[0] for f in tickets for r in f.get('repos', []) if os.path.isdir(os.path.join(CODE, split(r)[0]))}):
        br = git(repo, 'branch', '--show-current'); ts = git(repo, 'log', '-1', '--format=%ct')
        dirty = len([l for l in git(repo, 'status', '--short').splitlines() if l.strip()])
        age = int((time.time() - int(ts)) / 60) if ts else None
        activity[repo] = dict(branch=br, lastCommitMinAgo=age, uncommitted=dirty)
    drift = []
    for f in tickets:
        bp = (BRAND.get('prompt') or {}).get('branchPattern')
        tag = bp.split('{slug}')[0].replace('{fid}', f['fid']) if bp and '{fid}' in bp else f"feature/{f['fid']}-"
        on = [r for r, a in activity.items() if a['branch'].startswith(tag)]
        if on and f.get('lifecycle') == 'backlog':
            drift.append(f"{f['fid']}: branch checked out in {', '.join(on)} but ticket is backlog")
        wt = any(os.path.isdir(os.path.join(CODE, split(r)[0] + '-' + f['fid'])) for r in f.get('repos', []))
        if f.get('lifecycle') == 'in-progress' and not on and not wt and not any(not os.path.isdir(os.path.join(CODE, split(r)[0])) for r in f.get('repos', [])):
            drift.append(f"{f['fid']}: in progress but no repo has its branch checked out")
    out = dict(running=[r['fid'] for r in rows if r['state'] == 'running'], startNow=[r['fid'] for r in go], rows=rows, held=held, activity=activity, drift=drift)
    if '--json' in sys.argv:
        print(json.dumps(out, indent=1)); return
    print('RUNNING :', ', '.join(out['running']) or '-')
    print('START NOW (parallel-safe):', ', '.join(f"{r['fid']}{' (not with ' + ', '.join(r['notWith']) + ')' if r['notWith'] else ''}{' [' + r['why'] + ']' if r['why'] else ''}" for r in go) or '-')
    print()
    print(f"{'seq':>3}  {'ticket':7}  {'stage':13}  {'can run now?':55}  repos")
    for r in rows:
        lab = {'running': 'running', 'paused': 'paused', 'done': 'done (' + r['why'] + ')', 'go': 'YES' + (' - ' + r['why'] if r['why'] else ''), 'wait': 'wait: ' + r['why'], 'blocked': 'blocked: ' + r['why']}[r['state']]
        print(f"{str(r['seq'] or '-'):>3}  w{str(r['wave'] or '-'):1}  {r['fid']:7}  {r['stage']:13}  {lab[:55]:55}  {', '.join(r['repos'])}")
    print('\nGIT ACTIVITY')
    for repo, a in activity.items():
        print(f"  {repo:22} {a['branch'][:55]:55} last commit {a['lastCommitMinAgo']} min ago, {a['uncommitted']} uncommitted")
    if drift:
        print('\nDRIFT'); [print('  - ' + d) for d in drift]

if __name__ == '__main__':
    main()
