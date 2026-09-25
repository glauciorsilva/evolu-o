// Interface do sistema contábil. Toda regra contábil vem de core/contabil.js;
// aqui ficam só telas, formulários e a escolha do banco (local ou Firebase).
import * as C from './core/contabil.js';
import { firebaseConfig, firebaseConfigurado } from './firebase-config.js';
import { criarArmazenamentoLocal } from './dados/armazenamento-local.js';
import { carregarPublico } from './dados/dados-publicos.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const moeda = C.formatarMoeda;
const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const hoje = () => new Date().toISOString().slice(0, 10);
const classeValor = (v) => (v < 0 ? 'negativo' : '');

const ano = new Date().getFullYear();
const estado = {
  store: null,
  empresas: [],
  empresaId: null,
  contas: [],
  lancamentos: [],
  historicos: [],
  periodo: { inicio: `${ano}-01-01`, fim: `${ano}-12-31` },
  rascunho: null, // lançamento em edição
  contaRazao: '1.1.1.02',
};

const VIEWS = {
  painel: { titulo: 'Painel', render: viewPainel },
  plano: { titulo: 'Plano de Contas', render: viewPlano, precisaEmpresa: true },
  lancamentos: { titulo: 'Lançamentos', render: viewLancamentos, precisaEmpresa: true },
  diario: { titulo: 'Diário', render: viewDiario, precisaEmpresa: true },
  razao: { titulo: 'Razão', render: viewRazao, precisaEmpresa: true },
  balancete: { titulo: 'Balancete', render: viewBalancete, precisaEmpresa: true },
  dre: { titulo: 'DRE', render: viewDre, precisaEmpresa: true },
  balanco: { titulo: 'Balanço', render: viewBalanco, precisaEmpresa: true },
  exercicios: { titulo: 'Exercícios', render: viewExercicios },
  estudos: { titulo: 'Estudos', render: viewEstudos },
  empresas: { titulo: 'Empresas', render: viewEmpresas },
};

// ---------------------------------------------------------------------------
// Inicialização e sessão
// ---------------------------------------------------------------------------

async function iniciar() {
  window.addEventListener('hashchange', render);
  try {
    estado.historicos = (await carregarPublico('historicos-padrao')).historicos;
  } catch (e) {
    avisar(`Aviso: ${e.message} Abra o sistema por um servidor (veja o README), não direto pelo arquivo.`, 'erro');
  }

  if (!firebaseConfigurado) {
    await usarArmazenamento(criarArmazenamentoLocal());
    return;
  }
  const fb = await import('./dados/armazenamento-firebase.js');
  await fb.observarUsuario(firebaseConfig, async (usuario) => {
    if (usuario) await usarArmazenamento(await fb.criarArmazenamentoFirebase(firebaseConfig, usuario));
    else telaLogin(fb);
  });
}

async function usarArmazenamento(store) {
  estado.store = store;
  estado.empresas = await store.listarEmpresas();
  let salvo = null;
  try { salvo = localStorage.getItem(`empresa:${store.usuario.uid}`); } catch { /* sem storage */ }
  const id = estado.empresas.some((e) => e.id === salvo) ? salvo : estado.empresas[0]?.id;
  if (id) await selecionarEmpresa(id);
  else render();
}

async function selecionarEmpresa(id) {
  estado.empresaId = id;
  try { localStorage.setItem(`empresa:${estado.store.usuario.uid}`, id); } catch { /* sem storage */ }
  await recarregarEmpresa();
}

async function recarregarEmpresa() {
  if (!estado.empresaId) {
    estado.contas = [];
    estado.lancamentos = [];
  } else {
    const [contas, lancamentos] = await Promise.all([
      estado.store.listarContas(estado.empresaId),
      estado.store.listarLancamentos(estado.empresaId),
    ]);
    estado.contas = C.ordenarContas(contas);
    estado.lancamentos = C.ordenarLancamentos(lancamentos);
  }
  render();
}

const empresaAtual = () => estado.empresas.find((e) => e.id === estado.empresaId);
const contaPorCodigo = (codigo) => estado.contas.find((c) => c.codigo === codigo);
const nomeConta = (codigo) => `${codigo} ${contaPorCodigo(codigo)?.nome ?? '(conta removida)'}`;

function telaLogin(fb) {
  estado.store = null;
  $('#topo-controles').innerHTML = '<span class="selo">Firebase: faça login</span>';
  $('#menu').innerHTML = '';
  $('#conteudo').innerHTML = `
    <section class="cartao login">
      <h1>Entrar</h1>
      <p class="subtitulo">Seus lançamentos ficam no banco privado (Firebase), visíveis só para você.</p>
      <form id="form-login">
        <label>E-mail <input name="email" type="email" required autocomplete="email"></label>
        <label>Senha <input name="senha" type="password" required minlength="6" autocomplete="current-password"></label>
        <button class="primario" name="acao" value="entrar">Entrar</button>
        <button name="acao" value="cadastrar">Criar conta</button>
        <button type="button" id="btn-google">Entrar com Google</button>
      </form>
    </section>`;
  const tratarErro = (e) => avisar(`Não foi possível entrar: ${e.code || e.message}`, 'erro');
  $('#form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const acao = ev.submitter?.value === 'cadastrar' ? fb.cadastrar : fb.entrar;
    acao(firebaseConfig, f.get('email'), f.get('senha')).catch(tratarErro);
  });
  $('#btn-google').addEventListener('click', () => fb.entrarComGoogle(firebaseConfig).catch(tratarErro));
}

// ---------------------------------------------------------------------------
// Estrutura da página
// ---------------------------------------------------------------------------

