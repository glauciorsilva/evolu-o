import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  paraCentavos, formatarMoeda, compararCodigos, validarConta, validarLancamento,
  formulaDoLancamento, razao, balancete, dre, balancoPatrimonial, gerarEncerramento,
  proximoNumero,
} from '../js/core/contabil.js';

const ler = (nome) => JSON.parse(readFileSync(new URL(`../dados-publicos/${nome}`, import.meta.url), 'utf8'));
const plano = ler('plano-de-contas.json').contas;
const exemplo = ler('empresa-exemplo.json').lancamentos;
const conta = (codigo) => plano.find((c) => c.codigo === codigo);

test('converte e formata dinheiro em centavos', () => {
  assert.equal(paraCentavos('1.234,56'), 123456);
  assert.equal(paraCentavos('1234.56'), 123456);
  assert.equal(paraCentavos('R$ 10'), 1000);
  assert.equal(paraCentavos('15.000'), 1500000);
  assert.equal(paraCentavos(0.1 + 0.2), 30);
  assert.ok(Number.isNaN(paraCentavos('abc')));
  assert.equal(formatarMoeda(123456789), 'R$ 1.234.567,89');
  assert.equal(formatarMoeda(-5), '-R$ 0,05');
});

test('ordena códigos numericamente por nível', () => {
  assert.ok(compararCodigos('1.10', '1.9') > 0);
  assert.ok(compararCodigos('1', '1.1') < 0);
});

test('valida hierarquia do plano de contas', () => {
  assert.deepEqual(validarConta({ codigo: '1.1.1.99', nome: 'Caixa Filial', tipo: 'A', natureza: 'D' }, plano), []);
  assert.match(validarConta({ codigo: '1.1.1.01.01', nome: 'X', tipo: 'A', natureza: 'D' }, plano)[0], /analítica/);
  assert.match(validarConta({ codigo: '7', nome: 'X', tipo: 'S', natureza: 'D' }, plano)[0], /grupo/);
});

test('partidas dobradas: rejeita lançamento desbalanceado e conta sintética', () => {
  const base = { data: '2026-09-01', historico: 'Teste' };
  assert.deepEqual(validarLancamento({ ...base, partidas: [
    { conta: '1.1.1.01', tipo: 'D', valor: 100 }, { conta: '3.1.1.01', tipo: 'C', valor: 100 },
  ] }, plano), []);
  const desbalanceado = validarLancamento({ ...base, partidas: [
    { conta: '1.1.1.01', tipo: 'D', valor: 100 }, { conta: '3.1.1.01', tipo: 'C', valor: 90 },
  ] }, plano);
  assert.ok(desbalanceado.some((e) => /diferentes/.test(e)));
  const sintetica = validarLancamento({ ...base, partidas: [
    { conta: '1.1.1', tipo: 'D', valor: 100 }, { conta: '3.1.1.01', tipo: 'C', valor: 100 },
  ] }, plano);
  assert.ok(sintetica.some((e) => /sintética/.test(e)));
});

test('identifica as quatro fórmulas de lançamento', () => {
  const d = { tipo: 'D' }; const c = { tipo: 'C' };
  assert.match(formulaDoLancamento([d, c]), /1ª/);
  assert.match(formulaDoLancamento([d, c, c]), /2ª/);
  assert.match(formulaDoLancamento([d, d, c]), /3ª/);
  assert.match(formulaDoLancamento([d, d, c, c]), /4ª/);
});

test('razão do banco acumula saldo pela natureza devedora', () => {
  const r = razao(conta('1.1.1.02'), exemplo);
  // 50.000 - 8.000 - 2.500 - 9.800 + 4.000 - 45
  assert.equal(r.saldoFinal, paraCentavos('33.655,00'));
  assert.equal(r.linhas.length, 6);
});

test('balancete fecha: débitos = créditos e saldos devedores = credores', () => {
  const b = balancete(plano, exemplo);
  assert.ok(b.fechado);
  assert.equal(b.totalDebitos, b.totalCreditos);
  const ativo = b.linhas.find((l) => l.codigo === '1');
  assert.equal(ativo.indicador, 'D');
});

test('DRE do mês de exemplo apura prejuízo de R$ 901,67', () => {
  const r = dre(exemplo);
  const linha = (id) => r.linhas.find((l) => l.id === id).valor;
  assert.equal(linha('rb'), paraCentavos('15.000'));
  assert.equal(linha('rl'), paraCentavos('14.100'));
  assert.equal(linha('lb'), paraCentavos('5.100'));
  assert.equal(r.resultado, -paraCentavos('901,67'));
});

test('balanço fecha antes e depois do encerramento, e a DRE não muda', () => {
  const antes = balancoPatrimonial(plano, exemplo, { fim: '2026-09-30' });
  assert.ok(antes.fechado);
  assert.equal(antes.resultadoNaoEncerrado, -paraCentavos('901,67'));

  const enc = gerarEncerramento(plano, exemplo, { data: '2026-09-30' });
  assert.deepEqual(validarLancamento(enc, plano), []);
  assert.ok(enc.partidas.some((p) => p.conta === '3.3.1.02' && p.tipo === 'D' && p.valor === 90167));

  const depois = [...exemplo, { ...enc, numero: proximoNumero(exemplo) }];
  const bal = balancoPatrimonial(plano, depois, { fim: '2026-09-30' });
  assert.ok(bal.fechado);
  assert.equal(bal.resultadoNaoEncerrado, 0);
  assert.equal(bal.totalAtivo, antes.totalAtivo);
  assert.equal(dre(depois).resultado, dre(exemplo).resultado);
  assert.equal(gerarEncerramento(plano, depois, { data: '2026-09-30' }), null);
});

test('período: saldo anterior entra no balancete', () => {
  const b = balancete(plano, exemplo, { inicio: '2026-09-10', fim: '2026-09-30' });
  const banco = b.linhas.find((l) => l.codigo === '1.1.1.02');
  assert.equal(banco.saldoAnterior, paraCentavos('39.500'));
  assert.ok(b.fechado);
});
