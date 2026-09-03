# 19 · Hotspots de Refatoração e Duplicação

Esta análise identifica **onde está o maior custo de manutenção e evolução da base atual**.

Ela não recomenda reescrever arquivos grandes apenas pelo tamanho. A prioridade é reduzir acoplamento onde existe benefício operacional, de teste, confiabilidade ou velocidade de desenvolvimento.

## 1. Baseline atual

Inventário automático (`npm run docs:inventory`):

- 79 páginas App Router;
- 119 Route Handlers;
- 27 componentes compartilhados;
- 63 arquivos de domínio em `lib/` + `data/`;
- 329 arquivos de código;
- ~5,4 MB de código.

## 2. Rotas mais densas

Os maiores Route Handlers atuais são:

1. `app/api/ligas-v2/[slug]/destaques/route.js`;
2. `app/api/serie-c/data/route.js`;
3. `app/api/serie-c/gols-lado/route.js`;
4. `app/api/monitoramento/route.js`;
5. `app/api/avaliacao-atleta/route.js`;
6. `app/api/status-recuperacao/route.js`;
7. `app/api/player-master/[id]/route.js`;
8. `app/api/ligas-v2/jogadores/route.js`.

A lista completa e tamanhos está em `18-INVENTARIO-CODIGO.md`.

## 3. Duplicação estrutural identificada

### 3.1 DDL em runtime

Há dezenas de rotas com `ensureTable`/`ensureTables`. O conteúdo não é idêntico — cada domínio cria seu schema —, portanto transformar tudo em um helper genérico não resolve a causa.

**Causa real:** ausência de migrations versionadas.

**Ação correta:** extrair um baseline de schema e implantar migrations. Depois remover gradualmente o DDL de request-time.

### 3.2 Normalização de identidade e partida

Esse era um caso de duplicação real e de baixo risco. Hoje está centralizado em:

- identidade do clube → `lib/club-config.js`;
- normalização/matching de partidas → `lib/serieCMatch.js`;
- consumidores de Série C passaram a reutilizar esses helpers.

### 3.3 Providers

O calendário/classificação pública foi isolado em `lib/providers/espn-serie-c.js`; Sportmonks sem uso foi removido.

Próximo passo: mover integrações externas alteradas com frequência para adapters explícitos, sem fazer refactor em massa de integrações estáveis apenas por estética.

### 3.4 Contratos de benchmark do próprio clube

Os contratos do próprio clube usam as chaves canônicas `club`, `clubScore`, `percentileClub`, `avgClub` e `clubGroupSize`.

## 4. Arquivos grandes de frontend

Os maiores arquivos de UI concentram tela, transformação, exportação e componentes locais. Os principais candidatos são:

- `app/banco-fisico-tatico/page.js`;
- `app/fisiologia/gps/page.js`;
- `app/dm/page.js`;
- `app/fisiologia/bem-estar/page.js`;
- `app/ligas-v2/[slug]/page.js`.

### Estratégia de decomposição

Não quebrar por número arbitrário de linhas. Extrair quando houver uma fronteira clara:

```text
page.js
├── hooks/          carregamento/estado
├── components/     blocos visuais reutilizáveis
├── domain/         cálculo/regras puras
└── export/         PDF/PNG/planilha
```

Benefício esperado: testes unitários no domínio e menor risco de regressão visual.

## 5. Ordem recomendada de refactor

### P0 · Confiabilidade estrutural

1. migrations;
2. padronização da autenticação e gestão de usuários;
3. autorização granular;
4. isolamento e organização de arquivos/credentials;
5. validação de contratos nas rotas críticas.

### P1 · Confiabilidade

6. contrato/validação de APIs críticas;
7. testes de parsers, identity resolution e scoring;
8. logs estruturados e observabilidade;
9. jobs para processamento longo.

### P2 · Manutenibilidade

10. decompor os maiores Route Handlers por serviço de domínio;
11. decompor páginas analíticas mais alteradas;
12. padronizar acesso ao PostgreSQL;
13. consolidar contratos internos conforme os módulos forem refatorados.

## 6. Critério para uma rota grande

Uma rota deve ser dividida quando mistura múltiplas responsabilidades, por exemplo:

```text
HTTP parsing
+ validação
+ SQL
+ integração externa
+ cálculo analítico
+ geração de resposta
```

Alvo:

```text
route.js
   -> valida request/autorização
   -> chama service
service
   -> coordena caso de uso
repository/provider
   -> I/O
pure domain
   -> cálculo testável
```

O objetivo é deixar o Route Handler fino sem criar camadas artificiais onde não agregam valor.

## 7. Direção de manutenção

O tamanho atual demonstra amplitude funcional. O principal ganho técnico está em mover gradualmente responsabilidades críticas para domínio testável, adotar migrations e reduzir o acoplamento dos maiores fluxos.
