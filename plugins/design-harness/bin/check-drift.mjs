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
 *   colour   a raw colour literal (hex, rgb/hsl/oklch/oklab/lab/lch) in a rendered file
 *   size     a Tailwind arbitrary length or colour (`p-[13px]`, `text-[#333]`, `w-[37rem]`)
 *   forced   an important override (`!text-red-700`, `text-red-700!`, `!important`): the component lost and was
 *            beaten at the call site instead of fixed where it lives
 *
 * A line can opt out with a trailing comment containing `drift-ok: <reason>`, which the reviewer reads.
 *
 * Usage: node check-drift.mjs [--base=<ref>]   (from the project root)
 * Exit: 0 clean · 1 drift found.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULTS, addedLines, baseOf, loadConfig, matchesAny } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const baseArg = process.argv.find((a) => a.startsWith('--base='))?.slice(7)
const scope = addedLines(root, baseArg ?? baseOf(root, config), config.ui)

const RULES = [
  ['colour', /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/],
  ['size', /\b[\w:-]+-\[(?:-?\d*\.?\d+(?:px|rem|em|vh|vw|%)|#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch)\([^\]]*\))\]/],
  ['forced', /(?:^|[\s"'`])![a-z][\w:-]*|\b[a-z][\w-]*-[\w/.-]+!(?=[\s"'`]|$)|!important/],
]

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
  text.forEach((line, i) => {
    if (lines !== 'all' && !lines.has(i + 1)) return
    read++
    if (/drift-ok:/.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return
    for (const [kind, re] of RULES) {
      const m = line.match(re)
      // One finding per line: `text-[#d00]` is both an arbitrary value and a raw colour, and saying it twice is noise.
      if (m) {
        findings.push(`  ${file}:${i + 1}  ${kind}: ${m[0].trim()}`)
        break
      }
    }
  })
}

console.log(`drift: ${read} added line(s) read across ${scope.size} rendered file(s); theme files exempt`)
if (!findings.length) {
  console.log('drift: no raw colours, arbitrary sizes or forced overrides')
  process.exit(0)
}
console.log(findings.join('\n'))
console.log(`drift: ${findings.length} value(s) bypass the tokens. Use the token, fix the component, or mark the line drift-ok with a reason.`)
process.exit(1)
