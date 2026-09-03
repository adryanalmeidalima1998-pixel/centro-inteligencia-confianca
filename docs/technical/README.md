# Documentação Técnica · Centro de Inteligência do Confiança

Esta pasta concentra a documentação técnica usada para manutenção e evolução do projeto. A ideia é registrar arquitetura, fluxos, integrações e decisões que não ficam óbvias apenas lendo uma tela ou uma rota isolada.

## Documentos

| Documento | Conteúdo |
|---|---|
| [`00-VISAO-GERAL.md`](00-VISAO-GERAL.md) | Visão geral do produto e da stack |
| [`01-ARQUITETURA.md`](01-ARQUITETURA.md) | Camadas e fluxo de dados |
| [`02-MAPA-REPOSITORIO.md`](02-MAPA-REPOSITORIO.md) | Organização das principais pastas |
| [`03-MODULOS-FUNCIONAIS.md`](03-MODULOS-FUNCIONAIS.md) | Módulos e funcionalidades |
| [`04-API-CATALOG.md`](04-API-CATALOG.md) | Catálogo dos Route Handlers |
| [`05-DADOS-E-BANCO.md`](05-DADOS-E-BANCO.md) | Persistência, identidade e fusão de dados |
| [`06-INTEGRACOES.md`](06-INTEGRACOES.md) | Integrações externas |
| [`07-AUTENTICACAO-SEGURANCA-LGPD.md`](07-AUTENTICACAO-SEGURANCA-LGPD.md) | Autenticação, permissões e dados pessoais |
| [`08-DEPLOY-OPERACAO.md`](08-DEPLOY-OPERACAO.md) | Deploy e operação |
| [`10-PADRAO-CODIGO.md`](10-PADRAO-CODIGO.md) | Convenções do projeto |
| [`11-HANDOVER.md`](11-HANDOVER.md) | Continuidade e passagem de contexto |
| [`12-DIVIDA-TECNICA.md`](12-DIVIDA-TECNICA.md) | Pontos conhecidos de manutenção |
| [`16-STATUS-FUNCIONAL.md`](16-STATUS-FUNCIONAL.md) | Estado dos módulos e dependências |
| [`18-INVENTARIO-CODIGO.md`](18-INVENTARIO-CODIGO.md) | Inventário automático do repositório |
| [`19-HOTSPOTS-REFATORACAO.md`](19-HOTSPOTS-REFATORACAO.md) | Arquivos e fluxos que merecem refatoração gradual |
| [`20-VALIDACAO-REPOSITORIO.md`](20-VALIDACAO-REPOSITORIO.md) | Checks e validações disponíveis |

## Decisões arquiteturais

- [`decisions/ADR-001-MONOLITO-MODULAR.md`](decisions/ADR-001-MONOLITO-MODULAR.md)
- [`decisions/ADR-002-ADAPTADORES-DE-PROVEDORES.md`](decisions/ADR-002-ADAPTADORES-DE-PROVEDORES.md)

## Atualização automática

```bash
npm run docs:all
npm run check:all
npm test
```

Mudanças relevantes de arquitetura, persistência, autenticação, provider ou fluxo operacional devem atualizar a documentação relacionada junto com o código.
