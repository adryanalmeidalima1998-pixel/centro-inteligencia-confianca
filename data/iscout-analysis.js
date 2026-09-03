import { calculateSportsbasePercentile, getSportsbasePositionGroup } from '@/data/sportsbase-map'

export const ISCOUT_COLS = [
  'jogo','competition','date','posicao','minutos',
  'acoes','acoes_sucesso','gols','assistencias','remates','remates_no_alvo','xg',
  'passes','passes_precisos','passes_longos','passes_longos_precisos',
  'cruzamentos','cruzamentos_precisos','dribles','dribles_sucesso',
  'duelos','duelos_ganhos','duelos_aereos','duelos_aereos_ganhos','intercecoes',
  'perdas_bola','perdas_campo_proprio','recuperacoes','recuperacoes_campo_adversario',
  'amarelos','vermelhos','duelos_def','duelos_def_ganhos','duelos_bola_livre','duelos_bola_livre_ganhos',
  'carrinhos','carrinhos_sucesso','alivios','faltas','amarelos_2','vermelhos_2','assist_remate',
  'duelos_of','duelos_of_ganhos','toques_area','impedimentos','corridas_prog','faltas_sofridas',
  'passes_profundidade','passes_profundidade_precisos','xa','segundas_assistencias','passes_tercofinal','passes_tercofinal_precisos',
  'passes_area','passes_area_precisos','passes_recebidos','passes_frente','passes_frente_precisos',
  'passes_tras','passes_tras_precisos','gols_sofridos','xcg','remates_sofridos','defesas','defesas_reflexo',
  'saidas','gk_desarmes','gk_desarmes_sucesso','tiros_meta','tiros_meta_curtos','tiros_meta_longos',
]

export const POSITION_OPTIONS = [
  ['GK','Goleiro'], ['CB','Zagueiro'], ['RB','Lateral direito'], ['LB','Lateral esquerdo'],
  ['DMF','Volante'], ['CMF','Meia central'], ['AMF','Meia ofensivo'], ['RW','Extremo direito'],
  ['LW','Extremo esquerdo'], ['CF','Atacante'],
]

const POSITION_LABELS = Object.fromEntries(POSITION_OPTIONS)

const METRIC_CATALOG = {
  gols_90: { label:'Gols/90', format:'decimal', good:'apresenta presença de área e capacidade para transformar participação ofensiva em gol.', bad:'ainda entrega pouco impacto direto em gol para o contexto da função.' },
  xg_90: { label:'xG/90', format:'decimal', good:'chega a zonas de finalização com frequência e aparenta conseguir se colocar em situações de maior probabilidade de gol.', bad:'participa pouco de situações claras de finalização e tende a ter presença limitada em zonas de alto valor.' },
  assistencias_90: { label:'Assistências/90', format:'decimal', good:'consegue transformar ações de criação em último passe e demonstra capacidade para servir companheiros em vantagem.', bad:'a produção de último passe ainda aparece de forma pouco constante.' },
  xa_90: { label:'xA/90', format:'decimal', good:'demonstra repertório para criar situações de finalização e alimentar companheiros em zonas perigosas.', bad:'a criação de chances para terceiros ainda parece limitada no recorte.' },
  remates_90: { label:'Finalizações/90', format:'decimal', good:'procura finalizar e consegue aparecer com frequência no desfecho das jogadas.', bad:'participa pouco do desfecho ofensivo e finaliza com baixa frequência.' },
  remates_golo_pct: { label:'Finalizações no alvo %', format:'percent', good:'demonstra bom controle da finalização e consegue direcionar os remates com consistência.', bad:'a execução da finalização ainda oscila e parte importante das tentativas não exige intervenção do goleiro.' },
  passes_90: { label:'Passes/90', format:'decimal', good:'aparece com frequência na circulação e oferece linha de passe de forma constante.', bad:'tem participação reduzida na circulação e pode passar períodos longos sem influenciar a construção.' },
  passes_pct: { label:'Precisão de passe %', format:'percent', good:'demonstra segurança na circulação e boa capacidade para sustentar posse e conectar setores.', bad:'apresenta oscilação na execução do passe e pode interromper sequências de posse em ações de menor pressão.' },
  passes_prog_90: { label:'Passes progressivos/90', format:'decimal', good:'procura ganhar metros por passe e demonstra intenção clara de acelerar a progressão da equipe.', bad:'tende a circular mais de lado ou para trás e oferece pouca progressão direta por passe.' },
  passes_prog_pct: { label:'Passes progressivos certos %', format:'percent', good:'demonstra critério na progressão, conseguindo avançar a jogada sem sacrificar tanto a precisão.', bad:'força parte das ações verticais e ainda precisa escolher melhor o momento para acelerar por passe.' },
  passes_profundidade_90: { label:'Passes em profundidade/90', format:'decimal', sourceOnly:true },
  passes_profundidade_pct: { label:'Passes em profundidade certos %', format:'percent', sourceOnly:true },
  passes_longos_90: { label:'Passes longos/90', format:'decimal', good:'utiliza mudança de corredor e passe longo como recurso para escapar da pressão e acelerar a construção.', bad:'explora pouco o passe longo como alternativa de progressão e mudança de corredor.' },
  passes_longos_pct: { label:'Passes longos certos %', format:'percent', good:'mostra boa execução nas ações de maior distância e consegue encontrar alvos com consistência.', bad:'a precisão em passes de maior distância ainda limita o uso desse recurso.' },
  passes_tercofinal_90: { label:'Passes ao terço final/90', format:'decimal', good:'consegue conectar a construção às zonas mais adiantadas e participa da entrada no terço final.', bad:'tem dificuldade para conectar a posse às zonas mais adiantadas com regularidade.' },
  passes_tercofinal_pct: { label:'Passes ao terço final certos %', format:'percent', good:'mantém boa eficiência quando busca conectar a posse ao terço final.', bad:'a precisão das tentativas para o terço final fica abaixo da referência da função.' },
  passes_area_90: { label:'Passes para a área/90', format:'decimal', good:'consegue encontrar companheiros em zonas próximas ao gol e demonstra intenção de criar dentro da área.', bad:'produz pouco passe que realmente ameaça a última linha e encontra poucas conexões dentro da área.' },
  passes_chave_90: { label:'Passes para finalização/90', format:'decimal', good:'enxerga o companheiro em condição de finalizar e consegue acelerar a jogada no último passe.', bad:'ainda cria poucas ações que terminam em finalização de um companheiro.' },
  cruzamentos_90: { label:'Cruzamentos/90', format:'decimal', good:'chega a zonas de cruzamento e utiliza o corredor para colocar a bola na área com frequência.', bad:'oferece pouco volume de cruzamento e ameaça pouco a área a partir do corredor.' },
  cruzamentos_pct: { label:'Cruzamentos certos %', format:'percent', good:'demonstra boa execução no cruzamento e consegue selecionar alvos dentro da área.', bad:'a qualidade do cruzamento ainda oscila e parte importante das bolas não encontra um alvo útil.' },
  dribles_90: { label:'Dribles/90', format:'decimal', good:'assume o duelo individual e utiliza a condução para superar linhas e gerar vantagem.', bad:'ameaça pouco no um contra um e raramente progride a jogada por eliminação direta do adversário.' },
  dribles_pct: { label:'Dribles certos %', format:'percent', good:'demonstra eficiência no duelo ofensivo e boa capacidade para proteger a bola durante a tentativa de superação.', bad:'perde eficiência quando precisa eliminar o adversário e ainda escolhe melhor as situações de um contra um.' },
  duelos_90: { label:'Duelos/90', format:'decimal', good:'participa ativamente dos confrontos e não se omite em disputas por espaço e posse.', bad:'entra pouco em confronto direto e pode ter participação física limitada em partidas mais intensas.' },
  duelos_pct: { label:'Duelos ganhos %', format:'percent', good:'sustenta bem o contato e demonstra competitividade para sair vencedor em disputas de diferentes naturezas.', bad:'apresenta dificuldade para sustentar o confronto e perde parte importante das disputas em que entra.' },
  duelos_def_90: { label:'Duelos defensivos/90', format:'decimal', good:'é ativo na abordagem e aparece com frequência para interromper ações do adversário.', bad:'tem baixo volume de intervenção defensiva direta e pode depender mais do posicionamento coletivo.' },
  duelos_def_pct: { label:'Duelos defensivos ganhos %', format:'percent', good:'demonstra consistência no confronto defensivo e boa capacidade para sustentar o duelo.', bad:'a eficiência no confronto defensivo ainda oscila e pode ser superado quando precisa defender em campo aberto.' },
  duelos_of_pct: { label:'Duelos ofensivos ganhos %', format:'percent', good:'protege bem a bola sob contato e consegue dar continuidade à jogada mesmo pressionado.', bad:'tem dificuldade para sustentar a posse sob contato e pode perder vantagem quando recebe pressionado.' },
  duelos_aereos_pct: { label:'Duelos aéreos ganhos %', format:'percent', good:'demonstra bom tempo de bola e competitividade nas disputas aéreas.', bad:'apresenta limitação nas disputas aéreas e pode oferecer menor controle de segunda bola nesse tipo de lance.' },
  intercecoes_90: { label:'Interceptações/90', format:'decimal', good:'antecipa linhas de passe e aparenta boa leitura de espaço sem bola.', bad:'antecipa pouco as linhas de passe e participa menos por leitura preventiva do que por reação.' },
  desarmes_90: { label:'Desarmes/90', format:'decimal', good:'é agressivo no tempo de abordagem e consegue interromper conduções com frequência.', bad:'produz pouco desarme direto e pode chegar atrasado ou evitar a abordagem em situações de maior risco.' },
  carrinhos_90: { label:'Carrinhos/90', format:'decimal', sourceOnly:true },
  carrinhos_pct: { label:'Carrinhos bem-sucedidos %', format:'percent', sourceOnly:true },
  recuperacoes_90: { label:'Recuperações/90', format:'decimal', good:'mostra boa leitura de segunda bola e capacidade para reaparecer rapidamente após a perda.', bad:'recupera pouco volume de posse e pode ter menor influência nas transições defensivas.' },
  recuperacoes_campo_adversario_90: { label:'Recuperações altas/90', format:'decimal', good:'apresenta comportamento ativo após a perda e consegue recuperar em zonas mais adiantadas.', bad:'tem pouca presença na recuperação alta e oferece impacto reduzido na pressão pós-perda.' },
  perdas_bola_90: { label:'Perdas de bola/90', format:'decimal', higherIsBetter:false, good:'protege razoavelmente bem a posse e evita oferecer transições ao adversário por ações precipitadas.', bad:'acumula perdas que podem quebrar a continuidade da posse e expor a equipe em transição.' },
  perdas_campo_proprio_90: { label:'Perdas no próprio campo/90', format:'decimal', higherIsBetter:false, good:'demonstra controle de risco em zonas sensíveis e tende a preservar a posse perto da própria meta.', bad:'precisa reduzir perdas em zonas de maior risco, pois pode entregar ao adversário transições curtas e perigosas.' },
  faltas_90: { label:'Faltas/90', format:'decimal', higherIsBetter:false, good:'consegue defender com controle e evita interromper ações por contato desnecessário.', bad:'recorre com frequência à falta e pode aumentar a exposição disciplinar ou oferecer bolas paradas ao adversário.' },
  faltas_sofridas_90: { label:'Faltas sofridas/90', format:'decimal', good:'protege bem a bola e força o adversário a interromper suas ações com contato.', bad:'provoca poucas faltas e gera pouco ganho territorial por proteção de bola ou desequilíbrio individual.' },
  toques_area_90: { label:'Toques na área/90', format:'decimal', good:'consegue ocupar a área e participa das ações em zonas próximas ao gol.', bad:'tem presença reduzida dentro da área e influencia pouco as jogadas em zona de definição.' },
  acoes_pct: { label:'Ações bem-sucedidas %', format:'percent', good:'mantém bom nível de execução no conjunto das ações e aparenta tomar decisões com estabilidade.', bad:'o rendimento global das ações oscila e indica margem para maior consistência técnica.' },
  defesas_pct: { label:'Defesas %', format:'percent', good:'responde bem aos remates sofridos e demonstra capacidade para evitar gols em ações de defesa direta.', bad:'a taxa de defesa ainda fica abaixo do desejável e precisa ser contextualizada pela qualidade e pelo tipo das finalizações enfrentadas.' },
  gols_sofridos_90: { label:'Gols sofridos/90', format:'decimal', higherIsBetter:false, good:'apresenta bom controle do impacto direto no placar dentro da amostra.', bad:'sofre gols em frequência elevada e o indicador precisa ser interpretado junto ao contexto defensivo coletivo e à qualidade das chances enfrentadas.' },
  saidas_90: { label:'Saídas/90', format:'decimal', good:'é ativo fora da linha e demonstra disposição para atacar bolas em profundidade ou cruzamentos.', bad:'atua de forma mais passiva fora da linha e oferece pouco volume de intervenção em saídas.' },

}

