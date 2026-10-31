// Writes a review packet for a benchmark case the way the 0.7.0 hook does: change, checks on it, server state, token.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
const [caseDir, out, ...pathArgs] = process.argv.slice(2)
const H = '/Users/gonzalo/dev/design-harness/plugins/design-harness'
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: caseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 })
  } catch (e) {
    return e.stdout ?? ''
  }
}
mkdirSync(out, { recursive: true })
const token = randomBytes(8).toString('hex')
const base = run('git', ['rev-parse', 'HEAD^']).trim()
const head = run('git', ['rev-parse', 'HEAD']).trim()
// The packet as the hook builds it: rendered files only, paths relative to the project, the hook's diff settings.
const { gitDiff, loadConfig, pathspec, DEFAULTS } = await import(`${H}/bin/lib.mjs`)
const UI = pathspec((loadConfig(caseDir) ?? DEFAULTS).ui)
const sep = ['--', ...UI] // the extra path arguments older runs took are no longer needed: UI already narrows it
writeFileSync(join(out, 'change.diff'), `review-token: ${token}\n\n` + gitDiff(caseDir, '--relative', '--stat', base, head, ...sep) + '\n' + gitDiff(caseDir, '--relative', base, head, ...sep))
writeFileSync(join(out, 'checks.txt'), run('node', [`${H}/bin/check-copy-length.mjs`, `--base=${base}`]) + '\n' + run('node', [`${H}/bin/check-drift.mjs`, `--base=${base}`]))
writeFileSync(join(out, 'server.txt'), run('node', [`${H}/bin/server-of.mjs`]))
writeFileSync(join(out, 'README.md'), [`# Review packet`, '', 'Start your report with the review-token line from the top of change.diff, exactly as written.', '', `- base: ${base}`, `- change.diff: the change, \`git diff ${base} ${head}\`, with its --stat on top`, '- checks.txt: copy length and drift on exactly this change, run by the hook', '- server.txt: whether the dev server serves this checkout', `- the AI-look register: ${H}/reference/ai-look.md`, ''].join('\n'))
console.log(out, token)
