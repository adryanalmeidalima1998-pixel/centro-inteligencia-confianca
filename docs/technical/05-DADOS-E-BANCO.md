# 05 · Dados e Banco de Dados

## 1. Banco principal

A persistência principal é **PostgreSQL**, consumida majoritariamente por `@vercel/postgres`. Alguns trechos históricos utilizam `@neondatabase/serverless` diretamente. Ambos podem apontar para Neon/Postgres, mas a camada de acesso deve ser padronizada para reduzir manutenção e comportamento divergente.

## 2. Estratégia atual de schema

Grande parte dos módulos é autocontida e garante suas tabelas com `CREATE TABLE IF NOT EXISTS` e alterações idempotentes. Esse modelo permitiu evolução rápida sem pipeline de migrations separado.

Para melhorar governança e previsibilidade do banco, a recomendação é substituir progressivamente DDL em runtime por **migrations versionadas**, permitindo:

- revisão de mudança de schema em pull request;
- rollback/forward previsível;
- ambientes dev/staging/prod no mesmo nível de schema;
- auditoria de evolução;
- onboarding de novos clientes sem depender da primeira execução de um endpoint.

## 3. Grupos de tabelas

O código atual cria aproximadamente 80+ tabelas/estruturas de domínio. Os principais grupos são:

### 3.1 Identidade e inteligência de atletas

- `cig_jogadores` — ficha canônica;
- `cig_player_sources` — ocorrências por provider/liga/temporada;
- `player_aliases` — aliases auxiliares;
- `player_enrichment` — enriquecimentos;
- `jogadores_banco`, `jogadores_destacados` — bases históricas/fluxos legados;
- `liga_jogadores` — snapshots de fonte por competição.

### 3.2 Recrutamento

- `candidatos_pipeline`;
- `focos_recrutamento`;
- `lista_preferencial`;
- `lista_preferencial_historico`;
- `lista_final`;
- `observacao_partidas`;
- `atletas_monitoramento`;
- `transferroom`;
- `cig_shadow_teams` / `shadow_team_v2`.

### 3.3 Automação

- `cig_automation_runs`;
- `cig_automation_snapshots`;
- `cig_automation_alerts`;
- `cig_automation_reports`;
- `cig_import_logs`.

### 3.4 Próprio clube

- `club_sportsbase` — snapshot coletivo + atletas do SportsBase;
- `confianca_squad` — elenco do Corpo Técnico;
- `elenco_session` — estado persistido de tela/modelo de elenco;
- `agenda_eventos`.

### 3.5 Corpo Técnico / performance

- `gps_sessions`;
- `gps_desempenho`;
- `cmj_basal`;
- `forca_basal`;
- `pcr_basal`;
- `maturacao_athletes` / `maturacao_assessments`;
- `status_recuperacao`;
- `dm_cases` / `dm_logs`;
- `banco_treino` / `banco_partidas`;
- `penaltis_cig`;
- `training_pdfs`.

### 3.6 Série C

- `serie_c_uploads`;
- `serie_c_team_stats`;
- `serie_c_player_stats`;
- `serie_c_goalkeeper_stats`;
- `serie_c_competition_matches`;
- `serie_c_live_matches`;
- `serie_c_live_snapshots`;
- `serie_c_standings_snapshots`;
- `serie_c_opponent_reports`;
- `serie_c_team_reports`;
- `serie_c_report_exclusions`;
- `serie_c_gols_lado`;
- `serie_c_club_matches` — histórico de partidas do próprio clube.

## 4. Identidade canônica

### Problema

Fornecedores podem representar o mesmo atleta de formas diferentes:

```text
SportsBase: Kevin Stiben Viveros Rodallega
Wyscout:    K. Viveros
```

Fazer `JOIN` apenas por nome gera falsos negativos e falsos positivos.

### Implementação atual

`app/lib/playerMaster.js` implementa uma identidade canônica:

```text
buildPlayerIdentity(player)
  ├─ nome normalizado
  ├─ data de nascimento (quando disponível)
  ├─ ano de nascimento (fallback)
  ├─ nacionalidade (fallback)
  └─ posição (fallback)
```

A chave de origem (`source_player_key`) inclui provider, liga, temporada, identidade e clube da ocorrência. Isso permite manter histórico sem transformar provider ID em identidade global do produto.

## 5. Fusão SportsBase + Wyscout

`data/provider-data-fusion.js` separa quatro problemas:

1. **candidate generation** — quais registros podem representar a mesma pessoa;
2. **identity scoring** — quão confiável é a associação;
3. **freshness** — qual fonte parece mais atual em determinado registro;
4. **field-level choice** — qual valor usar em cada campo.

Principais funções:

- `pairProviderPlayers()`;
- `findBestProviderMatch()`;
- `compareProviderFreshness()`;
- `fusePlayerRecords()`;
- `mergeProviderDatasets()`.

Essa abordagem é preferível a sobrescrever uma fonte pela outra. Ela preserva rastreabilidade e permite explicar a origem do valor final.

## 6. JSONB

JSONB é usado quando:

- a estrutura do provider possui muitas métricas e evolui com frequência;
- o snapshot precisa ser armazenado rapidamente;
- a aplicação trabalha com payload completo como unidade;
- a normalização total geraria dezenas de tabelas pouco úteis.

Não deve ser usado como substituto universal de modelagem relacional. Campos utilizados intensamente em joins, constraints, autorização, filtros críticos e integridade devem preferir colunas/tabelas próprias.

## 7. Idempotência

Uploads e sincronizações devem ser desenhados para não duplicar entidades se a mesma operação for repetida. Os padrões usados no projeto incluem:

- `UNIQUE` + `ON CONFLICT`;
- chave canônica de atleta;
- chave de source/provider;
- substituição do snapshot mais recente em domínios onde histórico não é necessário;
- snapshots versionados onde histórico é relevante.

Ao criar nova ingestão, a pergunta obrigatória é: **o que acontece se esta mesma carga rodar duas vezes?**

## 8. Data quality

Validações relevantes no código:

- cabeçalhos obrigatórios nos uploads;
- conversão defensiva de números;
- cobertura de posição/pé/minutagem;
- duplicidades e matching;
- campos ausentes;
- fonte e timestamp de upload;
- regras de amostra mínima para rankings;
- validações de schema de ligas.

Direção futura: registrar erros de data quality em estrutura única, com severidade, provider, dataset, linha/entidade, regra violada e ação tomada.


## 10. Portabilidade

Dados produzidos pelo clube devem possuir caminho de exportação. Dados derivados ou licenciados por Wyscout, SportsBase ou outro provider devem ser tratados conforme as regras de uso da respectiva fonte.
