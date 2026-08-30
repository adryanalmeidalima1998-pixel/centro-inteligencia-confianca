import { sql } from '@vercel/postgres'
import agendaBase from '@/data/agenda.json'
import { getGuaraniSportsbase } from '@/lib/guarani-sportsbase-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS_VALIDOS = new Set(['Jogo', 'Treino', 'Reunião', 'Viagem', 'Observação', 'Abertura de Janela', 'Outro'])

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeClub(value = '') {
  const ignored = new Set(['fc', 'sc', 'ac', 'ec', 'ao', 'se', 'afc', 'clube', 'futebol'])
  return normalizeText(value)
    .split(' ')
    .filter(token => token && !ignored.has(token))
    .join(' ')
}

function isoDate(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = String(value).trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  const br = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(safeNumber(value) * factor) / factor
}

function completedGame(game) {
  const home = game.mando === 'casa'
  const goalsFor = safeNumber(game.golsPro)
  const goalsAgainst = safeNumber(game.golsContra)
  const opponent = String(game.adversario || '').trim()

  return {
    id: game.id || `sportsbase-${game.data}-${normalizeText(opponent).replace(/\s+/g, '-')}`,
    tipo: 'Jogo',
    titulo: `${home ? 'Confiança' : opponent} x ${home ? opponent : 'Confiança'}`,
    competicao: game.competicao || 'Brasileirão Série C 2026',
    rodada: safeNumber(game.rodada, null),
    mandante: home ? 'Confiança' : opponent,
    visitante: home ? opponent : 'Confiança',
    adversario: opponent,
    mando: game.mando,
    data: isoDate(game.data),
    hora: '',
    local: home ? 'Arena Batistão' : '',
    scout: '',
    descricao: '',
    status: 'realizado',
    origem: 'sportsbase-guarani',
    editavel: false,
    resultado: game.resultado || (goalsFor > goalsAgainst ? 'V' : goalsFor < goalsAgainst ? 'D' : 'E'),
    golsGuarani: goalsFor,
    golsAdversario: goalsAgainst,
    golsMandante: home ? goalsFor : goalsAgainst,
    golsVisitante: home ? goalsAgainst : goalsFor,
    placar: home ? `${goalsFor}:${goalsAgainst}` : `${goalsAgainst}:${goalsFor}`,
    sistema: game.sistema || game.tatica || '—',
    metricas: {
      indice: safeNumber(game.indice),
      posse: round(game.posse_pct),
      chutes: safeNumber(game.remates),
      chutesAlvo: safeNumber(game.remates_no_alvo),
      chutesAlvoPct: round(game.remates_alvo_pct),
      chances: safeNumber(game.chances_gol),
      chancesConvertidasPct: round(game.chances_gol_pct),
      passes: safeNumber(game.passes),
      passesPct: round(game.passes_pct),
      passesProgressivos: safeNumber(game.passes_prog),
      passesProgressivosPct: round(game.passes_prog_pct),
      passesChave: safeNumber(game.passes_chave),
      entradasTercoFinal: safeNumber(game.entradas_tercofinal),
      entradasArea: safeNumber(game.entradas_area),
      duelos: safeNumber(game.duelos),
      duelosPct: round(game.duelos_pct),
      duelosDefensivos: safeNumber(game.duelos_def),
      duelosDefensivosPct: round(game.duelos_def_pct),
      recuperacoes: safeNumber(game.recuperacoes),
      recuperacoesCampoAdversario: safeNumber(game.recuperacoes_campo_adversario),
      pressao: safeNumber(game.pressao),
      pressaoPct: round(game.pressao_pct),
      perdas: safeNumber(game.perdas_bola),
      perdasCampoProprio: safeNumber(game.perdas_campo_proprio),
      cruzamentos: safeNumber(game.cruzamentos),
      cruzamentosPct: round(game.cruzamentos_pct),
      dribles: safeNumber(game.dribles),
      driblesPct: round(game.dribles_pct),
    },
  }
}

