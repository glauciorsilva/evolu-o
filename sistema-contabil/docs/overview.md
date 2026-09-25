# Sistema Contábil de Estudo — registro do projeto

**Resumo:** sistema de contabilidade online para estudar escrituração contábil (plano de
contas, partidas dobradas, livros e demonstrações), com banco público no GitHub e banco
privado no Firebase.

- **Tipo:** projeto de código (sistema web) com finalidade de estudo.
- **Aliases:** sistema contábil, contabilidade online, sistema de contabilidade, evolu-o/sistema-contabil.
- **Pessoas:** Glaucio Rafael (autor e estudante).
- **Repositório:** `glauciorsilva/evolu-o`, pasta `sistema-contabil/`.
- **Referência de mercado:** fluxo do módulo de escrituração do Domínio Contábil (Thomson Reuters).

## Estado atual (v0.1.0 — 25/09/2026)

- Núcleo contábil completo e testado (`js/core/contabil.js`, 10 testes).
- Telas: Painel, Empresas, Plano de Contas, Lançamentos, Diário, Razão, Balancete, DRE,
  Balanço, Exercícios e Estudos.
- Banco público com 133 contas, 15 históricos, empresa de exemplo, 10 exercícios e 5
  registros de estudo.
- Banco privado: adaptador Firebase e regras do Firestore prontos; **falta criar o projeto
  no console do Firebase** e preencher `js/firebase-config.js`.

## O que falta / próximos passos

- [ ] Criar o projeto Firebase, preencher a configuração e publicar as regras.
- [ ] Publicar o sistema (Firebase Hosting ou GitHub Pages).
- [ ] Relatório de razão/balancete em PDF.
- [ ] Importação de extrato bancário (OFX/CSV) para gerar lançamentos.
- [ ] Lançamentos com centro de custo.
- [ ] Testes das regras do Firestore com o emulador.
