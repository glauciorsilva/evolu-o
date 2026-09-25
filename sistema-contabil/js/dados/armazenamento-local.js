// Banco local (localStorage): usado quando o Firebase não está configurado.
// Mesmo contrato do armazenamento-firebase.js, para a interface não saber a diferença.

const CHAVE = 'sistema-contabil:v1';
let memoria = null; // usado se o navegador bloquear o localStorage

function carregar() {
  if (memoria) return memoria;
  try {
    memoria = JSON.parse(localStorage.getItem(CHAVE)) || null;
  } catch {
    memoria = null;
  }
  memoria ||= { empresas: {}, estudos: {} };
  return memoria;
}

function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(memoria));
  } catch {
    // Sem localStorage (aba anônima, bloqueio): os dados ficam só na memória desta aba.
  }
}

const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const semSubcolecoes = ({ contas, lancamentos, ...empresa }) => empresa;

export function criarArmazenamentoLocal() {
  const empresa = (id) => {
    const e = carregar().empresas[id];
    if (!e) throw new Error('Empresa não encontrada.');
    return e;
  };

  return {
    modo: 'local',
    usuario: { uid: 'local', email: 'dados só neste navegador' },

    async listarEmpresas() {
      return Object.values(carregar().empresas).map(semSubcolecoes);
    },
    async salvarEmpresa(dados) {
      const bd = carregar();
      const id = dados.id || novoId();
      const atual = bd.empresas[id] || { contas: {}, lancamentos: {} };
      bd.empresas[id] = { ...atual, ...dados, id };
      gravar();
      return id;
    },
    async excluirEmpresa(id) {
      delete carregar().empresas[id];
      gravar();
    },

    async listarContas(empresaId) {
      return Object.values(empresa(empresaId).contas);
    },
    async salvarContas(empresaId, contas) {
      const e = empresa(empresaId);
      for (const c of contas) e.contas[c.codigo] = { ...c };
      gravar();
    },
    async excluirConta(empresaId, codigo) {
      delete empresa(empresaId).contas[codigo];
      gravar();
    },

    async listarLancamentos(empresaId) {
      return Object.values(empresa(empresaId).lancamentos);
    },
    async salvarLancamentos(empresaId, lancamentos) {
      const e = empresa(empresaId);
      const ids = lancamentos.map((l) => {
        const id = l.id || novoId();
        e.lancamentos[id] = { ...l, id };
        return id;
      });
      gravar();
      return ids;
    },
    async excluirLancamento(empresaId, id) {
      delete empresa(empresaId).lancamentos[id];
      gravar();
    },

    async listarEstudos() {
      return Object.values(carregar().estudos);
    },
    async salvarEstudo(estudo) {
      const id = estudo.id || novoId();
      carregar().estudos[id] = { ...estudo, id };
      gravar();
      return id;
    },
    async excluirEstudo(id) {
      delete carregar().estudos[id];
      gravar();
    },

    async sair() {},
  };
}
