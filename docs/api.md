# Interface de integração (API) · App de Arborização Neofloresta

Versão do script: 1.10

## Endereço e formato

- Endereço: a URL do Apps Script publicada como app da Web (termina em `/exec`).
- Método: `POST`, corpo em JSON (pode ir como `text/plain`).
- Toda chamada leva `acao`, `u` (usuário) e `s` (senha).
- Resposta: JSON com `ok: true` e os dados, ou `ok: false` e `erro` com a mensagem.
- `GET` no mesmo endereço devolve `{ ok, app, versao, configurado }`, para checar se o serviço está no ar.

Exemplo:

```json
{ "acao": "listar", "u": "div-1", "s": "senha", "projeto": "divinopolis", "de": 0, "n": 4000 }
```

## Ações

| Ação | Quem pode | Parâmetros | Devolve |
|---|---|---|---|
| `login` | Todos | nenhum | `usuario`, `projetos`, `versaoScript` |
| `formulario` | Todos | `id` | `formulario` (JSON do formulário) |
| `estilo` | Todos | `id` | `qml` (estilo do QGIS, se houver) |
| `listar` | Usuários do projeto | `projeto`, opcionais `de` e `n` (página) | `linhas` (registros) e `total` |
| `mapa` | Usuários do projeto | `projeto`, `campos` (lista de colunas) | `cab` e `linhas` (listas compactas, só as colunas pedidas) |
| `registro` | Usuários do projeto | `projeto`, `linha` (registro com `uuid` e `atualizado_em`) | `ok`. Grava ou atualiza pelo `uuid`; versão mais antiga não sobrescreve a mais nova |
| `foto` | Usuários do projeto | `projeto`, `nome`, `mime`, `dados` (base64) | `id` e `url` da foto no Drive |
| `projetos_listar` | Coordenação | nenhum | `projetos` |
| `projeto_salvar` | Coordenação | `projeto_dados` | `ok` |
| `usuarios_listar` | Coordenação | nenhum | `usuarios` |
| `usuario_salvar` | Coordenação | `usuario_dados` | `ok` |
| `usuario_remover` | Coordenação | `login` | `ok` |
| `formularios_listar` | Coordenação | nenhum | `formularios` |
| `formulario_salvar` | Coordenação | `formulario`, `qml` opcional | `ok` |
| `os_listar` | Usuários do projeto (a equipe vê só as ordens dela) | `projeto` | `ordens`, `tipos` |
| `os_salvar` | Coordenação abre; cliente e equipe pedem (fica Solicitada) | `projeto`, `os` (`registro_uuid` ou `latitude` e `longitude`, `tipo`, `prioridade`, `descricao`; coordenação também `responsavel` e `prazo`; `chave` evita duplicar no reenvio) | `ordem` |
| `os_andamento` | Coordenação; a equipe responsável inicia e conclui | `projeto`, `id`, `etapa` (`aprovar`, `iniciar`, `concluir`, `cancelar`, `reabrir`), `dados` (`foto_antes`, `foto_depois`, `obs`, `em`) | `ordem` |
| `chave_criar`, `chaves_listar`, `chave_revogar` | Coordenação | `nome`, `projeto` / `id` | a chave aparece só na criação |
| `backup_listar`, `backup_restaurar` | Coordenação | `projeto` / `projeto`, `arquivo` | quantidade restaurada e identificador da cópia do estado anterior |

## Acesso de outros sistemas (chave de integração)

A coordenação cria a chave em Coordenação > Segurança > Chaves de integração, para um projeto. A chave começa com `neo_`, aparece uma vez só e pode ser revogada a qualquer momento. No servidor fica só o resumo criptográfico.

Com a chave, o sistema externo envia `chave_api` no lugar de `t` e pode usar somente: `listar` (em páginas, com `de` e `n`), `mapa`, `painel`, `os_listar` e `formulario`. Qualquer gravação é recusada, e cada consulta fica no registro de auditoria com o nome da chave.

Exemplo:

```
POST <endereço do servidor>
{"acao": "listar", "chave_api": "neo_...", "projeto": "divinopolis", "de": 0, "n": 4000}
```

Resposta: `{"ok": true, "linhas": [...], "proximo": 4000}`. Repita com `de` = `proximo` até `proximo` vir vazio. A chave enxerga o mesmo que o perfil cliente: só os registros que o projeto libera ao cliente (validados, ou todos se o projeto estiver configurado assim), sem colunas internas, e no máximo 5000 linhas por página.

## Campos de cada ordem de serviço

`id`, `numero` (sequência única do projeto), `registro_uuid` e `codigo_arvore` (quando ligada a uma árvore), `especie`, `latitude`, `longitude`, `endereco`, `bairro`, `tipo`, `prioridade` (Urgente, Alta, Média, Baixa), `descricao`, `status` (Solicitada, Aberta, Em execução, Concluída, Cancelada), `prazo` (AAAA-MM-DD), quando cada etapa aconteceu (`solicitada_em`, `aberta_em`, `iniciada_em`, `concluida_em`, `cancelada_em`), `foto_antes` e `foto_depois` (links no Drive), `execucao_obs`, `motivo`. Desde a versão 2.6, a chave de integração (como o cliente) não recebe os dados internos das equipes: `responsavel`, quem fez cada etapa (`*_por`) e `historico`.

## Campos fixos de cada registro

`uuid`, `projeto`, `criado_em`, `atualizado_em` (data e hora ISO 8601, UTC), `latitude`, `longitude` (graus decimais, SIRGAS 2000), `precisao_gps_m`. Desde a versão 2.6, a chave de integração (como o cliente) não recebe os dados internos das equipes: `equipe`, `usuario`, o campo de coletor do formulário, `validado_por`, `historico` e `validacao_hist`. Os demais campos seguem o formulário do projeto; cada foto tem uma coluna com o nome do arquivo e outra com o link no Drive.

## Limites conhecidos

- Planilha Google: até 10 milhões de células. Com cerca de 76 colunas, cabem perto de 130 mil registros por projeto.
- Cada chamada tem até 6 minutos. Para projetos grandes, use `listar` em páginas (`n` = 4000).
- Autenticação por sessão (token) para pessoas e por chave de integração para sistemas, sempre por HTTPS.
