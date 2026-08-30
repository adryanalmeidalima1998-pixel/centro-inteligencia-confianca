'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button, C, EmptyState, Field, Kpi, LoadingState, PageHeader,
  Panel, ScoutingPage, ScoreBadge, StatusDot, inputStyle,
} from '@/app/components/scouting/ScoutingUI'
import { SPORTSBASE_IAP_PERFIS } from '@/data/sportsbase-iap-profiles'
import { PLAYER_FOOT_OPTIONS, playerFootLabel } from '@/data/player-foot'
import { COMPETITIVE_LEVELS, getCompetitiveLevel, robustnessFromScore } from '@/data/competitive-levels'

const GROUPS = [
  { id:'', label:'Todos' }, { id:'Goleiro', label:'Goleiros' },
  { id:'Zagueiro', label:'Zagueiros' }, { id:'Lateral', label:'Laterais' },
  { id:'Volante', label:'Volantes' }, { id:'Meia', label:'Meias' },
  { id:'Extremo', label:'Extremos' }, { id:'Atacante', label:'Atacantes' },
]

const LEAGUE_LABELS = {
  'brasileirao-serie-a':'Série A', 'brasileirao-serie-b':'Série B',
  'brasileirao-serie-c':'Série C', 'brasileirao-serie-d':'Série D',
}
const leagueLabel = slug => LEAGUE_LABELS[slug] || String(slug || '—').replace(/-/g, ' ')
const hasNumber = input => input !== null && input !== undefined && input !== '' && Number.isFinite(Number(input))
const value = (input, decimals = 0) => hasNumber(input) ? Number(input).toLocaleString('pt-BR', { maximumFractionDigits:decimals }) : '—'

function LevelBadge({ label, score, tone = C.green, index = null, context = '' }) {
  const available = hasNumber(score)
  return <div title={context || 'Faixa relativa ao grupo comparável'}><span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:38, padding:'5px 8px', borderRadius:8, background:available ? `${tone}12` : '#f5f7f6', border:`1px solid ${available ? `${tone}30` : C.line}`, color:available ? tone : C.muted, fontSize:10.5, fontWeight:950 }}>{available ? label : '—'}</span>{hasNumber(index) && <p style={{ color:C.muted, fontSize:7.7, marginTop:3 }}>índice {value(index, 1)}</p>}</div>
}

function Robustness({ score, coverage, minutes, metrics }) {
  const robust = robustnessFromScore(score)
  const tone = robust.key === 'very-high' || robust.key === 'high' ? C.green : robust.key === 'moderate' ? C.amber : C.red
  return <div><span style={{ color:tone, fontSize:9, fontWeight:900 }}>{robust.label} · {robust.score}</span><p style={{ color:C.muted, fontSize:8.2, marginTop:3 }}>Cobertura {Math.round(Number(coverage) || 0)}% · {value(minutes)} min · {Number(metrics) || 0} métricas</p></div>
}

