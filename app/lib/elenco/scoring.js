// lib/elenco/scoring.js
// NPR — Nota de Performance no Recorte
// Versão 2.0 — lógica por grupo posicional com escala suavizada

import { aggregatePlayerGames, computePer90 } from './parseStats'

// ---------------------------------------------------------------------------
// Detecção de grupo de posição
// ---------------------------------------------------------------------------

export function detectPosGroup(posicao) {
  const p = (posicao || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\/,]/g, ' ')
    .trim()

  const first = p.split(/[,/\s]+/)[0] || p

  if (/^(gk|gr|gl)$/.test(first) || /goleiro|goalkeeper/.test(p)) return 'goleiro'
  if (/^(r|l)?w(f)?$/.test(first) || /^(rm|lm)$/.test(first) || /ponta|extremo|winger|alero|wing\b/.test(p)) return 'ponta'
  if (/^(cf|st|ss)$/.test(first) || /centroavante|atacante|striker|forward\b/.test(p)) return 'centroavante'
  if (/^(r|l)?amf$/.test(first) || /^(cam|am)$/.test(first) || /\b10\b/.test(p) || /meia.?atacante|trequartista|enganche/.test(p)) return 'meia'
  if (/^(r|l)?dmf$/.test(first) || /^(cdm|dm|dmc)$/.test(first) || /volante|medio.?def/.test(p)) return 'volante'
  if (/^(r|l)?cmf$/.test(first) || /^(cm|mc)$/.test(first) || /\bmeia\b|midfielder|centro.?campo/.test(p)) return 'meia'
  if (/^(r|l)b(5)?$/.test(first) || /^(r|l)wb$/.test(first) || /lateral|fullback|wing.?back/.test(p)) return 'lateral'
  if (/^(r|l)?cb$/.test(first) || /zagueiro|central|defender\b/.test(p)) return 'zagueiro'

  if (/\bgk\b|\bgr\b/.test(p)) return 'goleiro'
  if (/\bcb\b/.test(p)) return 'zagueiro'
  if (/\bdmf\b|\bdm\b/.test(p)) return 'volante'
  if (/\bcmf\b|\bamf\b|\bcm\b|\bam\b/.test(p)) return 'meia'
  if (/\bwf\b|\bw\b|\brw\b|\blw\b/.test(p)) return 'ponta'
  if (/\bcf\b|\bst\b/.test(p)) return 'centroavante'
  if (/\bb\b|\bwb\b/.test(p)) return 'lateral'

  return 'volante'
}

export const POSLABELS = {
  goleiro: 'GOL', zagueiro: 'ZAG', lateral: 'LAT',
  volante: 'VOL', meia: 'MEI', ponta: 'PON', centroavante: 'CA',
}

// ---------------------------------------------------------------------------
// Definição de dimensões por posição
// Cada dimensão tem métricas com pesos. Peso negativo = invertido (menos é melhor).
// ---------------------------------------------------------------------------