export const QUALITATIVE_DIMENSIONS = [
  { key:'qd', code:'QD', label:'Quality of Decision', area:'COGNITIVO', description:'QUALIDADE DA DECISÃO SOB PRESSÃO E TEMPO REDUZIDO.', guidance:'AVALIAR A ESCOLHA, O TEMPO DA AÇÃO E A ADEQUAÇÃO AO CONTEXTO.' },
  { key:'gis', code:'GIS', label:'Game Intelligence', area:'COGNITIVO', description:'PERCEPÇÃO, ANTECIPAÇÃO E TEMPO DE REAÇÃO EM AÇÕES COLETIVAS.', guidance:'OBSERVAR SCANNING, ANTECIPAÇÃO E CAPACIDADE DE LER O DESENVOLVIMENTO DA JOGADA.' },
  { key:'tai', code:'TAI', label:'Tactical Awareness', area:'TÁTICO', description:'ENTENDIMENTO DA FUNÇÃO, MOVIMENTAÇÃO E SINCRONIZAÇÃO COM O MODELO.', guidance:'AVALIAR OCUPAÇÃO DE ESPAÇOS, COBERTURAS, COMPENSAÇÕES E RELAÇÃO COM OS COMPANHEIROS.' },
  { key:'composure', code:'COMP', label:'Composure', area:'COGNITIVO', description:'CLAREZA E CONTROLE DA DECISÃO EM CENÁRIOS DE ALTA PRESSÃO.', guidance:'OBSERVAR SE MANTÉM QUALIDADE DE EXECUÇÃO E ESCOLHA QUANDO O TEMPO E O ESPAÇO DIMINUEM.' },
  { key:'adaptability', code:'ADAPT', label:'Adaptabilidade', area:'TÁTICO/COMPORTAMENTAL', description:'CAPACIDADE DE AJUSTE A RITMO, FUNÇÃO E CONTEXTO COMPETITIVO.', guidance:'PREFERIR AMOSTRA DE MÚLTIPLOS JOGOS E, QUANDO POSSÍVEL, CONTEXTOS DIFERENTES.' },
  { key:'resilience', code:'RES', label:'Resiliência comportamental', area:'COMPORTAMENTAL', description:'REAÇÃO A ERROS, ADVERSIDADES, SUBSTITUIÇÕES E MOMENTOS NEGATIVOS.', guidance:'NÃO INFERIR PELOS DADOS. REGISTRAR APENAS COM EVIDÊNCIA OBSERVACIONAL RECORRENTE.' },
  { key:'communication', code:'COM', label:'Comunicação', area:'COMPORTAMENTAL', description:'CLAREZA E FREQUÊNCIA DA COMUNICAÇÃO EM CAMPO.', guidance:'OBSERVAR ORIENTAÇÃO A COMPANHEIROS, ORGANIZAÇÃO COLETIVA E COMUNICAÇÃO EM MOMENTOS SEM BOLA.' },
]

