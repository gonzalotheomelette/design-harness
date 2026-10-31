# Design harness

Omelette's starting point for every new product. The look is new for every client; the method is the same
everywhere: a design decision written down once is enforced on every change after it, and nothing reaches the
designer before a reviewer has compared it with what already exists.

## What it does

- **Review before show.** When a Claude Code turn changes anything rendered, a Stop hook holds the turn until a
  fresh-context reviewer has read that exact change. The reviewer compares each surface with its closest sibling,
  checks the project's settled rules and an AI-look register, measures copy length against the project's approved
  copy, checks token drift and accessibility, and reports. The session fixes what it agrees with and says what it
  left. Later reviews read only what changed since the last one. The reviewer's shell is limited to read-only
  git, the harness checks, search and the project's screenshot command, so instructions planted in the code it
  reads cannot get it to run anything else.
- **Kickoff, with or without a mood board.** `/design-harness:kickoff` starts from a brief. It builds the mood board
  with you when there isn't one, or brings in what exists (a Claude Design artifact, a Figma file, a live site, a
  brand guide). It turns that into `PRODUCT.md`,
  `DESIGN.md` (Google's format: tokens plus rationale, lint-checked for contrast), generated theme tokens, brand
  folders, a style tile and a sample screen, and switches the review loop on for the project.
- **Rules that grow from corrections.** `/design-harness:learn` turns each correction into a row in the project's
  `docs/ui-consistency.md`, so the same slip is caught automatically next time.
- **The best public design skills**, pinned to a commit that was read and checked: Anthropic's frontend-design,
  Impeccable, Google Chrome's modern-web-guidance and Emil Kowalski's design-engineering skills.

How well the reviewer works is in [docs/benchmark.md](docs/benchmark.md), with its limits: on 7 cases from one
project, scored blind, it caught 11 of 18 real corrections (Opus caught 10, within noise of each other), against 8 for
Impeccable's method and 4 for OneRedOak's. Treat that as a promising first measure, not a proof: a second project and
repeated runs are still to come.

- **Product work in the same place.** A requirement per surface (`docs/product/`), a decision log and an open
  questions register sit beside the design files. The reviewer checks each surface against its requirement, so a
  listed state that was never designed is caught. Client-facing copies go to Google Docs or Claude Docs for comments, and
  `/design-harness:feedback` brings their comments, meeting notes and revisions back: each note sorted into a
  decision, a requirement, a revision or a question, built with your go-ahead, and answered in your voice once you
  approve the drafts.

## Start a new project

1. Once per machine, add the marketplace and your personal rules:

   ```bash
   claude plugin marketplace add gonzalotheomelette/design-harness
   ```

   ```bash
   ~/dev/design-harness/dotfiles/install.sh
   ```

2. In the new project, install the harness and run the kickoff with the mood board at hand:

   ```bash
   claude plugin install design-harness@omelette --scope project
   ```

   Then, in Claude Code: `/design-harness:kickoff`

3. The kickoff writes `.claude/settings.json`, which enables the other plugins for everyone who opens the project.
   Install each once per machine:

   ```bash
   claude plugin install frontend-design@omelette --scope project
   ```

   ```bash
   claude plugin install impeccable@omelette --scope project
   ```

   ```bash
   claude plugin install modern-web-guidance@omelette --scope project
   ```

   ```bash
   claude plugin install emil-design-engineering@omelette --scope project
   ```

## What a project ends up with

```
your-project/
  AGENTS.md                 what any coding agent must know (Codex and Cursor read it too)
  CLAUDE.md                 imports AGENTS.md, under 200 lines
  PRODUCT.md                audience, use scene, surfaces and their modes, voice
  DESIGN.md                 the identity: tokens + rationale, plus Iconography, Imagery, Motion,
                            Chosen on purpose and the Signature move
  design/moodboard/         the mood board, built with you when there isn't one, and why each round went the way it did
  design/brand/             logo, wordmark, fonts
  design/artwork/           illustration and photography
  design/references/        pattern references, and anything imported (Claude Design, Figma, an existing site)
  docs/product/             one requirement per surface or flow: what it does, its data, its states, its acts
  docs/decision-log.md      every decision, dated, in the words of whoever made it
  docs/open-questions.md    what is waiting on the client
  docs/ui-consistency.md    the rules sibling surfaces must share; grows from corrections
  src/styles/theme.css      generated from DESIGN.md; the only place raw values live
  .claude/design-harness.json   which files render, the theme files, the dev server, copy limits
  .claude/settings.json     the marketplace and the enabled plugins
```

## This repository

```
.claude-plugin/marketplace.json     the "omelette" marketplace: design-harness plus the pinned external plugins
plugins/design-harness/
  hooks/                            review-before-show (Stop + UserPromptSubmit), reviewer-shell (PreToolUse)
  agents/ui-review.md               the reviewer (Sonnet: as accurate as Opus in the benchmark, and faster)
  skills/kickoff/                   mood board to a project that knows its identity, with templates
  skills/design-pass/               the loop for building any surface
  skills/learn/                     a correction becomes a rule
  skills/feedback/                  client notes in (Google Docs, Claude Docs, Granola), sorted, built, answered
  skills/web-design-guidelines/     Vercel's wider review, for PR time
  reference/ai-look.md              the devices that read as generated
  bin/                              check-copy-length, check-drift, check-a11y, shoot, server-of (run from a
                                    project root; they use the project's own Playwright or Puppeteer)
dotfiles/CLAUDE.md                  Gonzalo's working rules for every project; install.sh links it
docs/benchmark.md                   method and results
```

## Updating

Pins are deliberate: an external skill changes only when its `sha` here is moved, after reading what changed, and a
project changes harness version only when the `ref` tag in its `.claude/settings.json` is moved.

To release: run the tests (`node --test tests/harness.test.mjs`), bump `version` in both manifests, update the `ref`
in `skills/kickoff/templates/settings.json`, commit, and tag `vX.Y.Z`. Re-run the benchmark when the reviewer, its
rules or its model change.

## What it does not cover yet

- Windows: the dev-server proof uses `lsof` and the browser search knows macOS and Linux paths.
- Copy length in Vue, Svelte and Astro files: the check names them instead of measuring them.
- Route inference assumes file-based routing (Next.js); other routers need the route named by hand.
- A day-one stack scaffold, CI workflow and preview deploys: the kickoff sets up identity and product files, not
  the app itself.
- State that only exists after an action in the session: screenshots of a fresh page cannot show it, and the
  reviewer says so.
