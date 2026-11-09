---
name: direction
description: Finds outside ideas for a page (wide for a new product, blended for an existing one), lets the designer pick the ones that pull before anything is built, builds directions from them behind switches on the real page, has the art-direction critic judge each, and records the choice. Use when a page or section is called basic, plain, generic, flat or unrefined, before a marketing or reading page is shown as finished, or when asked for directions, options, a bolder take or an art direction pass.
---

# Direction

The review loop catches slips; it cannot say a page is plain. This is the loop that can. Its order matters, and it
comes from one day on the Omelette site (2026-11-09): with directions drawn only from the critic and the site's own
pages, three rounds came back "very simple and questionable", "nothing really worth checking", and then a set the
critic itself dropped once built (it judges far better than it invents). The designer's diagnosis: the harness was not
looking outside. So ideas come from outside first, the designer picks before anything is built, and the critic filters.

## 1. Name the mode

Ask nothing the project already answers.

- **Wide**: something new from scratch: no DESIGN.md yet, or the designer says the page is new. Go super wide:
  candidates that could be radically different from each other, in structure, type, colour and motion. The kickoff's
  mood-board round is this mode.
- **Blend**: something that exists (a DESIGN.md and live surfaces). Outside ideas are welcome, and each one has to
  blend in with what is already in place: take one structural move from it and say it in the project's own type,
  colour, imagery and motion. A candidate whose idea only works in another brand's language is dropped, not toned down.

The designer's words for the two, 2026-11-09: "if we are building something new from scratch, it is good to go super
wide and explore different options that could be radically different", and "where there is something existing so the
new ideas need to blend in nicely with whats already in place".

## 2. Diagnose, briefly

Build the packet for the page as it stands (step 6 shows the command) and ask the critic the first question only: what
the page's category does by default, which of the five ways it goes plain, and its moment. That names what to look for
outside. Its own directions are a starting point, not the menu.

## 3. Search outside

Always, in both modes, by **pattern class**, not feature ("a studio's process told as evidence", not "method page"):

- the sites the designer names and the ones in `design/references/`, opened in the browser;
- the designer's own bookmarks or competitors, when they share them (most will be the category's average: say so);
- Mobbin (`search_sections`, `search_screens`) and inspo (`recommend`, `find_examples_for_macrostructure`,
  `search_screens`) when connected. Briefs leave the machine: describe the pattern, never a client or anything under NDA.

Keep 6 to 12. For each: the link, the **one structural move** it makes, and, in blend mode, **one line on how it would
read in this project** (its type, its colour, its own patterns). Write down what you looked at and left, and why.

## 4. Let the designer pick, before building

Show the candidates as links with their one-line move and translation. A link is the live page; no mock-ups yet. Ask
which pull, which repel, and why. Record the round in `design/picks.md` and the picks in `design/references/` (the
`references` skill, step 4), in their words. This is the cheapest moment to be wrong; a built direction costs an
hour and a critique.

If the designer would rather react to built options than to links, say what that costs and build from your own top
picks, naming each one's source.

## 5. Build the directions behind switches

Two or three directions, each from one picked move, each a different kind of answer. Build them on the real page,
not as mock-ups: a small panel that turns each on, kept in the browser so it holds across pages, and nothing of it on
the main branch or in a deploy (render it only when an environment flag is set). Each direction also opens by link,
`?dir=<id>`, so the designer gets one live URL per direction and the packet can capture each one. Label invented copy
in the panel, and name each direction's source there.

Check every direction at desktop and phone width with the break, layout and accessibility checks, passing each
`?dir=` route, before anyone judges it.

## 6. Ask the critic, about each direction

From the project root, with the dev server serving this checkout:

```
node <harness>/bin/direction-packet.mjs --packet=<folder> /<route>?dir=<id> [...] --said="<the designer's words>"
```

One packet can hold every direction: each `?dir=` route gets its own pictures. Run the `design-harness:art-direction`
agent with `packet: <folder>` (and the hook's `fingerprint:` when it asked), and tell it the mode and which source
each direction came from.

**Its verdict is shown first**, in its words, with what it would change, including "not ready to show". Drop what it
drops. When you fix what it named, its verdict was on the earlier version: say so to the designer, or run it again.
Never present work as finished on the strength of clean checks.

## 7. Record the choice

When the designer picks, add the round to `design/picks.md` (the learn skill's pick entry): what was shown, what
was picked, what was left, in their words. Then build the pick properly on a branch, like any change: it goes
through the review loop.
