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
 * Art direction. When the change touches a page the project lists in `artDirection` (its Persuade and Read pages),
 * the turn is also held for the art-direction critic, after the reviewer and with the same proof of reading: a packet
 * whose README starts with a token the critic's report must start with. The reviewer asks whether the change is
 * right; the critic asks whether the page has a point of view, which no check can. On 2026-11-09 a session built two
 * proposals for a marketing page, ran every check, reported them clean, and the designer called them "very simple and
 * questionable"; the critic, run blind on both afterwards, said "not ready to show" for reasons close to his. It had
 * been an optional line in the design pass, and the session skipped it every time. The critic is asked once a message.
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
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { baseOf, git, gitDiff, gitDirOf, keepTree, loadConfig, matchesAny, pathspec, snapshot, treeExists } from '../bin/lib.mjs'

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)))

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}

// The project is the checkout the session works in. In a desktop worktree session CLAUDE_PROJECT_DIR names the main
// checkout, not the worktree the edits land in: on 2026-11-09 a test session's change in its worktree was diffed
// against the untouched main checkout, and the gate never fired. So the session's own folder comes first when it
// runs the harness, then the project folder.
const topOf = (dir) => {
  try {
    return dir ? git(dir, 'rev-parse', '--show-toplevel').trim() : null
  } catch {
    return null
  }
}
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
const cwdTop = topOf(input.cwd)
// Only a different checkout moves the root; the same checkout keeps the folder as the project names it.
const root = cwdTop && cwdTop !== topOf(projectDir) && loadConfig(cwdTop) ? cwdTop : projectDir
const config = loadConfig(root)
if (!config) {
  if (input.hook_event_name === 'Stop') warnOutside()
  process.exit(0)
}

