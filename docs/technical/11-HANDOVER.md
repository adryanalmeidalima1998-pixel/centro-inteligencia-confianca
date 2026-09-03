# 11 · Handover: como outro desenvolvedor assume o projeto

## 1. Objetivo

O projeto deve continuar operável mesmo se o autor original não estiver disponível. Handover não significa explicar linha por linha; significa fornecer **contexto, contratos, caminhos críticos e meios reproduzíveis de rodar/alterar o sistema**.

## 2. Pacote mínimo de handover

Outro desenvolvedor precisa receber:

- acesso autorizado ao repositório;
- README e `docs/technical`;
- lista de ambientes;
- acesso institucional a Vercel/banco/storage conforme função;
- variáveis via secret manager, nunca por mensagem/texto em documento;
- contratos/licenças de providers pertinentes;
- inventário de módulos ativos;
- owner de negócio para validar regra esportiva.

## 3. Roteiro de 90 minutos

### 0–15 min · Produto

- quem usa;
- Corpo Técnico × Mercado;
- decisões suportadas;
- módulos mais críticos.

### 15–35 min · Arquitetura

- `app/`;
- `app/api/`;
- `lib/`;
- `data/`;
- PostgreSQL;
- providers;
- middleware/auth.

### 35–60 min · Fluxo real

Demonstrar um caso ponta a ponta:

```text
upload de liga
 -> parser
 -> persistência
 -> sync canônico
 -> ranking
 -> UI
```

### 60–75 min · Operação

- deploy;
- env;
- cron;
- logs;
- backup;
- como detectar falha.

### 75–90 min · Dívida e roadmap

- runtime DDL;
- drivers de banco;
- contexto e configuração específicos do Confiança;
- testes/observabilidade.

## 4. Bootstrap de um desenvolvedor

```bash
git clone <repo>
cd <repo>
npm install
cp .env.local.example .env.local
# obter credenciais por canal seguro
npm run docs:all
npm run check:all
npm run dev
```

Depois validar:

1. login;
2. Home;
3. um GET de Corpo Técnico;
4. um GET de Scouting;
5. banco conectado;
6. upload não destrutivo em ambiente de teste.

## 5. Como localizar uma funcionalidade

Exemplo: “Ligas”.

1. localizar item no `Sidebar.js` → `/ligas-v2`;
2. abrir `app/ligas-v2/page.js` e páginas filhas;
3. procurar `/api/ligas-v2` no frontend;
4. usar `04-API-CATALOG.md`;
5. seguir imports para `data/` e `lib/`;
6. consultar `05-DADOS-E-BANCO.md`.

## 6. Conhecimento de domínio

Código sozinho não explica por que uma métrica tem peso, amostra mínima ou perfil posicional. Regras esportivas relevantes devem estar em arquivos de domínio e documentação, e a validação final deve ter owner do futebol.

Exemplos:

- perfis IAP;
- contexto de viabilidade de mercado;
- critérios de ranking;
- amostra mínima;
- lógica de fit;
- interpretação de métricas de Série C.

## 7. “Bus factor”

Para reduzir dependência de uma pessoa:

- PRs revisados;
- documentação viva;
- migrations;
- testes dos fluxos centrais;
- dashboards de operação;
- secrets institucionais;
- pelo menos duas pessoas capazes de fazer deploy/rollback.
