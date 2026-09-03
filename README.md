# Centro de Inteligência · Associação Desportiva Confiança

Plataforma web integrada para **Corpo Técnico, Performance, Análise de Competição, Scouting e Inteligência de Mercado**. O projeto reúne frontend, backend e regras analíticas no mesmo repositório, com persistência em PostgreSQL e integrações externas organizadas por domínio.

A aplicação foi desenvolvida para atender a rotina do Confiança e vem sendo evoluída conforme surgem novas necessidades das áreas que utilizam o sistema.

## Estrutura geral

```text
Fontes externas / uploads
       │
       ▼
Adaptadores + parsers + validação
       │
       ▼
PostgreSQL / Blob
       │
       ▼
Regras analíticas e domínio
       │
       ▼
Route Handlers / API interna
       │
       ▼
Next.js / React
       │
       ▼
Corpo Técnico · Mercado · Diretoria
```

A base funciona como um **monólito modular em Next.js 15 / React 19**. As páginas ficam em `app/**/page.js`, as APIs em `app/api/**/route.js` e boa parte das regras reutilizadas entre telas e rotas fica em `lib/` e `data/`.

## Módulos

### Corpo Técnico

- visão geral operacional;
- treino, goleiros e pênaltis;
- Banco Físico-Tático;
- fisiologia / GPS / Catapult;
- Departamento Médico e RTP;
- programação e agenda de futebol;
- elenco profissional e fotos;
- Série C: uploads, classificação, jogos, coleta ao vivo, adversários e relatórios.

### Inteligência de Mercado

- Decision Room;
- ligas Wyscout + SportsBase;
- base de atletas e fusão entre fontes;
- Sub-20 e evolução de jogadores;
- Times Shadow;
- TransferRoom e funil de recrutamento;
- focos, watchlist, lista final e relatórios;
- comparação e avaliação iScout;
- monitoramento e eficiência de mercado;
- treinadores e desempenho;
- importação de dados.

## Stack principal

- **Next.js 15.3 / App Router**
- **React 19**
- **NextAuth 4**
- **PostgreSQL** via `@vercel/postgres` / Neon
- **Vercel Blob**
- **Tailwind CSS 3**
- **Recharts**
- **XLSX / PapaParse / JSZip**
- **jsPDF / PDF.js / Mammoth**
- **OpenAI API** em recursos opcionais de extração/interpretação

## Rodando localmente

Pré-requisitos:

- Node.js 20 ou 22;
- npm 10+;
- PostgreSQL/Neon para os fluxos que dependem de persistência.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Aplicação local: `http://localhost:3000`.

As credenciais não ficam versionadas. As variáveis utilizadas pelo projeto estão descritas em `.env.local.example`.

## Comandos principais

```bash
npm run dev           # ambiente de desenvolvimento
npm run build         # build de produção
npm run start         # executa a aplicação compilada
npm test              # testes das regras críticas cobertas pela suíte atual
npm run check:server  # valida sintaxe de server/data
npm run check:imports # valida imports locais @/
npm run audit:repo    # procura referências obsoletas e secrets conhecidos
npm run check:all     # sintaxe + imports + auditoria
npm run docs:all      # atualiza catálogo de APIs e inventário do código
npm run ci            # checks + testes + build
```

## Decisões técnicas principais

### Next.js no frontend e backend

O mesmo projeto atende interface e Route Handlers. Essa escolha reduziu a quantidade de infraestrutura necessária no início e facilitou a evolução conjunta das telas e dos fluxos de API.

### PostgreSQL para dados operacionais

Atletas, partidas, avaliações, uploads e registros internos possuem bastante relação entre si. PostgreSQL foi escolhido como base principal, enquanto arquivos persistidos por alguns módulos ficam no Vercel Blob.

### Wyscout e SportsBase como fontes complementares

As duas fontes não são tratadas como se possuíssem exatamente os mesmos atletas, nomes ou nível de atualização. O sistema mantém as entradas separadas e usa uma camada de identificação para encontrar o mesmo jogador entre as bases.

O matching considera, conforme disponibilidade:

- nome normalizado;
- abreviações e partículas do nome;
- data/ano de nascimento e idade;
- clube;
- nacionalidade;
- posição;
- margem de confiança em relação a outros candidatos.

A regra principal fica em `data/provider-data-fusion.js`. A suíte em `tests/provider-data-fusion.test.mjs` cobre casos de abreviação, acentos, homônimos, ambiguidade e divergência de identidade.

### Autorização no servidor

As permissões não dependem apenas de esconder itens da interface. O middleware também aplica as regras de acesso no servidor, incluindo o bloqueio de escrita para perfis somente leitura.

## Autenticação e perfis

A autenticação usa **NextAuth Credentials**, com usuários e senhas definidos por variáveis de ambiente.

| Perfil | Corpo Técnico | Mercado | Escrita |
|---|---:|---:|---:|
| Administrador | Sim | Sim | Sim |
| Corpo Técnico | Sim | Não | Sim |
| Scouting | Não | Sim | Sim |
| Diretoria | Sim | Sim | Não |

Não existe senha padrão mantida no código.

## Bem-estar

O módulo foi implementado para o fluxo:

```text
Google Forms
    ↓
Google Sheets publicada como CSV
    ↓
Dashboard
```

Os formulários específicos do Confiança ainda não foram criados. Por isso, estas variáveis permanecem vazias em `.env.local.example`:

- `WELLNESS_PRE_SHEET_URL`
- `WELLNESS_POST_SHEET_URL`

Quando os formulários PRÉ e PÓS forem definidos, basta publicar as planilhas de respostas no formato utilizado pelo módulo e configurar as URLs. Enquanto estiverem vazias, o endpoint informa que a integração ainda não está configurada.

## Testes e validações

A suíte automatizada começou pelas regras de identidade entre providers porque um match incorreto pode contaminar comparações, rankings e perfil do atleta. Os testes usam o runner nativo do Node e não dependem de banco ou credenciais externas.

O restante do repositório possui checks locais de sintaxe, imports e auditoria. Fluxos que dependem de PostgreSQL, Blob, providers ou credenciais continuam exigindo validação integrada no ambiente apropriado.

## Integração contínua

O workflow `.github/workflows/ci.yml` executa os checks, testes e build nos pushes e pull requests da branch principal. O objetivo é evitar que alterações simples cheguem à base com import quebrado, falha de regra coberta por teste ou erro de build.

## Documentação técnica

A documentação complementar está em [`docs/technical/`](docs/technical/README.md), incluindo arquitetura, mapa do repositório, banco, integrações, segurança, operação, padrões de código e pontos de manutenção.

## Deploy

O ambiente utilizado é Vercel + PostgreSQL/Neon + Vercel Blob. Variáveis, crons e cuidados operacionais ficam descritos em [`docs/technical/08-DEPLOY-OPERACAO.md`](docs/technical/08-DEPLOY-OPERACAO.md).

## Segurança

- secrets somente por variável de ambiente;
- middleware exige sessão e permissão de módulo;
- perfis read-only são bloqueados também no servidor;
- crons operacionais exigem `CRON_SECRET`;
- headers HTTP básicos de segurança ficam em `next.config.mjs`;
- dados e licenças de terceiros devem seguir as regras dos respectivos fornecedores.

## Evolução do projeto

As mudanças são priorizadas a partir das necessidades reais da operação. Quando um fluxo passa a ser mais crítico ou reutilizado por mais módulos, a tendência é extrair regra de negócio, reduzir duplicação e adicionar validações automatizadas antes de continuar ampliando a funcionalidade.
