// Banco PRIVADO no Firebase (Cloud Firestore + Authentication).
//
// Estrutura das coleções (cada usuário só enxerga a própria árvore):
//   usuarios/{uid}/empresas/{empresaId}
//   usuarios/{uid}/empresas/{empresaId}/contas/{codigo}
//   usuarios/{uid}/empresas/{empresaId}/lancamentos/{lancamentoId}
//   usuarios/{uid}/estudos/{estudoId}
//
// O SDK é carregado do CDN oficial só quando o Firebase está configurado.

const VERSAO_SDK = '10.12.2';
const cdn = (modulo) => `https://www.gstatic.com/firebasejs/${VERSAO_SDK}/firebase-${modulo}.js`;
const LIMITE_LOTE = 450; // o Firestore aceita até 500 operações por lote

let sdk = null;

async function carregarSdk(config) {
  if (sdk) return sdk;
  const [app, auth, fs] = await Promise.all([import(cdn('app')), import(cdn('auth')), import(cdn('firestore'))]);
  const aplicacao = app.initializeApp(config);
  sdk = { auth, fs, autenticacao: auth.getAuth(aplicacao), banco: fs.getFirestore(aplicacao) };
  return sdk;
}

/** Observa login/logout. `aoMudar` recebe o usuário do Firebase ou null. */
export async function observarUsuario(config, aoMudar) {
  const { auth, autenticacao } = await carregarSdk(config);
  return auth.onAuthStateChanged(autenticacao, aoMudar);
}

export async function entrar(config, email, senha) {
  const { auth, autenticacao } = await carregarSdk(config);
  return auth.signInWithEmailAndPassword(autenticacao, email, senha);
}

export async function cadastrar(config, email, senha) {
  const { auth, autenticacao } = await carregarSdk(config);
  return auth.createUserWithEmailAndPassword(autenticacao, email, senha);
}

export async function entrarComGoogle(config) {
  const { auth, autenticacao } = await carregarSdk(config);
  return auth.signInWithPopup(autenticacao, new auth.GoogleAuthProvider());
}

export async function criarArmazenamentoFirebase(config, usuario) {
  const { fs, banco, auth, autenticacao } = await carregarSdk(config);
  const { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp } = fs;
  const raiz = ['usuarios', usuario.uid];
  const col = (...partes) => collection(banco, ...raiz, ...partes);
  const listar = async (...partes) => (await getDocs(col(...partes))).docs.map((d) => ({ ...d.data(), id: d.id }));

  async function gravarEmLotes(itens, aplicar) {
    for (let i = 0; i < itens.length; i += LIMITE_LOTE) {
      const lote = writeBatch(banco);
      itens.slice(i, i + LIMITE_LOTE).forEach((item) => aplicar(lote, item));
      await lote.commit();
    }
  }

  return {
    modo: 'firebase',
    usuario: { uid: usuario.uid, email: usuario.email },

    listarEmpresas: () => listar('empresas'),
    async salvarEmpresa(dados) {
      const ref = dados.id ? doc(col('empresas'), dados.id) : doc(col('empresas'));
      const { id, ...resto } = dados;
      await setDoc(ref, { ...resto, atualizadoEm: serverTimestamp() }, { merge: true });
      return ref.id;
    },
    async excluirEmpresa(id) {
      // O Firestore não apaga subcoleções junto com o documento pai.
      for (const sub of ['contas', 'lancamentos']) {
        const docs = (await getDocs(col('empresas', id, sub))).docs;
        await gravarEmLotes(docs, (lote, d) => lote.delete(d.ref));
      }
      await deleteDoc(doc(col('empresas'), id));
    },

    async listarContas(empresaId) {
      return (await listar('empresas', empresaId, 'contas')).map(({ id, ...c }) => c);
    },
    async salvarContas(empresaId, contas) {
      await gravarEmLotes(contas, (lote, c) => lote.set(doc(col('empresas', empresaId, 'contas'), c.codigo), c));
    },
    excluirConta: (empresaId, codigo) => deleteDoc(doc(col('empresas', empresaId, 'contas'), codigo)),

    listarLancamentos: (empresaId) => listar('empresas', empresaId, 'lancamentos'),
    async salvarLancamentos(empresaId, lancamentos) {
      const refs = lancamentos.map((l) => (l.id ? doc(col('empresas', empresaId, 'lancamentos'), l.id) : doc(col('empresas', empresaId, 'lancamentos'))));
      await gravarEmLotes(lancamentos.map((l, i) => [l, refs[i]]), (lote, [l, ref]) => {
        const { id, ...resto } = l;
        lote.set(ref, { ...resto, atualizadoEm: serverTimestamp() });
      });
      return refs.map((r) => r.id);
    },
    excluirLancamento: (empresaId, id) => deleteDoc(doc(col('empresas', empresaId, 'lancamentos'), id)),

    listarEstudos: () => listar('estudos'),
    async salvarEstudo(estudo) {
      const ref = estudo.id ? doc(col('estudos'), estudo.id) : doc(col('estudos'));
      const { id, ...resto } = estudo;
      await setDoc(ref, resto);
      return ref.id;
    },
    excluirEstudo: (id) => deleteDoc(doc(col('estudos'), id)),

    sair: () => auth.signOut(autenticacao),
  };
}
