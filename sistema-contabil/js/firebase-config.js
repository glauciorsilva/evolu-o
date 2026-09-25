// Configuração do projeto Firebase (banco PRIVADO).
//
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative Authentication (E-mail/senha e Google) e o Cloud Firestore.
// 3. Em "Configurações do projeto > Seus apps", registre um app Web e cole os valores abaixo.
// 4. Publique as regras de firebase/firestore.rules (veja o README).
//
// Estes valores NÃO são segredo: todo app web do Firebase os expõe no navegador.
// Quem protege os dados são as regras de segurança do Firestore, que só deixam
// cada usuário autenticado ler e gravar dentro de usuarios/{seu uid}.
//
// Enquanto apiKey estiver vazio, o sistema roda em MODO LOCAL (dados só neste navegador).
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const firebaseConfigurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
