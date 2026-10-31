import subprocess,sys,collections,re
def g(*a): return subprocess.run(['git',*a],capture_output=True,text=True).stdout
for f in sys.argv[1:]:
    diff=g('diff','-U0',f+'^',f,'--','.',':!*.md',':!*.json',':!*.jpg',':!*.png',':!*.webp',':!*.svg',':!*.mjs',':!*.txt',':!.claude')
    file=None; counts=collections.Counter(); removed=0
    for line in diff.split('\n'):
        if line.startswith('--- a/'): file=line[6:]; continue
        if line.startswith('--- '): file=None; continue
        m=re.match(r'^@@ -(\d+)(?:,(\d+))? ',line)
        if m and file:
            s=int(m.group(1)); n=1 if m.group(2) is None else int(m.group(2))
            if n==0: continue
            out=g('blame','-s','-l','-L',f'{s},{s+n-1}',f+'^','--',file)
            for l in out.split('\n'):
                if l: counts[l.split()[0].lstrip('^')[:8]]+=1; removed+=1
    top=counts.most_common(3)
    print(f, 'removed', removed, '| intro:', ', '.join(f"{c} {n} lines {g('log','-1','--format=%ad %s','--date=short',c).strip()[:60]}" for c,n in top))
