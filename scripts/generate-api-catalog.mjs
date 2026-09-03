import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const API_ROOT = path.join(ROOT, 'app', 'api')
const OUT = path.join(ROOT, 'docs', 'technical', '04-API-CATALOG.md')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })
}

function apiPath(file) {
  const relative = path.relative(path.join(ROOT, 'app'), path.dirname(file)).split(path.sep).join('/')
  return `/${relative}`
}

function methodsFor(text) {
  return METHODS.filter(method => {
    const patterns = [
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`),
      new RegExp(`export\\s+const\\s+${method}\\b`),
    ]
    return patterns.some(pattern => pattern.test(text))
  })
}

function groupFor(route) {
  const rest = route.replace(/^\/api\//, '')
  if (rest.startsWith('serie-c/')) return 'Série C / competição'
  if (rest.startsWith('ligas-v2/')) return 'Ligas / datasets'
  if (rest.startsWith('treinadores/')) return 'Treinadores'
  if (rest.startsWith('scouting-automation/')) return 'Automação de scouting'
  if (rest.startsWith('ai/')) return 'IA / extração'
  if (['gps','cmj-basal','forca-basal','pcr-basal','maturacao','status-recuperacao','dm','banco-treino','banco-partidas','treino-duracao','penaltis'].some(p => rest === p || rest.startsWith(`${p}/`))) return 'Corpo técnico / performance'
  if (['lista-final','lista-final-pdf','lista-preferencial','candidatos-pipeline','focos-recrutamento','funil','observacao','monitoramento','transferroom','relatorios-jogadores','jogadores-destacados','avaliacao-atleta','evolucao-jogadores','shadows'].some(p => rest === p || rest.startsWith(`${p}/`))) return 'Mercado / recrutamento'
  if (['club-sportsbase','club-calendar','agenda','squad','photos','photo-map','team-crest','weather-match','standings'].some(p => rest === p || rest.startsWith(`${p}/`))) return 'Clube / operação'
  if (['auth','notify','notificacoes'].some(p => rest === p || rest.startsWith(`${p}/`))) return 'Autenticação / operação'
  return 'Dados / utilidades'
}

const files = walk(API_ROOT).filter(file => file.endsWith(`${path.sep}route.js`))
const rows = files.map(file => {
  const text = fs.readFileSync(file, 'utf8')
  return {
    route: apiPath(file),
    methods: methodsFor(text),
    group: groupFor(apiPath(file)),
    file: path.relative(ROOT, file).split(path.sep).join('/'),
    lines: text.split(/\r?\n/).length,
  }
}).sort((a,b) => a.group.localeCompare(b.group, 'pt-BR') || a.route.localeCompare(b.route))

const groups = new Map()
for (const row of rows) {
  if (!groups.has(row.group)) groups.set(row.group, [])
  groups.get(row.group).push(row)
}

let md = `# Catálogo de APIs\n\n> Gerado por \`npm run docs:api\`. Não editar manualmente a tabela de rotas.\n\n`
md += `Total atual: **${rows.length} Route Handlers** em \`app/api\`. Frontend e backend vivem no mesmo repositório Next.js; cada arquivo \`route.js\` é um endpoint server-side.\n\n`
md += `## Convenções\n\n- Rotas são protegidas pelo \`middleware.js\`, exceto autenticação e arquivos públicos.\n- APIs do Corpo Técnico e do Mercado são separadas logicamente por permissões de módulo.\n- Rotas com \`[slug]\`, \`[id]\` ou outros segmentos usam parâmetros dinâmicos do App Router.\n- O catálogo mostra superfície HTTP e localização do código; contratos detalhados devem permanecer próximos ao domínio correspondente.\n\n`

for (const [group, items] of groups) {
  md += `## ${group}\n\n| Métodos | Endpoint | Implementação | Linhas |\n|---|---|---|---:|\n`
  for (const row of items) {
    md += `| ${row.methods.length ? row.methods.join(', ') : 'NextAuth handler'} | \`${row.route}\` | \`${row.file}\` | ${row.lines} |\n`
  }
  md += '\n'
}

md += `## Rotas operacionais sem tela direta\n\nAlgumas rotas são intencionalmente acionadas por cron, manutenção ou encadeamento interno, e portanto podem não aparecer em busca estática por \`fetch('/api/...')\`:\n\n- \`/api/scouting-automation/cron\` — Vercel Cron diário.\n- \`/api/notificacoes\` — Vercel Cron semanal.\n- \`/api/player-master/sync\` — reconstrução/sincronização da ficha canônica.\n- \`/api/scouting-automation/material\` e \`/package\` — materialização de entregáveis da automação.\n\n`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md)
console.log(`API catalog generated: ${rows.length} routes -> ${path.relative(ROOT, OUT)}`)
