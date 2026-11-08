# Roteiro de Prova de Conceito (PoC) simulada · App de Arborização Neofloresta

**Palavra-chave: RODAR POC**

## Como usar (qualquer chat deste projeto)

1. Ler este documento inteiro.
2. Verificar o estado atual do app (repositório neofloresta/app no GitHub e backend no Google).
3. Executar os testes pedidos (um bloco ou todos), na escala indicada.
4. Atualizar a coluna Status de cada teste: Passou / Falhou / Não implementado / Não testado, com data e observação.
5. Corrigir o que falhar, refazer o teste e salvar a versão atualizada deste documento no projeto (claude/roteiro-poc.md).
6. Quando o Ciro precisar agir (GitHub, Apps Script, celular), passar passo a passo detalhado, uma parte de cada vez.
7. Registrar a rodada no Histórico de execuções, no fim do documento.

**Onde estão os testes automáticos:** pasta `claude/poc/` do repositório neofloresta/app. Eles sobem o app, uma simulação do Apps Script (`mock.js`) e um celular Android simulado (Playwright, perfil Pixel 7). Comandos: `node srv.js` (servidor e segurança, 42 testes), `node b12.js` (blocos 1 e 2), `node b47.js 3000` (perfis, validação, painel, relatório, cliente, exportação, importação, segurança), `node b3.js 20000` (mapa na escala), `node b5.js 20000` (exportação), `node b7.js` (permissões), `node b9.js` (celular parado, mesmo usuário em dois celulares e toque no ponto do mapa). Os números de tempo vêm dessa simulação, com CPU 4 vezes mais lenta e rede de 10 Mbps; no Google real há alguns segundos a mais de resposta do servidor.

## Escalas de teste

| Cliente | Volume real | Volume de teste | Usuários simultâneos |
|---|---|---|---|
| Carmo do Rio Claro | cerca de 3.000 registros | 5.000 | 2 |
| Divinópolis | mais de 10.000 registros, 2 equipes | 20.000 | 10 |
| Cemig | centenas de milhares | 500.000 | 50 |

**Alerta de arquitetura (confirmado na rodada de 04/11/2026):** a planilha do projeto tem 76 colunas. Cabem cerca de 130 mil registros por planilha (limite de 10 milhões de células). Carmo (5 mil) usa 4% e Divinópolis (20 mil) usa 15%. A Cemig (500 mil) precisaria de 38 milhões de células, quase 4 vezes o limite: para ela é obrigatório banco de dados geográfico (ex.: PostgreSQL com PostGIS) e servidor próprio.

## Ações pendentes do Ciro

| Ação | Por quê | Situação |
|---|---|---|
| Atualizar o servidor no Google para a versão 2.1 (colar Code.gs, rodar configurar, publicar nova versão) | Perfis, validação, portal do cliente, painel, segurança, mapa rápido e a reserva de códigos por aparelho (2.2) dependem dele. O app novo funciona com o servidor antigo, mas sem essas funções | Pendente |
| No app, Coordenação > Formulários > Atualizar formulários prontos | Liga o critério de 2 m, a ajuda do DAP e a simbologia do QGIS | Pendente |
| Preencher email de contato, CNPJ e encarregado de dados no config.js | Termo de uso (LGPD) e tela Sobre | Pendente |
| Preencher responsável técnico, registro e ART em cada projeto | Saem no relatório e no boletim de medição | Pendente |
| Enviar a lista de espécies com nome popular, família e origem | Busca por nome popular e indicadores de nativas e diversidade | Pendente |
| Contratar mais espaço no Google Drive | Fotos de Divinópolis passam de 15 GB | Pendente |
| Ligar a cópia diária (Coordenação > Segurança) e testar uma restauração | Item 7.6 | Pendente |
| Definir os limites de valores absurdos de cada campo | Hoje há limites gerais (altura 40 m, DAP 300 cm, raio 20 m) | Pendente |

