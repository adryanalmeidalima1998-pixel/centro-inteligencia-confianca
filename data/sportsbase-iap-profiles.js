/**
 * Perfis IAP nativos do modelo Sportsbase.
 *
 * Não há aliases com o Wyscout: cada chave abaixo corresponde a uma coluna
 * Sportsbase ou a um cálculo direto por 90/conversão explicitamente identificado.
 * Métricas percentuais carregam o denominador e o mínimo de tentativas usados
 * para impedir inflação por amostra curta.
 */

const m = (key, peso, options = {}) => ({ key, peso, ...options })

export const SPORTSBASE_IAP_PERFIS = {
  Goleiro: {},

  Zagueiro: {
    'Defensor de Área': [
      m('duelos_def_pct', 3, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('duelos_aereos_pct', 3, { denominatorKey:'duelos_aereos', minAttempts:20 }),
      m('intercecoes_90', 3),
      m('desarmes_90', 2),
      m('recuperacoes_bola_solta_90', 2),
      m('erros_chances_gol_90', 2, { inverted:true }),
      m('erros_gol_90', 2, { inverted:true }),
    ],
    'Construtor': [
      m('passes_90', 3),
      m('passes_pct', 3, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_prog_90', 3),
      m('passes_prog_pct', 2, { denominatorKey:'passes_prog', minAttempts:30 }),
      m('passes_longos_90', 2),
      m('passes_longos_pct', 2, { denominatorKey:'passes_longos', minAttempts:20 }),
      m('perdas_campo_proprio_90', 2, { inverted:true }),
    ],
    'Agressivo': [
      m('duelos_def_90', 3),
      m('desarmes_90', 3),
      m('intercecoes_90', 3),
      m('recuperacoes_90', 2),
      m('duelos_def_pct', 2, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('faltas_90', 1, { inverted:true }),
    ],
    'Cobertura': [
      m('intercecoes_90', 3),
      m('recuperacoes_90', 3),
      m('recuperacoes_bola_solta_90', 2),
      m('duelos_def_pct', 2, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('perdas_campo_proprio_90', 3, { inverted:true }),
      m('erros_chances_gol_90', 2, { inverted:true }),
    ],
  },

  Lateral: {
    'Ofensivo': [
      m('cruzamentos_90', 3),
      m('cruzamentos_pct', 2, { denominatorKey:'cruzamentos', minAttempts:15 }),
      m('dribles_90', 2),
      m('dribles_pct', 2, { denominatorKey:'dribles', minAttempts:15 }),
      m('entradas_terco_conducao_90', 2),
      m('passes_area_90', 2),
      m('passes_recebidos_tercofinal_90', 1),
    ],
    'Construtor': [
      m('passes_90', 3),
      m('passes_pct', 3, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_prog_90', 3),
      m('passes_prog_pct', 2, { denominatorKey:'passes_prog', minAttempts:30 }),
      m('passes_tercofinal_90', 2),
      m('passes_tercofinal_pct', 2, { denominatorKey:'passes_tercofinal', minAttempts:20 }),
      m('perdas_apos_passes_90', 1, { inverted:true }),
    ],
    'Defensivo': [
      m('duelos_def_90', 3),
      m('duelos_def_pct', 3, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('desarmes_90', 3),
      m('desarmes_pct', 2, { denominatorKey:'desarmes', minAttempts:10 }),
      m('intercecoes_90', 2),
      m('recuperacoes_90', 2),
      m('faltas_90', 1, { inverted:true }),
    ],
    'Equilibrado': [
      m('passes_prog_90', 2),
      m('cruzamentos_90', 2),
      m('duelos_def_pct', 2, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('desarmes_90', 2),
      m('recuperacoes_90', 2),
      m('dribles_90', 2),
      m('perdas_bola_90', 2, { inverted:true }),
    ],
  },

  Volante: {
    'Recuperador': [
      m('duelos_def_90', 3),
      m('duelos_def_pct', 3, { denominatorKey:'duelos_def', minAttempts:20 }),
      m('desarmes_90', 3),
      m('intercecoes_90', 3),
      m('recuperacoes_90', 2),
      m('recuperacoes_campo_adversario_90', 1),
      m('faltas_90', 1, { inverted:true }),
    ],
    'Organizador': [
      m('passes_90', 3),
      m('passes_pct', 3, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_prog_90', 3),
      m('passes_prog_pct', 3, { denominatorKey:'passes_prog', minAttempts:30 }),
      m('passes_longos_90', 2),
      m('passes_longos_pct', 2, { denominatorKey:'passes_longos', minAttempts:20 }),
      m('perdas_apos_passes_90', 2, { inverted:true }),
    ],
    'Área-a-Área': [
      m('recuperacoes_campo_adversario_90', 3),
      m('entradas_terco_conducao_90', 3),
      m('passes_tercofinal_90', 2),
      m('duelos_90', 2),
      m('faltas_sofridas_90', 2),
      m('participacao_gols_90', 1),
      m('perdas_bola_90', 1, { inverted:true }),
    ],
    'Progressor': [
      m('passes_prog_90', 3),
      m('passes_prog_pct', 3, { denominatorKey:'passes_prog', minAttempts:30 }),
      m('passes_tercofinal_90', 3),
      m('entradas_terco_passe_90', 2),
      m('entradas_terco_conducao_90', 2),
      m('dribles_90', 1),
      m('perdas_campo_proprio_90', 2, { inverted:true }),
    ],
  },

  Meia: {
    'Criativo': [
      m('passes_chave_90', 3),
      m('passes_chave_pct', 2, { denominatorKey:'passes_chave', minAttempts:10 }),
      m('assist_remate_90', 3),
      m('passes_area_90', 3),
      m('passes_area_pct', 2, { denominatorKey:'passes_area', minAttempts:15 }),
      m('assistencias_90', 2),
      m('chances_criadas_90', 2),
    ],
    'Organizador Ofensivo': [
      m('passes_90', 2),
      m('passes_pct', 2, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_prog_90', 3),
      m('passes_prog_pct', 2, { denominatorKey:'passes_prog', minAttempts:30 }),
      m('passes_tercofinal_90', 3),
      m('passes_tercofinal_pct', 2, { denominatorKey:'passes_tercofinal', minAttempts:20 }),
      m('perdas_apos_passes_90', 2, { inverted:true }),
    ],
    'Infiltrador': [
      m('entradas_terco_conducao_90', 3),
      m('passes_recebidos_tercofinal_90', 3),
      m('passes_recebidos_area_90', 2),
      m('gols_90', 2),
      m('xg_90', 2),
      m('remates_area_90', 2),
      m('dribles_90', 1),
    ],
    'Conector': [
      m('passes_90', 3),
      m('passes_pct', 3, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_recebidos_90', 3),
      m('acoes_90', 2),
      m('passes_curtos_pct', 2, { denominatorKey:'passes_curtos', minAttempts:50 }),
      m('perdas_bola_90', 3, { inverted:true }),
      m('dominio_incorreto_90', 1, { inverted:true }),
    ],
  },

  Extremo: {
    'Driblador': [
      m('dribles_90', 3),
      m('dribles_pct', 3, { denominatorKey:'dribles', minAttempts:15 }),
      m('dribles_tercofinal_90', 3),
      m('dribles_tercofinal_pct', 2, { denominatorKey:'dribles_tercofinal', minAttempts:10 }),
      m('duelos_of_90', 2),
      m('duelos_of_pct', 2, { denominatorKey:'duelos_of', minAttempts:20 }),
      m('faltas_sofridas_90', 1),
    ],
    'Criador de Lado': [
      m('passes_chave_90', 3),
      m('assist_remate_90', 3),
      m('cruzamentos_90', 2),
      m('cruzamentos_pct', 2, { denominatorKey:'cruzamentos', minAttempts:15 }),
      m('passes_area_90', 3),
      m('assistencias_90', 2),
    ],
    'Vertical': [
      m('entradas_terco_conducao_90', 3),
      m('dribles_tercofinal_90', 3),
      m('passes_recebidos_tercofinal_90', 3),
      m('passes_recebidos_area_90', 2),
      m('duelos_of_90', 2),
      m('perdas_individuais_90', 1, { inverted:true }),
    ],
    'Finalizador de Lado': [
      m('gols_90', 3),
      m('xg_90', 3),
      m('remates_90', 2),
      m('remates_golo_pct', 2, { denominatorKey:'remates', minAttempts:10 }),
      m('conversao_gols_pct', 2, { denominatorKey:'remates', minAttempts:10 }),
      m('remates_area_90', 2),
      m('passes_recebidos_area_90', 1),
    ],
  },

  Atacante: {
    'Finalizador': [
      m('gols_90', 3),
      m('xg_90', 3),
      m('remates_90', 3),
      m('remates_golo_pct', 3, { denominatorKey:'remates', minAttempts:10 }),
      m('conversao_gols_pct', 2, { denominatorKey:'remates', minAttempts:10 }),
      m('remates_area_90', 2),
      m('chances_gol_pct', 2, { denominatorKey:'chances_gol', minAttempts:6 }),
    ],
    'Referência': [
      m('duelos_aereos_90', 3),
      m('duelos_aereos_pct', 3, { denominatorKey:'duelos_aereos', minAttempts:20 }),
      m('duelos_of_90', 3),
      m('duelos_of_pct', 2, { denominatorKey:'duelos_of', minAttempts:20 }),
      m('passes_recebidos_area_90', 2),
      m('cabecadas_90', 2),
      m('gols_cabeca_90', 2),
    ],
    'Móvel': [
      m('dribles_90', 2),
      m('dribles_pct', 2, { denominatorKey:'dribles', minAttempts:15 }),
      m('entradas_terco_conducao_90', 3),
      m('passes_recebidos_tercofinal_90', 3),
      m('passes_recebidos_area_90', 2),
      m('faltas_sofridas_90', 2),
      m('impedimentos_90', 1, { inverted:true }),
    ],
    'Associativo': [
      m('passes_chave_90', 3),
      m('assist_remate_90', 3),
      m('assistencias_90', 2),
      m('passes_pct', 2, { denominatorKey:'passes', minAttempts:100 }),
      m('passes_recebidos_90', 2),
      m('participacao_gols_90', 2),
      m('perdas_bola_90', 2, { inverted:true }),
    ],
  },
}

export function getSportsbaseIapProfiles(grupo) {
  return SPORTSBASE_IAP_PERFIS[grupo] || {}
}

export function isSportsbaseIapMetricEligible(player, metric, minimumMinutes = 0) {
  const value = Number(player?.[metric.key])
  if (!Number.isFinite(value)) return false
  if ((Number(player?.minutos) || 0) < minimumMinutes) return false
  if (metric.denominatorKey && metric.minAttempts) {
    return (Number(player?.[metric.denominatorKey]) || 0) >= metric.minAttempts
  }
  return true
}
