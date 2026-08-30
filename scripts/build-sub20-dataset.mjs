import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const projectRoot = process.cwd()
const input = process.argv[2] || path.join(projectRoot, 'data', 'SUB20 AMÉRICA DO SUL.xlsx')
const output = process.argv[3] || path.join(projectRoot, 'data', 'sub20-america-sul.json')

if (!fs.existsSync(input)) {
  console.error(`Arquivo não encontrado: ${input}`)
  process.exit(1)
}

const workbook = XLSX.readFile(input, { cellDates: true })
const sheets = workbook.SheetNames.map(name => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null, raw: true })
    .map((row, index) => ({ ...row, _sheet: name, _row: index + 2 }))
    .filter(row => String(row.Jogador || '').trim())
  return { name: String(name || '').trim(), rows }
}).filter(sheet => sheet.name && sheet.rows.length)

const totalPlayers = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
if (!totalPlayers) {
  console.error('Nenhum atleta foi encontrado na planilha.')
  process.exit(1)
}

const payload = {
  source: path.basename(input),
  generatedAt: new Date().toISOString(),
  sheets,
}

fs.writeFileSync(output, JSON.stringify(payload))
console.log(`Dataset Sub-20 gerado: ${totalPlayers} atletas em ${sheets.length} ligas.`)
console.log(output)
