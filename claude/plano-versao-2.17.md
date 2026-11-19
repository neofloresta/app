# Plano de ajustes alinhado com o Ciro em 19/11/2026

Tudo abaixo foi decidido pelo Ciro em conversa, ponto a ponto, em 19/11/2026. A intenção dele é que esta seja a última mudança estrutural. Situação: o Ciro deu o "pode fazer" em 19/11/2026. Entrega 1 feita (formulário 14, app 2.16.5); entrega 2 em andamento.

## Já feito em 19/11/2026

- Formulário 12 (app 2.16.3) e formulário 13 (app 2.16.4), publicados. Ver claude/formulario-divinopolis.md.
- Planilha de Divinópolis zerada dos testes pelo Ciro. Depois disso entraram 13 registros válidos das equipes Neo-1 e Neo-2 (quadra 2833), feitos nos formulários 12 e 13.
- Projeto "Treinamento Gap" (identificador treinamento-gap) criado pelo Ciro, com a camada de quadras copiada de Divinópolis (5.414 quadras, 22.042 faces), time "Treinamento" (parceiro), pessoas "Treinamento Gap" (avaliadora) e "Auxiliar Treinamento", usuários treino e treino-aux. Serve para o treinamento da Gap de 20/11 (até 6 celulares) e para o teste de carga.
- Conector Google Planilhas ligado na conta do Ciro.
- Um formulário 14 que tirava "Rede elétrica" dos alvos foi montado por engano (leitura errada de uma mensagem) e NÃO foi publicado. Foi desfeito: o formulário 14 de verdade (`build/divi14.js`) parte do 13 e mantém a rede elétrica nos alvos.

## Entrega 1: formulário 14 (só formulário)

| Item | O que muda |
|---|---|
| 6 | Fitossanidade (Boa, Regular, Ruim) sai da etapa Raízes e vai para a etapa Identificação, depois da foto geral. A situação (viva ou morta) também vai para a Identificação, antes dela |
| 7 | "Tronco paralelo à fiação elétrica aérea?" vira pergunta própria (Não ou Sim, obrigatória), na etapa Meio, depois da fiação. Some quando a fiação é "Ausente" |
| 18 | Calçada sem árvores só com a foto. Conferido: o formulário já não tinha campo de largura, nada a mudar |

## Entrega 2: versão 2.17 do app e do servidor (o Ciro cola o Code.gs novo)

### Campo

| Item | O que muda |
|---|---|
| 1 | Foto tirada por dentro do app, sem abrir a câmera do celular (o Android fechava o app e a foto se perdia, com aviso de memória). Câmera do celular continua como reserva. Comparar a resolução antes de publicar |
| 2 | Galeria com botão visível na tela de câmera, só para foto geral, fotos de identificação e fotos extras. Encerrar face, sem acesso e chuva: só câmera |
| 3 | Foto para encerrar a face: opcional no time Neofloresta (próprio), obrigatória na Gap (parceiro). Foto de sem acesso continua obrigatória para todos |
| 8 | Copa no time Neofloresta: botões "2 raios" e "Área" sempre visíveis em cada árvore; a árvore nova vem no último jeito usado; o coletor troca quando quiser. Gap continua só com 2 raios |
| 9 | Time Neofloresta: qualquer pessoa do time encerra face, fecha quadra e cadastra árvore onde outra pessoa do time começou. Histórico registra quem fez. Gap não muda |
| 11 | "Concluir": o botão responde na hora ("Salvando...") e trava contra toque repetido; medir cada passo com o mapa de Divinópolis e cortar o gargalo. O "+" fica como está (a espera é do GPS; treinar "Marcar agora" e "Marcar no mapa") |

### Coordenação e auditoria

