# How well the reviewer works, and how it was measured

Measured 2026-10-31 on the the client prototype prototype, where this harness was first built. Re-run it whenever the reviewer,
its rules or its model change; a change that lowers the hit rate or raises the noise is a regression.

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

## Results (7 cases, 18 corrections)

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
review counts when Claude Code records the call as completed, and an errored call does not.

## Limits

Seven cases from one project, one run each, so run-to-run variance is unknown and 11 against 10 is noise. The cases
were chosen for the kinds of correction this reviewer targets, and its copy limits were measured on the same
project's approved copy, so some of the answer was in the instrument: more than an ordinary home advantage. The judge
is a model. The configuration measured reviewed whole commits without a dev server; the shipped one reviews a turn's
change and looks at the page, which these numbers do not cover. Next: repeat each case three times and add a second
project held out from the rules.
