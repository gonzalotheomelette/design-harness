# Design harness

> **Retired, Nov 9 2026.** Omelette no longer uses this harness. A full day of runs on the Omelette site showed its
> checks working (line breaks, layout, accessibility, copy) and its taste side failing: every direction it produced was
> turned down, and a rebuild that removed its rules drifted into another brand's look. Omelette's design work now runs
> on Anthropic's [frontend-design](https://github.com/anthropics/claude-plugins-official) skill and
> [Impeccable](https://github.com/pbakaus/impeccable), steered by the designer on narrow targets. The code stays here as
> it was at v0.19.0, unmaintained.

Omelette's starting point for every new product. The look is new for every client; the method is the same
everywhere: a design decision written down once is enforced on every change after it, and a turn that changed the
interface does not end until a fresh reviewer has compared that change with what already exists. Fixes the session
makes after the review are read by the next one.

## What it does

- **Review before show.** When a Claude Code turn changes anything rendered, a Stop hook asks for a fresh-context
  review of that exact change before the turn ends, once per message (a session that will not run it is let through
  with a note saying so, so it can never loop). The hook runs the copy-length and drift checks on the change
  and hands the reviewer a packet; when this checkout's dev server is up, the session adds the accessibility and
  line-break checks, and screenshots for projects that switch them on (`"screenshots": true`; off by default, since
  measured they cost minutes a review and caught nothing more). The reviewer compares each surface with its closest sibling, checks the project's settled rules and
  an AI-look register, reads the packet, and reports. It has no shell, so instructions planted in the code it reads
  have nothing to run. The session fixes what it agrees with and says what it left; the checks read those fixes once
  before the turn ends, and the next review reads them in full.
- **Kickoff, with or without a mood board.** `/design-harness:kickoff` starts from a brief. It builds the mood board
  with you when there isn't one, or brings in what exists (a Claude Design artifact, a Figma file, a live site, a
  brand guide). It turns that into `PRODUCT.md`,
  `DESIGN.md` (Google's format: tokens plus rationale, lint-checked for contrast), generated theme tokens, brand
  folders, a style tile and a sample screen, and switches the review loop on for the project.
- **Rules that grow from corrections.** `/design-harness:learn` turns each correction into a row in the project's
  `docs/ui-consistency.md`, so the same slip is caught automatically next time.
- **Taste, from your own references.** Everything above looks backward: it can say a page is inconsistent, broken or
  AI-made, never that it is plain. `/design-harness:references` gathers references from Mobbin, inspo (832 real
  production websites, shipped with the harness as an MCP server) and any site you name, and keeps only the ones you
  pick, each with what it teaches. An art-direction critic judges whether a page has a point of view against those
  references and your past picks (`design/picks.md`), and ends with a verdict. It is not optional: a change to a page
  the project lists in `artDirection` (its Persuade and Read pages) is held after the review until the critic has
  read it, with the same proof of reading, and its verdict is shown to you first. `/design-harness:direction` puts its
  two or three directions on the page behind switches so you choose by looking. Run blind on 2026-11-09, it stopped
  both proposals the designer had rejected that day ("not ready to show", 4 and 3 of 5 ways a page goes plain), and
  was harsher than him on a live case page (2 of 5): it is not yet calibrated against his eye.
- **Design work runs where the harness runs.** The review, the critic and the skills key off the session's own
  folder. A session opened somewhere else that edits a project using the harness is told so, once, by name: one
  afternoon's work on a website went unreviewed that way. The warning reaches only sessions where the plugin is
  enabled, so enable it for your user, not just the project, if you open sessions outside your projects.
- **The best public design skills**, pinned to a commit that was read and checked: Anthropic's frontend-design,
  Google Chrome's modern-web-guidance, Emil Kowalski's design-engineering skills and Benji Taylor's Stageshow (faux
  product UI for case stills, films and heroes, filmed frame by frame to catch what a still cannot), on by default. Paul Bakaus's
  Impeccable is listed but off by default: it covers the same ground as frontend-design and the harness's AI-look
  register (which distils its useful rules), its opinions pull hardest against a project's own taste, and it downloads
  a program on first use. A project that wants its audit commands installs it and enables it in its settings.

