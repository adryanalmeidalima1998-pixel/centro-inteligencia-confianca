import { ensureLegacyLigasSchema } from '@/lib/legacy-ligas-schema'
import { sql } from '@vercel/postgres'

// ─── Busca de jogadores no banco ─────────────────────────────────────────────
// Procura o termo em duas fontes e mescla o resultado:
//   1. jogadores_liga   (base de competições — Série C/D, Paulista A2, etc.)
//   2. jogadores_banco  (banco manual de clubes/jogadores)
// Cada fonte é isolada em try/catch: se a tabela estiver vazia ou não existir,
// a busca continua nas demais em vez de quebrar.
// Se nenhuma encontrar, o modal da página permite cadastro manual.

function idadeFromNascimento(nasc) {
  if (!nasc) return null
  const d = new Date(nasc)
  if (Number.isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) || null
}

function normKey(nome, clube) {
  return `${String(nome || '').toLowerCase().trim()}|${String(clube || '').toLowerCase().trim()}`
}

export async function GET(request) {
  await ensureLegacyLigasSchema()
  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get('q') || '').trim()
  if (q.length < 2) return Response.json({ jogadores: [] })

  const like = `%${q}%`
  const out = []
  const seen = new Set()

  const push = (item) => {
    const key = normKey(item.nome, item.clube)
    if (!item.nome || seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  // 1. Base de competições
  try {
    const r = await sql`
      SELECT nome, equipe, posicao, idade
      FROM jogadores_liga
      WHERE LOWER(nome) LIKE LOWER(${like})
      ORDER BY minutos DESC NULLS LAST
      LIMIT 25
    `
    for (const row of r.rows) {
      push({
        nome: row.nome,
        idade: row.idade || null,
        posicao: row.posicao || '',
        clube: row.equipe || '',
        fonte: 'Base de Ligas',
      })
    }
  } catch (_) {}

  // 2. Banco manual de jogadores
  try {
    const r = await sql`
      SELECT j.nome, j.posicao, j.nascimento, t.nome AS time_nome
      FROM jogadores_banco j
      LEFT JOIN times_db t ON t.id = j.time_id
      WHERE LOWER(j.nome) LIKE LOWER(${like})
      ORDER BY j.nome
      LIMIT 25
    `
    for (const row of r.rows) {
      push({
        nome: row.nome,
        idade: idadeFromNascimento(row.nascimento),
        posicao: row.posicao || '',
        clube: row.time_nome || '',
        fonte: 'Banco',
      })
    }
  } catch (_) {}

  return Response.json({ jogadores: out.slice(0, 40) })
}
