// Shared by the hook and every check: where the project keeps its harness settings, what counts as a rendered
// file, and what the branch is compared against. One place, so the hook and the checks never disagree about
// which change they are looking at.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { createRequire } from 'node:module'

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export const DEFAULTS = {
  // Rendered files. A project narrows these in .claude/design-harness.json when its UI lives elsewhere.
  ui: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/*.astro', '**/*.css'],
  // Files allowed to hold raw colour values and arbitrary sizes: the theme the tokens are written into.
  themeFiles: ['**/theme.css', '**/tokens.css', '**/globals.css', '**/tailwind.css', 'DESIGN.md'],
  rules: 'docs/ui-consistency.md',
  design: 'DESIGN.md',
  product: 'PRODUCT.md',
  requirements: 'docs/product',
  decisions: 'docs/decision-log.md',
  questions: 'docs/open-questions.md',
  copyRegister: null,
  devServer: 'http://localhost:3000',
  baseBranch: null,
  // One review per message from the person: a second review of the same turn mostly re-reads the first one's fixes,
  // and each costs a minute and a share of the plan.
  maxReviewsPerMessage: 1,
  // The colour modes the product ships. Screenshots and accessibility run in each; a light-only product says so here.
  modes: ['light', 'dark'],
}

// The default output buffer (1 MB) is smaller than the diff of one large refactor, and the hook then threw on every
// stop. 256 MB is far past any diff worth reviewing.
export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 })
}

export function gitDirOf(root) {
  const d = git(root, 'rev-parse', '--git-dir').trim()
  return isAbsolute(d) ? d : join(root, d)
}

// The working state as a tree object, untracked files included, written through a scratch index so the real one is
// untouched. Every check compares trees, so a new file, an edit and a monorepo subfolder all read the same way.
export function snapshot(root) {
  const env = { ...process.env, GIT_INDEX_FILE: join(gitDirOf(root), 'design-harness.index') }
  const run = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  try {
    run('read-tree', 'HEAD')
  } catch {
    run('read-tree', '--empty')
  }
  run('add', '-A', '--', '.')
  return run('write-tree').trim()
}

// The project's settings, or null when the harness has not been set up here (the hook then stays silent).
export function loadConfig(root) {
  const p = join(root, '.claude', 'design-harness.json')
  if (!existsSync(p)) return null
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf8')) }
  } catch {
    return null
  }
}

// What the branch is compared against: the configured base, else the remote's default branch, else the first
// commit (a new project with no remote yet), else the empty tree (no commits at all).
export function baseOf(root, config) {
  const tries = [config?.baseBranch, 'origin/HEAD', 'origin/main', 'origin/master'].filter(Boolean)
  for (const ref of tries) {
    try {
      return git(root, 'merge-base', 'HEAD', ref).trim()
    } catch {}
  }
  try {
    return git(root, 'rev-list', '--max-parents=0', 'HEAD').trim().split('\n').at(-1)
  } catch {
    return EMPTY_TREE
  }
}

export const pathspec = (globs) => globs.map((g) => `:(glob)${g}`)

// Lines added between `base` (a commit or a tree) and the working state, per file, paths relative to `root`.
// `--relative` keeps a monorepo package's paths joinable to its own folder: without it, git reported them from the
// repository root and every file silently failed to open, so the checks read nothing and passed.
export function addedLines(root, base, globs) {
  const map = new Map()
  let file = null
  const now = snapshot(root)
  for (const line of git(root, 'diff', '--relative', '-U0', base, now, '--', ...pathspec(globs)).split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6) : null
      continue
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (hunk && file) {
      const start = Number(hunk[1])
      const count = hunk[2] === undefined ? 1 : Number(hunk[2])
      if (!map.has(file)) map.set(file, new Set())
      for (let i = 0; i < count; i++) map.get(file).add(start + i)
    }
  }
  return map
}

// Every file under `globs` that differs between `base` and the working state, deletions left out.
export function changedFiles(root, base, globs) {
  return git(root, 'diff', '--relative', '--name-only', '--diff-filter=d', base, snapshot(root), '--', ...pathspec(globs))
    .split('\n')
    .filter(Boolean)
}

// The `--base=` a check was given, or the branch's base.
export const baseArg = (config, root) => process.argv.find((a) => a.startsWith('--base='))?.slice(7) || baseOf(root, config)

// A package resolved from the PROJECT, not from the plugin, which ships no node_modules of its own.
export function projectRequire(root, name) {
  try {
    return createRequire(join(root, 'package.json'))(name)
  } catch {
    return null
  }
}

// A browser from whatever the project already has: Playwright, else Puppeteer. A project should not have to add a
// second browser library for the harness, and the 2026-10-31 the client prototype trial had only Puppeteer. Pages come back with
// one shape whichever library is behind them: { goto, screenshot, axe, close }.
const BROWSERS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.BROWSER_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
export async function openBrowser(root, config) {
  const pw = projectRequire(root, 'playwright') ?? projectRequire(root, '@playwright/test')
  if (pw) {
    const axeLib = projectRequire(root, '@axe-core/playwright')
    const browser = await pw.chromium.launch()
    return {
      kind: 'playwright',
      hasAxe: !!axeLib,
      async page({ colorScheme = 'light', viewport }) {
        const page = await browser.newPage({ colorScheme, viewport })
        return {
          goto: (url) => page.goto(url, { waitUntil: 'networkidle' }),
          screenshot: (path) => page.screenshot({ path, fullPage: true }),
          axe: (tags) => new (axeLib.default ?? axeLib.AxeBuilder)({ page }).withTags(tags).analyze(),
          close: () => page.close(),
        }
      },
      close: () => browser.close(),
    }
  }
  const pp = projectRequire(root, 'puppeteer') ?? projectRequire(root, 'puppeteer-core')
  if (pp) {
    const axeLib = projectRequire(root, '@axe-core/puppeteer')
    const executablePath = config?.browserPath ?? BROWSERS.filter(Boolean).find((p) => existsSync(p))
    let browser
    try {
      browser = await pp.launch({ headless: true })
    } catch {
      browser = await pp.launch({ headless: true, executablePath })
    }
    return {
      kind: 'puppeteer',
      hasAxe: !!axeLib,
      async page({ colorScheme = 'light', viewport }) {
        const page = await browser.newPage()
        await page.setViewport(viewport)
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: colorScheme }])
        return {
          goto: (url) => page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }),
          screenshot: (path) => page.screenshot({ path, fullPage: true }),
          axe: (tags) => new (axeLib.AxePuppeteer ?? axeLib.default)(page).withTags(tags).analyze(),
          close: () => page.close(),
        }
      },
      close: () => browser.close(),
    }
  }
  return null
}

// `**/` is any depth, `**` anything, `*` anything within one folder. Placeholders first: the single-star step used to
// rewrite the `.*` the double-star step had just written, so `**/theme.css` matched one folder deep and no deeper,
// and a theme file at src/styles/theme.css was flagged as drift. tests/lib.test.mjs holds the cases.
export function globToRegExp(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')
  return new RegExp(`^${re}$`)
}
export const matchesAny = (file, globs) => globs.some((g) => globToRegExp(g).test(file))
