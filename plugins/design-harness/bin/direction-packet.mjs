#!/usr/bin/env node
/**
 * The art-direction critic's packet: pictures of the pages, each listed by its full path, the pages' modes read from
 * PRODUCT.md, and the paths of everything else the critic reads.
 *
 * Why. On 2026-11-09 three blind runs of the critic were handed a folder and told to look at its pictures. Two had to
 * guess the file names (one after about 25 misses), and one never found them and judged nothing: a subagent is not
 * always given a tool that lists a folder. The same day, the session that wrote the folder labelled a case page
 * Persuade where PRODUCT.md says Read. So nothing here is left to the reader to find or to the session to retype.
 *
 * Usage (from the project root, with the dev server serving this checkout):
 *   node direction-packet.mjs --packet=<folder> /route [/route ...] [--tiles=<n>] [--said="<the designer's words>"]
 * The folder is the one the review-before-show hook named (its README.md starts with the review token, which stays
 * first), or any new folder when the direction skill runs on its own. Pictures land in <folder>/pictures/.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS, loadConfig } from './lib.mjs'

const BIN = dirname(fileURLToPath(import.meta.url))
const root = process.cwd()
const config = loadConfig(root) ?? DEFAULTS
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const packet = arg('packet') && resolve(arg('packet'))
const routes = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!packet || !routes.length) {
  console.log('direction-packet: NOT RUN. Usage: node direction-packet.mjs --packet=<folder> /route [/route ...]')
  process.exit(2)
}
const pics = join(packet, 'pictures')
mkdirSync(pics, { recursive: true })

// The pictures, a screen at a time, by the harness's own screenshot script; its output names every file it wrote.
const shot = spawnSync('node', [join(BIN, 'shoot.mjs'), ...routes, `--tiles=${arg('tiles') || 4}`], { cwd: root, encoding: 'utf8', timeout: 240000 })
const lines = (shot.stdout ?? '').split('\n')
const taken = []
for (const l of lines) {
  const m = l.match(/^\s{2}(\/\S+\.png)\s{2}\((.+)\)$/)
  if (!m || !existsSync(m[1])) continue
  const name = `${String(taken.length + 1).padStart(2, '0')}-${basename(m[1])}`
  copyFileSync(m[1], join(pics, name))
  taken.push({ path: join(pics, name), what: m[2] })
}
const failed = lines.filter((l) => /could not load|NOT RUN/.test(l)).map((l) => l.trim())
if (!taken.length) {
  console.log(`direction-packet: NOT RUN. No picture was taken${failed.length ? `: ${failed.join('; ')}` : ' (is the dev server serving this checkout?)'}`)
  process.exit(2)
}

// Each route's mode, from PRODUCT.md's page table: a row naming the route in backticks, the mode in a cell of its own.
// A placeholder in the table (`/work/<slug>/`) matches any one path segment.
const productPath = join(root, config.product)
const product = existsSync(productPath) ? readFileSync(productPath, 'utf8').split('\n') : []
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const modeOf = (route) => {
  for (const row of product.filter((r) => r.trim().startsWith('|'))) {
    const named = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1])
    const hit = named.some((n) => new RegExp(`^${n.split(/<[^>]+>/).map(esc).join('[^/]+')}$`).test(route))
    const mode = row.split('|').map((c) => c.trim()).find((c) => /^(Persuade|Read|Operate)$/.test(c))
    if (hit && mode) return `${mode} (PRODUCT.md: ${row.trim().slice(0, 160)})`
  }
  return 'not named in PRODUCT.md: say so, and judge it as the page it reads as'
}

// What the critic compares with.
const listImages = (dir) => {
  const out = []
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(png|jpe?g|webp|gif|avif)$/i.test(n)) out.push(p)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}
const refDir = join(root, 'design', 'references')
const refs = listImages(refDir)
const refReadme = join(refDir, 'README.md')
const picks = join(root, 'design', 'picks.md')
const doc = (p) => (existsSync(join(root, p)) ? `\`${join(root, p)}\`` : `${p} (not in this project)`)

const readme = join(packet, 'README.md')
const said = arg('said')
const section = [
  existsSync(readme) ? '' : '# Art direction packet\n',
  '## The pages',
  '',
  ...routes.map((r) => `- \`${r}\`: ${modeOf(r)}`),
  ...(said ? ['', `What the designer said about it, in their words: "${said}"`] : []),
  '',
  `## Pictures (${taken.length}), each by its full path`,
  '',
  'Open every one with Read before reading any code. Motion is settled to its end state in each.',
  '',
  ...taken.map((t) => `- \`${t.path}\`: ${t.what}`),
  ...(failed.length ? ['', `Not captured: ${failed.join('; ')}`] : []),
  '',
  '## References the designer picked',
  '',
  ...(existsSync(refReadme) || refs.length
    ? [`- What each teaches: ${existsSync(refReadme) ? `\`${refReadme}\`` : 'no README (ask for one)'}`, ...refs.map((p) => `- \`${p}\``)]
    : ['None: `design/references/` is empty or missing. Your bar is the project\'s own best surfaces, and you must say so in "Beside the closest reference". A critique without references is the weaker one.']),
  '',
  '## Documents',
  '',
  `- DESIGN.md: ${doc(config.design)}`,
  `- PRODUCT.md: ${doc(config.product)}`,
  `- The designer's past picks: ${existsSync(picks) ? `\`${picks}\`` : 'design/picks.md (none yet)'}`,
  `- Settled rules: ${doc(config.rules)}`,
  '',
].join('\n')
if (existsSync(readme)) appendFileSync(readme, `\n${section}`)
else writeFileSync(readme, section)
console.log(`direction-packet: ${taken.length} picture(s) in ${relative(root, pics) || pics}; README at ${readme}`)
