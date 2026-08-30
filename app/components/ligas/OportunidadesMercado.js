'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { calculateSportsbasePercentile, getSportsbasePositionGroup, SPORTSBASE_POSITION_GROUPS } from '@/data/sportsbase-map'
import { playerProfilePath } from '@/data/player-route'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'

const GFC = '#0a66b7'
const GFC_DARK = '#064b82'

/* Limite de jogos que um atleta pode disputar por uma equipe e ainda ficar
   elegível a se transferir para outro clube da mesma divisão no ano (vínculo). */
const LIMITE_JOGOS = 13

/* Métricas de destaque (per-90 / %) usadas para compor a nota estatística por grupo.
   Todas são "quanto maior, melhor". Chaves conferidas contra data/sportsbase-map.js. */
const SCORE_METRICS = {
  GK: ['duelos_aereos_pct', 'passes_pct', 'passes_longos_pct'],
  CB: ['desarmes_90', 'intercecoes_90', 'duelos_def_pct', 'duelos_aereos_pct', 'passes_pct'],
  FB: ['desarmes_90', 'intercecoes_90', 'cruzamentos_90', 'duelos_def_pct', 'passes_prog_90'],
  DM: ['recuperacoes_90', 'intercecoes_90', 'passes_90', 'passes_pct', 'duelos_pct'],
  AM: ['assistencias_90', 'chances_criadas_90', 'passes_chave_90', 'dribles_pct', 'participacao_gols_90'],
  WG: ['gols_90', 'assistencias_90', 'dribles_90', 'dribles_pct', 'chances_criadas_90'],
  ST: ['gols_90', 'xg_90', 'remates_golo_pct', 'participacao_gols_90', 'conversao_gols_pct'],
}
/* Fallback caso a fonte não tenha as métricas específicas do grupo. */
const FALLBACK_METRICS = ['gols_90', 'assistencias_90', 'passes_pct', 'duelos_pct', 'acoes_90']

function canonicalPlayerPath(slug, player) {
  return player?._canonical_id ? `/database/${player._canonical_id}` : playerProfilePath(slug, player)
}

function footBadge(value) {
  const label = playerFootLabel(value)
  return label && label !== '—' ? label : null
}

function scoreTone(score) {
  if (score >= 80) return { bg:'#dcfce7', text:'#166534', bar:'#0a66b7' }
  if (score >= 65) return { bg:'#ecfccb', text:'#3f6212', bar:'#65a30d' }
  if (score >= 50) return { bg:'#fef3c7', text:'#92400e', bar:'#d97706' }
  return { bg:'#f1f5f9', text:'#475569', bar:'#64748b' }
}

/* Nota estatística 0–100: média dos percentis do jogador (dentro do próprio grupo
   posicional) nas métricas relevantes. Só considera métricas presentes na base. */
function computeGroupScores(players) {
  const byGroup = {}
  for (const p of players) {
    const g = getSportsbasePositionGroup(p.posicao) || 'ST'
    ;(byGroup[g] ||= []).push(p)
  }
  const scored = new Map()
  for (const [group, pool] of Object.entries(byGroup)) {
    const metricKeys = SCORE_METRICS[group] || FALLBACK_METRICS
    const usable = metricKeys.filter(key => pool.some(p => Number.isFinite(Number(p[key]))))
    const keys = usable.length ? usable : FALLBACK_METRICS.filter(key => pool.some(p => Number.isFinite(Number(p[key]))))
    const valuesByKey = Object.fromEntries(keys.map(key => [key, pool.map(p => p[key])]))
    for (const p of pool) {
      const pcts = keys
        .map(key => {
          const v = p[key]
          if (!Number.isFinite(Number(v))) return null
          return calculateSportsbasePercentile(v, valuesByKey[key], true)
        })
        .filter(v => v != null)
      const score = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0
      scored.set(p, score)
    }
  }
  return scored
}

function GroupBadge({ group }) {
  const info = SPORTSBASE_POSITION_GROUPS[group]
  if (!info) return null
  return <span style={{ fontSize:8.5, fontWeight:900, padding:'2px 6px', borderRadius:5, background:'#eef6f1', color:GFC }}>{info.shortLabel}</span>
}

