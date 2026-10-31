// Shared by the hook and every check: where the project keeps its harness settings, what counts as a rendered
// file, and what the branch is compared against. One place, so the hook and the checks never disagree about
// which change they are looking at.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { createRequire } from 'node:module'

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export const DEFAULTS = {
  // Rendered files. A project narrows these in .claude/design-harness.json when its UI lives elsewhere.
  // Plain .ts is left out on purpose: it is mostly logic and server code, and chart colours and fixtures there read as
  // drift. Markdown content (.mdx) is prose, not interface copy.
  ui: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/*.astro', '**/*.html', '**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
  // Files allowed to hold raw colour values and arbitrary sizes: the theme the tokens are written into.
  // design/ holds the mood board and the style tile, which show raw swatches on purpose.
  themeFiles: ['**/theme.css', '**/tokens.css', '**/globals.css', '**/tailwind.css', 'DESIGN.md', 'design/**'],
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
// stop. 256 MB is far past any diff worth reviewing. `core.quotePath=false` keeps non-ASCII paths readable.
export function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 256 * 1024 * 1024,
  })
}

// Every diff the harness parses goes through here. A user's `diff.noprefix`, `diff.external` (difftastic and the
// like) or colour settings changed the output the parser expects, and the checks then read nothing and passed.
export const gitDiff = (root, ...args) => git(root, 'diff', '--no-ext-diff', '--no-color', '--src-prefix=a/', '--dst-prefix=b/', ...args)

export function gitDirOf(root) {
  const d = git(root, 'rev-parse', '--git-dir').trim()
  return isAbsolute(d) ? d : join(root, d)
}

// Folders that are never the product's rendered source, excluded from every pathspec even where a project has no
// .gitignore yet (a new project's node_modules was otherwise hashed into every snapshot). Build output is excluded
// only at the root: at any depth, `dist`, `build` and `coverage` are also route names, and a page at
// src/app/coverage/page.tsx was never reviewed.
const NEVER = ['**/node_modules/**', '**/.next/**', 'dist/**', 'build/**', '.turbo/**', 'coverage/**']
export const pathspec = (globs) => [...globs.map((g) => `:(glob)${g}`), ...NEVER.map((g) => `:(exclude,glob)${g}`)]

