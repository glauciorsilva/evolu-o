# Resumo de estudo: como o sistema aplica a contabilidade

Cada tópico aponta onde a regra foi implementada, para estudar teoria e código juntos.

## 1. Plano de contas

- **Grupos** (primeiro dígito do código): 1 Ativo, 2 Passivo, 3 Patrimônio Líquido,
  4 Receitas, 5 Custos, 6 Despesas. Grupos 1–3 são **contas patrimoniais**; 4–6 são
  **contas de resultado**.
- **Sintética (S)**: agrupa outras contas, não recebe lançamento. Seu saldo é a soma das
  subcontas (identificadas pelo prefixo do código: `1.1.1.01` pertence a `1.1.1`).
- **Analítica (A)**: último nível, é a única que recebe lançamentos.
- **Natureza**: devedora (D) aumenta a débito; credora (C) aumenta a crédito.
  Ativo, custos e despesas são devedoras; passivo, PL e receitas são credoras.
- **Retificadoras**: têm natureza oposta ao grupo e reduzem o saldo dele. Exemplos:
  `(-) Depreciação Acumulada` (credora dentro do Ativo) e `(-) Capital a Integralizar`
  (devedora dentro do PL).

Código: `validarConta`, `pertenceA`, `compararCodigos` em `js/core/contabil.js`.

## 2. Método das partidas dobradas

"Não há devedor sem credor": todo fato contábil é registrado com débitos e créditos de
mesmo valor total. Por isso o balancete sempre fecha.

| Fórmula | Débitos | Créditos | Exemplo |
| --- | --- | --- | --- |
| 1ª | 1 | 1 | Pagamento de aluguel |
| 2ª | 1 | vários | Pagamento a fornecedor com desconto obtido |
| 3ª | vários | 1 | Venda parte à vista, parte a prazo |
| 4ª | vários | vários | Folha com retenções e encargos no mesmo lançamento |

Código: `validarLancamento` e `formulaDoLancamento`. Os valores são guardados em
**centavos inteiros** para evitar erros como `0,1 + 0,2 = 0,30000000000000004`.

## 3. Livros

- **Diário**: todos os lançamentos em ordem cronológica (livro obrigatório, art. 1.180 do
  Código Civil).
- **Razão**: movimento de uma conta com saldo acumulado; no papel, é o famoso "razonete"
  (conta em T). Função `razao`.

## 4. Balancete de verificação

Lista cada conta com saldo anterior, débitos, créditos e saldo atual. Confere duas coisas:
total de débitos = total de créditos e soma dos saldos devedores = soma dos credores.
Função `balancete`.

## 5. Demonstração do Resultado (DRE)

Receita bruta − deduções = receita líquida − custos = lucro bruto − despesas operacionais
± resultado financeiro = resultado antes do IRPJ/CSLL − tributos = **resultado líquido**
(Lei 6.404/76, art. 187). Pelo **regime de competência**, receitas e despesas entram no
período em que acontecem, não quando o dinheiro entra ou sai.

Função `dre` (a estrutura está em `ESTRUTURA_DRE`).

## 6. Encerramento do exercício e Balanço Patrimonial

No fim do exercício as contas de resultado são zeradas e o saldo vai para o PL
(`Lucros Acumulados` ou `(-) Prejuízos Acumulados`). Função `gerarEncerramento`.

O balanço mostra Ativo = Passivo + PL. Antes do encerramento, o sistema exibe o
"Resultado do exercício (não encerrado)" dentro do PL para a equação continuar fechando.
A DRE ignora o lançamento de encerramento, senão o resultado apareceria zerado.

## 7. Empresa de exemplo (setembro/2026)

| Nº | Fato | Débito | Crédito |
| --- | --- | --- | --- |
| 1 | Capital integralizado no banco | Bancos 50.000 | Capital Social 50.000 |
| 5 | Venda: 6.000 à vista + 9.000 a prazo | Caixa 6.000; Clientes 9.000 | Receita de Vendas 15.000 |
| 6 | Baixa do custo | CMV 9.000 | Mercadorias 9.000 |
| 8 | Paga fornecedor com desconto | Fornecedores 10.000 | Bancos 9.800; Descontos Obtidos 200 |
| 13 | Depreciação 10% a.a. de 8.000 | Depreciação 66,67 | (-) Depreciação Acumulada 66,67 |

Resultado do mês: receita líquida 14.100 − CMV 9.000 = lucro bruto 5.100; despesas
operacionais 6.156,67; resultado financeiro +155 ⇒ **prejuízo de R$ 901,67**.
Os testes em `tests/contabil.test.js` conferem exatamente esses números.

## Referências

- Lei 6.404/76 (Lei das S.A.), arts. 176 a 187
- ITG 2000 (R1) – Escrituração Contábil
- NBC TG Estrutura Conceitual e NBC TG 26 – Apresentação das Demonstrações Contábeis
- Plano de Contas Referencial da ECD (SPED Contábil)
