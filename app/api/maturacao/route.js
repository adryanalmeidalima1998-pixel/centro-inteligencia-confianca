import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS maturacao_athletes (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(255) NOT NULL,
      birth_date    DATE,
      sex           VARCHAR(20),
      category      VARCHAR(50),
      position      VARCHAR(50),
      dominant_foot VARCHAR(30),
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS maturacao_assessments (
      id                          SERIAL PRIMARY KEY,
      athlete_id                  INTEGER REFERENCES maturacao_athletes(id) ON DELETE CASCADE,
      assessment_date             DATE,
      decimal_age                 NUMERIC(6,2),
      standing_height_cm          NUMERIC(6,1),
      body_mass_kg                NUMERIC(6,1),
      bench_height_cm             NUMERIC(6,1) DEFAULT 40,
      seated_height_from_floor_cm NUMERIC(6,1),
      sitting_height_cm           NUMERIC(6,1),
      leg_length_cm               NUMERIC(6,1),
      maturity_offset             NUMERIC(6,2),
      estimated_phv_age           NUMERIC(6,2),
      current_maturation_status   VARCHAR(30),
      maturation_timing           VARCHAR(30),
      automatic_insight           TEXT,
      staff_notes                 TEXT,
      responsavel                 VARCHAR(255),
      created_at                  TIMESTAMP DEFAULT NOW()
    )
  `
  const migrations = [
    `ALTER TABLE maturacao_assessments ADD COLUMN IF NOT EXISTS responsavel VARCHAR(255)`,
    `ALTER TABLE maturacao_assessments ADD COLUMN IF NOT EXISTS sitting_height_cm NUMERIC(6,1)`,
  ]
  for (const m of migrations) { try { await sql.query(m) } catch (_) {} }
}

export async function GET() {
  try {
    await ensureTables()
    const athletes    = await sql`SELECT * FROM maturacao_athletes ORDER BY name ASC`
    const assessments = await sql`SELECT * FROM maturacao_assessments ORDER BY assessment_date DESC, created_at DESC`
    return NextResponse.json({ athletes: athletes.rows, assessments: assessments.rows })
  } catch (err) {
    return NextResponse.json({ athletes: [], assessments: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTables()
    const body = await request.json()
    const { athlete = {}, assessment = {} } = body

    if (!athlete.name?.trim()) {
      return NextResponse.json({ error: 'Nome do atleta é obrigatório.' }, { status: 400 })
    }

    // ── Resolve atleta: por id (atualiza) → por nome+nascimento (reaproveita) → cria ──
    let athleteRow = null
    if (athlete.id) {
      const upd = await sql`
        UPDATE maturacao_athletes SET
          name          = ${athlete.name.trim()},
          birth_date    = ${athlete.birth_date || null},
          sex           = ${athlete.sex || null},
          category      = ${athlete.category || null},
          position      = ${athlete.position || null},
          dominant_foot = ${athlete.dominant_foot || null}
        WHERE id = ${athlete.id}
        RETURNING *
      `
      athleteRow = upd.rows[0] || null
    }
    if (!athleteRow) {
      const found = await sql`
        SELECT * FROM maturacao_athletes
        WHERE lower(name) = lower(${athlete.name.trim()})
          AND birth_date IS NOT DISTINCT FROM ${athlete.birth_date || null}
        LIMIT 1
      `
      if (found.rows.length) athleteRow = found.rows[0]
    }
    if (!athleteRow) {
      const ins = await sql`
        INSERT INTO maturacao_athletes (name, birth_date, sex, category, position, dominant_foot)
        VALUES (
          ${athlete.name.trim()}, ${athlete.birth_date || null}, ${athlete.sex || null},
          ${athlete.category || null}, ${athlete.position || null}, ${athlete.dominant_foot || null}
        )
        RETURNING *
      `
      athleteRow = ins.rows[0]
    }

    // ── Insere avaliação ──
    const a = assessment
    const result = await sql`
      INSERT INTO maturacao_assessments (
        athlete_id, assessment_date, decimal_age, standing_height_cm, body_mass_kg, bench_height_cm,
        seated_height_from_floor_cm, sitting_height_cm, leg_length_cm, maturity_offset, estimated_phv_age,
        current_maturation_status, maturation_timing, automatic_insight, staff_notes, responsavel
      )
      VALUES (
        ${athleteRow.id},
        ${a.assessment_date || null},
        ${a.decimal_age ?? null},
        ${a.standing_height_cm ?? null},
        ${a.body_mass_kg ?? null},
        ${a.bench_height_cm ?? 40},
        ${a.seated_height_from_floor_cm ?? null},
        ${a.sitting_height_cm ?? null},
        ${a.leg_length_cm ?? null},
        ${a.maturity_offset ?? null},
        ${a.estimated_phv_age ?? null},
        ${a.current_maturation_status || null},
        ${a.maturation_timing || null},
        ${a.automatic_insight || null},
        ${a.staff_notes || null},
        ${a.responsavel || null}
      )
      RETURNING *
    `
    return NextResponse.json({ athlete: athleteRow, assessment: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
