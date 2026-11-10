---
name: direction
description: Gives a page new directions the designer chooses between by looking. Shows outside candidates from the best of the designer's own field one at a time for a yes or no, has three fresh agents each build a whole-page direction from the yeses (one of them a control with no context), puts them behind switches, and lets the designer pick blind. Use when a page or section is called basic, plain, generic, flat or unrefined, or when asked for directions, options, a bolder take or an art direction pass.
---

# Direction

Three steps. Its shape comes from one day on the Omelette site (2026-11-09), where the old seven-step version failed in
front of the designer and a five-minute control beat it:

- Directions the critic invented were turned down every round ("very simple and questionable", "nothing really worth
  checking").
- Searching by pattern class sent the search to the category's average (SaaS pricing pages): "your sources are mostly
  non-creative companies".
- Rules written from the live site (DESIGN.md, the picks summary, "one move per direction", "the smallest move") kept
  every build small: the harness's two directions changed only the top of the page.
- One fresh agent given only the brief and the code rebuilt the whole page and was the boldest of the three.

So: outside ideas from the designer's own field, chosen by them one at a time; whole-page directions built by fresh
agents who carry no rules; a blind pick; and a control in every round, which keeps the harness honest.

## 1. Candidates, one at a time

Search where the designer's peers at the top of their field are: for a studio, award-level creative studios and the
designer's named references; for a product, the best products in its space. Mobbin (`search_sections`,
`search_screens`) and inspo (`search_screens` with the matching `industry`) when connected, and the sites themselves
in the browser. Never the category's average for the page type (tier-card pricing pages, capability lists): name
what you left and why.

Keep 6 to 10. For each: the live link (or the Mobbin link when the live page has changed, saying so), the one move it
makes, and one line on how it would look here, in the brand's own assets. Show them **one at a time, yes or no**, with
an optional reason (an interactive card stack when the host can render one; the designer asked for exactly this). Record
the round in `design/picks.md` in the designer's words only: what was shown, what got a yes, what got a no.

If the designer says the whole set is wrong, ask nothing: record their words and search again with that correction.

## 2. Three whole-page directions, by fresh agents

For the yeses, start three agents in parallel, each building one direction of the **whole page** (not a section) into
its own file behind the switch panel, `?dir=<id>`:

- **Two from the yeses**, one per agent, each with: the designer's brief in their words, the yes candidates with their
  links and the one move each makes, the page's file, and the brand's own assets (wordmark, type family, drawn marks,
  voice, facts). Tell them the site's layout, rhythm, scale and colour rules are open, and that a direction keeps the
  brand's assets, not its current page.
- **One control**: the brief and the code only. No candidates, no references, no picks, no DESIGN.md, no skills.

Each agent writes only its own direction file (a component the page renders when its `?dir=` is on, scoped CSS
inside it), never the page's shared files, so the three never collide. Name the switches 1, 2, 3 in a shuffled order
and keep the mapping in the session's notes, not in the panel or the page. Nothing of the panel renders without the
environment flag, so none of it can reach a deploy.

When the three are built, run the browser checks on every `?dir=` route (`check-breaks.mjs`, `check-layout.mjs`,
`check-a11y.mjs`) and fix what is broken (overflow, contrast, a line that strands a word) in **every** direction
alike, the control included: a broken control proves nothing. Do not make any of them safer.

The project's `previews` setting should list the direction files, so drift and the rules file leave them alone.

## 3. The blind pick

Give the designer the three links and the Live page, labelled 1, 2, 3, and ask which they would pick and why. Say
nothing about which came from where until they have picked.

When they ask for a second opinion, or before showing when the session doubts all three, run
`node <harness>/bin/direction-packet.mjs --packet=<folder> /<route>?dir=<id> [...]` and the
`design-harness:art-direction` agent on it, told that the origins are withheld. It ranks; it does not pass or fail.
Show its ranking after the designer's pick, not before, so it cannot steer a blind test.

Then reveal the mapping, and record the round in `design/picks.md`: what was shown, what was picked, what was left, in
their words, and **whether the control won**. If the control wins two rounds running, say so to the designer: the
harness is adding cost, not taste, and this skill should be cut further.

When a pick is built for real, it updates DESIGN.md in the same change (the rules follow the picks, not the reverse),
and it goes through the review loop like any change.
