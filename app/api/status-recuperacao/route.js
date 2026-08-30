import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS status_recuperacao (
      id                SERIAL PRIMARY KEY,
      partida           VARCHAR(255) NOT NULL,
      data_partida      DATE         NOT NULL,
      jogador           VARCHAR(255) NOT NULL,
      recuperacao       VARCHAR(20)  DEFAULT NULL,
      recuperacao_nota  INTEGER      DEFAULT NULL,
      cmj               VARCHAR(20)  DEFAULT NULL,
      cmj_valor         DECIMAL(6,2) DEFAULT NULL,
      cmj_es            DECIMAL(8,4) DEFAULT NULL,
      pcr               VARCHAR(20)  DEFAULT NULL,
      pcr_valor         DECIMAL(8,4) DEFAULT NULL,
      pcr_es            DECIMAL(8,4) DEFAULT NULL,
      forca             VARCHAR(20)  DEFAULT NULL,
      forca_esquerda    DECIMAL(8,2) DEFAULT NULL,
      forca_direita     DECIMAL(8,2) DEFAULT NULL,
      forca_absoluta    DECIMAL(8,2) DEFAULT NULL,
      forca_assimetria  DECIMAL(8,4) DEFAULT NULL,
      forca_queda_pct   DECIMAL(8,4) DEFAULT NULL,
      criado_em         TIMESTAMP    DEFAULT NOW(),
      atualizado_em     TIMESTAMP    DEFAULT NOW()
    )
  `
  // migrações seguras
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS recuperacao_nota INTEGER DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS cmj_valor DECIMAL(6,2) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS cmj_es DECIMAL(8,4) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS pcr_valor DECIMAL(8,4) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS pcr_es DECIMAL(8,4) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS forca_esquerda DECIMAL(8,2) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS forca_direita DECIMAL(8,2) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS forca_absoluta DECIMAL(8,2) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS forca_assimetria DECIMAL(8,4) DEFAULT NULL`
  await sql`ALTER TABLE status_recuperacao ADD COLUMN IF NOT EXISTS forca_queda_pct DECIMAL(8,4) DEFAULT NULL`
}

// ── classificadores ──────────────────────────────────────────────────────────

function notaParaCor(nota) {
  if (nota == null) return null
  const n = Number(nota)
  if (n >= 7) return 'Verde'
  if (n >= 5) return 'Amarelo'
  return 'Vermelho'
}

// CMJ: direcional — ES negativo = queda de performance (fadiga); positivo = melhora → Verde
function cmjEsParaCor(es) {
  if (es == null) return null
  const n = Number(es)
  if (n >= -0.2) return 'Verde'   // trivial ou melhora
  if (n >= -0.8) return 'Amarelo' // fadiga moderada
  return 'Vermelho'                // fadiga alta
}

function pcrEsParaCor(es) {
  if (es == null) return null
  const n = Number(es)
  if (n <= 0.2) return 'Verde'
  if (n <= 0.8) return 'Amarelo'
  return 'Vermelho'
}

// Força: vermelho se queda > 15% do basal OU assimetria bilateral > 15%
function forcaParaCor(quedaPct, assimetria) {
  if (quedaPct == null && assimetria == null) return null
  const q = quedaPct != null ? Number(quedaPct) : 0
  const a = assimetria != null ? Number(assimetria) : 0
  if (q > 15 || a > 15) return 'Vermelho'
  if (q > 10) return 'Amarelo'
  return 'Verde'
}

// ── helpers basal ─────────────────────────────────────────────────────────────

async function getCMJBasalDP(jogador) {
  try {
    const all = await sql`SELECT jogador, basal FROM cmj_basal`
    if (all.rows.length < 2) return { basal: null, dp: 5.03 }
    const vals = all.rows.map(r => parseFloat(r.basal))
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const dp = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1))
    const row = all.rows.find(r => r.jogador.toLowerCase().trim() === jogador.toLowerCase().trim())
    return { basal: row ? parseFloat(row.basal) : null, dp }
  } catch { return { basal: null, dp: 5.03 } }
}

