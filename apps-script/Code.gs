/**
 * Neofloresta Inventário · servidor (Google Apps Script)
 * Guarda os registros em uma planilha por projeto e as fotos na pasta DCIM do projeto, no Google Drive.
 *
 * Instalação (uma vez):
 *  1. Rode a função "configurar" (menu Executar) e autorize o acesso.
 *  2. Implantar > Nova implantação > Tipo: App da Web. Executar como: Eu. Quem pode acessar: Qualquer pessoa.
 *  3. Copie a URL que termina em /exec e cole no app (config.js ou menu Servidor).
 * Atualização: cole o código novo, rode "configurar" de novo (autoriza o que for novo) e publique uma nova versão
 * em Implantar > Gerenciar implantações > editar (lápis) > Versão: Nova versão.
 */

const PROPS = PropertiesService.getScriptProperties();
const VERSAO_SCRIPT = '2.0';
const COLS_USUARIOS = ['login', 'senha', 'nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo', 'senha_hash', 'sal', 'tentativas', 'bloqueado_ate', 'termo_aceito_em', 'criado_em'];
const COLS_PROJETOS = ['id', 'nome', 'formulario', 'epsg', 'prefixo', 'pasta_id', 'planilha_id', 'contratante', 'contrato', 'municipio', 'meta', 'cliente_ve', 'responsavel', 'registro_profissional', 'art'];
const COLS_SESSOES = ['token', 'login', 'criada_em', 'expira_em', 'aparelho'];
const COLS_AUDITORIA = ['em', 'login', 'acao', 'alvo', 'detalhe'];
const PERFIS = ['admin', 'revisor', 'coletor', 'cliente'];
// Colunas que só o servidor escreve (validação). Um envio do aparelho nunca as apaga.
const COLS_SISTEMA = ['validacao', 'validacao_obs', 'validado_por', 'validado_em', 'validacao_hist', 'numero_unico', 'servidor_em'];
// Colunas internas que o perfil cliente não recebe
const COLS_INTERNAS = ['usuario', 'validacao_obs', 'servidor_em'];
const SESSAO_DIAS = 30;
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;
const FUSO = 'America/Sao_Paulo';
const ITERACOES = 1000;
const SENHA_MIN = 8;
const ACOES_ESCRITA = ['registro', 'foto', 'validar', 'importar'];
// texto que começaria uma fórmula na planilha vira texto puro
function seguro(v) { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function hashToken(t) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'sessao|' + t, Utilities.Charset.UTF_8)); }

function configurar() {
  let raiz = PROPS.getProperty('RAIZ_ID');
  if (!raiz) {
    const pasta = DriveApp.createFolder('Neofloresta Inventário');
    raiz = pasta.getId(); PROPS.setProperty('RAIZ_ID', raiz);
    PROPS.setProperty('FORMS_ID', pasta.createFolder('Formularios').getId());
    const base = SpreadsheetApp.create('Neofloresta Inventário - Usuários e Projetos');
    DriveApp.getFileById(base.getId()).moveTo(pasta);
    const u = base.getSheets()[0]; u.setName('Usuarios'); u.appendRow(COLS_USUARIOS);
    const senha = String(Math.floor(100000 + Math.random() * 900000));
    const r2 = u.getRange(2, 1, 1, COLS_USUARIOS.length);
    r2.setNumberFormats([COLS_USUARIOS.map(() => '@')]);
    r2.setValues([COLS_USUARIOS.map((c) => ({ login: 'admin', senha: senha, nome: 'Coordenação', perfil: 'admin', projeto: '*', equipe: 'Coordenação', codigo: 'CO', ativo: 'sim', criado_em: new Date().toISOString() })[c] || '')]);
    u.setFrozenRows(1);
    const p = base.insertSheet('Projetos'); p.appendRow(COLS_PROJETOS); p.setFrozenRows(1);
    PROPS.setProperty('BASE_ID', base.getId());
    Logger.log('Pronto. Usuário: admin  Senha: ' + senha + '  (troque pelo app em Coordenação > Equipes e usuários)');
    Logger.log('Pasta no Drive: ' + pasta.getUrl());
  } else {
    Logger.log('Já configurado. Pasta: ' + DriveApp.getFolderById(raiz).getUrl());
  }
  // garante as abas e colunas novas (atualização de versões anteriores)
  garantirColunas('Usuarios', COLS_USUARIOS); garantirColunas('Projetos', COLS_PROJETOS);
  garantirAba('Sessoes', COLS_SESSOES); garantirAba('Auditoria', COLS_AUDITORIA);
  try { numerarExistentes(); } catch (e) { Logger.log('Numeração: ' + e.message); }
  Logger.log('Versão do servidor: ' + VERSAO_SCRIPT);
}

// ---------- Entrada ----------
function doGet() { return json({ ok: true, app: 'Neofloresta Inventário', versao: VERSAO_SCRIPT, configurado: !!PROPS.getProperty('BASE_ID') }); }

