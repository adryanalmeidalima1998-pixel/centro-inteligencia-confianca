# Catálogo de APIs

> Gerado por `npm run docs:api`. Não editar manualmente a tabela de rotas.

Total atual: **119 Route Handlers** em `app/api`. Frontend e backend vivem no mesmo repositório Next.js; cada arquivo `route.js` é um endpoint server-side.

## Convenções

- Rotas são protegidas pelo `middleware.js`, exceto autenticação e arquivos públicos.
- APIs do Corpo Técnico e do Mercado são separadas logicamente por permissões de módulo.
- Rotas com `[slug]`, `[id]` ou outros segmentos usam parâmetros dinâmicos do App Router.
- O catálogo mostra superfície HTTP e localização do código; contratos detalhados devem permanecer próximos ao domínio correspondente.

## Autenticação / operação

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| NextAuth handler | `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.js` | 61 |
| GET | `/api/notificacoes` | `app/api/notificacoes/route.js` | 133 |
| POST | `/api/notify` | `app/api/notify/route.js` | 17 |

## Automação de scouting

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET | `/api/scouting-automation/cron` | `app/api/scouting-automation/cron/route.js` | 31 |
| GET | `/api/scouting-automation/material` | `app/api/scouting-automation/material/route.js` | 68 |
| GET | `/api/scouting-automation/package` | `app/api/scouting-automation/package/route.js` | 25 |

## Clube / operação

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, POST, PATCH, DELETE | `/api/agenda` | `app/api/agenda/route.js` | 356 |
| GET | `/api/club-calendar` | `app/api/club-calendar/route.js` | 53 |
| GET, POST, DELETE | `/api/club-sportsbase` | `app/api/club-sportsbase/route.js` | 110 |
| GET, POST | `/api/photo-map` | `app/api/photo-map/route.js` | 52 |
| GET, POST | `/api/photos` | `app/api/photos/route.js` | 136 |
| DELETE | `/api/photos/[id]` | `app/api/photos/[id]/route.js` | 51 |
| GET, POST | `/api/squad` | `app/api/squad/route.js` | 70 |
| PUT, DELETE | `/api/squad/[id]` | `app/api/squad/[id]/route.js` | 13 |
| GET | `/api/standings` | `app/api/standings/route.js` | 80 |
| GET, POST, DELETE | `/api/team-crest` | `app/api/team-crest/route.js` | 233 |
| GET | `/api/weather-match` | `app/api/weather-match/route.js` | 164 |

## Corpo técnico / performance

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, POST | `/api/banco-partidas` | `app/api/banco-partidas/route.js` | 93 |
| GET, PATCH, DELETE | `/api/banco-partidas/[id]` | `app/api/banco-partidas/[id]/route.js` | 83 |
| GET, POST | `/api/banco-treino` | `app/api/banco-treino/route.js` | 73 |
| PUT, DELETE | `/api/banco-treino/[id]` | `app/api/banco-treino/[id]/route.js` | 47 |
| GET, POST | `/api/cmj-basal` | `app/api/cmj-basal/route.js` | 104 |
| GET, POST | `/api/dm` | `app/api/dm/route.js` | 150 |
| PUT, DELETE | `/api/dm/[id]` | `app/api/dm/[id]/route.js` | 82 |
| GET, POST | `/api/forca-basal` | `app/api/forca-basal/route.js` | 117 |
| GET, POST | `/api/gps` | `app/api/gps/route.js` | 217 |
| PATCH, DELETE | `/api/gps/[id]` | `app/api/gps/[id]/route.js` | 58 |
| GET, POST, DELETE | `/api/gps/desempenho` | `app/api/gps/desempenho/route.js` | 200 |
| GET, POST | `/api/maturacao` | `app/api/maturacao/route.js` | 137 |
| PUT, DELETE | `/api/maturacao/[id]` | `app/api/maturacao/[id]/route.js` | 44 |
| GET, POST | `/api/pcr-basal` | `app/api/pcr-basal/route.js` | 103 |
| GET, POST | `/api/penaltis` | `app/api/penaltis/route.js` | 79 |
| DELETE | `/api/penaltis/[id]` | `app/api/penaltis/[id]/route.js` | 16 |
| GET | `/api/penaltis/ranking` | `app/api/penaltis/ranking/route.js` | 57 |
| GET, POST, DELETE | `/api/status-recuperacao` | `app/api/status-recuperacao/route.js` | 376 |
| GET, POST, DELETE | `/api/treino-duracao` | `app/api/treino-duracao/route.js` | 60 |

