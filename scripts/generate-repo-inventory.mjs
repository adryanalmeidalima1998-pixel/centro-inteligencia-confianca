import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/technical/18-INVENTARIO-CODIGO.md')
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

function filesUnder(root, predicate = () => true) {
  const out = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (predicate(abs)) out.push(abs)
    }
  }
  walk(path.join(ROOT, root))
  return out
}

const code = ['app', 'lib', 'data', 'scripts'].flatMap(root => filesUnder(root, p => CODE_EXT.has(path.extname(p))))
const pages = filesUnder('app', p => p.endsWith(`${path.sep}page.js`))
const routes = filesUnder('app/api', p => p.endsWith(`${path.sep}route.js`))
const components = filesUnder('app/components', p => CODE_EXT.has(path.extname(p)))
const domain = [...filesUnder('lib', p => CODE_EXT.has(path.extname(p))), ...filesUnder('data', p => path.extname(p) === '.js')]

const size = p => fs.statSync(p).size
const rel = p => path.relative(ROOT, p).split(path.sep).join('/')
const totalBytes = code.reduce((sum, p) => sum + size(p), 0)
const largest = [...code].sort((a, b) => size(b) - size(a)).slice(0, 20)
const largestRoutes = [...routes].sort((a, b) => size(b) - size(a)).slice(0, 15)

const lines = [
  '# 18 · Inventário do Código', '',
  '> Gerado automaticamente por `npm run docs:inventory`. Os números descrevem o repositório, não substituem análise de complexidade.', '',
  '## Resumo', '',
  `- **Páginas App Router:** ${pages.length}`,
  `- **Route Handlers (API):** ${routes.length}`,
  `- **Componentes compartilhados (` + '`app/components`' + `):** ${components.length}`,
  `- **Arquivos de domínio (lib/ + data/*.js):** ${domain.length}`,
  `- **Arquivos de código analisados:** ${code.length}`,
  `- **Volume aproximado de código:** ${(totalBytes / 1024 / 1024).toFixed(2)} MB`, '',
  '## Maiores arquivos de código', '',
  '| Arquivo | Tamanho |', '|---|---:|',
  ...largest.map(p => `| \`${rel(p)}\` | ${(size(p) / 1024).toFixed(1)} KB |`), '',
  'Arquivos grandes não são automaticamente um erro. Eles são candidatos a extração de componentes/serviços quando a mudança reduzir acoplamento sem gerar refactor de risco.', '',
  '## Maiores Route Handlers', '',
  '| Rota | Tamanho |', '|---|---:|',
  ...largestRoutes.map(p => `| \`${rel(p)}\` | ${(size(p) / 1024).toFixed(1)} KB |`), '',
  '## Leitura de engenharia', '',
  '- O backend está distribuído nos Route Handlers do App Router; não existe um segundo repositório BE.',
  '- Regras compartilhadas devem sair das rotas quando aparecem em mais de um fluxo. A segunda etapa de limpeza centralizou identidade do clube e utilitários de partida em lib/club-config.js e lib/serieCMatch.js.',
  '- Os maiores arquivos atuais estão majoritariamente em telas analíticas densas. A próxima decomposição deve ser guiada por frequência de mudança e testes, não apenas por número de linhas.', '',
  '## Atualização', '',
  'Regere após mudanças estruturais:', '', '```bash', 'npm run docs:inventory', '```', ''
]
fs.writeFileSync(OUT, lines.join('\n'))
console.log(`Inventário salvo em ${path.relative(ROOT, OUT)}`)
