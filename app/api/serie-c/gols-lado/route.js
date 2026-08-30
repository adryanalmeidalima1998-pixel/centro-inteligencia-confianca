import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

const GOAL_TYPES = new Set(['nao_informado','jogo_organizado','contra_ataque','escanteio','falta_lateral','falta_direta','penalti','outro'])

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_gols_lado (
      id SERIAL PRIMARY KEY,
      rodada INTEGER NOT NULL UNIQUE,
      esquerda INTEGER NOT NULL DEFAULT 0,
      centro INTEGER NOT NULL DEFAULT 0,
      direita INTEGER NOT NULL DEFAULT 0,
      marcados_esquerda INTEGER NOT NULL DEFAULT 0,
      marcados_centro INTEGER NOT NULL DEFAULT 0,
      marcados_direita INTEGER NOT NULL DEFAULT 0,
      gols_sofridos_pontos JSONB NOT NULL DEFAULT '[]'::jsonb,
      gols_marcados_pontos JSONB NOT NULL DEFAULT '[]'::jsonb,
      ataques_esquerda INTEGER NOT NULL DEFAULT 0,
      ataques_centro INTEGER NOT NULL DEFAULT 0,
      ataques_direita INTEGER NOT NULL DEFAULT 0,
      amostra_ataques INTEGER,
      duelos_def_ganhos_esquerda INTEGER NOT NULL DEFAULT 0,
      duelos_def_ganhos_centro INTEGER NOT NULL DEFAULT 0,
      duelos_def_ganhos_direita INTEGER NOT NULL DEFAULT 0,
      amostra_duelos_def_ganhos INTEGER,
      duelos_aereos_esquerda INTEGER NOT NULL DEFAULT 0,
      duelos_aereos_centro INTEGER NOT NULL DEFAULT 0,
      duelos_aereos_direita INTEGER NOT NULL DEFAULT 0,
      amostra_duelos_aereos INTEGER,
      source_page INTEGER,
      metodo VARCHAR(120),
      cruzamentos_esquerda INTEGER NOT NULL DEFAULT 0,
      cruzamentos_centro INTEGER NOT NULL DEFAULT 0,
      cruzamentos_direita INTEGER NOT NULL DEFAULT 0,
      amostra_cruzamentos INTEGER,
      dribles_esquerda INTEGER NOT NULL DEFAULT 0,
      dribles_centro INTEGER NOT NULL DEFAULT 0,
      dribles_direita INTEGER NOT NULL DEFAULT 0,
      amostra_dribles INTEGER,
      recuperacoes_altas_esquerda INTEGER NOT NULL DEFAULT 0,
      recuperacoes_altas_centro INTEGER NOT NULL DEFAULT 0,
      recuperacoes_altas_direita INTEGER NOT NULL DEFAULT 0,
      amostra_recuperacoes_altas INTEGER,
      source_page_ofensiva INTEGER,
      metodo_ofensivo VARCHAR(140),
      recuperacoes_zonas JSONB,
      perdas_zonas JSONB,
      faltas_zonas JSONB,
      source_page_transicoes INTEGER,
      metodo_transicoes VARCHAR(160),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  const statements = [
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS marcados_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS marcados_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS marcados_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS gols_sofridos_pontos JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS gols_marcados_pontos JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS ataques_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS ataques_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS ataques_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_ataques INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_def_ganhos_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_def_ganhos_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_def_ganhos_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_duelos_def_ganhos INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_aereos_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_aereos_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS duelos_aereos_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_duelos_aereos INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS source_page INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS metodo VARCHAR(120)`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS cruzamentos_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS cruzamentos_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS cruzamentos_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_cruzamentos INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS dribles_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS dribles_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS dribles_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_dribles INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS recuperacoes_altas_esquerda INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS recuperacoes_altas_centro INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS recuperacoes_altas_direita INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS amostra_recuperacoes_altas INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS source_page_ofensiva INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS metodo_ofensivo VARCHAR(140)`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS recuperacoes_zonas JSONB`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS perdas_zonas JSONB`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS faltas_zonas JSONB`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS source_page_transicoes INTEGER`,
    `ALTER TABLE serie_c_gols_lado ADD COLUMN IF NOT EXISTS metodo_transicoes VARCHAR(160)`,
  ]
  for (const statement of statements) {
    try { await sql.query(statement) } catch (_) {}
  }
}

