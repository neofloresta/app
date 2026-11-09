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
const VERSAO_SCRIPT = '2.5';
const COLS_USUARIOS = ['login', 'senha', 'nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo', 'senha_hash', 'sal', 'tentativas', 'bloqueado_ate', 'termo_aceito_em', 'criado_em', 'modo_copa'];
const COLS_PROJETOS = ['id', 'nome', 'formulario', 'epsg', 'prefixo', 'pasta_id', 'planilha_id', 'contratante', 'contrato', 'municipio', 'meta', 'cliente_ve', 'responsavel', 'registro_profissional', 'art', 'tipos_os', 'face_gps', 'face_dist', 'face_folga'];
const COLS_SESSOES = ['token', 'login', 'criada_em', 'expira_em', 'aparelho'];
const COLS_AUDITORIA = ['em', 'login', 'acao', 'alvo', 'detalhe'];
const COLS_CHAVES = ['id', 'nome', 'projeto', 'hash', 'criada_por', 'criada_em', 'ativa'];
const ACOES_INTEGRACAO = ['listar', 'mapa', 'painel', 'os_listar', 'formulario', 'sessao', 'quadras_camada', 'quadras_situacao'];
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
const ACOES_ESCRITA = ['registro', 'foto', 'validar', 'importar', 'os_salvar', 'os_andamento', 'quadras_importar', 'quadras_marcar'];
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
    PROPS.setProperty('BASE_ID', base.getId()); invalidarTabela('Usuarios'); invalidarTabela('Projetos');
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
function doGet() { BASE_ABERTA = null; TABS = {}; return json({ ok: true, app: 'Neofloresta Inventário', versao: VERSAO_SCRIPT, configurado: !!PROPS.getProperty('BASE_ID') }); }

