'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { exportToCustomExcel } from './excelExport'

const BRAND_PRIMARY = '#0a66b7'
const DARK = '#10233b'

/* ─── LISTAS (espelham o Excel) ─────────────────────────────────── */
const AVALIACOES = ['Destaque do Jogo','Jovem Potencial','Destaque/Jovem','Desempenho Bom','Desempenho Normal','Desempenho Ruim']
const NOTAS = ['10 (A+)','9 (A)','8 (B+)','7 (B)','6 (C+)','5 (C)','4 (D/E)','3 (D/E)','2 (D/E)','1 (D/E)','0 (D/E)']
const RECOMENDACOES = ['Contratar (Titular PRO)','Contratar (Elenco PRO)','Monitorar (PRO)','Contratar (Titular Base)','Contratar (Elenco Base)','Monitorar (Base)','Avaliar no Grupo (Base)','Ver mais (sem opinião)','Arquivar']
const PRIORIDADES = ['Urgente','Moderado','Baixo','Não se aplica']
const SUGERE_RETORNO = ['Sim (Titular PRO)','Sim (Elenco PRO)','Sim (Titular Base)','Sim (Elenco Base)','Ver mais (sem opinião)','Não']
const POSICOES = ['Goleiro','Zagueiro (dir.)','Zagueiro (esq.)','Zagueiro (central)','Lateral (dir.)','Lateral (esq.)','Volante (1º)','Volante (2º)','Meia (Armador)','Meia (Ofensivo)','Meia Ponta (dir.)','Meia Ponta (esq.)','Atacante (Extremo dir.)','Atacante (Extremo esq.)','Centroavante (Tradicional)','Centroavante (Mobilidade)']
const PE_DOM = ['Direito','Esquerdo','Ambidestro','Não identificável']
const MATURACAO = ['Avançado','Normal','Tardio','Não identificável']
const NOTAS_CAPACIDADE = [10,9,8,7,6,5,4,3,2,1]

const CAP_FISICAS = ['Resistência','Potência/Aceleração','Agilidade/Mobilidade','Perfil/Força/Biotipo','Competitividade/Intensidade']
const CAP_TECNICAS = ['Passe curto/médio','Passe longo','Técnica da posição','Perna não dominante','Domínio/Controle de Bola','Desempenho na função','Comportamento sem bola','Inteligência/Tomada de decisão']

const OPCOES_PONTOS = ['Aceleração','Agilidade','Ambidestria','Biotipo','Bola Parada Cruzada','Bola Parada Direta','Cobertura','Condução','Construção de jogada','Cruzamento','Defesa Bola Parada','Defesa de fin. dentro da área','Defesa de fin. fora da área','Defesa Pênalti','Dinâmica de Jogo','Drible','Duelo Aéreo','Duelo Defensivo','Encurtar a marcação','Enfrentamento 1x1','Entendimento Tático','Envergadura','Finalização com a cabeça','Finalização com os pés','Força','Infiltração','Intensidade','Jogo com os pés','Jogo entre linhas','Liderança','Mobilidade','Movimentação sem bola','Olhar sobre o ombro','Outras Posições','Participação Defensiva','Passe','Passe Chave','Passe Longo','Pênalti','Pivô','Recepção e Proteção da bola','Recuperação','Refino Técnico','Reposição com as mãos','Reposição com os pés','Saída de Gol Aérea','Ultrapassagem','Velocidade','Velocidade de reação']

const EMPTY_JOGADOR = { numero:'', nome:'', posicao:'', nasc:'', gols:0, avaliar:false, time_nome:'' }
const EMPTY_AVALIACAO = {
  avaliacao_jogo:'', nota_jogo:'', cedido_clube:'Não', recomendacao:'', prioridade:'',
  sugere_retorno:'', altura:'', pe_preferido:'', nivel_maturacional:'', lesionou:'Não',
  pontos_fortes:['','','','',''], pontos_fracos:['','','','',''],
  obs_gerais:'', cig_previa:'', link_lances:'',
  cap_fisicas:{ resistencia:'', potencia:'', agilidade:'', biotipo:'', competitividade:'' },
  cap_tecnicas:{ perna_nao_dom:'', dominio:'', desempenho_funcao:'', comportamento_sem_bola:'', inteligencia:'' },
}

