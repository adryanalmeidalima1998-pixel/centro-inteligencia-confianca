import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema, safeJson } from '@/lib/treinadores-schema'
import { parseWyscoutTeamStats, matchWyscoutToCoachGames } from '@/lib/wyscout-trainer-teamstats'
import { analyzeCoachWyscoutData } from '@/lib/treinador-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_ADAPT = ['Flexibilidade tática','Gestão de grupo','Trabalho com jovens','Reação a adversidades','Uso de dados/tecnologia','Adaptação ao elenco']

function mergeNamed(current=[], incoming=[], key='titulo', limit=12) {
  const map=new Map()
  for (const item of current || []) if (item?.[key]) map.set(String(item[key]).toLowerCase(), item)
  for (const item of incoming || []) if (item?.[key]) map.set(String(item[key]).toLowerCase(), item)
  return [...map.values()].slice(0,limit)
}

function mergeAdapt(current=[], incoming=[]) {
  const map=new Map(DEFAULT_ADAPT.map(criterio=>[criterio,{criterio,nota:0,justificativa:''}]))
  for (const item of current || []) if (item?.criterio) map.set(item.criterio,{...map.get(item.criterio),...item})
  for (const item of incoming || []) if (item?.criterio) map.set(item.criterio,{...map.get(item.criterio),...item})
  return [...map.values()]
}

function withImportedGames(current=[], imported=[]) {
  const map=new Map((current || []).map(x=>[Number(x.id),x]))
  for (const g of imported || []) {
    if (!g.game_id) continue
    const old=map.get(Number(g.game_id)) || {}
    map.set(Number(g.game_id),{id:Number(g.game_id),fonte:'Wyscout',nota:old.nota||'',...old,fonte:old.fonte||'Wyscout'})
  }
  return [...map.values()]
}

function mergeReport(current, analysis, wyscoutMeta) {
  const ai=analysis || {}
  return {
    ...current,
    resumo_executivo: ai.resumo_executivo || current.resumo_executivo || '',
    modelo_jogo:{...(current.modelo_jogo||{}),...(ai.modelo_jogo||{})},
    pontos_fortes:mergeNamed(current.pontos_fortes,ai.pontos_fortes,'titulo',12),
    pontos_melhoria:mergeNamed(current.pontos_melhoria,ai.pontos_melhoria,'titulo',10),
    adaptabilidade:mergeAdapt(current.adaptabilidade,ai.adaptabilidade),
    aderencia_objetivo:ai.aderencia_objetivo || current.aderencia_objetivo || {
      objetivo:'Retorno à Série C',nota:0,nivel:'Em análise',acessos_confirmados:[],experiencia_serie_d:'',evidencias:[],riscos:[]
    },
    recomendacao:ai.recomendacao || current.recomendacao || 'Em análise',
    justificativas_recomendacao:ai.justificativas_recomendacao?.length ? ai.justificativas_recomendacao : (current.justificativas_recomendacao||[]),
    sintese_final:ai.sintese_final || current.sintese_final || '',
    jogos_analisados:withImportedGames(current.jogos_analisados,wyscoutMeta.jogos),
    wyscout_analise:wyscoutMeta
  }
}

function safeFilename(name='wyscout-team-stats.xlsx') {
  return String(name).replace(/[^a-zA-Z0-9._ -]+/g,'').slice(0,100) || 'wyscout-team-stats.xlsx'
}

