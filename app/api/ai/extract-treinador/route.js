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
    const body = await request.json()
    const base64 = body.pdf_base64
    if (!base64) return Response.json({ error: 'pdf_base64 obrigatório' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    const fileBuffer = Buffer.from(base64, 'base64')
    const fd = new FormData()
    fd.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'treinador.pdf')
    fd.append('purpose', 'user_data')

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    })
    if (!uploadRes.ok) {
      const e = await uploadRes.text()
      return Response.json({ error: `Upload falhou: ${e}` }, { status: 500 })
    }
    const fileData = await uploadRes.json()
    const fileId = fileData.id

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'file', file: { file_id: fileId } },
            { type: 'text', text: 'Extraia os dados e retorne apenas o JSON.' },
          ]},
        ],
      }),
    })

    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})

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
