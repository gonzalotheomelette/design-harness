---
name: learn
description: Turns a designer's correction into a written rule the reviewer will enforce, and a designer's pick among options into a record the art-direction critic reads. Use right after the designer corrects copy, a component's styling, placement, an icon, or anything that a sibling surface or a settled decision would have caught, and whenever they choose between options, directions, toggles or references.
---

# Learn from a correction

A correction that stays in the conversation is lost the next session. A correction written as a rule is checked
on every change after it. This is how a project's `docs/ui-consistency.md` grows from empty to the record of the
designer's taste.

## When

Whenever the designer corrects something, ask yourself: would a sibling surface or a written rule have caught it?
If yes, run this in the same turn as the fix, and commit the row with the fix.

Skip it for one-off feature decisions (what a single page contains) and for anything already a row.

## How

1. **State the rule as what must match**, generalised one level: not "the Retire toast is too long" but "a toast
   is a past-tense verb and its object, under 7 words". Generalise only as far as the designer's words support;
   when unsure, keep it narrow and say so.
2. **Make it checkable**: write how a reviewer would see a violation in a diff or a screenshot.
3. **Name the reference implementation**: the file (and line) that now does it right.
4. **Quote the designer**, with the date. The quote is what stops the rule being relitigated later.
5. **Check for a conflicting row.** If an older row says the opposite, move the older one under *Unsettled* with
   both dates, unless the designer's new words clearly replace it; then replace it and say so.
6. **Sweep the siblings.** `rg` for every other place the corrected pattern appears and list the ones that now break
   the rule. Fix them only with the designer's go-ahead; a sweep that edits is a sweep whose mistakes ship.
7. If the rule can be checked mechanically (a word count, a forbidden class, a required prop), say so: it may
   belong in a check rather than in the reviewer's judgement.

Add the row under the right heading, adding the heading when the file does not have it yet (Buttons and actions,
Toasts and receipts, Dialogs and drawers, Forms, Lists, tables and rows, Pickers and filters, Empty states, notices
and alerts, Copy, Layout and spacing, Icons), in this shape:

| Rule (what must match) | How to check it | Reference implementation | Source |
|---|---|---|---|
| A destructive act is the red button with the bin icon, everywhere | Any Delete, Remove or Discard: `color="red"` and the bin icon; no plain red text | `src/app/fleet/vehicle-record.tsx:351` | 2026-09-24, "it has no stroke like the others" |

Then tell the designer, in one line, the rule you wrote and how many siblings break it.

## When the designer picks

A correction says what was wrong. A pick says what they want: which of several options, directions, toggles or
references they chose, and which they left. Corrections become rules; picks are taste, and taste is a pattern across
many picks, so they are kept as a log the art-direction critic reads, not as rules anyone enforces.

Add a row to `design/picks.md` (create it with this header the first time) in the same turn as the pick:

| Date | Surface | Shown | Picked | Left | Their words |
|---|---|---|---|---|---|
| 2026-11-09 | Home, Work, case pages | 21 proposals as toggles on the pages | Run-ins on phones, the glued breaks, a "Back" label | The hero strip cut, the team section cut, the "X, not Y" rewrites, 15 more | (none) |

Write "Left" as carefully as "Picked": what the designer turned down, among options that were really shown, is as
much taste as what they took. Never infer a pick they did not make, and quote only their words.
