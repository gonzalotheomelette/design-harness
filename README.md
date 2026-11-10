# Omelette's design setup

How Omelette designs with Claude Code: a few outside design plugins, each pinned to a commit that was read and
checked, and the working rules every session starts with. Nothing here gates or grades the work. The designer steers.

| Piece | What it does | Pinned |
|---|---|---|
| [frontend-design](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design) (Anthropic) | Commits to an aesthetic direction and a real type pairing before any code | `a7ba5b9` |
| [Impeccable](https://github.com/pbakaus/impeccable) (Paul Bakaus) | Commands run on a narrow target: `/impeccable critique the pricing cards`, `audit`, `polish`, `bolder`, `quieter`, `typeset`, `layout`, `animate`. A detector with 62 rules and no model behind it. A hook that leaves notes after UI edits and never blocks | 4.8.2, `4ae73c5` |
| [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) (Benji Taylor) | Faux product UI as stills or short animations, filmed frame by frame to catch jumps and text that does not fit. For case imagery and product heroes | 1.1.1, `299140f` |
| [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (Google Chrome) | What the web platform now does natively | `4f2b13e` |
| [Emil Kowalski's skills](https://github.com/emilkowalski/skills) | Animation and interaction craft | `a81dbca` |
| `dotfiles/CLAUDE.md` | The working rules every session on this machine starts with | |

## How work runs

- **References first.** For anything new, real references from the top of the field, shown one at a time for a yes or
  no. Build from the yeses and show the result beside its reference. Never invent a new visual language without asking.
- **Steer on narrow targets.** One section or component at a time, with an Impeccable command, never a whole page at once.
- **Checks catch slips, not taste.** Impeccable's detector and its hook flag contrast, overflow, legibility and the
  common AI looks. Whether the work is good is the designer's call.
- **Leave Impeccable's live mode off.** It can start `claude` with permissions bypassed.

## Install on a new machine

```bash
git clone https://github.com/gonzalotheomelette/design-harness.git ~/dev/design-harness
```

```bash
~/dev/design-harness/dotfiles/install.sh
```

```bash
claude plugin marketplace add gonzalotheomelette/design-harness
```

Then, in each project's folder, install what it uses (local scope keeps it to that project):

```bash
claude plugin install frontend-design@omelette --scope local
claude plugin install impeccable@omelette --scope local
claude plugin install modern-web-guidance@omelette --scope local
claude plugin install emil-design-engineering@omelette --scope local
claude plugin install stageshow@omelette --scope local
```

`install.sh` links `~/.claude/CLAUDE.md` to the clone, so the clone has to stay where it is. Stageshow's filming
needs `playwright-core` installed in Stageshow's own folder, since it loads it from there (`npm i --no-save
playwright-core` in that folder), and Chrome, or `CHROME_PATH` set to another Chromium. It films Stageshow's own
stages, not arbitrary page elements.

## Start a new product

Every client product starts with no context. In its folder, after installing the plugins above:

1. **`/impeccable init`.** It scans the project, then interviews you about the product: who uses it, in what
   situation, what job they do, what makes it different, what real evidence exists. It writes `PRODUCT.md` from
   your answers only, and marks anything undecided rather than inventing it. It never asks about looks.
2. **The first surface.** Ask for it, or run `/impeccable shape <surface>` to agree a brief before any code. This is
   where the look is settled: references from the top of the field, one at a time, yes or no, and Impeccable's
   new-work step, which can start from a generated image when image generation is available. It writes
   `DESIGN.md`.
3. **Refine on narrow targets** with `critique`, `polish`, `bolder`, `quieter`, `typeset`, `layout`, `animate`.
   For product-UI stills and animations, ask for them and Stageshow takes over.

Commit `PRODUCT.md`, `DESIGN.md` and `.impeccable/config.json`; `.impeccable/config.local.json` stays on the machine.
Checked on Nov 10 2026 in an empty project: the plugins install with the commands above, Impeccable reports that
`init` is required, and `/impeccable doctor` finds no drift.

## Updating a pin

Read the plugin's diff since the pinned commit, then move its `sha` in `.claude-plugin/marketplace.json` in a PR.
Projects take it with `claude plugin marketplace update omelette` and `claude plugin update <name>@omelette`.

## What was here before

Until Nov 9 2026 this repository held Omelette's own design harness: a review-before-show hook, a fresh-context
reviewer, an art-direction critic and nine skills. A day of runs on the Omelette site showed its checks working and its
taste side failing: every direction it produced was turned down, and a rebuild without its rules drifted into another
brand's look. It was retired for the simpler setup above. Its code is kept at the
[`v0.19.0`](https://github.com/gonzalotheomelette/design-harness/tree/v0.19.0) tag.
It is deprecated and no longer listed in the marketplace, so no project can switch it on.