function normalizeGoalType(value) {
  const tipo = String(value || 'nao_informado').trim().toLowerCase()
  return GOAL_TYPES.has(tipo) ? tipo : 'nao_informado'
}

function safePoints(value) {
  const arr = Array.isArray(value) ? value : []
  return arr.slice(0, 160).map((point, index) => ({
    id:String(point?.id || `${Date.now()}-${index}`).slice(0,80),
    x:Math.max(0, Math.min(100, Number(point?.x) || 0)),
    y:Math.max(0, Math.min(100, Number(point?.y) || 0)),
    tipo:normalizeGoalType(point?.tipo),
  }))
}

function parseJsonPoints(value) {
  if (Array.isArray(value)) return safePoints(value)
  if (!value) return []
  try { return safePoints(typeof value === 'string' ? JSON.parse(value) : value) } catch (_) { return [] }
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch (_) { return null }
}

function safeSpatialObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const cleanCell = cell => {
    if (!cell || typeof cell !== 'object') return { defensivo:null, medio:null, ofensivo:null }
    const n = key => Number.isFinite(Number(cell[key])) ? Number(cell[key]) : null
    return { defensivo:n('defensivo'), medio:n('medio'), ofensivo:n('ofensivo') }
  }
  const grid = value.pct || value.per90 ? value : { pct:value }
  return {
    pct:grid.pct ? { esquerda:cleanCell(grid.pct.esquerda), centro:cleanCell(grid.pct.centro), direita:cleanCell(grid.pct.direita) } : null,
    per90:grid.per90 ? { esquerda:cleanCell(grid.per90.esquerda), centro:cleanCell(grid.per90.centro), direita:cleanCell(grid.per90.direita) } : null,
  }
}

function corridorCounts(points) {
  let esquerda = 0, centro = 0, direita = 0
  for (const p of safePoints(points)) {
    if (p.x < 33.333) esquerda += 1
    else if (p.x < 66.667) centro += 1
    else direita += 1
  }
  return { esquerda, centro, direita }
}

function serialize(row) {
  if (!row) return null
  return {
    rodada:Number(row.rodada),
    esquerda:Number(row.esquerda || 0), centro:Number(row.centro || 0), direita:Number(row.direita || 0),
    marcados_esquerda:Number(row.marcados_esquerda || 0), marcados_centro:Number(row.marcados_centro || 0), marcados_direita:Number(row.marcados_direita || 0),
    gols_sofridos_pontos:parseJsonPoints(row.gols_sofridos_pontos),
    gols_marcados_pontos:parseJsonPoints(row.gols_marcados_pontos),
    ataques_esquerda:Number(row.ataques_esquerda || 0), ataques_centro:Number(row.ataques_centro || 0), ataques_direita:Number(row.ataques_direita || 0),
    amostra_ataques:row.amostra_ataques == null ? null : Number(row.amostra_ataques),
    duelos_def_ganhos_esquerda:Number(row.duelos_def_ganhos_esquerda || 0), duelos_def_ganhos_centro:Number(row.duelos_def_ganhos_centro || 0), duelos_def_ganhos_direita:Number(row.duelos_def_ganhos_direita || 0),
    amostra_duelos_def_ganhos:row.amostra_duelos_def_ganhos == null ? null : Number(row.amostra_duelos_def_ganhos),
    duelos_aereos_esquerda:Number(row.duelos_aereos_esquerda || 0), duelos_aereos_centro:Number(row.duelos_aereos_centro || 0), duelos_aereos_direita:Number(row.duelos_aereos_direita || 0),
    amostra_duelos_aereos:row.amostra_duelos_aereos == null ? null : Number(row.amostra_duelos_aereos),
    source_page:row.source_page == null ? null : Number(row.source_page),
    metodo:row.metodo || null,
    cruzamentos_esquerda:Number(row.cruzamentos_esquerda || 0), cruzamentos_centro:Number(row.cruzamentos_centro || 0), cruzamentos_direita:Number(row.cruzamentos_direita || 0),
    amostra_cruzamentos:row.amostra_cruzamentos == null ? null : Number(row.amostra_cruzamentos),
    dribles_esquerda:Number(row.dribles_esquerda || 0), dribles_centro:Number(row.dribles_centro || 0), dribles_direita:Number(row.dribles_direita || 0),
    amostra_dribles:row.amostra_dribles == null ? null : Number(row.amostra_dribles),
    recuperacoes_altas_esquerda:Number(row.recuperacoes_altas_esquerda || 0), recuperacoes_altas_centro:Number(row.recuperacoes_altas_centro || 0), recuperacoes_altas_direita:Number(row.recuperacoes_altas_direita || 0),
    amostra_recuperacoes_altas:row.amostra_recuperacoes_altas == null ? null : Number(row.amostra_recuperacoes_altas),
    source_page_ofensiva:row.source_page_ofensiva == null ? null : Number(row.source_page_ofensiva),
    metodo_ofensivo:row.metodo_ofensivo || null,
    recuperacoes_zonas:safeSpatialObject(parseJsonObject(row.recuperacoes_zonas)),
    perdas_zonas:safeSpatialObject(parseJsonObject(row.perdas_zonas)),
    faltas_zonas:safeSpatialObject(parseJsonObject(row.faltas_zonas)),
    source_page_transicoes:row.source_page_transicoes == null ? null : Number(row.source_page_transicoes),
    metodo_transicoes:row.metodo_transicoes || null,
    updated_at:row.updated_at,
  }
}