function rotaAtual() {
  const nome = location.hash.replace(/^#\/?/, '') || 'painel';
  return VIEWS[nome] ? nome : 'painel';
}

async function render() {
  if (!estado.store) return;
  const rota = rotaAtual();
  const empresa = empresaAtual();

  $('#topo-controles').innerHTML = `
    ${estado.empresas.length ? `<select id="sel-empresa" aria-label="Empresa">
      ${estado.empresas.map((e) => `<option value="${esc(e.id)}" ${e.id === estado.empresaId ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
    </select>` : ''}
    <span class="selo ${estado.store.modo === 'local' ? 'local' : ''}" title="${estado.store.modo === 'local' ? 'Configure js/firebase-config.js para usar o banco privado na nuvem' : ''}">
      ${estado.store.modo === 'local' ? 'Modo local' : 'Firebase'} · ${esc(estado.store.usuario.email)}
    </span>
    ${estado.store.modo === 'firebase' ? '<button id="btn-sair">Sair</button>' : ''}`;
  $('#sel-empresa')?.addEventListener('change', (ev) => selecionarEmpresa(ev.target.value));
  $('#btn-sair')?.addEventListener('click', () => estado.store.sair());

  $('#menu').innerHTML = Object.entries(VIEWS)
    .map(([id, v]) => `<a href="#/${id}" ${id === rota ? 'aria-current="page"' : ''}>${v.titulo}</a>`)
    .join('');

  const view = VIEWS[rota];
  document.title = `${view.titulo} · Sistema Contábil de Estudo`;
  const conteudo = $('#conteudo');
  if (view.precisaEmpresa && !empresa) {
    conteudo.innerHTML = `<section class="cartao"><h1>${view.titulo}</h1>
      <p>Cadastre ou selecione uma empresa primeiro.</p><a href="#/empresas">Ir para Empresas</a></section>`;
    return;
  }
  // Contêiner novo a cada render, para os listeners da tela anterior não se acumularem.
  const alvo = document.createElement('div');
  conteudo.replaceChildren(alvo);
  try {
    await view.render(alvo, empresa);
  } catch (e) {
    console.error(e);
    alvo.innerHTML = `<section class="cartao"><h1>Erro</h1><p>${esc(e.message)}</p></section>`;
  }
}

let temporizadorAviso;
function avisar(texto, tipo = 'info') {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = `aviso ${tipo}`;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { el.hidden = true; }, tipo === 'erro' ? 9000 : 4000);
}

async function executar(acao, mensagem) {
  try {
    await acao();
    if (mensagem) avisar(mensagem);
  } catch (e) {
    console.error(e);
    avisar(e.message || String(e), 'erro');
  }
}

function filtrosPeriodo({ soFim = false } = {}) {
  const { inicio, fim } = estado.periodo;
  return `<form class="filtros" data-periodo>
    ${soFim ? '' : `<label>De <input type="date" name="inicio" value="${inicio}"></label>`}
    <label>${soFim ? 'Posição em' : 'Até'} <input type="date" name="fim" value="${fim}"></label>
    <button>Atualizar</button>
  </form>`;
}

function ligarPeriodo(raiz) {
  $('form[data-periodo]', raiz)?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    if (f.has('inicio')) estado.periodo.inicio = f.get('inicio');
    estado.periodo.fim = f.get('fim');
    render();
  });
}

function baixarJson(nome, dados) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nome });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

async function viewPainel(el, empresa) {
  if (!empresa) {
    el.innerHTML = `<section class="cartao">
      <h1>Bem-vindo</h1>
      <p>Sistema de contabilidade para estudo, com o fluxo dos sistemas de escrituração usados por escritórios contábeis:
      empresa → plano de contas → lançamentos → diário, razão, balancete, DRE e balanço.</p>
      <p><a href="#/empresas">Cadastre uma empresa</a> (você pode começar pela empresa de exemplo).</p>
    </section>`;
    return;
  }
  const { inicio, fim } = estado.periodo;
  const bal = C.balancoPatrimonial(estado.contas, estado.lancamentos, { fim });
  const resultado = C.dre(estado.lancamentos, { inicio, fim }).resultado;
  const bc = C.balancete(estado.contas, estado.lancamentos, { inicio, fim });
  const disponivel = C.movimentoDaConta('1.1.1', estado.lancamentos, { fim });
  el.innerHTML = `
    <h1>${esc(empresa.nome)}</h1>
    <p class="subtitulo">${esc(empresa.regime || '')} ${empresa.cnpj ? '· CNPJ ' + esc(empresa.cnpj) : ''}</p>
    <section class="cartao">
      ${filtrosPeriodo()}
    </section>
    <section class="grade">
      <div class="indicador"><small>Disponível (caixa e bancos)</small><b>${moeda(disponivel.debitos - disponivel.creditos)}</b></div>
      <div class="indicador"><small>Total do Ativo</small><b>${moeda(bal.totalAtivo)}</b></div>
      <div class="indicador"><small>Passivo + PL</small><b>${moeda(bal.totalPassivoMaisPL)}</b></div>
      <div class="indicador"><small>Resultado do período</small><b class="${resultado < 0 ? 'negativo' : 'positivo'}">${moeda(resultado)}</b></div>
      <div class="indicador"><small>Lançamentos</small><b>${estado.lancamentos.length}</b></div>
    </section>
    <section class="cartao" style="margin-top:16px">
      <h2>Conferências</h2>
      <p>Balancete: <span class="status ${bc.fechado ? 'ok' : 'erro'}">${bc.fechado ? 'fechado (débitos = créditos)' : 'não fecha'}</span></p>
      <p>Balanço: <span class="status ${bal.fechado ? 'ok' : 'erro'}">${bal.fechado ? 'Ativo = Passivo + PL' : 'não fecha'}</span></p>
      <div class="acoes"><a href="#/lancamentos">Novo lançamento</a> · <a href="#/balancete">Balancete</a> · <a href="#/exercicios">Praticar exercícios</a></div>
    </section>`;
  ligarPeriodo(el);
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

async function viewEmpresas(el) {
  el.innerHTML = `
    <h1>Empresas</h1>
    <p class="subtitulo">Cada empresa tem seu próprio plano de contas e seus lançamentos (${estado.store.modo === 'local' ? 'salvos neste navegador' : 'salvos no seu banco privado do Firebase'}).</p>
    <section class="cartao">
      <h2>Nova empresa</h2>
      <form class="linha" id="form-empresa">
        <label>Nome <input name="nome" required placeholder="Minha Empresa Ltda"></label>
        <label>CNPJ <input name="cnpj" placeholder="00.000.000/0001-00"></label>
        <label>Regime
          <select name="regime"><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option><option>MEI</option></select>
        </label>
        <label>Início do exercício <input type="date" name="inicioExercicio" value="${ano}-01-01"></label>
        <button class="primario">Criar com plano padrão</button>
      </form>
      <div class="acoes">
        <button id="btn-exemplo">Criar empresa de exemplo (com lançamentos)</button>
        <label style="flex-direction:row;align-items:center">Importar backup <input type="file" id="arquivo-backup" accept="application/json"></label>
      </div>
    </section>
    <section class="cartao">
      <h2>Cadastradas</h2>
      ${estado.empresas.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Nome</th><th>CNPJ</th><th>Regime</th><th></th></tr></thead>
        <tbody>${estado.empresas.map((e) => `<tr>
          <td>${esc(e.nome)} ${e.id === estado.empresaId ? '<span class="selo">atual</span>' : ''}</td>
          <td>${esc(e.cnpj)}</td><td>${esc(e.regime)}</td>
          <td class="num">
            <button class="link" data-selecionar="${esc(e.id)}">Abrir</button>
            <button class="link" data-backup="${esc(e.id)}">Backup</button>
            <button class="link perigo" data-excluir="${esc(e.id)}">Excluir</button>
          </td></tr>`).join('')}</tbody></table></div>` : '<p class="suave">Nenhuma empresa ainda.</p>'}
    </section>`;

  const criar = async (dados, lancamentos = []) => {
    const plano = (await carregarPublico('plano-de-contas')).contas.map((c) => ({ ...c, ativa: true }));
    const id = await estado.store.salvarEmpresa({ ...dados, criadaEm: hoje() });
    await estado.store.salvarContas(id, plano);
    if (lancamentos.length) await estado.store.salvarLancamentos(id, lancamentos);
    estado.empresas = await estado.store.listarEmpresas();
    await selecionarEmpresa(id);
    location.hash = '#/painel';
  };

  $('#form-empresa', el).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const dados = Object.fromEntries(new FormData(ev.target));
    executar(() => criar(dados), 'Empresa criada com o plano de contas padrão.');
  });

  $('#btn-exemplo', el).addEventListener('click', () => executar(async () => {
    const ex = await carregarPublico('empresa-exemplo');
    estado.periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    await criar(ex.empresa, ex.lancamentos);
  }, 'Empresa de exemplo criada. Confira o balancete e a DRE.'));

  $('#arquivo-backup', el).addEventListener('change', (ev) => executar(async () => {
    const arquivo = ev.target.files[0];
    if (!arquivo) return;
    const dados = JSON.parse(await arquivo.text());
    if (!dados.empresa || !Array.isArray(dados.contas) || !Array.isArray(dados.lancamentos)) throw new Error('Arquivo de backup inválido.');
    const { id, ...empresa } = dados.empresa;
    const novoId = await estado.store.salvarEmpresa({ ...empresa, nome: `${empresa.nome} (importada)` });
    await estado.store.salvarContas(novoId, dados.contas);
    await estado.store.salvarLancamentos(novoId, dados.lancamentos.map(({ id: _, ...l }) => l));
    estado.empresas = await estado.store.listarEmpresas();
    await selecionarEmpresa(novoId);
  }, 'Backup importado.'));

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.selecionar) executar(() => selecionarEmpresa(b.dataset.selecionar));
    if (b.dataset.backup) executar(async () => {
      const id = b.dataset.backup;
      const empresa = estado.empresas.find((e) => e.id === id);
      const [contas, lancamentos] = await Promise.all([estado.store.listarContas(id), estado.store.listarLancamentos(id)]);
      baixarJson(`backup-${empresa.nome.replace(/\W+/g, '-').toLowerCase()}-${hoje()}.json`, { empresa, contas, lancamentos, geradoEm: new Date().toISOString() });
    });
    if (b.dataset.excluir) {
      const empresa = estado.empresas.find((e) => e.id === b.dataset.excluir);
      if (!confirm(`Excluir "${empresa.nome}" com todo o plano de contas e lançamentos? Não dá para desfazer.`)) return;
      executar(async () => {
        await estado.store.excluirEmpresa(empresa.id);
        estado.empresas = await estado.store.listarEmpresas();
        estado.empresaId = null;
        if (estado.empresas[0]) await selecionarEmpresa(estado.empresas[0].id);
        else await recarregarEmpresa();
      }, 'Empresa excluída.');
    }
  });
}

