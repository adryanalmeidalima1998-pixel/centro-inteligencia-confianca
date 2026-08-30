'use client'

import { useMemo, useState } from 'react'
import { Button, C, Field, Panel, inputStyle } from '@/app/components/scouting/ScoutingUI'
import { buildScoutDataCorrelation } from '@/app/lib/scouting/scoutDataCorrelation'

const SOURCE_OPTIONS = [
  ['video', 'Vídeo · jogos completos'],
  ['in_loco', 'Observação in loco'],
  ['mixed', 'Vídeo + in loco'],
]

export function emptyQualitative() {
  return {
    version:2,
    primarySource:'video',
    sources:{ data:true, video:true, inLoco:false, reference:false, interview:false },
    scoutReport:'',
    correlation:null,
    // Compatibilidade com avaliações antigas.
    scoutSummary:'',
    convergence:'',
    dimensions:{},
  }
}

function normalizedValue(value) {
  const base = emptyQualitative()
  const source = value?.primarySource || (value?.sources?.inLoco && value?.sources?.video ? 'mixed' : value?.sources?.inLoco ? 'in_loco' : 'video')
  const scoutReport = value?.scoutReport || value?.scoutSummary || ''
  return {
    ...base,
    ...(value || {}),
    version:2,
    primarySource:source,
    scoutReport,
    sources:{ ...base.sources, ...(value?.sources || {}), data:true },
    correlation:value?.correlation || null,
    dimensions:{ ...(value?.dimensions || {}) },
  }
}

function sourceFlags(source, previous = {}) {
  return {
    ...previous,
    data:true,
    video:source === 'video' || source === 'mixed',
    inLoco:source === 'in_loco' || source === 'mixed',
  }
}

function statusTone(item) {
  if (item.classification === 'converge') return '#15803d'
  if (item.classification === 'indirect') return '#0f766e'
  if (item.classification === 'partial') return '#b7791f'
  if (item.classification === 'diverge') return '#b45309'
  return '#7c3aed'
}