function doPost(e) {
  BASE_ABERTA = null; TABS = {};
  let d = {};
  try {
    d = JSON.parse(e.postData.contents);
    // entrar com usuário e senha devolve uma sessão; as demais ações usam a sessão (ou usuário e senha, nas versões antigas do app)
    if (d.acao === 'login') {
      const usr = autenticarSenha(d.u, d.s);
      const token = d.semSessao ? '' : criarSessao(usr.login, d.aparelho);
      auditar(usr.login, 'login', '', d.aparelho || '');
      const prjs = projetosDoUsuario(usr); const forms = {};
      // os formulários vão junto no login: o app abre sem esperar outra consulta
      prjs.slice(0, 5).forEach((p) => { if (p.formulario && !forms[p.formulario]) try { forms[p.formulario] = lerFormulario(p.formulario); } catch (er) { /* app busca depois */ } });
      return json({ ok: true, versaoScript: VERSAO_SCRIPT, token: token, expira_em: token ? new Date(Date.now() + SESSAO_DIAS * 864e5).toISOString() : '', usuario: publico(usr), projetos: prjs, formularios: forms });
    }
    const usr = d.chave_api ? autenticarChave(d.chave_api, d.acao) : d.t ? autenticarSessao(d.t) : autenticarSenha(d.u, d.s, true);
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
      case 'listar': pode('revisor', 'cliente'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, listarPagina(d.projeto, d.de, usr.integracao ? Math.min(+d.n || 5000, 5000) : d.n, usr)));
      case 'reservar': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, reservar(d.projeto, d.prefixo, d.campo, d.qtd, d.minimo)));
      case 'mapa': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, colunas(d.projeto, d.campos || [], usr)));
      case 'painel': pode('revisor', 'cliente'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, painel(d.projeto, usr)));
      case 'foto_ver': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, verFoto(d.projeto, d.id, usr)));
      case 'situacao_meus': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json({ ok: true, itens: situacaoMeus(d.projeto, usr) });
      case 'validar': pode('revisor'); exigeProjeto(d.projeto); if ((d.itens || []).length > 1000) throw new Error('Envie no máximo 1000 registros por vez.'); return json(Object.assign({ ok: true }, validar(d.projeto, d.itens || [], usr)));
      case 'quadras_importar': pode(); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, importarQuadras(d.projeto, d.camada, usr)));
      case 'quadras_camada': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, camadaQuadras(d.projeto, d.versao)));
      case 'quadras_situacao': exigeProjeto(d.projeto); return json({ ok: true, quadras: lerSitQuadras(d.projeto).map(publicoOS), faces: d.faces ? lerSitFaces(d.projeto).map(publicoOS) : undefined });
      case 'quadras_marcar': pode('coletor', 'revisor'); exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, marcarQuadras(d.projeto, d.itens, usr)));
      case 'os_listar': exigeProjeto(d.projeto); return json({ ok: true, ordens: listarOS(d.projeto, usr), tipos: tiposOS(d.projeto) });
      case 'os_salvar': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, salvarOS(d.projeto, d.os || {}, usr)));
      case 'os_andamento': exigeProjeto(d.projeto); return json(Object.assign({ ok: true }, andamentoOS(d.projeto, d.id, d.etapa, d.dados || {}, usr)));
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
      case 'chaves_listar': pode(); return json({ ok: true, chaves: tabela('Chaves').map((c) => ({ id: c.id, nome: c.nome, projeto: c.projeto, criada_por: c.criada_por, criada_em: c.criada_em, ativa: c.ativa === 'sim' })) });
      case 'chave_criar': pode(); return json(Object.assign({ ok: true }, criarChave(d.nome, d.projeto, usr)));
      case 'chave_revogar': pode(); if (!tabela('Chaves').some((c) => c.id === String(d.id))) throw new Error('Chave não encontrada.'); salvarLinha('Chaves', COLS_CHAVES, 'id', { id: String(d.id), ativa: 'não' }); auditar(usr.login, 'chave_revogar', d.id, ''); return json({ ok: true });
      case 'backup_listar': pode(); return json({ ok: true, copias: listarCopias(d.projeto) });
      case 'backup_restaurar': pode(); exigeProjeto(d.projeto); { const r = restaurarCopia(d.projeto, d.arquivo, usr); return json(Object.assign({ ok: true }, r)); }
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
// Velocidade: a planilha base abre uma vez por chamada, e as tabelas de usuários e projetos ficam
// 1 minuto no cache do servidor (qualquer gravação pelo app limpa na hora; edição direto na planilha vale em até 1 minuto).
let BASE_ABERTA = null, TABS = {};
const TABS_CACHE = ['Usuarios', 'Projetos'];
function base() {
  if (BASE_ABERTA) return BASE_ABERTA;
  const id = PROPS.getProperty('BASE_ID');
  if (!id) throw new Error('Servidor não configurado. Rode a função configurar no Apps Script.');
  BASE_ABERTA = SpreadsheetApp.openById(id); return BASE_ABERTA;
}
function invalidarTabela(nome) { delete TABS[nome]; if (TABS_CACHE.indexOf(nome) >= 0) try { CacheService.getScriptCache().remove('tab:' + nome); } catch (e) { /* segue */ } }
function garantirAba(nome, cols) {
  const b = base(); let sh = b.getSheetByName(nome);
  if (!sh) { sh = b.insertSheet(nome); sh.appendRow(cols); sh.setFrozenRows(1); }
  return sh;
}
function garantirColunas(nome, cols) {
  const sh = base().getSheetByName(nome);
  const cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  const faltam = cols.filter((c) => cab.indexOf(c) < 0);
  if (faltam.length) { sh.getRange(1, cab.filter(String).length + 1, 1, faltam.length).setValues([faltam]); invalidarTabela(nome); }
}
function tabela(nome, fresco) {
  const copia = (t) => t.map((o) => Object.assign({}, o));
  if (!fresco && TABS[nome]) return copia(TABS[nome]);
  const emCache = TABS_CACHE.indexOf(nome) >= 0;
  if (!fresco && emCache) { try { const c = CacheService.getScriptCache().get('tab:' + nome); if (c) { TABS[nome] = JSON.parse(c); return copia(TABS[nome]); } } catch (e) { /* lê da planilha */ } }
  const sh = base().getSheetByName(nome); if (!sh || sh.getLastRow() < 1) return [];
  const v = sh.getDataRange().getValues();
  const cab = v.shift();
  const t = v.filter((l) => l[0] !== '').map((l) => { const o = {}; cab.forEach((c, i) => { if (c !== '') o[c] = texto(l[i]); }); return o; });
  TABS[nome] = t;
  if (emCache) try { CacheService.getScriptCache().put('tab:' + nome, JSON.stringify(t), 60); } catch (e) { /* grande demais: sem cache */ }
  return copia(t);
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
  invalidarTabela(nome);
}
function removerLinha(nome, chave, valor) {
  const sh = base().getSheetByName(nome); const v = sh.getDataRange().getValues(); const ic = v[0].indexOf(chave);
  for (let i = v.length - 1; i >= 1; i--) if (texto(v[i][ic]).toLowerCase() === String(valor).toLowerCase()) sh.deleteRow(i + 1);
  invalidarTabela(nome);
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
function buscarUsuario(login, fresco) {
  return tabela('Usuarios', fresco).find((x) => x.login.toLowerCase() === String(login || '').trim().toLowerCase());
}
function atualizarUsuario(login, campos) { const u = buscarUsuario(login); if (!u) throw new Error('Usuário não encontrado.'); salvarLinha('Usuarios', COLS_USUARIOS, 'login', Object.assign({ login: u.login }, campos)); }

function autenticarSenha(login, senha, legado) {
  if (!login || senha == null || senha === '') throw new Error('Informe usuário e senha.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    garantirColunas('Usuarios', COLS_USUARIOS);
    const u = buscarUsuario(login, true); // senha e bloqueio sempre conferidos na planilha (vale a troca de senha feita direto nela)
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
  ['nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo', 'modo_copa'].forEach((k) => { if (dados[k] != null) o[k] = String(dados[k]).trim(); });
  if (o.modo_copa && ['raios', 'area'].indexOf(o.modo_copa) < 0) o.modo_copa = 'raios';
  if (o.perfil) o.perfil = normalizarPerfil(o.perfil);
  const existe = buscarUsuario(o.login);
  if (dados.senha) { const sal = novoSal(); o.sal = sal; o.senha_hash = hashSenha(sal, validarSenhaNova(dados.senha)); o.senha = ''; o.tentativas = '0'; o.bloqueado_ate = ''; }
  else if (!existe) throw new Error('Defina uma senha para o novo usuário.');
  if (!existe) { o.criado_em = new Date().toISOString(); if (!o.ativo) o.ativo = 'sim'; }
  salvarLinha('Usuarios', COLS_USUARIOS, 'login', o);
  if (dados.senha && existe) encerrarSessoesDe(o.login);
}
function publico(u) { return { login: u.login, nome: u.nome, perfil: normalizarPerfil(u.perfil), equipe: u.equipe, email: u.email || '', termo_aceito_em: u.termo_aceito_em || '', modo_copa: u.modo_copa || 'raios' }; }
function paraAdmin(u) {
  const o = {}; ['login', 'nome', 'perfil', 'projeto', 'equipe', 'codigo', 'email', 'ativo', 'termo_aceito_em', 'criado_em', 'modo_copa'].forEach((k) => (o[k] = u[k] || ''));
  o.perfil = normalizarPerfil(u.perfil);
  o.bloqueado = !!(u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date());
  o.senha_antiga = !u.senha_hash;
  return o;
}
function projetosDoUsuario(u) {
  return tabela('Projetos').filter((p) => u.perfil === 'admin' || u.projetos.indexOf(p.id) >= 0)
    .map((p) => ({ id: p.id, nome: p.nome, formulario: p.formulario, epsg: p.epsg, prefixo: p.prefixo, contratante: p.contratante || '', contrato: p.contrato || '', municipio: p.municipio || '', meta: +p.meta || 0, responsavel: p.responsavel || '', registro_profissional: p.registro_profissional || '', art: p.art || '', face_gps: +p.face_gps || 0, face_dist: +p.face_dist || 0, face_folga: +p.face_folga || 0, equipe: u.equipe, equipeCodigo: u.codigo || '' }));
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
  if (p.nome && tabela('Projetos').some((x) => x.id !== p.id && String(x.nome).trim().toLowerCase() === String(p.nome).trim().toLowerCase())) throw new Error('Já existe outro projeto com esse nome. Use um nome diferente (as cópias de segurança são separadas pelo nome).');
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
function lerFormulario(id) {
  const cache = CacheService.getScriptCache(); let t = null;
  try { t = cache.get('form:' + id); } catch (e) { /* lê do Drive */ }
  if (!t) { t = lerArquivoForm(id + '.json'); if (t) try { cache.put('form:' + id, t, 21600); } catch (e) { /* grande demais */ } }
  if (!t) throw new Error('Formulário não encontrado: ' + id); return JSON.parse(t);
}
function salvarFormulario(f, qml) {
  if (!f || !f.id || !Array.isArray(f.campos)) throw new Error('Formulário inválido.');
  gravarArquivoForm(f.id + '.json', JSON.stringify(f), 'application/json'); try { CacheService.getScriptCache().remove('form:' + f.id); } catch (e) { /* segue */ }
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
    if ((',' + lib + ',').indexOf(',' + id + ',') < 0 && !fotoDeOS(projetoId, id)) throw new Error('Foto de registro ainda não validado.');
  }
  const b = arq.getBlob();
  return { mime: b.getContentType() || 'image/jpeg', dados: Utilities.base64Encode(b.getBytes()) };
}

// ---------- Registros ----------
// Reserva uma faixa de códigos para o aparelho (ex.: E1-0101 a E1-0200).
// Dois celulares com o mesmo usuário nunca geram o mesmo código, mesmo sem internet.
function reservar(projetoId, prefixo, campo, qtd, minimo) {
  prefixo = String(prefixo || '').toUpperCase(); qtd = Math.min(Math.max(+qtd || 100, 1), 1000);
  if (!/^[A-Z0-9]{1,10}$/.test(prefixo)) throw new Error('Prefixo de código inválido.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const chave = 'seq:' + projetoId + ':' + prefixo;
    let atual = +(PROPS.getProperty(chave) || 0);
    if (!PROPS.getProperty(chave)) {
      const sh = planilha(projetoId);
      if (sh.getLastRow() > 1 && sh.getLastColumn()) {
        const ic = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf(String(campo || ''));
        const re = new RegExp('^' + prefixo + '-(\\d+)$');
        if (ic >= 0) sh.getRange(2, ic + 1, sh.getLastRow() - 1, 1).getValues().forEach((l) => { const m = String(l[0]).match(re); if (m) atual = Math.max(atual, +m[1]); });
      }
    }
    atual = Math.max(atual, Math.min(+minimo || 0, 999999));
    PROPS.setProperty(chave, String(atual + qtd));
    return { ini: atual + 1, fim: atual + qtd };
  } finally { lock.releaseLock(); }
}
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


// ---------- Ordens de serviço ----------
// Aba "Ordens" na planilha do projeto. Fluxo: Solicitada (pedido do cliente ou da equipe) > Aberta > Em execução > Concluída; ou Cancelada.
const COLS_OS = ['id', 'numero', 'registro_uuid', 'codigo_arvore', 'especie', 'latitude', 'longitude', 'endereco', 'bairro', 'tipo', 'prioridade', 'descricao', 'status', 'prazo', 'responsavel',
  'solicitada_por', 'solicitada_em', 'aberta_por', 'aberta_em', 'iniciada_por', 'iniciada_em', 'foto_antes', 'concluida_por', 'concluida_em', 'foto_depois', 'execucao_obs',
  'cancelada_por', 'cancelada_em', 'reaberta_em', 'motivo', 'historico', 'atualizado_em'];
const TIPOS_OS_PADRAO = ['Poda de limpeza', 'Poda de levantamento de copa', 'Poda de adequação à rede elétrica', 'Poda de condução', 'Supressão', 'Remoção de toco', 'Plantio', 'Substituição', 'Tratamento fitossanitário', 'Avaliação de risco', 'Outro'];
const PRIORIDADES_OS = ['Urgente', 'Alta', 'Média', 'Baixa'];
const OS_SEM_FOTO_ANTES = ['Plantio', 'Avaliação de risco'];
function tiposOS(projetoId) {
  const t = String(projeto(projetoId).tipos_os || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
  return t.length ? t : TIPOS_OS_PADRAO;
}
function abaOS(projetoId) {
  const ss = SpreadsheetApp.openById(projeto(projetoId).planilha_id); let sh = ss.getSheetByName('Ordens');
  if (!sh) { sh = ss.insertSheet('Ordens'); sh.appendRow(COLS_OS); sh.setFrozenRows(1); }
  const cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  const faltam = COLS_OS.filter((c) => cab.indexOf(c) < 0);
  if (faltam.length) sh.getRange(1, cab.filter(String).length + 1, 1, faltam.length).setValues([faltam]);
  return sh;
}
function lerOS(sh) {
  const v = sh.getDataRange().getValues(); const cab = v.shift().map(String);
  return v.filter((l) => l[0] !== '').map((l, i) => { const o = { __linha: i + 2 }; cab.forEach((c, k) => { if (c) o[c] = texto(l[k]); }); return o; });
}
function gravarOS(sh, o) {
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  o.atualizado_em = new Date().toISOString();
  const linha = cab.map((c) => seguro(o[c] == null ? '' : String(o[c])));
  const r = o.__linha || sh.getLastRow() + 1; const rg = sh.getRange(r, 1, 1, linha.length);
  rg.setNumberFormats([linha.map(() => '@')]); rg.setValues([linha]); o.__linha = r;
}
function publicoOS(o) { const x = Object.assign({}, o); delete x.__linha; return x; }
function listarOS(projetoId, usr) {
  const todas = lerOS(abaOS(projetoId));
  let out = todas;
  if (usr.perfil === 'coletor') out = todas.filter((o) => (o.responsavel && o.responsavel === usr.equipe && o.status !== 'Solicitada') || o.solicitada_por === usr.login);
  if (usr.perfil === 'cliente' && !clienteVeTodos(projetoId)) {
    const c = colunas(projetoId, ['uuid', 'validacao'], { perfil: 'admin' }); const val = {}; c.linhas.forEach((l) => { if (l[1] === 'Validado') val[l[0]] = 1; });
    out = out.map((o) => (!o.registro_uuid || val[o.registro_uuid] || o.solicitada_por === usr.login ? o : Object.assign({}, o, { codigo_arvore: '', especie: '', latitude: '', longitude: '', endereco: '', bairro: '', registro_uuid: '' })));
  }
  return out.map(publicoOS);
}
function idFoto(u) { const m = String(u || '').match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{20,80})\/view$/); return m ? m[1] : ''; }
function fotoDeOS(projetoId, id) {
  try {
    const cache = CacheService.getScriptCache(); let lib = cache.get('fotos_os:' + projetoId);
    if (lib == null) { lib = lerOS(abaOS(projetoId)).flatMap((o) => [idFoto(o.foto_antes), idFoto(o.foto_depois)]).filter(Boolean).join(','); try { cache.put('fotos_os:' + projetoId, lib, 600); } catch (e) { /* grande demais */ } }
    return (',' + lib + ',').indexOf(',' + id + ',') >= 0;
  } catch (e) { return false; }
}
// a foto da ordem precisa estar no DCIM deste projeto
function fotoDoProjeto(projetoId, u) {
  const id = idFoto(u); if (!id) return '';
  try { const p = projeto(projetoId); const arq = DriveApp.getFileById(id); if (!/^OS-/.test(String(arq.getName()))) return ''; const pais = arq.getParents(); while (pais.hasNext()) { const avo = pais.next().getParents(); while (avo.hasNext()) if (avo.next().getId() === p.pasta_id) return 'https://drive.google.com/file/d/' + id + '/view'; } } catch (e) { /* não existe */ }
  return '';
}
function carimboHist(usr, txt, quando) {
  const agora = new Date(); const q = quando ? new Date(quando) : agora; const f = (d) => Utilities.formatDate(d, FUSO, 'yyyy-MM-dd HH:mm');
  return f(q) + ' ' + usr.login + ': ' + String(txt).replace(/\s*\|\s*/g, ' / ').slice(0, 300) + (agora - q > 10 * 60000 ? ' (registrado no aparelho, enviado em ' + f(agora) + ')' : '');
}

// data informada pelo aparelho (trabalho feito sem internet); se vier no futuro ou muito antiga, vale a do servidor
function dataAparelho(iso, minimo) {
  const d = iso ? new Date(iso) : null; const agora = Date.now(); const min = minimo ? new Date(minimo).getTime() : agora - 60 * 864e5;
  return d && !isNaN(d) && d.getTime() <= agora + 10 * 60000 && d.getTime() >= Math.max(min || 0, agora - 60 * 864e5) ? d.toISOString() : new Date().toISOString();
}
function dadosArvore(projetoId, uuidR) {
  const sh = planilha(projetoId); const tot = sh.getLastRow() - 1; if (tot < 1) return null;
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); const iu = cab.indexOf('uuid'); if (iu < 0) return null;
  const col = sh.getRange(2, iu + 1, tot, 1).getValues(); let r = -1;
  for (let i = 0; i < tot; i++) if (String(col[i][0]) === uuidR) { r = i; break; }
  if (r < 0) return null;
  return linhaObj(cab, sh.getRange(r + 2, 1, 1, cab.length).getValues()[0]);
}
function salvarOS(projetoId, d, usr) {
  const coord = usr.perfil === 'admin' || usr.perfil === 'revisor';
  const tipos = tiposOS(projetoId);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = abaOS(projetoId); const todas = lerOS(sh);
    if (d.chave && !/^[\w-]{8,60}$/.test(String(d.chave))) throw new Error('Identificador inválido.');
    if (d.chave) { const ja = todas.find((o) => o.id === d.chave); if (ja) { if (ja.solicitada_por !== usr.login && ja.aberta_por !== usr.login) throw new Error('Identificador inválido.'); return { ordem: publicoOS(ja), ignorado: true }; } } // reenvio do mesmo pedido (aparelho sem internet)
    const atual = d.id ? todas.find((o) => o.id === d.id) : null;
    if (d.id && !atual) throw new Error('Ordem de serviço não encontrada.');
    if (atual && !coord) throw new Error('Seu perfil não tem acesso a esta função.');
    if (atual && ['Concluída', 'Cancelada'].indexOf(atual.status) >= 0) throw new Error('Ordem ' + atual.status.toLowerCase() + '. Reabra antes de alterar.');
    const o = atual || { id: String(d.chave || Utilities.getUuid()).slice(0, 60) };
    if (d.tipo != null) { if (tipos.indexOf(d.tipo) < 0) throw new Error('Tipo de serviço inválido.'); o.tipo = d.tipo; }
    if (d.prioridade != null) { if (PRIORIDADES_OS.indexOf(d.prioridade) < 0) throw new Error('Prioridade inválida.'); o.prioridade = d.prioridade; }
    if (d.descricao != null) o.descricao = String(d.descricao).slice(0, 1000);
    if (coord) {
      if (d.prazo != null) { if (d.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(d.prazo)) throw new Error('Prazo inválido.'); o.prazo = d.prazo; }
      if (d.responsavel != null) o.responsavel = String(d.responsavel).slice(0, 60);
    }
    if (!o.tipo) throw new Error('Escolha o tipo de serviço.');
    if (!atual && !coord) { const hoje = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd'); if (todas.filter((x) => x.solicitada_por === usr.login && dia(x.solicitada_em) === hoje).length >= 50) throw new Error('Limite de 50 pedidos por dia atingido. Fale com a coordenação.'); }
    if (!o.prioridade) o.prioridade = 'Média';
    if (!atual) {
      if (d.registro_uuid) {
        const a = dadosArvore(projetoId, String(d.registro_uuid));
        if (!a || (usr.perfil === 'cliente' && a.validacao === 'Descartado') || (usr.perfil === 'cliente' && !clienteVeTodos(projetoId) && a.validacao !== 'Validado')) throw new Error('Árvore não disponível para pedido. Envie o registro antes de pedir o serviço.');
        const form = lerFormulario(projeto(projetoId).formulario);
        const cc = form.campos.find((c) => c.auto === 'codigo') || form.campos.find((c) => /codigo/i.test(c.nome));
        const ce = form.campos.find((c) => c.tipo === 'species');
        Object.assign(o, { registro_uuid: a.uuid, codigo_arvore: cc ? a[cc.nome] || '' : '', especie: ce ? a[ce.nome] || '' : '', latitude: a.latitude, longitude: a.longitude, endereco: a.endereco_aprox || '', bairro: a.bairro_aprox || '' });
      } else {
        const la = +d.latitude, lo = +d.longitude;
        if (!(la >= -34 && la <= 6 && lo >= -74 && lo <= -28)) throw new Error('Informe o local do serviço (árvore ou ponto no mapa).');
        Object.assign(o, { latitude: la, longitude: lo, endereco: String(d.endereco || '').slice(0, 200), bairro: String(d.bairro || '').slice(0, 100) });
      }
      const props = PROPS; const k = 'OSN_' + projetoId; const n = (+props.getProperty(k) || todas.reduce((m, x) => Math.max(m, +x.numero || 0), 0)) + 1; props.setProperty(k, String(n));
      o.numero = n;
      const agora = new Date().toISOString(); // pedido e abertura sempre com a hora do servidor
      if (coord) Object.assign(o, { status: 'Aberta', aberta_por: usr.login, aberta_em: agora });
      else Object.assign(o, { status: 'Solicitada', solicitada_por: usr.login, solicitada_em: agora });
      o.historico = carimboHist(usr, (coord ? 'abriu a ordem' : 'solicitou o serviço') + ' (' + o.tipo + ', prioridade ' + o.prioridade.toLowerCase() + ')' + (o.responsavel ? ', responsável ' + o.responsavel : ''));
    } else {
      o.historico = [atual.historico, carimboHist(usr, 'alterou: ' + ['tipo', 'prioridade', 'prazo', 'responsavel', 'descricao'].filter((c) => d[c] != null && String(d[c]) !== String(atual[c] || '')).join(', '))].filter(Boolean).join(' | ');
    }
    gravarOS(sh, o);
    auditar(usr.login, atual ? 'os_alterar' : 'os_abrir', projetoId, 'OS ' + o.numero + ' ' + o.tipo);
    return { ordem: publicoOS(o) };
  } finally { lock.releaseLock(); }
}
function andamentoOS(projetoId, id, etapa, d, usr) {
  const coord = usr.perfil === 'admin' || usr.perfil === 'revisor';
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = abaOS(projetoId); const o = lerOS(sh).find((x) => x.id === id);
    if (!o) throw new Error('Ordem de serviço não encontrada.');
    const daEquipe = usr.perfil === 'coletor' && o.responsavel && o.responsavel === usr.equipe;
    const exige = (ok) => { if (!ok) throw new Error('Seu perfil não tem acesso a esta função.'); };
    const base = o.reaberta_em || o.aberta_em || o.solicitada_em;
    const quando = dataAparelho(d.em, etapa === 'concluir' ? (o.iniciada_em && o.status === 'Em execução' ? o.iniciada_em : base) : base); const obs = String(d.obs || '').slice(0, 1000);
    let txt = '';
    if ((etapa === 'iniciar' || etapa === 'concluir') && o.reaberta_em && d.em && new Date(d.em) < new Date(o.reaberta_em)) throw new Error('A coordenação reabriu esta ordem depois do registro feito no aparelho. Abra a ordem e registre a execução de novo.');
    if (etapa === 'aprovar') {
      exige(coord); if (o.status === 'Aberta') return { ordem: publicoOS(o), ignorado: true };
      if (o.status !== 'Solicitada') throw new Error('Só pedidos com situação Solicitada podem ser aprovados.');
      Object.assign(o, { status: 'Aberta', aberta_por: usr.login, aberta_em: new Date().toISOString() });
      if (d.responsavel != null) o.responsavel = String(d.responsavel).slice(0, 60);
      if (d.prazo) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d.prazo)) throw new Error('Prazo inválido.'); o.prazo = d.prazo; }
      txt = 'aprovou o pedido' + (o.responsavel ? ', responsável ' + o.responsavel : '');
    } else if (etapa === 'iniciar') {
      exige(coord || daEquipe); if (o.status === 'Em execução') return { ordem: publicoOS(o), ignorado: true };
      if (o.status !== 'Aberta') throw new Error('Só ordens abertas podem ser iniciadas (situação atual: ' + o.status + ').');
      const f = fotoDoProjeto(projetoId, d.foto_antes); if (!f && OS_SEM_FOTO_ANTES.indexOf(o.tipo) < 0) throw new Error('Tire a foto de antes do serviço.');
      Object.assign(o, { status: 'Em execução', iniciada_por: usr.login, iniciada_em: quando, foto_antes: f || o.foto_antes });
      txt = 'iniciou a execução';
    } else if (etapa === 'concluir') {
      exige(coord || daEquipe); if (o.status === 'Concluída') return { ordem: publicoOS(o), ignorado: true, aviso: o.concluida_por !== usr.login ? 'Esta ordem já tinha sido concluída por ' + o.concluida_por + '. O seu registro não foi aplicado.' : '' };
      if (['Aberta', 'Em execução'].indexOf(o.status) < 0) throw new Error('Só ordens abertas ou em execução podem ser concluídas (situação atual: ' + o.status + ').');
      const fa = fotoDoProjeto(projetoId, d.foto_antes) || o.foto_antes; if (!fa && OS_SEM_FOTO_ANTES.indexOf(o.tipo) < 0) throw new Error('Falta a foto de antes do serviço.');
      const fd = fotoDoProjeto(projetoId, d.foto_depois); if (!fd) throw new Error('Tire a foto de depois do serviço.');
      if (o.status === 'Aberta') Object.assign(o, { iniciada_por: usr.login, iniciada_em: dataAparelho(d.iniciada_em || d.em, base) });
      Object.assign(o, { status: 'Concluída', concluida_por: usr.login, concluida_em: quando, foto_antes: fa, foto_depois: fd, execucao_obs: obs });
      txt = 'concluiu o serviço' + (obs ? ' (' + obs + ')' : '');
    } else if (etapa === 'cancelar') {
      exige(coord); if (o.status === 'Cancelada') return { ordem: publicoOS(o), ignorado: true };
      if (o.status === 'Concluída') throw new Error('Ordem concluída não pode ser cancelada. Reabra antes, se precisar.');
      if (!obs) throw new Error('Informe o motivo do cancelamento.');
      Object.assign(o, { status: 'Cancelada', cancelada_por: usr.login, cancelada_em: new Date().toISOString(), motivo: obs });
      txt = 'cancelou (' + obs + ')';
    } else if (etapa === 'reabrir') {
      exige(coord); if (['Concluída', 'Cancelada'].indexOf(o.status) < 0) throw new Error('Só ordens concluídas ou canceladas podem ser reabertas.');
      if (!obs) throw new Error('Informe o motivo para reabrir.');
      const fh = (x) => Utilities.formatDate(new Date(x), FUSO, 'yyyy-MM-dd HH:mm');
      const ant = o.concluida_em || o.iniciada_em ? '. Execução anterior: ' + [o.iniciada_em ? 'iniciada ' + fh(o.iniciada_em) + ' por ' + o.iniciada_por : '', o.concluida_em ? 'concluída ' + fh(o.concluida_em) + ' por ' + o.concluida_por : '', o.execucao_obs ? 'observação: ' + o.execucao_obs : '', o.foto_antes ? 'foto de antes ' + o.foto_antes : '', o.foto_depois ? 'foto de depois ' + o.foto_depois : ''].filter(Boolean).join(', ') : '';
      Object.assign(o, { status: 'Aberta', motivo: obs, iniciada_por: '', iniciada_em: '', concluida_por: '', concluida_em: '', foto_depois: '', execucao_obs: '', cancelada_por: '', cancelada_em: '', reaberta_em: new Date().toISOString() });
      txt = 'reabriu (' + obs + ')' + ant;
    } else throw new Error('Etapa inválida.');
    o.historico = [o.historico, carimboHist(usr, txt, etapa === 'iniciar' || etapa === 'concluir' ? quando : null)].filter(Boolean).join(' | ');
    o.historico = String(o.historico).slice(-20000);
    gravarOS(sh, o); try { CacheService.getScriptCache().remove('fotos_os:' + projetoId); } catch (e) { /* segue */ }
    auditar(usr.login, 'os_' + etapa, projetoId, 'OS ' + o.numero);
    return { ordem: publicoOS(o) };
  } finally { lock.releaseLock(); }
}



