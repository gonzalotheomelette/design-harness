// Tests for the hook and the checks, each against a throwaway git repo. Run: node --test tests/
//
// Each case below is a bug an independent review found on 2026-10-31, or a behaviour a live trial depended on.
// A green here proves the behaviour; where a check can pass by measuring nothing, the case asserts the population too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globToRegExp, matchesAny } from '../plugins/design-harness/bin/lib.mjs'

const HARNESS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'design-harness')
const HOOK = join(HARNESS, 'hooks', 'review-before-show.mjs')

function repo(files = {}, config = { ui: ['src/**/*.tsx', 'src/**/*.css'], themeFiles: ['**/theme.css'] }) {
  const dir = mkdtempSync(join(tmpdir(), 'dh-test-'))
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  write(dir, { 'README.md': '# test\n', ...files })
  if (config) write(dir, { '.claude/design-harness.json': JSON.stringify(config) })
  git('add', '-A')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
  return dir
}
function write(dir, files) {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
}
function hook(dir, event, extra = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ hook_event_name: event, session_id: 's1', cwd: dir, ...extra }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout ? JSON.parse(r.stdout) : null }
}
const gitDir = (dir) => join(dir, '.git')
const check = (dir, name, ...args) => spawnSync('node', [join(HARNESS, 'bin', name), ...args], { cwd: dir, encoding: 'utf8' })

test('globs match at any depth, and only where they should', () => {
  const cases = [
    ['**/theme.css', 'src/styles/theme.css', true],
    ['**/theme.css', 'theme.css', true],
    ['**/*.test.*', 'src/a/b/x.test.tsx', true],
    ['src/**/*.tsx', 'src/app/a/b/page.tsx', true],
    ['src/*.tsx', 'src/a/page.tsx', false],
    ['**/theme.css', 'src/styles/themes.css', false],
  ]
  for (const [g, f, want] of cases) assert.equal(matchesAny(f, [g]), want, `${g} on ${f} (${globToRegExp(g)})`)
})

test('the hook is silent where the harness is not set up', () => {
  const dir = repo({ 'src/a.tsx': 'x' }, null)
  write(dir, { 'src/a.tsx': 'changed' })
  assert.equal(hook(dir, 'Stop').out, null)
})

test('a turn that changed nothing rendered ends untouched, even with unreviewed work lying around', () => {
  const dir = repo({ 'src/a.tsx': 'export const A = 1\n' })
  write(dir, { 'src/a.tsx': 'export const A = 2\n' }) // left from before this turn
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'README.md': '# only docs changed this turn\n' })
  assert.equal(hook(dir, 'Stop').out, null)
})

test('a turn that changed a rendered file is asked for a review, with the base and the range', () => {
  const dir = repo({ 'src/a.tsx': 'export const A = 1\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/a.tsx': 'export const A = 2\n', 'src/new.tsx': 'export const B = 1\n' })
  const ctx = hook(dir, 'Stop').out?.hookSpecificOutput?.additionalContext ?? ''
  assert.match(ctx, /ui-review/)
  assert.match(ctx, /fingerprint: [0-9a-f]{12}/)
  assert.match(ctx, /base: [0-9a-f]{40}/)
  assert.match(ctx, /2: src\/a\.tsx, src\/new\.tsx|2: src\/new\.tsx, src\/a\.tsx/)
  assert.match(ctx, /is theirs to decide/)
})

test('a finished review lets the turn end, and a review still running does not', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/a.tsx': 'y\n' })
  const fp = hook(dir, 'Stop').out.hookSpecificOutput.additionalContext.match(/fingerprint: ([0-9a-f]{12})/)[1]
  const call = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_X', name: 'Agent', input: { subagent_type: 'design-harness:ui-review', prompt: `fingerprint: ${fp}` } }] } }
  const launched = { type: 'user', message: { content: [{ tool_use_id: 'toolu_X', type: 'tool_result', content: 'Async agent launched successfully.' }] } }
  const done = { type: 'user', message: { content: [{ tool_use_id: 'toolu_X', type: 'tool_result', content: 'fingerprint: ' + fp + ' report' }] } }
  const t1 = join(dir, 'running.jsonl')
  writeFileSync(t1, [call, launched].map((e) => JSON.stringify(e)).join('\n'))
  // Same message: the session started the review in the background and tried to stop. The one-per-message cap must
  // not let this through, and asking again must not loop.
  const running = hook(dir, 'Stop', { transcript_path: t1, stop_hook_active: true }).out
  assert.match(running?.hookSpecificOutput?.additionalContext ?? '', /has not reported/)
  const again = hook(dir, 'Stop', { transcript_path: t1, stop_hook_active: true }).out
  assert.ok(again?.systemMessage, 'a session that never waits is let through with a note, not held forever')
  const t2 = join(dir, 'done.jsonl')
  writeFileSync(t2, [call, launched, done].map((e) => JSON.stringify(e)).join('\n'))
  assert.equal(hook(dir, 'Stop', { transcript_path: t2 }).out, null)
})

