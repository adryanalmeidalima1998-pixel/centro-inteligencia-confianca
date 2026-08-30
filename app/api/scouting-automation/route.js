import { NextResponse } from 'next/server'
import {
  approveSuggestedFocus,
  getAutomationDashboard,
  getAutomationHistory,
  runScoutingAutomation,
} from '@/lib/scouting-automation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'dashboard'
    if (mode === 'history') return NextResponse.json(await getAutomationHistory(Number(searchParams.get('limit') || 20)))
    const refresh = searchParams.get('refresh') === '1'
    const payload = refresh
      ? await runScoutingAutomation({ trigger: 'manual-dashboard' })
      : await getAutomationDashboard({ refreshIfMissing: true })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[scouting-automation-get]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'run'
    if (action === 'approve-focus') {
      const created = await approveSuggestedFocus(body.suggestedFocus || {})
      const payload = await runScoutingAutomation({ trigger: 'focus-approved', triggerRef: String(created.id) })
      return NextResponse.json({ ok: true, focus: created, automation: payload.run, dashboard: payload })
    }
    const payload = await runScoutingAutomation({ trigger: body.trigger || 'manual', triggerRef: body.triggerRef || null })
    return NextResponse.json({ ok: true, ...payload })
  } catch (error) {
    console.error('[scouting-automation-post]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