// ---------------------------------------------------------------------------
// Plano de contas
// ---------------------------------------------------------------------------

async function viewPlano(el) {
  const usadas = new Set(estado.lancamentos.flatMap((l) => l.partidas.map((p) => p.conta)));
  el.innerHTML = `
    <h1>Plano de Contas</h1>
    <p class="subtitulo">Contas <b>sintéticas</b> (S) agrupam; só as <b>analíticas</b> (A) recebem lançamentos.
    Natureza D = devedora (aumenta a débito), C = credora (aumenta a crédito). Contas com "(-)" são retificadoras.</p>
    <section class="cartao">
      <h2 id="titulo-form-conta">Nova conta</h2>
      <form class="linha" id="form-conta">
        <label>Código <input name="codigo" required placeholder="1.1.1.04" pattern="\\d+(\\.\\d+)*"></label>
        <label style="flex:1;min-width:200px">Nome <input name="nome" required></label>
        <label>Tipo <select name="tipo"><option value="A">A - Analítica</option><option value="S">S - Sintética</option></select></label>
        <label>Natureza <select name="natureza"><option value="D">D - Devedora</option><option value="C">C - Credora</option></select></label>
        <label>Situação <select name="ativa"><option value="true">Ativa</option><option value="false">Inativa</option></select></label>
        <button class="primario">Salvar</button>
      </form>
    </section>
    <section class="cartao">
      <div class="filtros"><label style="flex:1">Buscar <input id="busca-conta" placeholder="código ou nome"></label></div>
      <div class="tabela-rolagem"><table>
        <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Natureza</th><th></th></tr></thead>
        <tbody>${estado.contas.map((c) => `<tr class="${c.tipo === 'S' ? 'sintetica' : ''} ${c.ativa === false ? 'suave' : ''}" data-busca="${esc((c.codigo + ' ' + c.nome).toLowerCase())}">
          <td>${esc(c.codigo)}</td>
          <td style="padding-left:${(C.nivelDaConta(c.codigo) - 1) * 16 + 8}px">${esc(c.nome)}${c.ativa === false ? ' (inativa)' : ''}</td>
          <td>${c.tipo}</td><td>${c.natureza}</td>
          <td class="num"><button class="link" data-editar="${esc(c.codigo)}">Editar</button>
          ${usadas.has(c.codigo) ? '' : `<button class="link perigo" data-excluir="${esc(c.codigo)}">Excluir</button>`}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`;

  const form = $('#form-conta', el);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const conta = { codigo: f.codigo.trim(), nome: f.nome.trim(), tipo: f.tipo, natureza: f.natureza, ativa: f.ativa === 'true' };
    const outras = estado.contas.filter((c) => c.codigo !== conta.codigo);
    const erros = C.validarConta(conta, outras);
    const existente = contaPorCodigo(conta.codigo);
    if (existente && existente.tipo === 'S' && conta.tipo === 'A' && estado.contas.some((c) => C.codigoPai(c.codigo) === conta.codigo)) {
      erros.push('Esta conta tem subcontas; ela precisa continuar sintética.');
    }
    if (existente && existente.tipo === 'A' && conta.tipo === 'S' && usadas.has(conta.codigo)) {
      erros.push('Esta conta já tem lançamentos; não pode virar sintética.');
    }
    if (erros.length) return avisar(erros.join('\n'), 'erro');
    executar(async () => {
      await estado.store.salvarContas(estado.empresaId, [conta]);
      await recarregarEmpresa();
    }, `Conta ${conta.codigo} salva.`);
  });

  $('#busca-conta', el).addEventListener('input', (ev) => {
    const termo = ev.target.value.toLowerCase();
    $$('tbody tr', el).forEach((tr) => { tr.hidden = termo && !tr.dataset.busca.includes(termo); });
  });

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.editar) {
      const c = contaPorCodigo(b.dataset.editar);
      form.codigo.value = c.codigo;
      form.nome.value = c.nome;
      form.tipo.value = c.tipo;
      form.natureza.value = c.natureza;
      form.ativa.value = String(c.ativa !== false);
      $('#titulo-form-conta', el).textContent = `Editar conta ${c.codigo}`;
      form.scrollIntoView({ behavior: 'smooth' });
    }
    if (b.dataset.excluir) {
      const codigo = b.dataset.excluir;
      if (estado.contas.some((c) => C.codigoPai(c.codigo) === codigo)) return avisar('Exclua primeiro as subcontas.', 'erro');
      if (!confirm(`Excluir a conta ${nomeConta(codigo)}?`)) return;
      executar(async () => {
        await estado.store.excluirConta(estado.empresaId, codigo);
        await recarregarEmpresa();
      }, 'Conta excluída.');
    }
  });
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

function novoRascunho() {
  return { data: hoje(), historico: '', partidas: [{ conta: '', tipo: 'D', valor: 0 }, { conta: '', tipo: 'C', valor: 0 }] };
}

async function viewLancamentos(el) {
  estado.rascunho ||= novoRascunho();
  const r = estado.rascunho;
  const analiticas = estado.contas.filter((c) => c.tipo === 'A' && c.ativa !== false);
  const recentes = [...estado.lancamentos].reverse().slice(0, 50);

  el.innerHTML = `
    <h1>Lançamentos</h1>
    <p class="subtitulo">Método das partidas dobradas: a soma dos débitos deve ser igual à soma dos créditos.</p>
    <section class="cartao">
      <h2>${r.id ? `Editando lançamento nº ${r.numero}` : 'Novo lançamento'}</h2>
      <form id="form-lancamento">
        <div class="filtros">
          <label>Data <input type="date" name="data" value="${esc(r.data)}" required></label>
          <label style="flex:1;min-width:240px">Histórico
            <input name="historico" list="lista-historicos" value="${esc(r.historico)}" required placeholder="Ex.: Venda de mercadorias conforme NF nº 123">
          </label>
        </div>
        <datalist id="lista-historicos">${estado.historicos.map((h) => `<option value="${esc(h.texto)}">${esc(h.codigo)}</option>`).join('')}</datalist>
        <datalist id="lista-contas">${analiticas.map((c) => `<option value="${esc(c.codigo)} - ${esc(c.nome)}"></option>`).join('')}</datalist>
        <h2 style="margin-top:16px">Partidas</h2>
        <div id="partidas">${r.partidas.map((p, i) => `
          <div class="partida" data-i="${i}">
            <input name="conta" list="lista-contas" placeholder="Conta (digite código ou nome)" value="${p.conta ? esc(nomeConta(p.conta).replace(' ', ' - ')) : ''}" aria-label="Conta">
            <select name="tipo" aria-label="Débito ou crédito"><option value="D" ${p.tipo === 'D' ? 'selected' : ''}>Débito</option><option value="C" ${p.tipo === 'C' ? 'selected' : ''}>Crédito</option></select>
            <input name="valor" class="valor" inputmode="decimal" placeholder="0,00" value="${p.valor ? esc(moeda(p.valor).replace('R$ ', '')) : ''}" aria-label="Valor">
            <button type="button" data-remover="${i}" title="Remover partida" aria-label="Remover partida">×</button>
          </div>`).join('')}
        </div>
        <button type="button" id="btn-add-partida">+ Partida</button>
        <div class="resumo-partidas" id="resumo-partidas"></div>
        <div class="acoes">
          <button class="primario">${r.id ? 'Salvar alterações' : 'Lançar'}</button>
          <button type="button" id="btn-limpar">${r.id ? 'Cancelar edição' : 'Limpar'}</button>
        </div>
      </form>
    </section>
    <section class="cartao">
      <h2>Encerramento do exercício</h2>
      <p class="suave">Zera as contas de resultado (grupos 4, 5 e 6) e transfere o lucro ou prejuízo para o Patrimônio Líquido.</p>
      <form class="linha" id="form-encerramento">
        <label>Data do encerramento <input type="date" name="data" value="${estado.periodo.fim}" required></label>
        <button>Gerar lançamento de encerramento</button>
      </form>
    </section>
    <section class="cartao">
      <h2>Últimos lançamentos</h2>
      ${recentes.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Nº</th><th>Data</th><th>Histórico</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>${recentes.map((l) => `<tr>
          <td>${l.numero ?? ''}</td><td>${dataBR(l.data)}</td>
          <td>${esc(l.historico)}${l.tipo === 'encerramento' ? ' <span class="selo">encerramento</span>' : ''}
            <div class="suave">${l.partidas.map((p) => `${p.tipo} ${esc(nomeConta(p.conta))} ${moeda(p.valor)}`).join('<br>')}</div></td>
          <td class="num">${moeda(C.totalPartidas(l.partidas, 'D'))}</td>
          <td class="num"><button class="link" data-editar="${esc(l.id)}">Editar</button>
            <button class="link perigo" data-excluir="${esc(l.id)}">Excluir</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="suave">Nenhum lançamento ainda.</p>'}
    </section>`;

  const form = $('#form-lancamento', el);

  // Lê o formulário para o rascunho (sem validar), mantendo o que foi digitado.
  const lerForm = () => {
    r.data = form.data.value;
    r.historico = form.historico.value;
    r.partidas = $$('.partida', form).map((linha) => ({
      conta: linha.querySelector('[name=conta]').value.trim().split(/\s+/)[0] || '',
      tipo: linha.querySelector('[name=tipo]').value,
      valor: C.paraCentavos(linha.querySelector('[name=valor]').value) || 0,
    }));
  };

  const atualizarResumo = () => {
    lerForm();
    const d = C.totalPartidas(r.partidas, 'D');
    const c = C.totalPartidas(r.partidas, 'C');
    $('#resumo-partidas', el).innerHTML = `
      <span>Débitos: <b>${moeda(d)}</b></span>
      <span>Créditos: <b>${moeda(c)}</b></span>
      <span class="status ${d === c && d > 0 ? 'ok' : 'erro'}">${d === c && d > 0 ? 'Balanceado' : `Diferença ${moeda(d - c)}`}</span>
      <span class="suave">${C.formulaDoLancamento(r.partidas)}</span>`;
  };
  form.addEventListener('input', atualizarResumo);
  atualizarResumo();

  $('#btn-add-partida', el).addEventListener('click', () => {
    lerForm();
    const d = C.totalPartidas(r.partidas, 'D');
    const c = C.totalPartidas(r.partidas, 'C');
    r.partidas.push({ conta: '', tipo: d >= c ? 'C' : 'D', valor: Math.abs(d - c) });
    render();
  });
  $('#btn-limpar', el).addEventListener('click', () => { estado.rascunho = novoRascunho(); render(); });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    lerForm();
    const lancamento = { ...r, partidas: r.partidas.filter((p) => p.conta || p.valor) };
    const erros = C.validarLancamento(lancamento, estado.contas);
    if (erros.length) return avisar(erros.join('\n'), 'erro');
    if (!lancamento.numero) lancamento.numero = C.proximoNumero(estado.lancamentos);
    executar(async () => {
      await estado.store.salvarLancamentos(estado.empresaId, [lancamento]);
      estado.rascunho = novoRascunho();
      await recarregarEmpresa();
    }, `Lançamento nº ${lancamento.numero} gravado.`);
  });

  $('#form-encerramento', el).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = ev.target.data.value;
    const enc = C.gerarEncerramento(estado.contas, estado.lancamentos, { data });
    if (!enc) return avisar('Não há saldo nas contas de resultado até essa data.');
    const erros = C.validarLancamento(enc, estado.contas);
    if (erros.length) return avisar(erros.join('\n'), 'erro');
    if (!confirm(`${enc.historico}.\nGerar o lançamento com ${enc.partidas.length} partidas em ${dataBR(data)}?`)) return;
    executar(async () => {
      await estado.store.salvarLancamentos(estado.empresaId, [{ ...enc, numero: C.proximoNumero(estado.lancamentos) }]);
      await recarregarEmpresa();
    }, 'Exercício encerrado. O resultado foi transferido para o PL.');
  });

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.remover !== undefined) {
      lerForm();
      r.partidas.splice(Number(b.dataset.remover), 1);
      render();
    }
    if (b.dataset.editar) {
      estado.rascunho = structuredClone(estado.lancamentos.find((l) => l.id === b.dataset.editar));
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (b.dataset.excluir) {
      const l = estado.lancamentos.find((x) => x.id === b.dataset.excluir);
      if (!confirm(`Excluir o lançamento nº ${l.numero} (${l.historico})?`)) return;
      executar(async () => {
        await estado.store.excluirLancamento(estado.empresaId, l.id);
        await recarregarEmpresa();
      }, 'Lançamento excluído.');
    }
  });
}

