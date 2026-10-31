#!/usr/bin/env node
/**
 * Accessibility: axe over the pages a change reaches, in light and dark, at desktop and phone widths.
 *
 * Why. Contrast, names, roles and focus are the failures a designer cannot see by looking, and they are the
 * ones a client's audit finds first. Running both colour modes matters because a token that passes in light
 * routinely fails in dark. Only WCAG 2.x A and AA rules run; best-practice rules are left out, so a finding is a
 * real failure rather than advice.
 *
 * It uses the project's own browser library (Playwright with @axe-core/playwright, or Puppeteer with
 * @axe-core/puppeteer) and the dev server the project already runs. It never starts a server.
 *
 * Usage: node check-a11y.mjs <local url or /path> [more...]   (from the project root; paths resolve against devServer;
 *        local addresses only)
 * Exit: 0 no serious or critical violations · 1 found · 2 setup problem (named).
 */
import { DEFAULTS, loadConfig, localTargets, openBrowser } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const { targets, refused } = localTargets(process.argv.slice(2).filter((a) => !a.startsWith('--')), config)
if (refused.length) {
  console.log(`a11y: NOT RUN. Only local addresses are opened (localhost, 127.0.0.1, *.localhost); refused: ${refused.join(', ')}`)
  process.exit(2)
}
if (!targets.length) {
  console.log('a11y: name the pages to check, e.g. node check-a11y.mjs /settings /settings/billing')
  process.exit(2)
}
// A browser that cannot start is a setup problem, not a finding: it used to throw, exit 1, and read as "violations
// found" to the reviewer.
let browser
try {
  browser = await openBrowser(root, config)
} catch (e) {
  console.log(`a11y: NOT RUN. The browser could not start: ${String(e.message ?? e).split('\n')[0]}`)
  process.exit(2)
}
if (!browser || !browser.hasAxe) {
  console.log(
    'a11y: NOT RUN. Add a browser and axe: npm i -D playwright @axe-core/playwright && npx playwright install chromium' +
      ' (or @axe-core/puppeteer beside an existing puppeteer).',
  )
  if (browser) await browser.close()
  process.exit(2)
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
let serious = 0
let runs = 0
let passed = 0
try {
  for (const url of targets) {
    for (const colorScheme of config.modes ?? ['light', 'dark']) {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const page = await browser.page({ colorScheme, viewport })
        const res = await page.goto(url).catch((e) => ({ error: e }))
        if (!res || res.error || res.status() >= 400) {
          console.log(`  ${url} [${colorScheme}, ${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
          serious++
          await page.close()
          continue
        }
        const { violations, passes } = await page.axe(TAGS)
        runs++
        // The population: a run that passed nothing checked nothing (a blank or still-loading page), which a
        // violation count of zero would otherwise report as clean.
        passed += passes.length
        if (!passes.length) console.log(`  ${url} [${colorScheme}, ${label}]: axe passed no rules, so the page was likely blank`)
        for (const v of violations) {
          if (v.impact === 'serious' || v.impact === 'critical') serious++
          console.log(`  ${url} [${colorScheme}, ${label}] ${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, first: ${v.nodes[0]?.target?.join(' ')})`)
        }
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
}
console.log(`a11y: ${targets.length} page(s), ${runs} page/mode/width runs with ${browser.kind}, ${passed} rule passes, ${serious} serious or critical`)
process.exit(serious ? 1 : 0)
