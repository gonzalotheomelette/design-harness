---
name: kickoff
description: Starts a new product's design from a mood board and a brief. Writes PRODUCT.md and DESIGN.md (Google's format, tokens plus rationale), generates the theme tokens, builds a style tile and one sample screen, sets up the brand folders, and switches on the review-before-show loop for the project. Use at the start of a new project, when the person shares a mood board, references or a brief, or asks to set up the design harness here.
---

# Kickoff

Turn a mood board and a brief into a project that knows its own identity and reviews its own work. The point is
that the look is new for every client while the method is the same: a decision written down once is enforced on
every change after it.

Work in this order. Each step writes a file the next one reads, and skipping one is how a project ends up with a
theme nobody can explain.

## 1. Gather

Ask for what is missing, in one message, conversationally:

- **The mood board.** Images in a folder, links, a Figma file, a Mobbin collection. Read every image.
- **The brief.** What the product is, who uses it, where and under what light (this decides light or dark, not the
  category), and what it must never feel like.
- **The surfaces.** For each, its mode: *Operate* (a working screen: dense, scannable, standard controls), *Persuade*
  (a marketing page: one idea, one signature move), *Read* (long-form). A product usually has more than one.

Then pull references by **pattern class**, not feature ("resource calendar with staff as rows", not "scheduling
page") from Mobbin when it is connected, and note what each reference does structurally.

## 2. Answer the forcing questions before any value is chosen

Write the answers down; they go into PRODUCT.md.

1. What is the metaphor: what *object* is this product, if not "pages with cards"?
2. Where does the eye go first on the main screen, and is that right?
3. What moves, and what does the movement mean?
4. What is the one moment of delight? One.
5. What would make it feel expensive? Usually space, restraint and one confident thing.

## 3. Write PRODUCT.md

From `templates/PRODUCT.md` in this skill's folder: audience, use scene, surfaces and their modes, voice (with
three example strings in it and three it would never say), the forcing answers, and what is out of scope.

## 4. Write DESIGN.md, in two passes

Use Google's DESIGN.md format (`templates/DESIGN.md`): tokens in YAML front matter, rationale in prose, sections in
the spec's order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts),
then this harness's extra sections (Iconography, Imagery, Motion, Chosen on purpose, Signature move).

**First pass, a plan:** palette as 4 to 6 named values, type families and roles, a type scale far apart, a radius
tier per object size, spacing scale, the layout concept, and the one signature move. Derive them from the mood
board and the use scene, not from habit.

**Second pass, against the defaults.** Read `../../reference/ai-look.md` (from this skill's folder) and the
frontend-design skill's list of generated looks. For every choice that is a default rather than a decision for this
brief (cream and terracotta, the SaaS card kit, an eyebrow above every heading, a near-black ground with one neon
accent), revise it and say what changed and why. Anything from that list the brief genuinely calls for goes under
**Chosen on purpose**, so the reviewer does not flag it later.

Then lint it, which checks token references and WCAG contrast:

```bash
npx @google/design.md lint DESIGN.md
```

Fix every error and every contrast warning before going on.

## 5. Generate the tokens

For Tailwind v4: `npx @google/design.md export --format css-tailwind DESIGN.md > src/styles/theme.css` (or where the
project's CSS lives), imported once from the global stylesheet. For Tailwind v3, `--format json-tailwind`. Otherwise
`--format dtcg` for a token pipeline. This file is the only place raw values may live; the drift check exempts it.

## 6. Make the brand folders

```
design/
  brand/      logo files, wordmark, favicon source, the brand's own fonts if self-hosted
  artwork/    illustrations, photography, the mood board images themselves (moodboard/)
  references/ screenshots of the references from step 1, named for the pattern they show
```

Write `design/README.md` saying what each holds and which DESIGN.md section governs it.

## 7. Prove the identity on a page

Build a **style tile** route (or `design/style-tile.html` when there is no app yet): every colour token with its
contrast pair, the type scale with real copy from PRODUCT.md's voice, buttons in every state, an input, a card, an
empty state, a toast. Then build **one sample screen**: the product's main screen in its mode, with realistic data.
Screenshot both at desktop and phone width, in light and dark, and look before showing. These two pages are what
the person approves; the tokens are not approved until they have seen them used.

## 8. Switch on the harness for this project

Copy from `templates/`:

- `design-harness.json` to `.claude/design-harness.json`, with `ui`, `themeFiles` and `devServer` set for this stack.
- `settings.json` merged into `.claude/settings.json` (registers the omelette marketplace and enables the plugins,
  so every session in this project, and every teammate, gets the same harness).
- `ui-consistency.md` to `docs/ui-consistency.md`. It starts nearly empty on purpose: it fills with the person's
  corrections through `/design-harness:learn`.
- `AGENTS.md` to the project root (what any coding agent must know), and `CLAUDE.md` beside it, which imports it and
  stays under 200 lines.

For a JavaScript project, ask before adding the dev dependencies the checks use:
`npm i -D typescript playwright @axe-core/playwright && npx playwright install chromium`.

Tell the person that external plugins enabled in project settings need one install each, once per machine:
`claude plugin install <name>@omelette --scope project` for each plugin the settings list.

## 9. Show

Present the style tile and the sample screen as live URLs, not a batch of screenshots, with: what the mood board
contributed, what the second pass changed and why, what is under Chosen on purpose, and what you are unsure of. A
named uncertainty is worth more than a confident first draft.
