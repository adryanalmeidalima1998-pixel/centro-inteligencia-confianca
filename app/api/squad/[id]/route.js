import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
export async function PUT(request,{params}){
 try{
  const {id}=await params; const b=await request.json()
  const numInt=v=>{const n=parseInt(v);return !isNaN(n)&&v!==''&&v!=null?n:null}; const numFlt=v=>{const n=parseFloat(String(v).replace(',','.'));return !isNaN(n)&&v!==''&&v!=null?n:null}
  const r=await sql`UPDATE confianca_squad SET nome=${b.nome?.trim()},posicao=${b.posicao||null},numero=${numInt(b.numero)},altura=${numFlt(b.altura)},peso=${numFlt(b.peso)},pe_dominante=${b.pe_dominante||null},data_nascimento=${b.data_nascimento||null},contrato_inicio=${b.contrato_inicio||null},contrato_fim=${b.contrato_fim||null},ativo=${b.ativo!==false} WHERE id=${Number(id)} RETURNING *`
  if(!r.rows[0]) return NextResponse.json({error:'Atleta não encontrado.'},{status:404})
  return NextResponse.json({player:r.rows[0]})
 }catch(err){return NextResponse.json({error:err.message},{status:500})}
}
export async function DELETE(_request,{params}){try{const {id}=await params;await sql`DELETE FROM confianca_squad WHERE id=${Number(id)}`;return NextResponse.json({ok:true})}catch(err){return NextResponse.json({error:err.message},{status:500})}}
