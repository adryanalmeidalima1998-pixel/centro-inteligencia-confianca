import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const roots = ['app/api', 'lib', 'data', 'scripts']
const files = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(abs)
    else if (/\.(?:js|mjs)$/.test(entry.name) && !entry.name.includes('check-server-syntax')) files.push(abs)
  }
}

for (const rel of roots) walk(path.join(ROOT, rel))
files.push(path.join(ROOT, 'middleware.js'), path.join(ROOT, 'next.config.mjs'))

let failed = 0
for (const file of [...new Set(files)].sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed += 1
    console.error(`\n[syntax] ${path.relative(ROOT, file)}\n${result.stderr || result.stdout}`)
  }
}

if (failed) {
  console.error(`\n${failed} arquivo(s) com erro de sintaxe.`)
  process.exit(1)
}
console.log(`Sintaxe validada em ${files.length} arquivo(s) server/data.`)
