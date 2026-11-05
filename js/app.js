// Neofloresta Inventário
(() => {
  const VERSAO = '2.2.0';
  const TERMO_VERSAO = '2026-11';
  const S = { editando: new Set(), linhas: {}, sessao: null, projeto: null, form: null, reg: null, aba: 0, tentou: false, pos: null, sincronizando: false, revisao: null, adminAba: 'exportar' };
  const $app = document.getElementById('app');
  { const rc = Element.prototype.replaceChildren; Element.prototype.replaceChildren = function (...k) { return rc.apply(this, k.flat(Infinity).filter((x) => x != null && x !== false)); }; }
  const CONTATO = (window.NEO_CONFIG && window.NEO_CONFIG.contato) || {};

  // ---------- utilidades ----------
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) el.append(f.nodeType ? f : document.createTextNode(String(f)));
    return el;
  }
  // só abre links de foto do Google Drive
  const linkSeguro = (u) => (/^https:\/\/(drive|docs)\.google\.com\//.test(String(u || '')) ? String(u) : '');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const agoraISO = () => new Date().toISOString();
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  function carimbo(d = new Date()) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}`; }
  function dataBR(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function numBR(v) { return v == null || v === '' ? '' : String(v).replace('.', ','); }
  function paraNum(s) { if (s == null) return null; const t = String(s).trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return isNaN(n) ? null : n; }
  function toast(msg, ms = 2600) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); }
  function modal(titulo, corpo, botoes) {
    return new Promise((res) => {
      const fechar = (v) => { veu.remove(); res(v); };
      const veu = h('div', { class: 'veu', onclick: (e) => { if (e.target === veu) fechar(null); } },
        h('div', { class: 'folha' }, titulo ? h('h3', null, titulo) : null, corpo,
          botoes && botoes.length ? h('div', { class: 'linha-btn', style: 'margin-top:14px' }, botoes.map((b) => h('button', { class: 'btn ' + (b.classe || ''), onclick: () => fechar(b.valor) }, b.texto))) : null));
      document.body.append(veu);
    });
  }
  const confirmar = (titulo, texto, ok = 'Confirmar', classe = '') => modal(titulo, h('p', null, texto), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: ok, classe, valor: true }]);
  function baixar(nome, dados, tipo) { const b = dados instanceof Blob ? dados : new Blob([dados], { type: tipo }); const a = h('a', { href: URL.createObjectURL(b), download: nome }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  const ICONES = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', voltar: '<path d="M15 5l-7 7 7 7"/>', mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    busca: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', mais: '<path d="M12 5v14M5 12h14"/>',
    etapas: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', esq: '<path d="M15 5l-7 7 7 7"/>', dir: '<path d="M9 5l7 7-7 7"/>',
  };
  function ico(n) { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg>`; return s; }

  function topo(titulo, sub, esquerda, direita) {
    return h('header', { class: 'topo' }, esquerda, h('h1', null, titulo, sub ? h('small', null, sub) : null), direita);
  }

  // ---------- GPS ----------
  const Gps = {
    id: null, ouvintes: new Set(),
    iniciar() {
      if (this.id != null || !navigator.geolocation) return;
      this.id = navigator.geolocation.watchPosition((p) => {
        S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, prec: Math.round(p.coords.accuracy * 10) / 10, t: Date.now() };
        this.ouvintes.forEach((f) => f(S.pos));
      }, (e) => { S.posErro = e.message; this.ouvintes.forEach((f) => f(null, e)); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    },
    // pede uma leitura nova na hora (o watch só avisa quando a posição muda)
    agora() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((p) => {
        S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, prec: Math.round(p.coords.accuracy * 10) / 10, t: Date.now() };
        this.ouvintes.forEach((f) => f(S.pos));
      }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    },
  };
  function classeGps(prec) { return prec == null ? 'ruim' : prec <= 5 ? 'bom' : prec <= 15 ? 'medio' : 'ruim'; }

  // ---------- Sessão e projeto ----------
  async function iniciar() {
    const servidor = (await Store.get('servidor')) ?? window.NEO_CONFIG.servidor;
    Api.configurar(servidor);
    S.sessao = await Store.get('sessao');
    // sessão de outro servidor (ex.: da demonstração) não vale mais
    if (S.sessao && (S.sessao.servidor || '') !== (servidor || '')) { S.sessao = null; await Store.del('sessao'); }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('hashchange', rota);
    window.addEventListener('online', () => { atualizarSync(); sincronizar(); });
    window.addEventListener('offline', atualizarSync);
    setInterval(() => sincronizar(true), 60000);
    setInterval(() => verificarAtualizacao(), 30 * 60000); verificarAtualizacao();
    Api.aoExpirar(() => { if (!S.expirada) { S.expirada = true; toast('Sua sessão expirou. Entre de novo para continuar enviando. Nada do aparelho foi perdido.', 6000); atualizarSync(); } });
    if (S.sessao) {
      Api.credenciais(credDe(S.sessao));
      if (S.sessao.usuario.perfil === 'campo') S.sessao.usuario.perfil = 'coletor';
      if (S.sessao.usuario.perfil !== 'cliente') await abrirProjeto(S.sessao.projetoAtual); else await abrirProjetoCliente(S.sessao.projetoAtual);
      if (S.sessao.usuario.perfil !== 'cliente') Gps.iniciar();
      atualizarSessao();
    }
    rota(); sincronizar(true);
  }

  // ---------- Atualização do app ----------
  const maiorVersao = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  async function verificarAtualizacao(avisar) {
    if (!navigator.onLine || location.protocol === 'file:') { if (avisar) toast('Sem internet para verificar.'); return null; }
    try {
      const j = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json();
      S.novaVersao = maiorVersao(j.versao, VERSAO) ? j : null;
      if (avisar && !S.novaVersao) toast('O app já está na versão mais nova (' + VERSAO + ').');
      if (S.novaVersao && (location.hash === '' || location.hash === '#inicio')) pintarAvisoVersao();
      return S.novaVersao;
    } catch (e) { if (avisar) toast('Não foi possível verificar agora.'); return null; }
  }
  async function atualizarApp() {
    const pend = (await Store.todosRegistros()).filter((r) => r.__base).length;
    if (pend && !(await confirmar('Atualizar o app', 'Há uma edição não concluída. Ela continua guardada no aparelho e você termina depois de atualizar.', 'Atualizar'))) return;
    toast('Atualizando...', 5000);
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) { /* segue */ }
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* segue */ }
    location.reload();
  }
  function pintarAvisoVersao() {
    const el = document.getElementById('aviso-versao'); if (!el) return;
    const v = S.novaVersao;
    el.replaceChildren(v ? h('div', { class: 'faixa-versao' }, h('div', null, h('b', null, `Nova versão ${v.versao} disponível`), v.notas && v.notas.length ? h('ul', null, v.notas.slice(0, 4).map((n) => h('li', null, n))) : null, h('small', null, 'Seus registros ficam guardados. Leva poucos segundos.')), h('button', { class: 'btn peq', onclick: atualizarApp }, 'Atualizar agora')) : '');
  }
  const credDe = (ss) => (ss.t ? { u: ss.u, t: ss.t } : { u: ss.u, s: ss.s });
  const perfil = () => (S.sessao ? S.sessao.usuario.perfil : '');
  const ehCoord = () => ['admin', 'revisor'].includes(perfil());
  // confere no servidor se o perfil e os projetos mudaram; servidor antigo: troca a senha guardada por uma sessão
  async function atualizarSessao() {
    if (Api.demo || !navigator.onLine || !S.sessao) return;
    try {
      if (!S.sessao.t && S.sessao.s) {
        const r = await Api.b.login(S.sessao.u, S.sessao.s, aparelho());
        if (r.token) { S.sessao.t = r.token; delete S.sessao.s; S.sessao.versaoScript = r.versaoScript; Api.credenciais(credDe(S.sessao)); }
        if (r.usuario.termo_aceito_em === undefined) r.usuario.termo_aceito_em = S.sessao.usuario.termo_aceito_em; // servidor antigo
        Object.assign(S.sessao, { usuario: r.usuario, projetos: r.projetos }); await Store.set('sessao', S.sessao); return;
      }
      const r = await Api.b.sessao(); if (!r) return;
      Object.assign(S.sessao, { usuario: r.usuario, projetos: r.projetos, versaoScript: r.versaoScript }); await Store.set('sessao', S.sessao);
    } catch (e) { /* sem conexão ou sessão expirada: o aviso já aparece */ }
  }
  const aparelho = () => { const u = navigator.userAgent; const m = u.match(/Android [\d.]+;[^)]*|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+/); return (m ? m[0] : u).slice(0, 100); };
  async function abrirProjetoCliente(id) {
    const p = S.sessao.projetos.find((x) => x.id === id) || S.sessao.projetos[0];
    if (!p) throw new Error('Nenhum projeto liberado para este usuário.');
    S.projeto = p; S.sessao.projetoAtual = p.id; await Store.set('sessao', S.sessao);
    S.form = await carregarForm(p.formulario);
  }
  async function abrirProjeto(id) {
    const p = S.sessao.projetos.find((x) => x.id === id) || S.sessao.projetos[0];
    if (!p) { if (S.sessao.usuario.perfil === 'admin') { S.projeto = null; S.form = null; return; } throw new Error('Nenhum projeto liberado para este usuário.'); }
    S.projeto = p; S.sessao.projetoAtual = p.id; await Store.set('sessao', S.sessao);
    S.form = await carregarForm(p.formulario);
    await Promise.race([sincronizarSequencia(), new Promise((r) => setTimeout(r, 8000))]);
  }
  async function carregarForm(id, forcarCache) {
    const chave = 'form:' + id;
    if (!forcarCache && navigator.onLine) {
      try { const f = await Api.b.formulario(id); if (f) { await Store.set(chave, f); return f; } } catch (e) { console.warn(e); }
    }
    const f = await Store.get(chave);
    if (!f) throw new Error('Formulário indisponível sem internet. Conecte e tente de novo.');
    return f;
  }

  function rota() {
    document.querySelectorAll('.veu').forEach((v) => v.remove());
    if (S.reg && !location.hash.startsWith('#form/' + S.reg.uuid)) { const r = S.reg; clearTimeout(salvarTimer); Store.salvarRegistro(r); Gps.ouvintes.forEach((f) => f.__form && Gps.ouvintes.delete(f)); S.reg = null; }
    if (!S.sessao) return telaLogin();
    if (!S.sessao.usuario.termo_aceito_em) return telaTermo(true);
    const [r, a, b] = location.hash.replace(/^#/, '').split('/');
    const pf = perfil();
    if (r === 'sobre') return telaSobre();
    if (r === 'admin' && pf === 'admin') return telaAdmin(a);
    if (!S.projeto) { if (pf === 'admin') return telaAdmin('projetos'); return telaLogin(); }
    if (r === 'painel' && pf !== 'coletor') return telaPainel();
    if (r === 'relatorio' && pf !== 'coletor') return telaRelatorio();
    if (r === 'medicao' && pf !== 'coletor') return telaMedicao();
    if (r === 'mapa') return telaMapa();
    if (r === 'ordens') return telaOrdens();
    if (r === 'os' && a) return telaOS(decodeURIComponent(a));
    if (r === 'os-nova') return telaNovaOS(a ? decodeURIComponent(a) : null);
    if (r === 'validacao' && ehCoord()) return telaValidacao();
    if (r === 'ficha' && a && pf !== 'coletor') return telaFichaServidor(decodeURIComponent(a));
    if (pf === 'cliente') return telaPainel();
    if (r === 'form' && a) return telaForm(a, b);
    return telaInicio();
  }
  const ir = (h_) => { if (location.hash === h_) rota(); else location.hash = h_; };

  // ---------- Login ----------
  function telaLogin() {
    const u = h('input', { class: 'entrada', autocomplete: 'username', autocapitalize: 'none', placeholder: 'Usuário' });
    const s = h('input', { class: 'entrada', type: 'password', autocomplete: 'current-password', placeholder: 'Senha' });
    const erro = h('div', { class: 'aviso oculto' });
    const btn = h('button', { class: 'btn cheio', onclick: entrar }, 'Entrar');
    async function entrar() {
      erro.classList.add('oculto'); btn.disabled = true; btn.textContent = 'Entrando...';
      try {
        const usuario = u.value.trim().toLowerCase(), senha = s.value.trim();
        const r = await Api.b.login(usuario, senha, aparelho());
        if (r.usuario.perfil === 'campo') r.usuario.perfil = 'coletor';
        if (r.usuario.termo_aceito_em === undefined) r.usuario.termo_aceito_em = (await Store.get('termo:' + usuario)) || ''; // servidor antigo: aceite guardado no aparelho
        if (!r.projetos.length && r.usuario.perfil !== 'admin') throw new Error('Este usuário não tem projeto liberado.');
        S.sessao = { u: usuario, t: r.token || '', usuario: r.usuario, projetos: r.projetos, projetoAtual: r.projetos.length ? r.projetos[0].id : null, servidor: Api.servidor || '', versaoScript: r.versaoScript || '' };
        if (!r.token) S.sessao.s = senha; // servidor antigo ou demonstração: sem sessão, guarda a senha como antes
        Api.credenciais(credDe(S.sessao)); S.expirada = false;
        await Store.set('sessao', S.sessao);
        if (r.usuario.perfil === 'cliente') await abrirProjetoCliente(S.sessao.projetoAtual); else { await abrirProjeto(S.sessao.projetoAtual); Gps.iniciar(); }
        ir(r.usuario.perfil === 'cliente' ? '#painel' : '#inicio'); rota();
      } catch (e) {
        erro.textContent = navigator.onLine ? e.message : 'Sem internet. O primeiro acesso precisa de conexão.'; erro.classList.remove('oculto');
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    }
    s.addEventListener('keydown', (e) => e.key === 'Enter' && entrar());
    if (S.ultimoUsuario) u.value = S.ultimoUsuario;
    $app.replaceChildren(h('div', { class: 'tela-login' }, h('div', { class: 'login' },
      h('div', { class: 'marca' }, h('img', { src: 'icons/logo-basica.png', alt: 'Neofloresta Serviços Ecossistêmicos' }), h('span', null, 'Inventário de arborização urbana')),
      S.expirada ? h('div', { class: 'aviso' }, 'Sua sessão expirou. Entre de novo: os registros guardados no aparelho continuam salvos e serão enviados.') : null,
      Api.demo ? h('div', { class: 'info' }, 'Modo demonstração: os dados ficam só neste aparelho. Usuários de teste (senha 1234): ', h('b', null, 'admin'), ', ', h('b', null, 'revisor'), ' e ', h('b', null, 'prefeitura'), '. Equipes de campo: ', h('b', null, 'equipe1 / 1111'), ' e ', h('b', null, 'equipe2 / 2222'), '.') : null,
      h('div', { class: 'campo' }, u), h('div', { class: 'campo' }, s), erro, btn,
      Api.demo || /[?&]config/.test(location.search) ? h('button', { class: 'btn linha cheio', style: 'margin-top:12px', onclick: configurarServidor }, 'Configurar servidor') : null,
      h('p', { class: 'dica', style: 'text-align:center;margin-top:18px' }, 'Versão ' + VERSAO, ' · ', h('a', { href: '#', class: 'link-termo', onclick: (e) => { e.preventDefault(); verTermo(); } }, 'Termo de uso e privacidade'))), h('div', { class: 'padronagem', 'aria-hidden': 'true' })));
  }

  async function configurarServidor() {
    const inp = h('input', { class: 'entrada', value: Api.servidor || '', placeholder: 'https://script.google.com/macros/s/.../exec' });
    const r = await modal('Servidor', h('div', null, h('p', null, 'Endereço da ponte Google (Apps Script). Deixe vazio para usar o modo demonstração.'), inp),
      [{ texto: 'Cancelar', classe: 'sec', valor: null }, { texto: 'Salvar', valor: 'ok' }]);
    if (r !== 'ok') return;
    const v = inp.value.trim();
    await Store.set('servidor', v); Api.configurar(v); toast(v ? 'Servidor configurado.' : 'Modo demonstração.');
    if (S.sessao) await sair(true); else telaLogin();
  }

  async function sair(semPerguntar) {
    const pend = (await Store.todosRegistros()).filter((r) => r.status === 'pendente').length;
    if (!semPerguntar && pend && !(await confirmar('Sair', `Há ${pend} registro(s) ainda não enviados. Eles continuam guardados neste aparelho e serão enviados no próximo acesso.`, 'Sair mesmo assim'))) return;
    try { await Api.b.sair(); } catch (e) { /* sem conexão: a sessão expira sozinha */ }
    S.ultimoUsuario = S.sessao && S.sessao.u; S.sessao = null; S.projeto = null; S.linhas = {}; await Store.del('sessao'); location.hash = ''; telaLogin();
  }

  // ---------- Sincronização ----------
  const $sync = () => document.querySelector('.sync');
  async function pendentes() { return (await Store.todosRegistros()).filter((r) => r.status === 'pendente' && !r.__base); }
  async function atualizarSync() {
    const el = $sync(); if (!el) return;
    const n = (await pendentes()).length + (await nFilaOS());
    el.className = 'sync' + (!navigator.onLine ? ' off' : n ? ' pend' : '');
    if (S.expirada) { el.className = 'sync pend'; el.textContent = 'Entrar de novo'; return; }
    el.textContent = S.sincronizando ? 'Enviando...' : !navigator.onLine ? (n ? `Sem rede · ${n}` : 'Sem rede') : n ? `${n} a enviar` : (Api.demo ? 'Demonstração' : 'Tudo enviado');
  }
  async function sincronizar(silencioso) {
    if (S.expirada && !silencioso) return reentrar();
    if (S.sincronizando || !S.sessao || S.expirada || perfil() === 'cliente') return;
    if (!navigator.onLine) { if (!silencioso) toast('Sem internet. Os dados ficam guardados e serão enviados depois.'); return atualizarSync(); }
    S.sincronizando = true; // marcado antes de qualquer espera: nunca roda duas vezes ao mesmo tempo
    try { await enviarPendentes(silencioso); if (!S.expirada) await enviarFilaOS(silencioso); } finally { S.sincronizando = false; await atualizarSync(); }
    if (S.expirada) return;
    await atualizarSituacao();
    if (location.hash === '' || location.hash === '#inicio') listarRegistros();
  }
  // recusas definitivas do servidor (não adianta tentar de novo)
  const recusaFinal = (m) => /travado|validado pela coordena|outra equipe|perfil n[aã]o tem acesso/i.test(m || '');
  async function enderecoDe(lat, lon) {
    try {
      const espera = 1100 - (Date.now() - (S.ultimoGeo || 0)); if (espera > 0) await new Promise((r) => setTimeout(r, espera)); S.ultimoGeo = Date.now();
      const c = new AbortController(); setTimeout(() => c.abort(), 3000);
      const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lon}`, { signal: c.signal, headers: { 'Accept-Language': 'pt-BR' } })).json();
      const a = j.address || {}; const rua = a.road || a.pedestrian || a.footway || '';
      if (!rua && !a.suburb && !a.neighbourhood) return null;
      return { endereco: [rua, a.house_number].filter(Boolean).join(', '), bairro: a.suburb || a.neighbourhood || a.quarter || a.city_district || '' };
    } catch (e) { S.geocodificados = 99; return null; } // falhou: não tenta mais nesta rodada
  }
  async function enviarPendentes(silencioso) {
    S.geocodificados = 0;
    const lista = await pendentes(); if (!lista.length) { if (!silencioso) toast('Tudo enviado.'); return; }
    atualizarSync();
    let ok = 0, falhas = 0, ultimoErro = '', aviso = '';
    for (const r0 of lista) {
      const uid = r0.uuid;
      try {
        let r = await Store.registro(uid); if (!r || r.status !== 'pendente' || r.__base) continue;
        const p = S.sessao.projetos.find((x) => x.id === r.projeto);
        const form = S.projeto && r.projeto === S.projeto.id ? S.form : await carregarForm(p ? p.formulario : '', true);
        for (const [campo, f] of Object.entries(r.fotos || {})) {
          if (!f || f.enviado) continue;
          const blob = await Store.foto(f.chave);
          let res = null; if (blob) res = await Api.b.foto(r.projeto, f.nome.replace(/^DCIM\//, ''), blob);
          const cur = await Store.registro(uid); // grava só se a foto ainda é a mesma no registro
          if (cur && cur.fotos && cur.fotos[campo] && cur.fotos[campo].chave === f.chave) { Object.assign(cur.fotos[campo], { enviado: true, url: (res && res.url) || '', idDrive: (res && res.id) || '' }); await Store.salvarRegistro(cur); }
        }
        r = await Store.registro(uid); if (!r || r.status !== 'pendente' || r.__base) continue;
        if (r.lat != null && !r.endereco && S.geocodificados < 20 && !Api.demo) {
          S.geocodificados++; const e = await enderecoDe(r.lat, r.lon);
          if (e) { const cur = await Store.registro(uid); if (cur && cur.atualizado_em === r.atualizado_em) { Object.assign(cur, e); await Store.salvarRegistro(cur); r = cur; } }
        }
        const res = await Api.b.registro(r.projeto, Api.achatar(r, form));
        const atual = await Store.registro(uid);
        if (atual && atual.atualizado_em === r.atualizado_em && !atual.__base) {
          atual.status = 'enviado'; delete atual.erroSync;
          if (res && res.validacao) atual.validacao = res.validacao;
          if (res && res.ignorado) { atual.conflito = 'A coordenação alterou este registro depois desta versão. A versão do aparelho não foi aplicada.'; aviso = atual.conflito; } else delete atual.conflito;
          await Store.salvarRegistro(atual);
        }
        ok++;
      } catch (e) {
        if (e.sessao) { ultimoErro = e.message; break; }
        falhas++; ultimoErro = e.message;
        const cur = await Store.registro(uid);
        if (cur && !cur.__base) { cur.erroSync = e.message; if (recusaFinal(e.message)) cur.status = 'recusado'; await Store.salvarRegistro(cur); }
      }
    }
    if (S.expirada) return;
    if (!silencioso || falhas || aviso) toast(falhas ? `Enviados ${ok}. Falharam ${falhas}: ${ultimoErro}` : aviso || `${ok} registro(s) enviados.`, falhas || aviso ? 5000 : 2600);
  }
  // traz do servidor como a coordenação avaliou os registros deste aparelho (validado, devolvido e motivo)
  async function atualizarSituacao() {
    if (!S.projeto || !navigator.onLine || S.expirada || !['coletor', 'revisor', 'admin'].includes(perfil())) return;
    try {
      const itens = await Api.b.situacaoMeus(S.projeto.id); const m = new Map(itens.map((x) => [x.uuid, x]));
      let mudou = false;
      for (const r of await Store.registros(S.projeto.id)) {
        const it = m.get(r.uuid); const v = it ? it.validacao : (r.validacao && r.validacao !== 'Corrigido' ? 'Pendente' : r.validacao);
        const o = it ? it.obs || '' : r.validacao_obs || '';
        if ((r.validacao || '') !== (v || '') || (r.validacao_obs || '') !== o) { r.validacao = v; r.validacao_obs = o; await Store.salvarRegistro(r); mudou = true; }
      }
      if (mudou && (location.hash === '' || location.hash === '#inicio')) listarRegistros();
    } catch (e) { /* servidor antigo ou sem conexão */ }
  }
  async function reentrar() {
    if (!(await confirmar('Entrar de novo', 'Sua sessão expirou. Entre com usuário e senha para continuar enviando. Os registros guardados no aparelho continuam salvos.', 'Entrar'))) return;
    S.ultimoUsuario = S.sessao && S.sessao.u; S.sessao = null; await Store.del('sessao'); location.hash = ''; telaLogin();
  }

  // ---------- Início ----------
  function camposCodigo(form) {
    const auto = form.campos.filter((c) => c.auto === 'codigo'); if (auto.length) return auto;
    return form.campos.filter((c) => c.incremento || (/codigo|coletor|plaqueta|numero|placa/i.test(norm(c.nome) + ' ' + norm(c.rotulo)) && ['text', 'number'].includes(c.tipo)));
  }
  function campoCodigo(form) { return camposCodigo(form)[0]; }
  function codigoDe(form, vals) { const c = camposCodigo(form).find((k) => vals[k.nome] != null && vals[k.nome] !== ''); return c ? `${c.rotulo}: ${vals[c.nome]}` : ''; }
  function campoEspecie(form) { return form.campos.find((c) => c.tipo === 'species'); }

  async function telaInicio() {
    const menu = h('button', { class: 'ic', onclick: abrirMenu, 'aria-label': 'Menu' }, ico('menu'));
    const sync = h('button', { class: 'sync', onclick: () => sincronizar() }, '...');
    const busca = h('input', { class: 'busca', placeholder: 'Buscar código ou espécie', oninput: () => listarRegistros(busca.value) });
    $app.replaceChildren(
      topo(S.projeto.nome, S.projeto.equipe || S.sessao.usuario.nome, menu, h('div', { class: 'topo-dir' }, h('button', { class: 'ic', onclick: () => ir('#mapa'), 'aria-label': 'Mapa' }, ico('mapa')), sync)),
      h('main', null,
        S.expirada ? h('div', { class: 'aviso' }, 'Sua sessão expirou. ', h('button', { class: 'btn peq', onclick: reentrar }, 'Entrar de novo'), ' Os registros continuam guardados aqui.') : null,
        h('button', { class: 'btn nova canto', onclick: novoRegistro }, ico('mais'), 'Nova árvore'),
        h('div', { id: 'aviso-versao' }),
        h('div', { id: 'devolvidos' }),
        h('div', { id: 'os-equipe' }),
        h('div', { class: 'resumo', id: 'stats' }),
        h('div', { class: 'busca-box' }, ico('busca'), busca),
        h('div', { id: 'lista', class: 'lista' })));
    atualizarSync(); listarRegistros(); pintarAvisoVersao(); pintarOSEquipe();
  }

  async function pintarOSEquipe() {
    const el = document.getElementById('os-equipe'); if (!el || perfil() !== 'coletor') return;
    try {
      const d = await carregarOS(false); if (!document.body.contains(el)) return;
      const f = d.ordens.filter((o) => ehMinhaOS(o) && ['Aberta', 'Em execução'].includes(o.status)); const at = f.filter(atrasada).length;
      el.replaceChildren(f.length ? h('button', { class: 'faixa-os', onclick: () => { S.filtroOS = 'fazer'; ir('#ordens'); } }, h('b', null, `${f.length} ordem${f.length > 1 ? 'ns' : ''} de serviço para a sua equipe`), h('span', null, at ? `${at} atrasada${at > 1 ? 's' : ''}. Toque para ver` : 'Toque para ver e registrar a execução')) : '');
    } catch (e) { /* sem ordens */ }
  }
  const urls = new Map();
  async function miniatura(r) {
    const f = Object.values(r.fotos || {}).find((x) => x && x.chave); if (!f) return null;
    if (urls.has(f.chave)) return urls.get(f.chave);
    const b = await Store.foto(f.chave); if (!b) return null;
    const u = URL.createObjectURL(b); urls.set(f.chave, u); return u;
  }

  async function listarRegistros(filtro) {
    const el = document.getElementById('lista'); if (!el) return;
    const todos = (await Store.registros(S.projeto.id)).sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));
    const hoje = new Date().toDateString();
    const st = document.getElementById('stats');
    const nPend = todos.filter((r) => r.status === 'pendente').length;
    const nRasc = todos.filter((r) => r.status === 'rascunho').length;
    if (st) st.replaceChildren(h('span', null, h('b', null, todos.filter((r) => r.status !== 'rascunho' && new Date(r.criado_em).toDateString() === hoje).length), ' hoje'),
      h('span', null, h('b', null, todos.filter((r) => r.status !== 'rascunho').length), ' concluídas'),
      nRasc ? h('span', null, h('b', null, nRasc), nRasc > 1 ? ' rascunhos' : ' rascunho') : null,
      h('span', { class: nPend ? 'pend' : '' }, h('b', null, nPend), ' a enviar'));
    const cc = campoCodigo(S.form), ce = campoEspecie(S.form);
    const f = norm(filtro);
    const dev = todos.filter((r) => r.validacao === 'Devolvido');
    const box = document.getElementById('devolvidos');
    if (box) box.replaceChildren(dev.length ? h('button', { class: 'faixa-dev', onclick: () => { const b = document.querySelector('.busca'); if (b) { b.value = 'devolvido'; listarRegistros('devolvido'); } } }, h('b', null, `${dev.length} registro${dev.length > 1 ? 's' : ''} devolvido${dev.length > 1 ? 's' : ''} pela coordenação`), h('span', null, 'Toque para ver e corrigir')) : '');
    const lista = f === 'devolvido' ? dev : todos.filter((r) => !f || norm(camposCodigo(S.form).map((k) => r.valores[k.nome]).join(' ') + ' ' + (ce && r.valores[ce.nome])).includes(f));
    if (!lista.length) return el.replaceChildren(h('div', { class: 'vazio-lista' }, filtro ? 'Nada encontrado.' : 'Nenhuma árvore cadastrada ainda neste aparelho.'));
    const itens = [];
    for (const r of lista.slice(0, 300)) {
      const img = await miniatura(r);
      const rotSt = r.status === 'enviado' && r.validacao && r.validacao !== 'Pendente' ? r.validacao : { rascunho: 'Rascunho', pendente: r.erroSync ? 'Erro' : 'A enviar', enviado: 'Enviado', recusado: 'Recusado' }[r.status];
      const clsSt = r.status === 'enviado' && r.validacao && r.validacao !== 'Pendente' ? 'v-' + norm(r.validacao) : (r.erroSync && r.status === 'pendente') || r.status === 'recusado' ? 'erro' : r.status;
      itens.push(h('button', { class: 'reg', onclick: () => ir('#form/' + r.uuid) },
        img ? h('img', { src: img, alt: '' }) : h('div', { class: 'sem' }),
        h('div', { class: 'tx' }, h('b', null, (cc && r.valores[cc.nome]) || codigoDe(S.form, r.valores) || 'Sem código'),
          h('i', null, (ce && r.valores[ce.nome]) || (() => { const ct = S.form.campos.find((k) => k.tipo === 'choice' && /categoria/i.test(norm(k.nome))); const t = ct && rotuloOpcao(ct, r.valores[ct.nome]); return t ? t.replace(/\s*\(.*\)/, '') : 'Espécie não informada'; })()), h('small', null, `${dataBR(r.atualizado_em)} · ${r.equipe || ''}`),
          r.validacao === 'Devolvido' && r.validacao_obs ? h('small', { class: 'motivo' }, 'Motivo: ' + r.validacao_obs) : null),
        h('span', { class: 'st ' + clsSt }, rotSt)));
    }
    el.replaceChildren(...itens);
  }

  function abrirMenu() {
    const it = (txt, fn) => h('button', { class: 'menu-it', onclick: () => { veu.remove(); fn(); } }, txt);
    const veu = h('div', { class: 'veu', onclick: (e) => e.target === veu && veu.remove() }, h('div', { class: 'folha' },
      h('img', { class: 'folha-marca', src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }),
      h('h3', null, S.sessao.usuario.nome, h('small', { class: 'perfil-tag' }, ROT_PERFIL[perfil()] || '')),
      S.sessao.projetos.length > 1 ? it('Trocar projeto', trocarProjeto) : null,
      it('Mapa das árvores', () => ir('#mapa')),
      it('Ordens de serviço', () => ir('#ordens')),
      perfil() !== 'cliente' ? it('Enviar agora', () => sincronizar()) : null,
      perfil() !== 'coletor' ? it('Painel do projeto', () => ir('#painel')) : null,
      ehCoord() ? it('Validação dos registros', () => ir('#validacao')) : null,
      perfil() === 'admin' ? it('Coordenação (exportar, equipes, formulários, segurança)', () => ir('#admin/exportar')) : null,
      perfil() === 'admin' ? it('Servidor', configurarServidor) : null,
      !Api.demo || true ? it('Trocar minha senha', trocarSenha) : null,
      S.novaVersao ? it(`Atualizar para a versão ${S.novaVersao.versao}`, atualizarApp) : it('Verificar atualização', () => verificarAtualizacao(true)),
      it('Sobre, termo de uso e privacidade', () => ir('#sobre')),
      it('Sair', () => sair()),
      h('p', { class: 'dica', style: 'margin-top:12px' }, `Versão ${VERSAO}${Api.demo ? ' · demonstração' : ''}`)));
    document.body.append(veu);
  }
  const ROT_PERFIL = { admin: 'Coordenação', revisor: 'Revisão técnica', coletor: 'Equipe de campo', cliente: 'Cliente (consulta)' };
  async function trocarSenha() {
    const a = h('input', { class: 'entrada', type: 'password', autocomplete: 'current-password' });
    const n1 = h('input', { class: 'entrada', type: 'password', autocomplete: 'new-password' });
    const n2 = h('input', { class: 'entrada', type: 'password', autocomplete: 'new-password' });
    const ok = await modal('Trocar minha senha', h('div', null, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Senha atual'), a), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nova senha (mínimo 8 caracteres)'), n1), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Repita a nova senha'), n2)),
      [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Trocar senha', valor: true }]);
    if (!ok) return;
    if (n1.value !== n2.value) return toast('As duas senhas novas não conferem.');
    if (n1.value.trim().length < 8 && !Api.demo) return toast('A nova senha precisa ter pelo menos 8 caracteres.');
    try { await Api.b.trocarSenha(a.value, n1.value.trim()); if (S.sessao.s) { S.sessao.s = n1.value.trim(); Api.credenciais(credDe(S.sessao)); await Store.set('sessao', S.sessao); } toast('Senha alterada.'); } catch (e) { toast(e.message, 5000); }
  }
  async function trocarProjeto() {
    const r = await modal('Projeto', h('div', null, S.sessao.projetos.map((p) => h('button', { class: 'menu-it', onclick: () => { document.querySelector('.veu').remove(); escolher(p.id); } }, p.nome + (p.id === S.projeto.id ? ' ✓' : '')))), []);
    async function escolher(id) { try { if (perfil() === 'cliente') { await abrirProjetoCliente(id); ir('#painel'); rota(); } else { await abrirProjeto(id); ir('#inicio'); } } catch (e) { toast(e.message); } }
    return r;
  }

  // ---------- Registro ----------
  async function proximoIncremento(campo) {
    const regs = await Store.registros(S.projeto.id);
    let max = 0; for (const r of regs) { const n = parseInt(String(r.valores[campo] ?? '').replace(/\D+/g, ''), 10); if (!isNaN(n) && n > max) max = n; }
    return max ? String(max + 1) : '';
  }

  // Código automático: prefixo da equipe + sequência. Nunca repete entre equipes porque cada uma tem seu prefixo.
  function prefixoEquipe() {
    const p = S.projeto; if (p.equipeCodigo) return p.equipeCodigo.toUpperCase();
    const eq = String(p.equipe || S.sessao.u); const dig = eq.match(/\d+/);
    return dig ? 'E' + dig[0] : norm(eq).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || 'EQ';
  }
  function seqDe(cod, pre) { const m = String(cod || '').match(new RegExp('^' + pre + '-(\\d+)$')); return m ? parseInt(m[1], 10) : 0; }
  async function proximoCodigo(campo) {
    const pre = prefixoEquipe(); const chave = `seq:${S.projeto.id}:${pre}`;
    let max = Math.max((await Store.get(chave)) || 0, (await Store.get('srv' + chave)) || 0);
    for (const r of await Store.registros(S.projeto.id)) max = Math.max(max, seqDe(r.valores[campo], pre));
    await Store.set(chave, max + 1);
    return `${pre}-${String(max + 1).padStart(4, '0')}`;
  }
  async function sincronizarSequencia() {
    if (Api.demo || !navigator.onLine || !S.projeto || !S.form) return;
    const c = S.form.campos.find((x) => x.auto === 'codigo'); if (!c) return;
    try {
      const pre = prefixoEquipe(); let max = 0;
      const m = await Api.b.mapa(S.projeto.id, [c.nome]);
      for (const l of m.linhas) max = Math.max(max, seqDe(l[0], pre));
      await Store.set(`srvseq:${S.projeto.id}:${pre}`, max);
    } catch (e) { /* sem conexão: usa o que tem no aparelho */ }
  }

  async function novoRegistro() {
    const r = {
      uuid: uuid(), projeto: S.projeto.id, equipe: S.projeto.equipe || '', usuario: S.sessao.u,
      criado_em: agoraISO(), atualizado_em: agoraISO(), status: 'rascunho', valores: {}, fotos: {},
      lat: null, lon: null, prec: null, gpsAuto: true, mexido: false,
    };
    for (const c of S.form.campos) {
      if (c.agora) r.valores[c.nome] = agoraISO();
      else if (c.tipo === 'bool') r.valores[c.nome] = false;
      else if (c.expr && !c.calculado) { try { r.valores[c.nome] = Expr.evaluate(c.expr, () => null); } catch (e) { /* ignora */ } }
      if (c.incremento) r.valores[c.nome] = await proximoIncremento(c.nome);
      if (c.auto === 'codigo') r.valores[c.nome] = await proximoCodigo(c.nome);
      if (c.auto === 'coletor') r.valores[c.nome] = S.sessao.usuario.nome || S.sessao.u;
    }
    if (S.pos && Date.now() - S.pos.t < 20000) Object.assign(r, { lat: S.pos.lat, lon: S.pos.lon, prec: S.pos.prec });
    await Store.salvarRegistro(r);
    Gps.agora();
    S.aba = 0; S.tentou = false;
    ir('#form/' + r.uuid);
  }

  function recalcular(r) {
    for (let i = 0; i < 4; i++) for (const c of S.form.campos) if (c.calculado && c.expr) {
      try { r.valores[c.nome] = Expr.evaluate(c.expr, (k) => r.valores[k]); } catch (e) { r.valores[c.nome] = null; }
    }
  }
  const vazio = (c, v) => c.tipo === 'photo' ? !v : (v == null || v === '' || (c.tipo === 'multinumber' && !String(v).split(';').some((x) => x.trim())));
  function valorDe(r, c) { return c.tipo === 'photo' ? r.fotos[c.nome] : r.valores[c.nome]; }
  // Regras por classe: form.regras = [{ campo, por: { valor: { nomeCampo: 'obrig' | 'opcional' | 'oculto' } } }]
  function estadoCampos(form, vals) {
    const E = {};
    for (const c of form.campos) E[c.nome] = { obrig: !!c.obrigatorio, oculto: false };
    // Regras aplicadas na ordem: a de baixo prevalece sobre a de cima; "oculto" sempre prevalece.
    for (const rg of form.regras || []) {
      const v = vals[rg.campo]; if (v == null || v === '') continue;
      const cfg = (rg.por || {})[String(v)]; if (!cfg) continue;
      for (const [nome, est] of Object.entries(cfg)) {
        if (!E[nome] || nome === rg.campo || E[nome].oculto) continue;
        if (est === 'oculto') { E[nome].oculto = true; E[nome].obrig = false; }
        else if (est === 'obrig') E[nome].obrig = true;
        else if (est === 'opcional') E[nome].obrig = false;
      }
    }
    return E;
  }
  // Grupos de marcar obrigatórios: ao menos uma opção marcada (inclui "Ausente"). form.gruposObrig = ['Fiação aérea', ...]
  function camposDoGrupo(form, g) { const out = []; for (const a of form.abas) for (const x of a.campos) if (x.grupo === g) out.push(x.campo); return out; }
  function gruposFaltando(form, vals, E) {
    const out = [];
    for (const g of form.gruposObrig || []) {
      const cs = camposDoGrupo(form, g).filter((n) => E[n] && !E[n].oculto);
      if (cs.length && !cs.some((n) => vals[n] === true)) out.push(g);
    }
    return out;
  }
  function faltando(r) {
    const E = estadoCampos(S.form, r.valores);
    const f = S.form.campos.filter((c) => E[c.nome].obrig && !E[c.nome].oculto && vazio(c, valorDe(r, c)));
    for (const g of gruposFaltando(S.form, r.valores, E)) f.push({ nome: 'grupo:' + g, rotulo: g, grupo: g });
    for (const c of S.form.campos) {
      if (E[c.nome].oculto || (c.min == null && c.max == null)) continue;
      const v = r.valores[c.nome]; if (v == null || v === '' || typeof v !== 'number') continue;
      if (c.min != null && v < c.min) f.push({ nome: c.nome, limite: true, rotulo: `${c.rotulo}: ${c.limiteMsg || 'abaixo do mínimo de ' + numBR(c.min)}` });
      else if (c.max != null && v > c.max) f.push({ nome: c.nome, limite: true, rotulo: `${c.rotulo}: ${c.limiteMsgMax || 'acima do máximo de ' + numBR(c.max)}` });
    }
    return f;
  }

  // limites de plausibilidade (podem passar, mas pedem confirmação). O formulário pode trazer avisoMax/avisoMin por campo.
  const PLAUS = [[/altura/i, null, 40, 'm'], [/dap/i, null, 300, 'cm'], [/raio/i, 0.01, 20, 'm']];
  function conferirValores(r) {
    const E = estadoCampos(S.form, r.valores); const out = [];
    for (const c of S.form.campos) {
      if (E[c.nome].oculto || (c.tipo !== 'number' && c.tipo !== 'multinumber')) continue;
      const pl = PLAUS.find(([re]) => re.test(c.nome)); const mn = c.avisoMin ?? (pl && pl[1]), mx = c.avisoMax ?? (pl && pl[2]); const un = pl ? ' ' + pl[3] : '';
      const vs = c.tipo === 'multinumber' ? String(r.valores[c.nome] || '').split(';').map((x) => paraNum(x)).filter((x) => x != null) : [r.valores[c.nome]].filter((x) => typeof x === 'number');
      for (const v of vs) { if (mx != null && v > mx) out.push(`${c.rotulo}: ${numBR(v)}${un} é muito alto (acima de ${numBR(mx)}${un}).`); else if (mn != null && v < mn) out.push(`${c.rotulo}: ${numBR(v)}${un} é muito baixo.`); }
    }
    const ce = campoEspecie(S.form); const e = ce && !E[ce.nome].oculto && String(r.valores[ce.nome] || '').trim();
    if (e && (S.form.especies || []).length && !S.form.especies.some((x) => norm(x.cientifico) === norm(e))) out.push(`A espécie "${e}" não está na lista do projeto. Confira a grafia.`);
    return out;
  }
  let salvarTimer = null;
  function salvarRascunho() {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(async () => { const r = S.reg; if (!r) return; if (r.status === 'rascunho') r.atualizado_em = agoraISO(); await Store.salvarRegistro(r); atualizarSync(); }, 350);
  }

  // ---------- Formulário ----------
  async function telaForm(id, abaParam) {
    const r = await Store.registro(id);
    if (!r) { toast('Registro não encontrado.'); return ir('#inicio'); }
    if (r.projeto !== S.projeto.id) await abrirProjeto(r.projeto);
    if (r.status !== 'rascunho' && r.__base) { // edição interrompida (app fechado no meio)
      if (podeEditar(r).ok) S.editando.add(r.uuid);
      else { await descartarEdicao(r); toast('A edição não terminada foi descartada: o registro está travado.', 5000); }
    }
    if (r.status !== 'rascunho' && !S.editando.has(r.uuid)) return telaFichaLocal(r);
    if (!S.reg || S.reg.uuid !== r.uuid) { S.aba = 0; S.tentou = false; }
    S.reg = r; r.valores = r.valores || {}; r.fotos = r.fotos || {};
    if (r.status !== 'rascunho' && !r.__base) { r.__base = JSON.stringify(r.valores); r.__baseFotos = JSON.stringify(r.fotos); r.__basePos = JSON.stringify({ lat: r.lat, lon: r.lon, prec: r.prec, posManual: r.posManual }); await Store.salvarRegistro(r); }
    if (abaParam != null) S.aba = +abaParam || 0;
    const form = S.form; const abas = form.abas;
    S.aba = Math.min(Math.max(0, S.aba), abas.length - 1);

    const gpsBtn = h('button', { class: 'gps', onclick: abrirLocal });
    function pintarGps() {
      gpsBtn.className = 'gps ' + classeGps(r.prec);
      if (r.lat == null && !S.posErro) gpsBtn.className = 'gps medio';
      gpsBtn.textContent = r.lat == null ? (S.posErro ? 'Sem GPS' : 'Aguardando GPS') : `GPS ±${Math.round(r.prec)} m${r.posManual ? ' (ajustado)' : ''}`;
    }
    const ouvinte = (p) => {
      if (!p || !r.gpsAuto || r.posManual) return pintarGps();
      if (r.prec == null || p.prec <= r.prec + 0.5) { Object.assign(r, { lat: p.lat, lon: p.lon, prec: p.prec }); salvarRascunho(); }
      pintarGps();
    };
    Gps.ouvintes.forEach((f) => f.__form && Gps.ouvintes.delete(f)); ouvinte.__form = true; Gps.ouvintes.add(ouvinte);
    pintarGps();

    const cc = campoCodigo(form);
    const voltar = h('button', { class: 'ic', onclick: sairForm, 'aria-label': 'Voltar' }, ico('voltar'));
    const barraAbas = h('nav', { class: 'prog' });
    const barraPend = h('div', { class: 'barra-pend oculto', role: 'alert' });
    const conteudo = h('main');
    let E = estadoCampos(form, r.valores);
    const camposRegra = new Set((form.regras || []).map((x) => x.campo));
    const abaVisivel = (a) => a.campos.some((x) => { const c = form.campos.find((f) => f.nome === x.campo); return c && c.tipo !== 'hidden' && !E[c.nome].oculto; });
    const vizinha = (i, passo) => { for (let k = i + passo; k >= 0 && k < abas.length; k += passo) if (abaVisivel(abas[k])) return k; return -1; };
    const btAnt = h('button', { class: 'btn sec quad', onclick: () => irAba(vizinha(S.aba, -1)), 'aria-label': 'Etapa anterior' }, ico('esq'));
    const btProx = h('button', { class: 'btn prox', onclick: () => { const k = vizinha(S.aba, 1); if (k >= 0) irAba(k); else concluir(); } });
    $app.replaceChildren(topo(r.status === 'rascunho' && !r.mexido ? 'Nova árvore' : (codigoDe(form, r.valores) || 'Árvore'), S.projeto.nome, voltar, gpsBtn), barraAbas, conteudo, h('footer', { class: 'rodape' }, btAnt, btProx));

    const calcEls = new Map();
    function estadoAba(a) {
      const cs = a.campos.map((x) => form.campos.find((c) => c.nome === x.campo)).filter((c) => c && c.tipo !== 'hidden' && !c.calculado && c.tipo !== 'bool' && !E[c.nome].oculto);
      const gFalta = gruposFaltando(form, r.valores, E).filter((g) => a.campos.some((x) => x.grupo === g));
      if (S.tentou && (gFalta.length || cs.some((c) => E[c.nome].obrig && vazio(c, valorDe(r, c))))) return 'falta';
      const n = cs.filter((c) => !vazio(c, valorDe(r, c))).length;
      if (!cs.length) return a.campos.some((x) => r.valores[x.campo] === true) ? 'cheio' : '';
      return n === cs.length ? 'cheio' : n ? 'meio' : '';
    }
    // pendências na ordem do formulário (etapa por etapa, campo por campo)
    function pendOrdenadas() {
      const f = faltando(r); const pos = (c) => { for (let i = 0; i < abas.length; i++) { const j = abas[i].campos.findIndex((x) => x.campo === c.nome || (c.grupo && x.grupo === c.grupo)); if (j >= 0) return [i, j]; } return [999, 0]; };
      return f.map((c) => ({ c, p: pos(c) })).sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]).map((x) => ({ c: x.c, aba: x.p[0] }));
    }
    // leva direto ao campo que falta: abre a etapa, rola até ele, marca em vermelho e põe o cursor
    function irPendente(k) {
      const lista = pendOrdenadas(); if (!lista.length) return atualizarPend();
      const it = lista[((k % lista.length) + lista.length) % lista.length]; S.pendAtual = it.c.nome;
      if (it.aba !== S.aba && it.aba < abas.length) { S.aba = it.aba; history.replaceState(null, '', '#form/' + r.uuid + '/' + it.aba); render(); } else render();
      const el = it.c.grupo ? conteudo.querySelector(`[data-grupo="${CSS.escape(it.c.grupo)}"]`) : conteudo.querySelector(`.campo[data-campo="${CSS.escape(it.c.nome)}"]`) || conteudo.querySelector(`[data-campo="${CSS.escape(it.c.nome)}"]`);
      if (el) {
        el.classList.add('falta', 'destaque'); setTimeout(() => el.classList.remove('destaque'), 1600);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const inp = el.querySelector('input:not([type=file]), textarea'); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
      }
    }
    function atualizarPend() {
      if (!S.tentou) return barraPend.classList.add('oculto');
      const lista = pendOrdenadas(); barraPend.dataset.itens = JSON.stringify(lista.map((x) => x.c.rotulo));
      if (!lista.length) { barraPend.replaceChildren(h('span', null, 'Tudo preenchido. Pode concluir.'), h('button', { class: 'btn peq', onclick: concluir }, ico('check'), 'Concluir')); barraPend.className = 'barra-pend ok'; return; }
      const prox = lista.find((x) => x.aba === S.aba) || lista[0];
      barraPend.className = 'barra-pend';
      barraPend.replaceChildren(h('span', null, h('b', null, lista.length === 1 ? 'Falta 1 item' : `Faltam ${lista.length} itens`), ': ', prox.c.rotulo),
        h('button', { class: 'btn peq', onclick: () => irPendente(lista.indexOf(prox)) }, 'Ir para o campo'));
    }
    function pintarAbas() {
      atualizarPend();
      const vis = abas.map((x, i) => i).filter((i) => abaVisivel(abas[i]));
      barraAbas.replaceChildren(
        h('button', { class: 'prog-topo', onclick: abrirEtapas },
          h('span', { class: 'prog-nome' }, abas[S.aba].nome), h('span', { class: 'prog-n' }, `${vis.indexOf(S.aba) + 1} de ${vis.length}`), ico('etapas')),
        h('div', { class: 'prog-barra' }, vis.map((i) => h('span', { class: 'seg ' + (i === S.aba ? 'at' : estadoAba(abas[i])), onclick: () => irAba(i) }))), barraPend);
    }
    function abrirEtapas() {
      const vis = abas.map((x, i) => i).filter((i) => abaVisivel(abas[i]));
      const rot = { cheio: 'Completa', meio: 'Em andamento', falta: 'Falta obrigatório', '': '' };
      const veu = h('div', { class: 'veu', onclick: (e) => e.target === veu && veu.remove() }, h('div', { class: 'folha' },
        h('h3', null, 'Etapas'),
        vis.map((i) => { const st = estadoAba(abas[i]); return h('button', { class: 'menu-it' + (i === S.aba ? ' at' : ''), onclick: () => { veu.remove(); irAba(i); } }, h('span', { class: 'seg-dot ' + st }), h('span', { style: 'flex:1' }, abas[i].nome), h('small', { class: 'dica' }, rot[st])); }),
        h('div', { class: 'linha-btn', style: 'margin-top:14px' }, r.status !== 'enviado' ? h('button', { class: 'btn perigo', onclick: () => { veu.remove(); excluir(); } }, 'Excluir') : null, h('button', { class: 'btn', onclick: () => { veu.remove(); concluir(); } }, ico('check'), 'Concluir árvore'))));
      document.body.append(veu);
    }
    function irAba(i) { if (i < 0 || i >= abas.length) return; if (!abaVisivel(abas[i])) { const k = vizinha(i, 1) >= 0 ? vizinha(i, 1) : vizinha(i, -1); if (k < 0) return; i = k; } S.aba = i; history.replaceState(null, '', '#form/' + r.uuid + '/' + i); render(); window.scrollTo(0, 0); }

    function mudar(c, v) {
      r.valores[c.nome] = v; r.mexido = true; recalcular(r);
      E = estadoCampos(form, r.valores);
      if (camposRegra.has(c.nome)) { salvarRascunho(); return render(); }
      for (const [nome, el] of calcEls) pintarCalc(el, form.campos.find((x) => x.nome === nome));
      salvarRascunho(); pintarAbas();
      if (S.tentou) { const box = conteudo.querySelector(`[data-campo="${CSS.escape(c.nome)}"]`); if (box) box.classList.toggle('falta', E[c.nome].obrig && vazio(c, valorDe(r, c))); }
    }
    function pintarCalc(el, c) {
      const v = r.valores[c.nome];
      el.className = 'calc' + (v == null || v === '' ? ' vazio' : '') + (/risco/i.test(c.nome) && v ? ' risco-' + v : '');
      el.textContent = v == null || v === '' ? 'Calculado automaticamente' : typeof v === 'number' ? numBR(v) : Q2F.bonito(v);
    }

    function render() {
      if (!abaVisivel(abas[S.aba])) { const k = vizinha(S.aba, -1) >= 0 ? vizinha(S.aba, -1) : vizinha(S.aba, 1); if (k >= 0) S.aba = k; }
      pintarAbas(); calcEls.clear();
      const a = abas[S.aba];
      const campos = a.campos.map((x) => ({ c: form.campos.find((f) => f.nome === x.campo), grupo: x.grupo })).filter((x) => x.c && x.c.tipo !== 'hidden' && !E[x.c.nome].oculto);
      const blocos = []; let grupoAtual = null; let chips = null; let nums = null; let fotos = null;
      for (const { c, grupo } of campos) {
        if (grupo !== grupoAtual) { grupoAtual = grupo; chips = nums = fotos = null; if (grupo) blocos.push(h('div', { class: 'grupo-tit' }, grupo)); }
        if (c.tipo === 'bool' && !c.calculado) {
          nums = fotos = null;
          if (!chips) {
            const gObrig = grupo && (form.gruposObrig || []).includes(grupo);
            const faltaG = S.tentou && gObrig && gruposFaltando(form, r.valores, E).includes(grupo);
            chips = h('div', { class: 'chips' });
            blocos.push(h('div', { class: 'campo' + (faltaG ? ' falta' : ''), 'data-grupo': grupo || '' }, grupo ? (gObrig ? h('div', { class: 'dica', style: 'margin:-6px 0 10px' }, 'Marque uma ou mais (obrigatório)') : null) : h('div', { class: 'rot' }, 'Marque o que se aplica'), chips));
          }
          const meuGrupo = grupo;
          const b = h('button', { class: 'chip' + (c.exclusivo ? ' exclusivo' : '') + (r.valores[c.nome] ? ' sel' : ''), 'data-campo': c.nome, onclick: () => {
            const v = !r.valores[c.nome];
            if (v && meuGrupo) {
              // "Ausente" desmarca as outras opções do grupo, e qualquer outra desmarca "Ausente"
              for (const n of camposDoGrupo(form, meuGrupo)) {
                const k = form.campos.find((x) => x.nome === n);
                if (n !== c.nome && k && k.tipo === 'bool' && (c.exclusivo || k.exclusivo) && r.valores[n]) { r.valores[n] = false; const el = conteudo.querySelector(`.chip[data-campo="${CSS.escape(n)}"]`); if (el) el.classList.remove('sel'); }
              }
            }
            b.classList.toggle('sel', v); mudar(c, v);
            if (S.tentou && meuGrupo) { const box = conteudo.querySelector(`[data-grupo="${CSS.escape(meuGrupo)}"]`); if (box) box.classList.toggle('falta', gruposFaltando(form, r.valores, E).includes(meuGrupo)); }
          } }, c.rotulo);
          chips.append(b); continue;
        }
        if (c.tipo === 'number' && !c.calculado) {
          chips = fotos = null;
          if (!nums) { nums = h('div', { class: 'grade-num' }); blocos.push(nums); }
          nums.append(campoEl(c)); continue;
        }
        if (c.tipo === 'photo') {
          chips = nums = null;
          if (!fotos) { fotos = h('div', { class: 'grade-fotos' }); blocos.push(fotos); }
          fotos.append(campoEl(c)); continue;
        }
        chips = nums = fotos = null; blocos.push(campoEl(c));
        if (camposRegra.has(c.nome)) {
          const rg = (form.regras || []).find((x) => x.campo === c.nome); const cfg = rg && rg.por[String(r.valores[c.nome])];
          const nOc = cfg ? Object.values(cfg).filter((x) => x === 'oculto').length : 0;
          if (nOc) blocos.push(h('div', { class: 'nota' }, `${nOc} campos não se aplicam e foram ocultados.`));
        }
      }
      conteudo.replaceChildren(...blocos);
      btAnt.disabled = vizinha(S.aba, -1) < 0;
      const k = vizinha(S.aba, 1);
      btProx.replaceChildren(...(k >= 0 ? [h('span', null, abas[k].nome), ico('dir')] : [ico('check'), h('span', null, 'Concluir árvore')]));
      btProx.classList.toggle('fim', k < 0);
    }

    function rotulo(c) { return h('label', { class: 'rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null, c.ajuda ? h('small', { class: 'ajuda' }, c.ajuda) : null); }
    function campoEl(c) {
      const box = h('div', { class: 'campo' + (S.tentou && E[c.nome].obrig && vazio(c, valorDe(r, c)) ? ' falta' : ''), 'data-campo': c.nome });
      const v = r.valores[c.nome];
      if (c.auto) { box.append(rotulo(c), h('div', { class: 'calc' + (v ? '' : ' vazio') }, v || 'Automático')); return box; }
      if (c.calculado) { const el = h('div', { class: 'calc' }); calcEls.set(c.nome, el); pintarCalc(el, c); box.append(rotulo(c), el); return box; }
      switch (c.tipo) {
        case 'choice': {
          const longas = c.opcoes.some((o) => o.t.length > 24) || c.opcoes.length > 6;
          const grade = h('div', { class: 'opcoes' + (longas ? ' longas' : '') });
          for (const o of c.opcoes) {
            const m = o.t.match(/^([^(]+?)\s*\((.+)\)\s*$/);
            const b = h('button', { class: 'op' + (String(v) === String(o.v) ? ' sel' : ''), onclick: async () => {
              const novo = String(r.valores[c.nome]) === String(o.v) ? null : o.v;
              if (camposRegra.has(c.nome) && novo != null) {
                const E2 = estadoCampos(form, Object.assign({}, r.valores, { [c.nome]: novo }));
                const perde = form.campos.filter((k) => E2[k.nome].oculto && !E[k.nome].oculto && k.tipo !== 'bool' && !k.calculado && !vazio(k, valorDe(r, k)));
                if (perde.length && !(await confirmar('Trocar ' + c.rotulo.toLowerCase(), `Com "${o.t.replace(/\s*\(.*\)/, '')}" estes campos já preenchidos deixam de valer: ${perde.map((k) => k.rotulo).join(', ')}. Continuar?`, 'Trocar'))) return;
              }
              grade.querySelectorAll('.op').forEach((x) => x.classList.remove('sel')); if (novo != null) b.classList.add('sel'); mudar(c, novo);
            } }, m ? [m[1], h('small', null, m[2])] : o.t);
            grade.append(b);
          }
          box.append(rotulo(c), grade); break;
        }
        case 'bool': {
          const b = h('button', { class: 'chip' + (v ? ' sel' : ''), onclick: () => { const nv = !r.valores[c.nome]; b.classList.toggle('sel', nv); mudar(c, nv); } }, c.rotulo);
          box.append(h('div', { class: 'chips' }, b)); break;
        }
        case 'number': {
          const av = h('div', { class: 'aviso-campo oculto' });
          const checar = () => {
            const t = i.value.trim(); const n = paraNum(t); let m = '';
            if (t && n == null) m = 'Número inválido. Use só uma vírgula, ex.: 2,5';
            else if (n != null && c.min != null && n < c.min) m = c.limiteMsg ? `${c.rotulo.replace(/\s*\(.*\)/, '')}: ${c.limiteMsg}. Mude a categoria ou exclua o registro.` : `Abaixo do mínimo de ${numBR(c.min)}.`;
            av.textContent = m; av.classList.toggle('oculto', !m); i.classList.toggle('invalido', !!m);
          };
          const i = h('input', { class: 'entrada', inputmode: 'decimal', enterkeyhint: 'next', value: numBR(v), oninput: () => { checar(); mudar(c, c.inteiro ? (paraNum(i.value) == null ? null : Math.round(paraNum(i.value))) : paraNum(i.value)); } });
          box.append(rotulo(c), i, av); checar(); break;
        }
        case 'multinumber': {
          const lista = h('div', { class: 'fustes' });
          let valores = String(v || '').split(';').map((x) => x.trim()); if (!valores.length) valores = [''];
          const gravar = () => mudar(c, valores.map((x) => x.replace('.', ',').trim()).filter((x) => x).join(';'));
          const desenhar = () => {
            lista.replaceChildren(...valores.map((val, k) => {
              const i = h('input', { class: 'entrada', inputmode: 'decimal', value: val, placeholder: '0,0', oninput: () => { valores[k] = i.value; gravar(); } });
              return h('div', { class: 'fuste' }, h('span', null, `Fuste ${k + 1}`), i,
                valores.length > 1 ? h('button', { onclick: () => { valores.splice(k, 1); gravar(); desenhar(); }, 'aria-label': 'Remover fuste' }, '×') : null);
            }));
          };
          desenhar();
          box.append(rotulo(c), lista, h('button', { class: 'btn sec peq', style: 'margin-top:8px', onclick: () => { valores.push(''); desenhar(); lista.lastChild.querySelector('input').focus(); } }, '+ fuste'));
          break;
        }
        case 'species': box.append(rotulo(c), especieEl(c)); break;
        case 'textarea': { const t = h('textarea', { class: 'entrada', oninput: () => mudar(c, t.value) }); t.value = v || ''; box.append(rotulo(c), t); break; }
        case 'datetime': case 'date': {
          const d = v ? new Date(v) : null;
          const loc = d && !isNaN(d) ? (c.tipo === 'date' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`) : '';
          const i = h('input', { class: 'entrada', type: c.tipo === 'date' ? 'date' : 'datetime-local', value: loc, onchange: () => mudar(c, i.value ? new Date(i.value).toISOString() : null) });
          box.append(rotulo(c), i); break;
        }
        case 'photo': box.append(fotoEl(c)); break;
        default: {
          const i = h('input', { class: 'entrada', value: v ?? '', enterkeyhint: 'next', oninput: () => mudar(c, i.value) });
          box.append(rotulo(c), i); if (c.incremento) box.append(h('div', { class: 'dica' }, 'Sugerido: último + 1. Confira a plaqueta.'));
        }
      }
      return box;
    }

    function especieEl(c) {
      const lista = form.especies || [];
      const i = h('input', { class: 'entrada', value: r.valores[c.nome] || '', placeholder: 'Digite parte do nome', autocomplete: 'off', autocapitalize: 'none' });
      const drop = h('div', { class: 'esp-lista oculto' });
      const nova = h('div', { class: 'esp-nova oculto' }, 'Espécie fora da lista do projeto. Confira a grafia.');
      const conferir = () => { const v = (r.valores[c.nome] || '').trim(); nova.classList.toggle('oculto', !v || lista.some((e) => norm(e.cientifico) === norm(v))); };
      const escolher = (nome) => { i.value = nome; drop.classList.add('oculto'); mudar(c, nome); conferir(); };
      i.addEventListener('input', () => {
        const q = norm(i.value).trim(); mudar(c, i.value.replace(/\s+/g, ' ').trim());
        if (!q) { drop.classList.add('oculto'); return conferir(); }
        const termos = q.split(/\s+/);
        const achados = lista.filter((e) => { const alvo = norm(e.cientifico + ' ' + (e.popular || '')); return termos.every((t) => alvo.split(/[\s,;-]+/).some((w) => w.startsWith(t))); }).slice(0, 30);
        drop.replaceChildren(...achados.map((e) => h('button', { onmousedown: (ev) => ev.preventDefault(), onclick: () => escolher(e.cientifico) }, h('i', null, e.cientifico), e.popular ? h('small', null, e.popular) : null)));
        drop.classList.toggle('oculto', !achados.length); conferir();
      });
      i.addEventListener('blur', () => setTimeout(() => drop.classList.add('oculto'), 150));
      const rec = h('div', { class: 'esp-recentes' });
      Store.registros(S.projeto.id).then((regs) => {
        const vistos = []; for (const x of regs.sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''))) { const e = x.valores && x.valores[c.nome]; if (e && x.uuid !== r.uuid && !vistos.includes(e)) vistos.push(e); if (vistos.length >= 6) break; }
        rec.replaceChildren(...vistos.map((e) => h('button', { onclick: () => escolher(e) }, e)));
      });
      conferir();
      return h('div', null, h('div', { class: 'esp-box' }, i, drop), nova, rec);
    }

    function fotoEl(c) {
      const wrap = h('div', { class: 'foto-tile' });
      const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: () => receber(cam) });
      const gal = h('input', { type: 'file', accept: 'image/*', onchange: () => receber(gal) });
      const desenhar = async () => {
        const f = r.fotos[c.nome];
        let u = null; if (f) { const b = await Store.foto(f.chave); if (b) u = URL.createObjectURL(b); }
        const opcoes = async () => {
          const v = await modal(c.rotulo, u ? h('img', { src: u, style: 'width:100%;border-radius:12px;max-height:55vh;object-fit:contain;background:#000' }) : h('p', null, 'Foto já enviada ao Drive.'),
            [{ texto: 'Remover', classe: 'perigo', valor: 'rm' }, { texto: 'Galeria', classe: 'sec', valor: 'gal' }, { texto: 'Tirar outra', valor: 'cam' }]);
          if (v === 'cam') cam.click(); else if (v === 'gal') gal.click();
          else if (v === 'rm' && await confirmar('Remover foto', 'Remover esta foto do registro?', 'Remover', 'perigo')) { delete r.fotos[c.nome]; mudar(c, r.valores[c.nome]); desenhar(); }
        };
        wrap.replaceChildren(
          f ? h('button', { class: 'tile cheia', onclick: opcoes, style: u ? `background-image:url(${u})` : '' }, u ? null : ico('check'))
            : h('button', { class: 'tile', onclick: () => cam.click() }, ico('camera')),
          h('div', { class: 'tile-rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null),
          ...(f ? [] : [h('button', { class: 'tile-gal', onclick: () => gal.click() }, 'Escolher da galeria')]), cam, gal);
      };
      async function receber(inp) {
        const arq = inp.files && inp.files[0]; if (!arq) return;
        try {
          const blob = await reduzir(arq, 2048, 0.85);
          const chave = r.uuid + ':' + c.nome + ':' + Date.now();
          await Store.salvarFoto(chave, blob);
          const antiga = r.fotos[c.nome]; const daBase = r.__baseFotos && (JSON.parse(r.__baseFotos)[c.nome] || {}).chave === (antiga && antiga.chave);
          if (antiga && !antiga.enviado && !daBase) Store.apagarFoto(antiga.chave);
          const prefixo = S.projeto.prefixo || S.projeto.id;
          r.fotos[c.nome] = { nome: `DCIM/${prefixo}_${carimbo()}_${r.uuid.replace(/-/g, '').slice(0, 6)}.jpg`, chave, enviado: false, url: '' };
          mudar(c, r.valores[c.nome]); desenhar();
        } catch (e) { toast('Não foi possível ler a foto: ' + e.message); }
      }
      desenhar(); return wrap;
    }

    async function abrirLocal() {
      const info = h('p', { class: 'dica' });
      const div = h('div', { class: 'mapa-mini' });
      const pintar = () => { info.textContent = r.lat == null ? 'Sem posição ainda.' : `Lat ${r.lat.toFixed(6)} · Lon ${r.lon.toFixed(6)} · precisão ±${Math.round(r.prec)} m${r.posManual ? ' · ajustada no mapa' : ''}`; };
      pintar();
      let mapa = null, marca = null;
      const p = modal('Localização da árvore', h('div', null, h('p', null, 'Arraste o marcador para o pé da árvore, se precisar ajustar.'), div, info), [
        { texto: 'Usar GPS agora', classe: 'sec', valor: 'gps' }, { texto: 'Pronto', valor: 'ok' }]);
      setTimeout(() => {
        const centro = r.lat != null ? [r.lat, r.lon] : S.pos ? [S.pos.lat, S.pos.lon] : [-15.8, -47.9];
        mapa = L.map(div, { maxZoom: 21 }).setView(centro, r.lat != null || S.pos ? 19 : 4);
        camadasFundo(mapa, false);
        if (r.lat != null) { marca = L.marker(centro, { draggable: true }).addTo(mapa); marca.on('dragend', () => { const ll = marca.getLatLng(); Object.assign(r, { lat: ll.lat, lon: ll.lng, posManual: true, gpsAuto: false }); salvarRascunho(); pintar(); pintarGps(); }); }
        if (S.pos) L.circle([S.pos.lat, S.pos.lon], { radius: S.pos.prec, color: '#0B6E8C', weight: 1 }).addTo(mapa);
      }, 60);
      const v = await p;
      if (v === 'gps') {
        if (!S.pos) return toast('GPS ainda sem sinal.');
        Object.assign(r, { lat: S.pos.lat, lon: S.pos.lon, prec: S.pos.prec, posManual: false, gpsAuto: true }); salvarRascunho(); pintarGps(); toast(`Posição do GPS: ±${Math.round(S.pos.prec)} m`);
      }
    }

    async function concluir() {
      S.tentou = true;
      const f = faltando(r);
      if (f.length) { if (navigator.vibrate) navigator.vibrate(120); irPendente(0); return; }
      const avisos = conferirValores(r);
      if (avisos.length && !(await modal('Confira os valores', h('div', null, h('p', null, 'Estes valores estão fora do comum:'), h('ul', { class: 'lista-mud' }, avisos.map((a) => h('li', null, a)))), [{ texto: 'Corrigir', classe: 'sec', valor: false }, { texto: 'Está certo', valor: true }]))) return;
      if (r.lat == null && !(await confirmar('Sem localização', 'Esta árvore ainda não tem posição de GPS. Salvar assim mesmo?', 'Salvar sem GPS'))) return;
      if (r.__base) {
        const mud = diferencas();
        if (!mud.length) { clearTimeout(salvarTimer); delete r.__base; delete r.__baseFotos; await Store.salvarRegistro(r); S.editando.delete(r.uuid); Gps.ouvintes.delete(ouvinte); S.reg = null; toast('Nenhuma alteração.'); return ir('#form/' + r.uuid); }
        const ok = await modal('Confirmar alterações', h('div', null, h('p', null, 'Estas mudanças vão para o histórico do registro, com seu usuário, data e hora:'), h('ul', { class: 'lista-mud' }, mud.map((m) => h('li', null, m)))),
          [{ texto: 'Voltar e revisar', classe: 'sec', valor: false }, { texto: 'Confirmar alterações', valor: true }]);
        if (!ok) return;
      }
      clearTimeout(salvarTimer);
      // campos ocultos pela classe não levam valor antigo para a planilha
      for (const c of form.campos) if (E[c.nome].oculto) { if (c.tipo === 'photo') delete r.fotos[c.nome]; else r.valores[c.nome] = null; }
      recalcular(r);
      anotarHistorico();
      if (!r.concluido_em) r.concluido_em = agoraISO();
      if (r.validacao === 'Devolvido') r.validacao = 'Corrigido';
      S.editando.delete(r.uuid);
      r.status = 'pendente'; r.gpsAuto = false; r.atualizado_em = agoraISO(); delete r.erroSync;
      await Store.salvarRegistro(r);
      Gps.ouvintes.delete(ouvinte); S.reg = null;
      toast('Árvore salva.'); ir('#inicio'); sincronizar(true);
    }
    // registro já concluído que foi alterado: guarda quem mudou o quê e quando
    function diferencas() {
      if (!r.__base) return [];
      const antes = JSON.parse(r.__base); const mud = [];
      const fmt = (c, v) => v == null || v === '' ? 'vazio' : v === true ? 'sim' : v === false ? 'não' : typeof v === 'number' ? numBR(v) : c.tipo === 'choice' ? rotuloOpcao(c, v) : String(v);
      for (const c of form.campos) if (!c.calculado && c.tipo !== 'photo' && fmt(c, antes[c.nome]) !== fmt(c, r.valores[c.nome])) mud.push(`${c.rotulo}: ${fmt(c, antes[c.nome])} → ${fmt(c, r.valores[c.nome])}`);
      const bp = JSON.parse(r.__basePos || 'null');
      if (bp && (bp.lat !== r.lat || bp.lon !== r.lon)) { const d = bp.lat == null || r.lat == null ? null : distM(bp.lat, bp.lon, r.lat, r.lon); mud.push(`Posição: ${bp.lat == null ? 'sem GPS' : 'ajustada'}${d != null ? ` (${numBR(Math.round(d * 10) / 10)} m)` : ''}`); }
      const fa = JSON.parse(r.__baseFotos || '{}');
      for (const c of form.campos) if (c.tipo === 'photo' && ((fa[c.nome] || {}).chave || '') !== ((r.fotos[c.nome] || {}).chave || '')) mud.push(`${c.rotulo}: foto ${r.fotos[c.nome] ? (fa[c.nome] ? 'trocada' : 'incluída') : 'removida'}`);
      return mud;
    }
    // registro já concluído que foi alterado: guarda quem mudou o quê e quando
    function anotarHistorico() {
      const mud = diferencas();
      if (mud.length) (r.historico = r.historico || []).push({ em: agoraISO(), por: S.sessao.u, mud });
      // fotos da versão anterior que foram trocadas e nunca subiram: agora podem sair do aparelho
      const fa = JSON.parse(r.__baseFotos || '{}'); const atuais = new Set(Object.values(r.fotos).map((f) => f && f.chave));
      for (const f of Object.values(fa)) if (f && f.chave && !f.enviado && !atuais.has(f.chave)) Store.apagarFoto(f.chave);
      delete r.__base; delete r.__baseFotos; delete r.__basePos;
    }
    async function sairForm() {
      clearTimeout(salvarTimer);
      if (r.__base) {
        const mud = diferencas();
        if (mud.length) {
          const v = await modal('Alterações não confirmadas', h('div', null, h('p', null, 'Você mudou este registro já concluído:'), h('ul', { class: 'lista-mud' }, mud.map((m) => h('li', null, m)))),
            [{ texto: 'Descartar alterações', classe: 'perigo', valor: 'descartar' }, { texto: 'Continuar editando', classe: 'sec', valor: null }, { texto: 'Salvar', valor: 'salvar' }]);
          if (v === 'salvar') return concluir();
          if (v !== 'descartar') return;
          await descartarEdicao(r); S.editando.delete(r.uuid); Gps.ouvintes.delete(ouvinte); S.reg = null; return ir('#form/' + r.uuid);
        }
        delete r.__base; delete r.__baseFotos; delete r.__basePos; await Store.salvarRegistro(r); S.editando.delete(r.uuid);
        Gps.ouvintes.delete(ouvinte); S.reg = null; return ir('#form/' + r.uuid);
      }
      Gps.ouvintes.delete(ouvinte);
      if (r.status === 'rascunho' && !r.mexido && !Object.keys(r.fotos).length) { await Store.apagarRegistro(r.uuid); }
      else { r.atualizado_em = agoraISO(); await Store.salvarRegistro(r); if (r.status === 'rascunho') toast('Guardado como rascunho.'); }
      S.reg = null; ir('#inicio');
    }

    async function excluir() {
      if (!(await confirmar('Excluir', 'Excluir este registro do aparelho? Isso não pode ser desfeito.', 'Excluir', 'perigo'))) return;
      clearTimeout(salvarTimer); Gps.ouvintes.delete(ouvinte);
      for (const f of Object.values(r.fotos)) if (f && f.chave) await Store.apagarFoto(f.chave);
      await Store.apagarRegistro(r.uuid); S.reg = null; ir('#inicio');
    }
    recalcular(r); render();
  }

  // ---------- Mapa ----------
  async function telaMapa() {
    const div = h('div', { id: 'mapa' });
    const form = S.form;
    const cc = campoCodigo(form), ce = campoEspecie(form);
    const cRisco = form.campos.find((c) => c.tipo === 'choice' && /^risco$/i.test(norm(c.nome)));
    const cCat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const cFoto = form.campos.find((c) => c.tipo === 'photo');
    const rotOp = (c, v) => { if (!c || v == null || v === '') return ''; const o = c.opcoes.find((x) => String(x.v) === String(v)); return o ? o.t : String(v); };
    // filtros
    const busca = h('input', { class: 'entrada', placeholder: 'Código ou espécie', autocapitalize: 'none' });
    const selEq = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todas as equipes'));
    const selRisco = cRisco ? h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todos os riscos'), cRisco.opcoes.map((o) => h('option', { value: o.v }, 'Risco ' + o.t.toLowerCase()))) : null;
    const selBairro = h('select', { class: 'entrada oculto' }, h('option', { value: '' }, 'Todos os bairros'));
    const selCor = h('select', { class: 'entrada' }, h('option', { value: 'equipe' }, 'Cor por equipe'), cRisco ? h('option', { value: 'risco' }, 'Cor por risco') : null, h('option', { value: 'os' }, 'Cor por ordem de serviço'));
    if (S.corMapa) { selCor.value = S.corMapa; S.corMapa = null; }
    let osPorArv = null; const osSoltas = []; const ORD_OS = ['Em execução', 'Aberta', 'Solicitada', 'Concluída', 'Cancelada'];
    const carregarOSMapa = async () => {
      if (osPorArv) return; osPorArv = new Map();
      try { const d = await carregarOS(false); for (const o of d.ordens) { if (!o.registro_uuid) { if (o.latitude !== '' && !isNaN(+o.latitude)) osSoltas.push(o); continue; } const a = osPorArv.get(o.registro_uuid); if (!a || ORD_OS.indexOf(o.status) < ORD_OS.indexOf(a.status)) osPorArv.set(o.registro_uuid, o); } } catch (e) { /* sem ordens */ }
    };
    const conta = h('small', { class: 'mapa-conta' });
    const barra = h('div', { class: 'mapa-filtros' }, busca, h('div', { class: 'mapa-sel' }, selEq, selRisco, selBairro, selCor), conta);
    $app.replaceChildren(h('div', { class: 'tela-mapa' }, topo('Mapa', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir(perfil() === 'cliente' ? '#painel' : '#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: centrar }, 'Minha posição')), barra, div));
    const mapa = L.map(div, { preferCanvas: true, maxZoom: 21 }).setView(S.pos ? [S.pos.lat, S.pos.lon] : [-15.8, -47.9], S.pos ? 18 : 4);
    if (S.fundo == null) S.fundo = (await Store.get('fundo')) || 'ruas';
    camadasFundo(mapa, false);
    const render = L.canvas({ padding: 0.3 });
    const cores = ['#00546E', '#CD834C', '#6A1B9A', '#2E7D32', '#C62828', '#12A6C8'];
    const corRisco = { Baixo: COR_RISCO.Baixo, 'Médio': COR_RISCO['Médio'], Alto: COR_RISCO.Alto };
    const equipes = []; const corEq = (e) => { if (!equipes.includes(e)) equipes.push(e); return cores[equipes.indexOf(e) % cores.length]; };
    // pontos: os do aparelho primeiro (podem ter edição ainda não enviada), depois os do servidor
    const pts = []; const vistos = new Set();
    const add = (o) => { if (o.lat == null || o.lat === '' || isNaN(+o.lat) || vistos.has(o.uid)) return; vistos.add(o.uid); o.lat = +o.lat; o.lon = +o.lon; o.chave = norm(o.cod + ' ' + o.esp); corEq(o.equipe || '-'); pts.push(o); };
    if (perfil() !== 'cliente') for (const r of await Store.registros(S.projeto.id)) if (r.status !== 'rascunho') add({ uid: r.uuid, lat: r.lat, lon: r.lon, equipe: r.equipe, bairro: r.bairro || '', cod: cc ? r.valores[cc.nome] || '' : '', esp: ce ? r.valores[ce.nome] || '' : '', risco: cRisco ? r.valores[cRisco.nome] : '', cat: cCat ? r.valores[cCat.nome] : '', foto: '', local: true });
    const camada = L.layerGroup().addTo(mapa);
    function desenhar(ajustar) {
      camada.clearLayers(); mapa.closePopup();
      const q = norm(busca.value).trim(), eq = selEq.value, rk = selRisco ? selRisco.value : '', porRisco = selCor.value === 'risco';
      const ba = selBairro.value; const porOS = selCor.value === 'os';
      if (porOS && !osPorArv) { carregarOSMapa().then(() => desenhar(false)); }
      const vis = pts.filter((o) => (!q || o.chave.includes(q)) && (!eq || o.equipe === eq) && (!rk || String(o.risco) === rk) && (!ba || o.bairro === ba));
      for (const o of vis) {
        const os = porOS && osPorArv ? osPorArv.get(o.uid) : null;
        const fill = porOS ? (os ? COR_OS[os.status] : '#C9D3D6') : porRisco ? corRisco[o.risco] || '#8A969C' : corEq(o.equipe || '-');
        L.circleMarker([o.lat, o.lon], { renderer: render, radius: vis.length > 2000 ? 4 : 6, color: '#fff', weight: 1.5, fillColor: fill, fillOpacity: 0.95 }).on('click', (e) => ficha(o, e.latlng)).addTo(camada);
      }
      if (porOS && osPorArv) for (const o of osSoltas) L.circleMarker([+o.latitude, +o.longitude], { renderer: render, radius: 8, color: '#13262B', weight: 2, fillColor: COR_OS[o.status], fillOpacity: 0.95 }).on('click', () => ir('#os/' + encodeURIComponent(o.id))).addTo(camada);
      conta.textContent = `${vis.length.toLocaleString('pt-BR')} de ${pts.length.toLocaleString('pt-BR')} pontos` + (porOS && osPorArv ? ` · ${[...osPorArv.values()].filter((x) => ['Aberta', 'Em execução', 'Solicitada'].includes(x.status)).length + osSoltas.filter((x) => ['Aberta', 'Em execução', 'Solicitada'].includes(x.status)).length} com ordem em aberto` : '');
      legenda();
      if (ajustar && vis.length) {
        if (vis.length === 1) { mapa.setView([vis[0].lat, vis[0].lon], 19); ficha(vis[0]); }
        else mapa.fitBounds(L.latLngBounds(vis.map((o) => [o.lat, o.lon])), { padding: [30, 30], maxZoom: 19 });
      }
    }
    function ficha(o, ll) {
      const pop = h('div', { class: 'ficha' }, h('b', null, o.cod || 'Sem código'), o.esp ? h('i', null, o.esp) : null,
        o.cat ? h('div', null, rotOp(cCat, o.cat)) : null, o.risco ? h('div', null, 'Risco ' + String(rotOp(cRisco, o.risco)).toLowerCase()) : null,
        h('small', null, o.equipe || ''),
        linkSeguro(o.foto) ? h('a', { href: linkSeguro(o.foto), target: '_blank', rel: 'noopener' }, 'Ver foto') : null,
        osPorArv && osPorArv.get(o.uid) ? h('button', { class: 'btn sec peq', onclick: () => ir('#os/' + encodeURIComponent(osPorArv.get(o.uid).id)) }, `${numOS(osPorArv.get(o.uid))} · ${osPorArv.get(o.uid).status}`) : null,
        o.local ? h('button', { class: 'btn peq', onclick: () => ir('#form/' + o.uid) }, 'Abrir') : perfil() !== 'coletor' ? h('button', { class: 'btn peq', onclick: () => { S.navVal = []; ir('#ficha/' + encodeURIComponent(o.uid)); } }, 'Ver ficha') : null);
      L.popup().setLatLng(ll || [o.lat, o.lon]).setContent(pop).openOn(mapa);
    }
    let leg = null;
    function legenda() {
      if (leg) leg.remove();
      leg = L.control({ position: 'bottomleft' });
      const itens = selCor.value === 'os' ? [...Object.entries(COR_OS), ['Sem ordem', '#C9D3D6']] : selCor.value === 'risco' ? Object.entries(corRisco) : equipes.map((e) => [e, corEq(e)]);
      leg.onAdd = () => h('div', { class: 'mapa-leg' }, itens.map(([t, c]) => h('div', null, h('span', { style: `background:${c}` }), t)));
      leg.addTo(mapa);
    }
    let tBusca = null;
    busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => desenhar(!!busca.value.trim()), 250); });
    busca.setAttribute('enterkeyhint', 'search'); busca.placeholder = 'Código, espécie ou endereço';
    let marcaEnd = null;
    busca.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return; const q = busca.value.trim(); if (!q) return;
      if (pts.some((o) => o.chave.includes(norm(q)))) return desenhar(true);
      if (!navigator.onLine) return toast('Sem internet para buscar endereço.');
      try {
        const r = await buscarEndereco(q); if (!r) return toast('Endereço não encontrado.');
        busca.value = ''; desenhar(false); mapa.setView([r.lat, r.lon], 18);
        if (marcaEnd) marcaEnd.remove(); marcaEnd = L.marker([r.lat, r.lon]).addTo(mapa).bindPopup(r.nome).openPopup();
      } catch (er) { toast('Não foi possível buscar o endereço.'); }
    });
    [selEq, selRisco, selBairro, selCor].filter(Boolean).forEach((x) => x.addEventListener('change', () => desenhar(x !== selCor)));
    const preencherBairros = () => { const bs = [...new Set(pts.map((o) => o.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')); const at = selBairro.value; selBairro.replaceChildren(h('option', { value: '' }, 'Todos os bairros'), bs.map((b) => h('option', { value: b, selected: b === at }, b))); selBairro.classList.toggle('oculto', !bs.length); };
    const preencherEquipes = () => { preencherBairros(); const atual = selEq.value; selEq.replaceChildren(h('option', { value: '' }, 'Todas as equipes'), ...equipes.filter((e) => e !== '-').map((e) => h('option', { value: e, selected: e === atual }, e))); };
    preencherEquipes(); desenhar(true);
    if (!Api.demo && navigator.onLine) {
      conta.textContent = 'Carregando pontos...';
      try {
        const campos = ['uuid', 'latitude', 'longitude', 'equipe', cc && cc.nome, ce && ce.nome, cRisco && cRisco.nome, cCat && cCat.nome, cFoto && cFoto.nome + ' link', 'bairro_aprox'].map((x) => x || '');
        const m = await Api.b.mapa(S.projeto.id, campos);
        for (const l of m.linhas) add({ uid: l[0], lat: l[1], lon: l[2], equipe: l[3], cod: l[4] || '', esp: l[5] || '', risco: l[6], cat: l[7], foto: l[8], bairro: l[9] || '', local: false });
        if (!document.body.contains(div)) return;
        preencherEquipes(); desenhar(true);
      } catch (e) { conta.textContent = ''; toast('Não foi possível carregar os pontos das outras equipes.'); }
    }
    let eu = null;
    function centrar() { if (!S.pos) return toast('GPS ainda sem sinal.'); mapa.setView([S.pos.lat, S.pos.lon], 19); }
    const ouv = (p) => { if (!p || !document.body.contains(div)) return; if (!eu) eu = L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#1E88E5', fillOpacity: 1 }).addTo(mapa); else eu.setLatLng([p.lat, p.lon]); };
    Gps.ouvintes.add(ouv); if (S.pos) ouv(S.pos);
    if (!pts.length) { if (S.pos) centrar(); else mapa.setView([-15.8, -47.9], 4); }
  }

  // ---------- Coordenação ----------
  async function telaAdmin(sub) {
    sub = sub || 'exportar';
    const corpo = h('main');
    const it = (id, txt) => h('button', { class: sub === id ? 'at' : '', onclick: () => ir('#admin/' + id) }, txt);
    const voltar = S.projeto ? h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')) : h('button', { class: 'ic', onclick: abrirMenuAdmin, 'aria-label': 'Menu' }, ico('menu'));
    $app.replaceChildren(...[topo('Coordenação', Api.demo ? 'Modo demonstração' : (S.projeto ? S.projeto.nome : 'Neofloresta Inventário'), voltar, null),
      !S.projeto ? h('main', { style: 'padding-bottom:0' }, h('div', { class: 'info' }, 'Primeiros passos: 1) em Formulários, instale ou importe um formulário; 2) em Projetos, crie o projeto; 3) em Equipes e usuários, crie os acessos de campo.')) : null,
      h('main', { style: 'padding-bottom:0' }, h('div', { class: 'subabas' }, it('exportar', 'Exportar'), it('importar', 'Importar'), it('projetos', 'Projetos'), it('usuarios', 'Usuários'), it('formularios', 'Formulários'), it('seguranca', 'Segurança')),
        S.projeto ? h('div', { class: 'linha-btn', style: 'margin:8px 0 0' }, h('button', { class: 'btn sec peq', onclick: () => ir('#painel') }, 'Painel'), h('button', { class: 'btn sec peq', onclick: () => ir('#validacao') }, 'Validação'), h('button', { class: 'btn sec peq', onclick: () => ir('#mapa') }, 'Mapa')) : null), corpo].filter(Boolean));
    corpo.style.paddingTop = '0';
    try {
      if (sub === 'exportar') await adminExportar(corpo);
      else if (sub === 'projetos') await adminProjetos(corpo);
      else if (sub === 'usuarios') await adminUsuarios(corpo);
      else if (sub === 'formularios') await adminFormularios(corpo);
      else if (sub === 'importar') await adminImportar(corpo);
      else if (sub === 'seguranca') await adminSeguranca(corpo);
      else if (sub === 'revisao') adminRevisao(corpo);
    } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, 'Erro: ' + e.message)); }
  }

  function abrirMenuAdmin() {
    modal('Menu', h('div', null, h('button', { class: 'menu-it', onclick: () => { document.querySelector('.veu').remove(); configurarServidor(); } }, 'Servidor'), h('button', { class: 'menu-it', onclick: () => { document.querySelector('.veu').remove(); sair(); } }, 'Sair')), []);
  }
  async function recarregarSessao() {
    const r = await Api.b.login(S.sessao.u, S.sessao.s);
    S.sessao.projetos = r.projetos; await Store.set('sessao', S.sessao);
    if (!S.projeto && r.projetos.length) await abrirProjeto(r.projetos[0].id);
  }

  async function adminProjetos(corpo) {
    const [projetos, forms] = await Promise.all([Api.b.projetosListar(), Api.b.formulariosListar()]);
    const fusos = [['auto', 'Automático (pelo GPS)'], ...[18, 19, 20, 21, 22, 23, 24, 25].map((z) => [String(31960 + z), `SIRGAS 2000 / UTM ${z}S (EPSG:${31960 + z})`])];
    async function editar(p) {
      const novo = !p; p = p || { id: '', nome: '', formulario: forms[0] && forms[0].id, epsg: 'auto', prefixo: '' };
      const id = h('input', { class: 'entrada', value: p.id, disabled: !novo, placeholder: 'ex.: divinopolis-2026' });
      const nome = h('input', { class: 'entrada', value: p.nome, placeholder: 'ex.: PMAU Divinópolis' });
      const fo = h('select', { class: 'entrada' }, forms.map((f) => h('option', { value: f.id, selected: f.id === p.formulario }, f.nome)));
      const ep = h('select', { class: 'entrada' }, fusos.map(([v, t]) => h('option', { value: v, selected: String(p.epsg) === v }, t)));
      const pre = h('input', { class: 'entrada', value: p.prefixo || '', placeholder: 'prefixo do nome das fotos' });
      const contr = h('input', { class: 'entrada', value: p.contratante || '', placeholder: 'ex.: Prefeitura Municipal de Divinópolis' });
      const ncon = h('input', { class: 'entrada', value: p.contrato || '', placeholder: 'ex.: 580/2026' });
      const mun = h('input', { class: 'entrada', value: p.municipio || '', placeholder: 'ex.: Divinópolis/MG' });
      const meta = h('input', { class: 'entrada', inputmode: 'numeric', value: p.meta || '', placeholder: 'ex.: 10000' });
      const rt = h('input', { class: 'entrada', value: p.responsavel || '', placeholder: 'ex.: Nome do engenheiro florestal' });
      const reg = h('input', { class: 'entrada', value: p.registro_profissional || '', placeholder: 'ex.: CREA-PR 000.000/D' });
      const art = h('input', { class: 'entrada', value: p.art || '', placeholder: 'nº da ART' });
      const tos = h('textarea', { class: 'entrada', rows: 4, placeholder: 'Um por linha. Vazio usa a lista padrão: ' + TIPOS_OS_PADRAO.join(', ') }); tos.value = String(p.tipos_os || '').split(/[;\n]+/).filter(Boolean).join('\n');
      const cve = h('select', { class: 'entrada' }, h('option', { value: 'validados', selected: p.cliente_ve !== 'todos' }, 'Só registros validados'), h('option', { value: 'todos', selected: p.cliente_ve === 'todos' }, 'Todos, inclusive aguardando validação'));
      const ok = await modal(novo ? 'Novo projeto' : 'Editar projeto', h('div', null,
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Identificador (sem espaços)'), id), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), nome),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Formulário'), fo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Sistema de coordenadas da exportação'), ep),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prefixo das fotos'), pre, h('div', { class: 'dica' }, 'As fotos ficam como DCIM/prefixo_AAAAMMDDhhmmssmmm.jpg, igual ao QField.')),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Contratante'), contr), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nº do contrato'), ncon)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Município'), mun), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Meta de registros'), meta)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Responsável técnico (sai no relatório)'), rt),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Registro profissional'), reg), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'ART'), art)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'O cliente vê no portal'), cve),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Tipos de serviço das ordens de serviço'), tos)),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const pid = Q2F.slug(id.value || nome.value); if (!pid || !nome.value.trim()) return toast('Preencha identificador e nome.');
      if (novo && projetos.some((x) => x.id === pid)) return toast('Já existe projeto com esse identificador.');
      try { await Api.b.projetoSalvar(Object.assign({}, p, { id: pid, nome: nome.value.trim(), formulario: fo.value, epsg: ep.value, prefixo: Q2F.slug(pre.value || pid), contratante: contr.value.trim(), contrato: ncon.value.trim(), municipio: mun.value.trim(), meta: String(parseInt(meta.value, 10) || ''), cliente_ve: cve.value, responsavel: rt.value.trim(), registro_profissional: reg.value.trim(), art: art.value.trim(), tipos_os: tos.value.split('\n').map((x) => x.trim()).filter(Boolean).join('; ') })); toast('Projeto salvo.'); await recarregarSessao(); telaAdmin('projetos'); } catch (e) { toast(e.message, 5000); }
    }
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Projetos'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Projeto'), h('th', null, 'Formulário'), h('th', null, '')),
        projetos.map((p) => h('tr', null, h('td', null, h('b', null, p.nome), h('br'), h('small', null, [p.id, p.municipio, p.meta ? 'meta ' + fmtN(+p.meta) : ''].filter(Boolean).join(' · '))), h('td', null, (forms.find((f) => f.id === p.formulario) || {}).nome || p.formulario),
          h('td', null, h('button', { class: 'btn sec peq', onclick: () => editar(p) }, 'Editar'))))),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => editar(null) }, '+ Novo projeto'),
      h('p', { class: 'dica' }, Api.demo ? '' : 'Cada projeto novo ganha uma pasta no Drive com a planilha e a subpasta DCIM das fotos.')));
  }

  async function adminUsuarios(corpo) {
    const [us, projetos] = await Promise.all([Api.b.usuariosListar(), Api.b.projetosListar()]);
    const PERFIS = [['coletor', 'Equipe de campo (coleta)'], ['revisor', 'Revisão técnica (valida registros)'], ['cliente', 'Cliente (consulta painel, mapa e relatório)'], ['admin', 'Coordenação (acesso total)']];
    async function editar(u) {
      const novo = !u; u = u || { login: '', nome: '', perfil: 'coletor', projeto: S.projeto ? S.projeto.id : '', equipe: '', ativo: 'sim' };
      const lo = h('input', { class: 'entrada', value: u.login, disabled: !novo, autocapitalize: 'none', placeholder: 'ex.: div-1' });
      const no = h('input', { class: 'entrada', value: u.nome || '', placeholder: 'ex.: Equipe 1' });
      const se = h('input', { class: 'entrada', type: 'text', autocomplete: 'new-password', placeholder: novo ? 'mínimo 8 caracteres' : 'deixe em branco para manter' });
      const eq = h('input', { class: 'entrada', value: u.equipe || '', placeholder: 'ex.: Equipe 1' });
      const cod = h('input', { class: 'entrada', value: u.codigo || '', autocapitalize: 'characters', placeholder: 'ex.: E1' });
      const em = h('input', { class: 'entrada', type: 'email', value: u.email || '', placeholder: 'opcional' });
      const pe = h('select', { class: 'entrada' }, PERFIS.map(([v, t]) => h('option', { value: v, selected: (u.perfil === 'campo' ? 'coletor' : u.perfil) === v }, t)));
      const at = h('input', { type: 'checkbox', checked: String(u.ativo || 'sim').toLowerCase() !== 'nao' });
      const marcados = new Set(String(u.projeto || '').split(',').map((x) => x.trim()));
      const prj = h('div', { class: 'chips' }, projetos.map((p) => { const b = h('button', { class: 'chip' + (marcados.has(p.id) ? ' sel' : ''), onclick: () => { b.classList.toggle('sel'); if (marcados.has(p.id)) marcados.delete(p.id); else marcados.add(p.id); } }, p.nome); return b; }));
      const ok = await modal(novo ? 'Novo usuário' : 'Editar usuário', h('div', null,
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Usuário'), lo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, novo ? 'Senha' : 'Nova senha'), se)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Perfil'), pe),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), no), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe'), eq)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Código da equipe'), cod), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Email'), em)),
        h('div', { class: 'dica' }, 'O código da equipe vira o prefixo dos códigos das árvores (E1 gera E1-0001, E1-0002...). Use um diferente para cada equipe.'),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projetos liberados'), prj), h('label', null, at, ' Usuário ativo')),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const login = lo.value.trim().toLowerCase();
      if (!login) return toast('Preencha o usuário.');
      if (se.value.trim() && se.value.trim().length < 8 && !Api.demo) return toast('A senha precisa ter pelo menos 8 caracteres.');
      if (novo && !se.value.trim()) return toast('Defina a senha.');
      if (novo && us.some((x) => x.login === login)) return toast('Esse usuário já existe.');
      const dados = { login, nome: no.value.trim() || login, perfil: pe.value, projeto: pe.value === 'admin' ? '*' : [...marcados].filter(Boolean).join(','), equipe: eq.value.trim(), codigo: cod.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), email: em.value.trim(), ativo: at.checked ? 'sim' : 'nao' };
      if (se.value.trim()) dados.senha = se.value.trim();
      if (pe.value === 'coletor' && !dados.codigo) return toast('Defina o código da equipe (ex.: E1).');
      if (pe.value === 'coletor' && us.some((x) => x.login !== login && x.codigo === dados.codigo && String(x.projeto).split(',').some((p) => dados.projeto.split(',').includes(p)))) return toast('Outra equipe deste projeto já usa o código ' + dados.codigo + '.');
      try { await Api.b.usuarioSalvar(dados); toast('Usuário salvo.'); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); }
    }
    async function remover(u) { if (u.login === S.sessao.u) return toast('Você não pode remover o próprio usuário.'); if (await confirmar('Remover', `Remover o usuário ${u.login}? Os registros feitos por ele continuam na planilha.`, 'Remover', 'perigo')) { try { await Api.b.usuarioRemover(u.login); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); } } }
    async function desbloquear(u) { try { await Api.b.usuarioDesbloquear(u.login); toast('Usuário desbloqueado.'); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); } }
    const nomeP = (ids) => ids === '*' ? 'Todos' : String(ids || '').split(',').map((i) => (projetos.find((p) => p.id === i.trim()) || {}).nome || i).join(', ');
    const rotP = (p) => (PERFIS.find((x) => x[0] === (p === 'campo' ? 'coletor' : p)) || [p, p])[1].replace(/\s*\(.*\)/, '');
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Usuários'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Usuário'), h('th', null, 'Perfil e projetos'), h('th', null, '')),
        us.map((u) => h('tr', { class: String(u.ativo).toLowerCase() === 'nao' ? 'inativo' : '' }, h('td', null, h('b', null, u.login), h('br'), h('small', null, u.nome || ''), u.bloqueado ? h('span', { class: 'tag-alerta' }, 'bloqueado') : null, String(u.ativo).toLowerCase() === 'nao' ? h('span', { class: 'tag-cinza' }, 'inativo') : null),
          h('td', null, rotP(u.perfil), u.codigo ? ` · ${u.codigo}` : '', h('br'), h('small', null, nomeP(u.projeto)), u.senha_antiga ? h('div', null, h('small', { class: 'dica' }, 'senha ainda no formato antigo: é convertida no próximo acesso')) : null),
          h('td', { style: 'white-space:nowrap' }, u.bloqueado ? h('button', { class: 'btn peq', onclick: () => desbloquear(u) }, 'Desbloquear') : null, ' ', h('button', { class: 'btn sec peq', onclick: () => editar(u) }, 'Editar'), ' ', h('button', { class: 'btn perigo peq', onclick: () => remover(u) }, 'Excluir'))))),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => editar(null) }, '+ Novo usuário'),
      h('p', { class: 'dica' }, 'Equipe de campo coleta; revisão técnica valida ou devolve registros; cliente só consulta painel, mapa e relatório dos dados validados; coordenação faz tudo. Senhas ficam guardadas de forma criptografada e o usuário é bloqueado por 15 minutos após 5 senhas erradas. Senha com no mínimo 8 caracteres.')));
  }

  async function adminFormularios(corpo) {
    const forms = await Api.b.formulariosListar();
    const qml = h('input', { type: 'file', accept: '.qml' });
    const gp = h('input', { type: 'file', accept: '.gpkg' });
    const nome = h('input', { class: 'entrada', placeholder: 'ex.: Censo PMAU Divinópolis' });
    const msg = h('div');
    async function importar() {
      try {
        if (!qml.files[0] && !gp.files[0]) throw new Error('Escolha o .qml e/ou o .gpkg.');
        let info = null, texto = null;
        if (gp.files[0]) info = await Gpkg.ler(await gp.files[0].arrayBuffer());
        if (qml.files[0]) texto = await qml.files[0].text(); else if (info && info.estilo) texto = info.estilo;
        if (!texto) throw new Error('O GeoPackage não tem estilo salvo dentro dele. Envie também o .qml.');
        const nm = nome.value.trim() || (info && info.table) || 'Formulário';
        const form = Q2F.convert(texto, { gpkg: info, nome: nm, id: Q2F.slug(nm) });
        if (!info) form.avisos.unshift('Sem o .gpkg os tipos de campo foram deduzidos pelo nome. Confira os números na revisão.');
        S.revisao = { form, qml: texto, novo: true }; ir('#admin/revisao');
      } catch (e) { msg.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    }
    async function exemplo() {
      try { for (const arq of ['divinopolis-inventario', 'seade-risco']) { const f = await (await fetch(`forms/${arq}.json`)).json(); const q = await fetch(`forms/${arq}.qml`).then((r) => (r.ok ? r.text() : null)).catch(() => null); await Api.b.formularioSalvar(f, q); } toast('Formulários instalados.'); if (S.form) S.form = await carregarForm(S.form.id); telaAdmin('formularios'); } catch (e) { toast(e.message, 5000); }
    }
    async function editar(id) { const form = await Api.b.formulario(id); S.revisao = { form: JSON.parse(JSON.stringify(form)), qml: null, novo: false }; ir('#admin/revisao'); }
    corpo.replaceChildren(
      h('div', { class: 'cartao' }, h('h3', null, 'Formulários'),
        forms.length ? h('table', { class: 'tab' }, forms.map((f) => h('tr', null, h('td', null, h('b', null, f.nome), h('br'), h('small', null, `${f.id} · ${f.campos} campos${f.versao ? ' · versão ' + f.versao : ''}`)), h('td', null, h('button', { class: 'btn sec peq', onclick: () => editar(f.id) }, 'Revisar'))))) : h('p', null, 'Nenhum formulário ainda.'),
        h('button', { class: 'btn sec', style: 'margin-top:10px', onclick: exemplo }, forms.some((f) => f.id === 'divinopolis-inventario') ? 'Atualizar formulários prontos (inventário Divinópolis e risco)' : 'Instalar formulários prontos (inventário Divinópolis e risco)')),
      h('div', { class: 'cartao' }, h('h3', null, 'Importar do QGIS'),
        h('p', { class: 'dica' }, 'No QGIS: Propriedades da camada > Estilo > Salvar estilo (.qml) com todas as categorias. Envie também o .gpkg da camada para trazer os tipos de campo e a lista de espécies.'),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome do formulário'), nome),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Estilo (.qml)'), qml),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'GeoPackage (.gpkg)'), gp),
        msg, h('button', { class: 'btn', onclick: importar }, 'Converter e revisar')));
  }

  function adminRevisao(corpo) {
    const R = S.revisao; if (!R) return ir('#admin/formularios');
    const f = R.form;
    const nome = h('input', { class: 'entrada', value: f.nome });
    const id = h('input', { class: 'entrada', value: f.id, disabled: !R.novo });
    const tiposLivres = { text: 'Texto', textarea: 'Texto longo', number: 'Número', multinumber: 'Números por fuste (;)', species: 'Espécie (lista)', date: 'Data', datetime: 'Data e hora' };
    const fixos = { choice: 'Lista de opções', bool: 'Sim/não', photo: 'Foto', hidden: 'Oculto' };
    const linhas = [];
    for (const a of f.abas) {
      linhas.push(h('tr', null, h('td', { class: 'rev-aba', colspan: 3 }, a.nome)));
      for (const x of a.campos) {
        const c = f.campos.find((k) => k.nome === x.campo); if (!c) continue;
        const rot = h('input', { type: 'text', value: c.rotulo, oninput: () => (c.rotulo = rot.value) });
        let tipo;
        if (c.calculado) tipo = h('small', null, 'Calculado');
        else if (fixos[c.tipo]) tipo = h('small', null, fixos[c.tipo] + (c.opcoes ? ` (${c.opcoes.length})` : ''));
        else tipo = h('select', { onchange: () => (c.tipo = tipo.value) }, Object.entries(tiposLivres).map(([v, t]) => h('option', { value: v, selected: c.tipo === v }, t)));
        const obr = h('input', { type: 'checkbox', checked: !!c.obrigatorio, disabled: c.calculado || c.tipo === 'bool', onchange: () => (c.obrigatorio = obr.checked) });
        linhas.push(h('tr', null, h('td', null, rot, h('small', { class: 'dica' }, c.nome)), h('td', null, tipo), h('td', { style: 'text-align:center' }, obr)));
      }
    }
    // ----- regras por classe -----
    f.regras = f.regras || [];
    const regrasBox = h('div');
    const curto = (t) => String(t).replace(/\s*\(.*$/, '');
    const EST = [['', 'Padrão'], ['obrig', 'Obrigatório'], ['opcional', 'Opcional'], ['oculto', 'Oculto']];
    function desenharRegras() {
      const escolhas = f.campos.filter((c) => c.tipo === 'choice');
      const livres = escolhas.filter((c) => !f.regras.some((r) => r.campo === c.nome));
      const add = h('select', { class: 'entrada', style: 'max-width:340px' }, h('option', { value: '' }, 'Adicionar regra a partir de...'), livres.map((c) => h('option', { value: c.nome }, c.rotulo)));
      add.addEventListener('change', () => { if (add.value) { f.regras.push({ campo: add.value, por: {} }); desenharRegras(); } });
      const tabelas = f.regras.map((rg, ri) => {
        const cc = f.campos.find((c) => c.nome === rg.campo); if (!cc) return null;
        const ops = cc.opcoes;
        const cel = (nome, op) => {
          const sel = h('select', { onchange: () => { rg.por[op.v] = rg.por[op.v] || {}; if (sel.value) rg.por[op.v][nome] = sel.value; else delete rg.por[op.v][nome]; pintar(sel); } }, EST.map(([v, t]) => h('option', { value: v, selected: ((rg.por[op.v] || {})[nome] || '') === v }, t)));
          const pintar = (el) => { el.style.background = { obrig: '#FFF4D6', opcional: '#E3F0F3', oculto: '#ECEFF1' }[el.value] || '#fff'; el.style.color = el.value === 'oculto' ? '#78909C' : ''; };
          pintar(sel); return h('td', null, sel);
        };
        const linhas = [];
        for (const a of f.abas) {
          const cs = a.campos.map((x) => f.campos.find((c) => c.nome === x.campo)).filter((c) => c && c.tipo !== 'hidden' && c.nome !== rg.campo);
          if (!cs.length) continue;
          linhas.push(h('tr', null, h('td', { class: 'rev-aba' }, a.nome), ops.map((op) => {
            const s = h('select', { onchange: () => { rg.por[op.v] = rg.por[op.v] || {}; for (const c of cs) { if (s.value) rg.por[op.v][c.nome] = s.value; else delete rg.por[op.v][c.nome]; } desenharRegras(); } },
              h('option', { value: '' }, 'Aba toda...'), EST.map(([v, t]) => h('option', { value: v }, t)));
            return h('td', { class: 'rev-aba' }, s);
          })));
          for (const c of cs) linhas.push(h('tr', null, h('td', null, c.rotulo, c.obrigatorio ? h('span', { class: 'obr', style: 'color:var(--erro)' }, ' *') : null), ops.map((op) => cel(c.nome, op))));
        }
        return h('div', { style: 'margin-top:14px' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' }, h('b', null, 'Conforme: ' + cc.rotulo), h('button', { class: 'btn perigo peq', onclick: () => { f.regras.splice(ri, 1); desenharRegras(); } }, 'Remover regra')),
          h('div', { style: 'overflow-x:auto' }, h('table', { class: 'tab', style: 'min-width:' + (220 + ops.length * 130) + 'px' },
            h('tr', null, h('th', null, 'Campo'), ops.map((op) => h('th', null, curto(op.t)))), linhas)));
      });
      regrasBox.replaceChildren(h('p', { class: 'dica' }, 'Padrão segue a coluna "Obrig." acima (* = obrigatório). Oculto some do formulário e não é exigido. Quando duas regras se cruzam, vale a de baixo (a mais específica); oculto sempre vence.'), ...tabelas, livres.length ? h('div', { style: 'margin-top:12px' }, add) : null);
    }
    desenharRegras();
    const esp = h('textarea', { class: 'entrada', style: 'min-height:180px;font-size:14px' });
    esp.value = (f.especies || []).map((e) => e.cientifico + (e.popular ? ' ; ' + e.popular : '')).join('\n');
    async function salvar() {
      f.nome = nome.value.trim() || f.nome; if (R.novo) f.id = Q2F.slug(id.value || f.nome);
      f.especies = esp.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [c, p] = l.split(';').map((x) => (x || '').trim()); return { cientifico: c, popular: p || '' }; });
      f.versao = (f.versao || 0) + 1; delete f.avisos;
      try { await Api.b.formularioSalvar(f, R.qml); toast('Formulário salvo.'); S.revisao = null; if (S.form && S.form.id === f.id) S.form = await carregarForm(f.id); ir('#admin/formularios'); } catch (e) { toast(e.message, 5000); }
    }
    corpo.replaceChildren(
      h('div', { class: 'cartao' }, h('h3', null, 'Revisar formulário'),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), nome), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Identificador'), id)),
        (f.avisos || []).length ? h('div', { class: 'aviso' }, h('b', null, 'Atenção na importação:'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, f.avisos.map((a) => h('li', null, a)))) : null,
        h('p', { class: 'dica' }, `${f.abas.length} abas · ${f.campos.length} campos · ${(f.especies || []).length} espécies`)),
      h('div', { class: 'cartao' }, h('h3', null, 'Campos'), h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Rótulo no app'), h('th', null, 'Tipo'), h('th', null, 'Obrig.')), linhas)),
      h('div', { class: 'cartao' }, h('h3', null, 'Regras por classe'), regrasBox),
      h('div', { class: 'cartao' }, h('h3', null, 'Lista de espécies'), h('p', { class: 'dica' }, 'Uma por linha. Nome popular opcional depois de ponto e vírgula. Ex.: Tipuana tipu ; tipuana'), esp),
      h('div', { class: 'linha-btn', style: 'margin-bottom:30px' }, h('button', { class: 'btn sec', onclick: () => { S.revisao = null; ir('#admin/formularios'); } }, 'Cancelar'), h('button', { class: 'btn', onclick: salvar }, 'Salvar formulário')));
  }

  // ---------- Ficha (leitura) e trava de registros concluídos ----------
  function rotuloOpcao(c, v) { if (v == null || v === '') return ''; const o = (c.opcoes || []).find((x) => String(x.v) === String(v)); return o ? o.t : String(v); }
  // dia no fuso de Brasília, igual ao servidor
  const diaLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; try { return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); } catch (e) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; } };
  function distM(a1, o1, a2, o2) { const R = 6371000, t = Math.PI / 180; const dA = (a2 - a1) * t, dO = (o2 - o1) * t; const x = Math.sin(dA / 2) ** 2 + Math.cos(a1 * t) * Math.cos(a2 * t) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
  // volta o registro como estava antes da edição e apaga as fotos novas que não foram confirmadas
  async function descartarEdicao(r) {
    if (!r.__base) return;
    const base = JSON.parse(r.__baseFotos || '{}'); const manter = new Set(Object.values(base).map((f) => f && f.chave));
    for (const f of Object.values(r.fotos || {})) if (f && f.chave && !manter.has(f.chave)) await Store.apagarFoto(f.chave);
    r.valores = JSON.parse(r.__base); r.fotos = base;
    const bp = JSON.parse(r.__basePos || 'null'); if (bp) Object.assign(r, bp);
    delete r.__base; delete r.__baseFotos; delete r.__basePos; await Store.salvarRegistro(r);
  }
  function podeEditar(r) {
    if (perfil() === 'cliente') return { ok: false, motivo: 'Perfil de consulta.' };
    if (ehCoord()) return { ok: true };
    if (r.validacao === 'Validado') return { ok: false, motivo: 'Registro validado pela coordenação. Para corrigir, fale com a coordenação.' };
    if (r.status === 'recusado') return { ok: false, motivo: 'Alteração recusada pelo servidor.' };
    if (r.validacao === 'Devolvido') return { ok: true };
    if (diaLocal(r.concluido_em || r.criado_em) === diaLocal(agoraISO())) return { ok: true };
    return { ok: false, motivo: 'Registro concluído em dia anterior. Só a coordenação pode alterar.' };
  }
  function valorTexto(c, v) {
    if (v == null || v === '' || v === false || v === 0 && c.tipo === 'bool') return '';
    if (c.tipo === 'bool') return v === true || v === 1 || v === '1' ? 'Sim' : '';
    if (c.tipo === 'choice') return rotuloOpcao(c, v);
    if (c.tipo === 'datetime' || c.tipo === 'date') { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString('pt-BR', c.tipo === 'date' ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' }); }
    if (typeof v === 'number') return numBR(Math.round(v * 100) / 100);
    if (c.tipo === 'multinumber') return String(v).split(';').join(' + ');
    return String(v);
  }
  // Conteúdo da ficha, por etapa. get(c) devolve o valor; fotos = [{ rotulo, src, link }]
  function fichaConteudo(form, valores, fotos) {
    const E = estadoCampos(form, valores);
    const secoes = [];
    for (const a of form.abas) {
      const linhas = []; const marc = [];
      for (const x of a.campos) {
        const c = form.campos.find((k) => k.nome === x.campo); if (!c || c.tipo === 'hidden' || c.tipo === 'photo' || E[c.nome].oculto) continue;
        const t = valorTexto(c, valores[c.nome]); if (!t) continue;
        if (c.tipo === 'bool') marc.push((x.grupo ? x.grupo + ': ' : '') + c.rotulo);
        else linhas.push(h('div', { class: 'fl' }, h('span', null, c.rotulo), c.tipo === 'species' ? h('i', null, t) : h('b', null, t)));
      }
      if (marc.length) linhas.push(h('div', { class: 'fl col' }, h('span', null, 'Marcados'), h('div', { class: 'chips' }, marc.map((m) => h('span', { class: 'chip sel mini' }, m)))));
      if (linhas.length) secoes.push(h('section', { class: 'cartao ficha-sec' }, h('h3', null, a.nome), linhas));
    }
    if (fotos && fotos.length) secoes.push(h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Fotos'), h('div', { class: 'ficha-fotos' }, fotos.map((f) => h(linkSeguro(f.link) || f.src ? 'a' : 'div', { href: linkSeguro(f.link) || f.src, target: '_blank', rel: 'noopener', class: 'ficha-foto', 'data-drive': f.drive || null }, f.src ? h('img', { src: f.src, alt: f.rotulo, loading: 'lazy', onerror: (e) => e.target.remove() }) : null, h('span', null, f.rotulo))))));
    return secoes;
  }
  const ROT_VAL = { Pendente: 'Aguardando validação', Validado: 'Validado', Devolvido: 'Devolvido para correção', Corrigido: 'Corrigido, aguardando nova validação', Descartado: 'Descartado' };
  async function telaFichaLocal(r) {
    const form = S.form; const pe = podeEditar(r);
    const fotos = [];
    for (const c of form.campos.filter((k) => k.tipo === 'photo')) { const f = r.fotos[c.nome]; if (!f) continue; const b = f.chave ? await Store.foto(f.chave) : null; fotos.push({ rotulo: c.rotulo, src: b ? URL.createObjectURL(b) : null, link: f.url || '' }); }
    const st = r.status === 'recusado' ? 'Recusado pelo servidor: ' + (r.erroSync || '') : r.status === 'pendente' ? (r.erroSync ? 'Erro no envio: ' + r.erroSync : 'Aguardando envio') : (ROT_VAL[r.validacao || 'Pendente'] || 'Enviado');
    const descartarLocal = async () => { if (!(await confirmar('Remover do aparelho', 'A versão que está no servidor continua valendo. Remover a cópia deste aparelho?', 'Remover', 'perigo'))) return; for (const f of Object.values(r.fotos || {})) if (f && f.chave && !f.enviado) await Store.apagarFoto(f.chave); await Store.apagarRegistro(r.uuid); ir('#inicio'); };
    const editar = async () => {
      const ok = await modal('Alterar registro concluído', h('div', null, h('p', null, 'Este registro já foi concluído' + (r.status === 'enviado' ? ' e enviado' : '') + '. Se você alterar, a mudança fica guardada no histórico com seu usuário, data e hora.'),
        r.validacao === 'Devolvido' && r.validacao_obs ? h('div', { class: 'aviso' }, 'Motivo da devolução: ' + r.validacao_obs) : null), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Editar registro', valor: true }]);
      if (!ok) return; S.editando.add(r.uuid); S.aba = 0; S.tentou = false; S.reg = null; telaForm(r.uuid);
    };
    $app.replaceChildren(topo(codigoDe(form, r.valores) || 'Registro', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        h('div', { class: 'cartao status-ficha st-' + norm(r.status === 'pendente' ? 'pendente' : r.validacao || 'enviado') }, h('b', null, st),
          r.validacao === 'Devolvido' && r.validacao_obs ? h('p', null, 'Motivo: ' + r.validacao_obs) : null,
          h('small', null, `Concluído em ${dataBR(r.concluido_em || r.criado_em)} · ${r.equipe || ''}${r.prec ? ' · GPS ±' + Math.round(r.prec) + ' m' : ''}`),
          r.conflito ? h('p', { class: 'trava' }, r.conflito) : null,
          r.status === 'recusado' ? h('p', { class: 'trava' }, 'Esta alteração não foi aceita. Fale com a coordenação ou remova a cópia do aparelho.', h('br'), h('button', { class: 'btn perigo peq', style: 'margin-top:8px', onclick: descartarLocal }, 'Remover do aparelho')) : null,
          !pe.ok && r.status !== 'recusado' ? h('p', { class: 'trava' }, pe.motivo) : null),
        fichaConteudo(form, r.valores, fotos),
        secaoOSArvore(r.uuid, r.status === 'enviado'),
        (r.historico || []).length ? h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Histórico de alterações'), r.historico.map((x) => h('div', { class: 'hist' }, h('small', null, `${dataBR(x.em)} · ${x.por}`), h('ul', null, x.mud.map((m) => h('li', null, m)))))) : null,
        h('div', { class: 'linha-btn', style: 'margin:8px 0 30px' }, h('button', { class: 'btn sec', onclick: () => ir('#inicio') }, 'Voltar'), pe.ok ? h('button', { class: 'btn', onclick: editar }, 'Editar registro') : null)));
  }

  // ---------- Termo de uso e privacidade ----------
  function textoTermo() {
    return h('div', { class: 'termo' },
      h('p', null, 'Este aplicativo é da Neofloresta Serviços Ecossistêmicos Ltda. e serve para registrar o inventário da arborização urbana nos projetos contratados.'),
      h('h4', null, 'Dados pessoais tratados'),
      h('p', null, 'Usuário, nome e equipe de quem usa o app, data, hora e posição do aparelho no momento de cada registro, e o modelo do aparelho. Não coletamos contatos, arquivos pessoais nem a localização fora do registro das árvores.'),
      h('h4', null, 'Para que usamos'),
      h('p', null, 'Identificar quem fez cada registro, garantir a qualidade e a rastreabilidade do inventário (histórico de alterações e registro de auditoria) e cumprir o contrato com o cliente. A base legal é a execução de contrato e o legítimo interesse (Lei 13.709/2018, art. 7º, incisos V e IX).'),
      h('h4', null, 'Onde ficam e por quanto tempo'),
      h('p', null, 'Em planilhas e pastas do Google Drive da Neofloresta, com acesso restrito à coordenação, e no próprio aparelho até o envio. Guardamos durante o contrato e pelo prazo exigido para prestação de contas. O cliente recebe os dados do inventário, sem os dados internos das equipes.'),
      h('h4', null, 'Fotos e dados do inventário'),
      h('p', null, 'As fotos são das árvores e do seu entorno. Evite enquadrar pessoas, placas de veículos e o interior de imóveis; se aparecerem, a foto é usada só como registro técnico. Os dados do inventário pertencem ao contratante, que é o controlador; a Neofloresta atua como operadora e usa serviços do Google (Planilhas e Drive) para guardar e processar os dados, o que pode envolver servidores fora do Brasil. Ao fim do contrato, os dados e as fotos são entregues ao contratante e as cópias da Neofloresta são descartadas no prazo combinado em contrato.'),
      h('h4', null, 'Segurança'),
      h('p', null, 'Conexão criptografada (HTTPS), senha guardada de forma criptografada, bloqueio após senhas erradas, sessão com prazo de validade e cópia de segurança diária.'),
      h('h4', null, 'Seus direitos'),
      h('p', null, 'Você pode pedir acesso, correção ou exclusão dos seus dados pessoais à coordenação do projeto' + (CONTATO.email ? ' ou pelo email ' + CONTATO.email : '') + '.' + (CONTATO.encarregado ? ' Encarregado de dados: ' + CONTATO.encarregado + '.' : '')),
      h('h4', null, 'Uso correto'),
      h('p', null, 'O usuário e a senha são pessoais. Não compartilhe. Registre apenas informações verdadeiras observadas em campo.'),
      h('p', { class: 'dica' }, 'Versão do termo: ' + TERMO_VERSAO));
  }
  function verTermo() { modal('Termo de uso e privacidade', textoTermo(), [{ texto: 'Fechar', valor: true }]); }
  function telaTermo() {
    const btn = h('button', { class: 'btn cheio', onclick: async () => {
      btn.disabled = true;
      try { await Api.b.aceitarTermo(TERMO_VERSAO).catch((e) => { if (!/desconhecida/i.test(e.message)) throw e; }); S.sessao.usuario.termo_aceito_em = agoraISO(); await Store.set('sessao', S.sessao); await Store.set('termo:' + S.sessao.u, S.sessao.usuario.termo_aceito_em); rota(); } catch (e) { toast(e.message, 5000); btn.disabled = false; }
    } }, 'Li e aceito');
    $app.replaceChildren(topo('Termo de uso e privacidade', 'Leia antes de começar', null, null), h('main', null, h('div', { class: 'cartao' }, textoTermo()), h('div', { style: 'margin-bottom:30px' }, btn, h('button', { class: 'btn linha cheio', style: 'margin-top:10px', onclick: () => sair(true) }, 'Não aceito, sair'))));
  }
  function telaSobre() {
    $app.replaceChildren(topo('Sobre', 'Neofloresta Inventário', h('button', { class: 'ic', onclick: () => history.back(), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        h('div', { class: 'cartao sobre' }, h('img', { src: 'icons/logo-horizontal.png', alt: 'Neofloresta', style: 'max-width:240px' }),
          h('p', null, h('b', null, 'Neofloresta Inventário'), ' · versão ', VERSAO, S.sessao && S.sessao.versaoScript ? ' · servidor ' + S.sessao.versaoScript : ''),
          h('div', { class: 'linha-btn' }, S.novaVersao ? h('button', { class: 'btn', onclick: atualizarApp }, `Atualizar para a versão ${S.novaVersao.versao}`) : h('button', { class: 'btn sec', onclick: async () => { await verificarAtualizacao(true); if (S.novaVersao) telaSobre(); } }, 'Verificar atualização')),
          h('p', null, 'Coleta de campo, validação, painel e entrega dos dados do inventário da arborização urbana. Funciona sem internet: os registros ficam no aparelho e são enviados quando houver conexão.'),
          h('p', { class: 'dica' }, ['Neofloresta Serviços Ecossistêmicos Ltda.', CONTATO.cnpj ? 'CNPJ ' + CONTATO.cnpj : '', CONTATO.cidade || 'Dois Vizinhos/PR'].filter(Boolean).join(' · ')),
          CONTATO.email || CONTATO.telefone ? h('p', null, 'Suporte: ', [CONTATO.email, CONTATO.telefone].filter(Boolean).join(' · ')) : null),
        h('div', { class: 'cartao' }, h('h3', null, 'Termo de uso e privacidade'), textoTermo(), S.sessao && S.sessao.usuario.termo_aceito_em ? h('p', { class: 'dica' }, 'Aceito em ' + dataBR(S.sessao.usuario.termo_aceito_em)) : null)));
  }

  // ---------- Painel, relatório e validação ----------
  const COR_RISCO = { Baixo: '#3CB300', 'Médio': '#D9C21E', Alto: '#E10000', Severo: '#7606DE', Extremo: '#7606DE' };
  const ROT_CURTO = { Pendente: 'Aguardando', Validado: 'Validados', Corrigido: 'Corrigidos', Devolvido: 'Devolvidos', Descartado: 'Descartados' };
  const COR_VAL = { Validado: '#2E7D32', Pendente: '#8A969C', Corrigido: '#12A6C8', Devolvido: '#CD834C', Descartado: '#B0BEC5' };
  const CORES = ['#00546E', '#CD834C', '#12A6C8', '#5B8C5A', '#8E6C8A', '#C9A227'];
  const pl = (n, um, varios) => `${fmtN(n)} ${n === 1 ? um : varios}`;
  const fmtN = (n) => (n == null ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const fmtP = (x) => (x == null || !isFinite(x) ? '' : (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
  function barras(itens, opts = {}) {
    if (!itens.length || !itens.some((i) => i.n)) return h('p', { class: 'dica' }, 'Sem dados ainda.');
    const max = Math.max(1, ...itens.map((i) => i.n)); const tot = opts.total || itens.reduce((a, i) => a + i.n, 0);
    return h('div', { class: 'barras' }, itens.map((i, k) => h('div', { class: 'barra' },
      h('span', { class: 'b-rot', title: i.rot }, i.it ? h('i', null, i.rot) : i.rot),
      h('span', { class: 'b-tri' }, h('span', { class: 'b-enc', style: `width:${(100 * i.n / max).toFixed(1)}%;background:${i.cor || opts.cor || CORES[0]}` })),
      h('span', { class: 'b-val' }, fmtN(i.n), opts.pct !== false && tot ? h('small', null, ' ' + fmtP(i.n / tot)) : null))));
  }
  function serieDias(porDia, equipes) {
    const dias = Object.keys(porDia).sort(); if (!dias.length) return h('p', { class: 'dica' }, 'Sem registros ainda.');
    const W = 640, H = 200, ml = 34, mb = 22, mt = 8; const bw = (W - ml - 8) / dias.length;
    const tot = dias.map((d) => equipes.reduce((a, e) => a + (porDia[d][e] || 0), 0)); const max = Math.max(1, ...tot);
    const passo = Math.pow(10, Math.floor(Math.log10(max))); const topo_ = Math.ceil(max / passo) * passo;
    const y = (v) => H - mb - (v / topo_) * (H - mb - mt);
    const ns = 'http://www.w3.org/2000/svg'; const el = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Registros por dia' });
    [0, topo_ / 2, topo_].forEach((v) => { svg.append(el('line', { x1: ml, x2: W - 4, y1: y(v), y2: y(v), stroke: '#E3E8EA' })); svg.append(el('text', { x: ml - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5B6B72' }, fmtN(v))); });
    dias.forEach((d, i) => {
      let acc = 0; const x = ml + i * bw + bw * 0.15, w = Math.max(1, bw * 0.7);
      equipes.forEach((e, k) => { const v = porDia[d][e] || 0; if (!v) return; const r = el('rect', { x, width: w, y: y(acc + v), height: y(acc) - y(acc + v), fill: CORES[k % CORES.length], rx: 1.5 }); r.append(el('title', {}, `${d.slice(8, 10)}/${d.slice(5, 7)} · ${e}: ${v}`)); svg.append(r); acc += v; });
      const k = Math.max(1, Math.ceil(dias.length / 10)); if (i % k === 0) svg.append(el('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 10, fill: '#5B6B72' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`));
    });
    return h('div', null, svg, h('div', { class: 'leg' }, equipes.map((e, k) => h('span', null, h('i', { style: `background:${CORES[k % CORES.length]}` }), e))));
  }
  const kpi = (rot, val, sub, cls) => h('div', { class: 'kpi ' + (cls || '') }, h('small', null, rot), h('b', null, val), sub ? h('span', null, sub) : null);

  async function dadosPainel(forcar) {
    const chave = S.projeto.id;
    if (!forcar && S.painel && S.painel.id === chave && Date.now() - S.painel.t < 120000) return S.painel.d;
    const d = await Api.b.painel(chave); S.painel = { id: chave, t: Date.now(), d }; return d;
  }
  function analisarPainel(d, form) {
    const cRisco = form.campos.find((c) => c.tipo === 'choice' && /^risco$/i.test(norm(c.nome)));
    const cCat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const cSit = form.campos.find((c) => c.tipo === 'choice' && /situacao/i.test(norm(c.nome)));
    const risco = cRisco ? cRisco.opcoes.map((o) => ({ rot: o.t, n: (d.escolhas[cRisco.nome] || {})[o.v] || 0, cor: COR_RISCO[o.v] })) : [];
    const cat = cCat ? cCat.opcoes.map((o, k) => ({ rot: o.t.replace(/\s*\(.*\)/, ''), n: (d.escolhas[cCat.nome] || {})[o.v] || 0, cor: CORES[k % CORES.length] })) : [];
    const ind = cCat ? ['1', '2', '3'].reduce((a, v) => a + ((d.escolhas[cCat.nome] || {})[v] || 0), 0) : d.total;
    const sit = cSit ? cSit.opcoes.map((o) => ({ rot: o.t, n: (d.escolhas[cSit.nome] || {})[o.v] || 0 })) : [];
    const manejo = form.campos.filter((c) => c.tipo === 'bool' && /^manejo/i.test(c.nome) && !/nenhum/i.test(c.nome)).map((c) => ({ rot: c.rotulo, n: d.marcados[c.nome] || 0 })).sort((a, b) => b.n - a.n);
    const ocorr = form.campos.filter((c) => c.tipo === 'bool' && !/^manejo|ausente|nenhum|sem interfer/i.test(c.nome)).map((c) => ({ rot: c.rotulo + (form.abas.some((a) => a.campos.some((x) => x.campo === c.nome && x.grupo)) ? '' : ''), n: d.marcados[c.nome] || 0 })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 12);
    const val = ['Validado', 'Corrigido', 'Pendente', 'Devolvido'].map((k) => ({ rot: ROT_CURTO[k], n: d.validacao[k] || 0, cor: COR_VAL[k] }));
    const esp = (d.especies || []).map(([e, n]) => ({ rot: e, n, it: true }));
    const nEsp = d.especies.reduce((a, [, n]) => a + n, 0);
    const generos = {}; (d.especies || []).forEach(([e, n]) => { const g = String(e).split(/\s+/)[0]; if (g) generos[g] = (generos[g] || 0) + n; });
    const topEsp = esp[0] ? esp[0].n / Math.max(1, nEsp) : 0; const gen = Object.entries(generos).sort((a, b) => b[1] - a[1])[0];
    const topGen = gen ? gen[1] / Math.max(1, nEsp) : 0;
    const altoN = cRisco ? ((d.escolhas[cRisco.nome] || {}).Alto || 0) + ((d.escolhas[cRisco.nome] || {}).Severo || 0) : 0;
    const nRisco = risco.reduce((a, x) => a + x.n, 0);
    return { risco, cat, ind, sit, manejo, ocorr, val, esp, nEsp, topEsp, gen, topGen, altoN, nRisco };
  }
  async function telaPainel(forcar) {
    const corpo = h('main', { class: 'painel' }, h('div', { class: 'info' }, 'Carregando indicadores...'));
    const voltar = perfil() === 'cliente' ? h('button', { class: 'ic', onclick: abrirMenu, 'aria-label': 'Menu' }, ico('menu')) : h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar'));
    $app.replaceChildren(topo('Painel', S.projeto.nome, voltar, h('div', { class: 'topo-dir' }, h('button', { class: 'ic', onclick: () => ir('#mapa'), 'aria-label': 'Mapa' }, ico('mapa')))), corpo);
    let d; try { d = await dadosPainel(forcar); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, 'Não foi possível carregar o painel: ' + e.message)); return; }
    const A = analisarPainel(d, S.form); const p = d.projeto || S.projeto;
    const meta = +(p.meta || 0); const validados = d.validacao.Validado || 0;
    const equipes = Object.keys(d.equipes).sort();
    const dias = Object.keys(d.porDia).sort(); const ult7 = dias.slice(-7); const media7 = ult7.length ? ult7.reduce((a, x) => a + Object.values(d.porDia[x]).reduce((s, v) => s + v, 0), 0) / ult7.length : 0;
    const faltam = meta ? Math.max(0, meta - d.total) : 0; const previsao = meta && media7 ? Math.ceil(faltam / media7) : null;
    const alertas = [];
    if (A.topEsp > 0.1 && A.esp[0]) alertas.push(`A espécie mais comum (${A.esp[0].rot}) tem ${fmtP(A.topEsp)} dos indivíduos. A referência de diversidade recomenda no máximo 10% por espécie.`);
    if (A.topGen > 0.2 && A.gen) alertas.push(`O gênero ${A.gen[0]} tem ${fmtP(A.topGen)} dos indivíduos. A referência recomenda no máximo 20% por gênero.`);
    if (d.semCoordenada) alertas.push(`${fmtN(d.semCoordenada)} registro(s) sem coordenada.`);
    if (d.gps && d.gps.ate5m < 0.8) alertas.push(`Só ${fmtP(d.gps.ate5m)} dos pontos têm GPS com erro de até 5 m.`);
    const vazioCliente = perfil() === 'cliente' && !d.total ? h('div', { class: 'info' }, 'Ainda não há árvores validadas. Os números aparecem aqui assim que a Neofloresta concluir a conferência dos primeiros registros.') : null;
    corpo.replaceChildren(vazioCliente,
      h('div', { class: 'painel-cab' }, h('div', null, p.contratante ? h('div', null, p.contratante) : null, p.municipio ? h('small', null, p.municipio + (p.contrato ? ' · Contrato ' + p.contrato : '')) : null),
        h('small', null, (perfil() === 'cliente' ? 'Dados validados pela Neofloresta. ' : '') + 'Atualizado às ' + new Date(d.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), ' ', h('button', { class: 'btn sec peq', onclick: () => telaPainel(true) }, 'Atualizar'))),
      h('div', { class: 'kpis' },
        kpi('Registros', fmtN(d.total), `${fmtN(A.ind)} indivíduos e ${fmtN(d.total - A.ind)} pontos sem árvore` + (meta ? ` · ${fmtP(d.total / meta)} da meta de ${fmtN(meta)}` : '')),
        perfil() !== 'cliente' ? kpi('Validados', fmtN(validados), d.total ? fmtP(validados / d.total) + ' do total' : '') : kpi('Indivíduos', fmtN(A.ind), 'árvores, arbustos e palmeiras'),
        kpi('Espécies', fmtN(d.nEspecies), A.esp[0] ? 'mais comum: ' + A.esp[0].rot : ''),
        A.risco.length ? kpi('Risco alto', fmtN(A.altoN), A.nRisco ? fmtP(A.altoN / A.nRisco) + ' dos indivíduos avaliados' : '', A.altoN ? 'alerta' : '') : null,
        kpi('Ritmo', fmtN(Math.round(media7)), 'registros por dia (últimos 7 dias de campo)' + (previsao != null ? ` · faltam cerca de ${fmtN(previsao)} dias` : '')),
        d.gps ? kpi('Precisão do GPS', fmtN(d.gps.mediana) + ' m', fmtP(d.gps.ate5m) + ' com erro até 5 m') : null),
      alertas.length && perfil() !== 'cliente' ? h('div', { class: 'cartao alertas' }, h('h3', null, 'Pontos de atenção'), h('ul', null, alertas.map((a) => h('li', null, a)))) : null,
      h('div', { class: 'grade-cartoes' },
        h('div', { class: 'cartao larga' }, h('h3', null, 'Registros por dia de campo'), serieDias(d.porDia, equipes)),
        perfil() !== 'cliente' ? h('div', { class: 'cartao' }, h('h3', null, 'Situação da validação'), barras(A.val, { total: d.total })) : null,
        A.cat.length ? h('div', { class: 'cartao' }, h('h3', null, 'Categoria'), barras(A.cat)) : null,
        A.risco.length ? h('div', { class: 'cartao' }, h('h3', null, 'Classe de risco'), barras(A.risco)) : null,
        h('div', { class: 'cartao' }, h('h3', null, 'Espécies mais comuns'), barras(A.esp.slice(0, 12), { total: A.nEsp })),
        d.classesDap.length ? h('div', { class: 'cartao' }, h('h3', null, 'Classes de DAP'), barras(d.classesDap.map((c) => ({ rot: c.ate ? `${c.de} a ${c.ate} cm` : `${c.de} cm ou mais`, n: c.n })))) : null,
        A.manejo.length ? h('div', { class: 'cartao' }, h('h3', null, 'Manejo recomendado'), barras(A.manejo.filter((x) => x.n), { total: A.ind, cor: CORES[1] })) : null,
        A.ocorr.length ? h('div', { class: 'cartao' }, h('h3', null, 'Ocorrências observadas'), barras(A.ocorr, { total: A.ind, cor: CORES[2] })) : null,
        perfil() !== 'cliente' ? h('div', { class: 'cartao' }, h('h3', null, 'Por equipe'), barras(equipes.map((e, k) => ({ rot: e, n: d.equipes[e], cor: CORES[k % CORES.length] })))) : null),
      h('div', { class: 'linha-btn botoes-painel', style: 'margin:6px 0 30px' }, h('button', { class: 'btn', onclick: () => ir('#relatorio') }, 'Relatório para imprimir ou PDF'), h('button', { class: 'btn sec', onclick: () => ir('#medicao') }, 'Boletim de medição'), h('button', { class: 'btn sec', onclick: () => ir('#mapa') }, 'Ver no mapa'),
        perfil() === 'cliente' ? h('button', { class: 'btn sec', onclick: () => exportarCliente() }, 'Baixar dados') : null));
    pintarPainelOS(corpo);
  }
  function resumoOS(ordens) {
    const ativos = ordens.filter((o) => !o.__pend || o.numero);
    const porSt = {}; const porTipo = {}; ativos.forEach((o) => { porSt[o.status] = (porSt[o.status] || 0) + 1; porTipo[o.tipo] = porTipo[o.tipo] || {}; porTipo[o.tipo][o.status] = (porTipo[o.tipo][o.status] || 0) + 1; });
    const conc = ativos.filter((o) => o.status === 'Concluída' && o.concluida_em);
    const dias = conc.map((o) => (new Date(o.concluida_em) - new Date(o.solicitada_em || o.aberta_em)) / 864e5).filter((x) => isFinite(x) && x >= 0);
    const mes = diaLocal(agoraISO()).slice(0, 7);
    return { total: ativos.length, porSt, porTipo, atrasadas: ativos.filter(atrasada).length, concMes: conc.filter((o) => diaLocal(o.concluida_em).slice(0, 7) === mes).length, prazoMedio: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null };
  }
  async function pintarPainelOS(corpo) {
    let d; try { d = await carregarOS(false); } catch (e) { return; }
    if (d.semServidor || !d.ordens.length || !document.body.contains(corpo)) return;
    const r = resumoOS(d.ordens); const abertas = (r.porSt.Aberta || 0) + (r.porSt['Em execução'] || 0);
    const sec = h('section', { class: 'painel-os' }, h('h2', { class: 'painel-tit' }, 'Ordens de serviço'),
      h('div', { class: 'kpis' }, kpi('Em aberto', fmtN(abertas), `${fmtN(r.porSt['Em execução'] || 0)} em execução`), kpi('Pedidos a aprovar', fmtN(r.porSt.Solicitada || 0), ''), kpi('Atrasadas', fmtN(r.atrasadas), 'prazo vencido', r.atrasadas ? 'alerta' : ''),
        kpi('Concluídas no mês', fmtN(r.concMes), `${fmtN(r.porSt['Concluída'] || 0)} no total`), r.prazoMedio != null ? kpi('Tempo médio', fmtN(Math.round(r.prazoMedio * 10) / 10) + ' dias', 'do pedido à conclusão') : null),
      h('div', { class: 'grade-cartoes' },
        h('div', { class: 'cartao' }, h('h3', null, 'Situação'), barras(['Solicitada', 'Aberta', 'Em execução', 'Concluída', 'Cancelada'].map((k) => ({ rot: k, n: r.porSt[k] || 0, cor: COR_OS[k] })).filter((x) => x.n), { total: r.total })),
        h('div', { class: 'cartao' }, h('h3', null, 'Por tipo de serviço'), barras(Object.entries(r.porTipo).map(([t, o]) => ({ rot: t, n: Object.values(o).reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n), { total: r.total, cor: CORES[1] }))),
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn sec', onclick: () => ir('#ordens') }, 'Ver ordens de serviço')));
    const bt = corpo.querySelector('.botoes-painel'); if (bt) corpo.insertBefore(sec, bt); else corpo.append(sec);
  }
  function producaoTabela(porDia, dias, equipes, semanal) {
    const dt = (x) => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
    if (!semanal) return dias.map((x) => { const v = equipes.map((e) => porDia[x][e] || 0); return [dt(x), ...v.map(fmtN), fmtN(v.reduce((a, b) => a + b, 0))]; });
    const sem = new Map();
    for (const x of dias) { const d = new Date(x + 'T12:00:00Z'); const seg = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); if (!sem.has(seg)) sem.set(seg, {}); const o = sem.get(seg); equipes.forEach((e) => (o[e] = (o[e] || 0) + (porDia[x][e] || 0))); }
    return [...sem.entries()].map(([seg, o]) => { const v = equipes.map((e) => o[e] || 0); const fim = new Date(new Date(seg + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10); return [`${dt(seg).slice(0, 5)} a ${dt(fim)}`, ...v.map(fmtN), fmtN(v.reduce((a, b) => a + b, 0))]; });
  }
  async function telaRelatorio() {
    const corpo = h('main', { class: 'relatorio' }, h('div', { class: 'info' }, 'Montando o relatório...'));
    $app.replaceChildren(h('div', { class: 'nao-imprime' }, topo('Relatório', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#painel'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: () => window.print() }, 'Imprimir ou PDF'))), corpo);
    let d; try { d = await dadosPainel(); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, e.message)); return; }
    const A = analisarPainel(d, S.form); const p = d.projeto || S.projeto; const agora = new Date();
    const tab = (cab, linhas) => h('table', { class: 'tab-rel' }, h('thead', null, h('tr', null, cab.map((c) => h('th', null, c)))), h('tbody', null, linhas.map((l) => h('tr', null, l.map((c) => h('td', null, c))))));
    const pct = (n, t) => (t ? fmtP(n / t) : '');
    const equipes = Object.keys(d.equipes).sort(); const dias = Object.keys(d.porDia).sort();
    Api.b.auditar && Api.b.auditar('relatorio', S.projeto.id, '');
    corpo.replaceChildren(
      h('header', { class: 'rel-cab' }, h('img', { src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }), h('div', null, h('h1', null, 'Relatório de andamento do inventário'), h('p', null, p.nome), h('small', null, [p.contratante, p.municipio, p.contrato ? 'Contrato ' + p.contrato : ''].filter(Boolean).join(' · ')))),
      h('p', { class: 'rel-data' }, 'Emitido em ' + agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (perfil() === 'cliente' ? '. Considera apenas registros validados.' : '. Considera todos os registros enviados, exceto os descartados.')),
      h('h2', null, '1. Resumo'),
      tab(['Indicador', 'Valor'], [
        ['Registros', fmtN(d.total)], ['Indivíduos (árvores, arbustos e palmeiras)', fmtN(A.ind)], p.meta ? ['Meta do contrato', `${fmtN(p.meta)} (${fmtP(d.total / p.meta)} concluído)`] : null,
        ['Espécies distintas', fmtN(d.nEspecies)], perfil() !== 'cliente' ? ['Validados', `${fmtN(d.validacao.Validado || 0)} (${pct(d.validacao.Validado || 0, d.total)})`] : null,
        A.risco.length ? ['Indivíduos com risco alto', `${fmtN(A.altoN)} (${pct(A.altoN, A.nRisco)} dos avaliados)`] : null,
        ['Dias de campo', fmtN(dias.length)], d.gps ? ['Precisão mediana do GPS', fmtN(d.gps.mediana) + ' m'] : null].filter(Boolean)),
      A.cat.length ? [h('h2', null, '2. Registros por categoria'), tab(['Categoria', 'Quantidade', '%'], A.cat.map((c) => [c.rot, fmtN(c.n), pct(c.n, d.total)]))] : null,
      h('h2', null, '3. Composição de espécies'),
      h('p', null, `Foram registradas ${fmtN(d.nEspecies)} espécies. ` + (A.esp[0] ? `A mais comum é ${A.esp[0].rot}, com ${fmtP(A.topEsp)} dos indivíduos identificados` + (A.topEsp > 0.1 ? ', acima do limite de referência de 10% por espécie.' : ', dentro do limite de referência de 10% por espécie.') : '')),
      tab(['Espécie', 'Indivíduos', '%'], A.esp.slice(0, 30).map((e) => [h('i', null, e.rot), fmtN(e.n), pct(e.n, A.nEsp)])),
      d.classesDap.length ? [h('h2', null, '4. Classes de diâmetro (DAP)'), tab(['Classe', 'Indivíduos', '%'], d.classesDap.map((c) => [c.ate ? `${c.de} a ${c.ate} cm` : `${c.de} cm ou mais`, fmtN(c.n), pct(c.n, d.classesDap.reduce((a, x) => a + x.n, 0))]))] : null,
      A.risco.length ? [h('h2', null, '5. Classe de risco'), tab(['Classe', 'Indivíduos', '%'], A.risco.map((c) => [c.rot, fmtN(c.n), pct(c.n, A.nRisco)]))] : null,
      A.manejo.length ? [h('h2', null, '6. Manejo recomendado'), tab(['Manejo', 'Indivíduos', '%'], A.manejo.filter((x) => x.n).map((c) => [c.rot, fmtN(c.n), pct(c.n, A.ind)]))] : null,
      A.ocorr.length ? [h('h2', null, '7. Ocorrências observadas'), tab(['Ocorrência', 'Indivíduos', '%'], A.ocorr.map((c) => [c.rot, fmtN(c.n), pct(c.n, A.ind)]))] : null,
      h('h2', null, '8. Produção de campo'),
      h('p', null, dias.length > 14 ? 'Registros por semana (de segunda a domingo).' : 'Registros por dia de campo.'),
      tab([dias.length > 14 ? 'Semana' : 'Data', ...equipes, 'Total'], producaoTabela(d.porDia, dias, equipes, dias.length > 14)),
      h('div', { id: 'rel-os' }),
      p.responsavel ? h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, p.responsavel), p.registro_profissional ? h('div', null, p.registro_profissional) : null, p.art ? h('div', null, 'ART nº ' + p.art) : null, h('div', null, 'Responsável técnico · Neofloresta Serviços Ecossistêmicos Ltda.')) : null,
      h('footer', { class: 'rel-rodape' }, 'Neofloresta Serviços Ecossistêmicos Ltda. · Gerado pelo Neofloresta Inventário ' + VERSAO));
    try {
      const od = await carregarOS(false); const el = document.getElementById('rel-os');
      if (el && !od.semServidor && od.ordens.length) {
        const r = resumoOS(od.ordens); const sts = ['Solicitada', 'Aberta', 'Em execução', 'Concluída', 'Cancelada'];
        el.replaceChildren(h('h2', null, '9. Ordens de serviço'), h('p', null, `${fmtN(r.total)} ordens registradas, ${fmtN(r.porSt['Concluída'] || 0)} concluídas e ${fmtN(r.atrasadas)} com prazo vencido` + (r.prazoMedio != null ? `. Tempo médio do pedido à conclusão: ${fmtN(Math.round(r.prazoMedio * 10) / 10)} dias.` : '.')),
          tab(['Tipo de serviço', ...sts, 'Total'], [...Object.entries(r.porTipo).sort((a, b) => a[0].localeCompare(b[0], 'pt')).map(([t, o]) => [t, ...sts.map((k) => fmtN(o[k] || 0)), fmtN(Object.values(o).reduce((a, b) => a + b, 0))]), ['Total', ...sts.map((k) => fmtN(r.porSt[k] || 0)), fmtN(r.total)]]));
      }
    } catch (e) { /* sem ordens */ }
  }

  // ---------- Boletim de medição (registros validados num período) ----------
  async function telaMedicao() {
    const hoje = new Date(); const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const isoD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    S.periodo = S.periodo || { de: isoD(ini), ate: isoD(hoje) };
    const de = h('input', { class: 'entrada', type: 'date', value: S.periodo.de }); const ate = h('input', { class: 'entrada', type: 'date', value: S.periodo.ate });
    const corpo = h('div', { class: 'relatorio-corpo' });
    const gerar = async () => {
      S.periodo = { de: de.value, ate: ate.value };
      corpo.replaceChildren(h('div', { class: 'info nao-imprime' }, 'Carregando registros...'));
      let linhas; try { linhas = await linhasProjeto(false); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, e.message)); return; }
      const form = S.form; const cc = campoCodigo(form), ce = campoEspecie(form); const cat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
      const noPer = (l) => { const d = diaLocal(l.validado_em); return d && d >= de.value && d <= ate.value; };
      const doPer = linhas.filter((l) => noPer(l));
      const val = doPer.filter((l) => l.validacao === 'Validado'), dev = doPer.filter((l) => l.validacao === 'Devolvido'), desc = doPer.filter((l) => l.validacao === 'Descartado');
      const ehInd = (l) => !cat || ['1', '2', '3'].includes(String(l[cat.nome]));
      const equipes = [...new Set(val.map((l) => l.equipe || '-'))].sort();
      const tab = (cab, ls) => h('table', { class: 'tab-rel' }, h('thead', null, h('tr', null, cab.map((c) => h('th', null, c)))), h('tbody', null, ls.map((l) => h('tr', null, l.map((c) => h('td', null, c))))));
      const p = S.projeto; const dBR = (x) => x.split('-').reverse().join('/');
      const acum = linhas.filter((l) => l.validacao === 'Validado' && diaLocal(l.validado_em) <= ate.value).length;
      Api.b.auditar('relatorio', S.projeto.id, `boletim ${de.value} a ${ate.value}`);
      corpo.replaceChildren(
        h('header', { class: 'rel-cab' }, h('img', { src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }), h('div', null, h('h1', null, 'Boletim de medição'), h('p', null, p.nome), h('small', null, [p.contratante, p.municipio, p.contrato ? 'Contrato ' + p.contrato : ''].filter(Boolean).join(' · ')))),
        h('p', { class: 'rel-data' }, `Período: ${dBR(de.value)} a ${dBR(ate.value)}. Conta os registros pela data da validação técnica.`),
        h('h2', null, '1. Resumo do período'),
        tab(['Item', 'Quantidade'], [['Registros validados no período', fmtN(val.length)], ['Indivíduos (árvores, arbustos e palmeiras)', fmtN(val.filter(ehInd).length)], ['Pontos sem árvore (locais de plantio e calçadas)', fmtN(val.filter((l) => !ehInd(l)).length)],
          ehCoord() ? ['Devolvidos para correção no período', fmtN(dev.length)] : null, ehCoord() ? ['Descartados no período', fmtN(desc.length)] : null,
          ['Validados acumulados até o fim do período', fmtN(acum) + (p.meta ? ` (${fmtP(acum / p.meta)} da meta de ${fmtN(p.meta)})` : '')]].filter(Boolean)),
        h('h2', null, '2. Validados por equipe'),
        tab(['Equipe', 'Indivíduos', 'Pontos sem árvore', 'Total'], [...equipes.map((e) => { const x = val.filter((l) => (l.equipe || '-') === e); return [e, fmtN(x.filter(ehInd).length), fmtN(x.filter((l) => !ehInd(l)).length), fmtN(x.length)]; }), ['Total', fmtN(val.filter(ehInd).length), fmtN(val.filter((l) => !ehInd(l)).length), fmtN(val.length)]]),
        h('h2', null, '3. Registros validados no período'),
        val.length ? tab(['Nº', 'Código', 'Categoria', 'Espécie', 'Equipe', 'Validado em'], val.sort((a, b) => (+a.numero_unico || 0) - (+b.numero_unico || 0)).map((l) => [String(l.numero_unico || ''), (cc && l[cc.nome]) || '', cat ? rotuloOpcao(cat, l[cat.nome]).replace(/\s*\(.*\)/, '') : '', h('i', null, (ce && l[ce.nome]) || ''), l.equipe || '', dataBR(l.validado_em)])) : h('p', null, 'Nenhum registro validado neste período.'),
        h('div', { id: 'med-os' }),
        h('div', { class: 'rel-assinaturas' },
          h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, p.responsavel || 'Responsável técnico'), p.registro_profissional ? h('div', null, p.registro_profissional) : null, h('div', null, 'Neofloresta Serviços Ecossistêmicos Ltda.')),
          h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, 'Fiscal do contrato'), h('div', null, 'Atesto a execução dos serviços acima. Data: ____/____/______'))),
        h('footer', { class: 'rel-rodape' }, 'Gerado pelo Neofloresta Inventário ' + VERSAO + ' em ' + new Date().toLocaleString('pt-BR')));
      try {
        const od = await carregarOS(false); const el = document.getElementById('med-os');
        const feitas = od.ordens.filter((o) => o.status === 'Concluída' && o.numero && (() => { const x = diaLocal(o.concluida_em); return x && x >= de.value && x <= ate.value; })()).sort((a, b) => +a.numero - +b.numero);
        if (el && !od.semServidor && od.ordens.length) {
          const tipos = [...new Set(feitas.map((o) => o.tipo))].sort((a, b) => a.localeCompare(b, 'pt')); const eqs = [...new Set(feitas.map((o) => o.responsavel || '-'))].sort();
          el.replaceChildren(h('h2', null, '4. Serviços executados no período (ordens de serviço concluídas)'),
            h('p', null, 'Conta as ordens pela data de conclusão em campo. Cada ordem tem foto de antes e de depois guardada no sistema.'),
            feitas.length ? [tab(['Tipo de serviço', ...eqs, 'Total'], [...tipos.map((t) => [t, ...eqs.map((e) => fmtN(feitas.filter((o) => o.tipo === t && (o.responsavel || '-') === e).length)), fmtN(feitas.filter((o) => o.tipo === t).length)]), ['Total', ...eqs.map((e) => fmtN(feitas.filter((o) => (o.responsavel || '-') === e).length)), fmtN(feitas.length)]]),
              tab(['Ordem', 'Serviço', 'Árvore ou local', 'Equipe', 'Concluída em'], feitas.map((o) => [numOS(o), o.tipo, o.codigo_arvore || o.endereco || '', o.responsavel || '', dataBR(o.concluida_em)]))] : h('p', null, 'Nenhuma ordem de serviço concluída neste período.'));
        }
      } catch (e) { /* sem ordens */ }
    };
    $app.replaceChildren(h('div', { class: 'nao-imprime' }, topo('Boletim de medição', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#painel'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: () => window.print() }, 'Imprimir ou PDF'))),
      h('main', { class: 'relatorio' }, h('div', { class: 'nao-imprime cartao' }, h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'De'), de), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Até'), ate)), h('button', { class: 'btn', onclick: gerar }, 'Gerar boletim')), corpo));
    gerar();
  }

  // ---------- Validação (coordenação e revisão técnica) ----------
  // grava a decisão no servidor e atualiza a lista guardada; devolve true se gravou
  async function decidirRegistros(estado, uuids, amostra) {
    let obs = '';
    if (estado !== 'Validado') {
      const t = h('textarea', { class: 'entrada', placeholder: estado === 'Devolvido' ? 'Ex.: conferir a espécie e refazer a foto 1' : 'Ex.: registro duplicado' });
      const ok = await modal(estado === 'Devolvido' ? 'Devolver para a equipe' : 'Descartar', h('div', null, h('p', null, `${uuids.length} registro(s). Escreva o motivo${estado === 'Devolvido' ? ', que a equipe vê no aparelho' : ''}:`), t), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: estado === 'Devolvido' ? 'Devolver' : 'Descartar', classe: estado === 'Descartado' ? 'perigo' : '', valor: true }]);
      if (!ok) return false; obs = t.value.trim(); if (!obs) { toast('Informe o motivo.'); return false; }
    } else if (uuids.length > 1 && !amostra && !(await confirmar('Validar registros', `Validar ${uuids.length} registro(s)? Depois de validados, a equipe não consegue mais alterar.`, 'Validar'))) return false;
    try {
      for (let i = 0; i < uuids.length; i += 500) await Api.b.validar(S.projeto.id, uuids.slice(i, i + 500).map((u) => ({ uuid: u, estado, obs, amostra: !!amostra })));
      const c = S.linhas[S.projeto.id]; const agora = agoraISO(); const set = new Set(uuids);
      if (c) for (const l of c.linhas) if (set.has(l.uuid)) Object.assign(l, { validacao: estado, validacao_obs: obs, validado_por: S.sessao.u, validado_em: agora });
      S.painel = null; toast(`${uuids.length} registro(s): ${estado.toLowerCase()}.`); return true;
    } catch (e) { toast(e.message, 5000); return false; }
  }
  function alertasDe(l, form, dups) {
    const a = []; const cc = campoCodigo(form), ce = campoEspecie(form);
    const cat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const ind = !cat || ['1', '2', '3'].includes(String(l[cat.nome]));
    if (l.latitude === '' || l.latitude == null) a.push('Sem coordenada'); else if (+l.precisao_gps_m > 10) a.push(`GPS ±${Math.round(l.precisao_gps_m)} m`);
    const f1 = form.campos.find((c) => c.tipo === 'photo'); if (f1 && !l[f1.nome]) a.push('Sem foto');
    if (ind && ce) { const e = String(l[ce.nome] || '').trim(); if (!e) a.push('Sem espécie'); else if ((form.especies || []).length && !form.especies.some((x) => norm(x.cientifico) === norm(e))) a.push('Espécie fora da lista'); }
    for (const c of form.campos) {
      if (c.tipo !== 'number' && c.tipo !== 'multinumber') continue; const v = Indicadores.valorNum(l[c.nome], c.tipo === 'multinumber'); if (v == null) continue;
      if (/altura/i.test(c.nome) && v > 35) a.push('Altura alta: ' + numBR(v) + ' m');
      if (/dap/i.test(c.nome) && v > 200) a.push('DAP alto: ' + numBR(Math.round(v)) + ' cm');
      if (/raio/i.test(c.nome) && v > 20) { if (!a.some((x) => /^Raio/.test(x))) a.push('Raio de copa alto'); }
      if (c.min != null && v < c.min) a.push(c.limiteMsg ? c.rotulo.replace(/\s*\(.*\)/, '') + ' ' + c.limiteMsg.replace(/\s*\(.*\)/, '') : c.rotulo + ' abaixo de ' + numBR(c.min));
    }
    if (cc && l[cc.nome] && dups.has(String(l[cc.nome]))) a.push('Código repetido');
    const sim = (v) => v === 1 || v === '1' || v === true;
    for (const g of form.gruposObrig || []) { const cs = form.abas.flatMap((x) => x.campos).filter((x) => x.grupo === g).map((x) => form.campos.find((c) => c.nome === x.campo)).filter(Boolean); const ex = cs.find((c) => c.exclusivo); if (ex && sim(l[ex.nome]) && cs.some((c) => c !== ex && sim(l[c.nome]))) a.push('Contradição em ' + g); }
    return a;
  }
  async function linhasProjeto(forcar, progresso) {
    const id = S.projeto.id; const c = S.linhas[id];
    if (!forcar && c && Date.now() - c.t < 300000) return c.linhas;
    const linhas = await Api.b.listarTudo(id, progresso);
    S.linhas[id] = { t: Date.now(), linhas }; return linhas;
  }
  async function telaValidacao(forcar) {
    const form = S.form; const cc = campoCodigo(form), ce = campoEspecie(form);
    const cat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const corpo = h('main', { class: 'validacao' }, h('div', { class: 'info' }, 'Carregando registros...'));
    $app.replaceChildren(topo('Validação', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: () => telaValidacao(true) }, 'Atualizar')), corpo);
    let linhas; try { linhas = await linhasProjeto(forcar, (n, t) => { const i = corpo.querySelector('.info'); if (i) i.textContent = `Carregando registros: ${fmtN(n)}${t ? ' de ' + fmtN(t) : ''}...`; }); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, e.message)); return; }
    const cont = {}; linhas.forEach((l) => { const k = cc ? String(l[cc.nome] || '') : ''; if (k) cont[k] = (cont[k] || 0) + 1; });
    const dups = new Set(Object.keys(cont).filter((k) => cont[k] > 1));
    linhas.forEach((l) => { l.__alertas = alertasDe(l, form, dups); l.validacao = l.validacao || 'Pendente'; });
    const F = S.filtroVal = S.filtroVal || { sit: 'revisar', eq: '', alerta: '', q: '', limite: 100 };
    const sel = new Set();
    const selSit = h('select', { class: 'entrada' }, [['revisar', 'A revisar'], ['Pendente', 'Aguardando validação'], ['Corrigido', 'Corrigidos'], ['Devolvido', 'Devolvidos'], ['Validado', 'Validados'], ['Descartado', 'Descartados'], ['', 'Todos']].map(([v, t]) => h('option', { value: v, selected: F.sit === v }, t)));
    const eqs = [...new Set(linhas.map((l) => l.equipe || ''))].filter(Boolean).sort();
    const selEq = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todas as equipes'), eqs.map((e) => h('option', { value: e, selected: F.eq === e }, e)));
    const selAl = h('select', { class: 'entrada' }, [['', 'Com e sem alerta'], ['com', 'Só com alerta'], ['sem', 'Só sem alerta']].map(([v, t]) => h('option', { value: v, selected: F.alerta === v }, t)));
    const busca = h('input', { class: 'entrada', placeholder: 'Código ou espécie', value: F.q });
    const resumo = h('div', { class: 'val-resumo' }); const lista = h('div', { class: 'val-lista' }); const acoes = h('div', { class: 'val-acoes' });
    const filtradas = () => linhas.filter((l) => (F.sit === 'revisar' ? ['Pendente', 'Corrigido'].includes(l.validacao) : !F.sit || l.validacao === F.sit) && (!F.eq || l.equipe === F.eq)
      && (!F.alerta || (F.alerta === 'com' ? l.__alertas.length : !l.__alertas.length)) && (!F.q || norm((cc ? l[cc.nome] : '') + ' ' + (ce ? l[ce.nome] : '')).includes(norm(F.q))))
      .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    function desenhar() {
      const vis = filtradas(); S.navVal = vis.map((l) => l.uuid);
      const c = {}; linhas.forEach((l) => (c[l.validacao] = (c[l.validacao] || 0) + 1));
      resumo.replaceChildren(...['Pendente', 'Corrigido', 'Devolvido', 'Validado', 'Descartado'].map((k) => h('span', { class: 'val-chip', style: `border-color:${COR_VAL[k]}` }, h('b', null, fmtN(c[k] || 0)), ' ', ROT_CURTO[k])));
      lista.replaceChildren(...vis.slice(0, F.limite).map((l) => {
        const cb = h('input', { type: 'checkbox', checked: sel.has(l.uuid), onchange: () => { if (cb.checked) sel.add(l.uuid); else sel.delete(l.uuid); pintarAcoes(); }, 'aria-label': 'Selecionar' });
        return h('div', { class: 'val-item' }, cb, h('button', { class: 'val-txt', onclick: () => ir('#ficha/' + encodeURIComponent(l.uuid)) },
          h('b', null, (cc && l[cc.nome]) || 'Sem código'), h('i', null, (ce && l[ce.nome]) || (cat ? rotuloOpcao(cat, l[cat.nome]).replace(/\s*\(.*\)/, '') : '')),
          h('small', null, `${dataBR(l.criado_em)} · ${l.equipe || ''}`), l.__alertas.length ? h('span', { class: 'al' }, l.__alertas.join(' · ')) : null),
          h('span', { class: 'st v-' + norm(l.validacao) }, l.validacao === 'Pendente' ? 'Aguardando' : l.validacao));
      }), vis.length > F.limite ? h('button', { class: 'btn sec cheio', onclick: () => { F.limite += 200; desenhar(); } }, `Mostrar mais (${fmtN(vis.length - F.limite)} restantes)`) : null,
      !vis.length ? h('div', { class: 'vazio-lista' }, 'Nenhum registro neste filtro.') : null);
      pintarAcoes();
    }
    async function aplicar(estado, uuids) {
      if (!uuids.length) return toast('Selecione pelo menos um registro.');
      if (await decidirRegistros(estado, uuids)) { uuids.forEach((u) => sel.delete(u)); desenhar(); }
    }
    function pintarAcoes() {
      const vis = filtradas(); const semAlerta = vis.filter((l) => !l.__alertas.length && l.validacao !== 'Validado').map((l) => l.uuid);
      acoes.replaceChildren(h('label', { class: 'tudo' }, h('input', { type: 'checkbox', checked: vis.length && vis.slice(0, F.limite).every((l) => sel.has(l.uuid)), onchange: (e) => { vis.slice(0, F.limite).forEach((l) => (e.target.checked ? sel.add(l.uuid) : sel.delete(l.uuid))); desenhar(); } }), ' Marcar os visíveis'),
        h('button', { class: 'btn peq', disabled: !sel.size, onclick: () => aplicar('Validado', [...sel]) }, `Validar (${sel.size})`),
        h('button', { class: 'btn sec peq', disabled: !sel.size, onclick: () => aplicar('Devolvido', [...sel]) }, 'Devolver'),
        h('button', { class: 'btn perigo peq', disabled: !sel.size, onclick: () => aplicar('Descartado', [...sel]) }, 'Descartar'),
        semAlerta.length ? h('button', { class: 'btn sec peq', onclick: () => validarLote(semAlerta) }, `Validar todos sem alerta (${fmtN(semAlerta.length)})`) : null);
    }
    async function validarLote(uuids) {
      const n = Math.max(1, Math.ceil(uuids.length * 0.05));
      const cb = h('input', { type: 'checkbox' });
      const ok = await modal('Validar em lote', h('div', null, h('p', null, `${fmtN(uuids.length)} registros sem alerta. Antes de validar em lote, confira por amostragem pelo menos ${fmtN(n)} deles (5%), abrindo a ficha e as fotos.`), h('label', null, cb, ` Conferi uma amostra de pelo menos ${fmtN(n)} registros`)), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Validar', valor: true }]);
      if (!ok) return; if (!cb.checked) return toast('Marque a confirmação da amostra conferida.');
      if (await decidirRegistros('Validado', uuids, true)) desenhar();
    }
    const mudou = () => { F.sit = selSit.value; F.eq = selEq.value; F.alerta = selAl.value; F.q = busca.value; F.limite = 100; sel.clear(); desenhar(); };
    [selSit, selEq, selAl].forEach((x) => x.addEventListener('change', mudou)); let tb; busca.addEventListener('input', () => { clearTimeout(tb); tb = setTimeout(mudou, 250); });
    corpo.replaceChildren(resumo, h('div', { class: 'val-filtros' }, selSit, selEq, selAl, busca), acoes, lista);
    desenhar();
  }
  const idDrive = (u) => { const m = String(u || '').match(/\/d\/([\w-]{20,})/) || String(u || '').match(/id=([\w-]{20,})/); return m ? m[1] : null; };
  async function telaFichaServidor(uuidR) {
    const form = S.form;
    let linhas; try { linhas = await linhasProjeto(false); } catch (e) { return toast(e.message); }
    const l = linhas.find((x) => x.uuid === uuidR); if (!l) { toast('Registro não encontrado.'); return ir(ehCoord() ? '#validacao' : '#painel'); }
    const valores = {}; for (const c of form.campos) { let v = l[c.nome]; if (c.tipo === 'bool') v = v === 1 || v === '1' || v === true; valores[c.nome] = v; }
    const fotos = form.campos.filter((c) => c.tipo === 'photo' && l[c.nome]).map((c) => { const link = linkSeguro(l[c.nome + ' link']); const id = idDrive(link); return { rotulo: c.rotulo + (link ? '' : ' (ainda não enviada ao Drive)'), src: null, link: link || '', drive: id || '' }; });
    const nav = S.navVal || []; const i = nav.indexOf(uuidR);
    const irPara = (k) => { if (k >= 0 && k < nav.length) ir('#ficha/' + encodeURIComponent(nav[k])); };
    const cc = campoCodigo(form);
    const decidir = async (estado) => { if (!(await decidirRegistros(estado, [uuidR]))) return; if (i >= 0 && i + 1 < nav.length) irPara(i + 1); else ir('#validacao'); };
    const mapaDiv = h('div', { class: 'mapa-mini', style: 'height:220px' });
    $app.replaceChildren(topo((cc && l[cc.nome]) || 'Registro', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir(ehCoord() ? '#validacao' : '#mapa'), 'aria-label': 'Voltar' }, ico('voltar')), nav.length && ehCoord() ? h('span', { class: 'nav-n' }, `${fmtN(i + 1)} de ${fmtN(nav.length)}`) : null),
      h('main', null,
        h('div', { class: 'cartao status-ficha st-' + norm(l.validacao || 'pendente') }, h('b', null, ROT_VAL[l.validacao || 'Pendente'] || l.validacao),
          l.validacao_obs ? h('p', null, 'Motivo: ' + l.validacao_obs) : null,
          h('small', null, `${dataBR(l.criado_em)} · ${l.equipe || ''}${l.usuario ? ' (' + l.usuario + ')' : ''}${l.precisao_gps_m ? ' · GPS ±' + Math.round(l.precisao_gps_m) + ' m' : ''}${l.validado_por ? ' · avaliado por ' + l.validado_por + ' em ' + dataBR(l.validado_em) : ''}`),
          l.__alertas && l.__alertas.length ? h('p', { class: 'al' }, 'Alertas: ' + l.__alertas.join(' · ')) : null),
        l.latitude !== '' && l.latitude != null ? h('div', { class: 'cartao' }, mapaDiv, h('a', { href: `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`, target: '_blank', rel: 'noopener' }, 'Abrir no Google Maps')) : null,
        fichaConteudo(form, valores, fotos),
        secaoOSArvore(uuidR, true),
        l.historico ? h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Histórico de alterações'), String(l.historico).split(' | ').map((x) => h('p', { class: 'hist' }, x))) : null,
        ehCoord() ? h('div', { class: 'linha-btn val-dec' },
          h('button', { class: 'btn sec', disabled: i <= 0, onclick: () => irPara(i - 1) }, 'Anterior'),
          h('button', { class: 'btn perigo', onclick: () => decidir('Descartado') }, 'Descartar'),
          h('button', { class: 'btn sec', onclick: () => decidir('Devolvido') }, 'Devolver'),
          h('button', { class: 'btn', onclick: () => decidir('Validado') }, 'Validar'),
          h('button', { class: 'btn sec', disabled: i < 0 || i >= nav.length - 1, onclick: () => irPara(i + 1) }, 'Próximo')) : null));
    if (!Api.demo) setTimeout(() => document.querySelectorAll('.ficha-foto[data-drive]').forEach(async (a) => { try { const b = await Api.b.fotoVer(S.projeto.id, a.dataset.drive); const img = h('img', { src: URL.createObjectURL(b), alt: '', loading: 'lazy' }); a.querySelector('img') ? a.querySelector('img').replaceWith(img) : a.prepend(img); } catch (e) { /* sem permissão ou sem conexão: fica o link */ } }), 30);
    if (l.latitude !== '' && l.latitude != null) setTimeout(() => { const m = L.map(mapaDiv, { zoomControl: false }).setView([+l.latitude, +l.longitude], 19); camadasFundo(m, true); L.circleMarker([+l.latitude, +l.longitude], { radius: 8, color: '#fff', weight: 2, fillColor: '#E10000', fillOpacity: 1 }).addTo(m); }, 50);
  }

  // ---------- Ordens de serviço ----------
  // Fluxo: Solicitada (pedido do cliente ou da equipe) > Aberta > Em execução > Concluída, ou Cancelada.
  // Sem internet, o pedido e a execução ficam numa fila no aparelho e sobem no próximo envio.
  const TIPOS_OS_PADRAO = ['Poda de limpeza', 'Poda de levantamento de copa', 'Poda de adequação à rede elétrica', 'Poda de condução', 'Supressão', 'Remoção de toco', 'Plantio', 'Substituição', 'Tratamento fitossanitário', 'Avaliação de risco', 'Outro'];
  const PRIOR_OS = ['Urgente', 'Alta', 'Média', 'Baixa'];
  const OS_SEM_ANTES = ['Plantio', 'Avaliação de risco'];
  const COR_OS = { Solicitada: '#8E6C8A', Aberta: '#CD834C', 'Em execução': '#12A6C8', 'Concluída': '#2E7D32', Cancelada: '#90A4AE' };
  const numOS = (o) => (o.numero ? 'OS ' + String(o.numero).padStart(4, '0') : 'Nova ordem');
  const hojeISO = () => diaLocal(agoraISO());
  const atrasada = (o) => !!o.prazo && ['Aberta', 'Em execução', 'Solicitada'].includes(o.status) && o.prazo < hojeISO();
  const ehMinhaOS = (o) => perfil() === 'coletor' && o.responsavel && o.responsavel === (S.projeto.equipe || S.sessao.usuario.equipe);
  const podeExecutar = (o) => ehCoord() || ehMinhaOS(o);
  async function filaOS() { return (await Store.get('osfila')) || []; }
  async function mexerFilaOS(fn) { const f = await filaOS(); const n = (await fn(f)) || f; await Store.set('osfila', n); return n; }
  async function carregarOS(forcar) {
    const chave = 'os:' + S.projeto.id; const c = (await Store.get(chave)) || { ordens: [], tipos: [] };
    {
      if (navigator.onLine && !S.expirada && (forcar || !S.osEm || S.osEm.p !== S.projeto.id || Date.now() - S.osEm.t > 60000)) {
        try { const j = await Api.b.osListar(S.projeto.id); c.ordens = j.ordens || []; c.tipos = j.tipos || []; c.em = agoraISO(); delete c.semServidor; await Store.set(chave, c); S.osEm = { p: S.projeto.id, t: Date.now() }; } catch (e) { if (/desconhecida/i.test(e.message)) c.semServidor = true; }
      }
    }
    const ordens = (c.ordens || []).map((o) => Object.assign({}, o));
    for (const it of (await filaOS()).filter((x) => x.projeto === S.projeto.id)) {
      if (it.tipo === 'salvar' && !it.dados.id) { if (!ordens.some((o) => o.id === it.dados.chave)) ordens.unshift(Object.assign({ id: it.dados.chave, numero: '', status: ehCoord() ? 'Aberta' : 'Solicitada', aberta_em: it.dados.em, solicitada_em: it.dados.em, __pend: true, __erro: it.erro || '' }, it.dados)); continue; }
      const o = ordens.find((x) => x.id === (it.id || it.dados.id)); if (!o) continue;
      o.__pend = true; o.__erro = it.erro || '';
      if (it.etapa === 'iniciar' && o.status === 'Aberta') o.status = 'Em execução';
      if (it.etapa === 'concluir') { o.status = 'Concluída'; o.execucao_obs = it.dados.obs || ''; }
      if (it.fotos) o.__fotos = Object.assign(o.__fotos || {}, it.fotos);
    }
    return { ordens, tipos: (c.tipos && c.tipos.length) ? c.tipos : TIPOS_OS_PADRAO, em: c.em, semServidor: !!c.semServidor };
  }
  // tenta mandar na hora; sem internet (ou servidor fora do ar) guarda na fila do aparelho
  async function enviarOS(item) {
    item.chave = item.chave || uuid(); item.projeto = S.projeto.id; item.dados.em = item.dados.em || agoraISO();
    if (navigator.onLine && !S.expirada) {
      try { const r = await mandarItemOS(item); S.osEm = null; return { ok: true, ordem: r && r.ordem }; } catch (e) {
        if (!/Sem conexão|Servidor respondeu 5/i.test(e.message)) { for (const f of Object.values(item.fotos || {})) if (f && f.chave && !f.url) await Store.apagarFoto(f.chave); throw e; }
      }
    }
    await mexerFilaOS((f) => { f.push(item); }); atualizarSync();
    return { ok: true, fila: true };
  }
  async function mandarItemOS(item) {
    const dados = Object.assign({}, item.dados);
    for (const [k, f] of Object.entries(item.fotos || {})) {
      if (!f) continue;
      if (!f.url) {
        const b = await Store.foto(f.chave); if (!b) throw new Error('Foto não encontrada no aparelho.');
        const r = await Api.b.foto(item.projeto, f.nome, b); f.url = r.url || '';
        await mexerFilaOS((fila) => { const x = fila.find((y) => y.chave === item.chave); if (x) x.fotos[k].url = f.url; });
      }
      dados[k] = f.url;
    }
    const r = item.tipo === 'salvar' ? await Api.b.osSalvar(item.projeto, dados) : await Api.b.osAndamento(item.projeto, item.id, item.etapa, dados);
    for (const f of Object.values(item.fotos || {})) if (f && f.chave) await Store.apagarFoto(f.chave);
    return r;
  }
  async function enviarFilaOS(silencioso) {
    const fila = (await filaOS()).filter((x) => !x.recusado); if (!fila.length) return;
    let ok = 0, falhas = 0, erro = '';
    for (const it of fila) {
      try { await mandarItemOS(it); await mexerFilaOS((f) => f.filter((y) => y.chave !== it.chave)); ok++; } catch (e) {
        if (e.sessao) break; falhas++; erro = e.message;
        const final = !/Sem conexão|Servidor respondeu 5/i.test(e.message);
        await mexerFilaOS((f) => { const x = f.find((y) => y.chave === it.chave); if (x) { x.erro = e.message; if (final) x.recusado = true; } });
      }
    }
    S.osEm = null;
    if (ok || falhas) if (!silencioso || falhas) toast(falhas ? `Ordens de serviço: ${ok} enviada(s), ${falhas} com problema: ${erro}` : `${ok} atualização(ões) de ordem de serviço enviada(s).`, falhas ? 5000 : 2600);
  }
  async function nFilaOS() { return (await filaOS()).filter((x) => !x.recusado).length; }

  function etiquetaOS(o) { return h('span', { class: 'os-st', style: `background:${COR_OS[o.status] || '#8A969C'}` }, o.status + (o.__pend ? ' · a enviar' : '')); }
  function itemOS(o) {
    const local = o.codigo_arvore ? `Árvore ${o.codigo_arvore}` : (o.endereco || 'Ponto no mapa');
    return h('button', { class: 'os-item' + (atrasada(o) ? ' atrasada' : ''), onclick: () => ir('#os/' + encodeURIComponent(o.id)) },
      h('div', { class: 'os-l1' }, h('b', null, numOS(o)), h('span', null, o.tipo), etiquetaOS(o)),
      h('div', { class: 'os-l2' }, local, o.especie ? h('i', null, ' · ' + o.especie) : null, o.bairro ? ' · ' + o.bairro : ''),
      h('small', { class: 'os-l3' }, ['Prioridade ' + String(o.prioridade || 'Média').toLowerCase(), o.prazo ? 'prazo ' + o.prazo.split('-').reverse().join('/') : '', o.responsavel || 'sem equipe definida'].filter(Boolean).join(' · '), atrasada(o) ? h('b', { class: 'os-atraso' }, ' · Atrasada') : null),
      o.__erro ? h('small', { class: 'motivo' }, 'Não enviado: ' + o.__erro) : null);
  }
  const ordenarOS = (a, b) => (atrasada(b) - atrasada(a)) || (PRIOR_OS.indexOf(a.prioridade || 'Média') - PRIOR_OS.indexOf(b.prioridade || 'Média')) || String(a.prazo || '9').localeCompare(String(b.prazo || '9')) || ((+b.numero || 1e9) - (+a.numero || 1e9));

  async function telaOrdens() {
    const pf = perfil();
    const voltar = h('button', { class: 'ic', onclick: () => ir(pf === 'cliente' ? '#painel' : '#inicio'), 'aria-label': 'Voltar' }, ico('voltar'));
    const lista = h('div', { class: 'os-lista' }, h('div', { class: 'info' }, 'Carregando ordens de serviço...'));
    const busca = h('input', { class: 'entrada', placeholder: 'Número, árvore, endereço ou bairro', enterkeyhint: 'search' });
    const selTipo = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todos os tipos'));
    const filtros = h('div', { class: 'chips os-chips' });
    S.filtroOS = S.filtroOS || (pf === 'coletor' ? 'fazer' : 'abertas');
    const novo = pf === 'cliente' ? 'Solicitar serviço' : ehCoord() ? 'Nova ordem' : 'Pedir serviço';
    $app.replaceChildren(topo('Ordens de serviço', S.projeto.nome, voltar, h('div', { class: 'topo-dir' }, h('button', { class: 'ic', onclick: () => { S.corMapa = 'os'; ir('#mapa'); }, 'aria-label': 'Mapa' }, ico('mapa')))),
      h('main', null, h('button', { class: 'btn nova canto', onclick: () => ir('#os-nova') }, ico('mais'), novo), filtros, h('div', { class: 'grade2 os-busca' }, busca, selTipo), lista));
    const d = await carregarOS(true);
    if (!document.body.contains(lista)) return;
    if (d.semServidor) { lista.replaceChildren(h('div', { class: 'aviso' }, 'O servidor do projeto ainda está numa versão sem ordens de serviço. A coordenação precisa atualizar o servidor (versão 2.2).')); return; }
    selTipo.replaceChildren(h('option', { value: '' }, 'Todos os tipos'), d.tipos.map((t) => h('option', { value: t }, t)));
    const grupos = [['fazer', 'A fazer', (o) => ['Aberta', 'Em execução'].includes(o.status)], ['abertas', 'Em aberto', (o) => ['Solicitada', 'Aberta', 'Em execução'].includes(o.status)], ['solicitadas', 'Pedidos', (o) => o.status === 'Solicitada'], ['atrasadas', 'Atrasadas', atrasada], ['concluidas', 'Concluídas', (o) => o.status === 'Concluída'], ['canceladas', 'Canceladas', (o) => o.status === 'Cancelada'], ['todas', 'Todas', () => true]].filter(([k]) => pf !== 'coletor' || !['abertas', 'canceladas'].includes(k));
    const pintar = () => {
      const g = grupos.find((x) => x[0] === S.filtroOS) || grupos[0];
      filtros.replaceChildren(grupos.map(([k, t, f]) => h('button', { class: 'chip' + (k === g[0] ? ' sel' : ''), onclick: () => { S.filtroOS = k; pintar(); } }, `${t} (${d.ordens.filter(f).length})`)));
      const q = norm(busca.value).trim();
      const vis = d.ordens.filter(g[2]).filter((o) => !selTipo.value || o.tipo === selTipo.value).filter((o) => !q || norm([numOS(o), o.numero, o.codigo_arvore, o.especie, o.endereco, o.bairro, o.descricao, o.responsavel].join(' ')).includes(q)).sort(ordenarOS);
      lista.replaceChildren(vis.length ? vis.slice(0, 500).map(itemOS) : h('div', { class: 'vazio-lista' }, d.ordens.length ? 'Nenhuma ordem neste filtro.' : pf === 'coletor' ? 'Nenhuma ordem de serviço para a sua equipe.' : 'Nenhuma ordem de serviço ainda. Abra uma pela ficha da árvore ou pelo botão acima.'));
    };
    busca.addEventListener('input', pintar); selTipo.addEventListener('change', pintar); pintar();
  }

  // foto de antes ou depois: tira, reduz e guarda no aparelho até enviar
  function campoFotoOS(rotulo, alvo, k) {
    const img = h('div', { class: 'os-foto-vazia' }, 'Sem foto');
    const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto', onchange: async () => {
      const arq = cam.files && cam.files[0]; if (!arq) return;
      try {
        const blob = await reduzir(arq, 2048, 0.85); const chave = 'os-' + uuid();
        if (alvo[k] && alvo[k].chave) await Store.apagarFoto(alvo[k].chave);
        await Store.salvarFoto(chave, blob); alvo[k] = { chave, nome: `OS-${chave.slice(3, 11)}-${k === 'foto_antes' ? 'antes' : 'depois'}.jpg` };
        img.replaceWith(h('img', { class: 'os-foto', src: URL.createObjectURL(blob), alt: rotulo })); bloco.classList.remove('falta');
      } catch (e) { toast('Não foi possível usar esta foto: ' + e.message); }
    } });
    const bloco = h('div', { class: 'campo os-foto-campo', 'data-foto': k }, h('label', { class: 'rot' }, rotulo), img, h('button', { class: 'btn sec peq', onclick: () => cam.click() }, ico('camera'), 'Tirar foto'), cam);
    return bloco;
  }
  async function verFotoOS(link, alvo, local) {
    if (local && local.chave) { const b = await Store.foto(local.chave); if (b) return alvo.replaceChildren(h('img', { class: 'os-foto', src: URL.createObjectURL(b), alt: '' })); }
    const id = idDrive(link); if (!id) return;
    alvo.replaceChildren(h('a', { href: linkSeguro(link), target: '_blank', rel: 'noopener' }, 'Abrir foto'));
    if (Api.demo) return;
    try { const b = await Api.b.fotoVer(S.projeto.id, id); alvo.replaceChildren(h('a', { href: linkSeguro(link), target: '_blank', rel: 'noopener' }, h('img', { class: 'os-foto', src: URL.createObjectURL(b), alt: '' }))); } catch (e) { /* sem conexão: fica o link */ }
  }

  async function telaOS(id) {
    const d = await carregarOS(false); let o = d.ordens.find((x) => x.id === id);
    if (!o) { const d2 = await carregarOS(true); o = d2.ordens.find((x) => x.id === id); }
    if (!o) { toast('Ordem de serviço não encontrada.'); return ir('#ordens'); }
    const fotos = {};
    const exec = async (etapa) => {
      const dados = {}; let fts = {};
      if (etapa === 'iniciar' || etapa === 'concluir') {
        if (etapa === 'iniciar' && !o.foto_antes && !fotos.foto_antes && !OS_SEM_ANTES.includes(o.tipo)) return falta('foto_antes', 'Tire a foto de antes do serviço.');
        if (etapa === 'concluir') {
          if (!o.foto_antes && !fotos.foto_antes && !OS_SEM_ANTES.includes(o.tipo)) return falta('foto_antes', 'Falta a foto de antes do serviço.');
          if (!fotos.foto_depois) return falta('foto_depois', 'Tire a foto de depois do serviço.');
          dados.obs = obs.value.trim();
          if (o.status === 'Aberta') dados.iniciada_em = agoraISO();
        }
        fts = Object.fromEntries(Object.entries(fotos).filter(([, v]) => v));
      } else if (etapa === 'cancelar' || etapa === 'reabrir') {
        const t = h('textarea', { class: 'entrada', placeholder: etapa === 'cancelar' ? 'Ex.: árvore já removida pela concessionária' : 'Ex.: faltou retirar galho sobre a fiação' });
        const okm = await modal(etapa === 'cancelar' ? 'Cancelar ordem' : 'Reabrir ordem', h('div', null, h('p', null, 'Escreva o motivo:'), t), [{ texto: 'Voltar', classe: 'sec', valor: false }, { texto: etapa === 'cancelar' ? 'Cancelar ordem' : 'Reabrir', classe: etapa === 'cancelar' ? 'perigo' : '', valor: true }]);
        if (!okm) return; dados.obs = t.value.trim(); if (!dados.obs) return toast('Informe o motivo.');
      } else if (etapa === 'aprovar') {
        const r = await escolherEquipePrazo(o, 'Aprovar pedido'); if (!r) return; Object.assign(dados, r);
      }
      if (etapa === 'concluir' && !(await confirmar('Concluir serviço', `Concluir ${numOS(o)} (${o.tipo})? Depois de concluída, só a coordenação pode reabrir.`, 'Concluir'))) return;
      try {
        const r = await enviarOS({ tipo: 'andamento', id: o.id, etapa, dados, fotos: fts });
        toast(r.fila ? 'Sem internet: guardado no aparelho. Será enviado depois.' : { iniciar: 'Execução iniciada.', concluir: 'Serviço concluído.', cancelar: 'Ordem cancelada.', reabrir: 'Ordem reaberta.', aprovar: 'Pedido aprovado.' }[etapa]);
        telaOS(id);
      } catch (e) { toast(e.message, 5000); }
    };
    const falta = (k, msg) => { if (navigator.vibrate) navigator.vibrate(120); const el = document.querySelector(`[data-foto="${k}"]`); if (el) { el.classList.add('falta', 'destaque'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.classList.remove('destaque'), 1600); } toast(msg); };
    const editar = async () => {
      const r = await escolherEquipePrazo(o, 'Alterar ordem', true); if (!r) return;
      try { const x = await enviarOS({ tipo: 'salvar', dados: Object.assign({ id: o.id }, r) }); toast(x.fila ? 'Guardado no aparelho.' : 'Ordem alterada.'); telaOS(id); } catch (e) { toast(e.message, 5000); }
    };
    const obs = h('textarea', { class: 'entrada', placeholder: 'O que foi feito (opcional). Ex.: 3 galhos secos removidos' });
    const mapaDiv = h('div', { class: 'mapa-mini', style: 'height:200px' });
    const temPonto = o.latitude !== '' && o.latitude != null && !isNaN(+o.latitude);
    const fa = h('div', { class: 'os-foto-box' }), fd = h('div', { class: 'os-foto-box' });
    const linha = (rot, v) => (v ? h('div', { class: 'os-dado' }, h('small', null, rot), h('span', null, v)) : null);
    const ativo = ['Aberta', 'Em execução'].includes(o.status) && podeExecutar(o) && !o.__pend;
    const hist = String(o.historico || '').split(' | ').filter(Boolean);
    $app.replaceChildren(topo(numOS(o), o.tipo, h('button', { class: 'ic', onclick: () => ir('#ordens'), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        h('div', { class: 'cartao os-cab', style: `border-left:6px solid ${COR_OS[o.status] || '#8A969C'}` }, h('div', { class: 'os-l1' }, h('b', null, o.tipo), etiquetaOS(o)),
          h('div', { class: 'os-dados' }, linha('Prioridade', o.prioridade), linha('Prazo', o.prazo ? o.prazo.split('-').reverse().join('/') + (atrasada(o) ? ' (atrasada)' : '') : ''), linha('Equipe responsável', o.responsavel || 'A definir'),
            linha('Pedido por', o.solicitada_por ? `${o.solicitada_por} em ${dataBR(o.solicitada_em)}` : ''), linha('Aberta por', o.aberta_por ? `${o.aberta_por} em ${dataBR(o.aberta_em)}` : ''),
            linha('Iniciada', o.iniciada_em ? `${dataBR(o.iniciada_em)} por ${o.iniciada_por}` : ''), linha('Concluída', o.concluida_em ? `${dataBR(o.concluida_em)} por ${o.concluida_por}` : ''),
            o.status === 'Cancelada' ? linha('Motivo do cancelamento', o.motivo) : o.motivo ? linha('Motivo da reabertura', o.motivo) : null),
          o.descricao ? h('p', { class: 'os-desc' }, o.descricao) : null,
          o.__erro ? h('p', { class: 'trava' }, 'Não foi aceito pelo servidor: ' + o.__erro) : null),
        h('section', { class: 'cartao' }, h('h3', null, o.codigo_arvore ? 'Árvore ' + o.codigo_arvore : 'Local do serviço'),
          o.especie ? h('p', null, h('i', null, o.especie)) : null, o.endereco || o.bairro ? h('p', null, [o.endereco, o.bairro].filter(Boolean).join(' · ')) : null,
          temPonto ? mapaDiv : null,
          h('div', { class: 'linha-btn quebra' }, temPonto ? h('a', { class: 'btn sec peq', href: `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`, target: '_blank', rel: 'noopener' }, 'Como chegar') : null,
            o.registro_uuid && perfil() !== 'coletor' ? h('button', { class: 'btn sec peq', onclick: () => { S.navVal = []; ir('#ficha/' + encodeURIComponent(o.registro_uuid)); } }, 'Ficha da árvore') : null)),
        h('section', { class: 'cartao' }, h('h3', null, 'Execução'),
          ativo ? h('div', { class: 'grade2' }, o.foto_antes ? h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de antes'), fa) : campoFotoOS('Foto de antes' + (OS_SEM_ANTES.includes(o.tipo) ? ' (opcional)' : ''), fotos, 'foto_antes'), campoFotoOS('Foto de depois', fotos, 'foto_depois'))
            : h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de antes'), fa), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de depois'), fd)),
          ativo ? h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Observação da execução'), obs) : o.execucao_obs ? h('p', null, o.execucao_obs) : null,
          ativo ? h('div', { class: 'linha-btn' }, o.status === 'Aberta' ? h('button', { class: 'btn sec', onclick: () => exec('iniciar') }, 'Iniciar serviço') : null, h('button', { class: 'btn', onclick: () => exec('concluir') }, 'Concluir serviço')) : null,
          !ativo && ['Aberta', 'Em execução'].includes(o.status) && !podeExecutar(o) ? h('p', { class: 'dica' }, o.responsavel ? `A execução é registrada pela ${o.responsavel}.` : 'A coordenação ainda vai definir a equipe.') : null,
          o.status === 'Solicitada' ? h('p', { class: 'dica' }, 'Pedido aguardando aprovação da coordenação.') : null),
        hist.length ? h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Histórico'), hist.map((x) => h('p', { class: 'hist' }, x))) : null,
        ehCoord() && !o.__pend ? h('div', { class: 'linha-btn quebra', style: 'margin:8px 0 30px' },
          o.status === 'Solicitada' ? h('button', { class: 'btn', onclick: () => exec('aprovar') }, 'Aprovar pedido') : null,
          ['Solicitada', 'Aberta', 'Em execução'].includes(o.status) ? h('button', { class: 'btn sec', onclick: editar }, 'Alterar') : null,
          ['Solicitada', 'Aberta', 'Em execução'].includes(o.status) ? h('button', { class: 'btn perigo', onclick: () => exec('cancelar') }, 'Cancelar ordem') : null,
          ['Concluída', 'Cancelada'].includes(o.status) ? h('button', { class: 'btn sec', onclick: () => exec('reabrir') }, 'Reabrir') : null) : null,
        o.__erro && o.__pend ? h('div', { class: 'linha-btn' }, h('button', { class: 'btn perigo peq', onclick: async () => { await mexerFilaOS((f) => f.filter((y) => !(y.id === o.id || y.dados.chave === o.id || y.dados.id === o.id))); toast('Removido do aparelho.'); ir('#ordens'); } }, 'Remover do aparelho')) : null));
    verFotoOS(o.foto_antes, fa, o.__fotos && o.__fotos.foto_antes); verFotoOS(o.foto_depois, fd, o.__fotos && o.__fotos.foto_depois);
    if (!o.foto_antes && !(o.__fotos && o.__fotos.foto_antes)) fa.replaceChildren(h('div', { class: 'os-foto-vazia' }, 'Sem foto'));
    if (!o.foto_depois && !(o.__fotos && o.__fotos.foto_depois)) fd.replaceChildren(h('div', { class: 'os-foto-vazia' }, 'Sem foto'));
    if (temPonto) setTimeout(() => { const m = L.map(mapaDiv, { zoomControl: false }).setView([+o.latitude, +o.longitude], 19); camadasFundo(m, true); L.circleMarker([+o.latitude, +o.longitude], { radius: 8, color: '#fff', weight: 2, fillColor: COR_OS[o.status] || '#E10000', fillOpacity: 1 }).addTo(m); }, 50);
  }
  // equipes conhecidas: as do projeto (usuários, para a coordenação) ou as que já coletaram
  async function equipesProjeto() {
    const s = new Set();
    try { if (perfil() === 'admin') (await Api.b.usuariosListar()).filter((u) => u.perfil === 'coletor' && u.equipe && String(u.projeto || '').split(',').map((x) => x.trim()).some((x) => x === S.projeto.id || x === '*')).forEach((u) => s.add(u.equipe)); } catch (e) { /* segue */ }
    try { const c = S.linhas[S.projeto.id]; if (c) c.linhas.forEach((l) => l.equipe && s.add(l.equipe)); } catch (e) { /* segue */ }
    ((await Store.get('os:' + S.projeto.id)) || { ordens: [] }).ordens.forEach((o) => o.responsavel && s.add(o.responsavel));
    return [...s].sort();
  }
  async function escolherEquipePrazo(o, titulo, completo) {
    const eqs = await equipesProjeto();
    const resp = h('input', { class: 'entrada', value: o.responsavel || '', list: 'os-equipes', placeholder: 'Ex.: Equipe 1' });
    const dl = h('datalist', { id: 'os-equipes' }, eqs.map((e) => h('option', { value: e })));
    const prazo = h('input', { class: 'entrada', type: 'date', value: o.prazo || '' });
    const prio = h('select', { class: 'entrada' }, PRIOR_OS.map((p) => h('option', { value: p, selected: (o.prioridade || 'Média') === p }, p)));
    const desc = h('textarea', { class: 'entrada' }); desc.value = o.descricao || '';
    const ok = await modal(titulo, h('div', null, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe responsável'), resp, dl), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prazo'), prazo),
      completo ? [h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prioridade'), prio), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Descrição'), desc)] : null), [{ texto: 'Voltar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
    if (!ok) return null;
    const r = { responsavel: resp.value.trim(), prazo: prazo.value };
    if (completo) Object.assign(r, { prioridade: prio.value, descricao: desc.value.trim() });
    return r;
  }

  // nova ordem: a partir da árvore (uuid) ou de um ponto marcado no mapa
  async function telaNovaOS(uuidR) {
    const pf = perfil(); const coord = ehCoord();
    const d = await carregarOS(false);
    let arv = null;
    if (uuidR) {
      const r = await Store.registro(uuidR);
      const cc = campoCodigo(S.form), ce = campoEspecie(S.form);
      if (r) arv = { uuid: r.uuid, cod: cc ? r.valores[cc.nome] : '', esp: ce ? r.valores[ce.nome] : '', lat: r.lat, lon: r.lon, local: r.status !== 'enviado' };
      else { try { const ls = await linhasProjeto(false); const l = ls.find((x) => x.uuid === uuidR); if (l) arv = { uuid: l.uuid, cod: cc ? l[cc.nome] : '', esp: ce ? l[ce.nome] : '', lat: +l.latitude, lon: +l.longitude }; } catch (e) { /* sem acesso à lista */ } }
    }
    const tipo = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Escolha o tipo de serviço'), d.tipos.map((t) => h('option', { value: t }, t)));
    let prio = 'Média';
    const chips = h('div', { class: 'chips' }); const pintarPrio = () => chips.replaceChildren(PRIOR_OS.map((p) => h('button', { class: 'chip' + (p === prio ? ' sel' : ''), onclick: () => { prio = p; pintarPrio(); } }, p))); pintarPrio();
    const desc = h('textarea', { class: 'entrada', placeholder: 'O que precisa ser feito e por quê. Ex.: galho seco sobre a calçada, risco de queda' });
    const resp = h('input', { class: 'entrada', list: 'os-equipes', placeholder: 'Ex.: Equipe 1' }); const dl = h('datalist', { id: 'os-equipes' });
    const prazo = h('input', { class: 'entrada', type: 'date' });
    const end = h('input', { class: 'entrada', placeholder: 'Rua e número, ou referência' });
    const mapaDiv = h('div', { class: 'mapa-mini', style: 'height:260px' });
    let ponto = arv && arv.lat ? { lat: arv.lat, lon: arv.lon } : null;
    const salvar = async () => {
      if (!tipo.value) { tipo.classList.add('invalido'); tipo.focus(); return toast('Escolha o tipo de serviço.'); }
      if (!arv && !ponto) return toast('Toque no mapa para marcar o local do serviço.');
      if (arv && arv.local) return toast('Envie o registro da árvore antes de pedir o serviço.');
      const dados = { chave: uuid(), tipo: tipo.value, prioridade: prio, descricao: desc.value.trim() };
      if (arv) dados.registro_uuid = arv.uuid; else Object.assign(dados, { latitude: ponto.lat, longitude: ponto.lon, endereco: end.value.trim() });
      if (coord) Object.assign(dados, { responsavel: resp.value.trim(), prazo: prazo.value });
      try {
        const r = await enviarOS({ tipo: 'salvar', chave: dados.chave, dados });
        toast(r.fila ? 'Sem internet: o pedido ficou guardado e será enviado depois.' : coord ? `${r.ordem ? numOS(r.ordem) : 'Ordem'} aberta.` : 'Pedido enviado à coordenação.');
        ir(arv && pf === 'coletor' ? '#form/' + arv.uuid : '#ordens');
      } catch (e) { toast(e.message, 5000); }
    };
    $app.replaceChildren(topo(pf === 'cliente' ? 'Solicitar serviço' : coord ? 'Nova ordem de serviço' : 'Pedir serviço', S.projeto.nome, h('button', { class: 'ic', onclick: () => history.back(), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        arv ? h('div', { class: 'cartao' }, h('h3', null, 'Árvore ' + (arv.cod || '')), arv.esp ? h('p', null, h('i', null, arv.esp)) : null, arv.local ? h('p', { class: 'trava' }, 'Este registro ainda não foi enviado. Envie antes de pedir o serviço.') : null)
          : h('div', { class: 'cartao' }, h('h3', null, 'Local do serviço'), h('p', { class: 'dica' }, 'Toque no mapa para marcar o ponto. Para uma árvore já cadastrada, abra o pedido pela ficha dela.'), mapaDiv, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Endereço ou referência'), end)),
        h('div', { class: 'cartao' },
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Tipo de serviço *'), tipo),
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prioridade'), chips),
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Descrição'), desc),
          coord ? h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe responsável'), resp, dl), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prazo'), prazo)) : h('p', { class: 'dica' }, 'A coordenação aprova o pedido e define a equipe e o prazo.')),
        h('div', { class: 'linha-btn', style: 'margin:8px 0 30px' }, h('button', { class: 'btn sec', onclick: () => history.back() }, 'Cancelar'), h('button', { class: 'btn', onclick: salvar }, pf === 'cliente' || !coord ? 'Enviar pedido' : 'Abrir ordem'))));
    if (coord) equipesProjeto().then((eqs) => dl.replaceChildren(eqs.map((e) => h('option', { value: e }))));
    if (!arv) setTimeout(() => {
      const c = ponto || S.pos || (() => { const ps = d.ordens.filter((o) => o.latitude !== '' && !isNaN(+o.latitude)); return ps.length ? { lat: +ps[0].latitude, lon: +ps[0].longitude } : null; })();
      const m = L.map(mapaDiv, { maxZoom: 21 }).setView(c ? [c.lat, c.lon] : [-15.8, -47.9], c ? 18 : 4); camadasFundo(m, true);
      let mk = null; const marcar = (lat, lon) => { ponto = { lat, lon }; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon]).addTo(m); };
      m.on('click', (e) => marcar(e.latlng.lat, e.latlng.lng));
      if (S.pos && perfil() === 'coletor') marcar(S.pos.lat, S.pos.lon);
    }, 50);
  }
  // seção "Ordens de serviço" da ficha de uma árvore
  function secaoOSArvore(uuidR, enviado) {
    const box = h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Ordens de serviço'), h('small', null, 'Carregando...'));
    (async () => {
      const d = await carregarOS(false); const os = d.ordens.filter((o) => o.registro_uuid === uuidR).sort((a, b) => (+b.numero || 1e9) - (+a.numero || 1e9));
      const pf = perfil(); const rot = pf === 'cliente' ? 'Solicitar serviço' : ehCoord() ? 'Abrir ordem de serviço' : 'Pedir serviço para esta árvore';
      box.replaceChildren(h('h3', null, 'Ordens de serviço'), d.semServidor ? h('p', { class: 'dica' }, 'Disponível depois da atualização do servidor.') : null,
        os.length ? os.map(itemOS) : h('p', { class: 'dica' }, 'Nenhuma intervenção registrada nesta árvore.'),
        d.semServidor ? null : enviado ? h('button', { class: 'btn sec peq', style: 'margin-top:8px', onclick: () => ir('#os-nova/' + encodeURIComponent(uuidR)) }, rot) : h('p', { class: 'dica' }, 'Para pedir um serviço, envie o registro primeiro.'));
    })();
    return box;
  }

  // ---------- Exportação (coordenação e cliente) ----------
  const FORMATOS = [['gpkg', 'GeoPackage (QGIS)'], ['xlsx', 'Excel (.xlsx)'], ['shp', 'Shapefile (.zip)'], ['csv', 'CSV'], ['kml', 'Google Earth (.kml)']];
  async function exportarDados(p, formato, filtro, status, saida) {
    const entregar = (nome, dados, tipo) => (saida ? saida.push({ nome, dados: dados instanceof Blob ? dados : new Blob([dados], { type: tipo || '' }) }) : baixar(nome, dados, tipo));
    const msg = (t, cls = 'info') => status.replaceChildren(h('div', { class: cls }, t));
    msg('Preparando...');
    try {
      const form = await Api.b.formulario(p.formulario);
      let linhas = await Api.b.listarTudo(p.id, (n, t) => msg(`Baixando registros: ${fmtN(n)}${t ? ' de ' + fmtN(t) : ''}...`));
      linhas = linhas.filter((l) => l.validacao !== 'Descartado' && (filtro !== 'validados' || l.validacao === 'Validado'));
      if (!linhas.length) throw new Error(filtro === 'validados' ? 'Nenhum registro validado ainda.' : 'Nenhum registro enviado neste projeto ainda.');
      // numeração única do projeto, sem distinção de equipe, pela ordem de coleta
      // numeração única dada pelo servidor; registros antigos sem número recebem a seguinte, pela ordem de coleta
      let maxN = Math.max(0, ...linhas.map((l) => +l.numero_unico || 0));
      [...linhas].filter((l) => !(+l.numero_unico)).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)) || String(a.uuid).localeCompare(String(b.uuid))).forEach((l) => { l.numero_unico = ++maxN; });
      linhas.sort((a, b) => (+a.numero_unico) - (+b.numero_unico));
      const cDap = form.campos.find((c) => c.tipo === 'multinumber' && /dap/i.test(c.nome));
      if (cDap) linhas.forEach((l) => { const v = Indicadores.valorNum(l[cDap.nome], true); l.dap_equivalente_cm = v == null ? '' : Math.round(v * 10) / 10; });
      const cc = campoCodigo(form), ce = campoEspecie(form);
      const dia = new Date().toISOString().slice(0, 10); const base = `${p.id}_${dia}${filtro === 'validados' ? '_validados' : ''}`;
      const ordem = ['numero_unico', ...form.campos.flatMap((c) => (c.tipo === 'photo' ? [c.nome, c.nome + ' link'] : [c.nome])), 'dap_equivalente_cm', 'latitude', 'longitude', 'precisao_gps_m', 'endereco_aprox', 'bairro_aprox', 'equipe', 'usuario', 'criado_em', 'concluido_em', 'atualizado_em', 'validacao', 'validacao_obs', 'validado_por', 'validado_em', 'validacao_hist', 'historico', 'uuid'];
      const todas = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter((c) => !c.startsWith('__'));
      const cols = [...ordem.filter((c) => todas.includes(c)), ...todas.filter((c) => !ordem.includes(c) && !['projeto', 'servidor_em'].includes(c))];
      // planilhas com rótulos legíveis e opções por extenso
      const rot = (c) => { const k = form.campos.find((x) => x.nome === c); return k && k.rotulo !== c ? `${k.rotulo}` : c; };
      const legivel = (l) => { const o = {}; for (const c of cols) { const k = form.campos.find((x) => x.nome === c); let v = l[c]; if (k && k.tipo === 'choice') v = rotuloOpcao(k, v); else if (k && k.tipo === 'bool') v = v === 1 || v === '1' || v === true ? 'Sim' : 'Não'; else if ((k && (k.tipo === 'datetime' || k.tipo === 'date')) || /_em$/.test(c)) { const d = v ? new Date(v) : null; if (d && !isNaN(d)) v = d.toLocaleString('pt-BR', k && k.tipo === 'date' ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' }); } o[c] = v; } return o; };
      const epsgNum = () => { if (/^\d+$/.test(String(p.epsg))) return +p.epsg; const lons = linhas.map((l) => +l.longitude).filter((x) => isFinite(x) && x); return UTM.epsgDoFuso(UTM.fuso(lons.length ? lons.reduce((a, b) => a + b, 0) / lons.length : -45)); };
      if (formato === 'gpkg') {
        const estilo = await Api.b.estilo(form.id).catch(() => null);
        const r = await Gpkg.gerar({ form, linhas, epsg: p.epsg, nomeCamada: Q2F.slug(p.id).replace(/-/g, '_'), estiloQml: estilo });
        entregar(base + '.gpkg', r.bytes, 'application/geopackage+sqlite3');
        msg(`GeoPackage gerado: ${fmtN(r.total)} registros em SIRGAS 2000 / UTM (EPSG:${r.srs})${r.semPonto ? `, ${r.semPonto} sem coordenada` : ''}${estilo ? ', com a simbologia do QGIS embutida' : ''}. Fotos: baixe a pasta DCIM do projeto no Drive e coloque ao lado do arquivo.`);
      } else if (formato === 'xlsx') {
        const leg = linhas.map(legivel);
        const unid = (c) => { const m = String(c.rotulo + ' ' + c.nome).match(/\((cm|m|m2|m²|%|graus)\)/i); return m ? m[1].replace('m2', 'm²') : ''; };
        const dic = [...form.campos.map((c) => ({ Campo: c.nome, 'Nome no app': c.rotulo, Unidade: unid(c), Descrição: c.ajuda || '', Tipo: { choice: 'Lista de opções', bool: 'Sim ou não', number: 'Número', multinumber: 'Números por fuste', species: 'Espécie', photo: 'Foto', text: 'Texto', textarea: 'Texto longo', datetime: 'Data e hora', date: 'Data' }[c.tipo] || c.tipo, Opções: (c.opcoes || []).map((o) => `${o.v} = ${o.t}`).join('; ') })),
          ...[['numero_unico', 'Número único do registro no projeto, dado pelo servidor no primeiro envio', ''], ['dap_equivalente_cm', 'DAP equivalente: raiz da soma dos quadrados dos DAP de cada fuste', 'cm'], ['latitude', 'Latitude em graus decimais, SIRGAS 2000', 'graus'], ['longitude', 'Longitude em graus decimais, SIRGAS 2000', 'graus'], ['precisao_gps_m', 'Erro estimado do GPS do aparelho no momento do registro', 'm'],
            ['endereco_aprox', 'Endereço aproximado obtido do mapa (OpenStreetMap) pela coordenada', ''], ['bairro_aprox', 'Bairro aproximado obtido do mapa (OpenStreetMap)', ''], ['equipe', 'Equipe que coletou', ''], ['criado_em', 'Data e hora da coleta', ''], ['concluido_em', 'Data e hora em que a equipe concluiu o registro', ''],
            ['validacao', 'Situação da validação técnica (Pendente, Validado, Devolvido, Corrigido, Descartado)', ''], ['validado_por', 'Quem fez a última avaliação', ''], ['validado_em', 'Data e hora da última avaliação', ''], ['validacao_hist', 'Histórico de todas as avaliações do registro', ''], ['historico', 'Histórico de alterações feitas depois de concluído', ''], ['uuid', 'Identificador interno do registro', '']]
            .map(([c, d, u]) => ({ Campo: c, 'Nome no app': '', Unidade: u, Descrição: d, Tipo: '', Opções: '' }))];
        const meta = [['Projeto', p.nome], ['Contratante', p.contratante || ''], ['Contrato', p.contrato || ''], ['Município', p.municipio || ''], ['Responsável técnico', [p.responsavel, p.registro_profissional, p.art ? 'ART ' + p.art : ''].filter(Boolean).join(' · ')],
          ['Registros neste arquivo', String(linhas.length)], ['Filtro', filtro === 'validados' ? 'Somente registros validados' : 'Todos os registros, exceto descartados'], ['Sistema de referência das coordenadas', 'SIRGAS 2000, geográficas (EPSG:4674)'], ['Formulário', `${form.nome} (versão ${form.versao || 1})`], ['Gerado em', new Date().toLocaleString('pt-BR')], ['Gerado por', `${S.sessao.usuario.nome || S.sessao.u} no Neofloresta Inventário ${VERSAO}`]].map(([k, v]) => ({ Item: k, Valor: v }));
        const abas = [{ nome: 'Registros', cols, linhas: leg.map((l) => Object.fromEntries(cols.map((c) => [c, l[c]]))) }];
        try {
          const os = (await Api.b.osListar(p.id)).ordens || [];
          if (os.length) {
            const dt = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''; };
            const co = [['numero', 'Número'], ['tipo', 'Serviço'], ['status', 'Situação'], ['prioridade', 'Prioridade'], ['codigo_arvore', 'Árvore'], ['especie', 'Espécie'], ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['descricao', 'Descrição'], ['responsavel', 'Equipe'], ['prazo', 'Prazo'], ['solicitada_por', 'Pedido por'], ['solicitada_em', 'Pedido em'], ['aberta_por', 'Aberta por'], ['aberta_em', 'Aberta em'], ['iniciada_em', 'Iniciada em'], ['concluida_por', 'Concluída por'], ['concluida_em', 'Concluída em'], ['execucao_obs', 'Observação da execução'], ['foto_antes', 'Foto de antes'], ['foto_depois', 'Foto de depois'], ['motivo', 'Motivo (cancelamento ou reabertura)'], ['historico', 'Histórico'], ['registro_uuid', 'Identificador da árvore']];
            abas.push({ nome: 'Ordens de serviço', cols: co.map((c) => c[1]), linhas: os.sort((a, b) => +a.numero - +b.numero).map((o) => Object.fromEntries(co.map(([k, t]) => [t, /_em$/.test(k) ? dt(o[k]) : k === 'numero' || k === 'latitude' || k === 'longitude' ? (o[k] === '' || o[k] == null ? '' : +o[k]) : k === 'prazo' && o[k] ? o[k].split('-').reverse().join('/') : o[k] ?? ''])) ) });
            meta.push({ Item: 'Ordens de serviço neste arquivo', Valor: String(os.length) });
          }
        } catch (e) { /* servidor sem ordens de serviço */ }
        const b = await Arquivos.xlsx([...abas, { nome: 'Dicionário de campos', cols: ['Campo', 'Nome no app', 'Unidade', 'Descrição', 'Tipo', 'Opções'], linhas: dic }, { nome: 'Metadados', cols: ['Item', 'Valor'], linhas: meta }]);
        void rot; entregar(base + '.xlsx', b);
        msg(`Excel gerado com ${fmtN(linhas.length)} registros${abas.length > 1 ? `, ${pl(abas[1].linhas.length, 'ordem de serviço', 'ordens de serviço')}` : ''} e as abas "Dicionário de campos" e "Metadados".`);
      } else if (formato === 'shp') {
        const epsg = epsgNum(); const z = UTM.fusoDoEpsg(epsg);
        const pontos = linhas.map((l) => (l.latitude === '' || l.latitude == null ? null : (() => { const u = UTM.paraUTM(+l.latitude, +l.longitude, z); return { x: u.x, y: u.y }; })()));
        const b = await Arquivos.shapefile({ nome: base, cols, linhas, pontos, prj: UTM.wkt(z) });
        entregar(base + '_shapefile.zip', b);
        msg(`Shapefile gerado com ${fmtN(linhas.length)} pontos em SIRGAS 2000 / UTM ${z}S (EPSG:${epsg}). Os nomes de campo do shapefile têm até 10 letras; o arquivo _campos.csv traz o nome completo de cada um.`);
      } else if (formato === 'kml') {
        const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const chave = (n) => n && /^(numero_unico|equipe|criado_em|precisao_gps_m|validacao)$|codigo|especie|categoria|situa|dap|altura|risco|foto 1 link/i.test(norm(n));
        const ck = cols.filter(chave);
        const pms = linhas.filter((l) => l.latitude !== '' && l.latitude != null).map((l) => { const g = legivel(l); return `<Placemark><name>${x(cc ? l[cc.nome] : l.numero_unico)}</name>${ce && l[ce.nome] ? `<description>${x(l[ce.nome])}</description>` : ''}<ExtendedData>${ck.map((c) => `<Data name="${x(rot(c))}"><value>${x(g[c])}</value></Data>`).join('')}</ExtendedData><Point><coordinates>${+l.longitude},${+l.latitude},0</coordinates></Point></Placemark>`; });
        entregar(base + '.kml', `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(p.nome)}</name>${pms.join('\n')}</Document></kml>`, 'application/vnd.google-earth.kml+xml');
        msg(`KML gerado com ${fmtN(pms.length)} pontos e os campos principais (abre no Google Earth e no Google Maps).`);
      } else {
        const esc = (v) => { if (typeof v === 'number') return String(v).replace('.', ','); let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const valCsv = (v) => v;
        const csv = '﻿' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(valCsv(l[c]))).join(';'))].join('\r\n');
        entregar(base + '.csv', csv, 'text/csv'); msg(`CSV gerado com ${fmtN(linhas.length)} linhas (separador ponto e vírgula, decimal com vírgula, pronto para o Excel em português).`);
      }
      Api.b.auditar('exportar', p.id, `${formato} ${filtro} ${linhas.length}`);
    } catch (e) { msg(e.message, 'aviso'); if (saida) throw e; }
  }
  // pacote final de entrega: dados em todos os formatos, dicionário, ordens de serviço, leia-me e, em projetos pequenos, as fotos
  async function pacoteEntrega(p, filtro, status) {
    const msg = (t, cls = 'info') => status.replaceChildren(h('div', { class: cls }, t));
    const arqs = [];
    try {
      for (const f of ['gpkg', 'xlsx', 'shp', 'csv', 'kml']) { const st = h('div'); msg(`Gerando ${FORMATOS.find((x) => x[0] === f)[1]}...`); await exportarDados(p, f, filtro, st, arqs); }
      const linhas = (await Api.b.listarTudo(p.id)).filter((l) => l.validacao !== 'Descartado' && (filtro !== 'validados' || l.validacao === 'Validado'));
      const form = await Api.b.formulario(p.formulario);
      const fotos = []; for (const l of linhas) for (const c of form.campos.filter((k) => k.tipo === 'photo')) { const id = idDrive(l[c.nome + ' link']); if (id) fotos.push({ id, nome: String(l[c.nome] || id).replace(/^DCIM\//, '') }); }
      let os = []; try { os = (await Api.b.osListar(p.id)).ordens || []; } catch (e) { /* sem ordens */ }
      os.forEach((o) => [['foto_antes', 'antes'], ['foto_depois', 'depois']].forEach(([k, t]) => { const id = idDrive(o[k]); if (id) fotos.push({ id, nome: `ordens/OS-${String(o.numero).padStart(4, '0')}-${t}.jpg` }); }));
      const LIM = 300; let baixadas = 0;
      if (fotos.length <= LIM) for (const f of fotos) { msg(`Baixando fotos: ${baixadas + 1} de ${fotos.length}...`); try { arqs.push({ nome: 'DCIM/' + f.nome, dados: await Api.b.fotoVer(p.id, f.id) }); baixadas++; } catch (e) { /* fica o link na planilha */ } }
      const dia = new Date().toLocaleDateString('pt-BR');
      const leia = [`Pacote de entrega: ${p.nome}`, `Gerado em ${dia} pelo Neofloresta Inventário ${VERSAO}.`, `Contratante: ${p.contratante || ''}  Contrato: ${p.contrato || ''}  Município: ${p.municipio || ''}`, `Responsável técnico: ${[p.responsavel, p.registro_profissional, p.art ? 'ART ' + p.art : ''].filter(Boolean).join(', ')}`, '',
        `Registros: ${linhas.length} (${filtro === 'validados' ? 'somente validados' : 'todos, exceto descartados'}).`, `Ordens de serviço: ${os.length}.`, '',
        'Arquivos:', ...arqs.filter((a) => !a.nome.startsWith('DCIM/')).map((a) => '  ' + a.nome + ({ gpkg: ': GeoPackage para o QGIS, em SIRGAS 2000 / UTM, com a simbologia embutida', xlsx: ': Excel com os registros, as ordens de serviço, o dicionário de campos (unidade e descrição) e os metadados', zip: ': Shapefile em SIRGAS 2000 / UTM; o arquivo _campos.csv traz o nome completo de cada campo', csv: ': texto separado por ponto e vírgula, decimal com vírgula', kml: ': Google Earth e Google Maps' }[a.nome.split('.').pop()] || '')),
        fotos.length <= LIM ? `  DCIM/: ${baixadas} fotos dos registros e das ordens de serviço (os nomes batem com as colunas de foto da planilha).` : `  Fotos: são ${fotos.length}, grandes demais para um arquivo só. Baixe a pasta DCIM do projeto no Google Drive (botão direito > Fazer download) e coloque ao lado do GeoPackage. Cada linha da planilha tem o link da foto.`,
        '', 'Coordenadas: SIRGAS 2000. Datas e horas no horário de Brasília nas planilhas legíveis e em UTC (ISO 8601) no CSV.', 'Os dados pertencem ao contratante. A Neofloresta atua como operadora dos dados, conforme o termo de uso e privacidade do sistema.'].join('\r\n');
      arqs.push({ nome: 'LEIA-ME.txt', dados: new Blob(['﻿' + leia], { type: 'text/plain' }) });
      msg('Compactando...');
      const prontos = []; for (const a of arqs) prontos.push({ nome: a.nome, dados: new Uint8Array(await a.dados.arrayBuffer()) });
      const z = await Arquivos.zip(prontos);
      baixar(`${p.id}_pacote_entrega_${new Date().toISOString().slice(0, 10)}.zip`, z);
      msg(`Pacote gerado: ${pl(linhas.length, 'registro', 'registros')}, ${pl(os.length, 'ordem de serviço', 'ordens de serviço')}, 5 formatos de dados${fotos.length <= LIM ? `, ${pl(baixadas, 'foto', 'fotos')}` : ''} e o LEIA-ME com o conteúdo.`);
      Api.b.auditar('exportar', p.id, `pacote ${filtro} ${linhas.length}`);
    } catch (e) { msg(e.message, 'aviso'); }
  }
  async function adminExportar(corpo) {
    const projetos = await Api.b.projetosListar();
    const sel = h('select', { class: 'entrada' }, projetos.map((p) => h('option', { value: p.id, selected: S.projeto && p.id === S.projeto.id }, p.nome)));
    const filtro = h('select', { class: 'entrada' }, h('option', { value: 'ativos' }, 'Todos os registros, menos os descartados'), h('option', { value: 'validados' }, 'Só os validados (entrega ao cliente)'));
    const status = h('div'); const links = h('div');
    const mostrarLinks = () => { const p = projetos.find((x) => x.id === sel.value); links.replaceChildren(p && (p.planilha_url || p.pasta_url) ? h('div', { class: 'info' }, p.planilha_url ? h('div', null, h('a', { href: p.planilha_url, target: '_blank', rel: 'noopener' }, 'Abrir planilha do projeto')) : null, p.pasta_url ? h('div', null, h('a', { href: p.pasta_url, target: '_blank', rel: 'noopener' }, 'Abrir pasta do projeto no Drive (fotos em DCIM)')) : null) : ''); };
    sel.addEventListener('change', mostrarLinks); mostrarLinks();
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Exportar dados'),
      h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), sel), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Registros'), filtro)), links,
      h('div', { class: 'linha-btn quebra' }, FORMATOS.map(([f, t], i) => h('button', { class: 'btn' + (i ? ' sec' : ''), onclick: () => exportarDados(projetos.find((x) => x.id === sel.value), f, filtro.value, status) }, t))),
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn linha', onclick: () => pacoteEntrega(projetos.find((x) => x.id === sel.value), filtro.value, status) }, 'Pacote final de entrega (tudo num arquivo .zip)')),
      h('p', { class: 'dica' }, 'Todos os formatos trazem a coluna numero_unico (numeração única do projeto, sem distinção de equipe) e a situação da validação. O Excel traz as opções por extenso e um dicionário de campos.'), status));
  }
  async function exportarCliente() {
    const st = h('div');
    await modal('Baixar dados validados', h('div', null, h('p', null, 'Escolha o formato. O arquivo traz os registros validados do projeto.'), h('div', { class: 'linha-btn quebra' }, FORMATOS.map(([f, t]) => h('button', { class: 'btn sec', onclick: () => exportarDados(S.projeto, f, 'validados', st) }, t))), st), [{ texto: 'Fechar', classe: 'sec', valor: null }]);
  }

  // ---------- Importação de inventário existente ----------
  async function adminImportar(corpo) {
    const projetos = await Api.b.projetosListar();
    const sel = h('select', { class: 'entrada' }, projetos.map((p) => h('option', { value: p.id, selected: S.projeto && p.id === S.projeto.id }, p.nome)));
    const arq = h('input', { type: 'file', accept: '.csv,.txt,.gpkg' });
    const eq = h('input', { class: 'entrada', value: 'Inventário anterior', placeholder: 'ex.: Inventário 2019' });
    const extra = h('input', { type: 'checkbox', checked: true });
    const area = h('div');
    async function ler() {
      area.replaceChildren(h('div', { class: 'info' }, 'Lendo o arquivo...'));
      try {
        const f = arq.files[0]; if (!f) throw new Error('Escolha um arquivo .csv ou .gpkg.');
        const p = projetos.find((x) => x.id === sel.value); const form = await Api.b.formulario(p.formulario);
        let dados;
        if (/\.gpkg$/i.test(f.name)) { dados = await Gpkg.lerFeicoes(await f.arrayBuffer()); if (!dados.convertivel) throw new Error(`O GeoPackage está no sistema EPSG:${dados.srs}, que o app ainda não converte. Use SIRGAS 2000 (geográfico ou UTM Sul).`); }
        else dados = Arquivos.lerCsv(Arquivos.lerTexto(await f.arrayBuffer()));
        if (!dados.linhas.length) throw new Error('O arquivo não tem linhas.');
        const plano = planejarImportacao(dados, form, p);
        mostrarPlano(plano, p, form);
      } catch (e) { area.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    }
    function mostrarPlano(plano, p, form) {
      const ok = plano.linhas.filter((l) => l.latitude !== '');
      const btn = h('button', { class: 'btn', onclick: () => enviar(plano, p) }, `Importar ${fmtN(plano.linhas.length)} registros`);
      area.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Conferência antes de importar'),
        h('p', null, `${fmtN(plano.linhas.length)} linhas, ${fmtN(ok.length)} com coordenada.`),
        h('p', null, h('b', null, 'Colunas reconhecidas: '), plano.mapeadas.length ? plano.mapeadas.map(([o, d]) => (norm(o) === norm(d) ? d : `${o} → ${d}`)).join(', ') : 'nenhuma'),
        plano.soltas.length ? h('p', null, h('b', null, 'Colunas sem correspondência no formulário: '), plano.soltas.join(', '), h('br'), h('label', null, extra, ' Manter essas colunas na planilha')) : null,
        plano.avisos.length ? h('div', { class: 'aviso' }, h('ul', null, plano.avisos.map((a) => h('li', null, a)))) : null,
        h('div', { style: 'overflow-x:auto' }, h('table', { class: 'tab' }, h('tr', null, plano.amostraCols.map((c) => h('th', null, c))), plano.linhas.slice(0, 5).map((l) => h('tr', null, plano.amostraCols.map((c) => h('td', null, String(l[c] ?? ''))))))),
        btn, h('div', { id: 'imp-st' })));
      void form;
    }
    async function enviar(plano, p) {
      const st = area.querySelector('#imp-st');
      if (!(await confirmar('Importar', `Importar ${fmtN(plano.linhas.length)} registros para ${p.nome}? Eles entram como "aguardando validação".`, 'Importar'))) return;
      let ins = 0, ign = 0;
      try {
        const linhas = plano.linhas.map((l) => { const o = Object.assign({}, l); if (!extra.checked) plano.soltas.forEach((c) => delete o[c]); o.equipe = o.equipe || eq.value.trim() || 'Inventário anterior'; return o; });
        for (let i = 0; i < linhas.length; i += 1000) {
          st.replaceChildren(h('div', { class: 'info' }, `Enviando ${fmtN(Math.min(i + 1000, linhas.length))} de ${fmtN(linhas.length)}...`));
          const r = await Api.b.importar(p.id, linhas.slice(i, i + 1000)); ins += r.inseridos; ign += r.ignorados;
        }
        S.linhas = {}; S.painel = null;
        st.replaceChildren(h('div', { class: 'info' }, `Importação concluída: ${fmtN(ins)} registros inseridos${ign ? `, ${fmtN(ign)} já existiam e foram ignorados` : ''}.`));
      } catch (e) { st.replaceChildren(h('div', { class: 'aviso' }, `Parou com erro depois de ${fmtN(ins)} inseridos: ${e.message}. Pode enviar de novo: os já importados são ignorados.`)); }
    }
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Importar inventário existente'),
      h('p', { class: 'dica' }, 'Aceita CSV (separado por ponto e vírgula, vírgula ou tabulação) ou GeoPackage de pontos. As colunas com o mesmo nome dos campos do formulário são reconhecidas sozinhas; opções escritas por extenso (ex.: "Árvore") são convertidas. No CSV, use colunas latitude e longitude em graus decimais.'),
      h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), sel), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome da origem (vai na coluna equipe)'), eq)),
      h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Arquivo'), arq), h('button', { class: 'btn', onclick: ler }, 'Ler e conferir')), area);
  }
  // número escrito em português ou inglês: 1.234,5 / 1,234.5 / 12,5 / 1.234 (milhar)
  function numeroBR(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let t = String(v == null ? '' : v).trim().replace(/\s/g, ''); if (!t) return null;
    const ip = t.lastIndexOf('.'), iv = t.lastIndexOf(',');
    if (ip > -1 && iv > -1) t = ip > iv ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
    else if (iv > -1) t = (t.match(/,/g).length > 1 ? t.replace(/,/g, '') : t.replace(',', '.'));
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = Number(t); return isFinite(n) ? n : null;
  }
  function planejarImportacao(dados, form, p) {
    const chaveCampo = new Map(); form.campos.forEach((c) => { chaveCampo.set(norm(c.nome).replace(/[^a-z0-9]/g, ''), c); chaveCampo.set(norm(c.rotulo).replace(/[^a-z0-9]/g, ''), c); });
    const avisos = []; const mapeadas = []; const soltas = []; const destino = {};
    const ehLat = (c) => /^(lat|latitude|y_?lat|coord_?y_?geo)$/.test(norm(c).replace(/\s+/g, '')); const ehLon = (c) => /^(lon|long|longitude|lng|x_?lon)$/.test(norm(c).replace(/\s+/g, ''));
    const ehX = (c) => /^(x|este|utm_?e|easting|coord_?x|e)$/.test(norm(c).replace(/\s+/g, '')); const ehY = (c) => /^(y|norte|utm_?n|northing|coord_?y|n)$/.test(norm(c).replace(/\s+/g, ''));
    let cLat = null, cLon = null, cX = null, cY = null;
    for (const c of dados.cols) {
      if (ehLat(c)) { cLat = c; continue; } if (ehLon(c)) { cLon = c; continue; } if (ehX(c)) { cX = c; continue; } if (ehY(c)) { cY = c; continue; }
      if (/^(uuid|fid|ogc_fid|id|equipe|criado_em|numero_unico|validacao.*|validado_.*|historico|usuario|projeto|atualizado_em|concluido_em|servidor_em|dap_equivalente_cm|endereco_aprox|bairro_aprox|precisao_gps_m)$/i.test(c)) continue;
      const k = chaveCampo.get(norm(c).replace(/[^a-z0-9]/g, ''));
      if (k) { destino[c] = k; mapeadas.push([c, k.nome]); } else soltas.push(c);
    }
    const zona = UTM.zonaDoEpsg(p.epsg);
    if (!dados.linhas[0].__lat && !cLat && cX && cY && !zona) avisos.push('O arquivo tem coordenadas X e Y em metros, mas o projeto está com sistema "automático". Defina o fuso UTM do projeto em Projetos para converter.');
    if (!dados.linhas[0].__lat && !cLat && !(cX && cY)) avisos.push('Não achei colunas de coordenada (latitude e longitude). Os registros entram sem ponto no mapa.');
    const conv = (k, v) => {
      if (v === '' || v == null) return '';
      if (k.tipo === 'choice') { const o = k.opcoes.find((x) => String(x.v) === String(v) || norm(x.t) === norm(v) || norm(x.t.replace(/\s*\(.*\)/, '')) === norm(v)); return o ? o.v : String(v); }
      if (k.tipo === 'bool') return /^(1|s|sim|x|true|verdadeiro|yes)$/i.test(String(v).trim()) ? 1 : 0;
      if (k.tipo === 'number' || k.armazenar === 'real') { const n = numeroBR(v); return n == null ? String(v) : n; }
      return String(v);
    };
    let semOpcao = 0;
    const linhas = dados.linhas.map((l, idx) => {
      const o = {};
      for (const [c, k] of Object.entries(destino)) { o[k.nome] = conv(k, l[c]); if (k.tipo === 'choice' && o[k.nome] !== '' && !k.opcoes.some((x) => String(x.v) === String(o[k.nome]))) semOpcao++; }
      for (const c of soltas) o[c] = l[c];
      let lat = l.__lat, lon = l.__lon;
      if (lat == null && cLat && cLon) { lat = numeroBR(l[cLat]); lon = numeroBR(l[cLon]); }
      if (lat == null && cX && cY && zona) { const g = UTM.paraGeo(numeroBR(l[cX]), numeroBR(l[cY]), zona); lat = g.lat; lon = g.lon; }
      o.latitude = isFinite(lat) && Math.abs(lat) <= 90 ? Math.round(lat * 1e7) / 1e7 : ''; o.longitude = isFinite(lon) && Math.abs(lon) <= 180 ? Math.round(lon * 1e7) / 1e7 : '';
      o.uuid = l.uuid ? String(l.uuid) : 'imp-' + Arquivos.crc32(new TextEncoder().encode(JSON.stringify(l))).toString(16) + '-' + (l.fid || l.id || idx);
      if (l.equipe) o.equipe = l.equipe; if (l.criado_em) o.criado_em = l.criado_em;
      return o;
    });
    const cc0 = campoCodigo(form); if (cc0) { const vist = {}; let dup = 0; linhas.forEach((o) => { const k = o[cc0.nome]; if (k) { if (vist[k]) dup++; vist[k] = 1; } }); if (dup) avisos.push(`${fmtN(dup)} código(s) de árvore repetido(s) no arquivo. Confira antes de importar.`); }
    if (dados.cols.includes('uuid')) avisos.push('O arquivo tem a coluna uuid: registros que já existem no projeto serão ignorados, sem duplicar.');
    if (semOpcao) avisos.push(`${fmtN(semOpcao)} valor(es) de lista não batem com as opções do formulário e foram mantidos como estão. Confira na validação.`);
    const cc = campoCodigo(form), ce = campoEspecie(form);
    const amostraCols = [cc && cc.nome, ce && ce.nome, 'latitude', 'longitude', ...mapeadas.map((m) => m[1])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 7);
    return { linhas, mapeadas, soltas, avisos, amostraCols };
  }

  // ---------- Segurança: cópia de segurança e auditoria ----------
  async function adminSeguranca(corpo) {
    const st = await Api.b.backupStatus().catch((e) => ({ erro: e.message }));
    const emails = h('input', { class: 'entrada', value: st.emails || '', placeholder: 'email1@..., email2@...' });
    const ativo = h('input', { type: 'checkbox', checked: !!st.ativo });
    const msg = h('div');
    const salvar = async () => { try { const r = await Api.b.backupConfig(emails.value, ativo.checked); msg.replaceChildren(h('div', { class: 'info' }, r.ativo ? `Cópia diária ligada (todo dia às 2h). Emails: ${r.emails || 'nenhum'}.` : 'Cópia diária desligada.')); } catch (e) { msg.replaceChildren(h('div', { class: 'aviso' }, e.message)); } };
    const agora = async () => { msg.replaceChildren(h('div', { class: 'info' }, 'Copiando as planilhas...')); try { const r = await Api.b.backupAgora(); msg.replaceChildren(h('div', { class: r.erros && r.erros.length ? 'aviso' : 'info' }, `Cópia feita: ${r.resumo}. `, r.pasta ? h('a', { href: r.pasta, target: '_blank', rel: 'noopener' }, 'Abrir pasta') : null)); } catch (e) { msg.replaceChildren(h('div', { class: 'aviso' }, e.message)); } };
    const filtro = h('input', { class: 'entrada', placeholder: 'Filtrar por usuário ou ação' });
    const restaura = h('div', null, h('small', null, 'Carregando...')); const chaves = h('div', null, h('small', null, 'Carregando...'));
    const tabela = h('div', { style: 'overflow-x:auto' });
    const ROT_AC = { login: 'Entrou', login_falhou: 'Senha errada', usuario_bloqueado: 'Usuário bloqueado', usuario_desbloquear: 'Desbloqueou usuário', usuario_salvar: 'Salvou usuário', usuario_remover: 'Removeu usuário', projeto_salvar: 'Salvou projeto', formulario_salvar: 'Salvou formulário', validar: 'Validação', importar: 'Importação', exportar: 'Exportação', relatorio: 'Relatório', backup_agora: 'Cópia de segurança', backup_config: 'Configurou cópia', backup_restaurar: 'Restaurou cópia', trocar_senha: 'Trocou a senha', aceitar_termo: 'Aceitou o termo', chave_criar: 'Criou chave de integração', chave_revogar: 'Revogou chave de integração', os_abrir: 'Abriu ordem de serviço', os_alterar: 'Alterou ordem de serviço', os_aprovar: 'Aprovou pedido de serviço', os_iniciar: 'Iniciou ordem de serviço', os_concluir: 'Concluiu ordem de serviço', os_cancelar: 'Cancelou ordem de serviço', os_reabrir: 'Reabriu ordem de serviço', api_listar: 'Integração: consultou registros', api_os_listar: 'Integração: consultou ordens', api_painel: 'Integração: consultou indicadores', api_mapa: 'Integração: consultou mapa' };
    let itens = [];
    const pintar = () => { const q = norm(filtro.value); tabela.replaceChildren(h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Usuário'), h('th', null, 'Ação'), h('th', null, 'Detalhe')),
      itens.filter((i) => !q || norm(i.login + ' ' + i.acao + ' ' + (ROT_AC[i.acao] || '') + ' ' + i.alvo + ' ' + i.detalhe).includes(q)).slice(0, 300).map((i) => h('tr', null, h('td', null, dataBR(i.em)), h('td', null, i.login), h('td', null, ROT_AC[i.acao] || i.acao), h('td', null, [i.alvo, i.detalhe].filter(Boolean).join(' · ')))))); };
    filtro.addEventListener('input', pintar);
    corpo.replaceChildren(
      h('div', { class: 'cartao' }, h('h3', null, 'Cópia de segurança'),
        st.demo ? h('p', { class: 'dica' }, 'Disponível com o servidor Google.') : [
          h('p', { class: 'dica' }, 'Copia todo dia a base de usuários e a planilha de cada projeto para a pasta Backup do Drive, guarda as últimas 30 cópias e manda email com as planilhas em Excel.'),
          st.ultimo ? h('p', null, `Última cópia: ${dataBR(st.ultimo.em)} (${st.ultimo.resumo}). `, st.ultimo.pasta ? h('a', { href: st.ultimo.pasta, target: '_blank', rel: 'noopener' }, 'Abrir') : null) : h('p', null, 'Nenhuma cópia feita ainda.'),
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Enviar para os emails'), emails), h('label', null, ativo, ' Fazer cópia automática todo dia'),
          h('div', { class: 'linha-btn' }, h('button', { class: 'btn', onclick: salvar }, 'Salvar'), h('button', { class: 'btn sec', onclick: agora }, 'Fazer cópia agora')), msg]),
      st.demo ? null : h('div', { class: 'cartao' }, h('h3', null, 'Restaurar uma cópia'), h('p', { class: 'dica' }, 'Volta os registros e as ordens de serviço de um projeto para como estavam no dia da cópia. Antes, o app guarda uma cópia do estado atual, que aparece nesta lista para desfazer.'), restaura),
      st.demo ? null : h('div', { class: 'cartao' }, h('h3', null, 'Chaves de integração'), h('p', { class: 'dica' }, 'Para outro sistema (da prefeitura ou da concessionária) consultar os dados do projeto. A chave só permite ler registros, ordens de serviço e indicadores; não grava nada. Cada uso fica na auditoria. Como usar: docs/api.md no repositório do app.'), chaves),
      h('div', { class: 'cartao' }, h('h3', null, 'Registro de auditoria'), h('p', { class: 'dica' }, 'Entradas no sistema, senhas erradas, bloqueios, mudanças em usuários, projetos e formulários, validações, importações e exportações. As alterações em cada árvore ficam na coluna historico do próprio registro.'), filtro, tabela));
    try { itens = await Api.b.auditoria(500); pintar(); } catch (e) { tabela.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    if (!st.demo) { pintarRestauracao(restaura); pintarChaves(chaves); }
  }
  async function pintarRestauracao(box) {
    const projetos = await Api.b.projetosListar().catch(() => []);
    const selP = h('select', { class: 'entrada' }, projetos.map((p) => h('option', { value: p.id, selected: S.projeto && p.id === S.projeto.id }, p.nome)));
    const selC = h('select', { class: 'entrada' }); const msg = h('div');
    const carregar = async () => { selC.replaceChildren(h('option', { value: '' }, 'Carregando...')); try { const cs = await Api.b.backupListar(selP.value); selC.replaceChildren(cs.length ? cs.map((c) => h('option', { value: c.id }, /antes da restauração/.test(c.nome) ? 'Estado antes de uma restauração (' + c.nome.slice(-16).replace(/-(\d\d)$/, ':$1') + ')' : 'Cópia de ' + c.dia.split('-').reverse().join('/'))) : h('option', { value: '' }, 'Nenhuma cópia deste projeto ainda')); } catch (e) { selC.replaceChildren(h('option', { value: '' }, e.message)); } };
    const restaurar = async () => {
      const p = projetos.find((x) => x.id === selP.value); if (!selC.value || !p) return toast('Escolha a cópia.');
      const conf = h('input', { class: 'entrada', placeholder: p.nome });
      const ok = await modal('Restaurar cópia', h('div', null, h('p', null, `Os registros e as ordens de serviço de "${p.nome}" vão voltar para: ${selC.selectedOptions[0].textContent}.`), h('div', { class: 'aviso' }, 'O que foi enviado depois dessa data deixa de aparecer na planilha (fica guardado na cópia "antes da restauração"). Avise as equipes antes.'), h('p', null, 'Para confirmar, escreva o nome do projeto:'), conf), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Restaurar', classe: 'perigo', valor: true }]);
      if (!ok) return; if (conf.value.trim() !== p.nome) return toast('O nome não confere. Nada foi alterado.');
      msg.replaceChildren(h('div', { class: 'info' }, 'Restaurando...'));
      try { const r = await Api.b.backupRestaurar(p.id, selC.value); S.linhas = {}; S.painel = null; msg.replaceChildren(h('div', { class: 'info' }, `Restaurado: ${pl(r.registros, 'registro', 'registros')} e ${pl(r.ordens, 'ordem de serviço', 'ordens de serviço')}. O estado anterior foi guardado e aparece na lista para desfazer.`)); carregar(); } catch (e) { msg.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    };
    selP.addEventListener('change', carregar);
    box.replaceChildren(h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), selP), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Cópia'), selC)), h('div', { class: 'linha-btn' }, h('button', { class: 'btn perigo', onclick: restaurar }, 'Restaurar esta cópia')), msg);
    carregar();
  }
  async function pintarChaves(box) {
    const projetos = await Api.b.projetosListar().catch(() => []);
    const nome = h('input', { class: 'entrada', placeholder: 'Ex.: Sistema da prefeitura' });
    const selP = h('select', { class: 'entrada' }, projetos.map((p) => h('option', { value: p.id, selected: S.projeto && p.id === S.projeto.id }, p.nome)));
    const lista = h('div'); const msg = h('div');
    const pintar = async () => {
      try {
        const cs = await Api.b.chavesListar();
        lista.replaceChildren(cs.length ? h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Nome'), h('th', null, 'Projeto'), h('th', null, 'Criada'), h('th', null, 'Situação'), h('th', null, '')),
          cs.map((c) => h('tr', null, h('td', null, c.nome), h('td', null, c.projeto), h('td', null, `${dataBR(c.criada_em)} por ${c.criada_por}`), h('td', null, c.ativa ? 'Ativa' : 'Revogada'),
            h('td', null, c.ativa ? h('button', { class: 'btn perigo peq', onclick: async () => { if (!(await confirmar('Revogar chave', `O sistema "${c.nome}" deixa de conseguir consultar os dados. Revogar?`, 'Revogar', 'perigo'))) return; try { await Api.b.chaveRevogar(c.id); toast('Chave revogada.'); pintar(); } catch (e) { toast(e.message); } } }, 'Revogar') : null))))
          : h('p', { class: 'dica' }, 'Nenhuma chave criada.'));
      } catch (e) { lista.replaceChildren(h('div', { class: 'aviso' }, /desconhecida/i.test(e.message) ? 'Disponível depois da atualização do servidor (versão 2.2).' : e.message)); }
    };
    const criar = async () => {
      if (!nome.value.trim()) return toast('Dê um nome à chave.');
      try {
        const r = await Api.b.chaveCriar(nome.value.trim(), selP.value); nome.value = '';
        const campo = h('input', { class: 'entrada', value: r.chave, readonly: true, onfocus: (e) => e.target.select() });
        msg.replaceChildren(h('div', { class: 'info' }, h('p', null, 'Copie a chave agora. Ela não aparece de novo; se perder, revogue e crie outra.'), campo, h('button', { class: 'btn sec peq', style: 'margin-top:8px', onclick: async () => { try { await navigator.clipboard.writeText(r.chave); toast('Chave copiada.'); } catch (e) { campo.select(); } } }, 'Copiar')));
        pintar();
      } catch (e) { toast(e.message, 5000); }
    };
    box.replaceChildren(h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome do sistema'), nome), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), selP)), h('div', { class: 'linha-btn' }, h('button', { class: 'btn', onclick: criar }, 'Criar chave')), msg, lista);
    pintar();
  }

  // ---------- Fundo do mapa: ruas ou satélite ----------
  function camadasFundo(mapa, satelite) {
    const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagem © Esri, Maxar, Earthstar Geographics' });
    const rot = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19 });
    const hib = L.layerGroup([sat, rot]);
    const escolha = satelite ? 'sat' : (S.fundo || 'ruas');
    (escolha === 'sat' ? hib : ruas).addTo(mapa);
    if (!satelite) { L.control.layers({ 'Ruas': ruas, 'Satélite': hib }, null, { position: 'topright' }).addTo(mapa); mapa.on('baselayerchange', (e) => { S.fundo = e.layer === hib ? 'sat' : 'ruas'; Store.set('fundo', S.fundo); }); }
  }
  async function buscarEndereco(txt) {
    const cid = S.projeto.municipio || '';
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(txt + (cid && !norm(txt).includes(norm(cid.split('/')[0])) ? ', ' + cid : ''))}`, { headers: { 'Accept-Language': 'pt-BR' } });
    const j = await r.json(); return j[0] ? { lat: +j[0].lat, lon: +j[0].lon, nome: j[0].display_name } : null;
  }

  // ---------- Fotos ----------
  async function reduzir(arq, max, q) {
    let bmp;
    try { bmp = await createImageBitmap(arq, { imageOrientation: 'from-image' }); } catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('formato não suportado')); i.src = URL.createObjectURL(arq); }); }
    const w = bmp.width, hh = bmp.height, k = Math.min(1, max / Math.max(w, hh));
    if (k === 1 && arq.type === 'image/jpeg' && arq.size < 1.5e6) return arq;
    const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(hh * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
  }

  window.__app = { S, Store, sincronizar };
  iniciar().catch((e) => { $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'aviso' }, 'Erro ao iniciar: ' + e.message), h('button', { class: 'btn', onclick: () => sair(true) }, 'Voltar ao login'))); });
})();