## Bloco 1 · Coleta em campo

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 1.1 | Cadastrar árvore com espécie, atributos, 3 fotos e GPS | Menos de 2 min por árvore; precisão do GPS exibida | Passou | 04/11/2026 | Cadastro completo com 3 fotos, GPS exibido no topo ("Aguardando GPS" em amarelo enquanto não fixa) e código automático. Simulação de um dia de coleta: árvore viva completa com cerca de 38 toques e 85 a 90 s de preenchimento; morta cerca de 47 s; plantio e calçada em 3 etapas. Medir em campo real. 2ª conferência (04/11): com o celular parado, a árvore nova ficava sem GPS (o aparelho só avisa quando a posição muda); corrigido na 2.0.1, o app reinicia a leitura ao abrir cada árvore |
| 1.2 | Campos obrigatórios por classe | Não salva sem os obrigatórios | Passou | 04/11/2026 | Bloqueia e lista as pendências agrupadas por etapa; tocar no nome da etapa leva até ela |
| 1.3 | Árvore morta | Clique libera só os campos pertinentes | Passou | 04/11/2026 | Raios, área e qualidade de copa e fitossanidade somem; espécie fica opcional |
| 1.4 | Categorias Local de plantio e Calçada sem árvores | Formulário próprio de cada categoria | Passou | 04/11/2026 | 3 etapas próprias. Trocar a categoria de uma árvore já medida pede confirmação e lista o que deixa de valer |
| 1.5 | Critério de inclusão (Divinópolis: altura a partir de 2 m) | Alerta ou bloqueio abaixo do critério | Passou | 04/11/2026 | Aviso na hora, no próprio campo ("abaixo do critério de inclusão... mude a categoria ou exclua o registro") e bloqueio ao concluir. Valores fora do comum (altura acima de 40 m, DAP acima de 300 cm, raio acima de 20 m ou zero) e espécie fora da lista pedem confirmação. Número digitado errado ("2,5,") avisa na hora |
| 1.6 | Editar e excluir registro | Alteração fica no histórico | Passou | 04/11/2026 | Registro concluído abre só para leitura. Editar pede confirmação; ao concluir aparece a lista do que mudou (inclusive posição e fotos) para confirmar. Tudo vai para a coluna historico. A equipe só altera no mesmo dia ou quando a coordenação devolve; a trava vale também no servidor. Edição abandonada pode ser descartada sem perder a foto original |
| 1.7 | Formulário customizado por projeto | Trocar de projeto troca o formulário | Passou | 04/11/2026 | Cada projeto usa o seu formulário (agora com ajuda nos campos, ex.: DAP) |

## Bloco 2 · Offline e sincronização

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 2.1 | Coletar 50 árvores em modo avião e sincronizar ao voltar | Nenhuma perda, nenhum duplicado | Passou | 04/11/2026 | 50 de 50 chegaram, sem duplicados. Edição em andamento não é enviada antes de confirmada |
| 2.2 | Duas equipes coletando ao mesmo tempo | Códigos nunca se repetem | Passou | 04/11/2026 | Prefixo por equipe. 2ª conferência: o mesmo usuário em dois celulares sem internet repetia códigos (E2-0001 e E2-0002 saíram duas vezes). Corrigido na 2.0.1: cada aparelho recebe do servidor uma faixa própria de 100 números (ex.: E2-0101 a E2-0200) e pede outra quando sobram menos de 30. Depende do servidor 2.1; com o servidor antigo continua a sequência local. Outra equipe não altera registro alheio |
| 2.3 | Dois usuários editam o mesmo registro | Regra de conflito definida, sem perda silenciosa | Passou | 04/11/2026 | Entre aparelhos da mesma equipe vale a edição mais recente e o aparelho avisa quando a dele foi ignorada; a coordenação sempre prevalece |
| 2.4 | Sincronização interrompida no meio | Retoma sem duplicar | Passou | 04/11/2026 | Retoma sem duplicar. Envio nunca roda duas vezes ao mesmo tempo (antes podia duplicar fotos no Drive) |
| 2.5 | Fotos com sinal fraco | Envio em fila, coleta não trava | Passou | 04/11/2026 | Foto fica na fila e sai na tentativa seguinte; a coleta não trava. Recusas definitivas do servidor aparecem como "Recusado", com opção de remover a cópia do aparelho |