// ---------------------------------------------------------------------------
// Livros: Diário e Razão
// ---------------------------------------------------------------------------

async function viewDiario(el, empresa) {
  const { inicio, fim } = estado.periodo;
  const lista = estado.lancamentos.filter((l) => l.data >= inicio && l.data <= fim);
  el.innerHTML = `
    <h1>Livro Diário</h1>
    <p class="subtitulo">${esc(empresa.nome)} · registro cronológico de todos os fatos contábeis.</p>
    <section class="cartao">${filtrosPeriodo()}</section>
    <section class="cartao">
      ${lista.length ? lista.map((l) => `<article class="lancamento-diario">
        <header><b>Nº ${l.numero ?? ''} · ${dataBR(l.data)}</b><span class="suave">${C.formulaDoLancamento(l.partidas)}</span></header>
        <div class="tabela-rolagem"><table>
          ${l.partidas.map((p) => `<tr><td>${p.tipo === 'D' ? '' : '&nbsp;&nbsp;&nbsp;&nbsp;a '}${esc(nomeConta(p.conta))}</td>
            <td class="num">${p.tipo === 'D' ? moeda(p.valor) : ''}</td><td class="num">${p.tipo === 'C' ? moeda(p.valor) : ''}</td></tr>`).join('')}
        </table></div>
        <p class="suave" style="margin:4px 0 0">${esc(l.historico)}</p>
      </article>`).join('') : '<p class="suave">Nenhum lançamento no período.</p>'}
    </section>`;
  ligarPeriodo(el);
}