function doPost(e) {
  let d = {};
  try {
    d = JSON.parse(e.postData.contents);
    // entrar com usuário e senha devolve uma sessão; as demais ações usam a sessão (ou usuário e senha, nas versões antigas do app)
    if (d.acao === 'login') {
      const usr = autenticarSenha(d.u, d.s);
      const token = d.semSessao ? '' : criarSessao(usr.login, d.aparelho);
      auditar(usr.login, 'login', '', d.aparelho || '');
      return json({ ok: true, versaoScript: VERSAO_SCRIPT, token: token, expira_em: token ? new Date(Date.now() + SESSAO_DIAS * 864e5).toISOString() : '', usuario: publico(usr), projetos: projetosDoUsuario(usr) });
    }
    const usr = d.t ? autenticarSessao(d.t) : autenticarSenha(d.u, d.s, true);
    if (ACOES_ESCRITA.indexOf(d.acao) >= 0 && !usr.termo_aceito_em && usr.perfil !== 'admin') throw new Error('Aceite o termo de uso e privacidade no app antes de enviar dados (atualize o app e entre de novo).');
    const formLiberado = (id) => { if (usr.perfil !== 'admin' && !projetosDoUsuario(usr).some((p) => p.formulario === id)) throw new Error('Formulário não liberado para este usuário.'); };
    const perfil = usr.perfil;
    const admin = perfil === 'admin';
    const pode = (...ps) => { if (!admin && ps.indexOf(perfil) < 0) throw new Error('Seu perfil não tem acesso a esta função.'); };
    const exigeProjeto = (id) => { if (!admin && usr.projetos.indexOf(id) < 0) throw new Error('Projeto não liberado para este usuário.'); };
    switch (d.acao) {
      case 'sessao': return json({ ok: true, versaoScript: VERSAO_SCRIPT, usuario: publico(usr), projetos: projetosDoUsuario(usr) });
      case 'sair': encerrarSessao(d.t); return json({ ok: true });
      case 'aceitar_termo': atualizarUsuario(usr.login, { termo_aceito_em: new Date().toISOString() }); auditar(usr.login, 'aceitar_termo', '', d.versao || ''); return json({ ok: true });
      case 'trocar_senha': trocarSenha(usr, d.atual, d.nova, d.t); return json({ ok: true });
      case 'formulario': formLiberado(d.id); return json({ ok: true, formulario: lerFormulario(d.id) });
      case 'estilo': formLiberado(d.id); return json({ ok: true, qml: lerArquivoForm(d.id + '.qml') });
      case 'foto': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, salvarFoto(d.projeto, d.nome, d.mime, d.dados)));
      case 'registro': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, salvarRegistro(d.projeto, d.linha, usr)));
      case 'listar': pode('revisor', 'cliente'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, listarPagina(d.projeto, d.de, d.n, usr)));
      case 'mapa': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, colunas(d.projeto, d.campos || [], usr)));
      case 'painel': pode('revisor', 'cliente'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, painel(d.projeto, usr)));
      case 'foto_ver': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, verFoto(d.projeto, d.id, usr)));
      case 'situacao_meus': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json({ ok: true, itens: situacaoMeus(d.projeto, usr) });
      case 'validar': pode('revisor'); exigeProjeto(d.projeto); if ((d.itens || []).length > 1000) throw new Error('Envie no máximo 1000 registros por vez.'); return json(Object.assign({ ok: true }, validar(d.projeto, d.itens || [], usr)));
      case 'projetos_listar': pode(); return json({ ok: true, projetos: tabela('Projetos').map(comLinks) });
      case 'projeto_salvar': pode(); salvarProjeto(d.projeto_dados); auditar(usr.login, 'projeto_salvar', d.projeto_dados && d.projeto_dados.id, ''); return json({ ok: true });
      case 'usuarios_listar': pode(); return json({ ok: true, usuarios: tabela('Usuarios').map(paraAdmin) });
      case 'usuario_salvar': pode(); salvarUsuario(d.usuario_dados); auditar(usr.login, 'usuario_salvar', d.usuario_dados && d.usuario_dados.login, d.usuario_dados && d.usuario_dados.perfil); return json({ ok: true });
      case 'usuario_remover': pode(); if (String(d.login).toLowerCase() === usr.login.toLowerCase()) throw new Error('Você não pode remover o próprio usuário.'); removerLinha('Usuarios', 'login', d.login); encerrarSessoesDe(d.login); auditar(usr.login, 'usuario_remover', d.login, ''); return json({ ok: true });
      case 'usuario_desbloquear': pode(); atualizarUsuario(d.login, { tentativas: '0', bloqueado_ate: '' }); auditar(usr.login, 'usuario_desbloquear', d.login, ''); return json({ ok: true });
      case 'formularios_listar': pode(); return json({ ok: true, formularios: listarFormularios() });
      case 'formulario_salvar': pode(); salvarFormulario(d.formulario, d.qml); auditar(usr.login, 'formulario_salvar', d.formulario && d.formulario.id, 'versão ' + (d.formulario && d.formulario.versao || '')); return json({ ok: true });
      case 'importar': pode(); exigeProjeto(d.projeto); { const r = importar(d.projeto, d.linhas || [], usr); auditar(usr.login, 'importar', d.projeto, r.inseridos + ' inseridos, ' + r.ignorados + ' já existiam'); return json(Object.assign({ ok: true }, r)); }
      case 'auditar': if (['exportar', 'relatorio'].indexOf(d.tipo) < 0) throw new Error('Evento inválido.'); auditar(usr.login, d.tipo, String(d.alvo || '').slice(0, 100), String(d.detalhe || '').slice(0, 200)); return json({ ok: true });
      case 'auditoria_listar': pode(); return json({ ok: true, itens: auditoriaRecente(+d.n || 300) });
      case 'backup_status': pode(); return json(Object.assign({ ok: true }, backupStatus()));
      case 'backup_config': pode(); backupConfig(d.emails, d.ativo); auditar(usr.login, 'backup_config', '', (d.ativo ? 'ativo' : 'desligado') + ' ' + (d.emails || '')); return json(Object.assign({ ok: true }, backupStatus()));
      case 'backup_agora': pode(); { const r = backupDiario(); auditar(usr.login, 'backup_agora', '', r.resumo); return json(Object.assign({ ok: true }, r)); }
      default: throw new Error('Ação desconhecida: ' + d.acao);
    }
  } catch (err) {
    return json({ ok: false, erro: err.message, sessao: err.sessao || false });
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- Base (usuários e projetos) ----------
function base() {
  const id = PROPS.getProperty('BASE_ID');
  if (!id) throw new Error('Servidor não configurado. Rode a função configurar no Apps Script.');
  return SpreadsheetApp.openById(id);
}
function garantirAba(nome, cols) {
  const b = base(); let sh = b.getSheetByName(nome);
  if (!sh) { sh = b.insertSheet(nome); sh.appendRow(cols); sh.setFrozenRows(1); }
  return sh;
}
function garantirColunas(nome, cols) {
  const sh = base().getSheetByName(nome);
  const cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  const faltam = cols.filter((c) => cab.indexOf(c) < 0);
  if (faltam.length) sh.getRange(1, cab.filter(String).length + 1, 1, faltam.length).setValues([faltam]);
}
function tabela(nome) {
  const sh = base().getSheetByName(nome); if (!sh || sh.getLastRow() < 1) return [];
  const v = sh.getDataRange().getValues();
  const cab = v.shift();
  return v.filter((l) => l[0] !== '').map((l) => { const o = {}; cab.forEach((c, i) => { if (c !== '') o[c] = texto(l[i]); }); return o; });
}
// valor da célula como texto limpo (sem apóstrofo inicial nem espaços)
function texto(v) { return v instanceof Date ? v.toISOString() : String(v).replace(/^'/, '').trim(); }
function salvarLinha(nome, cols, chave, obj) {
  garantirColunas(nome, cols);
  const sh = base().getSheetByName(nome);
  const v = sh.getDataRange().getValues(); const cab = v[0]; const ic = cab.indexOf(chave);
  let r = v.length + 1; let atual = null;
  for (let i = 1; i < v.length; i++) if (texto(v[i][ic]).toLowerCase() === String(obj[chave]).toLowerCase()) { r = i + 1; atual = v[i]; break; }
  // campos não informados mantêm o valor que já estava na planilha
  const linha = cab.map((c, i) => (obj[c] == null ? (atual ? texto(atual[i]) : '') : String(obj[c])));
  const rg = sh.getRange(r, 1, 1, linha.length);
  rg.setNumberFormats([linha.map(() => '@')]); rg.setValues([linha]);
}
function removerLinha(nome, chave, valor) {
  const sh = base().getSheetByName(nome); const v = sh.getDataRange().getValues(); const ic = v[0].indexOf(chave);
  for (let i = v.length - 1; i >= 1; i--) if (texto(v[i][ic]).toLowerCase() === String(valor).toLowerCase()) sh.deleteRow(i + 1);
}

// ---------- Senhas, sessões e perfis ----------
function hashSenha(sal, senha) {
  let h = sal + '|' + senha;
  for (let i = 0; i < ITERACOES; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + sal, Utilities.Charset.UTF_8));
  return h;
}
function novoSal() { return Utilities.getUuid().replace(/-/g, ''); }
function normalizarPerfil(p) { p = String(p || '').toLowerCase().trim(); if (p === 'equipe' || p === '') return 'coletor'; return PERFIS.indexOf(p) >= 0 ? p : 'coletor'; }
function comProjetos(u) {
  u.perfil = normalizarPerfil(u.perfil);
  u.projetos = u.projeto === '*' ? [] : String(u.projeto || '').split(',').map((s) => s.trim()).filter(String);
  return u;
}
function buscarUsuario(login) {
  return tabela('Usuarios').find((x) => x.login.toLowerCase() === String(login || '').trim().toLowerCase());
}
function atualizarUsuario(login, campos) { const u = buscarUsuario(login); if (!u) throw new Error('Usuário não encontrado.'); salvarLinha('Usuarios', COLS_USUARIOS, 'login', Object.assign({ login: u.login }, campos)); }

function autenticarSenha(login, senha, legado) {
  if (!login || senha == null || senha === '') throw new Error('Informe usuário e senha.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    garantirColunas('Usuarios', COLS_USUARIOS);
    const u = buscarUsuario(login);
    const erro = 'Usuário ou senha incorretos.';
    if (!u) throw new Error(erro);
    if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) throw new Error(`Usuário bloqueado por ${MAX_TENTATIVAS} senhas erradas. Tente de novo depois das ${Utilities.formatDate(new Date(u.bloqueado_ate), FUSO, 'HH:mm')} ou peça desbloqueio à coordenação.`);
    const s = String(senha).trim();
    const ok = u.senha_hash ? hashSenha(u.sal, s) === u.senha_hash : (u.senha !== '' && u.senha === s);
    if (!ok) {
      const t = (+u.tentativas || 0) + 1;
      if (t >= MAX_TENTATIVAS) { atualizarUsuario(u.login, { tentativas: '0', bloqueado_ate: new Date(Date.now() + BLOQUEIO_MIN * 60000).toISOString() }); auditar(u.login, 'usuario_bloqueado', '', t + ' tentativas'); }
      else { atualizarUsuario(u.login, { tentativas: String(t) }); auditar(u.login, 'login_falhou', '', 'tentativa ' + t); }
      throw new Error(erro);
    }
    if (String(u.ativo).toLowerCase() === 'nao' || String(u.ativo).toLowerCase() === 'não') throw new Error('Usuário desativado. Fale com a coordenação.');
    const mud = {};
    if (+u.tentativas) mud.tentativas = '0';
    if (u.bloqueado_ate) mud.bloqueado_ate = '';
    // migra senha antiga em texto para a forma criptografada
    if (!u.senha_hash) { const sal = novoSal(); mud.sal = sal; mud.senha_hash = hashSenha(sal, s); mud.senha = ''; }
    if (Object.keys(mud).length) atualizarUsuario(u.login, mud);
    return comProjetos(u);
  } finally { lock.releaseLock(); }
}
function criarSessao(login, aparelho) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const sh = garantirAba('Sessoes', COLS_SESSOES);
  const agora = new Date();
  if (sh.getLastRow() > 300) { const v = sh.getDataRange().getValues(); for (let i = v.length - 1; i >= 1; i--) if (!(new Date(texto(v[i][3])) > agora)) sh.deleteRow(i + 1); }
  sh.appendRow([hashToken(token), login, agora.toISOString(), new Date(agora.getTime() + SESSAO_DIAS * 864e5).toISOString(), seguro(String(aparelho || '').slice(0, 120))]);
  return token;
}
function autenticarSessao(token) {
  const cache = CacheService.getScriptCache();
  let login = cache.get('s:' + token);
  if (login) { const rev = cache.get('revogado:' + login.toLowerCase()); const em = cache.get('s:' + token + ':em'); if (rev && (!em || em < rev)) { cache.remove('s:' + token); login = null; } }
  if (!login) {
    const sh = garantirAba('Sessoes', COLS_SESSOES);
    const v = sh.getDataRange().getValues();
    let achou = -1;
    const ht = hashToken(token);
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === ht) { achou = i; break; }
    const e = new Error('Sua sessão expirou. Entre de novo com usuário e senha. Os registros guardados no aparelho continuam salvos.'); e.sessao = true;
    if (achou < 0) throw e;
    const expira = new Date(texto(v[achou][3]));
    if (!(expira > new Date())) { sh.deleteRow(achou + 1); throw e; }
    // renova quando faltar menos da metade do prazo
    if (expira.getTime() - Date.now() < SESSAO_DIAS * 864e5 / 2) sh.getRange(achou + 1, 4).setValue(new Date(Date.now() + SESSAO_DIAS * 864e5).toISOString());
    login = texto(v[achou][1]);
    cache.put('s:' + token, login, 600); cache.put('s:' + token + ':em', new Date().toISOString(), 600);
  }
  const u = buscarUsuario(login);
  if (!u || String(u.ativo).toLowerCase() === 'nao' || String(u.ativo).toLowerCase() === 'não') { cache.remove('s:' + token); const e = new Error('Usuário desativado ou removido.'); e.sessao = true; throw e; }
  return comProjetos(u);
}
function encerrarSessao(token) {
  if (!token) return; CacheService.getScriptCache().remove('s:' + token);
  const sh = garantirAba('Sessoes', COLS_SESSOES); const v = sh.getDataRange().getValues(); const ht = hashToken(token);
  for (let i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === ht) sh.deleteRow(i + 1);
}
function encerrarSessoesDe(login, exceto) {
  const sh = garantirAba('Sessoes', COLS_SESSOES); const v = sh.getDataRange().getValues(); const ex = exceto ? hashToken(exceto) : null;
  for (let i = v.length - 1; i >= 1; i--) if (texto(v[i][1]).toLowerCase() === String(login).toLowerCase() && String(v[i][0]) !== ex) sh.deleteRow(i + 1);
  const c = CacheService.getScriptCache(); c.put('revogado:' + String(login).toLowerCase(), new Date().toISOString(), 21600);
  if (exceto) c.put('s:' + exceto + ':em', new Date(Date.now() + 1000).toISOString(), 600);
}
function validarSenhaNova(nova) {
  nova = String(nova || '').trim();
  if (nova.length < SENHA_MIN) throw new Error('A senha precisa ter pelo menos ' + SENHA_MIN + ' caracteres.');
  return nova;
}
function trocarSenha(usr, atual, nova, tokenAtual) {
  const u = buscarUsuario(usr.login);
  const ok = u.senha_hash ? hashSenha(u.sal, String(atual || '').trim()) === u.senha_hash : u.senha === String(atual || '').trim();
  if (!ok) throw new Error('Senha atual incorreta.');
  const sal = novoSal(); atualizarUsuario(u.login, { sal: sal, senha_hash: hashSenha(sal, validarSenhaNova(nova)), senha: '' });
  encerrarSessoesDe(u.login, tokenAtual);
  auditar(u.login, 'trocar_senha', '', 'outras sessões encerradas');
}
function salvarUsuario(dados) {
  if (!dados || !dados.login) throw new Error('Informe o usuário.');
  if (!/^[a-z0-9._-]{2,40}$/i.test(dados.login)) throw new Error('Usuário só pode ter letras, números, ponto, hífen e sublinhado.');
  const o = { login: String(dados.login).trim().toLowerCase() };
  ['nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo'].forEach((k) => { if (dados[k] != null) o[k] = String(dados[k]).trim(); });
  if (o.perfil) o.perfil = normalizarPerfil(o.perfil);
  const existe = buscarUsuario(o.login);
  if (dados.senha) { const sal = novoSal(); o.sal = sal; o.senha_hash = hashSenha(sal, validarSenhaNova(dados.senha)); o.senha = ''; o.tentativas = '0'; o.bloqueado_ate = ''; }
  else if (!existe) throw new Error('Defina uma senha para o novo usuário.');
  if (!existe) { o.criado_em = new Date().toISOString(); if (!o.ativo) o.ativo = 'sim'; }
  salvarLinha('Usuarios', COLS_USUARIOS, 'login', o);
  if (dados.senha && existe) encerrarSessoesDe(o.login);
}
function publico(u) { return { login: u.login, nome: u.nome, perfil: normalizarPerfil(u.perfil), equipe: u.equipe, email: u.email || '', termo_aceito_em: u.termo_aceito_em || '' }; }
function paraAdmin(u) {
  const o = {}; ['login', 'nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo', 'termo_aceito_em', 'criado_em'].forEach((k) => (o[k] = u[k] || ''));
  o.perfil = normalizarPerfil(u.perfil);
  o.bloqueado = !!(u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date());
  o.senha_antiga = !u.senha_hash;
  return o;
}
function projetosDoUsuario(u) {
  return tabela('Projetos').filter((p) => u.perfil === 'admin' || u.projetos.indexOf(p.id) >= 0)
    .map((p) => ({ id: p.id, nome: p.nome, formulario: p.formulario, epsg: p.epsg, prefixo: p.prefixo, contratante: p.contratante || '', contrato: p.contrato || '', municipio: p.municipio || '', meta: +p.meta || 0, responsavel: p.responsavel || '', registro_profissional: p.registro_profissional || '', art: p.art || '', equipe: u.equipe, equipeCodigo: u.codigo || '' }));
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
  if (!/^[a-z0-9-]{2,60}$/.test(p.id)) throw new Error('Identificador do projeto: use só letras minúsculas, números e hífen.');
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

// ---------- Auditoria ----------
function auditar(login, acao, alvo, detalhe) {
  try { garantirAba('Auditoria', COLS_AUDITORIA).appendRow([new Date().toISOString(), seguro(String(login || '').slice(0, 60)), seguro(acao), seguro(alvo), seguro(detalhe)]); } catch (e) { /* auditoria nunca derruba a operação */ }
}
function auditoriaRecente(n) {
  const sh = garantirAba('Auditoria', COLS_AUDITORIA); const tot = sh.getLastRow() - 1; if (tot < 1) return [];
  const k = Math.min(n, tot); const v = sh.getRange(sh.getLastRow() - k + 1, 1, k, COLS_AUDITORIA.length).getValues();
  return v.reverse().map((l) => ({ em: texto(l[0]), login: texto(l[1]), acao: texto(l[2]), alvo: texto(l[3]), detalhe: texto(l[4]) }));
}

// ---------- Formulários ----------
function pastaForms() { return DriveApp.getFolderById(PROPS.getProperty('FORMS_ID')); }
function lerArquivoForm(nome) { const it = pastaForms().getFilesByName(nome); return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null; }
function gravarArquivoForm(nome, txt, mime) {
  const it = pastaForms().getFilesByName(nome);
  if (it.hasNext()) it.next().setContent(txt); else pastaForms().createFile(nome, txt, mime);
}
function lerFormulario(id) { const t = lerArquivoForm(id + '.json'); if (!t) throw new Error('Formulário não encontrado: ' + id); return JSON.parse(t); }
function salvarFormulario(f, qml) {
  if (!f || !f.id || !Array.isArray(f.campos)) throw new Error('Formulário inválido.');
  gravarArquivoForm(f.id + '.json', JSON.stringify(f), 'application/json');
  if (qml) gravarArquivoForm(f.id + '.qml', qml, 'text/xml');
}
function listarFormularios() {
  const out = []; const it = pastaForms().getFiles();
  while (it.hasNext()) {
    const a = it.next(); if (!/\.json$/.test(a.getName())) continue;
    try { const f = JSON.parse(a.getBlob().getDataAsString('UTF-8')); out.push({ id: f.id, nome: f.nome, campos: f.campos.length, versao: f.versao || '' }); } catch (e) { /* ignora */ }
  }
  return out;
}

// ---------- Fotos ----------
function salvarFoto(projetoId, nome, mime, dados) {
  if (!/^[\w .-]{1,120}$/.test(String(nome))) throw new Error('Nome de foto inválido.');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(String(mime || 'image/jpeg')) < 0) throw new Error('Tipo de foto não aceito.');
  if (String(dados || '').length > 11e6) throw new Error('Foto grande demais (máximo 8 MB).');
  const p = projeto(projetoId);
  const pasta = DriveApp.getFolderById(p.pasta_id);
  const it = pasta.getFoldersByName('DCIM'); const dcim = it.hasNext() ? it.next() : pasta.createFolder('DCIM');
  const lock = LockService.getScriptLock(); lock.waitLock(30000); // evita duas cópias da mesma foto
  try {
    const ex = dcim.getFilesByName(nome);
    const arq = ex.hasNext() ? ex.next() : dcim.createFile(Utilities.newBlob(Utilities.base64Decode(dados), mime || 'image/jpeg', nome));
    return { id: arq.getId(), url: 'https://drive.google.com/file/d/' + arq.getId() + '/view' };
  } finally { lock.releaseLock(); }
}