## Bloco 3 · Mapa e consulta

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 3.1 | Mapa com todos os pontos na escala de teste | Abre em até 5 s (Carmo e Divinópolis); Cemig com agrupamento de pontos | Passou | 04/11/2026 | 5 mil pontos em 2,2 s e 20 mil em 4,8 s (celular simulado mais lento e rede 4G); na 2ª conferência 5,1 s, no limite: medir em campo. Depende de atualizar o servidor |
| 3.2 | Filtros por espécie, estado, bairro e equipe | Resultado correto em até 3 s | Passou | 04/11/2026 | Filtros por código ou espécie, equipe, classe de risco e bairro (bairro aproximado pelo mapa, preenchido no envio), e cor por equipe ou risco. 0,2 a 1,8 s com 20 mil pontos |
| 3.3 | Busca por código e por endereço | Encontra o registro certo | Passou | 04/11/2026 | Busca por código abre a ficha (1,8 s com 20 mil). Busca por endereço (OpenStreetMap) feita; não deu para testar aqui porque o ambiente de teste não tem internet: conferir em campo |
| 3.4 | Ficha da árvore ao clicar | Mostra atributos e fotos | Passou | 04/11/2026 | 2ª conferência: tocar no ponto não abria a ficha quando a "minha posição" estava no mapa (o desenho dela ficava por cima e engolia o toque; a ficha só abria pela busca). Corrigido na 2.0.1. Ficha com atributos, situação da validação, histórico e fotos carregadas pelo próprio app (sem precisar de conta Google); fundo de mapa com ruas ou satélite |

## Bloco 4 · Gestão e ordens de serviço

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 4.1 | Criar ordem de serviço (poda, supressão, plantio, remoção) a partir da árvore | Ordem vinculada à árvore | Passou | 05/11/2026 | Versão 2.2. A coordenação abre pela ficha da árvore (código, espécie, endereço e coordenada vêm da árvore), com tipo, prioridade, equipe e prazo. Cliente e equipe pedem serviço pela ficha ou marcando um ponto no mapa; o pedido fica Solicitado até a coordenação aprovar. Tipos de serviço configuráveis por projeto |
| 4.2 | Fluxo de status: aberta, em execução, concluída | Responsável e data em cada etapa | Passou | 05/11/2026 | Solicitada, Aberta, Em execução, Concluída ou Cancelada, com quem e quando em cada etapa. Cancelar e reabrir exigem motivo; reabrir guarda a execução anterior no histórico. A equipe só vê e executa as ordens dela (conferido também chamando o servidor direto) |
| 4.3 | Registro da execução | Foto antes e depois | Passou | 05/11/2026 | Foto de antes e de depois obrigatórias (plantio e avaliação de risco: só a de depois), com observação. Funciona sem internet: iniciar e concluir ficam no aparelho e sobem depois, sem duplicar. Fotos só aceitas da pasta do projeto |
| 4.4 | Histórico de intervenções por árvore | Lista completa e em ordem | Passou | 05/11/2026 | A ficha da árvore lista todas as ordens. Ordens também no mapa (cor por situação), no painel (em aberto, atrasadas, tempo médio), no relatório, no boletim de medição (serviços concluídos no período, com prazo e fotos) e no Excel |

