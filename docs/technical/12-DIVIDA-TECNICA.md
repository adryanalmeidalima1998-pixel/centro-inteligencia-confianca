# 12 · Dívida Técnica e Riscos Conhecidos

Este documento é deliberadamente transparente. Dívida técnica não significa que a funcionalidade não funciona; significa que existem pontos cuja melhoria aumenta segurança, confiabilidade, manutenção e previsibilidade operacional.

## Prioridade P0 — segurança e confiabilidade

### 1. Autenticação de usuários

**Atual:** contas internas via environment variables + NextAuth Credentials.

**Risco:** gestão manual de usuários aumenta custo operacional e dificulta recuperação/auditoria de acesso.

**Ação:** banco/IdP, recuperação de acesso, perfis/permissões e MFA conforme requisito.

### 2. Migrations versionadas

**Atual:** muitos módulos executam `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` no runtime.

**Risco:** schema distribuído, difícil auditar/rollback.

**Ação:** gerar baseline e mover mudanças futuras para migrations.

### 3. Dados médico/performance e autorização granular

**Atual:** proteção por módulo.

**Risco:** informações sensíveis exigem acesso mínimo, autorização granular e trilha de auditoria.

**Ação:** permission model + classificação de dados + auditoria.

## Prioridade P1 — manutenção e qualidade

### 4. Padronização de acesso ao PostgreSQL

**Atual:** `@vercel/postgres` é principal; alguns trechos usam `@neondatabase/serverless`.

**Ação:** uma abstração/padrão de conexão e transação.

### 5. Testes automatizados

**Atual:** validação é majoritariamente funcional/manual e checagem de sintaxe.

**Ação:** testes unitários para parsers/matching/ranking; integração para APIs críticas; smoke/E2E para login, upload, relatório e CRUD.

### 6. Observabilidade

**Atual:** logs distribuídos.

**Ação:** logging estruturado, erro central, request id, métricas, alertas.

### 7. Workloads longos

**Atual:** parte roda dentro de Route Handlers; algumas rotinas já disparam processamento secundário.

**Ação:** job queue para tarefas pesadas e retries controlados.

### 8. Contrato de API interno

**Atual:** contratos são implícitos no código React/Route Handlers.

**Ação:** schemas de entrada/saída em pontos críticos, validação e documentação gerável.


### 9.1 Lockfile/reprodutibilidade de dependências

**Atual:** o repositório não contém `package-lock.json`.

**Risco:** ranges SemVer podem resolver versões diferentes entre máquinas/deploys.

**Ação:** gerar `package-lock.json` em ambiente com acesso ao registry, validar `npm run build` e versionar o lockfile antes da operação comercial.

## Prioridade P2 — limpeza estrutural

### 10. Payloads JSONB grandes

Alguns datasets são persistidos como snapshots JSONB.

**Ação:** manter onde faz sentido, mas normalizar entidades necessárias a consultas frequentes e medir custo de payload.

### 11. Providers distribuídos

ESPN já foi isolado em `lib/providers`. Outras integrações históricas ainda vivem próximas das rotas.

**Ação:** consolidar provider clients conforme forem alterados, evitando refactor de risco sem necessidade.

## Melhorias técnicas já aplicadas

- remoção de Sportmonks não utilizado;
- calendar/standings público consolidado no adapter ESPN;
- remoção de senha/secret fallback hardcoded;
- cron fechado quando secret não está configurado;
- contatos de notificação movidos para environment;
- remoção de endpoints/componentes sem consumidores estáticos conhecidos;
- remoção de pasta raiz morta `monitoramento/`;
- contexto de mercado renomeado para domínio neutro do clube;
- rotas SportsBase/calendário do próprio clube com nomes neutros;
- documentação técnica e checks adicionados.

## Regra de priorização

Não corrigir dívida apenas por estética durante janela crítica. Priorizar por:

```text
risco de dados/segurança
> risco de indisponibilidade
> custo recorrente de desenvolvimento
> consistência estética
```

## Revisão de hotspots

A duplicação e os maiores arquivos/rotas foram inventariados em `18-INVENTARIO-CODIGO.md` e analisados em `19-HOTSPOTS-REFATORACAO.md`. O principal padrão duplicado estrutural encontrado é DDL em runtime; a solução prevista é migrations, não um helper genérico de `ensureTable`.
