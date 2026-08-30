import { NextResponse } from 'next/server'
import { getLatestReportPayload } from '@/lib/scouting-automation'
import {
  createAlertsPdf,
  createDashboardPdf,
  createExecutivePdf,
  createFocusPdf,
  createOpportunitiesPdf,
  createTopMetricPdf,
  createTopMetricPng,
} from '@/lib/scouting-reports'

export const runtime = 'nodejs'
export const maxDuration = 60

function slugify(value) {
  return String(value || 'material').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(request) {
  try {
    const report = await getLatestReportPayload()
    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind') || 'dashboard'
    const format = searchParams.get('format') || 'pdf'
    let buffer
    let filename
    let contentType = 'application/pdf'

    if (kind === 'top5') {
      const key = searchParams.get('metric') || report.topMetrics?.[0]?.key
      const metric = (report.topMetrics || []).find(item => item.key === key)
      if (!metric) return NextResponse.json({ error: 'Métrica não encontrada.' }, { status: 404 })
      if (format === 'png') {
        buffer = await createTopMetricPng(metric, report.generatedAt)
        contentType = 'image/png'
        filename = `top5-${slugify(metric.label)}.png`
      } else {
        buffer = createTopMetricPdf(metric, report.generatedAt)
        filename = `top5-${slugify(metric.label)}.pdf`
      }
    } else {
      const creators = {
        dashboard: createDashboardPdf,
        opportunities: createOpportunitiesPdf,
        focuses: createFocusPdf,
        alerts: createAlertsPdf,
        executive: createExecutivePdf,
      }
      const creator = creators[kind]
      if (!creator) return NextResponse.json({ error: 'Tipo de material inválido.' }, { status: 400 })
      buffer = creator(report)
      filename = `${slugify(kind)}-${report.periodKey || 'atual'}.pdf`
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[scouting-material]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
