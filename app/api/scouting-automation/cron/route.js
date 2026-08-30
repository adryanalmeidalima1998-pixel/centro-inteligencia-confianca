import { NextResponse } from 'next/server'
import { runScoutingAutomation } from '@/lib/scouting-automation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    const payload = await runScoutingAutomation({ trigger: 'daily-cron' })
    return NextResponse.json({
      ok: true,
      generatedAt: payload.generatedAt,
      summary: {
        leagues: payload.kpis?.leagues || 0,
        players: payload.kpis?.players || 0,
        opportunities: payload.kpis?.opportunities || 0,
        alerts: payload.alerts?.length || 0,
        health: payload.health?.score || 0,
      },
    })
  } catch (error) {
    console.error('[scouting-automation-cron]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
