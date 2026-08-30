import { ensureLegacyLigasSchema } from '@/lib/legacy-ligas-schema'
import { sql } from '@vercel/postgres'

const METRICAS_CHAVE = [
  'gols','assistencias','xg','xa','passes_pct','passes_prog',
  'dribles','dribles_pct','interceptacoes','recuperacoes',
  'desarmes','duelos_aereos','duelos_aereos_pct','chutes','chutes_gol','cruzamentos'
]

function calcPercentil(valor, valores) {
  if (!valores.length || valor === null) return null
  const menores = valores.filter(v => v !== null && v < valor).length
  return Math.round((menores / valores.length) * 100)
}

export async function GET(req, { params }) {
  await ensureLegacyLigasSchema()
  const { id } = await params
  try {
    // Jogador
    const { rows: jogs } = await sql`
      SELECT j.*, l.nome AS liga_nome, l.slug AS liga_slug, l.cor_hex AS liga_cor
      FROM jogadores_liga j JOIN ligas_cig l ON l.id = j.liga_id
      WHERE j.id = ${id}
    `
    if (!jogs.length) return Response.json({ error: 'Jogador não encontrado' }, { status: 404 })
    const jogador = jogs[0]

    // Médias da liga (mesma liga)
    const { rows: mediaLiga } = await sql`
      SELECT
        AVG(gols) AS gols, AVG(assistencias) AS assistencias,
        AVG(xg) AS xg, AVG(xa) AS xa, AVG(passes_pct) AS passes_pct,
        AVG(passes_prog) AS passes_prog, AVG(dribles) AS dribles,
        AVG(dribles_pct) AS dribles_pct, AVG(interceptacoes) AS interceptacoes,
        AVG(recuperacoes) AS recuperacoes, AVG(desarmes) AS desarmes,
        AVG(duelos_aereos) AS duelos_aereos, AVG(duelos_aereos_pct) AS duelos_aereos_pct,
        AVG(chutes) AS chutes, AVG(chutes_gol) AS chutes_gol, AVG(cruzamentos) AS cruzamentos
      FROM jogadores_liga WHERE liga_id = ${jogador.liga_id} AND minutos >= 90
    `

    // Médias da posição (mesma liga, mesma posição)
    const { rows: mediaPosicao } = await sql`
      SELECT
        AVG(gols) AS gols, AVG(assistencias) AS assistencias,
        AVG(xg) AS xg, AVG(xa) AS xa, AVG(passes_pct) AS passes_pct,
        AVG(passes_prog) AS passes_prog, AVG(dribles) AS dribles,
        AVG(dribles_pct) AS dribles_pct, AVG(interceptacoes) AS interceptacoes,
        AVG(recuperacoes) AS recuperacoes, AVG(desarmes) AS desarmes,
        AVG(duelos_aereos) AS duelos_aereos, AVG(duelos_aereos_pct) AS duelos_aereos_pct,
        AVG(chutes) AS chutes, AVG(chutes_gol) AS chutes_gol, AVG(cruzamentos) AS cruzamentos
      FROM jogadores_liga
      WHERE liga_id = ${jogador.liga_id}
        AND posicao_grupo = ${jogador.posicao_grupo}
        AND minutos >= 90
    `

    // Médias gerais (todas as ligas)
    const { rows: mediaGeral } = await sql`
      SELECT
        AVG(gols) AS gols, AVG(assistencias) AS assistencias,
        AVG(xg) AS xg, AVG(xa) AS xa, AVG(passes_pct) AS passes_pct,
        AVG(passes_prog) AS passes_prog, AVG(dribles) AS dribles,
        AVG(dribles_pct) AS dribles_pct, AVG(interceptacoes) AS interceptacoes,
        AVG(recuperacoes) AS recuperacoes, AVG(desarmes) AS desarmes,
        AVG(duelos_aereos) AS duelos_aereos, AVG(duelos_aereos_pct) AS duelos_aereos_pct,
        AVG(chutes) AS chutes, AVG(chutes_gol) AS chutes_gol, AVG(cruzamentos) AS cruzamentos
      FROM jogadores_liga
      WHERE posicao_grupo = ${jogador.posicao_grupo} AND minutos >= 90
    `

    // Percentis por métrica vs liga (posição)
    const percentis = {}
    for (const metrica of METRICAS_CHAVE) {
      const { rows: vals } = await sql`
        SELECT ${metrica} AS val FROM jogadores_liga
        WHERE liga_id = ${jogador.liga_id} AND posicao_grupo = ${jogador.posicao_grupo} AND minutos >= 90
      `
      const valores = vals.map(r => parseFloat(r.val)).filter(v => !isNaN(v))
      percentis[metrica] = calcPercentil(parseFloat(jogador[metrica]), valores)
    }

    // Jogadores similares (mesma liga, mesma posição, mais próximos por minutos)
    const { rows: similares } = await sql`
      SELECT id, nome, equipe, posicao, idade, minutos, gols, assistencias, elo
      FROM jogadores_liga
      WHERE liga_id = ${jogador.liga_id}
        AND posicao_grupo = ${jogador.posicao_grupo}
        AND id != ${jogador.id}
      ORDER BY ABS(minutos - ${jogador.minutos || 0})
      LIMIT 5
    `

    return Response.json({
      jogador,
      media_liga: mediaLiga[0] || {},
      media_posicao: mediaPosicao[0] || {},
      media_geral: mediaGeral[0] || {},
      percentis,
      similares,
      metricas_chave: METRICAS_CHAVE,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
