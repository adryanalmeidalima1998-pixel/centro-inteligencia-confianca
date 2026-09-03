# ADR-002 · Isolar providers externos atrás de adaptadores

**Status:** aceito; implementação progressiva.

## Contexto

APIs públicas, scrapers e exports de fornecedores mudam formato e disponibilidade. Espalhar o contrato bruto pelas telas aumenta custo de troca.

## Decisão

Normalizar provider em camada dedicada antes de entregar ao domínio. Novas integrações HTTP estruturadas devem preferir `lib/providers/`.

## Exemplo aplicado

`lib/providers/espn-serie-c.js` concentra URL, timeout, parsing e normalização do calendário/classificação.

## Consequência

Trocar provider deixa de exigir reescrever todas as telas consumidoras, desde que o contrato interno seja preservado.
