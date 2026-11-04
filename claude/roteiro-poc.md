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

**Onde estão os testes automáticos:** pasta `claude/poc/` do repositório neofloresta/app. Eles sobem o app, uma simulação do Apps Script (`mock.js`) e um celular Android simulado (Playwright, perfil Pixel 7). Comandos: `node b12.js` (blocos 1 e 2), `node b3.js 20000` (mapa na escala), `node b5.js 20000` (exportação), `node b7.js` (permissões). Os números de tempo vêm dessa simulação, com CPU 4 vezes mais lenta e rede de 10 Mbps; no Google real há alguns segundos a mais de resposta do servidor.

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
| Atualizar o código do Apps Script (colar o novo Code.gs e publicar nova versão) | Sem isso o mapa continua lento (16 s com 5 mil pontos em vez de 2 s) e a exportação não pagina | Pendente |
| No app, Coordenação > Formulários > Atualizar formulários prontos | Liga o critério de inclusão de 2 m no formulário de Divinópolis | Pendente |
| Contratar mais espaço no Google Drive | Fotos de Divinópolis passam dos 15 GB gratuitos (ver 6.5) | Pendente |

## Bloco 1 · Coleta em campo

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 1.1 | Cadastrar árvore com espécie, atributos, 3 fotos e GPS | Menos de 2 min por árvore; precisão do GPS exibida | Passou | 04/11/2026 | Cadastro completo salvo com 3 fotos, GPS ±4 m exibido no topo e código automático E1-0001. Tempo humano por árvore ainda precisa ser medido em campo |
| 1.2 | Campos obrigatórios por classe | Não salva sem os obrigatórios | Passou | 04/11/2026 | Árvore sem dados foi bloqueada com 23 pendências listadas |
| 1.3 | Árvore morta | Clique libera só os campos pertinentes | Passou | 04/11/2026 | Raios, área e qualidade de copa e fitossanidade somem; espécie fica opcional |
| 1.4 | Categorias Local de plantio e Calçada sem árvores | Formulário próprio de cada categoria | Passou | 04/11/2026 | Só 3 etapas; pede foto, conflitos, marquise, fiação e tráfego |
| 1.5 | Critério de inclusão (Divinópolis: altura a partir de 2 m) | Alerta ou bloqueio abaixo do critério | Passou | 04/11/2026 | Falhou na primeira rodada (salvava árvore de 1,2 m). Corrigido: o formulário bloqueia e mostra "abaixo do critério de inclusão". Vale no aparelho depois de Atualizar formulários prontos. O mesmo recurso serve para as travas de valores absurdos (limites a definir pelo Ciro) |
| 1.6 | Editar e excluir registro | Alteração fica no histórico | Passou | 04/11/2026 | Falhou na primeira rodada (não havia histórico). Corrigido: edição depois de concluída grava quem mudou, quando, valor antigo e novo na coluna "historico". Exclusão só existe para registro ainda não enviado; registro enviado não é apagado da planilha |
| 1.7 | Formulário customizado por projeto | Trocar de projeto troca o formulário | Passou | 04/11/2026 | Cada projeto aponta para o seu formulário, carregado ao abrir o projeto |

## Bloco 2 · Offline e sincronização

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 2.1 | Coletar 50 árvores em modo avião e sincronizar ao voltar | Nenhuma perda, nenhum duplicado | Passou | 04/11/2026 | 50 de 50 chegaram, 0 duplicados |
| 2.2 | Duas equipes coletando ao mesmo tempo | Códigos nunca se repetem | Passou | 04/11/2026 | Prefixo por equipe (E1, E2) e sequência própria; sem repetição. Rascunhos excluídos deixam buracos na sequência, o que é normal |
| 2.3 | Dois usuários editam o mesmo registro | Regra de conflito definida, sem perda silenciosa | Passou | 04/11/2026 | Regra: vale a edição mais recente. Ressalva: a versão mais antiga é descartada sem avisar quem a fez. A trava de registros concluídos (backlog) reduz esse risco |
| 2.4 | Sincronização interrompida no meio | Retoma sem duplicar | Passou | 04/11/2026 | Com quedas de conexão no envio, os registros ficam na fila e entram na tentativa seguinte, sem duplicar |
| 2.5 | Fotos com sinal fraco | Envio em fila, coleta não trava | Passou | 04/11/2026 | Falha no envio da foto não trava a coleta; o registro espera na fila e sai na próxima tentativa (automática a cada minuto ou ao voltar a internet) |