// ---------- Quadras ----------
// A camada (polígonos e números) fica num arquivo no Drive do projeto; a situação de cada quadra fica na aba "Quadras".
const COLS_QUADRAS = ['numero', 'equipe', 'situacao', 'marcada_por', 'marcada_em', 'obs', 'historico', 'atualizado_em', 'atribuida'];
// atribuida: 'sim' quando a coordenação definiu a equipe; 'nao' quando a equipe pegou sozinha (aí não prende as faces de outras equipes)
function garantirCab(sh, cols) { const cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String); const faltam = cols.filter((c) => cab.indexOf(c) < 0); if (faltam.length) sh.getRange(1, cab.filter(String).length + 1, 1, faltam.length).setValues([faltam]); return sh; }
const SITUACOES_QUADRA = ['A levantar', 'Em levantamento', 'Levantada'];
function infoQuadras(projetoId) { try { return JSON.parse(PROPS.getProperty('QD_' + projetoId) || 'null'); } catch (e) { return null; } }
function importarQuadras(projetoId, camada, usr) {
  const txt = String(camada || ''); if (txt.length > 15e6) throw new Error('Camada grande demais (limite de 15 MB). Simplifique os polígonos antes de importar.');
  let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Camada inválida.'); }
  if (!j || !Array.isArray(j.quadras) || !j.quadras.length) throw new Error('A camada não tem quadras.');
  if (j.quadras.length > 50000) throw new Error('Mais de 50 mil quadras: divida a camada por região.');
  const nums = Object.create(null); let nFaces = 0;
  j.quadras.forEach((q) => {
    if (!q || typeof q.n !== 'string' || !Array.isArray(q.b) || q.b.length !== 4 || !Array.isArray(q.a) || !q.a.length) throw new Error('Quadra com formato inválido.');
    q.n = q.n.replace(/[\t\r\n]+/g, ' ').trim().slice(0, 40); if (!q.n) throw new Error('Quadra sem número.'); if (nums[q.n]) throw new Error('Número de quadra repetido: ' + q.n); nums[q.n] = 1;
    if (!q.b.every((x) => typeof x === 'number' && isFinite(x)) || q.b[1] < -34 || q.b[3] > 6 || q.b[0] < -74 || q.b[2] > -28) throw new Error('Quadra ' + q.n + ' fora do Brasil ou com coordenada inválida.');
    q.a.forEach((a) => { if (!Array.isArray(a) || a.length < 6 || a.length > 20000 || !a.every((x) => typeof x === 'number' && isFinite(x))) throw new Error('Polígono inválido na quadra ' + q.n + '.'); });
    if (q.p) Object.keys(q.p).forEach((k) => { q.p[k] = String(q.p[k]).slice(0, 60); });
    if (q.f != null) {
      const nv = q.a[0].length / 2 - 1; const letras = {};
      if (!Array.isArray(q.f) || q.f.length > 80) throw new Error('Faces inválidas na quadra ' + q.n + '.');
      q.f = q.f.map((f) => {
        if (!f || !/^[A-Z]{1,3}$/.test(f.i) || letras[f.i] || !Array.isArray(f.k) || f.k.length !== 2 || !f.k.every((x) => Number.isInteger(x) && x >= 0 && x < nv)) throw new Error('Face inválida na quadra ' + q.n + '.');
        letras[f.i] = 1; nFaces++;
        return { i: f.i, r: String(f.r || '').slice(0, 60), c: Math.max(0, Math.min(100000, Math.round(+f.c || 0))), s: String(f.s || '').slice(0, 12), k: f.k };
      });
      if (!q.f.length) delete q.f;
    }
  });
  const p = projeto(projetoId); const pasta = DriveApp.getFolderById(p.pasta_id);
  const ant = infoQuadras(projetoId);
  const limpo = JSON.stringify({ campo: String(j.campo || '').slice(0, 40), total: j.quadras.length, quadras: j.quadras });
  const arq = pasta.createFile('Quadras - ' + p.nome + '.json', limpo, 'application/json');
  if (ant && ant.id) try { DriveApp.getFileById(ant.id).setTrashed(true); } catch (e) { /* já removido */ }
  const info = { id: arq.getId(), em: new Date().toISOString(), total: j.quadras.length, faces: nFaces, campo: String(j.campo || '').slice(0, 40) };
  PROPS.setProperty('QD_' + projetoId, JSON.stringify(info));
  guardarIndiceCamada(projetoId, j.quadras);
  auditar(usr.login, 'quadras_importar', projetoId, info.total + ' quadras');
  return { total: info.total, faces: nFaces, versao: info.em };
}
function camadaQuadras(projetoId, versao) {
  const info = infoQuadras(projetoId); if (!info) return { semCamada: true };
  if (versao && versao === info.em) return { igual: true, versao: info.em };
  return { versao: info.em, total: info.total, camada: DriveApp.getFileById(info.id).getBlob().getDataAsString() };
}
// índice da camada no cache do servidor: número de cada quadra e as letras das suas faces ("12\tA,B,C")
function guardarIndiceCamada(projetoId, quadras) {
  const txt = quadras.map((q) => q.n + '\t' + (q.f || []).map((f) => f.i).join(',')).join('\n');
  try { CacheService.getScriptCache().put('qdidx:' + projetoId, txt, 21600); } catch (e) { /* grande demais: lê o arquivo quando precisar */ }
  return txt;
}
function indiceCamada(projetoId) {
  let txt = CacheService.getScriptCache().get('qdidx:' + projetoId);
  if (txt == null) {
    const info = infoQuadras(projetoId); if (!info) throw new Error('Este projeto ainda não tem camada de quadras.');
    txt = guardarIndiceCamada(projetoId, JSON.parse(DriveApp.getFileById(info.id).getBlob().getDataAsString()).quadras);
  }
  const nums = new Set(); const faces = Object.create(null);
  txt.split('\n').forEach((l) => { const t = l.split('\t'); nums.add(t[0]); faces[t[0]] = t[1] ? t[1].split(',') : []; });
  return { nums, faces };
}
function numerosQuadras(projetoId) { return indiceCamada(projetoId).nums; }
function abaQuadras(projetoId) {
  const ss = SpreadsheetApp.openById(projeto(projetoId).planilha_id); let sh = ss.getSheetByName('Quadras');
  if (!sh) { sh = ss.insertSheet('Quadras'); sh.appendRow(COLS_QUADRAS); sh.setFrozenRows(1); }
  if (!sh.getLastRow()) sh.appendRow(COLS_QUADRAS);
  return garantirCab(sh, COLS_QUADRAS);
}
function lerSitQuadras(projetoId) { return lerOS(abaQuadras(projetoId)); }
const COLS_FACES = ['numero', 'quadra', 'rua', 'equipe', 'situacao', 'marcada_por', 'marcada_em', 'largura', 'registro', 'obs', 'historico', 'atualizado_em', 'atribuida'];
const SITUACOES_FACE = ['A levantar', 'Em levantamento', 'Levantada', 'Levantada, sem árvores'];
const FACE_FEITA = ['Levantada', 'Levantada, sem árvores'];
function abaFaces(projetoId) {
  const ss = SpreadsheetApp.openById(projeto(projetoId).planilha_id); let sh = ss.getSheetByName('Faces');
  if (!sh) { sh = ss.insertSheet('Faces'); sh.appendRow(COLS_FACES); sh.setFrozenRows(1); }
  if (!sh.getLastRow()) sh.appendRow(COLS_FACES);
  return garantirCab(sh, COLS_FACES);
}
function lerSitFaces(projetoId) { return lerOS(abaFaces(projetoId)); }
// Marca quadras e faces (itens com tipo "face", número "quadra-letra"). Ao mexer numa face, a quadra acompanha:
// todas as faces levantadas deixam a quadra levantada; uma face começada deixa a quadra em levantamento.
function marcarQuadras(projetoId, itens, usr) {
  if (!Array.isArray(itens) || !itens.length) throw new Error('Nenhuma quadra informada.');
  const coord = usr.perfil === 'admin' || usr.perfil === 'revisor';
  if (itens.length > (coord ? 5000 : 300)) throw new Error('Quadras demais de uma vez.');
  const idx = indiceCamada(projetoId);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const itF = itens.filter((it) => it && it.tipo === 'face'); const itQ = itens.filter((it) => !(it && it.tipo === 'face')).map((it) => { const o = Object.assign({}, it); delete o.sistema; delete o.soDe; return o; }); // 'sistema' só vale para o efeito interno das faces
    let rf = { alteradas: 0, recusadas: [], quadras: [] };
    if (itF.length) rf = marcarFacesSemTrava(projetoId, itF, usr, coord, idx);
    const rq = itQ.length || rf.quadras.length ? marcarQuadrasSemTrava(projetoId, itQ.concat(rf.quadras), usr, coord, idx.nums) : { alteradas: 0, recusadas: [] };
    return { alteradas: rf.alteradas + rq.alteradas, recusadas: rf.recusadas.concat(rq.recusadas) };
  } finally { lock.releaseLock(); }
}
function marcarFacesSemTrava(projetoId, itens, usr, coord, idx) {
  const eqQuadra = {}; lerSitQuadras(projetoId).forEach((q) => { if (q.equipe && q.atribuida !== 'nao') eqQuadra[q.numero] = q.equipe; });
  const sh = abaFaces(projetoId); const por = {}; const todas = [];
  const v0 = sh.getDataRange().getValues(); const cab0 = v0.shift().map(String);
  v0.forEach((l, i) => { if (l[0] === '') return; const o = { __linha: i + 2 }; cab0.forEach((c, k) => { if (c) o[c] = texto(l[k]); }); todas.push(o); por[o.numero] = o; }); // linha real na planilha, mesmo com linhas em branco no meio
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const mudou = []; const recusadas = []; const qds = {};
  itens.forEach((it) => {
    const id = String(it.numero || '').slice(0, 45); const cut = id.lastIndexOf('-'); const qn = id.slice(0, cut), letra = id.slice(cut + 1);
    if (cut < 1 || !Array.isArray(idx.faces[qn]) || idx.faces[qn].indexOf(letra) < 0) { recusadas.push({ numero: id, motivo: 'Face não existe na camada.' }); return; }
    const f0 = por[id]; const f = Object.assign({}, f0 || { numero: id, quadra: qn, situacao: 'A levantar', equipe: '' }); // cópia: item recusado não muda nada
    if (it.situacao != null && SITUACOES_FACE.indexOf(it.situacao) < 0) { recusadas.push({ numero: id, motivo: 'Situação inválida.' }); return; }
    if (it.situacao === 'Levantada, sem árvores') {
      const lt = String(it.largura == null ? '' : it.largura).trim(); const lg = +lt.replace(',', '.'); // largura é opcional desde a 2.6 (só a foto)
      if (!/^[0-9a-f-]{8,60}$/i.test(String(it.registro || '')) || (lt && (!/^\d{1,2}([.,]\d{1,3})?$/.test(lt) || !(lg > 0)))) { recusadas.push({ numero: id, motivo: 'Face sem árvores precisa da foto da calçada (cadastro de calçada).' }); return; }
    }
    if (!coord) {
      if (it.equipe != null && it.equipe !== usr.equipe) { recusadas.push({ numero: id, motivo: 'Só a coordenação escolhe a equipe.' }); return; }
      if (f.equipe && f.equipe !== usr.equipe) { recusadas.push({ numero: id, motivo: 'Face da ' + f.equipe + '.' }); return; }
      // face ainda sem equipe numa quadra de outra equipe: só a coordenação passa a face para outra equipe
      if (!f.equipe && eqQuadra[qn] && eqQuadra[qn] !== usr.equipe) { recusadas.push({ numero: id, motivo: 'Quadra da ' + eqQuadra[qn] + '.' }); return; }
      if (!f.equipe && it.situacao != null && it.situacao !== 'A levantar') { f.equipe = usr.equipe; f.atribuida = 'nao'; }
      if (it.situacao === 'A levantar' && f.atribuida !== 'sim') f.equipe = ''; // desmarcou: a face volta a ficar livre (se não foi a coordenação que deu a equipe)
    } else if (it.equipe != null) { f.equipe = String(it.equipe).slice(0, 60); f.atribuida = f.equipe ? 'sim' : ''; }
    if (it.rua != null) f.rua = String(it.rua).slice(0, 60);
    if (it.auto && (f.situacao || 'A levantar') !== 'A levantar') return;
    if (it.situacao != null && it.em && f.marcada_em && new Date(it.em) < new Date(f.marcada_em)) { recusadas.push({ numero: id, motivo: 'A face foi marcada depois por ' + f.marcada_por + ' (' + f.situacao.toLowerCase() + ').' }); return; }
    const txt = [];
    const lgNova = it.situacao === 'Levantada, sem árvores' && it.largura != null && String(it.largura).trim() ? String(+String(it.largura).replace(',', '.')) : '';
    if (it.situacao === 'Levantada, sem árvores' && it.situacao === f.situacao && it.registro === f.registro && lgNova !== f.largura) { f.largura = lgNova; txt.push('largura da calçada ' + lgNova.replace('.', ',') + ' m'); } // cadastro corrigido depois
    else if (it.situacao != null && (it.situacao !== f.situacao || (it.situacao === 'Levantada, sem árvores' && it.registro !== f.registro))) {
      f.situacao = it.situacao; f.marcada_por = usr.login; f.marcada_em = dataAparelho(it.em); txt.push(it.situacao.toLowerCase());
      if (it.situacao === 'Levantada, sem árvores') { f.registro = String(it.registro).slice(0, 60); f.largura = lgNova; } else { f.registro = ''; f.largura = ''; }
    }
    if (coord && it.equipe != null) txt.push('equipe ' + (f.equipe || 'nenhuma'));
    if (it.obs != null) f.obs = String(it.obs).slice(0, 300);
    if (!txt.length && it.obs == null) return;
    f.historico = [f.historico, carimboHist(usr, txt.join(', ') || 'observação', it.situacao != null ? f.marcada_em : null)].filter(Boolean).join(' | ').slice(-3000);
    f.atualizado_em = new Date().toISOString();
    if (f0) Object.assign(f0, f); else { por[id] = f; todas.push(f); }
    mudou.push(id); if (it.situacao != null) qds[qn] = 1;
  });
  if (mudou.length) {
    // a aba de faces pode chegar a dezenas de milhares de linhas: grava só as linhas que mudaram
    const linha = (f) => cab.map((c) => seguro(f[c] == null ? '' : String(f[c])));
    const velhas = [], novas = []; [...new Set(mudou)].forEach((id) => (por[id].__linha ? velhas : novas).push(por[id]));
    if (velhas.length > 80) { const ult = sh.getLastRow(); if (ult > 1) sh.getRange(2, 1, ult - 1, sh.getLastColumn()).clearContent(); const rg = sh.getRange(2, 1, todas.length, cab.length); rg.setNumberFormat('@'); rg.setValues(todas.map(linha)); }
    else {
      velhas.forEach((f) => { const rg = sh.getRange(f.__linha, 1, 1, cab.length); rg.setNumberFormat('@'); rg.setValues([linha(f)]); });
      if (novas.length) { const rg = sh.getRange(sh.getLastRow() + 1, 1, novas.length, cab.length); rg.setNumberFormat('@'); rg.setValues(novas.map(linha)); }
    }
    auditar(usr.login, 'faces_marcar', projetoId, mudou.length + ' face(s): ' + mudou.slice(0, 20).join(', '));
  }
  // a quadra acompanha as faces
  const quadras = Object.keys(qds).map((qn) => {
    const st = idx.faces[qn].map((l) => (por[qn + '-' + l] || {}).situacao || 'A levantar');
    if (st.every((x) => FACE_FEITA.indexOf(x) >= 0)) return { numero: qn, situacao: 'Levantada', sistema: 'todas as faces levantadas' };
    if (st.some((x) => x !== 'A levantar')) return { numero: qn, situacao: 'Em levantamento', sistema: 'face em levantamento' };
    return { numero: qn, situacao: 'A levantar', sistema: 'nenhuma face começada', soDe: 'faces' }; // desfaz só o que veio das faces
  }).filter(Boolean);
  return { alteradas: mudou.length, recusadas, quadras };
}
function marcarQuadrasSemTrava(projetoId, itens, usr, coord, nums) {
  {
    const sh = abaQuadras(projetoId); const todas = lerOS(sh); const por = {}; todas.forEach((q) => { por[q.numero] = q; });
    const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const mudou = []; const recusadas = [];
    itens.forEach((it) => {
      const n = String(it && it.numero || '').slice(0, 40);
      if (!nums.has(n)) { recusadas.push({ numero: n, motivo: 'Quadra não existe na camada.' }); return; }
      const q0 = por[n]; const q = Object.assign({}, q0 || { numero: n, situacao: 'A levantar', equipe: '' }); // cópia: item recusado não muda nada
      if (it.situacao != null && SITUACOES_QUADRA.indexOf(it.situacao) < 0) { recusadas.push({ numero: n, motivo: 'Situação inválida.' }); return; }
      if (it.sistema) { // efeito das faces: não muda a equipe nem é recusado pela equipe da quadra
        const atual = q.situacao || 'A levantar';
        if (atual === it.situacao) return;
        if (it.soDe === 'faces' && !(atual === 'Levantada' || (atual === 'Em levantamento' && /\(face em levantamento\)$/.test(q.historico || '')))) return; // quadra começada por árvore ou pela equipe fica como está
        q.situacao = it.situacao; q.marcada_por = usr.login; q.marcada_em = new Date().toISOString();
        if (it.situacao === 'Levantada' && !q.equipe && !coord && usr.equipe) { q.equipe = usr.equipe; q.atribuida = 'nao'; } // quadra feita pelas faces fica com a equipe que fez
        if (it.situacao === 'A levantar' && q.atribuida === 'nao') q.equipe = '';
        q.historico = [q.historico, carimboHist(usr, it.situacao.toLowerCase() + ' (' + it.sistema + ')', q.marcada_em)].filter(Boolean).join(' | ').slice(-5000);
        q.atualizado_em = q.marcada_em; if (q0) Object.assign(q0, q); else { por[n] = q; todas.push(q); } mudou.push(n); return;
      }
      if (!coord) {
        if (it.equipe != null && it.equipe !== usr.equipe) { recusadas.push({ numero: n, motivo: 'Só a coordenação escolhe a equipe.' }); return; }
        if (q.equipe && q.equipe !== usr.equipe) { recusadas.push({ numero: n, motivo: 'Quadra da ' + q.equipe + '.' }); return; }
        if (!q.equipe) { q.equipe = usr.equipe; q.atribuida = 'nao'; }
      } else if (it.equipe != null) { q.equipe = String(it.equipe).slice(0, 60); q.atribuida = q.equipe ? 'sim' : ''; }
      if (it.auto && (q.situacao || 'A levantar') !== 'A levantar') return; // automática ao salvar árvore: só vale para quadra ainda a levantar
      if (it.situacao != null && it.em && q.marcada_em && new Date(it.em) < new Date(q.marcada_em)) { recusadas.push({ numero: n, motivo: 'A quadra foi marcada depois por ' + q.marcada_por + ' (' + q.situacao.toLowerCase() + ').' }); return; }
      const txt = [];
      if (it.situacao != null && it.situacao !== q.situacao) { q.situacao = it.situacao; q.marcada_por = usr.login; q.marcada_em = dataAparelho(it.em); txt.push(it.situacao.toLowerCase()); }
      if (coord && it.equipe != null) txt.push('equipe ' + (q.equipe || 'nenhuma'));
      if (it.obs != null) q.obs = String(it.obs).slice(0, 300);
      if (!txt.length && it.obs == null) return;
      q.historico = [q.historico, carimboHist(usr, txt.join(', ') || 'observação', it.situacao != null ? q.marcada_em : null)].filter(Boolean).join(' | ').slice(-5000);
      q.atualizado_em = new Date().toISOString();
      if (q0) Object.assign(q0, q); else { por[n] = q; todas.push(q); }
      mudou.push(n);
    });
    if (mudou.length) {
      const linhas = todas.map((q) => cab.map((c) => seguro(q[c] == null ? '' : String(q[c]))));
      const rg = sh.getRange(2, 1, linhas.length, cab.length); rg.setNumberFormat('@'); rg.setValues(linhas);
      auditar(usr.login, 'quadras_marcar', projetoId, mudou.length + ' quadra(s): ' + mudou.slice(0, 20).join(', '));
    }
    return { alteradas: mudou.length, recusadas };
  }
}

