# Script de melhorias para o sistema da Cemig

**Palavra-chave: APLICAR MELHORIAS CEMIG**

Este documento leva para o sistema da Cemig (gestão de poda e faixa) tudo o que foi aprendido na versão 2.0 do app de inventário: as correções apontadas pelos agentes revisores, o processo de conferência e as funções de produto. O chat que receber a palavra-chave deve seguir os passos abaixo na ordem, sem pular as conferências.

## Como usar (no chat da Cemig)

1. Ler este documento inteiro e o estado atual do sistema da Cemig (MVP navegável e o que mais existir no projeto).
2. Para cada item das listas A a F: dizer se **já atende**, se **não se aplica** (com o motivo) ou se **precisa fazer**. Montar essa tabela antes de mexer em código.
3. Implementar os itens "precisa fazer" em ordem de prioridade (Must, depois Should).
4. Fazer as conferências da seção G, na ordem, corrigindo o que aparecer.
5. Rodar os testes de aceite da seção H e registrar o resultado.
6. Salvar no projeto: a tabela de itens com a situação final e um resumo do que mudou. Avisar o Ciro com passo a passo, uma parte de cada vez, de qualquer ação que dependa dele.

Regras de escrita para o Ciro: português do Brasil, informal no chat, direto, sem travessões, sem inventar dados, palavras em vez de siglas em telas e tabelas.

## A. Segurança (revisão de segurança)

| Prioridade | Item | Por quê |
|---|---|---|
| Must | Senha guardada só como hash com sal (nunca em texto); mínimo de 8 caracteres | Senha em texto na planilha ou no banco reprova em qualquer checklist |
| Must | Bloqueio por 15 min após 5 senhas erradas, contado só quando o usuário existe; sessões já abertas continuam valendo | Evita força bruta sem permitir travar o admin de propósito |
| Must | Sessão por token com validade (ex.: 30 dias, renovável); no servidor guardar só o hash do token; trocar a senha encerra as outras sessões | O aparelho não guarda a senha |
| Must | Todas as permissões checadas no servidor, por perfil e por projeto, inclusive em ações "de leitura" (mapa, painel, fotos, formulários) | Achado real: o coletor lia colunas internas pelo endpoint do mapa |
| Must | O aparelho nunca escreve campos de sistema (validação, número único, autor); autor e datas de controle vêm do servidor; data do aparelho no futuro é recusada | Achado real: dava para burlar a trava mandando data falsa |
| Must | Proteção contra fórmula em planilha: todo texto que começa com = + - @ vira texto puro (inclusive nomes de coluna e auditoria); no CSV exportado, números nunca levam apóstrofo | Achado real: login com "=IMAGE(...)" virava fórmula na auditoria; e o conserto mal feito corrompeu as coordenadas no CSV |
| Must | Links externos (fotos) só abrem se forem do domínio esperado; sem innerHTML com dados; política de segurança de conteúdo (CSP) no app | Evita link javascript: e injeção de script |
| Must | Limites de tamanho: foto (ex.: 8 MB, só jpeg/png/webp), lotes (ex.: 1000 itens), páginas (ex.: 5000 linhas), colunas | Evita encher o Drive ou travar a planilha |
| Should | Auditoria só com eventos do sistema (o cliente não grava evento livre); nada de linha de auditoria para usuário inexistente | Auditoria que aceita qualquer texto não prova nada |
| Should | Cópia de segurança não leva tokens nem hashes por email | Backup também vaza |
| Should | Termo de uso e privacidade (LGPD) com aceite registrado e cobrado no servidor para gravar dados; contratante como controlador, consultoria como operadora, Google como suboperador, fotos de fachadas e pessoas, encarregado e prazo de descarte | Exigência de contrato público |

## B. Lógica e perda de dados (revisão de lógica)

