// Dados exclusivamente demonstrativos para apresentar o ambiente Corpo Técnico
// antes do início da temporada. NUNCA são persistidos no banco.
// Para desligar a demonstração e voltar somente aos dados reais:
// NEXT_PUBLIC_CORPO_TECNICO_DEMO=false

export const CORPO_TECNICO_DEMO_ENABLED = process.env.NEXT_PUBLIC_CORPO_TECNICO_DEMO !== 'false'

export const CONFIANCA_DEMO_ROSTER = [
  { nome:'Rafael Pereira Pascoal', posicao:'Goleiro', codigo:'GK', peso:88, pe_dominante:'Direito' },
  { nome:'Matheus Emiliano Pereira Silva', posicao:'Goleiro', codigo:'GK', peso:84, pe_dominante:'Direito' },
  { nome:'Ícaro Cosmo da Rocha', posicao:'Zagueiro', codigo:'ZAG', peso:86, pe_dominante:'Esquerdo' },
  { nome:'Lucas Cunha', posicao:'Zagueiro', codigo:'ZAG', peso:84, pe_dominante:'Direito' },
  { nome:'Eduardo', posicao:'Zagueiro', codigo:'ZAG', peso:85, pe_dominante:'Esquerdo' },
  { nome:'José Alisson dos Santos', posicao:'Zagueiro', codigo:'ZAG', peso:82, pe_dominante:'Direito' },
  { nome:'Mandovani', posicao:'Zagueiro', codigo:'ZAG', peso:80, pe_dominante:'Direito' },
  { nome:'Kelvyn Ramos da Fonseca', posicao:'Lateral', codigo:'LAT', peso:74, pe_dominante:'Esquerdo' },
  { nome:'Valdir Junior Botelho Correia', posicao:'Lateral', codigo:'LAT', peso:73, pe_dominante:'Direito' },
  { nome:'Mateus Ludke', posicao:'Lateral', codigo:'LAT', peso:75, pe_dominante:'Direito' },
  { nome:'Matheus', posicao:'Lateral', codigo:'LAT', peso:72, pe_dominante:'Esquerdo' },
  { nome:'Marcelo Nunes Correa', posicao:'Lateral', codigo:'LAT', peso:74, pe_dominante:'Esquerdo' },
  { nome:'Renilson dos Santos Silva', posicao:'Volante', codigo:'VOL', peso:78, pe_dominante:'Direito' },
  { nome:'Gabriel Souza Dos Santos', posicao:'Volante', codigo:'VOL', peso:76, pe_dominante:'Direito' },
  { nome:'Guilherme Nunes da Silva', posicao:'Volante', codigo:'VOL', peso:79, pe_dominante:'Esquerdo' },
  { nome:'Madison Araujo Costa', posicao:'Volante', codigo:'VOL', peso:77, pe_dominante:'Direito' },
  { nome:'Paulo Henrique Novais', posicao:'Volante', codigo:'VOL', peso:75, pe_dominante:'Esquerdo' },
  { nome:'Gustavo Amorim Nicola', posicao:'Volante', codigo:'VOL', peso:78, pe_dominante:'Direito' },
  { nome:'Lorran Rosendo Rangel Soares', posicao:'Volante', codigo:'VOL', peso:76, pe_dominante:'Direito' },
  { nome:'Patrick Machado Ferreira', posicao:'Meia', codigo:'MEI', peso:72, pe_dominante:'Direito' },
  { nome:'Fabricio Oya', posicao:'Meia', codigo:'MEI', peso:70, pe_dominante:'Direito' },
  { nome:'João Pedro', posicao:'Meia / Extremo', codigo:'EXT', peso:71, pe_dominante:'Direito' },
  { nome:'Iago Antonio Silva Santos', posicao:'Meia / Extremo', codigo:'EXT', peso:73, pe_dominante:'Esquerdo' },
  { nome:'Danielzinho', posicao:'Meia / Extremo', codigo:'EXT', peso:69, pe_dominante:'Direito' },
  { nome:'Breiner Camilo Barbosa Ospino', posicao:'Meia / Extremo', codigo:'EXT', peso:74, pe_dominante:'Esquerdo' },
  { nome:'Pedro Felipe dos Santos Santana', posicao:'Meia / Extremo', codigo:'EXT', peso:72, pe_dominante:'Direito' },
  { nome:'Andrey Rafael Quintino dos Santos', posicao:'Meia / Extremo', codigo:'EXT', peso:71, pe_dominante:'Direito' },
  { nome:'Maikon Aquino', posicao:'Centroavante', codigo:'ATA', peso:83, pe_dominante:'Direito' },
  { nome:'Sassá', posicao:'Centroavante', codigo:'ATA', peso:80, pe_dominante:'Direito' },
  { nome:'Luiz Thiago Martins da Silva', posicao:'Centroavante', codigo:'ATA', peso:82, pe_dominante:'Direito' },
  { nome:'Wendel Rosas Nogueira Junior', posicao:'Centroavante', codigo:'ATA', peso:79, pe_dominante:'Direito' },
  { nome:'Welder', posicao:'Centroavante', codigo:'ATA', peso:81, pe_dominante:'Direito' },
]

