# ADR-001 · Manter monólito modular como baseline

**Status:** aceito para baseline atual.

## Contexto

A aplicação combina dezenas de funcionalidades de scouting e performance em Next.js. Separar frontend/backend em serviços independentes adicionaria autenticação entre serviços, contratos de rede, deploys e observabilidade adicionais antes de existir um gargalo que justifique o custo.

## Decisão

Manter Next.js como monólito modular no estado atual. Separar domínios internamente e extrair serviço apenas quando houver requisito operacional mensurado.

## Consequências

Positivas:

- deploy simples;
- compartilhamento de domínio;
- menor custo operacional;
- velocidade de produto.

Negativas:

- exige disciplina de módulos;
- workloads pesados não devem bloquear request;
- tamanho do deploy cresce.

## Revisar quando

- job pesado exigir runtime próprio;
- equipe/domínio possuir ciclo independente;
- falha de um domínio impactar outros de forma inaceitável;
- escala demonstrar necessidade de separação.
