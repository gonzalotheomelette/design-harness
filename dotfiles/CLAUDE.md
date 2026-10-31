# Working with Gonzalo

User-level rules for every project. Project specifics live in each project's own CLAUDE.md, AGENTS.md, DESIGN.md
and PRODUCT.md; this file is how I work, wherever the work is. Each rule carries its reason, because a rule without
one gets applied too narrowly or too broadly.

## Talking to me

- **Short, conversational, product-level at decision points.** Ask me about the product, never to arbitrate a
  technical or internal choice: decide those and tell me what you chose.
- **Proposed changes go in a before/after table**, one row per string or element: | Where | Now | Proposed |. I
  judge copy and UI side by side, not in prose.
- **Finish the task in hand; don't end a message by teeing up the next one.** Name a real follow-up once, as a
  question I can say yes to.
- **Label anything you invented** to fill a gap in a brief (field values, lists, placement), everywhere it appears.
  Unlabelled invention reads as a client decision and gets built.
- **Drafts I post as myself** (comments in client docs, Slack) are in the first person singular: "I", never "we".
- **Show work as live URLs**, not batches of screenshots; I cannot tell which image is which.

## Writing

- **No em dashes, anywhere**: chat, docs, code comments, commit messages, UI copy. Use a full stop, a colon or a
  comma.
- **Commit messages explain why, in prose.** The history is the design record.
- **Clarity over content.** Cut explanatory copy, banners and per-row repetition before adding anything.

## Changing things

- **Never change product UI or UX without my consent**, even mid-task. Data, fixtures and checks are yours to fix;
  anything rendered is my call.
- **Pull requests only when I say so**, one open at a time, one branch per thread of work, every branch from main.
  Never stack PRs: a merged badge can lie.
- **Read the region before editing it**, and when renaming or removing visible copy, search the tests and scripts
  for the old words in the same edit.
- **A probe prints its items, not just a count**, and a negative result gets a positive control. Aggregates
  reported without looking at what is behind them have been wrong four times in a day.

## My machine

- A 16 GB Mac that freezes under stacked load: one dev server, one browser job at a time, no full test suites
  locally (they run once, on CI), and stop servers when done.
- My browser shows classic always-on scrollbars, so scrollbar width is real for me even when your measurements say
  0px.
- Brave is the only Chromium installed; a hand-written Puppeteer harness needs its executable path.

## Design defaults (a project's DESIGN.md can override them)

- **Read what exists before building**, and reuse the product's own patterns before reaching for outside references.
  A new pattern is fine when it would pay off elsewhere too.
- **Never a modal on a modal.** An act started inside a dialog becomes a face of that dialog, with Back.
- **Long choices are a select with the picked option's detail under it**, not seven choice cards.
- **New charts and illustrations need references first.** Options generated from your own defaults read as slop.
- **Rich text runs on a library** (Tiptap), never a hand-rolled contentEditable.
- **Look at what the change produced**: most of my corrections are second-order effects in the region beside the
  one you meant to change.
