# How well the reviewer works, and how it was measured

Measured 2026-10-31 on two projects: a client prototype, where this harness was built, and Omelette's website, held out from
it, and again on 2026-11-08 with the reviewer on Opus. Re-run it whenever the reviewer, its rules or its model change; `bench/` holds the scripts and prompts, and
`bench/README.md` the steps. The cases, answer keys, reports and scores quote the projects' code, so they are not in
this tree; `bench/README.md` says how to restore them. A change that lowers the hit rate or raises the noise is a
regression.

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

## 0.17.0 on Opus 5.5, both projects (2026-11-08)

The question: since 0.16.0 the reviewer runs on the latest Opus, here `claude-opus-5-5`. Does it catch more than 0.7.0
on Sonnet? The same 13 cases, code only (no dev server), three runs each: a fresh Opus agent given the reviewer's
instructions as of 0.17.0 plus the AI-look register as refreshed on 2026-11-08, and a packet built as the hook builds it
(with `settings.json`, and a `request.md` saying the request was not recorded). One Opus judge per case scored the
reports against that case's corrections, fixed in advance rather than listed by the judge: the website's 21 from the
0.12.1 round and the client prototype's 32 from the 0.7.0 round. On the website each judge also scored the three 0.7.0
code-only reports, shuffled in with the new ones. It gave them 1.7 hits a run where the 0.12.1 round's judges gave 1.3,
so it reads close to them. The client prototype's 0.7.0 reports were never kept, so there the comparison is with
another judge's scores.

| Project | Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time |
|---|---|---|---|---|---|---|
| Website, held out (21 corrections) | 0.17.0 on Opus, runs 1, 2, 3 | 2, 5, 4 | 5, 6, 8 | 14, 10, 9 | 14.3 | 41% |
| | 0.7.0 on Sonnet, same judge | 3, 1, 1 | 4, 5, 5 | 14, 15, 15 | 10.3 | 37% |
| Client prototype (32) | 0.17.0 on Opus, runs 1, 2, 3 | 8, 12, 11 | 13, 8, 7 | 11, 12, 14 | 18.4 | 13% |
| | 0.7.0 on Sonnet, the 0.7.0 judges | 11, 11, 14 | 9, 8, 8 | 12, 13, 10 | 12.6 | 13% |

What it says:

- **On the held-out website, two more hits a run**, 3.7 against 1.7 under the same judge, most of them on the kickoff
  brief (5 hits over three runs against 1). Small, but larger than 0.7.0's own spread there.
- **On the client prototype, no gain.** 10.3 against 12 is inside the three hits runs differ by, and the scores come
  from different judges. The drop is one case: all three runs flagged a wordy row line and proposed cutting the other
  half of it.
- **It says more.** 18 findings a review on the client prototype against 13, and 14 against 10 on the website, at the
  same share not worth the time on the client prototype and a little more on the website.
- **It is slower.** The median review took 3.3 minutes (2.4 to 6.7), where Sonnet took 89 seconds in the first
  comparison below. These stand-ins searched by reading files, which is slower than the plugin agent's Grep.
- **The visual corrections are still missed:** 0.3 hits of the website's 7.
- **Most partial hits are the right element with a softer fix.** Where the designer deleted, the reviewer rewrote: it
  kept "Omelette Studio" on the founder label, demoted the draft banner instead of removing it, trimmed the review
  step's copy instead of dropping the step, and kept the clause a notice's fix cut.

By the rule above this is neither a gain nor a regression: the website moved by more than its spread and the client
prototype did not move outside its own. Nothing here calls for pinning the reviewer back to an earlier model.

How this run differed: it measures the model and the refreshed register together, so it cannot say which moved what;
it did not also rerun Sonnet, so the comparison is with 0.7.0's stored reports and scores; the stand-in reviewers had
Read but no Grep or Glob, and 5 of the 39 runs used a read-only shell search against their instructions; no packet
carried the person's request. The reports and scores quote both projects' code, so they are not in this tree.
`bench/scripts/make-judging-fixed.py` and `tally-fixed.py` build and total this round's judging.

## 0.12.1 with screenshots, on the held-out website (2026-11-01)

