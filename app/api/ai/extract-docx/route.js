import mammoth from 'mammoth'

export const maxDuration = 60

const SYSTEM_PROMPT = `Você é um extrator especializado de relatórios de scouting de treinadores do Confiança.
Analise o documento e retorne APENAS um JSON válido com os campos abaixo (null se não encontrar):
{
  "nome": string,
  "data_nascimento": string,
  "nacionalidade": string,
  "historico_clubes": string,
  "sistemas_jogo": ["string"],
  "estilo_jogo": string,
  "forcas": string,
  "fraquezas": string,
  "recomendacao": "Recomendado" | "Com Ressalvas" | "Não Recomendado",
  "estrelas": number (1-5)
}`

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return Response.json({ error: 'arquivo obrigatório' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    // Extract text from DOCX using mammoth
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const { value: text } = await mammoth.extractRawText({ buffer })
    if (!text || text.trim().length < 50) {
      return Response.json({ error: 'Documento DOCX vazio ou ilegível' }, { status: 400 })
    }

    // Send text to OpenAI
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Extraia os dados do seguinte relatório de treinador e retorne apenas o JSON:\n\n${text.slice(0, 8000)}` },
        ],
      }),
    })

    if (!chatRes.ok) {
      const e = await chatRes.text()
      return Response.json({ error: `Erro no serviço de processamento: ${e}` }, { status: 500 })
    }

    const data = await chatRes.json()
    const content = data.choices?.[0]?.message?.content || ''
    const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const extracted = JSON.parse(clean)
    return Response.json({ success: true, data: extracted })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