test('the hook asks once per message, then says so instead of looping', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/a.tsx': 'y\n' })
  assert.ok(hook(dir, 'Stop').out.hookSpecificOutput)
  write(dir, { 'src/a.tsx': 'z\n' })
  assert.match(hook(dir, 'Stop').out?.systemMessage ?? '', /limit of 1 per message/)
})

test('a diff over 1 MB does not crash the hook', () => {
  const dir = repo({ 'src/big.tsx': 'x\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/big.tsx': Array.from({ length: 60000 }, (_, i) => `export const v${i} = "${'a'.repeat(20)}"`).join('\n') })
  const r = hook(dir, 'Stop')
  assert.equal(r.code, 0)
  assert.ok(r.out?.hookSpecificOutput, JSON.stringify(r.out))
})

test('drift flags a raw colour in a class, not code, and exempts nested theme files', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  write(dir, {
    'src/a.tsx': 'export const A = ({ paid }) => (!paid ? <b className="text-[#d00000]">x</b> : null)\n',
    'src/styles/theme.css': ':root { --ink: #111111; }\n',
  })
  const r = check(dir, 'check-drift.mjs')
  assert.match(r.stdout, /src\/a\.tsx:1 {2}(colour|size)/)
  assert.doesNotMatch(r.stdout, /forced/)
  assert.doesNotMatch(r.stdout, /theme\.css/)
  assert.match(r.stdout, /1 added line\(s\) read/)
})

test('in a monorepo package the checks read the package, not nothing', () => {
  const dir = repo({ 'packages/web/src/a.tsx': 'x\n' }, null)
  write(dir, { 'packages/web/.claude/design-harness.json': JSON.stringify({ ui: ['src/**/*.tsx'] }) })
  write(dir, { 'packages/web/src/a.tsx': 'export const A = () => <b className="bg-[#123456]">x</b>\n' })
  const r = check(join(dir, 'packages', 'web'), 'check-drift.mjs')
  assert.match(r.stdout, /1 rendered file/)
  assert.match(r.stdout, /src\/a\.tsx:1/)
})

test('copy-length names files it cannot parse instead of passing silently', () => {
  const dir = repo({ 'src/a.vue': '<template>x</template>\n' }, { ui: ['src/**/*.vue', 'src/**/*.tsx'] })
  write(dir, { 'src/a.vue': '<template><button>Remove this item permanently from your workspace</button></template>\n' })
  const r = check(dir, 'check-copy-length.mjs')
  // The specific line: a generic NOT RUN (no typescript in the test project) passed this case vacuously at first.
  assert.match(r.stdout, /NOT RUN on 1 file\(s\) it cannot parse \(src\/a\.vue\)/)
  assert.doesNotMatch(r.stdout, /every one is within its limit/)
})

// Round two: bugs a second independent review found in 0.4.0, each with the scenario that exposed it.

const askFor = (dir) => hook(dir, 'Stop').out?.hookSpecificOutput?.additionalContext ?? ''
const fpOf = (ctx) => ctx.match(/fingerprint: ([0-9a-f]{12})/)?.[1]
const reported = (dir, fp, id = 'toolu_R') => {
  const p = join(dir, `${id}.jsonl`)
  const call = { type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Agent', input: { subagent_type: 'design-harness:ui-review', prompt: `fingerprint: ${fp}` } }] } }
  const done = { type: 'user', message: { content: [{ tool_use_id: id, type: 'tool_result', content: `fingerprint: ${fp} report` }] } }
  writeFileSync(p, [call, done].map((e) => JSON.stringify(e)).join('\n'))
  return p
}

test('the reviewer is handed a diff that includes files created this turn', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/brand-new-page.tsx': 'export const P = 1\n' })
  const ctx = askFor(dir)
  const cmd = ctx.match(/change: (git diff --relative [0-9a-f]{40} [0-9a-f]{40})/)?.[1]
  assert.ok(cmd, ctx)
  const shown = execFileSync('sh', ['-c', `${cmd} --name-only`], { cwd: dir, encoding: 'utf8' })
  assert.match(shown, /src\/brand-new-page\.tsx/)
})

