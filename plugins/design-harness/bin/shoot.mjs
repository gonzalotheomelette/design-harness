#!/usr/bin/env node
/**
 * Screenshots of pages a change reaches, at desktop and phone width, in light and dark, for the reviewer to look at.
 *
 * Why. Some slips only show in a picture: an action placed differently from its sibling's, a line that wraps on a
 * phone, a colour that dies in dark mode. A blind benchmark of reviewers reading code alone missed every one of
 * those. A project with its own screenshot tool (personas, seeded state) names it in `screenshot` in
 * .claude/design-harness.json and the reviewer uses that instead.
 *
 * Usage: node shoot.mjs <url or /path> [more...]   (from the project root)
 * Prints the path of every image it wrote, in a temp folder.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS, loadConfig, openBrowser } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const targets = process.argv.slice(2).map((t) => (t.startsWith('http') ? t : new URL(t, config.devServer).href))
const browser = await openBrowser(root, config)
if (!browser) {
  console.log('shoot: NOT RUN. The project has neither playwright nor puppeteer (npm i -D playwright).')
  process.exit(2)
}
const out = mkdtempSync(join(tmpdir(), 'ui-review-'))
try {
  for (const url of targets) {
    const slug = new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'
    for (const colorScheme of ['light', 'dark']) {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const page = await browser.page({ colorScheme, viewport })
        const res = await page.goto(url).catch((e) => ({ error: e }))
        if (!res || res.error || res.status() >= 400) {
          console.log(`  ${url} [${colorScheme}, ${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
        } else {
          const file = join(out, `${slug}-${label}-${colorScheme}.png`)
          await page.screenshot(file)
          console.log(`  ${file}`)
        }
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
}
