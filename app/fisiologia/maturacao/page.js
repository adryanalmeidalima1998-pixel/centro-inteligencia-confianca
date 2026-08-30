'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'
import AppShell from '../../components/layout/AppShell'

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────────────────────────────────────
const BENCH_DEFAULT = 40 // altura padrão do banco (cm), editável por avaliação
const SEXOS = ['Masculino', 'Feminino']
const CATEGORIAS = ['Sub-13', 'Sub-14', 'Sub-15', 'Sub-16', 'Sub-17', 'Sub-20', 'Profissional']
const POSICOES = ['Goleiro', 'Lateral Direito', 'Lateral Esquerdo', 'Zagueiro', 'Volante', 'Meia', 'Ponta', 'Centroavante']
const PES = ['Direito', 'Esquerdo', 'Ambidestro']

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
  .card-hover { transition: all 0.2s ease; }
  .card-hover:hover { transform: translateY(-3px); box-shadow: 0 16px 32px -12px rgba(11,124,61,0.20); }
  .pulse-dot { animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .mat-input {
    width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0;
    border-radius: 10px; font-size: 12px; font-family: 'DM Sans', sans-serif;
    background: #f8fafc; color: #0f172a; outline: none; transition: border-color 0.15s;
  }
  .mat-input:focus { border-color: #0B7C3D; background: white; }
  .mat-input:disabled { background: #eef2f6; color: #64748b; cursor: not-allowed; }
  select.mat-input { cursor: pointer; }
  #mat-print { display: none; }
  @media print {
    @page { size: A4 portrait; margin: 1.4cm 1.5cm; }
    html, body { background: #ffffff !important; }
    body * { visibility: hidden !important; }
    #mat-print, #mat-print * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #mat-print { display: block !important; position: absolute !important; left: 0; top: 0; width: 100%; }
    .no-print { display: none !important; }
    .min-h-screen { min-height: 0 !important; }
  }
`

// Estado maturacional → configuração visual + textos técnicos
const ESTADO_CFG = {
  'PRÉ-PVC': {
    cor: '#2563eb', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🌱',
    titulo: 'PRÉ-PVC',
    desc: 'Atleta ainda está antes do pico de crescimento. A comparação física com atletas mais maturados deve ser feita com cautela. Foco recomendado em coordenação, técnica, mobilidade, padrões motores e força geral controlada.',
    insight: 'O atleta encontra-se em estágio pré-PVC, indicando que ainda não atingiu o pico de velocidade de crescimento. Nesta fase, é importante evitar julgamentos baseados apenas em força, potência e tamanho corporal, pois ele pode estar em desvantagem maturacional em relação a atletas da mesma categoria. Recomenda-se foco em desenvolvimento técnico, coordenação, mobilidade, velocidade gestual, força geral controlada e acompanhamento periódico do crescimento.',
    recomendacoes: [
      'Priorizar coordenação, técnica e padrões motores fundamentais.',
      'Trabalhar mobilidade e força geral controlada, sem sobrecarga axial excessiva.',
      'Evitar comparação física direta com atletas mais maturados da mesma categoria.',
      'Acompanhar estatura e massa a cada 2-3 meses para mapear o avanço maturacional.',
    ],
  },
  'PVC': {
    cor: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', icon: '⚡',
    titulo: 'PVC',
    desc: 'Atleta está próximo ou dentro do pico de crescimento. Fase sensível para alterações rápidas de estatura, massa corporal, coordenação e possíveis desconfortos. Recomenda-se atenção ao controle de carga, dor, fadiga, mobilidade e qualidade de movimento.',
    insight: 'O atleta encontra-se próximo ao PVC, fase marcada por crescimento acelerado e possíveis alterações de coordenação, controle motor e tolerância à carga. Recomenda-se monitoramento próximo de dores, fadiga, qualidade de movimento, assimetrias e resposta ao treino. A evolução física pode ser rápida, mas a prescrição deve respeitar o momento maturacional.',
    recomendacoes: [
      'Monitorar dor, fadiga e desconforto (atenção a dores de crescimento e tendões).',
      'Controlar volume e impacto; ajustar carga conforme janelas de crescimento.',
      'Reforçar mobilidade, controle motor e qualidade de movimento.',
      'Mapear assimetrias e resposta ao treino com maior frequência.',
    ],
  },
  'PÓS-PVC': {
    cor: '#0B7C3D', bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700', icon: '💪',
    titulo: 'PÓS-PVC',
    desc: 'Atleta já passou pelo pico de crescimento. Maior estabilidade maturacional e maior possibilidade de evolução em força, potência, velocidade e capacidades físicas específicas, respeitando o histórico individual.',
    insight: 'O atleta encontra-se em estágio pós-PVC, indicando que já ultrapassou o principal pico de crescimento. Essa condição tende a favorecer maior estabilidade corporal e melhor resposta a estímulos de força, potência e velocidade. Recomenda-se individualizar o desenvolvimento físico sem desconsiderar histórico de crescimento, carga acumulada e perfil técnico-tático.',
    recomendacoes: [
      'Avançar em força, potência e velocidade respeitando o histórico individual.',
      'Individualizar a prescrição conforme carga acumulada e perfil técnico-tático.',
      'Estruturar progressão de capacidades físicas específicas da posição.',
      'Manter acompanhamento, pois o crescimento residual ainda pode ocorrer.',
    ],
  },
}

const TIMING_CFG = {
  AVANÇADO: { cor: '#dc2626', badge: 'bg-red-100 text-red-700' },
  'AVANÇADA': { cor: '#dc2626', badge: 'bg-red-100 text-red-700' },
  NORMOMATURO: { cor: '#0B7C3D', badge: 'bg-sky-100 text-sky-700' },
  NORMOMATURA: { cor: '#0B7C3D', badge: 'bg-sky-100 text-sky-700' },
  ATRASADO: { cor: '#7c3aed', badge: 'bg-violet-100 text-violet-700' },
  ATRASADA: { cor: '#7c3aed', badge: 'bg-violet-100 text-violet-700' },
}

// Leitura técnica do timing maturacional (cedo / no esperado / tarde vs pares)
const TIMING_INSIGHT = {
  avancado: 'Quanto ao timing, o atleta tende a maturar mais cedo que a média dos pares (maturação avançada): a idade estimada do PVC é precoce. Isso costuma gerar vantagem física temporária em estatura, força e potência frente a colegas da mesma idade. Atenção para não superestimar o talento com base nessa vantagem maturacional, que tende a se diluir conforme os demais maturam. O foco deve permanecer em técnica, tomada de decisão e qualidade de jogo.',
  normomaturo: 'Quanto ao timing, o atleta matura dentro da janela esperada para a idade (normomaturação): a idade estimada do PVC está alinhada à média dos pares. O desenvolvimento físico acompanha o grupo, sem vantagem ou desvantagem maturacional relevante, o que torna as comparações de desempenho dentro da categoria mais confiáveis.',
  atrasado: 'Quanto ao timing, o atleta tende a maturar mais tarde que a média dos pares (maturação tardia): a idade estimada do PVC é mais avançada. Isso pode gerar desvantagem física temporária (menor estatura, força e potência) frente a colegas mais maturados. É fundamental não descartar o atleta por isso, pois parte da diferença é maturacional e tende a reduzir com o tempo. Recomenda-se priorizar técnica, coordenação e acompanhamento, evitando comparações físicas diretas.',
}
function timingInsightDe(timing) {
  if (!timing) return null
  const t = timing.toUpperCase()
  if (t.startsWith('AVAN')) return TIMING_INSIGHT.avancado
  if (t.startsWith('NORMO')) return TIMING_INSIGHT.normomaturo
  if (t.startsWith('ATRAS')) return TIMING_INSIGHT.atrasado
  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS DE CÁLCULO (puros)
// ──────────────────────────────────────────────────────────────────────────────
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
const round = (n, d) => (n == null || !Number.isFinite(n)) ? null : Math.round(n * 10 ** d) / 10 ** d
const fmt = (n, d = 1) => (n == null || !Number.isFinite(n)) ? '—' : n.toFixed(d).replace('.', ',')

function idadeDecimal(birth, assess) {
  if (!birth || !assess) return null
  const b = new Date(birth + 'T00:00:00')
  const a = new Date(assess + 'T00:00:00')
  if (isNaN(b) || isNaN(a)) return null
  const dias = (a - b) / 86400000
  if (dias <= 0) return null
  return dias / 365.25
}

// Mirwald, Baxter-Jones, Bailey & Beunen (2002) — Maturity Offset / DPVC.
// Obs: o briefing teve os sinais embaralhados pela formatação (asteriscos viraram bullets).
// Aqui usamos os sinais CANÔNICOS validados na literatura.
//   Meninos: +(CP·AS) −(IDADE·CP) +(IDADE·AS) +(P/H·100)
//   Meninas: +(CP·AS) +(IDADE·CP) +(IDADE·AS) −(IDADE·P) +(P/H·100)
function maturityOffset({ sex, idade, estatura, peso, alturaSentado, comprimentoPernas }) {
  const CP = comprimentoPernas, AS = alturaSentado, IDADE = idade, PESO = peso, EST = estatura
  if (![CP, AS, IDADE, PESO, EST].every(v => Number.isFinite(v)) || EST <= 0) return null
  const whr = (PESO / EST) * 100
  if (sex === 'Feminino') {
    return -9.376
      + 0.0001882 * (CP * AS)
      + 0.0022 * (IDADE * CP)
      + 0.005841 * (IDADE * AS)
      - 0.002658 * (IDADE * PESO)
      + 0.07693 * whr
  }
  // Masculino (default)
  return -9.236
    + 0.0002708 * (CP * AS)
    - 0.001663 * (IDADE * CP)
    + 0.007216 * (IDADE * AS)
    + 0.02292 * whr
}

function estadoMaturacional(dpvc) {
  if (dpvc == null) return null
  if (dpvc < -1) return 'PRÉ-PVC'
  if (dpvc > 1) return 'PÓS-PVC'
  return 'PVC'
}

function timingMaturacional(sex, idadePVC) {
  if (idadePVC == null) return null
  if (sex === 'Feminino') {
    if (idadePVC < 11.3) return 'AVANÇADA'
    if (idadePVC > 12.7) return 'ATRASADA'
    return 'NORMOMATURA'
  }
  if (idadePVC < 12.9) return 'AVANÇADO'
  if (idadePVC > 14.7) return 'ATRASADO'
  return 'NORMOMATURO'
}

// Validações de coleta (avisos de inconsistência)
function buildValidacoes({ estatura, peso, alturaSentado, comprimentoPernas, dpvc }) {
  const out = []
  if (estatura != null && (estatura < 120 || estatura > 210)) out.push('Estatura fora da faixa usual (120-210 cm). Conferir a medida.')
  if (peso != null && (peso < 25 || peso > 120)) out.push('Massa corporal fora da faixa usual (25-120 kg). Conferir a medida.')
  if (alturaSentado != null && (alturaSentado < 60 || alturaSentado > 110)) out.push('Altura sentado real fora da faixa usual (60-110 cm). Conferir a medida do chão até a cabeça.')
  if (comprimentoPernas != null && (comprimentoPernas < 50 || comprimentoPernas > 120)) out.push('Comprimento das pernas fora da faixa usual (50-120 cm). Conferir estatura e altura sentado.')
  if (dpvc != null && (dpvc < -4 || dpvc > 4)) out.push('DPVC fora da faixa plausível (-4 a +4 anos). Possível inconsistência na coleta.')
  return out
}

// Alertas inteligentes
function buildAlertas({ sex, idade, dpvc, estado, idadePVC }) {
  const out = []
  if (dpvc != null && dpvc >= -0.5 && dpvc <= 0.5) {
    out.push({ tipo: 'pvc', cls: 'bg-orange-50 border-orange-200 text-orange-800', icon: '⚡', txt: 'Alerta: atleta em janela central do PVC. Monitorar crescimento, dor, fadiga, coordenação e resposta à carga.' })
  }
  if (sex === 'Masculino' && idade != null && idade > 14 && estado === 'PRÉ-PVC') {
    out.push({ tipo: 'pre_tardio', cls: 'bg-violet-50 border-violet-200 text-violet-800', icon: '⏳', txt: 'Possível maturação tardia. Evitar comparação física direta com atletas avançados da mesma categoria.' })
  }
  if (sex === 'Masculino' && idadePVC != null && idadePVC < 12.9) {
    out.push({ tipo: 'pos_avancado', cls: 'bg-red-50 border-red-200 text-red-800', icon: '🚀', txt: 'Atleta com tendência maturacional avançada. Desempenho físico pode estar influenciado por maturação precoce.' })
  }
  return out
}

function fmtDatePt(d) {
  if (!d) return '—'
  const date = new Date((d.length > 10 ? d : d + 'T00:00:00'))
  if (isNaN(date)) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtDateShort(d) {
  if (!d) return '—'
  const date = new Date((d.length > 10 ? d : d + 'T00:00:00'))
  if (isNaN(date)) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function emptyForm() {
  return {
    athlete_id: '', name: '', category: '', position: '', dominant_foot: '', sex: 'Masculino',
    birth_date: '', assessment_date: new Date().toISOString().slice(0, 10),
    standing_height_cm: '', body_mass_kg: '', seated_height_from_floor_cm: '', bench_height_cm: BENCH_DEFAULT,
    responsavel: '', staff_notes: '',
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PÁGINA
// ──────────────────────────────────────────────────────────────────────────────
export default function MaturacaoPage() {
  const router = useRouter()
  const [athletes, setAthletes] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [openedId, setOpenedId] = useState(null) // avaliação aberta do histórico (para relatório)
  const [showGuia, setShowGuia] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/maturacao')
      const data = await res.json()
      setAthletes(data.athletes || [])
      setAssessments(data.assessments || [])
    } catch (e) { console.error('[Maturação] erro ao carregar', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── CÁLCULOS AO VIVO ──
  const calc = useMemo(() => {
    const estatura = num(form.standing_height_cm)
    const peso = num(form.body_mass_kg)
    const sentadoChao = num(form.seated_height_from_floor_cm)
    const banco = num(form.bench_height_cm)
    const bancoVal = banco != null ? banco : BENCH_DEFAULT
    const alturaSentado = sentadoChao != null ? sentadoChao - bancoVal : null
    const comprimentoPernas = (estatura != null && alturaSentado != null) ? estatura - alturaSentado : null
    const idade = idadeDecimal(form.birth_date, form.assessment_date)
    const dpvc = maturityOffset({ sex: form.sex, idade, estatura, peso, alturaSentado, comprimentoPernas })
    const idadePVC = (idade != null && dpvc != null) ? idade - dpvc : null
    const estado = estadoMaturacional(dpvc)
    const timing = timingMaturacional(form.sex, idadePVC)
    const validacoes = buildValidacoes({ estatura, peso, alturaSentado, comprimentoPernas, dpvc })
    const alertas = buildAlertas({ sex: form.sex, idade, dpvc, estado, idadePVC })
    const insight = estado ? ESTADO_CFG[estado].insight : null
    const timingInsight = timingInsightDe(timing)
    return { estatura, peso, sentadoChao, banco, bancoVal, alturaSentado, comprimentoPernas, idade, dpvc, idadePVC, estado, timing, validacoes, alertas, insight, timingInsight }
  }, [form])

  // Avaliações do atleta selecionado (histórico)
  const athleteAssessments = useMemo(() => {
    if (!form.athlete_id) return []
    return assessments
      .filter(a => Number(a.athlete_id) === Number(form.athlete_id))
      .sort((a, b) => (b.assessment_date || '').localeCompare(a.assessment_date || ''))
  }, [assessments, form.athlete_id])

  // Todas as avaliações cadastradas (com nome do atleta), mais recentes primeiro
  const allRows = useMemo(() => {
    return assessments
      .map(a => {
        const ath = athletes.find(x => Number(x.id) === Number(a.athlete_id))
        return { ...a, _name: ath?.name || '—', _cat: ath?.category || '', _sex: ath?.sex || '' }
      })
      .sort((a, b) => (b.assessment_date || '').localeCompare(a.assessment_date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
  }, [assessments, athletes])

  // Distribuição da categoria (última avaliação de cada atleta da mesma categoria)
  const distribuicao = useMemo(() => {
    const cat = form.category
    const byAthlete = {}
    assessments.forEach(a => {
      const ath = athletes.find(x => Number(x.id) === Number(a.athlete_id))
      if (!ath) return
      if (cat && ath.category !== cat) return
      const prev = byAthlete[a.athlete_id]
      if (!prev || (a.assessment_date || '') > (prev.assessment_date || '')) byAthlete[a.athlete_id] = a
    })
    const ults = Object.values(byAthlete)
    const estados = { 'PRÉ-PVC': 0, 'PVC': 0, 'PÓS-PVC': 0 }
    const timings = {}
    ults.forEach(a => {
      if (a.current_maturation_status && estados[a.current_maturation_status] != null) estados[a.current_maturation_status]++
      if (a.maturation_timing) timings[a.maturation_timing] = (timings[a.maturation_timing] || 0) + 1
    })
    return { total: ults.length, estados, timings }
  }, [assessments, athletes, form.category])

  // ── HANDLERS ──
  // Monta o formulário completo a partir de uma avaliação salva (identidade + medidas)
  function buildFormFromAssessment(a, ath) {
    const bench = num(a.bench_height_cm)
    const benchVal = bench != null ? bench : BENCH_DEFAULT
    let seatedFromFloor = num(a.seated_height_from_floor_cm)
    if (seatedFromFloor == null && num(a.sitting_height_cm) != null) seatedFromFloor = num(a.sitting_height_cm) + benchVal
    return {
      athlete_id: ath?.id ?? a.athlete_id ?? '',
      name: ath?.name || '',
      category: ath?.category || '',
      position: ath?.position || '',
      dominant_foot: ath?.dominant_foot || '',
      sex: ath?.sex || 'Masculino',
      birth_date: ath?.birth_date ? ath.birth_date.substring(0, 10) : '',
      assessment_date: a.assessment_date ? a.assessment_date.substring(0, 10) : new Date().toISOString().slice(0, 10),
      standing_height_cm: a.standing_height_cm != null ? String(a.standing_height_cm) : '',
      body_mass_kg: a.body_mass_kg != null ? String(a.body_mass_kg) : '',
      seated_height_from_floor_cm: seatedFromFloor != null ? String(seatedFromFloor) : '',
      bench_height_cm: benchVal,
      responsavel: a.responsavel || '',
      staff_notes: a.staff_notes || '',
    }
  }

  function latestAssessmentOf(athleteId) {
    return assessments
      .filter(a => Number(a.athlete_id) === Number(athleteId))
      .sort((a, b) => (b.assessment_date || '').localeCompare(a.assessment_date || '') || (b.created_at || '').localeCompare(a.created_at || ''))[0] || null
  }

  function selectAthlete(id) {
    if (!id) { setForm(f => ({ ...emptyForm(), assessment_date: f.assessment_date })); setOpenedId(null); return }
    const ath = athletes.find(x => Number(x.id) === Number(id))
    if (!ath) return
    const latest = latestAssessmentOf(id)
    if (latest) {
      setForm(buildFormFromAssessment(latest, ath))
      setOpenedId(latest.id)
    } else {
      setForm(f => ({
        ...emptyForm(),
        athlete_id: ath.id,
        name: ath.name || '',
        category: ath.category || '',
        position: ath.position || '',
        dominant_foot: ath.dominant_foot || '',
        sex: ath.sex || 'Masculino',
        birth_date: ath.birth_date ? ath.birth_date.substring(0, 10) : '',
        assessment_date: f.assessment_date,
      }))
      setOpenedId(null)
    }
  }

  async function save() {
    if (!form.name.trim()) { alert('Informe o nome do atleta.'); return }
    if (calc.idade == null) { alert('Confira a data de nascimento e a data da avaliação.'); return }
    if (calc.dpvc == null) { alert('Preencha estatura, massa e altura sentado para calcular o DPVC.'); return }
    setSaving(true)
    try {
      const payload = {
        athlete: {
          id: form.athlete_id || undefined,
          name: form.name.trim(), birth_date: form.birth_date || null, sex: form.sex,
          category: form.category || null, position: form.position || null, dominant_foot: form.dominant_foot || null,
        },
        assessment: {
          assessment_date: form.assessment_date || null,
          decimal_age: round(calc.idade, 2),
          standing_height_cm: round(calc.estatura, 1),
          body_mass_kg: round(calc.peso, 1),
          bench_height_cm: round(calc.bancoVal, 1),
          seated_height_from_floor_cm: round(calc.sentadoChao, 1),
          sitting_height_cm: round(calc.alturaSentado, 1),
          leg_length_cm: round(calc.comprimentoPernas, 1),
          maturity_offset: round(calc.dpvc, 2),
          estimated_phv_age: round(calc.idadePVC, 2),
          current_maturation_status: calc.estado,
          maturation_timing: calc.timing,
          automatic_insight: calc.insight,
          staff_notes: form.staff_notes || null,
          responsavel: form.responsavel || null,
        },
      }
      const res = await fetch('/api/maturacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadAll()
      setForm(f => ({ ...f, athlete_id: data.athlete.id, staff_notes: '' }))
      alert('Avaliação salva com sucesso!')
    } catch (e) { alert('Erro ao salvar: ' + e.message) }
    finally { setSaving(false) }
  }

  async function deleteAssessment(id) {
    if (!confirm('Excluir esta avaliação?')) return
    try {
      const res = await fetch(`/api/maturacao/${id}?type=assessment`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setAssessments(prev => prev.filter(a => Number(a.id) !== Number(id)))
      if (Number(openedId) === Number(id)) setOpenedId(null)
    } catch (e) { alert('Erro ao excluir: ' + e.message) }
  }

  // Abre uma avaliação salva: carrega TUDO (identidade + medidas) no formulário
  function abrirAvaliacao(a) {
    const ath = athletes.find(x => Number(x.id) === Number(a.athlete_id))
    setForm(buildFormFromAssessment(a, ath))
    setOpenedId(a.id)
    if (typeof window !== 'undefined') setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  // Carrega a avaliação no formulário e dispara o PDF
  function exportarAvaliacao(a) {
    const ath = athletes.find(x => Number(x.id) === Number(a.athlete_id))
    setForm(buildFormFromAssessment(a, ath))
    setOpenedId(a.id)
    if (typeof window !== 'undefined') setTimeout(() => window.print(), 250)
  }

  // Dados para o relatório: sempre derivados do formulário ao vivo (fonte única)
  const reportData = useMemo(() => ({
    name: form.name, category: form.category, position: form.position, dominant_foot: form.dominant_foot,
    sex: form.sex, birth_date: form.birth_date, assessment_date: form.assessment_date, responsavel: form.responsavel,
    idade: calc.idade, estatura: calc.estatura, peso: calc.peso, alturaSentado: calc.alturaSentado,
    comprimentoPernas: calc.comprimentoPernas, dpvc: calc.dpvc, idadePVC: calc.idadePVC,
    estado: calc.estado, timing: calc.timing, insight: calc.insight, timingInsight: calc.timingInsight, staff_notes: form.staff_notes,
  }), [form, calc])

  const estadoCfg = calc.estado ? ESTADO_CFG[calc.estado] : null
  const timingCfg = calc.timing ? TIMING_CFG[calc.timing] : null

  // Série longitudinal (ordem crescente por data)
  const serie = useMemo(() => {
    return athleteAssessments
      .slice()
      .sort((a, b) => (a.assessment_date || '').localeCompare(b.assessment_date || ''))
      .map(a => ({
        data: fmtDateShort(a.assessment_date),
        Estatura: num(a.standing_height_cm),
        Peso: num(a.body_mass_kg),
        DPVC: num(a.maturity_offset),
      }))
  }, [athleteAssessments])

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm min-h-screen bg-gray-50">

        {/* HERO */}
        <div className="px-8 py-9 relative overflow-hidden no-print" style={{ background: 'linear-gradient(135deg, #0B7C3D 0%, #064d27 100%)' }}>
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="relative max-w-6xl mx-auto">
            <button onClick={() => router.push('/fisiologia')} className="flex items-center gap-1.5 text-sky-200 hover:text-white text-[10px] font-black uppercase tracking-widest mb-3 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Fisiologia
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="pulse-dot w-2 h-2 rounded-full bg-sky-300" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-sky-200">Ciência do Esporte · Base</p>
            </div>
            <h1 className="bc text-5xl font-black uppercase text-white leading-none mb-1">MATURAÇÃO / PVC</h1>
            <p className="text-sky-200 text-sm">Pico de Velocidade de Crescimento · Maturity Offset (Mirwald, 2002)</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-7">

          {/* EXPLICAÇÃO RÁPIDA */}
          <div className="no-print bg-white border border-sky-100 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 text-[11px] text-gray-600">
            <p className="flex-1 min-w-[260px] leading-relaxed">
              Esta ferramenta estima a <strong>distância para o Pico de Velocidade de Crescimento (DPVC)</strong> a partir de medidas antropométricas simples.
              Basta coletar estatura, massa e altura sentado — o sistema calcula idade decimal, comprimento das pernas, DPVC, idade estimada do PVC, estado e timing maturacional.
            </p>
            <div className="flex items-center gap-2 bg-sky-50 rounded-xl px-3 py-2 border border-sky-100">
              <span className="text-lg">📏</span>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-sky-600">Altura do banco</p>
                <p className="bc text-lg font-black text-sky-800 leading-none">{fmt(calc.bancoVal, 0)} cm</p>
              </div>
            </div>
          </div>

          {/* ─────────── FORMULÁRIO ─────────── */}
          <div className="no-print bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-7">
            <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
              <p className="bc text-sm font-black uppercase tracking-widest text-white">Avaliação Antropométrica</p>
              <select value={form.athlete_id} onChange={e => selectAthlete(e.target.value)} className="mat-input" style={{ width: 220, background: 'rgba(255,255,255,0.1)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>
                <option value="" style={{ color: '#0f172a' }}>+ Novo atleta</option>
                {athletes.map(a => <option key={a.id} value={a.id} style={{ color: '#0f172a' }}>{a.name}{a.category ? ` · ${a.category}` : ''}</option>)}
              </select>
            </div>

            <div className="p-5 space-y-5">
              {/* IDENTIFICAÇÃO */}
              <div>
                <p className="bc text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2.5">Identificação do atleta</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Nome do atleta *" span2>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mat-input" placeholder="Nome completo" />
                  </Field>
                  <Field label="Categoria">
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mat-input">
                      <option value="">Selecione...</option>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Sexo">
                    <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))} className="mat-input">
                      {SEXOS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Posição">
                    <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="mat-input">
                      <option value="">Selecione...</option>
                      {POSICOES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Pé dominante">
                    <select value={form.dominant_foot} onChange={e => setForm(f => ({ ...f, dominant_foot: e.target.value }))} className="mat-input">
                      <option value="">Selecione...</option>
                      {PES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Data de nascimento">
                    <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className="mat-input" />
                  </Field>
                  <Field label="Data da avaliação">
                    <input type="date" value={form.assessment_date} onChange={e => setForm(f => ({ ...f, assessment_date: e.target.value }))} className="mat-input" />
                  </Field>
                </div>
              </div>

              {/* MEDIDAS */}
              <div>
                <p className="bc text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2.5">Medidas antropométricas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Estatura em pé (cm)">
                    <input type="number" step="0.1" value={form.standing_height_cm} onChange={e => setForm(f => ({ ...f, standing_height_cm: e.target.value }))} className="mat-input" placeholder="ex: 165,5" />
                  </Field>
                  <Field label="Massa corporal (kg)">
                    <input type="number" step="0.1" value={form.body_mass_kg} onChange={e => setForm(f => ({ ...f, body_mass_kg: e.target.value }))} className="mat-input" placeholder="ex: 54,2" />
                  </Field>
                  <Field label="Altura sentado — chão à cabeça (cm)">
                    <input type="number" step="0.1" value={form.seated_height_from_floor_cm} onChange={e => setForm(f => ({ ...f, seated_height_from_floor_cm: e.target.value }))} className="mat-input" placeholder="medida total" />
                  </Field>
                  <Field label="Altura do banco (cm)">
                    <input type="number" step="0.1" value={form.bench_height_cm} onChange={e => setForm(f => ({ ...f, bench_height_cm: e.target.value }))} className="mat-input" placeholder="ex: 38" />
                  </Field>
                </div>
                {/* Derivados ao vivo */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <DerivedChip label="Altura sentado real" value={`${fmt(calc.alturaSentado, 1)} cm`} hint={`medida − ${fmt(calc.bancoVal, 0)}`} />
                  <DerivedChip label="Comprimento das pernas" value={`${fmt(calc.comprimentoPernas, 1)} cm`} hint="estatura − altura sentado real" />
                  <DerivedChip label="Idade decimal" value={`${fmt(calc.idade, 2)} anos`} hint="auto" />
                </div>
              </div>

              {/* RESPONSÁVEL + OBS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Responsável pela avaliação">
                  <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} className="mat-input" placeholder="Nome do avaliador" />
                </Field>
                <Field label="Observações da coleta / comissão">
                  <input value={form.staff_notes} onChange={e => setForm(f => ({ ...f, staff_notes: e.target.value }))} className="mat-input" placeholder="Notas livres..." />
                </Field>
              </div>

              <div className="flex justify-end">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-700 text-white text-[11px] font-black uppercase tracking-widest hover:bg-sky-800 shadow-sm transition-colors disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar avaliação'}
                </button>
              </div>
            </div>
          </div>

          {/* ─────────── AVALIAÇÕES CADASTRADAS (sempre visível) ─────────── */}
          {allRows.length > 0 && (
            <div className="no-print mb-7">
              <div className="flex items-center justify-between mb-3">
                <p className="bc text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Avaliações cadastradas · {allRows.length}</p>
                {openedId && <button onClick={() => selectAthlete('')} className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">Nova avaliação</button>}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-[10px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                      {['Atleta', 'Categoria', 'Data', 'Idade', 'DPVC', 'Idade PVC', 'Estado', 'Timing', 'Ações'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-black uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map(a => {
                      const ecfg = ESTADO_CFG[a.current_maturation_status]
                      const tcfg = TIMING_CFG[a.maturation_timing]
                      const aberto = Number(openedId) === Number(a.id)
                      return (
                        <tr key={a.id} className={`border-b border-gray-50 ${aberto ? 'bg-sky-50/60' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-2.5 font-bold text-gray-800">{a._name}</td>
                          <td className="px-3 py-2.5 text-gray-500">{a._cat || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmtDateShort(a.assessment_date)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.decimal_age), 2)}</td>
                          <td className="px-3 py-2.5 font-black" style={{ color: ecfg?.cor || '#0f172a' }}>{num(a.maturity_offset) != null ? (num(a.maturity_offset) > 0 ? '+' : '') + fmt(num(a.maturity_offset), 2) : '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.estimated_phv_age), 2)}</td>
                          <td className="px-3 py-2.5">{a.current_maturation_status ? <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${ecfg?.badge || 'bg-gray-100 text-gray-600'}`}>{a.current_maturation_status}</span> : '—'}</td>
                          <td className="px-3 py-2.5">{a.maturation_timing ? <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${tcfg?.badge || 'bg-gray-100 text-gray-600'}`}>{a.maturation_timing}</span> : '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button onClick={() => abrirAvaliacao(a)} className={`text-[9px] font-black uppercase ${aberto ? 'text-sky-700' : 'text-gray-500 hover:text-sky-600'}`} title="Carregar atleta e relatório">{aberto ? '● Aberta' : 'Abrir'}</button>
                              <button onClick={() => exportarAvaliacao(a)} className="text-[9px] font-black uppercase text-gray-500 hover:text-sky-600" title="Exportar PDF">PDF</button>
                              <button onClick={() => deleteAssessment(a.id)} className="text-gray-300 hover:text-red-500" title="Excluir">✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Clique em <strong>Abrir</strong> para carregar a avaliação no formulário e no relatório, ou em <strong>PDF</strong> para exportar direto.</p>
            </div>
          )}

          {/* ─────────── CARDS DE RESULTADO ─────────── */}
          <p className="no-print bc text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-3">Resultados</p>
          <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
            <KpiCard label="Idade decimal" value={fmt(calc.idade, 2)} unit="anos" />
            <KpiCard label="Estatura" value={fmt(calc.estatura, 1)} unit="cm" />
            <KpiCard label="Massa corporal" value={fmt(calc.peso, 1)} unit="kg" />
            <KpiCard label="Altura sentado real" value={fmt(calc.alturaSentado, 1)} unit="cm" />
            <KpiCard label="Comprimento pernas" value={fmt(calc.comprimentoPernas, 1)} unit="cm" />
            <KpiCard label="DPVC / Maturity Offset" value={calc.dpvc != null ? (calc.dpvc > 0 ? '+' : '') + fmt(calc.dpvc, 2) : '—'} unit="anos" highlight={estadoCfg?.cor} />
            <KpiCard label="Idade estimada do PVC" value={fmt(calc.idadePVC, 2)} unit="anos" />
            <KpiCard label="Estado maturacional" value={calc.estado || '—'} badge={estadoCfg?.badge} />
            <KpiCard label="Timing maturacional" value={calc.timing || '—'} badge={timingCfg?.badge} />
            <KpiCard label="Monitoramento" value={calc.alertas.length ? `${calc.alertas.length} alerta${calc.alertas.length > 1 ? 's' : ''}` : 'Normal'} badge={calc.alertas.length ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'} />
          </div>

          {/* DPVC EM DESTAQUE + ESTADO */}
          {calc.dpvc != null && estadoCfg && (
            <div className={`no-print rounded-2xl border ${estadoCfg.border} ${estadoCfg.bg} p-5 mb-7`}>
              <div className="flex flex-wrap items-center gap-5">
                <div className="text-center px-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">DPVC</p>
                  <p className="bc text-5xl font-black leading-none" style={{ color: estadoCfg.cor }}>
                    {calc.dpvc > 0 ? '+' : ''}{fmt(calc.dpvc, 2)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">anos</p>
                </div>
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{estadoCfg.icon}</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${estadoCfg.badge}`}>{estadoCfg.titulo}</span>
                  </div>
                  <p className="text-[12px] text-gray-700 leading-relaxed">
                    {calc.dpvc < 0
                      ? `O atleta está aproximadamente ${fmt(Math.abs(calc.dpvc), 1)} ano(s) antes do PVC.`
                      : calc.dpvc > 0
                        ? `O atleta está aproximadamente ${fmt(calc.dpvc, 1)} ano(s) após o PVC.`
                        : 'O atleta está praticamente no PVC.'}
                    {' '}Idade estimada do PVC: <strong>{fmt(calc.idadePVC, 2)} anos</strong>.
                  </p>
                </div>
              </div>

              {/* GRÁFICO 1 — LINHA DO PVC */}
              <div className="mt-5">
                <PvcScale dpvc={calc.dpvc} cor={estadoCfg.cor} />
              </div>
            </div>
          )}

          {/* LEITURA TÉCNICA AUTOMÁTICA */}
          {calc.insight && (
            <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 mb-6">
              <p className="bc text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">📖 Leitura técnica automática</p>

              <div className="mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Estado maturacional atual</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{calc.insight}</p>
              </div>

              {calc.timingInsight && (
                <div className="mb-3 pt-3 border-t border-gray-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Timing maturacional</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{calc.timingInsight}</p>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <strong>Estado</strong> = onde o atleta está agora em relação ao PVC. <strong>Timing</strong> = se ele tende a maturar mais cedo, dentro do esperado ou mais tarde que os pares. As duas leituras são complementares e podem divergir (ex.: já estar pós-PVC, mas com PVC tardio em relação ao grupo).
                </p>
              </div>
            </div>
          )}

          {/* ALERTAS */}
          {calc.alertas.length > 0 && (
            <div className="no-print space-y-2 mb-6">
              {calc.alertas.map((al, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${al.cls}`}>
                  <span className="text-lg leading-none mt-0.5">{al.icon}</span>
                  <p className="text-[12px] font-medium leading-relaxed">{al.txt}</p>
                </div>
              ))}
            </div>
          )}

          {/* VALIDAÇÕES / INCONSISTÊNCIAS */}
          {calc.validacoes.length > 0 && (
            <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
              <p className="bc text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">⚠ Conferir coleta</p>
              <ul className="space-y-1">
                {calc.validacoes.map((v, i) => <li key={i} className="text-[12px] text-amber-800 leading-relaxed">• {v}</li>)}
              </ul>
            </div>
          )}

          {/* GUIA DIDÁTICO */}
          <div className="no-print bg-white border border-gray-200 rounded-2xl mb-7 overflow-hidden">
            <button onClick={() => setShowGuia(s => !s)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <span className="bc text-[12px] font-black uppercase tracking-widest text-gray-700">📐 Como medir corretamente</span>
              <span className="text-gray-400 text-lg">{showGuia ? '−' : '+'}</span>
            </button>
            {showGuia && (
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <GuiaItem titulo="Estatura">Atleta descalço, em pé, corpo ereto, calcanhares apoiados, braços ao lado do corpo e cabeça olhando para frente.</GuiaItem>
                <GuiaItem titulo="Massa corporal">Atleta em roupa leve, preferencialmente antes do treino ou em condição padronizada.</GuiaItem>
                <GuiaItem titulo="Altura sentado">Usar um banco ou step de altura conhecida (padrão 40 cm, mas informe a altura real do seu banco no campo correspondente). Atleta sentado com tronco ereto, cabeça alinhada, joelhos próximos de 90° e pés apoiados. Medir do chão até o topo da cabeça. O sistema desconta automaticamente a altura do banco informada.</GuiaItem>
                <GuiaItem titulo="Comprimento das pernas">Não medir diretamente com fita. O sistema calcula automaticamente: Comprimento das pernas = Estatura − Altura sentado real.</GuiaItem>
              </div>
            )}
          </div>

          {/* HISTÓRICO */}
          {form.athlete_id && athleteAssessments.length > 0 && (
            <div className="no-print mb-7">
              <p className="bc text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-3">Histórico de avaliações · {form.name}</p>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-[10px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                      {['Data', 'Idade', 'Estatura', 'Peso', 'Alt. Sent.', 'Comp. Pernas', 'DPVC', 'Idade PVC', 'Estado', 'Timing', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-black uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {athleteAssessments.map(a => {
                      const ecfg = ESTADO_CFG[a.current_maturation_status]
                      const tcfg = TIMING_CFG[a.maturation_timing]
                      const aberto = Number(openedId) === Number(a.id)
                      return (
                        <tr key={a.id} className={`border-b border-gray-50 ${aberto ? 'bg-sky-50/60' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-2.5 font-bold text-gray-700">{fmtDateShort(a.assessment_date)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.decimal_age), 2)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.standing_height_cm), 1)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.body_mass_kg), 1)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.sitting_height_cm), 1)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.leg_length_cm), 1)}</td>
                          <td className="px-3 py-2.5 font-black" style={{ color: ecfg?.cor || '#0f172a' }}>{num(a.maturity_offset) != null ? (num(a.maturity_offset) > 0 ? '+' : '') + fmt(num(a.maturity_offset), 2) : '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{fmt(num(a.estimated_phv_age), 2)}</td>
                          <td className="px-3 py-2.5">{a.current_maturation_status ? <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${ecfg?.badge || 'bg-gray-100 text-gray-600'}`}>{a.current_maturation_status}</span> : '—'}</td>
                          <td className="px-3 py-2.5">{a.maturation_timing ? <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${tcfg?.badge || 'bg-gray-100 text-gray-600'}`}>{a.maturation_timing}</span> : '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button onClick={() => abrirAvaliacao(a)} className={`text-[9px] font-black uppercase ${aberto ? 'text-sky-700' : 'text-gray-400 hover:text-sky-600'}`} title="Carregar no formulário e relatório">{aberto ? '● Aberta' : 'Abrir'}</button>
                              <button onClick={() => deleteAssessment(a.id)} className="text-gray-300 hover:text-red-500" title="Excluir">✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GRÁFICO 2 — EVOLUÇÃO LONGITUDINAL */}
          {serie.length >= 2 && (
            <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 mb-7">
              <p className="bc text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">📈 Evolução longitudinal · {form.name}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Estatura (cm) e Peso (kg)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={serie} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                      <XAxis dataKey="data" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                      <Line type="monotone" dataKey="Estatura" stroke="#0B7C3D" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Peso" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">DPVC (anos)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={serie} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                      <XAxis dataKey="data" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} domain={[-4, 4]} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                      <Line type="monotone" dataKey="DPVC" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* GRÁFICO 3 — DISTRIBUIÇÃO DA CATEGORIA */}
          {distribuicao.total > 0 && (
            <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 mb-7">
              <p className="bc text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-1">📊 Distribuição da categoria{form.category ? ` · ${form.category}` : ' (todas)'}</p>
              <p className="text-[10px] text-gray-400 mb-3">Última avaliação de cada atleta ({distribuicao.total} atleta{distribuicao.total > 1 ? 's' : ''})</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Estado maturacional</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { nome: 'PRÉ-PVC', qtd: distribuicao.estados['PRÉ-PVC'], cor: '#2563eb' },
                      { nome: 'PVC', qtd: distribuicao.estados['PVC'], cor: '#ea580c' },
                      { nome: 'PÓS-PVC', qtd: distribuicao.estados['PÓS-PVC'], cor: '#0B7C3D' },
                    ]} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                      <XAxis dataKey="nome" tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                      <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="qtd" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                        {['#2563eb', '#ea580c', '#0B7C3D'].map((c, i) => <Cell key={i} fill={c} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Timing maturacional</p>
                  <div className="flex flex-col gap-2 mt-1">
                    {Object.keys(distribuicao.timings).length === 0 && <p className="text-[11px] text-gray-400">Sem dados de timing.</p>}
                    {Object.entries(distribuicao.timings).map(([t, n]) => {
                      const tcfg = TIMING_CFG[t]
                      const pct = distribuicao.total ? (n / distribuicao.total) * 100 : 0
                      return (
                        <div key={t}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${tcfg?.badge || 'bg-gray-100 text-gray-600'}`}>{t}</span>
                            <span className="text-[11px] font-bold text-gray-600">{n}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tcfg?.cor || '#94a3b8' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTÃO PDF */}
          <div className="no-print flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-4 mb-8">
            <div>
              <p className="bc text-[12px] font-black uppercase tracking-widest text-gray-700">Relatório individual</p>
              <p className="text-[11px] text-gray-400">{reportData.name ? `${reportData.name}${reportData.assessment_date ? ` · ${fmtDateShort(reportData.assessment_date)}` : ''}` : 'Preencha ou selecione um atleta acima'}</p>
            </div>
            <button onClick={() => window.print()} disabled={reportData.dpvc == null}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-700 text-white text-[11px] font-black uppercase tracking-widest hover:bg-sky-800 shadow-sm transition-colors disabled:opacity-40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Exportar relatório em PDF
            </button>
          </div>
        </div>

        {/* ─────────── RELATÓRIO IMPRIMÍVEL ─────────── */}
        <RelatorioMaturacao d={reportData} />
      </div>
    </AppShell>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ──────────────────────────────────────────────────────────────────────────────
function Field({ label, span2, children }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function DerivedChip({ label, value, hint }) {
  return (
    <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-1.5">
      <div>
        <p className="text-[8px] font-black uppercase tracking-widest text-sky-600 leading-none">{label}</p>
        <p className="bc text-base font-black text-sky-800 leading-none mt-0.5">{value}</p>
      </div>
      {hint && <span className="text-[8px] text-sky-400 italic">{hint}</span>}
    </div>
  )
}

function KpiCard({ label, value, unit, highlight, badge }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-3 py-3 card-hover">
      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5 leading-tight">{label}</p>
      {badge ? (
        <span className={`inline-block text-[10px] font-black uppercase px-2 py-1 rounded-lg ${badge}`}>{value}</span>
      ) : (
        <p className="bc text-2xl font-black leading-none" style={{ color: highlight || '#0f172a' }}>
          {value}{unit && <span className="text-[10px] ml-1 font-bold text-gray-400">{unit}</span>}
        </p>
      )}
    </div>
  )
}

function GuiaItem({ titulo, children }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
      <p className="bc text-[12px] font-black uppercase tracking-wider text-sky-700 mb-1">{titulo}</p>
      <p className="text-[12px] text-gray-600 leading-relaxed">{children}</p>
    </div>
  )
}

// Gráfico 1 — escala/linha do PVC
function PvcScale({ dpvc, cor }) {
  const min = -3, max = 3
  const clamped = Math.max(min, Math.min(max, dpvc))
  const pct = ((clamped - min) / (max - min)) * 100
  const marks = [-3, -2, -1, 0, 1, 2, 3]
  return (
    <div>
      <div className="flex justify-between mb-1.5 px-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Pré-PVC</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-orange-600">PVC</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-sky-700">Pós-PVC</span>
      </div>
      <div className="relative h-7 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, #bfdbfe 0%, #bfdbfe 33%, #fed7aa 33%, #fed7aa 67%, #bbf7d0 67%, #bbf7d0 100%)' }}>
        {/* faixa central PVC (-1 a +1) destacada por divisórias */}
        <div className="absolute top-0 bottom-0" style={{ left: `${((-1 - min) / (max - min)) * 100}%`, width: `${(2 / (max - min)) * 100}%`, borderLeft: '1px dashed rgba(0,0,0,0.25)', borderRight: '1px dashed rgba(0,0,0,0.25)' }} />
        {/* marcador */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center" style={{ left: `${pct}%` }}>
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-md" style={{ background: cor }} />
        </div>
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        {marks.map(m => <span key={m} className="text-[8px] font-bold text-gray-400">{m > 0 ? '+' : ''}{m}</span>)}
      </div>
    </div>
  )
}

// Relatório imprimível (PDF via window.print) — cards modernos, paleta verde/branco
function RelatorioMaturacao({ d }) {
  const GREEN_DARK = '#064e2b'
  const GREEN = '#0B7C3D'
  const GREEN_SOFT = '#e6f6ec'
  const GREEN_LINE = '#cdeedb'
  const TEXT = '#0f3d22'
  const MUTED = '#4d8265'

  const S = {
    page: { fontFamily: "'DM Sans', Arial, sans-serif", maxWidth: 760, margin: '0 auto', padding: '0 0 16px', color: TEXT, fontSize: 11, background: '#ffffff' },
    secTit: { fontFamily: "'Barlow Condensed', sans-serif", color: GREEN_DARK, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 7px', display: 'flex', alignItems: 'center', gap: 8 },
    card: { background: '#ffffff', border: `1px solid ${GREEN_LINE}`, borderRadius: 14, padding: '10px 14px' },
    label: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, fontWeight: 700, margin: 0 },
    value: { fontSize: 13, fontWeight: 700, color: TEXT, margin: '3px 0 0' },
    li: { fontSize: 11, margin: '4px 0', lineHeight: 1.6, color: TEXT },
  }

  const dado = (k, v) => (
    <div style={S.card}>
      <p style={S.label}>{k}</p>
      <p style={S.value}>{v ?? '—'}</p>
    </div>
  )

  const metric = (label, value, explicacao, destaque) => (
    <div style={{
      ...S.card,
      background: destaque ? GREEN_SOFT : '#ffffff',
      borderColor: destaque ? GREEN : GREEN_LINE,
    }}>
      <p style={S.label}>{label}</p>
      <p style={{ fontSize: destaque ? 24 : 16, fontWeight: 900, color: GREEN_DARK, margin: '4px 0 0', fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</p>
      {explicacao && <p style={{ fontSize: 9.5, color: MUTED, margin: '6px 0 0', lineHeight: 1.5 }}>{explicacao}</p>}
    </div>
  )

  return (
    <div id="mat-print">
      <div style={S.page}>
        {/* CABEÇALHO */}
        <div style={{
          background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
          borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
        }}>
          <div style={{ background: '#ffffff', borderRadius: 12, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/confianca.png" alt="Confiança" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          </div>
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: '#ffffff', fontSize: 19, margin: 0, letterSpacing: '0.01em' }}>Associação Desportiva Confiança</p>
            <p style={{ fontWeight: 600, color: '#dff3e6', fontSize: 11.5, margin: '2px 0 0' }}>Relatório de Maturação Somática · Pico de Velocidade de Crescimento (PVC)</p>
          </div>
        </div>

        {/* IDENTIFICAÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '0 2px' }}>
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, color: GREEN_DARK, margin: 0 }}>{d.name || '—'}</p>
            <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 0', fontWeight: 600 }}>{[d.category, d.position, d.sex].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: MUTED }}>
            <p style={{ margin: 0 }}>Avaliação: <strong style={{ color: TEXT }}>{fmtDatePt(d.assessment_date)}</strong></p>
            {d.responsavel && <p style={{ margin: '2px 0 0' }}>Responsável: <strong style={{ color: TEXT }}>{d.responsavel}</strong></p>}
          </div>
        </div>

        {/* DADOS DO ATLETA */}
        <p style={S.secTit}>🧾 Dados do Atleta</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {dado('Nascimento', fmtDatePt(d.birth_date))}
          {dado('Idade decimal', `${fmt(d.idade, 2)} anos`)}
          {dado('Sexo', d.sex)}
          {dado('Estatura', `${fmt(d.estatura, 1)} cm`)}
          {dado('Massa corporal', `${fmt(d.peso, 1)} kg`)}
          {dado('Altura sentado', `${fmt(d.alturaSentado, 1)} cm`)}
          {dado('Comp. das pernas', `${fmt(d.comprimentoPernas, 1)} cm`)}
        </div>

        {/* RESULTADOS */}
        <p style={S.secTit}>📊 Resultados Maturacionais</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {metric(
            'DPVC · Maturity Offset',
            `${d.dpvc != null ? (d.dpvc > 0 ? '+' : '') + fmt(d.dpvc, 2) : '—'} anos`,
            'Distância até o pico de crescimento. Negativo = ainda não chegou ao PVC. Positivo = já ultrapassou o PVC.',
            true,
          )}
          {metric(
            'Idade estimada do PVC',
            `${fmt(d.idadePVC, 2)} anos`,
            'Idade aproximada em que o atleta atingiu (ou tende a atingir) o principal pico de crescimento.',
            true,
          )}
          {metric(
            'Estado maturacional',
            d.estado || '—',
            'Onde o atleta está agora em relação ao PVC: antes, dentro, ou depois do pico de crescimento.',
          )}
          {metric(
            'Timing maturacional',
            d.timing || '—',
            'Se o desenvolvimento ocorre mais cedo, dentro do esperado, ou mais tarde que a média dos pares.',
          )}
        </div>

        {/* INTERPRETAÇÃO */}
        {(d.insight || d.timingInsight) && (<>
          <p style={S.secTit}>🔎 Interpretação</p>
          <div style={{ ...S.card, background: GREEN_SOFT, borderColor: GREEN_LINE }}>
            {d.insight && (
              <p style={{ ...S.li, margin: '0 0 8px' }}>
                <strong style={{ color: GREEN_DARK }}>Estado maturacional atual — </strong>{d.insight}
              </p>
            )}
            {d.timingInsight && (
              <p style={{ ...S.li, margin: 0 }}>
                <strong style={{ color: GREEN_DARK }}>Timing maturacional — </strong>{d.timingInsight}
              </p>
            )}
            <p style={{ fontSize: 10, color: MUTED, fontStyle: 'italic', margin: '10px 0 0', lineHeight: 1.5, borderTop: `1px dashed ${GREEN_LINE}`, paddingTop: 8 }}>
              O <strong>estado</strong> indica onde o atleta está agora em relação ao PVC; o <strong>timing</strong> indica se ele tende a maturar mais cedo, dentro do esperado ou mais tarde que os pares. As leituras são complementares e podem divergir.
            </p>
          </div>
        </>)}

        {/* RODAPÉ */}
        <p style={{ fontSize: 8.5, fontStyle: 'italic', color: MUTED, marginTop: 12, borderTop: `1px solid ${GREEN_LINE}`, paddingTop: 8, lineHeight: 1.5 }}>
          Este relatório utiliza estimativa antropométrica de maturação somática baseada no cálculo do Maturity Offset / Pico de Velocidade de Crescimento (Mirwald et al., 2002).
          O resultado deve ser interpretado como estimativa auxiliar para acompanhamento do desenvolvimento, não como diagnóstico médico ou idade óssea.
        </p>
      </div>
    </div>
  )
}
