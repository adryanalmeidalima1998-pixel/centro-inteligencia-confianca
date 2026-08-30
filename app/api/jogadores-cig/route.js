import { ensureLegacyLigasSchema } from '@/lib/legacy-ligas-schema'
import { db } from '@vercel/postgres'

const VALID_COLS = new Set([
  'minutos','gols','assistencias','xg','xa','idade','elo','potencial',
  'interceptacoes','desarmes','recuperacoes','cruzamentos','chutes',
  'partidas','passes_pct','passes_prog','dribles','duelos_aereos','chutes_gol'
])

export async function GET(req) {
  await ensureLegacyLigasSchema()
  const { searchParams } = new URL(req.url)
  const ligaSlug  = searchParams.get('liga') || ''
  const grupo     = searchParams.get('grupo') || ''
  const posicao   = searchParams.get('posicao') || ''
  const busca     = searchParams.get('busca') || ''
  const equipe    = searchParams.get('equipe') || ''
  const minMin    = parseInt(searchParams.get('minMin') || '0')
  const minMax    = parseInt(searchParams.get('minMax') || '99999')
  const idadeMin  = parseInt(searchParams.get('idadeMin') || '0')
  const idadeMax  = parseInt(searchParams.get('idadeMax') || '99')
  const ordemRaw  = searchParams.get('ordem') || 'minutos'
  const dir       = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC'
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage   = Math.min(100, parseInt(searchParams.get('perPage') || '50'))
  const offset    = (page - 1) * perPage
  const ordem     = VALID_COLS.has(ordemRaw) ? ordemRaw : 'minutos'

  const client = await db.connect()
  try {
    // Resolver liga_id
    let ligaId = null
    if (ligaSlug) {
      const lr = await client.query('SELECT id FROM ligas_cig WHERE slug = $1 LIMIT 1', [ligaSlug])
      if (lr.rows.length) ligaId = lr.rows[0].id
    }

    // Construção dinâmica e segura do WHERE
    const conds = []
    const vals  = []

    if (ligaId !== null) {
      vals.push(ligaId); conds.push(`j.liga_id = $${vals.length}`)
    }
    if (grupo) {
      vals.push(grupo); conds.push(`j.posicao_grupo = $${vals.length}`)
    }
    if (posicao) {
      vals.push(`%${posicao}%`); conds.push(`j.posicao ILIKE $${vals.length}`)
    }
    if (busca) {
      vals.push(`%${busca}%`); conds.push(`j.nome ILIKE $${vals.length}`)
    }
    if (equipe) {
      vals.push(`%${equipe}%`); conds.push(`j.equipe ILIKE $${vals.length}`)
    }
    if (minMin > 0) {
      vals.push(minMin); conds.push(`j.minutos >= $${vals.length}`)
    }
    if (minMax < 99999) {
      vals.push(minMax); conds.push(`j.minutos <= $${vals.length}`)
    }
    if (idadeMin > 15) {
      vals.push(idadeMin); conds.push(`j.idade >= $${vals.length}`)
    }
    if (idadeMax < 45) {
      vals.push(idadeMax); conds.push(`j.idade <= $${vals.length}`)
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const base  = `FROM jogadores_liga j JOIN ligas_cig l ON l.id = j.liga_id ${where}`

    // Total
    const countRes = await client.query(`SELECT COUNT(*) AS total ${base}`, vals)
    const total = parseInt(countRes.rows[0].total)

    // Dados — ORDER BY via string interpolação segura (coluna validada)
    const dataVals = [...vals, perPage, offset]
    const dataRes = await client.query(
      `SELECT j.id, j.nome, j.equipe, j.posicao, j.posicao_grupo, j.idade, j.altura, j.pe,
              j.minutos, j.partidas, j.fim_contrato, j.valor_mercado, j.agente,
              j.elo, j.elo_max, j.reap, j.potencial,
              j.gols, j.assistencias, j.xg, j.xa,
              j.passes_pct, j.passes_prog, j.dribles, j.dribles_pct,
              j.interceptacoes, j.recuperacoes, j.desarmes,
              j.duelos_aereos, j.duelos_aereos_pct, j.chutes, j.chutes_gol, j.cruzamentos,
              l.nome AS liga_nome, l.slug AS liga_slug, l.cor_hex AS liga_cor
       ${base}
       ORDER BY j."${ordem}" ${dir} NULLS LAST
       LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      dataVals
    )

    return Response.json({ jogadores: dataRes.rows, total, page, perPage })
  } catch (e) {
    console.error('[jogadores-cig]', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
