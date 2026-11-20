# Passo a passo da versão 2.17 (para o Ciro)

O app 2.17.0 já está publicado desde a madrugada de 20/11/2026. Enquanto o servidor não for atualizado, ele grava como antes e as funções novas que dependem do servidor avisam "atualize o Code.gs".

## Antes de colar o Code.gs, não faça

- Cadastrar pessoa sem registro profissional (o servidor antigo recusa).
- Gravar teto 0 no prêmio (no servidor antigo vira superação zero).
- Rodar o "Ajustar registros antigos" (o app nem deixa).

## Parte 1: colar o Code.gs (de manhã, antes do treinamento)

1. Abra o projeto do Apps Script do servidor.
2. Abra o arquivo Code.gs, selecione tudo (Ctrl+A) e apague.
3. Cole o conteúdo do arquivo Code.gs novo (o da versão 2.17) e salve (Ctrl+S).
4. Implantar > Gerenciar implantações > lápis (editar) > em Versão escolha "Nova versão" > Implantar. O endereço do servidor não muda.
5. No app, abra Menu > Sobre. Tem de aparecer "versão 2.17.0 · servidor 2.17". Se ainda mostrar 2.16, feche e abra o app.

## Parte 2: atualizar o formulário

1. Coordenação > Formulários > "Atualizar formulários prontos".
2. Confira no formulário de Divinópolis: versão 15, 102 campos.
3. Os celulares recebem o formulário novo ao abrir o app com internet.

## Parte 3: conferir os times

Coordenação > Equipes e usuários. Neo-1 e Neo-2 precisam estar com o time "Neofloresta". Sem o time, uma equipe não encerra a face da outra.

## Parte 4: ajustar os registros antigos (à noite, com a coleta parada)

1. Abra o projeto que vai ajustar (PMAU Divinópolis).
2. Coordenação > Formulários > "Ajustar registros antigos".
3. Leia a tela: quantos registros mudam e quais colunas saem. Devem sair só colunas de formulário antigo (DAP, Fungo, Cupim, Broca, Doença aparente, Praga aparente, Largura da calçada, Principal alvo e semelhantes).
4. Toque em "Ajustar agora". O servidor guarda uma cópia da planilha na pasta Backup antes de gravar.
5. Se aparecer "registros pulados", rode de novo.
6. Repita para o projeto Treinamento Gap só se for usar os dados dele.

## Parte 5: valores (quando quiser)

- Projeto > produção: parceiro com avaliador em 60% (R$ 1,20 e R$ 0,80 em dupla), valor por registro R$ 2,50 e parte do time R$ 0,50.
- Prêmio da Neofloresta: superação R$ 2,00 (avaliador) e R$ 1,00 (auxiliar), teto 0 (sem teto), com a data de início.

## O que conferir no celular

- Tirar uma foto por dentro do app e comparar a nitidez com a da câmera do celular.
- Ver se o aviso de memória parou de aparecer.
- Coordenação e auditor: atualizar o app antes de editar qualquer registro.
