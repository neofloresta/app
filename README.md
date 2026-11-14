# ArborizIA Coletor (por Neofloresta)

Sistema de inventário da arborização urbana da Neofloresta Serviços Ecossistêmicos: coleta em campo pelo celular (funciona sem internet), validação técnica, painel de indicadores, portal do cliente e entrega dos dados em formatos de SIG e de planilha.

Versão 2.0 · app em `https://neofloresta.github.io/app/`

## O que faz

| Perfil | O que vê e faz |
|---|---|
| Equipe de campo | Cadastra árvores, locais de plantio e calçadas com fotos e GPS, sem internet. Código automático por equipe. Corrige registros devolvidos pela coordenação. |
| Revisão técnica | Lista de validação com alertas automáticos (sem foto, GPS ruim, espécie fora da lista, medidas fora do comum, código repetido). Valida em lote, devolve com motivo ou descarta. |
| Cliente | Portal só de consulta: painel, mapa e relatório dos registros validados, e download dos dados validados. |
| Coordenação | Tudo acima, mais projetos, usuários, formulários, importação de inventário existente, exportações, cópia de segurança e auditoria. |

- **Formulário por projeto**, com campos obrigatórios por categoria, regras (árvore morta, local de plantio) e limites de valores (ex.: altura mínima de 2 m).
- **Trava de registros concluídos**: a equipe só altera no mesmo dia ou quando a coordenação devolve; toda alteração pede duas confirmações e fica no histórico.
- **Painel** com metas, ritmo, validação, categorias, risco, espécies (com alerta de diversidade 10% por espécie e 20% por gênero), DAP, manejo e ocorrências.
- **Relatório** pronto para imprimir ou salvar em PDF.
- **Exportação**: GeoPackage com a simbologia do QGIS embutida, Excel com dicionário de campos, Shapefile, CSV e KML. Numeração única do projeto (`numero_unico`).
- **Mapa** com ruas ou satélite, filtros, busca por código, espécie ou endereço.
- **Segurança**: senha criptografada, bloqueio após 5 senhas erradas, sessão com validade de 30 dias, termo de uso e privacidade (LGPD), auditoria e cópia de segurança diária por email.

## Estrutura

- `index.html`, `js/`, `styles.css`, `sw.js`, `forms/`: o aplicativo (GitHub Pages)
- `apps-script/Code.gs`: o servidor no Google (planilhas e Drive)
- `docs/api.md`: interface de integração
- `claude/roteiro-poc.md`: roteiro da prova de conceito; `claude/poc/`: testes automáticos

## Instalação do servidor (uma vez)

1. Em script.google.com, com a conta Google da Neofloresta, crie um projeto, cole o `apps-script/Code.gs` e salve.
2. Execute a função **configurar** e autorize. O registro de execução mostra o usuário `admin` e a senha inicial.
3. **Implantar > Nova implantação > App da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. Copie a URL que termina em `/exec` para o `config.js`.

O acesso "Qualquer pessoa" só permite falar com o script; quem entra é controlado pelo usuário e senha do app.

### Atualizar o servidor

1. Cole o `Code.gs` novo por cima do antigo e salve.
2. Execute **configurar** de novo (cria as abas novas e pede autorização para o que for novo, como email e gatilho diário).
3. **Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar**. A URL continua a mesma.

## Atualizar o app

Troque os arquivos no GitHub e mude a versão em `sw.js` (`CACHE`). Os aparelhos atualizam na abertura seguinte com internet.

## Testes

`cd claude/poc && node srv.js` (servidor), `node b12.js` (coleta e envio), `node b47.js 3000` (perfis, validação, painel, exportação, importação), `node b3.js 20000` (mapa em escala), `node b5.js 20000` (exportação em escala).
