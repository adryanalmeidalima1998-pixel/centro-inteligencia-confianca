'use client'

import { playerFootLabel } from '@/data/player-foot'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  Button, C, ConfidenceBadge, EmptyState, Kpi, LoadingState,
  PageHeader, Panel, PercentileBar, ScoreBadge, ScoutingPage, StatusDot,
} from '@/app/components/scouting/ScoutingUI'

function number(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function metricValue(metric) {
  if (metric?.value === null || metric?.value === undefined) return '—'
  if (metric.type === 'percent') return `${number(metric.value, 1)}%`
  if (metric.type === 'total') return number(metric.value, 0)
  return number(metric.value, 2)
}

function sourceLabel(source) {
  return source === 'wyscout' ? 'WYSCOUT · SÉRIE D' : 'SPORTSBASE'
}

function RadarCard({ title, subtitle, data, comparisonLabel, candidateLabel }) {
  if (data.length < 3) return <Panel title={title} subtitle={subtitle}><EmptyState icon="📐" title="Comparação insuficiente" text="São necessárias ao menos três métricas elegíveis para formar o radar." /></Panel>
  return <Panel title={title} subtitle={subtitle} bodyStyle={{ padding: 8 }}>
    <div style={{ height: 370 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="69%">
          <PolarGrid stroke="#dbe9df" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#526d5d', fontSize: 10, fontWeight: 700 }} />
          <Tooltip formatter={(value) => [`P${Math.round(Number(value) || 0)}`, '']} />
          <Radar name={candidateLabel} dataKey="candidate" stroke="#0a66b7" fill="#0a66b7" fillOpacity={0.28} strokeWidth={2.5} />
          <Radar name={comparisonLabel} dataKey="benchmark" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.12} strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  </Panel>
}

function ProfileSummary({ scouting, source }) {
  const strengths = scouting?.strengths || []
  const concerns = scouting?.concerns || []
  return <Panel title="Encaixe projetado no Confiança" subtitle={source === 'wyscout' ? 'Leitura indicativa com variáveis compartilhadas pelo export da Série D' : 'Perfil funcional + modelo de jogo + confiança da amostra'} accent={C.green}>
    <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 18, alignItems: 'center' }} className="scout-two-col">
      <div style={{ textAlign: 'center', borderRadius: 16, padding: 18, background: 'linear-gradient(145deg,#e8f5ed,#fff)', border: `1px solid ${C.green3}` }}>
        <p style={{ fontSize: 9.5, color: C.muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.7px' }}>Fit Confiança</p>
        <strong style={{ display: 'block', color: C.green, fontSize: 48, lineHeight: 1, marginTop: 8 }}>{scouting?.finalScore || 0}</strong>
        <p style={{ color: C.ink, fontSize: 11.5, fontWeight: 900, marginTop: 8 }}>{scouting?.profile || 'Sem perfil'}</p>
        <div style={{ marginTop: 10 }}><ConfidenceBadge confidence={scouting?.confidence} /></div>
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 9 }}>
          <Kpi label="Perfil funcional" value={scouting?.profileScore || 0} sub={scouting?.profile || '—'} icon="🧬" tone={C.purple} />
          <Kpi label="Encaixe tático" value={scouting?.tacticalScore || 0} sub="Aderência ao modelo atual" icon="🧩" tone={C.blue} />
          <Kpi label="Amostra" value={scouting?.confidence?.label || '—'} sub={`${scouting?.minimumMinutes || 0} min de referência`} icon="⏱️" tone={C.amber} />
        </div>
        {scouting?.limited && <div style={{ marginTop: 12, padding: 10, background: '#fff8e8', border: '1px solid #f3d79d', borderRadius: 10, color: '#895b08', fontSize: 10.5, lineHeight: 1.45 }}>A fonte Wyscout da Série D não traz passe, duelos, recuperação ou condução. O fit é uma triagem inicial e não deve ser comparado diretamente ao score Sportsbase.</div>}
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, marginTop: 16 }} className="scout-two-col">
      <div style={{ padding: 13, borderRadius: 12, background: '#f0f8f3', border: `1px solid ${C.green3}` }}>
        <h3 style={{ fontSize: 10, color: C.green, fontWeight: 950, textTransform: 'uppercase' }}>Sinais para validar</h3>
        {strengths.length ? strengths.map(item => <p key={item.label || item.key} style={{ fontSize: 11, color: C.ink, marginTop: 9 }}>✓ <strong>{item.label}</strong> · P{item.percentile}</p>) : <p style={{ fontSize: 11, color: C.muted, marginTop: 9 }}>Sem métricas elegíveis suficientes.</p>}
      </div>
      <div style={{ padding: 13, borderRadius: 12, background: '#fff7f2', border: '1px solid #f2d3c4' }}>
        <h3 style={{ fontSize: 10, color: C.red, fontWeight: 950, textTransform: 'uppercase' }}>Perguntas para vídeo/campo</h3>
        {concerns.length ? concerns.map(item => <p key={item.label || item.key} style={{ fontSize: 11, color: C.ink, marginTop: 9 }}>→ Validar <strong>{String(item.label || '').toLowerCase()}</strong> · P{item.percentile}</p>) : <p style={{ fontSize: 11, color: C.muted, marginTop: 9 }}>Sem alertas estatísticos elegíveis.</p>}
      </div>
    </div>
  </Panel>
}