// Devolve a foto (reduzida) se ela for da pasta DCIM do projeto; o cliente só vê fotos de registros validados
function verFoto(projetoId, id, usr) {
  if (!/^[\w-]{20,80}$/.test(String(id || ''))) throw new Error('Foto inválida.');
  const p = projeto(projetoId); const arq = DriveApp.getFileById(id);
  const pais = arq.getParents(); let ok = false;
  while (pais.hasNext()) { const f = pais.next(); const avo = f.getParents(); while (avo.hasNext()) if (avo.next().getId() === p.pasta_id) ok = true; }
  if (!ok) throw new Error('Foto não pertence a este projeto.');
  if (usr.perfil === 'cliente') {
    const cache = CacheService.getScriptCache(); let lib = cache.get('fotos_val:' + projetoId);
    if (!lib) {
      const sh = planilha(projetoId); const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); const tot = sh.getLastRow() - 1;
      const iv = cab.indexOf('validacao'); const links = cab.map((c, i) => (/ link$/.test(c) ? i : -1)).filter((i) => i >= 0);
      const ids = []; if (tot > 0 && iv >= 0) { const v = sh.getRange(2, 1, tot, cab.length).getValues(); v.forEach((l) => { if (l[iv] === 'Validado') links.forEach((i) => { const m = String(l[i]).match(/\/d\/([\w-]+)/); if (m) ids.push(m[1]); }); }); }
      lib = ids.join(','); try { cache.put('fotos_val:' + projetoId, lib, 600); } catch (e) { /* grande demais */ }
    }
    if ((',' + lib + ',').indexOf(',' + id + ',') < 0) throw new Error('Foto de registro ainda não validado.');
  }
  const b = arq.getBlob();
  return { mime: b.getContentType() || 'image/jpeg', dados: Utilities.base64Encode(b.getBytes()) };
}