// ---------- Chaves de integração (outros sistemas, só leitura) ----------
// A chave aparece uma vez para a coordenação; no servidor fica só o resumo criptográfico.
function hashChave(k) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'chave|' + k, Utilities.Charset.UTF_8)); }
function criarChave(nome, projetoId, usr) {
  nome = String(nome || '').trim().slice(0, 60); if (!nome) throw new Error('Dê um nome à chave (ex.: Sistema da prefeitura).');
  projeto(projetoId);
  garantirAba('Chaves', COLS_CHAVES);
  const k = 'neo_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const id = Utilities.getUuid().slice(0, 8);
  salvarLinha('Chaves', COLS_CHAVES, 'id', { id: id, nome: seguro(nome), projeto: projetoId, hash: hashChave(k), criada_por: usr.login, criada_em: new Date().toISOString(), ativa: 'sim' });
  auditar(usr.login, 'chave_criar', projetoId, nome);
  return { id: id, chave: k };
}
function autenticarChave(k, acao) {
  if (!/^neo_[a-f0-9]{48}$/.test(String(k))) throw Object.assign(new Error('Chave de integração inválida.'), { sessao: true });
  const c = tabela('Chaves').find((x) => x.hash === hashChave(k) && x.ativa === 'sim');
  if (!c) throw Object.assign(new Error('Chave de integração inválida ou revogada.'), { sessao: true });
  if (ACOES_INTEGRACAO.indexOf(acao) < 0) throw new Error('A chave de integração só permite consultar dados.');
  try { const ck = 'api:' + c.id + ':' + acao + ':' + Utilities.formatDate(new Date(), FUSO, 'yyyyMMddHH'); const cache = CacheService.getScriptCache(); if (!cache.get(ck)) { cache.put(ck, '1', 3700); auditar('integração: ' + c.nome, 'api_' + acao, c.projeto, 'primeira consulta desta hora'); } } catch (e) { auditar('integração: ' + c.nome, 'api_' + acao, c.projeto, ''); }
  return { login: 'integracao-' + c.id, nome: c.nome, perfil: 'cliente', equipe: '', projetos: [c.projeto], termo_aceito_em: c.criada_em, integracao: true };
}

