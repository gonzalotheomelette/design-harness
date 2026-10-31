#!/usr/bin/env node
/**
 * Drift: values that bypass the design tokens, on lines this branch added.
 *
 * Why. A design system erodes one hardcoded value at a time: a raw hex because the token was not at hand, a
 * `w-[13px]` because the scale step felt one pixel off, an `!important` to beat a component instead of fixing
 * it. Each is invisible on the day and each one is a second source of truth. Only lines added on the branch are
 * read, so an older codebase never blocks new work; the theme files the tokens live in are exempt.
 *
 * Flags:
 *   colour   a raw colour literal (hex, rgb/hsl/oklch/oklab/lab/lch), or a named CSS colour set on a colour property
 *            (`color: 'red'` in a style object, `background: white` in a stylesheet)
 *   palette  a Tailwind default palette class (`bg-blue-600`, `text-gray-500`): the theme's tokens are the palette.
 *            A project whose tokens ARE Tailwind's palette sets `"allowPalette": true`
 *   size     a Tailwind arbitrary value holding a length, calc() or colour (`p-[13px]`, `grid-cols-[200px_1fr]`,
 *            `w-[calc(100%-13px)]`, `text-[#333]`)
 *   forced   an important override (`!text-red-700`, `text-red-700!`, `!important`): the component lost and was
 *            beaten at the call site instead of fixed where it lives
 *
 * A line can opt out with a trailing comment containing `drift-ok: <reason>`, which the reviewer reads.
 *
 * Usage: node check-drift.mjs [--base=<ref>]   (from the project root)
 * Exit: 0 clean · 1 drift found · 2 not a clean pass (nothing it could read, or a bad --base).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULTS, addedLines, baseArg, changedFiles, loadConfig, matchesAny, projectRequire } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const base = baseArg(config, root)
const scope = addedLines(root, base, config.ui)
// The project's TypeScript, when it has one, finds strings exactly; without it a scanner stands in.
const ts = projectRequire(root, 'typescript')

// Named colours a hand reaches for; the full CSS list is mostly ones nobody types (papayawhip).
const NAMED =
  'black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|' +
  'coral|tomato|gold|crimson|indigo|violet|salmon|beige|ivory|khaki|lavender|tan|brown|cyan|magenta|whitesmoke|' +
  'gainsboro|lightgray|lightgrey|darkgray|darkgrey|dimgray|slategray|snow|linen'
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const RULES = [
  ['size', /\b[\w:-]+-\[[^\]\s]*?(?:\d(?:px|rem|em|vh|vw|svh|dvh|lvh|ch|%)|calc\(|#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch)\()[^\]\s]*\]/],
  ['colour', /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/],
  ['colour', new RegExp(`(?:^|[\\s;{])(?:color|background(?:-color)?|border(?:-[a-z]+)?-?color|border|fill|stroke|outline(?:-color)?)\\s*:[^;{}]*?(?<![\\w-])(?:${NAMED})(?![\\w-])`, 'i')],
  ...(config.allowPalette
    ? []
    : [['palette', new RegExp(`(?:^|[\\s"'\`:])(?:bg|text|border|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(?:${PALETTE})-(?:50|[1-9]00|950)(?:/\\d+)?(?=$|[\\s"'\`])`)]]),
  ['forced', /(?:^|[\s"'`])![a-z][\w:-]*|\b[a-z][\w-]*-[\w/.-]+!(?=[\s"'`]|$)|!important/],
]

// The string content on each line of a component, template literals that span lines included. Matching quotes one line
// at a time missed a class list written as a multi-line template literal, which is how long class lists get written.
// A quote or apostrophe left open at a line end is JSX text ("Don't"), not a string: JavaScript does not let ' or "
// strings cross lines, so the scan returns to code there. Comments are skipped; a ${} inside a template is code.
function stringsByLine(lines) {
  const out = new Map()
  const add = (n, t) => t && (out.get(n) ?? out.set(n, []).get(n)).push(t)
  let state = 'code'
  const stack = []
  for (let n = 1; n <= lines.length; n++) {
    const line = lines[n - 1]
    let buf = ''
    if (state === "'" || state === '"') state = 'code'
    if (state === 'line-comment') state = 'code'
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (state === 'block-comment') {
        if (c === '*' && line[i + 1] === '/') (state = stack.pop() ?? 'code'), i++
        continue
      }
      if (state === 'code') {
        if (c === '/' && line[i + 1] === '/') break
        if (c === '/' && line[i + 1] === '*') (stack.push('code'), (state = 'block-comment')), i++
        // An apostrophe between letters is a word in JSX text ("Don't"), not a quote.
        else if (c === "'" && /[A-Za-z]/.test(line[i - 1] ?? '') && /[A-Za-z]/.test(line[i + 1] ?? '')) continue
        else if (c === "'" || c === '"' || c === '`') (state = c), (buf = '')
        else if (c === '}' && stack.at(-1) === '`') (state = stack.pop()), (buf = '')
        else if (c === '{' && stack.length) stack.push('{')
        else if (c === '}' && stack.at(-1) === '{') stack.pop()
        continue
      }
      // inside a string
      if (c === '\\') {
        buf += line.slice(i, i + 2)
        i++
      } else if (c === state) {
        add(n, buf)
        buf = ''
        state = 'code'
      } else if (state === '`' && c === '$' && line[i + 1] === '{') {
        add(n, buf)
        buf = ''
        stack.push('`')
        state = 'code'
        i++
      } else buf += c
    }
    if (state === '`') add(n, buf)
  }
  return out
}

// The same map from the parsed file: every string and template piece, split onto the lines it spans.
function stringsByAst(file, src) {
  const out = new Map()
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
  ])
  // Strings that are not styling, whatever they look like: `href="#added"` is a valid hex colour.
  const NOT_STYLE = /^(href|id|to|htmlFor|for|key|name|src|alt|title|aria-[\w-]+|data-[\w-]+|role|type|target|rel)$/
  const ignored = (node) => {
    const p = node.parent
    if (p && ts.isJsxAttribute(p)) return NOT_STYLE.test(p.name.getText(sf))
    if (p && ts.isCallExpression(p)) return /querySelector|getElementById|scrollIntoView|push|replace|navigate/.test(p.expression.getText(sf))
    return p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p))
  }
  const visit = (node) => {
    // A colour property in a style object: `{ color: 'red' }` reads as the line a stylesheet would have.
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer) && /colou?r|background|fill|stroke|border|outline/i.test(node.name.getText(sf))) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
      ;(out.get(line) ?? out.set(line, []).get(line)).push(`color: ${node.initializer.text}`)
    }
    if (KINDS.has(node.kind) && !ignored(node)) {
      const start = node.getStart(sf)
      const first = sf.getLineAndCharacterOfPosition(start).line + 1
      src
        .slice(start, node.getEnd())
        .split('\n')
        .forEach((piece, k) => (out.get(first + k) ?? out.set(first + k, []).get(first + k)).push(piece))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const findings = []
let read = 0
for (const [file, lines] of scope) {
  if (matchesAny(file, config.themeFiles)) continue
  let text
  try {
    text = readFileSync(join(root, file), 'utf8').split('\n')
  } catch {
    continue
  }
  // In a stylesheet the whole line is styling. In a component only strings are (class names, inline styles): reading
  // the code too flagged `if (!paid)` as a forced override on the first the client prototype trial.
  const stylesheet = /\.(css|scss|sass|less)$/.test(file)
  const strings = stylesheet ? null : ts && /\.[jt]sx?$/.test(file) ? stringsByAst(file, text.join('\n')) : stringsByLine(text)
  // A <style> block in a .vue, .svelte, .astro or .html file is a stylesheet: its lines are read whole, like a .css
  // file's. Reading only its quoted strings passed `color: #ff0000` as clean.
  const inStyle = new Set()
  if (!stylesheet && !/\.[jt]sx?$/.test(file)) {
    let open = false
    text.forEach((line, i) => {
      if (/<style[\s>]/i.test(line)) open = true
      if (open) inStyle.add(i + 1)
      if (/<\/style>/i.test(line)) open = false
    })
  }
  text.forEach((line, i) => {
    if (lines !== 'all' && !lines.has(i + 1)) return
    read++
    const sheet = stylesheet || inStyle.has(i + 1)
    if (/drift-ok:/.test(line) || (sheet && /^\s*(\/\/|\*|\/\*)/.test(line))) return
    const haystacks = sheet ? [line.replace(/<\/?style[^>]*>/gi, '')] : (strings.get(i + 1) ?? [])
    for (const text of haystacks)
    for (const [kind, re] of RULES) {
      const m = text.match(re)
      // One finding per line: `text-[#d00]` is both an arbitrary value and a raw colour, and saying it twice is noise.
      if (m) {
        findings.push(`  ${file}:${i + 1}  ${kind}: ${m[0].trim()}`)
        break
      }
    }
  })
}

console.log(`drift: ${read} added line(s) read across ${scope.size} rendered file(s); theme files exempt`)
// The population from git's list of changed files, read independently of the line parser: when git's output was not
// what the parser expects, the parser found nothing and the check used to pass.
const unread = changedFiles(root, base, config.ui).filter((f) => !matchesAny(f, config.themeFiles)).length
if (!read && unread) {
  console.log(`drift: NOT A CLEAN PASS. ${unread} changed file(s) could not be read; check them by hand.`)
  process.exit(2)
}
if (!findings.length) {
  console.log('drift: no raw colours, arbitrary sizes or forced overrides')
  process.exit(0)
}
console.log(findings.join('\n'))
console.log(`drift: ${findings.length} value(s) bypass the tokens. Use the token, fix the component, or mark the line drift-ok with a reason.`)
process.exit(1)
