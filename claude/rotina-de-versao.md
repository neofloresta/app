# Rotina de liberação de versão do app

**Palavra-chave: LIBERAR VERSÃO**

Nenhuma atualização do app vai para as equipes sem passar por esta rotina. O objetivo é um só: a atualização não pode quebrar a coleta de dados nem apagar o que está guardado nos celulares.

## Quando usar

Sempre que qualquer arquivo do app mudar (telas, formulários, exportações, servidor). Correção pequena também passa pela rotina.

## Passos (nesta ordem)

1. **Trabalhar fora do ar.** As mudanças ficam no computador de desenvolvimento até o passo 6. O endereço que as equipes usam só muda na publicação.
2. **Numerar a versão.** O mesmo número em três lugares: `js/app.js` (VERSAO), `version.json` (versao, data e notas do que mudou, em palavras simples) e `sw.js` (CACHE `coleta-vX.Y.Z`). Correção: muda o último número (2.1.0 para 2.1.1). Função nova: muda o do meio (2.1 para 2.2).
3. **Testes automáticos:** `node liberar.js` na pasta `claude/poc`. Ele confere se as versões batem, a sintaxe dos arquivos e roda todas as baterias:
   - servidor: perfis, senhas, bloqueios e recusas;
   - coleta e envio: cadastro completo, obrigatórios com salto ao campo em vermelho, 50 registros sem sinal, queda no meio do envio, duas equipes, edição e trava;
   - coordenação, cliente e exportação: validação, painel, relatório, portal do cliente, importação e cópia de segurança;
   - mapa com 5 mil pontos e exportações com 2 mil registros;
   - permissões;
   - versão e atualização: o aviso aparece e atualizar não apaga rascunho nem registro não enviado.

   Qualquer falha: corrigir e rodar de novo. Só segue com "PODE SEGUIR".
4. **Agentes verificadores**, cada um em portas e pasta próprias (`preparar.sh`), só relatando:
   - **coletor de campo apressado** (sempre): um dia de coleta com erros, sem internet, atualizando o app no meio do trabalho e em tela pequena;
   - **fiscal de contrato** e **analista de dados**: quando a mudança mexer em validação, relatórios, medição ou exportações;
   - **revisor de segurança**: quando mexer no servidor, em login ou em permissões.

   Cada agente entrega o veredito (PODE LIBERAR ou NÃO LIBERAR) e os achados por gravidade.
5. **Corrigir os achados** obrigatórios (Must) e repetir o passo 3. Os achados Should entram na lista de desenvolvimento.
6. **Publicar** (enviar ao repositório principal). Se mudou o servidor, o Ciro cola o novo `Code.gs` e cria uma nova versão da implantação, com o passo a passo enviado no chat.
7. **Registrar** no histórico do roteiro de prova de conceito: a versão, a data, o que mudou e o resultado dos testes e dos agentes.

## Como a atualização chega às equipes

- O app confere se há versão nova ao abrir e a cada 30 minutos.
- Havendo, aparece na tela inicial o aviso "Nova versão X disponível", com o que mudou e o botão **Atualizar agora**. No menu também tem "Verificar atualização", e a tela Sobre mostra a versão do celular.
- Atualizar não apaga rascunhos nem registros que ainda não foram enviados. Se houver uma edição em andamento, o app pede confirmação, e a edição continua guardada.
- Recomendação para a coordenação: publicar versão nova fora do horário de campo (à noite ou no fim de semana), para as equipes atualizarem antes de sair.

## Se der problema depois de publicar

Voltar a versão anterior no repositório (o histórico guarda todas) e publicar de novo com um número maior. Os dados nos celulares e na planilha não são afetados por voltar a versão do app.
