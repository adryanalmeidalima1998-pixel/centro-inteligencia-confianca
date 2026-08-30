'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button, C, EmptyState, Field, LoadingState, PageHeader, Panel,
  ScoutingPage, StatusDot, inputStyle,
} from '@/app/components/scouting/ScoutingUI'
import { GRUPOS_POSICOES } from '@/data/iap-profiles'

const SLOTS = [
  { id:'GK', label:'GOL', group:'Goleiro', x:50, y:88 },
  { id:'LB', label:'LE', group:'Lateral', x:16, y:70 },
  { id:'CBL', label:'ZAG', group:'Zagueiro', x:37, y:67 },
  { id:'CBR', label:'ZAG', group:'Zagueiro', x:63, y:67 },
  { id:'RB', label:'LD', group:'Lateral', x:84, y:70 },
  { id:'CM', label:'MC', group:'Meia', x:22, y:47 },
  { id:'DM', label:'VOL', group:'Volante', x:50, y:51 },
  { id:'AM', label:'MEI', group:'Meia', x:78, y:47 },
  { id:'LW', label:'PE', group:'Extremo', x:20, y:23 },
  { id:'CF', label:'CA', group:'Atacante', x:50, y:16 },
  { id:'RW', label:'PD', group:'Extremo', x:80, y:23 },
]

function Pitch() {
  return <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 100 130" preserveAspectRatio="none">
    <rect x="5" y="5" width="90" height="120" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <line x1="5" y1="65" x2="95" y2="65" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <rect x="22" y="5" width="56" height="25" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <rect x="35" y="5" width="30" height="12" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <rect x="22" y="100" width="56" height="25" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    <rect x="35" y="113" width="30" height="12" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
  </svg>
}

