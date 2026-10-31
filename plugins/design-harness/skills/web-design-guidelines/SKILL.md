---
name: web-design-guidelines
description: Reviews UI code against Vercel's Web Interface Guidelines (hit targets, focus, loading states, URL as state, forms, motion, typography details). Use at PR time or when asked to "review my UI", "check accessibility", "audit design" or "check against best practices"; it is broader and slower than the per-turn ui-review, so it belongs before a merge rather than after every change.
metadata:
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines (MIT), vendored 2026-10-31 at 1a2c79d4
---

# Web Interface Guidelines

Review files for compliance with Vercel's Web Interface Guidelines.

## How it works

1. Fetch the guidelines at the commit this harness pinned (moved deliberately, after reading what changed, like the
   other pins in the marketplace):
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/434b7f91364665f2f733b310ec54809bf8f37937/command.md`
2. Read the files named (or the branch's changed rendered files, from `git diff --name-only` against the base).
3. Check every rule in the fetched guidelines.
4. Report findings in the terse `file:line` format the guidelines specify.

## Where it fits

The per-turn `design-harness:ui-review` agent is tuned for the corrections a designer makes (sibling consistency,
copy length, the AI look) and is kept fast. This review is wider: interaction details, forms, focus and loading
states. In the 2026-10-31 benchmark the wider reviewers found real behaviour bugs the per-turn one did not, so run
this once before a pull request, not after every change.

If the project's DESIGN.md or ui-consistency.md settles something differently from the guidelines, the project
wins: report the difference as information, not as a violation.