## Bloco 3 · Mapa e consulta

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 3.1 | Mapa com todos os pontos na escala de teste | Abre em até 5 s (Carmo e Divinópolis); Cemig com agrupamento de pontos | Passou | 04/11/2026 | Falhou na primeira rodada: 15,7 s com 5 mil pontos (baixava 9 MB e desenhava ponto a ponto). Corrigido: o servidor manda só as colunas do mapa e o desenho ficou mais leve. Agora 1,7 s com 5 mil e 4,8 s com 20 mil. Depende de atualizar o Apps Script. Cemig não testada (não cabe na planilha) |
| 3.2 | Filtros por espécie, estado, bairro e equipe | Resultado correto em até 3 s | Falhou | 04/11/2026 | Não existia. Criados filtros por código ou espécie, equipe e risco, e cor por equipe ou por risco: 1,8 s com 20 mil pontos. O formulário não tem campo de bairro; filtro por bairro depende de incluir o campo ou cruzar com o mapa de bairros |
| 3.3 | Busca por código e por endereço | Encontra o registro certo | Falhou | 04/11/2026 | Busca por código criada no mapa: acha, aproxima e abre a ficha em 2,3 s com 20 mil. Busca por endereço ainda não existe |
| 3.4 | Ficha da árvore ao clicar | Mostra atributos e fotos | Passou | 04/11/2026 | Ficha mostra código, espécie, categoria, risco, equipe e link "Ver foto" do Drive; registro do próprio aparelho tem botão Abrir |

## Bloco 4 · Gestão e ordens de serviço

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 4.1 | Criar ordem de serviço (poda, supressão, plantio, remoção) a partir da árvore | Ordem vinculada à árvore | Não implementado | 04/11/2026 | Existe só no MVP navegável feito para a Cemig, separado do app de coleta |
| 4.2 | Fluxo de status: aberta, em execução, concluída | Responsável e data em cada etapa | Não implementado | 04/11/2026 | Idem |
| 4.3 | Registro da execução | Foto antes e depois | Não implementado | 04/11/2026 | Idem |
| 4.4 | Histórico de intervenções por árvore | Lista completa e em ordem | Não implementado | 04/11/2026 | Idem |

## Bloco 5 · Relatórios, exportação e importação

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 5.1 | Exportar GeoPackage | Abre no QGIS com o estilo .qml | Falhou | 04/11/2026 | GeoPackage válido (SIRGAS 2000 / UTM 23S, 20 mil pontos em 2 s, 9 MB). Falta o estilo: o formulário de Divinópolis não tem .qml próprio. Pendente: simbologia com as cores da SEADE embutida |
| 5.2 | Exportar shapefile, KML, Excel e CSV | Arquivos abrem sem erro | Falhou | 04/11/2026 | CSV (abre no Excel) e KML (criado nesta rodada; 18 MB com 20 mil pontos e os campos principais) funcionam. Faltam shapefile e arquivo .xlsx próprio |
| 5.3 | Normalizar códigos dos registros validados na exportação | Sequência única, sem distinção de equipe | Falhou | 04/11/2026 | Criada a coluna "numero_unico" (1 a N, pela ordem de coleta, todas as equipes) no GeoPackage, CSV e KML. Falta o fluxo de validação para numerar só os validados |
| 5.4 | Importar inventário existente (GeoPackage ou planilha) na escala de teste | Todos os registros entram, sem erro | Não implementado | 04/11/2026 | O app só importa formulário (.qml) |
| 5.5 | Relatório em PDF (resumo e por bairro) | Gera em até 1 min | Não implementado | 04/11/2026 | |
| 5.6 | Painel de indicadores (total, espécies, estado, ordens de serviço) | Números batem com a base | Não implementado | 04/11/2026 | Existe só um painel de simulação com dados fictícios, fora do app. Entra com o portal do cliente |

## Bloco 6 · Desempenho e escala

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 6.1 | Gerar base fictícia com 5.000, 20.000 e 500.000 registros | Bases prontas para os testes | Passou | 04/11/2026 | Gerador em `claude/poc/lib.js`. A de 500 mil não foi carregada porque não cabe na planilha (ver 6.3) |
| 6.2 | Medir tempo de abrir mapa, filtrar e exportar em cada escala | Tempos registrados na observação | Passou | 04/11/2026 | 5 mil: mapa 1,7 s, filtro 0,5 s, GeoPackage 0,7 s. 20 mil: mapa 4,8 s, filtro 1,8 s, busca 2,3 s, GeoPackage 2,0 s, CSV 1,6 s, KML 1,7 s. Entrada no app 2 s nas duas escalas. 500 mil: não se aplica na arquitetura atual |
| 6.3 | Verificar limites do backend (células, tempo de execução, cotas) em cada escala | Indicar em qual escala quebra | Passou | 04/11/2026 | Quebra acima de cerca de 130 mil registros por projeto (10 milhões de células). Carmo e Divinópolis cabem com folga; Cemig não. A listagem completa de 20 mil registros dava 37 MB numa resposta só: agora vem em páginas de 4 mil |
| 6.4 | Usuários simultâneos: 10 (Divinópolis) e 50 (Cemig) | Sem erro nem lentidão grave | Não testado | 04/11/2026 | Precisa do Google real. Análise: o Google aceita cerca de 30 execuções ao mesmo tempo por conta, e as gravações entram em fila (uma por vez). 10 usuários devem funcionar; 50 provavelmente não |
| 6.5 | Armazenamento de fotos | Estimativa em GB por escala (500.000 árvores com 3 fotos de 300 KB dão cerca de 450 GB) | Passou | 04/11/2026 | Foto de 12 MP fica com cerca de 600 KB depois da redução do app (2048 px). Com 3 fotos por árvore: Carmo (3 mil) cerca de 5 GB, Divinópolis (10 mil) cerca de 18 GB, Cemig (500 mil) cerca de 900 GB. Divinópolis já passa dos 15 GB gratuitos do Google: contratar plano maior |

