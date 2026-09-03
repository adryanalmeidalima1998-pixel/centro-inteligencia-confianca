# 06 · Integrações e Dependências Externas

## 1. Regra geral

Integrações externas devem ser vistas como **providers substituíveis**, não como regra de negócio. O contrato bruto de um fornecedor não deve vazar desnecessariamente para toda a aplicação.

Sempre que possível:

```text
Provider externo -> adaptador/parser -> modelo interno -> domínio/UI
```

## 2. Matriz atual

| Provider / fonte | Uso | Forma de entrada | Necessidade | Observação |
|---|---|---|---|---|
| PostgreSQL/Neon | persistência principal | conexão server-side | Obrigatório | núcleo do sistema |
| Vercel Blob | arquivos persistentes | SDK server-side | Condicional | necessário nos módulos que salvam arquivos |
| SportsBase | scouting/performance | upload XLSX/export | Importante | não existe chave de API embutida no core de Ligas |
| Wyscout | scouting/benchmark | upload XLSX/CSV/export | Importante | core de Ligas trabalha com export autorizado |
| ESPN pública | calendário/classificação Série C | HTTP GET | Condicional | adapter em `lib/providers/espn-serie-c.js` |
| OpenAI | extração/interpretação | API server-side | Opcional | recursos de IA degradam sem a chave |
| Transfermarkt | classificação/treinadores | scraping HTTP | Opcional | best effort; sujeito a mudança externa |
| Jina AI Reader | auxílio de leitura Transfermarkt | HTTP | Opcional | `JINA_API_KEY` opcional |
| Google Sheets | proxy/importação específica | HTTP | Opcional | depende do módulo |
| Resend | e-mail | API | Opcional | notificações |
| CallMeBot | WhatsApp | API | Opcional | notificações simples |
| Open-Meteo / serviço climático | clima de jogo | HTTP | Opcional | suporte à programação |

## 3. Wyscout

### Fluxo principal de Ligas

No código atual, o fluxo robusto é baseado em **exportação Wyscout enviada pelo usuário**, não em feed contratado embutido no repositório.

`app/api/ligas-v2/[slug]/wyscout/route.js`:

1. recebe `.xlsx`;
2. seleciona `Search results` quando existe;
3. valida campos obrigatórios;
4. resolve aliases de cabeçalhos;
5. normaliza atletas;
6. salva snapshot com `fonte='wyscout'`;
7. agenda processamento secundário;
8. disponibiliza dataset filtrável.

Outras rotas `wyscout*` atendem funções históricas/benchmark/desempenho e devem ser avaliadas por módulo.

## 4. SportsBase

`app/api/ligas-v2/[slug]/sportsbase/route.js`:

1. recebe arquivo;
2. valida planilha/headers;
3. converte usando `data/sportsbase-map.js`;
4. tenta enriquecer atributos estáticos com Wyscout quando disponível;
5. persiste snapshot separado;
6. dispara processamento da ficha canônica/automação.

O próprio clube possui fluxo adicional em `/api/club-sportsbase`, com `lib/club-sportsbase-store.js`.

## 5. ESPN

A API pública ESPN substitui uma integração Sportmonks não utilizada no fluxo final.

`lib/providers/espn-serie-c.js` é o adapter único para:

- scoreboard por intervalo de data;
- parsing de evento;
- calendário da temporada;
- classificação.

### Por que adapter separado

Se a estrutura ESPN mudar ou o produto migrar para provider oficial, as telas não precisam ser reescritas; altera-se o adapter/contrato interno.

## 6. IA / OpenAI

Recursos atuais incluem:

- extração de PDF/DOCX;
- interpretação de textos de treinador;
- leitura estruturada de documentos;
- fallback/enriquecimento em scrapers específicos.

A chave é somente server-side (`OPENAI_API_KEY`). O serviço não deve receber secrets internos nem mais dados do que o necessário para a tarefa.

### Cuidados no uso de IA

Definir por recurso:

- quais campos são enviados;
- base legal/necessidade operacional para dados pessoais, quando aplicável;
- retenção do provider;
- modelo utilizado;
- custo por operação;
- fallback sem IA;
- logs sem conteúdo sensível.

## 7. Google Forms / Google Sheets · bem-estar

O módulo de bem-estar usa planilhas públicas apenas como **fonte de leitura das respostas dos formulários**, seguindo o fluxo:

```text
Google Forms PRÉ/PÓS -> planilha de respostas -> publicação CSV -> /api/sheets-proxy -> dashboard
```

Nesta versão, os formulários do Confiança **ainda não foram criados**. Portanto, `WELLNESS_PRE_SHEET_URL` e `WELLNESS_POST_SHEET_URL` estão intencionalmente vazias em `.env.local.example`. O código do módulo está presente, mas os dados só aparecerão depois da criação dos formulários e configuração dessas URLs.

O proxy aceita somente URLs públicas em `docs.google.com/spreadsheets/` e retorna `503` com mensagem de configuração ausente enquanto a variável correspondente não estiver definida.

## 8. Transfermarkt / scraping

Scraping deve ser tratado como **best effort**. Não pode ser dependência única de uma função crítica sem fallback porque:

- HTML pode mudar;
- bloqueios podem ocorrer;
- latência pode variar;
- termos do site podem restringir usos.

A classificação principal do produto não deve ficar presa a um scraper quando existe provider estruturado disponível.

## 9. Sportmonks

A integração Sportmonks foi removida na limpeza porque não estava sendo utilizada no fluxo efetivo. Permanecer com token, código e fallback de uma API sem consumidor aumenta superfície de configuração, custo cognitivo e risco de credencial sem entregar valor.

O calendário atual está consolidado no provider ESPN. Se no futuro Sportmonks ou outro provider for contratado, deve entrar novamente como adapter explícito e com decisão documentada.

## 10. Timeouts, retries e degradação

Toda integração externa crítica deve evoluir para padrão comum:

- timeout explícito;
- tratamento de HTTP status;
- retry apenas quando seguro;
- backoff em falhas transitórias;
- logs com provider e request id;
- cache quando apropriado;
- última carga válida persistida;
- UI informando data da atualização.

A regra de produto é: **indisponibilidade de provider não deve apagar a última informação válida já persistida**.
