# Third-party material

- `plugins/design-harness/skills/web-design-guidelines/` is adapted from
  [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines),
  MIT licensed. It fetches the guidelines from vercel-labs/web-interface-guidelines (MIT) at run time.
- `plugins/design-harness/reference/ai-look.md` distils rules from
  [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0),
  [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT),
  [Nutlope/hallmark](https://github.com/Nutlope/hallmark) (MIT) and Anthropic's frontend-design skill. It
  quotes none of them at length; each is credited in the file.
- The marketplace lists, but does not copy, frontend-design (anthropics/claude-plugins-official), Impeccable,
  modern-web-guidance (GoogleChrome, Apache-2.0), emilkowalski/skills (MIT) and Stageshow
  (benjitaylor/skills, `stageshow/` MIT). Each installs from its own
  repository at the commit pinned in `.claude-plugin/marketplace.json`.
- `plugins/design-harness/agents/art-direction.md` adapts three questions from the fresh-eye review in
  [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) (MIT): whether the composition could be any
  product in its category, the five ways a result goes plain, and the one difference beside the closest example.
- `plugins/design-harness/skills/references/` records what a reference teaches as Trigger, Decision, Reason and
  Evidence, an idea from [senlindesign/taste-skill](https://github.com/senlindesign/taste-skill); no text is taken
  from it. The inspo MCP server ([Nutlope/inspo](https://github.com/Nutlope/inspo), MIT) is configured, not copied.
- `plugins/design-harness/bin/vendor/typescript-6.0.3.js.gz` is Microsoft's TypeScript 6.0.3 (`lib/typescript.js`),
  Apache-2.0, gzipped and unmodified; its licence is beside it. The checks parse with it so they never load the
  project's own copy.
- `plugins/design-harness/bin/vendor/axe-core-4.12.1.min.js.gz` is Deque's axe-core 4.12.1 (`axe.min.js`), MPL-2.0,
  gzipped and unmodified; its licence is beside it, and its source is at https://github.com/dequelabs/axe-core. The
  accessibility check injects it when the project has no axe of its own.
