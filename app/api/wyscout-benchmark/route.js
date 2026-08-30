import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS wyscout_benchmark (
      id        SERIAL PRIMARY KEY,
      tipo      TEXT UNIQUE NOT NULL,
      data_json TEXT NOT NULL,
      upload_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// ── Mapeamento colunas PT Wyscout → chaves internas ──────────────────────────
const COL = {
  'Jogador':                               'nome',
  'Posição':                               'posicao',
  'Idade':                                 'idade',
  'Minutos jogados:':                      'minutos',
  'Partidas jogadas':                      'jogos',
  'Golos/90':                              'gols_90',
  'Golos esperados/90':                    'xg_90',
  'Assistências/90':                       'assists_90',
  'Assistências esperadas/90':             'xa_90',
  'Passes/90':                             'passes_90',
  'Passes certos, %':                      'passes_pct',
  'Passes progressivos/90':               'passes_prog_90',
  'Passes progressivos certos, %':        'passes_prog_pct',
  'Passes chave/90':                       'passes_chave_90',
  'Passes para terço final/90':           'passes_tercofinal_90',
  'Passes longos/90':                      'passes_longos_90',
  'Passes longos certos, %':              'passes_longos_pct',
  'Remates/90':                            'remates_90',
  'Remates à baliza, %':                   'remates_baliza_pct',
  'Dribles/90':                            'dribles_90',
  'Dribles com sucesso, %':               'dribles_pct',
  'Duelos defensivos/90':                  'duelos_def_90',
  'Duelos defensivos ganhos, %':           'duelos_def_pct',
  'Duelos ofensivos/90':                   'duelos_of_90',
  'Duelos ofensivos ganhos, %':            'duelos_of_pct',
  'Duelos aérios/90':                      'duelos_aereos_90',
  'Duelos aéreos ganhos, %':              'duelos_aereos_pct',
  'Interseções/90':                        'intercepoes_90',
  'Ações defensivas com êxito/90':         'acoes_def_90',
  'Cortes/90':                             'cortes_90',
  'Corridas progressivas/90':             'corridas_prog_90',
  'Acelerações/90':                        'aceleracoes_90',
  'Toques na área/90':                     'toques_area_90',
  'Cruzamentos/90':                        'cruzamentos_90',
  'Cruzamentos certos, %':                 'cruzamentos_pct',
  'Passes para a área de penálti/90':      'passes_area_90',
  'Faltas/90':                             'faltas_90',
  'Faltas sofridas/90':                    'faltas_sofridas_90',
  'Duelos/90':                             'duelos_90',
  'Duelos ganhos, %':                      'duelos_pct',
  // GK
  'Golos sofridos/90':                     'gols_sofridos_90',
  'Defesas, %':                            'defesas_pct',
  'Golos sofridos esperados/90':           'xg_contra_90',
  'Saídas/90':                             'saidas_90',
}

function mapRow(row, headers) {
  const obj = {}
  headers.forEach((h, i) => {
    const key = COL[h] || COL[h?.trim()]
    if (key) {
      const v = row[i]
      obj[key] = (v === null || v === undefined || v === '') ? null : (isNaN(Number(v)) ? v : Number(v))
    }
  })
  return obj
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const tipo    = searchParams.get('tipo')    // 'confianca' | 'serie_c'
    const posicao = searchParams.get('posicao') // primary position string to filter Série C

    if (!tipo) {
      // Return upload status for both
      const rows = await sql`SELECT tipo, upload_at FROM wyscout_benchmark`
      const status = {}
      rows.rows.forEach(r => { status[r.tipo] = r.upload_at })
      return Response.json({ status })
    }

    const rows = await sql`SELECT data_json FROM wyscout_benchmark WHERE tipo = ${tipo}`
    if (!rows.rows[0]) return Response.json({ players: [], message: 'Nenhum dado carregado ainda' })

    let players = JSON.parse(rows.rows[0].data_json)

    // Filter Série C by position group if requested
    if (tipo === 'serie_c' && posicao) {
      const group = positionGroup(posicao)
      players = players.filter(p => {
        const pg = positionGroup(p.posicao || '')
        return pg === group
      })
    }

    return Response.json({ players, count: players.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// ── POST — upload Excel ───────────────────────────────────────────────────────
export async function POST(req) {
  try {
    await ensureTable()
    const { tipo, base64 } = await req.json()
    if (!tipo || !base64) return Response.json({ error: 'tipo e base64 obrigatórios' }, { status: 400 })

    const buf  = Buffer.from(base64, 'base64')
    const wb   = XLSX.read(buf, { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const headers = raw[0] || []
    const players = raw.slice(1)
      .filter(row => row.some(v => v !== null && v !== ''))
      .map(row => mapRow(row, headers))
      .filter(p => p.nome)

    await sql`
      INSERT INTO wyscout_benchmark (tipo, data_json, upload_at)
      VALUES (${tipo}, ${JSON.stringify(players)}, NOW())
      ON CONFLICT (tipo) DO UPDATE SET data_json = EXCLUDED.data_json, upload_at = NOW()
    `

    return Response.json({ success: true, count: players.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// ── Helpers exportados para uso no frontend ───────────────────────────────────
export function positionGroup(posStr) {
  if (!posStr) return 'other'
  const p = posStr.toUpperCase()
  if (/\bGK\b/.test(p))                       return 'GK'
  if (/\b(LCB|RCB|CB)\b/.test(p))             return 'CB'
  if (/\b(LB|RB|LWB|RWB)\b/.test(p))          return 'FB'
  if (/\b(DMF|LDMF|RDMF)\b/.test(p))          return 'DM'
  if (/\b(CMF|LCMF|RCMF)\b/.test(p))          return 'CM'
  if (/\b(AMF|LAMF|RAMF)\b/.test(p))          return 'AM'
  if (/\b(LW|RW|LWF|RWF|WF)\b/.test(p))       return 'WI'
  if (/\b(CF|SS)\b/.test(p))                  return 'CF'
  return 'other'
}
