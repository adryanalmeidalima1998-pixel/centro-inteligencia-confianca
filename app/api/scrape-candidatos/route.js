export const maxDuration = 30

export async function POST(request) {
  try {
    const { texto } = await request.json()
    if (!texto || texto.trim().length < 50) {
      return Response.json({ error: 'Texto muito curto.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    const snippet = texto.slice(0, 12000)

    const prompt = `Você vai receber o texto copiado (Ctrl+A, Ctrl+C) de uma página de resultados/pesquisa de jogadores — pode ser Transfermarkt, Sofascore, Flashscore, ou outro site de estatísticas.

Extraia TODOS os jogadores listados e retorne APENAS um array JSON válido. Cada item deve ter:
{
  "nome": string (nome do jogador),
  "clube": string ou null,
  "posicao": string ou null (ex: "Zagueiro", "Lateral Esquerdo", "Meia", "Centroavante"),
  "pe": string ou null ("esquerdo" | "direito" | "ambos"),
  "idade": number ou null,
  "altura": string ou null (ex: "1.84"),
  "valor_mercado": string ou null (ex: "€ 1.80 mi", "€ 500 mil"),
  "nacionalidade": string ou null
}

Regras:
- Extraia TODOS os jogadores que aparecerem, sem limite
- Se um campo não estiver disponível, use null
- Para posição, traduza para português: CB→Zagueiro, LB→Lateral Esquerdo, RB→Lateral Direito, CM→Meia, DM→Volante, AM→Meia Atacante, LW/RW→Ponta, CF/ST→Centroavante, GK→Goleiro
- Retorne SOMENTE o array JSON, sem markdown, sem explicações

Texto da página:
${snippet}

Retorne SOMENTE o array JSON.`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 4000,
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return Response.json({ error: `Erro no processamento: ${err}` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw    = aiData.choices?.[0]?.message?.content || ''
    const clean  = raw.replace(/```json|```/g, '').trim()
    const jogadores = JSON.parse(clean)

    return Response.json({ success: true, jogadores, total: jogadores.length })
  } catch (err) {
    return Response.json({ error: err.message || 'Erro ao processar' }, { status: 500 })
  }
}