function PlayerDot({ slot, player, onClick }) {
  return <button onClick={onClick} style={{ position:'absolute', left:`${slot.x}%`, top:`${slot.y}%`, transform:'translate(-50%,-50%)', border:'none', background:'none', cursor:'pointer', width:88, textAlign:'center' }}>
    <span style={{ width:44, height:44, borderRadius:999, margin:'0 auto', display:'grid', placeItems:'center', background:player ? '#fff' : 'rgba(255,255,255,.08)', border:player ? '3px solid #7c3aed' : '2px dashed rgba(255,255,255,.35)', color:player ? '#0a66b7' : 'rgba(255,255,255,.65)', fontSize:10, fontWeight:950, boxShadow:player ? '0 6px 18px rgba(0,0,0,.22)' : 'none' }}>{player ? (player.nivel_atual || '—') : slot.label}</span>
    <span style={{ display:'block', marginTop:4, color:'#fff', fontSize:8.5, fontWeight:900, textShadow:'0 1px 3px rgba(0,0,0,.8)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player?.nome?.split(' ').slice(-2).join(' ') || 'Adicionar'}</span>
  </button>
}

function Picker({ slot, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [league, setLeague] = useState('')
  const [positions, setPositions] = useState([])
  const [leagues, setLeagues] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const compatiblePositions = GRUPOS_POSICOES[slot.group] || []

  useEffect(() => {
    fetch('/api/database?limit=1', { cache:'no-store' })
      .then(response => response.json())
      .then(body => setLeagues(body.ligas || []))
      .catch(() => setLeagues([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({ grupo:slot.group, busca:query, liga:league, minMin:'0', limit:'50', ordenarPor:'nivel_atual', dir:'desc' })
      if (positions.length) params.set('posicao', positions.join(','))
      fetch(`/api/database?${params}`, { signal:controller.signal })
        .then(response => response.json())
        .then(body => setPlayers(body.jogadores || []))
        .catch(error => { if (error.name !== 'AbortError') setPlayers([]) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 120)
    return () => { clearTimeout(timer); controller.abort() }
  }, [slot, query, league, positions])

  function togglePosition(code) {
    setPositions(previous => previous.includes(code) ? previous.filter(item => item !== code) : [...previous, code])
  }

  const leagueName = slug => String(slug || '').replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())

  return <div onMouseDown={event => event.target === event.currentTarget && onClose()} style={{ position:'fixed', inset:0, background:'rgba(8,25,14,.55)', zIndex:10000, display:'grid', placeItems:'center', padding:18 }}>
    <div style={{ width:'min(880px,96vw)', maxHeight:'90vh', overflow:'auto', background:'#f8fbf9', borderRadius:16, border:`1px solid ${C.line}`, boxShadow:'0 24px 80px rgba(0,0,0,.25)' }}>
      <div style={{ padding:16, borderBottom:`1px solid ${C.line}`, display:'flex', justifyContent:'space-between', gap:12 }}><div><strong style={{ color:C.ink, fontSize:14 }}>Selecionar {slot.group}</strong><p style={{ color:C.muted, fontSize:9, marginTop:2 }}>Filtre por liga e por uma ou mais posições compatíveis com o slot.</p></div><button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer' }}>×</button></div>
      <div style={{ padding:13, display:'grid', gap:9 }}>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(220px,1fr) minmax(210px,.7fr)', gap:8 }} className="scout-two-col">
          <Field label="Jogador ou clube"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar jogador ou clube..." style={inputStyle} /></Field>
          <Field label="Liga"><select value={league} onChange={event => setLeague(event.target.value)} style={inputStyle}><option value="">Todas as ligas</option>{leagues.map(item => <option key={item} value={item}>{leagueName(item)}</option>)}</select></Field>
        </div>
        <Field label={`Posições (${positions.length ? `${positions.length} selecionada(s)` : 'todas do grupo'})`}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {compatiblePositions.map(code => <button key={code} onClick={() => togglePosition(code)} style={{ border:`1px solid ${positions.includes(code) ? C.green : C.line}`, background:positions.includes(code) ? C.green2 : '#fff', color:positions.includes(code) ? C.green : C.muted, padding:'6px 8px', borderRadius:8, fontSize:8.8, fontWeight:900, cursor:'pointer' }}>{code}</button>)}
            {!!positions.length && <button onClick={() => setPositions([])} style={{ border:`1px solid ${C.line}`, background:'#fff', color:C.red, padding:'6px 8px', borderRadius:8, fontSize:8.8, fontWeight:900, cursor:'pointer' }}>Limpar</button>}
          </div>
        </Field>
      </div>
      {loading ? <LoadingState text="Buscando fichas elegíveis..." /> : !players.length ? <EmptyState icon="🧬" title="Nenhum jogador encontrado" text="Altere a liga, as posições ou o termo de busca." /> : <div style={{ padding:'0 13px 13px', display:'grid', gap:7 }}>{players.map(player => <button key={player._canonical_id || player._identity_key} onClick={() => onSelect({ id:player._canonical_id, nome:player.nome, idade:player.idade, posicao:player.posicao, equipa:player.equipa, liga:player._liga, nivel_atual:player._nivel_atual, nivel_atual_score:player._nivel_atual_score, nivel_potencial:player._nivel_potencial, nivel_potencial_score:player._nivel_potencial_score, indice_relativo:player._indice_relativo, robustez:player._robustez?.label || '—' })} style={{ width:'100%', textAlign:'left', border:`1px solid ${C.line}`, borderRadius:10, padding:'10px 11px', background:'#fff', cursor:'pointer', display:'grid', gridTemplateColumns:'1.35fr .7fr .7fr .55fr', gap:10, alignItems:'center' }}><div><strong style={{ color:C.green, fontSize:10.8 }}>{player.nome}</strong><p style={{ color:C.muted, fontSize:8.5, marginTop:2 }}>{player.equipa} · {player.posicao} · {player.idade || '—'} anos · {leagueName(player._liga)}</p></div><div><span style={{ color:C.muted, fontSize:8 }}>FAIXA EFETIVA</span><strong style={{ display:'block', color:C.green, fontSize:11, marginTop:2 }}>{player._nivel_atual}</strong></div><div><span style={{ color:C.muted, fontSize:8 }}>PROJEÇÃO</span><strong style={{ display:'block', color:C.purple, fontSize:11, marginTop:2 }}>{player._nivel_potencial}</strong></div><div><span style={{ color:C.muted, fontSize:8 }}>ROBUSTEZ</span><strong style={{ display:'block', color:C.ink, fontSize:8.7, marginTop:2 }}>{player._robustez?.label || '—'}</strong></div></button>)}</div>}
    </div>
  </div>
}

export default function ShadowsPage() {
  const [teams, setTeams] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [picker, setPicker] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const body = await fetch('/api/shadows', { cache:'no-store' }).then(response => response.json())
    setTeams(body.teams || [])
    const id = activeId || body.teams?.[0]?.id
    if (id) {
      setActiveId(id)
      const selected = (body.teams || []).find(item => item.id === id)
      if (selected) setActive({ ...selected, slots:selected.slots || {} })
    } else setActive(null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const selected = teams.find(item => item.id === activeId)
    if (selected) setActive({ ...selected, slots:selected.slots || {} })
  }, [activeId, teams])

  async function createTeam() {
    const name = newName.trim()
    if (!name) return
    const response = await fetch('/api/shadows', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ name }) })
    const body = await response.json()
    if (response.ok) { setNewName(''); setTeams(previous => [body.team, ...previous]); setActiveId(body.team.id); setActive(body.team) }
  }

  async function saveTeam() {
    if (!active) return
    setSaving(true)
    const response = await fetch(`/api/shadows/${active.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ name:active.name, formation:active.formation, notes:active.notes, slots:active.slots }) })
    const body = await response.json()
    if (response.ok) setTeams(previous => previous.map(item => item.id === body.team.id ? body.team : item))
    setSaving(false)
  }

  async function removeTeam() {
    if (!active || !confirm(`Excluir ${active.name}?`)) return
    await fetch(`/api/shadows/${active.id}`, { method:'DELETE' })
    setActiveId(null); setActive(null); load()
  }

  const players = useMemo(() => SLOTS.map(slot => ({ slot, player:active?.slots?.[slot.id] })).filter(item => item.player), [active])
  if (loading) return <ScoutingPage><LoadingState text="Carregando Times Shadow..." /></ScoutingPage>

  return <ScoutingPage maxWidth={1550}>
    <PageHeader eyebrow="SCOUTING PLANNING" title="Times Shadow" subtitle="Crie cenários de elenco com busca por liga e posição. Cada cartão preserva nome, idade, clube, faixa efetiva, projeção e robustez." status={<StatusDot>{teams.length} time(s)</StatusDot>} actions={<Link href="/database"><Button variant="secondary">← Banco de atletas</Button></Link>} />

    <div style={{ display:'grid', gridTemplateColumns:'260px minmax(0,1fr)', gap:14, alignItems:'start' }} className="scout-two-col">
      <Panel title="Cenários" subtitle="Vários times podem coexistir" bodyStyle={{ padding:10 }}>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}><input value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => event.key === 'Enter' && createTeam()} placeholder="Nome do novo time" style={{ ...inputStyle, flex:1 }} /><Button onClick={createTeam}>+</Button></div>
        <div style={{ display:'grid', gap:6 }}>{teams.map(team => <button key={team.id} onClick={() => setActiveId(team.id)} style={{ textAlign:'left', border:`1px solid ${activeId === team.id ? C.green : C.line}`, background:activeId === team.id ? C.green2 : '#fff', borderRadius:9, padding:'9px 10px', cursor:'pointer' }}><strong style={{ display:'block', color:activeId === team.id ? C.green : C.ink, fontSize:10.5 }}>{team.name}</strong><span style={{ color:C.muted, fontSize:8.5 }}>{Object.values(team.slots || {}).filter(Boolean).length}/11 jogadores · {team.formation}</span></button>)}</div>
      </Panel>

      {!active ? <Panel title="Novo cenário" subtitle="Comece organizando uma hipótese de elenco"><EmptyState icon="🕶" title="Crie seu primeiro Time Shadow" text="O cenário será salvo no servidor e poderá ser atualizado conforme o mercado evoluir." /></Panel> : <div style={{ display:'grid', gap:14 }}>
        <Panel title={active.name} subtitle={`${players.length}/11 posições preenchidas`} action={<div style={{ display:'flex', gap:6 }}><Button variant="secondary" onClick={removeTeam}>Excluir</Button><Button onClick={saveTeam} disabled={saving}>{saving ? 'Salvando...' : 'Salvar time'}</Button></div>}>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 330px', gap:16 }} className="scout-two-col">
            <div style={{ position:'relative', width:'100%', paddingBottom:'130%', background:'linear-gradient(180deg,#1a6b3a,#15572f 50%,#1a6b3a)', borderRadius:16, overflow:'hidden', boxShadow:'0 8px 28px rgba(0,0,0,.2)' }}><Pitch />{SLOTS.map(slot => <PlayerDot key={slot.id} slot={slot} player={active.slots?.[slot.id]} onClick={() => setPicker(slot)} />)}</div>
            <div><Field label="Nome do cenário"><input value={active.name} onChange={event => setActive(previous => ({ ...previous, name:event.target.value }))} style={inputStyle} /></Field><div style={{ height:8 }} /><Field label="Notas de planejamento"><textarea value={active.notes || ''} onChange={event => setActive(previous => ({ ...previous, notes:event.target.value }))} rows={8} placeholder="Hipóteses, janela, perfil coletivo, prioridades..." style={{ ...inputStyle, resize:'vertical' }} /></Field><div style={{ marginTop:12, padding:11, borderRadius:10, background:'#f4f0ff', border:'1px solid #ddd2ff' }}><strong style={{ color:C.purple, fontSize:9, textTransform:'uppercase' }}>Leitura do cenário</strong><p style={{ color:C.muted, fontSize:9, lineHeight:1.5, marginTop:4 }}>O Time Shadow não altera rankings nem aprova contratações. Ele organiza hipóteses de composição e sucessão.</p></div></div>
          </div>
        </Panel>

        <Panel title="Quadro do Time Shadow" subtitle="Resumo executivo do cenário" bodyStyle={{ padding:0 }}>
          {!players.length ? <EmptyState icon="＋" title="Nenhum jogador selecionado" text="Clique em uma posição no campo para buscar no banco de dados." /> : <div className="scout-scroll" style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}><thead><tr>{['Posição no time','Nome','Idade','Posição','Clube','Faixa efetiva','Projeção','Robustez','Ação'].map(label => <th key={label} style={{ padding:'9px 10px', borderBottom:`1px solid ${C.line}`, color:C.muted, fontSize:8.5, textTransform:'uppercase', textAlign:['Idade'].includes(label) ? 'center' : 'left' }}>{label}</th>)}</tr></thead><tbody>{players.map(({ slot, player }) => <tr key={slot.id} style={{ borderBottom:`1px solid #edf3ef` }}><td style={{ padding:10, fontSize:9.5, fontWeight:900 }}>{slot.label}</td><td style={{ padding:10 }}><Link href={player.id ? `/database/${player.id}` : '#'} style={{ color:C.green, fontSize:10.5, fontWeight:900, textDecoration:'none' }}>{player.nome}</Link></td><td style={{ padding:10, textAlign:'center', fontSize:10 }}>{player.idade || '—'}</td><td style={{ padding:10, fontSize:10 }}>{player.posicao || '—'}</td><td style={{ padding:10, fontSize:10 }}>{player.equipa || '—'}</td><td style={{ padding:10, color:C.green, fontSize:9.5, fontWeight:850 }}>{player.nivel_atual}</td><td style={{ padding:10, color:C.purple, fontSize:9.5, fontWeight:850 }}>{player.nivel_potencial}</td><td style={{ padding:10, color:C.muted, fontSize:9 }}>{player.robustez || '—'}</td><td style={{ padding:10 }}><Button variant="secondary" onClick={() => setActive(previous => ({ ...previous, slots:{ ...previous.slots, [slot.id]:null } }))}>Remover</Button></td></tr>)}</tbody></table></div>}
        </Panel>
      </div>}
    </div>

    {picker && <Picker slot={picker} onClose={() => setPicker(null)} onSelect={player => { setActive(previous => ({ ...previous, slots:{ ...previous.slots, [picker.id]:player } })); setPicker(null) }} />}
  </ScoutingPage>
}
