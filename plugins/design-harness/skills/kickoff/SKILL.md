---
name: kickoff
description: Starts a new product's design, with or without a mood board. When there is none, builds one with the person in Claude Code (references, a mood board page they react to, rounds of narrowing). Then writes PRODUCT.md and DESIGN.md (Google's format, tokens plus rationale), generates the theme tokens, builds a style tile and one sample screen, sets up the brand folders, and switches on the review-before-show loop. Use at the start of a new project, when the person shares a brief, references or a mood board, when they want to explore a look, or asks to set up the design harness here. Rerun any step later to evolve the identity.
---

# Kickoff

Turn a mood board and a brief into a project that knows its own identity and reviews its own work. The point is
that the look is new for every client while the method is the same: a decision written down once is enforced on
every change after it.

Work in this order. Each step writes a file the next one reads, and skipping one is how a project ends up with a
theme nobody can explain.

## 1. Gather

Ask for what is missing, in one message, conversationally:

- **The brief.** What the product is, who uses it, where and under what light (this decides light or dark, not the
  category), and what it must never feel like. A few sentences is enough to start.
- **The surfaces.** For each, its mode: *Operate* (a working screen: dense, scannable, standard controls), *Persuade*
  (a marketing page: one idea, one signature move), *Read* (long-form). A product usually has more than one.
- **A mood board, if there is one.** Images in a folder, links, a Figma file, a Mobbin collection. Read every image.
  If there is none, that is the normal case: build it together in step 1b.