async function viewRazao(el) {
  const { inicio, fim } = estado.periodo;
  if (!contaPorCodigo(estado.contaRazao)) estado.contaRazao = estado.contas.find((c) => c.tipo === 'A')?.codigo;
  const conta = contaPorCodigo(estado.contaRazao);
  const r = conta ? C.razao(conta, estado.lancamentos, { inicio, fim }) : { saldoAnterior: 0, linhas: [], saldoFinal: 0 };
  el.innerHTML = `
    <h1>Livro Razão</h1>
    <p class="subtitulo">Movimento de uma conta com saldo acumulado. Em contas sintéticas, soma as subcontas.</p>
    <section class="cartao">
      <div class="filtros">
        <label style="flex:1;min-width:240px">Conta
          <select id="sel-conta-razao">${estado.contas.map((c) => `<option value="${esc(c.codigo)}" ${c.codigo === estado.contaRazao ? 'selected' : ''}>${esc(c.codigo)} - ${esc(c.nome)}</option>`).join('')}</select>
        </label>
      </div>
      <div style="margin-top:10px">${filtrosPeriodo()}</div>
    </section>
    <section class="cartao tabela-rolagem">
      <table>
        <thead><tr><th>Data</th><th>Nº</th><th>Histórico</th><th>Contrapartida</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          <tr class="destaque"><td colspan="6">Saldo anterior</td><td class="num ${classeValor(r.saldoAnterior)}">${moeda(r.saldoAnterior)}</td></tr>
          ${r.linhas.map((l) => `<tr><td>${dataBR(l.data)}</td><td>${l.numero ?? ''}</td><td>${esc(l.historico)}</td>
            <td class="suave">${l.contrapartidas.map((c) => esc(nomeConta(c))).join('<br>')}</td>
            <td class="num">${l.debito ? moeda(l.debito) : ''}</td><td class="num">${l.credito ? moeda(l.credito) : ''}</td>
            <td class="num ${classeValor(l.saldo)}">${moeda(l.saldo)}</td></tr>`).join('')}
          <tr class="total"><td colspan="6">Saldo final (natureza ${conta?.natureza === 'C' ? 'credora' : 'devedora'})</td><td class="num ${classeValor(r.saldoFinal)}">${moeda(r.saldoFinal)}</td></tr>
        </tbody>
      </table>
    </section>`;
  $('#sel-conta-razao', el).addEventListener('change', (ev) => { estado.contaRazao = ev.target.value; render(); });
  ligarPeriodo(el);
}

