# Coleta Neofloresta

App de coleta de campo da arborização urbana. Funciona no navegador do celular (Android e iPhone), pode ser instalado como ícone na tela e funciona sem internet.

- `app/`: o aplicativo (vai para o GitHub Pages)
- `apps-script/Code.gs`: a ponte com o Google (planilha e Drive)

## 1. Ponte Google (uma vez, cerca de 10 minutos)

1. Acesse script.google.com com a conta Google da Neofloresta e clique em **Novo projeto**.
2. Apague o conteúdo e cole o arquivo `apps-script/Code.gs` inteiro. Salve com o nome "Coleta Neofloresta".
3. No seletor de funções, escolha **configurar** e clique em **Executar**. Autorize o acesso.
4. Em **Registro de execução** aparecem o usuário `admin` e a senha inicial. Anote.
   No Drive é criada a pasta **Neofloresta Coleta**.
5. Clique em **Implantar > Nova implantação**. Em tipo, escolha **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a **URL do app da Web** (termina em `/exec`).

O acesso "Qualquer pessoa" só permite falar com o script. Quem controla quem entra é o usuário e a senha cadastrados no app.

## 2. Publicar o app (GitHub Pages)

1. Na organização `neofloresta` do GitHub, crie o repositório **coleta** (público).
2. Abra `app/config.js` e cole a URL do passo 1.6 entre as aspas de `servidor`.
3. Envie **o conteúdo da pasta `app/`** para o repositório (Add file > Upload files, arrastando tudo).
4. Em **Settings > Pages**, escolha a branch `main`, pasta `/ (root)` e salve.
5. Em 1 ou 2 minutos o app fica em `https://neofloresta.github.io/coleta/`.

## 3. Primeiro acesso (coordenação)

1. Abra o endereço e entre como `admin`.
2. **Formulários**: instale o formulário de avaliação de risco (SEADE) ou importe um novo do QGIS (.qml + .gpkg).
3. **Projetos**: crie o projeto (ex.: PMAU Divinópolis). O Drive ganha a pasta do projeto, com a planilha e a subpasta DCIM.
4. **Equipes e usuários**: crie um usuário por equipe (ex.: `divi-eq1`, `divi-eq2`, `carmo-eq1`) e troque a senha do admin.

## 4. Instalar no celular das equipes

- Android (Chrome): abra o endereço > menu ⋮ > **Instalar app** (ou "Adicionar à tela inicial").
- iPhone (Safari): abra o endereço > botão Compartilhar > **Adicionar à Tela de Início**.

Faça o primeiro login com internet. Depois disso o app funciona sem rede.

## Dados

- **Planilha**: uma por projeto, na pasta do projeto. Uma linha por árvore, com equipe, usuário, datas, coordenadas e todos os campos. Para Excel: Arquivo > Fazer download > .xlsx.
- **Fotos**: pasta `DCIM` do projeto, com o mesmo padrão de nome do QField. O campo guarda `DCIM/nome.jpg` e a coluna "Foto N link" guarda o link do Drive.
- **GeoPackage**: Coordenação > Exportar. Os nomes de campo são os mesmos do QGIS, em SIRGAS 2000 / UTM (fuso automático ou definido no projeto). Se o formulário veio de um .qml, o estilo vai embutido.
- **Fotos no QGIS**: baixe a pasta DCIM do projeto no Drive e coloque-a ao lado do .gpkg.

## Atualizações do app

Ao trocar arquivos no GitHub, altere a versão na primeira linha útil de `sw.js` (ex.: `coleta-v1.0.1`). Os celulares atualizam na abertura seguinte.
