# Judging folders for a website run: each case's three new reports and its three 0.7.0 reports, shuffled under A to
# F with lines naming a version or fingerprint removed, beside the frozen correction list and the answer key.
# Usage: python3 bench/scripts/make-judging-two-judges.py <reports dir of the new run> <label of the new run> <out dir>
import json, os, random, re, shutil, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
new_dir, new_label, out = sys.argv[1], sys.argv[2], sys.argv[3]
random.seed(20261101)
corrections = json.load(open(f'{HERE}/website/corrections.json'))
key = {}
for k in ['W1', 'W2', 'W3', 'W5', 'W6', 'W7']:
    src = {f'{new_label}-run{n}': f'{new_dir}/{k}-run{n}.md' for n in (1, 2, 3)}
    src.update({f'v0.7.0-run{n}': f'{HERE}/website/{k}/v0.7.0-run{n}.md' for n in (1, 2, 3)})
    missing = [n for n, p in src.items() if not os.path.exists(p)]
    if missing: print(k, 'missing', missing); continue
    names = list(src); random.shuffle(names)
    d = f'{out}/{k}'; os.makedirs(d, exist_ok=True)
    shutil.copy(f'{HERE}/website/{k}/key.md', f'{d}/key.md')
    json.dump(corrections[k], open(f'{d}/corrections.json', 'w'), indent=1)
    key[k] = {}
    for label, name in zip('ABCDEF', names):
        text = re.sub(r'(?im)^.*(review-token|fingerprint)\s*:.*\n', '', open(src[name]).read())
        open(f'{d}/{label}.md', 'w').write(text)
        key[k][label] = name
json.dump(key, open(f'{out}/blind-key.json', 'w'), indent=1)
print('cases ready:', len(key))
