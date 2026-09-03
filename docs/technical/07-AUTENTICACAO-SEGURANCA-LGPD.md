# 07 · Autenticação, Segurança e Proteção de Dados

> Este documento descreve controles técnicos. Não substitui revisão jurídica dos contratos, termos de providers ou enquadramento LGPD.

## 1. Autenticação atual

O projeto utiliza **NextAuth Credentials**.

Configuração:

- `app/api/auth/[...nextauth]/route.js`;
- `lib/auth-config.js`;
- `middleware.js`.

Usuários internos são definidos por environment variables. Não existe senha padrão hardcoded no código.

## 2. Autorização

A sessão carrega:

- `role`;
- `modules`;
- `readOnly`.

`middleware.js` determina se a rota pertence a Corpo Técnico ou Scouting e bloqueia acesso quando o módulo não está presente.

Para `readOnly`, métodos de escrita (`POST`, `PUT`, `PATCH`, `DELETE`) são bloqueados no servidor. Isso evita confiar apenas em botões desabilitados no frontend.

## 3. Limitação da autenticação atual

Environment variables com contas fixas funcionam para o ambiente interno atual, mas aumentam o trabalho manual de administração conforme o número de usuários cresce. Se necessário, a evolução natural é persistir usuários em banco ou usar um provedor de identidade, adicionando recuperação de acesso, gestão de sessão e permissões mais granulares.

## 4. Secrets

Secrets conhecidos:

- `NEXTAUTH_SECRET`;
- credenciais do banco;
- `BLOB_READ_WRITE_TOKEN`;
- `OPENAI_API_KEY`;
- `CRON_SECRET`;
- `RESEND_API_KEY`;
- `CALLMEBOT_API_KEY`;
- eventuais chaves adicionais de providers.

Regras:

1. nunca versionar `.env.local`;
2. nunca imprimir secret em log;
3. manter por ambiente;
4. rotacionar se houver exposição;
5. usar menor privilégio possível;
6. remover credencial quando integração deixa de existir.

## 5. Crons

Rotas cron exigem `Authorization: Bearer <CRON_SECRET>`. Os paths exatos de cron não exigem sessão NextAuth no middleware, pois são chamados pela infraestrutura; isso **não os torna públicos**, porque cada handler valida o secret e falha fechado quando ele não existe ou não confere.

O endpoint `/api/notify` permanece sob autenticação normal. Crons reutilizam `lib/notification-service.js` diretamente, sem abrir um segundo caminho HTTP desprotegido.

## 6. Headers HTTP

`next.config.mjs` aplica controles básicos:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: SAMEORIGIN`;
- `Referrer-Policy`;
- `Permissions-Policy` restringindo câmera/microfone/geolocalização.

Direção futura: CSP calibrada, HSTS no ambiente HTTPS e revisão de política de frames conforme integrações.

## 7. Classes de dados

### Dados esportivos de fornecedor

Métricas de Wyscout/SportsBase e outros providers. Podem ter restrição contratual de uso, armazenamento e redistribuição.

### Dados internos do clube

Exemplos:

- avaliações de scout;
- listas de mercado;
- decisões de recrutamento;
- programação interna;
- dados de treino;
- relatórios produzidos pela equipe.

Devem respeitar as permissões internas definidas para cada módulo e perfil.

### Dados pessoais

Podem existir nome, foto, idade/data de nascimento, dados de contato de usuários e informações relacionadas a atletas/profissionais.

### Dados potencialmente sensíveis

O módulo médico/performance pode lidar com informações cuja proteção exige cuidado elevado. O produto deve aplicar acesso mínimo, propósito definido, retenção e trilha de auditoria apropriados.

## 8. LGPD — desenho técnico

Em operação comercial, contratos precisam definir quem é controlador e operador em cada fluxo. Tecnicamente, a plataforma deve suportar:

- minimização de dados;
- controle de acesso por função/organização;
- registro de operações críticas;
- retenção configurável;
- exportação quando aplicável;
- exclusão/anonimização quando juridicamente cabível;
- proteção em trânsito (HTTPS) e no provider de banco/storage;
- resposta a incidente;
- inventário de subprocessadores (Vercel, banco, OpenAI etc.).

## 9. Logs

Logs devem conter contexto operacional, não conteúdo desnecessariamente sensível.

Preferir:

```text
request_id
user_id/organization_id
route/job
provider
status
duration_ms
error_code
```

Evitar:

- senha/token;
- prompt integral com informação sigilosa;
- documento médico integral;
- dump completo de atletas/clientes;
- connection string.

## 10. Checklist antes de compartilhar repositório

- nenhuma credencial real versionada;
- nenhum `.env.local`;
- revisar histórico Git se houver suspeita de secret já commitado;
- identificar dados internos/licenciados incluídos no repositório;
- confirmar autorização para compartilhar código/dados;
- deixar claro que acesso ao código não transfere propriedade intelectual automaticamente.
