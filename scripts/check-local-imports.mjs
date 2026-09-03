import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const roots = ['app', 'lib', 'data', 'scripts']
const codeExt = /\.(js|jsx|mjs)$/
const specRe = /(?:from\s*|import\s*\(|require\s*\()\s*['"](@\/[^'"]+)['"]/g

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (codeExt.test(entry.name)) out.push(full)
  }
  return out
}

function resolves(alias) {
  const rel = alias.slice(2)
  const base = path.join(ROOT, rel)
  return [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
    path.join(base, 'index.mjs'),
  ].some(candidate => fs.existsSync(candidate))
}

const missing = []
let scanned = 0
for (const root of roots) {
  for (const file of walk(path.join(ROOT, root))) {
    scanned++
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(specRe)) {
      if (!resolves(match[1])) missing.push({ file: path.relative(ROOT, file), import: match[1] })
    }
  }
}

if (missing.length) {
  console.error(`Imports locais não resolvidos (${missing.length}):`)
  for (const item of missing) console.error(`- ${item.file}: ${item.import}`)
  process.exit(1)
}

console.log(`Imports @/ validados em ${scanned} arquivo(s) de código.`)
