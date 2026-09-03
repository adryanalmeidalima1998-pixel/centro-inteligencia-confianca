# 18 · Inventário do Código

> Gerado automaticamente por `npm run docs:inventory`. Os números descrevem o repositório, não substituem análise de complexidade.

## Resumo

- **Páginas App Router:** 79
- **Route Handlers (API):** 119
- **Componentes compartilhados (`app/components`):** 27
- **Arquivos de domínio (lib/ + data/*.js):** 65
- **Arquivos de código analisados:** 332
- **Volume aproximado de código:** 5.40 MB

## Maiores arquivos de código

| Arquivo | Tamanho |
|---|---:|
| `app/banco-fisico-tatico/page.js` | 330.3 KB |
| `app/fisiologia/gps/page.js` | 263.4 KB |
| `app/dm/page.js` | 158.4 KB |
| `app/fisiologia/bem-estar/page.js` | 145.0 KB |
| `app/ligas-v2/[slug]/page.js` | 104.0 KB |
| `app/monitoramento/[id]/page.js` | 96.5 KB |
| `app/evolucao-jogadores/page.js` | 80.1 KB |
| `app/serie-c/coleta-ao-vivo/page.js` | 77.3 KB |
| `app/monitoramento/page.js` | 73.2 KB |
| `app/observacao/RelatorioModal.js` | 71.3 KB |
| `app/fisiologia/maturacao/page.js` | 66.0 KB |
| `app/desempenho/XmlAnalyzer.js` | 65.6 KB |
| `app/print/relatorio-semanal/page.js` | 63.5 KB |
| `data/radar-mercado-2026.js` | 60.2 KB |
| `app/ligas-v2/[slug]/SportsbasePlayersTable.js` | 59.1 KB |
| `lib/scouting-automation.js` | 58.4 KB |
| `app/transferroom/page.js` | 55.5 KB |
| `data/iscout-analysis.js` | 53.2 KB |
| `app/lista-preferencial/page.js` | 53.0 KB |
| `app/print/campanha-confianca/page.js` | 52.3 KB |

Arquivos grandes não são automaticamente um erro. Eles são candidatos a extração de componentes/serviços quando a mudança reduzir acoplamento sem gerar refactor de risco.

## Maiores Route Handlers

| Rota | Tamanho |
|---|---:|
| `app/api/ligas-v2/[slug]/destaques/route.js` | 24.9 KB |
| `app/api/serie-c/data/route.js` | 24.0 KB |
| `app/api/serie-c/gols-lado/route.js` | 20.8 KB |
| `app/api/monitoramento/route.js` | 19.8 KB |
| `app/api/avaliacao-atleta/route.js` | 16.0 KB |
| `app/api/status-recuperacao/route.js` | 15.7 KB |
| `app/api/player-master/[id]/route.js` | 14.0 KB |
| `app/api/ligas-v2/jogadores/route.js` | 14.0 KB |
| `app/api/serie-c/competition-matches/route.js` | 13.1 KB |
| `app/api/relatorio-partida/route.js` | 12.6 KB |
| `app/api/agenda/route.js` | 12.6 KB |
| `app/api/lista-preferencial/route.js` | 12.4 KB |
| `app/api/database/route.js` | 12.3 KB |
| `app/api/transferroom/route.js` | 11.1 KB |
| `app/api/lista-final/route.js` | 10.5 KB |

## Leitura de engenharia

- O backend está distribuído nos Route Handlers do App Router; não existe um segundo repositório BE.
- Regras compartilhadas devem sair das rotas quando aparecem em mais de um fluxo. A segunda etapa de limpeza centralizou identidade do clube e utilitários de partida em lib/club-config.js e lib/serieCMatch.js.
- Os maiores arquivos atuais estão majoritariamente em telas analíticas densas. A próxima decomposição deve ser guiada por frequência de mudança e testes, não apenas por número de linhas.

## Atualização

Regere após mudanças estruturais:

```bash
npm run docs:inventory
```
