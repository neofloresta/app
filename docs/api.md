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

## Campos fixos de cada registro

`uuid`, `projeto`, `equipe`, `usuario`, `criado_em`, `atualizado_em` (data e hora ISO 8601, UTC), `latitude`, `longitude` (graus decimais, SIRGAS 2000), `precisao_gps_m`, `historico` (alterações feitas depois de concluído). Os demais campos seguem o formulário do projeto; cada foto tem uma coluna com o nome do arquivo e outra com o link no Drive.

## Limites conhecidos

- Planilha Google: até 10 milhões de células. Com cerca de 76 colunas, cabem perto de 130 mil registros por projeto.
- Cada chamada tem até 6 minutos. Para projetos grandes, use `listar` em páginas (`n` = 4000).
- Autenticação por usuário e senha em cada chamada, sempre por HTTPS. Ainda sem chave de acesso própria para sistemas externos.
