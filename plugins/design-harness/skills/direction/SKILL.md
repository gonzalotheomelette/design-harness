---
name: direction
description: Asks the art-direction critic whether a page has a point of view, then puts its directions on the page behind switches so the designer chooses by looking, and records the choice. Use when a page or section is called basic, plain, generic, flat or unrefined, before a marketing or reading page is shown as finished, or when asked for directions, options, a bolder take or an art direction pass.
---

# Direction

The review loop catches slips; it cannot say a page is plain. This is the loop that can: compare the page with
references the designer picked, ask a critic for directions, build them behind switches, let the designer choose
on the page, and keep the choice so the next critique starts from it.

## 1. Make sure there is something to compare with

The critic judges against `design/references/`. When it holds nothing for this surface's pattern, **stop here**: ask
the designer for three to five sites whose taste they trust and run the `references` skill on them. Do not build
directions without them. A critique can run (the review-before-show hook asks for one after any change to a page that
persuades or is read), but directions generated with no reference come from the model's own defaults, which is the
look this exists to get away from: on 2026-11-09 two rounds of directions built that way were called "very simple and
questionable".

## 2. Prepare the packet

From the project root, with the dev server serving this checkout:

```
node <harness>/bin/direction-packet.mjs --packet=<folder> /<route> [...] --said="<the designer's words about it>"
```

It takes the pictures a screen at a time at desktop and phone width and writes `README.md` with every picture by its
full path, each page's mode read from PRODUCT.md's table, the references with what each teaches, and the paths of
DESIGN.md, PRODUCT.md, `design/picks.md` and `docs/ui-consistency.md`. Never hand the critic a bare folder: three blind
runs on 2026-11-09 had to guess file names, one never found the pictures, and a hand-written README called a Read
page Persuade. When the hook asked for the critique, use the folder it named.

## 3. Ask the critic

Run the `design-harness:art-direction` agent in the foreground with `packet: <folder>` (and the hook's `fingerprint:`
when it asked). It reads, it does not edit, and it answers with the five ways a page goes plain, the page's moment,
the one difference beside the closest reference, two or three directions, and a verdict.

**Its verdict is shown first.** When the critic says "not ready to show", the designer hears that before anything
else, in its words, with what it would change. Never present work as finished on the strength of clean checks: the
checks say a page is not broken, never that it is good.

## 4. Put the directions on the page

Show the critique in a few lines, then build the directions behind switches on the real page, not as mock-ups: a
small panel that turns each on and off, kept in the browser so it holds across pages, and nothing of it on the main
branch. Emil's `prototype` skill builds variants behind a picker when it is installed; otherwise a class on
`<html>` per direction, with the direction's markup shown or hidden by it, is enough. Label invented copy in the
panel. Check every direction at desktop and phone width with the layout and break checks before handing it over.
Show it as a live URL.

## 5. Record the choice

When the designer picks, add the round to `design/picks.md` (the learn skill's pick entry): what was shown, what
was picked, what was left, in their words. Then build the pick properly on a branch, like any change: it goes
through the review loop.
