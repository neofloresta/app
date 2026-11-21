# Passo a passo da versão 2.18

Publicada em 21/11/2026. O app já está no ar em https://neofloresta.github.io/app/. Falta a parte do servidor, que é manual.

## Ordem (importa)

1. **Colar o Code.gs 2.18 no Apps Script**
   - Abrir o projeto do Apps Script, apagar todo o conteúdo do arquivo Code.gs e colar o arquivo novo.
   - Salvar.
   - Implantar, Gerenciar implantações, lápis (editar), Versão: Nova versão, Implantar.
   - Conferir: no app, menu, Sobre. Deve aparecer "versão 2.18.0 · servidor 2.18".

2. **Atualizar o formulário**
   - Entrar como administrador, menu, Formulários.
   - Tocar em "Atualizar formulários prontos". O formulário de Divinópolis passa para a versão 16.

3. **Ajustar registros antigos** (com a coleta parada, de noite)
   - Na mesma tela, "Ajustar registros antigos".
   - Conferir a prévia: saem as colunas "Manejo remoção do alvo", "Manejo suporte complementar" e "Manejo avaliação nível 2 ou 3" (a marca desta última passa para "Manejo avaliação nível 3").
   - Se o app avisar que algum registro foi pulado, as colunas antigas ficam na planilha. É só rodar de novo.

Enquanto o passo 1 não for feito, o app 2.18 funciona com o servidor 2.17; só não mostra a espécie conferida para o coletor.
Enquanto o passo 2 não for feito, não aparece a categoria Fragmento florestal.

## O que mudou

- Conferência do ponto: em toda árvore, depois de o GPS marcar (meta de 4 m), abre o satélite em cima do ponto e pergunta "É aqui que a árvore está?". Só vira "ajustado no mapa" se a pessoa arrastar.
- Satélite guardado: o celular baixa a imagem das quadras da equipe (quadra mais 15 m, até 12 quadras) e apaga quando a quadra fecha ou sai da equipe. Precisa abrir o app com internet depois que a quadra é aprovada.
- Fotos: o app apaga sozinho do celular a foto que o servidor confirmou há mais de 3 dias, depois de conferir de novo foto por foto. O cadastro fica no celular e a foto fica no Drive.
- Mapa: o ponto azul fica por cima de tudo; copa grande fica translúcida com o pé da árvore marcado; árvore menor desenhada por cima da maior.
- Zoom na câmera do app (1x a 4x, conforme o aparelho).
- iPhone: a medida da altura pelo celular passa a funcionar (permissão do sensor pedida no toque e sinal da gravidade corrigido).
- Espécie conferida pela coordenação aparece na lista do coletor.
- Formulário 16: categoria Fragmento florestal (igual ao agrupamento, sem espécie); manejo sem remoção do alvo e suporte complementar; avaliação só de nível 3.

## Conferir em campo

- Num iPhone real: instalar pela Tela de Início, medir uma altura (tocar em Permitir quando o iPhone perguntar), tirar foto pelo app com zoom, marcar um ponto e ver quanto tempo o GPS leva para chegar a 4 m.
- Numa quadra cheia: ver se a transparência das copas e o tamanho dos pontos estão bons.
- Com o celular em modo avião dentro de uma quadra da equipe: a conferência do ponto deve abrir com o satélite.

## Limites conhecidos

- Não foi possível testar em Safari de verdade; o iPhone foi simulado.
- Imagem de satélite da Esri vai até o zoom 18. Melhor que isso, só ortofoto da prefeitura ou imagem própria. A licença da Esri para guardar imagem no aparelho não foi revisada.
- No iPhone, o app precisa estar instalado na Tela de Início e o envio das fotos para quando a tela bloqueia.
- Arrastar o mapa continua acima da meta no teste de celular fraco (cerca de 1 s, meta 0,8 s).
- A conferência do ponto não grava na planilha quais pontos foram conferidos no satélite; só os ajustados.
