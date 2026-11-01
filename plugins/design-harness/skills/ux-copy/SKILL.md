---
name: ux-copy
description: Writes or reviews interface copy (buttons, titles, helper text, empty states, errors, toasts, confirmations, onboarding) in the project's voice, short, and matched to the copy its sibling surfaces already use. Use when writing any string a person will read in the product, naming a button, wording a dialog, filling an empty state, or when copy is called wordy, long, vague or inconsistent. Reviews come back as a Where / Now / Proposed table.
---

# UX copy

The commonest correction a designer makes is copy: a sentence explaining the interface, a label longer than every
other label, the same act called two names on two screens. Each one passes a spell check and fails the person
reading it. This skill writes copy that does not need the correction.

Work in this order.

## 1. Read before writing

- **The voice.** `PRODUCT.md`'s voice section: its three example strings and the three it would never say.
- **The sibling.** The same element on the nearest surface that already exists: the other Remove button, the other
  toasts, the other empty states. Grep for it. Its verb, its noun, its length and its sentence shape are the
  default, and a difference needs a reason.
- **The settled rules.** `docs/ui-consistency.md` rows for the element, and the decision log for terms already
  chosen.
- **The limits.** `copyLimits` in `.claude/design-harness.json`, or the copy-length check's defaults: about 4 words
  for a button, 6 for a title, 7 for a toast, 16 for helper text, 22 for a description.

## 2. The rules

1. **Say each idea once.** If the heading says it, the text under it adds something new or goes.
2. **Never explain the interface.** No sentence about what the screen is for, how the system works or why it is
   designed this way. Clarity comes from the label and the layout.
3. **Name the act.** A button is a verb and an object ("Save changes", "Remove driver"), the same verb the sibling
   uses for the same act. Never Submit, OK, Yes, Continue or Learn more.
4. **The product's own words.** The terms the product already uses, in the decision log's spelling. None of:
   unlock, seamless, effortless, streamline, empower, robust, elevate, supercharge.
5. **Numbers that agree.** A count or amount that appears twice is the same both times.
6. **The project's punctuation.** Whatever `PRODUCT.md` and the rules file say; when silent, no em dashes and no
   exclamation marks.

## 3. Patterns

| Element | Write | Not |
|---|---|---|
| Button | Verb and object, the sibling's verb | "Submit", "Click here to continue" |
| Empty state | The state in a few words, and the one action ("No drivers yet." + Add driver) | Why it is empty and what the feature is for |
| Error | What failed and how to recover; why only when it changes what the person does next | "Something went wrong", or a paragraph of cause |
| Destructive confirmation | The object and the consequence, on the message and on the button ("Delete 3 files?", Delete files / Keep) | "Are you sure?", OK / Cancel |
| Toast | What happened, past tense, under the toast limit; Undo when recovery is safe | What happened plus what it means |
| Helper text | Only an answer to a question the reader would have | A restatement of the label |
| Placeholder | An example of the value, or nothing | Instructions, which vanish as the person types |
| Loading | What is happening, when it takes long enough to need words | A promise about speed |

## 4. When reviewing copy

Return every proposed change in a table, one row per string, so it can be judged side by side:

| Where | Now | Proposed |
|---|---|---|

`Where` is the file and line, or the screen and element. `Proposed` is the string as it should read, not a
description of it. Leave a string out when its only fault is taste the project has not decided; list it under a
short "Open questions" line instead.
