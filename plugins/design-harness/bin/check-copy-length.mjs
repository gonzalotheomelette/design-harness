#!/usr/bin/env node
/**
 * Copy length: every button, badge, title, subtitle, toast, label, placeholder and description a change added,
 * measured in words against a limit per kind of element.
 *
 * Why. "Say less" is the most frequent correction a designer makes and the easiest to forget, because an
 * adjective cannot fail. A number can. The limits should be read off the copy the designer has already
 * approved in this project: run `--survey` once a project has a few hundred strings and copy the 95th
 * percentile of each kind into `copyLimits` in .claude/design-harness.json. Until then the defaults below
 * apply; they were measured on the the client prototype prototype on 2026-10-31 and are a starting point, not this
 * project's taste.
 *
 * A flagged string is not automatically wrong. It is longer than nearly everything approved for that kind of
 * element, and it needs a reason. Most wordiness (a sentence explaining the interface) fits inside any sane
 * limit, so this is a floor under the reviewer, never the judge.
 *
 * JSX is parsed with the TypeScript that ships with the harness, so `<Button>Save</Button>`, `title="..."` on any
 * element and `toast('...')` are each recognised for what they are. A template expression counts as one word. A
 * ternary counts its longer branch. Words inside inline elements (`<strong>`, `<em>`, a link in a sentence) count
 * toward their sentence. HTML, Vue, Svelte and Astro markup is read by a smaller tag reader with the same kinds.
 *
 * Usage: node check-copy-length.mjs [--all | --survey | --base=<ref>]   (run from the project root)
 * Exit: 0 clean · 1 a string is over its limit · 2 not a clean pass: something it could not measure, named, or a
 *       setup problem. A caller never reads 2 as clean.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULTS, addedLines, baseArg, changedFiles, filesWithAdditions, git, loadConfig, matchesAny, pathspec, harnessTypescript } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const args = process.argv.slice(2)
const SURVEY = args.includes('--survey')
const ALL = args.includes('--all') || SURVEY

// Required only once there is something to parse, so the files it cannot read are named first, whatever happens.
const ts = harnessTypescript()

const LIMITS = {
  button: 4,
  // A link inside a sentence reads with the sentence; measured as a button, every "Read the full policy" was noise.
  link: 8,
  badge: 3,
  title: 6,
  subtitle: 10,
  toast: 7,
  helper: 16,
  label: 5,
  placeholder: 6,
  description: 22,
  // Words in any other element (a <div>, a <span>): explainer copy wrapped in a plain element was never measured.
  text: 22,
  ...(config.copyLimits ?? {}),
}

// Children of these elements are copy of that kind. Names cover Catalyst, shadcn/ui and Radix; a project adds
// its own in `copyTags`.
const TAG_KIND = {
  // Plain HTML too: the 2026-10-31 live trial added a native <button> with an 8-word label that only the reviewer
  // caught, because the list held component names alone.
  button: 'button',
  a: 'link',
  // Plain HTML: a new app's copy is mostly headings and paragraphs, and with only component names listed a 35-word
  // <p> passed as "every one is within its limit".
  h1: 'title',
  h2: 'title',
  h3: 'subtitle',
  h4: 'subtitle',
  h5: 'subtitle',
  h6: 'subtitle',
  p: 'description',
  label: 'label',
  legend: 'label',
  th: 'label',
  li: 'helper',
  small: 'helper',
  figcaption: 'description',
  Button: 'button',
  Badge: 'badge',
  Heading: 'title',
  Subheading: 'title',
  CardTitle: 'title',
  DialogTitle: 'title',
  AlertTitle: 'title',
  AlertDialogTitle: 'title',
  SheetTitle: 'title',
  DrawerTitle: 'title',
  DialogDescription: 'description',
  AlertDescription: 'description',
  AlertDialogDescription: 'description',
  SheetDescription: 'description',
  DrawerDescription: 'description',
  CardDescription: 'description',
  Notice: 'description',
  Text: 'description',
  Description: 'helper',
  FormDescription: 'helper',
  Label: 'label',
  FormLabel: 'label',
  ...(config.copyTags ?? {}),
}
// Copy carried in a prop, on any element.
const ATTR_KIND = { title: 'title', subtitle: 'subtitle', description: 'description', hint: 'description', caption: 'description', label: 'label', placeholder: 'placeholder' }
const JSX_FILES = config.copyFiles ?? ['**/*.tsx', '**/*.jsx']
const MARKUP_FILES = ['**/*.html', '**/*.vue', '**/*.svelte', '**/*.astro']
// The project's exclusions from `ui` (such as `!design/**`) apply to copy too.
const COPY_FILES = [...JSX_FILES, ...MARKUP_FILES, ...config.ui.filter((g) => g.startsWith('!'))]
// Elements whose words belong to the sentence around them.
const INLINE = new Set(['strong', 'em', 'b', 'i', 'u', 'code', 'span', 'a', 'Link', 'mark', 'abbr', 'kbd', 'sub', 'sup', 'q', 'time', 'Strong', 'Code', 'TextLink'])
const EXCLUDE = config.copyExclude ?? ['**/*.test.*', '**/*.stories.*', '**/node_modules/**']

const wordsOf = (t) => t.trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length

// Strings held in this file's constants (`const SAVE = 'Save changes'`, `const COPY = { save: '…' }`), so copy moved
// out of the markup is still measured; anything else a slot holds (a prop, `t('key')`) is collected in `opaque` and
// reported as not measured, never passed as clean. A blind review measured a 12-word button held in a const reading as
// "every one is within its limit".
let consts = new Map()
let opaque = []
function textOf(node) {
  if (!node) return ''
  // A wrapper component passing its own children through is not copy; its callers are measured where they write it.
  if (/^(props\.)?children$/.test(node.getText?.() ?? '')) return ''
  if (ts.isIdentifier(node)) {
    const v = consts.get(node.text)
    if (typeof v === 'string') return v
    opaque.push(node.text)
    return ''
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const v = consts.get(node.expression.text)
    if (v && typeof v === 'object' && typeof v[node.name.text] === 'string') return v[node.name.text]
    opaque.push(node.getText())
    return ''
  }
  if (ts.isCallExpression(node) || ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
    opaque.push(node.getText())
    return ''
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) return textOf(node.expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.flatMap((s) => ['X', s.literal.text])].join('')
  if (ts.isJsxText(node)) return node.text
  if (ts.isJsxExpression(node)) return node.expression ? textOf(node.expression) : ''
  if (ts.isParenthesizedExpression(node)) return textOf(node.expression)
  const longer = (a, b) => (wordsOf(a) >= wordsOf(b) ? a : b)
  if (ts.isConditionalExpression(node)) return longer(textOf(node.whenTrue), textOf(node.whenFalse))
  // `'Save your changes ' + 'to the draft'` is one string; `a || b` and `a ?? b` show one side, so the longer counts.
  if (ts.isBinaryExpression(node))
    return node.operatorToken.kind === ts.SyntaxKind.PlusToken
      ? `${textOf(node.left)}${textOf(node.right)}`
      : longer(textOf(node.left), textOf(node.right))
  if (ts.isJsxFragment(node)) return node.children.map(textOf).join(' ')
  return ''
}
const tagName = (el) => (ts.isIdentifier(el.tagName) ? el.tagName.text : ts.isPropertyAccessExpression(el.tagName) ? el.tagName.name.text : '')

// Markup files: the same kinds, read from tags. Scripts, styles and Astro's front matter are left out; a `{...}`
// expression in the text is a slot it cannot read, reported as unmeasured when it is all the text there is.
const HTML_KIND = Object.fromEntries(Object.entries(TAG_KIND))
function collectMarkup(file) {
  let src = readFileSync(join(root, file), 'utf8')
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  src = src.replace(/<script[\s\S]*?<\/script>/gi, blank).replace(/<style[\s\S]*?<\/style>/gi, blank)
  if (file.endsWith('.astro')) src = src.replace(/^---[\s\S]*?\n---/, blank)
  const lineAt = (i) => src.slice(0, i).split('\n').length
  const found = []
  const tags = Object.keys(HTML_KIND).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`<(${tags.join('|')})(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>`, 'g')
  for (const m of src.matchAll(re)) {
    const kind = HTML_KIND[m[1]]
    const inner = m[3]
    const EXPR = /\{\{[\s\S]*?\}\}|\{[^}]*\}/g
    const exprs = inner.match(EXPR) ?? []
    const text = inner.replace(EXPR, ' X ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
    const line = lineAt(m.index)
    const end = lineAt(m.index + m[0].length)
    const words = text.replace(/\bX\b/g, '').trim()
    if (/[A-Za-z]/.test(words)) found.push({ file, line, end, kind, text, words: wordsOf(text) })
    else if (exprs.length) found.push({ file, line, end, kind, opaque: exprs[0].replace(/^\{+|\}+$/g, '').trim() })
  }
  // Words directly inside any other element with no child tags, the markup form of the JSX rule above.
  for (const m of src.matchAll(/<([a-z][\w-]*)\b[^>]*>([^<{]*[A-Za-z][^<{]*)<\/\1>/g)) {
    if (HTML_KIND[m[1]]) continue
    const text = m[2].replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
    if (wordsOf(text) > 3) found.push({ file, line: lineAt(m.index), end: lineAt(m.index + m[0].length), kind: 'text', text, words: wordsOf(text) })
  }
  for (const m of src.matchAll(/\s(title|placeholder|aria-label|alt)="([^"]{1,400})"/g)) {
    const kind = m[1] === 'placeholder' ? 'placeholder' : m[1] === 'title' ? 'title' : null
    if (kind && /[A-Za-z]/.test(m[2])) found.push({ file, line: lineAt(m.index), end: lineAt(m.index), kind, text: m[2], words: wordsOf(m[2]) })
  }
  return found
}

function collect(file) {
  if (matchesAny(file, MARKUP_FILES)) return collectMarkup(file)
  const src = readFileSync(join(root, file), 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  consts = new Map()
  const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined)
  const unwrap = (n) => (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n)) ? unwrap(n.expression) : n)
  const scan = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const init = unwrap(node.initializer)
      if (literal(init) !== undefined) consts.set(node.name.text, literal(init))
      else if (init && ts.isObjectLiteralExpression(init)) {
        const obj = {}
        for (const p of init.properties) if (ts.isPropertyAssignment(p) && literal(unwrap(p.initializer)) !== undefined) obj[p.name.getText(sf)] = literal(unwrap(p.initializer))
        consts.set(node.name.text, obj)
      }
    }
    ts.forEachChild(node, scan)
  }
  scan(sf)
  // Every slot is measured through here: `get` reads the text with `opaque` reset, so a slot whose words could not be
  // read is recorded as such.
  const add = (kind, node, get) => {
    opaque = []
    const clean = get().replace(/\s+/g, ' ').trim()
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1
    if (/[A-Za-z]/.test(clean)) found.push({ file, line, end, kind, text: clean, words: wordsOf(clean) })
    else if (opaque.length) found.push({ file, line, end, kind, opaque: opaque[0] })
  }
  const measured = new Set()
  const visit = (node) => {
    if (ts.isJsxElement(node) && !measured.has(node)) {
      const kind = TAG_KIND[tagName(node.openingElement)]
      if (kind) {
        // `<Button asChild><Link>Save changes</Link></Button>`: the words sit one element down. Followed through an
        // element with no kind of its own; under `asChild` the child IS this element, so it is followed whatever its
        // tag and not measured again as itself.
        const asChild = node.openingElement.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'asChild')
        // Whitespace-only text is the line breaks a formatter puts around a wrapped child; it is not copy, and treating
        // it as copy stopped the walk before the words, so a wrapped label was never measured.
        let holder = node
        while (!holder.children.some((c) => ts.isJsxText(c) && textOf(c).trim())) {
          const inner = holder.children.filter((c) => ts.isJsxElement(c))
          if (inner.length !== 1 || (!asChild && TAG_KIND[tagName(inner[0].openingElement)])) break
          holder = inner[0]
          if (asChild) measured.add(holder)
        }
        const inline = (el) =>
          el.children
            .map((c) =>
              ts.isJsxText(c) || ts.isJsxExpression(c)
                ? textOf(c)
                : ts.isJsxElement(c) && INLINE.has(tagName(c.openingElement))
                  ? inline(c)
                  : '',
            )
            .join(' ')
        if (holder.children.length) add(kind, node, () => inline(holder))
      }
    }
    // Any other element's own words, inline children left to their sentence: an explainer in a plain <div> or
    // <span> is the commonest correction, and it fell outside every kind.
    if (ts.isJsxElement(node) && !measured.has(node) && !TAG_KIND[tagName(node.openingElement)]) {
      const own = node.children.filter((c) => ts.isJsxText(c) && c.text.trim())
      if (own.length) add('text', node, () => own.map((c) => c.text).join(' '))
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer) continue
        const kind = ATTR_KIND[attr.name.getText(sf)]
        if (kind) add(kind, attr, () => textOf(attr.initializer))
      }
    }
    // toast('...'), toast.success('...'), setToast({ text }), onDone({ text }): any call that reports an act.
    // Matched on the callee's own name segments, so `abandoned()` or `isDone()` is not taken for a toast.
    if (ts.isCallExpression(node) && node.expression.getText(sf).split('.').some((part) => /^(toast\w*|\w*Toast|notify\w*|receipt\w*|onDone|done)$/i.test(part))) {
      const arg = node.arguments[0]
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) if (ts.isPropertyAssignment(p) && /^(text|title|message)$/.test(p.name.getText(sf))) add('toast', p, () => textOf(p.initializer))
      } else if (arg) add('toast', node, () => textOf(arg))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

let scope = null
let notClean = false
let files
if (ALL) {
  files = git(root, 'ls-files', '--', ...pathspec(config.ui)).split('\n').filter((f) => matchesAny(f, COPY_FILES))
} else {
  const base = baseArg(config, root)
  // The rendered files the hook reviews (`ui`), of the kinds this check reads: reading its own wider list flagged
  // files outside the change the reviewer was shown.
  const all = addedLines(root, base, config.ui)
  scope = new Map([...all].filter(([f]) => matchesAny(f, COPY_FILES)))
  files = [...scope.keys()]
  const listed = filesWithAdditions(root, base, config.ui).filter((f) => matchesAny(f, COPY_FILES) && !matchesAny(f, EXCLUDE))
  if (listed.length && !files.length) {
    console.log(`copy-length: NOT A CLEAN PASS. git lists ${listed.length} changed file(s) but none could be read; check their copy by hand.`)
    process.exit(2)
  }
  // Rendered files it cannot read: name them, so silence is never read as a pass. Stylesheets hold no copy.
  const unreadable = changedFiles(root, base, config.ui).filter((f) => !matchesAny(f, COPY_FILES) && !/\.(css|scss|sass|less)$/.test(f))
  if (unreadable.length) {
    notClean = true
    console.log(`copy-length: NOT RUN on ${unreadable.length} file(s) it cannot parse (${unreadable.slice(0, 5).join(', ')}); read their copy by hand.`)
  }
}
files = files.filter((f) => existsSync(join(root, f)) && !matchesAny(f, EXCLUDE))
const jsx = files.filter((f) => matchesAny(f, JSX_FILES))
if (!ts && jsx.length) {
  notClean = true
  console.log(`copy-length: NOT RUN on ${jsx.length} JSX file(s): the harness's TypeScript (bin/vendor) could not be loaded; reinstall the plugin.`)
  files = files.filter((f) => !jsx.includes(f))
}
if (!files.length) {
  console.log('copy-length: nothing it can parse changed')
  process.exit(notClean ? 2 : 0)
}

let items = files.flatMap(collect)
if (scope) {
  items = items.filter((i) => {
    const lines = scope.get(i.file)
    if (lines === 'all') return true
    for (let l = i.line; l <= i.end; l++) if (lines?.has(l)) return true
    return false
  })
}

if (SURVEY) {
  console.log('Paste the p95 of each kind into copyLimits in .claude/design-harness.json once the project has approved copy.')
  for (const kind of Object.keys(LIMITS)) {
    const ws = items.filter((i) => i.kind === kind).map((i) => i.words).sort((a, b) => a - b)
    if (!ws.length) continue
    const at = (p) => ws[Math.min(ws.length - 1, Math.floor(p * ws.length))]
    console.log(`${kind.padEnd(12)} n=${String(ws.length).padStart(4)}  p50=${at(0.5)}  p90=${at(0.9)}  p95=${at(0.95)}  max=${ws.at(-1)}  limit=${LIMITS[kind]}`)
  }
  process.exit(0)
}

const unmeasured = items.filter((i) => i.opaque)
items = items.filter((i) => !i.opaque)
const label = ALL ? 'in the project' : 'added on this branch'
console.log(`copy-length: ${items.length} strings ${label} measured, across ${new Set(items.map((i) => i.file)).size} files`)
if (unmeasured.length) {
  console.log(`copy-length: ${unmeasured.length} slot(s) hold copy it could not read (a prop, a call, an import); read them by hand:`)
  for (const i of unmeasured.slice(0, 15)) console.log(`  ${i.file}:${i.line}  ${i.kind} holds {${i.opaque}}`)
}
// Added lines with no copy in them (a logic change, a class name) are not a failure to read; the population line
// above says how much was measured.
if (!items.length && !unmeasured.length && !notClean) {
  console.log(`copy-length: no copy in the added lines of ${files.length} file(s)`)
  process.exit(0)
}
const over = items.filter((i) => i.words > LIMITS[i.kind])
if (!over.length) {
  if (unmeasured.length || notClean) {
    console.log('copy-length: NOT A CLEAN PASS. Every measured string is within its limit; what is named above was not measured.')
    process.exit(2)
  }
  console.log('copy-length: every one is within its limit')
  process.exit(0)
}
for (const i of over) console.log(`  ${i.file}:${i.line}  ${i.kind} is ${i.words} words (limit ${LIMITS[i.kind]}): "${i.text}"`)
console.log(`copy-length: ${over.length} over the limit. Cut each, or say why it needs the words.`)
process.exit(1)