// ---------------------------------------------------------------------------
// Balancete, DRE e Balanço
// ---------------------------------------------------------------------------

async function viewBalancete(el, empresa) {
  const { inicio, fim } = estado.periodo;
  const b = C.balancete(estado.contas, estado.lancamentos, { inicio, fim });
  const saldo = (v, ind) => (v ? `${moeda(Math.abs(v))} ${ind}` : '-');
  el.innerHTML = `
    <h1>Balancete de Verificação</h1>
    <p class="subtitulo">${esc(empresa.nome)} · ${dataBR(inicio)} a ${dataBR(fim)}
      · <span class="status ${b.fechado ? 'ok' : 'erro'}">${b.fechado ? 'Fechado' : 'Não fecha'}</span></p>
    <section class="cartao">${filtrosPeriodo()}</section>
    <section class="cartao tabela-rolagem">
      <table>
        <thead><tr><th>Conta</th><th class="num">Saldo anterior</th><th class="num">Débitos</th><th class="num">Créditos</th><th class="num">Saldo atual</th></tr></thead>
        <tbody>
          ${b.linhas.map((l) => {
            const indAnt = l.saldoAnterior === 0 ? '' : (l.natureza === 'D') === (l.saldoAnterior > 0) ? 'D' : 'C';
            return `<tr class="${l.tipo === 'S' ? 'sintetica' : ''}">
              <td style="padding-left:${(l.nivel - 1) * 16 + 8}px">${esc(l.codigo)} ${esc(l.nome)}</td>
              <td class="num">${saldo(l.saldoAnterior, indAnt)}</td>
              <td class="num">${moeda(l.debitos)}</td><td class="num">${moeda(l.creditos)}</td>
              <td class="num">${saldo(l.saldoAtual, l.indicador)}</td></tr>`;
          }).join('')}
          <tr class="total"><td>Totais (contas analíticas)</td><td></td>
            <td class="num">${moeda(b.totalDebitos)}</td><td class="num">${moeda(b.totalCreditos)}</td>
            <td class="num">D ${moeda(b.saldosDevedores)}<br>C ${moeda(b.saldosCredores)}</td></tr>
        </tbody>
      </table>
    </section>`;
  ligarPeriodo(el);
}