| Item | O que muda |
|---|---|
| 12 | Coordenação e auditor corrigem a posição de um registro arrastando o ponto no mapa, em qualquer situação (inclusive validado e pago). Recalcula quadra, face e setor; guarda no histórico a coordenada antiga, a distância, quem e quando |
| 15 | "Formação ou registro profissional" do avaliador passa a ser opcional |
| 17 | Prêmio da Neofloresta segue o regulamento: superação de R$ 2,00 (analista) e R$ 1,00 (auxiliar), sem teto, apurada por semana (registros acima de 100 vezes os dias trabalhados). Conferir com a tabela do regulamento: média 130 em 21 dias dá R$ 1.510 e R$ 780; média 150 dá R$ 2.350 e R$ 1.200. Agrupamento e face sem acesso contam para o prêmio |
| 19 | Quadra ganha a situação "Validada", automática: quadra levantada, todos os registros validados, nenhum em validação ou devolvido. Volta a "Levantada" se algo for devolvido ou entrar registro novo. Simbologia por time: Neofloresta em azul, Gap em roxo; claro em levantamento, cheio levantada, cheio com contorno verde e sinal de conferido quando validada. Painel conta quadras por situação e por time. Mandar imagem do mapa para o Ciro aprovar as cores |
| 20 | Ficha, Excel e relatório mostram o texto curto das opções ("Raro"). A explicação aparece só na tela de coleta |

### Planilha

| Item | O que muda |
|---|---|
| 13 | Nada em branco nos campos do inventário. Número que não se aplica grava "NA"; escolha que não se aplica grava "Não se aplica"; caixa de marcar escondida grava 0; tronco paralelo com fiação ausente grava "Não". Ficam vazios só fotos extras e observações. Colunas de controle (validado por, pagamento, datas) seguem sendo preenchidas quando o fato acontece |
| 14 | Colunas de formulário antigo saem do formulário e da planilha (DAP, Fungo, Cupim, Broca, Doença aparente, Praga aparente, Risco nível 1, Nível da avaliação, Principal alvo e as demais marcadas como antigas). Antes de apagar, converter "Principal alvo" para as caixas de alvo nos registros feitos no formulário 12, e a caixa antiga "Tronco paralelo à fiação" marcada para "Sim" na pergunta nova (formulários 12 e 13) |
| 24 | Categoria, probabilidade de falha, probabilidade de impacto e consequências aparecem como palavra na planilha. O app continua usando os códigos por dentro; a troca é só na gravação e na leitura da planilha, e a leitura aceita os dois jeitos. Confirmar antes que toda gravação e leitura passam por um ponto só |
| Ajuste dos dados | Função "ajustar registros antigos", rodada uma vez pelo Ciro no Apps Script: aplica 13, 14 e 24 aos registros já coletados. Mostrar ao Ciro o que muda antes de rodar |

### Só cadastro, feito pelo Ciro na Coordenação (com passo a passo)

| Item | O que muda |
|---|---|
| 16 | Parceiro: avaliador em dupla 60% (R$ 1,20 e R$ 0,80), sozinho R$ 2,00, Gap R$ 0,50. Mesmo valor para árvore, agrupamento, face sem árvore e face sem acesso. Já apresentado à Gap |
| 17 | Valores do prêmio da Neofloresta no projeto, com data de início |

## Entrega 3: teste de carga na planilha de verdade (item 23)

No projeto "Treinamento Gap", depois do treinamento: script simulando de 6 a 10 celulares até cerca de 20 mil árvores, medindo envio, abertura do mapa e do painel e recusas do Google. Zerar o projeto no fim. Meta do Ciro: a base de 20 mil árvores tem de funcionar no celular e no painel. Caminho sugerido por ele, se pesar: o celular do coletor deixa de carregar as árvores das quadras já validadas e mostra só a quadra como validada.

## Entrega 4: giro do mapa (item 5)

Giro com dois dedos, como no Google Maps, com botão de bússola para voltar ao norte, só no mapa do coletor no celular. Fora desta rodada: depois da 2.17 estável, teste separado do complemento de giro com o mapa de Divinópolis, resultado mostrado ao Ciro antes de publicar. Ele considera que ajuda muito em campo.

## Fica para depois

- Painel de orçamento, só para a coordenação (item 22). Falta o Ciro dizer qual conta, contra qual valor e se mostra previsão.
- App nativo só para o coletor, com coordenação e painel no navegador. Ideia aprovada em princípio pelo Ciro; planejar junto com a troca do servidor em planilha (necessária para a Cemig).
- Regulamento do prêmio: na próxima renovação de 30 dias, incluir no item 4 o agrupamento e a face sem acesso. Gerar em Word e PDF quando o Ciro pedir.

## Retirados

- Tirar "Rede elétrica" dos alvos: foi leitura errada; a rede continua nos alvos.
- Opção "Sem defeito aparente": o Ciro decidiu que sempre há um defeito apontado.
- Aceitar a marca "Em validação" em quadra com equipe: era sugestão do Claude, não pedido do Ciro; virou o item 19 (situação "Validada").