const SELECT_COLS = `rodada, esquerda, centro, direita, marcados_esquerda, marcados_centro, marcados_direita,
  gols_sofridos_pontos, gols_marcados_pontos,
  ataques_esquerda, ataques_centro, ataques_direita, amostra_ataques,
  duelos_def_ganhos_esquerda, duelos_def_ganhos_centro, duelos_def_ganhos_direita, amostra_duelos_def_ganhos,
  duelos_aereos_esquerda, duelos_aereos_centro, duelos_aereos_direita, amostra_duelos_aereos,
  source_page, metodo,
  cruzamentos_esquerda, cruzamentos_centro, cruzamentos_direita, amostra_cruzamentos,
  dribles_esquerda, dribles_centro, dribles_direita, amostra_dribles,
  recuperacoes_altas_esquerda, recuperacoes_altas_centro, recuperacoes_altas_direita, amostra_recuperacoes_altas,
  source_page_ofensiva, metodo_ofensivo,
  recuperacoes_zonas, perdas_zonas, faltas_zonas, source_page_transicoes, metodo_transicoes, updated_at`

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const rodada = searchParams.get('rodada')
    const all = searchParams.get('all')
    if (all) {
      const { rows } = await sql.query(`SELECT ${SELECT_COLS} FROM serie_c_gols_lado ORDER BY rodada DESC`)
      return NextResponse.json({ rows:rows.map(serialize) })
    }
    const { rows } = rodada
      ? await sql.query(`SELECT ${SELECT_COLS} FROM serie_c_gols_lado WHERE rodada = $1 LIMIT 1`, [Number(rodada)])
      : await sql.query(`SELECT ${SELECT_COLS} FROM serie_c_gols_lado ORDER BY rodada DESC LIMIT 1`)
    return NextResponse.json({ registro:serialize(rows[0]) })
  } catch (err) {
    return NextResponse.json({ error:err.message || 'Falha ao ler dados por corredor.' }, { status:500 })
  }
}

