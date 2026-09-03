# 03 · Módulos Funcionais

Este documento liga a navegação visível ao código. O objetivo é impedir que a arquitetura seja entendida apenas por pastas e deixar claro quais domínios compõem o produto.

## 1. Corpo Técnico

| Módulo | Rota principal | Função técnica |
|---|---|---|
| Visão Geral | `/corpo-tecnico` | resumo operacional do departamento |
| Treino | `/treino` | conteúdo, sessões, PDFs, duração e goleiros |
| Pênaltis | `/treino/penaltis` | banco e ranking de cobranças |
| Banco Físico-Tático | `/banco-fisico-tatico` | correlação/visualização de performance física e jogo |
| Fisiologia / GPS | `/fisiologia` | ingestão e consulta de sessões GPS/performance |
| Departamento Médico | `/dm` | casos, status, logs e RTP |
| Programação | `/programacao` | agenda, calendário, classificação e clima |
| Elenco | `/corpo-tecnico/elenco` | cadastro do plantel profissional |
| Fotos | `/fotos` | foto principal, mapeamento e arquivos |
| Série C | `/serie-c` | inteligência da competição |

### Série C

Subdomínios:

- uploads de planilhas;
- tabela/classificação;
- times, jogadores, goleiros e líderes;
- partidas do clube;
- partidas da competição;
- coleta ao vivo;
- relatórios individuais/coletivos;
- adversários e PDFs de equipe;
- snapshots e comparação interna;
- origem/lado de gols.

Código central:

- `app/serie-c/**`
- `app/api/serie-c/**`
- `app/components/serie-c/**`
- `lib/serieC*.js`

## 2. Inteligência de Mercado

| Módulo | Rota principal | Função técnica |
|---|---|---|
| Decision Room | `/scouting` | painel executivo e alertas |
| Ligas | `/ligas-v2` | ingestão SportsBase/Wyscout por competição |
| Base de Atletas | `/database` | ficha canônica, ranking e percentis |
| Sub-20 | `/sub20` | base de talentos sul-americanos |
| Evolução | `/evolucao-jogadores` | comparação temporal de atletas |
| Times Shadow | `/shadows` | simulação de composição de elenco |
| TransferRoom | `/transferroom` | indicados × contratados |
| Funil | `/funil` | pipeline de scouting |
| Recrutamento | `/centro-recrutamento` | gestão de candidatos |
| Recomendações | `/recomendacoes` | focos/necessidades do mercado |
| Watchlist | `/lista-preferencial` | lista preferencial e histórico |
| Lista Final | `/lista-final` | decisão e relatório final |
| Relatórios | `/relatorios-jogadores` | dossiês por atleta/posição |
| Comparação | `/comparacao` | análise direta entre atletas |
| Avaliação iScout | `/avaliacao-atleta` | fit, benchmark e avaliação |
| Elenco / Modelo | `/elenco` | snapshot competitivo do próprio clube |
| Agenda | `/agenda` | calendário e observação de jogos |
| Observação | `/observacao` | registro de scouts em campo |
| Desempenho | `/desempenho` | análise de equipe/adversário |
| Monitoramento | `/monitoramento` | carteira de atletas acompanhados |
| Eficiência de Mercado | `/moneyball` | valor × desempenho |
| Treinadores | `/treinadores` | banco, textos, Wyscout e avaliação |
| Importar | `/importar` | entrada manual/arquivos |

## 3. Engine de Ligas

A engine de Ligas é um dos núcleos mais reutilizáveis do produto.

Fluxo:

1. usuário seleciona competição (`slug`);
2. sobe SportsBase e/ou Wyscout;
3. parser reconhece colunas e normaliza estrutura;
4. cada fonte é persistida separadamente em `liga_jogadores`;
5. processamento em background registra import logs/sincroniza ficha canônica;
6. filtros e métricas usam o dataset disponível;
7. camada de identity/fusion complementa atributos entre fontes quando há segurança suficiente.

O sistema foi desenhado para suportar os cenários:

- somente SportsBase;
- somente Wyscout;
- SportsBase + Wyscout;
- fontes atualizadas em momentos diferentes.

## 4. Ficha canônica de atleta

A ficha canônica evita que cada liga/provider crie uma identidade diferente para a mesma pessoa.

- `cig_jogadores`: entidade canônica;
- `cig_player_sources`: ocorrências por provider/liga/temporada;
- `player_aliases`: aliases manuais/normalização em fluxos específicos.

Essa camada é o ponto natural para evoluir entity resolution e auditoria de matching.

## 5. Automação de scouting

`lib/scouting-automation.js` agrega:

- cobertura de bases;
- focos e pipeline;
- oportunidades;
- necessidade por posição;
- alertas de saúde da informação;
- snapshots;
- materialização de relatórios/pacotes;
- cron operacional.

Não é um serviço separado hoje; é um domínio server-side do monólito.
