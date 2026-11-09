# Unblinds and totals a round judged by make-judging-fixed.py: per project and run, hits, partial, miss, findings per
# review, the share not worth the time, and the website's visible-only corrections.
# Usage: BENCH_DATA=<restored bench data> python3 bench/scripts/tally-fixed.py <run dir>
import json, os, sys
R = sys.argv[1]
D = os.environ.get('BENCH_DATA') or sys.exit('Set BENCH_DATA to the restored bench data (see bench/README.md).')
blind = json.load(open(f'{R}/judging/blind-key.json'))
web = json.load(open(f'{D}/website/corrections.json'))
proj = {l.split('\t')[0]: l.split('\t')[1] for l in open(f'{D}/cases.tsv').read().splitlines()[1:]}
rows = []
for k, labels in blind.items():
    try: s = json.load(open(f'{R}/judging/{k}/scores.json'))
    except Exception as e: print('not scored:', k, e); continue
    for label, name in labels.items():
        r = s['reports'][label]; m = r['marks']
        assert len(m) == len(s['corrections']), (k, label)
        vis = [m[i] for i, c in enumerate(web[k]) if c['visible_only']] if proj[k] == 'website' else []
        rows.append(dict(case=k, proj=proj[k], name=name, ver=name.split('-')[0], m=m, f=r['findings'], nw=r['not_worth'], vis=vis))
def line(sel, runs):
    n = lambda key, mark: sum(r[key].count(mark) for r in sel) / runs
    f = sum(r['f'] for r in sel); nw = sum(r['nw'] for r in sel)
    return (f"{n('m', 'HIT'):.1f} | {n('m', 'PARTIAL'):.1f} | {n('m', 'MISS'):.1f} | {f / len(sel):.1f} | {100 * nw / max(f, 1):.0f}% | "
            f"visible-only hit {n('vis', 'HIT'):.1f} partial {n('vis', 'PARTIAL'):.1f}")
print('| Project | Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time | |')
for pj in dict.fromkeys(proj.values()):
    for ver in ('new', 'v070'):
        for i in (1, 2, 3):
            sel = [r for r in rows if r['proj'] == pj and r['name'] == f'{ver}-run{i}']
            if sel: print(f'| {pj} | {ver}-run{i} | ' + line(sel, 1))
        sel = [r for r in rows if r['proj'] == pj and r['ver'] == ver]
        if sel: print(f'| {pj} | {ver}, mean of 3 | ' + line(sel, 3))
print()
for k in blind:
    for ver in ('new', 'v070'):
        sel = sorted([r for r in rows if r['case'] == k and r['ver'] == ver], key=lambda r: r['name'])
        if sel: print(k, ver, 'hits', '/'.join(str(r['m'].count('HIT')) for r in sel), 'partial', '/'.join(str(r['m'].count('PARTIAL')) for r in sel), 'findings', '/'.join(str(r['f']) for r in sel))
json.dump(rows, open(f'{R}/judging/rows.json', 'w'))