function scheduledGame(row) {
  const mandante = String(row?.Mandante || '').trim()
  const visitante = String(row?.Visitante || '').trim()
  const guaraniHome = normalizeText(mandante).includes('confianca')
  const opponent = guaraniHome ? visitante : mandante
  const data = isoDate(row?.Data)
  return {
    id: `agenda-${data}-${normalizeText(opponent).replace(/\s+/g, '-')}`,
    tipo: 'Jogo',
    titulo: `${mandante} x ${visitante}`,
    competicao: row?.['Competição'] || 'Brasileirão Série C',
    rodada: null,
    mandante,
    visitante,
    adversario: opponent,
    mando: guaraniHome ? 'casa' : 'fora',
    data,
    hora: row?.Horário ? String(row.Horário).slice(0, 5) : '',
    local: guaraniHome ? 'Arena Batistão' : '',
    scout: '',
    descricao: '',
    status: 'agendado',
    origem: 'calendario-base',
    editavel: false,
    resultado: null,
    metricas: null,
  }
}

async function ensureAgendaTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agenda_eventos (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT NOT NULL DEFAULT 'Outro',
      titulo      TEXT,
      descricao   TEXT,
      competicao  TEXT,
      mandante    TEXT,
      visitante   TEXT,
      data        DATE NOT NULL,
      hora        TIME,
      local       TEXT,
      scout       TEXT,
      status      TEXT NOT NULL DEFAULT 'agendado',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

function manualEvent(row) {
  const mandante = row.mandante || ''
  const visitante = row.visitante || ''
  const guaraniHome = normalizeText(mandante).includes('confianca')
  const isGame = row.tipo === 'Jogo'
  return {
    id: `manual-${row.id}`,
    dbId: row.id,
    tipo: row.tipo || 'Outro',
    titulo: row.titulo || row.descricao || (isGame ? `${mandante} x ${visitante}` : row.tipo),
    descricao: row.descricao || '',
    competicao: row.competicao || '',
    mandante,
    visitante,
    adversario: isGame ? (guaraniHome ? visitante : mandante) : '',
    mando: isGame ? (guaraniHome ? 'casa' : 'fora') : null,
    data: isoDate(row.data),
    hora: row.hora ? String(row.hora).slice(0, 5) : '',
    local: row.local || '',
    scout: row.scout || '',
    status: row.status || 'agendado',
    origem: 'manual',
    editavel: true,
    resultado: null,
    metricas: null,
  }
}

function sameScheduledMatch(schedule, completed) {
  if (normalizeClub(schedule.adversario) !== normalizeClub(completed.adversario)) return false
  if (!schedule.data || !completed.data) return true
  const diff = Math.abs(new Date(`${schedule.data}T12:00:00`).getTime() - new Date(`${completed.data}T12:00:00`).getTime())
  return diff <= 28 * 24 * 60 * 60 * 1000
}

function buildSummary(realizados, proximos, eventos) {
  const ordered = [...realizados].sort((a, b) => a.data.localeCompare(b.data))
  const last = ordered.at(-1) || null
  const lastFive = ordered.slice(-5)
  const record = ordered.reduce((acc, game) => {
    if (game.resultado === 'V') acc.vitorias += 1
    else if (game.resultado === 'D') acc.derrotas += 1
    else acc.empates += 1
    acc.pontos += game.resultado === 'V' ? 3 : game.resultado === 'E' ? 1 : 0
    acc.golsPro += safeNumber(game.golsGuarani)
    acc.golsContra += safeNumber(game.golsAdversario)
    return acc
  }, { vitorias: 0, empates: 0, derrotas: 0, pontos: 0, golsPro: 0, golsContra: 0 })

  return {
    jogosRealizados: ordered.length,
    proximosJogos: proximos.filter(item => item.tipo === 'Jogo').length,
    compromissosInternos: eventos.filter(item => item.tipo !== 'Jogo').length,
    pendentesDados: eventos.filter(item => item.status === 'aguardando_dados').length,
    ultimoJogo: last,
    proximoJogo: proximos.find(item => item.tipo === 'Jogo') || null,
    proximoEvento: proximos[0] || null,
    forma: lastFive.map(game => game.resultado),
    record,
    medias: ordered.length ? {
      gols: round(record.golsPro / ordered.length, 2),
      chutes: round(ordered.reduce((sum, game) => sum + safeNumber(game.metricas?.chutes), 0) / ordered.length, 1),
      posse: round(ordered.reduce((sum, game) => sum + safeNumber(game.metricas?.posse), 0) / ordered.length, 1),
      passesPct: round(ordered.reduce((sum, game) => sum + safeNumber(game.metricas?.passesPct), 0) / ordered.length, 1),
    } : null,
  }
}

export async function GET() {
  const warnings = []
  let sportsbase = { games: [], uploads: {} }
  let manualRows = []

  try {
    sportsbase = await getGuaraniSportsbase()
  } catch (error) {
    warnings.push(`Dados coletivos indisponíveis: ${error.message}`)
  }

  try {
    await ensureAgendaTable()
    const result = await sql`
      SELECT id, tipo, titulo, descricao, competicao, mandante, visitante,
             data::text AS data, hora::text AS hora, local, scout, status,
             created_at, updated_at
      FROM agenda_eventos
      ORDER BY data ASC, hora ASC NULLS LAST
    `
    manualRows = result.rows
  } catch (error) {
    warnings.push(`Compromissos manuais indisponíveis: ${error.message}`)
  }

  const realizados = (sportsbase.games || []).map(completedGame).filter(game => game.data)
  const hoje = isoDate(new Date())
  const programados = (agendaBase || [])
    .map(scheduledGame)
    .filter(game => game.data)
    .filter(game => !realizados.some(done => sameScheduledMatch(game, done)))
    .map(game => game.data < hoje ? { ...game, status: 'aguardando_dados' } : game)
  const manuais = manualRows.map(manualEvent)

  const eventos = [...realizados, ...programados, ...manuais]
    .sort((a, b) => `${a.data} ${a.hora || '00:00'}`.localeCompare(`${b.data} ${b.hora || '00:00'}`))

  const proximos = eventos.filter(item => item.data >= hoje && item.status !== 'cancelado')
  const resumo = buildSummary(realizados, proximos, manuais)

  return Response.json({
    eventos,
    realizados,
    proximos,
    manuais,
    resumo,
    fonte: {
      coletiva: sportsbase.uploads?.team || null,
      atualizadaEm: sportsbase.uploads?.updatedAt || null,
      partidasImportadas: realizados.length,
    },
    warnings,
  })
}

export async function POST(request) {
  try {
    await ensureAgendaTable()
    const body = await request.json()
    const tipo = TIPOS_VALIDOS.has(body.tipo) ? body.tipo : 'Outro'
    const data = isoDate(body.data)
    if (!data) return Response.json({ error: 'Informe uma data válida.' }, { status: 400 })

    const result = await sql`
      INSERT INTO agenda_eventos (
        tipo, titulo, descricao, competicao, mandante, visitante,
        data, hora, local, scout, status
      ) VALUES (
        ${tipo}, ${body.titulo || null}, ${body.descricao || null},
        ${body.competicao || null}, ${body.mandante || null}, ${body.visitante || null},
        ${data}, ${body.hora || null}, ${body.local || null}, ${body.scout || null},
        ${body.status || 'agendado'}
      )
      RETURNING id
    `
    return Response.json({ ok: true, id: result.rows[0].id })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureAgendaTable()
    const body = await request.json()
    const id = Number(body.id)
    const data = isoDate(body.data)
    if (!id) return Response.json({ error: 'Evento inválido.' }, { status: 400 })
    if (!data) return Response.json({ error: 'Informe uma data válida.' }, { status: 400 })
    const tipo = TIPOS_VALIDOS.has(body.tipo) ? body.tipo : 'Outro'

    await sql`
      UPDATE agenda_eventos SET
        tipo = ${tipo},
        titulo = ${body.titulo || null},
        descricao = ${body.descricao || null},
        competicao = ${body.competicao || null},
        mandante = ${body.mandante || null},
        visitante = ${body.visitante || null},
        data = ${data},
        hora = ${body.hora || null},
        local = ${body.local || null},
        scout = ${body.scout || null},
        status = ${body.status || 'agendado'},
        updated_at = NOW()
      WHERE id = ${id}
    `
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureAgendaTable()
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!id) return Response.json({ error: 'Evento inválido.' }, { status: 400 })
    await sql`DELETE FROM agenda_eventos WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
