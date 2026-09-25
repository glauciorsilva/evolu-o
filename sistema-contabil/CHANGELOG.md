# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [0.1.0] - 2026-09-25

### Adicionado
- Núcleo contábil: partidas dobradas, razão, balancete, DRE, balanço e encerramento do exercício.
- Telas de empresas, plano de contas, lançamentos, diário, razão, balancete, DRE, balanço,
  exercícios e registro de estudos.
- Banco público (`dados-publicos/`): plano de contas padrão, históricos, empresa de
  exemplo, exercícios e registro de estudos.
- Banco privado no Firebase (Firestore + Auth) com regras de acesso por usuário; modo
  local quando o Firebase não está configurado.
- Backup e importação de empresas em JSON.
- Testes do núcleo e validação do banco público no GitHub Actions.
