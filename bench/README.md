# Rerunning the benchmark

The steps and scripts to repeat the 2026-10-31 and 2026-11-01 runs. The data they ran on is not in this tree,
because it quotes the projects' code and describes a client's product: `cases.tsv` (each case's introducing commit,
the fix that corrected it and what the change was for, in the website `gonzalotheomelette/omelette-website` and a
client prototype), the website's answer keys, reports and correction list, and both rounds' scores. It is kept in
Omelette's private copy of this repository, `gonzalotheomelette/design-harness-private`, at commit `2409cae`. With
access, restore it into a folder outside the checkout and point the scripts at it:

    git clone -q https://github.com/gonzalotheomelette/design-harness-private.git <old>
    mkdir <data> && git -C <old> archive 2409cae bench | tar -x -C <data> --strip-components=1
    export BENCH_DATA=<data>

The client prototype's answer keys were never kept, since they quote its code; only its scores were.

## Steps

1. Clone each project somewhere disposable (`git clone --shared` leaves the original untouched) and check out each
   case's introducing commit in its own worktree. For a client case, give the worktree `.claude/design-harness.json`
   with `{"allowPalette": true}`, the setting that project would have. Nothing needs installing: the checks parse with
   the TypeScript that ships with the harness.
2. Write each case's answer key: the fix commit's message and what it removed and added
   (`scripts/find-introducing-commit.py <fix>` blames the removed lines to find the introducing commit).
3. Write each case's packet, as the hook does: `node scripts/make-packet.mjs <worktree> <packet dir>`.
4. Run the reviewer three times per case, each a fresh agent on the reviewer's model (`opus`, the latest Opus, since 0.16.0; the published numbers are Sonnet's) with this prompt:

   > You are acting as the `ui-review` agent in a benchmark. Read your instructions in full first:
   > `<harness>/agents/ui-review.md`, and follow them, with these adjustments: the project is checked out at
   > `<worktree>`, read-only; use only Read, Grep and Glob on it. Your prompt: packet: `<packet>`; fingerprint:
   > `<case>-run<n>`; what the change is for: "<from $BENCH_DATA/cases.tsv>". When done, write your complete report to
   > `<reports>/<case>-run<n>.md`, then reply with one line: how many findings you reported.

5. `python3 scripts/make-judging.py <dir>` shuffles each case's reports (three runs of this version, one of the
   previous) under letters A to D and strips the lines that name a version.
6. One Opus judge per case, blind:

   > key.md says what the designer corrected after a commit. A.md to D.md are four independent reviews of the commit
   > that introduced the slips. 1. List the distinct corrections in a design reviewer's territory (copy, consistency
   > between surfaces, generated-looking devices, clarity, visual treatment), leaving out pure engineering. 2. For each
   > report and correction mark HIT (same element, same reason or direction of fix), PARTIAL (same element for another
   > reason, or the right reason on a neighbouring element) or MISS. 3. Per report: findings, and how many are not worth
   > a designer's time. Be strict and apply one standard to every report. Write scores.json.

7. `python3 scripts/tally.py <dir>` unblinds and totals.

A change that lowers the hit rate or raises the share of findings not worth the time, on either project, is a
regression.