function has(body, key) { return Object.prototype.hasOwnProperty.call(body || {}, key) }
function nonNeg(value) { return Math.max(0, Number(value) || 0) }
function nullableNonNeg(body, key, current) {
  return has(body,key) ? nonNeg(body[key]) : (current == null ? null : Number(current))
}
function preserveSpatial(body, key, current) {
  return has(body,key) ? safeSpatialObject(body[key]) : safeSpatialObject(parseJsonObject(current))
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const rodada = Number(body?.rodada)
    if (!Number.isFinite(rodada) || rodada <= 0) return NextResponse.json({ error:'Informe uma rodada válida.' }, { status:400 })

    const currentRes = await sql.query(`SELECT ${SELECT_COLS} FROM serie_c_gols_lado WHERE rodada = $1 LIMIT 1`, [rodada])
    const current = currentRes.rows[0] || {}

    const sofridosPoints = has(body,'gols_sofridos_pontos') ? safePoints(body.gols_sofridos_pontos) : parseJsonPoints(current.gols_sofridos_pontos)
    const marcadosPoints = has(body,'gols_marcados_pontos') ? safePoints(body.gols_marcados_pontos) : parseJsonPoints(current.gols_marcados_pontos)
    const sufferedCounts = has(body,'gols_sofridos_pontos') ? corridorCounts(sofridosPoints) : {
      esquerda:has(body,'esquerda') ? nonNeg(body.esquerda) : nonNeg(current.esquerda),
      centro:has(body,'centro') ? nonNeg(body.centro) : nonNeg(current.centro),
      direita:has(body,'direita') ? nonNeg(body.direita) : nonNeg(current.direita),
    }
    const scoredCounts = has(body,'gols_marcados_pontos') ? corridorCounts(marcadosPoints) : {
      esquerda:has(body,'marcados_esquerda') ? nonNeg(body.marcados_esquerda) : nonNeg(current.marcados_esquerda),
      centro:has(body,'marcados_centro') ? nonNeg(body.marcados_centro) : nonNeg(current.marcados_centro),
      direita:has(body,'marcados_direita') ? nonNeg(body.marcados_direita) : nonNeg(current.marcados_direita),
    }

    const value = key => has(body,key) ? nonNeg(body[key]) : nonNeg(current[key])
    const nullable = key => nullableNonNeg(body,key,current[key])

    const sourcePage = has(body,'source_page') ? (Number(body.source_page) || null) : (current.source_page == null ? null : Number(current.source_page))
    const metodo = has(body,'metodo') ? String(body.metodo || '').slice(0,120) || null : (current.metodo || null)
    const sourcePageOff = has(body,'source_page_ofensiva') ? (Number(body.source_page_ofensiva) || null) : (current.source_page_ofensiva == null ? null : Number(current.source_page_ofensiva))
    const metodoOff = has(body,'metodo_ofensivo') ? String(body.metodo_ofensivo || '').slice(0,140) || null : (current.metodo_ofensivo || null)
    const sourcePageTrans = has(body,'source_page_transicoes') ? (Number(body.source_page_transicoes) || null) : (current.source_page_transicoes == null ? null : Number(current.source_page_transicoes))
    const metodoTrans = has(body,'metodo_transicoes') ? String(body.metodo_transicoes || '').slice(0,160) || null : (current.metodo_transicoes || null)

    const recuperacoesZonas = preserveSpatial(body,'recuperacoes_zonas',current.recuperacoes_zonas)
    const perdasZonas = preserveSpatial(body,'perdas_zonas',current.perdas_zonas)
    const faltasZonas = preserveSpatial(body,'faltas_zonas',current.faltas_zonas)

    await sql`
      INSERT INTO serie_c_gols_lado (
        rodada, esquerda, centro, direita, marcados_esquerda, marcados_centro, marcados_direita,
        gols_sofridos_pontos, gols_marcados_pontos,
        ataques_esquerda, ataques_centro, ataques_direita, amostra_ataques,
        duelos_def_ganhos_esquerda, duelos_def_ganhos_centro, duelos_def_ganhos_direita, amostra_duelos_def_ganhos,
        duelos_aereos_esquerda, duelos_aereos_centro, duelos_aereos_direita, amostra_duelos_aereos,
        source_page, metodo,
        cruzamentos_esquerda, cruzamentos_centro, cruzamentos_direita, amostra_cruzamentos,
        dribles_esquerda, dribles_centro, dribles_direita, amostra_dribles,
        recuperacoes_altas_esquerda, recuperacoes_altas_centro, recuperacoes_altas_direita, amostra_recuperacoes_altas,
        source_page_ofensiva, metodo_ofensivo,
        recuperacoes_zonas, perdas_zonas, faltas_zonas, source_page_transicoes, metodo_transicoes, updated_at
      ) VALUES (
        ${rodada}, ${sufferedCounts.esquerda}, ${sufferedCounts.centro}, ${sufferedCounts.direita}, ${scoredCounts.esquerda}, ${scoredCounts.centro}, ${scoredCounts.direita},
        ${JSON.stringify(sofridosPoints)}::jsonb, ${JSON.stringify(marcadosPoints)}::jsonb,
        ${value('ataques_esquerda')}, ${value('ataques_centro')}, ${value('ataques_direita')}, ${nullable('amostra_ataques')},
        ${value('duelos_def_ganhos_esquerda')}, ${value('duelos_def_ganhos_centro')}, ${value('duelos_def_ganhos_direita')}, ${nullable('amostra_duelos_def_ganhos')},
        ${value('duelos_aereos_esquerda')}, ${value('duelos_aereos_centro')}, ${value('duelos_aereos_direita')}, ${nullable('amostra_duelos_aereos')},
        ${sourcePage}, ${metodo},
        ${value('cruzamentos_esquerda')}, ${value('cruzamentos_centro')}, ${value('cruzamentos_direita')}, ${nullable('amostra_cruzamentos')},
        ${value('dribles_esquerda')}, ${value('dribles_centro')}, ${value('dribles_direita')}, ${nullable('amostra_dribles')},
        ${value('recuperacoes_altas_esquerda')}, ${value('recuperacoes_altas_centro')}, ${value('recuperacoes_altas_direita')}, ${nullable('amostra_recuperacoes_altas')},
        ${sourcePageOff}, ${metodoOff},
        ${recuperacoesZonas ? JSON.stringify(recuperacoesZonas) : null}::jsonb,
        ${perdasZonas ? JSON.stringify(perdasZonas) : null}::jsonb,
        ${faltasZonas ? JSON.stringify(faltasZonas) : null}::jsonb,
        ${sourcePageTrans}, ${metodoTrans}, NOW()
      )
      ON CONFLICT (rodada) DO UPDATE SET
        esquerda=EXCLUDED.esquerda, centro=EXCLUDED.centro, direita=EXCLUDED.direita,
        marcados_esquerda=EXCLUDED.marcados_esquerda, marcados_centro=EXCLUDED.marcados_centro, marcados_direita=EXCLUDED.marcados_direita,
        gols_sofridos_pontos=EXCLUDED.gols_sofridos_pontos, gols_marcados_pontos=EXCLUDED.gols_marcados_pontos,
        ataques_esquerda=EXCLUDED.ataques_esquerda, ataques_centro=EXCLUDED.ataques_centro, ataques_direita=EXCLUDED.ataques_direita, amostra_ataques=EXCLUDED.amostra_ataques,
        duelos_def_ganhos_esquerda=EXCLUDED.duelos_def_ganhos_esquerda, duelos_def_ganhos_centro=EXCLUDED.duelos_def_ganhos_centro, duelos_def_ganhos_direita=EXCLUDED.duelos_def_ganhos_direita, amostra_duelos_def_ganhos=EXCLUDED.amostra_duelos_def_ganhos,
        duelos_aereos_esquerda=EXCLUDED.duelos_aereos_esquerda, duelos_aereos_centro=EXCLUDED.duelos_aereos_centro, duelos_aereos_direita=EXCLUDED.duelos_aereos_direita, amostra_duelos_aereos=EXCLUDED.amostra_duelos_aereos,
        source_page=EXCLUDED.source_page, metodo=EXCLUDED.metodo,
        cruzamentos_esquerda=EXCLUDED.cruzamentos_esquerda, cruzamentos_centro=EXCLUDED.cruzamentos_centro, cruzamentos_direita=EXCLUDED.cruzamentos_direita, amostra_cruzamentos=EXCLUDED.amostra_cruzamentos,
        dribles_esquerda=EXCLUDED.dribles_esquerda, dribles_centro=EXCLUDED.dribles_centro, dribles_direita=EXCLUDED.dribles_direita, amostra_dribles=EXCLUDED.amostra_dribles,
        recuperacoes_altas_esquerda=EXCLUDED.recuperacoes_altas_esquerda, recuperacoes_altas_centro=EXCLUDED.recuperacoes_altas_centro, recuperacoes_altas_direita=EXCLUDED.recuperacoes_altas_direita, amostra_recuperacoes_altas=EXCLUDED.amostra_recuperacoes_altas,
        source_page_ofensiva=EXCLUDED.source_page_ofensiva, metodo_ofensivo=EXCLUDED.metodo_ofensivo,
        recuperacoes_zonas=EXCLUDED.recuperacoes_zonas, perdas_zonas=EXCLUDED.perdas_zonas, faltas_zonas=EXCLUDED.faltas_zonas,
        source_page_transicoes=EXCLUDED.source_page_transicoes, metodo_transicoes=EXCLUDED.metodo_transicoes,
        updated_at=NOW()
    `
    // Fazemos uma leitura simples depois do UPSERT para devolver o registro completo.
    const fresh = await sql.query(`SELECT ${SELECT_COLS} FROM serie_c_gols_lado WHERE rodada = $1 LIMIT 1`, [rodada])
    return NextResponse.json({ ok:true, registro:serialize(fresh.rows[0]) })
  } catch (err) {
    return NextResponse.json({ error:err.message || 'Falha ao salvar dados espaciais.' }, { status:500 })
  }
}
