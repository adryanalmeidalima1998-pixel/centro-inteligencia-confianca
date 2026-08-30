import { neon } from '@neondatabase/serverless'
import * as xlsx from 'xlsx'

const sql = neon(process.env.DATABASE_URL)

/*
  Planilha manual — formato atual (MONITORAMENTO_10_ANDERSON.xlsx):
  Col 0:  Nome Completo
  Col 1:  Data Nascimento
  Col 2:  Idade
  Col 3:  Nacionalidade
  Col 4:  Posição
  Col 5:  Pé
  Col 6:  Temporada
  Col 7:  Clube
  Col 8:  Tipo Competição  → 'AGREGADO' | 'JOGO'
  Col 9:  Competição
  Col 10: Data
  Col 11: Adversário
  Col 12: Local
  Col 13: Resultado
  Col 14: Jogos
  Col 15: Minutos
  Col 16: Gols
  Col 17: Assistências
  Col 18: Minutos Jogo
*/

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

  // Índices das colunas pelo nome do header
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

  // time_atual = clube da temporada mais recente (primeiro AGREGADO)
  const clubeAtual = resumo.find(r => notEmpty(r.clube))?.clube || null

  return {
    atleta: {
      nome,
      data_nascimento: dataNasc,
      nacionalidade,
      posicao,
      pe_preferido: pePreferido,
      time_atual: clubeAtual,
      pais_liga: 'Brasil',
    },
    resumo,
    jogos_temporada,
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { base64 } = body

    if (!base64) return Response.json({ error: 'base64 obrigatório' }, { status: 400 })

    const buf    = Buffer.from(base64, 'base64')
    const parsed = parseManualExcel(buf)
    const a      = parsed.atleta

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
    await sql`ALTER TABLE atletas_monitoramento ADD COLUMN IF NOT EXISTS pais_liga TEXT`
    await sql`ALTER TABLE atletas_monitoramento ADD COLUMN IF NOT EXISTS jogos_temporada_json JSONB DEFAULT '[]'::jsonb`

    const codigo = `MON_${Date.now()}`

    const rows = await sql`
      INSERT INTO atletas_monitoramento
        (codigo, nome, posicao, nacionalidade, pe_preferido,
         time_atual, pais_liga, data_nascimento,
         status, nivel_interesse,
         resumo_temporada_json, jogos_temporada_json,
         metricas_json, partidas_json)
      VALUES
        (${codigo}, ${a.nome}, ${a.posicao || null}, ${a.nacionalidade || null},
         ${a.pe_preferido || null}, ${a.time_atual || null}, ${a.pais_liga || 'Brasil'},
         ${a.data_nascimento || null}, 'Ativo', 'Monitorando',
         ${JSON.stringify(parsed.resumo)}::jsonb,
         ${JSON.stringify(parsed.jogos_temporada)}::jsonb,
         '[]'::jsonb, '[]'::jsonb)
      RETURNING *
    `

    return Response.json(rows[0])
  } catch (err) {
    console.error('[import-excel-manual]', err)
    return Response.json({ error: err.message || 'Erro ao importar planilha' }, { status: 400 })
  }
}
