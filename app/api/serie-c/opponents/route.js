import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

export const maxDuration = 60
const DEFAULT_COMPETITION='Brasileiro Série C'
const MAX_PDF_BYTES=25*1024*1024

async function ensureTable(){
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_opponent_reports (
      id SERIAL PRIMARY KEY,
      season VARCHAR(20) NOT NULL,
      competition VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      team VARCHAR(200) NOT NULL,
      source_filename TEXT NOT NULL,
      source_url TEXT NOT NULL,
      parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      uploaded_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (season, competition, team)
    )
  `
  try{await sql`CREATE INDEX IF NOT EXISTS idx_sc_opponent_reports ON serie_c_opponent_reports(season, competition, uploaded_at DESC)`}catch(_){}
}

function serialize(row){
  if(!row)return null
  return { id:Number(row.id), season:row.season, competition:row.competition, team:row.team, sourceFilename:row.source_filename, sourceUrl:row.source_url, parsedData:row.parsed_data||{}, uploadedAt:row.uploaded_at }
}

export async function GET(request){
  try{
    await ensureTable()
    const {searchParams}=new URL(request.url)
    const id=Number(searchParams.get('id'))
    const season=String(searchParams.get('season')||new Date().getFullYear())
    const competition=String(searchParams.get('competition')||DEFAULT_COMPETITION)
    if(Number.isInteger(id)&&id>0){
      const r=await sql`SELECT * FROM serie_c_opponent_reports WHERE id=${id} LIMIT 1`
      return NextResponse.json({ report:serialize(r.rows[0]) })
    }
    const r=await sql`
      SELECT * FROM serie_c_opponent_reports
      WHERE season=${season} AND competition=${competition}
      ORDER BY uploaded_at DESC
    `
    return NextResponse.json({ reports:r.rows.map(serialize) })
  }catch(error){ return NextResponse.json({ error:error.message||'Falha ao carregar adversários.' },{status:500}) }
}

export async function POST(request){
  try{
    await ensureTable()
    const form=await request.formData()
    const season=String(form.get('season')||'').trim()
    const competition=String(form.get('competition')||DEFAULT_COMPETITION).trim()
    const team=String(form.get('team')||'').trim()
    const parsedRaw=String(form.get('parsedData')||'{}')
    const file=form.get('file')
    if(!season||!team) return NextResponse.json({error:'Temporada e adversário são obrigatórios.'},{status:400})
    if(!file||typeof file.arrayBuffer!=='function') return NextResponse.json({error:'Selecione o PDF do adversário.'},{status:400})
    if(Number(file.size||0)>MAX_PDF_BYTES) return NextResponse.json({error:'O PDF ultrapassa 25 MB.'},{status:400})
    let parsedData={}
    try{ parsedData=JSON.parse(parsedRaw) }catch(_){ return NextResponse.json({error:'A leitura estruturada do PDF ficou inválida. Reprocesse o arquivo.'},{status:400}) }
    const safe=String(file.name||`${team}.pdf`).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,180)
    const blob=await put(`confianca/serie-c/adversarios/${season}/${Date.now()}-${safe}`,file,{access:'public'})
    const r=await sql`
      INSERT INTO serie_c_opponent_reports (season,competition,team,source_filename,source_url,parsed_data)
      VALUES (${season},${competition},${team},${file.name},${blob.url},${JSON.stringify(parsedData)}::jsonb)
      ON CONFLICT (season,competition,team) DO UPDATE SET
        source_filename=EXCLUDED.source_filename,
        source_url=EXCLUDED.source_url,
        parsed_data=EXCLUDED.parsed_data,
        uploaded_at=NOW()
      RETURNING *
    `
    return NextResponse.json({ok:true,report:serialize(r.rows[0])})
  }catch(error){ return NextResponse.json({error:error.message||'Falha ao salvar relatório do adversário.'},{status:500}) }
}


export async function PUT(request){
  try{
    await ensureTable()
    const body=await request.json().catch(()=>({}))
    const id=Number(body?.id)
    const team=String(body?.team||'').trim()
    const parsedData=body?.parsedData
    if(!Number.isInteger(id)||id<=0) return NextResponse.json({error:'Relatório inválido.'},{status:400})
    if(!parsedData||typeof parsedData!=='object') return NextResponse.json({error:'Leitura estruturada inválida.'},{status:400})
    const r=await sql`
      UPDATE serie_c_opponent_reports
      SET team=COALESCE(NULLIF(${team},''),team), parsed_data=${JSON.stringify(parsedData)}::jsonb, uploaded_at=NOW()
      WHERE id=${id}
      RETURNING *
    `
    if(!r.rows[0]) return NextResponse.json({error:'Relatório não encontrado.'},{status:404})
    return NextResponse.json({ok:true,report:serialize(r.rows[0])})
  }catch(error){ return NextResponse.json({error:error.message||'Falha ao reprocessar relatório do adversário.'},{status:500}) }
}

export async function DELETE(request){
  try{
    await ensureTable()
    const body=await request.json().catch(()=>({}))
    const id=Number(body?.id)
    if(!Number.isInteger(id)||id<=0) return NextResponse.json({error:'Relatório inválido.'},{status:400})
    await sql`DELETE FROM serie_c_opponent_reports WHERE id=${id}`
    return NextResponse.json({ok:true})
  }catch(error){ return NextResponse.json({error:error.message||'Falha ao excluir relatório.'},{status:500}) }
}