/* ─── HELPERS ───────────────────────────────────────────────────── */
const S = {
  label: { fontSize:10, fontWeight:700, color:'#52677e', marginBottom:4, display:'block' },
  input: { width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', cursor:'pointer' },
  btn: (color='#0a66b7', bg='transparent', border='#0a66b7') => ({
    padding:'7px 14px', borderRadius:8, border:`1.5px solid ${border}`, cursor:'pointer',
    fontFamily:'inherit', fontSize:11, fontWeight:700, color, background:bg, display:'inline-flex', alignItems:'center', gap:6,
  }),
  section: { background:'#f7fcf9', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'1px solid #e5edf5' },
  row: { display:'grid', gap:12 },
}

/* ─── AUTOCOMPLETE TIME ─────────────────────────────────────────── */
function TimeAutocomplete({ value, onChange, placeholder }) {
  const [q, setQ]           = useState(value || '')
  const [opts, setOpts]     = useState([])
  const [open, setOpen]     = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => { setQ(value || '') }, [value])

  async function buscar(texto) {
    setQ(texto)
    if (texto.length < 2) { setOpts([]); setOpen(false); return }
    const res = await fetch(`/api/times-db?q=${encodeURIComponent(texto)}`).then(r=>r.json())
    setOpts(res.times || [])
    setOpen(true)
  }

  async function criar(nome) {
    setCreating(true)
    const res = await fetch('/api/times-db', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nome }) }).then(r=>r.json())
    setCreating(false)
    setOpts([])
    setOpen(false)
    onChange(res.time?.nome || nome)
    setQ(res.time?.nome || nome)
  }

  const exact = opts.find(o => o.nome.toLowerCase() === q.toLowerCase())

  return (
    <div style={{ position:'relative' }}>
      <input value={q} placeholder={placeholder || 'Nome do time...'} style={S.input}
        onChange={e => buscar(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #d6e5f0', borderRadius:8, boxShadow:'0 4px 16px rgba(10,102,183,0.1)', zIndex:999, maxHeight:180, overflowY:'auto' }}>
          {opts.map(o => (
            <div key={o.id} onMouseDown={() => { onChange(o.nome); setQ(o.nome); setOpen(false) }}
              style={{ padding:'8px 12px', fontSize:11, cursor:'pointer', borderBottom:'1px solid #f4f8fc' }}
              onMouseEnter={e => e.target.style.background='#f0fdf4'}
              onMouseLeave={e => e.target.style.background='#fff'}>
              {o.nome}
            </div>
          ))}
          {q.length >= 2 && !exact && (
            <div onMouseDown={() => criar(q)} style={{ padding:'8px 12px', fontSize:11, cursor:'pointer', color:BRAND_PRIMARY, fontWeight:700, background:'#f0fdf4' }}>
              {creating ? 'Criando...' : `+ Cadastrar "${q}"`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── AUTOCOMPLETE JOGADOR ──────────────────────────────────────── */
function JogadorAutocomplete({ value, timeNome, onChange }) {
  const [q, setQ]       = useState(value || '')
  const [opts, setOpts] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setQ(value || '') }, [value])

  useEffect(() => {
    // Carregar jogadores do time quando time muda
    if (!timeNome) return
    async function load() {
      const timeRes = await fetch(`/api/times-db?q=${encodeURIComponent(timeNome)}`).then(r=>r.json())
      const time = (timeRes.times||[])[0]
      if (!time) return
      const jRes = await fetch(`/api/times-db?time_id=${time.id}`).then(r=>r.json())
      setOpts(jRes.jogadores || [])
    }
    load()
  }, [timeNome])

  return (
    <div style={{ position:'relative' }}>
      <input value={q} placeholder='Nome do jogador...' style={S.input}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && opts.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #d6e5f0', borderRadius:8, boxShadow:'0 4px 16px rgba(10,102,183,0.1)', zIndex:999, maxHeight:160, overflowY:'auto' }}>
          {opts.filter(o => o.nome.toLowerCase().includes(q.toLowerCase())).map(o => (
            <div key={o.id} onMouseDown={() => { onChange(o.nome, o); setQ(o.nome); setOpen(false) }}
              style={{ padding:'7px 12px', fontSize:11, cursor:'pointer', borderBottom:'1px solid #f4f8fc' }}
              onMouseEnter={e => e.target.style.background='#f0fdf4'}
              onMouseLeave={e => e.target.style.background='#fff'}>
              <span style={{ fontWeight:700 }}>{o.nome}</span>
              <span style={{ color:'#94a3b8', marginLeft:6 }}>{o.posicao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── LINHA DE JOGADOR NA SÚMULA ────────────────────────────────── */
function JogadorRow({ j, idx, onChange, time, label }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 130px 90px 60px 50px 36px', gap:6, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f4f8fc' }}>
      <input type='number' value={j.numero} placeholder='Nº' style={{ ...S.input, textAlign:'center', padding:'6px 4px' }}
        onChange={e => onChange(idx, 'numero', e.target.value)} />
      <JogadorAutocomplete value={j.nome} timeNome={j.time_nome || time}
        onChange={(nome, jObj) => {
          onChange(idx, 'nome', nome)
          if (jObj) {
            onChange(idx, 'posicao', jObj.posicao || j.posicao)
            onChange(idx, 'pe', jObj.pe || j.pe)
            onChange(idx, 'altura', jObj.altura || j.altura)
            onChange(idx, 'nasc', jObj.nascimento || j.nasc)
          }
        }} />
      <select value={j.posicao} style={S.select} onChange={e => onChange(idx, 'posicao', e.target.value)}>
        <option value=''>Posição</option>
        {POSICOES.map(p => <option key={p}>{p}</option>)}
      </select>
      <input value={j.nasc} placeholder='Nasc.' style={{ ...S.input, fontSize:10 }}
        onChange={e => onChange(idx, 'nasc', e.target.value)} />
      <input type='number' min={0} value={j.gols} placeholder='⚽' style={{ ...S.input, textAlign:'center', padding:'6px 4px' }}
        onChange={e => onChange(idx, 'gols', +e.target.value)} />
      <button title={j.avaliar ? 'Remover avaliação' : 'Avaliar jogador'}
        onClick={() => onChange(idx, 'avaliar', !j.avaliar)}
        style={{ ...S.btn(j.avaliar ? '#fff' : BRAND_PRIMARY, j.avaliar ? BRAND_PRIMARY : '#f0fdf4', BRAND_PRIMARY), width:32, height:32, padding:0, justifyContent:'center', borderRadius:8, flexShrink:0 }}>
        {j.avaliar ? '★' : '☆'}
      </button>
    </div>
  )
}

/* ─── FORM DE AVALIAÇÃO POR JOGADOR ─────────────────────────────── */
function AvaliacaoForm({ jogador, avaliacao, onChange }) {
  const upd = (campo, val) => onChange({ ...avaliacao, [campo]: val })
  const updCF = (k, v) => onChange({ ...avaliacao, cap_fisicas: { ...avaliacao.cap_fisicas, [k]: v } })
  const updCT = (k, v) => onChange({ ...avaliacao, cap_tecnicas: { ...avaliacao.cap_tecnicas, [k]: v } })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Cabeçalho Atleta */}
      <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:12, borderBottom:'2px solid #e5edf5' }}>
        <div style={{ width:48, height:48, borderRadius:12, background:BRAND_PRIMARY, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900 }}>{jogador.numero||'?'}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <h3 style={{ fontSize:16, fontWeight:900, color:DARK, margin:0 }}>{jogador.nome}</h3>
            {jogador.gols > 0 && (
              <span style={{
                display:'inline-flex', alignItems:'center', gap:4,
                background:'#dcfce7', color:'#166534', border:'1.5px solid #86efac',
                borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:800,
              }}>
                ⚽ {jogador.gols > 1 ? `${jogador.gols} gols` : '1 gol'}
              </span>
            )}
          </div>
          <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{jogador.posicao} · {jogador.time_nome}</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={S.section}>
          <p style={{ fontSize:12, fontWeight:800, color:BRAND_PRIMARY, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>📊 Avaliação do Jogo</p>
          <div style={{ ...S.row, gridTemplateColumns:'1fr 1fr' }}>
            <div>
              <label style={S.label}>Desempenho</label>
              <select value={avaliacao.avaliacao_jogo} style={S.select} onChange={e => upd('avaliacao_jogo', e.target.value)}>
                <option value=''>Selecionar...</option>
                {AVALIACOES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Nota</label>
              <select value={avaliacao.nota_jogo} style={S.select} onChange={e => upd('nota_jogo', e.target.value)}>
                <option value=''>Selecionar...</option>
                {NOTAS.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...S.row, gridTemplateColumns:'1fr 1fr', marginTop:12 }}>
             <div>
              <label style={S.label}>Recomendação</label>
              <select value={avaliacao.recomendacao} style={S.select} onChange={e => upd('recomendacao', e.target.value)}>
                <option value=''>Selecionar...</option>
                {RECOMENDACOES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Prioridade</label>
              <select value={avaliacao.prioridade} style={S.select} onChange={e => upd('prioridade', e.target.value)}>
                <option value=''>Selecionar...</option>
                {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={S.section}>
          <p style={{ fontSize:12, fontWeight:800, color:BRAND_PRIMARY, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>👤 Perfil Físico/Técnico</p>
          <div style={{ ...S.row, gridTemplateColumns:'1fr 1fr 1fr' }}>
            <div>
              <label style={S.label}>Altura (cm)</label>
              <input value={avaliacao.altura} placeholder='Ex: 185' style={S.input} onChange={e => upd('altura', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Pé Pref.</label>
              <select value={avaliacao.pe_preferido} style={S.select} onChange={e => upd('pe_preferido', e.target.value)}>
                <option value=''>Selecionar...</option>
                {PE_DOM.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Maturacional</label>
              <select value={avaliacao.nivel_maturacional} style={S.select} onChange={e => upd('nivel_maturacional', e.target.value)}>
                <option value=''>Selecionar...</option>
                {MATURACAO.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <label style={S.label}>Sugere Retorno?</label>
            <select value={avaliacao.sugere_retorno} style={S.select} onChange={e => upd('sugere_retorno', e.target.value)}>
              <option value=''>Selecionar...</option>
              {SUGERE_RETORNO.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Capacidades */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={S.section}>
          <p style={{ fontSize:11, fontWeight:800, color:BRAND_PRIMARY, marginBottom:10 }}>⚡ Capacidades Físicas (1-10)</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['resistencia','Resistência'],['potencia','Potência'],['agilidade','Agilidade'],['biotipo','Biotipo'],['competitividade','Intensidade']].map(([k,l]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', padding:'4px 8px', borderRadius:6, border:'1px solid #eef6f1' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#52677e' }}>{l}</span>
                <select value={avaliacao.cap_fisicas?.[k]||''} style={{ border:'none', fontSize:10, fontWeight:700, color:BRAND_PRIMARY, background:'transparent', outline:'none' }} onChange={e => updCF(k, e.target.value)}>
                  <option value=''>-</option>
                  {NOTAS_CAPACIDADE.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div style={S.section}>
          <p style={{ fontSize:11, fontWeight:800, color:BRAND_PRIMARY, marginBottom:10 }}>⚽ Capacidades Técnicas (1-10)</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['passe_curto','Passe Curto'],['passe_longo','Passe Longo'],['tecnica_posicao','Técnica Pos.'],['perna_nao_dom','Perna Ñ Dom.'],['dominio','Domínio'],['desempenho_funcao','Desempenho'],['comportamento_sem_bola','S/ Bola'],['inteligencia','Decisão']].map(([k,l]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', padding:'4px 8px', borderRadius:6, border:'1px solid #eef6f1' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#52677e' }}>{l}</span>
                <select value={avaliacao.cap_tecnicas?.[k]||''} style={{ border:'none', fontSize:10, fontWeight:700, color:BRAND_PRIMARY, background:'transparent', outline:'none' }} onChange={e => updCT(k, e.target.value)}>
                  <option value=''>-</option>
                  {NOTAS_CAPACIDADE.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pontos Fortes e Fracos */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={S.section}>
          <p style={{ fontSize:11, fontWeight:800, color:'#166534', marginBottom:8 }}>✅ Pontos Fortes</p>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(avaliacao.pontos_fortes||[]).map((v, i) => (
              <select key={i} value={v} style={S.select} onChange={e => {
                const arr = [...avaliacao.pontos_fortes]; arr[i] = e.target.value; upd('pontos_fortes', arr)
              }}>
                <option value=''>Selecionar ponto forte...</option>
                {OPCOES_PONTOS.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>
        <div style={S.section}>
          <p style={{ fontSize:11, fontWeight:800, color:'#991b1b', marginBottom:8 }}>❌ Pontos Fracos</p>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(avaliacao.pontos_fracos||[]).map((v, i) => (
              <select key={i} value={v} style={S.select} onChange={e => {
                const arr = [...avaliacao.pontos_fracos]; arr[i] = e.target.value; upd('pontos_fracos', arr)
              }}>
                <option value=''>Selecionar ponto fraco...</option>
                {OPCOES_PONTOS.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      <div style={S.section}>
        <label style={S.label}>Observações Gerais / CIC Prévia</label>
        <textarea value={avaliacao.obs_gerais} style={{ ...S.input, height:80, resize:'none' }} onChange={e => upd('obs_gerais', e.target.value)} placeholder='Descreva o comportamento, potencial e observações relevantes...' />
      </div>

      <div style={{ ...S.section, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
        <label style={{ ...S.label, color:'#1e40af' }}>🎬 Lances do Jogador — Link para a Comissão</label>
        <input
          value={avaliacao.link_lances || ''}
          onChange={e => upd('link_lances', e.target.value)}
          style={{ ...S.input, borderColor:'#bfdbfe' }}
          placeholder='Cole aqui o link (YouTube, Drive, Streamable, etc.)'
        />
        {avaliacao.link_lances && (
          <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
            <a
              href={avaliacao.link_lances}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize:11, fontWeight:700, color:'#1e40af', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}
            >
              ▶ Abrir lances
            </a>
            <span style={{ fontSize:10, color:'#94a3b8' }}>(abre em nova aba)</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── IMPORTAR ESCALAÇÃO RÁPIDA ─────────────────────────────────── */

// Normaliza posição para bater com a lista POSICOES
// Aceita tanto "Volante (1º)" quanto "Volante (1o)" e retorna a forma canônica
function normalizarPosicao(raw) {
  if (!raw) return ''
  // Remove o tempo do fim: "(52')" ou "(52′)"
  let p = raw.replace(/\s*\(\d+[''′]\)\s*$/, '').trim()

  // 1. Tenta match exato (case-insensitive)
  const exato = POSICOES.find(pos => pos.toLowerCase() === p.toLowerCase())
  if (exato) return exato

  // 2. Tenta match normalizando º↔o em ambos os lados
  const normP    = p.replace(/[°º]/g, 'o').replace(/\bo\b/g, 'o').toLowerCase()
  const normMatch = POSICOES.find(pos => {
    const normPos = pos.replace(/[°º]/g, 'o').toLowerCase()
    return normPos === normP
  })
  if (normMatch) return normMatch

  // 3. Tenta match parcial
  const parcial = POSICOES.find(pos =>
    pos.toLowerCase().includes(p.toLowerCase()) ||
    p.toLowerCase().includes(pos.toLowerCase().split('(')[0].trim())
  )
  return parcial || p
}

function parsearEscalacao(txt) {
  const linhas = txt.split('\n').map(l => l.trim()).filter(Boolean)
  const titulares = []
  const reservas  = []
  let secaoAtual  = 'titulares'

  for (const linha of linhas) {
    // Detectar seção de reservas/substituições
    if (/^(entraram|reservas|substitui[çc][oõ]es|banco|subs?)[\s:.]*/i.test(linha)) {
      secaoAtual = 'reservas'
      continue
    }
    // Deve começar com número
    if (!/^\d/.test(linha)) continue

    // Formato principal: "1 Ortega — Goleiro" ou "1 Marlon Sierra — Meia (Armador) (52')"
    // Separador pode ser: —  –  -  |  (espaços ao redor)
    const matchComPos = linha.match(/^(\d{1,3})\s+(.+?)\s+[—–\-|]\s+(.+)$/)
    if (matchComPos) {
      const [, numero, nome, posRaw] = matchComPos
      // Extrair tempo se vier no fim: "(52')"
      const tempoMatch = posRaw.match(/\s*\((\d+)[''′]\)\s*$/)
      const tempo      = tempoMatch ? tempoMatch[1] : null
      const posicao    = normalizarPosicao(posRaw)
      const jogador    = { numero, nome: nome.trim(), posicao, ...(tempo ? { minuto_entrada: tempo } : {}) }
      secaoAtual === 'titulares' ? titulares.push(jogador) : reservas.push(jogador)
      continue
    }

    // Fallback: sem posição — só "1 Fulano"
    const matchSimples = linha.match(/^(\d{1,3})[.\s]+(.+)$/)
    if (matchSimples) {
      const jogador = { numero: matchSimples[1], nome: matchSimples[2].trim(), posicao: '' }
      secaoAtual === 'titulares' ? titulares.push(jogador) : reservas.push(jogador)
    }
  }

  // Se não encontrou seção "Entraram:" mas há mais de 11, overflow vai p/ reservas
  if (secaoAtual === 'titulares' && titulares.length > 11) {
    return { titulares: titulares.slice(0, 11), reservas: titulares.slice(11) }
  }

  return { titulares, reservas }
}

function ImportarEscalacaoModal({ timeName, onImport, onClose }) {
  const [texto, setTexto]   = useState('')
  const [parsed, setParsed] = useState({ titulares: [], reservas: [] })

  useEffect(() => {
    setParsed(parsearEscalacao(texto))
  }, [texto])

  const total = parsed.titulares.length + parsed.reservas.length

  function confirmar() {
    onImport(parsed)
    onClose()
  }

  const lineStyle = { display:'flex', gap:8, fontSize:10, padding:'3px 0', borderBottom:'1px solid #e8f5ee', alignItems:'center' }
  const numStyle  = { width:24, textAlign:'right', color:'#94a3b8', fontWeight:700, flexShrink:0 }
  const nomStyle  = { fontWeight:700, color:'#10233b', minWidth:120 }
  const posStyle  = { color:'#0a66b7', fontSize:9, background:'#f0fdf4', padding:'1px 5px', borderRadius:4 }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div style={{ position:'relative', background:'#fff', borderRadius:16, width:'min(620px,96vw)', padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:900, color:'#10233b', margin:0 }}>⚡ Importar Escalação</h3>
            <p style={{ fontSize:11, color:'#94a3b8', margin:'3px 0 0' }}>{timeName}</p>
          </div>
          <button onClick={onClose} style={{ background:'#f0fdf4', border:'none', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {/* Dica de formato */}
        <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px', marginBottom:10, border:'1px solid #d6e5f0', fontSize:10, color:'#52677e', lineHeight:1.8 }}>
          <strong>Formato aceito:</strong><br/>
          <code style={{ background:'#e0f0e8', padding:'1px 4px', borderRadius:3 }}>1 Ortega — Goleiro</code>{'  '}
          <code style={{ background:'#e0f0e8', padding:'1px 4px', borderRadius:3 }}>77 Rincón — Meia Ponta (dir.)</code><br/>
          Reservas abaixo da linha <code style={{ background:'#e0f0e8', padding:'1px 4px', borderRadius:3 }}>Entraram:</code>{'  '}
          com ou sem o minuto: <code style={{ background:'#e0f0e8', padding:'1px 4px', borderRadius:3 }}>6 Marlon Sierra — Meia (Armador) (52')</code>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1, minHeight:0 }}>
          {/* Textarea */}
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={`Cole aqui...\n\n1 Ortega — Goleiro\n21 Meza — Lateral (dir.)\n...\nEntraram:\n6 Marlon Sierra — Meia (Armador) (52')`}
            style={{ width:'100%', height:'100%', minHeight:260, padding:'10px 12px', borderRadius:10, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'monospace', resize:'none', outline:'none', boxSizing:'border-box' }}
            autoFocus
          />

          {/* Preview */}
          <div style={{ overflowY:'auto', maxHeight:300 }}>
            {total === 0 ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#b0c8b8', fontSize:12 }}>
                Preview aparece aqui...
              </div>
            ) : (
              <>
                {parsed.titulares.length > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <p style={{ fontSize:10, fontWeight:800, color:'#0a66b7', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:0.5 }}>
                      Titulares ({parsed.titulares.length})
                    </p>
                    {parsed.titulares.map((j, i) => (
                      <div key={i} style={lineStyle}>
                        <span style={numStyle}>{j.numero}</span>
                        <span style={nomStyle}>{j.nome}</span>
                        {j.posicao && <span style={posStyle}>{j.posicao}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {parsed.reservas.length > 0 && (
                  <div>
                    <p style={{ fontSize:10, fontWeight:800, color:'#b45309', margin:'8px 0 6px', textTransform:'uppercase', letterSpacing:0.5 }}>
                      Entraram ({parsed.reservas.length})
                    </p>
                    {parsed.reservas.map((j, i) => (
                      <div key={i} style={lineStyle}>
                        <span style={numStyle}>{j.numero}</span>
                        <span style={nomStyle}>{j.nome}</span>
                        {j.posicao && <span style={posStyle}>{j.posicao}</span>}
                        {j.minuto_entrada && <span style={{ fontSize:9, color:'#94a3b8' }}>{j.minuto_entrada}'</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#94a3b8' }}>
            {total > 0 ? `${parsed.titulares.length} titular(es) · ${parsed.reservas.length} reserva(s)` : 'Cole a escalação ao lado'}
          </span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #c0d8c4', background:'transparent', cursor:'pointer', fontSize:12, fontWeight:700, color:'#64748b' }}>Cancelar</button>
            <button onClick={confirmar} disabled={total === 0}
              style={{ padding:'8px 22px', borderRadius:8, border:'none', background: total > 0 ? '#0a66b7' : '#ccc', color:'#fff', cursor: total > 0 ? 'pointer' : 'default', fontSize:12, fontWeight:700 }}>
              ⚡ Importar {total > 0 ? `(${total})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── MODAL PRINCIPAL ───────────────────────────────────────────── */
export default function RelatorioModal({ jogo, onClose, onSaved, canEdit = true }) {
  const [aba, setAba]           = useState('cabecalho')
  const [exportando, setExportando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [ready, setReady]           = useState(false) // Bloqueio de auto-save até carregar do banco

  // Estados do formulário
  const [competicao, setCompeticao] = useState(jogo.comp || '')
  const [temporada, setTemporada]   = useState(new Date().getFullYear().toString())
  const [timeMandante, setTimeMandante] = useState(jogo.mandante || '')
  const [timeVisitante, setTimeVisitante] = useState(jogo.visitante || '')
  const [dataJogo, setDataJogo]     = useState(jogo.data || '')
  const [local, setLocal]           = useState('')
  const [inLoco, setInLoco]         = useState('Não')
  const [observador, setObservador] = useState(jogo.scout || '')
  const [nivelGramado, setNivelGramado] = useState('7')
  const [nivelJogo, setNivelJogo]       = useState('7')
  const [nivelComp, setNivelComp]       = useState('7')
  const [qualVideo, setQualVideo]       = useState('7')
  const [obsPartida, setObsPartida]     = useState('')
  const [gols_mandante, setGolsMandante] = useState('')
  const [gols_visitante, setGolsVisitante] = useState('')

  const [sumulaM, setSumulaM] = useState([...Array(11)].map(()=>({...EMPTY_JOGADOR, time_nome:jogo.mandante})))
  const [resM, setResM]       = useState([...Array(7)].map(()=>({...EMPTY_JOGADOR, time_nome:jogo.mandante})))
  const [sumulaV, setSumulaV] = useState([...Array(11)].map(()=>({...EMPTY_JOGADOR, time_nome:jogo.visitante})))
  const [resV, setResV]       = useState([...Array(7)].map(()=>({...EMPTY_JOGADOR, time_nome:jogo.visitante})))

  const [avaliacoes, setAvaliacoes] = useState({}) // { 'Nome do Jogador': { ...EMPTY_AVALIACAO } }
  const [importarModal, setImportarModal] = useState(null) // 'M' | 'V' | null

  // Importar escalação rápida
  function handleImportarEscalacao(side, parsed) {
    const timeName = side === 'M' ? timeMandante : timeVisitante
    const setter    = side === 'M' ? setSumulaM : setSumulaV
    const resSetter = side === 'M' ? setResM    : setResV

    const toJogador = (j) => ({ ...EMPTY_JOGADOR, numero: j.numero||'', nome: j.nome||'', posicao: j.posicao||'', time_nome: timeName })

    // Titulares: garante sempre 11 slots
    const titulares = parsed.titulares.slice(0, 11).map(toJogador)
    while (titulares.length < 11) titulares.push({ ...EMPTY_JOGADOR, time_nome: timeName })
    setter(titulares)

    // Reservas: garante pelo menos 7 slots
    if (parsed.reservas.length > 0) {
      const reservas = parsed.reservas.map(toJogador)
      while (reservas.length < 7) reservas.push({ ...EMPTY_JOGADOR, time_nome: timeName })
      resSetter(reservas)
    }
  }

  // Carregar dados se já existirem
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/relatorio-partida?match_key=${jogo.match_key}`).then(r=>r.json())
        if (res.relatorio) {
          const row = res.relatorio          // linha do banco (colunas: mandante, visitante, competicao, data_jogo...)
          const det = row.relatorio || {}    // JSONB com os dados detalhados (súmulas, avaliações, etc.)

          // Colunas diretas do banco têm prioridade; fallback para o JSONB
          setCompeticao(row.competicao   || det.competicao   || jogo.comp)
          setTemporada(det.temporada     || '')
          setTimeMandante(row.mandante   || det.mandante     || jogo.mandante)
          setTimeVisitante(row.visitante || det.visitante    || jogo.visitante)
          setDataJogo(row.data_jogo      || det.data_jogo    || jogo.data)
          setLocal(det.local             || '')
          setInLoco(det.in_loco          || 'Não')
          setObservador(det.observador   || jogo.scout)
          setNivelGramado(det.nivel_gramado || '7')
          setNivelJogo(det.nivel_jogo    || '7')
          setNivelComp(det.nivel_comp    || '7')
          setQualVideo(det.qual_video    || '7')
          setObsPartida(det.obs_partida  || '')
          setGolsMandante(det.gols_mandante  ?? '')
          setGolsVisitante(det.gols_visitante ?? '')
          if (det.sumula_mandante)    setSumulaM(det.sumula_mandante)
          if (det.reservas_mandante)  setResM(det.reservas_mandante)
          if (det.sumula_visitante)   setSumulaV(det.sumula_visitante)
          if (det.reservas_visitante) setResV(det.reservas_visitante)

          const avs = {}
          const all = [...(det.sumula_mandante_avaliados||[]), ...(det.sumula_visitante_avaliados||[])]
          all.forEach(a => { avs[a.nome] = a })
          setAvaliacoes(avs)
        }
      } catch (e) { console.error(e) }
      setReady(true)
    }
    load()
  }, [jogo.match_key])

  // Auto-save ao trocar de aba (SÓ SE JÁ CARREGOU OS DADOS)
  useEffect(() => {
    if (ready && (aba !== 'cabecalho')) { 
       autoSave()
    }
  }, [aba])

  // Monta o body correto para a API: colunas do banco separadas do JSONB
  function buildPayload() {
    const det = buildRelatorio()
    return {
      match_key:  det.match_key,
      mandante:   det.mandante,
      visitante:  det.visitante,
      competicao: det.competicao,
      data_jogo:  det.data_jogo,
      relatorio:  det,   // tudo salvo no JSONB
    }
  }

  async function autoSave() {
    if (salvando || !ready) return
    if (!timeMandante || !timeVisitante) return

    setSalvando(true)
    try {
      await fetch('/api/relatorio-partida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      })
    } catch (e) {
      console.error('Erro no auto-save:', e)
    } finally {
      setSalvando(false)
    }
  }

  const handleSumulaChange = (setter, list, idx, field, val) => {
    const newList = [...list]
    newList[idx] = { ...newList[idx], [field]: val }
    setter(newList)
  }

  const buildRelatorio = () => {
    const filterAv = (list) => list.filter(j => j.avaliar && j.nome).map(j => ({
      ...j,
      ...(avaliacoes[j.nome] || EMPTY_AVALIACAO),
      time_nome: j.time_nome
    }))

    return {
      match_key: jogo.match_key,
      competicao, temporada, mandante:timeMandante, visitante:timeVisitante, data_jogo:dataJogo,
      local, in_loco:inLoco, observador, nivel_gramado:nivelGramado, nivel_jogo:nivelJogo,
      nivel_comp:nivelComp, qual_video:qualVideo, obs_partida:obsPartida,
      gols_mandante, gols_visitante,
      sumula_mandante: sumulaM, reservas_mandante: resM,
      sumula_visitante: sumulaV, reservas_visitante: resV,
      sumula_mandante_avaliados: filterAv([...sumulaM, ...resM]),
      sumula_visitante_avaliados: filterAv([...sumulaV, ...resV]),
    }
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
      const res = await fetch('/api/relatorio-partida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      })
      if (res.ok) onSaved()
      else alert('Erro ao salvar relatório')
    } catch (e) { console.error(e); alert('Erro de conexão') }
    setSalvando(false)
  }

  const paraAvaliar = [
    ...sumulaM.filter(j=>j.avaliar && j.nome).map(j=>({...j, side:'M'})),
    ...resM.filter(j=>j.avaliar && j.nome).map(j=>({...j, side:'M'})),
    ...sumulaV.filter(j=>j.avaliar && j.nome).map(j=>({...j, side:'V'})),
    ...resV.filter(j=>j.avaliar && j.nome).map(j=>({...j, side:'V'})),
  ]

  // Exportar PDF
  async function exportarPDF() {
    setExportando(true)
    try {
      const rel = buildRelatorio()

      // ── Imports robustos (jsPDF v4 = named export; v2-3 = default) ──
      const jspdfMod  = await import('jspdf')
      const jsPDF     = jspdfMod.jsPDF ?? jspdfMod.default
      const atMod     = await import('jspdf-autotable')
      const autoTable = atMod.autoTable ?? atMod.default

      // ── Escudo do Confiança (carregado do /public) ──
      let escudoDataUrl = null
      try {
        const r = await fetch('/confianca.png')
        const blob = await r.blob()
        escudoDataUrl = await new Promise(res => {
          const reader = new FileReader()
          reader.onload = () => res(reader.result)
          reader.readAsDataURL(blob)
        })
      } catch (_) { /* continua sem logo se falhar */ }

      const doc   = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const W     = doc.internal.pageSize.getWidth()
      const H     = doc.internal.pageSize.getHeight()
      const M     = 13
      const GREEN  = [10, 102, 183]
      const LGREEN = [240, 253, 244]
      let y = 0

      const newPage = () => { doc.addPage(); y = M }
      const check   = (n = 24) => { if (y + n > H - 14) newPage() }

      // ── Cabeçalho reutilizável (chamado após cada addPage) ──
      const HEADER_H = 38
      const drawHeader = () => {
        doc.setFillColor(...GREEN)
        doc.rect(0, 0, W, HEADER_H, 'F')
        // Escudo
        if (escudoDataUrl) {
          try { doc.addImage(escudoDataUrl, 'PNG', M, 4, 14, 14) } catch (_) {}
        }
        const xText = escudoDataUrl ? M + 17 : M
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
        doc.text('CIC CONFIANÇA  ·  RELATÓRIO DE OBSERVAÇÃO', xText, 10)
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
        doc.text(`${rel.competicao || ''} - ${rel.temporada || ''}  -  ${rel.data_jogo || ''}`, xText, 16)
        // Placar central
        const gmText = rel.gols_mandante !== '' && rel.gols_mandante != null ? rel.gols_mandante : '-'
        const gvText = rel.gols_visitante !== '' && rel.gols_visitante != null ? rel.gols_visitante : '-'
        doc.setFontSize(18); doc.setFont('helvetica', 'bold')
        doc.text(`${rel.mandante}  ${gmText} x ${gvText}  ${rel.visitante}`, W / 2, 26, { align: 'center' })
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
        doc.text(`Obs: ${rel.observador || '-'}  -  ${rel.in_loco === 'Sim' ? 'In Loco' : 'Video'}  -  Local: ${rel.local || '-'}`, W / 2, 33, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }

      const tbl = (opts) => {
        autoTable(doc, { ...opts, startY: y })
        y = (doc.lastAutoTable?.finalY ?? y + 16) + 5
      }

      // Adiciona cabeçalho nas páginas subsequentes com menos destaque
      const drawSubHeader = () => {
        doc.setFillColor(...GREEN)
        doc.rect(0, 0, W, 14, 'F')
        if (escudoDataUrl) {
          try { doc.addImage(escudoDataUrl, 'PNG', M, 2, 10, 10) } catch (_) {}
        }
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7); doc.setFont('helvetica', 'bold')
        doc.text(`CIC Confiança  ·  ${rel.mandante} x ${rel.visitante}  ·  ${rel.data_jogo || ''}`, M + (escudoDataUrl ? 13 : 0), 9)
        doc.setTextColor(0, 0, 0)
        y = 18
      }

      const newPageWithHeader = () => {
        doc.addPage()
        drawSubHeader()
      }
      const checkP = (n = 24) => { if (y + n > H - 14) newPageWithHeader() }

      // ── Helper: idade a partir de nasc ────────────────────────────────
      const calcIdade = (nasc) => {
        if (!nasc) return null
        let d
        if (/^\d{4}-\d{2}-\d{2}$/.test(nasc))       d = new Date(nasc + 'T12:00')
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(nasc)) { const [dd,mm,yy]=nasc.split('/'); d=new Date(`${yy}-${mm}-${dd}T12:00`) }
        else if (/^\d{2}\.\d{2}\.\d{4}$/.test(nasc)) { const [dd,mm,yy]=nasc.split('.'); d=new Date(`${yy}-${mm}-${dd}T12:00`) }
        else return null
        if (!d || isNaN(d.getTime())) return null
        const now = new Date()
        let age = now.getFullYear() - d.getFullYear()
        if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
        return (age > 0 && age < 60) ? age : null
      }

      // ── PAGINA 1: CAPA ────────────────────────────────────────────────
      drawHeader()
      y = HEADER_H + 6

      // Goleadores
      const goleadores = [
        ...(rel.sumula_mandante   || []).filter(j => j.gols > 0).map(j => ({ ...j, time: rel.mandante })),
        ...(rel.reservas_mandante || []).filter(j => j.gols > 0).map(j => ({ ...j, time: rel.mandante })),
        ...(rel.sumula_visitante  || []).filter(j => j.gols > 0).map(j => ({ ...j, time: rel.visitante })),
        ...(rel.reservas_visitante|| []).filter(j => j.gols > 0).map(j => ({ ...j, time: rel.visitante })),
      ]
      if (goleadores.length) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
        doc.text('GOLEADORES', M, y); y += 5
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); doc.setFontSize(8)
        goleadores.forEach(g => {
          const vezes = g.gols > 1 ? ` (x${g.gols})` : ''
          doc.text(`${g.nome}${vezes}  —  ${g.time}`, M + 4, y)
          y += 4.5
        })
        y += 4
      }

      // ── CAMPINHO ──────────────────────────────────────────────────────
      const pX = M, pY = y, pW = W - M * 2, pH = 94
      // Campo verde
      doc.setFillColor(34, 130, 65)
      doc.roundedRect(pX, pY, pW, pH, 3, 3, 'F')
      // Linhas
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3)
      doc.line(pX + pW / 2, pY + 4, pX + pW / 2, pY + pH - 4)   // linha do meio
      doc.circle(pX + pW / 2, pY + pH / 2, 8, 'S')               // círculo central
      const aW = 22, aH = 38
      doc.rect(pX + 1, pY + (pH - aH) / 2, aW, aH, 'S')          // área esquerda
      doc.rect(pX + pW - aW - 1, pY + (pH - aH) / 2, aW, aH, 'S')// área direita
      // Nomes dos times
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
      doc.text((rel.mandante || '').substring(0, 20), pX + pW / 4, pY + 7, { align: 'center' })
      doc.text((rel.visitante || '').substring(0, 20), pX + pW * 3 / 4, pY + 7, { align: 'center' })

      // ── Desenhar jogadores no campo ──────────────────────────────────
      // Coordenadas táticas por posição (X: 0=esq, 100=dir; Y: 0=defesa, 100=ataque)
      const POS_COORDS = {
        'Goleiro':                    { x: 50, y:  4 },
        'Zagueiro (dir.)':            { x: 70, y: 16 },
        'Zagueiro (esq.)':            { x: 30, y: 16 },
        'Zagueiro (central)':         { x: 50, y: 16 },
        'Lateral (dir.)':             { x: 88, y: 28 },
        'Lateral (esq.)':             { x: 12, y: 28 },
        'Volante (1º)':               { x: 50, y: 36 },
        'Volante (2º)':               { x: 50, y: 46 },
        'Meia (Armador)':             { x: 50, y: 50 },
        'Meia (Ofensivo)':            { x: 50, y: 62 },
        'Meia Ponta (dir.)':          { x: 76, y: 62 },
        'Meia Ponta (esq.)':          { x: 24, y: 62 },
        'Atacante (Extremo dir.)':    { x: 86, y: 78 },
        'Atacante (Extremo esq.)':    { x: 14, y: 78 },
        'Centroavante (Tradicional)': { x: 50, y: 86 },
        // retrocompat — não está mais no seletor mas pode existir em dados antigos
        'Volante (1o)':               { x: 50, y: 36 },
        'Volante (2o)':               { x: 50, y: 46 },
        'Centroavante (Mobilidade)':  { x: 50, y: 80 },
      }

      const drawTeamOnPitch = (sumula, lado) => {
        const players = (sumula || []).filter(j => j.nome && j.nome.trim()).slice(0, 11)
        if (!players.length) return

        // Contar quantas vezes cada posição aparece (para offset em duplicatas)
        const posCount = {}

        players.forEach(j => {
          const pos = j.posicao || ''
          let coords = POS_COORDS[pos]

          // Fallback se posição não encontrada no mapa
          if (!coords) {
            const p = pos.toLowerCase()
            if (p.includes('goleiro'))                            coords = { x: 50, y: 5  }
            else if (p.includes('zagueiro'))                      coords = { x: 50, y: 16 }
            else if (p.includes('lateral'))                       coords = { x: 50, y: 28 }
            else if (p.includes('volante'))                       coords = { x: 50, y: 38 }
            else if (p.includes('meia'))                          coords = { x: 50, y: 55 }
            else if (p.includes('atacante') || p.includes('extremo')) coords = { x: 50, y: 78 }
            else                                                  coords = { x: 50, y: 82 }
          }

          // Offset para duplicatas da mesma posição
          const dupIdx = posCount[pos] || 0
          posCount[pos] = dupIdx + 1
          let fieldX = coords.x
          const fieldY = coords.y
          if (dupIdx > 0) {
            const shift = 14 * Math.ceil(dupIdx / 2) * (dupIdx % 2 === 0 ? -1 : 1)
            fieldX = Math.max(6, Math.min(94, fieldX + shift))
          }

          // Para o visitante, espelhar o eixo X (esq/dir trocam de lado)
          const worldX = lado === 'L' ? fieldX : 100 - fieldX
          const worldY = fieldY

          // Converter coordenadas táticas (0-100) para pixels no campinho
          // Horizontal: Y de futebol → eixo horizontal do campinho (0=perto do gol, 100=ataque)
          // Vertical:   X de futebol → eixo vertical do campinho (0=esquerda, 100=direita)
          let xPx, yPx
          if (lado === 'L') {
            xPx = pX + 5 + (worldY / 100) * (pW / 2 - 10)
          } else {
            xPx = pX + pW - 5 - (worldY / 100) * (pW / 2 - 10)
          }
          yPx = pY + 11 + (worldX / 100) * (pH - 20)

          // Círculo do jogador
          doc.setFillColor(j.avaliar ? 255 : 255, j.avaliar ? 140 : 255, j.avaliar ? 0 : 255)
          doc.circle(xPx, yPx, 2.2, 'F')

          // Indicador de gol: ponto verde "G"
          if (j.gols > 0) {
            doc.setFillColor(50, 220, 90)
            doc.circle(xPx + 3, yPx - 2.5, 1.4, 'F')
            doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
            doc.text('G', xPx + 3, yPx - 1.8, { align: 'center' })
          }

          // Nome (sobrenome)
          doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255)
          const sobrenome = (j.nome || '').split(' ').pop().substring(0, 11)
          doc.text(sobrenome, xPx, yPx + 5.2, { align: 'center' })
        })
      }

      drawTeamOnPitch(rel.sumula_mandante, 'L')
      drawTeamOnPitch(rel.sumula_visitante, 'R')

      // Legenda
      doc.setTextColor(0, 0, 0)
      y = pY + pH + 5
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor('#555555')
      doc.text('Legenda:  Círculo laranja = Avaliado   Ponto verde G = Gol', M, y)
      y += 7

      // ── SÚMULAS ──────────────────────────────────────────────────────
      const buildRows = (titulares, reservas) => [
        ...(titulares || []).filter(j => j.nome).map(j => {
          const idade = calcIdade(j.nasc)
          return [
            j.numero || '',
            j.nome,
            j.posicao || '',
            j.nasc ? (idade ? `${j.nasc} (${idade}a)` : j.nasc) : '',
            j.gols > 0 ? String(j.gols) : '',
            j.avaliar ? 'Aval.' : '',
          ]
        }),
        ...(reservas || []).filter(j => j.nome).map(j => {
          const idade = calcIdade(j.nasc)
          return [
            j.numero || '',
            `(R) ${j.nome}`,
            j.posicao || '',
            j.nasc ? (idade ? `${j.nasc} (${idade}a)` : j.nasc) : '',
            j.gols > 0 ? String(j.gols) : '',
            j.avaliar ? 'Aval.' : '',
          ]
        }),
      ]

      checkP(40)
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
      doc.text(`SÚMULA — ${rel.mandante}`, M, y); y += 3; doc.setTextColor(0, 0, 0)
      tbl({
        margin: { left: M, right: M },
        styles: { fontSize: 7, cellPadding: 1.8 },
        headStyles: { fillColor: GREEN, textColor: 255, fontSize: 7, fontStyle: 'bold' },
        head: [['Nº', 'Nome', 'Posição', 'Nasc.', 'Gol', '']],
        body: buildRows(rel.sumula_mandante, rel.reservas_mandante),
        columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 10 }, 5: { cellWidth: 12 } },
        theme: 'grid',
      })

      checkP(40)
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
      doc.text(`SÚMULA — ${rel.visitante}`, M, y); y += 3; doc.setTextColor(0, 0, 0)
      tbl({
        margin: { left: M, right: M },
        styles: { fontSize: 7, cellPadding: 1.8 },
        headStyles: { fillColor: GREEN, textColor: 255, fontSize: 7, fontStyle: 'bold' },
        head: [['Nº', 'Nome', 'Posição', 'Nasc.', 'Gol', '']],
        body: buildRows(rel.sumula_visitante, rel.reservas_visitante),
        columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 10 }, 5: { cellWidth: 12 } },
        theme: 'grid',
      })

      // Obs da partida
      if (rel.obs_partida) {
        checkP(28)
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
        doc.text('ANÁLISE DA PARTIDA', M, y); y += 5
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); doc.setFontSize(8)
        const lines = doc.splitTextToSize(rel.obs_partida, W - M * 2)
        doc.text(lines, M, y)
        y += lines.length * 4 + 6
      }

      // ── CARDS DE AVALIACAO ───────────────────────────────────────────
      const allAv = [
        ...(rel.sumula_mandante_avaliados  || []),
        ...(rel.sumula_visitante_avaliados || []),
      ]

      for (const a of allAv) {
        newPageWithHeader()

        // Header do card do jogador
        doc.setFillColor(...GREEN)
        doc.roundedRect(M, y, W - M * 2, 18, 3, 3, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14); doc.setFont('helvetica', 'bold')
        doc.text(a.nome || '', M + 4, y + 9)
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
        const idadeCard = calcIdade(a.nasc)
        const subtitulo = [a.posicao, a.time_nome, idadeCard ? `${idadeCard} anos` : null].filter(Boolean).join('  ·  ')
        doc.text(subtitulo, M + 4, y + 15)

        // Nota circular
        const notaNum = parseInt(a.nota_jogo || '0')
        if (notaNum > 0) {
          const cor = notaNum >= 8 ? [0, 150, 50] : notaNum >= 6 ? [200, 120, 0] : [180, 40, 40]
          doc.setFillColor(...cor)
          doc.circle(W - M - 10, y + 9, 8, 'F')
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
          doc.text(notaNum.toString(), W - M - 10, y + 12, { align: 'center' })
        }

        // Badge gol se marcou
        if (a.gols > 0) {
          doc.setFillColor(50, 180, 90)
          doc.roundedRect(W - M - 60, y + 1, 22, 7, 2, 2, 'F')
          doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
          doc.text(`GOL${a.gols > 1 ? ' x' + a.gols : ''}`, W - M - 49, y + 5.5, { align: 'center' })
        }

        // Badge recomendação
        const rec = (a.recomendacao || '').toUpperCase()
        const recCor = rec.includes('CONTRATAR') ? [0, 150, 50] : rec.includes('MONITORAR') ? [200, 120, 0] : [120, 120, 120]
        if (a.recomendacao) {
          const badgeX = a.gols > 0 ? W - M - 35 : W - M - 60
          doc.setFillColor(...recCor)
          doc.roundedRect(badgeX, y + 1, 48, 7, 2, 2, 'F')
          doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
          doc.text((a.recomendacao || '').substring(0, 26), badgeX + 24, y + 5.5, { align: 'center' })
        }

        doc.setTextColor(0, 0, 0)
        y += 24

        // Tabela de avaliação
        tbl({
          margin: { left: M, right: M },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            0: { fillColor: LGREEN, textColor: GREEN, fontStyle: 'bold', cellWidth: 32 },
            2: { fillColor: LGREEN, textColor: GREEN, fontStyle: 'bold', cellWidth: 32 },
          },
          body: [
            ['Desempenho',  a.avaliacao_jogo || '-',         'Recomendação', a.recomendacao || '-'],
            ['Prioridade',  a.prioridade || '-',              'Retorno',      a.sugere_retorno || '-'],
            ['Pé Pref.',    a.pe_preferido || '-',            'Altura',       a.altura ? `${a.altura} cm` : '-'],
            ['Maturacional',a.nivel_maturacional || '-',      'Lesionou?',    a.lesionou || 'Não'],
          ],
          theme: 'grid',
        })

        // Capacidades
        const cf = a.cap_fisicas  || {}
        const ct = a.cap_tecnicas || {}
        const capFis = [['resistencia','Resistência'],['potencia','Potência'],['agilidade','Agilidade'],['biotipo','Biotipo'],['competitividade','Intensidade']]
        const capTec = [['passe_curto','P.Curto'],['passe_longo','P.Longo'],['tecnica_posicao','T.Posição'],['dominio','Domínio'],['inteligencia','Decisão']]

        checkP(24)
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
        doc.text('CAPACIDADES FÍSICAS', M, y); y += 3; doc.setTextColor(0, 0, 0)
        tbl({
          margin: { left: M, right: M },
          styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
          headStyles: { fillColor: LGREEN, textColor: GREEN, fontStyle: 'bold', fontSize: 7.5 },
          head: [capFis.map(([, l]) => l)],
          body: [capFis.map(([k]) => cf[k] || '-')],
          theme: 'grid',
        })

        checkP(24)
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
        doc.text('CAPACIDADES TÉCNICAS', M, y); y += 3; doc.setTextColor(0, 0, 0)
        tbl({
          margin: { left: M, right: M },
          styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
          headStyles: { fillColor: LGREEN, textColor: GREEN, fontStyle: 'bold', fontSize: 7.5 },
          head: [capTec.map(([, l]) => l)],
          body: [capTec.map(([k]) => ct[k] || '-')],
          theme: 'grid',
        })

        // Pontos fortes e fracos
        const pf  = (a.pontos_fortes || []).filter(Boolean)
        const pfr = (a.pontos_fracos || []).filter(Boolean)
        if (pf.length || pfr.length) {
          checkP(16)
          const maxLen = Math.max(pf.length, pfr.length)
          const pfRows = Array.from({ length: maxLen }, (_, i) => [pf[i] || '', pfr[i] || ''])
          tbl({
            margin: { left: M, right: M },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
            headStyles: { fillColor: LGREEN, textColor: GREEN, fontStyle: 'bold', fontSize: 8 },
            head: [['(+) Pontos Fortes', '(-) Pontos Fracos']],
            body: pfRows,
            theme: 'grid',
          })
        }

        // Observações
        if (a.obs_gerais) {
          checkP(20)
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREEN)
          doc.text('OBSERVAÇÕES DO SCOUT', M, y); y += 5
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); doc.setFontSize(8)
          const obsLines = doc.splitTextToSize(a.obs_gerais, W - M * 2)
          doc.text(obsLines, M, y)
          y += obsLines.length * 4 + 6
        }
      }

      // ── RODAPE EM TODAS AS PAGINAS ────────────────────────────────────
      const total = doc.internal.getNumberOfPages()
      for (let p = 1; p <= total; p++) {
        doc.setPage(p)
        doc.setFillColor(...GREEN)
        doc.rect(0, H - 9, W, 9, 'F')
        doc.setFontSize(6); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal')
        doc.text(`CIC Confiança  ·  Documento Confidencial  ·  ${rel.mandante} x ${rel.visitante}  ·  ${rel.data_jogo || ''}`, M, H - 3.5)
        doc.text(`Template CIC v1.2  ·  ${p} / ${total}`, W - M, H - 3.5, { align: 'right' })
        // Escudo no rodapé (pequeno)
        if (escudoDataUrl) {
          try { doc.addImage(escudoDataUrl, 'PNG', W - M - 14, H - 8.5, 5.5, 5.5) } catch (_) {}
        }
      }

      doc.save(`relatorio_${rel.mandante}_x_${rel.visitante}_${rel.data_jogo || ''}.pdf`)
    } catch (err) {
      console.error('Erro PDF:', err)
      alert('Erro ao gerar PDF.')
    } finally { setExportando(false) }
  }

  // Exportar Excel
  async function exportarExcel() {
    setExportando(true)
    try {
      const rel = buildRelatorio()
      exportToCustomExcel(rel, jogo)
    } catch (err) {
      console.error('Erro Excel:', err)
      alert('Erro ao gerar Excel.')
    } finally {
      setExportando(false)
    }
  }

  const tabStyle = (t) => ({
    padding:'8px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
    fontSize:11, fontWeight:700, background: aba===t ? BRAND_PRIMARY : 'transparent', color: aba===t ? '#fff' : '#5a7a62',
  })

  const countAv = paraAvaliar.length

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex' }}>
      {/* Overlay */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} onClick={onClose} />

      {/* Drawer */}
      <div style={{ position:'relative', marginLeft:'auto', width:'min(900px,98vw)', height:'100vh', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-4px 0 32px rgba(0,0,0,0.15)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BRAND_PRIMARY, padding:'16px 20px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:2 }}>Relatório de Observação · CIC Confiança</p>
              <h2 style={{ fontSize:20, fontWeight:900, color:'#fff', margin:'4px 0 2px', fontFamily:"'Barlow Condensed',sans-serif" }}>
                {timeMandante||jogo.mandante} {gols_mandante !== '' && gols_visitante !== '' ? `${gols_mandante} × ${gols_visitante}` : '×'} {timeVisitante||jogo.visitante}
              </h2>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>{jogo.comp} · {jogo.data ? new Date(jogo.data+'T12:00').toLocaleDateString('pt-BR') : '—'} · {jogo.scout || observador}</p>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginTop:12, background:'rgba(255,255,255,0.1)', borderRadius:10, padding:4, width:'fit-content' }}>
            {[['cabecalho','Cabeçalho'],['sumula_m',`${jogo.mandante||'Mandante'}`],['sumula_v',`${jogo.visitante||'Visitante'}`],['avaliacoes',`Avaliações (${countAv})`]].map(([t,l]) => (
              <button key={t} onClick={()=>setAba(t)} style={tabStyle(t)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', background:'#fff' }}>
          {!ready ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60, color:BRAND_PRIMARY }}>Carregando dados...</div>
          ) : (
            <>
              {aba === 'cabecalho' && (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div style={S.section}>
                    <p style={{ fontSize:12, fontWeight:800, color:BRAND_PRIMARY, marginBottom:12 }}>📍 Informações da Partida</p>
                    <div style={{ ...S.row, gridTemplateColumns:'1fr 1fr 1fr' }}>
                      <div><label style={S.label}>Competição</label><input value={competicao} style={S.input} onChange={e=>setCompeticao(e.target.value)} /></div>
                      <div><label style={S.label}>Temporada</label><input value={temporada} style={S.input} onChange={e=>setTemporada(e.target.value)} /></div>
                      <div><label style={S.label}>Data</label><input type='date' value={dataJogo} style={S.input} onChange={e=>setDataJogo(e.target.value)} /></div>
                    </div>
                    <div style={{ ...S.row, gridTemplateColumns:'1fr 1fr 1fr', marginTop:12 }}>
                      <div><label style={S.label}>Mandante</label><TimeAutocomplete value={timeMandante} onChange={setTimeMandante} /></div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div><label style={S.label}>Gols M.</label><input type='number' value={gols_mandante} style={S.input} onChange={e=>setGolsMandante(e.target.value)} /></div>
                        <div><label style={S.label}>Gols V.</label><input type='number' value={gols_visitante} style={S.input} onChange={e=>setGolsVisitante(e.target.value)} /></div>
                      </div>
                      <div><label style={S.label}>Visitante</label><TimeAutocomplete value={timeVisitante} onChange={setTimeVisitante} /></div>
                    </div>
                    <div style={{ ...S.row, gridTemplateColumns:'2fr 1fr 1fr', marginTop:12 }}>
                      <div><label style={S.label}>Local / Estádio</label><input value={local} style={S.input} onChange={e=>setLocal(e.target.value)} /></div>
                      <div><label style={S.label}>Observador</label><input value={observador} style={S.input} onChange={e=>setObservador(e.target.value)} /></div>
                      <div>
                        <label style={S.label}>In Loco?</label>
                        <select value={inLoco} style={S.select} onChange={e=>setInLoco(e.target.value)}>
                          <option>Não</option><option>Sim</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={S.section}>
                    <p style={{ fontSize:12, fontWeight:800, color:BRAND_PRIMARY, marginBottom:12 }}>🎭 Nível da Partida (1-10)</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                      {[
                        ['Gramado', nivelGramado, setNivelGramado],
                        ['Jogo', nivelJogo, setNivelJogo],
                        ['Competição', nivelComp, setNivelComp],
                        ['Vídeo', qualVideo, setQualVideo]
                      ].map(([l,v,s]) => (
                        <div key={l}>
                          <label style={S.label}>{l}</label>
                          <select value={v} style={S.select} onChange={e=>s(e.target.value)}>
                            {[...Array(10)].map((_,i)=><option key={i+1}>{i+1}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={S.section}>
                    <label style={S.label}>Observações Relevantes da Partida</label>
                    <textarea value={obsPartida} style={{ ...S.input, height:100, resize:'none' }} onChange={e=>setObsPartida(e.target.value)} placeholder='Análise tática coletiva, clima, lances capitais...' />
                  </div>
                </div>
              )}

              {(aba === 'sumula_m' || aba === 'sumula_v') && (
                <div>
                  <div style={{ background:'#f0fdf4', padding:'10px 14px', borderRadius:10, marginBottom:12, border:'1px solid #d6e5f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <p style={{ fontSize:11, color:BRAND_PRIMARY, fontWeight:700, margin:0 }}>Marque a estrela (★) para os atletas que deseja avaliar detalhadamente.</p>
                    <button
                      onClick={() => setImportarModal(aba === 'sumula_m' ? 'M' : 'V')}
                      style={{ ...S.btn('#fff', BRAND_PRIMARY, BRAND_PRIMARY), fontSize:11, padding:'6px 12px', flexShrink:0 }}>
                      ⚡ Importar Escalação
                    </button>
                  </div>
                  
                  <p style={{ fontSize:11, fontWeight:900, color:BRAND_PRIMARY, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Titulares</p>
                  <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 130px 90px 60px 50px 36px', gap:6, paddingBottom:6, borderBottom:'2px solid #e5edf5', marginBottom:4 }}>
                    {['Nº','Nome','Posição','Nasc.','⚽','Aval.',''].map(h=><span key={h} style={{ fontSize:9, fontWeight:700, color:'#94a3b8' }}>{h}</span>)}
                  </div>
                  {(aba==='sumula_m'?sumulaM:sumulaV).map((j, i) => (
                    <JogadorRow key={i} idx={i} j={j} time={aba==='sumula_m'?timeMandante:timeVisitante}
                      onChange={(idx,f,v) => handleSumulaChange(aba==='sumula_m'?setSumulaM:setSumulaV, aba==='sumula_m'?sumulaM:sumulaV, idx, f, v)} />
                  ))}
                  
                  <p style={{ fontSize:11, fontWeight:900, color:BRAND_PRIMARY, textTransform:'uppercase', letterSpacing:1, marginTop:24, marginBottom:8 }}>Reservas Utilizados / Banco</p>
                  {(aba==='sumula_m'?resM:resV).map((j, i) => (
                    <JogadorRow key={i} idx={i} j={j} time={aba==='sumula_m'?timeMandante:timeVisitante}
                      onChange={(idx,f,v) => handleSumulaChange(aba==='sumula_m'?setResM:setResV, aba==='sumula_m'?resM:resV, idx, f, v)} />
                  ))}
                  
                  <button onClick={() => (aba==='sumula_m'?setResM:setResV)(prev => [...prev, {...EMPTY_JOGADOR, time_nome:aba==='sumula_m'?timeMandante:timeVisitante}])}
                    style={{ ...S.btn(BRAND_PRIMARY, '#f0fdf4', BRAND_PRIMARY), marginTop:12, width:'100%', justifyContent:'center' }}>+ Adicionar Jogador</button>
                </div>
              )}

              {aba === 'avaliacoes' && (
                <div>
                  {paraAvaliar.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px', color:'#94a3b8' }}>
                      <p style={{ fontSize:40 }}>⭐</p>
                      <p style={{ fontSize:14, fontWeight:700 }}>Nenhum jogador selecionado para avaliação.</p>
                      <p style={{ fontSize:12 }}>Vá para as abas de Súmula e clique na estrela (☆) dos jogadores que deseja analisar.</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
                      {paraAvaliar.map((j, i) => (
                        <AvaliacaoForm key={j.nome+i} jogador={j} 
                          avaliacao={avaliacoes[j.nome] || EMPTY_AVALIACAO}
                          onChange={(val) => setAvaliacoes(prev => ({ ...prev, [j.nome]: val }))} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding:'16px 24px', background:'#f7fcf9', borderTop:'1px solid #e5edf5', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={exportarPDF} disabled={exportando} style={S.btn(BRAND_PRIMARY, '#fff', BRAND_PRIMARY)}>
              📄 {exportando ? 'Gerando...' : 'PDF'}
            </button>
            <button onClick={exportarExcel} disabled={exportando} style={S.btn(BRAND_PRIMARY, '#fff', BRAND_PRIMARY)}>
              📊 {exportando ? 'Gerando...' : 'Excel'}
            </button>
          </div>
          
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {salvando && <span style={{ fontSize:11, color:BRAND_PRIMARY, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:BRAND_PRIMARY, display:'inline-block' }} /> Salvando...
            </span>}
            <button onClick={onClose} style={S.btn('#64748b', 'transparent', '#c0d8c4')}>{canEdit ? 'Cancelar' : 'Fechar'}</button>
            {canEdit && (
              <button onClick={handleSave} disabled={salvando || !ready} style={{ ...S.btn('#fff', BRAND_PRIMARY, BRAND_PRIMARY), padding:'10px 24px' }}>
                {salvando ? 'Salvando...' : 'Salvar Relatório'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Importar Escalação Rápida */}
      {importarModal && (
        <ImportarEscalacaoModal
          timeName={importarModal === 'M' ? (timeMandante||jogo.mandante||'Mandante') : (timeVisitante||jogo.visitante||'Visitante')}
          onImport={(jogadores) => handleImportarEscalacao(importarModal, jogadores)}
          onClose={() => setImportarModal(null)}
        />
      )}
    </div>
  )
}
