#!/usr/bin/env node
/**
 * Layout: what a picture shows and a reviewer reading the picture misses, measured on the laid-out page at a phone,
 * a tablet and a desktop width.
 *
 * Why. Given screenshots, the reviewer caught none of the website's seven corrections that only show on the page
 * (docs/benchmark.md, 0.12.1). A model reading a picture describes it; it does not see that a block starts a column
 * off, that one date sits beside its dots and the next under them, or that a row runs off a phone. Those are numbers,
 * so this measures them. The rules are lib.mjs's layoutFlags:
 *   - anything past the screen's edge, and a page that scrolls sideways
 *   - repeated siblings in a row that lay out their parts two ways, or whose last item wraps onto a line of its own
 *   - on a many-column grid, a text block that starts a column or so off the edge its siblings share
 * Positions are read from layout (offsets), not from the screen, so an entrance animation mid-flight changes nothing.
 *
 * Usage: node check-layout.mjs <local url, /path or project .html file> [more...]   (from the project root)
 * Exit: 0 clean · 1 flagged · 2 not run, or not a clean pass (named).
 */
import { DEFAULTS, layoutFlags, loadConfig, openBrowser, pageTargets } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const { targets, refused } = pageTargets(process.argv.slice(2).filter((a) => !a.startsWith('--')), config, root)
if (refused.length) {
  console.log(`layout: NOT RUN. Only local addresses or HTML files inside the project are opened; refused: ${refused.join(', ')}`)
  process.exit(2)
}
if (!targets.length) {
  console.log('layout: name the pages to check, e.g. node check-layout.mjs / /pricing')
  process.exit(2)
}
let browser
try {
  browser = await openBrowser(root, config)
} catch (e) {
  console.log(`layout: NOT RUN. The browser could not start: ${String(e.message ?? e).split('\n')[0]}`)
  process.exit(2)
}
if (!browser) {
  console.log('layout: NOT RUN. The project has neither playwright nor puppeteer (npm i -D playwright).')
  process.exit(2)
}

// Phones are measured at 360, the narrowest common width, where a row that fits at 390 still breaks.
const WIDTHS = [['phone', { width: 360, height: 780 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1280, height: 900 }]]

// In the page. Self-contained: it is sent to the browser as source.
function measureLayout() {
  const width = document.documentElement.clientWidth
  const part = (e) => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + [...e.classList].slice(0, 2).map((c) => `.${c}`).join('')
  const name = (el) => (el.parentElement && el.parentElement !== document.body ? `${part(el.parentElement)} > ` : '') + part(el)
  // the layout box, summed up the offset chain: transforms (an entrance mid-flight) do not move it
  const box = (el) => {
    let left = 0
    let top = 0
    for (let e = el; e; e = e.offsetParent) {
      left += e.offsetLeft
      top += e.offsetTop
    }
    return { left: Math.round(left), top: Math.round(top), width: el.offsetWidth, height: el.offsetHeight }
  }
  // what is on the page to see: decorative marks hidden from screen readers (aria-hidden) still count
  const shown = (el) => {
    if (!(el instanceof HTMLElement) || el.closest('[hidden]')) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || (el.offsetParent === null && s.position !== 'fixed')) return false
    return el.offsetWidth > 2 && el.offsetHeight > 2
  }
  // past the edge on purpose: inside a strip that swipes sideways, inside a crop narrower than the screen (a tile
  // cropping its image), or moving (a marquee). A wrapper that clips at the screen's own edge is not a purpose: what
  // it cuts off is simply gone, which is the slip.
  const contained = (el) => {
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.animationName !== 'none') return true
      if (e === el) continue
      if (/auto|scroll/.test(s.overflowX)) return true
      if (/hidden|clip/.test(s.overflowX)) {
        const b = box(e)
        if (b.left > 1 || b.left + b.width < width - 1) return true
      }
    }
    return false
  }
  const all = [...document.body.querySelectorAll('*')].filter(shown)

  const overflow = []
  const reported = new Set()
  for (const el of all) {
    // a run of inline text has no box of its own: its offsets span every line it wraps over; its block is measured
    if (getComputedStyle(el).display === 'inline') continue
    if ([...reported].some((r) => r.contains(el)) || contained(el)) continue
    // past the edge by its layout box AND as drawn: a box centred with a transform (left 50%, translate -50%) is only
    // past it by layout, and an entrance mid-flight only as drawn
    const b = box(el)
    const r = el.getBoundingClientRect()
    const past = (left, right) => right > width + 1 || left < -1
    if (past(b.left, b.left + b.width) && past(r.left + window.scrollX, r.right + window.scrollX)) {
      overflow.push({ name: name(el), left: b.left, right: b.left + b.width })
      reported.add(el)
    }
  }

  const groups = []
  for (const el of all) {
    const d = getComputedStyle(el).display
    if (!/flex|grid/.test(d)) continue
    const kids = [...el.children].filter(shown)
    if (kids.length < 3) continue
    const sig = (k) => `${k.tagName}.${[...k.classList].sort().join('.')}`
    const counts = new Map()
    for (const k of kids) counts.set(sig(k), (counts.get(sig(k)) ?? 0) + 1)
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0]
    if (n < 3 || n < kids.length * 0.6) continue
    const items = kids.filter((k) => sig(k) === top).map((k) => {
      const parts = [...k.children].filter(shown)
      let stacked = null
      if (parts.length >= 2) {
        const a = box(parts[0])
        const z = box(parts.at(-1))
        if (z.top >= a.top + a.height - 2) stacked = true
        else if (z.left >= a.left + a.width - 2) stacked = false
      }
      return { ...box(k), stacked, label: (k.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30) }
    })
    groups.push({ name: name(el), items })
  }

  // placed blocks: text blocks that are children of a grid of eight or more columns, desktop widths only
  const blocks = []
  if (width >= 1024)
    for (const el of all) {
      const p = el.parentElement
      if (!p || getComputedStyle(p).display !== 'grid') continue
      const cols = getComputedStyle(p).gridTemplateColumns.split(' ').filter((t) => /px$/.test(t)).length
      if (cols < 8 || (el.textContent ?? '').trim().length < 20 || el.offsetWidth < 120) continue
      const gap = parseFloat(getComputedStyle(p).columnGap) || 0
      blocks.push({ name: name(el), left: box(el).left, pitch: (p.clientWidth + gap) / cols })
    }

  return { width, scrollWidth: document.documentElement.scrollWidth, overflow, groups, blocks }
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
      const m = await page.evaluate(measureLayout)
      read++
      for (const flag of layoutFlags(m)) {
        flagged++
        console.log(`  ${new URL(url).pathname} [${label}, ${viewport.width}px] ${flag}`)
      }
      await page.close()
    }
  }
} finally {
  await browser.close()
}
console.log(`layout: ${targets.length} page(s) measured at ${WIDTHS.length} widths, ${flagged} layout problem(s)`)
if (flagged) process.exit(1)
if (unloaded || !read) {
  console.log(`layout: NOT A CLEAN PASS. ${unloaded} page load(s) failed, so nothing there was measured.`)
  process.exit(2)
}
process.exit(0)
