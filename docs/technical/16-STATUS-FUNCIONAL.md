# 16 · Status Funcional e Dependências

Este documento diferencia **funcionalidade implementada**, **dependência externa** e **robustez operacional**.

## 1. Núcleo implementado

### Aplicação e acesso

- Home integrada;
- autenticação única;
- perfis por módulo;
- perfil diretoria read-only;
- navegação Corpo Técnico / Mercado.

### Corpo Técnico

- treino/banco de treino;
- pênaltis;
- GPS/fisiologia;
- banco físico-tático;
- DM/RTP;
- programação/agenda;
- elenco;
- fotos;
- Série C e relatórios.

### Mercado

- Decision Room;
- Ligas;
- uploads SportsBase/Wyscout;
- ficha canônica;
- database/ranking;
- Sub-20;
- evolução;
- shadow teams;
- TransferRoom;
- pipeline/funil;
- focos/recomendações;
- watchlist/lista final;
- relatórios/comparação;
- avaliação;
- observação;
- monitoramento;
- treinadores;
- automação.

## 2. Dependências obrigatórias do deploy base

| Dependência | Necessária para |
|---|---|
| PostgreSQL | persistência do sistema |
| NextAuth secret + usuário | acesso autenticado |
| Vercel/Node runtime | aplicação server/client |

## 3. Dependências condicionais

| Dependência | Módulos afetados sem ela |
|---|---|
| Vercel Blob | fluxos que persistem arquivos/imagens/PDFs |
| OpenAI API | extração/interpretação por IA |
| internet/ESPN | atualização pública de calendário/classificação |
| acesso a exports Wyscout | datasets Wyscout |
| acesso a exports SportsBase | datasets SportsBase |
| Resend/CallMeBot | canais de notificação |
| scraping externo | recursos específicos Transfermarkt/Ogol |

A ausência de um provider opcional não deve impedir o núcleo da aplicação de iniciar, desde que a rota correspondente trate a configuração ausente.

## 4. O que é “pronto funcionalmente” versus “pronto operacionalmente”

### Pronto funcionalmente

Fluxo pode ser utilizado pelo clube e persistir/entregar o resultado esperado.

### Pronto operacionalmente

Além de funcionar, possui:

- autorização adequada;
- migrations previsíveis;
- contrato de API estável;
- testes;
- observabilidade;
- fallback/erro claro;
- documentação;
- backup e recuperação conhecidos.

Alguns módulos já atendem ao fluxo funcional, enquanto outros ainda podem ganhar robustez operacional nos itens acima.

## 5. Itens que exigem validação em ambiente real

Antes de afirmar SLA/produção, validar com credenciais e infraestrutura reais:

- `npm run build`;
- conexão banco;
- Blob;
- upload de arquivos grandes;
- geração de PDF;
- crons;
- IA;
- scrapers;
- carga simultânea;
- rollback;
- restore de backup.

## 6. Critério para novas funcionalidades

Nova feature deve indicar explicitamente:

```text
Owner de negócio
Dados de entrada
Provider/origem
Persistência
Regra analítica
Permissões
Saída
Dependências externas
Comportamento em erro
```
