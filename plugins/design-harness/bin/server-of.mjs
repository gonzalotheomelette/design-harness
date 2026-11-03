#!/usr/bin/env node
/**
 * Is the dev server serving THIS checkout? Two sessions can share a port, and a screenshot or an accessibility
 * run against the other session's code proves nothing about this change. One command, so a reviewer whose shell
 * permissions refuse compound lines can still ask it (the first live client trial skipped its screenshots for
 * exactly that reason).
 *
 * Usage: node server-of.mjs   (from the project root)
 * Prints `serves this checkout: yes` (exit 0), or `no` / `nothing listening` with why (exit 1).
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { DEFAULTS, loadConfig } from './lib.mjs'

const root = realpathSync(process.cwd())
const config = loadConfig(root) ?? DEFAULTS
const url = new URL(config.devServer)
const port = url.port || (url.protocol === 'https:' ? '443' : '80')
// lsof exits 1 when any file on the machine is unreadable, and still prints what it found: read its output whatever
// the exit status. Treating that exit as "nothing" hid a listening server on a CI runner.
const sh = (...args) =>
  spawnSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).stdout?.trim() ?? ''
const pids = sh('lsof', '-nPw', `-iTCP:${port}`, '-sTCP:LISTEN', '-t').split('\n').filter(Boolean)
if (!pids.length) {
  console.log(`serves this checkout: nothing listening on ${port} (${config.devServer})`)
  process.exit(1)
}
for (const pid of pids) {
  const cwd = sh('lsof', '-aw', '-p', pid, '-d', 'cwd', '-Fn').split('\n').find((l) => l.startsWith('n'))?.slice(1)
  let real = cwd
  try {
    real = realpathSync(cwd)
  } catch {}
  if (real === root) {
    console.log(`serves this checkout: yes (${config.devServer}, pid ${pid})`)
    process.exit(0)
  }
  console.log(`serves this checkout: no (${config.devServer} is pid ${pid}, running from ${cwd})`)
}
process.exit(1)