const THEMATIC_LANGUAGE = {
  finishing: {
    category:'TÉCNICO/OFENSIVO',
    strengthTitle:'IMPACTO E PRESENÇA NA DEFINIÇÃO',
    attentionTitle:'PARTICIPAÇÃO NA FASE DE DEFINIÇÃO',
    good:'O PERFIL ESTATÍSTICO SUGERE IMPACTO RELEVANTE NO DESFECHO DAS JOGADAS PARA A REFERÊNCIA DA FUNÇÃO.',
    bad:'A PRODUÇÃO NA FASE DE DEFINIÇÃO FICA ABAIXO DA REFERÊNCIA. O DADO ISOLADO NÃO PERMITE CONCLUIR LIMITAÇÃO TÉCNICA SEM CONTEXTUALIZAR FUNÇÃO, VOLUME E QUALIDADE DAS CHANCES.',
    validate:['MOVIMENTAÇÃO PARA CRIAR LINHA DE FINALIZAÇÃO.','QUALIDADE DAS CHANCES E TIPO DE FINALIZAÇÃO.','TIMING PARA ATACAR A ÁREA E A SEGUNDA BOLA.'],
  },
  creation: {
    category:'TÉCNICO/COGNITIVO',
    strengthTitle:'CRIAÇÃO E ÚLTIMO PASSE',
    attentionTitle:'PRODUÇÃO CRIATIVA',
    good:'O DADO SUGERE PARTICIPAÇÃO RELEVANTE NA CRIAÇÃO DE SITUAÇÕES DE FINALIZAÇÃO E NA CONEXÃO COM ZONAS DE MAIOR PERIGO.',
    bad:'A PRODUÇÃO CRIATIVA FICA ABAIXO DA REFERÊNCIA DA FUNÇÃO. O INDICADOR PRECISA SER INTERPRETADO CONSIDERANDO A RESPONSABILIDADE DO ATLETA NO MODELO E AS CONDIÇÕES EM QUE RECEBE NO ÚLTIMO TERÇO.',
    validate:['RECEPÇÃO ENTRELINHAS E ORIENTAÇÃO CORPORAL.','PERCEPÇÃO DE CORRIDAS E JANELAS DE PASSE.','VELOCIDADE E QUALIDADE DA DECISÃO NO ÚLTIMO TERÇO.'],
  },
  circulation: {
    category:'TÉCNICO/TÁTICO',
    strengthTitle:'CIRCULAÇÃO E CONEXÃO ENTRE SETORES',
    attentionTitle:'ENVOLVIMENTO E ESTABILIDADE COM BOLA',
    good:'O DADO SUGERE BOA PARTICIPAÇÃO NA CIRCULAÇÃO E CAPACIDADE PARA DAR CONTINUIDADE À POSSE.',
    bad:'O INDICADOR FICA ABAIXO DA REFERÊNCIA DA FUNÇÃO. O RESULTADO PODE REFLETIR MENOR ENVOLVIMENTO, MAIOR GRAU DE RISCO OU LIMITAÇÕES DE EXECUÇÃO, A DEPENDER DO PAPEL EXERCIDO.',
    validate:['ORIENTAÇÃO CORPORAL ANTES DA RECEPÇÃO.','QUALIDADE DAS LINHAS DE PASSE OFERECIDAS.','PRESSÃO RECEBIDA E GRAU DE RISCO DAS TENTATIVAS.'],
  },
  progression: {
    category:'TÉCNICO/TÁTICO',
    strengthTitle:'PROGRESSÃO E CONEXÃO ENTRE SETORES',
    attentionTitle:'PROGRESSÃO DA POSSE',
    good:'O PERFIL ESTATÍSTICO SUGERE BOA CAPACIDADE PARA FAZER A BOLA AVANÇAR E CONECTAR SETORES.',
    bad:'A PROGRESSÃO FICA ABAIXO DA REFERÊNCIA DA FUNÇÃO. ISSO NÃO DEFINE PERFIL CONSERVADOR SEM CONSIDERAR A ESTRUTURA DE POSSE, A PRESSÃO RECEBIDA E AS RESPONSABILIDADES DO ATLETA.',
    validate:['ORIENTAÇÃO CORPORAL ANTES DE RECEBER.','LEITURA DA PRESSÃO E DO JOGADOR LIVRE À FRENTE DA LINHA DA BOLA.','SELEÇÃO DO MOMENTO PARA ACELERAR OU CIRCULAR.'],
  },
  wide: {
    category:'TÉCNICO/TÁTICO',
    strengthTitle:'AMEAÇA E ENTREGA PELO CORREDOR',
    attentionTitle:'PRODUÇÃO A PARTIR DO CORREDOR',
    good:'O DADO SUGERE PARTICIPAÇÃO RELEVANTE EM AÇÕES DE CORREDOR, COM CAPACIDADE PARA GERAR VANTAGEM OU ENTREGAR BOLA EM ZONA DE DEFINIÇÃO.',
    bad:'A PRODUÇÃO PELO CORREDOR FICA ABAIXO DA REFERÊNCIA. O INDICADOR DEVE SER LIDO À LUZ DO PAPEL DO ATLETA, QUE PODE PRIORIZAR LARGURA, OCUPAÇÃO INTERIOR OU APOIO MAIS BAIXO.',
    validate:['TIMING DE APOIO, SOBREPOSIÇÃO OU MOVIMENTO INTERIOR.','DECISÃO ENTRE CRUZAR, CONDUZIR, ASSOCIAR OU RECICLAR.','QUALIDADE DA ENTREGA SOB PRESSÃO.'],
  },
  duel: {
    category:'FÍSICO/FUNCIONAL',
    strengthTitle:'COMPETITIVIDADE NOS CONFRONTOS',
    attentionTitle:'SUSTENTAÇÃO DO CONFRONTO',
    good:'O DADO SUGERE BOM NÍVEL DE COMPETITIVIDADE E EFICIÊNCIA EM DISPUTAS POR POSSE E ESPAÇO.',
    bad:'O INDICADOR DE DUELO FICA ABAIXO DA REFERÊNCIA. O RESULTADO PODE ESTAR ASSOCIADO A CAPACIDADE FÍSICA, TIMING DE AÇÃO, TIPO DE CONFRONTO OU CONTEXTO POSICIONAL.',
    validate:['TIPO E ZONA DOS DUELOS.','USO DO CORPO, BASE DE APOIO E TEMPO DE ENTRADA.','CAPACIDADE DE PROTEGER O ESPAÇO ANTES DO CONTATO.'],
  },
  defense: {
    category:'TÁTICO/DEFENSIVO',
    strengthTitle:'OCUPAÇÃO E INTERVENÇÃO DEFENSIVA',
    attentionTitle:'VOLUME DE INTERVENÇÃO DEFENSIVA',
    good:'O DADO SUGERE PRESENÇA RELEVANTE EM AÇÕES DE RECUPERAÇÃO OU INTERRUPÇÃO DO ADVERSÁRIO.',
    bad:'O VOLUME DEFENSIVO FICA ABAIXO DA REFERÊNCIA. ISOLADAMENTE, ISSO NÃO PERMITE CONCLUIR DIFICULDADE DEFENSIVA, POIS PODE REFLETIR POSICIONAMENTO, ALTURA DO BLOCO, POSSE DA EQUIPE OU FUNÇÃO.',
    validate:['POSICIONAMENTO PREVENTIVO E CONTROLE DA ZONA.','MOMENTO DE SALTAR NO PORTADOR OU INTERCEPTAR.','CAPACIDADE DE TEMPORIZAR E COBRIR SEM ROMPER A ESTRUTURA.'],
  },
  risk: {
    category:'TÉCNICO/COGNITIVO',
    strengthTitle:'CONTROLE DE RISCO COM BOLA',
    attentionTitle:'PERDAS E EXPOSIÇÃO EM TRANSIÇÃO',
    good:'O DADO SUGERE BOM CONTROLE DE RISCO E MENOR FREQUÊNCIA DE PERDAS PARA A FUNÇÃO.',
    bad:'O VOLUME DE PERDAS É ALTO E MERECE ATENÇÃO. O RESULTADO PODE ENVOLVER ERRO TÉCNICO, DECISÃO SOB PRESSÃO OU MAIOR FREQUÊNCIA DE AÇÕES DE ALTO RISCO QUE BUSCAM GERAR VANTAGEM.',
    validate:['ZONA E MOMENTO DAS PERDAS.','PRESSÃO RECEBIDA ANTES DA AÇÃO.','RISCO ASSUMIDO VERSUS VANTAGEM POTENCIAL.'],
  },
  goalkeeper: {
    category:'TÉCNICO/TÁTICO · GOL',
    strengthTitle:'INTERVENÇÃO DO GOLEIRO',
    attentionTitle:'INTERVENÇÃO DO GOLEIRO',
    good:'O RECORTE ESTATÍSTICO SUGERE DESEMPENHO COMPETITIVO NAS AÇÕES DIRETAMENTE ASSOCIADAS À FUNÇÃO.',
    bad:'O INDICADOR FICA ABAIXO DA REFERÊNCIA E PRECISA SER REVISADO LANCE A LANCE, CONSIDERANDO QUALIDADE DAS FINALIZAÇÕES, POSICIONAMENTO E CONTEXTO DEFENSIVO.',
    validate:['POSICIONAMENTO INICIAL E AJUSTE DOS PÉS.','TEMPO DE REAÇÃO E DECISÃO DE INTERVENÇÃO.','CONTEXTO DA FINALIZAÇÃO OU DA SAÍDA.'],
  },
}

