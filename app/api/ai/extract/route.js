export const maxDuration = 60

const SYSTEM_PROMPT = `Você é um extrator especializado de relatórios CIC do Confiança.
Analise o relatório e retorne APENAS um JSON válido com os campos abaixo (null se não encontrar):
{
  "jogador": string, "clube": string, "posicao": string, "idade": number, "altura": string,
  "pe_preferido": string, "jogos": number, "minutagem": number, "gols": number, "assistencias": number,
  "perfil_tags": ["string"], "pontos_fisicos": string, "pontos_tecnicos": string, "pontos_taticos": string,
  "veredicto": string, "irc_final": number, "irc_classificacao": string,
  "historico_score": number, "nivel_competicao": number, "adequacao_modelo": number,
  "recomendacao": "CONTRATAÇÃO" | "MONITORAR" | "NÃO CONTRATAÇÃO"
}
Retorne SOMENTE o JSON, sem markdown, sem explicações.`

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let pdfBuffer = null, fileName = 'relatorio.pdf'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return Response.json({ error: 'Arquivo PDF não enviado' }, { status: 400 })
      pdfBuffer = Buffer.from(await file.arrayBuffer())
      fileName  = file.name || fileName
    } else {
      const body = await request.json()
      const b64  = body.imageBase64 || body.pdf_base64
      if (b64) pdfBuffer = Buffer.from(b64, 'base64')
    }

    if (!pdfBuffer) return Response.json({ error: 'Não foi possível processar o PDF' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 55000)

    // 1. Upload do PDF na Files API da OpenAI
    const formUpload = new FormData()
    formUpload.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName)
    formUpload.append('purpose', 'assistants')

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formUpload,
      signal: controller.signal,
    })

    if (!uploadRes.ok) {
      clearTimeout(timeoutId)
      const err = await uploadRes.text()
      return Response.json({ error: `Erro ao fazer upload do PDF: ${err}` }, { status: 500 })
    }

    const uploadData = await uploadRes.json()
    const fileId     = uploadData.id

    // 2. Usa Responses API (gpt-4o com file_search sobre o PDF)
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_file', file_id: fileId },
              { type: 'input_text', text: SYSTEM_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Apaga o arquivo da OpenAI (fire-and-forget)
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {})

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      if (openaiRes.status === 401) return Response.json({ error: 'OPENAI_API_KEY inválida ou expirada.' }, { status: 401 })
      if (openaiRes.status === 429) return Response.json({ error: 'Limite temporário do serviço de processamento. Tente em alguns minutos.' }, { status: 429 })
      return Response.json({ error: `Erro no serviço de processamento ${openaiRes.status}: ${errText}` }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    // Responses API retorna em output[].content[].text
    const content = openaiData.output
      ?.flatMap(o => o.content || [])
      ?.find(c => c.type === 'output_text')
      ?.text

    if (!content) return Response.json({ error: 'O serviço de processamento não retornou conteúdo.' }, { status: 500 })

    const clean     = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const extracted = JSON.parse(clean)
    return Response.json({ success: true, data: extracted })

  } catch (err) {
    if (err.name === 'AbortError') return Response.json({ error: 'Tempo limite do processamento excedido. Tente novamente.' }, { status: 504 })
    return Response.json({ error: `Erro ao extrair: ${err.message}` }, { status: 500 })
  }
}
