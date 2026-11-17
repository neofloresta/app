# Formulário de Divinópolis: decisões (versão 9 do formulário, app 2.12.0)

Decidido pelo Ciro em 07/11/2026, revisto em 15/11/2026 (etapas por parte da árvore) e em 17/11/2026 (fitossanidade, cadastro rápido e quadra sem acesso).

## Regra geral

Cada categoria mostra só as classes de variáveis que valem para ela. O que não vale para a categoria nem aparece. Todo campo tem ajuda (?) com a explicação; a fiação tem desenho de cada tipo de rede.

## Categorias

Árvore, arbusto e palmeira (altura a partir de 2 m) e calçada sem árvores. Não há local de novo plantio em Divinópolis.

## Árvore, arbusto e palmeira vivos (mesmas regras)

Etapas por parte da árvore, na ordem da tela (cadastro completo, avaliação de risco nível 2).

| Etapa | Variáveis |
|---|---|
| Identificação | Local do registro, categoria, foto geral (o indivíduo inteiro). Obrigatórios |
| Indivíduo | Situação, espécie (com "Não tenho certeza da espécie"), CAP, altura total, copa (2 raios, 4 raios ou área, conforme o time). Obrigatórios |
| Meio | Conflitos no raio de 2 m, fiação aérea, marquise ou toldo, interferência no tráfego |
| Copa | Qualidade da copa; galhos secos ou podres (Ausente, 0-25%, 25-50%, 50-75%, acima de 75%); podas (danos por podas, poda drástica); pragas na copa (fungo, cupim, broca, erva-de-passarinho) |
| Tronco | Danos no tronco (lesões, codominância); ocos e cavidades; pragas no tronco (fungo, cupim, broca) |
| Raízes | Raízes (poda de raiz, afloramento no canteiro, afloramento na calçada); pragas nas raízes (fungo, cupim); fitossanidade (Boa, Regular, Ruim), nota da árvore inteira |
| Risco | Probabilidade de falha, probabilidade de impacto, consequências; o risco calculado aparece no fim da etapa |
| Manejo | Ao menos uma opção. Se nada for marcado, o app pergunta se confirma "Nenhum" e segue |
| Fotos e observações | Fotos 2 a 5, sem descrição, e observações. Opcionais |

- Em todo grupo de marcar é obrigatório marcar ao menos uma opção ou "Ausente".
- **Regra de alteração**: a divisão das variáveis por etapa só muda com a lista completa aprovada pelo Ciro antes.
- **Campos do formulário anterior** (até a versão 7): fungo, cupim e broca gerais, "fitossanidade ausente" e "galhos secos, podres ou com risco de queda" (de marcar) saíram da tela. Continuam na base e nas exportações para os registros antigos, e aparecem na ficha desses registros em "Formulário anterior".
- Histórico: até a versão 7 as etapas eram Identificação, Indivíduo, Meio, Podas e danos, Fitossanidade, Risco, Manejo, Fotos. O formulário 8 foi gerado por `build/divi8.js` a partir do 7, e o 9 por `build/divi9.js` a partir do 8. "Doença aparente" e "Praga aparente" também ficaram só na base, para registros antigos.
- **CAP** (circunferência a 1,30 m, com fita), em centímetros. Com mais de um caule, os três mais representativos (os maiores), no máximo 3. Vale para árvore, arbusto e palmeira (ex.: areca). As exportações trazem o CAP equivalente e o DAP calculado (CAP dividido por pi).
- **Copa**: cada usuário escolhe em "Minhas preferências" se mede 4 raios (o app calcula a área) ou a área direto, com trena a laser.
- **Risco**: matriz da ISA, a mesma do formulário da SEADE (falha com impacto dá a probabilidade; com consequências dá o risco: Baixo, Médio, Alto ou Severo), com as cores do mapa e do estilo do QGIS.
- **Espécie não identificada**: obrigatórias as 4 fotos de identificação, com orientação de como fotografar: folha (face de cima), folha (face de baixo), ramo com a filotaxia, detalhe do tronco.

## Fitossanidade (formulário 9)

Nota da árvore inteira, no lugar de "Doença aparente" e "Praga aparente". Boa: sem sinais de praga ou doença. Regular: sinais leves ou localizados, sem comprometer a árvore. Ruim: ataque intenso ou generalizado, com comprometimento visível. "Qualidade da copa" e as pragas por parte continuam.

## Cadastro rápido: face com calçada irregular (formulário 9)

A equipe marca a face no mapa como "Calçada irregular" (relevo, piso, obstrução), com o motivo em texto livre. Toda árvore dessa face abre no cadastro rápido, sem perguntar de novo; a tela avisa e tem o botão "Fazer o completo" para a árvore que não for dessa calçada.

- Campos: local do registro, categoria, ponto, foto geral, situação, espécie (com as fotos de identificação quando não identificada), CAP, altura, fitossanidade e risco.
- Risco: um campo só (Baixo, Médio, Alto, Severo), com a nota "Avaliação de risco nível 1 (ABNT NBR 16246-3): visual, sem a matriz". Ninguém escreve nada.
- A coluna "Nivel da avaliacao" é preenchida pelo app: 1 no cadastro rápido, 2 no completo. O risco do nível 1 fica na coluna "Risco nivel 1", separada do risco calculado pela matriz (nível 2). No mapa as duas usam as mesmas cores; no painel e no relatório são contadas à parte.
- Pagamento árvore a árvore, igual ao cadastro completo.
- Face irregular sem nenhuma árvore: "Sem árvores (só a foto)", como qualquer face. O app separa sozinho "calçada irregular com árvores" e "sem árvores".

## Quadra sem acesso (formulário 9)

Quadra onde a equipe não entra (condomínio fechado, área particular). A equipe marca pela ficha da quadra no mapa: um cadastro só, com a foto da entrada (obrigatória) e o motivo em texto livre. As faces que faltavam ficam marcadas como sem acesso e a quadra é fechada. O cadastro passa pelo auditor (ele confere a foto) e conta uma vez por face para o pagamento: quadra de 4 faces vale 4 registros de face. A categoria "Sem acesso" não aparece na escolha de categoria do cadastro comum.

## Mortos (árvore, arbusto ou palmeira)

Só o ponto (coordenada) e a foto geral. Nada mais aparece.

## Calçada sem árvores

Ponto, foto da calçada inteira no sentido do comprimento e largura da calçada (m), obrigatória.

## Unidades e valores fora do comum

CAP em centímetros; todo o resto em metros (m² para área). Fora destes limites o app pede confirmação ("Corrigir" ou "Está certo"); altura abaixo de 2 m bloqueia (critério de inclusão).

| Campo | Mínimo | Máximo |
|---|---|---|
| CAP | 2 cm | 900 cm |
| Altura | 2 m (bloqueia) | 40 m |
| Raio de copa | 0,1 m | 20 m |
| Área de copa medida | 1 m² | 1.200 m² |
| Largura da calçada | 0,5 m | 10 m |
