#!/usr/bin/env node
/**
 * Line breaks: where the browser actually broke each heading, paragraph, list item, label and caption, at a phone, a
 * tablet and a desktop width, and which breaks read badly.
 *
 * Why. A designer reads a paragraph's shape before its words: a last line holding one word, a line that ends on "the"
 * and leaves its noun on the next, a new sentence whose first word hangs at the end of a line. None of it shows in the
 * code, and every one moves with the width, so a single screenshot misses most of them. `text-wrap: pretty` (and
 * `balance` on headings) prevents many in Chrome and Safari; this finds the ones left, including in Firefox's place.
 *
 * Flags, per block and width: a last line of one word; a line ending on a word that leans on the next (`leanWords`
 * in .claude/design-harness.json, English by default); a sentence starting on the last word of a line.
 *
 * Usage: node check-breaks.mjs <local url, /path or project .html file> [more...]   (from the project root)
 * Exit: 0 clean · 1 breaks flagged · 2 not run, or not a clean pass (named).
 */
import { DEFAULTS, LEAN_WORDS, lineFlags, loadConfig, openBrowser, pageTargets } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const { targets, refused } = pageTargets(process.argv.slice(2).filter((a) => !a.startsWith('--')), config, root)
if (refused.length) {
  console.log(`breaks: NOT RUN. Only local addresses or HTML files inside the project are opened; refused: ${refused.join(', ')}`)
  process.exit(2)
}
if (!targets.length) {
  console.log('breaks: name the pages to check, e.g. node check-breaks.mjs / /pricing')
  process.exit(2)
}
let browser
try {
  browser = await openBrowser(root, config)
} catch (e) {
  console.log(`breaks: NOT RUN. The browser could not start: ${String(e.message ?? e).split('\n')[0]}`)
  process.exit(2)
}
if (!browser) {
  console.log('breaks: NOT RUN. The project has neither playwright nor puppeteer (npm i -D playwright).')
  process.exit(2)
}

const WIDTHS = [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1280, height: 900 }]]
const lean = config.leanWords ?? LEAN_WORDS

// In the page: each text block's visible lines, read from where its words were laid out. Words of a nested block
// belong to that block, not to the one around it.
function linesOfBlocks() {
  const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,label,legend,dd'
  const out = []
  for (const el of document.querySelectorAll(BLOCK)) {
    if (!el.offsetParent || el.closest('[aria-hidden="true"]')) continue
    const tops = new Map()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode
      if (t.parentElement.closest(BLOCK) !== el) continue
      for (const m of t.data.matchAll(/\S+/g)) {
        const r = document.createRange()
        r.setStart(t, m.index)
        r.setEnd(t, m.index + m[0].length)
        const rect = r.getClientRects()[0]
        if (!rect || !rect.width) continue
        const key = Math.round(rect.top / 4)
        tops.set(key, [...(tops.get(key) ?? []), m[0]])
      }
    }
    const lines = [...tops.keys()].sort((a, b) => a - b).map((k) => tops.get(k).join(' '))
    if (lines.length) out.push({ tag: el.tagName.toLowerCase(), lines })
  }
  return out
}

let read = 0
let flagged = 0
let unloaded = 0
try {
  for (const url of targets) {
    for (const [label, viewport] of WIDTHS) {
      const page = await browser.page({ colorScheme: 'light', viewport })
      const res = await page.goto(url).catch((e) => ({ error: e }))
      if (!res || res.error || res.status() >= 400) {
        console.log(`  ${url} [${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
        unloaded++
        await page.close()
        continue
      }
      await new Promise((r) => setTimeout(r, 800))
      const blocks = await page.evaluate(linesOfBlocks)
      read += blocks.length
      for (const { tag, lines } of blocks)
        for (const flag of lineFlags(lines, lean)) {
          flagged++
          console.log(`  ${new URL(url).pathname}${new URL(url).search} [${label}] ${tag} "${lines.join(' / ').slice(0, 90)}": ${flag}`)
        }
      await page.close()
    }
  }
} finally {
  await browser.close()
}
console.log(`breaks: ${read} text block(s) read across ${targets.length} page(s) at ${WIDTHS.length} widths, ${flagged} bad break(s)`)
if (flagged) process.exit(1)
if (unloaded || !read) {
  console.log(`breaks: NOT A CLEAN PASS. ${unloaded ? `${unloaded} page load(s) failed` : 'no text blocks were found'}, so nothing there was checked.`)
  process.exit(2)
}
process.exit(0)