How well the reviewer works is in [docs/benchmark.md](docs/benchmark.md), with its limits. In short, measured on
0.7.0 with Sonnet as the reviewer, scored blind over three runs: it is a good copy reviewer and a weak visual one. On a client prototype's corrections, mostly wordy copy, it
caught 11 to 14 of 32 outright and 8 or 9 more in part, with one finding in eight not worth the time. On a
held-out project whose corrections were mostly visual and product calls, with no dev server for pictures, it caught
2 of 19 outright. Rerun on 0.12.1 with the dev server up (two judges, 95% agreement), the screenshots did not
change that: the visual corrections were missed with and without them. What did catch one class, line breaks, was a
measurement, which is now `check-breaks.mjs`. Rerun on 0.17.0 with the reviewer on Opus 5.5, it caught 2 more of the
held-out project's 21 corrections a run (3.7 against 1.7 under the same judge), none more on the client prototype,
and wrote about 40% more findings, at a median 3.3 minutes a review. A second measurement, `check-layout.mjs`, catches overflow, rows laid out
two ways and blocks a column off their siblings; built from two of the designer's corrections, it flags both and
nothing after their fixes, and none of the benchmark's other visual corrections, which are of other kinds.

- **Product work in the same place.** A requirement per surface (`docs/product/`), a decision log and an open
  questions register sit beside the design files. The reviewer checks each surface against its requirement, so a
  listed state that was never designed is caught. Client-facing copies go to Google Docs or Claude Docs for comments, and
  `/design-harness:feedback` brings their comments, meeting notes and revisions back: each note sorted into a
  decision, a requirement, a revision or a question, built with your go-ahead, and answered in your voice once you
  approve the drafts.

## Start a new project

1. Once per machine, clone the harness, then add the marketplace and your personal rules. `install.sh` links
   `~/.claude/CLAUDE.md` to the clone, so the clone has to stay where it is:

   ```bash
   git clone https://github.com/gonzalotheomelette/design-harness.git ~/dev/design-harness
   ```

   ```bash
   claude plugin marketplace add gonzalotheomelette/design-harness
   ```

   ```bash
   ~/dev/design-harness/dotfiles/install.sh
   ```