// ---------- Registros ----------
function planilha(projetoId) { return SpreadsheetApp.openById(projeto(projetoId).planilha_id).getSheetByName('Registros'); }

function celula(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
// textos ficam como texto puro (assim 156/2 não vira data nem 52,6 vira número); números ficam como número
function gravarLinha(sh, r, valores) {
  const rg = sh.getRange(r, 1, 1, valores.length);
  rg.setNumberFormats([valores.map((v) => (typeof v === 'number' ? '0.##########' : '@'))]);
  rg.setValues([valores]);
}
function cabecalho(sh, garantir) {
  let cab = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  if (!cab.length || cab[0] === '') cab = [];
  const novas = (garantir || []).filter((k, i, a) => cab.indexOf(k) < 0 && a.indexOf(k) === i);
  for (const k of novas) if (!/^[^=+\-@\t\r][^\t\r\n]{0,79}$/.test(k)) throw new Error('Nome de coluna inválido: ' + String(k).slice(0, 40));
  if (cab.length + novas.length > 300) throw new Error('Limite de colunas da planilha atingido.');
  if (novas.length) {
    sh.getRange(1, cab.length + 1, 1, novas.length).setNumberFormat('@').setValues([novas]).setFontWeight('bold');
    cab = cab.concat(novas); sh.setFrozenRows(1);
  }
  return cab;
}
const dia = (iso) => (iso ? Utilities.formatDate(new Date(iso), FUSO, 'yyyy-MM-dd') : '');

function salvarRegistro(projetoId, linha, usr) {
  if (!linha || !linha.uuid) throw new Error('Registro sem identificador.');
  COLS_SISTEMA.forEach((c) => delete linha[c]); // o aparelho não escreve a validação
  Object.keys(linha).forEach((k) => { if (/ link$/.test(k) && linha[k] && !/^https:\/\/drive\.google\.com\//.test(String(linha[k]))) linha[k] = ''; });
  if (linha.atualizado_em && new Date(linha.atualizado_em) > new Date(Date.now() + 10 * 60000)) throw new Error('Data do aparelho adiantada. Acerte a data e a hora do celular e envie de novo.');
  if (usr.perfil === 'coletor') linha.usuario = usr.login;
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = planilha(projetoId);
    const cab = cabecalho(sh, Object.keys(linha).concat(COLS_SISTEMA));
    linha.usuario = linha.usuario || usr.login;
    const iu = cab.indexOf('uuid') + 1;
    const achado = sh.getLastRow() > 1 ? sh.getRange(2, iu, sh.getLastRow() - 1, 1).createTextFinder(linha.uuid).matchEntireCell(true).findNext() : null;
    linha.servidor_em = new Date().toISOString();
    if (achado) {
      const r = achado.getRow();
      const atual = linhaObj(cab, sh.getRange(r, 1, 1, cab.length).getValues()[0]);
      if (usr.perfil === 'coletor' && atual.atualizado_em && linha.atualizado_em && String(atual.atualizado_em) > String(linha.atualizado_em)) return { ignorado: 'versao_antiga' };
      if (usr.perfil === 'coletor') {
        linha.concluido_em = atual.concluido_em || linha.concluido_em; linha.criado_em = atual.criado_em || linha.criado_em; linha.usuario = atual.usuario || usr.login;
        if (atual.usuario && String(atual.usuario).toLowerCase() !== usr.login.toLowerCase()) throw new Error('Este registro é de outra equipe. Só a coordenação pode alterá-lo.');
        const v = String(atual.validacao || '');
        if (v === 'Validado') throw new Error('Registro já validado pela coordenação. Para alterar, peça à coordenação.');
        const conc = atual.concluido_em || atual.criado_em;
        const mesmoDia = dia(conc) === dia(linha.atualizado_em) && (Date.now() - new Date(conc).getTime()) < 4 * 864e5;
        if (v !== 'Devolvido' && !mesmoDia) throw new Error('Registro travado: a equipe só altera no mesmo dia em que concluiu. Peça à coordenação.');
        if (v === 'Devolvido') linha.validacao = 'Corrigido';
      }
      const valores = cab.map((c) => (c in linha ? celula(linha[c]) : celula(atual[c])));
      gravarLinha(sh, r, valores);
      return { atualizado: true, validacao: linha.validacao || atual.validacao || '' };
    }
    linha.validacao = 'Pendente'; linha.numero_unico = proximoNumero(projetoId, sh, cab);
    gravarLinha(sh, sh.getLastRow() + 1, cab.map((c) => celula(linha[c])));
    return { novo: true };
  } finally { lock.releaseLock(); }
}

// Número único do projeto (sem distinção de equipe), dado uma vez pelo servidor e nunca recalculado
function proximoNumero(projetoId, sh, cab) {
  const k = 'NUM_' + projetoId; let n = +PROPS.getProperty(k) || 0;
  if (!n && sh.getLastRow() > 1) { const i = cab.indexOf('numero_unico'); if (i >= 0) n = Math.max(0, ...sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getValues().map((x) => +x[0] || 0)); }
  n++; PROPS.setProperty(k, String(n)); return n;
}
// Numera os registros antigos que ainda não têm número (pela ordem de coleta). Roda no configurar.
function numerarExistentes() {
  tabela('Projetos').forEach((p) => {
    if (!p.planilha_id) return; const sh = planilha(p.id); const tot = sh.getLastRow() - 1; if (tot < 1) return;
    const cab = cabecalho(sh, ['numero_unico']); const iN = cab.indexOf('numero_unico'), iC = cab.indexOf('criado_em');
    const nums = sh.getRange(2, iN + 1, tot, 1).getValues(); const cri = iC >= 0 ? sh.getRange(2, iC + 1, tot, 1).getValues() : nums.map(() => ['']);
    let max = Math.max(0, ...nums.map((x) => +x[0] || 0));
    const faltam = nums.map((x, i) => i).filter((i) => !(+nums[i][0])).sort((a, b) => String(texto(cri[a][0])).localeCompare(String(texto(cri[b][0]))));
    if (!faltam.length) return;
    faltam.forEach((i) => (nums[i] = [++max])); sh.getRange(2, iN + 1, tot, 1).setValues(nums); PROPS.setProperty('NUM_' + p.id, String(max));
  });
}
// Validação pela coordenação ou revisor: Validado, Devolvido (com motivo), Descartado ou Pendente
function validar(projetoId, itens, usr) {
  const estados = ['Validado', 'Devolvido', 'Descartado', 'Pendente'];
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = planilha(projetoId); const cab = cabecalho(sh, COLS_SISTEMA);
    const n = sh.getLastRow() - 1; if (n < 1) return { alterados: 0 };
    const uu = sh.getRange(2, cab.indexOf('uuid') + 1, n, 1).getValues().map((x) => String(x[0]));
    const pos = {}; uu.forEach((u, i) => (pos[u] = i));
    const agora = new Date().toISOString(); let alterados = 0;
    // cada coluna é lida e gravada de uma vez, pelo nome (rápido mesmo com milhares de registros)
    const nomes = ['validacao', 'validacao_obs', 'validado_por', 'validado_em', 'validacao_hist'];
    const col = {}; nomes.forEach((c) => (col[c] = sh.getRange(2, cab.indexOf(c) + 1, n, 1).getValues()));
    const quando = Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy HH:mm');
    for (const it of itens) {
      if (estados.indexOf(it.estado) < 0) throw new Error('Situação inválida: ' + it.estado);
      if (it.estado === 'Devolvido' && !String(it.obs || '').trim()) throw new Error('Informe o motivo da devolução.');
      const k = pos[String(it.uuid)]; if (k == null) continue;
      const obs = seguro(String(it.obs || '').slice(0, 500));
      col.validacao[k] = [it.estado]; col.validacao_obs[k] = [obs]; col.validado_por[k] = [usr.nome || usr.login]; col.validado_em[k] = [agora];
      const ant = texto(col.validacao_hist[k][0]);
      col.validacao_hist[k] = [seguro((ant ? ant + ' | ' : '') + quando + ' ' + (usr.nome || usr.login) + ': ' + it.estado + (obs ? ' (' + obs + ')' : '') + (it.amostra ? ' [lote com amostra conferida]' : '')).slice(-2000)];
      alterados++;
    }
    if (alterados) nomes.forEach((c) => sh.getRange(2, cab.indexOf(c) + 1, n, 1).setNumberFormat('@').setValues(col[c]));
    if (alterados) auditar(usr.login, 'validar', projetoId, alterados + ' registro(s): ' + itens.map((i) => i.estado).filter((x, i, a) => a.indexOf(x) === i).join(', '));
    CacheService.getScriptCache().remove('painel:' + projetoId + ':cliente'); CacheService.getScriptCache().remove('painel:' + projetoId + ':todos');
    return { alterados: alterados };
  } finally { lock.releaseLock(); }
}
// O aparelho do coletor pergunta como estão os registros dele (validado, devolvido e motivo)
function situacaoMeus(projetoId, usr) {
  const c = colunas(projetoId, ['uuid', 'usuario', 'validacao', 'validacao_obs', 'validado_em'], { perfil: 'admin' });
  return c.linhas.filter((l) => String(l[1]).toLowerCase() === usr.login.toLowerCase() && l[2] && l[2] !== 'Pendente')
    .map((l) => ({ uuid: l[0], validacao: l[2], obs: l[3], em: l[4] }));
}

// Página de registros (de = posição inicial, n = quantidade). Sem n devolve tudo.
function listarPagina(projetoId, de, n, usr) {
  const sh = planilha(projetoId); const total = Math.max(0, sh.getLastRow() - 1);
  if (total < 1) return { linhas: [], total: 0, proximo: null };
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  de = Math.max(0, +de || 0); n = n ? Math.min(+n, 5000, total - de) : total - de;
  if (n <= 0) return { linhas: [], total: total, proximo: null };
  const linhas = sh.getRange(2 + de, 1, n, cab.length).getValues().map((l) => linhaObj(cab, l));
  const proximo = de + n < total ? de + n : null;
  if (usr && usr.perfil === 'cliente') return { linhas: paraCliente(projetoId, linhas), total: null, proximo: proximo };
  return { linhas: linhas, total: total, proximo: proximo };
}
function clienteVeTodos(projetoId) { return String(projeto(projetoId).cliente_ve || '').toLowerCase() === 'todos'; }
function paraCliente(projetoId, linhas) {
  const todos = clienteVeTodos(projetoId);
  return linhas.filter((l) => l.validacao !== 'Descartado' && (todos || l.validacao === 'Validado')).map((l) => { COLS_INTERNAS.forEach((c) => delete l[c]); return l; });
}
// Só algumas colunas de todas as linhas, em lista compacta (mapa e sequência do código)
function colunas(projetoId, campos, usr) {
  const sh = planilha(projetoId); const total = sh.getLastRow() - 1;
  if (total < 1) return { cab: campos, linhas: [] };
  const cliente = usr && usr.perfil === 'cliente'; const coletor = usr && usr.perfil === 'coletor';
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const pedir = (cliente ? campos.slice(0, 30).concat(['validacao']) : campos.slice(0, 30));
  const proibida = (c) => (cliente && COLS_INTERNAS.indexOf(c) >= 0) || (coletor && (COLS_INTERNAS.indexOf(c) >= 0 || COLS_SISTEMA.indexOf(c) >= 0));
  const cols = pedir.map((c, k) => { const i = cab.indexOf(c); return i < 0 || (proibida(c) && !(cliente && k === pedir.length - 1)) ? null : sh.getRange(2, i + 1, total, 1).getValues(); });
  const todos = cliente && clienteVeTodos(projetoId);
  const linhas = [];
  for (let r = 0; r < total; r++) {
    const l = cols.map((c) => { if (!c) return ''; const x = c[r][0]; return x instanceof Date ? x.toISOString() : typeof x === 'string' ? x.replace(/^'/, '') : x; });
    if (cliente) { const v = l.pop(); if (v === 'Descartado' || (!todos && v !== 'Validado')) continue; }
    linhas.push(l);
  }
  return { cab: campos, linhas: linhas };
}
function linhaObj(cab, l) { const o = {}; cab.forEach((c, i) => { if (c !== '') o[c] = l[i] instanceof Date ? l[i].toISOString() : typeof l[i] === 'string' ? l[i].replace(/^'/, '') : l[i]; }); return o; }

// ---------- Painel (indicadores calculados no servidor) ----------
function painel(projetoId, usr) {
  const chave = 'painel:' + projetoId + ':' + (usr.perfil === 'cliente' ? 'cliente' : 'todos');
  const cache = CacheService.getScriptCache(); const em = cache.get(chave);
  if (em) return JSON.parse(em);
  const p = projeto(projetoId); const form = lerFormulario(p.formulario);
  let linhas = listarPagina(projetoId, 0, 0, usr).linhas;
  const out = indicadores(form, linhas, p);
  try { cache.put(chave, JSON.stringify(out), 300); } catch (e) { /* grande demais para o cache */ }
  return out;
}
// Mesma conta usada no app (painel offline) e no servidor
function indicadores(form, linhas, p) {
  const ativos = linhas.filter((l) => l.validacao !== 'Descartado');
  const conta = (arr, f) => { const m = {}; arr.forEach((l) => { const k = f(l); if (k === '' || k == null) return; m[k] = (m[k] || 0) + 1; }); return m; };
  const esp = form.campos.find((c) => c.tipo === 'species');
  const escolhas = {}; form.campos.filter((c) => c.tipo === 'choice').forEach((c) => (escolhas[c.nome] = conta(ativos, (l) => l[c.nome])));
  const marcados = {}; form.campos.filter((c) => c.tipo === 'bool').forEach((c) => (marcados[c.nome] = ativos.filter((l) => l[c.nome] === 1 || l[c.nome] === true || l[c.nome] === '1').length));
  const numeros = {}; form.campos.filter((c) => c.tipo === 'number' || c.tipo === 'multinumber' || c.armazenar === 'real').forEach((c) => {
    const vs = ativos.map((l) => valorNum(l[c.nome], c.tipo === 'multinumber')).filter((x) => x != null && isFinite(x));
    if (vs.length) { vs.sort((a, b) => a - b); numeros[c.nome] = { n: vs.length, min: vs[0], max: vs[vs.length - 1], media: vs.reduce((a, b) => a + b, 0) / vs.length, mediana: vs[Math.floor(vs.length / 2)] }; }
  });
  const dap = form.campos.find((c) => c.tipo === 'multinumber' && /dap/i.test(c.nome));
  const classesDap = dap ? (() => { const cl = [[0, 10], [10, 20], [20, 30], [30, 50], [50, 80], [80, 1e9]]; const vs = ativos.map((l) => valorNum(l[dap.nome], true)).filter((x) => x != null); return cl.map(([a, b]) => ({ de: a, ate: b === 1e9 ? null : b, n: vs.filter((v) => v >= a && v < b).length })); })() : [];
  const especies = esp ? Object.entries(conta(ativos, (l) => String(l[esp.nome] || '').trim())).sort((a, b) => b[1] - a[1]) : [];
  const porDia = {}; ativos.forEach((l) => { const d = l.criado_em ? dia(l.criado_em) : ''; if (!d) return; const e = l.equipe || '-'; porDia[d] = porDia[d] || {}; porDia[d][e] = (porDia[d][e] || 0) + 1; });
  const gps = ativos.map((l) => +l.precisao_gps_m).filter((x) => x > 0).sort((a, b) => a - b);
  return {
    gerado_em: new Date().toISOString(), projeto: p ? { id: p.id, nome: p.nome, contratante: p.contratante || '', contrato: p.contrato || '', municipio: p.municipio || '', meta: +p.meta || 0, responsavel: p.responsavel || '', registro_profissional: p.registro_profissional || '', art: p.art || '' } : null,
    total: ativos.length, descartados: linhas.length - ativos.length,
    validacao: conta(ativos, (l) => l.validacao || 'Pendente'), equipes: conta(ativos, (l) => l.equipe || '-'),
    escolhas: escolhas, marcados: marcados, numeros: numeros, classesDap: classesDap,
    especies: especies.slice(0, 40), nEspecies: especies.length, porDia: porDia,
    gps: gps.length ? { mediana: gps[Math.floor(gps.length / 2)], ate5m: gps.filter((x) => x <= 5).length / gps.length } : null,
    semCoordenada: ativos.filter((l) => l.latitude === '' || l.latitude == null).length,
  };
}
// DAP com vários fustes ("32,5;20") vira DAP equivalente: raiz da soma dos quadrados
function valorNum(v, multi) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const ps = String(v).split(';').map((x) => parseFloat(String(x).replace(',', '.'))).filter((x) => isFinite(x));
  if (!ps.length) return null;
  return multi ? Math.sqrt(ps.reduce((a, b) => a + b * b, 0)) : ps[0];
}

// ---------- Importação de inventário existente ----------
function importar(projetoId, linhas, usr) {
  if (!linhas.length) return { inseridos: 0, ignorados: 0 };
  if (linhas.length > 3000) throw new Error('Envie no máximo 3000 linhas por vez.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = planilha(projetoId);
    const chaves = {}; linhas.forEach((l) => Object.keys(l).forEach((k) => (chaves[k] = 1)));
    const cab = cabecalho(sh, ['uuid', 'projeto', 'equipe', 'usuario', 'criado_em', 'atualizado_em', 'latitude', 'longitude'].concat(Object.keys(chaves), COLS_SISTEMA, ['origem']));
    const n = sh.getLastRow() - 1;
    const existentes = n > 0 ? sh.getRange(2, cab.indexOf('uuid') + 1, n, 1).getValues().map((x) => String(x[0])) : [];
    const set = {}; existentes.forEach((u) => (set[u] = 1));
    const agora = new Date().toISOString(); const novos = []; let num = null;
    for (const l of linhas) {
      const o = Object.assign({}, l);
      o.uuid = String(o.uuid || Utilities.getUuid());
      if (set[o.uuid]) continue; set[o.uuid] = 1;
      o.projeto = projetoId; o.usuario = o.usuario || usr.login; o.criado_em = o.criado_em || agora; o.atualizado_em = o.atualizado_em || agora;
      o.validacao = 'Pendente'; o.servidor_em = agora; o.origem = o.origem || 'importado'; if (num == null) num = proximoNumero(projetoId, sh, cab) - 1; o.numero_unico = ++num;
      novos.push(cab.map((c) => celula(o[c])));
    }
    if (num != null) PROPS.setProperty('NUM_' + projetoId, String(num));
    if (novos.length) {
      const rg = sh.getRange(sh.getLastRow() + 1, 1, novos.length, cab.length);
      rg.setNumberFormats(novos.map((l) => l.map((v) => (typeof v === 'number' ? '0.##########' : '@'))));
      rg.setValues(novos);
    }
    return { inseridos: novos.length, ignorados: linhas.length - novos.length };
  } finally { lock.releaseLock(); }
}

// ---------- Cópia de segurança ----------
function pastaBackup() {
  const raiz = DriveApp.getFolderById(PROPS.getProperty('RAIZ_ID'));
  const it = raiz.getFoldersByName('Backup'); return it.hasNext() ? it.next() : raiz.createFolder('Backup');
}
// Roda todo dia (gatilho) ou pelo botão "Fazer cópia agora": copia a base e cada projeto, guarda 30 dias e manda email
function backupDiario() {
  const pasta = pastaBackup(); const hoje = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  const sub = (() => { const it = pasta.getFoldersByName(hoje); return it.hasNext() ? it.next() : pasta.createFolder(hoje); })();
  const feitos = []; const anexos = []; const erros = [];
  const copiar = (id, nome) => {
    try {
      const c = DriveApp.getFileById(id).makeCopy(nome + ' - ' + hoje, sub); feitos.push(nome);
      if (id === PROPS.getProperty('BASE_ID')) return c; // a base de usuários fica só no Drive, sem anexo no email
      try {
        const r = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
        if (r.getResponseCode() === 200) { const b = r.getBlob().setName(nome + ' - ' + hoje + '.xlsx'); if (b.getBytes().length < 15e6) anexos.push(b); }
      } catch (e) { /* sem anexo: o email leva o link */ }
      return c;
    } catch (e) { erros.push(nome + ': ' + e.message); }
  };
  copiar(PROPS.getProperty('BASE_ID'), 'Usuários e Projetos');
  tabela('Projetos').forEach((p) => { if (p.planilha_id) copiar(p.planilha_id, p.nome); });
  // mantém só as últimas 30 cópias
  const pastas = []; const it = pasta.getFolders(); while (it.hasNext()) pastas.push(it.next());
  pastas.sort((a, b) => (a.getName() < b.getName() ? 1 : -1)).slice(30).forEach((f) => f.setTrashed(true));
  const resumo = feitos.length + ' planilha(s) copiada(s)' + (erros.length ? ', ' + erros.length + ' erro(s)' : '');
  PROPS.setProperty('BACKUP_ULTIMO', JSON.stringify({ em: new Date().toISOString(), resumo: resumo, erros: erros, pasta: sub.getUrl() }));
  const emails = PROPS.getProperty('BACKUP_EMAILS');
  if (emails) {
    try {
      MailApp.sendEmail({ to: emails, subject: 'Neofloresta Inventário: cópia de segurança de ' + Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy'),
        body: 'Cópia de segurança concluída: ' + resumo + '.\n\nPasta no Drive: ' + sub.getUrl() + (erros.length ? '\n\nErros:\n' + erros.join('\n') : '') + '\n\nAs planilhas seguem em anexo no formato Excel (quando o tamanho permite).\n\nNeofloresta Inventário',
        attachments: anexos.slice(0, 10) });
    } catch (e) { erros.push('email: ' + e.message); }
  }
  return { resumo: resumo, erros: erros, pasta: sub.getUrl() };
}
function backupStatus() {
  const gat = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'backupDiario');
  return { ativo: gat.length > 0, emails: PROPS.getProperty('BACKUP_EMAILS') || '', ultimo: JSON.parse(PROPS.getProperty('BACKUP_ULTIMO') || 'null'), pasta: pastaBackup().getUrl() };
}
function backupConfig(emails, ativo) {
  emails = String(emails || '').split(/[,;\s]+/).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)).join(',');
  PROPS.setProperty('BACKUP_EMAILS', emails);
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'backupDiario').forEach((t) => ScriptApp.deleteTrigger(t));
  if (ativo) ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(2).inTimezone(FUSO).create();
}
