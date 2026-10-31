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
 * It parses with the project's own TypeScript, so `<Button>Save</Button>`, `title="..."` on any element and
 * `toast('...')` are each recognised for what they are. A template expression counts as one word. A ternary
 * counts its longer branch.
 *
 * Usage: node check-copy-length.mjs [--all | --survey | --base=<ref>]   (run from the project root)
 * Exit: 0 clean, or not measurable (said so) · 1 a string is over its limit · 2 setup problem.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULTS, addedLines, baseArg, changedFiles, git, loadConfig, matchesAny, pathspec, projectRequire } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const args = process.argv.slice(2)
const SURVEY = args.includes('--survey')
const ALL = args.includes('--all') || SURVEY

// Required only once there is something to parse, so the files it cannot read are named first, whatever happens.
const ts = projectRequire(root, 'typescript')

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
  ...(config.copyLimits ?? {}),
}

// Children of these elements are copy of that kind. Names cover Catalyst, shadcn/ui and Radix; a project adds
// its own in `copyTags`.
const TAG_KIND = {
  // Plain HTML too: the 2026-10-31 live trial added a native <button> with an 8-word label that only the reviewer
  // caught, because the list held component names alone.
  button: 'button',
  a: 'link',
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
const COPY_FILES = config.copyFiles ?? ['**/*.tsx', '**/*.jsx']
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
  if (ts.isBinaryExpression(node)) return longer(textOf(node.left), textOf(node.right))
  if (ts.isJsxFragment(node)) return node.children.map(textOf).join(' ')
  return ''
}
const tagName = (el) => (ts.isIdentifier(el.tagName) ? el.tagName.text : ts.isPropertyAccessExpression(el.tagName) ? el.tagName.name.text : '')

function collect(file) {
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
        let holder = node
        while (!holder.children.some((c) => ts.isJsxText(c) && textOf(c))) {
          const inner = holder.children.filter((c) => ts.isJsxElement(c))
          if (inner.length !== 1 || (!asChild && TAG_KIND[tagName(inner[0].openingElement)])) break
          holder = inner[0]
          if (asChild) measured.add(holder)
        }
        const parts = holder.children.filter((c) => ts.isJsxText(c) || ts.isJsxExpression(c))
        if (parts.length) add(kind, node, () => parts.map(textOf).join(' '))
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer) continue
        const kind = ATTR_KIND[attr.name.getText(sf)]
        if (kind) add(kind, attr, () => textOf(attr.initializer))
      }
    }
    // toast('...'), toast.success('...'), setToast({ text }), onDone({ text }): any call that reports an act.
    if (ts.isCallExpression(node) && /(toast|done|receipt|notify)/i.test(node.expression.getText(sf))) {
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
let files
if (ALL) {
  files = git(root, 'ls-files', '--', ...pathspec(COPY_FILES)).split('\n').filter(Boolean)
} else {
  const base = baseArg(config, root)
  scope = addedLines(root, base, COPY_FILES)
  files = [...scope.keys()]
  const listed = changedFiles(root, base, COPY_FILES).filter((f) => !matchesAny(f, EXCLUDE))
  if (listed.length && !files.length) {
    console.log(`copy-length: NOT A CLEAN PASS. git lists ${listed.length} changed file(s) but none could be read; check their copy by hand.`)
    process.exit(0)
  }
  // Rendered files this parser cannot read (Vue, Svelte, Astro): name them, so silence is never read as a pass.
  const unreadable = changedFiles(root, base, config.ui).filter((f) => !matchesAny(f, COPY_FILES) && !/\.(css|scss)$/.test(f))
  if (unreadable.length) console.log(`copy-length: NOT RUN on ${unreadable.length} file(s) it cannot parse (${unreadable.slice(0, 5).join(', ')}); read their copy by hand.`)
}
files = files.filter((f) => existsSync(join(root, f)) && !matchesAny(f, EXCLUDE))
if (!ts) {
  if (files.length) console.log(`copy-length: NOT RUN on ${files.length} file(s): this project has no typescript package to parse with (npm i -D typescript).`)
  else console.log('copy-length: nothing it can parse changed')
  process.exit(0)
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
if (!items.length && files.length) {
  console.log(`copy-length: NOT A CLEAN PASS. ${files.length} file(s) changed and no copy could be measured in them; read their strings by hand.`)
  process.exit(0)
}
const over = items.filter((i) => i.words > LIMITS[i.kind])
if (!over.length) {
  console.log(unmeasured.length ? 'copy-length: NOT A CLEAN PASS. Every measured string is within its limit; the slots above were not measured.' : 'copy-length: every one is within its limit')
  process.exit(0)
}
for (const i of over) console.log(`  ${i.file}:${i.line}  ${i.kind} is ${i.words} words (limit ${LIMITS[i.kind]}): "${i.text}"`)
console.log(`copy-length: ${over.length} over the limit. Cut each, or say why it needs the words.`)
process.exit(1)
