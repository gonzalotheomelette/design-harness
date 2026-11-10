---
name: design-pass
description: The loop for building or reworking any visual surface - read what exists, gather references, build from tokens, look at it, have it reviewed, then show. Use when creating a page, panel, dialog or component, when asked for a design pass, or when work is called basic, unrefined, tight, wordy, inconsistent or off-brand.
---

# Design pass

Output quality tracks what is written down concretely and what is checked. Most rejections this loop was built from
were avoidable by a step, not by better judgement. The rest were taste: a page that passed every check and still
read as plain. Steps 2 and 5 are where taste comes in, from references the designer picked and from a critic that
judges against them.

## 1. Read what exists, before any markup

Search the project for the concept and open the files, not just their names. Never build a component the product
already has; widen the existing one's props instead. Every hand-rolled duplicate drifts: in look, and in meaning.
Read the rows of `docs/ui-consistency.md` for the elements you are about to touch, and the DESIGN.md sections that
govern them.

## 2. Gather references, still before markup

Start from `design/references/`: what the designer already picked, and what each pick teaches. When it has nothing
for this pattern, run the `references` skill. Search by **pattern class**, not feature: "resource calendar with
staff as rows" finds what a scheduling page should be; "scheduling page" finds noise. Look at what references do
*structurally*. A grid of bordered cells where every reference uses a continuous surface is a structural problem,
and trim will not fix it.

For a new pattern (a chart, a new illustration), gather references first and decide from them. Options generated
from your own defaults read as generated.

## 3. Build

From tokens and existing components only. The frontend-design skill's process applies to anything new: plan the
choices, review the plan against the generated defaults, then build. On a working screen (Operate mode), the
product must read as the best of its category before it reads as anything distinctive.

Set text the way DESIGN.md's typesetting line says from the start: a measure on body text, `text-wrap: balance` on
headings, `pretty` on paragraphs. Write copy with the `ux-copy` skill: short, in the project's voice, with the
sibling's verbs.

## 4. Look at it

Screenshot the surface at desktop and phone width, in each colour mode the product ships, and open the images.
Most corrections are second-order effects of your own edit, in the region beside the one you meant to change. Use
the project's `screenshot` command when it names one, else `node <harness>/bin/shoot.mjs /<route>` from the
project root; the browser pane can stall transitions, so a picture from it is not proof. Run
`node <harness>/bin/check-breaks.mjs /<route>` and `node <harness>/bin/check-layout.mjs /<route>` too: a one-word
last line, a row that runs off a phone or a block a column off its siblings changes with the
width, and three widths catch what one picture misses.

## 5. Let the reviewer read it

The review-before-show hook asks for the `design-harness:ui-review` agent when rendered files changed. Run it in
the foreground, fix what you agree with, and keep a list of what you chose not to fix and why.

Then ask the questions the designer would:

- Does this read as the thing it is, or as a table or form wearing its costume?
- Is the chrome heavier than the content?
- Is it a first draft presented as a finished one?
- Would it have been better if something existing had been reused? If yes, go back to step 1.

For a marketing or reading page, or anything the designer has called basic, offer directions (the `direction` skill)
rather than one version: the designer chooses by looking. The reviewer checks a change is right; nothing in the
harness passes or fails taste.

## 6. Show

Say what you reused, what you took from references, what the reviewer flagged that you left, and what you are unsure of. Never call
work ready because the checks are clean: they measure slips, not taste. Show live URLs rather than batches of
screenshots.

## True everywhere

- **Trim is not structure.** If the critique is "basic", the structure is wrong, not the borders.
- **Clarity over content.** Cut the explanatory copy and per-row repetition first.
- **Never a modal on a modal.** An act started inside a dialog becomes a face of that dialog, with Back.
- **Fix a component's bug in the component**, never at the call site.
- **Label anything you invented** to fill a gap in the brief, everywhere it appears.
