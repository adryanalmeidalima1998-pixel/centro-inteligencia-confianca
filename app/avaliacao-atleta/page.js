'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import PizzaPlot from '@/app/components/scouting/PizzaPlot'
import QualitativeValidation, { emptyQualitative } from '@/app/components/scouting/QualitativeValidation'
import {
  Button, C, EmptyState, Field, Kpi, LoadingState, PageHeader, Panel, ScoutingPage,
  ScoreBadge, StatusDot, Tabs, inputStyle,
} from '@/app/components/scouting/ScoutingUI'
import { POSITION_OPTIONS, formatMetricValue, positionLabel } from '@/data/iscout-analysis'

const TAB_ITEMS = [
  { id:'resumo', label:'Visão geral', icon:'◉' },
  { id:'comparacao', label:'Comparação', icon:'↔' },
  { id:'metricas', label:'Métricas', icon:'▦' },
  { id:'validacao', label:'Scout × Dados', icon:'↔' },
  { id:'partidas', label:'Partidas', icon:'◷' },
]

const FOOT = ['','Direito','Esquerdo','Ambidestro']

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(`${String(value).slice(0,10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR')
}

function scoreTone(score) {
  if (score >= 80) return '#15803d'
  if (score >= 65) return '#0f766e'
  if (score >= 50) return '#c47b09'
  return '#c53a32'
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler a foto do atleta.'))
    reader.readAsDataURL(file)
  })
}

function ComparisonTable({ metrics }) {
  return (
    <div className="scout-scroll" style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:920, borderCollapse:'collapse' }}>
        <thead><tr style={{ background:'#f8fbf9' }}>
          {['Métrica','Atleta','Média Confiança','P Confiança','Média Série C','P Série C','Leitura'].map(h => <th key={h} style={{ padding:'10px 11px', textAlign:h==='Métrica'||h==='Leitura'?'left':'center', fontSize:9, textTransform:'uppercase', letterSpacing:'.5px', color:C.muted, borderBottom:`1px solid ${C.line}` }}>{h}</th>)}
        </tr></thead>
        <tbody>{metrics.map((m,i) => {
          const p = m.percentileSerieC ?? m.percentileGuarani ?? 0
          const tone = scoreTone(p)
          return <tr key={m.key} style={{ background:i%2?'#fbfdfb':'#fff', borderBottom:`1px solid ${C.line}` }}>
            <td style={{ padding:'10px 11px', fontSize:10.5, fontWeight:800, color:C.ink }}>{m.label}{m.priority && <span style={{ marginLeft:7, fontSize:8, color:C.green, background:C.green2, borderRadius:99, padding:'2px 6px' }}>PRIORIDADE ADC</span>}</td>
            <td style={{ padding:'10px 11px', textAlign:'center', fontSize:11, fontWeight:900, color:C.ink }}>{formatMetricValue(m.value,m.format)}</td>
            <td style={{ padding:'10px 11px', textAlign:'center', fontSize:10.5, color:C.muted }}>{formatMetricValue(m.avgGuarani,m.format)}</td>
            <td style={{ padding:'10px 11px', textAlign:'center' }}>{m.percentileGuarani!=null?<ScoreBadge value={m.percentileGuarani} />:'—'}</td>
            <td style={{ padding:'10px 11px', textAlign:'center', fontSize:10.5, color:C.muted }}>{formatMetricValue(m.avgSerieC,m.format)}</td>
            <td style={{ padding:'10px 11px', textAlign:'center' }}>{m.percentileSerieC!=null?<ScoreBadge value={m.percentileSerieC} />:'—'}</td>
            <td style={{ padding:'10px 11px', fontSize:9.5, color:tone, fontWeight:800 }}>{p>=75?'FORTE':p>=55?'COMPETITIVO':p>=35?'ATENÇÃO':'FRÁGIL'}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  )
}

function BenchmarkChart({ metrics }) {
  const data = metrics.filter(m => m.percentileSerieC != null || m.percentileGuarani != null).slice(0,10).map(m => ({
    label:m.label.length>21?`${m.label.slice(0,20)}…`:m.label,
    'Série C':m.percentileSerieC,
    'Confiança':m.percentileGuarani,
  }))
  if (!data.length) return <EmptyState title="Benchmark indisponível" text="Carregue a base da Série C e o elenco do Confiança para habilitar a comparação." />
  return <div style={{ width:'100%', height:420 }}><ResponsiveContainer>
    <BarChart data={data} layout="vertical" margin={{ top:5, right:22, bottom:5, left:26 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e8f0eb" horizontal={false} />
      <XAxis type="number" domain={[0,100]} tick={{ fontSize:9, fill:'#789083' }} />
      <YAxis type="category" dataKey="label" width={145} tick={{ fontSize:9, fill:'#3c5947' }} />
      <Tooltip contentStyle={{ borderRadius:10, border:'1px solid #dfece4', fontSize:11 }} formatter={v => v==null?'—':`P${Math.round(v)}`} />
      <Legend wrapperStyle={{ fontSize:10 }} />
      <Bar dataKey="Série C" fill="#0a66b7" radius={[0,4,4,0]} />
      <Bar dataKey="Confiança" fill="#7aa98a" radius={[0,4,4,0]} />
    </BarChart>
  </ResponsiveContainer></div>
}

function InsightList({ items, type }) {
  const good = type === 'strength'
  const tone = good ? '#15803d' : '#b45309'
  return <div style={{ display:'grid', gap:9 }}>{items.map((item,index) => <div key={item.key} style={{ padding:'11px 12px', borderRadius:11, background:`${tone}08`, border:`1px solid ${tone}20` }}>
    <div style={{ display:'flex', alignItems:'start', justifyContent:'space-between', gap:10 }}>
      <div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:8, fontWeight:950, color:tone, background:`${tone}12`, borderRadius:99, padding:'2px 6px' }}>{item.evidence || 'DADO SUGERE'}</span>
          <span style={{ fontSize:8, fontWeight:850, color:C.muted }}>{item.category || 'SCOUTING'}</span>
          {item.relative && <span style={{ fontSize:7.8, color:C.muted }}>LEITURA RELATIVA</span>}
        </div>
        <strong style={{ display:'block', marginTop:5, fontSize:10.5, color:C.ink }}>{index+1}. {item.title || item.label}</strong>
        <p style={{ fontSize:8.7, color:C.muted, marginTop:2 }}>{item.label}</p>
      </div>
      <span style={{ fontSize:9.5, fontWeight:900, color:tone, whiteSpace:'nowrap' }}>P{item.percentile}</span>
    </div>
    <p style={{ fontSize:9.8, color:C.muted, lineHeight:1.55, marginTop:7 }}>{item.text}</p>
  </div>)}</div>
}

function SquadDifferentials({ metrics = [] }) {
  const available = metrics.filter(m => m.percentileGuarani != null)
  const top = [...available].sort((a,b)=>b.percentileGuarani-a.percentileGuarani).slice(0,4)
  const attention = [...available].sort((a,b)=>a.percentileGuarani-b.percentileGuarani).slice(0,2)
  if (!available.length) return <EmptyState title="Sem benchmark do elenco" text="A comparação depende de jogadores do Confiança na mesma função com dados suficientes." />
  return <div style={{ display:'grid', gap:12 }}>
    <div>
      <p style={{ fontSize:8.5, fontWeight:950, color:C.green, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:7 }}>Diferenciais relativos no elenco</p>
      <div style={{ display:'grid', gap:6 }}>{top.map((m,i)=><div key={m.key} style={{ display:'grid', gridTemplateColumns:'24px 1fr auto', gap:8, alignItems:'center', padding:'8px 9px', border:`1px solid ${C.line}`, borderRadius:9, background:i===0?C.green2:'#fff' }}>
        <span style={{ width:22, height:22, borderRadius:'50%', display:'grid', placeItems:'center', background:i===0?C.green:'#edf4ef', color:i===0?'#fff':C.green, fontSize:8.5, fontWeight:950 }}>{i+1}</span>
        <div><strong style={{ display:'block', fontSize:9.8, color:C.ink }}>{m.label}</strong><span style={{ fontSize:8.5, color:C.muted }}>{m.priority?'Prioridade do modelo atual':'Comparação posicional'}</span></div>
        <ScoreBadge value={m.percentileGuarani} />
      </div>)}</div>
    </div>
    <div style={{ paddingTop:9, borderTop:`1px solid ${C.line}` }}>
      <p style={{ fontSize:8.5, fontWeight:950, color:'#b45309', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:7 }}>Onde encontra maior concorrência</p>
      <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>{attention.map(m=><span key={m.key} style={{ fontSize:8.8, color:'#8a5b11', padding:'5px 7px', borderRadius:8, border:'1px solid #f3d7a6', background:'#fffaf0' }}>{m.label} · P{Math.round(m.percentileGuarani)}</span>)}</div>
    </div>
  </div>
}

function cleanSummary(value) {
  return String(value || '')
    .replace(/Esta é uma leitura orientada por dados, não uma confirmação comportamental\.\s*A validação em vídeo deve priorizar comportamento sem bola, tomada de decisão sob pressão, aderência à função e os itens do roteiro de observação\.\s*/i, 'A leitura deve ser interpretada junto ao contexto competitivo, ao modelo da equipe e à função exercida. ')
}

function SavedList({ items, onOpen, activeId, archived = false, onArchive, onDelete }) {
  if (!items.length) return <p style={{ fontSize:10.5, color:C.muted, padding:'12px 2px' }}>{archived ? 'Nenhuma avaliação arquivada.' : 'Nenhuma avaliação ativa ainda.'}</p>
  return <div style={{ display:'grid', gap:7, maxHeight:310, overflowY:'auto', paddingRight:3 }}>{items.map(item => <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'stretch', gap:6, border:`1px solid ${activeId===item.id?C.green:C.line}`, background:activeId===item.id?C.green2:'#fff', borderRadius:10, padding:'7px 7px 7px 9px' }}>
    <button onClick={()=>onOpen(item.id)} style={{ minWidth:0, textAlign:'left', border:'none', background:'transparent', padding:'2px 0', cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><strong style={{ fontSize:10.5, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.nome}</strong><span style={{ fontSize:9, fontWeight:900, color:scoreTone(Number(item.fit_score)||0), flexShrink:0 }}>{item.fit_score?`${item.fit_score}`:'—'}</span></div>
      <p style={{ fontSize:9, color:C.muted, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.equipa||'—'} · {positionLabel(item.posicao)} · {fmtDate(archived ? item.archived_at : item.created_at)}</p>
    </button>
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      <button onClick={()=>onArchive(item.id)} title={archived?'Restaurar atleta':'Arquivar atleta'} style={{ height:28, borderRadius:8, border:`1px solid ${archived?C.green3:C.line}`, background:archived?C.green2:'#f8fbf9', color:archived?C.green:C.muted, cursor:'pointer', fontSize:8.3, fontWeight:900, padding:'0 7px' }}>{archived?'RESTAURAR':'ARQUIVAR'}</button>
      <button onClick={()=>onDelete(item.id,item.nome)} title="Excluir permanentemente" style={{ height:28, borderRadius:8, border:'1px solid #f2c8c3', background:'#fff7f6', color:C.red, cursor:'pointer', fontSize:8.3, fontWeight:900, padding:'0 7px' }}>EXCLUIR</button>
    </div>
  </div>)}</div>
}

export default function AvaliacaoAtletaPage() {
  const [form,setForm] = useState({ nome:'',equipa:'',posicao:'',idade:'',pe:'',nacionalidade:'',liga:'' })
  const [file,setFile] = useState(null)
  const [photoFile,setPhotoFile] = useState(null)
  const [photoPreview,setPhotoPreview] = useState('')
  const [analysis,setAnalysis] = useState(null)
  const [activeId,setActiveId] = useState(null)
  const [saved,setSaved] = useState([])
  const [savedView,setSavedView] = useState('active')
  const [qualitative,setQualitative] = useState(emptyQualitative())
  const [loading,setLoading] = useState(false)
  const [loadingSaved,setLoadingSaved] = useState(true)
  const [exportingPdf,setExportingPdf] = useState(false)
  const [error,setError] = useState('')
  const [tab,setTab] = useState('resumo')
  const fileRef = useRef(null)
  const photoRef = useRef(null)

  const update = (key,value) => setForm(prev=>({ ...prev,[key]:value }))

  async function refreshSaved(view = savedView) {
    setLoadingSaved(true)
    try {
      const suffix = view === 'archived' ? '?archived=1' : ''
      const data = await fetch(`/api/avaliacao-atleta${suffix}`).then(r=>r.json())
      setSaved(data.items || [])
    } finally { setLoadingSaved(false) }
  }

  useEffect(()=>{ refreshSaved(savedView) },[savedView])

  async function changeArchiveState(id) {
    const archived = savedView === 'archived'
    setError('')
    try {
      const response = await fetch('/api/avaliacao-atleta', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ id, action:archived?'unarchive':'archive' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o status da avaliação.')
      if (Number(activeId) === Number(id)) clearForm()
      await refreshSaved(savedView)
    } catch (e) { setError(e.message) }
  }

  async function deleteEvaluation(id, name) {
    const confirmed = window.confirm(`Excluir permanentemente a avaliação de ${name || 'este atleta'}? Esta ação não pode ser desfeita.`)
    if (!confirmed) return
    setError('')
    try {
      const response = await fetch(`/api/avaliacao-atleta?id=${id}`, { method:'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir a avaliação.')
      if (Number(activeId) === Number(id)) clearForm()
      await refreshSaved(savedView)
    } catch (e) { setError(e.message) }
  }

  async function handlePhotoChange(event) {
    const selected = event.target.files?.[0] || null
    setError('')
    setPhotoFile(selected)
    if (!selected) return
    if (!selected.type?.startsWith('image/')) {
      setError('A foto do atleta deve ser um arquivo de imagem.')
      setPhotoFile(null)
      if (photoRef.current) photoRef.current.value = ''
      return
    }
    if (Number(selected.size || 0) > 8 * 1024 * 1024) {
      setError('A foto do atleta deve ter no máximo 8 MB.')
      setPhotoFile(null)
      if (photoRef.current) photoRef.current.value = ''
      return
    }
    try {
      setPhotoPreview(await readFileAsDataUrl(selected))
      if (activeId) {
        const fd = new FormData()
        fd.append('id', String(activeId))
        fd.append('photo', selected)
        const response = await fetch('/api/avaliacao-atleta', { method:'PUT', body:fd })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao salvar a foto.')
        setPhotoPreview(data.photo_data_url || '')
        setPhotoFile(null)
        if (photoRef.current) photoRef.current.value = ''
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function analyze() {
    if (!form.nome.trim()) return setError('Informe o nome do atleta.')
    if (!file) return setError('Selecione a planilha iScout do atleta.')
    setError(''); setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v])=>fd.append(k,v))
      fd.append('file',file)
      if (photoFile) fd.append('photo',photoFile)
      const response = await fetch('/api/avaliacao-atleta',{ method:'POST', body:fd })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao analisar atleta.')
      setAnalysis(data.analysis)
      setQualitative(emptyQualitative())
      setActiveId(data.id)
      setPhotoPreview(data.photo_data_url || photoPreview || '')
      setPhotoFile(null)
      if (photoRef.current) photoRef.current.value = ''
      setTab('resumo')
      if (!form.equipa && data.analysis?.player?.equipa) update('equipa',data.analysis.player.equipa)
      if (!form.posicao && data.analysis?.player?.posicao) update('posicao',data.analysis.player.posicao)
      if (!form.liga && data.analysis?.context?.competition) update('liga',data.analysis.context.competition)
      setSavedView('active')
      await refreshSaved('active')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function openSaved(id) {
    setError(''); setLoading(true)
    try {
      const response = await fetch(`/api/avaliacao-atleta?id=${id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao abrir avaliação.')
      setAnalysis(data.analysis_json)
      setQualitative(data.qualitative_json || emptyQualitative())
      setPhotoPreview(data.photo_data_url || '')
      setPhotoFile(null)
      if (photoRef.current) photoRef.current.value = ''
      setActiveId(id)
      setForm({
        nome:data.nome||'', equipa:data.equipa||'', posicao:data.posicao||'', idade:data.idade||'', pe:data.pe||'', nacionalidade:data.nacionalidade||'', liga:data.liga||'',
      })
      setTab('resumo')
      await refreshSaved(savedView)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  function clearForm() {
    setForm({ nome:'',equipa:'',posicao:'',idade:'',pe:'',nacionalidade:'',liga:'' })
    setFile(null)
    setPhotoFile(null)
    setPhotoPreview('')
    setAnalysis(null)
    setQualitative(emptyQualitative())
    setActiveId(null)
    setError('')
    setTab('resumo')
    if (fileRef.current) fileRef.current.value=''
    if (photoRef.current) photoRef.current.value=''
  }

  async function exportPdf() {
    if (!analysis) return
    setError('')
    setExportingPdf(true)
    try {
      const { exportAvaliacaoAtletaPdf } = await import('@/app/lib/scouting/avaliacaoAtletaPdf')
      let qualitativeForPdf = qualitative
      if (qualitative?.scoutReport?.trim() && !qualitative?.correlation) {
        const { buildScoutDataCorrelation } = await import('@/app/lib/scouting/scoutDataCorrelation')
        qualitativeForPdf = { ...qualitative, correlation:buildScoutDataCorrelation(qualitative.scoutReport, analysis) }
      }
      await exportAvaliacaoAtletaPdf({
        analysis:{ ...analysis, guaraniScore, summary:cleanSummary(analysis.summary) },
        qualitative:qualitativeForPdf,
        photoDataUrl:photoPreview || null,
      })
    } catch (e) {
      setError(e.message || 'Erro ao gerar o PDF.')
    } finally {
      setExportingPdf(false)
    }
  }

  const topPizzaMetrics = useMemo(() => analysis?.metrics?.filter(m=>m.percentileSerieC!=null).slice(0,10) || [], [analysis])
  const topGuaraniPizzaMetrics = useMemo(() => analysis?.metrics?.filter(m=>m.percentileGuarani!=null).slice(0,10) || [], [analysis])
  const guaraniScore = useMemo(() => {
    if (analysis?.guaraniScore != null) return analysis.guaraniScore
    const values = analysis?.metrics?.map(m=>m.percentileGuarani).filter(v=>v!=null) || []
    return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0
  }, [analysis])

  return <ScoutingPage maxWidth={1520}>
    <PageHeader
      title="Avaliação de Atleta · iScout"
      subtitle="Cadastre o atleta, importe a planilha por jogo e obtenha encaixe com o Confiança, benchmarks, pizza plots contra Série C e elenco do Confiança, leitura CIC e triangulação entre o parecer do scout e os dados."
      status={<StatusDot>{analysis ? analysis.fitLabel : 'iScout → CIC'}</StatusDot>}
      actions={<>
        {analysis && <Button variant="dark" onClick={exportPdf} disabled={exportingPdf}>{exportingPdf ? 'Gerando PDF…' : '📄 Exportar PDF'}</Button>}
        <Button variant="secondary" onClick={clearForm}>＋ Nova avaliação</Button>
      </>}
    />

    <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(260px,.8fr)', gap:14, alignItems:'start' }}>
      <Panel title="Cadastro, arquivo e foto" subtitle="O nome é obrigatório. A competição informada filtra as partidas da planilha; se ficar vazia, a CIC usa a competição com mais minutos no arquivo. A foto é opcional e entra no PDF.">
        <div className="cig-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10 }}>
          <Field label="Nome do atleta"><input value={form.nome} onChange={e=>update('nome',e.target.value)} placeholder="Ex.: Maicom David" style={inputStyle}/></Field>
          <Field label="Equipe"><input value={form.equipa} onChange={e=>update('equipa',e.target.value)} placeholder="Pode deixar em branco" style={inputStyle}/></Field>
          <Field label="Posição"><select value={form.posicao} onChange={e=>update('posicao',e.target.value)} style={inputStyle}><option value="">Inferir do arquivo</option>{POSITION_OPTIONS.map(([code,label])=><option key={code} value={code}>{label} · {code}</option>)}</select></Field>
          <Field label="Idade"><input type="number" min="15" max="45" value={form.idade} onChange={e=>update('idade',e.target.value)} placeholder="—" style={inputStyle}/></Field>
          <Field label="Pé"><select value={form.pe} onChange={e=>update('pe',e.target.value)} style={inputStyle}>{FOOT.map(v=><option key={v} value={v}>{v||'Não informado'}</option>)}</select></Field>
          <Field label="Nacionalidade"><input value={form.nacionalidade} onChange={e=>update('nacionalidade',e.target.value)} placeholder="—" style={inputStyle}/></Field>
          <Field label="Competição da análise"><input value={form.liga} onChange={e=>update('liga',e.target.value)} placeholder="Ex.: Série B · vazio = principal do arquivo" style={inputStyle}/></Field>
          <Field label="Planilha iScout"><input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)} style={{ ...inputStyle, padding:'7px 8px' }}/></Field>
        </div>

        <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 160px', gap:12, marginTop:12, alignItems:'start' }}>
          <div>
            <Field label="Foto do atleta (opcional)">
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ ...inputStyle, padding:'7px 8px' }} />
            </Field>
            <p style={{ marginTop:8, fontSize:9.5, color:C.muted }}>A foto aparece na página como referência visual e é inserida automaticamente no PDF exportado.</p>
          </div>
          <div style={{ height:176, border:`1px dashed ${C.green3}`, borderRadius:14, background:'#fbfdfb', padding:10, display:'grid', placeItems:'center' }}>
            {photoPreview ? <img src={photoPreview} alt="Foto do atleta" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} /> : <div style={{ textAlign:'center' }}><div style={{ fontSize:26 }}>👤</div><p style={{ marginTop:7, fontSize:10, color:C.muted, lineHeight:1.45 }}>Espaço da foto do atleta</p></div>}
          </div>
        </div>

        {error && <div style={{ marginTop:12, border:'1px solid #fecaca', background:'#fff7f7', color:'#b91c1c', borderRadius:10, padding:'9px 11px', fontSize:10.5 }}>{error}</div>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:14, flexWrap:'wrap' }}>
          <p style={{ fontSize:9.5, color:C.muted }}>{file ? `${file.name} selecionado` : 'Aceita o export por jogo no padrão PlayerStats.'}</p>
          <Button onClick={analyze} disabled={loading}>{loading?'Analisando…':'Analisar e salvar atleta'}</Button>
        </div>
      </Panel>

      <Panel title="Avaliações" subtitle="Gerencie avaliações ativas e atletas arquivados.">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:4, border:`1px solid ${C.line}`, background:'#f8fbf9', borderRadius:10, marginBottom:10 }}>
          <button onClick={()=>setSavedView('active')} style={{ border:'none', borderRadius:7, padding:'7px 8px', cursor:'pointer', background:savedView==='active'?C.green:'#fff', color:savedView==='active'?'#fff':C.muted, fontSize:9.5, fontWeight:900 }}>ATIVOS</button>
          <button onClick={()=>setSavedView('archived')} style={{ border:'none', borderRadius:7, padding:'7px 8px', cursor:'pointer', background:savedView==='archived'?C.ink:'#fff', color:savedView==='archived'?'#fff':C.muted, fontSize:9.5, fontWeight:900 }}>ARQUIVADOS</button>
        </div>
        {loadingSaved ? <LoadingState text={savedView==='archived'?'Carregando arquivados…':'Carregando avaliações…'}/> : <SavedList items={saved} onOpen={openSaved} activeId={activeId} archived={savedView==='archived'} onArchive={changeArchiveState} onDelete={deleteEvaluation}/>} 
      </Panel>
    </div>

    {loading && !analysis && <div style={{ marginTop:14 }}><Panel><LoadingState text="Consolidando partidas, cruzando Série C e elenco do Confiança…"/></Panel></div>}

    {!analysis && !loading && <div style={{ marginTop:14 }}><Panel><EmptyState icon="📊" title="Cadastre um atleta para iniciar" text="A análise consolida os jogos por 90, calcula percentis por posição, compara com o elenco e com a Série C, gera leitura de scouting contextualizada e permite exportar o PDF final com escudo do Confiança e foto do atleta." /></Panel></div>}

    {analysis && <>
      {analysis.context?.requiresReimport && <div style={{ marginTop:14, padding:'11px 13px', borderRadius:11, border:'1px solid #f3d7a6', background:'#fffaf0', color:'#8a5b11', fontSize:10.5, lineHeight:1.5 }}><strong>REIMPORTAÇÃO NECESSÁRIA:</strong> {analysis.context.reimportReason}</div>}
      <div className="cig-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11, marginTop:14 }}>
        <Kpi label="Fit Confiança" value={analysis.fitScore} sub={analysis.fitLabel} icon="🟢" tone={scoreTone(analysis.fitScore)}/>
        <Kpi label="Nível Série C" value={analysis.serieCScore} sub={analysis.serieCLevel} icon="🏆" tone={scoreTone(analysis.serieCScore)}/>
        <Kpi label="Amostra" value={`${Math.round(analysis.player.minutos||0)} min`} sub={`${analysis.player.jogos||0}${analysis.context?.fileGames && analysis.context.fileGames!==analysis.player.jogos?` de ${analysis.context.fileGames}`:''} jogos · confiança ${analysis.sample?.label||'—'}`} icon="⏱" tone={C.blue}/>
        <Kpi label="Perfil IAP" value={analysis.profile?.name||analysis.groupLabel} sub={analysis.profile?`${analysis.profile.score} pts · cobertura ${analysis.profile.coverage}%`:'Perfil estatístico da função'} icon="🧩" tone={C.purple}/>
      </div>

      <div style={{ marginTop:14 }}><Tabs items={TAB_ITEMS} active={tab} onChange={setTab}/></div>

      {tab==='resumo' && <div style={{ display:'grid', gap:14, marginTop:14 }}>
        <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Panel title="Pizza Plot · Série C" subtitle={`Percentis contra ${analysis.pool?.serieC||0} atletas da Série C na mesma função.`}>
            <PizzaPlot metrics={topPizzaMetrics} score={analysis.serieCScore} title="SÉRIE C" percentileKey="percentileSerieC" />
          </Panel>
          <Panel title="Pizza Plot · Confiança" subtitle={`Percentis contra ${analysis.pool?.guarani||0} jogadores do Confiança na mesma função.`}>
            <PizzaPlot metrics={topGuaraniPizzaMetrics} score={guaraniScore} title="CONFIANÇA" percentileKey="percentileGuarani" emptyText="Elenco sem atletas suficientes da mesma função para formar o pizza plot." />
          </Panel>
        </div>

        <Panel title="Leitura CIC" subtitle={`${analysis.player.equipa||'—'} · ${positionLabel(analysis.player.posicao)} · ${analysis.context?.competition||'—'}`}>
          <div style={{ padding:'12px 13px', borderRadius:12, background:C.green2, border:`1px solid ${C.green3}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', marginBottom:7 }}><div><strong style={{ fontSize:13, color:C.ink }}>Leitura orientada por dados</strong><p style={{ fontSize:8.3, color:C.green, fontWeight:900, marginTop:2 }}>DADO CONTEXTUALIZADO · LEITURA CIC</p></div><ScoreBadge value={analysis.fitScore} label="FIT" /></div>
            <p style={{ fontSize:11, color:'#294d36', lineHeight:1.65 }}>{cleanSummary(analysis.summary)}</p>
          </div>
          {analysis.methodology?.caution && <div style={{ marginTop:9, padding:'9px 10px', borderRadius:9, border:'1px solid #f3d7a6', background:'#fffaf0' }}><p style={{ fontSize:8.8, color:'#8a5b11', lineHeight:1.5 }}>{analysis.methodology.caution}</p></div>}
          {analysis.model?.identity && <div style={{ marginTop:10, padding:'10px 12px', borderRadius:10, border:`1px solid ${C.line}`, background:'#fff' }}><p style={{ fontSize:9, fontWeight:900, color:C.muted, textTransform:'uppercase' }}>Modelo atual do Confiança</p><p style={{ fontSize:10.5, fontWeight:800, color:C.ink, marginTop:4 }}>{analysis.model.identity}</p><p style={{ fontSize:9, color:C.muted, marginTop:3 }}>{analysis.metrics.filter(m=>m.priority).length} métricas desta função recebem peso adicional no fit.</p></div>}
          <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
            <div><h3 style={{ fontSize:10, color:'#15803d', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>Pontos fortes indicados</h3><InsightList items={analysis.strengths||[]} type="strength"/></div>
            <div><h3 style={{ fontSize:10, color:'#b45309', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>Pontos de atenção</h3><InsightList items={analysis.weaknesses||[]} type="weakness"/></div>
          </div>
        </Panel>

        {qualitative?.correlation && <Panel title="Scout × Dados" subtitle="Síntese da triangulação entre o parecer de observação e os benchmarks quantitativos.">
          <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'170px 1fr', gap:12, alignItems:'stretch' }}>
            <div style={{ padding:'13px 14px', borderRadius:12, background:C.green2, border:`1px solid ${C.green3}`, display:'grid', alignContent:'center' }}><p style={{ fontSize:8.5, color:C.green, fontWeight:950, textTransform:'uppercase' }}>Convergência</p><strong style={{ fontSize:26, color:C.ink, marginTop:3 }}>{qualitative.correlation.score != null ? `${qualitative.correlation.score}%` : '—'}</strong><p style={{ fontSize:9, color:C.muted, marginTop:3 }}>{qualitative.correlation.label}</p></div>
            <div style={{ padding:'12px 13px', borderRadius:12, border:`1px solid ${C.line}`, background:'#fff' }}><p style={{ fontSize:8.5, fontWeight:950, color:C.muted, textTransform:'uppercase' }}>Síntese integrada CIC</p><p style={{ fontSize:10, color:'#294d36', lineHeight:1.6, marginTop:5 }}>{qualitative.correlation.integratedSummary}</p></div>
          </div>
        </Panel>}

        <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1.15fr .85fr', gap:14 }}>
          <Panel title="Compatibilidade com o elenco" subtitle="Jogadores do Confiança mais próximos pelo desenho estatístico da função.">
            {analysis.squadMatches?.length ? <div style={{ display:'grid', gap:8 }}>{analysis.squadMatches.map((p,i)=><div key={`${p.nome}-${i}`} style={{ display:'grid', gridTemplateColumns:'28px 1fr 80px', alignItems:'center', gap:9, padding:'9px 10px', borderRadius:10, background:i===0?C.green2:'#f9fbfa', border:`1px solid ${i===0?C.green3:C.line}` }}><strong style={{ fontSize:11, color:C.green }}>#{i+1}</strong><div><p style={{ fontSize:10.5, fontWeight:850, color:C.ink }}>{p.nome}</p><p style={{ fontSize:9, color:C.muted }}>{p.posicao} · {Math.round(p.minutos||0)} min</p></div><div style={{ textAlign:'right' }}><strong style={{ fontSize:15, color:scoreTone(p.similarity) }}>{p.similarity}%</strong><p style={{ fontSize:8.5, color:C.muted }}>similaridade</p></div></div>)}</div> : <EmptyState title="Sem comparáveis" text="O elenco precisa ter atletas da mesma função com dados suficientes." />}
          </Panel>
          <div style={{ display:'grid', gap:14 }}>
            <Panel title="Diferenciais vs. elenco do Confiança" subtitle="Onde o atleta aparece acima do grupo da mesma função e onde encontra maior concorrência interna.">
              <SquadDifferentials metrics={analysis.metrics || []} />
            </Panel>
            <Panel title="Identificação e contexto da amostra" subtitle="Foto do atleta e informações consolidadas do arquivo.">
            <div style={{ display:'grid', gridTemplateColumns:'104px 1fr', gap:12, alignItems:'start', marginBottom:12 }}>
              <button type="button" onClick={()=>photoRef.current?.click()} title="Alterar foto do atleta" style={{ width:104, height:132, border:`1px solid ${C.line}`, borderRadius:12, padding:0, overflow:'hidden', cursor:'pointer', background:'#f0f5f2', display:'grid', placeItems:'center' }}>{photoPreview?<img src={photoPreview} alt="Foto do atleta" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<div style={{ textAlign:'center', color:C.muted }}><div style={{ fontSize:27 }}>👤</div><p style={{ fontSize:8.5, fontWeight:900, marginTop:5 }}>ADICIONAR FOTO</p></div>}</button>
              <div><strong style={{ display:'block', fontSize:12, color:C.ink }}>{analysis.player.nome}</strong><p style={{ fontSize:9.2, color:C.muted, lineHeight:1.5, marginTop:4 }}>{analysis.player.equipa||'—'} · {positionLabel(analysis.player.posicao)}</p><p style={{ fontSize:9.2, color:C.muted, lineHeight:1.5, marginTop:3 }}>Clique na foto para selecionar ou substituir. A imagem salva também entra no PDF.</p></div>
            </div>
            <div style={{ display:'grid', gap:8 }}>
              {[['Equipe',analysis.player.equipa],['Função',positionLabel(analysis.player.posicao)],['Competição analisada',analysis.context?.competition],['Jogos analisados',`${analysis.player.jogos||0} jogos`],['Jogos no arquivo',analysis.context?.fileGames?`${analysis.context.fileGames} jogos`:'—'],['Última partida',fmtDate(analysis.context?.lastDate)],['Pool Série C',`${analysis.pool?.serieC||0} atletas`],['Pool Confiança',`${analysis.pool?.guarani||0} atletas`]].map(([label,value])=><div key={label} style={{ display:'flex', justifyContent:'space-between', gap:14, borderBottom:`1px solid ${C.line}`, paddingBottom:7 }}><span style={{ fontSize:9.5, color:C.muted }}>{label}</span><strong style={{ fontSize:10, color:C.ink, textAlign:'right' }}>{value||'—'}</strong></div>)}
            </div>
            {analysis.context?.positions?.length>0 && <div style={{ marginTop:12 }}><p style={{ fontSize:9, fontWeight:900, color:C.muted, textTransform:'uppercase', marginBottom:7 }}>Posições na amostra</p>{analysis.context.positions.slice(0,5).map(p=><div key={p.code} style={{ display:'flex', justifyContent:'space-between', fontSize:9.5, color:C.ink, padding:'4px 0' }}><span>{p.label} · {p.code}</span><strong>{Math.round(p.minutes)} min</strong></div>)}</div>}
            </Panel>
          </div>
        </div>
      </div>}

      {tab==='comparacao' && <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14 }}>
        <Panel title="Percentis por contexto" subtitle="Quanto maior, melhor. Métricas de risco já são invertidas no cálculo do percentil."><BenchmarkChart metrics={analysis.metrics||[]}/></Panel>
        <Panel title="Leitura de benchmark" subtitle="Atleta x média do elenco x média posicional da Série C."><ComparisonTable metrics={(analysis.metrics||[]).slice(0,10)}/></Panel>
      </div>}

      {tab==='metricas' && <div style={{ marginTop:14 }}><Panel title="Tabela completa de métricas" subtitle="Valores consolidados por 90/eficiência e percentis posicionais. As prioridades ADC recebem peso adicional no Fit Confiança."><ComparisonTable metrics={analysis.metrics||[]}/></Panel></div>}

      {tab==='validacao' && <div style={{ marginTop:14 }}>
        <QualitativeValidation
          evaluationId={activeId}
          value={qualitative}
          onChange={setQualitative}
          analysis={analysis}
          onSaved={setQualitative}
        />
      </div>}

      {tab==='partidas' && <div className="scout-two-col" style={{ display:'grid', gridTemplateColumns:'1.25fr .75fr', gap:14, marginTop:14 }}>
        <Panel title="Partidas do arquivo" subtitle={`${analysis.games?.length||0} jogos utilizados na consolidação.`}>
          <div className="scout-scroll" style={{ overflowX:'auto' }}><table style={{ width:'100%', minWidth:680, borderCollapse:'collapse' }}><thead><tr>{['Data','Jogo','Competição','Posição','Min'].map(h=><th key={h} style={{ padding:'9px 10px', fontSize:9, color:C.muted, textAlign:h==='Jogo'||h==='Competição'?'left':'center', borderBottom:`1px solid ${C.line}` }}>{h}</th>)}</tr></thead><tbody>{(analysis.games||[]).map((g,i)=><tr key={`${g.jogo}-${g.date}-${i}`} style={{ borderBottom:`1px solid ${C.line}`, background:i%2?'#fbfdfb':'#fff' }}><td style={{ padding:'9px 10px', textAlign:'center', fontSize:9.5 }}>{fmtDate(g.date)}</td><td style={{ padding:'9px 10px', fontSize:10, fontWeight:750 }}>{g.jogo}</td><td style={{ padding:'9px 10px', fontSize:9.5, color:C.muted }}>{g.competition}</td><td style={{ padding:'9px 10px', textAlign:'center', fontSize:9.5 }}>{g.posicao}</td><td style={{ padding:'9px 10px', textAlign:'center', fontSize:10, fontWeight:850 }}>{Math.round(g.minutos||0)}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title="Qualidade da amostra" subtitle="Peso estatístico e cobertura de contexto.">
          <div style={{ textAlign:'center', padding:'8px 0 16px' }}><div style={{ width:116, height:116, borderRadius:'50%', margin:'0 auto', display:'grid', placeItems:'center', background:`conic-gradient(${scoreTone(analysis.sample?.score||0)} ${(analysis.sample?.score||0)*3.6}deg, #e8f0eb 0deg)` }}><div style={{ width:88, height:88, borderRadius:'50%', background:'#fff', display:'grid', placeItems:'center' }}><div><strong style={{ fontSize:25, color:C.ink }}>{analysis.sample?.score||0}</strong><p style={{ fontSize:8.5, color:C.muted }}>CONFIANÇA</p></div></div></div><p style={{ fontSize:11, fontWeight:900, color:C.ink, marginTop:10 }}>{analysis.sample?.label}</p><p style={{ fontSize:9.5, color:C.muted, marginTop:4, lineHeight:1.45 }}>{analysis.sample?.text}</p></div>
          <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:10 }}><p style={{ fontSize:9, color:C.muted, lineHeight:1.5 }}>O Fit não substitui observação. Ele combina nível posicional na Série C, comparação direta com o elenco, prioridades métricas do modelo atual do Confiança e confiança da amostra.</p></div>
        </Panel>
      </div>}

    </>}
  </ScoutingPage>
}
