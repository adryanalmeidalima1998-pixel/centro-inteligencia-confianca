# 02 · Mapa do Repositório

## 1. Árvore de alto nível

```text
/
├── app/                    Next.js App Router
│   ├── api/                backend HTTP / Route Handlers
│   ├── components/         componentes compartilhados
│   ├── lib/                domínio histórico do módulo de mercado
│   └── .../page.js         páginas dos módulos
├── data/                   parsers, mapeamentos, regras e datasets
├── lib/                    serviços e domínio compartilhado
│   └── providers/          adaptadores de APIs/fontes externas
├── public/                 imagens e assets estáticos
├── scripts/                rotinas de build/auditoria/documentação
├── docs/                   documentação
│   ├── technical/          engenharia / arquitetura
│   └── sql/                SQL legado/documental
├── middleware.js           autenticação/autorização global
├── next.config.mjs         configuração Next + headers
├── vercel.json             cron/deploy Vercel
└── .env.local.example      contrato de variáveis de ambiente
```

## 2. Frontend

O frontend está distribuído em `app/` conforme o App Router.

Principais entradas:

- `/` — Home do Centro de Inteligência;
- `/corpo-tecnico` — entrada Corpo Técnico;
- `/scouting` — Decision Room / Mercado;
- `/serie-c` — inteligência da competição;
- `/ligas-v2` — engine de ligas e uploads;
- `/database` — base canônica/rankings;
- `/elenco` — snapshot do clube;
- `/treinadores` — banco e avaliação de treinadores.

O menu completo é definido em `app/components/layout/Sidebar.js`.

## 3. Backend

Backend = `app/api/**/route.js`.

Não existe repositório BE separado. Em Next.js App Router, cada `route.js` pode implementar `GET`, `POST`, `PUT`, `PATCH`, `DELETE` etc. O catálogo automático está em `04-API-CATALOG.md`.

## 4. Domínio

Arquivos que merecem leitura prioritária:

| Arquivo | Papel |
|---|---|
| `app/lib/playerMaster.js` | identidade canônica de atletas e fontes |
| `lib/club-config.js` | identidade canônica do clube, aliases e branding técnico |
| `data/provider-data-fusion.js` | matching, freshness e fusão SportsBase/Wyscout |
| `lib/iap-engine.js` | cálculo do motor analítico/IAP |
| `data/iap-profiles.js` | perfis posicionais e métricas |
| `data/club-market-context.js` | regra de viabilidade esportiva/mercado do clube |
| `lib/scouting-automation.js` | automação de scouting, alertas e snapshots |
| `lib/club-sportsbase-store.js` | persistência do dataset SportsBase do próprio clube |
| `lib/serieCDb.js` | schema compartilhado da área Série C |
| `lib/serieCMatch.js` | normalização/matching compartilhado de partidas |
| `lib/serieCReport.js` | regras de relatório da competição |
| `lib/providers/espn-serie-c.js` | calendário/classificação pública ESPN |
| `lib/treinador-ai.js` | interpretação via IA no domínio de treinadores |

## 5. Dados

`data/` possui quatro tipos de artefato:

1. **Mapas de colunas** — traduzem exports externos para o modelo interno.
2. **Regras de análise** — perfis, pesos, seleção e contexto competitivo.
3. **Datasets auxiliares** — bases que acompanham a aplicação.
4. **Fusão/normalização** — identity resolution e escolha de fonte.

Não tratar toda a pasta `data/` como “dados estáticos”: parte dela é código de domínio JavaScript.

## 6. Providers externos

Providers com chamadas HTTP devem preferencialmente viver em `lib/providers/` ou em adaptadores claramente identificados. O adaptador ESPN já segue esse padrão. Integrações legadas ainda distribuídas em rotas estão mapeadas em `06-INTEGRACOES.md`.

## 7. SQL

O arquivo SQL legado que ficava na raiz foi movido para:

`docs/sql/schema-ligas-legacy.sql`

Ele é referência histórica; o runtime atual usa schemas criados/atualizados pelo código. A direção futura é migrations versionadas.

## 8. Arquivos removidos da raiz

A pasta `monitoramento/` fora de `app/` continha apenas um layout desabilitado e não participava do App Router. Foi removida para evitar a impressão de existência de uma segunda implementação. O módulo real continua em `app/monitoramento/`.
