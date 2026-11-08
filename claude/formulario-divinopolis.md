# Formulário de Divinópolis: decisões (versão 5 do formulário, app 2.4)

Decidido pelo Ciro em 07/11/2026. O formulário é gerado por `build/divi5.js`.

## Regra geral

Cada categoria mostra só as classes de variáveis que valem para ela. O que não vale para a categoria nem aparece. Todo campo tem ajuda (?) com a explicação; a fiação tem desenho de cada tipo de rede.

## Categorias

Árvore, arbusto e palmeira (altura a partir de 2 m) e calçada sem árvores. Não há local de novo plantio em Divinópolis.

## Árvore, arbusto e palmeira vivos (mesmas regras)

| Classe | Obrigatório |
|---|---|
| Identificação | Local do registro, categoria, foto geral (o indivíduo inteiro) |
| Indivíduo | Situação, espécie, CAP, altura total, copa |
| Meio | Conflitos no raio de 2 m, fiação aérea, marquise ou toldo, interferência no tráfego |
| Podas e danos | Podas, danos no tronco, ocos e cavidades, raízes |
| Fitossanidade e risco | Qualidade da copa, pragas e doenças, probabilidade de falha, probabilidade de impacto, consequências; o risco é calculado |
| Manejo | Ao menos uma opção. Se nada for marcado, o app pergunta se confirma "Nenhum" e segue |
| Fotos e observações | Observações e fotos 2 a 4, opcionais |

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
