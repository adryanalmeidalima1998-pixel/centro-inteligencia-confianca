import { neon } from '@neondatabase/serverless'
import * as xlsx from 'xlsx'

const sql = neon(process.env.DATABASE_URL)

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS atletas_monitoramento (
      id                    SERIAL PRIMARY KEY,
      codigo                TEXT UNIQUE,
      nome                  TEXT NOT NULL,
      apelido               TEXT,
      data_nascimento       DATE,
      posicao               TEXT,
      posicao_secundaria    TEXT,
      nacionalidade         TEXT,
      altura                NUMERIC,
      pe_preferido          TEXT,
      time_atual            TEXT,
      liga                  TEXT,
      numero_camisa         INTEGER,
      data_contrato_inicio  DATE,
      data_contrato_fim     TEXT,
      empresario            TEXT,
      status                TEXT DEFAULT 'Ativo',
      valor_mercado         TEXT,
      nivel_interesse       TEXT DEFAULT 'Monitorando',
      foto_url              TEXT,
      link_externo          TEXT,
      pais_liga             TEXT,
      observacoes           TEXT,
      metricas_json         JSONB DEFAULT '[]'::jsonb,
      resumo_temporada_json JSONB DEFAULT '[]'::jsonb,
      partidas_json         JSONB DEFAULT '[]'::jsonb,
      jogos_temporada_json  JSONB DEFAULT '[]'::jsonb,
      created_at            TIMESTAMP DEFAULT NOW(),
      updated_at            TIMESTAMP DEFAULT NOW()
    )
  `
  // Migrations para tabelas existentes
  await sql`ALTER TABLE atletas_monitoramento ADD COLUMN IF NOT EXISTS pais_liga TEXT`
  await sql`ALTER TABLE atletas_monitoramento ADD COLUMN IF NOT EXISTS jogos_temporada_json JSONB DEFAULT '[]'::jsonb`
  await sql`ALTER TABLE atletas_monitoramento ADD COLUMN IF NOT EXISTS link_video TEXT`
}

/* ── Column index → field name (all 72 cols) ────────────────────── */
const COL_MAP = [
  'jogo','competition','date','posicao','minutos',            // 0-4
  'acoes_totais','acoes_ok',                                  // 5-6
  'gols','assists',                                           // 7-8
  'remates_totais','remates_baliza','xg',                    // 9-11
  'passes_totais','passes_certos',                           // 12-13
  'passes_longos','passes_longos_certos',                    // 14-15
  'cruzamentos','cruzamentos_certos',                        // 16-17
  'dribbles','dribbles_ok',                                  // 18-19
  'duelos','duelos_ganhos',                                  // 20-21
  'duelos_aereos','duelos_aereos_ganhos',                    // 22-23
  'intercepcoes',                                            // 24
  'perdas_proprio','perdas_proprio_ok',                      // 25-26
  'recuperacoes','recuperacoes_ok',                          // 27-28
  'amarelo','vermelho',                                      // 29-30
  'duelos_def','duelos_def_ganhos',                          // 31-32
  'bola_livre','bola_livre_ganhos',                          // 33-34
  'carrinhos','carrinhos_ok',                                // 35-36
  'alivios','faltas','amarelo2','vermelho2',                  // 37-40
  'assist_remate',                                           // 41
  'duelos_off','duelos_off_ganhos',                          // 42-43
  'toques_area','fora_jogo','corridas','faltas_sofridas',    // 44-47
  'passes_prof','passes_prof_certos',                        // 48-49
  'xa','segundas_assist',                                    // 50-51
  'passes_terco','passes_terco_certos',                      // 52-53
  'passes_area','passes_area_certos',                        // 54-55
  'passes_recebidos',                                        // 56
  'passes_frente','passes_frente_certos',                    // 57-58
  'passes_tras','passes_tras_certos',                        // 59-60
  // goalkeeper (61+) — ignored for outfield players
]

/* ── Parser planilha manual (atletas sem Wyscout) ───────────────────
   Formato: Nome Completo | Data Nascimento | Idade | Nacionalidade | Posição | Pé |
            Temporada | Clube | Tipo Competição (AGREGADO|JOGO) | Competição |
            Data | Adversário | Local | Resultado | Jogos | Minutos | Gols | Assistências | Minutos Jogo
──────────────────────────────────────────────────────────────────── */
function safeDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0]
  return null
}

function notEmpty(v) {
  return v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '-'
}

function parseManualExcel(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, cellDates: true, defval: null })

  if (rows.length < 2) throw new Error('Planilha vazia ou sem dados')

  const headers = rows[0].map(h => (h ? String(h).trim() : ''))
  const col = name => headers.findIndex(h => h === name)

  const iNome       = col('Nome Completo')
  const iDataNasc   = col('Data Nascimento')
  const iNac        = col('Nacionalidade')
  const iPosicao    = col('Posição')
  const iPe         = col('Pé')
  const iTemporada  = col('Temporada')
  const iClube      = col('Clube')
  const iTipo       = col('Tipo Competição')
  const iCompeticao = col('Competição')
  const iData       = col('Data')
  const iAdversario = col('Adversário')
  const iLocal      = col('Local')
  const iResultado  = col('Resultado')
  const iJogos      = col('Jogos')
  const iMinutos    = col('Minutos')
  const iGols       = col('Gols')
  const iAssists    = col('Assistências')
  const iMinJogo    = col('Minutos Jogo')

  const firstRow = rows[1]
  if (!firstRow) throw new Error('Sem dados na planilha')

  const nome          = firstRow[iNome]    || null
  const dataNasc      = safeDate(firstRow[iDataNasc])
  const nacionalidade = firstRow[iNac]     || null
  const posicao       = firstRow[iPosicao] || null
  const pePreferido   = firstRow[iPe]      || null

  if (!nome) throw new Error('Nome do atleta não encontrado na planilha')

  const resumo = []
  const jogos_temporada = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !notEmpty(c))) continue

    const tipo = String(row[iTipo] || '').trim().toUpperCase()

    if (tipo === 'AGREGADO') {
      resumo.push({
        temporada:    notEmpty(row[iTemporada])  ? row[iTemporada]  : null,
        clube:        notEmpty(row[iClube])       ? row[iClube]      : null,
        competicao:   notEmpty(row[iCompeticao])  ? row[iCompeticao] : null,
        jogos:        notEmpty(row[iJogos])        ? row[iJogos]      : null,
        minutos:      notEmpty(row[iMinutos])      ? row[iMinutos]    : null,
        gols:         notEmpty(row[iGols])         ? row[iGols]       : null,
        assistencias: notEmpty(row[iAssists])      ? row[iAssists]    : null,
      })
    }

    if (tipo === 'JOGO') {
      jogos_temporada.push({
        data:       safeDate(row[iData]) || (notEmpty(row[iData]) ? String(row[iData]) : null),
        adversario: notEmpty(row[iAdversario]) ? row[iAdversario] : null,
        local:      notEmpty(row[iLocal])      ? row[iLocal]      : null,
        resultado:  notEmpty(row[iResultado])  ? row[iResultado]  : null,
        minutos:    notEmpty(row[iMinJogo])    ? row[iMinJogo]    : null,
        clube:      notEmpty(row[iClube])      ? row[iClube]      : null,
        competicao: notEmpty(row[iCompeticao]) ? row[iCompeticao] : null,
        temporada:  notEmpty(row[iTemporada])  ? row[iTemporada]  : null,
      })
    }
  }

  const clubeAtual = resumo.find(r => r.clube)?.clube || null

  return {
    atleta: { nome, data_nascimento: dataNasc, nacionalidade, posicao, pe_preferido: pePreferido, time_atual: clubeAtual },
    resumo,
    jogos_temporada,
  }
}

function parseAtletaExcel(buffer) {
  const wb = xlsx.read(buffer, { type:'buffer', cellDates:true })
  const result = { atleta:{}, metricas:[], resumo:[], jogos_temporada:[] }

  // Aba ATLETA
  if (wb.SheetNames.includes('ATLETA')) {
    const ws   = wb.Sheets['ATLETA']
    const rows = xlsx.utils.sheet_to_json(ws, { header:1 })
    if (rows.length >= 2) {
      const [headers, vals] = rows
      headers.forEach((h, i) => { if (h) result.atleta[h] = vals[i] })
    }
  }

  // Aba MÉTRICAS POR JOGO — aceita também 'PlayerStats' (export direto do Wyscout)
  const metricasSheetName = ['MÉTRICAS POR JOGO', 'PlayerStats'].find(n => wb.SheetNames.includes(n))
  if (metricasSheetName) {
    const ws   = wb.Sheets[metricasSheetName]
    const rows = xlsx.utils.sheet_to_json(ws, { header:1, raw:false })
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row[0]) continue
      const obj = {}
      COL_MAP.forEach((name, j) => {
        const raw = row[j]
        obj[name] = (raw !== undefined && raw !== null && raw !== '') ? raw : null
      })
      result.metricas.push(obj)
    }
  }

  // Aba RESUMO TEMPORADA
  if (wb.SheetNames.includes('RESUMO TEMPORADA')) {
    const ws   = wb.Sheets['RESUMO TEMPORADA']
    const rows = xlsx.utils.sheet_to_json(ws, { header:1, raw:false })
    if (rows.length >= 2) {
      const headers = rows[0]
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row[0]) continue
        const obj = {}
        headers.forEach((h, j) => { if (h) obj[h] = row[j] || null })
        result.resumo.push(obj)
      }
    }
  }

  // Aba JOGOS DA TEMPORADA
  if (wb.SheetNames.includes('JOGOS DA TEMPORADA')) {
    const ws   = wb.Sheets['JOGOS DA TEMPORADA']
    const rows = xlsx.utils.sheet_to_json(ws, { header:1, cellDates:true })
    if (rows.length >= 2) {
      const headers = rows[0]
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row[0]) continue
        const obj = {}
        headers.forEach((h, j) => {
          if (!h) return
          const val = row[j]
          if (val instanceof Date) {
            obj[h] = val.toISOString().split('T')[0]
          } else if (val !== undefined && val !== null && String(val).startsWith('=')) {
            obj[h] = null // ignora fórmulas não resolvidas
          } else {
            obj[h] = val ?? null
          }
        })
        result.jogos_temporada.push(obj)
      }
    }
  }

  return result
}

export async function GET(req) {
  await ensureTable()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const rows = await sql`SELECT * FROM atletas_monitoramento WHERE id = ${id}`
    if (!rows.length) return Response.json({ error:'Não encontrado' }, { status:404 })
    return Response.json(rows[0])
  }

  const rows = await sql`
    SELECT id, codigo, nome, apelido, posicao, posicao_secundaria, nacionalidade,
           time_atual, liga, pais_liga, data_nascimento, data_contrato_fim, status,
           nivel_interesse, valor_mercado, foto_url, link_externo, link_video,
           updated_at, jogos_temporada_json
    FROM atletas_monitoramento ORDER BY nome
  `
  return Response.json(rows)
}

export async function POST(req) {
  await ensureTable()
  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { nome, apelido, posicao, posicao_secundaria, nacionalidade, time_atual,
            liga, pais_liga, data_nascimento, data_contrato_fim, data_contrato_inicio,
            altura, pe_preferido, numero_camisa, empresario, status,
            valor_mercado, nivel_interesse, observacoes, link_externo, link_video } = body

    const codigo = `MON_${Date.now()}`
    const rows = await sql`
      INSERT INTO atletas_monitoramento
        (codigo, nome, apelido, posicao, posicao_secundaria, nacionalidade, time_atual,
         liga, pais_liga, data_nascimento, data_contrato_fim, data_contrato_inicio,
         altura, pe_preferido, numero_camisa, empresario, status,
         valor_mercado, nivel_interesse, observacoes, link_externo, link_video)
      VALUES
        (${codigo}, ${nome}, ${apelido||null}, ${posicao||null}, ${posicao_secundaria||null},
         ${nacionalidade||null}, ${time_atual||null}, ${liga||null}, ${pais_liga||null},
         ${data_nascimento||null}, ${data_contrato_fim||null}, ${data_contrato_inicio||null},
         ${altura||null}, ${pe_preferido||null}, ${numero_camisa||null}, ${empresario||null},
         ${status||'Ativo'}, ${valor_mercado||null}, ${nivel_interesse||'Monitorando'},
         ${observacoes||null}, ${link_externo||null}, ${link_video||null})
      RETURNING *
    `
    return Response.json(rows[0])
  }

  if (action === 'upload_excel') {
    const { id, base64 } = body
    const buf    = Buffer.from(base64, 'base64')
    const parsed = parseAtletaExcel(buf)
    const a      = parsed.atleta

    const dataNasc = a['Data de Nascimento']
      ? (a['Data de Nascimento'] instanceof Date ? a['Data de Nascimento'].toISOString().split('T')[0] : a['Data de Nascimento'])
      : null
    const dataContrato = a['Data de Contratação']
      ? (a['Data de Contratação'] instanceof Date ? a['Data de Contratação'].toISOString().split('T')[0] : a['Data de Contratação'])
      : null

    const NIVEIS = ['Monitorando','Interesse','Proposta','Descartado']
    const STATUS  = ['Ativo','Cedido','Inativo']
    const statusRaw = a['Status'] || null
    const nivelFromSheet  = NIVEIS.includes(statusRaw) ? statusRaw : null
    const statusFromSheet = STATUS.includes(statusRaw)  ? statusRaw : null

    const rows = await sql`
      UPDATE atletas_monitoramento SET
        nome                  = COALESCE(${a['Nome']||null}, nome),
        apelido               = COALESCE(${a['Chamar ele de']||null}, apelido),
        posicao               = COALESCE(${a['Posição Principal']||null}, posicao),
        nacionalidade         = COALESCE(${a['Nacionalidade']||null}, nacionalidade),
        altura                = COALESCE(${a['ALTURA']||null}, altura),
        pe_preferido          = COALESCE(${a['Pé Preferido']||null}, pe_preferido),
        time_atual            = COALESCE(${a['Time Atual']||null}, time_atual),
        numero_camisa         = COALESCE(${a['Número da Camisa']||null}, numero_camisa),
        data_nascimento       = COALESCE(${dataNasc}, data_nascimento),
        data_contrato_inicio  = COALESCE(${dataContrato}, data_contrato_inicio),
        data_contrato_fim     = COALESCE(${a['Data de Término do Contrato']||null}, data_contrato_fim),
        liga                  = COALESCE(${a['Liga']||null}, liga),
        empresario            = COALESCE(${a['EMPRESÁRIO/AGÊNCIA']||null}, empresario),
        link_externo          = COALESCE(${a['LINK']||null}, link_externo),
        nivel_interesse       = COALESCE(${nivelFromSheet}, nivel_interesse),
        status                = COALESCE(${statusFromSheet}, status),
        observacoes           = COALESCE(${a['Observações Gerais']||null}, observacoes),
        metricas_json         = ${JSON.stringify(parsed.metricas)}::jsonb,
        resumo_temporada_json = ${JSON.stringify(parsed.resumo)}::jsonb,
        jogos_temporada_json  = ${JSON.stringify(parsed.jogos_temporada)}::jsonb,
        updated_at            = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return Response.json({ ok:true, atleta: rows[0] })
  }

  if (action === 'upload_semanal') {
    const { id, base64 } = body
    const buf    = Buffer.from(base64, 'base64')
    const parsed = parseAtletaExcel(buf)

    const existing = await sql`SELECT metricas_json FROM atletas_monitoramento WHERE id=${id}`
    const old = existing[0]?.metricas_json || []
    const oldKeys = new Set(old.map(g => `${g.jogo}|${g.date}`))
    const newOnes = parsed.metricas.filter(g => !oldKeys.has(`${g.jogo}|${g.date}`))
    const merged  = [...old, ...newOnes].sort((a,b) => new Date(b.date||0) - new Date(a.date||0))

    await sql`
      UPDATE atletas_monitoramento SET
        metricas_json        = ${JSON.stringify(merged)}::jsonb,
        jogos_temporada_json = COALESCE(${parsed.jogos_temporada.length > 0 ? JSON.stringify(parsed.jogos_temporada) : null}::jsonb, jogos_temporada_json),
        updated_at           = NOW()
      WHERE id = ${id}
    `
    return Response.json({ ok:true, novos: newOnes.length, total: merged.length })
  }

  if (action === 'upload_manual') {
    const { id, base64 } = body
    const buf    = Buffer.from(base64, 'base64')
    const parsed = parseManualExcel(buf)
    const a      = parsed.atleta

    const rows = await sql`
      UPDATE atletas_monitoramento SET
        nome                  = COALESCE(${a.nome||null}, nome),
        posicao               = COALESCE(${a.posicao||null}, posicao),
        nacionalidade         = COALESCE(${a.nacionalidade||null}, nacionalidade),
        pe_preferido          = COALESCE(${a.pe_preferido||null}, pe_preferido),
        data_nascimento       = COALESCE(${a.data_nascimento||null}, data_nascimento),
        time_atual            = COALESCE(${a.time_atual||null}, time_atual),
        resumo_temporada_json = ${JSON.stringify(parsed.resumo)}::jsonb,
        jogos_temporada_json  = ${JSON.stringify(parsed.jogos_temporada)}::jsonb,
        updated_at            = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return Response.json({ ok:true, atleta: rows[0] })
  }

  if (action === 'edit') {
    const { id, fields } = body
    const f = fields || {}
    await sql`
      UPDATE atletas_monitoramento SET
        nome                = COALESCE(${f.nome||null}, nome),
        apelido             = COALESCE(${f.apelido||null}, apelido),
        posicao             = COALESCE(${f.posicao||null}, posicao),
        posicao_secundaria  = COALESCE(${f.posicao_secundaria||null}, posicao_secundaria),
        time_atual          = COALESCE(${f.time_atual||null}, time_atual),
        liga                = COALESCE(${f.liga||null}, liga),
        pais_liga           = ${f.pais_liga||null},
        nivel_interesse     = COALESCE(${f.nivel_interesse||null}, nivel_interesse),
        valor_mercado       = COALESCE(${f.valor_mercado||null}, valor_mercado),
        data_contrato_fim   = COALESCE(${f.data_contrato_fim||null}, data_contrato_fim),
        observacoes         = COALESCE(${f.observacoes||null}, observacoes),
        status              = COALESCE(${f.status||null}, status),
        foto_url            = COALESCE(${f.foto_url||null}, foto_url),
        link_externo        = COALESCE(${f.link_externo||null}, link_externo),
        link_video          = COALESCE(${f.link_video||null}, link_video),
        updated_at          = NOW()
      WHERE id = ${id}
    `
    const rows = await sql`SELECT * FROM atletas_monitoramento WHERE id = ${id}`
    return Response.json({ ok:true, atleta: rows[0] })
  }

  if (action === 'set_foto') {
    const { id, foto_url } = body
    await sql`UPDATE atletas_monitoramento SET foto_url=${foto_url}, updated_at=NOW() WHERE id=${id}`
    return Response.json({ ok:true })
  }

  if (action === 'add_partida') {
    const { id, partida } = body
    const existing = await sql`SELECT partidas_json FROM atletas_monitoramento WHERE id=${id}`
    const partidas = existing[0]?.partidas_json || []
    const idx = partidas.findIndex(p => p.id === partida.id)
    if (idx >= 0) partidas[idx] = partida
    else partidas.push({ ...partida, id: Date.now() })
    await sql`UPDATE atletas_monitoramento SET partidas_json=${JSON.stringify(partidas)}::jsonb, updated_at=NOW() WHERE id=${id}`
    return Response.json({ ok:true })
  }

  if (action === 'delete') {
    await sql`DELETE FROM atletas_monitoramento WHERE id=${body.id}`
    return Response.json({ ok:true })
  }

  if (action === 'save_obs') {
    const { id, observacoes } = body
    await sql`UPDATE atletas_monitoramento SET observacoes=${observacoes}, updated_at=NOW() WHERE id=${id}`
    return Response.json({ ok:true })
  }

  return Response.json({ error:'Ação inválida' }, { status:400 })
}
