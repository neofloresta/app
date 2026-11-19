# Formulário de Divinópolis: decisões (versão 14 do formulário, app 2.16.5)

Decidido pelo Ciro em 07/11/2026, revisto em 15/11/2026 (etapas por parte da árvore), em 17/11/2026 (fitossanidade e quadra sem acesso), em 18/11/2026 (sai a calçada irregular, sem acesso por face e agrupamento) e em 19/11/2026 (área livre, posição na calçada, colo soterrado, alvo e defeito da ISA; fitossanidade na Identificação e tronco paralelo como pergunta própria).

## Regra geral

Cada categoria mostra só as classes de variáveis que valem para ela. O que não vale para a categoria nem aparece. Todo campo tem ajuda (?) com a explicação; a fiação tem desenho de cada tipo de rede.

## Categorias

Árvore, arbusto, palmeira e agrupamento (altura a partir de 2 m), calçada sem árvores e sem acesso. Não há local de novo plantio nem praças em Divinópolis. "Sem acesso" não aparece na escolha de categoria do cadastro comum: o app abre esse cadastro pela ficha da face ou da quadra no mapa.

## Árvore, arbusto e palmeira vivos (mesmas regras)

Etapas por parte da árvore, na ordem da tela (cadastro completo, avaliação de risco nível 2).

| Etapa | Variáveis |
|---|---|
| Identificação | Local do registro, categoria, foto geral (o indivíduo inteiro) e fitossanidade (Boa, Regular, Ruim), nota da árvore inteira. Obrigatórios |
| Indivíduo | Situação, espécie (com "Não tenho certeza da espécie"), CAP, altura total, copa (2 raios, 4 raios ou área, conforme o time). Obrigatórios |
| Meio | Área livre, posição da árvore na calçada, conflitos no raio de 2 m, fiação aérea, tronco paralelo à fiação elétrica aérea (Não ou Sim; não aparece com fiação ausente), marquise ou toldo, interferência no tráfego |
| Copa | Qualidade da copa; galhos secos ou podres (Ausente, 0-25%, 25-50%, 50-75%, acima de 75%); podas (danos por podas, poda drástica); pragas na copa (fungo, cupim, broca, erva-de-passarinho) |
| Tronco | Danos no tronco (lesões, codominância); ocos e cavidades; pragas no tronco (fungo, cupim, broca) |
| Raízes | Raízes (poda de raiz, afloramento no canteiro, na calçada e na via, colo soterrado); pragas nas raízes (fungo, cupim) |
| Alvo | Alvos na zona (de marcar, todos os que existem), zona do alvo, taxa de ocupação, fator de proteção |
| Risco | Principal defeito da árvore, carga sobre o defeito, probabilidade de falha, probabilidade de impacto e consequências; o risco calculado aparece no fim da etapa |
| Manejo | Ao menos uma opção. Se nada for marcado, o app pergunta se confirma "Nenhum" e segue |
| Fotos e observações | Fotos 2 a 5, sem descrição, e observações. Opcionais |

- Em todo grupo de marcar é obrigatório marcar ao menos uma opção ou "Ausente".
- **Regra de alteração**: a divisão das variáveis por etapa só muda com a lista completa aprovada pelo Ciro antes.
- **Campos do formulário anterior** (até a versão 7): fungo, cupim e broca gerais, "fitossanidade ausente" e "galhos secos, podres ou com risco de queda" (de marcar) saíram da tela. Continuam na base e nas exportações para os registros antigos, e aparecem na ficha desses registros em "Formulário anterior".
- Histórico: até a versão 7 as etapas eram Identificação, Indivíduo, Meio, Podas e danos, Fitossanidade, Risco, Manejo, Fotos. O formulário 8 foi gerado por `build/divi8.js` a partir do 7, o 9 por `build/divi9.js`, o 10 por `build/divi10.js`, o 11 por `build/especies11.py` (lista de 516 espécies) o 12 por `build/divi12.js`, o 13 por `build/divi13.js` e o 14 por `build/divi14.js`. "Doença aparente" e "Praga aparente" também ficaram só na base, para registros antigos.
- **CAP** (circunferência a 1,30 m, com fita), em centímetros. Com mais de um caule, os três mais representativos (os maiores), no máximo 3. Vale para árvore, arbusto e palmeira (ex.: areca). As exportações trazem o CAP equivalente e o DAP calculado (CAP dividido por pi).
- **Copa**: cada usuário escolhe em "Minhas preferências" se mede 4 raios (o app calcula a área) ou a área direto, com trena a laser.
- **Risco**: matriz da ISA, a mesma do formulário da SEADE (falha com impacto dá a probabilidade; com consequências dá o risco: Baixo, Médio, Alto ou Severo), com as cores do mapa e do estilo do QGIS.
- **Espécie não identificada**: obrigatórias as 4 fotos de identificação, com orientação de como fotografar: folha (face de cima), folha (face de baixo), ramo com a filotaxia, detalhe do tronco.

