# Ponto & Ganhos

App web (PWA) para registrar o ponto de trabalho e acompanhar, em tempo real, o valor ganho no dia.

## Como usar

Abra `index.html` em qualquer navegador de celular (Android ou iPhone) ou publique a pasta em um servidor
estático (GitHub Pages, Netlify, Vercel, etc.). Como é uma PWA, o navegador oferece a opção
**"Adicionar à tela inicial"**, permitindo instalar o app e usá-lo offline em qualquer aparelho.

Para testar localmente:

```bash
cd time-tracking-app
python3 -m http.server 8080
# acesse http://localhost:8080 no navegador do celular (mesma rede) ou no seu computador
```

## Regras de cálculo

- Valor da hora: **R$ 8,50**
- Após as **22h**, acréscimo de **20%** sobre o valor da hora (R$ 10,20/h) até a meia-noite,
  quando volta ao valor normal (o adicional se repete todo dia, caso o expediente ultrapasse
  mais de uma virada de 22h).
- Passar da meia-noite **não encerra** o expediente automaticamente — o cronômetro e o valor
  ganho continuam contando normalmente. Só é encerrado quando o botão é clicado pela 4ª vez.

## Fluxo do botão (4 cliques)

1. **Iniciar Expediente** — marca o início do trabalho.
2. **Marcar Intervalo** — marca o início do intervalo (pausa).
3. **Encerrar Intervalo** — marca o fim do intervalo, retomando o trabalho.
4. **Encerrar Expediente** — marca o fim do serviço e trava o valor final do dia.

Depois do 4º clique, o botão "Iniciar novo dia" reseta o app para um novo expediente.

## Persistência

O estado (marcações e valores) é salvo em `localStorage`, então fechar o navegador ou o app
não perde o progresso do dia — ao reabrir, o cronômetro e o valor continuam de onde pararam.

## Arquivos

- `index.html` / `style.css` — interface do app.
- `app.js` — lógica do ponto, cálculo de ganhos e persistência.
- `manifest.json` / `service-worker.js` / `icons/` — suporte a PWA (instalação e uso offline).
