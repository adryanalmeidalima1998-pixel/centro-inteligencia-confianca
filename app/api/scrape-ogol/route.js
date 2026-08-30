export const maxDuration = 30

export async function POST(request) {
  try {
    const { texto, url } = await request.json()

    if (!texto || texto.trim().length < 100) {
      return Response.json({ error: 'Texto da página muito curto ou vazio.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    const snippet = texto.slice(0, 6000)

    const prompt = `Você vai receber o texto copiado (Ctrl+A, Ctrl+C) da página de um jogador no site OGol.
Extraia os dados do atleta e retorne APENAS um JSON válido com estes campos (null se não encontrar):

{
  "nome": string (nome completo, ex: "Elkin Israel Muñoz Calderón"),
  "apelido": string (nome mais conhecido / apelido, ex: "Elkin Muñoz"),
  "data_nascimento": string (formato YYYY-MM-DD),
  "nacionalidade": string (país em português, ex: "Equador", "Brasil", "Colômbia"),
  "posicao": string (uma de: Goleiro | Lateral Direito | Lateral Esquerdo | Zagueiro | Volante | Meia | Meia Atacante | Ponta Direita | Ponta Esquerda | Atacante | Centroavante),
  "posicao_secundaria": string (segunda posição se houver, mesmas opções acima, ou null),
  "time_atual": string (clube atual, ex: "Juventus-SP"),
  "liga": string (campeonato/liga atual, ex: "Paulista A2"),
  "pais_liga": string (país da liga em português, ex: "Brasil", "Equador"),
  "altura": string (ex: "1.82") ou null,
  "pe_preferido": string ("Direito" | "Esquerdo" | "Ambos"),
  "link_externo": ${url ? `"${url}"` : 'null'}
}

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
        max_tokens: 600,
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

    return Response.json({ success: true, atleta })
  } catch (err) {
    return Response.json({ error: err.message || 'Erro ao processar o texto' }, { status: 500 })
  }
}
