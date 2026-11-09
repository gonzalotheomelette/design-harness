#!/usr/bin/env node
/**
 * Screenshots of pages a change reaches, at desktop and phone width, in light and dark, for the reviewer to look at.
 *
 * Why. Some slips only show in a picture: an action placed differently from its sibling's, a line that wraps on a
 * phone, a colour that dies in dark mode. A blind benchmark of reviewers reading code alone missed every one of
 * those. A project with its own screenshot tool (personas, seeded state) names it in `screenshot` in
 * .claude/design-harness.json and the reviewer uses that instead.
 *
 * Usage: node shoot.mjs <local url, /path or project .html file> [more...] [--at=<css selector>] [--tiles=<n>]
 *        (from the project root; local addresses only)
 * Each page is captured as the screen a visitor sees, scrolled a screen at a time from the top, or from the element `--at` names, up to `--tiles`
 * (default 6) per mode and width: a single full-page capture of a long page reached the reviewer at about 155px wide
 * and could not be read. Prints the path of every image it wrote, in a temp folder, with the slice it covers.
 *
 * Before and after. Each capture is kept (in the repository's git folder, never the working tree) and the next
 * capture of the same screen is compared with it: when anything changed, a copy with the changed regions boxed in red
 * is written beside the picture and its regions printed. The reviewer looks at what moved instead of judging a whole
 * page, which is where a picture alone failed (docs/benchmark.md). Motion is settled before each capture (entrances at
 * their end, videos on their first frame), so a loop playing is not a change.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS, gitDirOf, loadConfig, openBrowser, pageTargets } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const { targets, refused } = pageTargets(process.argv.slice(2).filter((a) => !a.startsWith('--')), config, root)
if (refused.length) {
  console.log(`shoot: NOT RUN. Only local addresses or HTML files inside the project are opened; refused: ${refused.join(', ')}`)
  process.exit(2)
}
// A browser that cannot start is a setup problem, not a finding: it used to throw, exit 1, and read as "violations
// found" to the reviewer.
let browser
try {
  browser = await openBrowser(root, config)
} catch (e) {
  console.log(`shoot: NOT RUN. The browser could not start: ${String(e.message ?? e).split('\n')[0]}`)
  process.exit(2)
}
if (!browser) {
  console.log('shoot: NOT RUN. The project has neither playwright nor puppeteer (npm i -D playwright).')
  process.exit(2)
}
const AT = process.argv.find((a) => a.startsWith('--at='))?.slice(5) || null
const TILES = Math.max(1, Number(process.argv.find((a) => a.startsWith('--tiles='))?.slice(8)) || 6)
const out = mkdtempSync(join(tmpdir(), 'ui-review-'))
// the last capture of each screen, to compare the next one with; outside a repository there is nothing to keep it in
let kept = null
try {
  kept = join(gitDirOf(root), 'design-harness', 'shots')
  mkdirSync(kept, { recursive: true })
} catch {
  kept = null
}

// In the page: motion settled, so two captures of an unchanged screen match.
function settle() {
  const s = document.createElement('style')
  s.textContent = '*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition:none !important;caret-color:transparent !important}'
  document.head.append(s)
  for (const v of document.getElementsByTagName('video')) {
    v.pause()
    v.currentTime = 0
  }
}

// In a blank page: the cells of 16px that differ between two captures, banded into regions, and the new capture with
// them boxed. Self-contained: it is sent to the browser as source.
async function compareCaptures({ before, after }) {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `data:image/png;base64,${src}` })
  const [a, b] = await Promise.all([load(before), load(after)])
  if (a.width !== b.width || a.height !== b.height) return { resized: true }
  const W = b.width
  const H = b.height
  const draw = (img) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return [c, x] }
  const [, xa] = draw(a)
  const [cb, xb] = draw(b)
  const da = xa.getImageData(0, 0, W, H).data
  const db = xb.getImageData(0, 0, W, H).data
  const C = 16
  const cols = Math.ceil(W / C)
  const rows = Math.ceil(H / C)
  const hit = new Uint8Array(cols * rows)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) hit[((y / C) | 0) * cols + ((x / C) | 0)] = 1
    }
  const bands = []
  for (let r = 0; r < rows; r++) {
    let x0 = cols
    let x1 = -1
    for (let c = 0; c < cols; c++) if (hit[r * cols + c]) { x0 = Math.min(x0, c); x1 = Math.max(x1, c) }
    if (x1 < 0) continue
    const last = bands.at(-1)
    if (last && last.r1 === r - 1) { last.r1 = r; last.x0 = Math.min(last.x0, x0); last.x1 = Math.max(last.x1, x1) } else bands.push({ r0: r, r1: r, x0, x1 })
  }
  xb.fillStyle = 'rgba(230,40,40,.25)'
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (hit[r * cols + c]) xb.fillRect(c * C, r * C, C, C)
  xb.strokeStyle = 'rgb(230,40,40)'
  xb.lineWidth = 3
  for (const k of bands) xb.strokeRect(k.x0 * C, k.r0 * C, (k.x1 - k.x0 + 1) * C, (k.r1 - k.r0 + 1) * C)
  return { regions: bands.map((k) => ({ x: k.x0 * C, y: k.r0 * C, w: (k.x1 - k.x0 + 1) * C, h: (k.r1 - k.r0 + 1) * C })), png: bands.length ? cb.toDataURL('image/png').split(',')[1] : null }
}
let compare = null
const diffOf = async (file) => {
  const prev = kept && join(kept, file.split('/').at(-1))
  if (!prev) return
  if (existsSync(prev)) {
    compare ??= await browser.page({ colorScheme: 'light', viewport: { width: 400, height: 300 } }).then(async (p) => (await p.goto('about:blank'), p))
    const r = await compare.evaluate(compareCaptures, { before: readFileSync(prev).toString('base64'), after: readFileSync(file).toString('base64') }).catch(() => null)
    if (r && r.resized) console.log(`    not compared with the last capture: the screen's size changed`)
    else if (r && Array.isArray(r.regions) && !r.regions.length) console.log('    unchanged since the last capture')
    else if (r && r.png) {
      const diff = file.replace(/\.png$/, '-changed.png')
      writeFileSync(diff, Buffer.from(r.png, 'base64'))
      console.log(`  ${diff}  (changed since the last capture, boxed: ${r.regions.map((g) => `${g.w}x${g.h} at ${g.x},${g.y}`).join('; ')})`)
    }
  }
  copyFileSync(file, prev)
}
let shots = 0
let failed = 0
try {
  for (const url of targets) {
    // The query is part of the name: two routes that differ only after the ? (a page's variants, /method/?dir=m1 and
    // ?dir=m2) are different pictures. Named by the path alone they overwrote each other, and a direction packet of
    // five variants handed the critic five copies of the last one (2026-11-09).
    const { pathname, search } = new URL(url)
    const slug = (pathname + search).replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'
    for (const colorScheme of config.modes ?? ['light', 'dark']) {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const page = await browser.page({ colorScheme, viewport })
        const res = await page.goto(url).catch((e) => ({ error: e }))
        if (!res || res.error || res.status() >= 400) {
          console.log(`  ${url} [${colorScheme}, ${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
          failed++
        } else {
          const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0))
          let start = 0
          if (AT) {
            const top = await page.evaluate((sel) => {
              const el = document.querySelector(sel)
              return el ? el.getBoundingClientRect().top + window.scrollY : null
            }, AT)
            if (top === null) console.log(`  ${url} [${colorScheme}, ${label}]: nothing matches ${AT}; tiling from the top`)
            else start = Math.max(0, Math.floor(top) - 80)
          }
          await page.evaluate(settle)
          let n = 0
          for (let y = start; y < height && n < TILES; y += viewport.height, n++) {
            const file = join(out, `${slug}-${label}-${colorScheme}-${String(n + 1).padStart(2, '0')}.png`)
            const at = await page.tile(file, y)
            console.log(`  ${file}  (${label}, ${colorScheme}, scrolled to ${at}px of ${height})`)
            shots++
            await diffOf(file)
          }
          const left = Math.ceil((height - start) / viewport.height) - n
          if (left > 0) console.log(`  ${url} [${colorScheme}, ${label}]: ${left} more slice(s) below; use --at=<selector> to start lower`)
        }
        await page.close()
      }
    }
  }
} finally {
  await compare?.close()
  await browser.close()
}
// A run that loaded nothing took no pictures; exit 0 read as "looked, and fine".
console.log(`shoot: ${shots} screenshot(s)${failed ? `, ${failed} page load(s) failed` : ''}`)
process.exit(failed ? 2 : 0)