export async function POST(request,{params}) {
  try {
    await ensureTreinadoresSchema()
    const {id}=await params
    const form=await request.formData()
    const file=form.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') return Response.json({error:'Selecione uma planilha .xlsx do Wyscout.'},{status:400})
    if (!/\.xlsx?$/i.test(file.name || '')) return Response.json({error:'Envie uma planilha Excel (.xlsx ou .xls) exportada do Wyscout.'},{status:400})
    if (Number(file.size || 0) > 12*1024*1024) return Response.json({error:'A planilha excede o limite de 12 MB.'},{status:400})

    const result=await sql`SELECT * FROM treinadores WHERE id=${id}`
    const coach=result.rows[0]
    if (!coach) return Response.json({error:'Treinador não encontrado.'},{status:404})

    const buffer=Buffer.from(await file.arrayBuffer())
    const parsed=parseWyscoutTeamStats(buffer,coach.clube_atual || '')
    const coachGames=safeJson(coach.jogos_json,[])
    let matched=matchWyscoutToCoachGames(parsed.jogos,coachGames)

    // Se um jogo existe no Wyscout mas não veio no histórico do Transfermarkt,
    // ele também entra na página de Jogos Analisados como registro Wyscout.
    let nextId=Math.max(0,...coachGames.map(g=>Number(g.id)||0))+1
    const synthetic=[]
    matched=matched.map(ws=>{
      if (ws.game_id) return ws
      const raw=String(ws.jogo||'')
      const score=raw.match(/(\d+)\s*[:x-]\s*(\d+)/i)
      const beforeScore=score ? raw.slice(0,score.index).trim() : raw
      const sides=beforeScore.split(/\s+-\s+/)
      const mandante=(sides[0]||ws.equipe||'Equipe').trim()
      const visitante=(sides[1]||ws.adversario||'Adversário').replace(/\s*\(P\)\s*/i,'').trim()
      const id=nextId++
      synthetic.push({
        id,data:ws.data,competicao:ws.competicao,temporada:null,rodada:null,mandante,
        placar:score?`${score[1]}:${score[2]}`:`${ws.metricas?.goals??0}:${ws.adversario_metricas?.goals??0}`,
        visitante,tatica:ws.sistema||null,tatica_wyscout:ws.sistema||null,fonte_dados:'Wyscout',wyscout_only:true,
        clube_treinador:ws.equipe||null,resultado_treinador:ws.resultado||null,
        wyscout_metricas:ws.metricas||null,wyscout_adversario_metricas:ws.adversario_metricas||null
      })
      return {...ws,game_id:id}
    })

    const updatedCoachGames=[...coachGames.map(g=>{
      const ws=matched.find(x=>Number(x.game_id)===Number(g.id))
      if (!ws) return g
      const currentTactic=String(g.tatica || '').trim()
      return {
        ...g,
        tatica:(!currentTactic || currentTactic==='?' || currentTactic==='—') ? (ws.sistema || currentTactic || null) : currentTactic,
        tatica_wyscout:ws.sistema || null,
        wyscout_metricas:ws.metricas || null,
        wyscout_adversario_metricas:ws.adversario_metricas || null
      }
    }),...synthetic]

    const current=safeJson(coach.relatorio_json,{})
    let analysis=null, aiWarning=''
    try {
      analysis=await analyzeCoachWyscoutData({coach:{...coach,jogos_json:updatedCoachGames},currentReport:current,wyscout:{...parsed,jogos:matched}})
    } catch (err) {
      console.error('[treinadores/wyscout/ai]',err)
      aiWarning=err?.message || 'Os dados foram importados, mas a interpretação automática não foi concluída.'
    }

    const wyscoutMeta={
      arquivo:safeFilename(file.name),
      importado_em:new Date().toISOString(),
      fonte:'Wyscout Team Stats',
      equipe:parsed.equipe,
      jogos:matched,
      resumo:parsed.resumo,
      formacoes:parsed.formacoes,
      insights:parsed.insights,
      ai:analysis ? {
        sintese:analysis.wyscout_sintese,
        leitura_ofensiva:analysis.leitura_ofensiva,
        leitura_defensiva:analysis.leitura_defensiva,
        pressao_sem_bola:analysis.pressao_sem_bola,
        progressao_posse:analysis.progressao_posse,
        transicoes:analysis.transicoes,
        bola_parada:analysis.bola_parada,
        jogos_destaque:analysis.jogos_destaque
      } : null
    }
    const report=mergeReport(current,analysis,wyscoutMeta)

    await sql`
      UPDATE treinadores SET
        jogos_json=${JSON.stringify(updatedCoachGames)}::jsonb,
        relatorio_json=${JSON.stringify(report)}::jsonb,
        recomendacao=${report.recomendacao || 'Em análise'},
        estilo_jogo=${report.resumo_executivo || null},
        forcas=${(report.pontos_fortes||[]).map(x=>x.titulo).filter(Boolean).join(' · ') || null},
        fraquezas=${(report.pontos_melhoria||[]).map(x=>x.titulo).filter(Boolean).join(' · ') || null},
        atualizado_em=NOW()
      WHERE id=${id}
    `

    return Response.json({
      success:true,
      report,
      wyscout:wyscoutMeta,
      matched_games:matched.filter(x=>x.game_id).length,
      total_games:matched.length,
      warning:aiWarning || null
    })
  } catch (err) {
    console.error('[treinadores/wyscout]',err)
    return Response.json({error:err?.message || 'Falha ao importar a planilha do Wyscout.'},{status:500})
  }
}