let gitDir
try {
  gitDir = gitDirOf(root)
} catch {
  process.exit(0)
}
const session = String(input.session_id || 'unknown').replace(/[^\w-]/g, '')
const statePath = join(gitDir, `review-before-show.${session}.json`)
const logPath = join(gitDir, 'review-before-show.log')
// Snapshots cover the rendered files AND the project's own documents, so an edit to DESIGN.md, the rules or a
// requirement in the same turn can be shown to the reviewer as part of the change. Only rendered files decide whether
// a turn needs a review.
const DOCS = [config.design, config.product, config.rules, config.requirements && `${config.requirements}/**`, config.decisions, config.questions].filter(Boolean)
const TREE = [...config.ui, ...DOCS]
const packetOf = (fingerprint) => join(gitDir, 'design-harness', 'review', fingerprint)
// The token is kept outside the packet; the reviewer finds it only on the first line of change.diff.
const tokenOf = (fingerprint, kind = 'review') => join(gitDir, 'design-harness', 'tokens', kind === 'review' ? fingerprint : `${kind}-${fingerprint}`)
// The art-direction critic's packet: its own folder, so a reviewer's packet is never mistaken for it.
const directionOf = (fingerprint) => join(gitDir, 'design-harness', 'direction', fingerprint)
const readLog = () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : [])
const isLogged = (fp) => readLog().some((l) => l.split(' ')[0] === fp)
// Each review is logged with the branch it was made on, so the fallback range (no turn snapshot) never starts from a
// tree on another branch.
let branch = 'detached'
try {
  branch = git(root, 'symbolic-ref', '--short', '-q', 'HEAD').trim() || 'detached'
} catch {}
const logReview = (fp, tree) => {
  appendFileSync(logPath, `${fp} ${tree} ${branch}\n`)
  keepTree(root, 'reviewed', tree)
}
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
    // A message the app delivers, not the person: an agent's hand-back, a background task's notice, a note from another
    // session. It continues the person's message rather than starting one. On 2026-11-09 a reviewer's hand-back reset
    // the state here, so the change it had just reviewed was forgotten and the critic was never asked for.
    const prompt = String(input.prompt ?? '')
    const fromApp = /^\s*<(agent-message|task-notification|side-sessions-event|ci-monitor-event)\b/.test(prompt) || prompt.includes('[Subagent hand-back]')
    if (fromApp && existsSync(statePath)) process.exit(0)
    const turnStart = snapshot(root, TREE)
    keepTree(root, 'turn', turnStart)
    // Work the last message left unreviewed (the cap was reached, the session stopped without the review, or this
    // message was queued while that turn was still working) is carried into this message's review as its own diff,
    // from where that work began to where that turn stopped (`endTree`, written at each stop; a message queued before
    // any stop is measured to now). Carried as a diff, not as an earlier start for this turn's range: a start let
    // everything between the messages in (a merge, a branch switch, the person's own edits).
    const prev = readJson(statePath, {})
    // A review that reported after the last stop (the next message arrived first) is recorded now, so its work is
    // not carried and reviewed twice.
    if (prev.lastBlocked && !prev.reviewed && prev.askedTree && (isLogged(prev.lastBlocked) || reviewOf(prev.lastBlocked).reported)) {
      if (!isLogged(prev.lastBlocked)) logReview(prev.lastBlocked, prev.askedTree)
      prev.reviewed = true
    }
    const prevEnd = treeExists(root, prev.endTree) ? prev.endTree : turnStart
    const UI = pathspec(config.ui)
    const ranges = prev.reviewed ? [{ from: prev.askedTree, to: prevEnd }] : [...(prev.carried ?? []), { from: prev.turnStart, to: prevEnd }]
    const carried = ranges
      .filter((r) => treeExists(root, r.from) && treeExists(root, r.to) && gitDiff(root, '--relative', '--name-only', r.from, r.to, '--', ...UI).trim())
      .slice(-3)
    carried.forEach((r, i) => {
      keepTree(root, `carried-${i}-from`, r.from)
      keepTree(root, `carried-${i}-to`, r.to)
    })
    // The person's own words go to the reviewer: the session's one-line summary of its own work is the framing a
    // fresh reader is there to avoid.
    writeFileSync(statePath, JSON.stringify({ blocks: 0, turnStart, carried, request: String(input.prompt ?? '').slice(0, 6000) }))
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
// never opened it. A review run in the background counts once its report is handed back (see below), not before.
function reviewOf(fingerprint, agent = 'design-harness:ui-review', kind = 'review') {
  if (!fingerprint || !input.transcript_path || !existsSync(input.transcript_path)) return { called: false, reported: false }
  let token = null
  try {
    token = readFileSync(tokenOf(fingerprint, kind), 'utf8').trim()
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
        b.input?.subagent_type === agent &&
        String(b.input?.prompt ?? '').includes(`fingerprint: ${fingerprint}`)
      )
        calls.add(b.id)
  if (!calls.size) return { called: false, reported: false }
  let completed = false
  // A call run in the background returns at once with the agent's id; its report comes back later as a hand-back the
  // app writes, naming that agent in its origin. Some sessions can only run agents that way (2026-11-09: the gate
  // could never pass there), so a hand-back from the agent this call started counts like a foreground report. The
  // origin is written by the app, not by the session, so a session cannot forge one.
  const launched = new Set()
  for (const e of entries)
    for (const b of blocks(e))
      if (e.type === 'user' && b.type === 'tool_result' && calls.has(b.tool_use_id) && !b.is_error) {
        if (e.toolUseResult?.status === 'async_launched' && e.toolUseResult?.agentId) launched.add(e.toolUseResult.agentId)
        if (e.toolUseResult?.status !== 'completed') continue
        completed = true
        const report = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        if (token && report.includes(`review-token: ${token}`)) return { called: true, reported: true }
      }
  for (const e of entries)
    if (e.origin?.handback && launched.has(e.origin.from)) {
      completed = true
      if (token && String(e.origin.handbackReportText ?? '').includes(`review-token: ${token}`)) return { called: true, reported: true }
    }
  // Launched in the background and not back yet: the agent is still working. A session that can only run agents that
  // way waits by ending its turn, and the hand-back starts the next one.
  return { called: true, reported: false, unread: completed, running: launched.size > 0 && !completed }
}

