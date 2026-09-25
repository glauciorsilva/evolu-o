// Núcleo contábil: regras de partidas dobradas, saldos e demonstrações.
// Este arquivo não depende de navegador nem de banco de dados, então pode
// ser testado com `node --test` e reaproveitado em qualquer interface.
//
// Convenções:
// - Valores monetários são sempre inteiros em CENTAVOS (evita erro de ponto flutuante).
// - Código de conta hierárquico separado por ponto: "1.1.1.01".
// - Natureza: "D" (devedora) ou "C" (credora).
// - Tipo: "S" (sintética, agrupa outras) ou "A" (analítica, recebe lançamentos).

export const GRUPOS = {
  1: { nome: 'Ativo', natureza: 'D' },
  2: { nome: 'Passivo', natureza: 'C' },
  3: { nome: 'Patrimônio Líquido', natureza: 'C' },
  4: { nome: 'Receitas', natureza: 'C' },
  5: { nome: 'Custos', natureza: 'D' },
  6: { nome: 'Despesas', natureza: 'D' },
};

// Contas de resultado são encerradas no fim do exercício.
export const GRUPOS_RESULTADO = ['4', '5', '6'];

// Estrutura da DRE para o plano de contas padrão.
// Cada linha soma o "valor credor líquido" (créditos - débitos) dos prefixos,
// então receitas aparecem positivas e custos/despesas negativos.
export const ESTRUTURA_DRE = [
  { id: 'rb', nome: 'Receita Operacional Bruta', prefixos: ['4.1'] },
  { id: 'ded', nome: '(-) Deduções da Receita Bruta', prefixos: ['4.2'] },
  { id: 'rl', nome: '= Receita Operacional Líquida', soma: ['rb', 'ded'], destaque: true },
  { id: 'cus', nome: '(-) Custo das Vendas e Serviços', prefixos: ['5'] },
  { id: 'lb', nome: '= Lucro Bruto', soma: ['rl', 'cus'], destaque: true },
  { id: 'dop', nome: '(-) Despesas Operacionais', prefixos: ['6.1'] },
  { id: 'rf', nome: '(+) Receitas Financeiras e Outras', prefixos: ['4.3'] },
  { id: 'df', nome: '(-) Despesas Financeiras', prefixos: ['6.2'] },
  { id: 'rai', nome: '= Resultado antes do IRPJ e CSLL', soma: ['lb', 'dop', 'rf', 'df'], destaque: true },
  { id: 'ir', nome: '(-) IRPJ e CSLL', prefixos: ['6.3'] },
  { id: 'rll', nome: '= Resultado Líquido do Exercício', soma: ['rai', 'ir'], destaque: true },
];

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

/**
 * Converte texto digitado em centavos: "1.234,56", "15.000", "1234.56", "10".
 * Sem vírgula, o ponto só é decimal se tiver 1 ou 2 dígitos depois ("1234.5");
 * caso contrário é separador de milhar, como se escreve no Brasil ("15.000").
 */