2. In the new project, install the harness and the skills it works with, before the kickoff (its second pass reads
   frontend-design's list of generated looks):

   ```bash
   claude plugin install design-harness@omelette --scope local
   ```

   ```bash
   claude plugin install frontend-design@omelette --scope local
   ```

   ```bash
   claude plugin install modern-web-guidance@omelette --scope local
   ```

   ```bash
   claude plugin install emil-design-engineering@omelette --scope local
   ```

   ```bash
   claude plugin install stageshow@omelette --scope local
   ```

3. Then, in Claude Code: `/design-harness:kickoff`, with or without a mood board. It writes `.claude/settings.local.json`,
   which keeps these plugins enabled on your machine only and stays out of git, so a client's developers are never
   asked to install the designer's tooling.

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
  docs/decision-log.md      every decision, dated, in the words of whoever made it (from the first one recorded)
  docs/open-questions.md    what is waiting on the client (from the first question)
  docs/ui-consistency.md    the rules sibling surfaces must share; grows from corrections
  src/styles/theme.css      generated from DESIGN.md; the only place raw values live
  .claude/design-harness.json   what differs from the harness's defaults: the dev server, the colour modes
  .claude/settings.json     the pinned DESIGN.md linter, shared
  .claude/settings.local.json   the marketplace and the enabled plugins, this machine only, not committed
```

## This repository

```
.claude-plugin/marketplace.json     the "omelette" marketplace: design-harness plus the pinned external plugins
plugins/design-harness/
  hooks/                            review-before-show (Stop + UserPromptSubmit): the turn gate and the review packet
  agents/ui-review.md               the reviewer: the latest Opus, Read, Grep and Glob, no shell
  agents/art-direction.md           the taste critic: judges against picked references, answers with directions and a verdict
  bin/direction-packet.mjs          the critic's packet: pictures listed by path, each page's mode read from PRODUCT.md
  .mcp.json                         inspo, real production websites as references (a hosted, read-only service)
  skills/kickoff/                   mood board to a project that knows its identity, with templates
  skills/design-pass/               the loop for building any surface
  skills/learn/                     a correction becomes a rule, a pick becomes a record
  skills/references/                references gathered, picked by the designer, kept with what each teaches
  skills/direction/                 the critic's directions, built behind switches, chosen on the page
  skills/ux-copy/                   interface copy in the project's voice, short, with the sibling's verbs
  skills/feedback/                  client notes in (Google Docs, Claude Docs, Granola), sorted, built, answered
  skills/web-design-guidelines/     Vercel's wider review, for PR time
  reference/ai-look.md              the devices that read as generated
  bin/                              check-copy-length, check-drift, check-a11y, check-breaks, check-layout, shoot, server-of (run from a
                                    project root). Copy and drift parse with the TypeScript in bin/vendor, never
                                    the project's; check-a11y and shoot, which the session runs, use the project's
                                    own Playwright or Puppeteer
dotfiles/CLAUDE.md                  Gonzalo's working rules for every project; install.sh links it
docs/benchmark.md                   method and results
bench/                              the benchmark's scripts and prompts, to rerun it (its data is kept privately)
```

## Updating

Pins are deliberate: an external skill changes only when its `sha` here is moved, after reading what changed, and a
project changes harness version only when the `ref` tag in its `.claude/settings.local.json` is moved.

To release: check the tests are green on CI (they run on every push; locally, `npm install` once for the pinned TypeScript the checks parse with, then `npm test`), bump `version` in both manifests, commit, and tag `vX.Y.Z`. A kickoff pins a new project
to the `version` in `plugin.json`, so nothing else names the release. Re-run the benchmark when the reviewer, its
rules or its model change.

## What it does not cover yet

- Taste, measured: the benchmark counts corrections caught, and a critic's directions are not corrections. Its
  measure will be how often its verdict matches the designer's, and how often he picks one of its directions over
  the page as it stands. The picks log is the data for both.
- Briefs sent to Mobbin and inspo leave the machine. The references skill writes them without client names or
  anything under NDA; inspo's hosted endpoint says it logs tool names and timings, never queries or IPs. Disable the
  `inspo` server in `/mcp` for a project that must not use it.
- Anything but macOS, on purpose: the dev-server proof uses `lsof` and the browser search knows Mac paths first.
- Fixes made after a review reach the next review, not this turn's: a second review of every fix would double the
  wait for little.
- Code from the project: the hook runs none (it parses with its own TypeScript and names no command from the
  project's settings), but the browser checks the session runs load the project's Playwright or Puppeteer, as the
  project's own scripts would.
- Supply chain below the top level: external plugins are pinned by commit and the DESIGN.md linter by version, but
  the harness itself only by tag (Claude Code's marketplace source takes a branch or tag, not a commit), the linter's
  own dependencies float, and Impeccable (optional) downloads a binary on first use.
- Copy behind a translation call or a prop: the copy check lists those slots for the reviewer instead of measuring
  them.
- Copy in markup other than JSX, HTML, Vue, Svelte and Astro (Handlebars, ERB, Markdown): the check names those
  files instead of measuring them.
- Which pages to screenshot: the session names them from the change; nothing maps files to routes for it.
- A day-one stack scaffold, CI workflow and preview deploys: the kickoff sets up identity and product files, not
  the app itself.
- State that only exists after an action in the session: screenshots of a fresh page cannot show it, and the
  reviewer says so.
