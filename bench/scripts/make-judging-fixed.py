# Builds one blind judging folder per case, scored against corrections fixed in advance (the 2026-11-08 round): the
# key, the case's corrections, and the reports shuffled under letters. Website cases also carry the three 0.7.0
# code-only reports as an anchor for the judge; the client prototype's were never kept.
# Usage: BENCH_DATA=<restored bench data> python3 bench/scripts/make-judging-fixed.py <run dir> [case ...]
# <run dir> holds reports/<case>-run<n>.md and keys/key-<case>.md; the result goes to <run dir>/judging.
import json, os, random, re, shutil, sys
R = sys.argv[1]; only = sys.argv[2:]
D = os.environ.get('BENCH_DATA') or sys.exit('Set BENCH_DATA to the restored bench data (see bench/README.md).')
web = json.load(open(f'{D}/website/corrections.json'))
os.makedirs(f'{R}/judging', exist_ok=True)
try: blind = json.load(open(f'{R}/judging/blind-key.json'))
except Exception: blind = {}
for line in open(f'{D}/cases.tsv').read().splitlines()[1:]:
    k, proj = line.split('\t')[:2]
    if only and k not in only: continue
    src = {f'new-run{n}': f'{R}/reports/{k}-run{n}.md' for n in (1, 2, 3)}
    if proj == 'website':
        src.update({f'v070-run{n}': f'{D}/website/{k}/v0.7.0-run{n}.md' for n in (1, 2, 3)})
        corr = [c['name'] for c in web[k]]
    else:
        corr = json.load(open(f'{D}/scores/{k}.json'))['corrections']
    missing = [n for n, p in src.items() if not os.path.exists(p)]
    if missing: print(k, 'missing', missing); continue
    d = f'{R}/judging/{k}'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    shutil.copy(f'{R}/keys/key-{k}.md', f'{d}/key.md')
    open(f'{d}/corrections.md', 'w').write(''.join(f'{i+1}. {c}\n' for i, c in enumerate(corr)))
    # Seeded per case, so rebuilding one case never reshuffles another.
    names = list(src); random.Random(f'{k}-20261108').shuffle(names); blind[k] = {}
    for label, name in zip('ABCDEF', names):
        text = re.sub(r'(?im)^.*(review-token|fingerprint)\s*:.*\n', '', open(src[name]).read())
        open(f'{d}/{label}.md', 'w').write(text); blind[k][label] = name
json.dump(blind, open(f'{R}/judging/blind-key.json', 'w'), indent=1)
print('cases ready:', len(blind))