const METRIC_THEME = {
  gols_90:'finishing', xg_90:'finishing', remates_90:'finishing', remates_golo_pct:'finishing', toques_area_90:'finishing',
  assistencias_90:'creation', xa_90:'creation', passes_chave_90:'creation', passes_area_90:'creation',
  passes_90:'circulation', passes_pct:'circulation', passes_longos_90:'circulation', passes_longos_pct:'circulation',
  passes_prog_90:'progression', passes_prog_pct:'progression', passes_tercofinal_90:'progression', passes_tercofinal_pct:'progression',
  cruzamentos_90:'wide', cruzamentos_pct:'wide', dribles_90:'wide', dribles_pct:'wide',
  duelos_90:'duel', duelos_pct:'duel', duelos_def_pct:'duel', duelos_of_pct:'duel', duelos_aereos_pct:'duel', faltas_sofridas_90:'duel',
  duelos_def_90:'defense', intercecoes_90:'defense', desarmes_90:'defense', recuperacoes_90:'defense', recuperacoes_campo_adversario_90:'defense', faltas_90:'defense',
  perdas_bola_90:'risk', perdas_campo_proprio_90:'risk', acoes_pct:'risk',
  defesas_pct:'goalkeeper', gols_sofridos_90:'goalkeeper', saidas_90:'goalkeeper',
}

const METRIC_OVERRIDES = {
  passes_tercofinal_90:{ strengthTitle:'CONEXÃO COM O TERÇO FINAL', attentionTitle:'VOLUME DE CONEXÃO COM O TERÇO FINAL' },
  passes_prog_90:{ strengthTitle:'PROGRESSÃO E CONEXÃO ENTRE SETORES', attentionTitle:'VOLUME DE PROGRESSÃO POR PASSE' },
  intercecoes_90:{ strengthTitle:'OCUPAÇÃO E LEITURA DE LINHAS DE PASSE', attentionTitle:'INTERVENÇÃO PREVENTIVA' },
  recuperacoes_campo_adversario_90:{ strengthTitle:'IMPACTO NA PRESSÃO ALTA', attentionTitle:'RECUPERAÇÃO EM CAMPO ADVERSÁRIO' },
  perdas_campo_proprio_90:{ strengthTitle:'CONTROLE DE RISCO EM ZONA SENSÍVEL', attentionTitle:'PERDAS NO PRÓPRIO CAMPO' },
  dribles_90:{ strengthTitle:'CAPACIDADE DE ELIMINAÇÃO', attentionTitle:'AMEAÇA NO 1X1' },
  passes_area_90:{ strengthTitle:'AMEAÇA À ÚLTIMA LINHA', attentionTitle:'CONEXÃO COM A ÁREA' },
  duelos_aereos_pct:{ strengthTitle:'COMPETITIVIDADE AÉREA', attentionTitle:'DISPUTA AÉREA' },
  defesas_pct:{ strengthTitle:'EFICIÊNCIA DE DEFESA', attentionTitle:'RESPOSTA A FINALIZAÇÕES' },
  saidas_90:{ strengthTitle:'CONTROLE DE PROFUNDIDADE E SAÍDAS', attentionTitle:'VOLUME DE INTERVENÇÃO FORA DA LINHA' },
}

const POSITION_METRICS = {
  // KPIs comparáveis por função. Só entram métricas cuja semântica é equivalente
  // entre o export iScout e as bases de benchmark Série C / Confiança.
  GK: [
    ['defesas_pct',3], ['gols_sofridos_90',2.5], ['saidas_90',2.2], ['passes_pct',1.8], ['passes_longos_pct',2], ['passes_90',1],
  ],
  CB: [
    ['duelos_def_90',2.2], ['duelos_def_pct',3], ['duelos_aereos_pct',2.7], ['intercecoes_90',2.5], ['recuperacoes_90',1.8],
    ['passes_pct',2], ['passes_longos_pct',1.7], ['perdas_campo_proprio_90',2.2],
  ],
  RB: [
    ['duelos_def_pct',2.4], ['intercecoes_90',1.5], ['recuperacoes_90',1.6], ['passes_tercofinal_90',2.2], ['passes_tercofinal_pct',1.6],
    ['cruzamentos_90',2.4], ['cruzamentos_pct',1.8], ['dribles_90',1.5], ['passes_area_90',1.6], ['perdas_bola_90',1.4],
  ],
  LB: [
    ['duelos_def_pct',2.4], ['intercecoes_90',1.5], ['recuperacoes_90',1.6], ['passes_tercofinal_90',2.2], ['passes_tercofinal_pct',1.6],
    ['cruzamentos_90',2.4], ['cruzamentos_pct',1.8], ['dribles_90',1.5], ['passes_area_90',1.6], ['perdas_bola_90',1.4],
  ],
  DMF: [
    ['recuperacoes_90',2.7], ['recuperacoes_campo_adversario_90',1.6], ['duelos_def_90',2.1], ['duelos_def_pct',2.4], ['intercecoes_90',2.2],
    ['passes_90',1.8], ['passes_pct',2], ['passes_tercofinal_90',2.3], ['passes_longos_pct',1.6], ['perdas_campo_proprio_90',2.3],
  ],
  CMF: [
    ['passes_90',2.5], ['passes_pct',2.1], ['passes_tercofinal_90',2.5], ['passes_tercofinal_pct',1.7], ['passes_longos_pct',1.5],
    ['passes_chave_90',1.5], ['recuperacoes_90',1.5], ['intercecoes_90',1.3], ['duelos_def_pct',1.4], ['perdas_bola_90',1.8],
  ],
  AMF: [
    ['passes_chave_90',3], ['assistencias_90',2.2], ['passes_tercofinal_90',1.8], ['passes_area_90',2.6], ['dribles_90',1.8],
    ['dribles_pct',1.5], ['xg_90',1.5], ['remates_90',1.4], ['passes_pct',1.2], ['perdas_bola_90',1.5],
  ],
  RW: [
    ['dribles_90',2.7], ['dribles_pct',2], ['passes_area_90',2.2], ['cruzamentos_90',1.7], ['cruzamentos_pct',1.4],
    ['passes_chave_90',1.6], ['xg_90',2], ['gols_90',2.5], ['assistencias_90',2], ['remates_90',1.8],
  ],
  LW: [
    ['dribles_90',2.7], ['dribles_pct',2], ['passes_area_90',2.2], ['cruzamentos_90',1.7], ['cruzamentos_pct',1.4],
    ['passes_chave_90',1.6], ['xg_90',2], ['gols_90',2.5], ['assistencias_90',2], ['remates_90',1.8],
  ],
  CF: [
    ['gols_90',3], ['xg_90',3], ['remates_90',2.7], ['remates_golo_pct',2.2], ['duelos_of_pct',1.8],
    ['duelos_aereos_pct',1.8], ['assistencias_90',1.2], ['passes_chave_90',1.2], ['faltas_sofridas_90',1],
  ],
}