const DIMENSIONS = {
  goleiro: {
    defesaMeta: {
      weight: 0.45,
      metrics: {
        defesas: 3,        // defesas totais/90
        defesasPct: 4,     // % de defesas (defesas/remates sofridos)
        defesasReflexo: 2, // defesas difíceis/reflexo
      }
    },
    saidasProfundidade: {
      weight: 0.20,
      metrics: {
        saidas: 3,         // saídas/90
        xcg: -3,           // xCG concedido (menos é melhor)
      }
    },
    jogoComPes: {
      weight: 0.20,
      metrics: {
        passesCertos: 3,
        passesLongos: 2,
        passesLongosCertos: 2,
      }
    },
    seguranca: {
      weight: 0.15,
      metrics: {
        golsSofridos: -4,  // menos gols sofridos = melhor
        rematesSofridos: -2,
      }
    },
  },

  zagueiro: {
    duelos: {
      weight: 0.30,
      metrics: {
        duelosDefensivosGanhos: 3,
        duelosAereosGanhos: 3,
        duelosGanhos: 2,
      }
    },
    protecaoArea: {
      weight: 0.30,
      metrics: {
        intercepcoes: 3,
        recuperacoes: 2,
        aliivos: 2,
      }
    },
    construcao: {
      weight: 0.20,
      metrics: {
        passesCertos: 3,
        passesLongosCertos: 2,
        passesFrente: 1.5,
        passesProgressivos: 2,
      }
    },
    seguranca: {
      weight: 0.20,
      metrics: {
        perdas: -3,
        faltas: -1.5,
        cartamarelos: -2,
        cartvermelhos: -4,
      }
    },
  },

  lateral: {
    defesa: {
      weight: 0.25,
      metrics: {
        duelosDefensivosGanhos: 3,
        intercepcoes: 2.5,
        recuperacoes: 2,
      }
    },
    apoioOfensivo: {
      weight: 0.25,
      metrics: {
        cruzamentosCertos: 3,
        assistenciasRemate: 2,
        passesGrandeArea: 2,
        toquesArea: 1.5,
      }
    },
    profundidadeTransicao: {
      weight: 0.20,
      metrics: {
        corridasSeguidas: 3,
        duelosOfensivosGanhos: 2,
        driblesCertos: 1.5,
      }
    },
    passeCruzamento: {
      weight: 0.15,
      metrics: {
        passesCertos: 2.5,
        passesProgressivos: 2,
        passesTercoFinal: 2,
      }
    },
    seguranca: {
      weight: 0.15,
      metrics: {
        perdas: -2.5,
        cartamarelos: -2,
        cartvermelhos: -4,
      }
    },
  },

  volante: {
    defesaRecuperacao: {
      weight: 0.25,
      metrics: {
        recuperacoes: 3,
        intercepcoes: 2.5,
        duelosDefensivosGanhos: 2,
      }
    },
    duelos: {
      weight: 0.20,
      metrics: {
        duelosGanhos: 2.5,
        duelosAereosGanhos: 2,
        duelosDefensivosGanhos: 2,
      }
    },
    construcao: {
      weight: 0.25,
      metrics: {
        passesCertos: 3,
        passesFrente: 2,
        passesProgressivos: 2.5,
      }
    },
    progressao: {
      weight: 0.15,
      metrics: {
        passesTercoFinal: 2.5,
        passesInteligentes: 2,
        corridasSeguidas: 1.5,
      }
    },
    seguranca: {
      weight: 0.15,
      metrics: {
        perdas: -3,
        cartamarelos: -2,
        cartvermelhos: -4,
        faltas: -1,
      }
    },
  },

  meia: {
    criacao: {
      weight: 0.30,
      metrics: {
        xa: 3,
        assistenciasRemate: 3,
        passesInteligentes: 2.5,
        passesGrandeArea: 2,
      }
    },
    participacaoCirculacao: {
      weight: 0.20,
      metrics: {
        passesCertos: 2.5,
        passesProgressivos: 2.5,
        passesFrente: 2,
      }
    },
    ultimoTerco: {
      weight: 0.20,
      metrics: {
        passesTercoFinal: 3,
        toquesArea: 2.5,
        driblesCertos: 2,
      }
    },
    finalizacao: {
      weight: 0.15,
      metrics: {
        xg: 2.5,
        remates: 2,
        rematesAlvo: 2.5,
      }
    },
    seguranca: {
      weight: 0.15,
      metrics: {
        perdas: -2.5,
        cartamarelos: -2,
        cartvermelhos: -4,
      }
    },
  },

  ponta: {
    um_um: {
      weight: 0.25,
      metrics: {
        driblesCertos: 3.5,
        duelosOfensivosGanhos: 3,
        corridasSeguidas: 2,
      }
    },
    profundidade: {
      weight: 0.20,
      metrics: {
        corridasSeguidas: 3,
        toquesArea: 2.5,
        passesTercoFinal: 2,
      }
    },
    criacao: {
      weight: 0.20,
      metrics: {
        xa: 3,
        assistenciasRemate: 2.5,
        cruzamentosCertos: 2,
        passesGrandeArea: 2,
      }
    },
    finalizacao: {
      weight: 0.20,
      metrics: {
        xg: 3,
        remates: 2,
        rematesAlvo: 2.5,
        gols: 3,
      }
    },
    decisaoSeguranca: {
      weight: 0.15,
      metrics: {
        perdas: -2,
        cartamarelos: -1.5,
        cartvermelhos: -4,
        duelosDefensivosGanhos: 1,
      }
    },
  },

  centroavante: {
    finalizacao: {
      weight: 0.35,
      metrics: {
        gols: 4,
        xg: 3.5,
        rematesAlvo: 3,
        remates: 2,
      }
    },
    presencaArea: {
      weight: 0.20,
      metrics: {
        toquesArea: 3,
        duelosAereosGanhos: 2.5,
        corridasSeguidas: 2,
      }
    },
    apoiosAssociacao: {
      weight: 0.15,
      metrics: {
        assistenciasRemate: 2.5,
        xa: 2,
        passesCertos: 1.5,
      }
    },
    duelos: {
      weight: 0.15,
      metrics: {
        duelosOfensivosGanhos: 3,
        duelosGanhos: 2.5,
        duelosAereosGanhos: 2,
      }
    },
    profundidade: {
      weight: 0.10,
      metrics: {
        corridasSeguidas: 3,
        driblesCertos: 2,
        faltasSofridas: 2,
      }
    },
    decisaoSeguranca: {
      weight: 0.05,
      metrics: {
        perdas: -2.5,
        cartamarelos: -2,
        cartvermelhos: -4,
      }
    },
  },
}

