# 00 · Visão Geral Técnica

## 1. Objetivo do sistema

O **Centro de Inteligência do Confiança** é uma aplicação web que conecta duas frentes do departamento de futebol:

1. **Corpo Técnico / Performance** — treino, GPS, saúde, programação, elenco e análise de competição.
2. **Inteligência de Mercado / Scouting** — ligas, bases de atletas, filtros, rankings, recrutamento, relatórios, monitoramento, treinadores e automações.

O valor central do produto não está apenas na interface. A aplicação concentra **ingestão de dados, padronização, identidade de atletas, regras analíticas, persistência, relatórios e fluxos de decisão**.

## 2. Arquitetura atual

O sistema é um **monólito modular em Next.js 15**. Frontend e backend estão no mesmo repositório:

- frontend: componentes React e páginas em `app/**/page.js`;
- backend: Route Handlers em `app/api/**/route.js`;
- domínio e serviços: `lib/` e `app/lib/`;
- regras/datasets/mapeamentos: `data/`;
- assets e Service Worker específico: `public/`;
- documentação: `docs/`.

Isso reduz complexidade operacional enquanto o produto ainda evolui rapidamente e permite compartilhar tipos conceituais, regras e código de domínio sem uma camada de rede adicional entre frontend e backend.

## 3. Dimensão do código

No snapshot documentado:

- **79 páginas** (`page.js`);
- **119 Route Handlers** (`app/api/**/route.js`);
- múltiplos domínios persistidos em PostgreSQL;
- importação de arquivos XLSX/CSV/PDF/DOCX;
- geração de relatórios e arquivos;
- integrações opcionais com serviços externos.

O catálogo completo de APIs está em `04-API-CATALOG.md`.

## 4. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15.3 / App Router |
| UI | React 19 + Tailwind CSS |
| Gráficos | Recharts |
| Autenticação | NextAuth Credentials |
| Banco | PostgreSQL / Neon / Vercel Postgres |
| Storage | Vercel Blob em módulos que persistem arquivos |
| Excel/CSV | XLSX + PapaParse |
| PDF | jsPDF, PDF.js, pdf-parse |
| DOCX | Mammoth |
| IA opcional | OpenAI API |
| Deploy alvo | Vercel |
| Versionamento | Git / GitHub |

## 5. Estado de maturidade

### O que a arquitetura atual resolve bem

- um único clube com dois ambientes funcionais;
- grande velocidade de evolução de produto;
- integração direta entre interface, backend e regras analíticas;
- uploads e tratamento de dados sem dependência de uma equipe de engenharia separada;
- centralização de scouting e performance em uma aplicação;
- persistência remota para acesso em diferentes dispositivos.

### Prioridades do escopo atual

As prioridades de evolução do sistema são confiabilidade, segurança, manutenção, qualidade dos dados, automação dos fluxos usados pelo Confiança e redução de dívida técnica que afete a operação real.

## 6. Princípios técnicos

1. **Dado externo nunca é considerado verdade sem validação.**
2. **Identidade de atleta não depende apenas de nome textual.**
3. **Fonte original e transformação analítica devem ser distinguíveis.**
4. **Regras de negócio devem ficar fora da camada visual sempre que possível.**
5. **Secrets não pertencem ao código-fonte.**
6. **Uma funcionalidade operacional deve ser assumível por outro desenvolvedor.**
7. **Complexidade arquitetural deve ser guiada por necessidade real, não por antecipação de requisitos inexistentes.**
8. **Dados do clube e dados licenciados de terceiros têm regimes de portabilidade diferentes.**