// The packet the reviewer reads instead of running anything: the change, the checks on it, and the server's state.
function writePacket(fingerprint, from, now, UI, state, carriedDiff = '') {
  const dir = packetOf(fingerprint)
  mkdirSync(dir, { recursive: true })
  const token = randomBytes(8).toString('hex')
  mkdirSync(dirname(tokenOf(fingerprint)), { recursive: true })
  writeFileSync(tokenOf(fingerprint), token)
  writeFileSync(
    join(dir, 'change.diff'),
    `review-token: ${token}\n\n` +
      gitDiff(root, '--relative', '--stat', from, now, '--', ...UI) +
      '\n' +
      gitDiff(root, '--relative', from, now, '--', ...UI),
  )
  if (carriedDiff.trim()) writeFileSync(join(dir, 'carried.diff'), carriedDiff)
  const copy = runCheck('check-copy-length.mjs', `--base=${from}`)
  const drift = runCheck('check-drift.mjs', `--base=${from}`)
  writeFileSync(join(dir, 'checks.txt'), `${copy.out}\n${drift.out}`)
  // The project's documents, when this change edited them too: the reviewer must not take a rule or a "Chosen on
  // purpose" line written in the same turn as settled.
  const docs = DOCS.length ? gitDiff(root, '--relative', from, now, '--', ...pathspec(DOCS)) : ''
  if (docs.trim()) writeFileSync(join(dir, 'docs.diff'), docs)
  const server = runCheck('server-of.mjs').out.trim()
  writeFileSync(join(dir, 'server.txt'), server + '\n')
  writeFileSync(join(dir, 'request.md'), `${state.request || '(not recorded: the hook was installed during this message)'}\n`)
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(config, null, 2) + '\n')
  writeFileSync(
    join(dir, 'README.md'),
    [
      `# Review packet ${fingerprint}`,
      '',
      'Start your report with the review-token line from the top of change.diff, exactly as written.',
      '',
      `- base: ${from}`,
      `- change.diff: the change, \`git diff --relative ${from} ${now}\`, new files included, with its --stat on top`,
      '- checks.txt: copy length and drift on exactly this change, run by the hook',
      ...(carriedDiff.trim() ? ["- carried.diff: work the previous message changed and nobody reviewed; review it with the change"] : []),
      ...(docs.trim() ? ["- docs.diff: this change ALSO edited the project's own documents (DESIGN.md, the rules, a requirement); see your instructions"] : []),
      '- request.md: what the person asked for this turn, in their own words',
      "- settings.json: the harness settings in effect: the project's as last committed (the working copy only before the first commit), plus this machine's local ones",
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
    .forEach(({ n }) => {
      rmSync(join(all, n), { recursive: true, force: true })
      rmSync(tokenOf(n), { force: true })
    })
  return { dir, serving: /: yes/.test(server) }
}

function main() {
  const UI = pathspec(config.ui)
  const state = readJson(statePath, { blocks: 0 })
  const save = () => writeFileSync(statePath, JSON.stringify(state))
  const now = snapshot(root, TREE)
  state.endTree = now
  keepTree(root, 'end', now)
  save()
  const changedSince = (from) => gitDiff(root, '--relative', '--name-only', from, now, '--', ...UI).split('\n').filter(Boolean)

  // Did THIS turn change anything rendered? Without a usable turn snapshot (the hook was installed mid-session, or
  // the tree is gone), fall back to the branch.
  const turnStart = treeExists(root, state.turnStart) ? state.turnStart : null
  if (turnStart && !changedSince(turnStart).length) process.exit(0)
  const hadTurnStart = !!turnStart

  // A review asked for earlier in this message that has now reported is logged against the tree it was asked about,
  // whatever the session changed after it. Logging only when the state at the stop still matched left the range
  // anchored at the previous review, so later reviews re-read old work and repeated findings already declined.
  if (state.lastBlocked && state.askedTree && !isLogged(state.lastBlocked) && reviewOf(state.lastBlocked).reported) {
    logReview(state.lastBlocked, state.askedTree)
    state.reviewed = true
    if (state.tasteNeeded) state.tasteFor = state.lastBlocked
    save()
  }

  // The critic, once the reviewer has reported on a change that touched an art-directed page. Before anything below:
  // a reported review with no edits since leaves no files to diff, and the turn would otherwise end there.
  if (tasteStep(state, save)) process.exit(0)

  // The change to review: this message's own work, from the turn's start or from unreviewed work carried in. Only
  // when the hook has no turn snapshot (installed mid-session) does it fall back to the last review on this branch,
  // then the branch's base. Starting from the last review read anything that arrived since (a pull, a merge) as this
  // turn's change. A logged tree that git has since pruned is skipped rather than diffed.
  const lastTree = readLog()
    .map((l) => l.split(' '))
    .filter(([, t, b]) => t && b === branch)
    .map(([, t]) => t)
    .reverse()
    .find((t) => treeExists(root, t))
  const from = state.reviewed ? state.askedTree : (turnStart ?? lastTree ?? baseOf(root, config))
  // A message with no snapshot of its start (the session's first message can reach the hook before it is installed)
  // takes the range it was just measured from as its start, so the next message can carry its work instead of losing it.
  if (!hadTurnStart && !state.reviewed) {
    state.turnStart = from
    keepTree(root, 'turn', from)
    save()
  }
  const carried = state.reviewed ? [] : (state.carried ?? []).filter((r) => treeExists(root, r.from) && treeExists(root, r.to))
  const carriedDiff = carried.map((r) => gitDiff(root, '--relative', r.from, r.to, '--', ...UI)).join('\n')
  const carriedFiles = carried.flatMap((r) => gitDiff(root, '--relative', '--name-only', r.from, r.to, '--', ...UI).split('\n').filter(Boolean))
  const files = [...new Set([...changedSince(from), ...carriedFiles])]
  if (!files.length) process.exit(0)
  // Files put back the way the branch found them (a revert, a probe undone) leave nothing to review. Compared with the
  // branch's base, not HEAD, so committing a change can never stand in for reviewing it. On 2026-11-09 reverting a
  // one-line test comment cost a second reviewer and a second critique.
  if (!gitDiff(root, '--relative', '--name-only', baseOf(root, config), now, '--', ...files).trim()) process.exit(0)

  // Fixes the session made after this message's review. The next review reads them in full; before this turn ends,
  // the copy and drift checks read them once, so a fix that adds a long string or a raw value is not handed over.
  // Each later stop reads only what changed since the last check, at most twice a message, so a session that fixes a
  // flagged line and adds another is read again without ever looping.
  if (state.reviewed) {
    // Work after this message's review. When the person's settings allow another review, it gets one, reading only
    // what came after the first (`from` is the tree that review was asked about). Otherwise the copy and drift checks
    // read it, and files created since the review, which are new surfaces rather than fixes, are named to the person:
    // before, a whole new page built after the review ended the turn with nothing said.
    if (state.blocks < config.maxReviewsPerMessage) {
      state.reviewed = false
      state.rechased = false
      delete state.fixBase
      save()
    } else {
      const fixBase = state.fixBase ?? state.askedTree
      if (!fixBase || !changedSince(fixBase).length) process.exit(0)
      const created = gitDiff(root, '--relative', '--name-only', '--diff-filter=A', state.askedTree, now, '--', ...UI).split('\n').filter(Boolean)
      const note =
        created.length && !state.notedCreated
          ? `Review before show: ${created.length} rendered file(s) created after this message's review were not reviewed (${created.slice(0, 5).join(', ')}); the next review reads them.`
          : null
      if (note) state.notedCreated = true
      let found = []
      if ((state.fixChecks ?? 0) < 2) {
        state.fixChecks = (state.fixChecks ?? 0) + 1
        state.fixBase = now
        found = [runCheck('check-copy-length.mjs', `--base=${fixBase}`), runCheck('check-drift.mjs', `--base=${fixBase}`)]
          .filter((r) => r.code === 1)
          .flatMap((r) => r.out.split('\n').filter((l) => /^ {2}\S/.test(l)))
      }
      save()
      if (!found.length && !note) process.exit(0)
      process.stdout.write(
        JSON.stringify({
          ...(note ? { systemMessage: note } : {}),
          ...(found.length
            ? {
                hookSpecificOutput: {
                  hookEventName: 'Stop',
                  additionalContext:
                    `The work after the review added these, which the checks flag:\n${found.slice(0, 12).join('\n')}\n` +
                    `Fix them, or tell the person why they stay.`,
                },
              }
            : {}),
        }),
      )
      process.exit(0)
    }
  }

  // The fingerprint names the change as it stands, so the same state is never reviewed twice.
  const fingerprint = createHash('sha1').update(gitDiff(root, '--relative', from, now, '--', ...UI)).update(carriedDiff).update(from).digest('hex').slice(0, 12)
  if (isLogged(fingerprint)) process.exit(0)
  const review = reviewOf(fingerprint)
  if (review.reported) {
    logReview(fingerprint, now)
    state.reviewed = true
    state.askedTree = now
    if (state.tasteNeeded) state.tasteFor = fingerprint
    save()
    tasteStep(state, save)
    process.exit(0)
  }
  const pending = review.called || (input.background_tasks ?? []).some((t) => /ui-review/.test(JSON.stringify(t)))
  // The review asked for is running in the background: let the turn end quietly and look again when its hand-back
  // arrives. Asking again here, then giving up with "was not reviewed", told the person on 2026-11-09 that a review had
  // not happened while it was a minute from reporting.
  if (review.running && state.lastBlocked === fingerprint) process.exit(0)

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
    // Pages that persuade or are read get the critic after the reviewer; it is asked for once the review reports.
    state.tasteFiles = config.artDirection?.length ? files.filter((f) => matchesAny(f, config.artDirection)) : []
    state.tasteNeeded = state.tasteFiles.length > 0
    state.askedTree = now
    keepTree(root, 'asked', now)
    save()
  }
  const packet = existsSync(tokenOf(fingerprint)) && existsSync(join(packetOf(fingerprint), 'server.txt')) ? { dir: packetOf(fingerprint), serving: /: yes/.test(readFileSync(join(packetOf(fingerprint), 'server.txt'), 'utf8')) } : writePacket(fingerprint, from, now, UI, state, carriedDiff)
  const shoot = config.screenshot
    ? `your screenshot command from .claude/design-harness.local.json (${config.screenshot})`
    : `\`node ${HARNESS}/bin/shoot.mjs /<route> --at=<css selector of the changed element>\``

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
              : `the ui-review you started has not reported; one still running in the background counts only once its report is handed back, so wait for it. `
            : '') +
          // Screenshots only when the project asks for them: on the 2026-11-01 benchmark they added 1.5 to 4 minutes a
          // review and caught none of the visual corrections. The measurements stay on: seconds each, and they are what
          // caught the visual classes (line breaks, check-breaks.mjs; overflow, grouping and alignment, check-layout.mjs).
          // Screenshots, when on, come with the regions changed since the last capture boxed.
          (packet.serving
            ? `1. The dev server serves this checkout, so run \`node ${HARNESS}/bin/check-a11y.mjs /<route>\` and ` +
              `\`node ${HARNESS}/bin/check-breaks.mjs /<route>\` and \`node ${HARNESS}/bin/check-layout.mjs /<route>\` on the pages this change renders` +
              (config.screenshots ? `, and take pictures of them with ${shoot}` : '') +
              `, writing all the output to ${packet.dir}/browser.txt. `
            : '') +
          `${packet.serving ? '2' : '1'}. Run the design-harness:ui-review agent in the FOREGROUND (run_in_background: false) where this session can, and ` +
          `wait for its report; a background run counts once its report is handed back. Its prompt: "packet: ${packet.dir}", "fingerprint: ${fingerprint}", and one sentence on ` +
          `what the change is for. The reviewer has no shell; the packet holds the change and the checks. ` +
          `Then fix the findings you agree with in what this turn built. Anything that would change a surface this turn ` +
          `did not set out to change, or that contradicts what the person asked for, is theirs to decide: list it for ` +
          `them instead of changing it.`,
      },
    }),
  )
  process.exit(0)
}

