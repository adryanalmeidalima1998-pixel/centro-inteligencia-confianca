# 08 · Deploy e Operação

## 1. Topologia atual recomendada

```text
GitHub
  │ push/PR
  ▼
Vercel (Next.js)
  ├── Route Handlers / Server Runtime
  ├── Frontend
  ├── Cron
  └── Environment Variables
       │
       ├── PostgreSQL / Neon
       ├── Vercel Blob
       └── providers externos
```

## 2. Pré-requisitos

- Node.js 20+;
- npm;
- PostgreSQL;
- variáveis de `.env.local.example` conforme módulos usados.

## 3. Ambiente local

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## 4. Variáveis

### Obrigatórias para núcleo autenticado + banco

- `NEXTAUTH_URL`;
- `NEXTAUTH_SECRET`;
- pelo menos um usuário/senha de acesso;
- variáveis Postgres compatíveis com `@vercel/postgres`;
- `DATABASE_URL` enquanto existirem rotas que usam o driver Neon diretamente.

### Dependentes de funcionalidade

- `BLOB_READ_WRITE_TOKEN` — arquivos persistidos;
- `OPENAI_API_KEY` — IA;
- `OPENAI_TRAINER_MODEL` — modelo opcional;
- `CRON_SECRET` — crons;
- `RESEND_API_KEY` / `NOTIF_EMAIL` — e-mail;
- `CALLMEBOT_API_KEY` / `WHATSAPP_PHONE` — WhatsApp.
- `WELLNESS_PRE_SHEET_URL` / `WELLNESS_POST_SHEET_URL` — planilhas públicas dos formulários de bem-estar; **ainda não configuradas porque os formulários do Confiança serão criados posteriormente**.

## 5. Deploy

Fluxo recomendado:

```text
feature branch
   ↓
pull request
   ↓
review + checks
   ↓
staging/preview
   ↓
smoke test
   ↓
main
   ↓
production
```

No estágio atual, Vercel Preview pode funcionar como ambiente de revisão. Para uma operação de produção mais controlada, staging pode ter banco/storage próprios.

## 6. Crons

`vercel.json`:

| Endpoint | Agenda | Papel |
|---|---|---|
| `/api/scouting-automation/cron` | diária | atualizar automação/snapshots |
| `/api/notificacoes` | semanal | consolidar notificações |

Ambos usam `CRON_SECRET`. Esses dois paths exatos são liberados do requisito de sessão NextAuth no `middleware.js` porque o Vercel Cron não possui sessão de usuário; **a autorização continua ocorrendo dentro de cada Route Handler** pelo header `Authorization: Bearer <CRON_SECRET>`.

A rotina semanal chama `lib/notification-service.js` diretamente no servidor, evitando HTTP contra a própria aplicação.

## 7. Banco

### Estado atual

Módulos podem criar/alterar tabelas ao serem chamados. Isso reduz setup inicial, mas dificulta governança de schema.

### Estado alvo

- migration tool/versionamento;
- schema version por release;
- migration em pipeline antes da aplicação;
- rollback planejado para mudanças destrutivas;
- backup antes de migrations de risco.

## 8. Backup

A política operacional deve definir:

- frequência;
- retenção;
- restauração testada;
- responsável;
- backup de banco;
- backup/export de Blob quando necessário.

Dois objetivos a formalizar:

- **RPO:** quantidade máxima de dados que pode ser perdida;
- **RTO:** tempo máximo para recuperar o serviço.

Não basta o provider afirmar que “faz backup”; é necessário testar recuperação.

## 9. Observabilidade

Hoje a aplicação utiliza `console.error`/logs de runtime em diferentes módulos. Para facilitar diagnóstico e manutenção, centralizar:

- logs estruturados;
- request/job id;
- erro por rota/provider;
- duração;
- taxa de falha;
- alertas;
- métricas de cron;
- health check de dependências essenciais.

## 10. Runbook de falha

### Provider externo indisponível

1. não apagar a última carga válida;
2. registrar falha;
3. informar data da última atualização;
4. retry controlado quando seguro;
5. acionar fallback quando houver.

### Banco indisponível

1. falhar com erro claro;
2. não simular sucesso de escrita;
3. preservar request context no log;
4. verificar status do provider;
5. restaurar/recuperar conforme RTO.

### Deploy com regressão

1. interromper novas mudanças;
2. usar rollback/redeploy da versão anterior;
3. avaliar se migration impede rollback;
4. registrar causa;
5. adicionar teste para evitar recorrência.

## 11. Checklist produção

- [ ] `npm run docs:all`
- [ ] `npm run check:all`
- [ ] `npm run build`
- [ ] environment variables validadas
- [ ] nenhum secret no repositório
- [ ] banco/staging separados quando aplicável
- [ ] auth testada por perfil
- [ ] CRUD crítico testado
- [ ] uploads críticos testados
- [ ] geração de PDF/arquivo testada
- [ ] crons autenticados
- [ ] backup confirmado
- [ ] rollback conhecido