// Labels de dimensão para exibição
export const DIMENSION_LABELS = {
  goleiro: {
    defesaMeta: 'Defesa de Meta',
    saidasProfundidade: 'Saídas/Profundidade',
    jogoComPes: 'Jogo com os Pés',
    seguranca: 'Segurança',
  },
  zagueiro: {
    duelos: 'Duelos',
    protecaoArea: 'Proteção da Área',
    construcao: 'Construção',
    seguranca: 'Segurança',
  },
  lateral: {
    defesa: 'Defesa',
    apoioOfensivo: 'Apoio Ofensivo',
    profundidadeTransicao: 'Profundidade/Transição',
    passeCruzamento: 'Passe/Cruzamento',
    seguranca: 'Segurança',
  },
  volante: {
    defesaRecuperacao: 'Defesa/Recuperação',
    duelos: 'Duelos',
    construcao: 'Construção',
    progressao: 'Progressão',
    seguranca: 'Segurança',
  },
  meia: {
    criacao: 'Criação',
    participacaoCirculacao: 'Participação/Circulação',
    ultimoTerco: 'Último Terço',
    finalizacao: 'Finalização',
    seguranca: 'Segurança',
  },
  ponta: {
    um_um: '1x1',
    profundidade: 'Profundidade',
    criacao: 'Criação',
    finalizacao: 'Finalização',
    decisaoSeguranca: 'Decisão/Segurança',
  },
  centroavante: {
    finalizacao: 'Finalização',
    presencaArea: 'Presença de Área',
    apoiosAssociacao: 'Apoios/Associação',
    duelos: 'Duelos',
    profundidade: 'Profundidade',
    decisaoSeguranca: 'Decisão/Segurança',
  },
}

// ---------------------------------------------------------------------------
// Benchmarks de referência por posição — médias típicas per90 da Série C
// Usados para preencher a população quando há menos de 3 jogadores no grupo.
// Baseados em médias típicas de atletas regulares (não top, não fundo) da 3ª div.
// ---------------------------------------------------------------------------

