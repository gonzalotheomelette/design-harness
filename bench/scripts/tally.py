# Usage: BENCH_DATA=<restored bench data> python3 bench/scripts/tally.py <run dir>
import json, os, sys, collections
B = sys.argv[1]
DATA = os.environ.get('BENCH_DATA') or sys.exit('Set BENCH_DATA to the restored bench data (see bench/README.md).')
CASES = [l.split('\t') for l in open(f'{DATA}/cases.tsv').read().splitlines()[1:] if l.strip()]
PROJECT = {c[0]: c[1] for c in CASES}
PROJECTS = list(dict.fromkeys(PROJECT.values()))
key = json.load(open(f'{B}/judging/blind-key.json'))
rows = []  # (case, project, version-run, hits, partial, miss, findings, not_worth)
missing = []
for case, labels in key.items():
    try: s = json.load(open(f'{B}/judging/{case}/scores.json'))
    except Exception as e: missing.append(case); continue
    n = len(s['corrections'])
    for label, name in labels.items():
        r = s['reports'][label]; m = r['marks']
        assert len(m) == n, (case, label)
        rows.append((case, PROJECT[case], name, m.count('HIT'), m.count('PARTIAL'), m.count('MISS'), r['findings'], r['not_worth'], n))
if missing: print('not scored yet:', missing)
def summary(filter_):
    sel = [r for r in rows if filter_(r)]
    if not sel: return None
    h = sum(r[3] for r in sel); p = sum(r[4] for r in sel); mi = sum(r[5] for r in sel); f = sum(r[6] for r in sel); nw = sum(r[7] for r in sel)
    return h, p, mi, round(f / len(sel), 1), round(100 * nw / max(f, 1))
print('corrections per project:', {proj: sum(r[8] for r in rows if r[1] == proj and r[2] == 'v060-run1') for proj in PROJECTS})
print('| Project | Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time |')
for proj in PROJECTS:
    for name in ['v070-run1', 'v070-run2', 'v070-run3', 'v060-run1']:
        s = summary(lambda r: r[1] == proj and r[2] == name)
        if s: print(f'| {proj} | {name} | {s[0]} | {s[1]} | {s[2]} | {s[3]} | {s[4]}% |')
print()
print('per case, hits (0.7.0 runs 1/2/3 ; 0.6.0):')
for case in key:
    get = lambda n: next((r for r in rows if r[0] == case and r[2] == n), None)
    rs = [get(n) for n in ['v070-run1', 'v070-run2', 'v070-run3', 'v060-run1']]
    if all(rs): print(f'  {case} ({rs[0][8]} corrections): {rs[0][3]}/{rs[1][3]}/{rs[2][3]} ; {rs[3][3]}   partial {rs[0][4]}/{rs[1][4]}/{rs[2][4]} ; {rs[3][4]}')
json.dump(rows, open(f'{B}/judging/rows.json', 'w'))