| Prioridade | Item | Achado que motivou |
|---|---|---|
| Must | Envio nunca roda duas vezes ao mesmo tempo (marcar "enviando" antes de qualquer espera) | 3 registros geraram 6 envios e fotos duplicadas |
| Must | Antes de cada gravação no aparelho, reler o registro atual; nunca gravar por cima com uma cópia antiga | Falha de rede desfazia uma correção feita durante o envio |
| Must | Edição em andamento não é enviada até ser confirmada | Envio a cada minuto subia edição pela metade |
| Must | Trocar foto durante uma edição não apaga a original até confirmar; descartar apaga só as novas | A foto original sumia ao descartar |
| Must | A comparação "o que mudou" inclui posição e fotos | Mudar só a posição dava "nenhuma alteração" |
| Must | Recusa definitiva do servidor vira estado final ("Recusado") com opção de remover a cópia do aparelho; não tentar de novo para sempre | Registro ficava preso tentando a cada minuto |
| Must | Mesmo fuso nos dois lados (America/Sao_Paulo) para regras por dia | Celular em outro fuso passava no app e era recusado no servidor |
| Must | Escrita em lote grava a coluna inteira de uma vez, lendo as colunas pelo nome | Validar 8 mil registros travava o envio das equipes |
| Must | Número único do registro dado pelo servidor uma vez e nunca recalculado | Número mudava a cada exportação; não serve para medição |
| Must | Sequência de códigos conferida com o servidor antes de liberar a coleta | Primeiro registro após login podia repetir código |
| Must | Nome de foto com parte do identificador do registro; servidor com trava ao criar arquivo | Fotos de aparelhos diferentes podiam colidir |
| Should | Botão voltar do Android grava e limpa a tela atual; folhas e menus fecham ao trocar de tela | Rascunho abandonado seguia pegando GPS |
| Should | Leitor de CSV: aspas só abrem campo no início; números em português e inglês (1.234,5 / 1,234.5 / 1.234); importação respeita identificador e não duplica | Aspas no meio engoliam o arquivo; 1.234 virava 1,234 |
| Should | Datas agrupadas no fuso local (trabalho depois das 21h não cai no dia seguinte) | Painel e relatório por dia |

## C. Experiência de uso (revisão de UX e agente coletor)

| Prioridade | Item |
|---|---|
| Must | Nenhum "null" ou "[object ...]" na tela: listas vazias e nulos tratados em toda montagem de tela |
| Must | Aviso na hora, no próprio campo: número inválido, valor abaixo do critério; valores fora do comum e item fora da lista pedem confirmação ("Está certo" / "Corrigir") |
| Must | Pendências agrupadas por etapa, cada grupo leva até a etapa |
| Must | Trocar uma classificação que esconde campos já preenchidos pede confirmação e diz o que deixa de valer |
| Must | Registro concluído abre só para leitura; editar pede confirmação; concluir a edição mostra a lista do que mudou |
| Should | Configuração de servidor escondida de quem não é da coordenação; nada de termos internos na tela (ids, "servidor", "conectado ao Google") |
| Should | Status com as mesmas palavras em todas as telas; rótulos de gráfico curtos; contadores que batem com a lista |
| Should | Botões de decisão fixos no rodapé; alvos de toque com pelo menos 40 px; filtros que quebram linha no celular |
| Should | Estados vazios com mensagem ("Ainda não há registros validados...") e GPS aguardando em amarelo, não vermelho |

## D. Fiscal de contrato (agente fiscal)

| Prioridade | Item |
|---|---|
| Must | Boletim de medição por período, contado pela data da validação, por equipe e por tipo de serviço, com lista dos itens e campos de assinatura (responsável técnico e ateste do fiscal) |
| Must | Fotos acessíveis ao perfil cliente pelo próprio sistema (sem precisar de conta Google), só dos itens validados |
| Must | Histórico de cada decisão de validação (quem, quando, motivo) entregue ao cliente; validação em lote exige confirmar amostra conferida (ex.: 5%) e isso fica registrado |
| Must | Relatório com responsável técnico, registro profissional e ART, páginas numeradas e cabeçalho de tabela repetido |
| Must | Meta separando o que é serviço medido do que não é (na Cemig: poda, supressão, inspeção, faixa) |
| Should | Pacote final de entrega: dados, fotos, dicionário com unidades e metadados, relatório; plano de entrega dos dados ao fim do contrato |
| Should | Alerta automático de respostas contraditórias (ex.: "ausente" marcado junto com outra opção) |