const BENCHMARKS = {
  goleiro: [
    // ref_baixo, ref_medio, ref_alto — 3 pontos representativos da distribuição
    { defesas: 2.5, defesasReflexo: 0.8, defesasPct: 65, saidas: 1.5, xcg: 1.2, golsSofridos: 1.0, rematesSofridos: 3.5, passesCertos: 18, passesLongos: 6, passesLongosCertos: 3 },
    { defesas: 3.5, defesasReflexo: 1.2, defesasPct: 75, saidas: 2.5, xcg: 1.6, golsSofridos: 1.4, rematesSofridos: 4.5, passesCertos: 24, passesLongos: 8, passesLongosCertos: 4 },
    { defesas: 5.0, defesasReflexo: 1.8, defesasPct: 85, saidas: 4.0, xcg: 2.0, golsSofridos: 1.0, rematesSofridos: 5.5, passesCertos: 32, passesLongos: 11, passesLongosCertos: 6 },
  ],
  zagueiro: [
    { duelosDefensivosGanhos: 3.0, duelosAereosGanhos: 2.0, duelosGanhos: 5.0, intercepcoes: 1.5, recuperacoes: 5.0, aliivos: 3.0, passesCertos: 28, passesLongosCertos: 3, passesFrente: 10, passesProgressivos: 2.0, perdas: 3.5, faltas: 1.5, cartamarelos: 0.3, cartvermelhos: 0.02 },
    { duelosDefensivosGanhos: 4.5, duelosAereosGanhos: 3.2, duelosGanhos: 7.5, intercepcoes: 2.5, recuperacoes: 7.5, aliivos: 5.0, passesCertos: 40, passesLongosCertos: 5, passesFrente: 16, passesProgressivos: 3.5, perdas: 2.5, faltas: 1.0, cartamarelos: 0.15, cartvermelhos: 0.01 },
    { duelosDefensivosGanhos: 6.5, duelosAereosGanhos: 5.0, duelosGanhos: 10.0, intercepcoes: 4.0, recuperacoes: 10.0, aliivos: 7.5, passesCertos: 55, passesLongosCertos: 8, passesFrente: 22, passesProgressivos: 5.5, perdas: 1.5, faltas: 0.5, cartamarelos: 0.05, cartvermelhos: 0 },
  ],
  lateral: [
    { duelosDefensivosGanhos: 2.5, intercepcoes: 1.0, recuperacoes: 4.0, cruzamentosCertos: 0.8, assistenciasRemate: 0.5, passesGrandeArea: 0.8, toquesArea: 1.5, corridasSeguidas: 1.0, duelosOfensivosGanhos: 1.5, driblesCertos: 0.5, passesCertos: 24, passesProgressivos: 2.0, passesTercoFinal: 2.0, perdas: 3.5, cartamarelos: 0.3, cartvermelhos: 0.02 },
    { duelosDefensivosGanhos: 4.0, intercepcoes: 2.0, recuperacoes: 6.0, cruzamentosCertos: 1.5, assistenciasRemate: 1.0, passesGrandeArea: 1.5, toquesArea: 3.0, corridasSeguidas: 2.5, duelosOfensivosGanhos: 3.0, driblesCertos: 1.0, passesCertos: 35, passesProgressivos: 4.0, passesTercoFinal: 4.0, perdas: 2.5, cartamarelos: 0.15, cartvermelhos: 0.01 },
    { duelosDefensivosGanhos: 6.0, intercepcoes: 3.5, recuperacoes: 9.0, cruzamentosCertos: 2.5, assistenciasRemate: 2.0, passesGrandeArea: 2.5, toquesArea: 5.5, corridasSeguidas: 4.5, duelosOfensivosGanhos: 5.0, driblesCertos: 2.0, passesCertos: 48, passesProgressivos: 6.5, passesTercoFinal: 7.0, perdas: 1.5, cartamarelos: 0.05, cartvermelhos: 0 },
  ],
  volante: [
    { recuperacoes: 5.0, intercepcoes: 1.5, duelosDefensivosGanhos: 2.5, duelosGanhos: 5.0, duelosAereosGanhos: 1.5, passesCertos: 28, passesFrente: 12, passesProgressivos: 2.5, passesTercoFinal: 3.0, passesInteligentes: 1.0, corridasSeguidas: 1.0, perdas: 4.0, cartamarelos: 0.3, cartvermelhos: 0.02, faltas: 1.5 },
    { recuperacoes: 8.0, intercepcoes: 2.5, duelosDefensivosGanhos: 4.0, duelosGanhos: 8.0, duelosAereosGanhos: 2.5, passesCertos: 42, passesFrente: 18, passesProgressivos: 4.5, passesTercoFinal: 5.0, passesInteligentes: 2.0, corridasSeguidas: 2.5, perdas: 2.5, cartamarelos: 0.15, cartvermelhos: 0.01, faltas: 1.0 },
    { recuperacoes: 12.0, intercepcoes: 4.0, duelosDefensivosGanhos: 6.0, duelosGanhos: 11.5, duelosAereosGanhos: 4.0, passesCertos: 58, passesFrente: 26, passesProgressivos: 7.0, passesTercoFinal: 8.0, passesInteligentes: 3.5, corridasSeguidas: 4.5, perdas: 1.5, cartamarelos: 0.05, cartvermelhos: 0, faltas: 0.5 },
  ],
  meia: [
    { xa: 0.05, assistenciasRemate: 0.5, passesInteligentes: 1.0, passesGrandeArea: 0.8, passesCertos: 24, passesProgressivos: 2.5, passesFrente: 12, passesTercoFinal: 3.0, toquesArea: 2.0, driblesCertos: 0.5, xg: 0.1, remates: 1.0, rematesAlvo: 0.4, perdas: 4.0, cartamarelos: 0.3, cartvermelhos: 0.02 },
    { xa: 0.15, assistenciasRemate: 1.2, passesInteligentes: 2.0, passesGrandeArea: 1.5, passesCertos: 36, passesProgressivos: 4.5, passesFrente: 18, passesTercoFinal: 5.5, toquesArea: 4.0, driblesCertos: 1.2, xg: 0.2, remates: 1.8, rematesAlvo: 0.8, perdas: 2.5, cartamarelos: 0.15, cartvermelhos: 0.01 },
    { xa: 0.35, assistenciasRemate: 2.5, passesInteligentes: 3.5, passesGrandeArea: 2.8, passesCertos: 50, passesProgressivos: 7.0, passesFrente: 26, passesTercoFinal: 9.0, toquesArea: 7.0, driblesCertos: 2.5, xg: 0.4, remates: 3.0, rematesAlvo: 1.5, perdas: 1.5, cartamarelos: 0.05, cartvermelhos: 0 },
  ],
  ponta: [
    { driblesCertos: 1.0, duelosOfensivosGanhos: 2.0, corridasSeguidas: 2.0, toquesArea: 2.5, passesTercoFinal: 3.0, xa: 0.1, assistenciasRemate: 0.8, cruzamentosCertos: 0.5, passesGrandeArea: 0.8, xg: 0.15, remates: 1.5, rematesAlvo: 0.5, gols: 0.1, perdas: 4.0, cartamarelos: 0.2, cartvermelhos: 0.01, duelosDefensivosGanhos: 1.0 },
    { driblesCertos: 2.0, duelosOfensivosGanhos: 3.5, corridasSeguidas: 4.0, toquesArea: 5.0, passesTercoFinal: 5.5, xa: 0.22, assistenciasRemate: 1.5, cruzamentosCertos: 1.0, passesGrandeArea: 1.5, xg: 0.3, remates: 2.5, rematesAlvo: 1.0, gols: 0.25, perdas: 2.5, cartamarelos: 0.12, cartvermelhos: 0.01, duelosDefensivosGanhos: 2.0 },
    { driblesCertos: 3.5, duelosOfensivosGanhos: 5.5, corridasSeguidas: 7.0, toquesArea: 8.5, passesTercoFinal: 9.0, xa: 0.45, assistenciasRemate: 2.8, cruzamentosCertos: 2.0, passesGrandeArea: 2.8, xg: 0.55, remates: 4.0, rematesAlvo: 2.0, gols: 0.5, perdas: 1.5, cartamarelos: 0.05, cartvermelhos: 0, duelosDefensivosGanhos: 3.5 },
  ],
  centroavante: [
    { gols: 0.15, xg: 0.25, rematesAlvo: 0.8, remates: 1.8, toquesArea: 4.0, duelosAereosGanhos: 2.0, corridasSeguidas: 1.5, assistenciasRemate: 0.5, xa: 0.08, passesCertos: 12, duelosOfensivosGanhos: 2.5, duelosGanhos: 4.5, driblesCertos: 0.5, faltasSofridas: 2.0, perdas: 3.5, cartamarelos: 0.2, cartvermelhos: 0.01 },
    { gols: 0.4, xg: 0.55, rematesAlvo: 1.5, remates: 3.0, toquesArea: 7.0, duelosAereosGanhos: 3.5, corridasSeguidas: 3.5, assistenciasRemate: 1.0, xa: 0.18, passesCertos: 18, duelosOfensivosGanhos: 4.0, duelosGanhos: 7.0, driblesCertos: 1.0, faltasSofridas: 3.5, perdas: 2.5, cartamarelos: 0.12, cartvermelhos: 0.01 },
    { gols: 0.75, xg: 1.0, rematesAlvo: 2.5, remates: 4.5, toquesArea: 11.0, duelosAereosGanhos: 5.5, corridasSeguidas: 6.0, assistenciasRemate: 2.0, xa: 0.35, passesCertos: 26, duelosOfensivosGanhos: 6.5, duelosGanhos: 10.0, driblesCertos: 2.0, faltasSofridas: 5.5, perdas: 1.5, cartamarelos: 0.05, cartvermelhos: 0 },
  ],
}

