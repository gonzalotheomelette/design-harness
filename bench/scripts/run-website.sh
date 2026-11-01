#!/bin/bash
# Runs the shipped flow on the website cases: each case's site served on its own port, a packet per run, and a
# headless Claude Code session with the plugin loaded that takes screenshots and an accessibility run, calls the real
# design-harness:ui-review agent and saves its report. One server at a time, runs one after another, and a run that
# brings back no report is tried once more.
#
# Needs, under $WORK: cases/<case> (worktrees of the website at each case's introducing commit, from cases.tsv),
# tools/node_modules (puppeteer-core and @axe-core/puppeteer) and astro/node_modules (the site's packages).
# Usage: WORK=<dir> [CASES="W1 W2"] [RUNS="1 2 3"] bench/scripts/run-website.sh
set -u
HERE=$(cd "$(dirname "$0")/.." && pwd)
H=$HERE/../plugins/design-harness
H=$(cd "$H" && pwd)
OUT=$WORK/out
PORT=${PORT:-4399}
mkdir -p $OUT/packets $OUT/reports $OUT/logs
LOG=$OUT/progress.log
purpose() { awk -F'\t' -v k="$1" '$1==k {print $5}' $HERE/cases.tsv; }

for K in ${CASES:-W1 W2 W3 W5 W6 W7}; do
  C=$WORK/cases/$K
  ln -sfn $WORK/tools/node_modules $C/node_modules
  mkdir -p $C/.claude && printf '{"devServer":"http://localhost:%s"}\n' $PORT > $C/.claude/design-harness.json
  if [ -f $C/site/package.json ]; then
    ln -sfn $WORK/astro/node_modules $C/site/node_modules
    (cd $C && node site/node_modules/astro/bin/astro.mjs build --root site > $OUT/logs/$K-build.log 2>&1)
    DIR=site/dist
  else
    DIR=.
  fi
  (cd $C && exec python3 -m http.server $PORT --bind 127.0.0.1 --directory $DIR > /dev/null 2>&1) &
  SERVER=$!
  sleep 2
  echo "$(date +%T) $K served from $DIR: $(cd $C && node $H/bin/server-of.mjs)" >> $LOG
  for N in ${RUNS:-1 2 3}; do
    R=$OUT/reports/$K-run$N.md
    for TRY in 1 2; do
      P=$OUT/packets/$K-run$N
      rm -rf $P $R
      node $HERE/scripts/make-packet.mjs $C $P > /dev/null
      START=$(date +%s)
      (cd $C && ~/.local/bin/claude -p --plugin-dir $H --model sonnet \
        --allowedTools "Agent" "Read" "Grep" "Glob" "Edit(/$OUT/**)" \
          "Bash(node $H/bin/shoot.mjs:*)" "Bash(node $H/bin/check-a11y.mjs:*)" \
        -- "You just made the change that is this checkout's last commit (git diff HEAD^ HEAD). It was for: \"$(purpose $K)\". The review-before-show hook has prepared its review. Do exactly this, and change no file in this checkout:
1. The dev server serves this checkout (http://localhost:$PORT). Take pictures of the pages this change renders with \`node $H/bin/shoot.mjs /<route> --at=<css selector of the changed element>\` (every route the change touches), and run \`node $H/bin/check-a11y.mjs /<route>\` on them. Write both commands' full output to $P/browser.txt with the Write tool.
2. Run the design-harness:ui-review agent in the FOREGROUND (run_in_background: false) and wait for its report. Its prompt: \"packet: $P\", \"fingerprint: $K-run$N\", and one sentence on what the change is for.
3. Write the reviewer's report, exactly as it came back, to $R with the Write tool. Then reply with one line: how many findings it reported." \
        < /dev/null > $OUT/logs/$K-run$N-try$TRY.out 2>&1)
      echo "$(date +%T) $K run $N try $TRY: $(( $(date +%s) - START )) s, report $( [ -s $R ] && echo written || echo MISSING ), browser.txt $( [ -s $P/browser.txt ] && echo yes || echo no )" >> $LOG
      [ -s $R ] && break
    done
  done
  kill $SERVER 2>/dev/null
  wait $SERVER 2>/dev/null
done
echo "$(date +%T) done" >> $LOG