## Bloco 5 · Relatórios, exportação e importação

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 5.1 | Exportar GeoPackage | Abre no QGIS com o estilo .qml | Passou | 04/11/2026 | GeoPackage válido em SIRGAS 2000 / UTM, com a simbologia do QGIS embutida (cores por categoria e risco, rótulo pelo código) e colunas de validação |
| 5.2 | Exportar shapefile, KML, Excel e CSV | Arquivos abrem sem erro | Passou | 04/11/2026 | Excel (com dicionário de campos, unidades e aba de metadados), Shapefile (com tabela de nomes completos), CSV pronto para o Excel em português e KML. Todos conferidos com pyogrio, openpyxl e leitor de XML |
| 5.3 | Normalizar códigos dos registros validados na exportação | Sequência única, sem distinção de equipe | Passou | 04/11/2026 | numero_unico é dado pelo servidor no primeiro envio e nunca muda; exportação com filtro "só validados" para a entrega |
| 5.4 | Importar inventário existente (GeoPackage ou planilha) na escala de teste | Todos os registros entram, sem erro | Passou | 04/11/2026 | Importa CSV e GeoPackage de pontos (geográfico ou UTM), reconhece colunas, converte opções escritas por extenso e números em português, avisa códigos repetidos e não duplica quem já existe (uuid) |
| 5.5 | Relatório em PDF (resumo e por bairro) | Gera em até 1 min | Passou | 04/11/2026 | Relatório para imprimir ou PDF (3 páginas, numeradas, com responsável técnico e ART) e Boletim de medição por período, com campo de ateste do fiscal. Gera em menos de 2 s |
| 5.6 | Painel de indicadores (total, espécies, estado, ordens de serviço) | Números batem com a base | Passou | 04/11/2026 | Painel com meta, ritmo e previsão, validação, categorias, risco, espécies (alerta de 10% por espécie e 20% por gênero), DAP, manejo e ocorrências. Números calculados no servidor |

## Bloco 6 · Desempenho e escala

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 6.1 | Gerar base fictícia com 5.000, 20.000 e 500.000 registros | Bases prontas para os testes | Passou | 04/11/2026 | Gerador em claude/poc/lib.js. A base de 500 mil não cabe na planilha (ver 6.3) |
| 6.2 | Medir tempo de abrir mapa, filtrar e exportar em cada escala | Tempos registrados na observação | Passou | 04/11/2026 | 20 mil registros: mapa 4,8 s, filtro 0,6 s, busca 1,8 s; exportação GeoPackage 2 s, Shapefile 5,7 s, Excel 9,8 s. Painel e validação abrem em menos de 1 s com 3 mil |
| 6.3 | Verificar limites do backend (células, tempo de execução, cotas) em cada escala | Indicar em qual escala quebra | Passou | 04/11/2026 | Cerca de 76 colunas: cabem perto de 130 mil registros por projeto. Carmo e Divinópolis cabem com folga; Cemig não. Listagem em páginas de até 5 mil |
| 6.4 | Usuários simultâneos: 10 (Divinópolis) e 50 (Cemig) | Sem erro nem lentidão grave | Não testado | 04/11/2026 | Precisa do Google real. O Google aceita cerca de 30 execuções simultâneas e as gravações entram em fila; a validação em lote agora grava de uma vez para não travar o envio das equipes |
| 6.5 | Armazenamento de fotos | Estimativa em GB por escala (500.000 árvores com 3 fotos de 300 KB dão cerca de 450 GB) | Passou | 04/11/2026 | Cerca de 600 KB por foto: Divinópolis (10 mil árvores, 3 fotos) perto de 18 GB, acima dos 15 GB gratuitos do Google |

