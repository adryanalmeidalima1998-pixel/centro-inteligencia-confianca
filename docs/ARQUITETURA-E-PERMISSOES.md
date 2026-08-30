# Arquitetura e permissões

## Entrada única

`/` é a Home do Centro de Inteligência. Ela oferece dois ambientes:

- `/corpo-tecnico`
- `/scouting`

O login é único via NextAuth e cada sessão carrega `modules` e `readOnly`.

## Proteção real de rotas

O `middleware.js` protege páginas e APIs, não apenas os botões da interface.

- usuário Corpo Técnico: acessa rotas e APIs do módulo Corpo Técnico;
- usuário Scouting: acessa o CIG/mercado;
- administrador: ambos;
- diretoria: ambos, mas métodos POST/PUT/PATCH/DELETE são bloqueados.

O `AppShell` também bloqueia escrita no navegador para perfis somente leitura, enquanto o middleware repete a proteção no servidor.

## Banco

O projeto unificado deve ser publicado sobre um banco novo do Confiança.

A tabela de elenco do Corpo Técnico foi isolada como `confianca_squad`. Nomes internos legados de outras tabelas foram preservados para não quebrar consultas, relatórios e uploads herdados.

## Contexto esportivo

- Série C 2026: histórico de equipe, jogos e relatórios.
- Mercado: planejamento 2027, Série D, objetivo de acesso à Série C.