// Cria "jogadores fantasma" de referência a partir dos benchmarks de uma posição.
// Retorna array de objetos com per90 e agg já preenchidos (estrutura que o scoring usa).
function buildRefPeers(posGroup) {
  const refs = BENCHMARKS[posGroup]
  if (!refs) return []
  return refs.map((bench, i) => ({
    playerId: `__ref_${posGroup}_${i}`,
    playerName: `Ref ${posGroup} ${i}`,
    posGroup,
    totalMin: 810, // ~9 jogos completos — amostra representativa
    agg: { ...bench },
    per90: { ...bench }, // benchmarks já estão em per90
  }))
}



// ---------------------------------------------------------------------------
// Percentile rank dentro da população
// ---------------------------------------------------------------------------

function percentileRank(value, population) {
  if (population.length < 2) return 50
  const sorted = [...population].sort((a, b) => a - b)
  let below = 0
  for (const v of sorted) if (v < value) below++
  return Math.round((below / (sorted.length - 1)) * 100)
}

// ---------------------------------------------------------------------------
// Conversão score 0-100 → nota 0-10 (escala suavizada NPR)
// score 0  = 4.5
// score 50 = 7.0
// score 100 = 9.5
// ---------------------------------------------------------------------------

function scoreToNPR(score) {
  return parseFloat(Math.min(10, Math.max(0, 4.5 + score * 0.05)).toFixed(2))
}

