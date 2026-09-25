# Sistema Contábil de Estudo

Sistema de contabilidade online feito para **estudar escrituração contábil na prática**:
plano de contas, lançamentos em partidas dobradas, Livro Diário, Livro Razão,
Balancete de Verificação, DRE, Balanço Patrimonial e encerramento do exercício.

## Qual sistema serviu de referência

Adotamos como referência o fluxo de trabalho do módulo de escrituração do **Domínio Contábil**
(Thomson Reuters), no mercado brasileiro desde 1991 e um dos mais usados por escritórios de
contabilidade. Replicamos **os conceitos e a sequência de trabalho**, não o código, as telas
ou a marca:

| Etapa no sistema de referência | Onde está aqui |
| --- | --- |
| Cadastro de empresas | aba **Empresas** |
| Plano de contas (sintéticas/analíticas) | aba **Plano de Contas** |
| Históricos padrão | `dados-publicos/historicos-padrao.json` (sugestões no campo Histórico) |
| Lançamentos contábeis | aba **Lançamentos** |
| Diário, Razão, Balancete | abas **Diário**, **Razão**, **Balancete** |
| Demonstrações (DRE e Balanço) | abas **DRE** e **Balanço** |
| Encerramento do exercício | botão na aba **Lançamentos** |

As regras seguem a Lei 6.404/76, a ITG 2000 (R1) – Escrituração Contábil e a NBC TG 26.
O resumo teórico está em [`docs/estudo-contabil.md`](docs/estudo-contabil.md).

## Dois bancos de dados

```
┌──────────────────────────────┐        ┌───────────────────────────────────┐
│ Banco PÚBLICO (GitHub)       │        │ Banco PRIVADO (Firebase)          │
│ dados-publicos/*.json        │        │ Cloud Firestore + Authentication  │
│ • plano de contas padrão     │  lido  │ usuarios/{uid}/empresas/{id}      │
│ • históricos padrão          │ ─────▶ │   ├─ contas/{codigo}              │
│ • empresa de exemplo         │  pelo  │   └─ lancamentos/{id}             │
│ • exercícios com resposta    │  app   │ usuarios/{uid}/estudos/{id}       │
│ • registro de estudos        │        │ Só o dono lê e grava (regras).    │
│ Evolui por commit / PR       │        │                                   │
└──────────────────────────────┘        └───────────────────────────────────┘
```

- **Público**: material de estudo que qualquer pessoa pode ver, versionado no Git. Cada
  mudança vira um commit, então o histórico mostra a evolução do que foi estudado.
- **Privado**: os lançamentos das suas empresas e suas anotações. Ficam no Firestore e as
  regras em [`firebase/firestore.rules`](firebase/firestore.rules) só dão acesso ao usuário
  autenticado dono dos dados.
- Enquanto o Firebase não estiver configurado, o sistema funciona em **modo local**
  (dados guardados só no navegador). Use o botão **Backup** para não perder nada.
- Na aba **Estudos**, o botão *Exportar no formato do banco público* gera um JSON das suas
  anotações privadas para revisar e publicar em `dados-publicos/estudos.json`.

## Como rodar

Não há build: é HTML + JavaScript (módulos ES) puro.

```bash
cd sistema-contabil
python3 -m http.server 8080      # ou: npm run servir
# abra http://localhost:8080
```

É preciso abrir por um servidor (não com duplo clique no arquivo), porque o navegador
bloqueia a leitura dos JSON públicos em `file://`.

Primeiro acesso: aba **Empresas → Criar empresa de exemplo**. Ela traz 14 lançamentos do
primeiro mês de uma empresa comercial fictícia (prejuízo de R$ 901,67) para você conferir
no balancete, na DRE e no balanço.

## Como ligar o banco privado (Firebase)

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Authentication → Método de login**: ative *E-mail/senha* (e *Google*, se quiser).
3. **Firestore Database → Criar banco** (modo produção).
4. **Configurações do projeto → Seus apps → Web**: registre o app e copie o objeto de
   configuração para [`js/firebase-config.js`](js/firebase-config.js).
5. Publique as regras e (opcionalmente) hospede o site:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.exemplo .firebaserc   # troque pelo ID do seu projeto
firebase deploy --only firestore:rules
firebase deploy --only hosting       # opcional: publica o sistema na internet
```

Os valores de `firebase-config.js` não são segredo (todo app web do Firebase os expõe); a
proteção vem das regras de segurança.

## Testes

```bash
npm test          # testa o núcleo contábil (node --test)
npm run validar   # confere o banco público: plano coerente e exemplos balanceados
```

Os dois rodam também no GitHub Actions a cada push que mexe em `sistema-contabil/`.

## Estrutura

```
sistema-contabil/
├── index.html               página única
├── css/estilo.css           visual (claro/escuro, responsivo)
├── js/
│   ├── app.js               telas e ações
│   ├── firebase-config.js   configuração do banco privado
│   ├── core/contabil.js     regras contábeis puras (testadas)
│   └── dados/               adaptadores: local, Firebase e banco público
├── dados-publicos/          banco público versionado (JSON)
├── firebase/                regras e índices do Firestore
├── scripts/                 validação do banco público
├── tests/                   testes do núcleo
└── docs/                    estudo, convenções e registro do projeto
```

## Evolução

As mudanças ficam em [`CHANGELOG.md`](CHANGELOG.md). Ideias e próximos passos são
acompanhados nas *issues* do GitHub (modelo "Evolução do sistema contábil").
