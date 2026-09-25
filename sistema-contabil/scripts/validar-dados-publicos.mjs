// Valida o "banco público" (JSON versionado no GitHub) antes de cada commit/CI.
// Uso: node scripts/validar-dados-publicos.mjs
import { readFileSync } from 'node:fs';
import { validarConta, validarLancamento, ordenarContas } from '../js/core/contabil.js';

const ler = (nome) => JSON.parse(readFileSync(new URL(`../dados-publicos/${nome}`, import.meta.url), 'utf8'));
const erros = [];

const { contas } = ler('plano-de-contas.json');
const vistos = new Set();
const aceitas = [];
for (const conta of ordenarContas(contas)) {
  if (vistos.has(conta.codigo)) erros.push(`Plano: código duplicado ${conta.codigo}`);
  vistos.add(conta.codigo);
  for (const e of validarConta(conta, aceitas)) erros.push(`Plano ${conta.codigo}: ${e}`);
  aceitas.push(conta);
}

for (const l of ler('empresa-exemplo.json').lancamentos) {
  for (const e of validarLancamento(l, contas)) erros.push(`Exemplo nº ${l.numero}: ${e}`);
}
for (const ex of ler('exercicios.json').exercicios) {
  const l = { data: '2026-01-01', historico: ex.enunciado, partidas: ex.partidas };
  for (const e of validarLancamento(l, contas)) erros.push(`Exercício ${ex.id}: ${e}`);
}
const ids = ler('estudos.json').estudos.map((e) => e.id);
if (new Set(ids).size !== ids.length) erros.push('Estudos: ids duplicados');
ler('historicos-padrao.json');

if (erros.length) {
  console.error(erros.join('\n'));
  process.exit(1);
}
console.log(`Dados públicos válidos: ${contas.length} contas, exemplos e exercícios balanceados.`);
