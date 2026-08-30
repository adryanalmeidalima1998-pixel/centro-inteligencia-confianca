import { NextResponse } from 'next/server'
import { getLatestReportPayload } from '@/lib/scouting-automation'
import { createWeeklyPackage } from '@/lib/scouting-reports'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  try {
    const report = await getLatestReportPayload()
    const buffer = await createWeeklyPackage(report)
    const date = report.periodKey || new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="pacote-semanal-cig-${date}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[scouting-package]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
