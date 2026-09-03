import { dispatchNotification } from '@/lib/notification-service'

/**
 * Endpoint autenticado para disparos manuais/operacionais.
 * Crons chamam o serviço diretamente no servidor, sem fazer HTTP contra a própria aplicação.
 */
export async function POST(request) {
  try {
    const { tipo, dados } = await request.json()
    if (!tipo || !dados) return Response.json({ error: 'tipo e dados são obrigatórios' }, { status: 400 })
    const result = await dispatchNotification(tipo, dados)
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