const MODEL_ALIAS = {
  assist_remate_90: 'passes_chave_90',
  intercepoes_90: 'intercecoes_90',
  intercecoes_90: 'intercecoes_90',
  passes_chave_90: 'passes_chave_90',
  assistencias_90: 'assistencias_90',
  recuperacoes_campo_adversario_90: 'recuperacoes_campo_adversario_90',
}

const PROFILE_RULES = {
  CB: {
    'Defensor de Área': [['duelos_def_pct',3],['duelos_aereos_pct',3],['intercecoes_90',2.5],['recuperacoes_90',2]],
    'Construtor': [['passes_pct',3],['passes_longos_pct',2.5],['perdas_campo_proprio_90',2]],
    'Agressivo': [['duelos_def_90',3],['intercecoes_90',2.5],['recuperacoes_90',2.5],['duelos_def_pct',2]],
    'Cobertura': [['intercecoes_90',3],['recuperacoes_90',3],['duelos_def_pct',2],['perdas_campo_proprio_90',2]],
  },
  FB: {
    'Ofensivo': [['cruzamentos_90',3],['cruzamentos_pct',2],['dribles_90',2],['dribles_pct',2],['passes_area_90',2]],
    'Construtor': [['passes_tercofinal_90',3],['passes_tercofinal_pct',2],['passes_area_90',2],['recuperacoes_90',1]],
    'Defensivo': [['duelos_def_pct',3],['intercecoes_90',2.5],['recuperacoes_90',2.5]],
    'Equilibrado': [['passes_tercofinal_90',2],['cruzamentos_90',2],['duelos_def_pct',2],['recuperacoes_90',2],['dribles_90',2],['perdas_bola_90',1.5]],
  },
  DM: {
    'Recuperador': [['duelos_def_90',2.5],['duelos_def_pct',3],['intercecoes_90',3],['recuperacoes_90',3],['recuperacoes_campo_adversario_90',1.5]],
    'Organizador': [['passes_90',3],['passes_pct',3],['passes_tercofinal_90',2.5],['passes_tercofinal_pct',2],['passes_longos_pct',2],['perdas_campo_proprio_90',2]],
    'Área-a-Área': [['recuperacoes_campo_adversario_90',2.5],['passes_tercofinal_90',2.5],['duelos_def_90',2],['recuperacoes_90',2],['passes_90',1.5]],
    'Conector': [['passes_90',3],['passes_pct',2.5],['passes_tercofinal_90',3],['passes_chave_90',1.5],['perdas_bola_90',2]],
  },
  AM: {
    'Criativo': [['passes_chave_90',3],['passes_area_90',3],['assistencias_90',2]],
    'Organizador Ofensivo': [['passes_pct',2],['passes_tercofinal_90',3],['passes_area_90',2.5],['perdas_bola_90',1.5]],
    'Infiltrador': [['gols_90',2],['xg_90',2.5],['remates_90',2],['dribles_90',1.5]],
    'Conector': [['passes_pct',3],['passes_tercofinal_90',2.5],['passes_chave_90',2],['perdas_bola_90',2]],
  },
  WG: {
    'Driblador': [['dribles_90',3],['dribles_pct',3],['passes_area_90',1.5]],
    'Criador de Lado': [['passes_chave_90',3],['cruzamentos_90',2.5],['cruzamentos_pct',2],['passes_area_90',3],['assistencias_90',2]],
    'Vertical': [['dribles_90',2.5],['passes_area_90',2],['remates_90',1.5]],
    'Finalizador de Lado': [['gols_90',3],['xg_90',3],['remates_90',2.5],['assistencias_90',1]],
  },
  ST: {
    'Finalizador': [['gols_90',3],['xg_90',3],['remates_90',3],['remates_golo_pct',2.5]],
    'Referência': [['duelos_aereos_pct',3],['duelos_of_pct',2.5],['faltas_sofridas_90',1.5]],
    'Móvel': [['faltas_sofridas_90',2],['remates_90',2],['passes_chave_90',1.5]],
    'Associativo': [['passes_chave_90',3],['assistencias_90',2.5],['duelos_of_pct',2]],
  },
}

function n(value) {
  if (value === null || value === undefined || value === '' || value === '-') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value).replace('%','').trim().replace(/\s/g,'').replace(',', '.')
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10)
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0,10)
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? text : d.toISOString().slice(0,10)
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null
  const f = 10 ** digits
  return Math.round(value * f) / f
}

function per90(value, minutes) {
  return minutes > 0 ? round((value * 90) / minutes, 2) : null
}

function pct(success, total) {
  return total > 0 ? round((success / total) * 100, 1) : null
}

function mode(values) {
  const counts = new Map()
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || null
}