The question: do pictures catch the visual corrections the code-only reviews missed? The six website cases were run
the way the harness ships, three times each: each case's site built and served, a packet per run, and a headless
Claude Code session with the plugin loaded that took screenshots (scrolled screen by screen, light and dark, desktop
and phone) and an accessibility run, then called the real `design-harness:ui-review` agent. The corrections were
listed from the answer keys alone, before any report was read (21 of them, 7 that only show on the rendered
page). Two Opus judges then scored all six reports per case independently, the three new
runs beside the three 0.7.0 code-only runs, shuffled. They agreed on 120 of 126 marks (95%, Cohen's kappa 0.91).

| Per run, of 21 corrections | Hits | Partial | Miss | Findings per review | Not worth the time |
|---|---|---|---|---|---|
| 0.12.1, with screenshots | 1.3 | 6.3 | 13.3 | 6.0 | 30 to 37% |
| 0.7.0, code only | 1.3 | 6.0 | 13.7 | 10.1 | 30 to 33% |
| The 7 visual-only corrections, 0.12.1 | 0 | 0.7 | 7.3 | | |
| The 7 visual-only corrections, 0.7.0 | 0 | 2.0 | 6.0 | | |

What it says: **the screenshots did not catch the visual corrections.** Hits are the same with and without them, and
on the seven corrections that only show on the page (line breaks, spacing out of line, animations stacked on phones,
a colour that should match its neighbour), neither version found one, and the code-only runs came closer.
The newer reviewer is more concise (6 findings per review against 10) at the same share of noise. Pictures cost 1.5 to
4 minutes a review on this project.

What does catch one class of them is a measurement, not a picture: the line-break check added after this run
(`check-breaks.mjs`), run on one case's pages, flagged 29 bad breaks, among them the exact ones that case's fix
corrected.
The others (spacing out of line with its siblings, a colour that should match, how many animations a phone shows) are
the next candidates for the same treatment. With the data restored, `python3 bench/scripts/tally-two-judges.py
$BENCH_DATA/scores-v0.12.1` reproduces this table from both judges' scores and the blind key;
`bench/scripts/run-website.sh` repeats the run.

## Results for 0.7.0: three runs per case, two projects

13 cases: the 7 client cases below and 6 from the website, chosen by the same rule (a commit that removed copy or a
device the designer objected to, whose removed lines one earlier commit wrote; three candidates were dropped because
the wording built up over several commits, came from the first commit, or the correction was to an image). The
website's messages rarely quote the designer, so its cases rest on what the fix did more than on his words. Each case
was reviewed three times by the shipped reviewer (Sonnet, reading the packet the hook writes, no dev server) and once
by 0.6.0, and one Opus judge per case scored all four reports, shuffled and stripped of anything naming a version.
These judges listed corrections more finely than the first round's (32 on the client prototype where it counted 18), so compare
within this table, not with the one below.

| Project | Reviewer | Hits | Partial | Miss | Findings per review | Not worth the time |
|---|---|---|---|---|---|---|
| Client prototype (32 corrections) | 0.7.0, run 1 | 11 | 9 | 12 | 13.4 | 14% |
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
  third to nearly half outright and 8 or 9 more in part, with few findings wasted. On the website, where the
  corrections were mostly visual (line breaks, spacing, stacked animations, a colour that should match) or product
  calls code cannot show (a word changed, a line dropped, the nav trimmed), it found 2 of 19 outright, and two in five
  of its findings were not worth the time. Its partial hits there were the copy and chrome ones.
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
found them alone. The wider reviewers did find real behaviour bugs the per-turn reviewer did not, in forms and
sheets, which is why `web-design-guidelines` runs before a PR.

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
benchmark reports on 0.7.0 opened with their token, read from the packet's README as 0.7.0 placed it; from 0.9.0 the
token is only on the first line of change.diff, and the benchmark script now builds it there too.

0.7.0's packet flow, live: a headless session made a wordy toast, the hook held the turn and wrote the packet, the
reviewer (Read, Grep and Glob, all three confirmed working in a plugin agent) flagged the toast against its sibling
and questioned a claim the code did not back, the review was logged, and the turn took 37 seconds.

## Limits

How this run differed from what ships, so its numbers are not read as more than they are: the packets diffed each
case's whole commit, not only its rendered files (fixed in `bench/scripts/make-packet.mjs` since, which now builds the
packet as the hook does); the reviewers were general Sonnet agents given the plugin's instructions, which in this
session had no Grep or Glob and searched with read-only grep instead, not the plugin agent itself; and 0.6.0 ran once
per case. The client prototype's answer keys and reports were never kept (they quote a client's code), so 32 of the
51 corrections can be checked only by someone with that repository.

Thirteen cases, three runs each, one model judge per case: enough to see run-to-run spread and a version difference
of the size measured, not small ones. The website is held out from the copy limits and the review rules, though not
from the designer's taste, which shaped both projects. No run had a dev server, so nothing here measures the
screenshots the shipped flow adds, which is exactly where the website's misses sit; the next measurement is the same
website cases with its dev server up. In this session the benchmark's stand-in reviewers had no Grep or Glob and
searched with read-only grep instead, the same search by another tool.
