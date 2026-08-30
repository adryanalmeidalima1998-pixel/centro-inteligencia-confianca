import { NextResponse } from 'next/server'

export const maxDuration = 60

const MATCH_PROMPT = `Você é um extrator de dados de relatórios Wyscout. Analise TODAS as páginas deste relatório de jogo e extraia as estatísticas das duas equipes. Retorne SOMENTE um objeto JSON com esta estrutura exata (sem markdown, sem texto extra):

{
  "homeTeam": "Nome equipe casa",
  "awayTeam": "Nome equipe fora",
  "score": "X-X",
  "date": "DD/MM/AAAA",
  "competition": "Nome competição",
  "confianca": {
    "goals": 0, "xG": 0.00, "shots": 0, "shotsOnTarget": 0,
    "possession": 0, "passes": 0, "passAccuracy": 0,
    "progressivePasses": 0, "deepCompletions": 0, "ppda": 0,
    "recoveries": 0, "duelsTotal": 0, "duelsPct": 0,
    "duelsOffPct": 0, "duelsDefPct": 0, "aerialDuelsPct": 0,
    "corners": 0, "fouls": 0, "yellowCards": 0,
    "goalsConceded": 0, "xGA": 0, "shotsConceded": 0,
    "touchesInBox": 0, "crosses": 0, "crossesAccurate": 0,
    "interceptions": 0, "clearances": 0,
    "attacks": 0, "positionalAttacks": 0, "formation": ""
  },
  "opponent": {
    "goals": 0, "xG": 0.00, "shots": 0, "shotsOnTarget": 0,
    "possession": 0, "passes": 0, "passAccuracy": 0,
    "progressivePasses": 0, "deepCompletions": 0, "ppda": 0,
    "recoveries": 0, "duelsTotal": 0, "duelsPct": 0,
    "duelsOffPct": 0, "duelsDefPct": 0, "aerialDuelsPct": 0,
    "corners": 0, "fouls": 0, "yellowCards": 0,
    "goalsConceded": 0, "xGA": 0, "shotsConceded": 0,
    "touchesInBox": 0, "crosses": 0, "crossesAccurate": 0,
    "interceptions": 0, "clearances": 0,
    "attacks": 0, "positionalAttacks": 0, "formation": ""
  }
}

Identifique automaticamente qual time é o Confiança. Retorne APENAS o JSON.`

const PLAYERS_PROMPT = `Você é um extrator de dados de relatórios Wyscout. Analise TODAS as páginas e extraia estatísticas de TODOS os jogadores de AMBAS as equipes. Retorne SOMENTE um objeto JSON no formato abaixo (sem markdown, sem texto extra):

{
  "players": [
    {
      "name": "Nome Completo", "team": "Nome do time",
      "number": 0, "position": "GK", "minutes": 0,
      "goals": 0, "xG": 0.00, "assists": 0, "xA": 0.00,
      "shots": 0, "shotsOnTarget": 0, "passes": 0, "passAccuracy": 0,
      "progressivePasses": 0, "dribbles": 0, "dribbleSuccessPct": 0,
      "duelsTotal": 0, "duelsPct": 0, "duelsOffPct": 0, "duelsDefPct": 0,
      "aerialDuelsPct": 0, "recoveries": 0, "interceptions": 0, "clearances": 0,
      "fouls": 0, "foulsSuffered": 0, "yellowCards": 0,
      "touchesInBox": 0, "crosses": 0
    }
  ]
}

Inclua TODOS os jogadores (titulares e substitutos) de AMBAS as equipes. Retorne APENAS o objeto JSON com a chave "players".`