// The working state of the rendered files as a tree object, untracked files included, written through a scratch
// index so the real one is untouched. It starts from a copy of the real index, so git reuses its record of which
// files are unchanged instead of re-hashing the project, and adds only the rendered files. Each call has its own
// scratch index: one shared file made two checks run side by side crash every time, each rewriting the other's index.
export function snapshot(root, globs = DEFAULTS.ui) {
  const gitDir = gitDirOf(root)
  const scratch = join(gitDir, `design-harness.${process.pid}.${Math.random().toString(36).slice(2)}.index`)
  try {
    return writeSnapshot(root, globs, scratch)
  } finally {
    rmSync(scratch, { force: true })
    rmSync(`${scratch}.lock`, { force: true })
  }
}
function writeSnapshot(root, globs, scratch) {
  const real = git(root, 'rev-parse', '--git-path', 'index').trim()
  const realPath = isAbsolute(real) ? real : join(root, real)
  const env = { ...process.env, GIT_INDEX_FILE: scratch }
  const run = (args, input) =>
    execFileSync('git', args, { cwd: root, env, input, encoding: 'utf8', stdio: [input ? 'pipe' : 'ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  if (existsSync(realPath)) {
    // The copy keeps the real index's timestamp. Git compares each entry's time with the index file's own to decide
    // which same-second edits it must re-read ("racily clean" entries); a copy stamped now made a same-size edit
    // made within a second of the last commit look unchanged. The tests caught it as a flake.
    copyFileSync(realPath, scratch)
    const { atime, mtime } = statSync(realPath)
    utimesSync(scratch, atime, mtime)
  }
  else run(['read-tree', '--empty'])
  // Only the rendered files that differ from the index: new, edited or deleted. ls-files, unlike add, accepts a
  // pattern that matches nothing (a project with no .css yet), which made the first version of this fail.
  const paths = run(['ls-files', '-z', '--others', '--modified', '--deleted', '--exclude-standard', '--', ...pathspec(globs)])
  if (paths) run(['update-index', '--add', '--remove', '-z', '--stdin'], paths)
  return run(['write-tree']).trim()
}

// Snapshot trees are referenced by nothing, so `git gc` prunes them after about two weeks, and a log pointing at a
// pruned tree made the hook fail on every turn after. Keeping each one under a per-worktree ref stops the pruning;
// treeExists lets a caller fall back if one is gone anyway.
export function keepTree(root, name, tree) {
  try {
    git(root, 'update-ref', `refs/worktree/design-harness/${name}`, tree)
  } catch {}
}
export function treeExists(root, tree) {
  if (!tree) return false
  try {
    git(root, 'cat-file', '-e', `${tree}^{tree}`)
    return true
  } catch {
    return false
  }
}

// The project's settings, or null when the harness has not been set up here (the hook then stays silent). The copy
// in the last commit wins over the working copy: a change can edit the working copy (narrow `ui` until nothing it
// touched counts as rendered, or point `browserPath` at a program), and a blind review showed both. A project that
// has not committed its settings yet uses the working copy, so a kickoff works before its first commit.
//
// The two settings that name something to RUN, `screenshot` (a command) and `browserPath` (a program), are never read
// from the project's settings, committed or not: a cloned repository could otherwise hand the session a command
// through the hook's own instructions. They live in `.claude/design-harness.local.json`, which is read only while git
// does not track it, so it is always this machine's.
const LOCAL_ONLY = ['screenshot', 'browserPath']
export function loadConfig(root) {
  const p = join(root, '.claude', 'design-harness.json')
  let text = null
  try {
    text = git(root, 'show', 'HEAD:./.claude/design-harness.json')
  } catch {}
  if (text === null && existsSync(p)) text = readFileSync(p, 'utf8')
  if (text === null) return null
  let shared
  try {
    shared = JSON.parse(text)
  } catch {
    return null
  }
  for (const k of LOCAL_ONLY) delete shared[k]
  return { ...DEFAULTS, ...shared, ...localConfig(root) }
}
function localConfig(root) {
  const p = join(root, '.claude', 'design-harness.local.json')
  if (!existsSync(p)) return {}
  try {
    git(root, 'ls-files', '--error-unmatch', '--', p)
    return {} // tracked, so it came with the repository, not from this machine
  } catch {}
  try {
    const local = JSON.parse(readFileSync(p, 'utf8'))
    return Object.fromEntries(LOCAL_ONLY.filter((k) => typeof local[k] === 'string').map((k) => [k, local[k]]))
  } catch {
    return {}
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

// Lines added between `base` (a commit or a tree) and the working state, per file, paths relative to `root`.
// `--relative` keeps a monorepo package's paths joinable to its own folder: without it, git reported them from the
// repository root and every file silently failed to open, so the checks read nothing and passed.
export function addedLines(root, base, globs) {
  const map = new Map()
  let file = null
  const now = snapshot(root, globs)
  for (const line of gitDiff(root, '--relative', '-U0', base, now, '--', ...pathspec(globs)).split('\n')) {
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

// Every file under `globs` that differs between `base` and the working state, deletions left out. The population a
// check states, read independently of the line parser so a parse that found nothing cannot pass as clean.
export function changedFiles(root, base, globs) {
  return gitDiff(root, '--relative', '--name-only', '--diff-filter=d', base, snapshot(root, globs), '--', ...pathspec(globs))
    .split('\n')
    .filter(Boolean)
}

// The `--base=` a check was given, or the branch's base. It must name a commit or tree: passed on unchecked,
// `--base=--output=<file>` reached git as an option, truncated the file and made the check pass on a change it never
// read. Anything else ends the check with exit 2, which no caller reads as clean.
export function baseArg(config, root) {
  const given = process.argv.find((a) => a.startsWith('--base='))?.slice(7)
  if (!given) return baseOf(root, config)
  let ok = !given.startsWith('-')
  if (ok)
    try {
      git(root, 'rev-parse', '--verify', '--quiet', '--end-of-options', `${given}^{tree}`)
    } catch {
      ok = false
    }
  if (!ok) {
    console.log(`NOT RUN: --base=${given} is not a commit or tree in this repository.`)
    process.exit(2)
  }
  return given
}

// The pages a browser check may open, from its arguments: paths resolve against the dev server, and only local
// addresses are allowed. The reviewer runs these checks with arguments it chose while reading untrusted code, and an
// arbitrary URL is a way to send what it read somewhere else. Returns { targets, refused }.
const LOCAL = /^(localhost|127(\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0|[a-z0-9.-]+\.localhost)$/i
export function localTargets(args, config) {
  const targets = []
  const refused = []
  for (const a of args) {
    let url
    try {
      url = new URL(a, config.devServer)
    } catch {
      refused.push(a)
      continue
    }
    if ((url.protocol === 'http:' || url.protocol === 'https:') && LOCAL.test(url.hostname)) targets.push(url.href)
    else refused.push(a)
  }
  return { targets, refused }
}
// The same, where a page can also be an HTML file inside the project (a style tile built before there is an app,
// `design/style-tile.html`), opened as file://. Nothing outside the project.
export function pageTargets(args, config, root) {
  const files = []
  const rest = []
  for (const a of args) {
    if (/\.html?$/i.test(a) && !/^[a-z]+:/i.test(a)) {
      const full = resolvePath(root, a)
      if (full.startsWith(resolvePath(root) + '/') && existsSync(full)) files.push(`file://${full}`)
      else rest.push(a)
    } else rest.push(a)
  }
  const { targets, refused } = localTargets(rest, config)
  return { targets: [...files, ...targets], refused }
}

// The TypeScript the checks parse with ships with the harness, so the hook never runs code from the repository it is
// checking: loading the project's own node_modules/typescript let a cloned repository run code on every stop. It is
// TypeScript 6.0.3, gzipped, unpacked once into the temp folder and checked against its hash on every load.
const TS_VERSION = '6.0.3'
const TS_SHA256 = '569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39'
export function harnessTypescript() {
  const here = dirname(fileURLToPath(import.meta.url))
  const gz = join(here, 'vendor', `typescript-${TS_VERSION}.js.gz`)
  const out = join(tmpdir(), `design-harness-typescript-${TS_VERSION}-${TS_SHA256.slice(0, 12)}.cjs`)
  const ok = (buf) => createHash('sha256').update(buf).digest('hex') === TS_SHA256
  try {
    if (!existsSync(out) || !ok(readFileSync(out))) {
      const buf = gunzipSync(readFileSync(gz))
      if (!ok(buf)) return null
      const tmp = `${out}.${process.pid}`
      writeFileSync(tmp, buf)
      renameSync(tmp, out)
    }
    return createRequire(import.meta.url)(out)
  } catch {
    return null
  }
}

// A package resolved from the PROJECT, not from the plugin: only the browser libraries, which the session runs.
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
// and a theme file at src/styles/theme.css was flagged as drift. tests/harness.test.mjs holds the cases.
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
