import * as XLSX from 'xlsx'

/**
 * Exporta o relatório de partida em um formato Excel personalizado.
 * Tenta seguir a estrutura do modelo fornecido (relatoriodepartida.xlsx).
 */
export function exportToCustomExcel(rel, jogo) {
  const wb = XLSX.utils.book_new()
  
  // 1. ABA RELATÓRIO (A principal e complexa)
  // Vamos montar uma estrutura de linhas que tenta espelhar o modelo.
  // O modelo tem um cabeçalho de metadados, depois blocos de avaliação e as súmulas.
  
  const rows = []
  
  // Cabeçalho (Linhas 1-10 aprox)
  rows.push(['Competição', '', '', '', rel.competicao || jogo.comp, '', '', '', '', '', '', '', '', '', '', '', 'Temporada', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['Mandante', '', '', '', rel.mandante || jogo.mandante, '', '', '', 'Visitante', '', '', '', rel.visitante || jogo.visitante, '', '', '', 'Data do Jogo', '', '', '', rel.data_jogo || jogo.data, '', '', '', 'Local', '', '', '', rel.local || '', '', '', ''])
  rows.push(['In Loco?', '', '', '', rel.in_loco || 'Não', '', '', '', 'Observador', '', '', '', rel.observador || jogo.scout, '', '', '', 'Gramado', '', '', '', rel.nivel_gramado || '', '', '', 'Jogo', '', '', '', rel.nivel_jogo || '', '', '', ''])
  rows.push(['Comp.', '', '', '', rel.nivel_comp || '', '', '', '', 'Vídeo', '', '', '', rel.qual_video || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push([])
  rows.push(['OBSERVAÇÕES DA PARTIDA:'])
  rows.push([rel.obs_partida || ''])
  rows.push([])

  // Súmula Mandante
  rows.push([rel.mandante || 'MANDANTE', '', '', '', '', '', '', '', 'TITULARES'])
  rows.push(['', '', '', '', '', '', '', '', 'Nº', 'Nome', '', '', '', '', '', '', 'Posição', '', '', '', '', '', '', 'Nasc.', '', 'Gols', '', 'Avaliar'])
  
  const sm = rel.sumula_mandante || []
  sm.filter(j => j.nome).forEach(j => {
    rows.push(['', '', '', '', '', '', '', '', j.numero, j.nome, '', '', '', '', '', '', j.posicao, '', '', '', '', '', '', j.nasc, '', j.gols || 0, '', j.avaliar ? 'Sim' : ''])
  })
  
  rows.push(['', '', '', '', '', '', '', '', 'RESERVAS'])
  const rm = rel.reservas_mandante || []
  rm.filter(j => j.nome).forEach(j => {
    rows.push(['', '', '', '', '', '', '', '', j.numero, j.nome, '', '', '', '', '', '', j.posicao, '', '', '', '', '', '', j.nasc, '', j.gols || 0, '', j.avaliar ? 'Sim' : ''])
  })
  
  rows.push([])
  
  // Súmula Visitante
  rows.push([rel.visitante || 'VISITANTE', '', '', '', '', '', '', '', 'TITULARES'])
  rows.push(['', '', '', '', '', '', '', '', 'Nº', 'Nome', '', '', '', '', '', '', 'Posição', '', '', '', '', '', '', 'Nasc.', '', 'Gols', '', 'Avaliar'])
  
  const sv = rel.sumula_visitante || []
  sv.filter(j => j.nome).forEach(j => {
    rows.push(['', '', '', '', '', '', '', '', j.numero, j.nome, '', '', '', '', '', '', j.posicao, '', '', '', '', '', '', j.nasc, '', j.gols || 0, '', j.avaliar ? 'Sim' : ''])
  })
  
  rows.push(['', '', '', '', '', '', '', '', 'RESERVAS'])
  const rv = rel.reservas_visitante || []
  rv.filter(j => j.nome).forEach(j => {
    rows.push(['', '', '', '', '', '', '', '', j.numero, j.nome, '', '', '', '', '', '', j.posicao, '', '', '', '', '', '', j.nasc, '', j.gols || 0, '', j.avaliar ? 'Sim' : ''])
  })

  rows.push([])
  rows.push(['AVALIAÇÕES DETALHADAS'])
  
  // Avaliações
  const allAv = [...(rel.sumula_mandante_avaliados || []), ...(rel.sumula_visitante_avaliados || [])]
  allAv.forEach((a, idx) => {
    rows.push([`ATLETA ${idx + 1}: ${a.nome}`, '', '', '', `Time: ${a.time_nome || ''}`])
    rows.push(['Avaliação', a.avaliacao_jogo, 'Nota', a.nota_jogo, 'Recomendação', a.recomendacao, 'Prioridade', a.prioridade])
    rows.push(['Pé', a.pe_preferido, 'Altura', a.altura, 'Maturacional', a.nivel_maturacional, 'Lesionou', a.lesionou])
    
    const cf = a.cap_fisicas || {}
    rows.push(['CAP. FÍSICAS', 'Resistência', 'Potência', 'Agilidade', 'Biotipo', 'Competitividade'])
    rows.push(['', cf.resistencia || '-', cf.potencia || '-', cf.agilidade || '-', cf.biotipo || '-', cf.competitividade || '-'])
    
    const ct = a.cap_tecnicas || {}
    rows.push(['CAP. TÉCNICAS', 'P.Curto', 'P.Longo', 'Técnica', 'Perna Ñ Dom', 'Domínio', 'Função', 'S/ Bola', 'Decisão'])
    rows.push(['', ct.passe_curto || '-', ct.passe_longo || '-', ct.tecnica_posicao || '-', ct.perna_nao_dom || '-', ct.dominio || '-', ct.desempenho_funcao || '-', ct.comportamento_sem_bola || '-', ct.inteligencia || '-'])
    
    rows.push(['PONTOS FORTES', ...(a.pontos_fortes || [])])
    rows.push(['PONTOS FRACOS', ...(a.pontos_fracos || [])])
    rows.push(['OBS GERAIS', a.obs_gerais || ''])
    rows.push([])
  })

  const wsRel = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, wsRel, 'Relatório')

  // 2. ABA AVALIAÇÕES (Lista flat para filtros)
  const avHeader = ['Nome','Time','Posição','Avaliação','Nota','Recomendação','Prioridade','Pé','Altura','Maturacional','Lesionou',
    'P.Forte 1','P.Forte 2','P.Forte 3','P.Forte 4','P.Forte 5',
    'P.Fraco 1','P.Fraco 2','P.Fraco 3','P.Fraco 4','P.Fraco 5',
    'Resistência','Potência','Agilidade','Biotipo','Competitividade',
    'P.Curto','P.Longo','T.Posição','P.Nao Dom','Domínio','Desempenho','Comp.s/bola','Inteligência',
    'Observações Gerais'
  ]
  const avRows = [avHeader, ...allAv.map(a => [
    a.nome, a.time_nome, a.posicao, a.avaliacao_jogo, a.nota_jogo,
    a.recomendacao, a.prioridade, a.pe_preferido, a.altura, a.nivel_maturacional, a.lesionou,
    ...(a.pontos_fortes || ['', '', '', '', '']).slice(0, 5),
    ...(a.pontos_fracos || ['', '', '', '', '']).slice(0, 5),
    a.cap_fisicas?.resistencia, a.cap_fisicas?.potencia, a.cap_fisicas?.agilidade, a.cap_fisicas?.biotipo, a.cap_fisicas?.competitividade,
    a.cap_tecnicas?.passe_curto, a.cap_tecnicas?.passe_longo, a.cap_tecnicas?.tecnica_posicao, a.cap_tecnicas?.perna_nao_dom,
    a.cap_tecnicas?.dominio, a.cap_tecnicas?.desempenho_funcao, a.cap_tecnicas?.comportamento_sem_bola, a.cap_tecnicas?.inteligencia,
    a.obs_gerais
  ])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(avRows), 'Lista de Avaliações')

  XLSX.writeFile(wb, `relatorio_${jogo.mandante}_x_${jogo.visitante}_${jogo.data || ''}.xlsx`)
}
