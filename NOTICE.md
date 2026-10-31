# Third-party material

- `plugins/design-harness/skills/web-design-guidelines/` is adapted from
  [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines),
  MIT licensed. It fetches the guidelines from vercel-labs/web-interface-guidelines (MIT) at run time.
- `plugins/design-harness/reference/ai-look.md` distils rules from
  [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0),
  [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) and Anthropic's frontend-design skill. It
  quotes none of them at length; each is credited in the file.
- The marketplace lists, but does not copy, frontend-design (anthropics/claude-plugins-official), Impeccable,
  modern-web-guidance (GoogleChrome, Apache-2.0) and emilkowalski/skills (MIT). Each installs from its own
  repository at the commit pinned in `.claude-plugin/marketplace.json`.
- `plugins/design-harness/bin/vendor/typescript-6.0.3.js.gz` is Microsoft's TypeScript 6.0.3 (`lib/typescript.js`),
  Apache-2.0, gzipped and unmodified; its licence is beside it. The checks parse with it so they never load the
  project's own copy.