async function viewDre(el, empresa) {
  const { inicio, fim } = estado.periodo;
  const r = C.dre(estado.lancamentos, { inicio, fim });
  el.innerHTML = `
    <h1>Demonstração do Resultado do Exercício</h1>
    <p class="subtitulo">${esc(empresa.nome)} · ${dataBR(inicio)} a ${dataBR(fim)} · Lei 6.404/76, art. 187</p>
    <section class="cartao">${filtrosPeriodo()}</section>
    <section class="cartao tabela-rolagem">
      <table><tbody>
        ${r.linhas.map((l) => `<tr class="${l.destaque ? 'destaque' : ''}"><td>${esc(l.nome)}</td><td class="num ${classeValor(l.valor)}">${moeda(l.valor)}</td></tr>`).join('')}
      </tbody></table>
      <p><b>${r.resultado >= 0 ? 'Lucro' : 'Prejuízo'} do período: <span class="${r.resultado < 0 ? 'negativo' : 'positivo'}">${moeda(Math.abs(r.resultado))}</span></b></p>
    </section>`;
  ligarPeriodo(el);
}

async function viewBalanco(el, empresa) {
  const { fim } = estado.periodo;
  const b = C.balancoPatrimonial(estado.contas, estado.lancamentos, { fim });
  const linhas = (itens) => itens.map((l) => `<tr class="${l.nivel < 3 ? 'sintetica' : ''}">
    <td style="padding-left:${(l.nivel - 1) * 16 + 8}px">${esc(l.nome)}</td><td class="num ${classeValor(l.valor)}">${moeda(l.valor)}</td></tr>`).join('');
  el.innerHTML = `
    <h1>Balanço Patrimonial</h1>
    <p class="subtitulo">${esc(empresa.nome)} · posição em ${dataBR(fim)}
      · <span class="status ${b.fechado ? 'ok' : 'erro'}">${b.fechado ? 'Ativo = Passivo + PL' : 'Não fecha'}</span></p>
    <section class="cartao">${filtrosPeriodo({ soFim: true })}</section>
    <div class="grade" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <section class="cartao tabela-rolagem"><h2>Ativo</h2><table><tbody>
        ${linhas(b.ativo)}
        <tr class="total"><td>Total do Ativo</td><td class="num">${moeda(b.totalAtivo)}</td></tr>
      </tbody></table></section>
      <section class="cartao tabela-rolagem"><h2>Passivo e Patrimônio Líquido</h2><table><tbody>
        ${linhas(b.passivo)}
        <tr class="destaque"><td>Total do Passivo</td><td class="num">${moeda(b.totalPassivo)}</td></tr>
        ${linhas(b.patrimonioLiquido)}
        ${b.resultadoNaoEncerrado ? `<tr><td style="padding-left:24px">Resultado do exercício (não encerrado)</td><td class="num ${classeValor(b.resultadoNaoEncerrado)}">${moeda(b.resultadoNaoEncerrado)}</td></tr>` : ''}
        <tr class="destaque"><td>Total do Patrimônio Líquido</td><td class="num ${classeValor(b.totalPL)}">${moeda(b.totalPL)}</td></tr>
        <tr class="total"><td>Total do Passivo + PL</td><td class="num">${moeda(b.totalPassivoMaisPL)}</td></tr>
      </tbody></table></section>
    </div>`;
  ligarPeriodo(el);
}

