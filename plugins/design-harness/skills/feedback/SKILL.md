---
name: feedback
description: Takes in client feedback and new requirements from wherever they arrive (a Google Doc or Claude Doc with comments, a meeting in Granola, an email, a pasted list), sorts every note into the project's decision log, open questions and per-surface requirements, builds what is buildable with the person's go-ahead, and drafts replies in the person's voice for them to post. Use when the person shares a client doc or notes, says the client left feedback or comments, asks to triage or answer them, or after a client meeting.
---

# Client feedback, in and out

Clients send product requirements and revisions in their own places and their own words. The repo is the source of
truth; their documents are where the conversation happens. This loop moves each note from their place into the
repo, and each answer from the repo back to their place, without losing one or answering one twice.

The records it writes: `docs/decision-log.md`, `docs/open-questions.md`, and `docs/product/<surface>.md`
(paths in `.claude/design-harness.json`). Create them from the kickoff templates if they are missing.

## 1. Read everything, from the source

- **Google Docs**: read the document and every comment thread with the Google Docs connector. Note each comment's
  author, date, the text it is anchored to, and whether it is resolved.
- **Claude Docs**: read with the docs connector, threads included.
- **A meeting**: read the Granola notes, then search the transcript for the specifics the notes compress (numbers,
  names, who decided). Notes summarise; decisions need the exact words.
- **Email or a paste**: take it as given, and ask who said it if that is not clear.

Read the whole source before sorting any of it: a later note often answers or reverses an earlier one.

## 2. Sort every note, in one table

Show the person one row per note before changing anything:

| # | Who, when | Their words | Kind | Where it goes | Proposed action |
|---|---|---|---|---|---|

Kinds:
- **Decision**: they settled something. Goes to the decision log with their words. Check the log first: if it
  reverses an earlier row, say so plainly, because a silent reversal is how a prototype ends up contradicting itself.
- **Requirement**: something a surface must do. Goes into that surface's `docs/product/` file, marked with its source.
- **Revision**: a change to something already built. Becomes a build item, and a decision row if it sets a rule.
- **Question to us**: they asked something. Draft the answer (step 4).
- **Question for them**: their note raises something only they can answer. Goes to open questions.
- **Not ours**: out of scope, or already answered. Say which, with the row that answers it.

Things the person can answer themselves (design and product calls within the brief) are theirs to answer, not the
client's: ask the person in chat, once, as a short list.

## 3. Write it down, then build with consent

Write the rows into the records. Build only what the person agrees to build; anything rendered is their call. Each
built item cites the note it answers in its commit message, so the history shows why it changed.

## 4. Draft the replies, never post them unasked

For every note that needs an answer, draft a reply in the person's own voice: first person singular ("I"), short,
saying what changed and where to see it (a live URL), or the question back. When a reply proposes changed copy or UI,
use a before/after table. Show all drafts together. Post them only when the person says to, and in Google Docs
check that focus is in the right comment box before typing: typing into the wrong place has wiped a document body
before.

## 5. Close the loop

When a question in `open-questions.md` is answered, move the answer into the decision log and mark the question
answered with the date. When the repo's records are mirrored to a client-facing place (a shared doc, a docs repo),
update the mirror after the change merges, not before: a mirror that shows unmerged decisions misleads the client.

End with one line: how many notes, how many decided, built, asked back, and what is still waiting on whom.