// ---------- Restauração de cópia de segurança ----------
function listarCopias(projetoId) {
  const p = projeto(projetoId); const out = []; const raiz = pastaBackup(); const it = raiz.getFolders();
  const esc = String(p.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rxDia = new RegExp('^' + esc + ' - \\d{4}-\\d{2}-\\d{2}$'); const rxAntes = new RegExp('^' + esc + ' - antes da restauração \\d{4}-\\d{2}-\\d{2} \\d{2}-\\d{2}$');
  const soltos = raiz.getFiles(); while (soltos.hasNext()) { const a = soltos.next(); if (rxAntes.test(String(a.getName()))) out.push({ id: a.getId(), nome: a.getName(), dia: String(a.getName()).slice(-16, -6) }); }
  while (it.hasNext()) {
    const f = it.next(); const fs = f.getFiles();
    while (fs.hasNext()) { const a = fs.next(); if (rxDia.test(String(a.getName()))) out.push({ id: a.getId(), nome: a.getName(), dia: f.getName() }); }
  }
  return out.sort((a, b) => (a.dia < b.dia ? 1 : -1)).slice(0, 60);
}
// Troca o conteúdo das abas Registros e Ordens pelo da cópia escolhida. Antes, guarda uma cópia do estado atual.
function restaurarCopia(projetoId, arquivoId, usr) {
  const p = projeto(projetoId);
  if (!listarCopias(projetoId).some((c) => c.id === arquivoId)) throw new Error('Cópia não encontrada na pasta de cópias deste projeto.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const agora = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH-mm');
    const antes = DriveApp.getFileById(p.planilha_id).makeCopy(p.nome + ' - antes da restauração ' + agora, pastaBackup());
    const origem = SpreadsheetApp.openById(arquivoId); const destino = SpreadsheetApp.openById(p.planilha_id);
    const res = {};
    ['Registros', 'Ordens', 'Quadras'].forEach((nome) => {
      const de = origem.getSheetByName(nome); let para = destino.getSheetByName(nome);
      if (!de && !para) return;
      if (!para) para = destino.insertSheet(nome);
      if (!de) { if (para.getLastRow()) para.getRange(1, 1, para.getLastRow(), Math.max(1, para.getLastColumn())).clearContent(); res[nome] = 0; return; } // cópia anterior às ordens de serviço: a aba fica vazia (o estado anterior está na cópia guardada)
      const v = de.getLastRow() ? de.getRange(1, 1, de.getLastRow(), de.getLastColumn()).getValues() : [];
      if (para.getLastRow()) para.getRange(1, 1, para.getLastRow(), Math.max(1, para.getLastColumn())).clearContent();
      if (v.length) { const rg = para.getRange(1, 1, v.length, v[0].length); rg.setNumberFormat('@'); rg.setValues(v.map((l) => l.map((x) => (x instanceof Date ? x.toISOString() : typeof x === 'string' ? seguro(x.replace(/^'/, '')) : x)))); }
      res[nome] = Math.max(0, v.length - 1);
    });
    try { CacheService.getScriptCache().removeAll(['painel:' + projetoId + ':todos', 'painel:' + projetoId + ':cliente', 'fotos_val:' + projetoId]); } catch (e) { /* segue */ }
    auditar(usr.login, 'backup_restaurar', projetoId, 'restaurou ' + arquivoId + ' (' + (res.Registros || 0) + ' registros); estado anterior guardado em ' + antes.getId());
    return { registros: res.Registros || 0, ordens: res.Ordens || 0, copiaAnterior: antes.getId() };
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