// ---------------------------------------------------------------------------
// Classificação da nota
// ---------------------------------------------------------------------------

export function notaLabel(n) {
  if (n >= 9.0) return 'Excepcional'
  if (n >= 8.0) return 'Destaque'
  if (n >= 7.5) return 'Muito boa'
  if (n >= 7.0) return 'Boa atuação'
  if (n >= 6.5) return 'Correta/Segura'
  if (n >= 6.0) return 'Regular'
  if (n >= 5.0) return 'Abaixo do esperado'
  if (n >= 4.0) return 'Muito abaixo'
  return 'Crítica'
}

export function notaColor(n) {
  if (n >= 8.0) return '#1b5e20'   // verde forte
  if (n >= 7.0) return '#2e7d32'   // verde
  if (n >= 6.5) return '#388e3c'   // verde claro
  if (n >= 6.0) return '#f57f17'   // amarelo/laranja
  if (n >= 5.0) return '#e65100'   // laranja/vermelho
  return '#b71c1c'                 // vermelho
}

// ---------------------------------------------------------------------------
// Confiabilidade e tendência
// ---------------------------------------------------------------------------

function calcConfiabilidade(totalMin) {
  if (totalMin >= 450) return 'alta'
  if (totalMin >= 180) return 'media'
  return 'baixa'
}

function calcAmostra(totalMin) {
  if (totalMin >= 675) return { label: 'Alta', cod: 'alta' }
  if (totalMin >= 405) return { label: 'Média', cod: 'media' }
  if (totalMin >= 180) return { label: 'Baixa', cod: 'baixa' }
  return { label: 'Muito baixa', cod: 'muito_baixa' }
}

// ---------------------------------------------------------------------------
// Engine principal — computeAllScores
// ---------------------------------------------------------------------------