// The art-direction critic, after the reviewer. Returns true when it wrote the hook's answer (the caller exits).
// Asked once a message: a critique still running is asked for once more, then the turn ends with a note, never a loop.
function tasteStep(state, save) {
  const fp = state.tasteFor
  if (!fp || state.tasteDone === fp) return false
  const critic = reviewOf(fp, 'design-harness:art-direction', 'taste')
  if (critic.reported) {
    state.tasteDone = fp
    save()
    return false
  }
  const pending = critic.called || (input.background_tasks ?? []).some((t) => /art-direction/.test(JSON.stringify(t)))
  // Still running in the background: end the turn quietly and look again at the hand-back, rather than ask again and
  // then tell the person "the critic did not report" while it is still reading (2026-11-09).
  if (critic.running && state.tasteAsked === fp) return true
  const list = (state.tasteFiles ?? []).slice(0, 8).join(', ')
  if (state.tasteAsked === fp) {
    if (pending && !state.tasteRechased) {
      state.tasteRechased = true
      save()
    } else {
      state.tasteDone = fp
      save()
      process.stdout.write(JSON.stringify({ systemMessage: `Art direction: the critic did not report on this change to ${list}; the person has not had its verdict.` }))
      return true
    }
  } else {
    state.tasteAsked = fp
    save()
  }
  const dir = directionOf(fp)
  if (!existsSync(tokenOf(fp, 'taste')) || !existsSync(join(dir, 'README.md'))) {
    mkdirSync(dir, { recursive: true })
    mkdirSync(dirname(tokenOf(fp, 'taste')), { recursive: true })
    const token = randomBytes(8).toString('hex')
    writeFileSync(tokenOf(fp, 'taste'), token)
    writeFileSync(
      join(dir, 'README.md'),
      `review-token: ${token}\n\n# Art direction packet ${fp}\n\nStart your report with the review-token line above, exactly as written.\n\n` +
        `The change touched: ${list}.\n\nWhat the person asked for this turn, in their words:\n\n> ${String(state.request || '(not recorded)').slice(0, 1500).replace(/\n/g, '\n> ')}\n`,
    )
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          `This change touched a page that persuades or is read (${list}; \`artDirection\` in .claude/design-harness.json), so the ` +
          `art-direction critic judges it before it is handed back: the reviewer asks whether it is right, the critic whether it has ` +
          `a point of view. ` +
          (pending ? (critic.unread ? 'The critique you ran did not open its packet (its report lacks the review-token line); run it again. ' : 'The critique you started has not reported; one still running in the background counts only once its report is handed back, so wait for it. ') : '') +
          `1. From the project root, with the dev server serving this checkout, run \`node ${HARNESS}/bin/direction-packet.mjs --packet=${dir} /<route> ...\` ` +
          `for the pages this change renders (add --said="<the person's words about the page>" when they gave any). ` +
          `2. Run the design-harness:art-direction agent in the FOREGROUND (run_in_background: false) where this session can; a background run counts once its report is handed back. Its prompt: "packet: ${dir}", ` +
          `"fingerprint: ${fp}". 3. Show the person its verdict and directions before anything else you say about the work, in its ` +
          `words, including "not ready to show" when it says so. A clean check is not a verdict on taste.`,
      },
    }),
  )
  return true
}