function inferClub(games) {
  const counts = new Map()
  for (const game of games) {
    const match = String(game.jogo || '')
    const m = match.match(/^(.+?)\s+-\s+(.+?)\s+\d+\s*:\s*\d+\s*$/)
    if (!m) continue
    for (const club of [m[1].trim(), m[2].trim()]) counts.set(club, (counts.get(club) || 0) + 1)
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || null
}

function canonicalPosition(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  const first = raw.split(',')[0].trim().replace(/\d+$/,'')
  if (first === 'GK') return 'GK'
  if (['CB','LCB','RCB'].includes(first)) return 'CB'
  if (['RB','RWB'].includes(first)) return 'RB'
  if (['LB','LWB'].includes(first)) return 'LB'
  if (['DMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM'].includes(first)) return 'DMF'
  if (['CMF','LCMF','RCMF','LCM','RCM'].includes(first)) return 'CMF'
  if (['AMF','CAM','LCAM','RCAM'].includes(first)) return 'AMF'
  if (['RW','RWF','RAM','RAMF','RM','RMF'].includes(first)) return 'RW'
  if (['LW','LWF','LAM','LAMF','LM','LMF'].includes(first)) return 'LW'
  if (['CF','LCF','RCF','SS'].includes(first)) return 'CF'
  const pt = first.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  if (/GOLEIRO|^GOL$/.test(pt)) return 'GK'
  if (/ZAGUEIRO/.test(pt)) return 'CB'
  if (/LATERAL DIREITO/.test(pt)) return 'RB'
  if (/LATERAL ESQUERDO/.test(pt)) return 'LB'
  if (/VOLANTE/.test(pt)) return 'DMF'
  if (/MEIA OFENSIVO|MEIA ATACANTE/.test(pt)) return 'AMF'
  if (/MEIA/.test(pt)) return 'CMF'
  if (/PONTA DIREITA|EXTREMO DIREITO/.test(pt)) return 'RW'
  if (/PONTA ESQUERDA|EXTREMO ESQUERDO/.test(pt)) return 'LW'
  if (/ATACANTE|CENTROAVANTE/.test(pt)) return 'CF'
  return first
}

function positionGroup(posicao) {
  return getSportsbasePositionGroup(canonicalPosition(posicao)) || 'DM'
}

function positionRole(value) {
  const raw = String(value || '').trim().toUpperCase().split(',')[0].trim()
  if (!raw) return ''
  if (raw === 'GK') return 'GK'
  if (['CB','LCB','RCB'].includes(raw)) return 'CB'
  if (['RB','RWB'].includes(raw)) return 'RB'
  if (['LB','LWB'].includes(raw)) return 'LB'
  if (['DMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM'].includes(raw)) return 'DMF'
  if (['CMF','LCMF','RCMF','LCM','RCM'].includes(raw)) return 'CMF'
  if (['AMF','CAM','LCAM','RCAM'].includes(raw)) return 'AMF'
  if (['RW','RWF','RAM','RAMF','RM','RMF'].includes(raw)) return 'RW'
  if (['LW','LWF','LAM','LAMF','LM','LMF'].includes(raw)) return 'LW'
  if (['CF','LCF','RCF','SS'].includes(raw)) return 'CF'
  return canonicalPosition(raw)
}

export function positionLabel(posicao) {
  const code = canonicalPosition(posicao)
  return POSITION_LABELS[code] || code || '—'
}

export function parseIScoutRows(rawRows = []) {
  if (!Array.isArray(rawRows) || rawRows.length < 2) throw new Error('Planilha sem partidas suficientes para análise.')
  const headers = (rawRows[0] || []).map(value => String(value || '').trim())
  if (!headers.some(h => /^Jogo$/i.test(h)) || !headers.some(h => /Minutos jogados/i.test(h))) {
    throw new Error('Formato não reconhecido. Use o export iScout com a aba PlayerStats e colunas por jogo.')
  }

  // Assinatura do export usado como referência. Se o iScout mudar a ordem das colunas,
  // interrompemos a importação em vez de atribuir uma estatística ao conceito errado.
  const signature = [
    [24,/Intercepções/i], [27,/Recuperações/i], [31,/Duelos defensivos/i],
    [35,/Carrinhos/i], [48,/Passes em profundidade/i], [52,/Passes para terço final/i],
    [57,/Passes para a frente/i], [64,/Defesas/i],
  ]
  for (const [index, pattern] of signature) {
    if (!pattern.test(headers[index] || '')) {
      throw new Error(`O layout da planilha iScout mudou na coluna ${index + 1}. Exporte novamente no padrão PlayerStats utilizado pela CIC.`)
    }
  }

  return rawRows.slice(1).filter(row => row?.[0]).map(row => {
    const game = {}
    ISCOUT_COLS.forEach((key, index) => { game[key] = row[index] ?? null })
    game.date = safeDate(game.date)
    game.minutos = n(game.minutos)
    return game
  })
}

function normalizeCompetition(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ')
    .replace(/^(brazil|brasil)\s+/,'')
    .replace(/\s+/g,' ').trim()
}

function competitionDisplay(value) {
  return String(value || '—')
    .replace(/^Brazil\.\s*/i,'')
    .replace(/\bSerie\b/i,'Série')
}

export function selectIScoutGames(games = [], requestedCompetition = '') {
  const stats = new Map()
  for (const game of games) {
    const name = String(game.competition || '').trim() || 'Sem competição'
    const current = stats.get(name) || { name, games:0, minutes:0 }
    current.games += 1
    current.minutes += n(game.minutos)
    stats.set(name, current)
  }
  const available = [...stats.values()].sort((a,b)=>b.minutes-a.minutes || b.games-a.games)
  if (!available.length) return { games, competition:'—', competitionSource:null, mode:'all', available:[], excludedGames:0 }

  const requested = String(requestedCompetition || '').trim()
  const requestedNorm = normalizeCompetition(requested)
  const wantsAll = /^(todas?|all|todas as competicoes)$/.test(requestedNorm)
  if (wantsAll) {
    return { games, competition:'Todas as competições', competitionSource:null, mode:'all', available, excludedGames:0 }
  }

  let selected = null
  if (requestedNorm) {
    selected = available.find(item => normalizeCompetition(item.name) === requestedNorm)
      || available.find(item => normalizeCompetition(item.name).endsWith(requestedNorm))
      || available.find(item => requestedNorm.endsWith(normalizeCompetition(item.name)))
    if (!selected) {
      throw new Error(`A competição "${requested}" não foi encontrada na planilha. Disponíveis: ${available.map(item=>competitionDisplay(item.name)).join(', ')}.`)
    }
  } else {
    selected = available[0]
  }

  const selectedGames = games.filter(game => String(game.competition || '').trim() === selected.name)
  return {
    games:selectedGames,
    competition:competitionDisplay(selected.name),
    competitionSource:selected.name,
    mode:requestedNorm ? 'requested' : 'dominant',
    available,
    excludedGames:games.length-selectedGames.length,
  }
}

export function aggregateIScoutGames(allGames = [], metadata = {}) {
  if (!allGames.length) throw new Error('Nenhuma partida válida encontrada na planilha.')
  const selection = selectIScoutGames(allGames, metadata.liga)
  const games = selection.games
  if (!games.length) throw new Error('Nenhuma partida restou no escopo de competição selecionado.')

  const sumKeys = ISCOUT_COLS.filter(key => !['jogo','competition','date','posicao'].includes(key))
  const T = Object.fromEntries(sumKeys.map(key => [key, 0]))
  for (const game of games) for (const key of sumKeys) T[key] += n(game[key])
  const minutes = T.minutos
  const positionsByMinutes = new Map()
  for (const game of games) {
    const primary = canonicalPosition(game.posicao)
    if (primary) positionsByMinutes.set(primary, (positionsByMinutes.get(primary) || 0) + n(game.minutos))
  }
  const inferredPosition = [...positionsByMinutes.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || 'CMF'
  const posicao = canonicalPosition(metadata.posicao) || inferredPosition
  const equipa = metadata.equipa || inferClub(games) || '—'
  const competition = selection.competition
  const lastDate = [...games].map(g=>g.date).filter(Boolean).sort().at(-1) || null

  const player = {
    nome: metadata.nome || 'Atleta', equipa, equipa_periodo: equipa, pais: metadata.nacionalidade || '',
    posicao, pe: metadata.pe || '', idade: n(metadata.idade) || null, minutos: minutes, jogos: games.length,
    gols:T.gols, assistencias:T.assistencias, xg:T.xg, xa:T.xa,
    remates:T.remates, remates_no_alvo:T.remates_no_alvo,
    passes:T.passes, passes_precisos:T.passes_precisos,
    passes_profundidade:T.passes_profundidade, passes_profundidade_precisos:T.passes_profundidade_precisos,
    passes_longos:T.passes_longos, passes_longos_precisos:T.passes_longos_precisos,
    passes_tercofinal:T.passes_tercofinal, passes_tercofinal_precisos:T.passes_tercofinal_precisos,
    passes_area:T.passes_area, passes_area_precisos:T.passes_area_precisos,
    passes_frente:T.passes_frente, passes_frente_precisos:T.passes_frente_precisos,
    passes_chave:T.assist_remate, assist_remate:T.assist_remate,
    cruzamentos:T.cruzamentos, cruzamentos_precisos:T.cruzamentos_precisos,
    dribles:T.dribles, dribles_sucesso:T.dribles_sucesso,
    duelos:T.duelos, duelos_ganhos:T.duelos_ganhos,
    duelos_def:T.duelos_def, duelos_def_ganhos:T.duelos_def_ganhos,
    duelos_of:T.duelos_of, duelos_of_ganhos:T.duelos_of_ganhos,
    duelos_aereos:T.duelos_aereos, duelos_aereos_ganhos:T.duelos_aereos_ganhos,
    carrinhos:T.carrinhos, carrinhos_sucesso:T.carrinhos_sucesso,
    intercecoes:T.intercecoes, recuperacoes:T.recuperacoes,
    recuperacoes_campo_adversario:T.recuperacoes_campo_adversario,
    perdas_bola:T.perdas_bola, perdas_campo_proprio:T.perdas_campo_proprio,
    faltas:T.faltas, faltas_sofridas:T.faltas_sofridas, impedimentos:T.impedimentos,
    passes_recebidos:T.passes_recebidos, toques_area:T.toques_area,
    acoes:T.acoes, acoes_sucesso:T.acoes_sucesso,
    gols_sofridos:T.gols_sofridos, xg_contra:T.xcg, remates_sofridos:T.remates_sofridos,
    defesas:T.defesas, saidas:T.saidas,
  }

  Object.assign(player, {
    gols_90:per90(T.gols,minutes), assistencias_90:per90(T.assistencias,minutes), participacao_gols_90:per90(T.gols+T.assistencias,minutes),
    xg_90:per90(T.xg,minutes), xa_90:per90(T.xa,minutes), remates_90:per90(T.remates,minutes),
    remates_no_alvo_90:per90(T.remates_no_alvo,minutes), remates_golo_pct:pct(T.remates_no_alvo,T.remates), conversao_gols_pct:pct(T.gols,T.remates),
    passes_90:per90(T.passes,minutes), passes_pct:pct(T.passes_precisos,T.passes),
    passes_profundidade_90:per90(T.passes_profundidade,minutes), passes_profundidade_pct:pct(T.passes_profundidade_precisos,T.passes_profundidade),
    passes_longos_90:per90(T.passes_longos,minutes), passes_longos_pct:pct(T.passes_longos_precisos,T.passes_longos),
    passes_tercofinal_90:per90(T.passes_tercofinal,minutes), passes_tercofinal_pct:pct(T.passes_tercofinal_precisos,T.passes_tercofinal),
    passes_area_90:per90(T.passes_area,minutes), passes_area_pct:pct(T.passes_area_precisos,T.passes_area),
    passes_frente_90:per90(T.passes_frente,minutes), passes_frente_pct:pct(T.passes_frente_precisos,T.passes_frente),
    passes_chave_90:per90(T.assist_remate,minutes), assist_remate_90:per90(T.assist_remate,minutes),
    cruzamentos_90:per90(T.cruzamentos,minutes), cruzamentos_pct:pct(T.cruzamentos_precisos,T.cruzamentos),
    dribles_90:per90(T.dribles,minutes), dribles_pct:pct(T.dribles_sucesso,T.dribles),
    duelos_90:per90(T.duelos,minutes), duelos_pct:pct(T.duelos_ganhos,T.duelos),
    duelos_def_90:per90(T.duelos_def,minutes), duelos_def_pct:pct(T.duelos_def_ganhos,T.duelos_def),
    duelos_of_90:per90(T.duelos_of,minutes), duelos_of_pct:pct(T.duelos_of_ganhos,T.duelos_of),
    duelos_aereos_90:per90(T.duelos_aereos,minutes), duelos_aereos_pct:pct(T.duelos_aereos_ganhos,T.duelos_aereos),
    carrinhos_90:per90(T.carrinhos,minutes), carrinhos_pct:pct(T.carrinhos_sucesso,T.carrinhos),
    intercecoes_90:per90(T.intercecoes,minutes), recuperacoes_90:per90(T.recuperacoes,minutes),
    recuperacoes_campo_adversario_90:per90(T.recuperacoes_campo_adversario,minutes),
    perdas_bola_90:per90(T.perdas_bola,minutes), perdas_campo_proprio_90:per90(T.perdas_campo_proprio,minutes),
    faltas_90:per90(T.faltas,minutes), faltas_sofridas_90:per90(T.faltas_sofridas,minutes), impedimentos_90:per90(T.impedimentos,minutes),
    passes_recebidos_90:per90(T.passes_recebidos,minutes), toques_area_90:per90(T.toques_area,minutes),
    acoes_90:per90(T.acoes,minutes), acoes_pct:pct(T.acoes_sucesso,T.acoes),
    gols_sofridos_90:per90(T.gols_sofridos,minutes), xg_contra_90:per90(T.xcg,minutes), saidas_90:per90(T.saidas,minutes),
    defesas_pct:pct(T.defesas,T.remates_sofridos),
  })

  return {
    player,
    games,
    context:{
      competition, competitionSource:selection.competitionSource, competitionSelection:selection.mode,
      lastDate, games:games.length, minutes,
      fileGames:allGames.length, excludedGames:selection.excludedGames,
      positions:[...positionsByMinutes.entries()].sort((a,b)=>b[1]-a[1]).map(([code,mins])=>({code,label:positionLabel(code),minutes:mins})),
      competitions:selection.available.map(item=>item.name),
      availableCompetitions:selection.available.map(item=>({ name:item.name, label:competitionDisplay(item.name), games:item.games, minutes:round(item.minutes,0) })),
      inferredTeam:inferClub(games), inferredPosition,
      schemaVersion:3,
    },
  }
}

function normalizeLegacyBenchmarkPlayer(player = {}) {
  const p = { ...player }
  if (p.assists_90 != null && p.assistencias_90 == null) p.assistencias_90 = p.assists_90
  if (p.intercepoes_90 != null && p.intercecoes_90 == null) p.intercecoes_90 = p.intercepoes_90
  if (p.acoes_def_90 != null && p.recuperacoes_90 == null) p.recuperacoes_90 = p.acoes_def_90
  return p
}

function samePositionPool(players, group, role) {
  const normalized = (players || []).map(normalizeLegacyBenchmarkPlayer)
  const exactWithMinutes = normalized.filter(player => positionRole(player.posicao) === role && Number(player.minutos || 0) >= 270)
  if (exactWithMinutes.length >= 5) return exactWithMinutes
  const exact = normalized.filter(player => positionRole(player.posicao) === role)
  if (exact.length >= 5) return exact
  const groupedWithMinutes = normalized.filter(player => getSportsbasePositionGroup(player.posicao) === group && Number(player.minutos || 0) >= 270)
  return groupedWithMinutes.length >= 5 ? groupedWithMinutes : normalized.filter(player => getSportsbasePositionGroup(player.posicao) === group)
}

function metricNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function average(players, key) {
  const values = players.map(player => metricNumber(player?.[key])).filter(value => value !== null)
  return values.length ? round(values.reduce((a,b)=>a+b,0)/values.length, 2) : null
}

function percentile(value, players, key, higherIsBetter = true) {
  const numericValue = metricNumber(value)
  if (numericValue === null) return null
  const values = players.map(player => metricNumber(player?.[key])).filter(item => item !== null)
  if (values.length < 3) return null
  return calculateSportsbasePercentile(numericValue, values, higherIsBetter)
}

function modelPrioritySet(model) {
  return new Set((model?.recruitmentMetrics || []).map(key => MODEL_ALIAS[key] || key))
}

function fitLabel(score) {
  if (score >= 80) return 'ENCAIXE ALTO'
  if (score >= 66) return 'BOM ENCAIXE'
  if (score >= 52) return 'ENCAIXE CONDICIONAL'
  if (score >= 38) return 'ENCAIXE BAIXO'
  return 'FORA DO PADRÃO ATUAL'
}

function levelLabel(score) {
  if (score >= 82) return 'DESTAQUE DA POSIÇÃO'
  if (score >= 68) return 'ACIMA DA MÉDIA DA SÉRIE C'
  if (score >= 48) return 'NÍVEL COMPETITIVO DE SÉRIE C'
  if (score >= 32) return 'ABAIXO DA MÉDIA DA SÉRIE C'
  return 'NÍVEL ESTATÍSTICO BAIXO NO RECORTE'
}

function sampleConfidence(minutes) {
  const m = Number(minutes) || 0
  if (m >= 900) return { label:'Alta', score:100, text:'amostra robusta para leitura estatística' }
  if (m >= 600) return { label:'Boa', score:88, text:'amostra já oferece boa estabilidade' }
  if (m >= 360) return { label:'Média', score:74, text:'amostra útil, ainda sensível a contexto e sequência de jogos' }
  if (m >= 180) return { label:'Baixa', score:58, text:'amostra curta; leitura sensível ao contexto e à sequência de jogos' }
  return { label:'Muito baixa', score:42, text:'amostra muito curta; leitura apenas indicativa' }
}

function metricQualitative(metric, positive = true) {
  const theme = THEMATIC_LANGUAGE[METRIC_THEME[metric.key]] || THEMATIC_LANGUAGE.circulation
  const override = METRIC_OVERRIDES[metric.key] || {}
  return {
    category: override.category || theme.category,
    title: positive ? (override.strengthTitle || theme.strengthTitle) : (override.attentionTitle || theme.attentionTitle),
    evidence:'DADO SUGERE',
    text: positive ? theme.good : theme.bad,
  }
}

function deriveFunctionalProfile(metrics, group) {
  const rules = PROFILE_RULES[group] || {}
  const lookup = new Map(metrics.map(metric => [metric.key, metric]))
  const ranking = Object.entries(rules).map(([name, items]) => {
    let weighted = 0
    let used = 0
    let total = 0
    for (const [key, weight] of items) {
      total += weight
      const metric = lookup.get(key)
      const value = metric?.percentileSerieC ?? metric?.percentileClub
      if (value != null) { weighted += value * weight; used += weight }
    }
    return { name, score:used ? Math.round(weighted/used) : 0, coverage:total ? Math.round((used/total)*100) : 0 }
  }).filter(item => item.coverage >= 30).sort((a,b)=>b.score-a.score)
  if (!ranking.length) return null
  return { ...ranking[0], secondary:ranking[1]?.name || null }
}

function similarity(player, candidate, metrics, seriePool) {
  const diffs = []
  for (const metric of metrics) {
    const a = percentile(player[metric.key], seriePool, metric.key, metric.higherIsBetter)
    const b = percentile(candidate[metric.key], seriePool, metric.key, metric.higherIsBetter)
    if (a != null && b != null) diffs.push(Math.abs(a-b))
  }
  if (diffs.length < 3) return null
  return Math.max(0, Math.round(100 - diffs.reduce((a,b)=>a+b,0)/diffs.length))
}

export function analyzeIScoutPlayer({ player, games = [], context = {}, clubPlayers = [], serieCPlayers = [], clubModel = null }) {
  const resolvedClubPlayers = Array.isArray(clubPlayers) ? clubPlayers : []
  const resolvedClubModel = clubModel
  const role = positionRole(player.posicao) || 'DMF'
  const group = positionGroup(role)
  const metricDefs = (POSITION_METRICS[role] || POSITION_METRICS.DMF).map(([key, weight]) => ({
    key, weight, higherIsBetter: METRIC_CATALOG[key]?.higherIsBetter !== false, ...METRIC_CATALOG[key],
  }))
  const clubPool = samePositionPool(resolvedClubPlayers, group, role)
  const seriePool = samePositionPool(serieCPlayers, group, role)
  const prioritySet = modelPrioritySet(resolvedClubModel)
  let weightedFit = 0
  let fitWeight = 0
  let serieWeighted = 0
  let serieWeight = 0
  let clubWeighted = 0
  let clubWeight = 0

  const metrics = metricDefs.map(def => {
    const value = metricNumber(player?.[def.key])
    const pSerie = percentile(value, seriePool, def.key, def.higherIsBetter)
    const pClub = percentile(value, clubPool, def.key, def.higherIsBetter)
    const available = [pSerie, pClub].filter(v => v != null)
    const contextScore = pSerie != null && pClub != null ? pSerie * .62 + pClub * .38 : available[0] ?? null
    const priority = prioritySet.has(def.key)
    const effectiveWeight = def.weight * (priority ? 1.25 : 1)
    if (contextScore != null) { weightedFit += contextScore * effectiveWeight; fitWeight += effectiveWeight }
    if (pSerie != null) { serieWeighted += pSerie * def.weight; serieWeight += def.weight }
    if (pClub != null) { clubWeighted += pClub * def.weight; clubWeight += def.weight }
    return {
      ...def,
      value: value !== null ? round(value, def.format === 'percent' ? 1 : 2) : null,
      percentileSerieC: pSerie,
      percentileClub: pClub,
      avgSerieC: average(seriePool, def.key),
      avgClub: average(clubPool, def.key),
      priority,
    }
  })

  const sample = sampleConfidence(player.minutos)
  const rawFit = fitWeight ? weightedFit / fitWeight : 0
  const fitScore = Math.round(rawFit * (.88 + .12 * (sample.score/100)))
  const serieCScore = serieWeight ? Math.round(serieWeighted / serieWeight) : 0
  const clubScore = clubWeight ? Math.round(clubWeighted / clubWeight) : 0
  const eligible = metrics.filter(m => m.percentileSerieC != null || m.percentileClub != null)
  const ranked = eligible.map(metric => ({
    metric,
    percentile: metric.percentileSerieC ?? metric.percentileClub ?? null,
  })).filter(item => item.percentile != null)

  const strongest = ranked
    .filter(item => item.percentile >= 60)
    .sort((a,b)=>b.percentile-a.percentile)
    .slice(0,3)
  const relativeStrengths = strongest.length ? strongest : [...ranked].sort((a,b)=>b.percentile-a.percentile).slice(0,3)

  const attentionRanked = ranked
    .filter(item => item.percentile <= 40)
    .sort((a,b)=>a.percentile-b.percentile)
    .slice(0,3)
  const relativeAttention = attentionRanked.length ? attentionRanked : [...ranked].sort((a,b)=>a.percentile-b.percentile).slice(0,3)

  const profile = deriveFunctionalProfile(metrics, group)

  const squadMatches = clubPool
    .map(candidate => ({
      nome: candidate.nome, posicao: candidate.posicao, minutos: candidate.minutos,
      similarity: similarity(player, candidate, metricDefs, seriePool),
    }))
    .filter(item => item.similarity != null)
    .sort((a,b)=>b.similarity-a.similarity)
    .slice(0,5)

  const strengths = relativeStrengths.map(({ metric, percentile }) => {
    const language = metricQualitative(metric, true)
    return {
      key:metric.key,
      label:metric.label,
      percentile,
      category:language.category,
      title:language.title,
      evidence:language.evidence,
      text:language.text,
      relative: strongest.length === 0,
    }
  })

  const weaknesses = relativeAttention.map(({ metric, percentile }) => {
    const language = metricQualitative(metric, false)
    const relative = attentionRanked.length === 0
    return {
      key:metric.key,
      label:metric.label,
      percentile,
      category:language.category,
      title:relative ? `MENOR DESTAQUE RELATIVO · ${metric.label.toUpperCase()}` : language.title,
      evidence:language.evidence,
      text:relative
        ? `DENTRO DE UM PERFIL SEM INDICADORES CLARAMENTE ABAIXO DA REFERÊNCIA, ${metric.label.toUpperCase()} APARECE ENTRE OS MENORES DESTAQUES RELATIVOS. O RESULTADO DEVE SER LIDO COMO HIERARQUIA INTERNA DO PERFIL, NÃO COMO DEFICIÊNCIA.`
        : language.text,
      relative,
    }
  })

  const leadStrength = strengths[0]
  const mainAttention = weaknesses[0]
  const profileText = profile?.name
    ? `O desenho estatístico se aproxima do perfil ${profile.name}${profile.secondary ? `, com ${profile.secondary} como alternativa funcional` : ''}.`
    : ''
  const strengthText = leadStrength
    ? `${leadStrength.title.toLowerCase()}: ${leadStrength.text.toLowerCase()}`
    : 'a amostra apresenta sinais competitivos em diferentes dimensões da função.'
  const attentionText = mainAttention
    ? `${mainAttention.title.toLowerCase()}: ${mainAttention.text.toLowerCase()}`
    : 'não há um ponto estatístico de atenção dominante no recorte.'
  const summary = `${player.nome} apresenta um perfil estatístico que sugere ${strengthText} ${profileText} Como principal ponto de atenção, ${attentionText} A leitura considera o desempenho relativo à função e deve ser interpretada junto ao contexto competitivo, ao modelo da equipe e à amostra disponível. A confiança estatística da amostra é ${sample.label.toLowerCase()}.`

  return {
    schemaVersion:3,
    group,
    role,
    groupLabel: positionLabel(role),
    fitScore,
    fitLabel: fitLabel(fitScore),
    serieCScore,
    serieCLevel: levelLabel(serieCScore),
    clubScore,
    clubLevel: clubScore >= 80 ? 'DESTAQUE FRENTE AO ELENCO' : clubScore >= 65 ? 'ACIMA DO PADRÃO DO ELENCO' : clubScore >= 50 ? 'COMPETITIVO NO ELENCO' : clubScore >= 35 ? 'ABAIXO DO PADRÃO DO ELENCO' : 'BAIXO NO RECORTE DO ELENCO',
    sample,
    profile,
    player,
    context,
    metrics,
    strengths,
    weaknesses,
    summary,
    methodology: {
      evidenceLabel:'DADO CONTEXTUALIZADO',
      caution:'OS INDICADORES DESCREVEM O DESEMPENHO RELATIVO À FUNÇÃO E AO CONTEXTO DE REFERÊNCIA. ASPECTOS COGNITIVOS, COMPORTAMENTAIS E DE MODELO DE JOGO NÃO SÃO INFERIDOS AUTOMATICAMENTE PELOS NÚMEROS.',
    },
    squadMatches,
    pool: { serieC:seriePool.length, club:clubPool.length },
    model: resolvedClubModel ? {
      identity: resolvedClubModel.identity || null,
      priorities: [...prioritySet],
      sampleGames: resolvedClubModel.sampleGames || 0,
    } : null,
    games: games.map(game => ({ jogo:game.jogo, competition:game.competition, date:game.date, posicao:game.posicao, minutos:n(game.minutos) }))
      .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),
  }
}

export function formatMetricValue(value, format = 'decimal') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  if (format === 'percent') return `${Number(value).toFixed(1)}%`
  return Number(value).toFixed(2)
}