export default function DatabasePage() {
  const [filters, setFilters] = useState({
    grupo:'', liga:'', busca:'', pe:'', idadeMax:32, minMin:450,
    iapMin:0, nivelAtualMin:0, nivelRealMin:0, nivelPotencialMin:0, perfil:'',
    ordenarPor:'nivel_efetivo', page:1,
  })
  const [data, setData] = useState({ jogadores:[], total:0, ligas:[], pages:1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [savingLevel, setSavingLevel] = useState(null)
  const profiles = useMemo(() => filters.grupo ? Object.keys(SPORTSBASE_IAP_PERFIS[filters.grupo] || {}) : [], [filters.grupo])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const firstLoad = !data.jogadores?.length
      if (firstLoad) setLoading(true)
      else setRefreshing(true)
      setError('')
      try {
        const params = new URLSearchParams({
          grupo:filters.grupo, liga:filters.liga, busca:filters.busca, pe:filters.pe,
          idadeMax:String(filters.idadeMax), minMin:String(filters.minMin), iapMin:String(filters.iapMin),
          nivelAtualMin:String(filters.nivelAtualMin), nivelRealMin:String(filters.nivelRealMin),
          nivelPotencialMin:String(filters.nivelPotencialMin), perfil:filters.perfil,
          ordenarPor:filters.ordenarPor, page:String(filters.page), limit:'40', dir:'desc',
        })
        const response = await fetch(`/api/database?${params}`, { signal:controller.signal })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Falha ao consultar a Base.')
        setData(json)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setRefreshing(false) }
      }
    }, 100)
    return () => { clearTimeout(timer); controller.abort() }
  }, [filters])


  function update(key, nextValue) {
    setFilters(previous => ({
      ...previous, [key]:nextValue, page:key === 'page' ? nextValue : 1,
      ...(key === 'grupo' ? { perfil:'' } : {}),
    }))
  }



  async function saveRealLevel(player, rawValue) {
    if (!player._canonical_id) return
    const real = rawValue === '' ? null : Number(rawValue)
    const note = real === null ? '' : window.prompt('Justifique a validação da faixa. Registre evidências de vídeo, contexto coletivo e motivo do ajuste:', player._nivel_real_nota || '')
    if (real !== null && !String(note || '').trim()) return
    setSavingLevel(player._canonical_id)
    try {
      const response = await fetch(`/api/player-master/${player._canonical_id}`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ real, recommended:player._nivel_recomendado_score, note:String(note || '').trim() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Falha ao salvar a faixa validada.')
      setData(previous => ({
        ...previous,
        jogadores:previous.jogadores.map(item => item._canonical_id === player._canonical_id ? {
          ...item,
          _nivel_real_score:body.real.score,
          _nivel_real:body.real.score === null ? null : body.real.label,
          _nivel_atual_score:body.effective.score,
          _nivel_atual:body.effective.label,
          _nivel_fonte:body.real.score === null ? 'automático' : 'analista',
        } : item),
      }))
    } catch (err) { setError(err.message) }
    finally { setSavingLevel(null) }
  }

  const rated = data.jogadores?.filter(player => hasNumber(player._nivel_atual_score)) || []
  const averageCurrent = rated.length ? rated.reduce((sum, player) => sum + Number(player._nivel_atual_score), 0) / rated.length : 0
  const manualCount = data.jogadores?.filter(player => hasNumber(player._nivel_real_score)).length || 0
  const provisionalCount = data.jogadores?.filter(player => player._nivel_recomendacao_tipo === 'provisório' || !player._nivel_modelo_disponivel).length || 0

  return <ScoutingPage maxWidth={1700}>
    <PageHeader
      eyebrow="SCOUTING DATABASE · FICHA-MÃE"
      title="Banco Canônico de Atletas"
      subtitle="As faixas S–E são internas à liga, temporada, posição e perfil. A validação do scout prevalece sobre o cálculo automático."
      status={<StatusDot>{value(data.total)} fichas únicas</StatusDot>}
      actions={<><span style={{ color:refreshing ? C.amber : C.green, fontSize:9.5, fontWeight:850 }}>{refreshing ? 'Atualizando recorte…' : '● automático após upload'}</span><Link href="/shadows"><Button variant="secondary">🕶 Times Shadow</Button></Link><Link href="/recomendacoes"><Button>🎯 Aplicar Fit Confiança</Button></Link></>}
    />

    {error && <div style={{ marginBottom:10, padding:'9px 11px', borderRadius:9, border:'1px solid #fecaca', background:'#fff1f2', color:C.red, fontSize:9.5, fontWeight:850 }}>{error}</div>}

    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:14 }}>
      <Kpi label="Fichas no recorte" value={value(data.total)} sub="sem duplicar atleta por liga/fonte" icon="🧬" />
      <Kpi label="Faixa efetiva média" value={averageCurrent ? getCompetitiveLevel(Math.round(averageCurrent))?.short : '—'} sub="validada quando preenchida; automática nos demais" icon="📈" tone={C.blue} />
      <Kpi label="Validados pelo scout" value={manualCount} sub="faixa revisada manualmente" icon="✍️" tone={C.purple} />
      <Kpi label="Resultados provisórios" value={provisionalCount} sub="amostra ou cobertura ainda limitadas" icon="🧪" tone={C.amber} />
    </div>

    <Panel title="Metodologia de faixa relativa" subtitle="A letra representa somente o desempenho dentro da própria liga, temporada, posição e perfil. Não existe equivalência automática com outra divisão." bodyStyle={{ padding:12 }} style={{ marginBottom:14 }}>
      <div className="scout-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(9,minmax(105px,1fr))', gap:6, overflowX:'auto', paddingBottom:4 }}>
        {COMPETITIVE_LEVELS.slice().reverse().map(item => <div key={item.score} style={{ minWidth:105, border:`1px solid ${item.score >= 8 ? '#d8c9ff' : item.score >= 6 ? '#c9e7d6' : item.score >= 4 ? '#d8e3dc' : '#f0d5d1'}`, borderRadius:9, padding:'9px 8px', background:item.score >= 8 ? '#f8f5ff' : item.score >= 6 ? '#f3fbf6' : item.score >= 4 ? '#f8faf9' : '#fff7f6' }}><strong style={{ display:'block', color:C.ink, fontSize:13 }}>{item.short}</strong><span style={{ color:C.muted, fontSize:7.6, lineHeight:1.3 }}>{item.min}–{item.max}% · {item.description}</span></div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(180px,1fr))', gap:8, marginTop:9 }} className="scout-filter-grid">
        <div style={{ color:C.muted, fontSize:9, lineHeight:1.45 }}><b style={{ color:C.green }}>Faixa automática:</b> percentis e pesos do perfil IAP, ajustados em direção à média conforme minutos, jogos, cobertura e tamanho do grupo.</div>
        <div style={{ color:C.muted, fontSize:9, lineHeight:1.45 }}><b style={{ color:C.blue }}>Faixa validada:</b> parecer do scout após vídeo e contexto; exige justificativa na ficha individual e prevalece no sistema.</div>
        <div style={{ color:C.muted, fontSize:9, lineHeight:1.45 }}><b style={{ color:C.purple }}>Projeção interna:</b> estimativa de evolução dentro de ambiente competitivo semelhante; não representa promoção automática de divisão.</div>
        <div style={{ color:C.muted, fontSize:9, lineHeight:1.45 }}><b style={{ color:C.amber }}>Robustez:</b> Muito baixa, Baixa, Moderada, Alta ou Muito alta. Uma faixa S pode ser provisória quando a amostra é curta.</div>
      </div>
    </Panel>

    <Panel title="Recorte do banco" subtitle="Filtre o universo competitivo e ordene por faixa validada, automática ou efetiva" bodyStyle={{ padding:13 }} style={{ marginBottom:14 }}>
      <div className="scout-scroll" style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:9 }}>
        {GROUPS.map(group => <button key={group.id} onClick={() => update('grupo', group.id)} style={{ whiteSpace:'nowrap', padding:'8px 11px', borderRadius:9, border:`1px solid ${filters.grupo === group.id ? C.green : C.line}`, background:filters.grupo === group.id ? C.green2 : '#fff', color:filters.grupo === group.id ? C.green : C.muted, fontSize:10.5, fontWeight:850, cursor:'pointer' }}>{group.label}</button>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(220px,1.7fr) repeat(9,minmax(112px,1fr))', gap:8 }} className="scout-filter-grid">
        <Field label="Jogador ou clube"><input value={filters.busca} onChange={event => update('busca', event.target.value)} placeholder="Buscar ficha..." style={inputStyle} /></Field>
        <Field label="Liga atual"><select value={filters.liga} onChange={event => update('liga', event.target.value)} style={inputStyle}><option value="">Todas</option>{(data.ligas || []).map(item => <option key={item} value={item}>{leagueLabel(item)}</option>)}</select></Field>
        <Field label="Perfil"><select value={filters.perfil} onChange={event => update('perfil', event.target.value)} disabled={!filters.grupo} style={inputStyle}><option value="">Todos</option>{profiles.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Pé"><select value={filters.pe} onChange={event => update('pe', event.target.value)} style={inputStyle}>{PLAYER_FOOT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Field label="Idade máx."><input type="number" value={filters.idadeMax} onChange={event => update('idadeMax', Number(event.target.value) || 45)} style={inputStyle} /></Field>
        <Field label="Min. minutos"><input type="number" value={filters.minMin} onChange={event => update('minMin', Number(event.target.value) || 0)} style={inputStyle} /></Field>
        <Field label="Faixa efetiva mín."><select value={filters.nivelAtualMin} onChange={event => update('nivelAtualMin', Number(event.target.value))} style={inputStyle}><option value="0">Qualquer</option>{COMPETITIVE_LEVELS.map(item => <option key={item.score} value={item.score}>{item.label}</option>)}</select></Field>
        <Field label="Faixa validada mín."><select value={filters.nivelRealMin} onChange={event => update('nivelRealMin', Number(event.target.value))} style={inputStyle}><option value="0">Qualquer</option>{COMPETITIVE_LEVELS.map(item => <option key={item.score} value={item.score}>{item.label}</option>)}</select></Field>
        <Field label="Projeção mín."><select value={filters.nivelPotencialMin} onChange={event => update('nivelPotencialMin', Number(event.target.value))} style={inputStyle}><option value="0">Qualquer</option>{COMPETITIVE_LEVELS.map(item => <option key={item.score} value={item.score}>{item.label}</option>)}</select></Field>
        <Field label="Ordenar por"><select value={filters.ordenarPor} onChange={event => update('ordenarPor', event.target.value)} style={inputStyle}><option value="nivel_efetivo">Faixa efetiva</option><option value="nivel_real">Faixa validada</option><option value="nivel_recomendado">Faixa automática</option><option value="nivel_potencial">Projeção interna</option><option value="iap">Desempenho no perfil</option><option value="minutos">Minutos</option><option value="idade">Idade</option></select></Field>
      </div>
    </Panel>

    <Panel title="Fichas-mãe" subtitle="Valide a faixa diretamente na tabela. Sem validação, a faixa efetiva usa o cálculo automático ajustado pela amostra." bodyStyle={{ padding:0 }}>
      {loading && !data.jogadores?.length ? <LoadingState text="Carregando fichas do recorte..." /> : !data.jogadores?.length ? <EmptyState icon="🧬" title="Nenhuma ficha no recorte" text="Revise os filtros competitivos e de amostra." /> : <div className="scout-scroll" style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1600 }}>
          <thead><tr style={{ background:'#f6faf7' }}>{['#','Atleta e contexto atual','Pos.','Faixa automática','Faixa validada','Faixa efetiva','Projeção interna','Perfil / índice','Robustez','Histórico','Ação'].map(label => <th key={label} style={{ padding:'11px 10px', borderBottom:`1px solid ${C.line}`, color:C.muted, fontSize:8.5, textTransform:'uppercase', textAlign:['#','Faixa automática','Faixa validada','Faixa efetiva','Projeção interna','Robustez'].includes(label) ? 'center' : 'left' }}>{label}</th>)}</tr></thead>
          <tbody>{data.jogadores.map((player, index) => <tr key={player._identity_key || `${player.nome}-${index}`} style={{ borderBottom:`1px solid #edf3ef` }}>
            <td style={{ padding:11, textAlign:'center', color:C.green, fontSize:10.5, fontWeight:950 }}>{(filters.page - 1) * 40 + index + 1}</td>
            <td style={{ padding:11 }}><Link href={player._canonical_id ? `/database/${player._canonical_id}` : '#'} style={{ color:C.green, textDecoration:'none', fontSize:11.5, fontWeight:950 }}>{player.nome}</Link><p style={{ color:C.muted, fontSize:9, marginTop:3 }}>{player.equipa || 'Sem clube'} · {leagueLabel(player._liga)} · {player.idade || '—'} anos · Pé {playerFootLabel(player.pe)}</p></td>
            <td style={{ padding:11 }}><span style={{ background:'#eef5f0', borderRadius:6, padding:'4px 6px', fontSize:9.5, fontWeight:900 }}>{player.posicao || '—'}</span></td>
            <td style={{ padding:11, textAlign:'center' }}><LevelBadge label={player._nivel_recomendado} score={player._nivel_recomendado_score} index={player._indice_relativo} context={`${leagueLabel(player._liga)} · ${player.posicao || 'posição'} · ${new Date().getFullYear()}`} /></td>
            <td style={{ padding:11, textAlign:'center' }}><select aria-label={`Faixa validada de ${player.nome}`} value={hasNumber(player._nivel_real_score) ? String(Math.round(Number(player._nivel_real_score))) : ''} disabled={!player._canonical_id || savingLevel === player._canonical_id} onChange={event => saveRealLevel(player, event.target.value)} style={{ width:145, border:`1px solid ${hasNumber(player._nivel_real_score) ? C.blue : C.line}`, borderRadius:8, padding:'7px 8px', background:hasNumber(player._nivel_real_score) ? '#f3f8ff' : '#fff', color:hasNumber(player._nivel_real_score) ? C.blue : C.muted, fontSize:9.2, fontWeight:850 }}><option value="">Não validada</option>{COMPETITIVE_LEVELS.map(item => <option key={item.score} value={item.score}>{item.short}</option>)}</select></td>
            <td style={{ padding:11, textAlign:'center' }}><LevelBadge label={player._nivel_atual} score={player._nivel_atual_score} tone={player._nivel_fonte === 'analista' ? C.blue : C.green} index={player._indice_relativo} /><p style={{ color:C.muted, fontSize:7.8, marginTop:4 }}>{player._nivel_fonte === 'analista' ? 'validação do scout' : player._nivel_recomendacao_tipo === 'estatístico' ? 'cálculo estatístico' : 'resultado provisório'}</p></td>
            <td style={{ padding:11, textAlign:'center' }}><LevelBadge label={player._nivel_potencial_recomendado || player._nivel_potencial} score={player._nivel_potencial_recomendado_score ?? player._nivel_potencial_score} tone={C.purple} index={player._projecao_indice} /></td>
            <td style={{ padding:11 }}><strong style={{ color:C.ink, fontSize:10.5 }}>{player._perfil_dominante || 'Perfil geral'}</strong><div style={{ marginTop:5, display:'flex', alignItems:'center', gap:6 }}><ScoreBadge value={player._indice_relativo ?? player._iap_dominante ?? 50} color={player._fonte === 'sportsbase' ? C.green : C.blue} /><span style={{ color:C.muted, fontSize:8.5 }}>bruto {value(player._indice_bruto ?? player._iap_dominante, 1)} · {player._fonte}</span></div>{player._faixas_perfis?.[1] && <p style={{ color:C.muted, fontSize:7.7, marginTop:3 }}>{player._faixas_perfis[1].label} como {player._faixas_perfis[1].profile}</p>}</td>
            <td style={{ padding:11, textAlign:'center' }}><Robustness score={player._nivel_confianca} coverage={player._nivel_criterios?.metricCoverage} minutes={player.minutos} metrics={player._nivel_criterios?.metricCount} /></td>
            <td style={{ padding:11 }}><strong style={{ color:C.ink, fontSize:10 }}>{player._source_count || 1} registro(s)</strong><p style={{ color:C.muted, fontSize:8.5, marginTop:3 }}>{player._league_count || 1} liga(s) · {player._season_count || 1} temporada(s)</p></td>
            <td style={{ padding:11 }}><Link href={player._canonical_id ? `/database/${player._canonical_id}` : '#'}><Button variant="secondary" disabled={!player._canonical_id}>Abrir ficha</Button></Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {data.pages > 1 && <div style={{ padding:13, borderTop:`1px solid ${C.line}`, display:'flex', justifyContent:'center', alignItems:'center', gap:8 }}><Button variant="secondary" disabled={filters.page <= 1} onClick={() => update('page', filters.page - 1)}>← Anterior</Button><span style={{ fontSize:10, color:C.muted }}>Página {filters.page} de {data.pages}</span><Button variant="secondary" disabled={filters.page >= data.pages} onClick={() => update('page', filters.page + 1)}>Próxima →</Button></div>}
    </Panel>
  </ScoutingPage>
}
