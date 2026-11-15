# Formulário de Divinópolis: decisões (versão 8 do formulário, app 2.11.1)

Decidido pelo Ciro em 07/11/2026 e revisto em 15/11/2026 (etapas por parte da árvore).

## Regra geral

Cada categoria mostra só as classes de variáveis que valem para ela. O que não vale para a categoria nem aparece. Todo campo tem ajuda (?) com a explicação; a fiação tem desenho de cada tipo de rede.

## Categorias

Árvore, arbusto e palmeira (altura a partir de 2 m) e calçada sem árvores. Não há local de novo plantio em Divinópolis.

## Árvore, arbusto e palmeira vivos (mesmas regras)

Etapas por parte da árvore, na ordem da tela (formulário 8, decidido pelo Ciro em 15/11/2026, app 2.11.1).

| Etapa | Variáveis |
|---|---|
| Identificação | Local do registro, categoria, foto geral (o indivíduo inteiro). Obrigatórios |
| Indivíduo | Situação, espécie (com "Não tenho certeza da espécie"), CAP, altura total, copa (2 raios, 4 raios ou área, conforme o time). Obrigatórios |
| Meio | Conflitos no raio de 2 m, fiação aérea, marquise ou toldo, interferência no tráfego |
| Copa | Qualidade da copa; galhos secos ou podres (Ausente, 0-25%, 25-50%, 50-75%, acima de 75%); podas (danos por podas, poda drástica); pragas e doenças na copa (fungo, cupim, broca, erva-de-passarinho, doença aparente, praga aparente) |
| Tronco | Danos no tronco (lesões, codominância); ocos e cavidades; pragas no tronco (fungo, cupim, broca) |
| Raízes | Raízes (poda de raiz, afloramento no canteiro, afloramento na calçada); pragas nas raízes (fungo, cupim) |
| Risco | Probabilidade de falha, probabilidade de impacto, consequências; o risco calculado aparece no fim da etapa |
| Manejo | Ao menos uma opção. Se nada for marcado, o app pergunta se confirma "Nenhum" e segue |
| Fotos e observações | Fotos 2 a 5, sem descrição, e observações. Opcionais |

- Em todo grupo de marcar é obrigatório marcar ao menos uma opção ou "Ausente".
- **Regra de alteração**: a divisão das variáveis por etapa só muda com a lista completa aprovada pelo Ciro antes.
- **Campos do formulário anterior** (até a versão 7): fungo, cupim e broca gerais, "fitossanidade ausente" e "galhos secos, podres ou com risco de queda" (de marcar) saíram da tela. Continuam na base e nas exportações para os registros antigos, e aparecem na ficha desses registros em "Formulário anterior".
- Histórico: até a versão 7 as etapas eram Identificação, Indivíduo, Meio, Podas e danos, Fitossanidade, Risco, Manejo, Fotos. O formulário é gerado por `build/divi8.js` a partir do 7.
- **CAP** (circunferência a 1,30 m, com fita), em centímetros. Com mais de um caule, os três mais representativos (os maiores), no máximo 3. Vale para árvore, arbusto e palmeira (ex.: areca). As exportações trazem o CAP equivalente e o DAP calculado (CAP dividido por pi).
- **Copa**: cada usuário escolhe em "Minhas preferências" se mede 4 raios (o app calcula a área) ou a área direto, com trena a laser.
- **Risco**: matriz da ISA, a mesma do formulário da SEADE (falha com impacto dá a probabilidade; com consequências dá o risco: Baixo, Médio, Alto ou Severo), com as cores do mapa e do estilo do QGIS.
- **Espécie não identificada**: obrigatórias as 4 fotos de identificação, com orientação de como fotografar: folha (face de cima), folha (face de baixo), ramo com a filotaxia, detalhe do tronco.

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
