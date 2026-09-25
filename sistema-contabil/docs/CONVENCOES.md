# Convenções técnicas

## Stack (decidida em 25/09/2026)

- **Front-end:** HTML + CSS + JavaScript puro em módulos ES, **sem build step**.
  Escolhido no lugar do padrão React-via-CDN porque o núcleo contábil precisa rodar
  também no Node para os testes (`node --test`), e módulos ES funcionam nos dois lados
  sem Babel.
- **Banco privado:** Firebase (Cloud Firestore + Authentication), SDK modular 10.12.2
  carregado do CDN `gstatic.com` só quando configurado.
- **Banco público:** arquivos JSON em `dados-publicos/`, versionados no Git.
- **Testes/CI:** `node --test` + `scripts/validar-dados-publicos.mjs` no GitHub Actions (Node 22).

## Regras de código

- Toda regra contábil fica em `js/core/contabil.js` (funções puras, sem DOM nem banco).
- Dinheiro sempre em **centavos inteiros**; formatar só na tela (`formatarMoeda`).
- Datas em ISO `AAAA-MM-DD`; exibição em `DD/MM/AAAA`.
- Nomes de funções, variáveis e arquivos em português.
- Toda escrita de texto do usuário no HTML passa por `esc()`.
- Os dois adaptadores de dados (`armazenamento-local.js`, `armazenamento-firebase.js`)
  têm o mesmo contrato; a interface não sabe qual está em uso.

## Visual

- Cores definidas como variáveis em `:root`, com tema escuro automático.
- Primária `#1f5fa8`; positivo `#1b7a45`; negativo `#b3261e`.
- Layout responsivo com margem lateral de 16px; tabelas largas rolam na horizontal.

## Git

- Commits no padrão convencional: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Mudanças no banco público entram por commit/PR e devem passar em `npm run validar`.
- Registrar cada versão no `CHANGELOG.md`.