function EvidenceCard({ item }) {
  const tone = statusTone(item)
  return <div style={{ padding:'11px 12px', borderRadius:11, border:`1px solid ${tone}2d`, background:`${tone}08` }}>
    <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'start', flexWrap:'wrap' }}>
      <div>
        <span style={{ display:'inline-flex', fontSize:8, fontWeight:950, color:tone, background:`${tone}12`, borderRadius:99, padding:'3px 7px' }}>{item.classificationLabel}</span>
        <strong style={{ display:'block', marginTop:6, fontSize:10.5, color:C.ink }}>{item.title}</strong>
        <span style={{ display:'block', marginTop:2, fontSize:8.5, color:C.muted }}>{item.category}</span>
      </div>
      {item.dataPercentile != null && <span style={{ fontSize:10, fontWeight:950, color:tone }}>P{item.dataPercentile}</span>}
    </div>
    <div style={{ marginTop:9 }}>
      <p style={{ fontSize:8, fontWeight:950, color:C.muted, textTransform:'uppercase', letterSpacing:'.45px' }}>Observação do scout</p>
      <p style={{ fontSize:9.4, color:C.ink, lineHeight:1.5, marginTop:3 }}>{item.observation}</p>
    </div>
    <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${tone}20` }}>
      <p style={{ fontSize:8, fontWeight:950, color:C.muted, textTransform:'uppercase', letterSpacing:'.45px' }}>Evidência quantitativa</p>
      <p style={{ fontSize:8.9, color:C.muted, lineHeight:1.5, marginTop:3 }}>{item.dataText}</p>
    </div>
    <div style={{ marginTop:8, padding:'8px 9px', borderRadius:8, background:'#fff', border:`1px solid ${C.line}` }}>
      <p style={{ fontSize:8, fontWeight:950, color:tone, textTransform:'uppercase', letterSpacing:'.45px' }}>Leitura integrada</p>
      <p style={{ fontSize:9, color:C.muted, lineHeight:1.5, marginTop:3 }}>{item.reading}</p>
    </div>
  </div>
}

function CorrelationOverview({ correlation }) {
  if (!correlation) return null
  const tone = correlation.score == null ? C.purple : correlation.score >= 75 ? '#15803d' : correlation.score >= 55 ? '#0f766e' : correlation.score >= 35 ? '#b7791f' : '#b45309'
  return <div style={{ display:'grid', gap:10 }}>
    <div className="cig-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:8 }}>
      {[
        ['Convergência', correlation.score == null ? '—' : `${correlation.score}%`, correlation.label],
        ['Comparáveis', correlation.comparableCount || 0, 'observações com dado relacionado'],
        ['Convergências', correlation.convergenceCount || 0, 'diretas ou com suporte indireto'],
        ['Exclusivas do scout', correlation.exclusiveCount || 0, 'sem métrica direta disponível'],
      ].map(([label,value,sub],i)=><div key={label} style={{ padding:'10px 11px', borderRadius:10, border:`1px solid ${i===0?tone+'35':C.line}`, background:i===0?`${tone}08`:'#fff' }}><p style={{ fontSize:8.2, color:C.muted, fontWeight:900, textTransform:'uppercase' }}>{label}</p><strong style={{ display:'block', fontSize:17, color:i===0?tone:C.ink, marginTop:4 }}>{value}</strong><p style={{ fontSize:8.3, color:C.muted, marginTop:2, lineHeight:1.35 }}>{sub}</p></div>)}
    </div>
    <div style={{ padding:'9px 10px', borderRadius:9, border:`1px solid ${C.line}`, background:'#f8fbf9' }}>
      <p style={{ fontSize:8.8, color:C.muted, lineHeight:1.5 }}>{correlation.note}</p>
    </div>
  </div>
}

export default function QualitativeValidation({ evaluationId, value, onChange, analysis, onSaved }) {
  const qualitative = useMemo(() => normalizedValue(value), [value])
  const [saving,setSaving] = useState(false)
  const [message,setMessage] = useState('')

  function patch(next) {
    onChange?.(normalizedValue(next))
    setMessage('')
  }

  function setSource(source) {
    patch({ ...qualitative, primarySource:source, sources:sourceFlags(source, qualitative.sources) })
  }

  function updateReport(text) {
    patch({ ...qualitative, scoutReport:text, correlation:null })
  }

  function correlate() {
    const report = qualitative.scoutReport.trim()
    if (!report) return setMessage('Digite o parecer do scout antes de cruzar com os dados.')
    const correlation = buildScoutDataCorrelation(report, analysis)
    patch({ ...qualitative, correlation })
    setMessage(correlation?.items?.length ? 'Cruzamento gerado. Revise as evidências e salve no atleta.' : 'O parecer foi salvo em memória, mas não foram encontrados conceitos suficientes para o cruzamento automático.')
  }

  async function save() {
    if (!evaluationId) return setMessage('Salve a avaliação quantitativa antes de registrar o parecer do scout.')
    if (!qualitative.scoutReport.trim()) return setMessage('Digite o parecer do scout antes de salvar.')
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/avaliacao-atleta', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ id:evaluationId, qualitative }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a análise integrada.')
      patch(data.qualitative)
      setMessage('Parecer e cruzamento Scout × Dados salvos no atleta.')
      onSaved?.(data.qualitative)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const correlation = qualitative.correlation
  const convergences = correlation?.items?.filter(i=>['converge','indirect'].includes(i.classification)) || []
  const contextual = correlation?.items?.filter(i=>['partial','diverge'].includes(i.classification)) || []
  const exclusive = correlation?.items?.filter(i=>i.classification === 'exclusive') || []

  return <div style={{ display:'grid', gap:14 }}>
    <Panel title="Parecer do Scout" subtitle="Escreva a leitura livre exatamente como você registraria em um relatório de scouting. O texto original é preservado e entra no PDF.">
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 210px', gap:12, alignItems:'start' }} className="scout-two-col">
        <Field label="Observação do atleta">
          <textarea
            value={qualitative.scoutReport}
            onChange={e=>updateReport(e.target.value)}
            placeholder="Ex.: ATLETA OBSERVADO RECENTEMENTE EXERCENDO A FUNÇÃO DE CAMISA 5..."
            style={{ ...inputStyle, minHeight:250, resize:'vertical', lineHeight:1.62, fontSize:11.2, textTransform:'uppercase' }}
          />
        </Field>
        <div style={{ display:'grid', gap:10 }}>
          <Field label="Fonte principal">
            <select value={qualitative.primarySource} onChange={e=>setSource(e.target.value)} style={inputStyle}>{SOURCE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <div style={{ padding:'10px 11px', borderRadius:10, background:C.green2, border:`1px solid ${C.green3}` }}>
            <p style={{ fontSize:8.5, fontWeight:950, color:C.green, textTransform:'uppercase' }}>Como funciona</p>
            <p style={{ fontSize:9.2, color:'#355742', lineHeight:1.5, marginTop:5 }}>A plataforma identifica evidências no seu texto e as cruza apenas com métricas relacionadas. O que não é mensurável permanece como evidência exclusiva do scout.</p>
          </div>
          <Button variant="soft" onClick={correlate}>↔ Cruzar observação com dados</Button>
          <Button onClick={save} disabled={saving || !evaluationId}>{saving?'Salvando…':'Salvar análise integrada'}</Button>
          {message && <p aria-live="polite" style={{ fontSize:9.2, lineHeight:1.45, color:message.includes('salv')?C.green:'#b45309' }}>{message}</p>}
        </div>
      </div>
    </Panel>

    {correlation && <>
      <Panel title="Convergência · Scout × Dados" subtitle="Índice de alinhamento das observações que possuem correspondência quantitativa. Não é uma nota do atleta nem correlação estatística.">
        <CorrelationOverview correlation={correlation}/>
      </Panel>

      <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel title="Convergências" subtitle="Comportamentos observados que encontram suporte direto ou indireto nos dados.">
          {convergences.length ? <div style={{ display:'grid', gap:8 }}>{convergences.map(item=><EvidenceCard key={item.id} item={item}/>)}</div> : <p style={{ fontSize:10, color:C.muted }}>Nenhuma convergência foi identificada automaticamente.</p>}
        </Panel>
        <Panel title="Divergências e contextualizações" subtitle="Pontos em que os dados são neutros, mistos ou caminham em direção diferente da observação.">
          {contextual.length ? <div style={{ display:'grid', gap:8 }}>{contextual.map(item=><EvidenceCard key={item.id} item={item}/>)}</div> : <p style={{ fontSize:10, color:C.muted }}>Nenhuma divergência relevante foi identificada.</p>}
        </Panel>
      </div>

      <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'.8fr 1.2fr', gap:14 }}>
        <Panel title="Evidências exclusivas do Scout" subtitle="Aspectos importantes da observação sem uma métrica direta suficiente na base iScout.">
          {exclusive.length ? <div style={{ display:'grid', gap:8 }}>{exclusive.map(item=><EvidenceCard key={item.id} item={item}/>)}</div> : <p style={{ fontSize:10, color:C.muted }}>Todas as evidências detectadas possuem algum indicador relacionado.</p>}
        </Panel>
        <Panel title="Síntese Integrada CIC" subtitle="Conclusão construída a partir do cruzamento entre o parecer original e os benchmarks quantitativos.">
          <div style={{ padding:'13px 14px', borderRadius:12, background:C.green2, border:`1px solid ${C.green3}` }}>
            <p style={{ fontSize:10.5, color:'#294d36', lineHeight:1.65, fontWeight:650 }}>{correlation.integratedSummary}</p>
          </div>
        </Panel>
      </div>
    </>}
  </div>
}
