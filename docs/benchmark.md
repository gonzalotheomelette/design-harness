# How well the reviewer works, and how it was measured

Measured 2026-10-31 on two projects: The client prototype, where this harness was built, and Omelette's website, held out from
it. Re-run it whenever the reviewer, its rules or its model change; `bench/` holds the cases, scripts, prompts and
scores, and `bench/README.md` the steps. A change that lowers the hit rate or raises the noise is a regression.

## Method

1. **Cases are chosen by rule, not by hand.** Every commit message since a date that quotes the designer correcting
   copy or consistency ("too long", "inconsistent", "wordy", "slop", "out of control"). For each, find the branch
   commit that made the correction (squash-merged PRs keep their branch commits on GitHub:
   `git fetch origin pull/<n>/head`).
2. **Replay the commit that introduced the slip.** `git blame` the lines the fix removed, at the fix's parent, to find
   the commit that wrote them. Check that commit out in its own worktree. The change under review is that commit
   alone (`git diff HEAD^ HEAD`), exactly what the incremental hook would have shown.
3. **Run each reviewer blind.** The reviewer gets its own instructions and the change, never the designer's words.
   Rules written after the slip are withheld.
4. **Score blind.** A separate judge per case gets the answer key (the fix commit's message and removed lines) and
   the reports labelled P, Q, R, S with method names scrubbed. Per correction: HIT (same element, same direction of
   fix), PARTIAL (same element, other reason; or right reason, neighbouring element), MISS. Per report: total
   findings, and how many are not worth a designer's time.

## Results for 0.7.0: three runs per case, two projects

13 cases: the 7 the client prototype cases below and 6 from the website, chosen by the same rule (a commit that removed copy or a
device the designer objected to, whose removed lines one earlier commit wrote; three candidates were dropped because
the wording built up over several commits, came from the first commit, or the correction was to an image). The
website's messages rarely quote the designer, so its cases rest on what the fix did more than on his words. Each case
was reviewed three times by the shipped reviewer (Sonnet, reading the packet the hook writes, no dev server) and once
by 0.6.0, and one Opus judge per case scored all four reports, shuffled and stripped of anything naming a version.
These judges listed corrections more finely than the first round's (32 on the client prototype where it counted 18), so compare
within this table, not with the one below.

| Project | Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time |
|---|---|---|---|---|---|---|
| the client prototype (32 corrections) | 0.7.0, run 1 | 11 | 9 | 12 | 13.4 | 14% |
| | 0.7.0, run 2 | 11 | 8 | 13 | 12.6 | 12% |
| | 0.7.0, run 3 | 14 | 8 | 10 | 11.9 | 13% |
| | 0.6.0 | 7 | 7 | 18 | 11.7 | 15% |
| Website, held out (19) | 0.7.0, run 1 | 2 | 6 | 11 | 11.0 | 42% |
| | 0.7.0, run 2 | 2 | 5 | 12 | 9.7 | 40% |
| | 0.7.0, run 3 | 2 | 6 | 11 | 9.7 | 28% |
| | 0.6.0 | 1 | 4 | 14 | 8.2 | 43% |

What it says:

- **Run to run, the reviewer moves by about three hits in 32**, so a difference smaller than that between versions is
  noise. On the client prototype, 0.7.0 over 0.6.0 (11 to 14 against 7) is larger than that. On the website, 2 against 1 is within
  it, from a single 0.6.0 run: no difference shown there.
- **It is a copy reviewer.** On the client prototype, where the corrections were mostly wordy copy and explainer lines, it found a
  third to nearly half outright and most of the rest in part, with few findings wasted. On the website, where the
  corrections were mostly visual (line breaks, a 44px gap, two animations stacked, a near-black that should match) or
  product calls code cannot show ("sprint" to "collaboration", dropping a privacy line, trimming the nav), it found 2
  of 19 outright, and two in five of its findings were not worth the time. Its partial hits there were the copy and
  chrome ones: the draft banner, the eyebrows, the founder label.
- **A held-out project is where the honest number lives.** The copy limits were measured on the client prototype's approved copy,
  and the gap between the two projects is mostly that home advantage plus the kind of correction each one got.

## First comparison, with other reviewers (7 cases, 18 corrections)

| Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time | Median time |
|---|---|---|---|---|---|---|
| design-harness ui-review, Sonnet | **11** | 3 | 4 | **11.1** | 22% | **89 s** |
| design-harness ui-review, Opus | 10 | 5 | 3 | 14.3 | 20% | 125 s |
| Impeccable, its review method | 8 | 6 | 4 | 20.7 | 17% | 212 s |
| OneRedOak design-review | 4 | 8 | 6 | 18.9 | 27% | 163 s |

Impeccable's hits often sat 15th to 26th in its list at low confidence, so a designer reading it would still have
found them alone. The wider reviewers did find real behaviour bugs the per-turn reviewer did not (a payment sheet
dismissed before it records, a date input with no limits), which is why `web-design-guidelines` runs before a PR.

No reviewer caught a placement inconsistency that only shows in a screenshot; the replays ran without a dev server.

## Live trials

A headless session told to make a toast wordy: the hook held the turn, the reviewer ran in the foreground and
flagged the 18-word toast against a limit of 7 and the toast rule, the session kept the wording it had been told to
write and said so, and the turn took 30 seconds. An earlier trial found two faults now fixed: subagents start in
the background by default (a review counts only once its report is back), and `decision: block` is shown as a hook
error (the request is now `additionalContext`).

A shell limit for the reviewer (0.5.1 to 0.6.0) worked in a live trial and still lost to blind review twice: allowed
commands turned into arbitrary ones through a planted node_modules, a planted repository's git config, a screenshot
script the change edited, `.npmrc`, and an `rg` flag. From 0.7.0 the reviewer has no shell; the hook runs the checks
and the session takes the screenshots.

In eight real review reports, only one repeated its fingerprint as instructed, so the hook does not depend on it: a
review counts when Claude Code records the call as completed and its report carries the packet's token. All 39
benchmark reports on 0.7.0 opened with their token.

0.7.0's packet flow, live: a headless session made a wordy toast, the hook held the turn and wrote the packet, the
reviewer (Read, Grep and Glob, all three confirmed working in a plugin agent) flagged the toast against its sibling
and questioned a claim the code did not back, the review was logged, and the turn took 37 seconds.

## Limits

How this run differed from what ships, so its numbers are not read as more than they are: the packets diffed each
case's whole commit, not only its rendered files (fixed in `bench/scripts/make-packet.mjs` since, which now builds the
packet as the hook does); the reviewers were general Sonnet agents given the plugin's instructions, which in this
session had no Grep or Glob and searched with read-only grep instead, not the plugin agent itself; and 0.6.0 ran once
per case. The client prototype's answer keys and reports are not published (they quote a client's code), so 32 of the 51
corrections can be checked only by someone with that repository.

Thirteen cases, three runs each, one model judge per case: enough to see run-to-run spread and a version difference
of the size measured, not small ones. The website is held out from the copy limits and the review rules, though not
from the designer's taste, which shaped both projects. No run had a dev server, so nothing here measures the
screenshots the shipped flow adds, which is exactly where the website's misses sit; the next measurement is the same
website cases with its dev server up. In this session the benchmark's stand-in reviewers had no Grep or Glob and
searched with read-only grep instead, the same search by another tool.
