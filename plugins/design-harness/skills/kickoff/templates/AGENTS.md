# {Product name}: working here

For any coding agent (Claude Code, Codex, Cursor). Claude Code reads it through CLAUDE.md.

## The design

- **DESIGN.md** is the identity: tokens and the reasons for them. Read the section for what you are touching.
  Tokens are the only source of colour, type, radius and spacing; raw values live only in the theme file.
- **PRODUCT.md** is who it is for and how it speaks. Copy follows its voice.
- **docs/ui-consistency.md** holds the rules that make sibling surfaces match. Read the rows for the elements you
  touch before building.
- **design/** holds the brand assets, artwork and references.

## Before building a surface

1. Read what exists: search for the concept and open the closest existing surface. Never build a second version
   of a component the product already has; widen the existing one.
2. Gather references by pattern class before writing markup.
3. Build from tokens and existing components.
4. Look at what you built, at desktop and phone width, light and dark, before showing it.

## Checks

```bash
node <harness>/bin/check-copy-length.mjs   # copy longer than the approved copy of its kind
node <harness>/bin/check-drift.mjs         # raw colours, arbitrary sizes, forced overrides
node <harness>/bin/check-a11y.mjs /route   # axe, light and dark, desktop and phone
npx @google/design.md lint DESIGN.md       # token references and contrast
```

In Claude Code the review-before-show hook runs these through the ui-review agent before any change is handed back.
