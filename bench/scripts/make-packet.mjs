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
const sep = pathArgs.length ? ['--', ...pathArgs] : []
writeFileSync(join(out, 'token'), token)
writeFileSync(join(out, 'change.diff'), run('git', ['diff', '--stat', base, head, ...sep]) + '\n' + run('git', ['diff', base, head, ...sep]))
writeFileSync(join(out, 'checks.txt'), run('node', [`${H}/bin/check-copy-length.mjs`, `--base=${base}`]) + '\n' + run('node', [`${H}/bin/check-drift.mjs`, `--base=${base}`]))
writeFileSync(join(out, 'server.txt'), run('node', [`${H}/bin/server-of.mjs`]))
writeFileSync(join(out, 'README.md'), [`# Review packet`, '', `review-token: ${token}`, '', 'Start your report with the review-token line above, exactly as written.', '', `- base: ${base}`, `- change.diff: the change, \`git diff ${base} ${head}\`, with its --stat on top`, '- checks.txt: copy length and drift on exactly this change, run by the hook', '- server.txt: whether the dev server serves this checkout', `- the AI-look register: ${H}/reference/ai-look.md`, ''].join('\n'))
console.log(out, token)
