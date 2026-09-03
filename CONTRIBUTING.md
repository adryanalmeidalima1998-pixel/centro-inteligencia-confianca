# Contribuindo com o Centro de Inteligência

## 1. Objetivo

Mudanças devem preservar o core funcional e reduzir acoplamento sem refactor cosmético de alto risco. Alterações de arquitetura, dados, providers, autenticação ou contrato de API precisam atualizar a documentação correspondente.

## 2. Fluxo de branch

Sugestão simples:

```text
main
  └── feature/<descricao>
  └── fix/<descricao>
  └── refactor/<descricao>
```

Abrir PR pequeno o suficiente para revisão e rollback.

## 3. Antes do PR

```bash
npm run docs:all
npm run check:all
npm run build
```

Quando a mudança toca provider/banco, adicionar também smoke test do fluxo afetado em ambiente de teste.

## 4. Definição de pronto

Uma mudança está pronta quando:

- código está legível e sem secret;
- imports/checks passam;
- contrato novo tem compatibilidade ou migration definida;
- regra esportiva relevante está em domínio/documentação, não apenas em UI;
- nova variável de ambiente está no `.env.local.example`;
- arquitetura/roadmap/changelog foram atualizados quando aplicável;
- mudança de persistência possui migration/estratégia de backfill;
- mudança de provider possui comportamento de erro/fallback conhecido.

## 5. Padrão de Route Handler

Preferir:

```text
route.js
  -> autenticação/autorização global via middleware
  -> valida entrada
  -> chama serviço/repositório/provider
  -> converte resultado para HTTP
```

Evitar adicionar cálculo analítico grande diretamente dentro de `route.js` quando a lógica puder ser uma função pura testável.

## 6. Convenções de domínio

Use nomes `club*`/`is_club` para representar o próprio Confiança e mantenha nomes de outros clubes somente quando forem entidades reais da competição.

## 7. Segurança

Nunca enviar em commit:

- `.env.local`;
- token de provider;
- connection string real;
- dump de produção não autorizado;
- senha;
- documento médico/relatório interno sem autorização.

## 8. Documentação de função

Funções de integração ou regra não óbvia devem deixar claro:

- entrada;
- saída;
- side effects;
- erros/fallbacks;
- provider/origem;
- regra de domínio relevante.

Não documentar o óbvio linha por linha. Documentar **contrato e intenção**.
