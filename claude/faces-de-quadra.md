# Faces de quadra (app 2.5)

Decidido pelo Ciro em 07 e 08/11/2026. As faces são geradas por `claude/poc/fixtures/quadras_faces.py` a partir das linhas de logradouro da prefeitura.

## O que é uma face

Cada lado de uma quadra voltado para uma rua, com o nome da rua e o comprimento em metros. Em Divinópolis são 22.042 faces em 5.414 quadras, cerca de 2.080 km de calçada. A numeração das quadras é a mesma da camada importada antes, então a situação já marcada continua valendo.

A face se chama pelo número da quadra e uma letra: 2459-B é a face B da quadra 2459. Faces de esquina com menos de 8 m entram na face vizinha.

## Situações

| Situação | Como chega |
|---|---|
| A levantar | Início |
| Em levantamento | Sozinha, ao salvar uma árvore perto da face (ver abaixo), ou marcada no mapa |
| Levantada | Marcada no mapa pela equipe |
| Levantada, sem árvores | Pelo cadastro de calçada sem árvores: foto da calçada inteira no comprimento e largura (m). Substitui o ponto de calçada sem árvores |

A quadra acompanha as faces: com todas as faces levantadas ela fica levantada; com uma face começada ela fica em levantamento; uma face reaberta reabre a quadra; se todas voltarem para "a levantar", a quadra levantada volta também. Quadra marcada à mão como levantada não mexe nas faces.

## Começo automático pelo GPS

Ao salvar uma árvore, a face da calçada passa a "em levantamento" sozinha só quando não há dúvida:

- erro do GPS até 10 m (ou posição ajustada à mão no mapa);
- a face mais perto está a menos de 15 m;
- nenhuma outra face está a menos de 8 m além dessa.

Os três valores podem ser mudados por projeto em Coordenação > Projetos > Editar, conforme a operação pedir ajuste. O fim da face é sempre manual.

## Equipes

- Cada dupla é um login e uma equipe.
- A equipe pode pegar uma face sem equipe, desde que a quadra não seja de outra equipe; face ou quadra de outra equipe fica só para consulta.
- Para uma equipe fazer o lado de uma rua em quadras de outras equipes, a coordenação passa essas faces para ela (escolher o lado todo da rua e definir a equipe).
- A quadra levantada pelas faces fica com a equipe que fez, se ainda não tinha equipe.
- A coordenação define a equipe de uma face, de várias ou do lado todo de uma rua.
- "Escolher o lado todo da rua" pega todas as faces do mesmo lado daquela rua, em toda a cidade (ex.: um lado de uma avenida de 5 km).

## Onde aparece

- Mapa: linhas coloridas sobre o contorno das quadras a partir do zoom 16; tracejado azul para levantada sem árvores.
- Painel: quilômetros de calçada levantados, no total e por equipe (faces marcadas pela coordenação sem equipe aparecem como "Sem equipe"). Para o boletim de medição, vale o Excel, em metros.
- Tela inicial da equipe: quilômetros levantados pela equipe.
- Exportação em Excel: aba "Faces de quadra" (face, quadra, rua, comprimento, equipe, situação, quem marcou, quando, largura da calçada e o cadastro ligado).
- Planilha do projeto: aba "Faces", só com as faces já mexidas.
