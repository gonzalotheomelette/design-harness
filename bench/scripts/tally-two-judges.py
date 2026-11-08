# Unblinds two judges' scores, totals each version's hits per run, and measures how often the judges agree.
# A correction counts as a hit when both judges say HIT, as partial when neither says MISS, otherwise as a miss.
# Usage: BENCH_DATA=<restored bench data> python3 bench/scripts/tally-two-judges.py <judging dir>
import json, os, sys, collections
DATA = os.environ.get('BENCH_DATA') or sys.exit('Set BENCH_DATA to the restored bench data (see bench/README.md).')
J = sys.argv[1]
key = json.load(open(f'{J}/blind-key.json'))
corr = json.load(open(f'{DATA}/website/corrections.json'))
same = total = 0
pairs = collections.Counter()
tot = collections.defaultdict(collections.Counter)
vis = collections.defaultdict(collections.Counter)
for k, labels in key.items():
    one = lambda n: f'{J}/{k}/scores-{n}.json' if os.path.exists(f'{J}/{k}/scores-{n}.json') else f'{J}/{k}-judge{n}.json'
    s1 = json.load(open(one(1)))
    s2 = json.load(open(one(2)))
    for label, name in labels.items():
        version = name.rsplit('-run', 1)[0]
        m1, m2 = s1['reports'][label]['marks'], s2['reports'][label]['marks']
        assert len(m1) == len(m2) == len(corr[k]), (k, label)
        for i, (a, b) in enumerate(zip(m1, m2)):
            total += 1; same += a == b; pairs[(a, b)] += 1
            score = 'HIT' if a == b == 'HIT' else 'PARTIAL' if 'MISS' not in (a, b) else 'MISS'
            tot[version][score] += 1
            vis[(version, corr[k][i]['visible_only'])][score] += 1
        for j, s in (('1', s1), ('2', s2)):
            tot[version][f'findings{j}'] += s['reports'][label]['findings']
            tot[version][f'notworth{j}'] += s['reports'][label]['not_worth']
L = ['HIT', 'PARTIAL', 'MISS']
po = same / total
pa = {l: sum(v for (a, b), v in pairs.items() if a == l) / total for l in L}
pb = {l: sum(v for (a, b), v in pairs.items() if b == l) / total for l in L}
pe = sum(pa[l] * pb[l] for l in L)
print(f'judges agree on {same} of {total} marks ({po:.0%}); Cohen kappa {(po - pe) / (1 - pe):.2f}')
n_corr = sum(len(corr[k]) for k in key)
for v in sorted(tot):
    t = tot[v]; reviews = 3 * len(key)
    print(f'{v}: per run, hits {t["HIT"]/3:.1f}, partial {t["PARTIAL"]/3:.1f}, miss {t["MISS"]/3:.1f} of {n_corr}; '
          f'findings per review {t["findings1"]/reviews:.1f} / {t["findings2"]/reviews:.1f}, '
          f'not worth the time {100*t["notworth1"]/max(t["findings1"],1):.0f}% / {100*t["notworth2"]/max(t["findings2"],1):.0f}% (judge 1 / 2)')
    for flag in (True, False):
        c = vis[(v, flag)]
        print(f'   {"visible only" if flag else "readable    "}: hits {c["HIT"]/3:.1f}, partial {c["PARTIAL"]/3:.1f}, miss {c["MISS"]/3:.1f}')
