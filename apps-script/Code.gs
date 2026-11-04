/**
 * Ponte Google do app de coleta Neofloresta.
 * Guarda registros em uma planilha por projeto e fotos na pasta DCIM do projeto, no Drive.
 *
 * Instalação (uma vez):
 *  1. Rode a função "configurar" (menu Executar). Autorize o acesso ao Drive e Planilhas.
 *  2. Implantar > Nova implantação > Tipo: App da Web. Executar como: Eu. Quem pode acessar: Qualquer pessoa.
 *  3. Copie a URL que termina em /exec e cole no app (config.js ou menu Servidor).
 */

const PROPS = PropertiesService.getScriptProperties();
const COLS_USUARIOS = ['login', 'senha', 'nome', 'perfil', 'projeto', 'equipe', 'codigo'];
const COLS_PROJETOS = ['id', 'nome', 'formulario', 'epsg', 'prefixo', 'pasta_id', 'planilha_id'];

function configurar() {
  let raiz = PROPS.getProperty('RAIZ_ID');
  if (!raiz) {
    const pasta = DriveApp.createFolder('Neofloresta Coleta');
    raiz = pasta.getId(); PROPS.setProperty('RAIZ_ID', raiz);
    PROPS.setProperty('FORMS_ID', pasta.createFolder('Formularios').getId());
    const base = SpreadsheetApp.create('Neofloresta Coleta - Usuarios e Projetos');
    DriveApp.getFileById(base.getId()).moveTo(pasta);
    const u = base.getSheets()[0]; u.setName('Usuarios'); u.appendRow(COLS_USUARIOS);
    const senha = String(Math.floor(100000 + Math.random() * 900000));
    u.appendRow(['admin', "'" + senha, 'Coordenação', 'admin', '*', 'Coordenação', 'CO']);
    u.setFrozenRows(1);
    const p = base.insertSheet('Projetos'); p.appendRow(COLS_PROJETOS); p.setFrozenRows(1);
    PROPS.setProperty('BASE_ID', base.getId());
    Logger.log('Pronto. Usuário: admin  Senha: ' + senha + '  (troque pelo app em Coordenação > Equipes e usuários)');
    Logger.log('Pasta no Drive: ' + pasta.getUrl());
  } else {
    Logger.log('Já configurado. Pasta: ' + DriveApp.getFolderById(raiz).getUrl());
  }
}

