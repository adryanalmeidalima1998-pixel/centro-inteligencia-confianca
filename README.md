# Centro de Inteligência · Confiança

Aplicação única da **Associação Desportiva Confiança** que reúne os dois sistemas operacionais anteriormente separados: **Corpo Técnico** e **CIG / Departamento de Mercado**.

O projeto foi organizado para uso diário, com uma Home institucional, autenticação única, isolamento de permissões por módulo e preservação das rotinas funcionais dos dois projetos de origem.

## Estrutura de acesso

| Perfil | Corpo Técnico | Mercado / Scouting | Edição |
|---|---:|---:|---:|
| Administrador | Sim | Sim | Sim |
| Corpo Técnico | Sim | Não | Sim |
| Scouting | Não | Sim | Sim |
| Diretoria | Sim | Sim | Somente leitura |

Contas padrão de desenvolvimento:

- `inteligencia@adconfianca.com.br` — ambos os módulos
- `corpotecnico@adconfianca.com.br` — somente Corpo Técnico
- `scouting@adconfianca.com.br` — somente Mercado
- `diretoria@adconfianca.com.br` — ambos, somente leitura

Quando nenhuma senha específica estiver configurada, as contas usam `AUTH_PASSWORD`. No código local existe um fallback de desenvolvimento (`confianca2026`); **configure senhas próprias na Vercel antes do uso externo**.

## Módulo Corpo Técnico

- Visão geral
- Treino e PDFs de programação de campo
- Preparação de goleiros
- Banco Físico-Tático
- Fisiologia / GPS / Catapult
- Bem-estar, PSE e análises individuais
- Departamento Médico, disponibilidade e RTP
- Programação diária/semanal, jogos, classificação e clima
- Elenco profissional com cadastro editável
- Banco de fotos
- Série C 2026: uploads, classificação, partidas, coleta ao vivo, adversários e relatórios

O endpoint `/api/squad` cria uma tabela própria (`confianca_squad`) e, quando vazia, inicia com uma base real do elenco do Confiança disponível no fim de agosto de 2026. Dados não confirmados publicamente — peso, altura, número, pé dominante e contratos — ficam vazios para preenchimento interno, sem informação inventada.

## Módulo Departamento de Mercado

- Decision Room
- Ligas e upload Wyscout / Sportsbase
- Base canônica de atletas
- Sub-20
- Evolução de jogadores
- Times Shadow
- TransferRoom
- Funil
- Centro de Recrutamento
- Recomendações
- Watchlist / Lista Preferencial
- Lista Final
- Relatórios de jogadores
- Comparação
- Avaliação iScout
- Elenco / modelo de jogo
- Agenda
- Observação
- Desempenho
- Monitoramento
- Eficiência de Mercado
- Treinadores
- Importação de dados

O contexto de mercado foi recalibrado para o planejamento de **2027: Série D → acesso à Série C**, enquanto os dados da Série C 2026 permanecem disponíveis como histórico de desempenho.

## Stack

- Next.js 15 / App Router
- React 19
- NextAuth
- Tailwind CSS 3
- Recharts
- Vercel Postgres / Neon
- Vercel Blob
- XLSX, PapaParse, JSZip, jsPDF e PDF.js

## Instalação

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Acesse `http://localhost:3000`.

> O `package-lock.json` dos dois projetos de origem não foi mantido porque cada projeto usava versões diferentes de Next/React e um dos locks já estava fora de sincronia com seu próprio `package.json`. Execute `npm install` uma vez para gerar um lock novo e coerente com o projeto unificado antes de versioná-lo.

## Deploy na Vercel

1. Suba esta pasta para um repositório.
2. Importe o repositório na Vercel.
3. Cadastre as variáveis de `.env.local.example`.
4. Conecte Postgres/Neon e Blob.
5. Faça o deploy.
6. Entre com o perfil administrativo e valide uploads e integrações externas.

### Migração de dados

Para começar do zero no Confiança, use um banco novo. Isso evita mistura com registros históricos do Guarani, mesmo quando alguns nomes internos de tabelas/rotas foram preservados por compatibilidade com as funções já existentes.

Caso queira transportar algum histórico selecionado, faça a migração tabela a tabela depois do novo banco estar operacional.

## Identidade

A interface usa azul, branco e azul-marinho, escudo do Confiança, Home institucional e navegação única. Nomes internos legados como `guarani_*` podem continuar aparecendo apenas em código/tabelas para evitar quebra de compatibilidade; a interface e a lógica de identificação do clube foram adaptadas para **Associação Desportiva Confiança**.
