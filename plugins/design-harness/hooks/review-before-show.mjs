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
import { baseOf, gitDiff, gitDirOf, keepTree, loadConfig, pathspec, snapshot, treeExists } from '../bin/lib.mjs'

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
    const turnStart = snapshot(root, config.ui)
    keepTree(root, 'turn', turnStart)
    writeFileSync(statePath, JSON.stringify({ blocks: 0, turnStart }))
    process.exit(0)
  }
  if (input.hook_event_name && input.hook_event_name !== 'Stop') process.exit(0)
  main()
} catch (e) {
  // A harness fault must never hold the person's turn: say so once and let it end.
  process.stdout.write(JSON.stringify({ systemMessage: `Review before show could not run: ${String(e.message ?? e).split('\n')[0]}` }))
  process.exit(0)
}

// Has a ui-review naming this fingerprint been called, and has its report come back? A foreground report is a
// tool_result for the call that is not the launch notice; a background one is a task-notification carrying the call's
// id and a completed status.
function reviewOf(fingerprint) {
  if (!fingerprint || !input.transcript_path || !existsSync(input.transcript_path)) return { called: false, reported: false }
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
        return { called: true, reported: true }
    }
  }
  return { called: calls.size > 0, reported: false }
}

function main() {
  const UI = pathspec(config.ui)
  const state = readJson(statePath, { blocks: 0 })
  const save = () => writeFileSync(statePath, JSON.stringify(state))
  const now = snapshot(root, config.ui)
  const changedSince = (from) => gitDiff(root, '--relative', '--name-only', from, now, '--', ...UI).split('\n').filter(Boolean)
  const readLog = () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : [])
  const isLogged = (fp) => readLog().some((l) => l.split(' ')[0] === fp)
  const logReview = (fp, tree) => {
    appendFileSync(logPath, `${fp} ${tree}\n`)
    keepTree(root, 'reviewed', tree)
  }

  // Did THIS turn change anything rendered? Without a usable turn snapshot (the hook was installed mid-session, or
  // the tree is gone), fall back to the branch.
  const turnStart = treeExists(root, state.turnStart) ? state.turnStart : null
  if (turnStart && !changedSince(turnStart).length) process.exit(0)

  // A review asked for earlier in this message that has now reported is logged against the tree it was asked about,
  // whatever the session changed after it. Logging only when the state at the stop still matched left the range
  // anchored at the previous review, so later reviews re-read old work and repeated findings already declined.
  if (state.lastBlocked && state.askedTree && !isLogged(state.lastBlocked) && reviewOf(state.lastBlocked).reported) {
    logReview(state.lastBlocked, state.askedTree)
    state.reviewed = true
    save()
  }

  // The change to review: since the last review on this worktree, else since the turn began, else the branch. A
  // logged tree that git has since pruned is skipped rather than diffed, which used to fail every turn after.
  const lastTree = readLog()
    .map((l) => l.split(' ')[1])
    .filter(Boolean)
    .reverse()
    .find((t) => treeExists(root, t))
  const from = lastTree ?? turnStart ?? baseOf(root, config)
  const files = changedSince(from)
  if (!files.length) process.exit(0)

  // Fixes the session made after this message's review: they ride with the next change rather than raising a note.
  if (state.reviewed) process.exit(0)

  // The fingerprint names the change as it stands, so the same state is never reviewed twice.
  const fingerprint = createHash('sha1').update(gitDiff(root, '--relative', from, now, '--', ...UI)).update(from).digest('hex').slice(0, 12)
  if (isLogged(fingerprint)) process.exit(0)
  const review = reviewOf(fingerprint)
  if (review.reported) {
    logReview(fingerprint, now)
    process.exit(0)
  }
  const pending = review.called || (input.background_tasks ?? []).some((t) => /ui-review/.test(JSON.stringify(t)))

  const say = (systemMessage) => process.stdout.write(JSON.stringify({ systemMessage }))
  // Asking again for a review that is still running is the same request, not a new review, so it does not spend the
  // per-message cap; it is allowed once, so a session that never waits cannot loop.
  const rechase = pending && state.lastBlocked === fingerprint && !state.rechased
  if (rechase) {
    state.rechased = true
    save()
  } else if (state.blocks >= config.maxReviewsPerMessage) {
    say(`Review before show: the latest change to ${files.length} rendered file(s) was not reviewed (limit of ${config.maxReviewsPerMessage} per message).`)
    process.exit(0)
  }
  if (!rechase && input.stop_hook_active && state.lastBlocked === fingerprint && !pending) {
    say(`Review before show: the session stopped without running the review it was asked for (${files.length} rendered file(s) unreviewed).`)
    process.exit(0)
  }
  if (!rechase) {
    state.blocks += 1
    state.lastBlocked = fingerprint
    state.askedTree = now
    keepTree(root, 'asked', now)
    save()
  }

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
          `"change: git diff --relative ${from} ${now}" (two snapshots, so new files are in it) and one sentence on what ` +
          `the change is for. Then fix the findings you agree with in what this turn built. Anything that would change a ` +
          `surface this turn did not set out to change, or that contradicts what the person asked for, is theirs to ` +
          `decide: list it for them instead of changing it.`,
      },
    }),
  )
  process.exit(0)
}