// ---------- Entrada ----------
function doGet() { return json({ ok: true, app: 'Neofloresta Coleta', configurado: !!PROPS.getProperty('BASE_ID') }); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const usr = autenticar(d.u, d.s);
    const admin = usr.perfil === 'admin';
    const exigeAdmin = () => { if (!admin) throw new Error('Acesso restrito à coordenação.'); };
    const exigeProjeto = (id) => { if (!admin && usr.projetos.indexOf(id) < 0) throw new Error('Projeto não liberado para este usuário.'); };
    switch (d.acao) {
      case 'login': return json({ ok: true, usuario: { login: usr.login, nome: usr.nome, perfil: usr.perfil }, projetos: projetosDoUsuario(usr) });
      case 'formulario': return json({ ok: true, formulario: lerFormulario(d.id) });
      case 'estilo': return json({ ok: true, qml: lerArquivoForm(d.id + '.qml') });
      case 'foto': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, salvarFoto(d.projeto, d.nome, d.mime, d.dados)));
      case 'registro': exigeProjeto(d.projeto); salvarRegistro(d.projeto, d.linha, usr); return json({ ok: true });
      case 'listar': exigeProjeto(d.projeto); return json({ ok: true, linhas: listar(d.projeto) });
      case 'projetos_listar': exigeAdmin(); return json({ ok: true, projetos: tabela('Projetos').map(comLinks) });
      case 'projeto_salvar': exigeAdmin(); salvarProjeto(d.projeto_dados); return json({ ok: true });
      case 'usuarios_listar': exigeAdmin(); return json({ ok: true, usuarios: tabela('Usuarios') });
      case 'usuario_salvar': exigeAdmin(); salvarLinha('Usuarios', COLS_USUARIOS, 'login', d.usuario_dados); return json({ ok: true });
      case 'usuario_remover': exigeAdmin(); removerLinha('Usuarios', 'login', d.login); return json({ ok: true });
      case 'formularios_listar': exigeAdmin(); return json({ ok: true, formularios: listarFormularios() });
      case 'formulario_salvar': exigeAdmin(); salvarFormulario(d.formulario, d.qml); return json({ ok: true });
      default: throw new Error('Ação desconhecida: ' + d.acao);
    }
  } catch (err) {
    return json({ ok: false, erro: err.message });
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- Base (usuários e projetos) ----------
function base() {
  const id = PROPS.getProperty('BASE_ID');
  if (!id) throw new Error('Servidor não configurado. Rode a função configurar no Apps Script.');
  return SpreadsheetApp.openById(id);
}
function tabela(nome) {
  const v = base().getSheetByName(nome).getDataRange().getValues();
  const cab = v.shift();
  return v.filter((l) => l[0] !== '').map((l) => { const o = {}; cab.forEach((c, i) => (o[c] = l[i] instanceof Date ? l[i].toISOString() : String(l[i]))); return o; });
}
function salvarLinha(nome, cols, chave, obj) {
  const sh = base().getSheetByName(nome);
  const v = sh.getDataRange().getValues(); const cab = v[0]; const ic = cab.indexOf(chave);
  const linha = cab.map((c) => (obj[c] == null ? '' : "'" + String(obj[c])));
  for (let i = 1; i < v.length; i++) if (String(v[i][ic]) === String(obj[chave])) { sh.getRange(i + 1, 1, 1, linha.length).setValues([linha]); return; }
  sh.appendRow(linha);
}
function removerLinha(nome, chave, valor) {
  const sh = base().getSheetByName(nome); const v = sh.getDataRange().getValues(); const ic = v[0].indexOf(chave);
  for (let i = v.length - 1; i >= 1; i--) if (String(v[i][ic]) === String(valor)) sh.deleteRow(i + 1);
}

function autenticar(login, senha) {
  if (!login) throw new Error('Informe usuário e senha.');
  const u = tabela('Usuarios').find((x) => x.login.toLowerCase() === String(login).toLowerCase() && x.senha === String(senha));
  if (!u) throw new Error('Usuário ou senha incorretos.');
  u.projetos = u.projeto === '*' ? [] : u.projeto.split(',').map((s) => s.trim()).filter(String);
  return u;
}
function projetosDoUsuario(u) {
  return tabela('Projetos').filter((p) => u.perfil === 'admin' || u.projetos.indexOf(p.id) >= 0)
    .map((p) => ({ id: p.id, nome: p.nome, formulario: p.formulario, epsg: p.epsg, prefixo: p.prefixo, equipe: u.equipe, equipeCodigo: u.codigo || '' }));
}
function comLinks(p) {
  const o = Object.assign({}, p);
  if (p.pasta_id) o.pasta_url = 'https://drive.google.com/drive/folders/' + p.pasta_id;
  if (p.planilha_id) o.planilha_url = 'https://docs.google.com/spreadsheets/d/' + p.planilha_id;
  return o;
}
function projeto(id) {
  const p = tabela('Projetos').find((x) => x.id === id);
  if (!p) throw new Error('Projeto não encontrado: ' + id);
  return p;
}

function salvarProjeto(p) {
  if (!p || !p.id) throw new Error('Projeto sem identificador.');
  const atual = tabela('Projetos').find((x) => x.id === p.id);
  if (atual) { p.pasta_id = atual.pasta_id; p.planilha_id = atual.planilha_id; }
  if (!p.pasta_id) {
    const pasta = DriveApp.getFolderById(PROPS.getProperty('RAIZ_ID')).createFolder(p.nome);
    pasta.createFolder('DCIM');
    const ss = SpreadsheetApp.create(p.nome + ' - Registros');
    DriveApp.getFileById(ss.getId()).moveTo(pasta);
    ss.getSheets()[0].setName('Registros');
    p.pasta_id = pasta.getId(); p.planilha_id = ss.getId();
  }
  salvarLinha('Projetos', COLS_PROJETOS, 'id', p);
}

// ---------- Formulários ----------
function pastaForms() { return DriveApp.getFolderById(PROPS.getProperty('FORMS_ID')); }
function lerArquivoForm(nome) { const it = pastaForms().getFilesByName(nome); return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null; }
function gravarArquivoForm(nome, texto, mime) {
  const it = pastaForms().getFilesByName(nome);
  if (it.hasNext()) it.next().setContent(texto); else pastaForms().createFile(nome, texto, mime);
}
function lerFormulario(id) { const t = lerArquivoForm(id + '.json'); if (!t) throw new Error('Formulário não encontrado: ' + id); return JSON.parse(t); }
function salvarFormulario(f, qml) {
  if (!f || !f.id) throw new Error('Formulário inválido.');
  gravarArquivoForm(f.id + '.json', JSON.stringify(f), 'application/json');
  if (qml) gravarArquivoForm(f.id + '.qml', qml, 'text/xml');
}
function listarFormularios() {
  const out = []; const it = pastaForms().getFiles();
  while (it.hasNext()) {
    const a = it.next(); if (!/\.json$/.test(a.getName())) continue;
    try { const f = JSON.parse(a.getBlob().getDataAsString('UTF-8')); out.push({ id: f.id, nome: f.nome, campos: f.campos.length }); } catch (e) { /* ignora */ }
  }
  return out;
}

// ---------- Fotos ----------
function salvarFoto(projetoId, nome, mime, dados) {
  const p = projeto(projetoId);
  const pasta = DriveApp.getFolderById(p.pasta_id);
  const it = pasta.getFoldersByName('DCIM'); const dcim = it.hasNext() ? it.next() : pasta.createFolder('DCIM');
  const ex = dcim.getFilesByName(nome);
  const arq = ex.hasNext() ? ex.next() : dcim.createFile(Utilities.newBlob(Utilities.base64Decode(dados), mime || 'image/jpeg', nome));
  return { id: arq.getId(), url: 'https://drive.google.com/file/d/' + arq.getId() + '/view' };
}

// ---------- Registros ----------
function planilha(projetoId) { return SpreadsheetApp.openById(projeto(projetoId).planilha_id).getSheetByName('Registros'); }

function celula(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  // texto que a planilha converteria sozinha (ex.: 156/2 virar data, 52,6 virar número)
  if (/^[\d\s.,\/:;+\-]+$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s) || /^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function salvarRegistro(projetoId, linha, usr) {
  if (!linha || !linha.uuid) throw new Error('Registro sem identificador.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = planilha(projetoId);
    let cab = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (!cab.length || cab[0] === '') { cab = []; }
    const novas = Object.keys(linha).filter((k) => cab.indexOf(k) < 0);
    if (novas.length) {
      sh.getRange(1, cab.length + 1, 1, novas.length).setValues([novas]).setFontWeight('bold');
      cab = cab.concat(novas); sh.setFrozenRows(1);
    }
    linha.usuario = linha.usuario || usr.login;
    const valores = cab.map((c) => celula(linha[c]));
    const iu = cab.indexOf('uuid') + 1;
    const achado = sh.getLastRow() > 1 ? sh.getRange(2, iu, sh.getLastRow() - 1, 1).createTextFinder(linha.uuid).matchEntireCell(true).findNext() : null;
    if (achado) {
      const r = achado.getRow();
      const ia = cab.indexOf('atualizado_em');
      const atual = sh.getRange(r, ia + 1).getValue();
      const atualIso = atual instanceof Date ? atual.toISOString() : String(atual);
      if (atualIso && linha.atualizado_em && atualIso > linha.atualizado_em) return; // já existe versão mais nova
      sh.getRange(r, 1, 1, valores.length).setValues([valores]);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, valores.length).setValues([valores]);
    }
  } finally { lock.releaseLock(); }
}

function listar(projetoId) {
  const sh = planilha(projetoId);
  if (sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(); const cab = v.shift();
  return v.map((l) => { const o = {}; cab.forEach((c, i) => (o[c] = l[i] instanceof Date ? l[i].toISOString() : l[i])); return o; });
}
