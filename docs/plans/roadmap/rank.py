#!/usr/bin/env python3
"""Regenerate the Order table in docs/plans/termanch-roadmap.md from the step files in this directory.

Edit a step by changing its `Status:` or `Score:` line, then run `python3 docs/plans/roadmap/rank.py`.
Step file header (one per step, R01.md ...):  # Rnn Title / Status: pending|blocked (why)|done (PR) /
Score: V=5 T=3 R=4 S=2 / Preds: R01,R02 or none / Lane: free|paid / Pin: after Rnn (optional) / Was: ...
WSJF = (V+T+R)/S. A step takes the best bundle score of any chain it unlocks. Paid-lane steps follow free ones.
"""
import re, sys, pathlib
D = pathlib.Path(__file__).parent
INDEX = D.parent / 'termanch-roadmap.md'
steps = {}
for f in sorted(D.glob('R*.md')):
    t = f.read_text().split('\n')
    s = {'id': f.stem, 'title': re.sub(r'^# R\d+ ', '', t[0]), 'file': f.name}
    for l in t[1:14]:
        m = re.match(r'(Status|Score|Preds|Lane|Pin|Was): ?(.*)', l)
        if m: s[m.group(1).lower()] = m.group(2).strip()
    sc = dict(re.findall(r'([VTRS])=(\d+)', s.get('score', '')))
    s['v'], s['t'], s['r'], s['size'] = (int(sc.get(k, 0)) for k in 'VTRS')
    s['preds'] = [] if s.get('preds', 'none') == 'none' else [p.strip() for p in s['preds'].split(',')]
    s['lane'] = s.get('lane', 'free')
    s['open'] = not s.get('status', 'pending').startswith('done')
    s['own'] = (s['v'] + s['t'] + s['r']) / max(s['size'], 1)
    steps[s['id']] = s
act = {k: v for k, v in steps.items() if v['open']}
def anc(k, seen=None):
    seen = seen if seen is not None else set()
    for p in act[k]['preds']:
        if p in act and p not in seen: seen.add(p); anc(p, seen)
    return seen
cod = lambda k: act[k]['v'] + act[k]['t'] + act[k]['r']
def bundle(d):
    c = anc(d) | {d}; return sum(cod(x) for x in c) / sum(max(act[x]['size'], 1) for x in c)
desc = {k: [d for d in act if k in anc(d)] for k in act}
eff = {k: max([act[k]['own']] + [bundle(d) for d in desc[k]]) for k in act}
order, done = [], set()
while len(done) < len(act):
    ready = [k for k in act if k not in done and all(p in done or p not in act for p in act[k]['preds'])]
    free = [k for k in ready if act[k]['lane'] == 'free']
    pool = free or ready
    k = max(pool, key=lambda x: (eff[x], act[x]['own'])); order.append(k); done.add(k)
for k in list(order):
    m = re.match(r'after (R\d+)', act[k].get('pin', ''))
    if m and m.group(1) in order:
        order.remove(k); order.insert(order.index(m.group(1)) + 1, k)
rows = ['| # | Step | Title | Status | WSJF | Preds |', '|---|---|---|---|---|---|']
for i, k in enumerate(order, 1):
    s = act[k]
    rows.append(f"| {i} | [{k}](roadmap/{s['file']}) | {s['title']} | {s.get('status', 'pending')} | {s['own']:.1f} | {', '.join(s['preds']) or '-'} |")
ndone = len(steps) - len(act)
table = '\n'.join(rows) + f"\n\n{ndone} step(s) done (their files stay in `roadmap/`; `grep -l '^Status: done' roadmap/R*.md`).\n"
txt = INDEX.read_text()
new = re.sub(r'(<!-- order:start -->\n).*?(<!-- order:end -->)', lambda m: m.group(1) + table + m.group(2), txt, flags=re.S)
INDEX.write_text(new)
print(f'{len(order)} open, {ndone} done; next: ' + ', '.join(order[:3]))