// ---------------------------------------------------------------------------
// Exercícios (banco público)
// ---------------------------------------------------------------------------

async function viewExercicios(el) {
  const { exercicios } = await carregarPublico('exercicios');
  const plano = estado.contas.length ? estado.contas : (await carregarPublico('plano-de-contas')).contas;
  const nome = (codigo) => `${codigo} ${plano.find((c) => c.codigo === codigo)?.nome ?? ''}`;
  el.innerHTML = `
    <h1>Exercícios de lançamentos</h1>
    <p class="subtitulo">Tente montar o lançamento antes de abrir a resposta. Os exercícios vêm do banco público (<code>dados-publicos/exercicios.json</code>).</p>
    ${exercicios.map((ex, i) => `<section class="cartao">
      <h2>${i + 1}. ${esc(ex.tema)}</h2>
      <p>${esc(ex.enunciado)}</p>
      <details><summary>Ver resposta</summary>
        <div class="tabela-rolagem"><table>
          ${ex.partidas.map((p) => `<tr><td>${p.tipo === 'D' ? 'D' : '&nbsp;&nbsp;C'} ${esc(nome(p.conta))}</td><td class="num">${moeda(p.valor)}</td></tr>`).join('')}
        </table></div>
        <p class="suave">${C.formulaDoLancamento(ex.partidas)}. ${esc(ex.conceito)}</p>
        ${estado.empresaId ? `<button data-praticar="${i}">Levar para a tela de lançamentos</button>` : ''}
      </details>
    </section>`).join('')}`;
  el.addEventListener('click', (ev) => {
    const i = ev.target.closest('button')?.dataset.praticar;
    if (i === undefined) return;
    const ex = exercicios[Number(i)];
    estado.rascunho = { data: hoje(), historico: ex.enunciado.slice(0, 200), partidas: structuredClone(ex.partidas) };
    location.hash = '#/lancamentos';
  });
}

// ---------------------------------------------------------------------------
// Estudos: registro público (GitHub) + anotações privadas
// ---------------------------------------------------------------------------

async function viewEstudos(el) {
  const publicos = (await carregarPublico('estudos')).estudos;
  const privados = (await estado.store.listarEstudos()).sort((a, b) => b.data.localeCompare(a.data));
  const cartao = (e, privado) => `<article class="cartao">
    <h2>${esc(e.tema)} <span class="suave" style="font-weight:400">· ${dataBR(e.data)}</span></h2>
    <div class="etiquetas">${(e.conceitos || []).map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <p>${esc(e.comoFoiFeito)}</p>
    ${e.referencias?.length ? `<p class="suave">Referências: ${e.referencias.map(esc).join('; ')}</p>` : ''}
    ${privado ? `<button class="link perigo" data-excluir="${esc(e.id)}">Excluir</button>` : ''}
  </article>`;

  el.innerHTML = `
    <h1>Registro de estudos</h1>
    <p class="subtitulo">O que foi estudado e como foi feito. Há dois bancos: o <b>público</b> (versionado no GitHub) e o <b>privado</b> (${estado.store.modo === 'local' ? 'neste navegador' : 'no Firebase'}).</p>
    <section class="cartao">
      <h2>Nova anotação (privada)</h2>
      <form id="form-estudo">
        <div class="filtros">
          <label>Data <input type="date" name="data" value="${hoje()}" required></label>
          <label style="flex:1;min-width:220px">Tema <input name="tema" required></label>
        </div>
        <label style="margin-top:8px">Conceitos (separados por vírgula) <input name="conceitos"></label>
        <label style="margin-top:8px">Como foi feito / o que aprendi <textarea name="comoFoiFeito" required></textarea></label>
        <label style="margin-top:8px">Referências (separadas por ponto e vírgula) <input name="referencias"></label>
        <div class="acoes">
          <button class="primario">Salvar</button>
          <button type="button" id="btn-exportar-estudos">Exportar no formato do banco público</button>
        </div>
      </form>
    </section>
    <h2>Privados (${privados.length})</h2>
    ${privados.map((e) => cartao(e, true)).join('') || '<p class="suave">Nenhuma anotação privada ainda.</p>'}
    <h2>Públicos · GitHub (${publicos.length})</h2>
    ${publicos.map((e) => cartao(e, false)).join('')}`;

  const lista = (texto, sep) => texto.split(sep).map((s) => s.trim()).filter(Boolean);
  $('#form-estudo', el).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    executar(async () => {
      await estado.store.salvarEstudo({ ...f, conceitos: lista(f.conceitos, ','), referencias: lista(f.referencias, ';') });
      render();
    }, 'Anotação salva.');
  });
  $('#btn-exportar-estudos', el).addEventListener('click', () => {
    // Gera um arquivo pronto para mesclar em dados-publicos/estudos.json e fazer commit.
    const estudos = privados.map(({ id, ...e }) => ({ id: `est-${e.data}-${id.slice(0, 6)}`, ...e }));
    baixarJson(`estudos-para-publicar-${hoje()}.json`, { versao: '1.0.0', descricao: 'Anotações exportadas do banco privado para revisão e publicação.', estudos });
  });
  el.addEventListener('click', (ev) => {
    const id = ev.target.closest('button')?.dataset.excluir;
    if (!id || !confirm('Excluir esta anotação?')) return;
    executar(async () => { await estado.store.excluirEstudo(id); render(); }, 'Anotação excluída.');
  });
}

iniciar().catch((e) => {
  console.error(e);
  $('#conteudo').innerHTML = `<section class="cartao"><h1>Não foi possível iniciar</h1><p>${esc(e.message)}</p></section>`;
});
