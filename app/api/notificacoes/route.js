import { sql } from '@vercel/postgres'
import staticM from '../../../data/players_mercado.json'

// Cron job semanal (toda segunda 8h) — Vercel Cron
// GET /api/notificacoes?secret=guarani-cig-cron-2026

async function callNotify(tipo, dados) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, dados }),
    })
    return await res.json()
  } catch(e) {
    return { error: e.message }
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET || 'guarani-cig-cron-2026'
    if (secret !== cronSecret) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    const results = { contratos: null, convergencia: null, jogos_monitoramento: null }
    const now = new Date()

    // ── 1. CONTRATOS EXPIRANDO ──
    let players = staticM
    try {
      const rows = await sql`SELECT players_json FROM wyscout_uploads WHERE section = 'mercado'`
      if (rows.rows.length > 0) {
        const all = []
        for (const r of rows.rows) all.push(...JSON.parse(r.players_json))
        if (all.length > 0) players = all
      }
    } catch {}

    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expirando = players.filter(p => {
      if (!p['Contrato expira em'] || p['Contrato expira em'] === '-') return false
      try { const d = new Date(p['Contrato expira em']); return d >= now && d <= in30 } catch { return false }
    }).slice(0, 30).map(p => ({
      jogador: p['Jogador'] || '—',
      clube:   p['Time'] || '—',
      posicao: p['_posicao_label'] || '—',
      expira:  (p['Contrato expira em'] || '').split('T')[0],
    }))

    if (expirando.length > 0) {
      results.contratos = await callNotify('contrato_expirando', { atletas: expirando })
    }

    // ── 2. CONVERGÊNCIA DE SCOUTS ──
    try {
      const obsRows = await sql`
        SELECT mandante, visitante, scout, obs, data
        FROM observacao_partidas WHERE obs IS NOT NULL AND obs != ''
        ORDER BY created_at DESC LIMIT 100`

      const mencoes = {}
      for (const j of obsRows.rows) {
        if (!j.obs || !j.scout) continue
        const nomes = j.obs.match(/[A-ZÁÉÍÓÚÂÊÔÃÕü][a-záéíóúâêôãõ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÜ][a-záéíóúâêôãõ]{2,})+/g) || []
        for (const n of nomes) {
          if (!mencoes[n]) mencoes[n] = []
          mencoes[n].push({ scout: j.scout })
        }
      }
      const conv = Object.entries(mencoes)
        .filter(([, arr]) => [...new Set(arr.map(x=>x.scout))].length >= 2)
        .map(([nome, arr]) => ({
          nome,
          scouts: [...new Set(arr.map(x=>x.scout))],
          count: arr.length,
        }))
        .sort((a,b) => b.scouts.length - a.scouts.length)
        .slice(0, 5)

      if (conv.length > 0) {
        results.convergencia = await callNotify('convergencia', { atletas: conv })
      }
    } catch(e) {
      results.convergencia = { error: e.message }
    }

    // ── 3. JOGOS DOS ATLETAS MONITORADOS (próximos 7 dias) ──
    try {
      const { neon } = await import('@neondatabase/serverless')
      const sql2 = neon(process.env.DATABASE_URL)
      const rows = await sql2`
        SELECT nome, apelido, time_atual, jogos_temporada_json
        FROM atletas_monitoramento
        WHERE nivel_interesse != 'Descartado'
          AND jogos_temporada_json IS NOT NULL
          AND jsonb_array_length(jogos_temporada_json) > 0
      `
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const jogosProximos = []

      for (const row of rows) {
        const jogos = row.jogos_temporada_json || []
        const nome  = row.apelido || row.nome
        for (const j of jogos) {
          if (!j['Data']) continue
          const d = new Date(j['Data'])
          if (isNaN(d)) continue
          if (d >= now && d <= in7) {
            const dd = String(d.getDate()).padStart(2,'0')
            const mm = String(d.getMonth()+1).padStart(2,'0')
            jogosProximos.push({
              atleta:      nome,
              time:        j['Time'] || row.time_atual || '—',
              adversario:  j['Adversário'] || '—',
              casa_fora:   j['Casa/Fora'] || '—',
              competicao:  j['Competição'] || '—',
              data_fmt:    `${dd}/${mm}`,
              data_iso:    j['Data'],
            })
          }
        }
      }

      jogosProximos.sort((a,b) => a.data_iso.localeCompare(b.data_iso))

      if (jogosProximos.length > 0) {
        results.jogos_monitoramento = await callNotify('jogo_monitoramento', { jogos: jogosProximos })
      }
    } catch(e) {
      results.jogos_monitoramento = { error: e.message }
    }

    return Response.json({ success: true, timestamp: now.toISOString(), ...results })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
