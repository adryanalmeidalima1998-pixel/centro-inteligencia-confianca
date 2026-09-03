import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE_ROOTS = ['app', 'lib', 'data', 'scripts', 'public']
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.sql', '.css', '.txt', '.example'])
const ignoredDirs = new Set(['node_modules', '.next', '.git'])
const ignoredFiles = new Set(['scripts/repo-audit.mjs'])
const failures = []
const warnings = []
let scanned = 0

const blockingRules = [
  [/SPORTMONKS_API_TOKEN|api\.sportmonks/i, 'Integração Sportmonks obsoleta ainda presente em código executável'],
  [/confianca2026/i, 'Senha de desenvolvimento hardcoded'],
  [/\bGFC(?:_[A-Z0-9_]+|2)?\b/, 'Constante visual legada GFC ainda presente'],
]

const compatibilityRules = []

function scanFile(abs, rel) {
  if (ignoredFiles.has(rel)) return
  const text = fs.readFileSync(abs, 'utf8')
  scanned += 1
  for (const [regex, message] of blockingRules) {
    if (regex.test(text)) failures.push(`${rel}: ${message}`)
  }
  for (const [regex, message] of compatibilityRules) {
    if (regex.test(text)) warnings.push(`${rel}: ${message}`)
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(abs)
    else {
      const ext = path.extname(entry.name).toLowerCase()
      if (!TEXT_EXT.has(ext) && !entry.name.startsWith('.env')) continue
      scanFile(abs, path.relative(ROOT, abs).split(path.sep).join('/'))
    }
  }
}

for (const root of SOURCE_ROOTS) walk(path.join(ROOT, root))

for (const obsoleteAsset of [
  'public/Escudo-GFC.png',
]) {
  if (fs.existsSync(path.join(ROOT, obsoleteAsset))) failures.push(`${obsoleteAsset}: asset visual legado sem uso conhecido`)
}

const uniqueWarnings = [...new Set(warnings)]
if (uniqueWarnings.length) {
  console.log(`Avisos de compatibilidade (${uniqueWarnings.length}):`)
  for (const warning of uniqueWarnings.slice(0, 30)) console.log(`  - ${warning}`)
  if (uniqueWarnings.length > 30) console.log(`  ... ${uniqueWarnings.length - 30} aviso(s) adicional(is).`)
}

if (failures.length) {
  console.error(`\nFalhas de auditoria (${failures.length}):`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`\nAuditoria estrutural concluída sem falhas bloqueantes (${scanned} arquivos de texto verificados).`)