// Design work done from a session opened somewhere else. The hook, the reviewer and the critic key off the session's
// own folder, so a session opened in one folder that edits a project running the harness gets none of them, silently.
// On 2026-11-09 a whole afternoon of work on a website went that way, from a session opened in the harness's own
// repository: no review, no critic, every proposal shown unjudged. This names it once a session, per project. It reads
// the files this turn's tools wrote (Edit, Write, and absolute paths in shell commands), and it can only speak where
// the plugin is enabled for that session.
function warnOutside() {
  if (!input.transcript_path || !existsSync(input.transcript_path)) return
  const entries = []
  for (const line of readFileSync(input.transcript_path, 'utf8').split('\n')) {
    try {
      if (line) entries.push(JSON.parse(line))
    } catch {}
  }
  const isPrompt = (e) => e.type === 'user' && (typeof e.message?.content === 'string' || (Array.isArray(e.message?.content) && e.message.content.some((b) => b.type === 'text')))
  let start = 0
  entries.forEach((e, i) => {
    if (isPrompt(e)) start = i
  })
  const paths = new Set()
  for (const e of entries.slice(start))
    for (const b of Array.isArray(e?.message?.content) ? e.message.content : [])
      if (b.type === 'tool_use') {
        if (typeof b.input?.file_path === 'string') paths.add(b.input.file_path)
        if (typeof b.input?.notebook_path === 'string') paths.add(b.input.notebook_path)
        if (b.name === 'Bash' && typeof b.input?.command === 'string') for (const m of b.input.command.matchAll(/(?:^|[\s'"=])(\/[^\s'"`;|&<>()]+)/g)) paths.add(m[1])
      }
  const here = resolve(root)
  const projects = new Map()
  for (const p of [...paths].slice(0, 300)) {
    let d = resolve(p)
    if (d === here || d.startsWith(here + sep)) continue
    while (d !== dirname(d)) {
      if (existsSync(join(d, '.claude', 'design-harness.json'))) {
        projects.set(d, (projects.get(d) ?? 0) + 1)
        break
      }
      d = dirname(d)
    }
  }
  if (!projects.size) return
  const seenPath = join(tmpdir(), `design-harness-outside.${String(input.session_id || 'unknown').replace(/[^\w-]/g, '')}.json`)
  let seen = []
  try {
    seen = JSON.parse(readFileSync(seenPath, 'utf8'))
  } catch {}
  const fresh = [...projects].filter(([d]) => !seen.includes(d))
  if (!fresh.length) return
  writeFileSync(seenPath, JSON.stringify([...seen, ...fresh.map(([d]) => d)]))
  const named = fresh.map(([d, n]) => `${d} (${n} path${n > 1 ? 's' : ''})`).join(', ')
  process.stdout.write(
    JSON.stringify({
      systemMessage:
        `Design harness: this turn touched ${named}, which runs the design harness, but this session was opened in ${here}, where it ` +
        `does not. Nothing here reviews or art-directs that work. Open a session in that project for design work on it.`,
    }),
  )
}
