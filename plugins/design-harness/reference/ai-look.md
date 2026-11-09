# The AI look

A register of the devices that make an interface read as generated, for the `ui-review` agent and for anyone
building a surface. Written 2026-10-31, refreshed 2026-11-08, and refreshed again when the sources below move.

None of these is bad design in itself. Each became a tell by being produced by default, everywhere, without a
reason. So the test is never "is this on the list" but "was this chosen for this product, or is it what a
model reaches for when nothing was decided". A project can choose any of them on purpose, and then it is not a
finding: each project lists its choices under "Chosen on purpose" in its `DESIGN.md`.

The register names devices and procedures, never replacement fonts or colours: every published "use this
instead" list has become the next wave of tells within months.

Sources, worth re-reading when this file feels stale:

- Impeccable's craft floor and clarify references (github.com/pbakaus/impeccable, Apache-2.0), read 2026-10-31.
- taste-skill (github.com/Leonxlnx/taste-skill, MIT): its tells registry and app-screens chapter, read
  2026-10-31, and its copy tells (`skills/taste-skill/references/copy-tells.md` at f6b7657), read 2026-11-08.
  Since 2.5.0 (2026-11-05) it builds marketing sites, and the app-screens chapter below is no longer in it.
- Hallmark's gates (github.com/Nutlope/hallmark, `skills/hallmark/references/gates.md` at 407fa68, MIT), read
  2026-11-08. Its theme catalogue is not a source, for the reason above.
- Anthropic's frontend-design skill (github.com/anthropics/claude-plugins-official).

## Surfaces and structure

| Tell | Why it reads as generated | Instead |
|---|---|---|
| Content chopped into same-size cards, each an icon in a tinted square plus a heading plus a line | The default container when no structure was decided. Nested cards are always wrong. | Group by what the content is: a list, a table, a form, one composed block |
| Every section built the same way: a label, a heading, a short intro, three or four cards, the same gap between each | A template repeated down the page, so no section stands out | Shape each section from what it holds; separate sections in more than one way |
| The eyebrow: a small label above a heading that announces it, stacked, in a pill, numbered, as a category tag over each card, or "Trusted by" over logos | The most reliable generated device of 2026 | Open with the heading. Keep small labels for real things: a caption, a column head, a field label, a date |
| Small text in tracked capitals: labels, table heads, nav links, tags and chips set uppercase or letter-spaced | One style poured over every label at once | Sentence case, the body face, a step smaller |
| One word of a heading set apart by colour, italic, weight, a highlight or an underline | Emphasis as a template | The whole heading one way; a line break if it needs a turn |
| Monospace on labels, captions and metadata when the content is not code or a measurement | Mono worn as a costume for "technical" | The body face; mono for code, figures and measurements |
| One soft grey shadow under every card, or a 1px border under a wide soft shadow (the ghost card) | Elevation declared twice, by habit | One elevation per object: a tone step, a border, or a shadow, chosen once |
| One medium radius on everything regardless of size | Radius as a default, not a hierarchy | Radius scales with the object, from the theme's tier table |
| The hero-metric template: big number, small label, supporting stats, an accent | The default dashboard opener | Lead with the answer to the screen's one question, and show its history if it moves |
| Gradient text, glow buttons, glass panels as decoration | First-wave generated look | Solid ink, flat fills, opaque surfaces |
| Cream paper, a high-contrast serif display and a clay or terracotta accent, together | The current wave: what a model reaches for once told to avoid the first | Move at least one axis for a reason this brief gives |
| A coloured left border thicker than 1px on cards, alerts or list items | The stock callout | A tone, an icon, or the words |
| Emoji or Unicode glyphs standing in for icons | No icon system was chosen | One icon set, one stroke weight |
| Sparklines, progress rings or donut charts standing in for content | Decoration shaped like data | A real figure, or nothing |
| Rows of identical dots, ticks or bars standing for a quantity | Decoration shaped like counting | The number, set in type |
| A drawn browser bar, window title bar or device frame around a mocked product, or styled boxes standing in for a product that exists | An imitation of the product where the product belonged | A capture of the real product, in one frame or none |
| An empty gradient block or a row of blank placeholders where a picture belongs | A wireframe shipped as the page | The real image, a slot labelled as one, or the content set in type |
| Illustrations of objects, people or scenes drawn inline by the model | Clip art made on the spot | A photograph, the product itself, or type at scale; illustration only from a chosen system |
| The stock nav (wordmark left, links, button right, a hairline under) and the stock footer (four link columns, a social row, a copyright) | Chrome nobody decided | Chrome shaped by what the visitor needs, or the stock shape chosen on purpose |
| A page that ends on an email sign-up when a mailing list is not its job | The stock close | End on what the visitor came to do |
| A success toast for a change the user can already see | Noise that teaches people to ignore toasts | Silent success; a toast only for what happened out of sight or can be undone |
| Section numbers (01 / 02 / 03) or "Step 2" when the order carries nothing | Index numbering as ornament | Order by position; number only a real sequence |
| A modal for a task that needs neither interruption nor protected focus | The reflex container | Inline, a drawer, or the page itself |
| Fade-and-rise on every block, hover lift on every card, staggered entrances, bounce or overshoot on interface state | Motion with no meaning | Motion answers an action: a press, a sheet opening, a row arriving. Ease out, without overshoot |
| Everything centred | Symmetry as a default | Left-anchored, with one centred moment if any |
| Browser defaults left on: selection colour, caret, scrollbars, focus ring, numerals in tables | The surface was assembled, not built | Theme them; tabular figures in every column of numbers |