## Campos do formulário 12 (19/11/2026)

Vieram do modelo antigo do QGIS (inv_eneas). Só o formulário mudou: o risco continua saindo da mesma matriz, e os campos novos não entram no cálculo. Valem para árvore, arbusto, palmeira e agrupamento. Todos obrigatórios (os de marcar entram no grupo, que exige uma opção ou "Ausente").

| Campo | Etapa | Opções |
|---|---|---|
| Área livre (m²) | Meio | Menor que 1 m², 1 a 2 m², 2 a 3 m², Maior que 3 m² |
| Posição da árvore na calçada | Meio | Até 1 m do meio-fio, Faixa de circulação, Junto ao muro ou divisa. Não aparece no canteiro central |
| Tronco paralelo à fiação | Meio, grupo Fiação aérea | de marcar (até o formulário 13; no 14 virou pergunta própria) |
| Colo soterrado | Raízes, grupo Raízes | de marcar |
| Afloramento da raiz na via | Raízes, grupo Raízes | de marcar |
| Zona do alvo | Alvo | Projeção da copa, 1 vez a altura, 1,5 vez a altura |
| Taxa de ocupação | Alvo | Raro, Ocasional, Frequente, Constante |
| Fator de proteção | Alvo | Ausente, Presente |
| Principal defeito da árvore | Risco | Raízes e colo, Tronco, Copa e galhos |
| Carga sobre o defeito | Risco | Pequena, Média, Significativa |

- **Zona do alvo** (definição do Ciro): 1,5 vez a altura vale para indivíduos maiores, por causa dos estilhaços em uma eventual queda.
- **Colo soterrado** (definição do Ciro): não dá para ver a forma de funil do colo, que é sempre um pouco mais largo que o resto do tronco.
- Os textos de ajuda dos campos de alvo e defeito seguem os conceitos da ficha da ISA.
- **Ficaram de fora, por decisão do Ciro**: altura da bifurcação, largura da calçada (na árvore), desequilíbrio da copa, galhos epicórmicos, inclinação, casca, rachadura, restrição da área de risco, condições de preocupação e a opção "Praças".

## Formulário 13 (19/11/2026, depois de ver o 12 na tela)

- **Etapa Alvo** separada da etapa Risco (são 10 etapas). Defeito e carga ficam na Risco, porque embasam a probabilidade de falha.
- **Alvos na zona**: no lugar de "Principal alvo" (era difícil eleger um só), grupo de marcar com todos os alvos que existem, ao menos um obrigatório: Pessoas, Veículos estacionados, Veículos em movimento, Edificação, Rede elétrica ou de serviços, Outros. Com mais de um alvo, taxa de ocupação e fator de proteção são respondidos pelo mais exposto.
- **Explicação dentro de cada opção** (como em probabilidade de falha) em zona do alvo, taxa de ocupação, fator de proteção, principal defeito e carga sobre o defeito. O valor gravado continua o curto ("Raro", "Presente"); a ficha e o Excel legível mostram o texto com a explicação.
- "Principal alvo" ficou só na base, como campo de formulário anterior.

