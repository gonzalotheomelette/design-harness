#!/usr/bin/env node
/**
 * Review before show: a turn that changed rendered files cannot hand the work back until the ui-review agent has
 * read that change and its report is back.
 *
 * Why. In the project this came from, the designer's corrections were rarely about a rule nobody had written down.
 * They were one surface not matching its sibling, or copy longer than anything already approved, and the designer
 * was the first reader of every change. This moves a reviewer in front of him.
 *
 *   UserPromptSubmit  Snapshots the working state as a tree, so the stop can tell what THIS turn changed, and resets
 *                     the per-message count of requests.
 *   Stop              If this turn changed no rendered file, the turn ends untouched: work left lying around, and a
 *                     turn that only answered a question, are not this turn's change. Otherwise, until a ui-review
 *                     call naming this change's fingerprint has REPORTED (subagents run in the background by default,
 *                     and a call that has only started does not count), the session is asked to run it in the
 *                     foreground. The review reads only what changed since the last review, or since the turn began.
 *
 * It asks at most `maxReviewsPerMessage` times per message (default once), then lets the turn end with a note to the
 * person, so it can never loop. It is silent in a project without .claude/design-harness.json. The request is returned
 * as additionalContext, shown as hook feedback; `decision: 'block'` is shown as "Stop hook error occurred".
 *
 * State lives in the worktree's git directory, never committed and never shared between worktrees.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseOf, git, gitDirOf, loadConfig, pathspec, snapshot } from '../bin/lib.mjs'

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
  gitDir = gitDirOf(root)
} catch {
  process.exit(0)
}
const session = String(input.session_id || 'unknown').replace(/[^\w-]/g, '')
const statePath = join(gitDir, `review-before-show.${session}.json`)
const logPath = join(gitDir, 'review-before-show.log')
const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

try {
  if (input.hook_event_name === 'UserPromptSubmit') {
    writeFileSync(statePath, JSON.stringify({ blocks: 0, turnStart: snapshot(root) }))
    process.exit(0)
  }
  if (input.hook_event_name && input.hook_event_name !== 'Stop') process.exit(0)
  main()
} catch (e) {
  // A harness fault must never hold the person's turn: say so once and let it end.
  process.stdout.write(JSON.stringify({ systemMessage: `Review before show could not run: ${String(e.message ?? e).split('\n')[0]}` }))
  process.exit(0)
}

function main() {
  const UI = pathspec(config.ui)
  const state = readJson(statePath, { blocks: 0 })
  const now = snapshot(root)
  const changedSince = (from) => git(root, 'diff', '--relative', '--name-only', from, now, '--', ...UI).split('\n').filter(Boolean)

  // Did THIS turn change anything rendered? Without a turn snapshot (the hook was installed mid-session), fall back
  // to the branch.
  const turnFiles = state.turnStart ? changedSince(state.turnStart) : null
  if (turnFiles && !turnFiles.length) process.exit(0)

  // The change to review: since the last review on this worktree if there was one, else since the turn began, else
  // the branch. Reviewed changes are logged as "<fingerprint> <tree>".
  const logLines = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : []
  const lastTree = logLines.map((l) => l.split(' ')[1]).filter(Boolean).at(-1)
  const from = lastTree ?? state.turnStart ?? baseOf(root, config)
  const files = changedSince(from)
  if (!files.length) process.exit(0)

  // The fingerprint names the content of the rendered files as they stand, so the same state is never reviewed twice.
  const fingerprint = createHash('sha1').update(git(root, 'diff', '--relative', from, now, '--', ...UI)).update(from).digest('hex').slice(0, 12)

  // Reviewed already? A ui-review call naming this fingerprint whose report has come back: a foreground tool_result
  // that is not the launch notice, or a background task-notification carrying the call's id and a completed status.
  const logged = logLines.some((l) => l.split(' ')[0] === fingerprint)
  let reviewedHere = false
  let pending = (input.background_tasks ?? []).some((t) => /ui-review/.test(JSON.stringify(t)))
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
    if (calls.size && !reviewedHere) pending = true
  }
  if (logged || reviewedHere) {
    if (!logged) appendFileSync(logPath, `${fingerprint} ${now}\n`)
    process.exit(0)
  }

  const say = (systemMessage) => process.stdout.write(JSON.stringify({ systemMessage }))
  // Asking again for a review that is still running is the same request, not a new review, so it does not spend the
  // per-message cap; it is allowed once, so a session that never waits cannot loop. Without this, one review per
  // message let a background review use the only ask and the turn ended before the report, the first trial's fault.
  const rechase = pending && state.lastBlocked === fingerprint && !state.rechased
  if (rechase) {
    writeFileSync(statePath, JSON.stringify({ ...state, rechased: true }))
  } else if (state.blocks >= config.maxReviewsPerMessage) {
    say(`Review before show: the latest change to ${files.length} rendered file(s) was not reviewed (limit of ${config.maxReviewsPerMessage} per message).`)
    process.exit(0)
  }
  if (!rechase && input.stop_hook_active && state.lastBlocked === fingerprint && !pending) {
    say(`Review before show: the session stopped without running the review it was asked for (${files.length} rendered file(s) unreviewed).`)
    process.exit(0)
  }
  if (!rechase) writeFileSync(statePath, JSON.stringify({ ...state, blocks: state.blocks + 1, lastBlocked: fingerprint }))

  const list = files.slice(0, 10).join(', ') + (files.length > 10 ? `, and ${files.length - 10} more` : '')
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          `Rendered files changed and have not been reviewed (${files.length}: ${list}). Before handing this back, ` +
          (pending ? `note that the ui-review you started has not reported, and a review still running in the background does not count. ` : '') +
          `run the design-harness:ui-review agent in the FOREGROUND (run_in_background: false) and wait for its report. ` +
          `Put these lines in its prompt: "fingerprint: ${fingerprint}", "harness: ${HARNESS}", "base: ${from}", ` +
          `"change: git diff --relative ${from} -- ." and one sentence on what the change is for. ` +
          `Then fix the findings you agree with in what this turn built. Anything that would change a surface this turn ` +
          `did not set out to change, or that contradicts what the person asked for, is theirs to decide: list it for ` +
          `them instead of changing it.`,
      },
    }),
  )
  process.exit(0)
}
