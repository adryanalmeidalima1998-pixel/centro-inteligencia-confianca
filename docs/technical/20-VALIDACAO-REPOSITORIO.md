# 20 · Validação do Repositório

Este documento registra o baseline técnico disponível no repositório e diferencia **checks executáveis localmente** de validações que dependem de infraestrutura/credenciais reais.

## 1. Checks executados

### Catálogo e inventário

```bash
npm run docs:all
```

Resultado atual:

- 79 páginas App Router;
- 119 Route Handlers;
- 27 componentes compartilhados;
- 63 arquivos de domínio em `lib/` + `data/`;
- 329+ arquivos de código analisados no inventário.

### Sintaxe server/data

```bash
npm run check:server
```

Resultado: **191 arquivos server/data** validados por `node --check` após a extração do serviço de notificações.

### Imports internos

```bash
npm run check:imports
```

Resultado: imports `@/` resolvidos nos arquivos varridos, sem referência local quebrada detectada.

### Auditoria estrutural

```bash
npm run audit:repo
```

Resultado: **sem falha bloqueante** na auditoria estrutural.

### Parse JS/JSX

Foi realizado parse estático dos arquivos JavaScript/JSX/MJS para detectar erros de sintaxe também no client. O baseline mais recente passou sem erro de parse.

### Secrets conhecidos

Varredura adicional não encontrou:

- chave OpenAI literal `sk-*`;
- connection string PostgreSQL literal com usuário/senha;
- bearer token longo hardcoded.

`.env.local` não acompanha o repositório; somente `.env.local.example`.

## 2. Bugs estruturais corrigidos durante a validação

### Cron bloqueado pelo middleware

O middleware exigia sessão NextAuth antes de atingir os endpoints de Vercel Cron. Como o Vercel Cron não possui sessão de usuário, o job poderia receber 401 antes de validar `CRON_SECRET`.

Correção:

- somente os endpoints exatos de cron bypassam NextAuth no middleware;
- cada rota continua exigindo `Authorization: Bearer <CRON_SECRET>`;
- ausência de `CRON_SECRET` falha fechada.

### Cron fazendo HTTP contra a própria aplicação

`/api/notificacoes` chamava `/api/notify` via HTTP interno. Além de adicionar latência/acoplamento, isso colidia com autenticação de usuário.

Correção:

- extraído `lib/notification-service.js`;
- cron chama o serviço diretamente no server;
- `/api/notify` continua como endpoint autenticado para chamadas manuais/operacionais.

### Identidade do clube por string distribuída

Corrigida com `lib/club-config.js` e helpers compartilhados. Também foi corrigido caso em que nome normalizado sem acento era comparado com string acentuada.

## 3. O que não foi validado neste ambiente

### Build completo Next.js

O build completo deve ser validado em um ambiente normal de desenvolvimento/CI com acesso ao registry e às dependências do projeto:

```bash
npm install
npm run build
```

O `package-lock.json` deve ser mantido versionado sempre que as dependências forem atualizadas.

### Integrações reais

Dependem de credenciais/infraestrutura e precisam de smoke test:

- PostgreSQL/Neon;
- Vercel Blob;
- OpenAI;
- Resend/CallMeBot;
- crons na Vercel;
- uploads Wyscout/SportsBase;
- providers/scrapers externos.

## 4. Checklist de validação integrada

Em ambiente com dependências e secrets de teste:

```bash
npm install
npm run docs:all
npm run check:all
npm run build
npm run dev
```

Depois validar:

1. login por perfil;
2. acesso Corpo Técnico e Scouting;
3. leitura/escrita de banco em ambiente de teste;
4. upload de uma base não sensível;
5. geração de um relatório/PDF;
6. chamada de cron com e sem secret;
7. um fluxo completo de scouting;
8. um fluxo de Série C;
9. logout e bloqueio de perfil read-only.

## 5. Regra de transparência

Este arquivo não declara “produção pronta”. Ele registra exatamente o que foi checado e o que ainda depende de validação. Essa separação faz parte do handover e evita transformar ausência de erro estático em promessa de SLA.
