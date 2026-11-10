#!/usr/bin/env node
/**
 * One line at session start: which harness version this session loaded, and whether it is the one the project pins.
 *
 * Why. On 2026-11-09 a session meant to test 0.19.0 ran 0.18.3 for its first hour: the project pinned v0.19.0 in
 * .claude/settings.local.json, but the marketplace copy had never been updated, so the pin did nothing and nothing said
 * so. Silent in a project without .claude/design-harness.json.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)))
let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {}
const dir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()
const read = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}
if (!existsSync(join(dir, '.claude', 'design-harness.json'))) process.exit(0)
const loaded = read(join(HARNESS, '.claude-plugin', 'plugin.json'))?.version ?? 'unknown'
// The ref a project pins for the marketplace the harness comes from, in its local or shared settings.
let pinned = null
for (const f of ['settings.local.json', 'settings.json']) {
  const m = read(join(dir, '.claude', f))?.extraKnownMarketplaces ?? {}
  for (const v of Object.values(m)) if (/design-harness/.test(v?.source?.repo ?? '') && v.source.ref) pinned ??= String(v.source.ref).replace(/^v/, '')
}
const line =
  pinned && pinned !== loaded
    ? `Design harness ${loaded} loaded, but this project pins ${pinned}. To load it: \`claude plugin marketplace update omelette\`, then \`claude plugin update design-harness@omelette --scope local\`, then start a new session.`
    : `Design harness ${loaded} loaded${pinned ? ' (the version this project pins)' : ''}.`
process.stdout.write(JSON.stringify({ systemMessage: line }))