## Dados / utilidades

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, POST | `/api/aliases` | `app/api/aliases/route.js` | 36 |
| DELETE | `/api/aliases/[id]` | `app/api/aliases/[id]/route.js` | 14 |
| GET | `/api/dashboard-scouting` | `app/api/dashboard-scouting/route.js` | 20 |
| GET | `/api/database` | `app/api/database/route.js` | 238 |
| GET, POST, DELETE | `/api/desempenho` | `app/api/desempenho/route.js` | 166 |
| GET, POST, DELETE | `/api/desempenho-wyscout` | `app/api/desempenho-wyscout/route.js` | 151 |
| GET, POST, DELETE | `/api/elenco-session` | `app/api/elenco-session/route.js` | 74 |
| GET | `/api/export-relatorio` | `app/api/export-relatorio/route.js` | 74 |
| POST | `/api/import-excel-manual` | `app/api/import-excel-manual/route.js` | 207 |
| GET, POST | `/api/ligas-times` | `app/api/ligas-times/route.js` | 88 |
| POST | `/api/parse-excel-wyscout` | `app/api/parse-excel-wyscout/route.js` | 156 |
| POST | `/api/parse-wyscout` | `app/api/parse-wyscout/route.js` | 200 |
| GET, POST | `/api/pdfs` | `app/api/pdfs/route.js` | 67 |
| DELETE | `/api/pdfs/[id]` | `app/api/pdfs/[id]/route.js` | 29 |
| GET | `/api/player-enrichment` | `app/api/player-enrichment/route.js` | 260 |
| GET, PATCH | `/api/player-master/[id]` | `app/api/player-master/[id]/route.js` | 237 |
| POST | `/api/player-master/sync` | `app/api/player-master/sync/route.js` | 61 |
| GET | `/api/players` | `app/api/players/route.js` | 69 |
| GET, POST | `/api/relatorio-partida` | `app/api/relatorio-partida/route.js` | 288 |
| GET, POST | `/api/scouting-automation` | `app/api/scouting-automation/route.js` | 44 |
| POST | `/api/scrape-ogol` | `app/api/scrape-ogol/route.js` | 68 |
| POST | `/api/scrape-radar` | `app/api/scrape-radar/route.js` | 83 |
| GET, POST | `/api/seed-db` | `app/api/seed-db/route.js` | 135 |
| GET | `/api/sheets-proxy` | `app/api/sheets-proxy/route.js` | 78 |
| GET, POST | `/api/sub20` | `app/api/sub20/route.js` | 36 |
| GET, POST | `/api/times-db` | `app/api/times-db/route.js` | 77 |
| GET, POST, DELETE | `/api/treinadores` | `app/api/treinadores/route.js` | 149 |
| GET, POST, DELETE | `/api/wyscout` | `app/api/wyscout/route.js` | 119 |
| GET, POST | `/api/wyscout-benchmark` | `app/api/wyscout-benchmark/route.js` | 185 |

## IA / extração

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| POST | `/api/ai/extract` | `app/api/ai/extract/route.js` | 113 |
| POST | `/api/ai/extract-docx` | `app/api/ai/extract-docx/route.js` | 65 |
| POST | `/api/ai/extract-treinador` | `app/api/ai/extract-treinador/route.js` | 79 |

## Ligas / datasets

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET | `/api/ligas-v2/[slug]/[team]` | `app/api/ligas-v2/[slug]/[team]/route.js` | 39 |
| GET, POST | `/api/ligas-v2/[slug]/categorias-rodada` | `app/api/ligas-v2/[slug]/categorias-rodada/route.js` | 80 |
| GET | `/api/ligas-v2/[slug]/dataset` | `app/api/ligas-v2/[slug]/dataset/route.js` | 146 |
| GET, POST, DELETE | `/api/ligas-v2/[slug]/destaques` | `app/api/ligas-v2/[slug]/destaques/route.js` | 591 |
| GET, PATCH | `/api/ligas-v2/[slug]/jogadores/[playerId]` | `app/api/ligas-v2/[slug]/jogadores/[playerId]/route.js` | 227 |
| GET, POST, DELETE | `/api/ligas-v2/[slug]/rodada-pdf` | `app/api/ligas-v2/[slug]/rodada-pdf/route.js` | 211 |
| GET | `/api/ligas-v2/[slug]/selecao` | `app/api/ligas-v2/[slug]/selecao/route.js` | 68 |
| GET, POST, DELETE | `/api/ligas-v2/[slug]/selecao-rodada` | `app/api/ligas-v2/[slug]/selecao-rodada/route.js` | 78 |
| GET, POST, DELETE | `/api/ligas-v2/[slug]/shadow-team` | `app/api/ligas-v2/[slug]/shadow-team/route.js` | 89 |
| GET, POST | `/api/ligas-v2/[slug]/sportsbase` | `app/api/ligas-v2/[slug]/sportsbase/route.js` | 214 |
| GET, POST | `/api/ligas-v2/[slug]/team-stats` | `app/api/ligas-v2/[slug]/team-stats/route.js` | 106 |
| GET | `/api/ligas-v2/[slug]/teams` | `app/api/ligas-v2/[slug]/teams/route.js` | 55 |
| GET | `/api/ligas-v2/[slug]/teams/[team]` | `app/api/ligas-v2/[slug]/teams/[team]/route.js` | 85 |
| GET, POST | `/api/ligas-v2/[slug]/wyscout` | `app/api/ligas-v2/[slug]/wyscout/route.js` | 194 |
| GET | `/api/ligas-v2/jogadores` | `app/api/ligas-v2/jogadores/route.js` | 282 |
| GET, POST | `/api/ligas-v2/logo` | `app/api/ligas-v2/logo/route.js` | 53 |

