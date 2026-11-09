---
name: references
description: Gathers design references for a surface or a pattern, has the designer pick, and keeps the picks in the project with what each teaches, so the art-direction critic and every later build compare against them. Searches Mobbin when it is connected, inspo (real production websites, over MCP) and any site the designer names. Use before designing a new page, section or pattern, when the designer shares a link they like, when a page is called basic or generic and there is nothing to compare it with, or when asked for references, inspiration or examples.
---

# References

A reference library returns mostly average work: searched for a stat row, it hands back the same row the page
already has, and one that stages its numbers as an object. The taste is in which one is kept. So this skill keeps
only what the designer picks, and writes down what each pick teaches, because a picture with no reason attached is
copied for its surface and not its decision.

## 1. Name what is being looked for

By **pattern class**, not feature: "a studio's process told as evidence", "figures staged as objects", "a repo
shown as a living thing", not "method page". Note the surface's mode from PRODUCT.md (Persuade, Read, Operate):
a marketing page is compared with the best pages, a working screen with the best of its category.

Read what the project already has first: `design/references/README.md` and `design/moodboard/`. A pick from last
month may already answer it.

**The project's own best surfaces come first.** A site with an identity is its own strongest reference: the page the
designer is proudest of, the pattern they chose over options, the case page or hero they keep pointing at. Name them
before searching outside, and judge every outside candidate as "could this live beside those". Good design is not the
bar; good design for this brand is. Six mocks of well-made studio and developer-tool pages, all "good designs but not
in line with Omelette's website" (the designer, 2026-11-09), is what this rule comes from.

## 2. Search, in this order

- **A site the designer names.** Open it in the browser, take the screens that matter at desktop and phone width,
  and read its computed type, colour and spacing from the page.
- **Mobbin**, when connected: `search_sections` for website sections, `search_screens` for app screens.
- **inspo** (this plugin's MCP server: 832 real sites, a DESIGN.md for each): `recommend` with a one-paragraph brief
  returns a structure pick, exemplars and the category's measured defaults; `find_components`,
  `find_examples_for_macrostructure` and `compare` narrow from there; `get_design_system` gives a site's real tokens.
  Its note on the category's "gravity" (what most sites in it do) is worth keeping: it is the default a page should
  take a position on.

**Briefs leave the machine.** Mobbin and inspo are outside services. Describe the pattern and the feel, never the
client's name, an unreleased product or anything under NDA.

Look at every image yourself before showing it. Drop the ones that are the category's average, and the ones that
could not live in this project: read DESIGN.md first (its type, colour, density, imagery and motion, and "Chosen on
purpose") and drop a candidate whose idea only works in another brand's language (a dark, technical, maximal or
display-serif page for a calm, warm, restrained identity). Take a reference for one structural idea that survives
translation into this project's own type and colour, and say which idea. Keep 6 to 12 that each do one thing well
in a way this brand could carry, and say what.

## 3. Let the designer pick

Show the candidates as a page or a gallery with their links, each with one line on what it does. Ask which pull
and which repel, and why. Their words are the record.

## 4. Keep the picks

Save each picked image to `design/references/<pattern>/` and add an entry to `design/references/README.md`
(create both the first time):

```markdown
## <pattern>, <date>

### <site or app>: <what the reference is>
Source: <link> · Image: design/references/<pattern>/<file> · Picked because: "<the designer's words>"

- **Trigger**: what the page had to solve at this point.
- **Decision**: what it did, concretely (sizes, type, colour, structure, motion), measured where it could be.
- **Reason**: why that works, in one or two sentences.
- **Evidence**: where in the image it shows.
```

Write what it teaches, not what it looks like: "the figure is the object, set as a split-flap board, so the number
reads as live" teaches; "dark, monospace, nice" does not. Record what the designer turned down too, as one line
under the entry ("Left: GitHub's three-card row, 'every dev tool does this'"); a refusal is as much taste as a pick.

Then add the round to `design/picks.md` (see the learn skill): the candidates shown, the picks, what was left.