async function getPCRBasalDP(jogador) {
  try {
    const all = await sql`SELECT jogador, basal FROM pcr_basal`
    if (all.rows.length < 2) return { basal: null, dp: 0.4606 }
    const vals = all.rows.map(r => parseFloat(r.basal))
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const dp = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1))
    const row = all.rows.find(r => r.jogador.toLowerCase().trim() === jogador.toLowerCase().trim())
    return { basal: row ? parseFloat(row.basal) : null, dp }
  } catch { return { basal: null, dp: 0.4606 } }
}

async function getForcaBasal(jogador) {
  try {
    const all = await sql`SELECT jogador, absoluta_apresentacao, basal FROM forca_basal`
    const row = all.rows.find(r => r.jogador.toLowerCase().trim() === jogador.toLowerCase().trim())
    if (!row) return { absoluta: null, basal: null }
    return {
      absoluta: row.absoluta_apresentacao != null ? parseFloat(row.absoluta_apresentacao) : null,
      basal:    row.basal                  != null ? parseFloat(row.basal)                  : null,
    }
  } catch { return { absoluta: null, basal: null } }
}

// ── routes ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`
      SELECT * FROM status_recuperacao
      ORDER BY data_partida DESC, jogador ASC
    `
    return NextResponse.json({ rows: result.rows })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()

    if (body.type === 'upsert') {
      const {
        partida, data_partida, jogador,
        recuperacao_nota,
        cmj_valor,
        pcr_valor,
        forca_esquerda, forca_direita,
        forca,
      } = body

      // ── Recuperação ──
      const recuperacaoCor = notaParaCor(recuperacao_nota)
      const nota = recuperacao_nota ?? null

      // ── CMJ ──
      let cmjCor = null, cmjEs = null, novoBasalCMJ = false
      if (cmj_valor != null) {
        const { basal, dp } = await getCMJBasalDP(jogador)
        if (basal !== null) {
          cmjEs = (Number(cmj_valor) - basal) / dp
          cmjCor = cmjEsParaCor(cmjEs)
          if (Number(cmj_valor) > basal) {
            await sql`
              INSERT INTO cmj_basal (jogador, basal, atualizado_em) VALUES (${jogador}, ${cmj_valor}, NOW())
              ON CONFLICT (jogador) DO UPDATE SET basal = ${cmj_valor}, atualizado_em = NOW()
            `
            novoBasalCMJ = true
          }
        } else {
          await sql`INSERT INTO cmj_basal (jogador, basal) VALUES (${jogador}, ${cmj_valor}) ON CONFLICT DO NOTHING`
          cmjCor = 'Verde'; cmjEs = 0; novoBasalCMJ = true
        }
      }

      // ── PCR ──
      let pcrCor = null, pcrEs = null
      if (pcr_valor != null) {
        const { basal, dp } = await getPCRBasalDP(jogador)
        if (basal !== null) {
          pcrEs = (Number(pcr_valor) - basal) / dp
          pcrCor = pcrEsParaCor(pcrEs)
        } else {
          await sql`INSERT INTO pcr_basal (jogador, basal) VALUES (${jogador}, ${pcr_valor}) ON CONFLICT DO NOTHING`
          pcrCor = 'Verde'; pcrEs = 0
        }
      }

      // ── Força ──
      let forcaCor = forca ?? null  // fallback para valor manual se não tiver medição
      let forcaAbsoluta = null, forcaAssimetria = null, forcaQuedaPct = null
      let fEsq = forca_esquerda ?? null
      let fDir = forca_direita ?? null

      if (fEsq != null && fDir != null) {
        const e = Number(fEsq), d = Number(fDir)
        // Absoluta do jogo = (E+D)/2
        forcaAbsoluta = (e + d) / 2
        // Assimetria bilateral = diferença relativa ao lado mais forte (%)
        const maxLado = Math.max(e, d)
        forcaAssimetria = maxLado > 0 ? ((Math.abs(e - d) / maxLado) * 100) : 0

        const { absoluta: absApres, basal: basalAtual } = await getForcaBasal(jogador)

        // ── Queda vs Absoluta da Apresentação (fixo — pré-temporada) ──
        const quedaVsAbsoluta = absApres != null && absApres > 0
          ? ((absApres - forcaAbsoluta) / absApres) * 100
          : null

        // ── Queda vs Basal pós-jogo (melhor já registrado nos testes) ──
        const quedaVsBasal = basalAtual != null && basalAtual > 0
          ? ((basalAtual - forcaAbsoluta) / basalAtual) * 100
          : null

        // Pior das duas comparações determina a cor
        const quedaFinal = Math.max(quedaVsAbsoluta ?? -Infinity, quedaVsBasal ?? -Infinity)
        forcaQuedaPct = quedaFinal === -Infinity ? 0 : quedaFinal
        forcaCor = forcaParaCor(forcaQuedaPct, forcaAssimetria)

        // ── AUTO-ATUALIZA BASAL pós-jogo se atleta superou o recorde ──
        if (basalAtual === null || forcaAbsoluta > basalAtual) {
          await sql`
            INSERT INTO forca_basal (jogador, basal, atualizado_em)
            VALUES (${jogador}, ${forcaAbsoluta}, NOW())
            ON CONFLICT (jogador) DO UPDATE
              SET basal = ${forcaAbsoluta}, atualizado_em = NOW()
          `
        }

        // Se não tem absoluta de apresentação, usa este como referência inicial
        if (absApres === null) {
          await sql`
            INSERT INTO forca_basal (jogador, absoluta_apresentacao, atualizado_em)
            VALUES (${jogador}, ${forcaAbsoluta}, NOW())
            ON CONFLICT (jogador) DO UPDATE
              SET absoluta_apresentacao = COALESCE(forca_basal.absoluta_apresentacao, ${forcaAbsoluta}),
                  atualizado_em = NOW()
          `
        }
      }

      const existing = await sql`
        SELECT id FROM status_recuperacao WHERE partida = ${partida} AND jogador = ${jogador}
      `

      const vals = {
        recuperacaoCor, nota,
        cmjCor, cmjValor: cmj_valor ?? null,
        cmjEsFinal: cmjEs != null ? parseFloat(cmjEs.toFixed(4)) : null,
        pcrCor, pcrValor: pcr_valor ?? null,
        pcrEsFinal: pcrEs != null ? parseFloat(pcrEs.toFixed(4)) : null,
        forcaCor,
        fEsq, fDir,
        forcaAbsoluta: forcaAbsoluta != null ? parseFloat(forcaAbsoluta.toFixed(2)) : null,
        forcaAssimetria: forcaAssimetria != null ? parseFloat(forcaAssimetria.toFixed(4)) : null,
        forcaQuedaPct: forcaQuedaPct != null ? parseFloat(forcaQuedaPct.toFixed(4)) : null,
      }

      if (existing.rows.length > 0) {
        await sql`
          UPDATE status_recuperacao SET
            recuperacao      = ${vals.recuperacaoCor},
            recuperacao_nota = ${vals.nota},
            cmj              = ${vals.cmjCor},
            cmj_valor        = ${vals.cmjValor},
            cmj_es           = ${vals.cmjEsFinal},
            pcr              = ${vals.pcrCor},
            pcr_valor        = ${vals.pcrValor},
            pcr_es           = ${vals.pcrEsFinal},
            forca            = ${vals.forcaCor},
            forca_esquerda   = ${vals.fEsq},
            forca_direita    = ${vals.fDir},
            forca_absoluta   = ${vals.forcaAbsoluta},
            forca_assimetria = ${vals.forcaAssimetria},
            forca_queda_pct  = ${vals.forcaQuedaPct},
            atualizado_em    = NOW()
          WHERE partida = ${partida} AND jogador = ${jogador}
        `
      } else {
        await sql`
          INSERT INTO status_recuperacao
            (partida, data_partida, jogador,
             recuperacao, recuperacao_nota,
             cmj, cmj_valor, cmj_es,
             pcr, pcr_valor, pcr_es,
             forca, forca_esquerda, forca_direita,
             forca_absoluta, forca_assimetria, forca_queda_pct)
          VALUES
            (${partida}, ${data_partida}, ${jogador},
             ${vals.recuperacaoCor}, ${vals.nota},
             ${vals.cmjCor}, ${vals.cmjValor}, ${vals.cmjEsFinal},
             ${vals.pcrCor}, ${vals.pcrValor}, ${vals.pcrEsFinal},
             ${vals.forcaCor}, ${vals.fEsq}, ${vals.fDir},
             ${vals.forcaAbsoluta}, ${vals.forcaAssimetria}, ${vals.forcaQuedaPct})
        `
      }

      return NextResponse.json({ ok: true, novoBasalCMJ })
    }

    if (body.type === 'nova_partida') {
      const { partida, data_partida, jogadores } = body
      for (const jogador of jogadores) {
        await sql`
          INSERT INTO status_recuperacao (partida, data_partida, jogador)
          VALUES (${partida}, ${data_partida}, ${jogador})
          ON CONFLICT DO NOTHING
        `
      }
      return NextResponse.json({ ok: true })
    }

    if (body.type === 'recalcular_cores') {
      const all = await sql`SELECT * FROM status_recuperacao`
      const basais = await sql`SELECT jogador, absoluta_apresentacao, basal FROM forca_basal`
      let atualizados = 0

      for (const row of all.rows) {
        const recuperacaoCor = notaParaCor(row.recuperacao_nota)
        const cmjCor = cmjEsParaCor(row.cmj_es != null ? parseFloat(row.cmj_es) : null)
        const pcrCor = pcrEsParaCor(row.pcr_es != null ? parseFloat(row.pcr_es) : null)

        // Força: recalcula usando os dois referenciais
        let forcaCor = row.forca
        const quedaPct   = row.forca_queda_pct   != null ? parseFloat(row.forca_queda_pct)   : null
        const assimetria = row.forca_assimetria  != null ? parseFloat(row.forca_assimetria)  : null
        const forcaAbs   = row.forca_absoluta    != null ? parseFloat(row.forca_absoluta)    : null

        if (forcaAbs != null) {
          const basRow = basais.rows.find(b => b.jogador.toLowerCase().trim() === row.jogador.toLowerCase().trim())
          const absApres   = basRow?.absoluta_apresentacao != null ? parseFloat(basRow.absoluta_apresentacao) : null
          const basalAtual = basRow?.basal                != null ? parseFloat(basRow.basal)                  : null

          const quedaVsAbsoluta = absApres   != null && absApres   > 0 ? ((absApres   - forcaAbs) / absApres)   * 100 : null
          const quedaVsBasal    = basalAtual != null && basalAtual > 0 ? ((basalAtual - forcaAbs) / basalAtual) * 100 : null
          const quedaFinal = Math.max(quedaVsAbsoluta ?? -Infinity, quedaVsBasal ?? -Infinity)
          const quedaUsar  = quedaFinal === -Infinity ? (quedaPct ?? 0) : quedaFinal

          forcaCor = forcaParaCor(quedaUsar, assimetria)
        } else if (quedaPct != null || assimetria != null) {
          forcaCor = forcaParaCor(quedaPct, assimetria)
        }

        await sql`
          UPDATE status_recuperacao SET
            recuperacao   = ${recuperacaoCor},
            cmj           = ${cmjCor},
            pcr           = ${pcrCor},
            forca         = ${forcaCor},
            atualizado_em = NOW()
          WHERE id = ${row.id}
        `
        atualizados++
      }

      return NextResponse.json({ ok: true, atualizados })
    }

    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const partida = searchParams.get('partida')
    const id = searchParams.get('id')
    if (id) {
      await sql`DELETE FROM status_recuperacao WHERE id = ${id}`
    } else if (partida) {
      await sql`DELETE FROM status_recuperacao WHERE partida = ${partida}`
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
