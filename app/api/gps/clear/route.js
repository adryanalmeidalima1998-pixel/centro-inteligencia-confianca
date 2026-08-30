import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// DELETE /api/gps/clear  — remove TODAS as sessões GPS
export async function DELETE() {
  try {
    const result = await sql`DELETE FROM gps_sessions RETURNING id`
    return NextResponse.json({
      ok: true,
      deleted: result.rows.length,
      message: `${result.rows.length} sessão(ões) deletada(s).`
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