const FIELD_ROSTER = CONFIANCA_DEMO_ROSTER.filter(p => p.codigo !== 'GK')
const GK_ROSTER = CONFIANCA_DEMO_ROSTER.filter(p => p.codigo === 'GK')

function hash(input='') {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}
function seeded(key, min=0, max=1) {
  const n = (hash(String(key)) % 100000) / 100000
  return min + (max - min) * n
}
function round(v, d=0) {
  const p = 10 ** d
  return Math.round(v * p) / p
}
function isoDateOffset(days) {
  const d = new Date('2026-08-31T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function brTimestamp(date, hour='08:05:00') {
  const [y,m,d] = date.split('-')
  return `${d}/${m}/${y} ${hour}`
}

export function buildDemoWellnessData() {
  const dates = Array.from({ length: 12 }, (_, i) => isoDateOffset(i - 11))
  const preRows = []
  const posRows = []
  const duracoes = {}

  dates.forEach((date, di) => {
    const isMatchDay = [3, 8].includes(di)
    duracoes[date] = isMatchDay ? 96 : [68,72,78,82,88][di % 5]
    CONFIANCA_DEMO_ROSTER.forEach((p, pi) => {
      const fatigue = isMatchDay ? 0.3 : (di % 4 === 0 ? 0.5 : 0)
      const sono = Math.max(5, Math.min(10, round(8.5 + seeded(`${date}-${p.nome}-sono`, -1.5, 1.2) - fatigue, 0)))
      const horas = Math.max(6, Math.min(10, round(8.1 + seeded(`${date}-${p.nome}-horas`, -1.1, 1.0) - fatigue * 0.4, 1)))
      const rec = Math.max(5, Math.min(10, round(8.4 + seeded(`${date}-${p.nome}-rec`, -1.7, 1.2) - fatigue, 0)))
      const urina = Math.max(1, Math.min(5, Math.round(2.3 + seeded(`${date}-${p.nome}-urina`, -1.0, 1.7))))
      const painTrigger = (hash(`${date}-${p.nome}-dor`) % 47 === 0) || (pi === 2 && di === 10) || (pi === 13 && di === 7)
      const dor = painTrigger ? 3 + (hash(`${date}-${p.nome}-dor2`) % 4) : 0
      const painLoc = dor ? (pi % 3 === 0 ? 'Adutor direito' : pi % 3 === 1 ? 'Posterior de coxa esquerda' : 'Tornozelo direito') : ''
      const peso = round(p.peso + seeded(`${date}-${p.nome}-peso`, -0.8, 0.8), 1)
      preRows.push({
        'Carimbo de data/hora': brTimestamp(date, `0${7 + (pi % 2)}:${String(5 + pi % 50).padStart(2,'0')}:00`),
        'Atletas': p.nome,
        'Peso (kg)': String(peso).replace('.', ','),
        'Apresenta ou apresentou no dia anterior algum sintoma gastrointestinal?': 'Não',
        'Como foi a qualidade do seu sono?': String(sono),
        'Quantas horas você dormiu na última noite?': String(horas).replace('.', ','),
        'Como você classifica sua recuperação?': String(rec),
        'Qual a coloração da sua urina?': String(urina),
        'QUal a graduação da sua dor': String(dor),
        'Está sentindo alguma dor localizada?': String(dor),
        'Local da Dor': painLoc,
        __demo: true,
      })

      if (di >= 2) {
        const pseBase = isMatchDay ? 8 : [4,5,6,7][(di + pi) % 4]
        const pse = Math.max(2, Math.min(10, pseBase + (hash(`${date}-${p.nome}-pse`) % 3) - 1))
        const postPain = dor > 0 ? Math.min(8, dor + (hash(`${date}-${p.nome}-postdor`) % 2)) : (hash(`${date}-${p.nome}-postdor2`) % 71 === 0 ? 3 : 0)
        posRows.push({
          'Carimbo de data/hora': brTimestamp(date, isMatchDay ? '18:10:00' : '11:35:00'),
          'Atleta': p.nome,
          'Peso (kg)': String(round(peso - seeded(`${date}-${p.nome}-loss`, 0.1, 1.0), 1)).replace('.', ','),
          'Qual sua percepção de esforço pós-treino ?': String(pse),
          'Qual sua percepção de esforço pós-treino?': String(pse),
          'Está sentindo alguma dor localizada?': String(postPain),
          'Local da Dor': postPain ? (painLoc || 'Panturrilha direita') : '',
          __demo: true,
        })
      }
    })
  })

  return { preRows, posRows, duracoes }
}

function sessionRow(p, date, tipo, index, intensity=1) {
  const isMatch = tipo === 'Jogo'
  const posMult = p.codigo === 'ATA' || p.codigo === 'EXT' ? 1.08 : p.codigo === 'VOL' ? 1.03 : p.codigo === 'ZAG' ? 0.93 : 1
  const baseDistance = isMatch ? seeded(`${date}-${p.nome}-dist`, 7800, 10800) : seeded(`${date}-${p.nome}-dist`, 3600, 6800)
  const totalDistance = round(baseDistance * intensity * posMult, 0)
  const dist20 = round((isMatch ? seeded(`${date}-${p.nome}-hsr`, 280, 900) : seeded(`${date}-${p.nome}-hsr`, 120, 520)) * intensity * posMult, 0)
  const dist25 = round((isMatch ? seeded(`${date}-${p.nome}-sprint`, 70, 330) : seeded(`${date}-${p.nome}-sprint`, 30, 190)) * intensity * (p.codigo === 'ZAG' ? .82 : 1), 0)
  const sprints = Math.max(1, Math.round(dist25 / seeded(`${date}-${p.nome}-splen`, 22, 35)))
  return {
    playerName:p.nome,
    positionName:p.posicao,
    periodNumber:'0',
    periodName:tipo,
    totalDistance,
    dist20,
    dist25,
    sprints,
    accel:Math.round(seeded(`${date}-${p.nome}-acc`, isMatch ? 26 : 18, isMatch ? 58 : 42) * intensity),
    decel:Math.round(seeded(`${date}-${p.nome}-dec`, isMatch ? 28 : 20, isMatch ? 62 : 45) * intensity),
    maxVel:round(seeded(`${date}-${p.nome}-vmax`, p.codigo === 'ZAG' ? 28 : 29, p.codigo === 'EXT' || p.codigo === 'ATA' ? 34.2 : 33.1),1),
    isGK:false,
    demo:true,
  }
}

function makeBlocks(rows, date, tipo) {
  if (tipo === 'Jogo') return { blocos:['1º Tempo','2º Tempo'], rowsByBloco:{
    '1º Tempo': rows.map(r => ({...r,totalDistance:round(r.totalDistance*.51),dist20:round(r.dist20*.52),dist25:round(r.dist25*.48),sprints:Math.round(r.sprints*.48),accel:Math.round(r.accel*.52),decel:Math.round(r.decel*.5)})),
    '2º Tempo': rows.map(r => ({...r,totalDistance:round(r.totalDistance*.49),dist20:round(r.dist20*.48),dist25:round(r.dist25*.52),sprints:Math.max(0,r.sprints-Math.round(r.sprints*.48)),accel:Math.max(0,r.accel-Math.round(r.accel*.52)),decel:Math.max(0,r.decel-Math.round(r.decel*.5))})),
  }}
  const names = ['Aquecimento','Jogo reduzido','Tático','Velocidade']
  const weights = [.16,.30,.40,.14]
  const rowsByBloco = Object.fromEntries(names.map((name,bi) => [name, rows.map(r => ({
    ...r,
    totalDistance:round(r.totalDistance*weights[bi]),
    dist20:round(r.dist20*(bi===3?.42:weights[bi])),
    dist25:round(r.dist25*(bi===3?.58:weights[bi]*.7)),
    sprints:Math.max(0,Math.round(r.sprints*(bi===3?.55:weights[bi]*.6))),
    accel:Math.round(r.accel*weights[bi]), decel:Math.round(r.decel*weights[bi]),
  }))]))
  return { blocos:names, rowsByBloco }
}

export function buildDemoGpsSessions() {
  const blueprint = [
    [-11,'Treino','Manhã',.82,'MD+2 · Reintegração'],
    [-10,'Treino','Manhã',1.02,'MD-4 · Volume'],
    [-9,'Treino','Tarde',1.08,'MD-3 · Intensidade'],
    [-8,'Treino','Manhã',.83,'MD-2 · Tático'],
    [-7,'Treino','Manhã',.67,'MD-1 · Ativação'],
    [-6,'Jogo','Tarde',1,'Confiança x Maringá'],
    [-5,'Treino','Manhã',.74,'MD+1 · Compensatório'],
    [-4,'Treino','Tarde',1.05,'MD-4 · Aquisição'],
    [-3,'Treino','Manhã',.92,'MD-3 · Específico'],
    [-2,'Treino','Manhã',.72,'MD-1 · Ajustes'],
    [-1,'Jogo','Tarde',1,'Ferroviária x Confiança'],
    [0,'Treino','Manhã',.70,'MD+1 · Recovery/compensatório'],
  ]
  const sessions = blueprint.map(([offset,tipo,periodo,intensity,titulo], idx) => {
    const date = isoDateOffset(offset)
    const roster = FIELD_ROSTER
    const rows = roster.map((p,pi) => sessionRow(p,date,tipo,pi,intensity * (tipo === 'Jogo' && pi % 8 === 0 ? .76 : 1)))
    const blockData = makeBlocks(rows,date,tipo)
    return {
      id:`demo-gps-${idx+1}`,
      titulo,
      data_sessao:date,
      tipo_sessao:tipo,
      periodo_dia:periodo,
      rows:{ rows, isGK:false, isGk:false, ...blockData, match_info: tipo === 'Jogo' ? { adversario: titulo.replace('Confiança x ','').replace(' x Confiança',''), competicao:'Brasileiro Série C', demo:true } : null },
      created_at:`${date}T12:00:00Z`,
      demo:true,
    }
  })

  ;[-9,-4,0].forEach((offset,j) => {
    const date = isoDateOffset(offset)
    const rows = GK_ROSTER.map((p,pi) => ({
      playerName:p.nome, positionName:'Goleiro', periodNumber:'0', periodName:'Goleiros', isGK:true, demo:true,
      totalDistance:round(seeded(`${date}-${p.nome}-gkdist`,2600,3900)), dist20:round(seeded(`${date}-${p.nome}-gkhsr`,25,90)), dist25:0, sprints:0,
      accel:Math.round(seeded(`${date}-${p.nome}-gkacc`,14,28)), decel:Math.round(seeded(`${date}-${p.nome}-gkdec`,15,30)), maxVel:round(seeded(`${date}-${p.nome}-gkv`,22,27),1),
      totalDiveCount:Math.round(seeded(`${date}-${p.nome}-dives`,16,28)),
      totalDiveLoad:round(seeded(`${date}-${p.nome}-diveload`,55,115),1),
      diveCentreCount:Math.round(seeded(`${date}-${p.nome}-center`,3,8)),
      diveLeftCount:Math.round(seeded(`${date}-${p.nome}-left`,5,12)),
      diveRightCount:Math.round(seeded(`${date}-${p.nome}-right`,5,12)),
      diveLoadRight:round(seeded(`${date}-${p.nome}-loadr`,22,58),1),
      diveLoadLeft:round(seeded(`${date}-${p.nome}-loadl`,22,58),1),
      jumpHigh:Math.round(seeded(`${date}-${p.nome}-jh`,3,9)),
      jumpMed:Math.round(seeded(`${date}-${p.nome}-jm`,6,14)),
      jumpLow:Math.round(seeded(`${date}-${p.nome}-jl`,8,18)),
    }))
    sessions.push({ id:`demo-gk-${j+1}`, titulo:`Goleiros · sessão específica ${j+1}`, data_sessao:date, tipo_sessao:'Goleiros', periodo_dia:'Manhã', rows:{rows,isGK:true,isGk:true,blocos:[],rowsByBloco:{}}, demo:true })
  })
  return sessions.sort((a,b) => String(b.data_sessao).localeCompare(String(a.data_sessao)))
}

export function buildDemoDmData() {
  const cases = [
    { id:'demo-dm-case-1', jogador:'Kelvyn Ramos da Fonseca', parte_corporal:'Adutor', tipo_lesao:'Sobrecarga', diagnostico:'Sobrecarga Muscular', hd_texto:'Sobrecarga adutora após sequência de cargas', estagio:'Fase Subaguda', status:'Tratamento', membro:'MIE', sintomatico:true, conduta:'Controle de sintomas, força isométrica e progressão de corrida', data_entrada:'2026-08-28', data_lesao:'2026-08-27', previsao_retorno:'2026-09-03', observacoes:'DADO FICTÍCIO — demonstração do fluxo do DM.', demo:true },
    { id:'demo-dm-case-2', jogador:'João Pedro', parte_corporal:'Tornozelo', tipo_lesao:'Articular', diagnostico:'Entorse de Tornozelo', hd_texto:'Entorse leve de tornozelo', estagio:'Reabilitação', status:'Recovery', membro:'MID', sintomatico:false, conduta:'Mobilidade, estabilidade, mudança de direção progressiva', data_entrada:'2026-08-24', data_lesao:'2026-08-23', previsao_retorno:'2026-09-01', observacoes:'DADO FICTÍCIO — demonstração do fluxo do DM.', demo:true },
    { id:'demo-dm-case-3', jogador:'Renilson dos Santos Silva', parte_corporal:'Coxa Posterior / Isquiotibiais', tipo_lesao:'Sobrecarga', diagnostico:'Fadiga Muscular', hd_texto:'Desconforto posterior sem perda funcional', estagio:'Retorno Progressivo', status:'Recovery', membro:'MIE', sintomatico:false, conduta:'Exposição progressiva a HSR e controle de força', data_entrada:'2026-08-26', data_lesao:'2026-08-25', previsao_retorno:'2026-09-02', observacoes:'DADO FICTÍCIO — demonstração do fluxo do DM.', demo:true },
    { id:'demo-dm-case-4', jogador:'Lucas Cunha', parte_corporal:'Joelho', tipo_lesao:'Overuse', diagnostico:'Sobrecarga Muscular', hd_texto:'Controle preventivo de carga periarticular', estagio:'Retorno Progressivo', status:'Manutenção', membro:'MID', sintomatico:false, conduta:'Força, mobilidade e manutenção preventiva', data_entrada:'2026-08-29', data_lesao:'2026-08-29', previsao_retorno:null, observacoes:'DADO FICTÍCIO — demonstração do fluxo do DM.', demo:true },
  ]
  const logs = [
    {id:'demo-dm-log-1',data:'2026-08-31',jogador:'Kelvyn Ramos da Fonseca',posicao:'Lateral',pe_dominante:'Esquerdo',categoria:'Profissional',periodo:'Manhã',local_queixa:'Adutor',membro_afetado:'MIE',hd:'Sobrecarga adutora',tipo_trabalho:'Tratamento',pre_pos:'Pré Treino',observacoes:'Isometria + progressão de força. DADO FICTÍCIO.',demo:true},
    {id:'demo-dm-log-2',data:'2026-08-31',jogador:'João Pedro',posicao:'Meia / Extremo',pe_dominante:'Direito',categoria:'Profissional',periodo:'Manhã',local_queixa:'Tornozelo',membro_afetado:'MID',hd:'Entorse leve',tipo_trabalho:'Recovery',pre_pos:'Pré Treino',observacoes:'Propriocepção + corrida linear. DADO FICTÍCIO.',demo:true},
    {id:'demo-dm-log-3',data:'2026-08-30',jogador:'Renilson dos Santos Silva',posicao:'Volante',pe_dominante:'Direito',categoria:'Profissional',periodo:'Tarde',local_queixa:'Coxa Posterior / Isquiotibiais',membro_afetado:'MIE',hd:'Fadiga muscular',tipo_trabalho:'Recovery',pre_pos:'Pós Treino',observacoes:'Força posterior + exposição submáxima. DADO FICTÍCIO.',demo:true},
    {id:'demo-dm-log-4',data:'2026-08-30',jogador:'Lucas Cunha',posicao:'Zagueiro',pe_dominante:'Direito',categoria:'Profissional',periodo:'Tarde',local_queixa:'Joelho',membro_afetado:'MID',hd:'Manutenção preventiva',tipo_trabalho:'Manutenção',pre_pos:'Pós Treino',observacoes:'Rotina de força e mobilidade. DADO FICTÍCIO.',demo:true},
    {id:'demo-dm-log-5',data:'2026-08-29',jogador:'Rafael Pereira Pascoal',posicao:'Goleiro',pe_dominante:'Direito',categoria:'Profissional',periodo:'Tarde',local_queixa:'',membro_afetado:'Bilateral',hd:'Recovery pós-jogo',tipo_trabalho:'Recovery',pre_pos:'Pós Treino',observacoes:'Rotina regenerativa demonstrativa. DADO FICTÍCIO.',demo:true},
  ]
  return { cases, logs }
}

export function demoSquadPlayers() {
  return CONFIANCA_DEMO_ROSTER.map((p, index) => ({
    id:`demo-squad-${index+1}`,
    nome:p.nome,
    posicao:p.posicao,
    pe_dominante:p.pe_dominante,
    peso:p.peso,
    demo:true,
  }))
}
