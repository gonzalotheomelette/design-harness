import json, os, random, re, shutil, sys
# Usage: BENCH_DATA=<restored bench data> python3 bench/scripts/make-judging.py <run dir>
B = sys.argv[1]
DATA = os.environ.get('BENCH_DATA') or sys.exit('Set BENCH_DATA to the restored bench data (see bench/README.md).')
CASES = [l.split('\t') for l in open(f'{DATA}/cases.tsv').read().splitlines()[1:] if l.strip()]
random.seed(20261031)
key = {}
for k in [c[0] for c in CASES]:
    src = {'v070-run1': f'{B}/reports/{k}-run1.md', 'v070-run2': f'{B}/reports/{k}-run2.md',
           'v070-run3': f'{B}/reports/{k}-run3.md', 'v060-run1': f'{B}/reports-0.6.0/{k}-run1.md'}
    missing = [n for n, p in src.items() if not os.path.exists(p)]
    if missing: print(k, 'missing', missing); continue
    labels = ['A', 'B', 'C', 'D']; names = list(src); random.shuffle(names)
    d = f'{B}/judging/{k}'; os.makedirs(d, exist_ok=True)
    shutil.copy(f'{B}/keys/key-{k}.md', f'{d}/key.md')
    key[k] = {}
    for label, name in zip(labels, names):
        text = open(src[name]).read()
        text = re.sub(r'(?im)^.*(review-token|fingerprint)\s*:.*\n', '', text)
        open(f'{d}/{label}.md', 'w').write(text)
        key[k][label] = name
json.dump(key, open(f'{B}/judging/blind-key.json', 'w'), indent=1)
print('cases ready:', len(key))