function PlayerCard({ player, slug, rank, mode, maxMinutes }) {
  const tone = scoreTone(player._oppScore)
  const jogos = Number(player.jogos) || 0
  const minutos = Math.round(Number(player.minutos) || 0)
  const restantes = Math.max(0, LIMITE_JOGOS - jogos)
  const share = maxMinutes > 0 ? Math.round((minutos / maxMinutes) * 100) : null

  return (
    <div style={{ display:'grid', gridTemplateColumns:'40px minmax(0,1fr) auto', gap:12, alignItems:'center', padding:'12px 14px', borderTop:'1px solid #eef3ef', background:rank === 1 ? '#fbfefc' : '#fff' }}>
      <div style={{ width:32, height:32, borderRadius:9, display:'grid', placeItems:'center', background:rank === 1 ? GFC : '#f1f5f9', color:rank === 1 ? '#fff' : '#64748b', fontSize:12, fontWeight:950 }}>#{rank}</div>

      <div style={{ minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          <Link href={canonicalPlayerPath(slug, player)} style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12.5, fontWeight:900, color:'#10233b', textDecoration:'none' }}>{player.nome}</Link>
          <GroupBadge group={getSportsbasePositionGroup(player.posicao)} />
          {player.idade ? <span style={{ fontSize:8.5, color:'#64748b', background:'#f1f5f9', borderRadius:99, padding:'2px 5px', flexShrink:0 }}>{player.idade}a</span> : null}
        </div>
        <p style={{ margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9.5, color:'#64748b' }}>
          {[player.equipa, player.posicao, footBadge(player.pe)].filter(Boolean).join(' · ')}
        </p>
        <div style={{ margin:'6px 0 0', display:'flex', gap:6, flexWrap:'wrap' }}>
          {mode === 'elegiveis13' ? (
            <>
              <span style={{ fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:6, background:restantes <= 3 ? '#fee2e2' : '#eef6f1', color:restantes <= 3 ? '#b91c1c' : GFC }}>
                {jogos}/{LIMITE_JOGOS} jogos · faltam {restantes}
              </span>
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#f1f5f9', color:'#475569' }}>{minutos} min</span>
              {player.gols ? <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#f0fdf4', color:GFC }}>{player.gols} gols</span> : null}
            </>
          ) : (
            <>
              <span style={{ fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8' }}>{jogos} jogos · {minutos} min</span>
              {share != null ? <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#f1f5f9', color:'#475569' }}>{share}% do teto de minutos da liga</span> : null}
              {player.gols ? <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#f0fdf4', color:GFC }}>{player.gols} gols</span> : null}
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign:'right', minWidth:70 }}>
        <p style={{ fontSize:8, color:'#94a3b8', fontWeight:800, margin:'0 0 3px' }}>NOTA</p>
        <span style={{ display:'inline-block', minWidth:44, borderRadius:9, padding:'5px 7px', background:tone.bg, color:tone.text, fontSize:15, fontWeight:950 }}>{player._oppScore}</span>
        <div style={{ width:48, height:4, margin:'5px 0 0 auto', borderRadius:99, background:'#e2e8f0', overflow:'hidden' }}>
          <div style={{ width:`${Math.max(4, Math.min(100, player._oppScore))}%`, height:'100%', background:tone.bar }} />
        </div>
      </div>
    </div>
  )
}

export default function OportunidadesMercado({ slug, ligaNome = '', mode = 'elegiveis13', sourcePreference = 'auto' }) {
  const [players, setPlayers] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState(null)

  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [foot, setFoot] = useState('')
  const [minScore, setMinScore] = useState(0)

  /* Controles específicos do modo elegíveis (Série C) */
  const [maxJogos, setMaxJogos] = useState(LIMITE_JOGOS - 1)

  /* Controles específicos do modo encostados (Série A/B) */
  const [maxShare, setMaxShare] = useState(30)   // % do teto de minutos da liga
  const [minJogosEncostado, setMinJogosEncostado] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ligas-v2/${slug}/dataset?source=${sourcePreference}`)
      if (!res.ok) throw new Error('Falha ao carregar dados da liga')
      const data = await res.json()
      setPlayers(data.jogadores || [])
      setMeta(data.meta || null)
      setSource(data.fonte || null)
    } catch (err) {
      console.error(err)
      setPlayers([])
      setMeta(null)
    }
    setLoading(false)
  }, [slug, sourcePreference])

  useEffect(() => { fetchData() }, [fetchData])

  const maxMinutes = useMemo(() => {
    const metaMax = Number(meta?.maxMinutes) || 0
    if (metaMax > 0) return metaMax
    return Math.max(0, ...players.map(p => Number(p.minutos) || 0))
  }, [meta, players])

  const scoreByPlayer = useMemo(() => computeGroupScores(players), [players])

  const ranked = useMemo(() => {
    const withScore = players.map(p => ({ ...p, _oppScore: scoreByPlayer.get(p) ?? 0 }))

    let base
    if (mode === 'elegiveis13') {
      // Ainda elegíveis: disputaram menos que o limite (usa o filtro maxJogos).
      base = withScore.filter(p => (Number(p.jogos) || 0) <= Number(maxJogos))
    } else {
      // Encostados: baixa utilização relativa ao teto de minutos da liga.
      base = withScore.filter(p => {
        const minutos = Number(p.minutos) || 0
        const share = maxMinutes > 0 ? (minutos / maxMinutes) * 100 : 0
        if (share > Number(maxShare)) return false
        if ((Number(p.jogos) || 0) < Number(minJogosEncostado)) return false
        return minutos > 0 || (Number(p.jogos) || 0) > 0
      })
    }

    return base
      .filter(p => !group || getSportsbasePositionGroup(p.posicao) === group)
      .filter(p => !foot || matchesPlayerFoot(p, foot))
      .filter(p => !search || `${p.nome} ${p.equipa}`.toLowerCase().includes(search.toLowerCase()))
      .filter(p => p._oppScore >= Number(minScore))
      .sort((a, b) => {
        if (mode === 'encostados') {
          // Prioriza qualidade (nota) e, em empate, quem tem menos minutos (mais "livre").
          if (b._oppScore !== a._oppScore) return b._oppScore - a._oppScore
          return (Number(a.minutos) || 0) - (Number(b.minutos) || 0)
        }
        // elegíveis: prioriza nota; em empate, quem tem mais jogos restantes (mais janela).
        if (b._oppScore !== a._oppScore) return b._oppScore - a._oppScore
        return (Number(a.jogos) || 0) - (Number(b.jogos) || 0)
      })
  }, [players, scoreByPlayer, mode, maxJogos, maxShare, minJogosEncostado, maxMinutes, group, foot, search, minScore])

  const isC = mode === 'elegiveis13'
  const headerCopy = isC
    ? {
        title:'Destaques ainda elegíveis (regra dos 13 jogos)',
        sub:'Jogadores em evidência que ainda não atingiram o limite de jogos e podem se transferir para outro clube da divisão dentro do vínculo.',
        accent:GFC,
      }
    : {
        title:'Jogadores encostados / com pouca minutagem',
        sub:'Atletas com baixa utilização na temporada — sem espaço no elenco atual — que podemos tentar trazer.',
        accent:'#1d4ed8',
      }

  if (loading) return <div style={{ padding:45, textAlign:'center', color:'#94a3b8', fontSize:12 }}>Carregando dados da liga…</div>

  if (!source) return (
    <div style={{ padding:36, textAlign:'center', border:'1px dashed #dbe7f2', borderRadius:12, background:'#f8fdf9' }}>
      <p style={{ fontSize:22, marginBottom:8 }}>📭</p>
      <p style={{ fontWeight:800, color:'#334155', fontSize:13 }}>Nenhum dado importado para esta liga.</p>
      <p style={{ fontSize:11, color:'#64748b', marginTop:6 }}>Envie um arquivo Sportsbase ou Wyscout na aba <b>Upload</b> para liberar esta análise.</p>
    </div>
  )

  return (
    <div>
      <div style={{ background:`linear-gradient(135deg,${isC ? GFC_DARK : '#1e3a8a'},${headerCopy.accent})`, borderRadius:14, padding:'18px 22px', marginBottom:18 }}>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>Oportunidades de mercado · {ligaNome || slug}</p>
        <h2 style={{ fontSize:17, fontWeight:900, color:'#fff', marginBottom:4 }}>{headerCopy.title}</h2>
        <p style={{ fontSize:11.5, color:'rgba(255,255,255,0.82)', lineHeight:1.5 }}>{headerCopy.sub}</p>
        <p style={{ fontSize:9.5, color:'rgba(255,255,255,0.6)', marginTop:8 }}>
          Fonte: {source === 'wyscout' ? 'Wyscout' : 'Sportsbase'} · Nota = média dos percentis do atleta no próprio grupo posicional. Use como triagem: valide sempre em vídeo.
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display:'grid', gridTemplateColumns:`minmax(180px,1.4fr) repeat(${isC ? 4 : 5},minmax(120px,.8fr))`, gap:8, padding:13, background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, marginBottom:14 }}>
        <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>BUSCAR
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Jogador ou clube" style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 9px', fontSize:10 }} />
        </label>
        <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>GRUPO
          <select value={group} onChange={e=>setGroup(e.target.value)} style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 7px', fontSize:10 }}>
            <option value="">Todos</option>
            {Object.entries(SPORTSBASE_POSITION_GROUPS).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>PÉ PREFERIDO
          <select value={foot} onChange={e=>setFoot(e.target.value)} style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 7px', fontSize:10 }}>
            {PLAYER_FOOT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>NOTA MÍNIMA
          <input type="number" min="0" max="100" value={minScore} onChange={e=>setMinScore(e.target.value)} style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 7px', fontSize:10 }} />
        </label>

        {isC ? (
          <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>MÁX. DE JOGOS
            <input type="number" min="0" max={LIMITE_JOGOS} value={maxJogos} onChange={e=>setMaxJogos(e.target.value)} style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 7px', fontSize:10 }} />
          </label>
        ) : (
          <>
            <label style={{ fontSize:9, fontWeight:800, color:'#64748b' }}>MÁX. % DE MINUTOS
              <input type="number" min="1" max="100" value={maxShare} onChange={e=>setMaxShare(e.target.value)} style={{ width:'100%', marginTop:4, border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 7px', fontSize:10 }} />
            </label>
          </>
        )}
      </div>

      {!isC && (
        <p style={{ fontSize:10, color:'#64748b', margin:'-6px 0 14px', lineHeight:1.5 }}>
          ℹ Encostados = atletas cuja minutagem é ≤ <b>{maxShare}%</b> do maior volume de minutos da liga.
          Quanto menor o percentual, mais claramente o jogador está fora dos planos do clube atual.
        </p>
      )}

      {/* Resumo */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'9px 14px' }}>
          <p style={{ fontSize:9, color:'#64748b', fontWeight:800 }}>ENCONTRADOS</p>
          <p style={{ fontSize:18, fontWeight:950, color:GFC }}>{ranked.length}</p>
        </div>
        {isC && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'9px 14px' }}>
            <p style={{ fontSize:9, color:'#64748b', fontWeight:800 }}>NA ZONA DE RISCO (≤ 3 JOGOS RESTANTES)</p>
            <p style={{ fontSize:18, fontWeight:950, color:'#b91c1c' }}>{ranked.filter(p => LIMITE_JOGOS - (Number(p.jogos) || 0) <= 3).length}</p>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'11px 15px', background:'#f8fdf9', borderBottom:'1px solid #edf4ef', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <strong style={{ fontSize:12.5, color:'#10233b' }}>{isC ? 'Elegíveis à transferência (vínculo)' : 'Candidatos encostados'}</strong>
          <strong style={{ fontSize:11, color:headerCopy.accent }}>{ranked.length} atletas</strong>
        </div>
        {ranked.length ? ranked.slice(0, 120).map((player, index) => (
          <PlayerCard key={`${player.nome}-${player.equipa}-${index}`} player={player} slug={slug} rank={index + 1} mode={mode} maxMinutes={maxMinutes} />
        )) : (
          <div style={{ padding:45, textAlign:'center', color:'#94a3b8', fontSize:12 }}>Nenhum jogador no recorte selecionado.</div>
        )}
      </div>
    </div>
  )
}
