# 10 · Padrão de Código e Documentação

## 1. Objetivo

O código deve ser legível por alguém que não participou da criação original. O padrão abaixo serve para desenvolvimento, manutenção e continuidade do projeto.

## 2. Organização

### UI

```text
app/<dominio>/page.js
app/components/<dominio>/...
```

### API

```text
app/api/<dominio>/route.js
app/api/<dominio>/[id]/route.js
```

### Domínio compartilhado

```text
lib/<dominio>.js
```

### Provider externo

```text
lib/providers/<provider>.js
```

### Parser/regra de dataset

```text
data/<provider-ou-regra>.js
```

## 3. Nomeação

- nomes devem representar o domínio atual;
- nomes de providers permanecem explícitos quando representam origem real;
- `club`/`ownClub` para representar o clube atual;
- `provider` para origem de dados;


## 4. Funções

Uma função deve ter responsabilidade identificável. Quando o contrato não for óbvio, documentar:

```js
/**
 * Busca e normaliza eventos da Série C do provider público.
 *
 * @param {string} dateRange - YYYYMMDD-YYYYMMDD.
 * @returns {Promise<Array<NormalizedMatch>>}
 * @throws {Error} Quando o provider responde fora de 2xx/timeout.
 */
async function fetchEvents(dateRange) { ... }
```

Comentários devem explicar **por quê**, não repetir o código.

Ruim:

```js
// incrementa i
i++
```

Bom:

```js
// Mantemos um ID interno porque os providers não compartilham a mesma identidade de atleta.
```

## 5. Route Handler

Estrutura preferida:

```js
export async function POST(request, context) {
  try {
    const input = await parseInput(request)
    const validated = validateInput(input)
    const result = await service(validated)
    return Response.json(result)
  } catch (error) {
    console.error('[dominio/action]', error)
    return Response.json({ error: safeMessage(error) }, { status: 500 })
  }
}
```

Não colocar uma regra analítica de centenas de linhas dentro da rota se ela for reutilizável/testável separadamente.

## 6. Providers

Não espalhar URLs e mapeamentos do mesmo provider por várias telas.

Adapter ideal:

```text
provider raw response
      ↓
validate
      ↓
normalize
      ↓
internal contract
```

A UI nunca deve depender de um detalhe instável do JSON externo se o domínio puder abstraí-lo.

## 7. Banco

Nova funcionalidade comercial deve evitar `CREATE TABLE` dentro de cada request. Após adoção de migrations:

- migration cria/transforma schema;
- código assume schema da versão;
- constraints ficam no banco;
- índices são explícitos;
- queries parametrizadas;
- transação quando várias escritas precisam ser atômicas.

## 8. Dados externos

Todo registro derivado deve, quando possível, preservar:

- provider;
- upload timestamp;
- league/season;
- source id/key;
- transformation version.

Isso permite auditar por que o dashboard mostrou determinado valor.

## 9. Matching

Nunca usar nome puro como identidade global quando houver alternativa.

Ordem conceitual:

1. provider ID quando comparando dentro da mesma fonte;
2. chave canônica interna;
3. nascimento + nome normalizado;
4. atributos auxiliares;
5. score/confiança;
6. revisão manual para ambiguidade.

## 10. Erros

Separar:

- erro de validação → 400;
- não autenticado → 401;
- não autorizado → 403;
- não encontrado → 404;
- conflito → 409 quando apropriado;
- provider indisponível → 502/503 quando apropriado;
- erro interno → 500.

Não devolver stack trace/secret ao cliente.

## 11. Git

Fluxo recomendado:

```text
main
 └── feature/<nome>
      └── commits pequenos e descritivos
```

PR deve responder:

- o que mudou;
- por quê;
- risco;
- como testar;
- alteração de schema;
- alteração de env;
- documentação afetada.

## 12. Definition of Done

Uma feature não está pronta apenas porque “abre na tela”. Para fluxos relevantes:

- regra validada;
- estados de erro tratados;
- autorização verificada;
- persistência segura;
- comportamento repetido/idempotente avaliado;
- documentação atualizada;
- teste manual/automatizado registrado;
- sem secret/log indevido.