## Mercado / recrutamento

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, POST, PUT, PATCH, DELETE | `/api/avaliacao-atleta` | `app/api/avaliacao-atleta/route.js` | 379 |
| GET, POST, PATCH, DELETE | `/api/candidatos-pipeline` | `app/api/candidatos-pipeline/route.js` | 188 |
| GET | `/api/evolucao-jogadores` | `app/api/evolucao-jogadores/route.js` | 124 |
| GET, POST, PATCH, DELETE | `/api/focos-recrutamento` | `app/api/focos-recrutamento/route.js` | 151 |
| GET | `/api/funil` | `app/api/funil/route.js` | 146 |
| GET, DELETE | `/api/jogadores-destacados` | `app/api/jogadores-destacados/route.js` | 64 |
| GET, POST, PATCH, DELETE | `/api/lista-final` | `app/api/lista-final/route.js` | 241 |
| GET | `/api/lista-final-pdf` | `app/api/lista-final-pdf/route.js` | 114 |
| GET, POST, PATCH, DELETE | `/api/lista-preferencial` | `app/api/lista-preferencial/route.js` | 286 |
| GET, POST | `/api/monitoramento` | `app/api/monitoramento/route.js` | 456 |
| GET, POST, PATCH, DELETE | `/api/observacao` | `app/api/observacao/route.js` | 142 |
| GET, POST, PATCH, DELETE | `/api/relatorios-jogadores` | `app/api/relatorios-jogadores/route.js` | 105 |
| GET | `/api/relatorios-jogadores/buscar` | `app/api/relatorios-jogadores/buscar/route.js` | 84 |
| GET, POST | `/api/shadows` | `app/api/shadows/route.js` | 40 |
| GET, PATCH, DELETE | `/api/shadows/[id]` | `app/api/shadows/[id]/route.js` | 56 |
| GET, POST, PATCH, DELETE | `/api/transferroom` | `app/api/transferroom/route.js` | 246 |

## Série C / competição

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, POST | `/api/serie-c/competition-matches` | `app/api/serie-c/competition-matches/route.js` | 309 |
| GET | `/api/serie-c/competition-matches/[id]` | `app/api/serie-c/competition-matches/[id]/route.js` | 25 |
| GET | `/api/serie-c/data` | `app/api/serie-c/data/route.js` | 495 |
| GET, POST | `/api/serie-c/gols-lado` | `app/api/serie-c/gols-lado/route.js` | 313 |
| GET, POST | `/api/serie-c/internal-comparison` | `app/api/serie-c/internal-comparison/route.js` | 106 |
| GET, POST | `/api/serie-c/live-matches` | `app/api/serie-c/live-matches/route.js` | 108 |
| GET, POST | `/api/serie-c/matches` | `app/api/serie-c/matches/route.js` | 143 |
| PATCH, DELETE | `/api/serie-c/matches/[id]` | `app/api/serie-c/matches/[id]/route.js` | 37 |
| GET, POST, PUT, DELETE | `/api/serie-c/opponents` | `app/api/serie-c/opponents/route.js` | 112 |
| GET, POST, DELETE | `/api/serie-c/report-athletes` | `app/api/serie-c/report-athletes/route.js` | 73 |
| GET, POST | `/api/serie-c/standings` | `app/api/serie-c/standings/route.js` | 199 |
| GET | `/api/serie-c/standings/transfermarkt` | `app/api/serie-c/standings/transfermarkt/route.js` | 261 |
| GET, POST | `/api/serie-c/team-report` | `app/api/serie-c/team-report/route.js` | 93 |
| GET, POST | `/api/serie-c/upload` | `app/api/serie-c/upload/route.js` | 176 |

## Treinadores

| Métodos | Endpoint | Implementação | Linhas |
|---|---|---|---:|
| GET, PUT, DELETE | `/api/treinadores/[id]` | `app/api/treinadores/[id]/route.js` | 54 |
| POST | `/api/treinadores/[id]/interpretar-textos` | `app/api/treinadores/[id]/interpretar-textos/route.js` | 96 |
| POST | `/api/treinadores/[id]/wyscout` | `app/api/treinadores/[id]/wyscout/route.js` | 185 |
| GET | `/api/treinadores/foto` | `app/api/treinadores/foto/route.js` | 41 |
| POST | `/api/treinadores/import-transfermarkt` | `app/api/treinadores/import-transfermarkt/route.js` | 151 |

## Rotas operacionais sem tela direta

Algumas rotas são intencionalmente acionadas por cron, manutenção ou encadeamento interno, e portanto podem não aparecer em busca estática por `fetch('/api/...')`:

- `/api/scouting-automation/cron` — Vercel Cron diário.
- `/api/notificacoes` — Vercel Cron semanal.
- `/api/player-master/sync` — reconstrução/sincronização da ficha canônica.
- `/api/scouting-automation/material` e `/package` — materialização de entregáveis da automação.

