# Design harness

Omelette's starting point for every new product. The look is new for every client; the method is the same
everywhere: a design decision written down once is enforced on every change after it, and nothing reaches the
designer before a reviewer has compared it with what already exists.

## What it does

- **Review before show.** When a Claude Code turn changes anything rendered, a Stop hook holds the turn until a
  fresh-context reviewer has read that exact change. The reviewer compares each surface with its closest sibling,
  checks the project's settled rules and an AI-look register, measures copy length against the project's approved
  copy, checks token drift and accessibility, and reports. The session fixes what it agrees with and says what it
  left. Later reviews read only what changed since the last one.
- **Kickoff from a mood board.** `/design-harness:kickoff` turns a mood board and a brief into `PRODUCT.md`,
  `DESIGN.md` (Google's format: tokens plus rationale, lint-checked for contrast), generated theme tokens, brand
  folders, a style tile and a sample screen, and switches the review loop on for the project.
- **Rules that grow from corrections.** `/design-harness:learn` turns each correction into a row in the project's
  `docs/ui-consistency.md`, so the same slip is caught automatically next time.
- **The best public design skills**, pinned to a commit that was read and checked: Anthropic's frontend-design,
  Impeccable, Google Chrome's modern-web-guidance and Emil Kowalski's design-engineering skills.

How well the reviewer works, measured blind against a designer's real corrections, is in
[docs/benchmark.md](docs/benchmark.md): 11 of 18 corrections caught, 11 findings a review, 89 seconds median, ahead
of every public reviewer tested.

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
  design/brand/             logo, wordmark, fonts
  design/artwork/           illustration, photography, the mood board
  design/references/        pattern references, named for what they show
  docs/ui-consistency.md    the rules sibling surfaces must share; grows from corrections
  src/styles/theme.css      generated from DESIGN.md; the only place raw values live
  .claude/design-harness.json   which files render, the theme files, the dev server, copy limits
  .claude/settings.json     the marketplace and the enabled plugins
```

## This repository

```
.claude-plugin/marketplace.json     the "omelette" marketplace: design-harness plus the pinned external plugins
plugins/design-harness/
  hooks/                            review-before-show (Stop + UserPromptSubmit)
  agents/ui-review.md               the reviewer (Sonnet: fastest and most accurate in the benchmark)
  skills/kickoff/                   mood board to a project that knows its identity, with templates
  skills/design-pass/               the loop for building any surface
  skills/learn/                     a correction becomes a rule
  skills/web-design-guidelines/     Vercel's wider review, for PR time
  reference/ai-look.md              the devices that read as generated
  bin/                              check-copy-length, check-drift, check-a11y (run from a project root)
dotfiles/CLAUDE.md                  Gonzalo's working rules for every project; install.sh links it
docs/benchmark.md                   method and results
```

## Updating

Pins are deliberate: an external skill changes only when its `sha` here is moved, after reading what changed.
Move a pin, bump `version` for design-harness when it changes, and re-run the benchmark when the reviewer, its
rules or its model change.
