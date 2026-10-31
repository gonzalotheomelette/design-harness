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
 * The reviewer has no shell. Every time it was given one, a blind review found a way to turn the allowed commands into
 * arbitrary ones (a planted folder's node_modules, a planted repository's git config, a screenshot script the change
 * itself edited). So the hook does what the shell was for: it writes a packet with the change, the copy and drift
 * checks run on exactly that change, and whether the dev server serves this checkout, and asks the session (which
 * has a shell anyway) to add pictures. The packet holds a token the report must start with, so a review that never
 * opened the packet does not count.
 *
 * After the review, fixes the session makes are checked once by the copy and drift checks before the turn ends; the
 * next review reads them in full.
 *
 * It asks at most `maxReviewsPerMessage` times per message (default once), then lets the turn end with a note to the
 * person, so it can never loop. It is silent in a project without .claude/design-harness.json. The request is returned
 * as additionalContext, shown as hook feedback; `decision: 'block'` is shown as "Stop hook error occurred".
 *
 * State lives in the worktree's git directory, never committed and never shared between worktrees.
 */
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseOf, git, gitDiff, gitDirOf, keepTree, loadConfig, pathspec, snapshot, treeExists } from '../bin/lib.mjs'

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
const packetOf = (fingerprint) => join(gitDir, 'design-harness', 'review', fingerprint)
// A harness check run on this project, as the hook: { code, out }.
const runCheck = (script, ...args) => {
  try {
    return { code: 0, out: execFileSync('node', [join(HARNESS, 'bin', script), ...args], { cwd: root, encoding: 'utf8', timeout: 25000, stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (e) {
    return { code: e.status ?? 2, out: `${e.stdout ?? ''}${e.signal ? `${script}: NOT RUN, it did not finish in 25 s\n` : ''}` }
  }
}
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
    // The person's own words go to the reviewer: the session's one-line summary of its own work is the framing a
    // fresh reader is there to avoid.
    writeFileSync(statePath, JSON.stringify({ blocks: 0, turnStart, request: String(input.prompt ?? '').slice(0, 6000) }))
    process.exit(0)
  }
  if (input.hook_event_name && input.hook_event_name !== 'Stop') process.exit(0)
  main()
} catch (e) {
  // A harness fault must never hold the person's turn: say so once and let it end.
  process.stdout.write(JSON.stringify({ systemMessage: `Review before show could not run: ${String(e.message ?? e).split('\n')[0]}` }))
  process.exit(0)
}

// Has a ui-review naming this fingerprint been called, and has its report come back? The transcript is read as JSON,
// not matched as text. A call counts only when Claude Code recorded its result as completed (an errored call also
// returns a result) AND that result, the report itself, carries the packet's token. Matching the token anywhere in
// the transcript let a session that had read the packet itself, or echoed a completion notice, pass a review that
// never opened it. A review run in the background is never counted: the hook asks for the foreground.
function reviewOf(fingerprint) {
  if (!fingerprint || !input.transcript_path || !existsSync(input.transcript_path)) return { called: false, reported: false }
  let token = null
  try {
    token = readFileSync(join(packetOf(fingerprint), 'token'), 'utf8').trim()
  } catch {}
  const entries = []
  for (const line of readFileSync(input.transcript_path, 'utf8').split('\n')) {
    try {
      if (line) entries.push(JSON.parse(line))
    } catch {}
  }
  const blocks = (e) => (Array.isArray(e?.message?.content) ? e.message.content : [])
  const calls = new Set()
  for (const e of entries)
    for (const b of blocks(e))
      if (
        b.type === 'tool_use' &&
        (b.name === 'Agent' || b.name === 'Task') &&
        /(^|:)ui-review$/.test(String(b.input?.subagent_type ?? '')) &&
        String(b.input?.prompt ?? '').includes(`fingerprint: ${fingerprint}`)
      )
        calls.add(b.id)
  if (!calls.size) return { called: false, reported: false }
  let completed = false
  for (const e of entries)
    for (const b of blocks(e))
      if (e.type === 'user' && b.type === 'tool_result' && calls.has(b.tool_use_id) && !b.is_error && e.toolUseResult?.status === 'completed') {
        completed = true
        const report = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        if (token && report.includes(`review-token: ${token}`)) return { called: true, reported: true }
      }
  return { called: true, reported: false, unread: completed }
}

// The packet the reviewer reads instead of running anything: the change, the checks on it, and the server's state.
function writePacket(fingerprint, from, now, UI, state) {
  const dir = packetOf(fingerprint)
  mkdirSync(dir, { recursive: true })
  const token = randomBytes(8).toString('hex')
  writeFileSync(join(dir, 'token'), token)
  writeFileSync(
    join(dir, 'change.diff'),
    gitDiff(root, '--relative', '--stat', from, now, '--', ...UI) + '\n' + gitDiff(root, '--relative', from, now, '--', ...UI),
  )
  const copy = runCheck('check-copy-length.mjs', `--base=${from}`)
  const drift = runCheck('check-drift.mjs', `--base=${from}`)
  writeFileSync(join(dir, 'checks.txt'), `${copy.out}\n${drift.out}`)
  const server = runCheck('server-of.mjs').out.trim()
  writeFileSync(join(dir, 'server.txt'), server + '\n')
  writeFileSync(join(dir, 'request.md'), `${state.request || '(not recorded: the hook was installed during this message)'}\n`)
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(config, null, 2) + '\n')
  writeFileSync(
    join(dir, 'README.md'),
    [
      `# Review packet ${fingerprint}`,
      '',
      `review-token: ${token}`,
      '',
      'Start your report with the review-token line above, exactly as written.',
      '',
      `- base: ${from}`,
      `- change.diff: the change, \`git diff --relative ${from} ${now}\`, new files included, with its --stat on top`,
      '- checks.txt: copy length and drift on exactly this change, run by the hook',
      '- request.md: what the person asked for this turn, in their own words',
      '- settings.json: the harness settings in effect (from the last commit, not the working copy)',
      '- server.txt: whether the dev server serves this checkout',
      `- the AI-look register: ${HARNESS}/reference/ai-look.md`,
      '- browser.txt: screenshots and accessibility, when the session took them (listed image paths open with Read)',
      '',
    ].join('\n'),
  )
  // Keep the twenty newest packets.
  const all = dirname(dir)
  readdirSync(all)
    .map((n) => ({ n, t: statSync(join(all, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(20)
    .forEach(({ n }) => rmSync(join(all, n), { recursive: true, force: true }))
  return { dir, serving: /: yes/.test(server) }
}

function main() {
  const UI = pathspec(config.ui)
  const state = readJson(statePath, { blocks: 0 })
  const save = () => writeFileSync(statePath, JSON.stringify(state))
  const now = snapshot(root, config.ui)
  const changedSince = (from) => gitDiff(root, '--relative', '--name-only', from, now, '--', ...UI).split('\n').filter(Boolean)
  const readLog = () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : [])
  const isLogged = (fp) => readLog().some((l) => l.split(' ')[0] === fp)
  // Each review is logged with the branch it was made on, so a branch switch starts the next range from the turn,
  // not from a tree on another branch (which made the next review read the whole difference between branches).
  let branch = 'detached'
  try {
    branch = git(root, 'symbolic-ref', '--short', '-q', 'HEAD').trim() || 'detached'
  } catch {}
  const logReview = (fp, tree) => {
    appendFileSync(logPath, `${fp} ${tree} ${branch}\n`)
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
    .map((l) => l.split(' '))
    .filter(([, t, b]) => t && b === branch)
    .map(([, t]) => t)
    .reverse()
    .find((t) => treeExists(root, t))
  const from = lastTree ?? turnStart ?? baseOf(root, config)
  const files = changedSince(from)
  if (!files.length) process.exit(0)

  // Fixes the session made after this message's review. The next review reads them in full; before this turn ends,
  // the copy and drift checks read them once, so a fix that adds a long string or a raw value is not handed over.
  // Each later stop reads only what changed since the last check, at most twice a message, so a session that fixes a
  // flagged line and adds another is read again without ever looping.
  if (state.reviewed) {
    const fixBase = state.fixBase ?? state.askedTree
    if (!fixBase || (state.fixChecks ?? 0) >= 2 || !changedSince(fixBase).length) process.exit(0)
    state.fixChecks = (state.fixChecks ?? 0) + 1
    state.fixBase = now
    save()
    const found = [runCheck('check-copy-length.mjs', `--base=${fixBase}`), runCheck('check-drift.mjs', `--base=${fixBase}`)]
      .filter((r) => r.code === 1)
      .flatMap((r) => r.out.split('\n').filter((l) => /^ {2}\S/.test(l)))
    if (!found.length) process.exit(0)
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'Stop',
          additionalContext:
            `The fixes made after the review added these, which the checks flag:\n${found.slice(0, 12).join('\n')}\n` +
            `Fix them, or tell the person why they stay. No second review is needed.`,
        },
      }),
    )
    process.exit(0)
  }

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
  const packet = existsSync(join(packetOf(fingerprint), 'token')) ? { dir: packetOf(fingerprint), serving: /: yes/.test(readFileSync(join(packetOf(fingerprint), 'server.txt'), 'utf8')) } : writePacket(fingerprint, from, now, UI, state)
  const shoot = config.screenshot
    ? `your screenshot command from .claude/design-harness.local.json (${config.screenshot})`
    : `\`node ${HARNESS}/bin/shoot.mjs /<route>\``

  const list = files.slice(0, 10).join(', ') + (files.length > 10 ? `, and ${files.length - 10} more` : '')
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          `Rendered files changed and have not been reviewed (${files.length}: ${list}). Before handing this back: ` +
          (pending
            ? review.unread
              ? `the ui-review you ran did not open its packet (its report lacks the review-token line); run it again. `
              : `the ui-review you started has not reported, and a review still running in the background does not count. `
            : '') +
          (packet.serving
            ? `1. The dev server serves this checkout, so take pictures of the pages this change renders with ${shoot}, and ` +
              `run \`node ${HARNESS}/bin/check-a11y.mjs /<route>\` on them, writing both outputs to ${packet.dir}/browser.txt. `
            : '') +
          `${packet.serving ? '2' : '1'}. Run the design-harness:ui-review agent in the FOREGROUND (run_in_background: false) and ` +
          `wait for its report. Its prompt: "packet: ${packet.dir}", "fingerprint: ${fingerprint}", and one sentence on ` +
          `what the change is for. The reviewer has no shell; the packet holds the change and the checks. ` +
          `Then fix the findings you agree with in what this turn built. Anything that would change a surface this turn ` +
          `did not set out to change, or that contradicts what the person asked for, is theirs to decide: list it for ` +
          `them instead of changing it.`,
      },
    }),
  )
  process.exit(0)
}