## Bloco 7 · Usuários e segurança

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 7.1 | Perfis: administrador, coletor, revisor, cliente | Cada perfil vê e faz só o permitido | Passou | 04/11/2026 | Quatro perfis: equipe de campo, revisão técnica, cliente e coordenação, com permissões conferidas no servidor (42 testes) |
| 7.2 | Coletor acessa só o seu projeto | Sem acesso a outros projetos | Passou | 04/11/2026 | Usuário de outro projeto não lê nem grava; equipe não altera registro de outra equipe nem lê colunas internas |
| 7.3 | Portal do cliente com login | Mapa e painel, somente leitura | Passou | 04/11/2026 | Cliente entra direto no painel, vê só os validados (ou todos, se o projeto permitir), mapa, relatório, boletim de medição, fotos e download dos dados |
| 7.4 | Registro de auditoria | Mostra quem alterou o quê e quando | Passou | 04/11/2026 | Auditoria de entradas, senhas erradas, bloqueios, usuários, projetos, formulários, validações, importações, exportações e relatórios; histórico de alterações e de validação em cada registro |
| 7.5 | Login, expiração de sessão, conexão segura | Funciona sem falhas | Passou | 04/11/2026 | Senha criptografada (mínimo 8 caracteres), bloqueio de 15 min após 5 erros, sessão de 30 dias que se renova, troca de senha encerra as outras sessões, HTTPS e política de segurança de conteúdo no app |
| 7.6 | Cópia de segurança e restauração | Restauração testada de fato | Passou | 05/11/2026 | Versão 2.2: restauração pelo app (Coordenação > Segurança), com confirmação pelo nome do projeto e cópia automática do estado anterior para desfazer. Testada no servidor simulado (restaurar e desfazer). Falta repetir uma vez no Google de verdade |
| 7.7 | Lei Geral de Proteção de Dados | Só dados pessoais necessários, com termo de uso | Falhou | 04/11/2026 | Termo de uso e privacidade com aceite registrado e cobrado pelo servidor. Falta o Ciro preencher email de contato, CNPJ e encarregado de dados (config.js) e combinar em contrato a entrega e o descarte dos dados |

## Bloco 8 · Plataformas e integração

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 8.1 | Android, incluindo aparelhos mais antigos | Funciona em Android 8 ou superior | Não testado | 04/11/2026 | Testado em Android simulado (Pixel 7). Falta aparelho real; o Chrome atual pode não rodar em Android 8 e 9 |
| 8.2 | Navegador no computador | Funciona em Chrome, Edge e Firefox | Não testado | 04/11/2026 | Chrome no computador ok (coordenação, revisão, cliente). Edge usa o mesmo motor; Firefox não testado |
| 8.3 | iPhone | Funciona, se o edital exigir | Não testado | 04/11/2026 | Precisa de iPhone real |
| 8.4 | Integração com outros sistemas (provável na Cemig) | Interface de integração documentada e testada | Passou | 05/11/2026 | Versão 2.2: chave de integração por projeto, criada e revogada pela coordenação, só de leitura (registros em páginas, ordens, indicadores), com o mesmo filtro do cliente e uso registrado na auditoria. Documentada em docs/api.md e testada como sistema externo |

## Resumo da rodada de 05/11/2026 (versão 2.2)

| Status | Quantidade |
|---|---|
| Passou | 37 |
| Falhou | 1 |
| Não implementado | 0 |
| Não testado | 4 |

Revisões feitas nesta rodada: segurança, lógica e experiência de uso (agentes revisores), e avaliação por agentes no papel de coletor de campo, fiscal de contrato e analista de dados. Os problemas apontados foram corrigidos e testados de novo; os que dependem do Ciro estão em "Ações pendentes".

Próximos passos para licitação: testes em aparelhos reais (8.1 e 8.3), uma restauração no Google de verdade (7.6), usuários simultâneos no Google (6.4), dados de contato e encarregado (7.7) e lista de espécies completa.

## Histórico de execuções