export function paraCentavos(valor) {
  if (typeof valor === 'number') return Math.round(valor * 100);
  let texto = String(valor ?? '').trim().replace(/\s|R\$/g, '');
  if (!texto) return NaN;
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  else if (!/^-?\d+\.\d{1,2}$/.test(texto)) texto = texto.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return NaN;
  return Math.round(Number(texto) * 100);
}

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatarMoeda(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos || 0));
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cent = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}R$ ${reais},${cent}`;
}

// ---------------------------------------------------------------------------
// Plano de contas
// ---------------------------------------------------------------------------

export function grupoDaConta(codigo) {
  return String(codigo).split('.')[0];
}

export function nivelDaConta(codigo) {
  return String(codigo).split('.').length;
}

export function codigoPai(codigo) {
  const partes = String(codigo).split('.');
  return partes.length > 1 ? partes.slice(0, -1).join('.') : null;
}

/** true se `codigo` for a própria conta `prefixo` ou uma subconta dela. */
export function pertenceA(codigo, prefixo) {
  return codigo === prefixo || codigo.startsWith(prefixo + '.');
}

/** Compara códigos numericamente por nível ("1.10" vem depois de "1.9"). */
export function compararCodigos(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function ordenarContas(contas) {
  return [...contas].sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

/** Valida uma conta nova/editada em relação ao plano existente. Retorna lista de erros. */
export function validarConta(conta, plano) {
  const erros = [];
  if (!/^\d+(\.\d+)*$/.test(conta.codigo || '')) erros.push('Código inválido. Use números separados por ponto, ex.: 1.1.1.01');
  if (!conta.nome || !conta.nome.trim()) erros.push('Informe o nome da conta.');
  if (!['S', 'A'].includes(conta.tipo)) erros.push('Tipo deve ser S (sintética) ou A (analítica).');
  if (!['D', 'C'].includes(conta.natureza)) erros.push('Natureza deve ser D (devedora) ou C (credora).');
  if (erros.length) return erros;

  if (!GRUPOS[grupoDaConta(conta.codigo)]) erros.push('O primeiro dígito deve ser um grupo de 1 a 6.');
  const pai = codigoPai(conta.codigo);
  if (pai) {
    const contaPai = plano.find((c) => c.codigo === pai);
    if (!contaPai) erros.push(`A conta superior ${pai} não existe.`);
    else if (contaPai.tipo !== 'S') erros.push(`A conta superior ${pai} é analítica; só contas sintéticas podem ter subcontas.`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Lançamentos (partidas dobradas)
// ---------------------------------------------------------------------------

export function totalPartidas(partidas, tipo) {
  return partidas.filter((p) => p.tipo === tipo).reduce((s, p) => s + p.valor, 0);
}

/**
 * Valida um lançamento. Regras:
 * - data no formato AAAA-MM-DD e histórico preenchido;
 * - pelo menos uma partida a débito e uma a crédito;
 * - valores inteiros positivos (centavos);
 * - contas existentes, analíticas e ativas;
 * - soma dos débitos = soma dos créditos (método das partidas dobradas).
 */
export function validarLancamento(lancamento, plano) {
  const erros = [];
  const porCodigo = new Map(plano.map((c) => [c.codigo, c]));
  const { data, historico, partidas = [] } = lancamento;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || Number.isNaN(Date.parse(data))) erros.push('Data inválida.');
  if (!historico || !historico.trim()) erros.push('Informe o histórico do lançamento.');
  if (!partidas.some((p) => p.tipo === 'D')) erros.push('É necessário pelo menos um débito.');
  if (!partidas.some((p) => p.tipo === 'C')) erros.push('É necessário pelo menos um crédito.');

  partidas.forEach((p, i) => {
    const n = i + 1;
    const conta = porCodigo.get(p.conta);
    if (!conta) erros.push(`Partida ${n}: conta ${p.conta || '(vazia)'} não existe.`);
    else if (conta.tipo !== 'A') erros.push(`Partida ${n}: ${conta.codigo} é sintética; lance em uma conta analítica.`);
    else if (conta.ativa === false) erros.push(`Partida ${n}: ${conta.codigo} está inativa.`);
    if (!['D', 'C'].includes(p.tipo)) erros.push(`Partida ${n}: tipo deve ser D ou C.`);
    if (!Number.isInteger(p.valor) || p.valor <= 0) erros.push(`Partida ${n}: valor deve ser maior que zero.`);
  });

  const debitos = totalPartidas(partidas, 'D');
  const creditos = totalPartidas(partidas, 'C');
  if (debitos !== creditos) {
    erros.push(`Débitos (${formatarMoeda(debitos)}) diferentes dos créditos (${formatarMoeda(creditos)}).`);
  }
  return erros;
}

/** Classifica a fórmula do lançamento, como se estuda em sala. */
export function formulaDoLancamento(partidas) {
  const d = partidas.filter((p) => p.tipo === 'D').length;
  const c = partidas.filter((p) => p.tipo === 'C').length;
  if (d === 1 && c === 1) return '1ª fórmula (1 débito e 1 crédito)';
  if (d === 1) return '2ª fórmula (1 débito e vários créditos)';
  if (c === 1) return '3ª fórmula (vários débitos e 1 crédito)';
  return '4ª fórmula (vários débitos e vários créditos)';
}

export function ordenarLancamentos(lancamentos) {
  return [...lancamentos].sort((a, b) => a.data.localeCompare(b.data) || (a.numero || 0) - (b.numero || 0));
}

function dentroDoPeriodo(data, inicio, fim) {
  return (!inicio || data >= inicio) && (!fim || data <= fim);
}

// ---------------------------------------------------------------------------
// Saldos, razão e balancete
// ---------------------------------------------------------------------------

/** Aplica a natureza: devedora = D - C; credora = C - D. */
export function saldoPelaNatureza(natureza, debitos, creditos) {
  return natureza === 'D' ? debitos - creditos : creditos - debitos;
}

/** Soma débitos e créditos de uma conta (e subcontas) dentro de um período. */
export function movimentoDaConta(codigo, lancamentos, { inicio, fim, ignorarEncerramento = false } = {}) {
  let debitos = 0;
  let creditos = 0;
  for (const l of lancamentos) {
    if (!dentroDoPeriodo(l.data, inicio, fim)) continue;
    if (ignorarEncerramento && l.tipo === 'encerramento') continue;
    for (const p of l.partidas) {
      if (!pertenceA(p.conta, codigo)) continue;
      if (p.tipo === 'D') debitos += p.valor;
      else creditos += p.valor;
    }
  }
  return { debitos, creditos };
}

/** Livro Razão: movimentos de uma conta com saldo acumulado. */
export function razao(conta, lancamentos, { inicio, fim } = {}) {
  const anterior = inicio ? movimentoDaConta(conta.codigo, lancamentos, { fim: anteriorA(inicio) }) : { debitos: 0, creditos: 0 };
  const saldoAnterior = saldoPelaNatureza(conta.natureza, anterior.debitos, anterior.creditos);
  let saldo = saldoAnterior;
  const linhas = [];
  for (const l of ordenarLancamentos(lancamentos)) {
    if (!dentroDoPeriodo(l.data, inicio, fim)) continue;
    for (const p of l.partidas) {
      if (!pertenceA(p.conta, conta.codigo)) continue;
      const debito = p.tipo === 'D' ? p.valor : 0;
      const credito = p.tipo === 'C' ? p.valor : 0;
      saldo += saldoPelaNatureza(conta.natureza, debito, credito);
      const contrapartidas = l.partidas.filter((x) => x.tipo !== p.tipo).map((x) => x.conta);
      linhas.push({ data: l.data, numero: l.numero, historico: l.historico, conta: p.conta, contrapartidas, debito, credito, saldo });
    }
  }
  return { saldoAnterior, linhas, saldoFinal: saldo };
}

/**
 * Balancete de verificação: para cada conta (sintéticas somam as subcontas),
 * saldo anterior, débitos e créditos do período e saldo atual.
 * Saldos são "com sinal" pela natureza da conta; `indicador` diz se o saldo
 * final está devedor (D) ou credor (C).
 */
export function balancete(plano, lancamentos, { inicio, fim, somenteComMovimento = true } = {}) {
  const linhas = [];
  for (const conta of ordenarContas(plano)) {
    const ant = inicio ? movimentoDaConta(conta.codigo, lancamentos, { fim: anteriorA(inicio) }) : { debitos: 0, creditos: 0 };
    const mov = movimentoDaConta(conta.codigo, lancamentos, { inicio, fim });
    const saldoAnterior = saldoPelaNatureza(conta.natureza, ant.debitos, ant.creditos);
    const saldoAtual = saldoAnterior + saldoPelaNatureza(conta.natureza, mov.debitos, mov.creditos);
    if (somenteComMovimento && !saldoAnterior && !mov.debitos && !mov.creditos) continue;
    const devedor = conta.natureza === 'D' ? saldoAtual >= 0 : saldoAtual < 0;
    linhas.push({
      ...conta,
      nivel: nivelDaConta(conta.codigo),
      saldoAnterior,
      debitos: mov.debitos,
      creditos: mov.creditos,
      saldoAtual,
      indicador: saldoAtual === 0 ? '' : devedor ? 'D' : 'C',
    });
  }

  // Totais só das analíticas (as sintéticas já são somas delas).
  const analiticas = linhas.filter((l) => l.tipo === 'A');
  const totalDebitos = analiticas.reduce((s, l) => s + l.debitos, 0);
  const totalCreditos = analiticas.reduce((s, l) => s + l.creditos, 0);
  const saldosDevedores = analiticas.filter((l) => l.indicador === 'D').reduce((s, l) => s + Math.abs(l.saldoAtual), 0);
  const saldosCredores = analiticas.filter((l) => l.indicador === 'C').reduce((s, l) => s + Math.abs(l.saldoAtual), 0);
  return {
    linhas,
    totalDebitos,
    totalCreditos,
    saldosDevedores,
    saldosCredores,
    fechado: totalDebitos === totalCreditos && saldosDevedores === saldosCredores,
  };
}

function anteriorA(data) {
  return new Date(Date.parse(data) - 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Demonstrações: DRE e Balanço Patrimonial
// ---------------------------------------------------------------------------

function valorCredor(prefixo, lancamentos, opcoes) {
  const { debitos, creditos } = movimentoDaConta(prefixo, lancamentos, opcoes);
  return creditos - debitos;
}

/**
 * Demonstração do Resultado do Exercício no período.
 * Ignora lançamentos de encerramento, senão o resultado apareceria zerado.
 */
export function dre(lancamentos, { inicio, fim, estrutura = ESTRUTURA_DRE } = {}) {
  const valores = {};
  const linhas = estrutura.map((linha) => {
    let valor;
    if (linha.prefixos) {
      valor = linha.prefixos.reduce((s, p) => s + valorCredor(p, lancamentos, { inicio, fim, ignorarEncerramento: true }), 0);
    } else {
      valor = linha.soma.reduce((s, id) => s + valores[id], 0);
    }
    valores[linha.id] = valor;
    return { ...linha, valor };
  });
  return { linhas, resultado: valores[estrutura[estrutura.length - 1].id] };
}

/** Resultado ainda não transferido para o PL (zero depois do encerramento). */
export function resultadoNaoEncerrado(lancamentos, { fim } = {}) {
  return GRUPOS_RESULTADO.reduce((s, g) => s + valorCredor(g, lancamentos, { fim }), 0);
}

/**
 * Balanço Patrimonial na data `fim`.
 * Valores seguem a natureza do grupo (Ativo devedor, Passivo/PL credor);
 * contas retificadoras aparecem negativas.
 */
export function balancoPatrimonial(plano, lancamentos, { fim, nivelMaximo = 3 } = {}) {
  const montar = (grupo) => {
    const natureza = GRUPOS[grupo].natureza;
    return ordenarContas(plano)
      .filter((c) => grupoDaConta(c.codigo) === grupo && nivelDaConta(c.codigo) <= nivelMaximo)
      .map((c) => {
        const { debitos, creditos } = movimentoDaConta(c.codigo, lancamentos, { fim });
        return { codigo: c.codigo, nome: c.nome, nivel: nivelDaConta(c.codigo), valor: saldoPelaNatureza(natureza, debitos, creditos) };
      })
      .filter((l) => l.valor !== 0);
  };
  const total = (grupo) => {
    const { debitos, creditos } = movimentoDaConta(grupo, lancamentos, { fim });
    return saldoPelaNatureza(GRUPOS[grupo].natureza, debitos, creditos);
  };

  const resultado = resultadoNaoEncerrado(lancamentos, { fim });
  const totalAtivo = total('1');
  const totalPassivo = total('2');
  const totalPL = total('3') + resultado;
  return {
    ativo: montar('1'),
    passivo: montar('2'),
    patrimonioLiquido: montar('3'),
    resultadoNaoEncerrado: resultado,
    totalAtivo,
    totalPassivo,
    totalPL,
    totalPassivoMaisPL: totalPassivo + totalPL,
    fechado: totalAtivo === totalPassivo + totalPL,
  };
}

/**
 * Gera o lançamento de encerramento do exercício: zera as contas de
 * resultado (grupos 4, 5 e 6) e transfere o saldo para o PL
 * (Lucros ou Prejuízos Acumulados). Retorna null se não houver saldo.
 */
export function gerarEncerramento(plano, lancamentos, { data, contaLucros = '3.3.1.01', contaPrejuizos = '3.3.1.02' }) {
  const partidas = [];
  const analiticasResultado = ordenarContas(plano).filter((c) => c.tipo === 'A' && GRUPOS_RESULTADO.includes(grupoDaConta(c.codigo)));
  for (const conta of analiticasResultado) {
    const { debitos, creditos } = movimentoDaConta(conta.codigo, lancamentos, { fim: data });
    const saldo = debitos - creditos; // positivo = saldo devedor
    if (saldo > 0) partidas.push({ conta: conta.codigo, tipo: 'C', valor: saldo });
    if (saldo < 0) partidas.push({ conta: conta.codigo, tipo: 'D', valor: -saldo });
  }
  if (!partidas.length) return null;

  const diferenca = totalPartidas(partidas, 'D') - totalPartidas(partidas, 'C');
  if (diferenca > 0) partidas.push({ conta: contaLucros, tipo: 'C', valor: diferenca });
  if (diferenca < 0) partidas.push({ conta: contaPrejuizos, tipo: 'D', valor: -diferenca });

  return {
    data,
    tipo: 'encerramento',
    historico: diferenca >= 0
      ? 'Encerramento do exercício - apuração de lucro transferido para Lucros Acumulados'
      : 'Encerramento do exercício - apuração de prejuízo transferido para Prejuízos Acumulados',
    partidas,
  };
}

export function proximoNumero(lancamentos) {
  return lancamentos.reduce((m, l) => Math.max(m, l.numero || 0), 0) + 1;
}
