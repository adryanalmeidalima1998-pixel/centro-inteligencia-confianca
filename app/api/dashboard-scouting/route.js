import { NextResponse } from 'next/server'
import { getAutomationDashboard, runScoutingAutomation } from '@/lib/scouting-automation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === '1'
    const payload = refresh
      ? await runScoutingAutomation({ trigger: 'dashboard-refresh' })
      : await getAutomationDashboard({ refreshIfMissing: true, maxAgeMinutes: 180 })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[dashboard-scouting]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