function MaterialLink({ href, label, icon }) {
  if (!href) return <span style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 11px', border:`1px dashed ${C.line}`, borderRadius:9, color:C.muted, fontSize:10.5, fontWeight:800 }}>{icon} {label} não cadastrado</span>
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'8px 11px', border:`1px solid ${C.green3}`, borderRadius:9, background:C.green2, color:C.green, textDecoration:'none', fontSize:10.5, fontWeight:900 }}>{icon} Abrir {label} ↗</a>
}

export default function PlayerProfileClient({ slug, playerId }) {
  const { data: session } = useSession()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [links, setLinks] = useState({ videoUrl:'', ogolUrl:'' })
  const [linkDraft, setLinkDraft] = useState({ videoUrl:'', ogolUrl:'' })
  const [savingLinks, setSavingLinks] = useState(false)
  const [linkMessage, setLinkMessage] = useState(null)

  const canEdit = !['diretoria','comissao'].includes(session?.user?.role)

  useEffect(() => {
    let active = true
    fetch(`/api/ligas-v2/${slug}/jogadores/${playerId}`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar o jogador.')
        if (active) {
          const nextLinks = {
            videoUrl:data.links?.videoUrl || data.player?._video_url || '',
            ogolUrl:data.links?.ogolUrl || data.player?._ogol_url || '',
          }
          setPayload(data)
          setLinks(nextLinks)
          setLinkDraft(nextLinks)
        }
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug, playerId])

  const leagueRadar = useMemo(() => (payload?.analysis?.radar || []).filter(item => Number.isFinite(item.leaguePercentile)).map(item => ({ subject: item.label, candidate: item.leaguePercentile, benchmark: 50 })), [payload])
  const clubRadar = useMemo(() => (payload?.analysis?.radar || [])
    .filter(item => Number.isFinite(item.playerVsClub) && Number.isFinite(item.clubAverage))
    .map(item => ({ subject: item.label, candidate: item.playerVsClub, benchmark: item.clubAverage })), [payload])
  const linksDirty = linkDraft.videoUrl.trim() !== links.videoUrl.trim() || linkDraft.ogolUrl.trim() !== links.ogolUrl.trim()

  async function saveLinks() {
    setSavingLinks(true)
    setLinkMessage(null)
    try {
      const response = await fetch(`/api/ligas-v2/${slug}/jogadores/${playerId}`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(linkDraft),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar os links.')
      const saved = {
        videoUrl:data.links?.videoUrl || '',
        ogolUrl:data.links?.ogolUrl || '',
      }
      setLinks(saved)
      setLinkDraft(saved)
      setPayload(current => current ? { ...current, links:saved, player:{ ...current.player, _video_url:saved.videoUrl || null, _ogol_url:saved.ogolUrl || null } } : current)
      setLinkMessage({ type:'success', text:'Links do atleta salvos.' })
    } catch (saveError) {
      setLinkMessage({ type:'error', text:saveError.message })
    } finally {
      setSavingLinks(false)
    }
  }

  if (loading) return <ScoutingPage><LoadingState text="Construindo perfil posicional e encaixe no Confiança..." /></ScoutingPage>
  if (error || !payload) return <ScoutingPage><EmptyState icon="⚠️" title="Perfil indisponível" text={error || 'Jogador não encontrado.'} action={<Link href={`/ligas-v2/${slug}`}><Button>Voltar para a liga</Button></Link>} /></ScoutingPage>

  const { player, league, analysis } = payload
  return <ScoutingPage maxWidth={1500}>
    <PageHeader
      eyebrow={`${league.nome || 'Liga'} · PERFIL INDIVIDUAL`}
      title={player.nome}
      subtitle={`${player.equipa || 'Sem clube'} · ${player.posicao || 'posição não informada'} · ${player.idade || '—'} anos`}
      status={<StatusDot color={analysis.source === 'wyscout' ? C.blue : C.green}>{sourceLabel(analysis.source)}</StatusDot>}
      actions={<>
        <Link href={`/ligas-v2/${slug}`}><Button variant="secondary">← Voltar à liga</Button></Link>
        {payload.canonicalId && <Link href={`/database/${payload.canonicalId}`}><Button variant="secondary">🧬 Abrir ficha-mãe</Button></Link>}
        <Link href={`/comparacao?nome=${encodeURIComponent(player.nome)}&equipa=${encodeURIComponent(player.equipa || '')}&liga=${encodeURIComponent(slug)}`}><Button>⚖️ Comparar</Button></Link>
      </>}
    />

    <Panel
      title="Materiais e referências"
      subtitle="Os links ficam vinculados à ficha-mãe e aparecem como atalhos clicáveis no PDF de destaques."
      style={{ marginBottom:16 }}
      action={<div style={{ display:'flex', gap:7, flexWrap:'wrap', justifyContent:'flex-end' }}><MaterialLink href={links.videoUrl} label="vídeo" icon="🎬" /><MaterialLink href={links.ogolUrl} label="oGol" icon="🔗" /></div>}
    >
      {canEdit ? <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }} className="scout-two-col">
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:9, color:C.muted, fontWeight:900, textTransform:'uppercase', letterSpacing:'.5px' }}>Material de vídeo</span>
            <input type="url" value={linkDraft.videoUrl} onChange={event => setLinkDraft(current => ({ ...current, videoUrl:event.target.value }))} placeholder="https://youtube.com/... ou link da pasta de vídeo" style={{ width:'100%', padding:'10px 11px', border:`1px solid ${C.line}`, borderRadius:9, color:C.ink, fontSize:11, outline:'none' }} />
          </label>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:9, color:C.muted, fontWeight:900, textTransform:'uppercase', letterSpacing:'.5px' }}>Perfil no oGol</span>
            <input type="url" value={linkDraft.ogolUrl} onChange={event => setLinkDraft(current => ({ ...current, ogolUrl:event.target.value }))} placeholder="https://www.ogol.com.br/jogador/..." style={{ width:'100%', padding:'10px 11px', border:`1px solid ${C.line}`, borderRadius:9, color:C.ink, fontSize:11, outline:'none' }} />
          </label>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginTop:12, flexWrap:'wrap' }}>
          <p style={{ margin:0, color:C.muted, fontSize:9.5 }}>Cole o endereço completo. Campos vazios removem o respectivo atalho.</p>
          <Button onClick={saveLinks} disabled={savingLinks || !linksDirty}>{savingLinks ? 'Salvando...' : '💾 Salvar links'}</Button>
        </div>
        {linkMessage ? <div style={{ marginTop:10, padding:'8px 10px', borderRadius:8, background:linkMessage.type === 'success' ? '#eaf4fd' : '#fef2f2', color:linkMessage.type === 'success' ? '#166534' : '#b91c1c', fontSize:10, fontWeight:800 }}>{linkMessage.text}</div> : null}
      </> : <p style={{ margin:0, color:C.muted, fontSize:10.5 }}>Os atalhos podem ser consultados acima. A edição é restrita à equipe de scouting.</p>}
    </Panel>

    <Panel title="Faixa relativa na competição" subtitle="A classificação S–E é interna à liga, temporada, posição e perfil. Não representa equivalência automática com outra divisão." style={{ marginBottom:16 }} bodyStyle={{ padding:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(170px,1fr))', gap:10 }} className="scout-filter-grid">
        {[
          ['Faixa automática', payload.levels?.recommended, C.green, payload.levels?.criteria?.adjustedIndex],
          ['Faixa validada', payload.levels?.real, C.blue, null],
          ['Faixa efetiva', payload.levels?.current, payload.levels?.current?.source === 'analista' ? C.blue : C.green, payload.levels?.criteria?.adjustedIndex],
          ['Projeção interna', payload.levels?.potential, C.purple, payload.levels?.criteria?.projectionIndex],
        ].map(([label,level,tone,index]) => <div key={label} style={{ border:`1px solid ${tone}28`, background:`${tone}0b`, borderRadius:12, padding:13 }}><p style={{ color:C.muted, fontSize:8.5, fontWeight:900, textTransform:'uppercase' }}>{label}</p><strong style={{ display:'block', color:tone, fontSize:19, marginTop:5 }}>{level?.label || '—'}</strong>{Number.isFinite(Number(index)) && <p style={{ color:C.muted, fontSize:8.5, marginTop:3 }}>Índice relativo {Number(index).toFixed(1)}</p>}</div>)}
      </div>
      <div style={{ marginTop:9, border:`1px solid ${payload.levels?.recommendationType === 'estatístico' ? '#cce9d8' : '#fed7aa'}`, background:payload.levels?.recommendationType === 'estatístico' ? '#f3fbf6' : '#fff7ed', color:payload.levels?.recommendationType === 'estatístico' ? C.green : '#9a3412', borderRadius:9, padding:'8px 10px', fontSize:9, fontWeight:800 }}>
        {payload.levels?.recommendationType === 'estatístico' ? 'Faixa calculada pelos percentis do perfil e ajustada pela amostra.' : 'Faixa provisória aproximada da média do grupo por cobertura ou amostra limitada.'} Robustez: {payload.levels?.robustness?.label || '—'} · {payload.levels?.confidence || 0}/100.
      </div>
      {!!payload.levels?.profileBands?.length && <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:7, marginTop:10 }}>{payload.levels.profileBands.slice(0,4).map(item => <div key={item.profile} style={{ padding:'8px 9px', border:`1px solid ${C.line}`, borderRadius:9, background:'#fff' }}><strong style={{ color:C.ink, fontSize:9.5 }}>{item.profile}</strong><span style={{ float:'right', color:item.score >= 8 ? C.purple : item.score >= 6 ? C.green : C.muted, fontSize:10, fontWeight:950 }}>{item.label}</span><p style={{ color:C.muted, fontSize:7.8, marginTop:3 }}>Índice ajustado {Number(item.adjustedIndex || 0).toFixed(1)}</p></div>)}</div>}
    </Panel>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 11, marginBottom: 16 }}>
      <Kpi label="Minutos" value={number(player.minutos, 0)} sub={`${number(player.jogos, 0)} partidas`} icon="⏱️" />
      <Kpi label="Posição" value={player.posicao || '—'} sub={analysis.group || 'Grupo não identificado'} icon="🧭" tone={C.blue} />
      <Kpi label="Idade" value={player.idade || '—'} sub={player.pais || player.naturalidade || 'Nacionalidade não informada'} icon="📅" tone={C.purple} />
      <Kpi label="Pé preferido" value={playerFootLabel(player.pe)} sub={player.altura ? `${number(player.altura, 0)} cm` : 'Altura não informada'} icon="👟" tone={C.amber} />
      <Kpi label="Fit Confiança" value={analysis.scouting?.finalScore || 0} sub={analysis.scouting?.profile || 'Sem perfil'} icon="🟢" tone={C.green} />
    </div>

    <Panel title="Métricas centrais" subtitle={`Amostra de referência: ${analysis.minimumMinutes || 0} minutos · ${analysis.groupSize || 0} pares na liga`} style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 9 }}>
        {(analysis.centralStats || []).map(metric => <div key={metric.key} style={{ padding: 12, borderRadius: 11, border: `1px solid ${C.line}`, background: '#fbfdfb' }}>
          <p style={{ fontSize: 9.5, color: C.muted, fontWeight: 800 }}>{metric.label}</p>
          <strong style={{ display: 'block', color: C.ink, fontSize: 19, marginTop: 5 }}>{metricValue(metric)}</strong>
          <span style={{ fontSize: 8.5, color: metric.type === 'percent' ? C.blue : C.green, fontWeight: 900 }}>{metric.type === 'percent' ? '% EFICIÊNCIA' : metric.type === 'per90' ? 'POR 90' : metric.type === 'total' ? 'TOTAL' : 'ÍNDICE'}</span>
        </div>)}
      </div>
    </Panel>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, marginBottom: 16 }} className="scout-two-col">
      <RadarCard title="Radar posicional · mesma liga" subtitle={`Percentil entre ${analysis.groupSize || 0} jogadores do mesmo grupo; a referência roxa é a mediana.`} data={leagueRadar} candidateLabel={player.nome} comparisonLabel="Mediana da liga" />
      <RadarCard title="Radar de encaixe · elenco do Confiança" subtitle={`${analysis.clubGroupSize ?? analysis.clubGroupSize ?? 0} jogadores do Confiança no grupo; comparação em escala percentílica compartilhada.`} data={clubRadar} candidateLabel={player.nome} comparisonLabel="Média Confiança" />
    </div>

    <ProfileSummary scouting={analysis.scouting} source={analysis.source} />

    <Panel title="Leitura métrica detalhada" subtitle="A elegibilidade considera minutos e, quando aplicável, mínimo de tentativas." style={{ marginTop: 16 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        {(analysis.radar || []).map(item => <PercentileBar key={item.key} label={item.fullLabel || item.label} value={item.leaguePercentile || 0} raw={item.value === null || item.value === undefined ? item.reason || 'Sem dado' : number(item.value, item.type === 'percent' ? 1 : 2)} suffix={item.type === 'percent' ? '%' : ''} color={item.eligible ? C.green : C.muted} />)}
      </div>
      <p style={{ marginTop: 16, fontSize: 10, color: C.muted, lineHeight: 1.55 }}>Metodologia: {analysis.methodology}</p>
    </Panel>
  </ScoutingPage>
}
