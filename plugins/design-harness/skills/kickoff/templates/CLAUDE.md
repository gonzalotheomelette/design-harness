@AGENTS.md

# Claude Code here

- Where the design harness is installed, the review-before-show hook holds any turn that changed rendered files until the `design-harness:ui-review` agent
  has reported on that change. Run it in the foreground when asked, fix what you agree with, and say what you left.
- When the designer corrects something a sibling surface or a written rule would have caught, run
  `/design-harness:learn` so the rule is written down in the same commit as the fix.
- Keep this file under 200 lines. Project facts that only matter to one area go in `.claude/rules/` with a `paths:`
  glob, so they load only when that area is touched.

## Project facts

{What a new session must know that the code does not say: the stack, how to run the dev server, the test commands,
the people and their roles.}