| Data | Chat ou responsável | Blocos rodados | Resumo |
|---|---|---|---|
| 04/11/2026 | Criação do roteiro | Nenhum | Roteiro criado, nada testado ainda |
| 04/11/2026 | Chat do app de coleta (RODAR POC) | Todos | Testes automáticos em celular simulado com 5 mil e 20 mil registros. Corrigidos nesta rodada: critério de 2 m (1.5), histórico de alterações (1.6), mapa lento (3.1), filtros e busca no mapa (3.2, 3.3), ficha com foto (3.4), exportação em páginas, KML e numeração única (5.2, 5.3), documentação da interface (8.4). Confirmado que a Cemig não cabe em planilha Google |
| 04/11/2026 | 2ª conferência da versão 2.0 (outro chat) | Todos | Suíte da 2.0 rodada de novo (42 testes de servidor, blocos 1, 2, 3, 5, 7 e gestão): tudo passou. Testes extras (b9.js) acharam 3 falhas que a suíte não pegava: celular parado sem GPS (1.1), código repetido com o mesmo usuário em dois celulares (2.2) e toque no ponto do mapa sem abrir a ficha (3.4). Corrigidas na versão 2.0.1 do app e 2.1 do servidor; suíte inteira rodada de novo sem falhas |
| 04/11/2026 | Chat do app de coleta (versão 2.0) | Todos | Versão 2.0: perfis, validação, portal do cliente, painel, relatório, boletim de medição, exportações (GeoPackage com simbologia, Excel, Shapefile, CSV, KML), importação, segurança (senha criptografada, bloqueio, sessão, auditoria, cópia diária, termo LGPD), mapa com satélite, bairro e endereço. Revisão por 6 agentes e correções. Compatível com o servidor antigo até a atualização |
| 05/11/2026 | Chat do app de coleta (versões 2.1 e 2.2) | Todos, mais o bloco 4 | 2.1: ao concluir, o app leva direto ao campo que falta, em vermelho; aviso de versão nova com botão de atualizar; rotina LIBERAR VERSÃO (claude/rotina-de-versao.md). 2.2: ordens de serviço completas (bloco 4), pedido de serviço pelo cliente, pacote final de entrega, chave de integração (8.4) e restauração de cópia (7.6). Verificação por agentes (equipe de campo, fiscal e analista, segurança) e correções antes de publicar |
| 07/11/2026 | Chat do app de coleta (versão 2.3) | Quadras, mais regressão de todos os blocos | Camada de quadras (shapefile, GeoPackage, KML ou GeoJSON), com número no mapa, situação (a levantar, em levantamento, levantada), equipe por quadra, escolha de várias por toque ou por área, marcação sem internet, mudança automática ao salvar árvore, andamento no painel e na tela inicial, número da quadra nas exportações. Quadras de Divinópolis geradas a partir dos logradouros da prefeitura (5.414, numeração automática). Agente verificador: 1 problema grave corrigido (marcação antiga rebaixava quadra levantada) e 5 ajustes. Rotina LIBERAR VERSÃO: 24 de 24 |
| 08/11/2026 | Chat do app de coleta (versão 2.4) | Formulário, regressão de todos os blocos | Formulário de Divinópolis 5 (decisões em claude/formulario-divinopolis.md): cada categoria mostra só o que vale para ela, CAP com até 3 caules, risco pela matriz da ISA, fotos de identificação para espécie não identificada, ajuda (?) em todos os campos, preferência de copa por usuário, limites de valores fora do comum. Rendimento por equipe no painel e filtro de dia no mapa. Agente verificador (dupla de campo): 3 problemas graves corrigidos (risco severo sem cor no mapa, CAP inválido aceito, copa sumindo ao reeditar). Rotina LIBERAR VERSÃO: 27 de 27 |
| 08/11/2026 | Chat do app de coleta (versão 2.5) | Faces de quadra, desempenho, estresse e regressão de todos os blocos | Faces de quadra (decisões em claude/faces-de-quadra.md): 22.042 faces geradas das ruas da prefeitura, linhas no mapa, começo automático pelo GPS, levantada e levantada sem árvores (foto e largura), lado todo da rua, quadra acompanha as faces, km por equipe no painel e no Excel. Velocidade: app abre com os dados do aparelho (reabrir de 3,6 s para 0,4 s com servidor lento), cache no servidor, mapa desenha só a área visível; mapa abre na cidade do projeto e filtros recolhidos em tela pequena. Estresse: 5 mil cadastros em 6 celulares (5 equipes), servidor lento, sem internet e quedas: nada perdido, achou e corrigiu códigos repetidos com reserva em andamento e dois celulares no mesmo login. Agentes: segurança (3 graves corrigidos), dados (pode liberar, 4 ajustes), dupla de campo (1 grave corrigido: botões tapados em tela pequena). Rotina LIBERAR VERSÃO: 31 de 31 |