/* ── EXCLUSIVE: only what's NOT in the standard team stats CSV/Excel ── */
const EXCLUSIVE_PROMPT = `Você é um extrator de dados Wyscout. Analise este relatório de jogo e extraia APENAS os dados que seguem abaixo. NÃO extraia estatísticas gerais de equipe (gols, passes, posse, duelos - isso já temos). Extraia:

1. Dinâmicas por intervalo de 15 minutos (página "Dinâmicas do Jogo")
2. Remates individuais com xG e PsxG (página "Remate" de cada equipe)
3. Ataques por corredor com xG (seção "Ataques pelos flancos e nível de perigo")

Retorne APENAS este objeto JSON:

{
  "timeline": {
    "labels": ["1-15","16-30","31-45+","46-60","61-75","76-90+"],
    "confianca": {
      "possession":      [0,0,0,0,0,0],
      "passAccuracy":    [0,0,0,0,0,0],
      "deepPassShare":   [0,0,0,0,0,0],
      "duelsWonPct":     [0,0,0,0,0,0],
      "attacksPerMin":   [0,0,0,0,0,0],
      "recoveriesPerMin":[0,0,0,0,0,0],
      "midlineM":        [0,0,0,0,0,0],
      "ppda":            [0,0,0,0,0,0]
    },
    "opponent": {
      "possession":      [0,0,0,0,0,0],
      "passAccuracy":    [0,0,0,0,0,0],
      "deepPassShare":   [0,0,0,0,0,0],
      "duelsWonPct":     [0,0,0,0,0,0],
      "attacksPerMin":   [0,0,0,0,0,0],
      "recoveriesPerMin":[0,0,0,0,0,0],
      "midlineM":        [0,0,0,0,0,0],
      "ppda":            [0,0,0,0,0,0]
    }
  },
  "shots": [
    {
      "team": "confianca",
      "player": "Nome",
      "minute": 0,
      "shotType": "Pé direito",
      "xG": 0.00,
      "psxG": 0.00,
      "onTarget": false,
      "goal": false
    }
  ],
  "corridors": {
    "confianca":  { "left": {"attacks":0,"xG":0,"pct":0}, "center": {"attacks":0,"xG":0,"pct":0}, "right": {"attacks":0,"xG":0,"pct":0} },
    "opponent": { "left": {"attacks":0,"xG":0,"pct":0}, "center": {"attacks":0,"xG":0,"pct":0}, "right": {"attacks":0,"xG":0,"pct":0} }
  }
}

Para "shots": inclua TODOS os remates de AMBAS as equipes. Para o time do Confiança use "team":"confianca", para o adversário use "team":"opponent". Para PsxG: use o valor numérico se presente, ou null se não mostrado. Retorne APENAS o JSON.`

/* ── Robust JSON extractor ───────────────────────────────────── */
function extractJson(raw) {
  try { return JSON.parse(raw) } catch {}

  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '').trim()
  try { return JSON.parse(stripped) } catch {}

  const objStart = stripped.indexOf('{')
  const objEnd   = stripped.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(stripped.slice(objStart, objEnd + 1)) } catch {}
  }

  const arrStart = stripped.indexOf('[')
  const arrEnd   = stripped.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(stripped.slice(arrStart, arrEnd + 1)) } catch {}
  }

  throw new Error('Não foi possível extrair JSON da resposta do serviço de processamento')
}

export async function POST(req) {
  try {
    const { images, type } = await req.json()

    if (!images?.length) {
      return NextResponse.json({ error: 'Nenhuma imagem recebida' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada na Vercel' }, { status: 500 })
    }

    const isPlayers   = type === 'players'
    const isExclusive = type === 'exclusive'
    const maxTokens   = isPlayers ? 10000 : isExclusive ? 6000 : 4096
    const prompt      = isPlayers ? PLAYERS_PROMPT : isExclusive ? EXCLUSIVE_PROMPT : MATCH_PROMPT

    const content = [
      { type: 'text', text: prompt },
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'high' },
      })),
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `Serviço de processamento ${response.status}: ${err.slice(0, 300)}` }, { status: 500 })
    }

    const data = await response.json()
    const raw  = (data.choices?.[0]?.message?.content || '').trim()

    try {
      let parsed = extractJson(raw)

      // Unwrap { players: [...] } → array
      if (isPlayers && parsed && !Array.isArray(parsed) && Array.isArray(parsed.players)) {
        parsed = parsed.players
      }

      return NextResponse.json({ data: parsed, type })
    } catch (parseErr) {
      return NextResponse.json(
        { error: 'Erro ao parsear JSON processado', raw: raw.slice(0, 1000), detail: parseErr.message },
        { status: 422 },
      )
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