Then pull references by **pattern class**, not feature ("resource calendar with staff as rows", not "scheduling
page") from Mobbin when it is connected, and note what each reference does structurally.

## 1a. Bring in what already exists

Design often starts somewhere else. Whatever the person brings becomes the first draft of DESIGN.md, and the steps
after this one refine it rather than start over:

- **A Claude Design artifact** (a claude.ai design, deck or design-system link): read it with the Artifact tool's
  `read` action. A design-system artifact maps almost one to one onto DESIGN.md's tokens; a design gives screens to
  measure (colours, type sizes, radii, spacing) and a direction to name.
- **Figma**: with the Figma connector, read the file's variables (`get_variable_defs`) for tokens and the key frames
  (`get_design_context`, `get_screenshot`) for composition. Prefer the variables to measuring frames.
- **A live site or an existing product**: screenshot its main screens and read the computed colours, families and
  sizes from the page, then name what is worth keeping and what the brief wants to leave behind.
- **A brand guide or PDF**: read it and carry its logo, colours and type rules into `design/brand/` and DESIGN.md,
  quoting its own wording for any rule.

Save what was brought into `design/references/imported/` (or a link to it in `design/README.md`) and say in DESIGN.md's
Overview where each value came from. A value measured from a screenshot is approximate; mark it so.

## 1b. Build the mood board together, when there is none

The mood board is a conversation, not an input. Make it in rounds, and let the person react rather than describe:

1. **Three words and one refusal.** Ask for three words the product should feel like and one thing it must never
   feel like. Ask who the users already trust (apps, brands, places, objects in their world).
2. **Gather wide.** Collect 12 to 20 references across three kinds: product screens of the same pattern class
   (Mobbin), the visual world of the subject itself (its materials, places, print, signage, tools), and type and
   colour in the wild. Save each image to `design/moodboard/` with a one-line note on what to take from it, not just
   what it is. When Mobbin is connected, save the screens to a Mobbin collection named for the project, so the
   person can browse and add to it there too.
3. **Show it as a page.** Write `design/moodboard/index.html`: the images in a grid grouped by kind, each with its
   note, and two or three candidate directions underneath (a name, a palette of 4 to 6 swatches, a type pairing, the
   signature move in one line). Open it for the person as a live URL.
4. **Narrow.** Ask which images and which direction pull and which repel, and why. Drop what repels, add more of what
   pulls, and redraw the directions. Two or three rounds is usual; stop when the person picks a direction.
5. **Record why.** Keep `design/moodboard/README.md`: each round's picks and rejections in the person's own words.
   Those words are the source the Overview in DESIGN.md quotes, and the record that stops the direction being
   relitigated later.

Nothing else waits on this. The project can be created, the harness switched on (step 8) and real screens started
before the identity is settled: the review loop works from the rules and siblings, and DESIGN.md is filled as the
direction firms up.

## 2. Answer the forcing questions before any value is chosen

Write the answers down; they go into PRODUCT.md.

1. What is the metaphor: what *object* is this product, if not "pages with cards"?
2. Where does the eye go first on the main screen, and is that right?
3. What moves, and what does the movement mean?
4. What is the one moment of delight? One.
5. What would make it feel expensive? Usually space, restraint and one confident thing.

## 3. Write PRODUCT.md

From `${CLAUDE_SKILL_DIR}/templates/PRODUCT.md`: audience, use scene, surfaces and their modes, voice (with
three example strings in it and three it would never say), the forcing answers, and what is out of scope.

## 4. Write DESIGN.md, in two passes

Use Google's DESIGN.md format (`${CLAUDE_SKILL_DIR}/templates/DESIGN.md`): tokens in YAML front matter, rationale in prose, sections in
the spec's order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts),
then this harness's extra sections (Iconography, Imagery, Motion, Chosen on purpose, Signature move).

**First pass, a plan:** palette as 4 to 6 named values, type families and roles, a type scale far apart, a radius
tier per object size, spacing scale, the layout concept, and the one signature move. Derive them from the mood
board and the use scene, not from habit.

**Second pass, against the defaults.** Read `${CLAUDE_PLUGIN_ROOT}/reference/ai-look.md`, which distils
the generated looks the external skills list, and the frontend-design skill's own list when that plugin is installed. For every choice that is a default rather than a decision for this
brief (cream and terracotta, the SaaS card kit, an eyebrow above every heading, a near-black ground with one neon
accent), revise it and say what changed and why. Anything from that list the brief genuinely calls for goes under
**Chosen on purpose**, so the reviewer does not flag it later.

Then lint it, which checks token references, tokens nothing uses, and WCAG contrast:

```bash
npx -y @google/design.md@0.4.0 lint --format=text DESIGN.md
```

It exits 0 even with warnings, and a failing contrast pair is a warning, so read the summary rather than the exit
code. Fix every error and every warning before going on; a warning left in place is either fixed or explained in
DESIGN.md. The version is pinned, like everything else here, so a new release cannot change what passes; move it
on purpose. The first run downloads it and asks the person once (auto mode refuses unasked downloads); from step 8
on, the project's settings allow this exact command.

## 5. Generate the tokens

For Tailwind v4: `npx -y @google/design.md@0.4.0 export --format css-tailwind DESIGN.md > src/styles/theme.css` (or where the
project's CSS lives), imported once from the global stylesheet. For Tailwind v3, `--format json-tailwind`. Otherwise
`--format dtcg` for a token pipeline. This file is the only place raw values may live; the drift check exempts it.

## 6. Make the brand folders

```
design/
  moodboard/  the mood board: images with notes, index.html, and README.md recording each round's picks
  brand/      logo files, wordmark, favicon source, the brand's own fonts if self-hosted
  artwork/    illustrations and photography the product uses
  references/ screenshots of the pattern references from step 1, named for the pattern they show
```

Write `design/README.md` saying what each holds and which DESIGN.md section governs it.

## 7. Prove the identity on a page

Build a **style tile** route (or `design/style-tile.html` when there is no app yet): every colour token with its
contrast pair, the type scale with real copy from PRODUCT.md's voice, buttons in every state, an input, a card, an
empty state, a toast. Then build **one sample screen**: the product's main screen in its mode, with realistic data.
Before the first screenshot, check the project has a browser library; for a JavaScript project with neither
Playwright nor Puppeteer, ask before adding one: `npm i -D playwright @axe-core/playwright && npx playwright install
chromium`. Then screenshot both at desktop and phone width, in each colour mode the product has (`node
<harness>/bin/shoot.mjs design/style-tile.html` opens a file inside the project when there is no app yet), and look
before showing. These two pages are what
the person approves; the tokens are not approved until they have seen them used.

## 8. Switch on the harness for this project

Claude Code protects the `.claude/` folder, so writing the three files there asks the person once; that is expected,
and a headless run cannot write them at all (the 2026-10-31 dry run stopped exactly there). Say what the three files
do when asking.

From `${CLAUDE_SKILL_DIR}/templates/`, and from the settings written out below:

- `design-harness.json` to `.claude/design-harness.json`. It holds only what differs per project: `devServer`, and
  `modes`, the colour modes the product ships. The template starts with `light` alone: add `dark` once DESIGN.md
  defines the dark twin of every colour token, so nothing is screenshotted or checked in a mode it has no palette
  for. Everything else comes from the harness's defaults (`${CLAUDE_PLUGIN_ROOT}/bin/lib.mjs`), which already cover
  every common UI file type (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.html` and the stylesheets) and the usual
  theme files, step 5's `theme.css` among them. Add `ui` or `themeFiles` only when this stack keeps its UI or its
  theme somewhere the defaults miss, and then list the whole set: a key here replaces the default, it does not add to
  it. `allowPalette` stays `false` unless the project's tokens are Tailwind's own palette. Screenshots stay off: the
  accessibility and line-break checks run whenever the dev server is up, but screenshots in every review cost
  minutes and, measured, caught nothing more; add `"screenshots": true` for a project where layout is the work.
  Commit the file: the harness reads its settings from the last commit, so a change cannot loosen them on the way
  through.
- A project tool that takes screenshots as a signed-in persona, or a browser outside the usual places, goes in
  `.claude/design-harness.local.json` as `screenshot` (a command, `{route}` where the path goes) or `browserPath`, and
  that file goes in `.gitignore`. The harness reads these two only from that file and only while git does not track
  it, so a repository someone clones can never hand the session a command to run.
- `.claude/settings.json`, committed: merge in this one rule and nothing else, so it is safe for anyone who clones
  the repo.

  ```json
  { "permissions": { "allow": ["Bash(npx -y @google/design.md@0.4.0 *)"] } }
  ```

- `.claude/settings.local.json`, with `.claude/settings.local.json` added to `.gitignore` in the same step: merge in
  the marketplace and the plugins, enabled on this machine only. The marketplace is private, so in the committed
  settings it would ask a client's developers to install something they cannot reach. Write `ref` as `v` and the
  `version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`: the release running this kickoff. A later change
  to the harness then cannot change this project's behaviour until the tag is moved on purpose.

  ```json
  {
    "extraKnownMarketplaces": {
      "omelette": { "source": { "source": "github", "repo": "gonzalotheomelette/design-harness", "ref": "v<version>" } }
    },
    "enabledPlugins": {
      "design-harness@omelette": true,
      "frontend-design@omelette": true,
      "modern-web-guidance@omelette": true,
      "emil-design-engineering@omelette": true
    }
  }
  ```

- `ui-consistency.md` to `docs/ui-consistency.md`. It starts empty on purpose: it fills with the person's
  corrections through `/design-harness:learn`, which adds each heading the first time a rule needs one.
- `requirement.md` as the pattern for `docs/product/<surface>.md`. Product work happens here, in tandem with design:
  write a surface's requirement before building it. The decision log and the open questions belong to the feedback
  skill, which creates each the first time a decision or a client question is recorded, so a new project does not
  open on empty paperwork.
- `AGENTS.md` to the project root (what any coding agent must know), and `CLAUDE.md` beside it, which imports it and
  stays under 200 lines. When the project already has either file, merge rather than replace: keep what is there,
  add the harness's sections, and put the `@AGENTS.md` import at the top of an existing CLAUDE.md. Claude Code reads
  AGENTS.md on its own only when there is no CLAUDE.md, so the import is what keeps one shared file.

The copy and drift checks need nothing installed: they parse with the TypeScript that ships with the harness. If the
person has not installed the external plugins yet (the README installs them before the kickoff), tell them each needs
one install per machine: `claude plugin install <name>@omelette --scope local` for each plugin the local settings list.

## 9. Show

Present the style tile and the sample screen as live URLs, not a batch of screenshots, with: what the mood board
contributed, what the second pass changed and why, what is under Chosen on purpose, and what you are unsure of. A
named uncertainty is worth more than a confident first draft.

## Evolving the identity later

Kickoff is not a gate the project passes once. Any step can be rerun when the direction moves: a new round of the
mood board, a palette that is not working on real screens, a client's brand refresh. When DESIGN.md changes:

1. Keep a copy of the old file first (`git show HEAD:DESIGN.md > /tmp/DESIGN.before.md`), edit, then show the person
   what moved: `npx -y @google/design.md@0.4.0 diff /tmp/DESIGN.before.md DESIGN.md` lists every token added, removed or
   changed, and whether contrast got worse.
2. Lint again, regenerate the theme file (step 5), and reshoot the style tile and the sample screen (step 7), so the
   change is approved on screens, not on values.
3. Run the drift check over the whole project (`node <harness>/bin/check-drift.mjs --base=<first commit>`) to find
   any raw value that was standing in for the old token.
4. Record why in `design/moodboard/README.md` or DESIGN.md's Overview, with the date and the person's words.

The rules in `docs/ui-consistency.md` are untouched by a change of look: they are about how sibling surfaces
behave and read, which is why they survive a rebrand.