## E. Analista de dados (agente analista)

| Prioridade | Item |
|---|---|
| Must | Mesmo esquema em todos os formatos; números como número, datas como data, booleanos iguais; "não se aplica" vazio, não "não" |
| Must | Valores calculados prontos como número (na Cemig: área, extensão de faixa, quantidades por OS) |
| Must | Colunas de validação e número único em todos os formatos, inclusive GeoPackage |
| Must | Coordenadas em SIRGAS 2000 (UTM no GeoPackage e Shapefile), conferidas com conversão independente |
| Should | Excel com dicionário de campos (unidade e descrição) e aba de metadados; Shapefile com tabela de nomes completos; estilo do QGIS embutido no GeoPackage, com regras que batem com os valores reais |
| Should | Importação que reconhece colunas, converte rótulos por extenso, avisa códigos repetidos e não duplica |

## F. Produto

Perfis com permissões claras (na Cemig: gestor, supervisor, executante, fiscal, administrador); portal do cliente só de consulta; painel com metas e ritmo; mapa com satélite, filtros e busca por endereço; cópia de segurança diária com email; registro de auditoria; termo de uso; tela Sobre com versão e contato. Na Cemig, lembrar: a escala de centenas de milhares de registros não cabe em planilha Google (limite de cerca de 130 mil linhas com 76 colunas). Precisa de banco de dados geográfico (PostgreSQL com PostGIS) e servidor próprio, e os testes de escala devem ser feitos nessa arquitetura.

## G. Processo de conferência (obrigatório, nesta ordem)

1. **Conferência 1 (sua):** rodar testes automáticos de todas as funções (servidor e telas, com celular simulado), corrigir e repetir até passar.
2. **Agentes revisores em paralelo**, cada um com briefing próprio, só relatando (sem editar): segurança, lógica e perda de dados, experiência de uso com capturas de tela no celular e no computador. Cada um em portas e pastas próprias para não derrubar o servidor de teste do outro. Pedir achados por gravidade, com arquivo e linha, cenário concreto, se foi confirmado rodando, e correção mínima.
3. **Corrigir** os achados e repetir a conferência 1. Rodar também as sondas que os revisores deixaram.
4. **Agentes no papel de usuários**, em paralelo e isolados: executante de campo (um dia de trabalho simulado, sem sinal, com erros de digitação), fiscal de contrato da Cemig (medição, aceite, rastreabilidade, entrega), analista de dados (todas as exportações abertas em Python e no formato do QGIS). Relatórios em português, Must, Should e Nice.
5. **Corrigir** e fazer a conferência final: todos os testes de novo, mais um teste de compatibilidade com a versão anterior do servidor ou dos dados, se houver.
6. Só publicar depois da conferência final. Enquanto isso, trabalhar em ramo separado.

## H. Testes de aceite mínimos

- Servidor: cada perfil só faz o que pode; bloqueio e desbloqueio; sessão expirada e encerrada; dados de sistema não aceitos do aparelho; recusas de fórmula, data futura e coluna inválida.
- Campo: 50 itens sem sinal sobem sem perda nem duplicata; queda no meio do envio; foto com sinal fraco; duas equipes ao mesmo tempo sem código repetido; edição no mesmo dia com duas confirmações; trava no dia seguinte; correção de item devolvido.
- Gestão: validar, devolver com motivo e descartar; lote com amostra; painel; relatório em PDF; boletim de medição; portal do cliente só com validados; exportações conferidas em Python; importação sem duplicar.
- Escala: tempos de mapa, filtro, exportação e painel na escala da Cemig, registrados no roteiro.

## Referência

O app de inventário versão 2.0 (repositório neofloresta/app) tem a implementação de cada item: servidor em `apps-script/Code.gs`, app em `js/app.js`, exportações em `js/arquivos.js` e `js/gpkg.js`, testes em `claude/poc/` (`srv.js`, `b12.js`, `b47.js`, `b3.js`, `b5.js`). O roteiro de prova de conceito está em `claude/roteiro-poc.md`. Pode copiar a lógica, adaptando ao modelo de dados da Cemig.