## Formulário 14 (19/11/2026, à noite, com a coleta em campo)

- **Fitossanidade** saiu da etapa Raízes e foi para a Identificação, logo depois da foto geral. Como a situação (viva ou morta) vem na etapa seguinte, a nota aparece também para a árvore morta; ao marcar "Morta" ela some e o valor é descartado.
- **Tronco paralelo à fiação elétrica aérea?** virou pergunta própria (Não ou Sim, obrigatória), na etapa Meio, depois do grupo da fiação. Com "Fiação ausente" marcada, a pergunta não aparece e hoje fica vazia na planilha (a 2.17 passa a gravar "Não"). A caixa de marcar dos formulários 12 e 13 ficou só na base.
- A rede elétrica continua entre os alvos na zona.
- Calçada sem árvores: o formulário já não tinha campo de largura (só a foto); nada a mudar.

## Fitossanidade (formulário 9)

Nota da árvore inteira, no lugar de "Doença aparente" e "Praga aparente". Boa: sem sinais de praga ou doença. Regular: sinais leves ou localizados, sem comprometer a árvore. Ruim: ataque intenso ou generalizado, com comprometimento visível. "Qualidade da copa" e as pragas por parte continuam.

## Agrupamento (formulário 10)

Muitos indivíduos juntos: cerca-viva, ou calçada sem uso com 50 a 60 indivíduos de leucena, por exemplo. É um registro só, com um ponto, e vale as mesmas regras da árvore, com estas diferenças:

- **Quantidade estimada de indivíduos**: campo novo, obrigatório, por contagem visual.
- **CAP**: de 3 indivíduos escolhidos por média visual (um por linha, no máximo 3).
- **Altura**: altura média do agrupamento.
- **Espécie**: uma só para o grupo todo.
- Todas as demais variáveis seguem, avaliadas pela média visual do grupo. O risco é avaliado uma vez, para o agrupamento todo (matriz de nível 2).
- Pagamento: vale 1 registro, como uma árvore, depois do auditor.
- Painel e relatório: os agrupamentos aparecem à parte ("N agrupamentos, com cerca de X indivíduos, por estimativa visual") e não somam nos indivíduos medidos.

## Sem acesso: face ou quadra (formulário 10)

Onde a equipe não entra (condomínio fechado, área particular, relevo, obra). Cadastro só com **foto** (obrigatória) e **motivo** escolhido na lista: Condomínio ou área particular, Relevo, Obra ou interdição, Outro (pede o texto). Sem ponto e sem quantidade de árvores. O auditor confere a foto.

- **Face**: pela ficha da face, "Sem acesso (foto e motivo)". Só aquela face fica marcada. Se a face já tem árvore cadastrada, o app pede para encerrá-la antes.
- **Quadra**: pela ficha da quadra. As faces que faltavam ficam marcadas e a quadra é fechada.
- Pagamento: cada face sem acesso vale 1 registro de face, depois do auditor (quadra de 4 faces vale 4).

A calçada irregular e o cadastro rápido (risco nível 1) foram retirados na versão 10 do formulário e na 2.16.0 do app.

## Mortos (árvore, arbusto ou palmeira)

Só o ponto (coordenada) e a foto geral. Nada mais aparece.

## Calçada sem árvores

Ponto e foto da calçada inteira no sentido do comprimento. Não há campo de largura.

## Unidades e valores fora do comum

CAP em centímetros; todo o resto em metros (m² para área). Fora destes limites o app pede confirmação ("Corrigir" ou "Está certo"); altura abaixo de 2 m bloqueia (critério de inclusão).

| Campo | Mínimo | Máximo |
|---|---|---|
| CAP | 2 cm | 900 cm |
| Altura | 2 m (bloqueia) | 40 m |
| Raio de copa | 0,1 m | 20 m |
| Área de copa medida | 1 m² | 1.200 m² |
| Largura da calçada | 0,5 m | 10 m |
| Quantidade estimada (agrupamento) | 2 | 500 (aviso) |
