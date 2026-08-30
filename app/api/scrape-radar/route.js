export const maxDuration = 30

export async function POST(request) {
  try {
    const { texto, url } = await request.json()

    if (!texto || texto.trim().length < 100) {
      return Response.json({ error: 'Texto da página muito curto ou vazio.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    const isTM = url?.includes('transfermarkt') || texto.includes('Valor de Mercado') || texto.includes('Nasc./Idade')
    const snippet = texto.slice(0, 8000)

    const prompt = `Você vai receber o texto copiado (Ctrl+A, Ctrl+C) de uma página de jogador do site ${isTM ? 'Transfermarkt' : 'OGol'}.
Extraia os dados do atleta e retorne APENAS um JSON válido com EXATAMENTE estes campos (null se não encontrar):

{
  "nome": string (nome completo),
  "apelido": string (nome de guerra / apelido),
  "data_nascimento": string (formato YYYY-MM-DD),
  "nacionalidade": string (país em português, ex: "Brasil", "Colômbia", "Argentina"),
  "posicao": string (uma de: Goleiro | Lateral Direito | Lateral Esquerdo | Zagueiro | Volante | Meia | Meia Atacante | Ponta Direita | Ponta Esquerda | Atacante | Centroavante),
  "posicao_secundaria": string ou null (segunda posição, mesmas opções acima),
  "time_atual": string (clube atual),
  "liga": string (campeonato/liga atual),
  "pais_liga": string (país da liga em português),
  "altura": string ou null (ex: "1.82"),
  "pe_preferido": string ou null ("Direito" | "Esquerdo" | "Ambos"),
  "valor_mercado": string ou null (ex: "€ 500 mil", "€ 1.2 mi"),
  "link_externo": "${url || ''}",
  "historico_clubes": [
    {
      "temporada": string (ex: "2024", "2023/24"),
      "clube": string,
      "jogos": number ou null,
      "gols": number ou null,
      "assists": number ou null,
      "emprestimo": boolean
    }
  ]
}

Para o historico_clubes: extraia a carreira/histórico cronológico do jogador, da temporada mais recente para a mais antiga. Inclua times de base se aparecerem. Máximo 25 registros.
Para emprestimo: marque true se houver indicação de "(E)", "empréstimo", "loan" ou "(Emp)" junto ao clube.

Texto copiado da página:
${snippet}

Retorne SOMENTE o JSON, sem markdown, sem explicações.`

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
        max_tokens: 1800,
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return Response.json({ error: `Erro no processamento: ${err}` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw    = aiData.choices?.[0]?.message?.content || ''
    const clean  = raw.replace(/```json|```/g, '').trim()
    const atleta = JSON.parse(clean)

    return Response.json({ success: true, atleta, fonte: isTM ? 'transfermarkt' : 'ogol' })
  } catch (err) {
    return Response.json({ error: err.message || 'Erro ao processar o texto' }, { status: 500 })
  }
}