## Bloco 7 · Usuários e segurança

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 7.1 | Perfis: administrador, coletor, revisor, cliente | Cada perfil vê e faz só o permitido | Falhou | 04/11/2026 | Administrador e coletor funcionam (coletor não lista nem cria usuários nem altera formulário). Faltam os perfis revisor e cliente |
| 7.2 | Coletor acessa só o seu projeto | Sem acesso a outros projetos | Passou | 04/11/2026 | Usuário de outro projeto não lê nem grava em Divinópolis. Ressalva: dentro do mesmo projeto, uma equipe consegue alterar registro de outra |
| 7.3 | Portal do cliente com login | Mapa e painel, somente leitura | Não implementado | 04/11/2026 | Próxima entrega combinada |
| 7.4 | Registro de auditoria | Mostra quem alterou o quê e quando | Falhou | 04/11/2026 | Alterações em registros agora ficam na coluna "historico" (criada nesta rodada). Ainda não há registro de entradas no sistema nem de mudanças de usuários e formulários |
| 7.5 | Login, expiração de sessão, conexão segura | Funciona sem falhas | Falhou | 04/11/2026 | Conexão segura (HTTPS) ok. Senhas ficam em texto puro na planilha e no aparelho, sessão não expira e não há bloqueio após senhas erradas (8 tentativas erradas e a certa entrou) |
| 7.6 | Cópia de segurança e restauração | Restauração testada de fato | Não implementado | 04/11/2026 | Só o histórico de versões nativo do Google Planilhas. Falta cópia diária na pasta Backup e por email |
| 7.7 | Lei Geral de Proteção de Dados | Só dados pessoais necessários, com termo de uso | Falhou | 04/11/2026 | Coleta só login e nome da equipe, mas não há termo de uso nem política de privacidade |

## Bloco 8 · Plataformas e integração

| Nº | Teste | Critério de aprovação | Status | Data | Observação |
|---|---|---|---|---|---|
| 8.1 | Android, incluindo aparelhos mais antigos | Funciona em Android 8 ou superior | Não testado | 04/11/2026 | Testado em Android simulado (Pixel 7) com Chrome. Falta aparelho real, e o Chrome atual pode não rodar em Android 8 e 9 |
| 8.2 | Navegador no computador | Funciona em Chrome, Edge e Firefox | Falhou | 04/11/2026 | Chrome no computador ok (coordenação e exportação). Edge usa o mesmo motor do Chrome, mas não foi testado; Firefox não testado |
| 8.3 | iPhone | Funciona, se o edital exigir | Não testado | 04/11/2026 | Sem Safari no ambiente de teste; precisa de iPhone real |
| 8.4 | Integração com outros sistemas (provável na Cemig) | Interface de integração documentada e testada | Falhou | 04/11/2026 | Interface documentada nesta rodada em `docs/api.md`. Falta chave de acesso própria para sistemas externos e teste com um sistema de verdade |

## Resumo da rodada de 04/11/2026

| Status | Quantidade |
|---|---|
| Passou | 19 |
| Falhou | 11 |
| Não implementado | 9 |
| Não testado | 3 |

Prioridades para a próxima rodada, pensando em licitação: ordens de serviço (bloco 4), portal do cliente e perfis (7.1 e 7.3), segurança de senhas e bloqueio (7.5), cópia de segurança (7.6), estilo no GeoPackage (5.1), shapefile e Excel (5.2), importação (5.4) e testes em aparelhos reais (8.1 e 8.3).

## Histórico de execuções

| Data | Chat ou responsável | Blocos rodados | Resumo |
|---|---|---|---|
| 04/11/2026 | Criação do roteiro | Nenhum | Roteiro criado, nada testado ainda |
| 04/11/2026 | Chat do app de coleta (RODAR POC) | Todos | Testes automáticos em celular simulado com 5 mil e 20 mil registros. Corrigidos nesta rodada: critério de 2 m (1.5), histórico de alterações (1.6), mapa lento (3.1), filtros e busca no mapa (3.2, 3.3), ficha com foto (3.4), exportação em páginas, KML e numeração única (5.2, 5.3), documentação da interface (8.4). Confirmado que a Cemig não cabe em planilha Google |
