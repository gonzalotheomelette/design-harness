# The AI look

A register of the devices that make an interface read as generated, for the `ui-review` agent and for anyone
building a surface. Written 2026-10-31 and refreshed when the sources below move.

None of these is bad design in itself. Each became a tell by being produced by default, everywhere, without a
reason. So the test is never "is this on the list" but "was this chosen for this product, or is it what a
model reaches for when nothing was decided". A project can choose any of them on purpose, and then it is not a
finding: each project lists its choices under "Chosen on purpose" in its `DESIGN.md`.

The register names devices and procedures, never replacement fonts or colours: every published "use this
instead" list has become the next wave of tells within months.

Sources, read 2026-10-31, worth re-reading when this file feels stale: Impeccable's craft floor and clarify
references (github.com/pbakaus/impeccable, Apache-2.0), taste-skill's dated tells registry and app-screens
chapter (github.com/Leonxlnx/taste-skill, MIT), and Anthropic's frontend-design skill
(github.com/anthropics/claude-plugins-official).

## Surfaces and structure

| Tell | Why it reads as generated | Instead |
|---|---|---|
| Content chopped into same-size cards, each an icon in a tinted square plus a heading plus a line | The default container when no structure was decided. Nested cards are always wrong. | Group by what the content is: a list, a table, a form, one composed block |
| One soft grey shadow under every card, or a 1px border under a wide soft shadow (the ghost card) | Elevation declared twice, by habit | One elevation per object: a tone step, a border, or a shadow, chosen once |
| One medium radius on everything regardless of size | Radius as a default, not a hierarchy | Radius scales with the object, from the theme's tier table |
| The hero-metric template: big number, small label, supporting stats, an accent | The default dashboard opener | Lead with the answer to the screen's one question, and show its history if it moves |
| Gradient text, glow buttons, glass panels as decoration | First-wave generated look | Solid ink, flat fills, opaque surfaces |
| A coloured left border thicker than 1px on cards, alerts or list items | The stock callout | A tone, an icon, or the words |
| Emoji or Unicode glyphs standing in for icons | No icon system was chosen | One icon set, one stroke weight |
| Sparklines, progress rings or donut charts standing in for content | Decoration shaped like data | A real figure, or nothing |
| Section numbers (01 / 02 / 03) or "Step 2" when the order carries nothing | Index numbering as ornament | Order by position; number only a real sequence |
| A modal for a task that needs neither interruption nor protected focus | The reflex container | Inline, a drawer, or the page itself |
| Fade-and-rise on every block, hover lift on every card, staggered entrances | Motion with no meaning | Motion answers an action: a press, a sheet opening, a row arriving |
| Everything centred | Symmetry as a default | Left-anchored, with one centred moment if any |
| Browser defaults left on: selection colour, caret, scrollbars, focus ring, numerals in tables | The surface was assembled, not built | Theme them; tabular figures in every column of numbers |

## Copy

| Tell | Instead |
|---|---|
| Genre verbs and adjectives: unlock, supercharge, seamless, effortless, streamline, empower, robust, elevate, all-in-one | The product's own words for what happens |
| The correction: "not just X, it's Y" | Say what it is |
| Three parallel items because three feels complete | The number the content has |
| An intro that repeats the heading, or helper text that restates its control | Say each idea once. If the heading explains the state, the intro adds something new or goes |
| Explainer captions that narrate the design or the system ("This helps you keep track of...") | Cut them. Clarity comes from the label and the layout, not from a sentence about them |
| A dialog subtitle spliced with "and" into one long sentence | Short declarative sentences, or none |
| Vague buttons: Submit, OK, Yes, Continue, Learn more, Get started | A verb and object naming what happens |
| A destructive confirmation that does not name the object or the consequence | Name both, on the message and on the button; prefer Undo when recovery is safe |
| An error that says something failed and stops | What failed, why when it is useful, and how to recover |
| Furniture text: version stamps, middle-dot strings of metadata, status dots that mean nothing | Remove |
| Em dashes as a habit | A full stop |
| Invented data presented as real (counts, testimonials, names) | Real values, or labelled as illustrative |

## App screens

A working screen should read as the best product of its category first, and only then as anything distinctive.
The world a brand brings lends type, palette, density and one signature move; it never supplies the layout,
the navigation or the controls.

- **One question per screen.** The biggest thing on it answers that question and is read first.
- **Shared edges.** Every block shares the screen's edges: no dead strip, no card stopping short, no stretched
  card with a blank band at its foot.
- **Colour only where it means something:** data, status, selection, the one primary action.
- **Numbers that agree.** Every fact that appears twice agrees with its copy; totals recompute from what is
  shown; figures line up digit for digit.
- **Honest emptiness.** A zero looks like a zero, a missing value like a dash, and every count badge sits on
  a queue that needs action.
- **Standard controls.** Every control is one the visitor already knows how to use.

## Removal is not the goal

A surface with every tell removed and nothing in their place is an empty page with good manners, and that is a
tell too. The tells fill a gap where a decision should have been. Make the decision first (what this surface
is, what it answers, which existing pattern it shares with its siblings), then check the list.