export function computeAllScores(players, pesosNPR = {}) {
  // 1. Enriquecer: calcular agregados e per90
  const enriched = players.map(p => {
    const agg = aggregatePlayerGames(p.games)
    const totalMin = agg['minutos'] || 0
    const per90 = computePer90(agg, totalMin)
    // defesasPct não é per90, vem do agg direto
    if (agg['defesasPct'] !== undefined) per90['defesasPct'] = agg['defesasPct']
    const posGroup = detectPosGroup(p.posicao)
    return { ...p, agg, per90, totalMin, posGroup }
  })

  // 2. Agrupar por posição e completar com benchmarks se grupo for pequeno
  const byPos = {}
  for (const e of enriched) {
    if (!byPos[e.posGroup]) byPos[e.posGroup] = []
    byPos[e.posGroup].push(e)
  }
  // Para cada grupo com menos de 3 atletas reais, adiciona peers de referência
  // Isso garante percentis significativos para goleiros únicos, etc.
  const MIN_GROUP = 3
  for (const posGroup of Object.keys(byPos)) {
    if (byPos[posGroup].length < MIN_GROUP) {
      const refs = buildRefPeers(posGroup)
      byPos[posGroup] = [...byPos[posGroup], ...refs]
    }
  }

  // 3. Calcular NPR para cada jogador
  const result = {}

  for (const pd of enriched) {
    const dims = DIMENSIONS[pd.posGroup] || DIMENSIONS.volante
    const dimLabels = DIMENSION_LABELS[pd.posGroup] || {}
    const peers = byPos[pd.posGroup] || [pd]
    // Pesos customizados da config — normalizar para somar 1.0
    const customWeights = pesosNPR[pd.posGroup]
    let weightTotal = 0
    const effectiveWeights = {}
    for (const [dimKey, dimDef] of Object.entries(dims)) {
      const w = customWeights?.[dimKey] ?? dimDef.weight
      effectiveWeights[dimKey] = w
      weightTotal += w
    }
    if (weightTotal > 0) {
      for (const k of Object.keys(effectiveWeights)) effectiveWeights[k] /= weightTotal
    }

    const dimScores = {}
    const dimBreakdown = {}

    for (const [dimKey, dimDef] of Object.entries(dims)) {
      let wSum = 0, wTotal = 0
      const metBreakdown = {}

      for (const [metric, weight] of Object.entries(dimDef.metrics)) {
        const absW = Math.abs(weight)
        const isNeg = weight < 0

        const population = peers.map(p => {
          const v = p.per90[metric] !== undefined ? p.per90[metric] : (p.agg[metric] || 0)
          return isNaN(v) ? 0 : v
        })
        const myVal = pd.per90[metric] !== undefined ? pd.per90[metric] : (pd.agg[metric] || 0)
        const myValSafe = isNaN(myVal) ? 0 : myVal

        let pct = percentileRank(myValSafe, population)
        if (isNeg) pct = 100 - pct

        metBreakdown[metric] = pct
        wSum += pct * absW
        wTotal += absW
      }

      const dimScore = wTotal > 0 ? wSum / wTotal : 50
      dimScores[dimKey] = dimScore
      dimBreakdown[dimKey] = { score: dimScore, metrics: metBreakdown, label: dimLabels[dimKey] || dimKey }
    }

    // Score final ponderado pelas dimensões (usa pesos efetivos já normalizados)
    let finalScore = 0
    for (const [dimKey] of Object.entries(dims)) {
      finalScore += (dimScores[dimKey] || 0) * (effectiveWeights[dimKey] || 0)
    }

    // Converter para nota NPR com escala suavizada
    let npr = scoreToNPR(finalScore)

    // Ajuste de amostra: cap em 7.5 para menos de 180 min (salvo ação decisiva)
    const totalMin = pd.totalMin
    const hasDecisiveAction = (pd.agg['gols'] || 0) > 0 || (pd.agg['assistencias'] || 0) > 0
    if (totalMin < 180 && !hasDecisiveAction) {
      npr = Math.min(npr, 7.5)
    }

    // Bônus de impacto
    let bonus = 0
    const gols = pd.agg['gols'] || 0
    const assists = pd.agg['assistencias'] || 0
    if (gols >= 3) bonus += 0.8
    else if (gols >= 2) bonus += 0.5
    else if (gols === 1) bonus += 0.3
    if (assists >= 2) bonus += 0.4
    else if (assists === 1) bonus += 0.2
    // Penalidades graves (se disponíveis no futuro via dados externos)
    // Por ora, penalidade por % muito alta de gols sofridos relativa ao xcg (goleiros)
    if (pd.posGroup === 'goleiro') {
      const xcgAgg = pd.agg['xcg'] || 0
      const golsSofridos = pd.agg['golsSofridos'] || 0
      if (xcgAgg > 0 && golsSofridos > xcgAgg * 1.5) bonus -= 0.3
    }

    npr = parseFloat(Math.min(10, Math.max(0, npr + bonus)).toFixed(2))

    // Tendência
    const sortedGames = [...pd.games].sort((a, b) =>
      (a.data || a.jogo || '').localeCompare(b.data || b.jogo || '')
    )

    let tendencia = 'estavel'
    const notasPorJogo = sortedGames.map(g => {
      const minG = g.minutos || 0
      if (minG < 10) return null
      // score simples por jogo: baseado em xg + xa + gols + assistencias
      const sc = (g.xg || 0) + (g.xa || 0) + (g.gols || 0) * 0.8 + (g.assistencias || 0) * 0.5
        + (g.defesas || 0) * 0.15 + (g.intercepcoes || 0) * 0.1 + (g.recuperacoes || 0) * 0.1
      return { nota: sc, min: minG }
    }).filter(Boolean)

    if (notasPorJogo.length >= 4) {
      const n = notasPorJogo.length
      const recentes = notasPorJogo.slice(-3)
      const anteriores = notasPorJogo.slice(0, n - 3)
      const mediaRec = recentes.reduce((s, g) => s + g.nota, 0) / recentes.length
      const mediaAnt = anteriores.reduce((s, g) => s + g.nota, 0) / anteriores.length
      const diff = mediaRec - mediaAnt
      if (diff > 0.15) tendencia = 'subindo'
      else if (diff < -0.15) tendencia = 'caindo'
    }

    // Dimensão mais forte e mais fraca
    const sortedDims = Object.entries(dimScores).sort((a, b) => b[1] - a[1])
    const dimMaisForte = sortedDims[0] ? (dimLabels[sortedDims[0][0]] || sortedDims[0][0]) : '—'
    const dimMaisFraca = sortedDims[sortedDims.length - 1]
      ? (dimLabels[sortedDims[sortedDims.length - 1][0]] || sortedDims[sortedDims.length - 1][0]) : '—'

    const confiabilidade = calcConfiabilidade(totalMin)
    const amostra = calcAmostra(totalMin)

    // Sub-scores por categoria genérica (compatibilidade com ElencoClient)
    const subByGroup = (keys) => {
      const vals = keys.map(k => {
        const population = peers.map(p => p.per90[k] !== undefined ? p.per90[k] : (p.agg[k] || 0))
        const myVal = pd.per90[k] !== undefined ? pd.per90[k] : (pd.agg[k] || 0)
        return percentileRank(isNaN(myVal) ? 0 : myVal, population)
      }).filter(v => v > 0)
      if (!vals.length) return npr
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      return parseFloat(scoreToNPR(avg).toFixed(2))
    }

    result[pd.playerId] = {
      geral: npr,
      finalScore: parseFloat(finalScore.toFixed(1)),
      ofensiva: subByGroup(['xg', 'xa', 'gols', 'assistencias', 'remates', 'rematesAlvo', 'toquesArea', 'driblesCertos']),
      defensiva: subByGroup(['duelosDefensivosGanhos', 'duelosAereosGanhos', 'intercepcoes', 'recuperacoes', 'aliivos', 'defesas']),
      construcao: subByGroup(['passesCertos', 'passesFrente', 'passesProgressivos', 'passesTercoFinal']),
      criacao: subByGroup(['xa', 'assistenciasRemate', 'passesInteligentes', 'passesGrandeArea', 'driblesCertos']),
      finalizacao: subByGroup(['gols', 'xg', 'remates', 'rematesAlvo']),
      impacto: parseFloat(Math.min(10, npr * 0.85 + Math.min(1.5, (gols * 0.3 + assists * 0.2))).toFixed(2)),
      dimScores,
      dimBreakdown,
      dimMaisForte,
      dimMaisFraca,
      confiabilidade,
      amostra,
      tendencia,
      notaLabel: notaLabel(npr),
      notaColor: notaColor(npr),
      totalMin,
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Correlações (mantidas para compatibilidade)
// ---------------------------------------------------------------------------

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function pearson(xs, ys) {
  if (xs.length < 3) return 0
  const mx = mean(xs), my = mean(ys)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  const denom = Math.sqrt(dx * dy)
  return denom === 0 ? 0 : parseFloat((num / denom).toFixed(4))
}

function rankArray(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  return arr.map(v => {
    const positions = sorted.reduce((acc, sv, i) => sv === v ? [...acc, i + 1] : acc, [])
    return positions.reduce((s, p) => s + p, 0) / positions.length
  })
}

export function spearman(xs, ys) {
  return pearson(rankArray(xs), rankArray(ys))
}

export function kendall(xs, ys) {
  let conc = 0, disc = 0
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const signX = Math.sign(xs[j] - xs[i])
      const signY = Math.sign(ys[j] - ys[i])
      const product = signX * signY
      if (product > 0) conc++
      else if (product < 0) disc++
    }
  }
  const total = (xs.length * (xs.length - 1)) / 2
  return total === 0 ? 0 : parseFloat(((conc - disc) / total).toFixed(4))
}

export function computeCorrelation(xs, ys, method = 'spearman') {
  if (method === 'pearson') return pearson(xs, ys)
  if (method === 'kendall') return kendall(xs, ys)
  return spearman(xs, ys)
}
