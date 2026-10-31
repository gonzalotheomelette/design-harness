#!/usr/bin/env node
/**
 * Accessibility: axe over the pages a change reaches, in light and dark, at desktop and phone widths.
 *
 * Why. Contrast, names, roles and focus are the failures a designer cannot see by looking, and they are the
 * ones a client's audit finds first. Running both colour modes matters because a token that passes in light
 * routinely fails in dark. Only WCAG 2.2 A and AA rules run; best-practice rules are left out, so a finding is
 * a real failure rather than advice.
 *
 * It uses the PROJECT's playwright and @axe-core/playwright (the kickoff adds them as devDependencies), and the
 * dev server the project already runs. It never starts a server.
 *
 * Usage: node check-a11y.mjs <url or /path> [more...]   (from the project root; paths resolve against devServer)
 * Exit: 0 no serious or critical violations · 1 found · 2 setup problem (named).
 */
import { DEFAULTS, loadConfig, projectRequire } from './lib.mjs'

const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const targets = process.argv.slice(2).map((t) => (t.startsWith('http') ? t : new URL(t, config.devServer).href))
if (!targets.length) {
  console.log('a11y: name the pages to check, e.g. node check-a11y.mjs /settings /settings/billing')
  process.exit(2)
}
const playwright = projectRequire(root, 'playwright') ?? projectRequire(root, '@playwright/test')
const axe = projectRequire(root, '@axe-core/playwright')
if (!playwright || !axe) {
  console.log('a11y: NOT RUN. Add the dev dependencies: npm i -D playwright @axe-core/playwright && npx playwright install chromium')
  process.exit(2)
}
const AxeBuilder = axe.default ?? axe.AxeBuilder ?? axe

const browser = await playwright.chromium.launch()
let serious = 0
let checked = 0
try {
  for (const url of targets) {
    for (const colorScheme of ['light', 'dark']) {
      for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const page = await browser.newPage({ colorScheme, viewport })
        const res = await page.goto(url, { waitUntil: 'networkidle' }).catch((e) => ({ error: e }))
        if (!res || res.error || res.status() >= 400) {
          console.log(`  ${url} [${colorScheme}, ${label}]: could not load (${res?.error?.message ?? res?.status?.()})`)
          serious++
          await page.close()
          continue
        }
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        checked++
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
console.log(`a11y: ${targets.length} page(s), ${checked} page/mode/width runs, ${serious} serious or critical`)
process.exit(serious ? 1 : 0)