## Copy

| Tell | Instead |
|---|---|
| Genre verbs and adjectives: unlock, supercharge, seamless, effortless, streamline, empower, robust, elevate, all-in-one | The product's own words for what happens |
| The correction: "not just X, it's Y", and what replaces it once banned: "rather than", "instead of", "without the" | Say what it is. Count the substitutes together |
| Virtue words about the product or ourselves: honest, calm, quiet, thoughtful, simply, genuinely, carefully | A fact or an admission that shows it. These are what banning the genre words breeds |
| Two-fragment headings ("Five tools. One inbox.") and number pairs ("Three plans, three ways to work"), repeated | Fine once. Otherwise say what the section holds |
| Negation runs: "No setup, no meetings, no waiting" | One, and only when each item is a refusal the reader can check |
| Three parallel items because three feels complete | The number the content has |
| A row of three or four figures, each over a one-word label | Each number in the sentence it proves |
| An intro that repeats the heading, helper text that restates its control, or a section whose last line restates its heading | Say each idea once. If the heading explains the state, the intro adds something new or goes |
| Explainer captions that narrate the design or the system ("This helps you keep track of...", "Below you'll find...") | Cut them. Clarity comes from the label and the layout, not from a sentence about them |
| A dialog subtitle spliced with "and" into one long sentence | Short declarative sentences, or none |
| A trailing rider on a fact (", making it easy to...", ", ensuring...") or a staged reveal ("The result? ...") | End the sentence at the fact; say the result plainly |
| A quip or a moral closing every paragraph, every card the same length | End on information; spend words where there is most to say |
| Vague buttons: Submit, OK, Yes, Continue, Learn more, Get started, or any label with an arrow glued to it | A verb and object naming what happens |
| Polished headlines over stock errors, empty states and confirmations | The microcopy written in the same voice |
| A destructive confirmation that does not name the object or the consequence | Name both, on the message and on the button; prefer Undo when recovery is safe |
| An error that says something failed and stops | What failed, why when it is useful, and how to recover |
| Furniture text: version stamps, beta pills, scroll cues, rotated side text, middle-dot strings of metadata, status dots that mean nothing | Remove |
| Em dashes as a habit | A full stop |
| Invented data presented as real: counts, testimonials, the default cast of names (Priya, Marcus, Acme, Northwind), and specifics added for colour, like a batch number or a time of day | Real values, or labelled as illustrative; without them, a plainer line |

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

Banning a habit breeds its substitute, so check for the replacement as closely as the original: no em dashes
becomes a drumbeat of fragments, no genre words becomes virtue words, no threes becomes everything in pairs, and
"be specific" becomes invented numbers.

Not tells: plain "is" and "has", a list of three when there are three things, a narrow claim the brief can prove,
and copy the client wrote.
