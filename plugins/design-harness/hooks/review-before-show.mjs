#!/usr/bin/env node
/**
 * Review before show: a session that changed rendered files cannot hand the work back until the ui-review agent
 * has read that exact change and its report is back.
 *
 * Why. In the project this came from, the designer's corrections were rarely about a rule nobody had written
 * down. They were one surface not matching its sibling, or copy longer than anything already approved, and the
 * designer was the first reader of every change. This moves a reviewer in front of him.
 *
 *   Stop              If rendered files differ from the base, the change gets a fingerprint. Until a ui-review
 *                     call naming that fingerprint has REPORTED (not merely started: subagents run in the
 *                     background by default), the session is told to run it in the foreground. A change made
 *                     after a review is a new fingerprint, and the next review is told to read only what changed
 *                     since the last one (a tree snapshot per review).
 *   UserPromptSubmit  Resets the per-message count of requests.
 *
 * It asks at most `maxReviewsPerMessage` times per message from the person, then lets the turn end with a note to
 * them, so it can never loop. It is silent in a project without .claude/design-harness.json: the harness is
 * opt-in per project, and /design-harness:kickoff writes that file.
 *
 * The request is returned as additionalContext, which keeps the session working and is shown as hook feedback;
 * `decision: 'block'` does the same but is shown as "Stop hook error occurred".
 *
 * State lives in the worktree's git directory, never committed and never shared between worktrees.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { baseOf, git, loadConfig, pathspec } from '../bin/lib.mjs'

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)))

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
const config = loadConfig(root)
if (!config) process.exit(0)

let gitDir
try {
  gitDir = git(root, 'rev-parse', '--git-dir').trim()
  if (!isAbsolute(gitDir)) gitDir = join(root, gitDir)
} catch {
  process.exit(0)
}
const session = String(input.session_id || 'unknown').replace(/[^\w-]/g, '')
const statePath = join(gitDir, `review-before-show.${session}.json`)
const logPath = join(gitDir, 'review-before-show.log')
const treesPath = join(gitDir, 'review-before-show.trees.json')
const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

if (input.hook_event_name === 'UserPromptSubmit') {
  writeFileSync(statePath, JSON.stringify({ blocks: 0 }))
  process.exit(0)
}
if (input.hook_event_name && input.hook_event_name !== 'Stop') process.exit(0)

const UI = pathspec(config.ui)
const base = baseOf(root, config)
const diff = git(root, 'diff', base, '--', ...UI)
const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '--', ...UI).split('\n').filter(Boolean)
if (!diff && !untracked.length) process.exit(0)

const hash = createHash('sha1').update(diff)
for (const f of untracked) hash.update(f).update(readFileSync(join(root, f)))
const fingerprint = hash.digest('hex').slice(0, 12)
const files = [...new Set([...git(root, 'diff', '--name-only', base, '--', ...UI).split('\n'), ...untracked])].filter(Boolean)

// The working state as a tree object, written through a scratch index so the real one is untouched.
function snapshot() {
  const env = { ...process.env, GIT_INDEX_FILE: join(gitDir, 'review-before-show.index') }
  const run = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    run('read-tree', 'HEAD')
  } catch {
    run('read-tree', '--empty')
  }
  run('add', '-A', '--', '.')
  return run('write-tree').trim()
}
const trees = readJson(treesPath, {})
const logLines = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : []

// Reviewed already? In a past session (the log), or in this one: a ui-review call naming this fingerprint whose
// report has come back. A foreground report is a tool_result for the call that is not the launch notice; a
// background one is a task-notification carrying the call's id and a completed status.
const logged = logLines.some((l) => l.split(' ')[0] === fingerprint)
let reviewedHere = false
let pending = false
if (!logged && input.transcript_path && existsSync(input.transcript_path)) {
  const lines = readFileSync(input.transcript_path, 'utf8').split('\n')
  const calls = new Set()
  for (const line of lines) {
    if (!/"subagent_type":"(?:[\w-]+:)?ui-review"/.test(line) || !line.includes(`fingerprint: ${fingerprint}`)) continue
    for (const m of line.matchAll(/"type":"tool_use","id":"([^"]+)","name":"(?:Agent|Task)"/g)) calls.add(m[1])
  }
  for (const id of calls) {
    for (const line of lines) {
      if (!line.includes(id)) continue
      if (
        (line.includes(`"tool_use_id":"${id}"`) && line.includes('"type":"tool_result"') && !line.includes('Async agent launched')) ||
        (line.includes(`<tool-use-id>${id}</tool-use-id>`) && line.includes('<status>completed</status>'))
      )
        reviewedHere = true
    }
  }
  pending = calls.size > 0 && !reviewedHere
}
if (logged || reviewedHere) {
  if (!logged) appendFileSync(logPath, `${fingerprint} ${trees[fingerprint] ?? ''}\n`)
  process.exit(0)
}

const state = readJson(statePath, { blocks: 0 })
const say = (systemMessage) => process.stdout.write(JSON.stringify({ systemMessage }))
if (state.blocks >= config.maxReviewsPerMessage) {
  say(`Review before show: the latest change to ${files.length} rendered file(s) was not reviewed (limit of ${config.maxReviewsPerMessage} reviews per message reached).`)
  process.exit(0)
}
if (input.stop_hook_active && state.lastBlocked === fingerprint && !pending) {
  say(`Review before show: the session stopped without running the review it was asked for (${files.length} rendered file(s) unreviewed).`)
  process.exit(0)
}

writeFileSync(statePath, JSON.stringify({ blocks: state.blocks + 1, lastBlocked: fingerprint }))
const tree = snapshot()
trees[fingerprint] = tree
writeFileSync(treesPath, JSON.stringify(trees))

const lastTree = logLines.map((l) => l.split(' ')[1]).filter(Boolean).at(-1)
let range = `git diff ${base} -- . (the whole branch)`
if (lastTree) {
  try {
    const changed = git(root, 'diff', '--name-only', lastTree, tree, '--', ...UI).split('\n').filter(Boolean)
    if (changed.length) range = `git diff ${lastTree} ${tree} (only what changed since the last review: ${changed.slice(0, 8).join(', ')}; the rest of the branch was reviewed already)`
  } catch {}
}
const list = files.slice(0, 12).join(', ') + (files.length > 12 ? `, and ${files.length - 12} more` : '')
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext:
        `Rendered files changed since the last review (${files.length} on the branch: ${list}). Before handing this back, ` +
        (pending ? `note that the ui-review you started has not reported, and a review still running in the background does not count. ` : '') +
        `run the design-harness:ui-review agent in the FOREGROUND (run_in_background: false) and wait for its report. ` +
        `Put these lines in its prompt: "fingerprint: ${fingerprint}", "harness: ${HARNESS}", "change: ${range}", and one sentence on what the change is for. ` +
        `Fix the findings you agree with, and tell the person about any you chose not to fix and why. ` +
        `A fix made after the review changes the fingerprint, and you will be asked once more.`,
    },
  }),
)
process.exit(0)
