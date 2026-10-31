#!/usr/bin/env node
/**
 * Screenshots of pages a change reaches, at desktop and phone width, in light and dark, for the reviewer to look at.
 *
 * Why. Some slips only show in a picture: an action placed differently from its sibling's, a line that wraps on a
 * phone, a colour that dies in dark mode. A blind benchmark of reviewers reading code alone missed every one of
 * those. A project with its own screenshot tool (personas, seeded state) names it in `screenshot` in
 * .claude/design-harness.json and the reviewer uses that instead.
 *
 * Usage: node shoot.mjs <local url or /path> [more...]   (from the project root; local addresses only)
 * Prints the path of every image it wrote, in a temp folder.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS, loadConfig, localTargets, openBrowser } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const { targets, refused } = localTargets(process.argv.slice(2).filter((a) => !a.startsWith('--')), config)
if (refused.length) {
  console.log(`shoot: NOT RUN. Only local addresses are opened (localhost, 127.0.0.1, *.localhost); refused: ${refused.join(', ')}`)
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
const out = mkdtempSync(join(tmpdir(), 'ui-review-'))
let shots = 0
let failed = 0
try {
  for (const url of targets) {
    const slug = new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'
    for (const colorScheme of config.modes ?? ['light', 'dark']) {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const page = await browser.page({ colorScheme, viewport })
        const res = await page.goto(url).catch((e) => ({ error: e }))
        if (!res || res.error || res.status() >= 400) {
          console.log(`  ${url} [${colorScheme}, ${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
          failed++
        } else {
          const file = join(out, `${slug}-${label}-${colorScheme}.png`)
          await page.screenshot(file)
          console.log(`  ${file}`)
          shots++
        }
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
}
// A run that loaded nothing took no pictures; exit 0 read as "looked, and fine".
console.log(`shoot: ${shots} screenshot(s)${failed ? `, ${failed} page load(s) failed` : ''}`)
process.exit(failed ? 2 : 0)