test('after a review reports, later reviews start from what it reviewed, even if the session fixed things after', () => {
  const dir = repo({ 'src/a.tsx': 'one\n' })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/a.tsx': 'two\n' })
  const fp = fpOf(askFor(dir))
  const askedTree = JSON.parse(readFileSync(join(gitDir(dir), 'review-before-show.s1.json'), 'utf8')).askedTree
  write(dir, { 'src/a.tsx': 'two, fixed after the review\n' })
  const end = hook(dir, 'Stop', { transcript_path: reported(dir, fp) }).out
  assert.equal(end, null, 'fixes after this message\'s review end the turn quietly')
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/b.tsx': 'next turn\n' })
  assert.match(askFor(dir), new RegExp(`base: ${askedTree}`))
})

test('a snapshot git has pruned is skipped instead of failing every turn, and snapshots are kept by a ref', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  writeFileSync(join(gitDir(dir), 'review-before-show.log'), `deadbeef0000 ${'1'.repeat(40)}\n`)
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'src/a.tsx': 'y\n' })
  const r = hook(dir, 'Stop').out
  assert.ok(r?.hookSpecificOutput, JSON.stringify(r))
  assert.doesNotMatch(r.hookSpecificOutput.additionalContext, /1{40}/)
  assert.match(execFileSync('git', ['rev-parse', 'refs/worktree/design-harness/turn'], { cwd: dir, encoding: 'utf8' }), /^[0-9a-f]{40}/)
})

test('node_modules is never part of a snapshot, even with no .gitignore', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' }, { ui: ['**/*.tsx'] })
  hook(dir, 'UserPromptSubmit')
  write(dir, { 'node_modules/pkg/index.tsx': 'export const N = 1\n', 'src/a.tsx': 'y\n' })
  const ctx = askFor(dir)
  assert.match(ctx, /\(1: src\/a\.tsx\)/)
  assert.doesNotMatch(ctx, /node_modules/)
})

test('git diff settings cannot blind the checks (noprefix, an external diff tool, colour)', () => {
  const dir = repo({ 'src/a.tsx': 'x\n' })
  for (const [k, v] of [['diff.noprefix', 'true'], ['diff.external', 'false'], ['color.ui', 'always']]) execFileSync('git', ['config', k, v], { cwd: dir })
  write(dir, { 'src/a.tsx': 'export const A = () => <b className="bg-[#123456]">x</b>\n' })
  const r = check(dir, 'check-drift.mjs')
  assert.match(r.stdout, /src\/a\.tsx:1 {2}(colour|size)/, r.stdout)
})

test('a same-size edit made in the same second as the last commit is seen', () => {
  // Deterministic version of a race the suite first showed as a flake: the file's index entry, the edited file and
  // the index itself all carry the same whole-second time, and ctime is set aside, so only git's racy-entry check can
  // see the edit. A snapshot index copied without the real index's timestamp fails this every time.
  const dir = repo({ 'src/a.tsx': 'aaaa\n' })
  execFileSync('git', ['config', 'core.trustctime', 'false'], { cwd: dir })
  const file = join(dir, 'src', 'a.tsx')
  const T0 = new Date('2020-01-01T00:00:00Z')
  utimesSync(file, T0, T0)
  execFileSync('git', ['update-index', '--really-refresh'], { cwd: dir, stdio: 'ignore' })
  hook(dir, 'UserPromptSubmit')
  writeFileSync(file, 'bbbb\n') // same size
  utimesSync(file, T0, T0)
  utimesSync(join(gitDir(dir), 'index'), T0, T0)
  assert.match(askFor(dir), /1: src\/a\.tsx/)
})
