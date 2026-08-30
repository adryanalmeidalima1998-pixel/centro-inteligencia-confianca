import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

const INITIAL_SQUAD = [
  ['Matheus Emiliano','Goleiro'],['Cadu','Goleiro'],
  ['Mateus Ludke','Lateral Direito'],['Valdir','Lateral Direito'],['Enzo Rocha','Lateral Esquerdo'],['Marcelo Nunes','Lateral Esquerdo'],['Kelvyn','Lateral Esquerdo'],['Matheus Julião','Lateral Esquerdo'],
  ['Renilson','Zagueiro'],['Alisson','Zagueiro'],['Ícaro','Zagueiro/Volante'],['Mandovani','Zagueiro'],['Eduardo Moura','Zagueiro'],
  ['Madison','Volante'],['Guilherme Nunes','Volante'],['Lorran','Volante'],['Paulo Henrique','Volante'],
  ['Gabriel Zeca','Meia'],['Fabrício Oya','Meia'],['Patrick PK','Meia'],
  ['Iago','Extremo Esquerdo'],['Danielzinho','Extremo Direito'],['Breyner','Extremo Direito'],
  ['João Pedro','Atacante'],['Maikon Aquino','Atacante'],['Luiz Thiago','Atacante'],['Welder','Atacante'],['Keirrison','Atacante'],
]

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS confianca_squad (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      posicao VARCHAR(100),
      numero INTEGER,
      altura NUMERIC(5,1),
      peso NUMERIC(5,1),
      pe_dominante VARCHAR(20),
      data_nascimento DATE,
      contrato_inicio DATE,
      contrato_fim DATE,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE(nome)
    )
  `
  await sql`ALTER TABLE confianca_squad ADD COLUMN IF NOT EXISTS data_nascimento DATE`
  const count = await sql`SELECT COUNT(*)::int AS total FROM confianca_squad`
  if (Number(count.rows?.[0]?.total || 0) === 0) {
    for (const [nome, posicao] of INITIAL_SQUAD) {
      await sql`INSERT INTO confianca_squad (nome, posicao, ativo) VALUES (${nome}, ${posicao}, TRUE) ON CONFLICT (nome) DO NOTHING`
    }
  }
}

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`SELECT * FROM confianca_squad ORDER BY posicao, nome`
    return NextResponse.json({ players: result.rows, seeded: true })
  } catch (err) {
    return NextResponse.json({ players: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { nome, posicao, numero, altura, peso, pe_dominante, data_nascimento, contrato_inicio, contrato_fim, ativo = true } = body
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    const numInt = v => { const n=parseInt(v); return !isNaN(n)&&v!==''&&v!=null?n:null }
    const numFlt = v => { const n=parseFloat(String(v).replace(',','.')); return !isNaN(n)&&v!==''&&v!=null?n:null }
    const result = await sql`
      INSERT INTO confianca_squad (nome,posicao,numero,altura,peso,pe_dominante,data_nascimento,contrato_inicio,contrato_fim,ativo)
      VALUES (${nome.trim()},${posicao||null},${numInt(numero)},${numFlt(altura)},${numFlt(peso)},${pe_dominante||null},${data_nascimento||null},${contrato_inicio||null},${contrato_fim||null},${ativo})
      RETURNING *
    `
    return NextResponse.json({ player: result.rows[0] })
  } catch (err) {
    const status = String(err.message||'').includes('unique') ? 409 : 500
    return NextResponse.json({ error: status===409?'Atleta já cadastrado.':err.message }, { status })
  }
}
