// Neofloresta Inventário
(() => {
  const VERSAO = '2.6.0';
  const TERMO_VERSAO = '2026-11-b';
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
  // espécie parecida com o que foi digitado: começo das palavras (nome científico ou popular), sem acento, com 1 ou 2 letras erradas
  function distEd(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let p = Array.from({ length: n + 1 }, (x, j) => j); for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; } return p[n]; }
  function buscaEspecie(lista, q) {
    const termos = norm(q).trim().split(/\s+/).filter(Boolean); if (!termos.length) return [];
    const pontua = (e) => {
      const ws = norm(e.cientifico + ' ' + (e.popular || '')).split(/[\s,;()-]+/).filter(Boolean); let tot = 0;
      for (const t of termos) {
        let best = 9; for (const w of ws) { if (w.startsWith(t)) { best = 0; break; } if (t.length >= 4) best = Math.min(best, distEd(t, w.slice(0, t.length)) + 0.5); }
        if (best > (t.length >= 7 ? 2.5 : t.length >= 4 ? 1.5 : 0)) return -1; tot += best;
      }
      return tot;
    };
    return lista.map((e) => [e, pontua(e)]).filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1] || a[0].cientifico.localeCompare(b[0].cientifico)).map((x) => x[0]);
  }
  function dataCurta(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', ''); }
  function dataAno(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
  function dataBR(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function numBR(v) { return v == null || v === '' ? '' : String(v).replace('.', ','); }
  function paraNum(s) { if (s == null) return null; const t = String(s).trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return isNaN(n) ? null : n; }
  function toast(msg, ms = 2600, acao, erro) { document.querySelectorAll('.toast').forEach((x) => { if (!x.querySelector('.toast-acao')) x.remove(); }); const t = h('div', { class: 'toast' + (erro || /^(Erro|Não foi possível|Falha)/.test(String(msg)) ? ' erro' : ''), role: 'status', 'data-t': String(Date.now()) }, h('span', null, msg), acao ? h('button', { class: 'toast-acao', onclick: () => { t.remove(); acao.fn(); } }, acao.texto) : null); document.body.append(t); setTimeout(() => t.remove(), acao ? Math.max(ms, 6000) : ms); }
  function modal(titulo, corpo, botoes) {
    return new Promise((res) => {
      const fechar = (v) => { veu.remove(); res(v); };
      const aberto = Date.now();
      const veu = h('div', { class: 'veu', onclick: (e) => { if (e.target === veu && Date.now() - aberto > 400) fechar(null); } },
        h('div', { class: 'folha' }, titulo ? h('h3', null, titulo) : null, corpo,
          botoes && botoes.length ? h('div', { class: 'linha-btn' + (botoes.length > 3 ? ' col' : ''), style: 'margin-top:14px' }, botoes.map((b) => h('button', { class: 'btn ' + (b.classe || ''), onclick: () => fechar(b.valor) }, b.texto))) : null));
      document.body.append(veu);
    });
  }
  const confirmar = (titulo, texto, ok = 'Confirmar', classe = '', nao = 'Cancelar') => modal(titulo, h('p', null, texto), [{ texto: nao, classe: 'sec', valor: false }, { texto: ok, classe, valor: true }]);
  function baixar(nome, dados, tipo) { const b = dados instanceof Blob ? dados : new Blob([dados], { type: tipo }); const a = h('a', { href: URL.createObjectURL(b), download: nome }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  const ICONES = {
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.5 13.8c2.9-.4 5 1.8 5 4.7"/>',
    alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    cidade: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', selecionar: '<path d="M5 5h4M15 5h4M5 19h4M15 19h4M5 5v4M19 5v4M5 15v4M19 15v4"/><path d="M10 12l2 2 3-4"/>', fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', voltar: '<path d="M15 5l-7 7 7 7"/>', mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    busca: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', mais: '<path d="M12 5v14M5 12h14"/>',
    etapas: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', esq: '<path d="M15 5l-7 7 7 7"/>', dir: '<path d="M9 5l7 7-7 7"/>',
  };
  function ico(n) { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg>`; return s; }

  function topo(titulo, sub, esquerda, direita) {
    return h('header', { class: 'topo' }, esquerda, h('h1', null, titulo, sub ? h('small', null, sub) : null), direita);
  }

  // ---------- GPS ----------
  // O GPS só liga depois do termo aceito e, na primeira vez, com uma explicação antes do pedido do celular
  async function ligarGps() {
    if (Gps.id != null || !navigator.geolocation) return;
    let estado = ''; try { estado = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { /* navegador antigo */ }
    void estado; // a explicação da localização fica na configuração do primeiro acesso (telaConfigurar)
    Gps.iniciar();
  }
  function pintarAvisoGps() {
    const el = document.getElementById('aviso-gps'); if (!el) return;
    el.replaceChildren(S.gpsNegado ? h('div', { class: 'aviso' }, h('b', null, 'O GPS está bloqueado para o app.'), h('br'), 'Android: toque no cadeado ao lado do endereço, em Permissões, Localização, Permitir. iPhone: Ajustes, Safari, Localização, Permitir. Depois feche e abra o app.') : '');
  }
  const Gps = {
    id: null, ouvintes: new Set(),
    iniciar() {
      if (this.id != null || !navigator.geolocation) return;
      this.id = navigator.geolocation.watchPosition((p) => {
        S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, prec: Math.round(p.coords.accuracy * 10) / 10, t: Date.now() };
        this.ouvintes.forEach((f) => f(S.pos));
      }, (e) => { S.posErro = e.message; if (e.code === 1) { S.gpsNegado = true; pintarAvisoGps(); } this.ouvintes.forEach((f) => f(null, e)); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    },
    // pede uma leitura nova na hora. O watch só avisa quando a posição muda: com o celular parado ele fica quieto
    // e a árvore nova ficava sem GPS. Reiniciar o acompanhamento força o aparelho a entregar a posição atual.
    // uma leitura nova, sem reiniciar o acompanhamento (a tela de marcação pede uma por segundo)
    ler() { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition((p) => { S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, prec: Math.round(p.coords.accuracy * 10) / 10, t: Date.now() }; this.ouvintes.forEach((f) => f(S.pos)); }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }); },
    agora() {
      if (!navigator.geolocation) return;
      if (this.id != null) { navigator.geolocation.clearWatch(this.id); this.id = null; this.iniciar(); }
      navigator.geolocation.getCurrentPosition((p) => {
        S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, prec: Math.round(p.coords.accuracy * 10) / 10, t: Date.now() };
        this.ouvintes.forEach((f) => f(S.pos));
      }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    },
  };
  function classeGps(prec) { return prec == null ? 'ruim' : prec <= 5 ? 'bom' : prec <= 15 ? 'medio' : 'ruim'; }

  // ---------- Sessão e projeto ----------
  async function iniciar() {
    try { if (await Store.get('modoSol')) document.documentElement.classList.add('sol'); } catch (e) { /* segue */ }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* segue */ } // pede ao navegador para não apagar os dados do app (fotos e cadastros)
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
      Api.credenciais(credDe(S.sessao)); S.termoLocal = await Store.get('termoV:' + S.sessao.u); S.configurado = !!(await Store.get('configurado:' + S.sessao.u));
      if (S.sessao.usuario.perfil === 'campo') S.sessao.usuario.perfil = 'coletor';
      if (S.sessao.usuario.perfil !== 'cliente') await abrirProjeto(S.sessao.projetoAtual); else await abrirProjetoCliente(S.sessao.projetoAtual);
      if (S.sessao.usuario.perfil !== 'cliente' && termoEmDia()) ligarGps();
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
      if (S.novaVersao && (['', '#inicio', '#lista', '#mapa'].includes(location.hash))) pintarAvisoVersao();
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
      if (S.termoLocal === TERMO_VERSAO && r.usuario && r.usuario.termo_versao !== TERMO_VERSAO) Object.assign(r.usuario, { termo_versao: TERMO_VERSAO, termo_aceito_em: r.usuario.termo_aceito_em || S.sessao.usuario.termo_aceito_em || agoraISO() }); // aceite no aparelho ainda indo ao servidor
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
    Dupla.carregar().then(() => Turno.carregar()).catch(() => {});
    // a numeração dos códigos se prepara em segundo plano: a tela abre na hora
    S.prepCodigosOk = false;
    S.prepCodigos = (async () => { await Promise.race([sincronizarSequencia(), new Promise((r) => setTimeout(r, 8000))]); await Promise.race([garantirFaixa(), new Promise((r) => setTimeout(r, 8000))]); S.prepCodigosOk = true; })();
  }
  // O formulário guardado no aparelho abre na hora; a versão do servidor é conferida em segundo plano
  // e passa a valer quando não houver cadastro aberto.
  async function carregarForm(id, forcarCache, fresco) {
    const chave = 'form:' + id;
    const local = await Store.get(chave);
    if (local && !forcarCache && !fresco && !Api.demo) { if (navigator.onLine && !(S.formsEm && Date.now() - S.formsEm < 300000)) atualizarFormFundo(id, local); return local; }
    if (!forcarCache && navigator.onLine) {
      try { const f = await Api.b.formulario(id); if (f) { await Store.set(chave, f); return f; } } catch (e) { console.warn(e); }
    }
    if (!local) throw new Error('Formulário indisponível sem internet. Conecte e tente de novo.');
    return local;
  }
  async function atualizarFormFundo(id, local) {
    try {
      const f = await Api.b.formulario(id); if (!f || JSON.stringify(f) === JSON.stringify(local)) return;
      await Store.set('form:' + id, f);
      const aplicar = () => { if (S.projeto && S.projeto.formulario === id && !S.reg) { S.form = f; return true; } return false; };
      if (!aplicar()) { const t = setInterval(() => { if (aplicar()) clearInterval(t); }, 2000); }
    } catch (e) { /* sem conexão: segue com o do aparelho */ }
  }

  // esboço da tela enquanto carrega (no lugar de um texto solto)
  const esboco = (txt) => h('div', { class: 'esboco', role: 'status', 'aria-label': txt }, h('small', { class: 'dica' }, txt), [90, 70, 80, 55, 85].map((w) => h('div', { class: 'carregando-esboco', style: `width:${w}%` })));
  function rota() {
    document.querySelectorAll('.veu').forEach((v) => v.remove());
    document.querySelectorAll('.toast').forEach((t) => { if (!t.querySelector('.toast-acao') && Date.now() - (+t.dataset.t || 0) > 1500) t.remove(); }); // aviso antigo da tela anterior não fica por cima da nova (o recém-mostrado e o de "Desfazer" ficam)
    if (S.reg && !location.hash.startsWith('#form/' + S.reg.uuid)) { const r = S.reg; clearTimeout(salvarTimer); Store.salvarRegistro(r); Gps.ouvintes.forEach((f) => f.__form && Gps.ouvintes.delete(f)); S.reg = null; }
    if (location.hash.startsWith('#ajuda')) return telaAjuda(location.hash.split('/')[1] || ''); // ajuda abre até antes de entrar
    if (!S.sessao) return telaLogin();
    if (!termoEmDia()) return telaTermo(true);
    const [r, a, b] = location.hash.replace(/^#/, '').split('/');
    if (r === 'configurar') return telaConfigurar(+a || 0);
    if (perfil() === 'coletor' && S.projeto && !S.configurado) return telaConfigurar(0); // primeiro acesso no aparelho: configuração curta antes do mapa
    const pf = perfil();
    if (r === 'sobre') return telaSobre();
    if (r === 'admin' && pf === 'admin') return telaAdmin(a);
    if (!S.projeto) { if (pf === 'admin') return telaAdmin('projetos'); return telaLogin(); }
    if (r === 'painel' && pf !== 'coletor') return telaPainel();
    if (r === 'hoje' && ehCoord()) return telaHoje(a || null);
    if (r === 'relatorio' && pf !== 'coletor') return telaRelatorio();
    if (r === 'medicao' && pf !== 'coletor') return telaMedicao();
    if (r === 'lista') return telaInicio();
    if (pf === 'coletor' && (r === 'mapa' || r === 'inicio' || !r)) return telaMapa({ campo: true }); // equipe de campo: mapa primeiro
    if (r === 'mapa') return telaMapa();
    if (r === 'ordens') return telaOrdens();
    if (r === 'preferencias') return telaPreferencias();
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
    const olho = h('button', { class: 'bt-olho', type: 'button', 'aria-label': 'Mostrar a senha', 'aria-pressed': 'false', onclick: () => { const ver = s.type === 'password'; s.type = ver ? 'text' : 'password'; olho.textContent = ver ? 'Ocultar' : 'Mostrar'; olho.setAttribute('aria-pressed', ver ? 'true' : 'false'); olho.setAttribute('aria-label', ver ? 'Ocultar a senha' : 'Mostrar a senha'); s.focus(); } }, 'Mostrar');
    const erro = h('div', { class: 'erro-login oculto', role: 'alert' });
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
        Api.credenciais(credDe(S.sessao)); S.expirada = false; S.termoLocal = await Store.get('termoV:' + usuario); S.configurado = !!(await Store.get('configurado:' + usuario));
        await Store.set('sessao', S.sessao);
        for (const [fid, f] of Object.entries(r.formularios || {})) if (f && Array.isArray(f.campos)) { await Store.set('form:' + fid, f); S.formsEm = Date.now(); }
        if (r.usuario.perfil === 'cliente') await abrirProjetoCliente(S.sessao.projetoAtual); else { await abrirProjeto(S.sessao.projetoAtual); if (termoEmDia()) ligarGps(); }
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
      h('div', { class: 'campo' }, u), h('div', { class: 'campo campo-senha' }, s, olho), erro, btn,
      h('p', { class: 'dica', style: 'text-align:center;margin:10px 0 0' }, 'Esqueceu a senha? Fale com a coordenação do projeto: ela cria uma senha nova.'),
      Api.demo || /[?&]config/.test(location.search) ? h('button', { class: 'btn linha cheio', style: 'margin-top:12px', onclick: configurarServidor }, 'Configurar servidor') : null,
      h('p', { class: 'dica', style: 'text-align:center;margin-top:18px' }, 'Versão ' + VERSAO, ' · ', h('a', { href: '#', class: 'link-termo', onclick: (e) => { e.preventDefault(); verTermo(); } }, 'Termo de uso e privacidade'), ' · ', h('a', { href: '#ajuda', class: 'link-ajuda' }, 'Ajuda'))), h('div', { class: 'padronagem', 'aria-hidden': 'true' })));
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
    const regs = await Store.todosRegistros();
    const pend = regs.filter((r) => r.status === 'pendente' || (r.status === 'enviado' && fotoFalta(r))).length + (S.sessao ? await nFilaOS() : 0); // inclui fotos esperando o Wi-Fi
    if (!semPerguntar && pend && !(await confirmar('Sair', `Há ${pend} registro(s) ou atualização(ões) de ordem de serviço ainda não enviados (registros, fotos esperando o Wi-Fi ou ordens de serviço). Eles continuam guardados neste aparelho e serão enviados quando você entrar de novo com o mesmo usuário.`, 'Sair mesmo assim'))) return;
    try { await Api.b.sair(); } catch (e) { /* sem conexão: a sessão expira sozinha */ }
    S.ultimoUsuario = S.sessao && S.sessao.u; S.sessao = null; S.projeto = null; S.linhas = {}; S.painel = null; S.qdSitEm = null; S.qdEm = null; S.formsEm = null; await Store.del('sessao'); location.hash = ''; telaLogin();
  }

  // ---------- Sincronização ----------
  const $sync = () => document.querySelector('.sync');
  const fotoFalta = (r) => Object.values(r.fotos || {}).some((f) => f && f.chave && !f.enviado);
  // a enviar: registro pendente, ou registro já enviado com foto esperando (Wi-Fi ou falha)
  async function pendentes() { return (await Store.todosRegistros()).filter((r) => !r.__base && (r.status === 'pendente' || (r.status === 'enviado' && fotoFalta(r)))); }
  // fotos sobem só no Wi-Fi (padrão); os cadastros sobem sempre. "Mandar agora" libera no 4G até sair do app.
  async function fotosSoWifi() { const v = await Store.get('fotosWifi'); return v == null ? true : !!v; }
  async function podeFotos() {
    if (S.fotosAgora || !(await fotosSoWifi())) return true;
    const c = navigator.connection; if (!c || !c.type || c.type === 'unknown') return true; // sem como saber: manda
    return c.type === 'wifi' || c.type === 'ethernet';
  }
  async function atualizarSync() {
    const el = $sync(); if (!el) return;
    const pend = await pendentes(); const nReg = pend.filter((r) => r.status === 'pendente').length;
    const nFot = pend.reduce((a, r) => a + Object.values(r.fotos || {}).filter((f) => f && f.chave && !f.enviado).length, 0);
    const n = nReg + (await nFilaOS()) + (await nFilaQd());
    el.className = 'sync' + (!navigator.onLine ? ' off' : n || nFot ? ' pend' : '');
    if (S.expirada) { el.className = 'sync pend'; el.textContent = 'Entrar de novo'; return; }
    const esperaWifi = nFot && !(await podeFotos());
    el.textContent = S.sincronizando ? 'Enviando...' : !navigator.onLine ? (n || nFot ? `Sem rede · ${n || nFot}` : 'Sem rede') : n ? `${n} a enviar` : nFot ? (esperaWifi ? `${pl(nFot, 'foto', 'fotos')} no Wi-Fi` : `${pl(nFot, 'foto', 'fotos')} a enviar`) : (Api.demo ? 'Demonstração' : 'Tudo enviado');
    el.title = esperaWifi ? 'As fotos sobem quando o celular estiver no Wi-Fi. Toque para mandar agora pelo 4G.' : '';
  }
  async function tocarSync() {
    const pend = await pendentes(); const nFot = pend.reduce((a, r) => a + Object.values(r.fotos || {}).filter((f) => f && f.chave && !f.enviado).length, 0);
    if (nFot && !(await podeFotos()) && await confirmar('Mandar fotos agora', `${pl(nFot, 'foto está esperando', 'fotos estão esperando')} o Wi-Fi. Mandar agora pelo 4G? Gasta internet do plano.`, 'Mandar agora')) S.fotosAgora = true;
    sincronizar();
  }
  async function sincronizar(silencioso) {
    if (S.expirada && !silencioso) return reentrar();
    if (S.sincronizando || !S.sessao || S.expirada || perfil() === 'cliente') return;
    if (!navigator.onLine) { if (!silencioso) toast('Sem internet. Os dados ficam guardados e serão enviados depois.'); return atualizarSync(); }
    S.sincronizando = true; // marcado antes de qualquer espera: nunca roda duas vezes ao mesmo tempo
    try { const tp = await Store.get('termoPend:' + S.sessao.u); if (tp) { await Api.b.aceitarTermo(tp); await Store.del('termoPend:' + S.sessao.u); } } catch (e) { /* tenta no próximo envio */ }
    try { await enviarPendentes(silencioso); if (!S.expirada) await enviarFilaOS(silencioso); if (!S.expirada) await enviarFilaQd(silencioso); if (!S.expirada) await Turno.enviar(); } finally { S.sincronizando = false; await atualizarSync(); }
    garantirFaixa();
    if (S.expirada) return;
    await atualizarSituacao();
    await conferirEnvio();
    if (['', '#inicio', '#lista', '#mapa'].includes(location.hash)) listarRegistros();
  }
  // Conferência: pergunta ao servidor se os registros enviados chegaram e se cada foto tem link.
  // O que não chegou volta para a fila e é reenviado. A foto continua guardada no celular.
  async function conferirEnvio() {
    if (Api.demo || !navigator.onLine || !S.projeto || !['coletor', 'revisor'].includes(perfil())) return;
    if (S.conferidoEm && Date.now() - S.conferidoEm < 5 * 60000) return; S.conferidoEm = Date.now();
    try {
      const alvo = (await Store.registros(S.projeto.id)).filter((r) => r.status === 'enviado' && !r.conferido && !r.conferenciaFalhou && !r.__base && !fotoFalta(r) && (perfil() !== 'coletor' || !r.usuario || r.usuario === S.sessao.u)).slice(0, 300); // celular compartilhado: confere só os do próprio login
      if (!alvo.length) return;
      const ach = await Api.b.conferir(S.projeto.id, alvo.map((r) => r.uuid)); if (!ach) return;
      let reenviar = 0;
      for (const r0 of alvo) {
        const r = await Store.registro(r0.uuid); if (!r || r.status !== 'enviado' || r.__base) continue;
        const a = ach[r.uuid];
        if (a && Object.keys(r.fotos || {}).every((k) => !r.fotos[k] || !r.fotos[k].chave || a.fotos[k])) { r.conferido = true; await Store.salvarRegistro(r); continue; }
        r.tentConf = (r.tentConf || 0) + 1;
        if (r.tentConf > 3) { r.conferenciaFalhou = true; r.erroSync = 'O servidor não confirmou este registro depois de 3 envios. Avise a coordenação.'; await Store.salvarRegistro(r); continue; } // não vale como confirmado: as fotos nunca são liberadas
        if (!a) { r.status = 'pendente'; reenviar++; } // não está na planilha: manda de novo
        else {
          let falta = false; for (const [campo, f] of Object.entries(r.fotos || {})) if (f && f.chave && !a.fotos[campo]) { f.enviado = false; falta = true; }
          if (falta) reenviar++; else r.conferido = true;
        }
        await Store.salvarRegistro(r);
      }
      if (reenviar) { S.conferidoEm = 0; setTimeout(() => sincronizar(true), 1000); }
    } catch (e) { S.conferidoEm = 0; /* tenta na próxima */ }
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
        let r = await Store.registro(uid); if (!r || r.__base || !(r.status === 'pendente' || (r.status === 'enviado' && fotoFalta(r)))) continue;
        const p = S.sessao.projetos.find((x) => x.id === r.projeto);
        const form = S.projeto && r.projeto === S.projeto.id ? S.form : await carregarForm(p ? p.formulario : '', true);
        const fotosOk = await podeFotos(); const soFotos = r.status === 'enviado';
        if (fotosOk) for (const [campo, f] of Object.entries(r.fotos || {})) {
          if (!f || f.enviado) continue;
          const blob = await Store.foto(f.chave);
          let res = null; if (blob) res = await Api.b.foto(r.projeto, f.nome.replace(/^DCIM\//, ''), blob);
          const cur = await Store.registro(uid); // grava só se a foto ainda é a mesma no registro
          if (cur && cur.fotos && cur.fotos[campo] && cur.fotos[campo].chave === f.chave) { Object.assign(cur.fotos[campo], { enviado: true, url: (res && res.url) || '', idDrive: (res && res.id) || '' }); await Store.salvarRegistro(cur); }
        }
        r = await Store.registro(uid); if (!r || r.__base) continue;
        if (soFotos) { if (!fotosOk || fotoFalta(r)) continue; } // registro já estava no servidor: reenvia só para gravar os links das fotos
        else if (r.status !== 'pendente') continue;
        if (r.lat != null && !r.endereco && S.geocodificados < 20 && !Api.demo) {
          S.geocodificados++; const e = await enderecoDe(r.lat, r.lon);
          if (e) { const cur = await Store.registro(uid); if (cur && cur.atualizado_em === r.atualizado_em) { Object.assign(cur, e); await Store.salvarRegistro(cur); r = cur; } }
        }
        const res = await Api.b.registro(r.projeto, Api.achatar(r, form));
        const atual = await Store.registro(uid);
        if (atual && atual.atualizado_em === r.atualizado_em && !atual.__base) {
          atual.status = 'enviado'; delete atual.erroSync; delete atual.conferido; delete atual.conferenciaFalhou; delete atual.tentConf;
          if (res && res.validacao) atual.validacao = res.validacao;
          if (res && res.ignorado && !(soFotos && res.soLinks)) { atual.conflito = 'A coordenação alterou este registro depois desta versão. A versão do aparelho não foi aplicada.'; aviso = atual.conflito; } else delete atual.conflito;
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
    if (ok) { await Store.set('ultimoEnvio:' + S.projeto.id, Date.now()); const ue = document.getElementById('ult-envio'); if (ue) ue.textContent = 'Último envio às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    if (S.expirada) return;
    if (!silencioso || falhas || aviso) toast(falhas ? `Enviados ${ok}. Falharam ${falhas}: ${ultimoErro}` : aviso || `${pl(ok, 'registro enviado', 'registros enviados')}.`, falhas || aviso ? 5000 : 2600);
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
      if (mudou && (['', '#inicio', '#lista', '#mapa'].includes(location.hash))) listarRegistros();
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
    const col = perfil() === 'coletor'; // para a equipe de campo esta é a lista "Meus registros" (a tela principal é o mapa)
    const menu = col ? h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar ao mapa' }, ico('voltar')) : h('button', { class: 'ic', onclick: abrirMenu, 'aria-label': 'Menu' }, ico('menu'));
    const sync = h('button', { class: 'sync', onclick: tocarSync }, '...');
    const busca = h('input', { class: 'busca', placeholder: 'Buscar código ou espécie', oninput: () => listarRegistros(busca.value) });
    $app.replaceChildren(
      topo(col ? 'Meus registros' : S.projeto.nome, col ? S.projeto.nome : S.projeto.equipe || S.sessao.usuario.nome, menu, h('div', { class: 'topo-dir' }, ajudaBt(''), h('button', { class: 'ic', onclick: () => ir('#mapa'), 'aria-label': 'Mapa' }, ico('mapa')), sync)),
      h('main', null,
        S.expirada ? h('div', { class: 'aviso' }, 'Sua sessão expirou. ', h('button', { class: 'btn peq', onclick: reentrar }, 'Entrar de novo'), ' Os registros continuam guardados aqui.') : null,
        h('button', { class: 'btn nova canto', onclick: novoRegistro }, ico('mais'), 'Nova árvore'),
        ehCoord() ? h('div', { class: 'linha-btn coord-atalhos' }, h('button', { class: 'btn sec', onclick: () => ir('#hoje') }, 'Hoje no campo'), h('button', { class: 'btn sec', onclick: () => ir('#painel') }, 'Panorama geral')) : null,
        h('div', { id: 'encerrar-face' }),
        h('div', { id: 'aviso-versao' }),
        h('div', { id: 'turno' }), h('div', { id: 'aviso-gps' }), h('div', { id: 'aviso-espaco' }), h('div', { id: 'continuar' }),
        h('div', { id: 'devolvidos' }),
        h('div', { id: 'os-equipe' }),
        h('div', { class: 'resumo', id: 'stats' }), h('small', { class: 'ult-envio', id: 'ult-envio' }),
        h('div', { class: 'busca-box' }, ico('busca'), busca),
        h('div', { id: 'lista', class: 'lista' })));
    atualizarSync(); listarRegistros(); pintarAvisoVersao(); pintarOSEquipe(); pintarEncerrarFace(); pintarAvisoGps(); pintarDicaGps(); pintarTurno(); pintarEspaco();
  }

  // "Encerrar face": a face que a equipe está fazendo, com confirmação para não encerrar sem querer
  async function pintarEncerrarFace() {
    const el = document.getElementById('encerrar-face'); if (!el || !['coletor', 'revisor', 'admin'].includes(perfil())) return;
    try {
      const cam = await carregarQuadras(); if (!cam || S.qdTemFaces !== S.projeto.id || !document.body.contains(el)) return;
      const sit = await carregarSitQd(false); const eq = minhaEquipe();
      const minhas = [...(sit.faces || new Map()).values()].filter((f) => f.situacao === 'Em levantamento' && (!f.equipe || f.equipe === eq || ehCoord()));
      if (!minhas.length || !document.body.contains(el)) return el.replaceChildren();
      el.replaceChildren(h('button', { class: 'btn contorno encerrar-face', onclick: () => encerrarFace(minhas) }, ico('check'), minhas.length > 1 ? `Encerrar face (${minhas.length} em andamento)` : 'Encerrar face'));
    } catch (e) { /* sem quadras */ }
  }
  async function encerrarFace(minhas) {
    const idx = S.qdIdx; const achar = (id) => { const k = id.lastIndexOf('-'); const q = idx.porN.get(id.slice(0, k)); const f = q && q.f && q.f.find((y) => y.i === id.slice(k + 1)); return q && f ? { q, f, id } : null; };
    let fs = minhas.map((x) => achar(x.numero)).filter(Boolean);
    if (S.pos) { const d = (x) => { const c = Quadras.faceCoords(x.q, x.f); const m = c[Math.floor(c.length / 2)]; return Math.hypot((m[0] - S.pos.lon) * 104000, (m[1] - S.pos.lat) * 110540); }; fs.sort((a, b) => d(a) - d(b)); }
    let alvo = fs[0];
    if (fs.length > 1) {
      const v = await modal('Qual face encerrar?', h('p', { class: 'dica' }, 'A mais perto de você está primeiro.'), fs.slice(0, 6).map((x) => ({ texto: `Face ${x.f.i} da quadra ${x.q.n} · ${x.f.r}`, classe: 'sec', valor: x.id })).concat([{ texto: 'Cancelar', classe: 'sec', valor: null }]));
      if (!v) return; alvo = fs.find((x) => x.id === v);
    }
    if (!alvo) return;
    const v = await modal('Encerrar face', h('p', null, `Deseja mesmo encerrar a face ${alvo.f.i} da quadra ${alvo.q.n} (${alvo.f.r}, ${fmtN(alvo.f.c)} m)?`),
      [{ texto: 'Cancelar', classe: 'sec', valor: null }, { texto: 'Levantada, sem árvores (foto)', classe: 'sec', valor: 'sem' }, { texto: 'Sim, levantada', valor: 'ok' }]);
    if (v === 'sem') return iniciarCalcadaFace(alvo.q, alvo.f);
    if (v !== 'ok') return;
    try { const r = await marcarQuadras([{ tipo: 'face', numero: alvo.id, situacao: 'Levantada', rua: alvo.f.r }]); if (r.recusadas && r.recusadas.length) toast(r.recusadas[0].motivo, 5000); else toast(r.fila ? 'Face encerrada. Vai quando houver rede.' : `Face ${alvo.f.i} da quadra ${alvo.q.n} encerrada.`, 3500); pintarEncerrarFace(); } catch (e) { toast(e.message, 5000); }
  }
  async function pintarOSEquipe() {
    const el = document.getElementById('os-equipe'); if (!el || perfil() !== 'coletor') return;
    try {
      const d = await carregarOS(false); if (!document.body.contains(el)) return;
      const f = d.ordens.filter((o) => ehMinhaOS(o) && ['Aberta', 'Em execução'].includes(o.status)); const at = f.filter(atrasada).length;
      let qd = null;
      try {
        const cam = await carregarQuadras();
        if (cam) {
          const sit = await carregarSitQd(false); const r = resumoQd(cam, sit); const x = r.eq[minhaEquipe()]; const fe = resumoFaces(cam, sit).eq[minhaEquipe()];
          const kmF = fe ? ` Calçada levantada: ${fmtKm(fe.m)}.` : '';
          if (x) qd = h('button', { class: 'faixa-os faixa-qd', onclick: () => { S.qdModo = 'eq'; ir('#mapa'); } }, h('b', null, `Quadras da sua equipe: ${fmtN(x.Levantada)} de ${fmtN(x.total)} levantadas`), h('span', null, `${fmtN(x['Em levantamento'])} em levantamento.${kmF} Toque para ver no mapa`));
          else if (fe) qd = h('button', { class: 'faixa-os faixa-qd', onclick: () => { S.qdModo = 'eq'; ir('#mapa'); } }, h('b', null, `Faces da sua equipe: ${fmtN(fe.n)} levantadas`), h('span', null, `${kmF.trim()} Toque para ver no mapa`));
        }
      } catch (e) { /* sem quadras */ }
      if (!document.body.contains(el)) return;
      el.replaceChildren(qd, f.length ? h('button', { class: 'faixa-os', onclick: () => { S.filtroOS = 'fazer'; ir('#ordens'); } }, h('b', null, `${f.length} ${f.length > 1 ? 'ordens' : 'ordem'} de serviço para a sua equipe`), h('span', null, at ? `${at} atrasada${at > 1 ? 's' : ''}. Toque para ver` : 'Toque para ver e registrar a execução')) : '');
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
    const el = document.getElementById('lista'); if (!el && !document.getElementById('stats')) return;
    if (filtro == null && S.filtroLista) { filtro = S.filtroLista; S.filtroLista = null; const bx = document.querySelector('.busca'); if (bx) bx.value = filtro; }
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
    const rasc = todos.filter((r) => r.status === 'rascunho' && r.mexido);
    const cont = document.getElementById('continuar');
    if (cont) cont.replaceChildren(rasc.length ? h('button', { class: 'faixa-cont', onclick: () => ir('#form/' + rasc[0].uuid) }, h('b', null, rasc.length > 1 ? `${rasc.length} cadastros não terminados` : '1 cadastro não terminado'), h('span', null, `${codigoDe(S.form, rasc[0].valores) || ''} · Continuar`)) : '');
    const ult = await Store.get('ultimoEnvio:' + S.projeto.id); const ue = document.getElementById('ult-envio');
    if (ue) ue.textContent = ult ? `Último envio às ${new Date(ult).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${new Date(ult).toDateString() !== hoje ? ' de ' + new Date(ult).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}` : '';
    if (box) box.replaceChildren(dev.length ? h('button', { class: 'faixa-dev', onclick: () => { const b = document.querySelector('.busca'); if (b) { b.value = 'devolvido'; listarRegistros('devolvido'); } else { S.filtroLista = 'devolvido'; ir('#lista'); } } }, h('b', null, `${dev.length} registro${dev.length > 1 ? 's' : ''} devolvido${dev.length > 1 ? 's' : ''} pela coordenação`), h('span', null, 'Toque para ver e corrigir')) : '');
    if (!el) return; // no mapa (mapa primeiro) só as faixas e o resumo
    const lista = f === 'devolvido' ? dev : todos.filter((r) => !f || norm(camposCodigo(S.form).map((k) => r.valores[k.nome]).join(' ') + ' ' + (ce && r.valores[ce.nome])).includes(f));
    if (!lista.length) {
      if (filtro || perfil() !== 'coletor') return el.replaceChildren(h('div', { class: 'vazio-lista' }, filtro ? 'Nada encontrado.' : 'Nenhuma árvore cadastrada ainda neste aparelho.'));
      const instalado = window.matchMedia && matchMedia('(display-mode: standalone)').matches; const ios = /iphone|ipad/i.test(navigator.userAgent);
      return el.replaceChildren(h('div', { class: 'cartao primeiros' }, h('h3', null, 'Primeiros passos'),
        h('ol', null,
          !instalado ? h('li', null, h('b', null, 'Instale o app. '), ios ? 'No Safari, toque em Compartilhar e em "Adicionar à Tela de Início".' : 'No Chrome, toque nos 3 pontinhos e em "Instalar app".') : null,
          h('li', null, h('b', null, 'Permita a localização '), 'quando o celular perguntar, e ligue a "Precisão da localização do Google".'),
          h('li', null, h('b', null, 'Teste o GPS: '), 'fique 1 minuto parado em lugar aberto antes da primeira árvore.'),
          h('li', null, h('b', null, 'Toque em "Nova árvore" '), 'ao lado do tronco, do lado da rua, e siga as etapas.')),
        h('a', { href: '#ajuda', class: 'btn sec peq' }, 'Ver a ajuda completa')));
    }
    const itens = [];
    for (const r of lista.slice(0, 300)) {
      const img = await miniatura(r);
      const rotSt = r.status === 'enviado' && r.validacao && r.validacao !== 'Pendente' ? r.validacao : { rascunho: 'Rascunho', pendente: r.erroSync ? 'Erro' : 'A enviar', enviado: r.conferenciaFalhou ? 'Não confirmado' : 'Enviado', recusado: 'Recusado' }[r.status];
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
    const grupo = (tit, ...itens) => { const v = itens.filter(Boolean); return v.length ? h('div', { class: 'menu-grupo' }, h('b', { class: 'menu-tit' }, tit), v) : null; };
    const pf = perfil(); const coord = ehCoord(); const admin = pf === 'admin';
    const conta = grupo('Conta',
      S.sessao.projetos.length > 1 ? it('Trocar projeto', trocarProjeto) : null,
      it('Preferências', () => ir('#preferencias')),
      it('Trocar minha senha', trocarSenha),
      S.novaVersao ? it(`Atualizar para a versão ${S.novaVersao.versao}`, atualizarApp) : it('Verificar atualização', () => verificarAtualizacao(true)),
      it('Ajuda e perguntas frequentes', () => ir('#ajuda')),
      it('Sobre, termo de uso e privacidade', () => ir('#sobre')),
      it('Sair', () => sair()));
    const grupos = pf === 'cliente' ? [
      grupo('Projeto', it('Painel', () => ir('#painel')), it('Mapa das árvores', () => ir('#mapa')), it('Pedidos de serviço', () => ir('#ordens'))),
      grupo('Entregas', it('Relatório para imprimir ou PDF', () => ir('#relatorio')), it('Boletim de medição', () => ir('#medicao')), it('Baixar dados', () => exportarCliente())),
    ] : pf === 'coletor' ? [
      grupo('Campo', it('Meus registros', () => ir('#lista')), it('Ordens de serviço', () => ir('#ordens')), it('Enviar agora', () => sincronizar())),
    ] : [
      grupo('Acompanhar', coord ? it('Hoje no campo', () => ir('#hoje')) : null, it('Painel do projeto', () => ir('#painel')), it('Mapa das árvores', () => ir('#mapa'))),
      grupo('Agir', coord ? it('Validação dos registros', () => ir('#validacao')) : null, it('Ordens de serviço', () => ir('#ordens')), !admin ? it('Enviar agora', () => sincronizar()) : null),
      grupo('Entregar', it('Relatório para imprimir ou PDF', () => ir('#relatorio')), it('Boletim de medição', () => ir('#medicao')), admin ? it('Exportar dados', () => ir('#admin/exportar')) : null),
      admin ? grupo('Configurar projeto', it('Projetos', () => ir('#admin/projetos')), it('Equipes e usuários', () => ir('#admin/usuarios')), it('Pessoas das equipes', () => ir('#admin/pessoas')), it('Setores censitários', () => ir('#admin/setores')), it('Formulários', () => ir('#admin/formularios')), it('Importar inventário', () => ir('#admin/importar'))) : null,
      admin ? grupo('Administração', it('Segurança, cópias e servidor', () => ir('#admin/seguranca'))) : null,
    ];
    const veu = h('div', { class: 'veu', onclick: (e) => e.target === veu && veu.remove() }, h('div', { class: 'folha menu-lateral' },
      h('img', { class: 'folha-marca', src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }),
      h('h3', null, S.sessao.usuario.nome, h('small', { class: 'perfil-tag' }, ROT_PERFIL[pf] || '')),
      grupos, conta,
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
  async function maxLocal(campo, pre) {
    let max = Math.max((await Store.get(`seq:${S.projeto.id}:${pre}`)) || 0, (await Store.get(`srvseq:${S.projeto.id}:${pre}`)) || 0);
    for (const r of await Store.registros(S.projeto.id)) max = Math.max(max, seqDe(r.valores[campo], pre));
    return max;
  }
  // Cada aparelho usa uma faixa de números reservada no servidor (ex.: E1-0101 a E1-0200), então dois celulares
  // com o mesmo usuário nunca repetem código, mesmo sem internet. Sem faixa (servidor antigo ou nunca conectou): sequência local.
  // um código de cada vez no aparelho: dois cadastros abertos quase juntos nunca pegam o mesmo número
  let travaCodigo = Promise.resolve();
  function comTravaCodigo(fn) { const p = travaCodigo.then(fn, fn); travaCodigo = p.catch(() => {}); return p; }
  async function proximoCodigo(campo) {
    // sem número reservado: espera a numeração do servidor (fora da trava). A numeração local, sem faixa, só vale sem internet:
    // com dois celulares no mesmo login ela poderia repetir o código do outro
    const kf = `faixa:${S.projeto.id}:${prefixoEquipe()}`; const temFaixa = async () => ((await Store.get(kf)) || []).some((f) => f[0] <= f[1]);
    if (!(await temFaixa())) {
      if (S.prepCodigos && !S.prepCodigosOk) await S.prepCodigos;
      if (!(await temFaixa()) && navigator.onLine && !Api.demo) await Promise.race([garantirFaixa(true), new Promise((r) => setTimeout(r, 15000))]);
    }
    return comTravaCodigo(() => proximoCodigo1(campo));
  }
  async function proximoCodigo1(campo) {
    const pre = prefixoEquipe(); const chave = `seq:${S.projeto.id}:${pre}`; const kf = `faixa:${S.projeto.id}:${pre}`;
    const faixas = ((await Store.get(kf)) || []).filter((f) => f[0] <= f[1]);
    let n;
    if (faixas.length) { n = faixas[0][0]++; await Store.set(kf, faixas.filter((f) => f[0] <= f[1])); }
    else n = (await maxLocal(campo, pre)) + 1;
    await Store.set(chave, Math.max((await Store.get(chave)) || 0, n));
    garantirFaixa();
    return `${pre}-${String(n).padStart(4, '0')}`;
  }
  // reserva de números no servidor: pede mais quando sobram menos de 60; "urgente" espera a reserva que já está a caminho
  async function garantirFaixa(urgente) {
    if (S.reservaP) { if (urgente) await S.reservaP; return; }
    if (Api.demo || !navigator.onLine || !S.projeto || !S.form || !['coletor', 'revisor', 'admin'].includes(perfil())) return;
    const c = S.form.campos.find((x) => x.auto === 'codigo'); if (!c) return;
    const pre = prefixoEquipe(); const kf = `faixa:${S.projeto.id}:${pre}`;
    const faixas = ((await Store.get(kf)) || []).filter((f) => f[0] <= f[1]);
    if (faixas.reduce((s, f) => s + f[1] - f[0] + 1, 0) >= 60) return;
    if (S.reservaP) { if (urgente) await S.reservaP; return; }
    S.reservaP = (async () => {
      try {
        const r = await Api.b.reservar(S.projeto.id, pre, c.nome, 200, await maxLocal(c.nome, pre));
        // relê as faixas na hora de gravar: enquanto a reserva ia e voltava, códigos podem ter sido usados (não pode voltar atrás)
        if (r) await comTravaCodigo(async () => {
          const usado = (await Store.get(`seq:${S.projeto.id}:${pre}`)) || 0; const ini = Math.max(r.ini, usado + 1); // número usado sem faixa enquanto a reserva ia e voltava
          const atual = ((await Store.get(kf)) || []).filter((f) => f[0] <= f[1]); if (ini <= r.fim) atual.push([ini, r.fim]); await Store.set(kf, atual);
        });
      } catch (e) { /* sem conexão: tenta de novo na próxima abertura ou envio */ }
    })();
    try { await S.reservaP; } finally { S.reservaP = null; }
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

  async function novoRegistro(ex) {
    if (!ex || !ex.faceId) ex = null; // chamado pelo botão: recebe o clique
    if (S.abrindoNova && Date.now() - S.abrindoNova < 60000) return toast('Abrindo o cadastro...'); S.abrindoNova = Date.now(); // toque duplo não cria dois rascunhos
    try { return await novoRegistro2(ex); } finally { S.abrindoNova = false; }
  }
  async function novoRegistro2(ex) {
    if (!(await Dupla.garantir())) return;
    const r = {
      uuid: uuid(), projeto: S.projeto.id, equipe: S.projeto.equipe || '', usuario: S.sessao.u, dupla: S.dupla && S.dupla.av ? { av: S.dupla.av, ax: S.dupla.ax } : undefined,
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
      if (c.auto === 'modocopa') r.valores[c.nome] = await prefCopa();
      // (registros antigos sem modo de copa recebem a preferência ao abrir: ver telaForm)
    }
    if (S.pos && Date.now() - S.pos.t < 20000) Object.assign(r, { lat: S.pos.lat, lon: S.pos.lon, prec: S.pos.prec });
    if (ex) { r.faceId = ex.faceId; r.faceRua = ex.faceRua; r.faceTxt = ex.faceTxt; r.valores[ex.cat[0]] = ex.cat[1]; Object.assign(r.valores, ex.extra || {}); }
    await Store.salvarRegistro(r);
    S.aba = 0; S.tentou = false;
    const marcou = await marcarPonto(r); // o ponto é travado aqui, antes de medir: não acompanha o celular enquanto a dupla dá a volta na árvore
    S.abrindoNova = false;
    if (marcou === false) { await Store.apagarRegistro(r.uuid); return; } // saiu da tela no meio da marcação: não deixa rascunho vazio
    if (!(await conferirPonto(r))) { await Store.apagarRegistro(r.uuid); toast('Cadastro não aberto.'); return; }
    await Store.salvarRegistro(r);
    ir('#form/' + r.uuid);
  }

  // ---------- Turno e trajeto ----------
  // com o trajeto liberado pela coordenação, a equipe toca em "Começar turno": o app guarda o caminho enquanto está aberto
  // (tela acesa) e manda em trechos. Parado, a pé ou de carro pela velocidade entre os pontos.
  const Poly = {
    enc(pts) { let o = '', pla = 0, plo = 0; const e = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let r = ''; while (v >= 0x20) { r += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return r + String.fromCharCode(v + 63); };
      for (const [la, lo] of pts) { const a = Math.round(la * 1e5), b = Math.round(lo * 1e5); o += e(a - pla) + e(b - plo); pla = a; plo = b; } return o; },
    dec(s) { const out = []; let i = 0, la = 0, lo = 0; const d = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
      while (i < s.length) { la += d(); lo += d(); out.push([la / 1e5, lo / 1e5]); } return out; },
  };
  const distPt = (a, b) => Math.hypot((a[2] - b[2]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 110540);
  function resumoTrajeto(pts) { // pts: [t, lat, lon, prec]
    let pe = 0, carro = 0, parado = 0;
    for (let i = 1; i < pts.length; i++) { const d = distPt(pts[i - 1], pts[i]); const dt = (pts[i][0] - pts[i - 1][0]) / 1000; if (dt <= 0 || dt > 900) continue; const v = d / dt; if (v < 0.4) parado += dt; else if (v < 2.8) pe += d; else carro += d; }
    return { km_pe: Math.round(pe / 10) / 100, km_carro: Math.round(carro / 10) / 100, min_parado: Math.round(parado / 60) };
  }
  const Turno = {
    chave: () => 'turno:' + (S.sessao ? S.sessao.u : '') + ':' + (S.projeto ? S.projeto.id : ''),
    liberado: () => !!(S.sessao && S.sessao.usuario.trajeto === 'sim' && perfil() === 'coletor' && S.projeto && !S.duplaParceiro), // parceiro: o app não registra jornada
    est: null, lock: null, salvarT: null,
    async carregar() { this.est = this.liberado() ? (await Store.get(this.chave())) : null; if (this.est && this.est.dia !== diaLocal(agoraISO())) { await this.encerrar(true); } if (this.est && this.est.ativo) this.ligar(); },
    async comecar() {
      if (!(await Dupla.garantir())) return; if (!this.liberado()) { pintarTurno(); return toast('Dupla com parceiro: o app não grava trajeto nem horário do dia.', 5000); }
      // turno anterior ainda não enviado (sem rede) vai para a fila antes de começar outro: nada é gravado por cima
      if (this.est && this.est.pts.length > this.est.env) { const k = this.chave() + ':fila'; const f = (await Store.get(k)) || []; this.est.ativo = false; f.push(this.est); await Store.set(k, f); }
      this.est = { ativo: true, dia: diaLocal(agoraISO()), inicio: agoraISO(), pts: [], env: 0, id: uuid().slice(0, 8) }; await Store.set(this.chave(), this.est); this.ligar(); pintarTurno(); toast('Turno começou. O trajeto fica ligado enquanto o app estiver aberto.', 4000); },
    ligar() { Gps.ouvintes.add(this.ouv); ligarGps(); this.pedirTela(); document.addEventListener('visibilitychange', this.vis); },
    vis: () => { if (document.visibilityState === 'visible' && Turno.est && Turno.est.ativo) Turno.pedirTela(); },
    async pedirTela() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { this.lock = await navigator.wakeLock.request('screen'); } } catch (e) { /* sem tela acesa: segue gravando enquanto aberto */ } },
    ouv: (p) => {
      const e = Turno.est; if (!p || !e || !e.ativo || p.prec > 30) return;
      const pt = [Date.now(), Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6, p.prec]; const ult = e.pts[e.pts.length - 1];
      if (ult && distPt(ult, pt) < Math.max(8, p.prec) && pt[0] - ult[0] < 60000) return; // parado: um ponto por minuto basta
      e.pts.push(pt); clearTimeout(Turno.salvarT); Turno.salvarT = setTimeout(() => Store.set(Turno.chave(), e), 3000);
    },
    async encerrar(silencioso) {
      const e = this.est; if (!e) return; e.ativo = false; e.fim = agoraISO(); await Store.set(this.chave(), e);
      Gps.ouvintes.delete(this.ouv); document.removeEventListener('visibilitychange', this.vis); try { if (this.lock) await this.lock.release(); } catch (er) { /* já solta */ } this.lock = null;
      await this.enviar(); if (!silencioso) { pintarTurno(); toast('Turno encerrado.'); }
    },
    async enviar() {
      if (Api.demo || !navigator.onLine || !S.projeto || !S.sessao) return;
      const kf = this.chave() + ':fila'; const fila = (await Store.get(kf)) || [];
      while (fila.length) { if (!(await this.enviarEst(fila[0]))) { await Store.set(kf, fila); return; } fila.shift(); await Store.set(kf, fila); }
      const e = this.est; if (!e) return;
      await this.enviarEst(e, true);
      if (this.est === e && !e.ativo && e.env >= e.pts.length) { await Store.del(this.chave()); this.est = null; } // se começou outro turno no meio do envio, não mexe nele
    },
    // manda os pontos que faltam de um turno em trechos de até 400; devolve true quando não sobra nada a enviar
    async enviarEst(e, atual) {
      while (e.pts.length - e.env >= (e.ativo ? 20 : 1)) {
        const de = Math.max(0, e.env - 1); const fatia = e.pts.slice(de, de + 400); if (fatia.length < 2 && !(!e.ativo && fatia.length)) break;
        const trecho = Object.assign({ id: S.sessao.u + '-' + e.dia + '-' + e.id + '-' + e.env, dia: e.dia, inicio: new Date(fatia[0][0]).toISOString(), fim: new Date(fatia[fatia.length - 1][0]).toISOString(), pontos: Poly.enc(fatia.map((x) => [x[1], x[2]])), n: fatia.length }, resumoTrajeto(fatia));
        try { await Api.b.trajetoSalvar(S.projeto.id, trecho); } catch (er) { return false; }
        e.env = de + fatia.length; if (atual && this.est === e) await Store.set(this.chave(), e);
      }
      return e.env >= e.pts.length || e.ativo;
    },
    km() { const e = this.est; if (!e) return 0; const r = resumoTrajeto(e.pts); return r.km_pe + r.km_carro; },
  };
  function pintarTurno() {
    const el = document.getElementById('turno'); if (!el) return; if (!Turno.liberado()) return el.replaceChildren();
    const e = Turno.est;
    if (e && e.ativo) el.replaceChildren(h('div', { class: 'faixa-turno ativo' }, h('span', { class: 'selo-trajeto' }, h('i'), 'Trajeto ligado'), h('small', null, `desde ${new Date(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${numBR(Math.round(Turno.km() * 10) / 10)} km`), h('button', { class: 'btn sec peq', onclick: async () => { if (await confirmar('Encerrar turno', 'Encerrar o turno desliga o trajeto até amanhã (ou até tocar em Começar turno de novo).', 'Encerrar turno')) Turno.encerrar(); } }, 'Encerrar turno')));
    else el.replaceChildren(h('button', { class: 'faixa-turno', onclick: () => Turno.comecar() }, h('b', null, 'Começar turno'), h('span', null, 'Liga o trajeto e mantém a tela acesa enquanto o app está aberto')));
  }

  // ---------- Dupla do dia ----------
  // o login é da dupla; no primeiro cadastro do dia a dupla diz quem está no campo (avaliador habilitado e auxiliar).
  // Só vale quando a coordenação cadastrou as pessoas do projeto; sem cadastro o app segue como antes.
  const Dupla = {
    chave: () => 'dupla:' + S.sessao.u + ':' + S.projeto.id,
    async pessoas(forcar) {
      const k = 'pessoas:' + S.projeto.id; let l = await Store.get(k);
      if (!Api.demo && navigator.onLine && !S.expirada && (forcar || !l || !S.pessoasEm || S.pessoasEm.p !== S.projeto.id || Date.now() - S.pessoasEm.t > 600000)) {
        try { l = await Api.b.pessoasListar(); await Store.set(k, l); S.pessoasEm = { p: S.projeto.id, t: Date.now() }; } catch (e) { /* sem conexão: fica a lista do aparelho */ }
      }
      if (Api.demo) l = await Api.b.pessoasListar();
      return (l || []).filter((x) => x.ativo !== 'não');
    },
    async hoje() { if (!S.sessao || !S.projeto) return null; const d = await Store.get(this.chave()); return d && d.dia === diaLocal(agoraISO()) ? d : null; },
    async carregar() { const d = await this.hoje(); S.dupla = d; S.duplaParceiro = !!(d && [d.av, d.ax].some((x) => x && x.vinculo === 'Parceiro')); },
    // true quando pode coletar
    async garantir() {
      if (perfil() !== 'coletor') return true;
      const ps = await this.pessoas(); if (!ps.some((x) => x.funcao === 'Avaliador')) return true;
      const d = await this.hoje(); if (d && d.av) { S.dupla = d; return true; }
      return this.escolher(ps);
    },
    async escolher(ps) {
      ps = ps || (await this.pessoas());
      const minha = minhaEquipe(); const ord = (a, b) => (b.equipe === minha) - (a.equipe === minha) || a.nome.localeCompare(b.nome, 'pt');
      const atual = (await this.hoje()) || {}; let av = atual.av ? atual.av.id : '', ax = atual.ax ? atual.ax.id : '';
      const op = (lista, sel, fn, nenhum) => { const box = h('div', { class: 'dupla-ops' }); const pintar = () => box.replaceChildren(...lista.map((x) => h('button', { class: 'dupla-op' + (sel() === x.id ? ' sel' : ''), type: 'button', onclick: () => { fn(sel() === x.id && nenhum ? '' : x.id); pintar(); } }, h('b', null, x.nome), h('small', null, [x.funcao === 'Avaliador' ? x.registro : 'Auxiliar', x.vinculo].filter(Boolean).join(' · ')))), nenhum ? h('button', { class: 'dupla-op' + (!sel() ? ' sel' : ''), type: 'button', onclick: () => { fn(''); pintar(); } }, h('b', null, nenhum)) : null); pintar(); return box; };
      const avs = ps.filter((x) => x.funcao === 'Avaliador').sort(ord); const axs = ps.filter((x) => x.funcao === 'Auxiliar').sort(ord);
      const boxAv = op(avs, () => av, (v) => { av = v; if (ax === v) ax = ''; }); const boxAx = op(axs, () => ax, (v) => { ax = v; }, 'Sem auxiliar hoje');
      for (;;) {
        const ok = await modal('Quem está na dupla hoje?', h('div', { class: 'dupla' }, h('p', { class: 'dica' }, 'Cada árvore fica registrada com quem avaliou e quem auxiliou. Dá para trocar depois, tocando na dupla embaixo do mapa.'),
          h('h4', null, 'Avaliador habilitado'), boxAv, h('h4', null, 'Auxiliar'), boxAx), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Confirmar dupla', valor: true }]);
        if (!ok) return false;
        if (!av) { toast('Escolha o avaliador habilitado. Sem ele a coleta não é liberada.', 5000, null, true); continue; }
        break;
      }
      const pub = (id) => { const x = ps.find((y) => y.id === id); return x ? { id: x.id, nome: x.nome, registro: x.registro || '', vinculo: x.vinculo } : null; };
      const d = { dia: diaLocal(agoraISO()), av: pub(av), ax: pub(ax), em: agoraISO() }; await Store.set(this.chave(), d); await this.carregar();
      if (S.duplaParceiro && Turno.est && Turno.est.ativo) await Turno.encerrar(true); // parceiro: sem trajeto
      pintarTurno(); pintarDupla(); return true;
    },
  };
  function pintarDupla() {
    const el = document.getElementById('dupla-hoje'); if (!el) return; const d = S.dupla;
    if (!d || !d.av || perfil() !== 'coletor') return el.replaceChildren();
    el.replaceChildren(h('button', { class: 'chip-dupla', onclick: () => Dupla.escolher(), 'aria-label': 'Trocar a dupla de hoje' }, ico('pessoas'), h('span', null, [d.av.nome, d.ax && d.ax.nome].filter(Boolean).map((n) => n.split(' ')[0]).join(' + '))));
  }

  // ---------- Setores censitários ----------
  // camada do IBGE importada pela coordenação; cada setor tem a equipe responsável (aba Setores do projeto)
  const Setores = {
    async camada() {
      if (!S.projeto) return null; const k = 'st:' + S.projeto.id; let c = await Store.get(k);
      if (!Api.demo && navigator.onLine && !S.expirada && (!S.stEm || S.stEm.p !== S.projeto.id || Date.now() - S.stEm.t > 600000)) {
        try { const j = await Api.b.setoresCamada(S.projeto.id, c && c.versao); S.stEm = { p: S.projeto.id, t: Date.now() }; if (j.semCamada) { c = null; await Store.del(k); } else if (!j.igual) { c = { versao: j.versao, camada: JSON.parse(j.camada) }; await Store.set(k, c); } } catch (e) { /* sem conexão: cópia do aparelho */ }
      }
      if (!c) { S.stIdx = null; return null; }
      if (!S.stIdx || S.stIdx.v !== c.versao || S.stIdx.p !== S.projeto.id) S.stIdx = { p: S.projeto.id, v: c.versao, idx: Quadras.indice(c.camada.setores, 0.01) };
      return c.camada;
    },
    async situacao(forcar) {
      const k = 'stsit:' + S.projeto.id; let l = await Store.get(k);
      if (!Api.demo && navigator.onLine && !S.expirada && (forcar || !l || !S.stSitEm || S.stSitEm.p !== S.projeto.id || Date.now() - S.stSitEm.t > 120000)) {
        try { l = await Api.b.setoresSituacao(S.projeto.id); await Store.set(k, l); S.stSitEm = { p: S.projeto.id, t: Date.now() }; } catch (e) { /* sem conexão */ }
      }
      return l || [];
    },
    // setor do ponto e se é da minha equipe; null quando o projeto não tem setores
    async doPonto(lon, lat) {
      try {
        if (!(await this.camada())) return null;
        const q = S.stIdx.idx.achar(+lon, +lat, 0); const sit = await this.situacao();
        const meus = sit.filter((x) => x.equipe && x.equipe === minhaEquipe()).map((x) => x.numero);
        return { n: q ? q.n : '', temMeus: meus.length > 0, fora: perfil() === 'coletor' && meus.length > 0 && !(q && meus.includes(q.n)) };
      } catch (e) { return null; }
    },
  };
  // pontos já cadastrados perto (deste aparelho e os do mapa guardados), do mais perto para o mais longe
  async function pontosPerto(r, raio) {
    const out = []; const vistos = new Set([r.uuid]); const cc = S.form.campos.find((c) => c.auto === 'codigo'); const ce = S.form.campos.find((c) => c.tipo === 'species');
    const d = (la, lo) => Math.hypot((lo - r.lon) * 111320 * Math.cos(r.lat * Math.PI / 180), (la - r.lat) * 110540);
    for (const x of await Store.registros(S.projeto.id)) { if (vistos.has(x.uuid) || x.status === 'rascunho' || x.lat == null || x.faceId) continue; vistos.add(x.uuid); const m = d(+x.lat, +x.lon); if (m <= raio) out.push({ uuid: x.uuid, m, cod: cc ? x.valores[cc.nome] || '' : '', esp: ce ? x.valores[ce.nome] || '' : '', local: true }); }
    const mp = await Store.get('mapapts:' + S.projeto.id + ':' + S.sessao.u);
    if (mp) for (const l of mp.linhas || []) { if (vistos.has(l[0]) || l[1] === '' || l[1] == null) continue; vistos.add(l[0]); const m = d(+l[1], +l[2]); if (m <= raio) out.push({ uuid: l[0], m, cod: l[4] || '', esp: l[5] || '' }); }
    return out.sort((a, b) => a.m - b.m);
  }
  // depois de marcar o ponto: árvore repetida (até 2 m) e ponto fora dos setores da equipe
  async function conferirPonto(r) {
    for (;;) {
      if (r.lat == null || r.lat === '') return true;
      const st = await Setores.doPonto(r.lon, r.lat);
      if (st) { r.setor = st.n; r.foraSetor = st.fora; }
      if (st && st.fora) {
        const v = await modal('Fora dos setores da equipe', h('p', null, st.n ? `Este ponto fica no setor ${st.n}, que não é da sua equipe. Confira o GPS: se a árvore é mesmo daqui, siga e a coordenação vai ver o aviso.` : 'Este ponto fica fora dos setores censitários do projeto. Confira o GPS antes de seguir.'),
          [{ texto: 'Marcar o ponto de novo', classe: 'sec', valor: 'refazer' }, { texto: 'Seguir assim mesmo', valor: 'seguir' }]);
        if (v === 'refazer') { if ((await marcarPonto(r)) === false) return false; await Store.salvarRegistro(r); continue; }
        if (v == null) return false;
      }
      if (!r.faceId) {
        const pr = await pontosPerto(r, 2);
        if (pr.length) {
          const x = pr[0]; const qual = [x.cod, x.esp].filter(Boolean).join(', ');
          const v = await modal('Árvore já cadastrada?', h('div', null, h('p', null, `Já existe um cadastro a ${numBR(Math.round(x.m * 10) / 10)} m deste ponto${qual ? ' (' + qual + ')' : ''}.`), h('p', { class: 'dica' }, 'A mesma árvore cadastrada duas vezes é descartada na validação. Se for outra árvore (vizinha, no mesmo canteiro), siga normalmente.')),
            [{ texto: 'Não cadastrar', classe: 'sec', valor: 'cancelar' }, { texto: 'É outra árvore', valor: 'seguir' }]);
          if (v !== 'seguir') return false;
          r.perto = x.cod || x.uuid.slice(0, 8);
        }
      }
      return true;
    }
  }

  // ---------- Marcação do ponto ----------
  const ORIENTA_GPS = 'Marque o ponto fora da copa, do lado da rua, encostado no tronco, e não debaixo da copa.';
  const DICAS_GPS = ['Ligue a "Precisão da localização do Google" em Configurações, Localização, Serviços de localização.', 'Ao começar o dia, espere 1 minuto parado em um lugar aberto antes da primeira árvore.', ORIENTA_GPS, 'Segure o celular na mão, com a tela para cima, não no bolso.', 'Se o erro não baixar, desligue e ligue a localização do celular.'];
  function marcarPonto(r) {
    return new Promise((fim) => {
      const META = 5; const t0 = Date.now(); const leituras = []; let pronto = false;
      const num = h('div', { class: 'mp-num' }, '...'); const st = h('div', { class: 'mp-st' }, 'Procurando o sinal do GPS...');
      const det = h('small', { class: 'mp-det' });
      const hojeK = 'gpsDia:' + new Date().toDateString();
      const dicas = h('details', { class: 'mp-dicas' }, h('summary', null, 'Dicas para melhorar o GPS'), h('ul', null, DICAS_GPS.map((d) => h('li', null, d))));
      Store.get(hojeK).then((v) => { if (!v) { dicas.open = true; Store.set(hojeK, 1); } }); // primeira marcação do dia: dicas abertas (teste do GPS do dia)
      const btAgora = h('button', { class: 'btn cheio', disabled: true, onclick: () => travar(true) }, 'Marcar agora');
      const btSem = h('button', { class: 'btn sec oculto', onclick: () => { pronto = true; sair(true); } }, 'Continuar sem GPS');
      const veu = h('div', { class: 'veu mp-veu' }, h('div', { class: 'folha mp' }, h('h3', null, 'Marcando o ponto'),
        h('div', { class: 'mp-orienta' }, ORIENTA_GPS), num, st, det, h('div', { class: 'mp-meta' }, `Espere o erro ficar em até ${META} m. O app marca sozinho quando estabilizar.`),
        h('div', { class: 'linha-btn col' }, btAgora, btSem), dicas));
      document.body.append(veu);
      const dist = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 110540);
      const media = () => { const melhor = Math.min(...leituras.map((x) => x.prec)); const us = leituras.filter((x) => x.prec <= melhor * 1.5); let sw = 0, la = 0, lo = 0; for (const x of us) { const w = 1 / (x.prec * x.prec); sw += w; la += x.lat * w; lo += x.lon * w; } return { lat: la / sw, lon: lo / sw, prec: Math.round(melhor * 10) / 10, n: us.length }; };
      const ouv = (p, e) => {
        if (pronto) return;
        if (!p) { if (e && e.code === 1) { st.textContent = 'O GPS está bloqueado para o app.'; btSem.classList.remove('oculto'); } return; }
        if (Date.now() - p.t > 3000) return;
        leituras.push({ lat: p.lat, lon: p.lon, prec: Math.max(0.5, +p.prec || 0.5) }); if (leituras.length > 40) leituras.shift();
        const pr = p.prec; num.textContent = '±' + (pr >= 10 ? Math.round(pr) : numBR(Math.round(pr * 10) / 10)) + ' m'; num.className = 'mp-num ' + (pr <= META ? 'bom' : pr <= 10 ? 'medio' : 'ruim');
        btAgora.disabled = Date.now() - t0 < 2500;
        const ult = leituras.slice(-3); const melhor = Math.min(...leituras.map((x) => x.prec));
        const estavel = ult.length >= 3 && ult.every((x) => dist(x, ult[0]) <= Math.max(2, melhor)) && ult.every((x) => x.prec <= melhor + 1);
        det.textContent = `${pl(leituras.length, 'leitura', 'leituras')} · melhor ±${numBR(melhor)} m`;
        if (Date.now() - t0 >= 3000 && melhor <= META && estavel) return travar(false);
        st.textContent = pr <= META ? 'Estabilizando...' : pr <= 10 ? 'Quase lá. Fique parado ao lado do tronco.' : 'Erro alto. Saia de baixo da copa, para o lado da rua.';
        if (Date.now() - t0 > 25000 && melhor <= 15 && estavel) travar(false);
      };
      function travar(manual) {
        if (pronto || !leituras.length) return; pronto = true;
        const m = media(); Object.assign(r, { lat: m.lat, lon: m.lon, prec: m.prec, gpsAuto: false, marcadoEm: agoraISO(), leiturasGps: m.n });
        Store.salvarRegistro(r);
        num.className = 'mp-num ' + (m.prec <= META ? 'bom' : m.prec <= 10 ? 'medio' : 'ruim'); num.textContent = '±' + numBR(m.prec) + ' m';
        st.textContent = manual ? 'Ponto marcado.' : 'Ponto marcado ✓'; btAgora.disabled = true;
        setTimeout(() => { if (!sair.feito) sair(true); }, 700);
      }
      function sair(v) { if (sair.feito) return; sair.feito = true; clearInterval(tm); Gps.ouvintes.delete(ouv); window.removeEventListener('hashchange', aoSair); veu.remove(); fim(v !== false); }
      // Voltar do Android (ou qualquer troca de tela) cancela a marcação: nada fica lendo GPS nem abre o cadastro depois
      const aoSair = () => { const marcado = pronto; pronto = true; sair(marcado); }; // marcado e saiu logo: o ponto vale; ainda marcando: cancela
      window.addEventListener('hashchange', aoSair);
      Gps.ouvintes.add(ouv); ligarGps();
      if (S.gpsNegado) { st.textContent = 'O GPS está bloqueado para o app.'; btSem.classList.remove('oculto'); }
      if (S.pos) ouv(S.pos);
      const tm = setInterval(() => { Gps.ler(); if (!leituras.length && Date.now() - t0 > 12000) { btSem.classList.remove('oculto'); st.textContent = 'Sem sinal de GPS ainda. Vá para um lugar aberto ou continue sem GPS.'; } }, 1000);
    });
  }
  // aviso de pouco espaço: nada é apagado sozinho; a equipe libera as fotos já confirmadas em Preferências
  async function pintarEspaco() {
    const el = document.getElementById('aviso-espaco'); if (!el || !navigator.storage || !navigator.storage.estimate) return;
    try { const e = await navigator.storage.estimate(); const livre = e.quota - e.usage; if (!(e.quota && (e.usage / e.quota > 0.8 || livre < 300e6)) || !document.body.contains(el)) return;
      el.replaceChildren(h('button', { class: 'faixa-cont faixa-gps', onclick: () => ir('#preferencias') }, h('b', null, 'Pouco espaço para o app no celular'), h('span', null, 'Toque para liberar as fotos já confirmadas no servidor'))); } catch (e) { /* sem informação */ }
  }
  // aviso na tela inicial quando as últimas árvores saíram com erro alto
  async function pintarDicaGps() {
    const el = document.getElementById('aviso-gps'); if (!el || S.gpsNegado || !S.projeto) return;
    const ult = (await Store.registros(S.projeto.id)).filter((r) => r.status !== 'rascunho' && r.prec != null).sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).slice(0, 5);
    if (ult.length < 3) return; const pr = ult.map((r) => +r.prec).sort((a, b) => a - b)[Math.floor(ult.length / 2)];
    if (pr <= 7 || !document.body.contains(el)) return;
    el.replaceChildren(h('button', { class: 'faixa-cont faixa-gps', onclick: () => modal('Dicas para melhorar o GPS', h('ul', null, DICAS_GPS.map((d) => h('li', null, d))), [{ texto: 'Entendi', valor: true }]) }, h('b', null, `A precisão do GPS caiu (±${numBR(pr)} m nas últimas árvores)`), h('span', null, 'Veja as dicas')));
  }

  // preferências de cada login neste aparelho
  // a coordenação define no cadastro do usuário como a dupla mede a copa (4 raios ou área com trena a laser)
  async function prefCopa() { const u = S.sessao && S.sessao.usuario; if (u && u.modo_copa) return u.modo_copa; return (await Store.get('pref:copa:' + (S.sessao && S.sessao.u))) || 'raios'; }
  async function telaPreferencias() {
    const copa = await prefCopa(); const wifi = await fotosSoWifi(); const sol = !!(await Store.get('modoSol'));
    let esp = ''; try { const e = await navigator.storage.estimate(); esp = `${(e.usage / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB usados pelo app de ${(e.quota / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} GB disponíveis.`; } catch (e) { /* sem informação */ }
    const chave = (txt, det, v, fn) => h('label', { class: 'pref-op' + (v ? ' sel' : '') }, h('input', { type: 'checkbox', checked: v, onchange: async (ev) => { await fn(ev.target.checked); telaPreferencias(); } }), h('div', null, h('b', null, txt), h('small', null, det)));
    $app.replaceChildren(topo('Preferências', S.sessao.usuario.nome || S.sessao.u, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        h('div', { class: 'cartao' }, h('h3', null, 'Fotos'), chave('Mandar fotos só no Wi-Fi', 'Os cadastros sobem na hora, pelo 4G. As fotos esperam o Wi-Fi (tocando no aviso de envio dá para mandar agora).', wifi, (v) => Store.set('fotosWifi', v)),
          h('p', { class: 'dica' }, 'As fotos ficam na qualidade original e continuam guardadas no celular depois de enviadas. ' + esp),
          h('button', { class: 'btn sec', onclick: liberarEspaco }, 'Liberar espaço: apagar do celular fotos já confirmadas no servidor há mais de 30 dias')),
        h('div', { class: 'cartao' }, h('h3', null, 'Tela'), chave('Modo Sol (alto contraste)', 'Letras pretas, bordas mais fortes e texto maior, para ler no sol forte.', sol, async (v) => { await Store.set('modoSol', v); document.documentElement.classList.toggle('sol', v); })),
        S.form && S.form.campos.some((c) => c.auto === 'modocopa') ? h('div', { class: 'cartao' }, h('h3', null, 'Como medir a copa'), h('p', null, copa === 'area' ? 'Área direto, com trena a laser.' : '4 raios com trena (o app calcula a área).'), h('p', { class: 'dica' }, 'Definido pela coordenação no seu usuário.')) : null));
  }
  async function liberarEspaco() {
    const lim = Date.now() - 30 * 864e5; let n = 0;
    if (!(await confirmar('Liberar espaço', 'Apaga do celular só as fotos que o servidor já confirmou, de cadastros de mais de 30 dias. Os cadastros continuam no celular.', 'Liberar'))) return;
    for (const r of await Store.todosRegistros()) {
      if (!r.conferido || r.conferenciaFalhou || r.status !== 'enviado' || new Date(r.atualizado_em || 0).getTime() > lim) continue; // só o que o servidor confirmou de fato
      let mudou = false; for (const f of Object.values(r.fotos || {})) if (f && f.chave && f.enviado && f.url) { await Store.apagarFoto(f.chave); f.chave = ''; mudou = true; n++; }
      if (mudou) await Store.salvarRegistro(r);
    }
    toast(n ? `${pl(n, 'foto apagada', 'fotos apagadas')} do celular. Elas continuam no servidor.` : 'Nenhuma foto antiga confirmada para apagar.', 4000);
  }
  function recalcular(r) {
    for (let i = 0; i < 4; i++) for (const c of S.form.campos) if (c.calculado && c.expr) {
      try { r.valores[c.nome] = Expr.evaluate(c.expr, (k) => r.valores[k]); } catch (e) { r.valores[c.nome] = null; }
    }
  }
  const numValido = (t) => /^\s*\d+([.,]\d+)?\s*$/.test(String(t));
  const vazio = (c, v) => c.tipo === 'photo' ? !v : (v == null || v === '' || (c.tipo === 'multinumber' && !String(v).split(';').some((x) => x.trim())));
  function valorDe(r, c) { return c.tipo === 'photo' ? r.fotos[c.nome] : r.valores[c.nome]; }
  // Regras por classe: form.regras = [{ campo, por: { valor: { nomeCampo: 'obrig' | 'opcional' | 'oculto' } } }]
  function estadoCampos(form, vals) {
    const E = {};
    for (const c of form.campos) E[c.nome] = { obrig: !!c.obrigatorio && !c.oculto, oculto: !!c.oculto, regra: false };
    // Regras aplicadas na ordem: a de baixo prevalece sobre a de cima; "oculto" por regra sempre prevalece.
    // Campo oculto por padrão (c.oculto) só aparece quando uma regra o pede ("obrig", "opcional" ou "mostrar").
    for (const rg of form.regras || []) {
      const v = vals[rg.campo]; if (v == null || v === '') continue;
      if (E[rg.campo] && E[rg.campo].oculto) continue; // regra de campo que não aparece não vale
      const cfg = (rg.por || {})[String(v)]; if (!cfg) continue;
      for (const [nome, est] of Object.entries(cfg)) {
        if (!E[nome] || nome === rg.campo || E[nome].regra) continue;
        if (est === 'oculto') { E[nome].oculto = true; E[nome].regra = true; E[nome].obrig = false; }
        else if (est === 'obrig') { E[nome].obrig = true; E[nome].oculto = false; }
        else if (est === 'opcional') { E[nome].obrig = false; E[nome].oculto = false; }
        else if (est === 'mostrar') E[nome].oculto = false;
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
    for (const c of S.form.campos) if (c.tipo === 'multinumber' && !E[c.nome].oculto) { const ps = String(r.valores[c.nome] || '').split(';').map((x) => x.trim()).filter(Boolean); const k = ps.findIndex((x) => !numValido(x)); if (k >= 0) f.push({ nome: c.nome, limite: true, rotulo: `${c.rotulo}: número inválido no ${/cap/i.test(c.nome) ? 'caule' : 'fuste'} ${k + 1}` }); }
    for (const c of S.form.campos) {
      if (E[c.nome].oculto || (c.min == null && c.max == null)) continue;
      const v = r.valores[c.nome]; if (v == null || v === '' || typeof v !== 'number') continue;
      if (c.min != null && v < c.min) f.push({ nome: c.nome, limite: true, rotulo: `${c.rotulo}: ${c.limiteMsg || 'abaixo do mínimo de ' + numBR(c.min)}` });
      else if (c.max != null && v > c.max) f.push({ nome: c.nome, limite: true, rotulo: `${c.rotulo}: ${c.limiteMsgMax || 'acima do máximo de ' + numBR(c.max)}` });
    }
    return f;
  }

  // limites de plausibilidade (podem passar, mas pedem confirmação). O formulário pode trazer avisoMax/avisoMin por campo.
  const PLAUS = [[/altura/i, null, 40, 'm'], [/dap/i, null, 300, 'cm'], [/cap/i, 2, 900, 'cm'], [/raio/i, 0.01, 20, 'm'], [/area de copa/i, 1, 1200, 'm²'], [/largura/i, 0.5, 10, 'm']];
  function conferirValores(r) {
    const E = estadoCampos(S.form, r.valores); const out = [];
    for (const c of S.form.campos) {
      if (E[c.nome].oculto || (c.tipo !== 'number' && c.tipo !== 'multinumber')) continue;
      const pl = PLAUS.find(([re]) => re.test(c.nome)); const mn = c.avisoMin ?? (pl && pl[1]), mx = c.avisoMax ?? (pl && pl[2]); const un = pl ? ' ' + pl[3] : '';
      const vs = c.tipo === 'multinumber' ? String(r.valores[c.nome] || '').split(';').map((x) => paraNum(x)).filter((x) => x != null) : [r.valores[c.nome]].filter((x) => typeof x === 'number');
      for (const v of vs) { if (mx != null && v > mx) out.push(`${c.rotulo}: ${numBR(v)}${un} é muito alto (acima de ${numBR(mx)}${un}).`); else if (mn != null && v < mn) out.push(`${c.rotulo}: ${numBR(v)}${un} é muito baixo.`); }
    }
    for (const c of S.form.campos) if (c.maxFustes && !E[c.nome].oculto) {
      const cat = S.form.campos.find((x) => x.nome === 'Categoria'); const lim = typeof c.maxFustes === 'number' ? c.maxFustes : cat && c.maxFustes[String(r.valores[cat.nome])];
      const n = String(r.valores[c.nome] || '').split(';').filter((x) => x.trim()).length;
      if (lim && n > lim) out.push(`${c.rotulo}: ${n} caules medidos. Meça só os ${lim} mais representativos (os maiores).`);
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
    if (!S.reg || S.reg.uuid !== r.uuid) { S.aba = 0; S.tentou = false; S.tentouFim = false; S.abaMax = 0; }
    S.reg = r; r.valores = r.valores || {}; r.fotos = r.fotos || {};
    if (r.status !== 'rascunho' && !r.__base) { r.__base = JSON.stringify(r.valores); r.__baseFotos = JSON.stringify(r.fotos); r.__basePos = JSON.stringify({ lat: r.lat, lon: r.lon, prec: r.prec, posManual: r.posManual }); await Store.salvarRegistro(r); }
    if (abaParam != null) S.aba = +abaParam || 0;
    const form = S.form; const abas = form.abas;
    for (const c of form.campos) if (c.auto === 'modocopa' && !r.valores[c.nome]) r.valores[c.nome] = await prefCopa();
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
    // árvore nova sem posição: usa a leitura recente ou pede outra (a resposta pode ter chegado antes desta tela abrir)
    if (r.lat == null && r.gpsAuto && !r.posManual) { if (S.pos && Date.now() - S.pos.t < 20000) ouvinte(S.pos); else Gps.agora(); }
    pintarGps();

    const cc = campoCodigo(form);
    const voltar = h('button', { class: 'ic', onclick: sairForm, 'aria-label': 'Voltar' }, ico('voltar'));
    // cancelar à vista: apaga o cadastro em andamento (novo) ou descarta a edição (já enviado)
    const btCancelar = r.status === 'enviado' && !r.__base ? null : h('button', { class: 'bt-cancelar', onclick: () => cancelarRegistro() }, 'Cancelar');
    const barraAbas = h('nav', { class: 'prog' });
    const barraPend = h('div', { class: 'barra-pend oculto', role: 'alert' });
    const conteudo = h('main');
    let E = estadoCampos(form, r.valores);
    const camposRegra = new Set((form.regras || []).map((x) => x.campo));
    const abaVisivel = (a) => a.campos.some((x) => { const c = form.campos.find((f) => f.nome === x.campo); return c && c.tipo !== 'hidden' && !E[c.nome].oculto; });
    const vizinha = (i, passo) => { for (let k = i + passo; k >= 0 && k < abas.length; k += passo) if (abaVisivel(abas[k])) return k; return -1; };
    const btAnt = h('button', { class: 'btn sec quad', onclick: () => irAba(vizinha(S.aba, -1)), 'aria-label': 'Etapa anterior' }, ico('esq'));
    const btProx = h('button', { class: 'btn prox', onclick: () => { const k = vizinha(S.aba, 1); if (k >= 0) irAba(k); else concluir(); } });
    $app.replaceChildren(...[topo(r.faceId && r.status === 'rascunho' ? 'Calçada sem árvores' : r.status === 'rascunho' && !r.mexido ? 'Nova árvore' : (codigoDe(form, r.valores) || 'Árvore'), S.projeto.nome, voltar, h('div', { class: 'topo-dir' }, btCancelar, gpsBtn)), barraAbas,
      r.faceId ? h('div', { class: 'faixa-face' }, h('b', null, 'Face sem árvores: ' + (r.faceTxt || r.faceId)), h('span', null, 'Tire a foto da calçada inteira, no sentido do comprimento, e toque em Concluir registro. A face fica como levantada sem árvores.')) : null,
      conteudo, h('footer', { class: 'rodape' }, btAnt, btProx)].filter(Boolean));

    const calcEls = new Map();
    function estadoAba(a) {
      const cs = a.campos.map((x) => form.campos.find((c) => c.nome === x.campo)).filter((c) => c && c.tipo !== 'hidden' && !c.calculado && c.tipo !== 'bool' && !E[c.nome].oculto);
      const gFalta = gruposFaltando(form, r.valores, E).filter((g) => a.campos.some((x) => x.grupo === g));
      const idx = abas.indexOf(a); // etapa ainda não visitada fica cinza, não vermelha (até tentar concluir)
      if (S.tentou && (S.tentouFim || idx <= (S.abaMax || 0)) && (gFalta.length || cs.some((c) => E[c.nome].obrig && vazio(c, valorDe(r, c))))) return 'falta';
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
      const nEt = lista.filter((x) => x.aba === S.aba).length;
      barraPend.replaceChildren(h('span', null, h('b', null, nEt ? `Faltam ${nEt} nesta etapa` : 'Esta etapa está completa'), lista.length > nEt ? ` · ${lista.length} no total` : '', h('br'), h('small', null, prox.c.rotulo)),
        h('button', { class: 'btn peq', onclick: () => irPendente(lista.indexOf(prox)) }, 'Próximo que falta'));
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
        h('div', { class: 'linha-btn', style: 'margin-top:14px' }, h('button', { class: 'btn cheio', onclick: () => { veu.remove(); concluir(); } }, ico('check'), 'Concluir registro')),
        h('button', { class: 'link-ajuda-form', onclick: () => { veu.remove(); ir('#ajuda/cadastro'); } }, ico('ajuda'), 'Ajuda do cadastro'),
        r.status !== 'enviado' ? h('button', { class: 'link-perigo', onclick: () => { veu.remove(); excluir(); } }, 'Excluir este registro') : null));
      document.body.append(veu);
    }
    // Trava: sem nada preenchido dá para passear pelas etapas (bom para treinar); depois do primeiro campo preenchido,
    // só avança com os obrigatórios da etapa completos. Voltar é sempre livre.
    function irAba(i) {
      if (i < 0 || i >= abas.length) return; if (!abaVisivel(abas[i])) { const k = vizinha(i, 1) >= 0 ? vizinha(i, 1) : vizinha(i, -1); if (k < 0) return; i = k; }
      if (i > S.aba && r.mexido) {
        const lista = pendOrdenadas(); const bloq = lista.find((x) => x.aba >= S.aba && x.aba < i && abaVisivel(abas[x.aba]));
        if (bloq) { S.tentou = true; if (navigator.vibrate) navigator.vibrate(120); toast(`Complete "${abas[bloq.aba].nome}" antes de seguir. Falta: ${bloq.c.rotulo}.`, 3500); return irPendente(lista.indexOf(bloq)); }
      }
      S.aba = i; S.abaMax = Math.max(S.abaMax || 0, i); history.replaceState(null, '', '#form/' + r.uuid + '/' + i); render(); window.scrollTo(0, 0);
    }

    function mudar(c, v) {
      r.valores[c.nome] = v; r.mexido = true; recalcular(r);
      const antes = camposRegra.has(c.nome) ? JSON.stringify(E) : '';
      E = estadoCampos(form, r.valores);
      // campo de regra (ex.: Espécie "Não identificada" mostra as fotos): redesenha só se o que aparece mudou; senão o teclado fecharia a cada letra
      if (camposRegra.has(c.nome) && JSON.stringify(E) !== antes) { salvarRascunho(); return render(); }
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
      const campos0 = a.campos.map((x) => ({ c: form.campos.find((f) => f.nome === x.campo), grupo: x.grupo })).filter((x) => x.c && x.c.tipo !== 'hidden' && !E[x.c.nome].oculto);
      // "Ausente" ou "Nenhum" (a resposta mais comum) vem primeiro em cada grupo
      const campos = []; for (let i = 0; i < campos0.length;) { let j = i; while (j < campos0.length && campos0[j].grupo && campos0[j].grupo === campos0[i].grupo) j++; if (j === i) { campos.push(campos0[i]); i++; continue; } const run = campos0.slice(i, j); campos.push(...run.filter((x) => x.c.exclusivo), ...run.filter((x) => !x.c.exclusivo)); i = j; }
      // código, data e equipe numa linha de resumo no topo (não se mexe neles)
      const resumoAuto = campos.filter((x) => x.c.auto === 'codigo' || x.c.auto === 'coletor' || (x.c.agora && x.c.somenteLeitura));
      const blocos = []; let grupoAtual = null; let chips = null; let nums = null; let fotos = null;
      if (resumoAuto.length) blocos.push(h('div', { class: 'resumo-auto' }, resumoAuto.map((x) => { const v = r.valores[x.c.nome]; return h('span', null, x.c.agora ? dataCurta(v) : (v || 'automático')); })));
      for (const { c, grupo } of campos) {
        if (resumoAuto.some((x) => x.c === c)) continue;
        if (grupo !== grupoAtual) { grupoAtual = grupo; chips = nums = fotos = null; if (grupo) blocos.push(h('div', { class: 'grupo-tit' }, grupo === 'Manejo e mitigações' ? grupo : grupo)); }
        if (c.tipo === 'bool' && !c.calculado) {
          nums = fotos = null;
          if (!chips) {
            const gObrig = grupo && (form.gruposObrig || []).includes(grupo);
            const faltaG = S.tentou && gObrig && gruposFaltando(form, r.valores, E).includes(grupo);
            chips = h('div', { class: 'chips' });
            const doGrupo = grupo ? camposDoGrupo(form, grupo).map((nm) => form.campos.find((x) => x.nome === nm)).filter((x) => x && x.ajuda && !E[x.nome].oculto) : [];
            const [bt, box] = doGrupo.length ? caixaAjuda(doGrupo.map((x) => [x.rotulo, x.ajuda]), (doGrupo.find((x) => x.ajudaImg) || {}).ajudaImg) : [null, null];
            const gConf = grupo && (form.gruposConfirmar || []).some((g) => g.grupo === grupo);
            blocos.push(h('div', { class: 'campo' + (faltaG ? ' falta' : ''), 'data-grupo': grupo || '' }, grupo ? h('div', { class: 'dica', style: 'margin:-6px 0 10px' }, gObrig ? 'Marque uma ou mais (obrigatório)' : gConf ? 'Marque uma ou mais, ou "Nenhum"' : '', bt) : h('div', { class: 'rot' }, 'Marque o que se aplica'), box, chips));
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
          const fam = c.nome.replace(/\d+/g, '#'); // Raio 1..4 juntos em 2x2; Altura na sua própria linha
          if (!nums || nums.dataset.fam !== fam) { nums = h('div', { class: 'grade-num' + (fam.includes('#') ? ' grade-2x2' : ' grade-1') }); nums.dataset.fam = fam; blocos.push(nums); }
          nums.append(campoEl(c, fam.includes('#') && nums.childElementCount > 0)); continue;
        }
        if (c.tipo === 'photo') {
          chips = nums = null;
          if (!fotos) { fotos = h('div', { class: 'grade-fotos' }); blocos.push(fotos); }
          fotos.append(campoEl(c)); continue;
        }
        chips = nums = fotos = null; blocos.push(campoEl(c));
        if (camposRegra.has(c.nome)) {
          const rg = (form.regras || []).find((x) => x.campo === c.nome); const cfg = rg && rg.por[String(r.valores[c.nome])];
          const nEt = abas.filter((x) => !abaVisivel(x)).length;
          if (cfg && nEt) blocos.push(h('div', { class: 'nota' }, `${pl(nEt, 'etapa não se aplica', 'etapas não se aplicam')} e ${nEt > 1 ? 'foram ocultadas' : 'foi ocultada'}.`));
        }
      }
      conteudo.replaceChildren(...blocos);
      btAnt.disabled = vizinha(S.aba, -1) < 0;
      const k = vizinha(S.aba, 1);
      btProx.replaceChildren(...(k >= 0 ? [h('span', null, abas[k].nome), ico('dir')] : [ico('check'), h('span', null, 'Concluir registro')]));
      btProx.classList.toggle('fim', k < 0);
    }

    function caixaAjuda(textos, img) {
      const box = h('div', { class: 'ajuda-box oculto' }, textos.map(([t, d]) => h('p', null, t ? h('b', null, t + ': ') : null, d)), img ? h('img', { src: img, alt: 'Desenho de ajuda', class: 'ajuda-img', loading: 'lazy' }) : null);
      const bt = h('button', { type: 'button', class: 'ajuda-bt', 'aria-label': 'Ajuda', onclick: (e) => { e.preventDefault(); e.stopPropagation(); box.classList.toggle('oculto'); } }, '?');
      return [bt, box];
    }
    function rotulo(c, semAjuda) {
      const [bt, box] = c.ajuda && !semAjuda ? caixaAjuda([['', c.ajuda]], c.ajudaImg) : [null, null];
      return h('div', { class: 'rot-linha' }, h('label', { class: 'rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null, bt), box);
    }
    function campoEl(c, semAjuda) {
      const rot = (k) => rotulo(k, semAjuda); // nos raios 2 a 4 o "?" do raio 1 vale para todos
      const box = h('div', { class: 'campo' + (S.tentou && E[c.nome].obrig && vazio(c, valorDe(r, c)) ? ' falta' : ''), 'data-campo': c.nome });
      const v = r.valores[c.nome];
      if (c.auto) { box.append(rot(c), h('div', { class: 'calc' + (v ? '' : ' vazio') }, v || 'Automático')); return box; }
      if (c.calculado) { const el = h('div', { class: 'calc' }); calcEls.set(c.nome, el); pintarCalc(el, c); box.append(rot(c), el); return box; }
      switch (c.tipo) {
        case 'choice': {
          const longas = c.opcoes.some((o) => o.t.length > 24) || c.opcoes.length > 6;
          // opções com explicação longa (risco da ISA): uma por linha, com a explicação sempre visível embaixo (pedido do Ciro na 2.7)
          const compactas = false;
          const grade = h('div', { class: 'opcoes' + (compactas ? ' compactas' : longas ? ' longas' : '') });
          for (const o of c.opcoes) {
            if (S.qdTemFaces === S.projeto.id && !r.faceId && String(v) !== String(o.v) && /categoria/i.test(norm(c.nome)) && /cal[cç]ada/i.test(o.t)) continue; // calçada sem árvores é marcada pela face, no mapa
            const m = o.t.match(/^([^(]+?)\s*\((.+)\)\s*$/);
            const b = h('button', { class: 'op' + (String(v) === String(o.v) ? ' sel' : ''), onclick: async () => {
              const novo = String(r.valores[c.nome]) === String(o.v) ? null : o.v;
              if (camposRegra.has(c.nome) && novo != null) {
                const E2 = estadoCampos(form, Object.assign({}, r.valores, { [c.nome]: novo }));
                const perde = form.campos.filter((k) => E2[k.nome].oculto && !E[k.nome].oculto && k.tipo !== 'bool' && k.tipo !== 'hidden' && !k.auto && !k.calculado && !vazio(k, valorDe(r, k)));
                if (perde.length && !(await confirmar('Trocar ' + c.rotulo.toLowerCase(), `Com "${o.t.replace(/\s*\(.*\)/, '')}" estes campos já preenchidos deixam de valer: ${perde.map((k) => k.rotulo).join(', ')}. Continuar?`, 'Trocar'))) return;
              }
              grade.querySelectorAll('.op').forEach((x) => x.classList.remove('sel')); if (novo != null) b.classList.add('sel'); mudar(c, novo);
            } }, m ? [m[1], h('small', null, m[2])] : o.t);
            grade.append(b);
          }
          if (compactas) { // o "?" explica cada opção
            const [bt, aj] = caixaAjuda([...(c.ajuda ? [['', c.ajuda]] : []), ...c.opcoes.map((o) => { const m = o.t.match(/^([^(]+?)\s*\((.+)\)\s*$/); return m ? [m[1], m[2]] : [o.t, '']; })]);
            box.append(h('div', { class: 'rot-linha' }, h('label', { class: 'rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null, bt), aj), grade); break;
          }
          box.append(rot(c), grade); break;
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
            let alerta = '';
            if (!m && n != null && c.avisoMax != null && n > c.avisoMax) alerta = `${numBR(n)} parece alto demais. Confira${n / 10 <= c.avisoMax && n >= 10 ? ` (quis dizer ${numBR(Math.round(n) / 10)}?)` : ''}.`;
            else if (!m && n != null && c.avisoMin != null && n < c.avisoMin) alerta = `${numBR(n)} parece baixo demais. Confira.`;
            av.textContent = m || alerta; av.classList.toggle('oculto', !m && !alerta); av.classList.toggle('amarelo', !m && !!alerta); i.classList.toggle('invalido', !!m);
          };
          const i = h('input', { class: 'entrada', inputmode: 'decimal', enterkeyhint: 'next', value: numBR(v), oninput: () => { checar(); mudar(c, c.inteiro ? (paraNum(i.value) == null ? null : Math.round(paraNum(i.value))) : paraNum(i.value)); } });
          box.append(rot(c), i, av); checar(); break;
        }
        case 'multinumber': {
          const lista = h('div', { class: 'fustes' });
          let valores = String(v || '').split(';').map((x) => x.trim()); if (!valores.length) valores = [''];
          const gravar = () => mudar(c, valores.map((x) => x.replace('.', ',').trim()).filter((x) => x).join(';'));
          const desenhar = () => {
            lista.replaceChildren(...valores.map((val, k) => {
              const avk = h('div', { class: 'aviso-campo oculto' }, 'Número inválido. Use só algarismos e uma vírgula (ex.: 45,5).');
              const checarK = () => { const ok = !i.value.trim() || numValido(i.value); i.classList.toggle('invalido', !ok); avk.classList.toggle('oculto', ok); };
              const i = h('input', { class: 'entrada', inputmode: 'decimal', value: val, placeholder: '0,0', oninput: () => { valores[k] = i.value; gravar(); checarK(); } });
              setTimeout(checarK, 0);
              return h('div', { class: 'fuste-bloco' }, h('div', { class: 'fuste' }, h('span', null, `${/cap/i.test(c.nome) ? 'Caule' : 'Fuste'} ${k + 1}`), i,
                valores.length > 1 ? h('button', { onclick: () => { valores.splice(k, 1); gravar(); desenhar(); }, 'aria-label': 'Remover fuste' }, '×') : null), avk);
            }));
          };
          desenhar();
          const maisBt = h('button', { class: 'btn sec peq', style: 'margin-top:8px', onclick: () => { if (c.maxFustes && valores.length >= c.maxFustes) return; valores.push(''); desenhar(); lista.lastChild.querySelector('input').focus(); maisBt.classList.toggle('oculto', !!c.maxFustes && valores.length >= c.maxFustes); } }, /cap/i.test(c.nome) ? '+ caule' : '+ fuste');
          maisBt.classList.toggle('oculto', !!c.maxFustes && valores.length >= c.maxFustes);
          box.append(rot(c), lista, maisBt);
          break;
        }
        case 'species': box.append(rot(c), especieEl(c)); break;
        case 'textarea': { const t = h('textarea', { class: 'entrada', oninput: () => mudar(c, t.value) }); t.value = v || ''; box.append(rot(c), t); break; }
        case 'datetime': case 'date': {
          if (c.somenteLeitura) { box.append(rot(c), h('div', { class: 'calc' }, v ? dataCurta(v) : 'Automático')); break; }
          const d = v ? new Date(v) : null;
          const loc = d && !isNaN(d) ? (c.tipo === 'date' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`) : '';
          const i = h('input', { class: 'entrada', type: c.tipo === 'date' ? 'date' : 'datetime-local', value: loc, onchange: () => mudar(c, i.value ? new Date(i.value).toISOString() : null) });
          box.append(rot(c), i); break;
        }
        case 'photo': box.append(fotoEl(c)); break;
        default: {
          const i = h('input', { class: 'entrada', value: v ?? '', enterkeyhint: 'next', oninput: () => mudar(c, i.value) });
          box.append(rot(c), i); if (c.incremento) box.append(h('div', { class: 'dica' }, 'Sugerido: último + 1. Confira a plaqueta.'));
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
      // busca por semelhança: começo das palavras, sem acento, e aceita 1 ou 2 letras erradas; o campo nunca fecha
      i.addEventListener('input', () => {
        const q = norm(i.value).trim(); mudar(c, i.value.replace(/\s+/g, ' ').trim()); nova.classList.add('oculto');
        if (!q) { drop.classList.add('oculto'); return; }
        const achados = buscaEspecie(lista, q).slice(0, 20);
        drop.replaceChildren(...achados.map((e) => h('button', { onmousedown: (ev) => ev.preventDefault(), onclick: () => escolher(e.cientifico) }, h('i', null, e.cientifico), e.popular ? h('small', null, e.popular) : null)),
          h('div', { class: 'esp-livre' }, achados.length ? 'Não está aqui? Continue escrevendo o nome.' : 'Nenhuma espécie parecida. Pode escrever o nome como souber.'));
        drop.classList.remove('oculto');
      });
      i.addEventListener('blur', () => setTimeout(() => { drop.classList.add('oculto'); conferir(); }, 150)); // aviso "fora da lista" só ao sair do campo
      const semId = h('button', { class: 'btn sec peq bt-semid', onclick: () => { escolher('Não identificada'); setTimeout(() => { const el = document.querySelector('[data-campo="Foto folha face superior"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 150); } }, 'Sem ID');
      const rec = h('div', { class: 'esp-recentes' });
      Store.registros(S.projeto.id).then((regs) => {
        const vistos = []; for (const x of regs.sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''))) { const e = x.valores && x.valores[c.nome]; if (e && x.uuid !== r.uuid && !vistos.includes(e)) vistos.push(e); if (vistos.length >= 6) break; }
        rec.replaceChildren(...vistos.map((e) => h('button', { onclick: () => escolher(e) }, e)));
      });
      conferir();
      return h('div', null, h('div', { class: 'esp-linha' }, h('div', { class: 'esp-box' }, i, drop), semId), nova, rec);
    }

    function fotoEl(c) {
      const wrap = h('div', { class: 'foto-tile' });
      const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: () => receber(cam) });
      const gal = h('input', { type: 'file', accept: 'image/*', onchange: () => receber(gal) });
      const desenhar = async () => {
        const f = r.fotos[c.nome];
        let u = null; if (f) { const b = await Store.foto(f.chave); if (b) u = URL.createObjectURL(b); }
        const opcoes = async () => {
          const v = await modal(c.rotulo, u ? h('img', { src: u, style: 'width:100%;border-radius:12px;max-height:55vh;object-fit:contain;background:#000' }) : h('p', null, 'Foto já enviada ao servidor.'),
            [{ texto: 'Remover', classe: 'perigo', valor: 'rm' }, { texto: 'Galeria', classe: 'sec', valor: 'gal' }, { texto: 'Tirar outra', valor: 'cam' }]);
          if (v === 'cam') cam.click(); else if (v === 'gal') gal.click();
          else if (v === 'rm' && await confirmar('Remover foto', 'Remover esta foto do registro?', 'Remover', 'perigo')) { delete r.fotos[c.nome]; mudar(c, r.valores[c.nome]); desenhar(); }
        };
        wrap.replaceChildren(
          f ? h('button', { class: 'tile cheia', onclick: opcoes, style: u ? `background-image:url(${u})` : '' }, u ? null : ico('check'))
            : h('button', { class: 'tile', onclick: () => cam.click() }, ico('camera')),
          h('div', { class: 'tile-rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null),
          ...(f ? [] : [h('button', { class: 'tile-gal link', onclick: () => gal.click() }, 'usar da galeria')]), cam, gal);
      };
      async function receber(inp) {
        const arq = inp.files && inp.files[0]; if (!arq) return;
        try {
          const blob = await reduzir(arq, 0, 0.92); // qualidade original
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
      S.tentou = true; S.tentouFim = true;
      const f = faltando(r);
      if (f.length) { if (navigator.vibrate) navigator.vibrate(120); irPendente(0); return; }
      // grupos em que "Nenhum" precisa de confirmação (ex.: manejo)
      const E0 = estadoCampos(form, r.valores);
      for (const g of form.gruposConfirmar || []) {
        const cs = camposDoGrupo(form, g.grupo).filter((nm) => E0[nm] && !E0[nm].oculto); if (!cs.length || cs.some((nm) => r.valores[nm] === true)) continue;
        const sim = await modal(g.grupo, h('p', null, g.pergunta), [{ texto: 'Voltar e marcar', classe: 'sec', valor: false }, { texto: 'Sim, nenhum', valor: true }]);
        if (!sim) { const k = abas.findIndex((a) => a.campos.some((x) => x.grupo === g.grupo)); if (k >= 0) { S.aba = k; render(); const el = conteudo.querySelector(`[data-grupo="${CSS.escape(g.grupo)}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
        r.valores[g.campo] = true; await Store.salvarRegistro(r);
      }
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
      for (const c of form.campos) if (E[c.nome].oculto && !c.auto && !c.agora) { if (c.tipo === 'photo') delete r.fotos[c.nome]; else r.valores[c.nome] = null; }
      recalcular(r);
      anotarHistorico();
      if (!r.concluido_em) r.concluido_em = agoraISO();
      if (r.lat != null && r.lat !== '') { const st = await Setores.doPonto(r.lon, r.lat); if (st) { r.setor = st.n; if (perfil() === 'coletor') r.foraSetor = st.fora; } }
      if (r.validacao === 'Devolvido') r.validacao = 'Corrigido';
      S.editando.delete(r.uuid);
      r.status = 'pendente'; r.gpsAuto = false; r.atualizado_em = agoraISO(); delete r.erroSync;
      await Store.salvarRegistro(r);
      Gps.ouvintes.delete(ouvinte); S.reg = null;
      toast(`${codigoDe(S.form, r.valores) || 'Registro'} salvo.` + (navigator.onLine ? '' : ' Vai quando houver rede.'), 3000); ir('#inicio'); sincronizar(true); quadraAutomatica(r);
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

    async function cancelarRegistro() {
      if (r.__base) { // edição de registro já concluído: volta ao que estava
        if (!(await confirmar('Cancelar a edição', 'Descartar as alterações e voltar o registro como estava?', 'Descartar alterações', 'perigo'))) return;
        clearTimeout(salvarTimer); await descartarEdicao(r); S.editando.delete(r.uuid); Gps.ouvintes.delete(ouvinte); S.reg = null; return ir('#form/' + r.uuid);
      }
      const nf = Object.values(r.fotos || {}).filter((f) => f && f.chave).length;
      if (!(await confirmar('Cancelar registro', `Cancelar ${r.faceId ? 'este cadastro de calçada' : 'esta árvore'}? ${nf ? `O que foi preenchido e ${nf === 1 ? 'a foto serão apagados' : `as ${nf} fotos serão apagados`}` : 'O que foi preenchido será apagado'} do celular. Isso não pode ser desfeito.`, 'Cancelar registro', 'perigo', 'Continuar preenchendo'))) return;
      clearTimeout(salvarTimer); Gps.ouvintes.delete(ouvinte);
      for (const f of Object.values(r.fotos)) if (f && f.chave) await Store.apagarFoto(f.chave);
      await Store.apagarRegistro(r.uuid); S.reg = null; toast('Registro cancelado.'); ir('#inicio');
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
  async function telaMapa(opc) {
    // "mapa primeiro": para a equipe de campo, o mapa é a tela principal (botão + para nova árvore, toque na face para a calçada)
    const campo = !!(opc && opc.campo);
    const div = h('div', { id: 'mapa' });
    const form = S.form;
    const cc = campoCodigo(form), ce = campoEspecie(form);
    const cRisco = form.campos.find((c) => c.tipo === 'choice' && /^risco$/i.test(norm(c.nome)));
    const cCat = form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const cFoto = form.campos.find((c) => c.tipo === 'photo');
    const cArea = form.campos.find((c) => /^area de copa \(m2\)$/i.test(norm(c.nome))) || form.campos.find((c) => /area de copa/i.test(norm(c.nome)));
    const opCalc = cCat && cCat.opcoes.find((o) => /cal[cç]ada/i.test(o.t)); // calçada sem árvores aparece só como a linha tracejada da face
    const raioCopa = (a) => { const v = +String(a == null ? '' : a).replace(',', '.'); return v > 0 ? Math.sqrt(v / Math.PI) : 0; };
    const rotOp = (c, v) => { if (!c || v == null || v === '') return ''; const o = c.opcoes.find((x) => String(x.v) === String(v)); return o ? o.t : String(v); };
    // filtros
    const busca = h('input', { class: 'entrada', placeholder: 'Código ou espécie', autocapitalize: 'none' });
    const selEq = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todas as equipes'));
    const selRisco = cRisco ? h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todos os riscos'), cRisco.opcoes.map((o) => h('option', { value: o.v }, 'Risco ' + o.t.toLowerCase()))) : null;
    const selBairro = h('select', { class: 'entrada oculto' }, h('option', { value: '' }, 'Todos os bairros'));
    const selDia = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todos os dias'), h('option', { value: 'hoje' }, 'Hoje'), h('option', { value: 'ontem' }, 'Ontem'), h('option', { value: '7' }, 'Últimos 7 dias'), h('option', { value: 'outro' }, 'Escolher o dia...'));
    const diaIn = h('input', { type: 'date', class: 'entrada oculto' });
    const selCor = h('select', { class: 'entrada' }, h('option', { value: 'equipe' }, 'Cor por equipe'), cRisco ? h('option', { value: 'risco' }, 'Cor por risco') : null, h('option', { value: 'os' }, 'Cor por ordem de serviço'));
    if (S.corMapa) { selCor.value = S.corMapa; S.corMapa = null; }
    // cliente não vê dados internos das equipes: sem filtro de equipe e cor por risco
    if (perfil() === 'cliente') { selEq.classList.add('oculto'); const oe = selCor.querySelector('option[value="equipe"]'); if (oe) oe.remove(); if (cRisco && selCor.value !== 'os') selCor.value = 'risco'; }
    let osPorArv = null; const osSoltas = []; const ORD_OS = ['Em execução', 'Aberta', 'Solicitada', 'Concluída', 'Cancelada'];
    const carregarOSMapa = async () => {
      if (osPorArv) return; osPorArv = new Map();
      try { const d = await carregarOS(false); for (const o of d.ordens) { if (!o.registro_uuid) { if (o.latitude !== '' && !isNaN(+o.latitude)) osSoltas.push(o); continue; } const a = osPorArv.get(o.registro_uuid); if (!a || ORD_OS.indexOf(o.status) < ORD_OS.indexOf(a.status)) osPorArv.set(o.registro_uuid, o); } } catch (e) { /* sem ordens */ }
    };
    const selQd = h('select', { class: 'entrada oculto' }, h('option', { value: 'sit' }, 'Quadras por situação'), h('option', { value: 'eq' }, 'Quadras por equipe'), h('option', { value: '' }, 'Sem quadras'));
    if (perfil() === 'cliente') { const oq = selQd.querySelector('option[value="eq"]'); if (oq) oq.remove(); } // cliente não vê equipes
    if (S.qdModo != null && (S.qdModo !== 'eq' || perfil() !== 'cliente')) selQd.value = S.qdModo;
    const conta = h('small', { class: 'mapa-conta' });
    const faixaOff = h('div', { class: 'faixa-off oculto', role: 'status' });
    const pintarConta = () => { conta.textContent = conta.textContent.replace(/ · Carregando quadras\.\.\./, '') + (conta.dataset.qd ? ' · ' + conta.dataset.qd : ''); };
    // em tela baixa os filtros ficam recolhidos num botão, para sobrar mapa
    const selBox = h('div', { class: 'mapa-sel' }, selEq, selDia, diaIn, selRisco, selBairro, selCor, selQd);
    const celular = window.innerWidth < 900 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const baixa = celular || window.innerHeight < 760; if (S.filtrosAbertos == null) S.filtrosAbertos = !baixa;
    const nFiltros = () => [selEq.value, selDia.value, selRisco && selRisco.value, selBairro.value, soAlto ? '1' : ''].filter(Boolean).length;
    const rotFiltros = () => (S.filtrosAbertos ? 'Esconder filtros' : 'Filtros' + (nFiltros() ? ` (${nFiltros()})` : ''));
    const btFiltros = h('button', { class: 'btn sec peq bt-filtros' + (baixa ? '' : ' oculto'), onclick: () => { S.filtrosAbertos = !S.filtrosAbertos; selBox.classList.toggle('oculto', !S.filtrosAbertos); btFiltros.textContent = rotFiltros(); setTimeout(() => mapa.invalidateSize(), 50); } }, '');
    // atalhos de um toque para os filtros mais usados
    let soAlto = false, trajOn = false, trajDados = null, trajDia = null, trajGen = 0, trajAvisou = ''; const trajCamada = L.layerGroup();
    const chipR = (txt, ativo, fn, semAjustar) => h('button', { class: 'chip-rapido' + (ativo() ? ' sel' : ''), 'aria-pressed': ativo() ? 'true' : 'false', onclick: (e) => { fn(); pintarChips(); desenhar(!semAjustar); } }, txt);
    const chipsR = h('div', { class: 'chips-rapidos' });
    function pintarChips() {
      chipsR.replaceChildren(chipR('Hoje', () => selDia.value === 'hoje', () => { selDia.value = selDia.value === 'hoje' ? '' : 'hoje'; diaIn.classList.add('oculto'); }),
        perfil() === 'coletor' && minhaEquipe() ? chipR('Minha equipe', () => selEq.value === minhaEquipe(), () => { selEq.value = selEq.value === minhaEquipe() ? '' : minhaEquipe(); }) : null,
        cRisco ? chipR('Risco alto', () => soAlto, () => { soAlto = !soAlto; if (soAlto) { selCor.value = 'risco'; if (selRisco) selRisco.value = ''; } }) : null,
        ehCoord() && !Api.demo ? chipR('Trajetos', () => trajOn, () => { trajOn = !trajOn; trajDados = null; trajAvisou = ''; }, true) : null);
      btFiltros.textContent = rotFiltros();
    }
    if (!S.filtrosAbertos) selBox.classList.add('oculto');
    const buscaRes = h('div', { class: 'busca-res oculto', role: 'listbox' });
    const barra = h('div', { class: 'mapa-filtros' }, h('div', { class: 'mapa-busca' }, busca, btFiltros), buscaRes, chipsR, selBox, conta, faixaOff);
    const barraSel = h('div', { class: 'qd-selecao oculto' });
    // botões grandes embaixo, à direita (alcance do polegar): minha posição, ver a cidade e selecionar
    const btEu = h('button', { class: 'mapa-bt grande', onclick: () => centrar(), 'aria-label': 'Minha posição', title: 'Minha posição' }, ico('alvo'), h('span', { class: 'so-leitor' }, 'Minha posição'));
    const btCidade = h('button', { class: 'mapa-bt', onclick: () => verCidade(), 'aria-label': 'Ver a cidade', title: 'Ver a cidade' }, ico('cidade'), h('span', { class: 'so-leitor' }, 'Ver a cidade'));
    const btSel = h('button', { class: 'mapa-bt pilula oculto', onclick: () => iniciarSelecao(), 'aria-label': 'Selecionar quadras ou faces' }, ico('selecionar'), 'Selecionar');
    const bts = h('div', { class: 'mapa-bts' }, btSel, btCidade, btEu);
    const fab = campo ? h('button', { class: 'btn nova mapa-mais', onclick: () => novoRegistro(), 'aria-label': 'Nova árvore', title: 'Nova árvore' }, ico('mais'), h('span', { class: 'so-leitor' }, 'Nova árvore')) : null;
    // faixa embaixo do mapa: o que antes ficava na tela inicial (envio, cadastro não terminado, turno, avisos, encerrar face, meus registros)
    const base = campo ? h('div', { class: 'campo-base' },
      h('div', { class: 'campo-faixas' }, h('div', { id: 'aviso-versao' }), h('div', { id: 'turno' }), h('div', { id: 'aviso-gps' }), h('div', { id: 'aviso-espaco' }), h('div', { id: 'continuar' }), h('div', { id: 'devolvidos' }), h('div', { id: 'os-equipe' }), h('div', { id: 'encerrar-face' })),
      h('div', { class: 'campo-linha' }, h('div', { class: 'campo-info' }, h('div', { class: 'resumo mini', id: 'stats' }), h('small', { class: 'ult-envio', id: 'ult-envio' })), h('div', { id: 'dupla-hoje' }), h('button', { class: 'btn sec peq', onclick: () => ir('#lista') }, 'Meus registros'))) : null;
    const topoM = campo
      ? topo(S.projeto.nome, S.projeto.equipe || S.sessao.usuario.nome, h('button', { class: 'ic', onclick: abrirMenu, 'aria-label': 'Menu' }, ico('menu')), h('div', { class: 'topo-dir' }, ajudaBt('mapa'), h('button', { class: 'sync', onclick: tocarSync }, '...')))
      : topo('Mapa', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir(perfil() === 'cliente' ? '#painel' : '#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('div', { class: 'topo-dir' }, ajudaBt('mapa')));
    const telaM = h('div', { class: 'tela-mapa' + (campo ? ' modo-campo' : '') }, topoM, S.expirada && campo ? h('div', { class: 'aviso' }, 'Sua sessão expirou. ', h('button', { class: 'btn peq', onclick: reentrar }, 'Entrar de novo')) : null, barra, div, bts, fab, base, barraSel);
    $app.replaceChildren(telaM);
    if (campo) { atualizarSync(); listarRegistros(); pintarOSEquipe(); pintarAvisoVersao(); pintarEncerrarFace(); pintarAvisoGps(); pintarDicaGps(); pintarTurno(); pintarEspaco(); Dupla.carregar().then(pintarDupla); }
    // um único desenho (canvas) para quadras, pontos e "minha posição": com dois, o de cima engolia o toque
    const render = L.canvas({ padding: 0.3, tolerance: 8 });
    const mapa = L.map(div, { preferCanvas: true, renderer: render, maxZoom: 21, fadeAnimation: false, zoomControl: !celular }).setView(S.pos ? [S.pos.lat, S.pos.lon] : [-15.8, -47.9], S.pos ? 18 : 4); // fadeAnimation desligada: a ficha que fecha não recebe mais toque
    // declarados antes de qualquer espera: os botões e eventos do mapa podem ser tocados enquanto os dados carregam
    let qdDados = null, qdSit = new Map(), selecao = null; let seguindo = false, euPrec = null, eu = null;
    if (S.fundo == null) S.fundo = (await Store.get('fundo')) || 'ruas';
    camadasFundo(mapa, false);
    const cores = ['#00546E', '#CD834C', '#6A1B9A', '#2E7D32', '#C62828', '#12A6C8'];
    const corRisco = { Baixo: COR_RISCO.Baixo, 'Médio': COR_RISCO['Médio'], Alto: COR_RISCO.Alto, Severo: COR_RISCO.Severo };
    const equipes = []; const corEq = (e) => { if (!equipes.includes(e)) equipes.push(e); return e === '-' ? '#8A969C' : corEquipe(e); };
    // pontos: os do aparelho primeiro (podem ter edição ainda não enviada), depois os do servidor
    const pts = []; const vistos = new Set();
    const add = (o) => { if (o.lat == null || o.lat === '' || isNaN(+o.lat) || vistos.has(o.uid)) return; if (opCalc && String(o.cat) === String(opCalc.v)) return; vistos.add(o.uid); o.lat = +o.lat; o.lon = +o.lon; o.chave = norm(o.cod + ' ' + o.esp); corEq(o.equipe || '-'); pts.push(o); };
    if (perfil() !== 'cliente') for (const r of await Store.registros(S.projeto.id)) if (r.status !== 'rascunho') add({ uid: r.uuid, lat: r.lat, lon: r.lon, equipe: r.equipe, bairro: r.bairro || '', dia: diaLocal(r.criado_em), cod: cc ? r.valores[cc.nome] || '' : '', esp: ce ? r.valores[ce.nome] || '' : '', risco: cRisco ? r.valores[cRisco.nome] : '', cat: cCat ? r.valores[cCat.nome] : '', rm: raioCopa(cArea ? r.valores[cArea.nome] : 0), foto: '', local: true });
    // quadras: desenhadas antes dos pontos, no mesmo canvas, para o toque no ponto ter prioridade
    // setores censitários (quando o projeto tem): os da minha equipe com borda forte, os outros finos; não pegam o toque
    const stCamada = L.layerGroup().addTo(mapa);
    if (perfil() !== 'cliente') Setores.camada().then(async (cam) => {
      if (!cam || !document.body.contains(div)) return; const meus = new Set((await Setores.situacao()).filter((x) => x.equipe && x.equipe === minhaEquipe()).map((x) => x.numero));
      for (const st of cam.setores) { const meu = meus.has(st.n); L.polygon(st.a.map((an) => { const o = []; for (let i = 0; i < an.length; i += 2) o.push([an[i + 1], an[i]]); return o; }), { renderer: render, interactive: false, fill: false, color: meu ? '#00546E' : '#7A8C92', weight: meu ? 3 : 1.2, dashArray: meu ? null : '6 5', opacity: meu ? 0.9 : 0.6 }).addTo(stCamada); }
    }).catch(() => {});
    const qdCamada = L.layerGroup().addTo(mapa); const rotulos = L.layerGroup().addTo(mapa);
    const corQd = (q) => { const s = qdSit.get(q.n) || {}; if (selQd.value === 'eq') return s.equipe ? corEq(s.equipe) : '#9AA9B0'; return COR_QD[s.situacao || 'A levantar']; };
    const qdLayers = new Map();
    // faces de quadra: linhas sobre o contorno da quadra, por cima dela e por baixo dos pontos
    const fcLayers = new Map(); let selTipo = 'qd'; const ZOOM_FACES = 16; let fcAberta = null;
    const fcSit = () => qdSit.faces || new Map();
    const estiloFc = (id) => {
      const s = fcSit().get(id) || {}; const st = s.situacao || 'A levantar'; const sel = selecao && selTipo === 'fc' && selecao.has(id);
      const aberta = fcAberta === id;
      const cor = aberta ? '#1565C0' : sel ? '#6A1B9A' : selQd.value === 'eq' ? (s.equipe ? corEq(s.equipe) : COR_FC['A levantar']) : COR_FC[st];
      const forte = aberta || sel || (selQd.value === 'eq' ? !!s.equipe : st !== 'A levantar');
      return { color: cor, weight: aberta ? 10 : sel ? 8 : forte ? 6 : 3, opacity: forte ? 0.95 : 0.6, dashArray: st === 'Levantada, sem árvores' && !sel && !aberta && selQd.value !== 'eq' ? '10 6' : null, lineCap: 'butt' };
    };
    // de perto (zoom 16 ou mais) a quadra fica só com o contorno e o número: quem conta a história são as faces; de longe, preenchida pela situação
    const estiloQd = (q) => { const sel = selecao && selecao.has(q.n); const cor = corQd(q); const s = qdSit.get(q.n) || {}; const forte = selQd.value === 'eq' ? !!s.equipe : (s.situacao && s.situacao !== 'A levantar'); const perto = mapa.getZoom() >= ZOOM_FACES && q.f;
      if (sel) return { color: '#6A1B9A', weight: 3, fillColor: '#9C4DCC', fillOpacity: 0.4 };
      return perto ? { color: '#8A9BA2', weight: 1, fillColor: cor, fillOpacity: 0.04 } : { color: cor, weight: 1, fillColor: cor, fillOpacity: forte ? 0.45 : 0.14 }; };
    // só as quadras perto da área visível ficam desenhadas: arrastar e dar zoom continuam leves com milhares de quadras
    function sincQdVista() {
      if (!qdDados || !selQd.value) { if (qdLayers.size) { qdCamada.clearLayers(); qdLayers.clear(); } return; }
      const b = mapa.getBounds().pad(0.4); const W = b.getWest(), E = b.getEast(), Sl = b.getSouth(), N = b.getNorth();
      const quer = new Set();
      for (const q of qdDados.quadras) if (!(q.b[2] < W || q.b[0] > E || q.b[3] < Sl || q.b[1] > N)) quer.add(q.n);
      for (const [n, ly] of qdLayers) if (!quer.has(n)) { qdCamada.removeLayer(ly); qdLayers.delete(n); }
      const comFaces = mapa.getZoom() >= ZOOM_FACES;
      for (const [id, ly] of fcLayers) if (!comFaces || !quer.has(id.slice(0, id.lastIndexOf('-')))) { qdCamada.removeLayer(ly); fcLayers.delete(id); }
      let novasF = 0;
      for (const q of qdDados.quadras) {
        if (!quer.has(q.n)) continue;
        if (!qdLayers.has(q.n)) {
          const ly = L.polygon(q.a.map((a) => { const r = []; for (let i = 0; i < a.length; i += 2) r.push([a[i + 1], a[i]]); return r; }), Object.assign({ renderer: render }, estiloQd(q))).on('click', (e) => { L.DomEvent.stop(e); tocarMapa(e.latlng, q); }).addTo(qdCamada);
          ly.bringToBack(); qdLayers.set(q.n, ly); // quadra sempre por baixo dos pontos: o toque no ponto tem prioridade
        }
        if (comFaces && q.f) for (const f of q.f) {
          const id = q.n + '-' + f.i; if (fcLayers.has(id)) continue;
          const ly = L.polyline(Quadras.faceCoords(q, f).map((c) => [c[1], c[0]]), Object.assign({ renderer: render }, estiloFc(id))).on('click', (e) => { L.DomEvent.stop(e); tocarMapa(e.latlng, null, { q, f }); }).addTo(qdCamada);
          ly.bringToBack(); fcLayers.set(id, ly); novasF++;
        }
      }
      if (novasF) for (const ly of qdLayers.values()) ly.bringToBack(); // ordem: quadras, faces, pontos
    }
    let qdPorN = null;
    function desenharQuadras() {
      if (qdDados && (!qdPorN || qdPorN.d !== qdDados)) qdPorN = { d: qdDados, m: new Map(qdDados.quadras.map((q) => [q.n, q])) };
      sincQdVista();
      for (const [n, ly] of qdLayers) { const q = qdPorN.m.get(n); if (q) ly.setStyle(estiloQd(q)); }
      for (const [id, ly] of fcLayers) ly.setStyle(estiloFc(id));
      pintarRotulos();
    }
    const restilizar = (ns) => { for (const n of ns) { if (fcLayers.has(n)) { fcLayers.get(n).setStyle(estiloFc(n)); continue; } const ly = qdLayers.get(n); const q = qdPorN && qdPorN.m.get(n); if (ly && q) ly.setStyle(estiloQd(q)); } };
    window.addEventListener('quadras-atualizadas', async function f() { if (!document.body.contains(div)) return window.removeEventListener('quadras-atualizadas', f); qdSit = await carregarSitQd(false); desenhar(false); });
    // escolher por área: arrastar um retângulo sobre o mapa
    let porArea = false, ini = null, ret = null;
    const ptLL = (e) => mapa.mouseEventToLatLng(e);
    div.addEventListener('pointerdown', (e) => { if (!porArea) return; ini = ptLL(e); e.preventDefault(); e.stopPropagation(); }, true);
    div.addEventListener('pointermove', (e) => { if (!porArea || !ini) return; const b = L.latLngBounds(ini, ptLL(e)); if (ret) ret.setBounds(b); else ret = L.rectangle(b, { color: '#6A1B9A', weight: 2, dashArray: '6 4', fillOpacity: 0.08, interactive: false }).addTo(mapa); e.preventDefault(); e.stopPropagation(); }, true);
    div.addEventListener('pointerup', (e) => {
      if (!porArea || !ini) return; const b = L.latLngBounds(ini, ptLL(e)); ini = null; if (ret) { ret.remove(); ret = null; }
      const novas = selTipo === 'fc'
        ? qdDados.quadras.filter((q) => q.f && b.intersects(L.latLngBounds([q.b[1], q.b[0]], [q.b[3], q.b[2]]))).flatMap((q) => q.f.filter((f) => { const c = Quadras.faceCoords(q, f); const m = c[Math.floor(c.length / 2)]; return b.contains([m[1], m[0]]); }).map((f) => q.n + '-' + f.i))
        : qdDados.quadras.filter((q) => { const c = Quadras.centro(q); return b.contains(c); }).map((q) => q.n);
      novas.forEach((n) => selecao.add(n)); porArea = false; mapa.dragging.enable(); restilizar(novas); pintarSelecao(); e.preventDefault(); e.stopPropagation();
    }, true);
    function pintarRotulos() {
      rotulos.clearLayers(); if (!qdDados || !selQd.value || mapa.getZoom() < ZOOM_FACES) return;
      const b = mapa.getBounds(); let n = 0;
      for (const q of qdDados.quadras) { if (q.b[2] < b.getWest() || q.b[0] > b.getEast() || q.b[3] < b.getSouth() || q.b[1] > b.getNorth()) continue; if (++n > 400) break; L.marker(Quadras.centro(q), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'qd-rot', html: h('span', null, q.n), iconSize: null }) }).addTo(rotulos); }
    }
    let zAnt = mapa.getZoom();
    mapa.on('moveend zoomend', () => setTimeout(() => { if (!document.body.contains(div)) return; sincQdVista(); pintarRotulos(); const z = mapa.getZoom(); if ((z >= ZOOM_FACES) !== (zAnt >= ZOOM_FACES)) { legenda(); desenharQuadras(); } if (z !== zAnt) ajustarRaios(); zAnt = z; }, 0)); window.__app.mapa = mapa;
    const podeMarcarQd = (s) => ehCoord() || (perfil() === 'coletor' && (!s.equipe || s.equipe === minhaEquipe()));
    // ---- ficha: no celular sobe de baixo (folha) e o mapa se desloca para o item continuar à vista; no computador, balão ----
    let folha = null, aoFecharFicha = null;
    function fecharFicha() { if (folha) { folha.remove(); folha = null; telaM.classList.remove('com-folha'); } const f = aoFecharFicha; aoFecharFicha = null; if (f) f(); }
    const fecharOrig = mapa.closePopup.bind(mapa); mapa.closePopup = (...a) => { fecharFicha(); return fecharOrig(...a); };
    function abrirFicha(conteudo, ll, aoFechar) {
      fecharFicha(); fecharOrig(); aoFecharFicha = aoFechar || null;
      if (!celular) { L.popup({ maxWidth: 320 }).setLatLng(ll).setContent(conteudo).openOn(mapa); mapa.once('popupclose', () => { const f = aoFecharFicha; aoFecharFicha = null; if (f) f(); }); return; }
      folha = h('div', { class: 'mapa-folha', role: 'dialog' }, h('div', { class: 'mf-alca', 'aria-hidden': 'true' }), h('button', { class: 'mf-fechar', 'aria-label': 'Fechar', onclick: () => fecharFicha() }, ico('fechar')), conteudo);
      telaM.append(folha); telaM.classList.add('com-folha');
      // mapa se desloca para o item ficar acima da folha
      requestAnimationFrame(() => { if (!folha) return; const alt = folha.getBoundingClientRect().height; const tam = mapa.getSize(); const pt = mapa.latLngToContainerPoint(ll); const lim = tam.y - alt - 30; if (pt.y > lim || pt.y < 30) mapa.panBy([0, pt.y - Math.max(60, lim / 2)], { animate: true }); });
    }
    const fichaAberta = () => !!folha;
    mapa.on('click', (e) => { if (fichaAberta()) return fecharFicha(); if (!selecao) tocarMapa(e.latlng, null); });
    // distância (em pixels na tela) do toque até cada face perto dele
    function facesPerto(ll) {
      if (!qdDados || !selQd.value || mapa.getZoom() < ZOOM_FACES) return [];
      const pt = mapa.latLngToContainerPoint(ll); const a = mapa.containerPointToLatLng([pt.x - 40, pt.y + 40]), b = mapa.containerPointToLatLng([pt.x + 40, pt.y - 40]);
      const out = [];
      for (const q of qdDados.quadras) {
        if (!q.f || q.b[2] < a.lng || q.b[0] > b.lng || q.b[3] < a.lat || q.b[1] > b.lat) continue;
        for (const f of q.f) {
          const cs = Quadras.faceCoords(q, f).map((c) => mapa.latLngToContainerPoint([c[1], c[0]])); let d = Infinity;
          for (let i = 1; i < cs.length; i++) { const p1 = cs[i - 1], p2 = cs[i]; const dx = p2.x - p1.x, dy = p2.y - p1.y; const l2 = dx * dx + dy * dy; let t = l2 ? ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); d = Math.min(d, Math.hypot(pt.x - (p1.x + t * dx), pt.y - (p1.y + t * dy))); }
          if (d <= 24) out.push({ q, f, id: q.n + '-' + f.i, d });
        }
      }
      return out.sort((x, y) => x.d - y.d);
    }
    // toque no mapa: a face mais próxima em 24 px; se duas calçadas estão quase à mesma distância, pergunta qual
    async function tocarMapa(ll, qd, direta) {
      if (fichaAberta()) return fecharFicha(); // com a ficha aberta, o primeiro toque só fecha
      if (selecao) { if (direta && selTipo === 'fc') return clicarFace(direta.q, direta.f, ll); if (qd && selTipo === 'qd') return clicarQuadra(qd, ll); const c0 = facesPerto(ll)[0]; if (c0 && selTipo === 'fc') return clicarFace(c0.q, c0.f, ll); return; }
      const c = facesPerto(ll);
      if (c.length) {
        const outra = c.find((x) => x.id !== c[0].id);
        if (outra && outra.d - c[0].d < 8) {
          const nome = (x) => `Face ${x.f.i} da quadra ${x.q.n} · ${x.f.r}`;
          const v = await modal('Qual calçada?', h('p', { class: 'dica' }, 'O toque ficou entre duas faces. Escolha a calçada:'), [{ texto: nome(c[0]), valor: 0 }, { texto: nome(outra), valor: 1 }, { texto: 'Cancelar', classe: 'sec', valor: null }]);
          if (v == null) return; const x = v ? outra : c[0]; return clicarFace(x.q, x.f, ll);
        }
        return clicarFace(c[0].q, c[0].f, ll);
      }
      if (direta) return clicarFace(direta.q, direta.f, ll);
      if (qd) clicarQuadra(qd, ll);
    }
    function clicarQuadra(q, ll) {
      if (selecao) { if (selTipo !== 'qd') return toast('Toque nas linhas das faces para escolher.'); if (selecao.has(q.n)) selecao.delete(q.n); else selecao.add(q.n); pintarSelecao(); restilizar([q.n]); return; }
      const s = qdSit.get(q.n) || { situacao: 'A levantar', equipe: '' }; const st = s.situacao || 'A levantar';
      const fFeitas = q.f ? q.f.filter((f) => FACE_FEITA.includes((fcSit().get(q.n + '-' + f.i) || {}).situacao)).length : 0;
      const arv = pts.filter((o) => Quadras.dentro(o.lon, o.lat, q)).length;
      const marcar = async (itens) => { try { const r = await marcarQuadras(itens); if (r.recusadas && r.recusadas.length) toast(r.recusadas[0].motivo, 5000); else toast(r.fila ? 'Sem internet: guardado no aparelho.' : 'Quadra atualizada.'); qdSit = await carregarSitQd(!r.fila); mapa.closePopup(); desenhar(false); } catch (e) { toast(e.message, 5000); } };
      const eqIn = escolhaEquipe(s.equipe || '');
      const pop = h('div', { class: 'ficha qd-ficha' }, h('b', null, 'Quadra ' + q.n),
        q.p ? Object.entries(q.p).map(([k, v]) => h('small', null, (/^ruas?$/i.test(k) ? '' : k + ': ') + v)) : null,
        h('div', null, h('span', { class: 'os-st', style: `background:${COR_QD[st]}` }, st + (s.__pend ? ' · a enviar' : '')), ' ', perfil() === 'cliente' ? '' : s.equipe ? s.equipe : 'sem equipe'),
        h('small', null, `${pl(arv, 'árvore cadastrada', 'árvores cadastradas')} dentro dela` + (s.marcada_por ? ` · marcada por ${s.marcada_por} em ${dataAno(s.marcada_em)}` : '')),
        q.f ? h('small', null, `Faces: ${fFeitas} de ${q.f.length} levantadas.` + (mapa.getZoom() < ZOOM_FACES ? '' : ' Toque na linha de uma face para marcar.')) : null,
        q.f && mapa.getZoom() < ZOOM_FACES ? h('button', { class: 'btn sec peq', onclick: () => { fecharFicha(); mapa.setView(Quadras.centro(q), 18); } }, 'Aproximar para marcar faces') : null,
        perfil() === 'coletor' && !s.equipe ? h('button', { class: 'btn peq', onclick: () => marcar([{ numero: q.n, situacao: st === 'A levantar' ? 'Em levantamento' : st }]) }, 'Assumir esta quadra para a minha equipe') : null,
        podeMarcarQd(s) ? h('div', { class: 'chips qd-chips' }, SIT_QD.map((x) => h('button', { class: 'chip' + (x === st ? ' sel' : ''), onclick: () => x !== st && marcar([{ numero: q.n, situacao: x }]) }, x))) : null,
        ehCoord() ? h('div', { class: 'qd-eq' }, eqIn.el, h('button', { class: 'btn sec peq', onclick: () => { const v = eqIn.valor(); if (v == null) return toast('Escolha a equipe.'); marcar([{ numero: q.n, equipe: v }]); } }, 'Definir equipe')) : null,
        ehCoord() ? h('button', { class: 'btn sec peq', onclick: () => { mapa.closePopup(); selTipo = 'qd'; selecao = new Set([q.n]); pintarSelecao(); restilizar([q.n]); } }, 'Escolher várias quadras') : null);
      abrirFicha(pop, ll);
    }
    // equipe escolhida numa lista fechada (evita "Equipe 1" e "equipe1" virarem duas); "Outra equipe..." abre o campo
    function escolhaEquipe(atual, comVazio) {
      const conhecidas = [...new Set([...equipes, ...[...qdSit.values()].map((x) => x.equipe), ...[...fcSit().values()].map((x) => x.equipe)].filter((e) => e && e !== '-'))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
      const sel = h('select', { class: 'entrada sel-eq', 'aria-label': 'Equipe' }, comVazio ? h('option', { value: '__' }, 'Equipe...') : null, conhecidas.map((e) => h('option', { value: e, selected: e === atual }, e)), h('option', { value: '', selected: !atual && !comVazio }, 'Sem equipe'), h('option', { value: '__outra' }, 'Outra equipe...'));
      const txt = h('input', { class: 'entrada oculto eq-outra', placeholder: 'Nome da equipe (ex.: Equipe 4)' });
      sel.addEventListener('change', () => { txt.classList.toggle('oculto', sel.value !== '__outra'); if (sel.value === '__outra') txt.focus(); });
      return { el: h('span', { class: 'eq-escolha' }, sel, txt), valor: () => (sel.value === '__outra' ? (txt.value.trim() || null) : sel.value === '__' ? null : sel.value) };
    }
    function iniciarSelecao() {
      if (!qdDados) return toast('Este projeto ainda não tem a camada de quadras.');
      const temFaces = qdDados.quadras.some((q) => q.f);
      const escolher = (t) => { fecharFicha(); selTipo = t; selecao = new Set(); if (t === 'fc' && mapa.getZoom() < ZOOM_FACES) mapa.setZoom(17); pintarSelecao(); };
      if (!temFaces) return escolher('qd');
      modal('Selecionar', h('p', { class: 'dica' }, 'Depois toque em cada uma ou escolha uma área do mapa.'), [{ texto: 'Faces (calçadas)', valor: 'fc' }, { texto: 'Quadras inteiras', valor: 'qd', classe: 'sec' }, { texto: 'Cancelar', valor: null, classe: 'sec' }]).then((t) => t && escolher(t));
    }
    // face sem equipe segue a equipe da quadra; a coordenação pode passar a face para outra equipe
    const eqDaQuadra = (q) => { const x = qdSit.get(q.n) || {}; return x.equipe && x.atribuida !== 'nao' ? x.equipe : ''; };
    const podeMarcarFc = (s, q) => ehCoord() || (perfil() === 'coletor' && (s.equipe ? s.equipe === minhaEquipe() : !eqDaQuadra(q) || eqDaQuadra(q) === minhaEquipe()));
    function clicarFace(q, f, ll) {
      const id = q.n + '-' + f.i;
      if (selecao) { if (selTipo !== 'fc') return toast('Toque nas quadras para escolher.'); if (selecao.has(id)) selecao.delete(id); else selecao.add(id); pintarSelecao(); restilizar([id]); return; }
      const s = fcSit().get(id) || { situacao: 'A levantar', equipe: '' }; const st = s.situacao || 'A levantar';
      const lado = f.s ? qdDados.quadras.flatMap((x) => (x.f || []).filter((y) => y.s === f.s).map((y) => ({ id: x.n + '-' + y.i, c: y.c }))) : [];
      const mLado = lado.reduce((a, x) => a + x.c, 0);
      const marcar = async (itens) => { try { const r = await marcarQuadras(itens.map((i) => Object.assign({ tipo: 'face', rua: f.r }, i))); if (r.recusadas && r.recusadas.length) toast(r.recusadas[0].motivo, 5000); else toast(r.fila ? 'Sem internet: guardado no aparelho.' : 'Face atualizada.'); qdSit = await carregarSitQd(!r.fila); mapa.closePopup(); desenhar(false); } catch (e) { toast(e.message, 5000); } };
      const eqIn = escolhaEquipe(s.equipe || '');
      const pode = podeMarcarFc(s, q) && perfil() !== 'cliente';
      const vaiSel = (ids) => { mapa.closePopup(); selTipo = 'fc'; selecao = new Set(ids); pintarSelecao(); restilizar([...selecao]); };
      const mais = [
        lado.length > 1 && (pode || ehCoord()) ? h('button', { class: 'btn sec peq', onclick: () => vaiSel(lado.map((x) => x.id)) }, `Escolher o lado todo da rua (${lado.length} faces, ${fmtM(mLado)})`) : null,
        pode ? h('button', { class: 'btn sec peq', onclick: () => vaiSel([id]) }, 'Escolher várias faces') : null,
        pode && st === 'Levantada' ? h('button', { class: 'btn sec peq acao', onclick: () => marcar([{ numero: id, situacao: 'Em levantamento' }]) }, 'Voltar para Em levantamento') : null,
        pode && st !== 'A levantar' ? h('button', { class: 'btn sec peq acao', onclick: () => marcar([{ numero: id, situacao: 'A levantar' }]) }, 'Voltar para A levantar') : null,
        ehCoord() ? h('div', { class: 'qd-eq' }, eqIn.el, h('button', { class: 'btn sec peq', onclick: () => { const v = eqIn.valor(); if (v == null) return toast('Escolha a equipe.'); marcar([{ numero: id, equipe: v }]); } }, 'Definir equipe')) : null].filter(Boolean);
      const pop = h('div', { class: 'ficha qd-ficha' }, h('b', null, `Face ${f.i} da quadra ${q.n}`), h('small', null, `${f.r} · ${fmtN(f.c)} m`),
        h('div', null, h('span', { class: 'os-st', style: `background:${COR_FC[st]}` }, st + (s.__pend ? ' · a enviar' : '')), ' ', perfil() === 'cliente' ? '' : s.equipe ? s.equipe : eqDaQuadra(q) ? 'quadra da ' + eqDaQuadra(q) : 'sem equipe'),
        s.marcada_por ? h('small', null, `marcada por ${s.marcada_por} em ${dataAno(s.marcada_em)}`) : null,
        pode && !FACE_FEITA.includes(st) ? h('button', { class: 'btn cheio acao', onclick: () => marcar([{ numero: id, situacao: 'Levantada' }]) }, ico('check'), 'Marcar como levantada') : null,
        pode && st === 'A levantar' ? h('button', { class: 'btn sec cheio acao', onclick: () => marcar([{ numero: id, situacao: 'Em levantamento' }]) }, 'Em levantamento') : null,
        pode ? h('button', { class: 'btn sec cheio acao', onclick: () => { mapa.closePopup(); iniciarCalcadaFace(q, f); } }, ico('camera'), st === 'Levantada, sem árvores' ? 'Refazer o cadastro da calçada sem árvores' : 'Sem árvores (só a foto)') : null,
        mais.length ? h('details', { class: 'qd-mais' }, h('summary', null, 'Mais opções'), mais) : null);
      fcAberta = id; restilizar([id]);
      abrirFicha(pop, ll, () => { fcAberta = null; restilizar([id]); });
    }
    function pintarSelecao() {
      barraSel.classList.toggle('oculto', !selecao); if (!selecao) { bts.classList.remove('oculto'); return; }
      const fc = selTipo === 'fc'; const eqSel = escolhaEquipe('', true); const eqIn = { get value() { const v = eqSel.valor(); return v == null ? '' : v === '' ? 'Sem equipe' : v; } };
      const sitSel = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Situação...'), (fc ? SIT_FC.filter((x) => x !== 'Levantada, sem árvores') : SIT_QD).map((x) => h('option', { value: x }, x)));
      const ruaDe = (id) => { const k = id.lastIndexOf('-'); const q = qdPorN && qdPorN.m.get(id.slice(0, k)); const f = q && q.f && q.f.find((y) => y.i === id.slice(k + 1)); return f ? f.r : ''; };
      const aplicar = async () => {
        if (!selecao.size) return toast(fc ? 'Toque nas faces para escolher.' : 'Toque nas quadras para escolher.');
        const it = [...selecao].map((n) => { const o = fc ? { tipo: 'face', numero: n, rua: ruaDe(n) } : { numero: n }; if (eqIn.value.trim() === 'Sem equipe') o.equipe = ''; else if (eqIn.value.trim()) o.equipe = eqIn.value.trim(); if (sitSel.value) o.situacao = sitSel.value; return o; });
        if (!it.some((o) => o.equipe != null || o.situacao)) return toast('Escolha a equipe ou a situação.');
        try { const r = await marcarQuadras(it); toast(r.fila ? 'Sem internet: guardado no aparelho. Vai quando o sinal voltar.' : (fc ? `${pl(it.length - (r.recusadas || []).length, 'face atualizada', 'faces atualizadas')}.` : `${pl(r.alteradas, 'quadra atualizada', 'quadras atualizadas')}.`) + (r.recusadas && r.recusadas.length ? ` ${r.recusadas.length} não aceita(s): ${r.recusadas[0].motivo}` : ''), 5000); qdSit = await carregarSitQd(!r.fila); selecao = null; pintarSelecao(); desenhar(false); } catch (e) { toast(e.message, 5000); }
      };
      const mSel = fc ? [...selecao].reduce((a, id) => { const k = id.lastIndexOf('-'); const q = qdPorN && qdPorN.m.get(id.slice(0, k)); const f = q && q.f && q.f.find((y) => y.i === id.slice(k + 1)); return a + (f ? f.c : 0); }, 0) : 0;
      const sair = () => { const v = [...selecao]; selecao = null; porArea = false; mapa.dragging.enable(); pintarSelecao(); restilizar(v); };
      barraSel.replaceChildren(h('div', { class: 'qd-sel-cab' }, h('b', null, fc ? `${pl(selecao.size, 'face escolhida', 'faces escolhidas')} (${fmtM(mSel)}). Toque nas faces ou escolha uma área.` : `${pl(selecao.size, 'quadra escolhida', 'quadras escolhidas')}. Toque nas quadras ou escolha uma área.`), h('button', { class: 'ic', 'aria-label': 'Sair da seleção', onclick: sair }, ico('fechar'))),
        h('div', { class: 'qd-sel-linha' }, h('button', { class: 'btn sec peq', onclick: () => { porArea = true; mapa.dragging.disable(); toast('Arraste o dedo sobre o mapa para marcar a área.', 3000); } }, 'Escolher por área'), selecao.size > 1 ? h('button', { class: 'btn sec peq', onclick: () => { const v = [...selecao]; selecao = new Set(); restilizar(v); pintarSelecao(); } }, 'Limpar escolha') : null),
        h('div', { class: 'qd-sel-linha' }, ehCoord() ? eqSel.el : null, sitSel,
          h('button', { class: 'btn peq', onclick: aplicar }, 'Aplicar'), h('button', { class: 'btn sec peq', onclick: sair }, 'Sair')));
      bts.classList.toggle('oculto', !!selecao);
    }
    const carregarQdMapa = async () => {
      try {
        conta.dataset.qd = 'Carregando quadras...'; pintarConta();
        qdDados = await carregarQuadras(); delete conta.dataset.qd; if (!qdDados || !document.body.contains(div)) { pintarConta(); return; }
        // primeiro com a situação guardada no aparelho, depois com a do servidor
        qdSit = await carregarSitQd(false, true); for (const s of qdSit.values()) if (s.equipe) corEq(s.equipe);
        selQd.classList.remove('oculto'); preencherEquipes(); desenhar(false); btSel.classList.toggle('oculto', !(ehCoord() || perfil() === 'coletor'));
        // com a camada do projeto, o mapa abre na cidade: na posição do GPS se a pessoa está nela, senão a cidade inteira
        porCidade = true;
        if (!semFiltro() || mexeu) { /* filtro do painel ou mapa já mexido: fica como está */ }
        else if (S.pos && limitesCidade().pad(0.05).contains([S.pos.lat, S.pos.lon])) mapa.setView([S.pos.lat, S.pos.lon], 18);
        else verCidade();
        const nova = await carregarSitQd(false); if (!document.body.contains(div)) return;
        qdSit = nova; for (const s of qdSit.values()) if (s.equipe) corEq(s.equipe); preencherEquipes(); desenhar(false);
      } catch (e) { /* sem quadras */ }
    };
    const camada = L.layerGroup().addTo(mapa); trajCamada.addTo(mapa);
    // trajeto das equipes (coordenação): em cor própria, fora das paletas, e desligável
    async function pintarTrajetos() {
      const gen = ++trajGen; trajCamada.clearLayers(); if (!trajOn) return; // só a chamada mais recente desenha
      const dv = selDia.value; const dia = dv === 'ontem' ? diaLocal(new Date(Date.now() - 864e5).toISOString()) : dv === 'outro' && diaIn.value ? diaIn.value : diaLocal(agoraISO());
      if (!trajDados || trajDia !== dia) { try { trajDados = await Api.b.trajetos(S.projeto.id, dia); trajDia = dia; } catch (e) { toast('Não foi possível carregar os trajetos: ' + e.message); trajOn = false; pintarChips(); return; } }
      if (!trajOn || gen !== trajGen || !document.body.contains(div)) return;
      let n = 0;
      for (const t of trajDados) { if (selEq.value && t.equipe !== selEq.value) continue; const ll = Poly.dec(t.pontos); if (ll.length < 2) continue; n++; L.polyline(ll, { renderer: render, color: '#D81B60', weight: 3, opacity: 0.85, interactive: false }).addTo(trajCamada); L.circleMarker(ll[ll.length - 1], { renderer: render, radius: 4, color: '#fff', weight: 1, fillColor: '#D81B60', fillOpacity: 1, interactive: false }).addTo(trajCamada); }
      const chaveAv = dia + '|' + selEq.value; if (!n && trajAvisou !== chaveAv) trajAvisou = chaveAv, toast(`Nenhum trajeto em ${dia.split('-').reverse().join('/')}${selEq.value ? ' para ' + selEq.value : ''}.`);
    }
    let porCidade = false, mexeu = false; mapa.on('dragstart', () => { mexeu = true; });
    const semFiltro = () => !busca.value.trim() && !selEq.value && !selDia.value && !(selRisco && selRisco.value) && !selBairro.value;
    function desenhar(ajustar) {
      desenharQuadras();
      camada.clearLayers(); if (!selecao) mapa.closePopup();
      const q = norm(busca.value).trim(), eq = selEq.value, rk = selRisco ? selRisco.value : '', porRisco = selCor.value === 'risco';
      const ba = selBairro.value; const porOS = selCor.value === 'os';
      if (porOS && !osPorArv) { carregarOSMapa().then(() => desenhar(false)); }
      const hojeD = diaLocal(agoraISO()); const ontemD = diaLocal(new Date(Date.now() - 864e5).toISOString()); const d7 = diaLocal(new Date(Date.now() - 6 * 864e5).toISOString());
      const dv = selDia.value; const okDia = (o) => { if (!dv) return true; const x = o.dia || ''; if (!x) return false; if (dv === 'hoje') return x === hojeD; if (dv === 'ontem') return x === ontemD; if (dv === '7') return x >= d7; if (dv === 'outro') return !diaIn.value || x === diaIn.value; return true; };
      const vis = pts.filter((o) => (!q || o.chave.includes(q)) && (!eq || o.equipe === eq) && (!rk || String(o.risco) === rk) && (!soAlto || o.risco === 'Alto' || o.risco === 'Severo') && (!ba || o.bairro === ba) && okDia(o));
      const mpp = metrosPorPixel();
      for (const o of vis) {
        const os = porOS && osPorArv ? osPorArv.get(o.uid) : null;
        const fill = porOS ? (os ? COR_OS[os.status] : '#C9D3D6') : porRisco ? corRisco[o.risco] || '#8A969C' : corEq(o.equipe || '-');
        // ponto no tamanho real da copa (como no satélite), com mínimo de 4 px para continuar visível e tocável
        const mk = L.circleMarker([o.lat, o.lon], { renderer: render, radius: raioPx(o, mpp, vis.length), color: '#13262B', weight: 1.2, fillColor: fill, fillOpacity: 0.8 }).on('click', (e) => { L.DomEvent.stop(e); if (fichaAberta()) return fecharFicha(); ficha(o, e.latlng); }).addTo(camada);
        mk.__o = o;
      }
      if (porOS && osPorArv) for (const o of osSoltas) L.circleMarker([+o.latitude, +o.longitude], { renderer: render, radius: 8, color: '#13262B', weight: 2, fillColor: COR_OS[o.status], fillOpacity: 0.95 }).on('click', () => ir('#os/' + encodeURIComponent(o.id))).addTo(camada);
      const rq = qdDados && selQd.value ? resumoQd(qdDados, qdSit) : null;
      const meu = perfil() === 'coletor' && minhaEquipe() ? minhaEquipe() : '';
      const minhasQ = rq && meu && rq.eq[meu] ? ` · Minhas quadras: ${fmtN(rq.eq[meu].Levantada)} de ${fmtN(rq.eq[meu].total)} levantadas` : '';
      const hojeN = meu ? pts.filter((o) => o.equipe === meu && o.dia === hojeD).length : 0;
      conta.textContent = `${vis.length.toLocaleString('pt-BR')} de ${pts.length.toLocaleString('pt-BR')} pontos` + (rq ? ` · ${fmtN(rq.por.Levantada)} de ${fmtN(rq.tot)} quadras levantadas` : '') + minhasQ + (meu ? ` · Hoje: ${fmtN(hojeN)}` : '') + (porOS && osPorArv ? ` · ${[...osPorArv.values()].filter((x) => ['Aberta', 'Em execução', 'Solicitada'].includes(x.status)).length + osSoltas.filter((x) => ['Aberta', 'Em execução', 'Solicitada'].includes(x.status)).length} com ordem em aberto` : '') + (conta.dataset.qd ? ' · ' + conta.dataset.qd : '');
      legenda(); pintarTrajetos();
      if (ajustar && vis.length && !(porCidade && semFiltro())) {
        if (vis.length === 1 && busca.value.trim()) { mapa.setView([vis[0].lat, vis[0].lon], 19); ficha(vis[0]); }
        else mapa.fitBounds(L.latLngBounds(vis.map((o) => [o.lat, o.lon])), { padding: [30, 30], maxZoom: 19 });
      }
    }
    function metrosPorPixel() { const c = mapa.getCenter(); return 40075016.686 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, mapa.getZoom() + 8); }
    const raioPx = (o, mpp, n) => { const min = n > 2000 && mapa.getZoom() < 16 ? 3 : 4; return o.rm ? Math.max(min, Math.min(80, o.rm / mpp)) : (n > 2000 ? 4 : 5); };
    function ajustarRaios() { const mpp = metrosPorPixel(); const n = camada.getLayers().length; camada.eachLayer((l) => { if (l.__o) l.setRadius(raioPx(l.__o, mpp, n)); }); }
    function ficha(o, ll) {
      const pop = h('div', { class: 'ficha' }, h('b', null, o.cod || 'Sem código'), o.esp ? h('i', null, o.esp) : null,
        o.cat ? h('div', null, rotOp(cCat, o.cat)) : null, o.risco ? h('div', null, 'Risco ' + String(rotOp(cRisco, o.risco)).toLowerCase()) : null,
        perfil() !== 'cliente' ? h('small', null, o.equipe || '') : null,
        linkSeguro(o.foto) ? h('a', { href: linkSeguro(o.foto), target: '_blank', rel: 'noopener' }, 'Ver foto') : null,
        osPorArv && osPorArv.get(o.uid) ? h('button', { class: 'btn sec peq', onclick: () => ir('#os/' + encodeURIComponent(osPorArv.get(o.uid).id)) }, `${numOS(osPorArv.get(o.uid))} · ${osPorArv.get(o.uid).status}`) : null,
        o.local ? h('button', { class: 'btn peq', onclick: () => ir('#form/' + o.uid) }, 'Abrir') : perfil() !== 'coletor' ? h('button', { class: 'btn peq', onclick: () => { S.navVal = []; ir('#ficha/' + encodeURIComponent(o.uid)); } }, 'Ver ficha') : null);
      abrirFicha(pop, ll || L.latLng(o.lat, o.lon));
    }
    let leg = null;
    function legenda() {
      if (leg) leg.remove();
      leg = L.control({ position: 'bottomleft' });
      const itens = selCor.value === 'os' ? [...Object.entries(COR_OS), ['Sem ordem', '#C9D3D6']] : selCor.value === 'risco' ? Object.entries(corRisco) : equipes.map((e) => [e, corEq(e)]);
      const itQd = qdDados && selQd.value && !(mapa.getZoom() >= ZOOM_FACES && selQd.value === 'sit') ? (selQd.value === 'eq' ? [...new Set([...qdSit.values()].map((s) => s.equipe).filter(Boolean))].sort().map((e) => [e, corEq(e)]).concat([['Sem equipe', '#9AA9B0']]) : Object.entries(COR_QD)) : [];
      const itFc = qdDados && selQd.value === 'sit' && fcLayers.size ? Object.entries(COR_FC).filter(([t]) => t !== 'A levantar') : [];
      // em tela pequena a legenda começa recolhida (um botão): aberta, ela tapava boa parte do mapa
      if (S.legAberta == null) S.legAberta = mapa.getSize().y >= 520;
      leg.onAdd = () => h('div', { class: 'mapa-leg' + (S.legAberta ? '' : ' recolhida') }, h('button', { class: 'leg-bt', onclick: (e) => { L.DomEvent.stop(e); S.legAberta = !S.legAberta; e.target.closest('.mapa-leg').classList.toggle('recolhida', !S.legAberta); e.target.textContent = S.legAberta ? 'Legenda ▾' : 'Legenda ▸'; } }, S.legAberta ? 'Legenda ▾' : 'Legenda ▸'), itens.map(([t, c]) => h('div', null, h('span', { style: `background:${c}` }), t)), itQd.length ? [h('b', { class: 'leg-tit' }, 'Quadras'), itQd.map(([t, c]) => h('div', null, h('span', { class: 'leg-qd', style: `background:${c}` }), t))] : null,
        itFc.length ? [h('b', { class: 'leg-tit' }, 'Faces'), itFc.map(([t, c]) => h('div', null, h('span', { class: 'leg-fc', style: `background:${c}` }), t))] : null);
      leg.addTo(mapa); if (mapa._popup && mapa.hasLayer(mapa._popup)) leg.getContainer().classList.add('oculto');
    }
    mapa.on('popupopen', () => { if (leg) leg.getContainer().classList.add('oculto'); });
    mapa.on('popupclose', () => { if (leg) leg.getContainer().classList.remove('oculto'); });
    let tBusca = null;
    busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { desenhar(!!busca.value.trim()); pintarBuscaRes(); }, 250); });
    busca.addEventListener('focus', () => pintarBuscaRes());
    busca.addEventListener('blur', () => setTimeout(() => buscaRes.classList.add('oculto'), 250));
    // resultados agrupados: árvores pelo código, espécies, quadras pelo número e endereço
    function pintarBuscaRes() {
      const t = busca.value.trim(); const q = norm(t); if (q.length < 2) return buscaRes.classList.add('oculto');
      const arv = pts.filter((o) => norm(o.cod).includes(q)).slice(0, 5);
      const esp = {}; for (const o of pts) if (o.esp && norm(o.esp).includes(q)) esp[o.esp] = (esp[o.esp] || 0) + 1;
      const esps = Object.entries(esp).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const qds = qdDados && /^\d/.test(t) ? qdDados.quadras.filter((x) => String(x.n).startsWith(t)).slice(0, 3) : [];
      if (arv.length === 1 && norm(arv[0].cod) === q && !esps.length && !qds.length) return buscaRes.classList.add('oculto'); // código exato: a ficha já abre
      const it = (txt, sub, fn) => h('button', { class: 'br-it', role: 'option', onmousedown: (e) => e.preventDefault(), onclick: () => { buscaRes.classList.add('oculto'); fn(); } }, h('span', null, txt), sub ? h('small', null, sub) : null);
      const grupo = (tit, itens) => (itens.length ? [h('b', { class: 'br-tit' }, tit), itens] : null);
      buscaRes.replaceChildren(
        grupo('Árvores', arv.map((o) => it(o.cod || 'Sem código', o.esp, () => { busca.value = o.cod; desenhar(false); mapa.setView([o.lat, o.lon], 19); ficha(o); }))),
        grupo('Espécies', esps.map(([e, n]) => it(e, pl(n, 'árvore', 'árvores'), () => { busca.value = e; desenhar(true); }))),
        grupo('Quadras', qds.map((x) => it('Quadra ' + x.n, x.f ? pl(x.f.length, 'face', 'faces') : '', () => { busca.value = ''; desenhar(false); mapa.fitBounds(L.latLngBounds([x.b[1], x.b[0]], [x.b[3], x.b[2]]), { maxZoom: 18 }); setTimeout(() => clicarQuadra(x, L.latLng(Quadras.centro(x))), 400); }))),
        h('b', { class: 'br-tit' }, 'Endereço'), it(`Buscar o endereço "${t}"`, navigator.onLine ? 'no mapa da cidade' : 'precisa de internet', () => { const ev = new KeyboardEvent('keydown', { key: 'Enter' }); ev.forcar = true; busca.dispatchEvent(ev); }));
      buscaRes.classList.remove('oculto');
    }
    busca.setAttribute('enterkeyhint', 'search'); busca.placeholder = 'Código, espécie ou endereço';
    let marcaEnd = null;
    busca.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return; const q = busca.value.trim(); if (!q) return;
      if (!e.forcar && pts.some((o) => o.chave.includes(norm(q)))) return desenhar(true);
      if (!navigator.onLine) return toast('Sem internet para buscar endereço.');
      try {
        const r = await buscarEndereco(q); if (!r) return toast('Endereço não encontrado.');
        busca.value = ''; desenhar(false); mapa.setView([r.lat, r.lon], 18);
        if (marcaEnd) marcaEnd.remove(); marcaEnd = L.circleMarker([r.lat, r.lon], { renderer: render, radius: 10, color: '#fff', weight: 3, fillColor: '#C62828', fillOpacity: 1 }).addTo(mapa).bindPopup(r.nome).openPopup();
      } catch (er) { toast('Não foi possível buscar o endereço.'); }
    });
    [selEq, selRisco, selBairro, selCor].filter(Boolean).forEach((x) => x.addEventListener('change', () => { if (x === selRisco && selRisco.value) soAlto = false; pintarChips(); desenhar(x !== selCor); }));
    selDia.addEventListener('change', () => { diaIn.classList.toggle('oculto', selDia.value !== 'outro'); pintarChips(); desenhar(true); }); diaIn.addEventListener('change', () => desenhar(true));
    selQd.addEventListener('change', () => { S.qdModo = selQd.value; desenhar(false); });
    const preencherBairros = () => { const bs = [...new Set(pts.map((o) => o.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')); const at = selBairro.value; selBairro.replaceChildren(h('option', { value: '' }, 'Todos os bairros'), bs.map((b) => h('option', { value: b, selected: b === at }, b))); selBairro.classList.toggle('oculto', !bs.length); };
    const preencherEquipes = () => { preencherBairros(); const atual = selEq.value; selEq.replaceChildren(h('option', { value: '' }, 'Todas as equipes'), ...equipes.filter((e) => e !== '-').map((e) => h('option', { value: e, selected: e === atual }, e))); };
    const aplicarFiltroPainel = () => { if (!S.mapaFiltro) return; if (S.mapaFiltro.alto && cRisco) { soAlto = true; selCor.value = 'risco'; } if (S.mapaFiltro.equipe) selEq.value = S.mapaFiltro.equipe; const fd = S.mapaFiltro.dia || ''; if (/^\d{4}-\d{2}-\d{2}$/.test(fd)) { selDia.value = 'outro'; diaIn.value = fd; diaIn.classList.remove('oculto'); } else selDia.value = fd; };
    preencherEquipes(); aplicarFiltroPainel(); pintarChips(); desenhar(true); carregarQdMapa();
    if (!Api.demo) {
      conta.textContent = navigator.onLine ? 'Carregando pontos...' : ''; pintarConta();
      try {
        const campos = ['uuid', 'latitude', 'longitude', 'equipe', cc && cc.nome, ce && ce.nome, cRisco && cRisco.nome, cCat && cCat.nome, cFoto && cFoto.nome + ' link', 'bairro_aprox', 'criado_em', cArea && cArea.nome].map((x) => x || '');
        // abre com os pontos da última consulta e troca pelos do servidor quando chegarem
        const addLinhas = (ls) => { for (const l of ls) add({ uid: l[0], lat: l[1], lon: l[2], equipe: l[3], cod: l[4] || '', esp: l[5] || '', risco: l[6], cat: l[7], foto: l[8], bairro: l[9] || '', dia: l[10] ? diaLocal(l[10]) : '', rm: raioCopa(l[11]), local: false }); };
        const kc = 'mapapts:' + S.projeto.id + ':' + (S.sessao ? S.sessao.u : '');
        const antes = await Store.get(kc);
        if (antes && antes.campos === campos.join('|') && document.body.contains(div)) { addLinhas(antes.linhas); preencherEquipes(); aplicarFiltroPainel(); desenhar(true); conta.textContent += navigator.onLine ? ' · atualizando...' : ''; }
        // sem internet: fica com os pontos guardados no aparelho e avisa de quando são
        const usouGuardados = !!(antes && antes.campos === campos.join('|'));
        if (!navigator.onLine) { faixaOff.textContent = usouGuardados ? (antes.em ? `Sem internet. Pontos guardados no aparelho em ${dataAno(antes.em)}.` : 'Sem internet. Pontos guardados no aparelho.') : 'Sem internet. Só os seus cadastros deste aparelho aparecem.'; faixaOff.classList.remove('oculto'); throw Object.assign(new Error('sem internet'), { semRede: true }); } // sai só do bloco: o GPS do mapa continua ligando abaixo
        const m = await Api.b.mapa(S.projeto.id, campos);
        Store.set(kc, { campos: campos.join('|'), linhas: m.linhas, em: agoraISO() });
        if (!document.body.contains(div)) return;
        const usouAntes = antes && antes.campos === campos.join('|');
        if (usouAntes) for (let i = pts.length - 1; i >= 0; i--) if (!pts[i].local) { vistos.delete(pts[i].uid); pts.splice(i, 1); }
        addLinhas(m.linhas);
        preencherEquipes(); aplicarFiltroPainel(); S.mapaFiltro = null; desenhar(!usouAntes);
      } catch (e) { conta.textContent = conta.textContent.replace(/Carregando pontos\.\.\.| · atualizando\.\.\./g, ''); if (!document.body.contains(div)) return; if (!e.semRede) { desenhar(false); toast('Não foi possível atualizar os pontos agora. Ficam os guardados no aparelho.'); } else desenhar(false); }
    }
    function limitesCidade() { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const q of qdDados.quadras) b = [Math.min(b[0], q.b[0]), Math.min(b[1], q.b[1]), Math.max(b[2], q.b[2]), Math.max(b[3], q.b[3])]; return L.latLngBounds([b[1], b[0]], [b[3], b[2]]); }
    // enquadra a cidade do projeto: a camada de quadras ou, sem ela, todos os pontos
    function verCidade() {
      if (qdDados && qdDados.quadras.length) return mapa.fitBounds(limitesCidade(), { padding: [10, 10] });
      if (pts.length) return mapa.fitBounds(L.latLngBounds(pts.map((o) => [o.lat, o.lon])), { padding: [30, 30], maxZoom: 17 });
      toast('Este projeto ainda não tem quadras nem pontos no mapa.');
    }
    // minha posição: primeiro toque centraliza; o segundo passa a seguir (arrastar o mapa para de seguir)
    mapa.on('dragstart', () => { if (seguindo) { seguindo = false; btEu.classList.remove('ativo'); } });
    function centrar() {
      if (!S.pos) { ligarGps(); return toast('GPS ainda sem sinal.'); }
      const perto = mapa.getCenter().distanceTo([S.pos.lat, S.pos.lon]) < 15 && mapa.getZoom() >= 18;
      if (perto && !seguindo) { seguindo = true; btEu.classList.add('ativo'); toast('Seguindo a sua posição. Arraste o mapa para parar.', 2500); }
      mapa.setView([S.pos.lat, S.pos.lon], Math.max(18, mapa.getZoom()));
    }
    const ouv = (p) => {
      if (!p || !document.body.contains(div)) return;
      if (!euPrec) euPrec = L.circle([p.lat, p.lon], { renderer: render, interactive: false, radius: p.prec || 5, color: '#1E88E5', weight: 1, fillColor: '#1E88E5', fillOpacity: 0.12 }).addTo(mapa); else { euPrec.setLatLng([p.lat, p.lon]); euPrec.setRadius(p.prec || 5); }
      if (!eu) eu = L.circleMarker([p.lat, p.lon], { renderer: render, interactive: false, radius: 9, color: '#fff', weight: 3, fillColor: '#1E88E5', fillOpacity: 1 }).addTo(mapa); else eu.setLatLng([p.lat, p.lon]);
      if (seguindo) mapa.panTo([p.lat, p.lon], { animate: true });
    };
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
      h('main', { style: 'padding-bottom:0' }, h('div', { class: 'subabas' }, it('exportar', 'Exportar'), it('importar', 'Importar'), it('projetos', 'Projetos'), it('usuarios', 'Usuários'), it('pessoas', 'Pessoas'), it('setores', 'Setores'), it('formularios', 'Formulários'), it('seguranca', 'Segurança')),
        S.projeto ? h('div', { class: 'linha-btn', style: 'margin:8px 0 0' }, h('button', { class: 'btn sec peq', onclick: () => ir('#painel') }, 'Painel'), h('button', { class: 'btn sec peq', onclick: () => ir('#validacao') }, 'Validação'), h('button', { class: 'btn sec peq', onclick: () => ir('#mapa') }, 'Mapa')) : null), corpo].filter(Boolean));
    corpo.style.paddingTop = '0';
    // as listas das outras abas vêm em segundo plano: trocar de aba fica instantâneo
    if (!Api.demo && navigator.onLine) { Api.b.usuariosListar().catch(() => {}); Api.b.projetosListar().catch(() => {}); Api.b.formulariosListar().catch(() => {}); }
    try {
      if (sub === 'exportar') await adminExportar(corpo);
      else if (sub === 'projetos') await adminProjetos(corpo);
      else if (sub === 'usuarios') await adminUsuarios(corpo);
      else if (sub === 'pessoas') await adminPessoas(corpo);
      else if (sub === 'setores') await adminSetores(corpo);
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
      const num = (v, ph) => h('input', { class: 'entrada', inputmode: 'decimal', value: v || '', placeholder: ph });
      const fGps = num(p.face_gps, '10'), fDist = num(p.face_dist, '15'), fFolga = num(p.face_folga, '8');
      const ok = await modal(novo ? 'Novo projeto' : 'Editar projeto', h('div', null,
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Identificador (sem espaços)'), id), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), nome),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Formulário'), fo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Sistema de coordenadas da exportação'), ep),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prefixo das fotos'), pre, h('div', { class: 'dica' }, 'As fotos ficam como DCIM/prefixo_AAAAMMDDhhmmssmmm.jpg, igual ao QField.')),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Contratante'), contr), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nº do contrato'), ncon)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Município'), mun), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Meta de registros'), meta)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Responsável técnico (sai no relatório)'), rt),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Registro profissional'), reg), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'ART'), art)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'O cliente vê no portal'), cve),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Tipos de serviço das ordens de serviço'), tos),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Faces de quadra: começo automático pelo GPS'),
          h('div', { class: 'grade3' }, h('div', null, h('small', null, 'Erro máximo do GPS (m)'), fGps), h('div', null, h('small', null, 'Distância até a face (m)'), fDist), h('div', null, h('small', null, 'Folga para a 2ª face (m)'), fFolga)),
          h('div', { class: 'dica' }, 'Ao salvar uma árvore, a face da calçada passa a "em levantamento" sozinha só quando o erro do GPS é até o máximo, a face está mais perto que a distância e nenhuma outra face está a menos da folga. Em branco vale 10, 15 e 8.'))),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      const nOk = (x, a, b) => { const v = +String(x.value).replace(',', '.'); return x.value.trim() === '' ? '' : v >= a && v <= b ? String(v) : null; };
      if (!ok) return;
      const pid = Q2F.slug(id.value || nome.value); if (!pid || !nome.value.trim()) return toast('Preencha identificador e nome.');
      if (novo && projetos.some((x) => x.id === pid)) return toast('Já existe projeto com esse identificador.');
      const fg = nOk(fGps, 1, 50), fd = nOk(fDist, 1, 50), ff = nOk(fFolga, 0, 50);
      if (fg == null || fd == null || ff == null) return toast('Faces de quadra: use números entre 1 e 50 metros (folga de 0 a 50).', 5000);
      try { await Api.b.projetoSalvar(Object.assign({}, p, { id: pid, nome: nome.value.trim(), formulario: fo.value, epsg: ep.value, prefixo: Q2F.slug(pre.value || pid), contratante: contr.value.trim(), contrato: ncon.value.trim(), municipio: mun.value.trim(), meta: String(parseInt(meta.value, 10) || ''), cliente_ve: cve.value, face_gps: fg, face_dist: fd, face_folga: ff, responsavel: rt.value.trim(), registro_profissional: reg.value.trim(), art: art.value.trim(), tipos_os: tos.value.split('\n').map((x) => x.trim()).filter(Boolean).join('; ') })); toast('Projeto salvo.'); await recarregarSessao(); telaAdmin('projetos'); } catch (e) { toast(e.message, 5000); }
    }
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Projetos'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Projeto'), h('th', null, 'Formulário'), h('th', null, 'Camada de quadras'), h('th', null, '')),
        projetos.map((p) => h('tr', null, h('td', null, h('b', null, p.nome), h('br'), h('small', null, [p.id, p.municipio, p.meta ? 'meta ' + fmtN(+p.meta) : ''].filter(Boolean).join(' · '))), h('td', null, (forms.find((f) => f.id === p.formulario) || {}).nome || p.formulario),
          h('td', null, p.camada ? [h('span', null, `${fmtN(p.camada.total)} quadras` + (p.camada.faces ? ` e ${fmtN(p.camada.faces)} faces` : '')), h('br'), h('small', { class: 'dica' }, 'carregada em ' + dataAno(p.camada.em))] : h('small', { class: 'dica' }, 'nenhuma')),
          h('td', null, h('button', { class: 'btn sec peq', onclick: () => editar(p) }, 'Editar'), Api.demo ? null : h('button', { class: 'btn sec peq', style: 'margin-left:6px', onclick: () => importarQuadrasTela(p) }, 'Quadras'))))),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => editar(null) }, '+ Novo projeto'),
      h('p', { class: 'dica' }, Api.demo ? '' : 'Cada projeto novo ganha uma pasta no Drive com a planilha e a subpasta DCIM das fotos.')));
  }

  async function adminUsuarios(corpo) {
    const [us, projetos] = await Promise.all([Api.b.usuariosListar(), Api.b.projetosListar()]);
    const PERFIS = [['coletor', 'Equipe de campo (coleta)'], ['revisor', 'Revisão técnica (valida registros)'], ['cliente', 'Cliente (consulta painel, mapa e relatório)'], ['admin', 'Coordenação (acesso total)']];
    // código sugerido: o próximo E<n> livre no projeto
    const proxCodigo = (proj) => { const usados = new Set(us.filter((x) => String(x.projeto).split(',').some((pp) => String(proj).split(',').includes(pp))).map((x) => String(x.codigo || '').toUpperCase())); let n = 1; while (usados.has('E' + n)) n++; return 'E' + n; };
    async function editar(u, novoF, senhaF) {
      const novo = novoF != null ? novoF : !u; u = u || { login: '', nome: '', perfil: 'coletor', projeto: S.projeto ? S.projeto.id : '', equipe: '', ativo: 'sim' };
      const lo = h('input', { class: 'entrada', value: u.login, disabled: !novo, autocapitalize: 'none', placeholder: 'ex.: div-1' });
      const no = h('input', { class: 'entrada', value: u.nome || '', placeholder: 'ex.: Equipe 1' });
      const se = h('input', { class: 'entrada', type: 'text', autocomplete: 'new-password', value: senhaF || '', placeholder: novo ? 'mínimo 8 caracteres' : 'deixe em branco para manter' });
      const eq = h('input', { class: 'entrada', value: u.equipe || '', placeholder: 'ex.: Equipe 1', oninput: () => { eqMexida = true; } });
      const cod = h('input', { class: 'entrada', value: u.codigo || (novo ? proxCodigo(u.projeto) : ''), autocapitalize: 'characters', placeholder: 'ex.: E1' });
      // a equipe acompanha o nome enquanto não for escrita à mão
      let eqMexida = !!u.equipe; no.addEventListener('input', () => { if (!eqMexida) eq.value = no.value; });
      const em = h('input', { class: 'entrada', type: 'email', value: u.email || '', placeholder: 'opcional' });
      const pe = h('select', { class: 'entrada' }, PERFIS.map(([v, t]) => h('option', { value: v, selected: (u.perfil === 'campo' ? 'coletor' : u.perfil) === v }, t)));
      const at = h('input', { type: 'checkbox', checked: String(u.ativo || 'sim').toLowerCase() !== 'nao' });
      const mc = h('select', { class: 'entrada' }, h('option', { value: 'raios', selected: (u.modo_copa || 'raios') === 'raios' }, '4 raios com trena (o app calcula a área)'), h('option', { value: 'area', selected: u.modo_copa === 'area' }, 'Área direto, com trena a laser'));
      const tj = h('input', { type: 'checkbox', checked: u.trajeto === 'sim' });
      const marcados = new Set(String(u.projeto || '').split(',').map((x) => x.trim()));
      const prj = h('div', { class: 'chips' }, projetos.map((p) => { const b = h('button', { class: 'chip' + (marcados.has(p.id) ? ' sel' : ''), onclick: () => { b.classList.toggle('sel'); if (marcados.has(p.id)) marcados.delete(p.id); else marcados.add(p.id); } }, p.nome); return b; }));
      const ok = await modal(novo ? 'Novo usuário' : 'Editar usuário', h('div', null,
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Usuário'), lo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, novo ? 'Senha' : 'Nova senha'), se)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Perfil'), pe),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), no), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe'), eq)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Código da equipe'), cod), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Email'), em)),
        h('div', { class: 'dica' }, 'O código da equipe vira o prefixo dos códigos das árvores (E1 gera E1-0001, E1-0002...). Use um diferente para cada equipe.'),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Como mede a copa'), mc),
        h('label', { class: 'campo' }, tj, ' Registrar o trajeto do turno (a equipe liga em "Começar turno", só com o app aberto)'),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projetos liberados'), prj), h('label', null, at, ' Usuário ativo')),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const login = lo.value.trim().toLowerCase();
      const digitado = () => ({ login: lo.value.trim().toLowerCase(), nome: no.value, perfil: pe.value, projeto: [...marcados].filter(Boolean).join(','), equipe: eq.value, codigo: cod.value, email: em.value, ativo: at.checked ? 'sim' : 'nao', modo_copa: mc.value, trajeto: tj.checked ? 'sim' : '' });
      const erro = (m) => { toast(m, 5000, null, true); return editar(digitado(), novo, se.value); }; // o formulário volta com o que foi digitado
      if (!login) return erro('Preencha o usuário.');
      if (se.value.trim() && se.value.trim().length < 8 && !Api.demo) return erro('A senha precisa ter pelo menos 8 caracteres.');
      if (novo && !se.value.trim()) return erro('Defina a senha.');
      if (novo && us.some((x) => x.login === login)) return erro('Esse usuário já existe.');
      const dados = { login, nome: no.value.trim() || login, perfil: pe.value, projeto: pe.value === 'admin' ? '*' : [...marcados].filter(Boolean).join(','), equipe: eq.value.trim(), codigo: cod.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), email: em.value.trim(), ativo: at.checked ? 'sim' : 'nao', modo_copa: mc.value, trajeto: tj.checked ? 'sim' : '' };
      if (se.value.trim()) dados.senha = se.value.trim();
      if (pe.value === 'coletor' && !dados.codigo) return erro('Defina o código da equipe (ex.: E1).');
      if (pe.value === 'coletor' && us.some((x) => x.login !== login && x.codigo === dados.codigo && String(x.projeto).split(',').some((p) => dados.projeto.split(',').includes(p)))) return erro('Outra equipe deste projeto já usa o código ' + dados.codigo + '.');
      try { await Api.b.usuarioSalvar(dados); toast('Usuário salvo.'); telaAdmin('usuarios'); } catch (e) { erro(e.message); }
    }
    async function remover(u) { if (u.login === S.sessao.u) return toast('Você não pode remover o próprio usuário.'); if (await confirmar('Remover', `Remover o usuário ${u.login}? Os registros feitos por ele continuam na planilha.`, 'Remover', 'perigo')) { try { await Api.b.usuarioRemover(u.login); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); } } }
    async function desbloquear(u) { try { await Api.b.usuarioDesbloquear(u.login); toast('Usuário desbloqueado.'); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); } }
    const nomeP = (ids) => ids === '*' ? 'Todos' : String(ids || '').split(',').map((i) => (projetos.find((p) => p.id === i.trim()) || {}).nome || i).join(', ');
    const rotP = (p) => (PERFIS.find((x) => x[0] === (p === 'campo' ? 'coletor' : p)) || [p, p])[1].replace(/\s*\(.*\)/, '');
    async function alternarAtivo(u) { const at = String(u.ativo).toLowerCase() !== 'nao'; if (u.login === S.sessao.u && at) return toast('Você não pode desativar o próprio usuário.'); try { await Api.b.usuarioSalvar({ login: u.login, ativo: at ? 'nao' : 'sim' }); toast(at ? 'Usuário desativado.' : 'Usuário reativado.'); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); } }
    // várias equipes de uma vez, com a folha de acessos para entregar às duplas
    async function criarSerie() {
      const proj = S.projeto ? S.projeto.id : (projetos[0] || {}).id || '';
      const nIn = h('input', { class: 'entrada', type: 'number', min: 1, max: 30, value: 3 });
      const prefIn = h('input', { class: 'entrada', value: (proj || 'eq').slice(0, 3) + '-', autocapitalize: 'none' });
      const codUsado = (cod, pj) => us.some((x) => String(x.codigo).toUpperCase() === cod && String(x.projeto).split(',').includes(pj));
      const iniDe = (pj) => { let n = 1; while (codUsado('E' + n, pj)) n++; return n; };
      const iniIn = h('input', { class: 'entrada', type: 'number', min: 1, value: iniDe(proj) });
      const selP = h('select', { class: 'entrada', onchange: () => { iniIn.value = iniDe(selP.value); } }, projetos.map((p) => h('option', { value: p.id, selected: p.id === proj }, p.nome)));
      const ok = await modal('Criar equipes em série', h('div', null, h('p', { class: 'dica' }, 'Cria as equipes de campo com usuário, senha, nome "Equipe N" e código "EN". No fim aparece a folha de acessos para imprimir ou copiar.'),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Quantas equipes'), nIn), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Começar pela equipe número'), iniIn)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Início do usuário'), prefIn), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), selP))),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Criar', valor: true }]);
      if (!ok) return;
      const n = Math.max(1, Math.min(30, +nIn.value || 0)), ini = Math.max(1, +iniIn.value || 1), pref = prefIn.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const senha = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let x = ''; const r = crypto.getRandomValues(new Uint8Array(10)); for (const b of r) x += a[b % a.length]; return x; };
      const feitos = []; const erros = [];
      for (let k = 0; k < n; k++) {
        const num = ini + k; const login = pref + num; if (us.some((x) => x.login === login)) { erros.push(`${login}: já existe`); continue; }
        if (codUsado('E' + num, selP.value)) { erros.push(`${login}: o código E${num} já é de outra equipe deste projeto`); continue; }
        const d = { login, senha: senha(), nome: 'Equipe ' + num, equipe: 'Equipe ' + num, codigo: 'E' + num, perfil: 'coletor', projeto: selP.value, ativo: 'sim', modo_copa: 'raios' };
        try { await Api.b.usuarioSalvar(d); feitos.push(d); } catch (e) { erros.push(`${login}: ${e.message}`); }
      }
      const linhasT = feitos.map((d) => `${d.equipe}\t${d.codigo}\tusuário: ${d.login}\tsenha: ${d.senha}`).join('\n');
      await modal('Folha de acessos', h('div', { class: 'folha-acessos' }, h('p', { class: 'dica' }, 'Guarde ou imprima agora: as senhas não aparecem de novo (ficam guardadas de forma criptografada).'),
        h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Equipe'), h('th', null, 'Código'), h('th', null, 'Usuário'), h('th', null, 'Senha')), feitos.map((d) => h('tr', null, h('td', null, d.equipe), h('td', null, d.codigo), h('td', null, d.login), h('td', null, h('code', null, d.senha))))),
        erros.length ? h('div', { class: 'aviso' }, 'Não criados: ' + erros.join('; ')) : null,
        h('div', { class: 'linha-btn' }, h('button', { class: 'btn sec', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(linhasT).then(() => toast('Copiado.'), () => toast('Não foi possível copiar.')); } }, 'Copiar'), h('button', { class: 'btn sec', onclick: () => baixar('acessos-equipes.txt', linhasT.replace(/\t/g, '  '), 'text/plain') }, 'Baixar'))),
        [{ texto: 'Fechar', valor: true }]);
      telaAdmin('usuarios');
    }
    const quando = (x) => (x ? dataAno(x) : 'nunca');
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Equipes e usuários'),
      h('div', { class: 'linha-btn', style: 'margin-bottom:10px' }, h('button', { class: 'btn', onclick: () => editar(null) }, '+ Novo usuário'), h('button', { class: 'btn sec', onclick: criarSerie }, 'Criar equipes em série')),
      h('div', { class: 'us-lista' }, us.map((u) => { const inativo = String(u.ativo).toLowerCase() === 'nao';
        return h('div', { class: 'us-card' + (inativo ? ' inativo' : '') },
          h('div', { class: 'us-cab' }, h('b', null, u.login), u.codigo ? h('span', { class: 'selo' }, u.codigo) : null, u.bloqueado ? h('span', { class: 'tag-alerta' }, 'bloqueado') : null, inativo ? h('span', { class: 'tag-cinza' }, 'desativado') : null),
          h('small', null, `${u.nome || ''} · ${rotP(u.perfil)}`), h('small', null, nomeP(u.projeto)),
          h('small', { class: 'dica' }, `Último acesso: ${quando(u.ultimo_acesso)}`), u.senha_antiga ? h('small', { class: 'dica' }, 'senha ainda no formato antigo: é convertida no próximo acesso') : null,
          h('div', { class: 'linha-btn' }, u.bloqueado ? h('button', { class: 'btn peq', onclick: () => desbloquear(u) }, 'Desbloquear') : null, h('button', { class: 'btn sec peq', onclick: () => editar(u) }, 'Editar'), h('button', { class: 'btn sec peq', onclick: () => alternarAtivo(u) }, inativo ? 'Reativar' : 'Desativar'),
            h('details', { class: 'us-mais' }, h('summary', { 'aria-label': 'Mais ações' }, '···'), h('button', { class: 'link-perigo', onclick: () => remover(u) }, 'Excluir usuário'))));
      })),
      h('p', { class: 'dica' }, 'Equipe de campo coleta; revisão técnica valida ou devolve registros; cliente só consulta painel, mapa e relatório dos dados validados; coordenação faz tudo. Prefira desativar a excluir: o histórico continua ligado ao usuário. Senhas ficam guardadas de forma criptografada e o usuário é bloqueado por 15 minutos após 5 senhas erradas.')));
  }

  // pessoas das equipes: avaliadores habilitados e auxiliares, com o vínculo (CLT ou parceiro). Sem dados de pagamento.
  async function adminPessoas(corpo) {
    const [ps, us, projetos] = await Promise.all([Api.b.pessoasListar(), Api.b.usuariosListar(), Api.b.projetosListar()]);
    const equipes = [...new Set(us.filter((u) => u.perfil === 'coletor' && u.equipe).map((u) => u.equipe))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
    async function editar(pe, dig) {
      const novo = !pe; pe = Object.assign({ nome: '', funcao: 'Auxiliar', registro: '', vinculo: 'CLT', empresa: '', equipe: '', projeto: S.projeto ? S.projeto.id : '', ativo: 'sim' }, pe || {}, dig || {});
      const no = h('input', { class: 'entrada', value: pe.nome, placeholder: 'Nome completo' });
      const fu = h('select', { class: 'entrada' }, ['Avaliador', 'Auxiliar'].map((v) => h('option', { value: v, selected: pe.funcao === v }, v === 'Avaliador' ? 'Avaliador habilitado' : 'Auxiliar')));
      const rg = h('input', { class: 'entrada', value: pe.registro, placeholder: 'ex.: CRBio 12345/04-D, CREA-MG 123456' });
      const vi = h('select', { class: 'entrada' }, [['CLT', 'CLT'], ['Parceiro', 'Parceiro (pessoa física, MEI ou empresa)']].map(([v, t]) => h('option', { value: v, selected: pe.vinculo === v }, t)));
      const em = h('input', { class: 'entrada', value: pe.empresa, placeholder: 'ex.: MEI, ou nome da empresa júnior' });
      const eq = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Sem equipe fixa'), equipes.map((e) => h('option', { value: e, selected: pe.equipe === e }, e)));
      const marcados = new Set(String(pe.projeto || '').split(',').map((x) => x.trim()).filter(Boolean));
      const prj = h('div', { class: 'chips' }, projetos.map((p) => { const b = h('button', { class: 'chip' + (marcados.has(p.id) ? ' sel' : ''), type: 'button', onclick: () => { b.classList.toggle('sel'); if (marcados.has(p.id)) marcados.delete(p.id); else marcados.add(p.id); } }, p.nome); return b; }));
      const cReg = h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Formação e registro profissional'), rg); const cEmp = h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Parceiro como'), em);
      const ver = () => { cReg.classList.toggle('oculto', fu.value !== 'Avaliador'); cEmp.classList.toggle('oculto', vi.value !== 'Parceiro'); }; fu.onchange = ver; vi.onchange = ver; ver();
      const ok = await modal(novo ? 'Nova pessoa' : 'Editar pessoa', h('div', null,
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), no),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Função'), fu), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Vínculo'), vi)),
        cReg, cEmp, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe de costume'), eq, h('div', { class: 'dica' }, 'Aparece primeiro na escolha da dupla. A dupla do dia é escolhida no celular e pode misturar vínculos.')),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projetos'), prj)),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const d = { id: pe.id, nome: no.value.trim(), funcao: fu.value, registro: fu.value === 'Avaliador' ? rg.value.trim() : '', vinculo: vi.value, empresa: vi.value === 'Parceiro' ? em.value.trim() : '', equipe: eq.value, projeto: [...marcados].join(','), ativo: pe.ativo || 'sim' };
      const erro = (m) => { toast(m, 5000, null, true); return editar(novo ? null : pe, d); };
      if (!d.nome) return erro('Informe o nome.');
      if (d.funcao === 'Avaliador' && !d.registro) return erro('Avaliador precisa do registro profissional (ex.: CRBio 12345/04-D, CREA-MG 123456).');
      try { await Api.b.pessoaSalvar(d); toast('Pessoa salva.'); telaAdmin('pessoas'); } catch (e) { erro(e.message); }
    }
    async function alternar(pe) { try { await Api.b.pessoaSalvar(Object.assign({}, pe, { ativo: pe.ativo === 'não' ? 'sim' : 'não' })); telaAdmin('pessoas'); } catch (e) { toast(e.message, 5000); } }
    const nomeP = (ids) => String(ids || '').split(',').filter(Boolean).map((i) => (projetos.find((p) => p.id === i.trim()) || {}).nome || i).join(', ') || 'Todos os projetos';
    const card = (pe) => { const inat = pe.ativo === 'não'; return h('div', { class: 'us-card' + (inat ? ' inativo' : '') },
      h('div', { class: 'us-cab' }, h('b', null, pe.nome), h('span', { class: 'selo' + (pe.vinculo === 'Parceiro' ? ' selo-parceiro' : '') }, pe.vinculo), inat ? h('span', { class: 'tag-cinza' }, 'desativada') : null),
      h('small', null, [pe.funcao === 'Avaliador' ? pe.registro : 'Auxiliar', pe.vinculo === 'Parceiro' && pe.empresa ? pe.empresa : '', pe.equipe].filter(Boolean).join(' · ')), h('small', null, nomeP(pe.projeto)),
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn sec peq', onclick: () => editar(pe) }, 'Editar'), h('button', { class: 'btn sec peq', onclick: () => alternar(pe) }, inat ? 'Reativar' : 'Desativar'))); };
    const grupo = (t, f) => { const l = ps.filter((x) => x.funcao === f).sort((a, b) => (a.ativo === 'não') - (b.ativo === 'não') || a.nome.localeCompare(b.nome, 'pt')); return h('div', null, h('h4', null, `${t} (${l.filter((x) => x.ativo !== 'não').length})`), l.length ? h('div', { class: 'us-lista' }, l.map(card)) : h('p', { class: 'dica' }, 'Ninguém cadastrado.')); };
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Pessoas das equipes'),
      h('p', { class: 'dica' }, 'O acesso continua por dupla. No primeiro cadastro do dia o celular pergunta quem está na dupla: sem avaliador habilitado a coleta não é liberada, e cada árvore guarda quem avaliou e quem auxiliou. Duplas com parceiro não têm trajeto nem horário do dia registrados, só o tempo de cada cadastro. Sem pessoas cadastradas o app funciona como antes.'),
      h('button', { class: 'btn', style: 'margin-bottom:10px', onclick: () => editar(null) }, '+ Nova pessoa'),
      grupo('Avaliadores habilitados', 'Avaliador'), grupo('Auxiliares', 'Auxiliar')));
  }
  // setores censitários: importar a camada do IBGE e dizer qual equipe coleta cada setor
  async function adminSetores(corpo) {
    if (!S.projeto) return corpo.replaceChildren(h('div', { class: 'info' }, 'Abra um projeto primeiro.'));
    const p = S.projeto; corpo.replaceChildren(h('div', { class: 'info' }, 'Carregando os setores...'));
    S.stEm = null; const [cam, sit, us] = await Promise.all([Setores.camada(), Setores.situacao(true), Api.b.usuariosListar()]);
    const equipes = [...new Set(us.filter((u) => u.perfil === 'coletor' && u.equipe && String(u.projeto).split(',').includes(p.id)).map((u) => u.equipe))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
    const btImp = h('button', { class: cam ? 'btn sec' : 'btn', onclick: () => importarSetoresTela(p) }, cam ? 'Importar de novo' : 'Importar camada de setores');
    if (!cam) return corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Setores censitários'), h('p', { class: 'dica' }, 'Importe a malha de setores censitários do IBGE (shapefile .zip, GeoPackage, KML ou GeoJSON) recortada para o município. Depois escolha a equipe de cada setor: a equipe é avisada quando marca um ponto fora dos setores dela, e cada árvore guarda o setor (base da auditoria por setor).'), btImp));
    const por = new Map(sit.map((x) => [x.numero, x])); const sel = new Set();
    const busca = h('input', { class: 'entrada', placeholder: 'Buscar setor ou equipe', oninput: () => pintar() });
    const eqSel = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Sem equipe'), equipes.map((e) => h('option', { value: e }, e)));
    const lista = h('div', { class: 'tab-rolagem' }); const nSel = h('span');
    const pintar = () => {
      const q = norm(busca.value.trim()); const ls = cam.setores.filter((x) => !q || norm(x.n + ' ' + ((por.get(x.n) || {}).equipe || '')).includes(q)).slice(0, 600);
      lista.replaceChildren(h('table', { class: 'tab' }, h('tr', null, h('th', null, ''), h('th', null, 'Setor'), h('th', null, 'Equipe'), h('th', null, 'Situação')),
        ls.map((x) => { const st = por.get(x.n) || {}; const cb = h('input', { type: 'checkbox', checked: sel.has(x.n), onchange: () => { if (cb.checked) sel.add(x.n); else sel.delete(x.n); nSel.textContent = sel.size ? `${sel.size} selecionado(s)` : ''; } });
          return h('tr', null, h('td', null, cb), h('td', null, x.n), h('td', null, st.equipe || h('small', { class: 'dica' }, 'sem equipe')), h('td', null, st.situacao || 'Em coleta')); })));
    };
    async function atribuir() {
      if (!sel.size) return toast('Marque os setores na lista.');
      try { const r = await Api.b.setoresAtribuir(p.id, [...sel].map((n) => ({ numero: n, equipe: eqSel.value }))); toast(`${r.alterados} setor(es) atualizados.`); S.stSitEm = null; telaAdmin('setores'); } catch (e) { toast(e.message, 5000); }
    }
    const tot = cam.setores.length; const comEq = cam.setores.filter((x) => (por.get(x.n) || {}).equipe).length;
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Setores censitários'),
      h('p', null, `${fmtN(tot)} setores na camada · ${fmtN(comEq)} com equipe`),
      h('div', { class: 'grade2' }, busca, h('div', { class: 'linha-btn', style: 'margin:0' }, eqSel, h('button', { class: 'btn', onclick: atribuir }, 'Atribuir'))), nSel,
      lista, h('div', { class: 'linha-btn' }, btImp), h('p', { class: 'dica' }, 'Equipe vazia libera o setor. A equipe só é avisada (não bloqueada) quando marca um ponto fora dos setores dela, porque o GPS pode errar perto da divisa.')));
    pintar();
  }
  async function importarSetoresTela(p) {
    const arq = h('input', { type: 'file', accept: '.zip,.gpkg,.kml,.geojson,.json', class: 'entrada' });
    const info = h('div'); const selN = h('select', { class: 'entrada' }); let lido = null;
    arq.addEventListener('change', async () => {
      const f = arq.files && arq.files[0]; if (!f) return; lido = null; info.replaceChildren(h('div', { class: 'info' }, 'Lendo o arquivo...'));
      try {
        lido = await Quadras.lerArquivo(f.name, await f.arrayBuffer()); const sug = lido.campos.find((c) => /^cd_?setor$|^cd_?geocodi$/i.test(c)) || lido.campos.find((c) => /setor|geocod/i.test(c)) || lido.campos[0];
        selN.replaceChildren(lido.campos.map((c) => h('option', { value: c, selected: c === sug }, `${c} (ex.: ${String(lido.feicoes[0].props[c] ?? '').slice(0, 30)})`)));
        info.replaceChildren(h('div', { class: 'info' }, `${fmtN(lido.feicoes.length)} polígonos encontrados.` + (lido.semPrj ? ' O arquivo não tem .prj: as coordenadas foram lidas como graus.' : '')));
      } catch (e) { info.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    });
    const ok = await modal('Setores censitários: ' + p.nome, h('div', null, h('p', { class: 'dica' }, 'Malha de setores do IBGE recortada para o município, em SIRGAS 2000. Importar de novo substitui a camada; as equipes dos setores com o mesmo código continuam valendo.'),
      arq, info, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Campo com o código do setor'), selN)), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Importar', valor: true }]);
    if (!ok) return; if (!lido) return toast('Escolha um arquivo válido.');
    const cam = Quadras.compactar(lido.feicoes, selN.value, []);
    try { toast('Enviando a camada...', 4000); const r = await Api.b.setoresImportar(p.id, JSON.stringify({ campo: cam.campo, total: cam.total, setores: cam.quadras.map((q) => ({ n: q.n, b: q.b, a: q.a })) })); S.stEm = null; S.stIdx = null; toast(`Camada importada: ${fmtN(r.total)} setores.`, 5000); if (/#admin\/setores/.test(location.hash)) telaAdmin('setores'); } catch (e) { toast(e.message, 6000); }
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
      try { for (const arq of ['divinopolis-inventario', 'seade-risco']) { const f = await (await fetch(`forms/${arq}.json`)).json(); const q = await fetch(`forms/${arq}.qml`).then((r) => (r.ok ? r.text() : null)).catch(() => null); await Api.b.formularioSalvar(f, q); } toast('Formulários instalados.'); if (S.form) S.form = await carregarForm(S.form.id, false, true); telaAdmin('formularios'); } catch (e) { toast(e.message, 5000); }
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
      try { await Api.b.formularioSalvar(f, R.qml); toast('Formulário salvo.'); S.revisao = null; if (S.form && S.form.id === f.id) S.form = await carregarForm(f.id, false, true); ir('#admin/formularios'); } catch (e) { toast(e.message, 5000); }
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
        else linhas.push(h('div', { class: 'fl', 'data-campo': c.nome }, h('span', null, c.rotulo), c.tipo === 'species' ? h('i', null, t) : h('b', null, t)));
      }
      if (marc.length) linhas.push(h('div', { class: 'fl col' }, h('span', null, 'Marcados'), h('div', { class: 'chips-leitura' }, marc.map((m) => h('span', { class: 'chip-leit' }, m)))));
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
        h('div', { style: 'height:84px' })), h('footer', { class: 'rodape' }, h('button', { class: 'btn sec', style: 'flex:1', onclick: () => ir('#inicio') }, 'Voltar'), pe.ok ? h('button', { class: 'btn', style: 'flex:2', onclick: editar }, 'Editar registro') : null));
  }

  // ---------- Termo de uso e privacidade ----------
  // por perfil (equipe de campo e coordenação x cliente), curto, por perguntas, com o texto completo a um toque.
  // Quando TERMO_VERSAO muda, todos aceitam de novo antes de continuar.
  function textoTermo(pf, completo) {
    pf = pf || perfil(); const cliente = pf === 'cliente';
    const contato = 'à coordenação do projeto' + (CONTATO.email ? ' ou pelo email ' + CONTATO.email : '') + (CONTATO.telefone ? ' ou pelo telefone ' + CONTATO.telefone : '');
    const P = (q, r) => h('div', { class: 'termo-q' }, h('h4', null, q), h('p', null, r));
    const curto = cliente ? [
      P('O que é este app?', 'O sistema da Neofloresta para acompanhar o inventário da arborização urbana do seu município: painel, mapa, relatórios, pedidos de serviço e download dos dados validados.'),
      P('Quais dados meus o app usa?', 'Seu usuário, nome e as ações que você faz no sistema (entrar, baixar dados, pedir serviço), para segurança e registro.'),
      P('De quem são os dados do inventário?', 'Do contratante. A Neofloresta faz o levantamento, confere cada registro e entrega os dados e as fotos no fim do contrato.'),
      P('Os dados estão protegidos?', 'Sim. Conexão criptografada, senha guardada de forma criptografada, bloqueio depois de senhas erradas e cópia de segurança diária.'),
      P('Como peço acesso, correção ou exclusão?', 'Fale ' + contato + '.'),
    ] : [
      P('O que é este app?', 'O app da Neofloresta para registrar o inventário da arborização urbana nos projetos contratados.'),
      P('Quais dados meus o app usa?', 'Usuário, nome e equipe; data, hora e posição do celular quando você marca um ponto; o modelo do aparelho. Não usamos contatos, galeria pessoal nem arquivos do celular.'),
      P('O app acompanha onde eu estou?', 'Só durante o trabalho e só com o app aberto: a posição na hora de marcar cada árvore e, quando a coordenação liga o trajeto do turno, o caminho da equipe até você tocar em "Encerrar turno". Fora disso, nada.'),
      P('Para que servem esses dados?', 'Saber quem fez cada registro, conferir a qualidade e a localização das árvores, acompanhar o andamento do campo e cumprir o contrato com o cliente.'),
      P('Quem vê?', 'A coordenação da Neofloresta. O cliente recebe os dados das árvores, sem os dados das equipes.'),
      P('E as fotos?', 'Fotografe a árvore e o entorno. Evite pessoas, placas de veículos e o interior das casas; se aparecerem, a foto é usada só como registro técnico.'),
      P('Os dados estão protegidos?', 'Sim. Conexão criptografada, senha guardada de forma criptografada, bloqueio depois de senhas erradas e cópia de segurança diária.'),
      P('Como peço acesso, correção ou exclusão?', 'Fale ' + contato + '.'),
      P('Combinado de uso', 'Usuário e senha são pessoais: não compartilhe. Registre só o que observou em campo.'),
    ];
    const longo = h('div', { class: 'termo-longo' },
      h('p', null, 'Este sistema é da Neofloresta Serviços Ecossistêmicos Ltda.' + (CONTATO.cnpj ? ' (CNPJ ' + CONTATO.cnpj + ')' : '') + ' e é usado para o inventário da arborização urbana nos projetos contratados pelo poder público ou por empresas.'),
      h('h4', null, 'Dados pessoais'),
      h('p', null, cliente ? 'Tratamos o usuário, o nome, o email informado pelo contratante e o registro das ações no sistema (auditoria).' : 'Tratamos o usuário, o nome e a equipe de quem usa o app; data, hora e posição do aparelho no momento de cada registro; o trajeto da equipe durante o turno, quando ligado pela coordenação, sempre com aviso na tela e só com o app aberto; e o modelo do aparelho. Não coletamos contatos, arquivos pessoais nem a localização fora do trabalho de campo.'),
      h('h4', null, 'Finalidade e base legal'),
      h('p', null, 'Identificar quem fez cada registro, garantir a qualidade e a rastreabilidade do inventário (histórico de alterações e auditoria), acompanhar o andamento e a segurança do trabalho de campo e cumprir o contrato. O tratamento se apoia na execução do contrato e no legítimo interesse, nos termos da Lei Geral de Proteção de Dados Pessoais.'),
      h('h4', null, 'Guarda e compartilhamento'),
      h('p', null, 'Os dados ficam em ambiente seguro, com acesso restrito à coordenação da Neofloresta, e no próprio aparelho até o envio. São guardados durante o contrato e pelo prazo exigido para prestação de contas. O contratante recebe os dados e as fotos do inventário, sem os dados internos das equipes. Os dados não são vendidos nem usados para publicidade.'),
      h('h4', null, 'Dados do inventário'),
      h('p', null, 'Os dados das árvores e as fotos pertencem ao contratante. Ao fim do contrato, são entregues a ele, e as cópias da Neofloresta são descartadas no prazo combinado em contrato.'),
      h('h4', null, 'Segurança'),
      h('p', null, 'Conexão criptografada (HTTPS), senha guardada de forma criptografada, bloqueio após senhas erradas, sessão com prazo de validade e cópia de segurança diária.'),
      h('h4', null, 'Direitos'),
      h('p', null, 'Você pode pedir confirmação, acesso, correção, anonimização ou exclusão dos seus dados pessoais ' + contato + '.' + (CONTATO.encarregado ? ' Encarregado pelo tratamento de dados: ' + CONTATO.encarregado + '.' : '')),
      h('h4', null, 'Mudanças'),
      h('p', null, 'Quando este termo mudar, o app mostra o novo texto e pede um novo aceite antes de continuar.'));
    if (completo) return h('div', { class: 'termo' }, curto, longo, h('p', { class: 'dica' }, 'Versão do termo: ' + TERMO_VERSAO));
    return h('div', { class: 'termo' }, curto, h('details', { class: 'termo-completo' }, h('summary', null, 'Ver o texto completo'), longo), h('p', { class: 'dica' }, 'Versão do termo: ' + TERMO_VERSAO));
  }
  const termoEmDia = () => { const u = S.sessao && S.sessao.usuario; return !!(u && u.termo_aceito_em && (u.termo_versao === TERMO_VERSAO || (u.termo_versao === undefined && S.termoLocal === TERMO_VERSAO))); };
  function verTermo() { modal('Termo de uso e privacidade', h('div', null, h('p', { class: 'dica' }, 'Equipe de campo e coordenação:'), textoTermo('coletor'), h('p', { class: 'dica', style: 'margin-top:14px' }, 'Clientes (prefeitura ou empresa contratante):'), textoTermo('cliente')), [{ texto: 'Fechar', valor: true }]); }
  function telaTermo() {
    const mudou = !!(S.sessao && S.sessao.usuario.termo_aceito_em);
    const btn = h('button', { class: 'btn cheio', onclick: async () => {
      btn.disabled = true;
      try { await Api.b.aceitarTermo(TERMO_VERSAO).catch(async (e) => { if (/desconhecida/i.test(e.message)) return; if (!navigator.onLine || e.rede || /fetch|network|rede|Failed|Sem conex/i.test(e.message)) { await Store.set('termoPend:' + S.sessao.u, TERMO_VERSAO); return; } throw e; }); Object.assign(S.sessao.usuario, { termo_aceito_em: agoraISO(), termo_versao: TERMO_VERSAO }); S.termoLocal = TERMO_VERSAO; await Store.set('sessao', S.sessao); await Store.set('termo:' + S.sessao.u, S.sessao.usuario.termo_aceito_em); await Store.set('termoV:' + S.sessao.u, TERMO_VERSAO); rota(); if (perfil() !== 'cliente') ligarGps(); } catch (e) { toast(e.message, 5000); btn.disabled = false; }
    } }, 'Li e aceito');
    $app.replaceChildren(topo('Termo de uso e privacidade', mudou ? 'O termo mudou: leia e aceite de novo' : 'Leia antes de começar', null, null), h('main', null,
      mudou ? h('div', { class: 'info' }, 'Atualizamos o termo de uso e privacidade. Seus registros continuam guardados; é só ler e aceitar para seguir.') : null,
      h('div', { class: 'cartao' }, textoTermo()), h('div', { style: 'margin-bottom:30px' }, btn, h('button', { class: 'btn linha cheio', style: 'margin-top:10px', onclick: () => sair(true) }, 'Não aceito, sair'))));
  }
  // ---------- Primeiro acesso: configuração em telas próprias (localização, instalar, teste de GPS) ----------
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.pedidoInstalar = e; });
  async function concluirConfiguracao() { S.configurado = true; await Store.set('configurado:' + S.sessao.u, agoraISO()); ir('#inicio'); }
  async function telaConfigurar(passo) {
    const PASSOS = ['Localização', 'Instalar o app', 'Teste do GPS'];
    const instalado = window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches);
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    if (passo === 1 && instalado) passo = 2;
    const prox = () => (passo >= PASSOS.length - 1 ? concluirConfiguracao() : telaConfigurar(passo + 1 === 1 && instalado ? 2 : passo + 1));
    const pontos = h('div', { class: 'cfg-pontos', 'aria-label': `Passo ${passo + 1} de ${PASSOS.length}` }, PASSOS.map((t, k) => h('span', { class: k === passo ? 'at' : k < passo ? 'feito' : '' })));
    const corpo = h('main', { class: 'cfg' });
    const rodape = (principal, rot, extra) => h('div', { class: 'cfg-rodape' }, principal, extra || null, h('button', { class: 'link-ajuda-form cfg-pular', onclick: () => (passo >= PASSOS.length - 1 ? concluirConfiguracao() : prox()) }, rot || 'Pular este passo'));
    $app.replaceChildren(h('div', { class: 'tela-cfg' }, h('div', { class: 'cfg-cab' }, h('img', { src: 'icons/logo-horizontal.png', alt: 'Neofloresta', class: 'cfg-logo' }), pontos, h('h1', null, PASSOS[passo]), h('small', null, `Passo ${passo + 1} de ${PASSOS.length}`)), corpo));
    if (passo === 0) {
      const st = h('div', { class: 'cfg-estado' });
      let estado = ''; try { estado = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { /* navegador antigo */ }
      const pintar = () => st.replaceChildren(estado === 'granted' ? h('div', { class: 'info' }, ico('check'), ' Localização permitida.') : estado === 'denied' || S.gpsNegado ? h('div', { class: 'aviso' }, h('b', null, 'A localização está bloqueada.'), h('br'), 'Android: toque no cadeado ao lado do endereço (ou em Configurações, Apps, Neofloresta), Permissões, Localização, Permitir. iPhone: Ajustes, Privacidade, Serviços de Localização, Safari, Ao Usar o App. Depois volte aqui.') : null);
      const bt = h('button', { class: 'btn cheio', onclick: () => {
        if (estado === 'granted') return prox();
        bt.disabled = true; bt.textContent = 'Aguardando a sua resposta...';
        navigator.geolocation.getCurrentPosition(() => { estado = 'granted'; Gps.iniciar(); pintar(); setTimeout(prox, 500); }, (e) => { if (e.code === 1) { estado = 'denied'; S.gpsNegado = true; } bt.disabled = false; bt.textContent = 'Tentar de novo'; pintar(); }, { enableHighAccuracy: true, timeout: 30000 });
      } }, estado === 'granted' ? 'Continuar' : 'Permitir localização');
      corpo.replaceChildren(h('p', { class: 'cfg-txt' }, 'O app usa o GPS do celular para marcar onde está cada árvore e mostrar você no mapa.'),
        h('ul', { class: 'cfg-lista' }, h('li', null, 'Só com o app aberto.'), h('li', null, 'Quando o celular perguntar, toque em ', h('b', null, 'Permitir'), ' (ou ', h('b', null, 'Durante o uso do app'), ').'), h('li', null, 'Ligue também a ', h('b', null, 'Precisão da localização do Google'), ' nas configurações do celular.')),
        st, rodape(bt));
      pintar();
    } else if (passo === 1) {
      const bt = S.pedidoInstalar ? h('button', { class: 'btn cheio', onclick: async () => { const e = S.pedidoInstalar; S.pedidoInstalar = null; e.prompt(); try { await e.userChoice; } catch (er) { /* segue */ } prox(); } }, 'Instalar o app') : h('button', { class: 'btn cheio', onclick: prox }, 'Já instalei, continuar');
      corpo.replaceChildren(h('p', { class: 'cfg-txt' }, 'Instalado, o app abre em tela cheia pelo ícone, como os outros apps do celular, e funciona sem internet.'),
        S.pedidoInstalar ? null : h('ol', { class: 'cfg-lista' }, ios ? [h('li', null, 'No Safari, toque em ', h('b', null, 'Compartilhar'), ' (o quadrado com a seta).'), h('li', null, 'Toque em ', h('b', null, 'Adicionar à Tela de Início'), '.')] : [h('li', null, 'No Chrome, toque nos ', h('b', null, '3 pontinhos'), ' no canto de cima.'), h('li', null, 'Toque em ', h('b', null, 'Instalar app'), ' (ou ', h('b', null, 'Adicionar à tela inicial'), ').')], h('li', null, 'Depois abra pelo ícone da Neofloresta.')),
        rodape(bt));
    } else {
      const num = h('div', { class: 'cfg-gps' }, '...'); const dica = h('p', { class: 'dica', style: 'text-align:center' }, 'Fique parado em lugar aberto, longe de prédios e de copas fechadas.');
      const bt = h('button', { class: 'btn cheio', onclick: concluirConfiguracao }, 'Começar a coletar');
      const ouv = (p) => { if (!document.body.contains(num)) return Gps.ouvintes.delete(ouv); if (!p) return; num.textContent = '±' + numBR(p.prec) + ' m'; num.className = 'cfg-gps ' + (p.prec <= 5 ? 'bom' : p.prec <= 10 ? 'medio' : 'ruim'); dica.textContent = p.prec <= 5 ? 'GPS bom para marcar as árvores.' : 'Espere o número baixar para até 5 m. Ele melhora nos primeiros minutos com o céu aberto.'; };
      corpo.replaceChildren(h('p', { class: 'cfg-txt' }, 'Erro do GPS agora:'), num, dica, rodape(bt, 'Fazer o teste depois')); // na tela antes de ouvir: o ouvinte sai sozinho quando o número some
      Gps.ouvintes.add(ouv); ligarGps(); if (S.pos) ouv(S.pos); Gps.ler(); const tm = setInterval(() => { if (!document.body.contains(num)) return clearInterval(tm); Gps.ler(); }, 1500);
    }
  }

  // ---------- Ajuda ----------
  // conteúdo em forms/ajuda.json (guardado pelo app para funcionar sem internet); "?" de cada tela abre no tema dela
  const ajudaBt = (chave) => h('button', { class: 'ic', onclick: () => ir('#ajuda/' + chave), 'aria-label': 'Ajuda' }, ico('ajuda'));
  async function telaAjuda(chave) {
    const voltar = () => { if (S.sessao && history.length > 1) history.back(); else if (S.sessao) ir('#inicio'); else if (location.hash) location.hash = ''; else telaLogin(); }; // a troca de endereço já redesenha o login (sem desenhar duas vezes)
    const corpo = h('main', { class: 'ajuda' }, h('div', { class: 'info' }, 'Carregando a ajuda...'));
    $app.replaceChildren(topo('Ajuda', 'Perguntas frequentes', h('button', { class: 'ic', onclick: voltar, 'aria-label': 'Voltar' }, ico('voltar')), null), corpo);
    let A_; try { A_ = S.ajuda || (S.ajuda = await (await fetch('forms/ajuda.json')).json()); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, 'Não foi possível abrir a ajuda agora. Abra o app uma vez com internet para guardá-la no celular.')); return; }
    let notas = null; try { notas = await (await fetch('version.json', { cache: 'no-store' })).json(); } catch (e) { /* sem internet: sem "o que mudou" */ }
    const pf = S.sessao ? perfil() : 'campo'; const meu = pf === 'cliente' ? 'cliente' : ehCoord() ? 'coordenacao' : 'campo';
    const abas = meu === 'cliente' ? ['cliente'] : meu === 'coordenacao' ? ['coordenacao', 'campo'] : ['campo'];
    const NOMES = { campo: 'Equipe de campo', coordenacao: 'Coordenação', cliente: 'Cliente' };
    let aba = S.ajudaAba && abas.includes(S.ajudaAba) ? S.ajudaAba : abas[0];
    if (chave && meu === 'coordenacao' && !A_.perguntas.some((q) => q.chave === chave && q.perfis.includes('coordenacao'))) aba = 'campo';
    const busca = h('input', { class: 'entrada busca-ajuda', type: 'search', placeholder: 'Buscar na ajuda (ex.: GPS, foto, senha)', 'aria-label': 'Buscar na ajuda', oninput: () => pintar() });
    const lista = h('div', { class: 'ajuda-lista' }); const seletor = h('div', { class: 'subabas' });
    const tel = String(CONTATO.telefone || '').replace(/\D/g, '');
    const contato = h('div', { class: 'cartao ajuda-contato' }, h('h3', null, 'Ainda com dúvida?'),
      h('p', null, meu === 'campo' ? 'Fale com a coordenação do seu projeto.' : 'Fale com a Neofloresta.'),
      h('div', { class: 'linha-btn' }, tel ? h('a', { class: 'btn', href: 'https://wa.me/' + (tel.length <= 11 ? '55' + tel : tel), target: '_blank', rel: 'noopener' }, 'WhatsApp') : null, tel ? h('a', { class: 'btn sec', href: 'tel:+' + (tel.length <= 11 ? '55' + tel : tel) }, 'Ligar') : null, CONTATO.email ? h('a', { class: 'btn sec', href: 'mailto:' + CONTATO.email }, 'Email') : null));
    function pintar() {
      seletor.replaceChildren(...(abas.length > 1 ? abas.map((x) => h('button', { class: 'subaba' + (x === aba ? ' sel' : ''), onclick: () => { aba = x; S.ajudaAba = x; pintar(); } }, NOMES[x])) : []));
      const q = norm(busca.value).trim(); const termos = q.split(/\s+/).filter(Boolean);
      // com várias palavras, ficam as perguntas que batem com mais delas (quem escreve "localizacao negada" acha "Neguei a localização")
      const pont = (x) => { const t_ = norm(x.p + ' ' + x.r + ' ' + x.tema); return termos.filter((t) => t_.includes(t)).length + (termos.some((t) => norm(x.p).includes(t)) ? 0.5 : 0); };
      let itens = A_.perguntas.filter((x) => x.perfis.includes(aba));
      if (termos.length) { const pt = itens.map((x) => [x, pont(x)]).filter(([, n]) => n >= 1); const mx = Math.max(0, ...pt.map(([, n]) => Math.floor(n))); itens = pt.filter(([, n]) => Math.floor(n) === mx).sort((a_, b_) => b_[1] - a_[1]).map(([x]) => x); }
      const temas = [...new Set(itens.map((x) => x.tema))];
      const passos = !termos.length && A_.passos[aba] ? h('details', { class: 'cartao ajuda-passos', open: !chave && !S.sessao ? true : null }, h('summary', null, 'Primeiros passos'), h('ol', null, A_.passos[aba].map(([t, d]) => h('li', null, h('b', null, t), h('span', null, d))))) : null;
      lista.replaceChildren(passos,
        ...temas.map((t) => h('section', { class: 'ajuda-tema' }, h('h3', null, t), itens.filter((x) => x.tema === t).map((x) => h('details', { class: 'ajuda-q', open: (termos.length && itens.length <= 3) || (chave && x.chave === chave && itens.filter((y) => y.chave === chave).length <= 2) ? true : null, 'data-chave': x.chave }, h('summary', null, x.p), h('p', null, x.r))))),
        !itens.length ? h('div', { class: 'info' }, 'Nada encontrado. Tente outra palavra ou fale com a coordenação.') : null,
        !termos.length && notas && notas.notas ? h('details', { class: 'cartao ajuda-mudou' }, h('summary', null, `O que mudou na versão ${notas.versao}`), h('ul', null, notas.notas.map((n) => h('li', null, n)))) : null);
      if (chave && !termos.length) { const el = lista.querySelector(`[data-chave="${chave}"]`); if (el) setTimeout(() => el.closest('section').scrollIntoView({ block: 'start' }), 50); }
    }
    corpo.replaceChildren(seletor, busca, lista, contato); pintar();
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
        h('div', { class: 'cartao' }, h('h3', null, 'Termo de uso e privacidade'), S.sessao ? textoTermo(null, true) : textoTermo('coletor', true), S.sessao && S.sessao.usuario.termo_aceito_em ? h('p', { class: 'dica' }, 'Aceito em ' + dataBR(S.sessao.usuario.termo_aceito_em)) : null)));
  }

  // ---------- Painel, relatório e validação ----------
  // paletas acessíveis a daltônicos (Okabe-Ito): risco, validação e ordens de serviço; sempre acompanhadas de texto
  const COR_RISCO = { Baixo: '#009E73', 'Médio': '#F0E442', Alto: '#D55E00', Severo: '#3B0F70', Extremo: '#3B0F70' };
  const ROT_CURTO = { Pendente: 'Aguardando', Validado: 'Validados', Corrigido: 'Corrigidos', Devolvido: 'Devolvidos', Descartado: 'Descartados' };
  const COR_VAL = { Validado: '#1B7F3B', Pendente: '#8A969C', Corrigido: '#0072B2', Devolvido: '#E69F00', Descartado: '#B0BEC5' };
  const CORES = ['#00546E', '#CD834C', '#12A6C8', '#5B8C5A', '#8E6C8A', '#C9A227'];
  // uma paleta de equipes para o painel e o mapa (acessível a daltônicos e sem o vermelho do risco); a mesma equipe tem sempre a mesma cor
  const CORES_EQ = ['#00546E', '#E69F00', '#56B4E9', '#CC79A7', '#009E73', '#3B0F70', '#8C6D31', '#0072B2'];
  function corEquipe(e) { const m = String(e || '').match(/(\d+)\s*$/); if (m) return CORES_EQ[(+m[1] - 1 + CORES_EQ.length) % CORES_EQ.length]; let hsh = 0; for (const ch of String(e)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; return CORES_EQ[hsh % CORES_EQ.length]; }
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
      equipes.forEach((e, k) => { const v = porDia[d][e] || 0; if (!v) return; const r = el('rect', { x, width: w, y: y(acc + v), height: y(acc) - y(acc + v), fill: corEquipe(e), rx: 1.5 }); r.append(el('title', {}, `${d.slice(8, 10)}/${d.slice(5, 7)} · ${e}: ${v}`)); svg.append(r); acc += v; });
      const k = Math.max(1, Math.ceil(dias.length / 10)); if (i % k === 0) svg.append(el('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 10, fill: '#5B6B72' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`));
    });
    return h('div', null, svg, h('div', { class: 'leg' }, equipes.map((e, k) => h('span', null, h('i', { style: `background:${corEquipe(e)}` }), e))));
  }
  const kpi = (rot, val, sub, cls) => h('div', { class: 'kpi ' + (cls || '') }, h('small', null, rot), h('b', null, val), sub ? h('span', null, sub) : null);

  // o painel abre com os números da última consulta e se atualiza sozinho em segundo plano
  async function dadosPainel(forcar) {
    const chave = S.projeto.id; const k = 'painel:' + chave + ':' + (S.sessao ? S.sessao.u : '');
    if (!forcar) {
      const eu = S.sessao ? S.sessao.u : '';
      const c = S.painel && S.painel.id === chave && S.painel.u === eu ? S.painel : await Store.get(k);
      if (c && c.d && c.id === chave && c.u === eu) { // painel é por usuário: outro login no mesmo aparelho não vê o do anterior
        S.painel = c;
        if (Date.now() - c.t > 120000 && !S.painelBusca && navigator.onLine) {
          S.painelBusca = true;
          Api.b.painel(chave).then(async (d) => { if (!S.sessao || S.sessao.u !== eu) return; S.painel = { id: chave, u: eu, t: Date.now(), d }; await Store.set(k, S.painel); if (document.querySelector('main.painel') && S.projeto && S.projeto.id === chave) telaPainel(false); }).catch(() => {}).finally(() => { S.painelBusca = false; });
        }
        return c.d;
      }
    }
    const d = await Api.b.painel(chave); S.painel = { id: chave, u: S.sessao ? S.sessao.u : '', t: Date.now(), d }; await Store.set(k, S.painel); return d;
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
    const corpo = h('main', { class: 'painel' }, esboco('Carregando indicadores...'));
    const voltar = perfil() === 'cliente' ? h('button', { class: 'ic', onclick: abrirMenu, 'aria-label': 'Menu' }, ico('menu')) : h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar'));
    $app.replaceChildren(topo('Painel', S.projeto.nome, voltar, h('div', { class: 'topo-dir' }, ajudaBt('painel'), h('button', { class: 'ic', onclick: () => ir('#mapa'), 'aria-label': 'Mapa' }, ico('mapa')))), corpo);
    let d; try { d = await dadosPainel(forcar); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, 'Não foi possível carregar o painel: ' + e.message)); return; }
    const A = analisarPainel(d, S.form); const p = d.projeto || S.projeto;
    const meta = +(p.meta || 0); const validados = d.validacao.Validado || 0;
    const equipes = Object.keys(d.equipes || {}).sort();
    const dias = Object.keys(d.porDia).sort(); const ult7 = dias.slice(-7); const media7 = ult7.length ? ult7.reduce((a, x) => a + Object.values(d.porDia[x]).reduce((s, v) => s + v, 0), 0) / ult7.length : 0;
    const faltam = meta ? Math.max(0, meta - d.total) : 0; const previsao = meta && media7 ? Math.ceil(faltam / media7) : null;
    const alertas = [];
    if (A.topEsp > 0.1 && A.esp[0]) alertas.push(`A espécie mais comum (${A.esp[0].rot}) tem ${fmtP(A.topEsp)} dos indivíduos. A referência de diversidade recomenda no máximo 10% por espécie.`);
    if (A.topGen > 0.2 && A.gen) alertas.push(`O gênero ${A.gen[0]} tem ${fmtP(A.topGen)} dos indivíduos. A referência recomenda no máximo 20% por gênero.`);
    if (d.semCoordenada) alertas.push(`${fmtN(d.semCoordenada)} registro(s) sem coordenada.`);
    if (d.gps && d.gps.ate5m < 0.8) alertas.push(`Só ${fmtP(d.gps.ate5m)} dos pontos têm GPS com erro de até 5 m.`);
    const vazioCliente = perfil() === 'cliente' && !d.total ? h('div', { class: 'info' }, 'Ainda não há árvores validadas. Os números aparecem aqui assim que a Neofloresta concluir a conferência dos primeiros registros.') : null;
    const cli = perfil() === 'cliente';
    const irVal = (sit) => { S.filtroVal = Object.assign(S.filtroVal || {}, { sit, limite: 100 }); ir('#validacao'); };
    const cab = h('div', { class: 'painel-cab' }, h('div', null, p.contratante ? h('div', null, p.contratante) : null, p.municipio ? h('small', null, p.municipio + (p.contrato ? ' · Contrato ' + p.contrato : '')) : null),
      h('small', null, (cli ? 'Dados validados pela Neofloresta. ' : '') + 'Atualizado às ' + new Date(d.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), ' ', h('button', { class: 'btn sec peq', onclick: () => telaPainel(true) }, 'Atualizar')));
    const kpiBt = (fn, ...a) => { const k = kpi(...a); if (!fn) return k; k.classList.add('clicavel'); k.setAttribute('role', 'button'); k.tabIndex = 0; k.addEventListener('click', fn); k.addEventListener('keydown', (e) => { if (e.key === 'Enter') fn(); }); return k; };
    const altoMapa = () => { S.mapaFiltro = { alto: true }; ir('#mapa'); };
    // Operação: andamento do campo (coordenação). Inventário: o que foi encontrado (coordenação e cliente)
    const operacao = cli ? null : h('div', { class: 'painel-aba', 'data-aba': 'op' },
      h('div', { class: 'kpis' },
        kpi('Registros', fmtN(d.total), `${fmtN(A.ind)} indivíduos e ${fmtN(d.total - A.ind)} pontos sem árvore` + (meta ? ` · ${fmtP(d.total / meta)} da meta de ${fmtN(meta)}` : '')),
        kpiBt(() => irVal('Validado'), 'Validados', fmtN(validados), d.total ? fmtP(validados / d.total) + ' do total' : ''),
        kpiBt(() => irVal('revisar'), 'A revisar', fmtN((d.validacao.Pendente || 0) + (d.validacao.Corrigido || 0)), 'aguardando ou corrigidos'),
        kpi('Ritmo', fmtN(Math.round(media7)), 'registros por dia (últimos 7 dias de campo)' + (previsao != null ? ` · faltam cerca de ${fmtN(previsao)} dias` : '')),
        d.gps ? kpi('Precisão do GPS', fmtN(d.gps.mediana) + ' m', fmtP(d.gps.ate5m) + ' com erro até 5 m') : null,
        d.tempos && d.tempos.dur != null ? kpiBt(() => ir('#hoje'), 'Tempo por amostra', fmtMin(d.tempos.dur), `mediana · intervalo entre amostras ${fmtMin(d.tempos.int)}`) : null),
      alertas.length ? h('div', { class: 'cartao alertas' }, h('h3', null, 'Pontos de atenção'), h('ul', null, alertas.map((a) => h('li', null, a)))) : null,
      h('div', { class: 'grade-cartoes' },
        h('div', { class: 'cartao larga' }, h('h3', null, 'Registros por dia de campo'), serieDias(d.porDia, equipes)),
        h('div', { class: 'cartao' }, h('h3', null, 'Situação da validação'), barras(A.val, { total: d.total })),
        h('div', { class: 'cartao' }, h('h3', null, 'Por equipe'), barras(equipes.map((e, k) => ({ rot: e, n: d.equipes[e], cor: corEquipe(e, k) }))))),
      equipes.length ? rendimentoEquipes(d, equipes) : null);
    const inventario = h('div', { class: 'painel-aba', 'data-aba': 'inv' },
      h('div', { class: 'kpis' },
        kpi('Indivíduos', fmtN(A.ind), 'árvores, arbustos e palmeiras'),
        kpi('Espécies', fmtN(d.nEspecies), A.esp[0] ? h('span', null, 'mais comum: ', h('i', null, A.esp[0].rot)) : ''),
        A.risco.length ? kpiBt(cli ? null : altoMapa, 'Risco alto ou severo', fmtN(A.altoN), A.nRisco ? fmtP(A.altoN / A.nRisco) + ' dos indivíduos avaliados' : '', A.altoN ? 'alerta' : '') : null,
        null),
      h('div', { class: 'grade-cartoes' },
        A.cat.length ? h('div', { class: 'cartao' }, h('h3', null, 'Categoria'), barras(A.cat)) : null,
        A.risco.length ? h('div', { class: 'cartao' }, h('h3', null, 'Classe de risco'), barras(A.risco)) : null,
        h('div', { class: 'cartao' }, h('h3', null, 'Espécies mais comuns'), barras(A.esp.slice(0, 12), { total: A.nEsp })),
        d.classesDap.length ? h('div', { class: 'cartao' }, h('h3', null, S.form && S.form.campos.some((c) => c.tipo === 'multinumber' && /cap/i.test(c.nome)) ? 'Classes de DAP (calculado do CAP)' : 'Classes de DAP'), barras(d.classesDap.map((c) => ({ rot: c.ate ? `${c.de} a ${c.ate} cm` : `${c.de} cm ou mais`, n: c.n })))) : null,
        A.manejo.length ? h('div', { class: 'cartao' }, h('h3', null, 'Manejo recomendado'), barras(A.manejo.filter((x) => x.n), { total: A.ind, cor: CORES[1] })) : null,
        A.ocorr.length ? h('div', { class: 'cartao' }, h('h3', null, 'Ocorrências observadas'), barras(A.ocorr, { total: A.ind, cor: CORES[2] })) : null));
    if (!S.painelAba || cli) S.painelAba = cli ? 'inv' : 'op';
    const abasP = cli ? null : h('div', { class: 'subabas painel-abas', role: 'tablist' }, [['op', 'Operação'], ['inv', 'Inventário']].map(([k, t]) => h('button', { class: S.painelAba === k ? 'at' : '', role: 'tab', 'aria-selected': S.painelAba === k ? 'true' : 'false', onclick: (e) => { S.painelAba = k; corpo.querySelectorAll('.painel-abas button').forEach((b) => { b.classList.toggle('at', b === e.currentTarget); b.setAttribute('aria-selected', b === e.currentTarget ? 'true' : 'false'); }); corpo.querySelectorAll('.painel-aba').forEach((x) => x.classList.toggle('oculto', x.dataset.aba !== k)); } }, t)));
    [operacao, inventario].forEach((x) => x && x.classList.toggle('oculto', x.dataset.aba !== S.painelAba));
    corpo.replaceChildren(vazioCliente, cab, abasP, operacao, cli && !d.total ? null : inventario,
      h('div', { class: 'linha-btn botoes-painel', style: 'margin:6px 0 30px' }, h('button', { class: 'btn', onclick: () => ir('#relatorio') }, 'Relatório para imprimir ou PDF'), h('button', { class: 'btn sec', onclick: () => ir('#medicao') }, 'Boletim de medição'), h('button', { class: 'btn sec', onclick: () => ir('#mapa') }, 'Ver no mapa'),
        cli ? h('button', { class: 'btn sec', onclick: () => exportarCliente() }, 'Baixar dados') : null));
    pintarPainelOS(corpo); pintarPainelQd(corpo, forcar);
  }
  // "Hoje no campo": o dia de cada equipe, com os dias anteriores a um toque
  const fmtMin = (m) => (m == null ? '-' : m < 1 ? Math.round(m * 60) + ' s' : fmtN(Math.round(m * 10) / 10) + ' min');
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  async function telaHoje(diaSel, forcar) {
    const corpo = h('main', { class: 'hoje' }, esboco('Carregando o dia das equipes...'));
    $app.replaceChildren(topo('Hoje no campo', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('div', { class: 'topo-dir' }, ajudaBt('hoje'), h('button', { class: 'ic', onclick: () => ir('#mapa'), 'aria-label': 'Mapa' }, ico('mapa')))), corpo);
    let d; try { d = await dadosPainel(forcar); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, 'Não foi possível carregar: ' + e.message), h('button', { class: 'btn', onclick: () => telaHoje(diaSel, true) }, 'Tentar de novo')); return; }
    if (!document.body.contains(corpo)) return;
    const diario = d.diario || {}; const hoje = diaLocal(agoraISO()); const ontem = diaLocal(new Date(Date.now() - 864e5).toISOString());
    const dias = [...new Set([hoje, ...Object.keys(diario)])].sort().reverse();
    const sel = diaSel && dias.includes(diaSel) ? diaSel : diaSel || hoje;
    const nomeDia = (x) => { const dt = new Date(x + 'T12:00:00'); return x === hoje ? 'Hoje' : x === ontem ? 'Ontem' : `${SEMANA[dt.getDay()]} ${x.slice(8, 10)}/${x.slice(5, 7)}`; };
    const totDia = (x) => Object.values(diario[x] || {}).reduce((a, v) => a + v.n, 0);
    const chips = h('div', { class: 'dias-chips', role: 'tablist' }, dias.map((x) => h('button', { class: 'dia-chip' + (x === sel ? ' sel' : ''), role: 'tab', 'aria-selected': x === sel ? 'true' : 'false', onclick: () => telaHoje(x) }, h('b', null, nomeDia(x)), h('small', null, pl(totDia(x), 'registro', 'registros')))));
    const outro = h('input', { type: 'date', class: 'entrada dia-outro', value: sel, max: hoje, 'aria-label': 'Escolher outro dia', onchange: () => outro.value && telaHoje(outro.value) });
    const eqs = diario[sel] || {}; const lista = Object.entries(eqs).sort((a, b) => b[1].n - a[1].n);
    const cCat = S.form && S.form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const rotCat = (v) => { const o = cCat && cCat.opcoes.find((x) => String(x.v) === String(v)); return o ? o.t.replace(/\s*\(.*\)/, '') : v; };
    const n = lista.reduce((a, [, v]) => a + v.n, 0);
    const meds = (k) => { const v = lista.map(([, x]) => x[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const T = d.tempos || {};
    const dt = new Date(sel + 'T12:00:00');
    corpo.replaceChildren(
      chips, h('div', { class: 'hoje-outro' }, h('label', null, 'Outro dia: ', outro), h('small', null, 'Atualizado às ' + new Date(d.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), ' ', h('button', { class: 'btn sec peq', onclick: () => telaHoje(sel, true) }, 'Atualizar'))),
      h('h2', { class: 'painel-tit' }, (sel === hoje ? 'Hoje, ' : '') + dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })),
      h('div', { class: 'kpis' },
        kpi('Registros no dia', fmtN(n), lista.length ? pl(lista.length, 'equipe em campo', 'equipes em campo') : 'nenhuma equipe enviou registros'),
        kpi('Tempo por amostra', fmtMin(meds('dur')), 'mediana do início ao fim do cadastro' + (T.dur != null ? ` · no projeto ${fmtMin(T.dur)}` : '')),
        kpi('Intervalo entre amostras', fmtMin(meds('int')), 'de um registro ao próximo, sem pausas' + (T.int != null ? ` · no projeto ${fmtMin(T.int)}` : '')),
        kpi('Precisão do GPS', meds('gps') != null ? fmtN(Math.round(meds('gps') * 10) / 10) + ' m' : '-', 'mediana do erro', meds('gps') > 7 ? 'alerta' : '')),
      lista.length ? h('div', { class: 'hoje-equipes' }, lista.map(([e, v]) => h('div', { class: 'cartao hoje-eq' },
        h('div', { class: 'hoje-eq-cab' }, h('b', null, e), h('span', { class: 'hoje-n' }, fmtN(v.n))),
        h('small', null, v.parceiro ? 'Dupla com parceiro: sem horário do dia, só o tempo de cada cadastro' : sel === hoje ? `Começou às ${v.ini} · último registro às ${v.fim}` : `Das ${v.ini} às ${v.fim}`),
        h('dl', { class: 'hoje-dl' },
          h('dt', null, 'Tempo por amostra'), h('dd', null, fmtMin(v.dur)),
          v.parceiro ? null : [h('dt', null, 'Intervalo'), h('dd', null, fmtMin(v.int))],
          h('dt', null, 'GPS'), h('dd', { class: v.gps > 7 ? 'ruim' : '' }, v.gps != null ? '±' + fmtN(v.gps) + ' m' : '-'),
          v.aguardando != null ? [h('dt', null, 'Aguardando validação'), h('dd', null, fmtN(v.aguardando))] : null,
          v.devolvidos ? [h('dt', null, 'Devolvidos'), h('dd', { class: 'ruim' }, fmtN(v.devolvidos))] : null),
        Object.keys(v.cat || {}).length ? h('div', { class: 'hoje-cats' }, Object.entries(v.cat).sort((a, b) => b[1] - a[1]).map(([c, k]) => h('span', { class: 'selo' }, `${rotCat(c)}: ${fmtN(k)}`))) : null,
        h('button', { class: 'btn sec', onclick: () => { S.mapaFiltro = { equipe: e, dia: sel === hoje ? 'hoje' : sel }; ir('#mapa'); } }, 'Ver os pontos no mapa')))) : h('div', { class: 'info' }, sel === hoje ? 'Nenhum registro chegou hoje ainda. Os registros aparecem aqui quando as equipes enviam (o envio é automático quando há internet).' : 'Nenhum registro neste dia.'),
      T.porCategoria && Object.keys(T.porCategoria).length ? h('div', { class: 'cartao' }, h('h3', null, 'Tempo por amostra em todo o projeto'),
        h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Categoria'), h('th', null, 'Tempo (mediana)'), h('th', null, 'Amostras')),
          Object.entries(T.porCategoria).sort((a, b) => b[1].n - a[1].n).map(([c, x]) => h('tr', null, h('td', null, c ? rotCat(c) : 'Sem categoria'), h('td', null, fmtMin(x.dur)), h('td', null, fmtN(x.n))))),
        h('p', { class: 'dica' }, 'Tempo do início ao fim de cada cadastro. Cadastros que ficaram abertos mais de 1 hora não entram na conta.')) : null,
      h('div', { class: 'linha-btn', style: 'margin:10px 0 30px' }, h('button', { class: 'btn', onclick: () => ir('#painel') }, 'Panorama geral do projeto'), h('button', { class: 'btn sec', onclick: () => ir('#validacao') }, 'Validar registros')));
    const s_ = chips.querySelector('.sel'); if (s_ && s_.scrollIntoView) s_.scrollIntoView({ inline: 'center', block: 'nearest' });
    // trajeto do turno (quando ligado para a equipe)
    if (!Api.demo && navigator.onLine) Api.b.trajetos(S.projeto.id, sel).then((ts) => {
      if (!document.body.contains(corpo) || !ts || !ts.length) return; const por = {};
      for (const t of ts) { const o = por[t.equipe] = por[t.equipe] || { pe: 0, carro: 0, parado: 0 }; o.pe += t.km_pe; o.carro += t.km_carro; o.parado += t.min_parado; }
      const txt = (o) => `${numBR(Math.round(o.pe * 10) / 10)} km a pé · ${numBR(Math.round(o.carro * 10) / 10)} km de carro · ${fmtN(o.parado)} min parado`;
      const vistos = new Set();
      corpo.querySelectorAll('.hoje-eq').forEach((c) => { const e = c.querySelector('.hoje-eq-cab b').textContent; vistos.add(e); const o = por[e]; if (!o) return; c.querySelector('.hoje-dl').append(h('dt', null, 'Trajeto'), h('dd', null, txt(o))); });
      // equipe com trajeto e sem registro no dia também aparece (estava em campo)
      const faltam = Object.keys(por).filter((e) => e && !vistos.has(e)); if (!faltam.length) return;
      let grade = corpo.querySelector('.hoje-equipes'); if (!grade) { grade = h('div', { class: 'hoje-equipes' }); const info = corpo.querySelector(':scope > .info'); if (info) info.replaceWith(grade); else corpo.append(grade); }
      for (const e of faltam) grade.append(h('div', { class: 'cartao hoje-eq' }, h('div', { class: 'hoje-eq-cab' }, h('b', null, e), h('span', { class: 'hoje-n' }, '0')), h('small', null, 'Em campo, sem registros enviados no dia'), h('dl', { class: 'hoje-dl' }, h('dt', null, 'Trajeto'), h('dd', null, txt(por[e])))));
    }).catch(() => {});
  }
  // rendimento de cada equipe (dupla): total, hoje, média por dia de campo e melhor dia
  function rendimentoEquipes(d, equipes) {
    const hoje = diaLocal(agoraISO()); const dias = Object.keys(d.porDia || {}).sort(); const ult7 = dias.slice(-7);
    const lin = equipes.map((e) => {
      const porDia = dias.map((x) => [x, (d.porDia[x] || {})[e] || 0]).filter(([, n]) => n);
      const tot = porDia.reduce((a, [, n]) => a + n, 0); const melhor = porDia.reduce((m, x) => (x[1] > m[1] ? x : m), ['', 0]);
      const n7 = ult7.map((x) => (d.porDia[x] || {})[e] || 0).filter((n) => n); const media = n7.length ? n7.reduce((a, b) => a + b, 0) / n7.length : 0;
      const te = ((d.tempos || {}).porEquipe || {})[e] || {};
      return { e, tot, hoje: (d.porDia[hoje] || {})[e] || 0, diasCampo: porDia.length, media, melhor, dur: te.dur, int: te.int };
    }).sort((a, b) => b.media - a.media);
    const dBR = (x) => (x ? x.split('-').reverse().slice(0, 2).join('/') : '');
    return h('div', { class: 'cartao tab-rolagem' }, h('h3', null, 'Rendimento por equipe'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Equipe'), h('th', null, 'Hoje'), h('th', null, 'Média por dia de campo (últimos 7)'), h('th', null, 'Dias de campo'), h('th', null, 'Melhor dia'), h('th', null, 'Tempo por amostra'), h('th', null, 'Intervalo'), h('th', null, 'Total'), h('th', null, '')),
        lin.map((x) => h('tr', null, h('td', null, x.e), h('td', null, fmtN(x.hoje)), h('td', null, fmtN(Math.round(x.media * 10) / 10)), h('td', null, fmtN(x.diasCampo)), h('td', null, x.melhor[1] ? `${fmtN(x.melhor[1])} em ${dBR(x.melhor[0])}` : ''), h('td', null, fmtMin(x.dur)), h('td', null, fmtMin(x.int)), h('td', null, fmtN(x.tot)),
          h('td', null, h('button', { class: 'btn sec peq', onclick: () => { S.mapaFiltro = { equipe: x.e, dia: 'hoje' }; ir('#mapa'); } }, 'Pontos de hoje'), ' ', h('button', { class: 'btn sec peq', onclick: () => { S.mapaFiltro = { equipe: x.e, dia: '' }; ir('#mapa'); } }, 'Todos'))))),
      h('p', { class: 'dica' }, 'Dia de campo é o dia em que a equipe cadastrou pelo menos um ponto. No mapa dá para filtrar por equipe e por dia.'));
  }
  function resumoOS(ordens) {
    const ativos = ordens.filter((o) => !o.__pend || o.numero);
    const porSt = {}; const porTipo = {}; ativos.forEach((o) => { porSt[o.status] = (porSt[o.status] || 0) + 1; porTipo[o.tipo] = porTipo[o.tipo] || {}; porTipo[o.tipo][o.status] = (porTipo[o.tipo][o.status] || 0) + 1; });
    const conc = ativos.filter((o) => o.status === 'Concluída' && o.concluida_em);
    const dias = conc.map((o) => (new Date(o.concluida_em) - new Date(o.solicitada_em || o.aberta_em)) / 864e5).filter((x) => isFinite(x) && x >= 0);
    const mes = diaLocal(agoraISO()).slice(0, 7);
    return { total: ativos.length, porSt, porTipo, atrasadas: ativos.filter(atrasada).length, concMes: conc.filter((o) => diaLocal(o.concluida_em).slice(0, 7) === mes).length, foraPrazo: conc.filter((o) => o.prazo && diaLocal(o.concluida_em) > o.prazo).length, prazoMedio: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null };
  }
  async function pintarPainelOS(corpo) {
    let d; try { d = await carregarOS(false); } catch (e) { return; }
    if (d.semServidor || !d.ordens.length || !document.body.contains(corpo)) return;
    const r = resumoOS(d.ordens); const abertas = (r.porSt.Aberta || 0) + (r.porSt['Em execução'] || 0);
    const sec = h('section', { class: 'painel-os' }, h('h2', { class: 'painel-tit' }, 'Ordens de serviço'),
      h('div', { class: 'kpis' }, kpi('Em aberto', fmtN(abertas), `${fmtN(r.porSt['Em execução'] || 0)} em execução`), kpi('Pedidos a aprovar', fmtN(r.porSt.Solicitada || 0), ''), kpi('Atrasadas', fmtN(r.atrasadas), 'prazo vencido', r.atrasadas ? 'alerta' : ''),
        kpi('Concluídas no mês', fmtN(r.concMes), `${fmtN(r.porSt['Concluída'] || 0)} no total` + (r.foraPrazo ? `, ${fmtN(r.foraPrazo)} depois do prazo` : '')), r.prazoMedio != null ? kpi('Tempo médio', fmtN(Math.round(r.prazoMedio * 10) / 10) + ' dias', 'do pedido à conclusão') : null),
      h('div', { class: 'grade-cartoes' },
        h('div', { class: 'cartao' }, h('h3', null, 'Situação'), barras(['Solicitada', 'Aberta', 'Em execução', 'Concluída', 'Cancelada'].map((k) => ({ rot: k, n: r.porSt[k] || 0, cor: COR_OS[k] })).filter((x) => x.n), { total: r.total })),
        h('div', { class: 'cartao' }, h('h3', null, 'Por tipo de serviço'), barras(Object.entries(r.porTipo).map(([t, o]) => ({ rot: t, n: Object.values(o).reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n), { total: r.total, cor: CORES[1] }))),
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn sec', onclick: () => ir('#ordens') }, 'Ver ordens de serviço')));
    const op = corpo.querySelector('.painel-aba[data-aba="op"]'); if (op) { op.append(sec); return; }
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
    const equipes = Object.keys(d.equipes || {}).sort(); const dias = Object.keys(d.porDia).sort();
    Api.b.auditar && Api.b.auditar('relatorio', S.projeto.id, '');
    const cli = perfil() === 'cliente'; let nSec = 0; const sec = (t) => h('h2', null, `${++nSec}. ${t}`); // numeração sempre em sequência, sem buracos
    const semResp = !p.responsavel;
    corpo.replaceChildren(
      semResp && !cli ? h('div', { class: 'aviso nao-imprime' }, 'Falta o responsável técnico do projeto (nome, registro e ART). Preencha em Coordenação, Projetos, Editar, antes de entregar o relatório.') : null,
      h('header', { class: 'rel-cab' }, h('img', { src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }), h('div', null, h('h1', null, 'Relatório de andamento do inventário'), h('p', null, p.nome), h('small', null, [p.contratante, p.municipio, p.contrato ? 'Contrato ' + p.contrato : ''].filter(Boolean).join(' · ')))),
      h('p', { class: 'rel-data' }, 'Emitido em ' + agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (perfil() === 'cliente' ? '. Considera apenas registros validados.' : '. Considera todos os registros enviados, exceto os descartados.')),
      h('p', { class: 'rel-leitura' }, 'Como ler: os números mostram o que foi levantado até a data de emissão. Indivíduos são as árvores, arbustos e palmeiras; os demais registros são pontos sem árvore (por exemplo, árvore morta ou calçada sem árvores). As porcentagens de espécies consideram só os indivíduos identificados.'),
      sec('Resumo'),
      tab(['Indicador', 'Valor'], [
        ['Registros', fmtN(d.total)], ['Indivíduos (árvores, arbustos e palmeiras)', fmtN(A.ind)], p.meta ? ['Meta do contrato', `${fmtN(p.meta)} (${fmtP(d.total / p.meta)} concluído)`] : null,
        ['Espécies distintas', fmtN(d.nEspecies)], perfil() !== 'cliente' ? ['Validados', `${fmtN(d.validacao.Validado || 0)} (${pct(d.validacao.Validado || 0, d.total)})`] : null,
        A.risco.length ? ['Indivíduos com risco alto ou severo', `${fmtN(A.altoN)} (${pct(A.altoN, A.nRisco)} dos avaliados)`] : null,
        ['Dias de campo', fmtN(dias.length)], d.gps && !cli ? ['Precisão mediana do GPS', fmtN(d.gps.mediana) + ' m'] : null].filter(Boolean)),
      A.cat.length ? [sec('Registros por categoria'), tab(['Categoria', 'Quantidade', '%'], A.cat.map((c) => [c.rot, fmtN(c.n), pct(c.n, d.total)]))] : null,
      sec('Composição de espécies'),
      h('p', null, `Foram registradas ${fmtN(d.nEspecies)} espécies. `, A.esp[0] ? ['A mais comum é ', h('i', null, A.esp[0].rot), `, com ${fmtP(A.topEsp)} dos indivíduos identificados` + (A.topEsp > 0.1 ? ', acima do limite de referência de 10% por espécie.' : ', dentro do limite de referência de 10% por espécie.')] : null),
      tab(['Espécie', 'Indivíduos', '%'], A.esp.slice(0, 30).map((e) => [h('i', null, e.rot), fmtN(e.n), pct(e.n, A.nEsp)])),
      d.classesDap.length ? [sec('Classes de diâmetro (DAP)'), tab(['Classe', 'Indivíduos', '%'], d.classesDap.map((c) => [c.ate ? `${c.de} a ${c.ate} cm` : `${c.de} cm ou mais`, fmtN(c.n), pct(c.n, d.classesDap.reduce((a, x) => a + x.n, 0))]))] : null,
      A.risco.length ? [sec('Classe de risco'), tab(['Classe', 'Indivíduos', '%'], A.risco.map((c) => [c.rot, fmtN(c.n), pct(c.n, A.nRisco)]))] : null,
      A.manejo.length ? [sec('Manejo recomendado'), tab(['Manejo', 'Indivíduos', '%'], A.manejo.filter((x) => x.n).map((c) => [c.rot, fmtN(c.n), pct(c.n, A.ind)]))] : null,
      A.ocorr.length ? [sec('Ocorrências observadas'), tab(['Ocorrência', 'Indivíduos', '%'], A.ocorr.map((c) => [c.rot, fmtN(c.n), pct(c.n, A.ind)]))] : null,
      cli ? null : [sec('Produção de campo'),
        h('p', null, dias.length > 14 ? 'Registros por semana (de segunda a domingo).' : 'Registros por dia de campo.'),
        tab([dias.length > 14 ? 'Semana' : 'Data', ...equipes, 'Total'], producaoTabela(d.porDia, dias, equipes, dias.length > 14))],
      h('div', { id: 'rel-os' }),
      p.responsavel ? h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, p.responsavel), p.registro_profissional ? h('div', null, p.registro_profissional) : null, p.art ? h('div', null, 'ART nº ' + p.art) : null, h('div', null, 'Responsável técnico · Neofloresta Serviços Ecossistêmicos Ltda.')) : h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('div', null, 'Responsável técnico · Neofloresta Serviços Ecossistêmicos Ltda.')),
      h('footer', { class: 'rel-rodape' }, 'Neofloresta Serviços Ecossistêmicos Ltda. · Gerado pelo Neofloresta Inventário ' + VERSAO));
    try {
      const od = await carregarOS(false); const el = document.getElementById('rel-os');
      if (el && !od.semServidor && od.ordens.length) {
        const r = resumoOS(od.ordens); const sts = ['Solicitada', 'Aberta', 'Em execução', 'Concluída', 'Cancelada'];
        el.replaceChildren(sec('Ordens de serviço'), h('p', null, `${fmtN(r.total)} ordens registradas, ${fmtN(r.porSt['Concluída'] || 0)} concluídas e ${fmtN(r.atrasadas)} com prazo vencido` + (r.prazoMedio != null ? `. Tempo médio do pedido à conclusão: ${fmtN(Math.round(r.prazoMedio * 10) / 10)} dias.` : '.')),
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
        perfil() === 'cliente' ? null : h('h2', null, '2. Validados por equipe'),
        perfil() === 'cliente' ? null : tab(['Equipe', 'Indivíduos', 'Pontos sem árvore', 'Total'], [...equipes.map((e) => { const x = val.filter((l) => (l.equipe || '-') === e); return [e, fmtN(x.filter(ehInd).length), fmtN(x.filter((l) => !ehInd(l)).length), fmtN(x.length)]; }), ['Total', fmtN(val.filter(ehInd).length), fmtN(val.filter((l) => !ehInd(l)).length), fmtN(val.length)]]),
        h('h2', null, perfil() === 'cliente' ? '2. Registros validados no período' : '3. Registros validados no período'),
        val.length ? tab(['Nº', 'Código', 'Categoria', 'Espécie', ...(perfil() === 'cliente' ? [] : ['Equipe']), 'Validado em'], val.sort((a, b) => (+a.numero_unico || 0) - (+b.numero_unico || 0)).map((l) => [String(l.numero_unico || ''), (cc && l[cc.nome]) || '', cat ? rotuloOpcao(cat, l[cat.nome]).replace(/\s*\(.*\)/, '') : '', h('i', null, (ce && l[ce.nome]) || ''), ...(perfil() === 'cliente' ? [] : [l.equipe || '']), dataBR(l.validado_em)])) : h('p', null, 'Nenhum registro validado neste período.'),
        h('div', { id: 'med-os' }),
        h('div', { class: 'rel-assinaturas' },
          h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, p.responsavel || 'Responsável técnico'), p.registro_profissional ? h('div', null, p.registro_profissional) : null, h('div', null, 'Neofloresta Serviços Ecossistêmicos Ltda.')),
          h('div', { class: 'rel-assina' }, h('div', { class: 'linha-ass' }), h('b', null, 'Fiscal do contrato'), h('div', null, 'Atesto a execução dos serviços acima. Data: ____/____/______'))),
        h('footer', { class: 'rel-rodape' }, 'Gerado pelo Neofloresta Inventário ' + VERSAO + ' em ' + new Date().toLocaleString('pt-BR')));
      try {
        const od = await carregarOS(false); const el = document.getElementById('med-os');
        const feitas = od.ordens.filter((o) => o.status === 'Concluída' && o.numero && (() => { const x = diaLocal(o.concluida_em); return x && x >= de.value && x <= ate.value; })()).sort((a, b) => +a.numero - +b.numero);
        if (el && !od.semServidor && od.ordens.length) {
          const tipos = [...new Set(feitas.map((o) => o.tipo))].sort((a, b) => a.localeCompare(b, 'pt')); const eqs = perfil() === 'cliente' ? ['Executadas'] : [...new Set(feitas.map((o) => o.responsavel || '-'))].sort(); const eqDe = (o) => (perfil() === 'cliente' ? 'Executadas' : o.responsavel || '-');
          el.replaceChildren(h('h2', null, (perfil() === 'cliente' ? '3' : '4') + '. Serviços executados no período (ordens de serviço concluídas)'),
            h('p', null, 'Conta as ordens pela data de conclusão em campo. As fotos de cada serviço ficam guardadas no sistema (antes e depois; plantio e avaliação de risco têm ao menos a foto de depois). ' + (feitas.filter((o) => o.prazo && diaLocal(o.concluida_em) > o.prazo).length ? `${pl(feitas.filter((o) => o.prazo && diaLocal(o.concluida_em) > o.prazo).length, 'ordem foi concluída', 'ordens foram concluídas')} depois do prazo.` : 'Todas as ordens com prazo foram concluídas dentro dele.')),
            feitas.length ? [tab(perfil() === 'cliente' ? ['Tipo de serviço', 'Total'] : ['Tipo de serviço', ...eqs, 'Total'], [...tipos.map((t) => [t, ...eqs.map((e) => fmtN(feitas.filter((o) => o.tipo === t && eqDe(o) === e).length)), fmtN(feitas.filter((o) => o.tipo === t).length)]), ['Total', ...eqs.map((e) => fmtN(feitas.filter((o) => eqDe(o) === e).length)), fmtN(feitas.length)]].map((l) => (perfil() === 'cliente' ? [l[0], l[l.length - 1]] : l))),
              tab(['Ordem', 'Serviço', 'Árvore ou local', perfil() === 'cliente' ? null : 'Equipe', 'Prazo', 'Concluída em', 'No prazo', 'Fotos'].filter(Boolean), feitas.map((o) => [numOS(o), o.tipo, o.codigo_arvore || o.endereco || '', ...(perfil() === 'cliente' ? [] : [o.responsavel || '']), o.prazo ? o.prazo.split('-').reverse().join('/') : '', dataAno(o.concluida_em), o.prazo ? (diaLocal(o.concluida_em) <= o.prazo ? 'Sim' : 'Não') : '', [linkSeguro(o.foto_antes) ? h('a', { href: linkSeguro(o.foto_antes), target: '_blank', rel: 'noopener' }, 'antes') : null, linkSeguro(o.foto_depois) ? h('a', { href: linkSeguro(o.foto_depois), target: '_blank', rel: 'noopener' }, 'depois') : null].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))]))] : h('p', null, 'Nenhuma ordem de serviço concluída neste período.'));
        }
      } catch (e) { /* sem ordens */ }
    };
    $app.replaceChildren(h('div', { class: 'nao-imprime' }, topo('Boletim de medição', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#painel'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: () => window.print() }, 'Imprimir ou PDF'))),
      h('main', { class: 'relatorio' }, h('div', { class: 'nao-imprime cartao' }, h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'De'), de), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Até'), ate)), h('button', { class: 'btn', onclick: gerar }, 'Gerar boletim')), corpo));
    gerar();
  }

  // ---------- Validação (coordenação e revisão técnica) ----------
  // grava a decisão no servidor e atualiza a lista guardada; devolve true se gravou
  // motivos sugeridos pelos alertas do registro (um toque preenche o motivo)
  const MOTIVO_ALERTA = [[/Sem coordenada|GPS/, 'Refazer a marcação do ponto ao lado do tronco (GPS com erro alto ou sem coordenada).'], [/Sem foto/, 'Falta a foto geral da árvore.'], [/Sem espécie|fora da lista/, 'Conferir a espécie (nome fora da lista ou em branco).'], [/Altura/, 'Conferir a altura (valor fora do comum).'], [/DAP|CAP/, 'Conferir a medida do CAP (valor fora do comum).'], [/Código repetido|duplicad/i, 'Código repetido: conferir se é o mesmo indivíduo.']];
  async function decidirRegistros(estado, uuids, amostra) {
    let obs = '';
    const antes = {}; const cache = S.linhas && S.linhas[S.projeto.id]; if (cache) for (const l of cache.linhas) if (uuids.includes(l.uuid)) antes[l.uuid] = { st: l.validacao || 'Pendente', validacao_obs: l.validacao_obs || '', validado_por: l.validado_por || '', validado_em: l.validado_em || '' };
    if (estado !== 'Validado') {
      const t = h('textarea', { class: 'entrada', placeholder: estado === 'Devolvido' ? 'Ex.: conferir a espécie e refazer a foto 1' : 'Ex.: registro duplicado' });
      const als = cache ? [...new Set(cache.linhas.filter((l) => uuids.includes(l.uuid)).flatMap((l) => l.__alertas || []))] : [];
      const sug = [...new Set(MOTIVO_ALERTA.filter(([r]) => als.some((a) => r.test(a))).map(([, m]) => m).concat(estado === 'Devolvido' ? ['Refazer as fotos (fora de foco ou sem a árvore inteira).'] : ['Registro duplicado.', 'Registro de teste.']))];
      const ok = await modal(estado === 'Devolvido' ? 'Devolver para a equipe' : 'Descartar', h('div', null, h('p', null, `${uuids.length} registro(s). Escreva o motivo${estado === 'Devolvido' ? ', que a equipe vê no aparelho' : ''}:`), sug.length ? h('div', { class: 'motivos' }, sug.map((m) => h('button', { class: 'chip', onclick: () => { t.value = t.value ? t.value + ' ' + m : m; } }, m))) : null, t), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: estado === 'Devolvido' ? 'Devolver' : 'Descartar', classe: estado === 'Descartado' ? 'perigo' : '', valor: true }]);
      if (!ok) return false; obs = t.value.trim(); if (!obs) { toast('Informe o motivo.'); return false; }
    } else if (uuids.length > 1 && !amostra && !(await confirmar('Validar registros', `Validar ${uuids.length} registro(s)? Depois de validados, a equipe não consegue mais alterar.`, 'Validar'))) return false;
    try {
      for (let i = 0; i < uuids.length; i += 500) await Api.b.validar(S.projeto.id, uuids.slice(i, i + 500).map((u) => ({ uuid: u, estado, obs, amostra: !!amostra })));
      const c = S.linhas[S.projeto.id]; const agora = agoraISO(); const set = new Set(uuids);
      if (c) for (const l of c.linhas) if (set.has(l.uuid)) Object.assign(l, { validacao: estado, validacao_obs: obs, validado_por: S.sessao.u, validado_em: agora });
      S.painel = null;
      const desfazer = Object.keys(antes).length ? { texto: 'Desfazer', fn: async () => { try { const its = Object.entries(antes).map(([u, a]) => ({ uuid: u, estado: a.st, obs: a.validacao_obs, desfazer: { validacao_obs: a.validacao_obs, validado_por: a.validado_por, validado_em: a.validado_em } })); for (let k = 0; k < its.length; k += 500) await Api.b.validar(S.projeto.id, its.slice(k, k + 500)); if (c) for (const l of c.linhas) if (antes[l.uuid]) { const a = antes[l.uuid]; Object.assign(l, { validacao: a.st, validacao_obs: a.validacao_obs, validado_por: a.validado_por, validado_em: a.validado_em }); } S.painel = null; toast('Desfeito.'); if (location.hash.startsWith('#validacao')) telaValidacao(); } catch (er) { toast('Não foi possível desfazer: ' + er.message, 5000); } } } : null;
      const nome = { Validado: 'validado(s)', Devolvido: 'devolvido(s)', Descartado: 'descartado(s)' }[estado] || estado.toLowerCase();
      toast(`${uuids.length} registro(s) ${nome}.`, 2600, desfazer); return true;
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
      if (/cap/i.test(c.nome) && v > 628) a.push('CAP alto: ' + numBR(Math.round(v)) + ' cm');
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
    const corpo = h('main', { class: 'validacao' }, h('div', { class: 'info' }, 'Carregando registros...'), esboco(''));
    $app.replaceChildren(topo('Validação', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('div', { class: 'topo-dir' }, ajudaBt('validacao'), h('button', { class: 'gps', onclick: () => telaValidacao(true) }, 'Atualizar'))), corpo);
    let linhas; try { linhas = await linhasProjeto(forcar, (n, t) => { const i = corpo.querySelector('.info'); if (i) i.textContent = `Carregando registros: ${fmtN(n)}${t ? ' de ' + fmtN(t) : ''}...`; }); } catch (e) { corpo.replaceChildren(h('div', { class: 'aviso' }, e.message)); return; }
    const cont = {}; linhas.forEach((l) => { const k = cc ? String(l[cc.nome] || '') : ''; if (k) cont[k] = (cont[k] || 0) + 1; });
    const dups = new Set(Object.keys(cont).filter((k) => cont[k] > 1));
    linhas.forEach((l) => { l.__alertas = alertasDe(l, form, dups); l.validacao = l.validacao || 'Pendente'; });
    const F = S.filtroVal = Object.assign({ sit: 'revisar', eq: '', alerta: '', q: '', limite: 100, per: '', ordem: 'antigos' }, S.filtroVal || {});
    const sel = new Set();
    const selSit = h('select', { class: 'entrada' }, [['revisar', 'A revisar'], ['Pendente', 'Aguardando validação'], ['Corrigido', 'Corrigidos'], ['Devolvido', 'Devolvidos'], ['Validado', 'Validados'], ['Descartado', 'Descartados'], ['', 'Todos']].map(([v, t]) => h('option', { value: v, selected: F.sit === v }, t)));
    const eqs = [...new Set(linhas.map((l) => l.equipe || ''))].filter(Boolean).sort();
    const selEq = h('select', { class: 'entrada' }, h('option', { value: '' }, 'Todas as equipes'), eqs.map((e) => h('option', { value: e, selected: F.eq === e }, e)));
    const selAl = h('select', { class: 'entrada' }, [['', 'Com e sem alerta'], ['com', 'Só com alerta'], ['sem', 'Só sem alerta']].map(([v, t]) => h('option', { value: v, selected: F.alerta === v }, t)));
    const busca = h('input', { class: 'entrada', placeholder: 'Código ou espécie', value: F.q });
    const selPer = h('select', { class: 'entrada', 'aria-label': 'Período' }, [['', 'Todo o período'], ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', 'Últimos 7 dias']].map(([v, t]) => h('option', { value: v, selected: F.per === v }, t)));
    const selOrd = h('select', { class: 'entrada', 'aria-label': 'Ordem' }, [['antigos', 'Mais antigos primeiro'], ['novos', 'Mais novos primeiro'], ['alerta', 'Com alerta primeiro']].map(([v, t]) => h('option', { value: v, selected: F.ordem === v }, t)));
    const dHoje = diaLocal(agoraISO()), dOntem = diaLocal(new Date(Date.now() - 864e5).toISOString()), d7 = diaLocal(new Date(Date.now() - 6 * 864e5).toISOString());
    const okPer = (l) => { if (!F.per) return true; const d = diaLocal(l.criado_em); return F.per === 'hoje' ? d === dHoje : F.per === 'ontem' ? d === dOntem : d >= d7; };
    const resumo = h('div', { class: 'val-resumo' }); const lista = h('div', { class: 'val-lista' }); const acoes = h('div', { class: 'val-acoes' });
    const filtradas = () => linhas.filter((l) => (F.sit === 'revisar' ? ['Pendente', 'Corrigido'].includes(l.validacao) : !F.sit || l.validacao === F.sit) && (!F.eq || l.equipe === F.eq)
      && (!F.alerta || (F.alerta === 'com' ? l.__alertas.length : !l.__alertas.length)) && okPer(l) && (!F.q || norm((cc ? l[cc.nome] : '') + ' ' + (ce ? l[ce.nome] : '')).includes(norm(F.q))))
      .sort((a, b) => (F.ordem === 'alerta' ? (b.__alertas.length ? 1 : 0) - (a.__alertas.length ? 1 : 0) : 0) || (F.ordem === 'novos' ? String(b.criado_em).localeCompare(String(a.criado_em)) : String(a.criado_em).localeCompare(String(b.criado_em))));
    function desenhar() {
      const vis = filtradas(); S.navVal = vis.map((l) => l.uuid);
      const c = {}; linhas.forEach((l) => (c[l.validacao] = (c[l.validacao] || 0) + 1));
      resumo.replaceChildren(...['Pendente', 'Corrigido', 'Devolvido', 'Validado', 'Descartado'].map((k) => h('button', { class: 'val-chip' + (F.sit === k ? ' sel' : ''), style: `border-color:${COR_VAL[k]}`, onclick: () => { selSit.value = F.sit === k ? 'revisar' : k; mudou(); } }, h('b', null, fmtN(c[k] || 0)), ' ', ROT_CURTO[k])));
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
      const vis = filtradas(); const semAlerta = vis.filter((l) => !l.__alertas.length && ['Pendente', 'Corrigido'].includes(l.validacao)).map((l) => l.uuid); // nunca valida descartados ou devolvidos em lote
      acoes.replaceChildren(h('label', { class: 'tudo' }, h('input', { type: 'checkbox', checked: vis.length && vis.slice(0, F.limite).every((l) => sel.has(l.uuid)), onchange: (e) => { vis.slice(0, F.limite).forEach((l) => (e.target.checked ? sel.add(l.uuid) : sel.delete(l.uuid))); desenhar(); } }), ' Marcar os visíveis'),
        h('button', { class: 'btn peq', disabled: !sel.size, onclick: () => validarSel() }, `Validar (${sel.size})`),
        h('button', { class: 'btn sec peq', disabled: !sel.size, onclick: () => aplicar('Devolvido', [...sel]) }, 'Devolver'),
        h('button', { class: 'btn perigo peq', disabled: !sel.size, onclick: () => aplicar('Descartado', [...sel]) }, 'Descartar'),
        semAlerta.length ? h('button', { class: 'btn sec peq', onclick: () => validarLote(semAlerta) }, `Validar todos sem alerta (${fmtN(semAlerta.length)})`) : null);
    }
    // validar os marcados: se algum tem alerta, avisa e oferece validar só os sem alerta
    async function validarSel() {
      const marc = linhas.filter((l) => sel.has(l.uuid)); const comAl = marc.filter((l) => l.__alertas.length);
      if (!comAl.length) return aplicar('Validado', [...sel]);
      const v = await modal('Validar', h('p', null, `${pl(comAl.length, 'dos marcados tem alerta', 'dos marcados têm alerta')} (${[...new Set(comAl.flatMap((l) => l.__alertas))].slice(0, 3).join(', ')}).`), [{ texto: `Validar só os sem alerta (${fmtN(marc.length - comAl.length)})`, valor: 'sem' }, { texto: `Validar todos (${fmtN(marc.length)})`, valor: 'todos', classe: 'sec' }, { texto: 'Cancelar', valor: null, classe: 'sec' }]);
      if (v === 'todos') return aplicar('Validado', [...sel]);
      if (v === 'sem') { const us = marc.filter((l) => !l.__alertas.length).map((l) => l.uuid); if (!us.length) return toast('Todos os marcados têm alerta.'); return aplicar('Validado', us); }
    }
    async function validarLote(uuids) {
      const n = Math.max(1, Math.ceil(uuids.length * 0.05));
      const abertas = uuids.filter((u) => (S.fichasAbertas || new Set()).has(u)).length; // amostra contada pelas fichas abertas nesta sessão
      const cb = h('input', { type: 'checkbox', checked: abertas >= n });
      const ok = await modal('Validar em lote', h('div', null, h('p', null, `${fmtN(uuids.length)} registros sem alerta. Antes de validar em lote, confira por amostragem pelo menos ${fmtN(n)} deles (5%), abrindo a ficha e as fotos.`), h('p', { class: abertas >= n ? 'info' : 'aviso' }, `Você abriu ${pl(abertas, 'ficha', 'fichas')} destes registros${abertas >= n ? ': amostra feita.' : `. Faltam ${fmtN(n - abertas)}.`}`), h('label', null, cb, ` Conferi uma amostra de pelo menos ${fmtN(n)} registros`)), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Validar', valor: true }]);
      if (!ok) return; if (!cb.checked) return toast('Marque a confirmação da amostra conferida.');
      if (await decidirRegistros('Validado', uuids, true)) desenhar();
    }
    const mudou = () => { F.sit = selSit.value; F.eq = selEq.value; F.alerta = selAl.value; F.q = busca.value; F.per = selPer.value; F.ordem = selOrd.value; F.limite = 100; sel.clear(); desenhar(); pintarBtF(); };
    [selSit, selEq, selAl, selPer, selOrd].forEach((x) => x.addEventListener('change', mudou)); let tb; busca.addEventListener('input', () => { clearTimeout(tb); tb = setTimeout(mudou, 250); });
    // no celular os filtros ficam numa folha que abre pelo botão "Filtros (n)"
    const estreito = window.innerWidth < 700; const caixaF = h('div', { class: 'val-filtros' + (estreito && !S.valFiltrosAbertos ? ' oculto' : '') }, selSit, selEq, selAl, selPer, selOrd);
    const btF = h('button', { class: 'btn sec peq' + (estreito ? '' : ' oculto'), onclick: () => { S.valFiltrosAbertos = !S.valFiltrosAbertos; caixaF.classList.toggle('oculto', !S.valFiltrosAbertos); pintarBtF(); } });
    const pintarBtF = () => { const n = [F.sit !== 'revisar', F.eq, F.alerta, F.per, F.ordem !== 'antigos'].filter(Boolean).length; btF.textContent = S.valFiltrosAbertos ? 'Esconder filtros' : 'Filtros' + (n ? ` (${n})` : ''); };
    pintarBtF();
    corpo.replaceChildren(resumo, h('div', { class: 'val-busca' }, busca, btF), caixaF, acoes, lista);
    desenhar();
  }
  const idDrive = (u) => { const m = String(u || '').match(/\/d\/([\w-]{20,})/) || String(u || '').match(/id=([\w-]{20,})/); return m ? m[1] : null; };
  async function telaFichaServidor(uuidR) {
    const form = S.form;
    let linhas; try { linhas = await linhasProjeto(false); } catch (e) { return toast(e.message); }
    const l = linhas.find((x) => x.uuid === uuidR); if (!l) { toast('Registro não encontrado.'); return ir(ehCoord() ? '#validacao' : '#painel'); }
    const valores = {}; for (const c of form.campos) { let v = l[c.nome]; if (c.tipo === 'bool') v = v === 1 || v === '1' || v === true; valores[c.nome] = v; }
    const fotos = form.campos.filter((c) => c.tipo === 'photo' && l[c.nome]).map((c) => { const link = linkSeguro(l[c.nome + ' link']); const id = idDrive(link); return { rotulo: c.rotulo + (link ? '' : ' (ainda não enviada)'), src: null, link: link || '', drive: id || '' }; });
    const nav = S.navVal || []; const i = nav.indexOf(uuidR);
    const irPara = (k) => { if (k >= 0 && k < nav.length) ir('#ficha/' + encodeURIComponent(nav[k])); };
    const cc = campoCodigo(form);
    const decidir = async (estado) => { if (S.decidindo) return; S.decidindo = true; let ok; try { ok = await decidirRegistros(estado, [uuidR]); } finally { S.decidindo = false; } if (!ok) return; if (i >= 0 && i + 1 < nav.length) irPara(i + 1); else ir('#validacao'); };
    (S.fichasAbertas = S.fichasAbertas || new Set()).add(uuidR);
    if (!l.__alertas) { const ccx = campoCodigo(form); const cont = {}; linhas.forEach((x) => { const k = ccx ? String(x[ccx.nome] || '') : ''; if (k) cont[k] = (cont[k] || 0) + 1; }); l.__alertas = alertasDe(l, form, new Set(Object.keys(cont).filter((k) => cont[k] > 1))); }
    // atalhos no computador: V valida, D devolve, setas navegam
    if (ehCoord()) { if (S.atalhoFicha) document.removeEventListener('keydown', S.atalhoFicha); S.atalhoFicha = (e) => { if (!location.hash.startsWith('#ficha/') || document.querySelector('.veu') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) return; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || S.decidindo) return; const k = e.key.toLowerCase(); if (k === 'v') decidir('Validado'); else if (k === 'd') decidir('Devolvido'); else if (e.key === 'ArrowRight') irPara(i + 1); else if (e.key === 'ArrowLeft') irPara(i - 1); }; document.addEventListener('keydown', S.atalhoFicha); }
    const mapaDiv = h('div', { class: 'mapa-mini', style: 'height:220px' });
    $app.replaceChildren(topo((cc && l[cc.nome]) || 'Registro', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir(ehCoord() ? '#validacao' : '#mapa'), 'aria-label': 'Voltar' }, ico('voltar')), nav.length && ehCoord() ? h('span', { class: 'nav-n' }, `${fmtN(i + 1)} de ${fmtN(nav.length)}`) : null),
      h('main', { class: 'ficha-servidor' },
        h('div', { class: 'cartao status-ficha st-' + norm(l.validacao || 'pendente') }, h('b', null, ROT_VAL[l.validacao || 'Pendente'] || l.validacao),
          l.validacao_obs ? h('p', null, 'Motivo: ' + l.validacao_obs) : null,
          h('small', null, `${dataBR(l.criado_em)} · ${l.equipe || ''}${l.usuario ? ' (' + l.usuario + ')' : ''}${l.precisao_gps_m ? ' · GPS ±' + Math.round(l.precisao_gps_m) + ' m' : ''}${l.validado_por ? ' · avaliado por ' + l.validado_por + ' em ' + dataBR(l.validado_em) : ''}`),
          l.__alertas && l.__alertas.length ? h('p', { class: 'al' }, 'Alertas: ' + l.__alertas.join(' · ')) : null),
        l.latitude !== '' && l.latitude != null ? h('div', { class: 'cartao' }, mapaDiv, h('a', { href: `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`, target: '_blank', rel: 'noopener' }, 'Abrir no Google Maps')) : null,
        fichaConteudo(form, valores, fotos),
        secaoOSArvore(uuidR, true),
        l.historico ? h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Histórico de alterações'), String(l.historico).split(' | ').map((x) => h('p', { class: 'hist' }, x))) : null,
        ehCoord() ? h('button', { class: 'link-perigo', style: 'margin:4px 0 90px', onclick: () => decidir('Descartado') }, 'Descartar este registro') : null,
        ehCoord() ? h('footer', { class: 'rodape val-dec' },
          h('button', { class: 'btn sec ic-nav', disabled: i <= 0, onclick: () => irPara(i - 1), 'aria-label': 'Anterior', title: 'Anterior (seta para a esquerda)' }, ico('esq')),
          h('button', { class: 'btn sec', style: 'flex:1', onclick: () => decidir('Devolvido'), title: 'Devolver (D)' }, 'Devolver'),
          h('button', { class: 'btn', style: 'flex:1.4', onclick: () => decidir('Validado'), title: 'Validar (V)' }, ico('check'), 'Validar'),
          h('button', { class: 'btn sec ic-nav', disabled: i < 0 || i >= nav.length - 1, onclick: () => irPara(i + 1), 'aria-label': 'Próximo', title: 'Próximo (seta para a direita)' }, ico('dir'))) : null));
    // destaca na ficha o campo que gerou o alerta
    const ALVO_ALERTA = [[/Altura/, /altura/i], [/DAP|CAP/, /cap|dap/i], [/espécie/i, /especie/i]];
    for (const a of l.__alertas || []) for (const [ra, rc] of ALVO_ALERTA) if (ra.test(a)) document.querySelectorAll('.ficha-sec .fl[data-campo]').forEach((el) => { if (rc.test(norm(el.dataset.campo || ''))) el.classList.add('campo-alerta'); });
    if (!Api.demo) setTimeout(() => document.querySelectorAll('.ficha-foto[data-drive]').forEach(async (a) => { try { const b = await Api.b.fotoVer(S.projeto.id, a.dataset.drive); const img = h('img', { src: URL.createObjectURL(b), alt: '', loading: 'lazy' }); a.querySelector('img') ? a.querySelector('img').replaceWith(img) : a.prepend(img); } catch (e) { /* sem permissão ou sem conexão: fica o link */ } }), 30);
    if (l.latitude !== '' && l.latitude != null) setTimeout(() => { const m = L.map(mapaDiv, { zoomControl: false }).setView([+l.latitude, +l.longitude], 19); camadasFundo(m, true); L.circleMarker([+l.latitude, +l.longitude], { radius: 8, color: '#fff', weight: 2, fillColor: '#E10000', fillOpacity: 1 }).addTo(m); }, 50);
  }

  // ---------- Ordens de serviço ----------
  // Fluxo: Solicitada (pedido do cliente ou da equipe) > Aberta > Em execução > Concluída, ou Cancelada.
  // Sem internet, o pedido e a execução ficam numa fila no aparelho e sobem no próximo envio.
  const TIPOS_OS_PADRAO = ['Poda de limpeza', 'Poda de levantamento de copa', 'Poda de adequação à rede elétrica', 'Poda de condução', 'Supressão', 'Remoção de toco', 'Plantio', 'Substituição', 'Tratamento fitossanitário', 'Avaliação de risco', 'Outro'];
  const PRIOR_OS = ['Urgente', 'Alta', 'Média', 'Baixa'];
  const OS_SEM_ANTES = ['Plantio', 'Avaliação de risco'];
  const COR_OS = { Solicitada: '#CC79A7', Aberta: '#E69F00', 'Em execução': '#0072B2', 'Concluída': '#1B7F3B', Cancelada: '#90A4AE' };
  const numOS = (o) => (o.numero ? 'OS ' + String(o.numero).padStart(4, '0') : 'Nova ordem');
  const hojeISO = () => diaLocal(agoraISO());
  const atrasada = (o) => !!o.prazo && ['Aberta', 'Em execução', 'Solicitada'].includes(o.status) && o.prazo < hojeISO();
  const ehMinhaOS = (o) => perfil() === 'coletor' && o.responsavel && o.responsavel === (S.projeto.equipe || S.sessao.usuario.equipe);
  const podeExecutar = (o) => ehCoord() || ehMinhaOS(o);
  async function filaTodaOS() { return (await Store.get('osfila')) || []; }
  async function filaOS() { const u = S.sessao && S.sessao.u; return (await filaTodaOS()).filter((x) => !x.usuario || x.usuario === u); }
  async function mexerFilaOS(fn) { const toda = await filaTodaOS(); const u = S.sessao && S.sessao.u; const minha = toda.filter((x) => !x.usuario || x.usuario === u); const outras = toda.filter((x) => x.usuario && x.usuario !== u); const n = (await fn(minha)) || minha; await Store.set('osfila', [...outras, ...n]); return n; }
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
      if (it.recusado) continue; // não aceito pelo servidor: vale a situação que está lá
      if (it.etapa === 'iniciar' && o.status === 'Aberta') o.status = 'Em execução';
      if (it.etapa === 'concluir') { o.status = 'Concluída'; o.execucao_obs = it.dados.obs || ''; o.__pendConcluir = true; }
      if (it.etapa !== 'iniciar' && it.etapa !== 'concluir') o.__pendCoord = true;
      if (it.fotos) o.__fotos = Object.assign(o.__fotos || {}, it.fotos);
    }
    return { ordens, tipos: (c.tipos && c.tipos.length) ? c.tipos : TIPOS_OS_PADRAO, em: c.em, semServidor: !!c.semServidor };
  }
  // tenta mandar na hora; sem internet (ou servidor fora do ar) guarda na fila do aparelho
  async function enviarOS(item) {
    item.chave = item.chave || uuid(); item.projeto = S.projeto.id; item.usuario = S.sessao.u; item.dados.em = item.dados.em || agoraISO();
    if (navigator.onLine && !S.expirada) {
      try { const r = await mandarItemOS(item); S.osEm = null; if (r && r.aviso) toast(r.aviso, 6000); return { ok: true, ordem: r && r.ordem, aviso: r && r.aviso }; } catch (e) {
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
      try { const r = await mandarItemOS(it); await mexerFilaOS((f) => f.filter((y) => y.chave !== it.chave)); ok++; if (r && r.aviso) { falhas++; erro = r.aviso; } } catch (e) {
        if (e.sessao) break; falhas++; erro = e.message;
        const final = !/Sem conexão|Servidor respondeu 5/i.test(e.message);
        await mexerFilaOS((f) => { const x = f.find((y) => y.chave === it.chave); if (x) { x.erro = e.message; if (final) x.recusado = true; } });
      }
    }
    S.osEm = null;
    if (ok || falhas) if (!silencioso || falhas) toast(falhas ? `Ordens de serviço: ${ok} enviada(s), ${falhas} com problema: ${erro}` : `${ok} atualização(ões) de ordem de serviço enviada(s).`, falhas ? 5000 : 2600);
  }
  async function nFilaOS() { return (await filaOS()).filter((x) => !x.recusado).length; }

  function etiquetaOS(o) { return h('span', { class: 'os-st', style: `background:${COR_OS[o.status] || '#8A969C'}` }, o.status + (o.__erro && o.__pend ? ' · não aceito' : o.__pend ? ' · a enviar' : '')); }
  function itemOS(o) {
    const local = o.codigo_arvore ? `Árvore ${o.codigo_arvore}` : (o.endereco || 'Ponto no mapa');
    return h('button', { class: 'os-item' + (atrasada(o) ? ' atrasada' : ''), onclick: () => ir('#os/' + encodeURIComponent(o.id)) },
      h('div', { class: 'os-l1' }, h('b', null, numOS(o)), h('span', null, o.tipo), etiquetaOS(o)),
      h('div', { class: 'os-l2' }, local, o.especie ? h('i', null, ' · ' + o.especie) : null, o.bairro ? ' · ' + o.bairro : ''),
      h('small', { class: 'os-l3' }, ['Prioridade ' + String(o.prioridade || 'Média').toLowerCase(), o.prazo ? 'prazo ' + o.prazo.split('-').reverse().join('/') : '', perfil() === 'cliente' ? '' : o.responsavel || 'sem equipe definida'].filter(Boolean).join(' · '), atrasada(o) ? h('b', { class: 'os-atraso' }, ' · Atrasada') : null),
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
    const novo = ehCoord() ? 'Nova ordem' : 'Solicitar serviço';
    $app.replaceChildren(topo('Ordens de serviço', S.projeto.nome, voltar, h('div', { class: 'topo-dir' }, ajudaBt('ordens'), h('button', { class: 'ic', onclick: () => { S.corMapa = 'os'; ir('#mapa'); }, 'aria-label': 'Mapa' }, ico('mapa')))),
      h('main', null, h('button', { class: 'btn nova canto', onclick: () => ir('#os-nova') }, ico('mais'), novo), filtros, h('div', { class: 'grade2 os-busca' }, busca, selTipo), lista));
    const d = await carregarOS(true);
    if (!document.body.contains(lista)) return;
    if (d.semServidor) { lista.replaceChildren(h('div', { class: 'aviso' }, 'O servidor do projeto ainda está numa versão sem ordens de serviço. A coordenação precisa atualizar o servidor (versão 2.2).')); return; }
    selTipo.replaceChildren(h('option', { value: '' }, 'Todos os tipos'), d.tipos.map((t) => h('option', { value: t }, t)));
    const resps = [...new Set(d.ordens.map((o) => o.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
    const selResp = h('select', { class: 'entrada' + (ehCoord() && resps.length ? '' : ' oculto') }, h('option', { value: '' }, 'Todas as equipes'), resps.map((r) => h('option', { value: r }, r)));
    lista.before(h('div', { class: 'os-busca' }, selResp));
    // poucos filtros: A fazer, Atrasadas, Concluídas e Todas (mais Pedidos para a coordenação quando há pedido a aprovar); cliente acompanha os pedidos
    const todosG = { fazer: ['fazer', 'A fazer', (o) => ['Aberta', 'Em execução'].includes(o.status)], abertas: ['abertas', 'Em aberto', (o) => ['Solicitada', 'Aberta', 'Em execução'].includes(o.status)], solicitadas: ['solicitadas', 'Pedidos a aprovar', (o) => o.status === 'Solicitada'], atrasadas: ['atrasadas', 'Atrasadas', atrasada], concluidas: ['concluidas', 'Concluídas', (o) => o.status === 'Concluída'], todas: ['todas', 'Todas', () => true] };
    const grupos = (pf === 'cliente' ? ['abertas', 'concluidas', 'todas'] : pf === 'coletor' ? ['fazer', 'atrasadas', 'concluidas', 'todas'] : ['fazer', 'solicitadas', 'atrasadas', 'concluidas', 'todas']).map((k) => todosG[k]).filter((g) => g[0] !== 'solicitadas' || d.ordens.some(g[2]));
    if (!grupos.some((g) => g[0] === S.filtroOS)) S.filtroOS = grupos[0][0];
    const pintar = () => {
      const g = grupos.find((x) => x[0] === S.filtroOS) || grupos[0];
      filtros.replaceChildren(grupos.map(([k, t, f]) => h('button', { class: 'chip' + (k === g[0] ? ' sel' : ''), onclick: () => { S.filtroOS = k; pintar(); } }, `${t} (${d.ordens.filter(f).length})`)));
      const q = norm(busca.value).trim();
      const vis = d.ordens.filter(g[2]).filter((o) => !selTipo.value || o.tipo === selTipo.value).filter((o) => !selResp.value || o.responsavel === selResp.value).filter((o) => !q || norm([numOS(o), o.numero, o.codigo_arvore, o.especie, o.endereco, o.bairro, o.descricao, o.responsavel].join(' ')).includes(q)).sort(ordenarOS);
      lista.replaceChildren(vis.length ? vis.slice(0, 500).map(itemOS) : h('div', { class: 'vazio-lista' }, d.ordens.length ? 'Nenhuma ordem neste filtro.' : pf === 'coletor' ? 'Nenhuma ordem de serviço para a sua equipe.' : 'Nenhuma ordem de serviço ainda. Abra uma pela ficha da árvore ou pelo botão acima.'));
    };
    busca.addEventListener('input', pintar); selTipo.addEventListener('change', pintar); selResp.addEventListener('change', pintar); pintar();
  }

  // foto de antes ou depois: tira, reduz e guarda no aparelho até enviar
  function campoFotoOS(rotulo, alvo, k) {
    const img = h('div', { class: 'os-foto-vazia' }, 'Sem foto');
    const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto', onchange: async () => {
      const arq = cam.files && cam.files[0]; if (!arq) return;
      try {
        const blob = await reduzir(arq, 0, 0.92); const chave = 'os-' + uuid();
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
        if (etapa === 'iniciar' && !temAntes && !fotos.foto_antes && !OS_SEM_ANTES.includes(o.tipo)) return falta('foto_antes', 'Tire a foto de antes do serviço.');
        if (etapa === 'concluir') {
          if (!temAntes && !fotos.foto_antes && !OS_SEM_ANTES.includes(o.tipo)) return falta('foto_antes', 'Falta a foto de antes do serviço.');
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
    const ativo = ['Aberta', 'Em execução'].includes(o.status) && podeExecutar(o) && !o.__pendConcluir && !o.__pendCoord && !o.__erro;
    const temAntes = !!(o.foto_antes || (o.__fotos && o.__fotos.foto_antes));
    const hist = String(o.historico || '').split(' | ').filter(Boolean);
    $app.replaceChildren(topo(numOS(o), o.tipo, h('button', { class: 'ic', onclick: () => ir('#ordens'), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        h('div', { class: 'cartao os-cab', style: `border-left:6px solid ${COR_OS[o.status] || '#8A969C'}` }, h('div', { class: 'os-l1' }, h('b', null, o.tipo), etiquetaOS(o)),
          h('div', { class: 'os-dados' }, linha('Prioridade', o.prioridade), linha('Prazo', o.prazo ? o.prazo.split('-').reverse().join('/') + (atrasada(o) ? ' (atrasada)' : '') : ''), perfil() === 'cliente' ? null : linha('Equipe responsável', o.responsavel || 'A definir'),
            linha('Pedido por', o.solicitada_por ? `${o.solicitada_por} em ${dataAno(o.solicitada_em)}` : ''), linha('Aberta por', o.aberta_por ? `${o.aberta_por} em ${dataAno(o.aberta_em)}` : ''),
            linha('Iniciada', o.iniciada_em ? `${dataAno(o.iniciada_em)} por ${o.iniciada_por}` : ''), linha('Concluída', o.concluida_em ? `${dataAno(o.concluida_em)} por ${o.concluida_por}` + (o.prazo && o.status === 'Concluída' && diaLocal(o.concluida_em) > o.prazo ? ' (depois do prazo)' : '') : ''),
            o.status === 'Cancelada' ? linha('Cancelada', `${dataAno(o.cancelada_em)} por ${o.cancelada_por}`) : null,
            o.status === 'Cancelada' ? linha('Motivo do cancelamento', o.motivo) : o.motivo ? linha('Motivo da reabertura', o.motivo) : null),
          o.descricao ? h('p', { class: 'os-desc' }, o.descricao) : null,
          o.__erro ? h('p', { class: 'trava' }, 'Não foi aceito pelo servidor: ' + o.__erro) : null),
        h('section', { class: 'cartao' }, h('h3', null, o.codigo_arvore ? 'Árvore ' + o.codigo_arvore : 'Local do serviço'),
          o.especie ? h('p', null, h('i', null, o.especie)) : null, o.endereco || o.bairro ? h('p', null, [o.endereco, o.bairro].filter(Boolean).join(' · ')) : null,
          temPonto ? mapaDiv : null,
          h('div', { class: 'linha-btn quebra' }, temPonto ? h('a', { class: 'btn sec peq', href: `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`, target: '_blank', rel: 'noopener' }, 'Como chegar') : null,
            o.registro_uuid && perfil() !== 'coletor' ? h('button', { class: 'btn sec peq', onclick: () => { S.navVal = []; ir('#ficha/' + encodeURIComponent(o.registro_uuid)); } }, 'Ficha da árvore') : null)),
        h('section', { class: 'cartao' }, h('h3', null, 'Execução'),
          ativo ? h('div', { class: 'grade2' }, temAntes ? h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de antes'), fa) : campoFotoOS('Foto de antes' + (OS_SEM_ANTES.includes(o.tipo) ? ' (opcional)' : ''), fotos, 'foto_antes'), campoFotoOS('Foto de depois', fotos, 'foto_depois'))
            : h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de antes'), fa), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Foto de depois'), fd)),
          ativo ? h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Observação da execução'), obs) : o.execucao_obs ? h('p', null, o.execucao_obs) : null,
          ativo ? h('div', { class: 'linha-btn' }, o.status === 'Aberta' ? h('button', { class: 'btn sec', onclick: () => exec('iniciar') }, 'Iniciar serviço') : null, h('button', { class: 'btn', onclick: () => exec('concluir') }, 'Concluir serviço')) : null,
          !ativo && ['Aberta', 'Em execução'].includes(o.status) && !podeExecutar(o) && perfil() !== 'cliente' ? h('p', { class: 'dica' }, o.responsavel ? `A execução é registrada pela ${o.responsavel}.` : 'A coordenação ainda vai definir a equipe.') : null,
          o.status === 'Solicitada' ? h('p', { class: 'dica' }, 'Pedido aguardando aprovação da coordenação.') : null),
        hist.length ? h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Histórico'), hist.map((x) => h('p', { class: 'hist' }, x))) : null,
        ehCoord() && !o.__pend ? h('div', { class: 'linha-btn quebra', style: 'margin:8px 0 30px' },
          o.status === 'Solicitada' ? h('button', { class: 'btn', onclick: () => exec('aprovar') }, 'Aprovar pedido') : null,
          ['Solicitada', 'Aberta', 'Em execução'].includes(o.status) ? h('button', { class: 'btn sec', onclick: editar }, 'Alterar') : null,
          ['Solicitada', 'Aberta', 'Em execução'].includes(o.status) ? h('button', { class: 'btn perigo', onclick: () => exec('cancelar') }, 'Cancelar ordem') : null,
          ['Concluída', 'Cancelada'].includes(o.status) ? h('button', { class: 'btn sec', onclick: () => exec('reabrir') }, 'Reabrir') : null) : null,
        o.__erro && o.__pend ? h('div', { class: 'linha-btn' }, h('button', { class: 'btn perigo peq', onclick: async () => { await mexerFilaOS(async (f) => { for (const y of f.filter((y) => y.id === o.id || y.dados.chave === o.id || y.dados.id === o.id)) for (const ft of Object.values(y.fotos || {})) if (ft && ft.chave) await Store.apagarFoto(ft.chave); return f.filter((y) => !(y.id === o.id || y.dados.chave === o.id || y.dados.id === o.id)); }); toast('Removido do aparelho.'); ir('#ordens'); } }, 'Remover do aparelho')) : null));
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
      if (!arv && !ponto) { mapaDiv.scrollIntoView({ block: 'center', behavior: 'smooth' }); mapaDiv.classList.add('destaque-mapa'); setTimeout(() => mapaDiv.classList.remove('destaque-mapa'), 1600); return toast('Toque no mapa para marcar o local do serviço.'); }
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
    $app.replaceChildren(topo(pf === 'cliente' ? 'Solicitar serviço' : coord ? 'Nova ordem de serviço' : 'Solicitar serviço', S.projeto.nome, h('button', { class: 'ic', onclick: () => history.back(), 'aria-label': 'Voltar' }, ico('voltar')), null),
      h('main', null,
        arv ? h('div', { class: 'cartao' }, h('h3', null, 'Árvore ' + (arv.cod || '')), arv.esp ? h('p', null, h('i', null, arv.esp)) : null, arv.local ? h('p', { class: 'trava' }, 'Este registro ainda não foi enviado. Envie antes de pedir o serviço.') : null)
          : h('div', { class: 'cartao' }, h('h3', null, 'Local do serviço'),
            coord ? (() => { const ci = h('input', { class: 'entrada', placeholder: 'Código da árvore (ex.: E1-0042)', autocapitalize: 'characters' }); const usar = async () => { const q = norm(ci.value).trim(); if (!q) return; try { const ccx = campoCodigo(S.form); const l = (await linhasProjeto(false)).find((x) => ccx && norm(x[ccx.nome]) === q); if (!l) return toast('Nenhuma árvore com esse código.'); ir('#os-nova/' + encodeURIComponent(l.uuid)); } catch (e) { toast(e.message, 5000); } }; ci.addEventListener('keydown', (e) => e.key === 'Enter' && usar()); return h('div', { class: 'campo os-por-codigo' }, h('label', { class: 'rot' }, 'Árvore já cadastrada'), h('div', { class: 'linha-btn' }, ci, h('button', { class: 'btn sec peq', onclick: usar }, 'Usar esta árvore'))); })() : null,
            h('p', { class: 'dica' }, coord ? 'Ou toque no mapa para marcar um local sem árvore cadastrada.' : 'Toque no mapa para marcar o ponto. Para uma árvore já cadastrada, abra o pedido pela ficha dela.'), mapaDiv, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Endereço ou referência'), end)),
        h('div', { class: 'cartao' },
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Tipo de serviço *'), tipo),
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prioridade'), chips),
          h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Descrição'), desc),
          coord ? h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe responsável'), resp, dl), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prazo'), prazo)) : h('p', { class: 'dica' }, 'A coordenação aprova o pedido e define a equipe e o prazo.')),
        h('div', { class: 'linha-btn', style: 'margin:8px 0 30px' }, h('button', { class: 'btn sec', onclick: () => history.back() }, 'Cancelar'), h('button', { class: 'btn', onclick: salvar }, pf === 'cliente' || !coord ? 'Enviar pedido' : 'Abrir ordem'))));
    if (coord) equipesProjeto().then((eqs) => dl.replaceChildren(eqs.map((e) => h('option', { value: e }))));
    if (!arv) setTimeout(() => {
      const c = ponto || S.pos || (() => { const ps = d.ordens.filter((o) => o.latitude !== '' && !isNaN(+o.latitude)); if (ps.length) return { lat: +ps[0].latitude, lon: +ps[0].longitude }; const ls = (S.linhas[S.projeto.id] || { linhas: [] }).linhas.filter((l) => l.latitude !== '' && !isNaN(+l.latitude)); return ls.length ? { lat: +ls[0].latitude, lon: +ls[0].longitude } : null; })();
      const m = L.map(mapaDiv, { maxZoom: 21 }).setView(c ? [c.lat, c.lon] : [-15.8, -47.9], c ? 18 : 4); camadasFundo(m, true);
      let mk = null; const marcar = (lat, lon) => { ponto = { lat, lon }; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon]).addTo(m); };
      m.on('click', (e) => marcar(e.latlng.lat, e.latlng.lng));
      if (S.pos && perfil() === 'coletor') marcar(S.pos.lat, S.pos.lon);
      // sem ponto conhecido (cliente no escritório): abre na cidade do projeto
      if (!ponto && perfil() === 'cliente') carregarQuadras().then((cam) => { if (!cam || !cam.quadras.length || !document.body.contains(mapaDiv)) return; let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const q of cam.quadras) b = [Math.min(b[0], q.b[0]), Math.min(b[1], q.b[1]), Math.max(b[2], q.b[2]), Math.max(b[3], q.b[3])]; m.fitBounds([[b[1], b[0]], [b[3], b[2]]]); }).catch(() => {});
    }, 50);
  }
  // seção "Ordens de serviço" da ficha de uma árvore
  function secaoOSArvore(uuidR, enviado) {
    const box = h('section', { class: 'cartao ficha-sec' }, h('h3', null, 'Ordens de serviço'), h('small', null, 'Carregando...'));
    (async () => {
      const d = await carregarOS(false); const os = d.ordens.filter((o) => o.registro_uuid === uuidR).sort((a, b) => (+b.numero || 1e9) - (+a.numero || 1e9));
      const pf = perfil(); const rot = pf === 'cliente' ? 'Solicitar serviço' : ehCoord() ? 'Abrir ordem de serviço' : 'Solicitar serviço para esta árvore';
      box.replaceChildren(h('h3', null, 'Ordens de serviço'), d.semServidor ? h('p', { class: 'dica' }, 'Disponível depois da atualização do servidor.') : null,
        os.length ? os.map(itemOS) : h('p', { class: 'dica' }, 'Nenhuma intervenção registrada nesta árvore.'),
        d.semServidor ? null : enviado ? h('button', { class: 'btn sec peq', style: 'margin-top:8px', onclick: () => ir('#os-nova/' + encodeURIComponent(uuidR)) }, rot) : h('p', { class: 'dica' }, 'Para pedir um serviço, envie o registro primeiro.'));
    })();
    return box;
  }

  // ---------- Quadras ----------
  // Camada de quadras do projeto (polígonos com número) e situação de cada uma: a levantar, em levantamento, levantada.
  const SIT_QD = ['A levantar', 'Em levantamento', 'Levantada'];
  const SIT_FC = ['A levantar', 'Em levantamento', 'Levantada', 'Levantada, sem árvores'];
  const FACE_FEITA = ['Levantada', 'Levantada, sem árvores'];
  const fmtKm = (m) => (m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
  const fmtM = (m) => (m >= 1000 ? fmtKm(m) : fmtN(Math.round(m)) + ' m');
  const COR_FC = { 'A levantar': '#78909C', 'Em levantamento': '#F2A900', Levantada: '#2E7D32', 'Levantada, sem árvores': '#6B85A3' }; // cinza-azulado tracejado: longe do teal das equipes
  const COR_QD = { 'A levantar': '#9AA9B0', 'Em levantamento': '#F2A900', Levantada: '#2E7D32' };
  const minhaEquipe = () => (S.projeto && S.projeto.equipe) || (S.sessao && S.sessao.usuario && S.sessao.usuario.equipe) || '';
  async function carregarQuadras() {
    const k = 'qd:' + S.projeto.id; let c = await Store.get(k);
    if (!Api.demo && navigator.onLine && !S.expirada && (!S.qdEm || S.qdEm.p !== S.projeto.id || Date.now() - S.qdEm.t > 600000)) {
      try {
        const j = await Api.b.quadrasCamada(S.projeto.id, c && c.versao); S.qdEm = { p: S.projeto.id, t: Date.now() };
        if (j.semCamada) { c = null; await Store.del(k); Store.set('qdtemfaces:' + S.projeto.id, false); S.qdTemFaces = null; } else if (!j.igual) { c = { versao: j.versao, camada: JSON.parse(j.camada) }; await Store.set(k, c); }
      } catch (e) { /* sem conexão ou servidor antigo: fica a cópia do aparelho */ }
    }
    if (Api.demo && !c) { const d = await Api.b.quadrasCamada(S.projeto.id); if (d && d.camada) c = { versao: d.versao, camada: JSON.parse(d.camada) }; }
    if (!c) return null;
    if (!S.qdIdx || S.qdIdx.v !== c.versao || S.qdIdx.p !== S.projeto.id) {
      S.qdIdx = { p: S.projeto.id, v: c.versao, idx: Quadras.indice(c.camada.quadras), porN: new Map(c.camada.quadras.map((q) => [q.n, q])) };
      const tem = c.camada.quadras.some((q) => q.f && q.f.length); S.qdTemFaces = tem ? S.projeto.id : null; Store.set('qdtemfaces:' + S.projeto.id, tem);
    }
    return c.camada;
  }
  async function filaTodaQd() { return (await Store.get('qdfila')) || []; }
  let travaFilaQd = Promise.resolve();
  function mexerFilaQd(fn) { const p = travaFilaQd.then(() => mexerFilaQd1(fn)); travaFilaQd = p.catch(() => {}); return p; }
  async function mexerFilaQd1(fn) { const toda = await filaTodaQd(); const u = S.sessao && S.sessao.u; const minha = toda.filter((x) => x.usuario === u); const n = (await fn(minha)) || minha; await Store.set('qdfila', [...toda.filter((x) => x.usuario !== u), ...n]); }
  async function nFilaQd() { const u = S.sessao && S.sessao.u; return (await filaTodaQd()).filter((x) => x.usuario === u && !x.recusado).length; }
  async function carregarSitQd(forcar, soLocal) {
    const k = 'qdsit:' + S.projeto.id; const c = (await Store.get(k)) || { quadras: [] };
    if (!soLocal && navigator.onLine && !S.expirada && (forcar || !S.qdSitEm || S.qdSitEm.p !== S.projeto.id || Date.now() - S.qdSitEm.t > 60000)) {
      try { const r = await Api.b.quadrasSituacao(S.projeto.id); c.quadras = r.quadras; c.faces = r.faces || []; await Store.set(k, c); S.qdSitEm = { p: S.projeto.id, t: Date.now() }; } catch (e) { /* sem conexão */ }
    }
    const m = new Map(c.quadras.map((q) => [q.numero, Object.assign({}, q)]));
    m.faces = new Map((c.faces || []).map((f) => [f.numero, Object.assign({}, f)]));
    const u = S.sessao && S.sessao.u;
    for (const it of (await filaTodaQd()).filter((x) => x.projeto === S.projeto.id && x.usuario === u && !x.recusado)) for (const i of it.itens) {
      if (i.tipo === 'face') {
        const f = m.faces.get(i.numero) || { numero: i.numero, situacao: 'A levantar', equipe: '' };
        if (i.auto && f.situacao !== 'A levantar') continue;
        if (i.situacao) { f.situacao = i.situacao; if (i.largura != null) f.largura = String(i.largura).replace(',', '.'); }
        if (i.equipe != null) f.equipe = i.equipe; else if (i.situacao === 'A levantar' && f.atribuida !== 'sim' && perfil() === 'coletor') f.equipe = ''; else if (!f.equipe && perfil() === 'coletor') f.equipe = minhaEquipe();
        f.__pend = true; m.faces.set(i.numero, f); continue;
      }
      const q = m.get(i.numero) || { numero: i.numero, situacao: 'A levantar', equipe: '' };
      if (i.situacao) q.situacao = i.situacao; if (i.equipe != null) q.equipe = i.equipe; else if (!q.equipe && perfil() === 'coletor') q.equipe = minhaEquipe();
      q.__pend = true; m.set(i.numero, q);
    }
    if (S.qdIdx && S.qdIdx.p === S.projeto.id) {
      const pendQ = new Set([...m.faces.values()].filter((f) => f.__pend).map((f) => f.numero.slice(0, f.numero.lastIndexOf('-'))));
      for (const n of pendQ) {
        const q = S.qdIdx.porN && S.qdIdx.porN.get(n); if (!q || !q.f) continue;
        const st = q.f.map((f) => (m.faces.get(n + '-' + f.i) || {}).situacao || 'A levantar'); const x = m.get(n) || { numero: n, situacao: 'A levantar', equipe: '' };
        const nova = st.every((v) => FACE_FEITA.includes(v)) ? 'Levantada' : st.some((v) => v !== 'A levantar') ? 'Em levantamento' : null;
        if (nova && x.situacao !== nova) { x.situacao = nova; x.__pend = true; m.set(n, x); }
      }
    }
    return m;
  }
  // marca na hora; sem internet guarda no aparelho
  async function marcarQuadras(itens) {
    const item = { chave: uuid(), usuario: S.sessao.u, projeto: S.projeto.id, itens: itens.map((i) => Object.assign({ em: agoraISO() }, i)) };
    if (navigator.onLine && !S.expirada) {
      try { const r = await Api.b.quadrasMarcar(item.projeto, item.itens); S.qdSitEm = null; return r; } catch (e) { if (!/Sem conexão|Servidor respondeu 5/i.test(e.message)) throw e; }
    }
    await mexerFilaQd((f) => { f.push(item); }); atualizarSync();
    return { fila: true, alteradas: itens.length, recusadas: [] };
  }
  async function enviarFilaQd(silencioso) {
    const u = S.sessao && S.sessao.u; const fila = (await filaTodaQd()).filter((x) => x.usuario === u && !x.recusado); if (!fila.length) return;
    let ok = 0, rec = [];
    for (const it of fila) {
      try { const r = await Api.b.quadrasMarcar(it.projeto, it.itens); rec = rec.concat(r.recusadas || []); await mexerFilaQd((f) => f.filter((y) => y.chave !== it.chave)); ok++; } catch (e) {
        if (e.sessao) break; if (/Sem conexão|Servidor respondeu 5/i.test(e.message)) break;
        await mexerFilaQd((f) => { const x = f.find((y) => y.chave === it.chave); if (x) { x.erro = e.message; x.recusado = true; } }); rec.push({ numero: '', motivo: e.message });
      }
    }
    S.qdSitEm = null; if (ok || rec.length) window.dispatchEvent(new Event('quadras-atualizadas'));
    if (rec.length) toast(`Quadras: ${rec.length} marcação(ões) não aceita(s). ${rec[0].numero ? (/-[A-Z]{1,3}$/.test(rec[0].numero) ? 'Face ' : 'Quadra ') + rec[0].numero + ': ' : ''}${rec[0].motivo}`, 6000);
    else if (ok && !silencioso) toast('Marcações de quadra enviadas.');
  }
  // ao salvar uma árvore numa quadra ainda "a levantar", ela passa a "em levantamento"
  // e a face da calçada começa sozinha quando o GPS deixa claro qual é (erro pequeno, face perto e nenhuma outra quase tão perto)
  async function quadraAutomatica(r) {
    try {
      if (!['coletor', 'revisor', 'admin'].includes(perfil())) return;
      const cam = await carregarQuadras(); if (!cam) return;
      const sit = await carregarSitQd(false); const fs = sit.faces || new Map(); const itens = [];
      const daOutra = (s) => perfil() === 'coletor' && s.equipe && s.equipe !== minhaEquipe();
      if (r.faceId) {
        const cl = S.form.campos.find((c) => /largura/i.test(c.nome));
        const res = await marcarQuadras([{ tipo: 'face', numero: r.faceId, situacao: 'Levantada, sem árvores', registro: r.uuid, largura: cl ? r.valores[cl.nome] : null, rua: r.faceRua || '' }]);
        if (res.recusadas && res.recusadas.length) toast('A face não foi marcada: ' + res.recusadas[0].motivo, 6000);
        return;
      }
      if (r.lat == null || r.lat === '') return;
      const q = S.qdIdx.idx.achar(+r.lon, +r.lat);
      if (q) { const s = sit.get(q.n) || { situacao: 'A levantar', equipe: '' }; if (s.situacao === 'A levantar' && !daOutra(s)) itens.push({ numero: q.n, situacao: 'Em levantamento', auto: true }); }
      const P = S.projeto; const gps = +P.face_gps || 10, dist = +P.face_dist || 15, folga = +P.face_folga || 8;
      if (r.posManual || (r.prec != null && +r.prec <= gps)) {
        const fc = S.qdIdx.idx.faces(+r.lon, +r.lat, dist + folga);
        if (fc.length && fc[0].d < dist && (!fc[1] || fc[1].d - fc[0].d >= folga)) {
          const s = fs.get(fc[0].id) || { situacao: 'A levantar', equipe: '' };
          const sq = sit.get(fc[0].q.n) || {};
          if (s.situacao === 'A levantar' && !daOutra(s) && !(!s.equipe && sq.atribuida !== 'nao' && daOutra(sq))) itens.push({ tipo: 'face', numero: fc[0].id, situacao: 'Em levantamento', auto: true, rua: fc[0].f.r });
        }
      }
      if (itens.length) await marcarQuadras(itens);
    } catch (e) { /* não atrapalha a coleta */ }
  }
  // "Levantada, sem árvores": abre o cadastro de calçada (só a foto de auditoria) ligado à face
  async function iniciarCalcadaFace(q, f) {
    const cat = S.form.campos.find((c) => c.tipo === 'choice' && /categoria/i.test(norm(c.nome)));
    const op = cat && cat.opcoes.find((o) => /cal[cç]ada/i.test(o.t));
    if (!op) return toast('O formulário deste projeto não tem a categoria calçada sem árvores.', 5000);
    const id = q.n + '-' + f.i; const rasc = (await Store.registros(S.projeto.id)).find((r) => r.faceId === id && r.status === 'rascunho');
    if (rasc) { toast('Continuando o cadastro desta face que ficou guardado.', 3000); S.aba = 0; S.tentou = false; return ir('#form/' + rasc.uuid); }
    const loc = S.form.campos.find((c) => c.tipo === 'choice' && /local do registro/i.test(norm(c.nome))); const opL = loc && loc.opcoes.find((o) => /cal[cç]ada|via p/i.test(o.t));
    await novoRegistro({ faceId: q.n + '-' + f.i, faceRua: f.r, faceTxt: `face ${f.i} da quadra ${q.n} (${f.r})`, cat: [cat.nome, op.v], extra: opL ? { [loc.nome]: opL.v } : {} });
  }
  function resumoQd(cam, sit) {
    const tot = cam ? cam.quadras.length : 0; const por = { 'A levantar': 0, 'Em levantamento': 0, Levantada: 0 }; const eq = {};
    if (cam) for (const q of cam.quadras) { const s = sit.get(q.n) || {}; const st = s.situacao || 'A levantar'; por[st]++; if (s.equipe) { eq[s.equipe] = eq[s.equipe] || { total: 0, Levantada: 0, 'Em levantamento': 0 }; eq[s.equipe].total++; if (st !== 'A levantar') eq[s.equipe][st]++; } }
    return { tot, por, eq };
  }
  function resumoFaces(cam, sit) {
    const fs = sit.faces || new Map(); const o = { n: 0, mTot: 0, mFeito: 0, mSem: 0, eq: {} };
    for (const q of cam.quadras) for (const f of q.f || []) {
      o.n++; o.mTot += f.c; const s = fs.get(q.n + '-' + f.i); if (!s || !FACE_FEITA.includes(s.situacao)) continue;
      o.mFeito += f.c; if (s.situacao === 'Levantada, sem árvores') o.mSem += f.c;
      const en = s.equipe || 'Sem equipe'; const e = o.eq[en] = o.eq[en] || { n: 0, m: 0 }; e.n++; e.m += f.c; // marcadas pela coordenação sem equipe também aparecem na tabela
    }
    return o;
  }
  async function pintarPainelQd(corpo, forcar) {
    let cam; try { cam = await carregarQuadras(); } catch (e) { return; } if (!cam || !document.body.contains(corpo)) return;
    const sit = await carregarSitQd(!!forcar); const r = resumoQd(cam, sit); const F = resumoFaces(cam, sit);
    const km = fmtKm;
    // cliente: só o potencial de plantio (calçadas levantadas sem árvores), sem dados das equipes
    if (perfil() === 'cliente') { if (!F.n || !F.mSem) return; const ks = corpo.querySelector('.painel-aba[data-aba="inv"] .kpis'); if (ks) ks.append(kpi('Potencial de plantio', km(F.mSem), 'de calçada levantada sem nenhuma árvore')); return; }
    for (const e of Object.keys(F.eq)) if (!r.eq[e]) r.eq[e] = { total: 0, Levantada: 0, 'Em levantamento': 0 };
    const sec = h('section', { class: 'painel-os' }, h('h2', { class: 'painel-tit' }, 'Andamento por quadras'),
      h('div', { class: 'kpis' }, kpi('Quadras levantadas', fmtN(r.por.Levantada), `de ${fmtN(r.tot)} (${fmtP(r.tot ? r.por.Levantada / r.tot : 0)})`), kpi('Em levantamento', fmtN(r.por['Em levantamento']), ''), kpi('A levantar', fmtN(r.por['A levantar']), ''),
        F.n ? kpi('Calçada levantada', km(F.mFeito), `de ${km(F.mTot)} (${fmtP(F.mTot ? F.mFeito / F.mTot : 0)}) · ${km(F.mSem)} sem árvores`) : null),
      h('div', { class: 'prog-qd' }, h('div', { style: `width:${(r.por.Levantada / Math.max(1, r.tot)) * 100}%;background:${COR_QD.Levantada}` }), h('div', { style: `width:${(r.por['Em levantamento'] / Math.max(1, r.tot)) * 100}%;background:${COR_QD['Em levantamento']}` })),
      Object.keys(r.eq).length ? h('div', { class: 'cartao tab-rolagem' }, h('h3', null, 'Por equipe'), h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Equipe'), h('th', null, 'Quadras atribuídas'), h('th', null, 'Levantadas'), h('th', null, 'Em levantamento'), h('th', null, 'Andamento'), F.n ? h('th', null, 'Faces levantadas') : null, F.n ? h('th', null, 'Calçada levantada') : null),
        Object.entries(r.eq).sort((a, b) => a[0].localeCompare(b[0], 'pt')).map(([e, x]) => h('tr', null, h('td', null, e), h('td', null, fmtN(x.total)), h('td', null, fmtN(x.Levantada)), h('td', null, fmtN(x['Em levantamento'])), h('td', null, x.total ? fmtP(x.Levantada / x.total) : ''),
          F.n ? h('td', null, fmtN((F.eq[e] || {}).n || 0)) : null, F.n ? h('td', null, km((F.eq[e] || {}).m || 0)) : null)))) : null,
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn sec', onclick: () => { S.qdModo = 'sit'; ir('#mapa'); } }, 'Ver quadras no mapa')));
    const op = corpo.querySelector('.painel-aba[data-aba="op"]'); if (op) { op.append(sec); return; }
    const bt = corpo.querySelector('.botoes-painel'); if (bt) corpo.insertBefore(sec, bt); else corpo.append(sec);
  }
  // importação da camada (coordenação > projetos)
  async function importarQuadrasTela(p) {
    const arq = h('input', { type: 'file', accept: '.zip,.gpkg,.kml,.geojson,.json', class: 'entrada' });
    const info = h('div'); const selN = h('select', { class: 'entrada' }); let lido = null;
    arq.addEventListener('change', async () => {
      const f = arq.files && arq.files[0]; if (!f) return; lido = null; info.replaceChildren(h('div', { class: 'info' }, 'Lendo o arquivo...'));
      try {
        lido = await Quadras.lerArquivo(f.name, await f.arrayBuffer()); const sug = Quadras.campoNumero(lido.campos, lido.feicoes);
        selN.replaceChildren(lido.campos.map((c) => h('option', { value: c, selected: c === sug }, `${c} (ex.: ${String(lido.feicoes[0].props[c] ?? '').slice(0, 30)})`)));
        info.replaceChildren(h('div', { class: 'info' }, `${fmtN(lido.feicoes.length)} polígonos encontrados` + (lido.campos.includes('faces') ? ', com as faces de quadra.' : '.') + (lido.semPrj ? ' O arquivo não tem .prj: as coordenadas foram lidas como graus.' : '')));
      } catch (e) { info.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    });
    const ok = await modal('Camada de quadras: ' + p.nome, h('div', null,
      h('p', { class: 'dica' }, 'Shapefile compactado (.zip com .shp, .dbf e .prj), GeoPackage, KML ou GeoJSON, em SIRGAS 2000 (graus ou UTM). Importar de novo substitui a camada; a situação das quadras com o mesmo número continua valendo.'),
      arq, info, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Campo com o número da quadra'), selN)), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Importar', valor: true }]);
    if (!ok) return; if (!lido) return toast('Escolha um arquivo válido.');
    const extras = lido.campos.filter((c) => c !== selN.value && !/^(fid|ogc_fid|objectid|shape_(area|leng|length)|geom|faces)$/i.test(c)).slice(0, 4);
    const cam = Quadras.compactar(lido.feicoes, selN.value, extras);
    try { toast('Enviando a camada...', 4000); const r = await Api.b.quadrasImportar(p.id, JSON.stringify(cam)); S.qdEm = null; S.qdIdx = null; toast(`Camada importada: ${fmtN(r.total)} quadras` + (r.faces ? ` e ${fmtN(r.faces)} faces de quadra.` : '.'), 5000); } catch (e) { toast(e.message, 6000); }
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
      const cDap = form.campos.find((c) => c.tipo === 'multinumber' && /dap|cap/i.test(c.nome)); const ehCap = cDap && /cap/i.test(cDap.nome);
      if (cDap) linhas.forEach((l) => { const v = Indicadores.valorNum(l[cDap.nome], true); l.dap_equivalente_cm = v == null ? '' : Math.round((ehCap ? v / Math.PI : v) * 10) / 10; if (ehCap) l.cap_equivalente_cm = v == null ? '' : Math.round(v * 10) / 10; });
      let camQd = null; // número da quadra de cada ponto, quando o projeto tem camada de quadras
      try { const qj = await Api.b.quadrasCamada(p.id); if (qj && qj.camada) { camQd = JSON.parse(qj.camada); const ix = Quadras.indice(camQd.quadras); linhas.forEach((l) => { const q = l.longitude !== '' && isFinite(+l.longitude) && +l.longitude ? ix.achar(+l.longitude, +l.latitude) : null; l.quadra = q ? q.n : ''; }); } } catch (e) { /* sem camada */ }
      if (form.campos.some((c) => /area de copa/i.test(c.nome))) linhas.forEach((l) => { const m = paraNum(l['Area de copa medida (m2)']), cl = paraNum(l['Area de copa (m2)']); l.area_copa_m2 = m != null ? m : cl != null ? cl : ''; });
      const cc = campoCodigo(form), ce = campoEspecie(form);
      const dia = new Date().toISOString().slice(0, 10); const base = `${p.id}_${dia}${filtro === 'validados' ? '_validados' : ''}`;
      const ordem = ['numero_unico', ...form.campos.flatMap((c) => (c.tipo === 'photo' ? [c.nome, c.nome + ' link'] : [c.nome])), 'cap_equivalente_cm', 'dap_equivalente_cm', 'area_copa_m2', 'latitude', 'longitude', 'precisao_gps_m', 'endereco_aprox', 'bairro_aprox', 'quadra', 'equipe', 'usuario', 'criado_em', 'concluido_em', 'atualizado_em', 'validacao', 'validacao_obs', 'validado_por', 'validado_em', 'validacao_hist', 'historico', 'uuid'];
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
        msg(`GeoPackage gerado: ${fmtN(r.total)} registros em SIRGAS 2000 / UTM (EPSG:${r.srs})${r.semPonto ? `, ${r.semPonto} sem coordenada` : ''}${estilo ? ', com a simbologia do QGIS embutida' : ''}. Fotos: use o pacote completo (com a pasta DCIM) e coloque as fotos ao lado do arquivo.`);
      } else if (formato === 'xlsx') {
        const leg = linhas.map(legivel);
        const unid = (c) => { const m = String(c.rotulo + ' ' + c.nome).match(/\((cm|m|m2|m²|%|graus)\)/i); return m ? m[1].replace('m2', 'm²') : ''; };
        const dic = [...form.campos.map((c) => ({ Campo: c.nome, 'Nome no app': c.rotulo, Unidade: unid(c), Descrição: c.ajuda || '', Tipo: { choice: 'Lista de opções', bool: 'Sim ou não', number: 'Número', multinumber: 'Números por fuste', species: 'Espécie', photo: 'Foto', text: 'Texto', textarea: 'Texto longo', datetime: 'Data e hora', date: 'Data' }[c.tipo] || c.tipo, Opções: (c.opcoes || []).map((o) => `${o.v} = ${o.t}`).join('; ') })),
          ...[['numero_unico', 'Número único do registro no projeto, dado pelo servidor no primeiro envio', ''], ['cap_equivalente_cm', 'CAP equivalente: raiz da soma dos quadrados dos CAP de cada caule', 'cm'], ['area_copa_m2', 'Área de copa: a medida com trena a laser ou, se não houver, a calculada pelos quatro raios', 'm²'], ['dap_equivalente_cm', 'DAP equivalente, calculado do CAP (CAP dividido por pi); com mais de um caule, raiz da soma dos quadrados', 'cm'], ['latitude', 'Latitude em graus decimais, SIRGAS 2000', 'graus'], ['longitude', 'Longitude em graus decimais, SIRGAS 2000', 'graus'], ['precisao_gps_m', 'Erro estimado do GPS do aparelho no momento do registro', 'm'],
            ['endereco_aprox', 'Endereço aproximado obtido do mapa (OpenStreetMap) pela coordenada', ''], ['bairro_aprox', 'Bairro aproximado obtido do mapa (OpenStreetMap)', ''], ['quadra', 'Número da quadra onde está o ponto, pela camada de quadras do projeto', ''], ['equipe', 'Equipe que coletou', ''], ['criado_em', 'Data e hora da coleta', ''], ['concluido_em', 'Data e hora em que a equipe concluiu o registro', ''],
            ['validacao', 'Situação da validação técnica (Pendente, Validado, Devolvido, Corrigido, Descartado)', ''], ['validado_por', 'Quem fez a última avaliação', ''], ['validado_em', 'Data e hora da última avaliação', ''], ['validacao_hist', 'Histórico de todas as avaliações do registro', ''], ['historico', 'Histórico de alterações feitas depois de concluído', ''], ['uuid', 'Identificador interno do registro', '']]
            .map(([c, d, u]) => ({ Campo: c, 'Nome no app': '', Unidade: u, Descrição: d, Tipo: '', Opções: '' }))];
        const meta = [['Projeto', p.nome], ['Contratante', p.contratante || ''], ['Contrato', p.contrato || ''], ['Município', p.municipio || ''], ['Responsável técnico', [p.responsavel, p.registro_profissional, p.art ? 'ART ' + p.art : ''].filter(Boolean).join(' · ')],
          ['Registros neste arquivo', String(linhas.length)], ['Filtro', filtro === 'validados' ? 'Somente registros validados' : 'Todos os registros, exceto descartados'], ['Sistema de referência das coordenadas', 'SIRGAS 2000, geográficas (EPSG:4674)'], ['Formulário', `${form.nome} (versão ${form.versao || 1})`], ['Gerado em', new Date().toLocaleString('pt-BR')], ['Gerado por', `${S.sessao.usuario.nome || S.sessao.u} no Neofloresta Inventário ${VERSAO}`]].map(([k, v]) => ({ Item: k, Valor: v }));
        const abas = [{ nome: 'Registros', cols, linhas: leg.map((l) => Object.fromEntries(cols.map((c) => [c, l[c]]))) }];
        if (camQd) {
          try {
            const dtQ = (v) => { const d = v ? new Date(v) : null; if (!d || isNaN(d)) return ''; let t; try { t = d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); } catch (e) { t = d.toISOString().replace('T', ' '); } return { __data: Math.round((Date.parse(t.slice(0, 19).replace(' ', 'T') + 'Z') / 864e5 + 25569) * 1e6) / 1e6 }; }; // data de verdade no Excel (filtra por período)
            const sitR = await Api.b.quadrasSituacao(p.id); const sq = new Map(sitR.quadras.map((q) => [q.numero, q])); const nArv = {}; linhas.forEach((l) => { if (l.quadra) nArv[l.quadra] = (nArv[l.quadra] || 0) + 1; });
            const extrasQ = [...new Set(camQd.quadras.flatMap((q) => Object.keys(q.p || {})))];
            abas.push({ nome: 'Quadras', cols: ['Quadra', ...extrasQ, 'Equipe', 'Situação', 'Marcada por', 'Marcada em', 'Registros neste arquivo'], linhas: camQd.quadras.map((q) => { const s = sq.get(q.n) || {}; const d = s.marcada_em ? new Date(s.marcada_em) : null; return Object.assign({ Quadra: /^\d+$/.test(q.n) ? +q.n : q.n }, Object.fromEntries(extrasQ.map((k) => [k, (q.p || {})[k] || ''])), { Equipe: s.equipe || '', 'Situação': s.situacao || 'A levantar', 'Marcada por': s.marcada_por || '', 'Marcada em': dtQ(s.marcada_em), 'Registros neste arquivo': nArv[q.n] || 0 }); }) });
            if (camQd.quadras.some((q) => q.f)) { // faces de quadra: uma linha por face
              const sf = new Map(sitR.faces.map((f) => [f.numero, f])); const lin = [];
              for (const q of camQd.quadras) for (const f of q.f || []) { const x = sf.get(q.n + '-' + f.i) || {}; const d = x.marcada_em ? new Date(x.marcada_em) : null; lin.push({ Face: q.n + '-' + f.i, Quadra: /^\d+$/.test(q.n) ? +q.n : q.n, Rua: f.r, 'Comprimento (m)': f.c, Equipe: x.equipe || '', 'Situação': x.situacao || 'A levantar', 'Marcada por': x.marcada_por || '', 'Marcada em': dtQ(x.marcada_em), 'Largura da calçada (m)': x.largura ? +x.largura : '', 'Registro da calçada': x.registro || '' }); }
              abas.push({ nome: 'Faces de quadra', cols: ['Face', 'Quadra', 'Rua', 'Comprimento (m)', 'Equipe', 'Situação', 'Marcada por', 'Marcada em', 'Largura da calçada (m)', 'Registro da calçada'], linhas: lin });
            }
          } catch (e) { /* segue sem a aba */ }
        }
        try {
          const os = (await Api.b.osListar(p.id)).ordens || [];
          if (os.length) {
            const dt = (v) => { const d = v ? new Date(v) : null; if (!d || isNaN(d)) return ''; let t; try { t = d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); } catch (e) { t = d.toISOString().replace('T', ' '); } return { __data: Math.round((Date.parse(t.slice(0, 19).replace(' ', 'T') + 'Z') / 864e5 + 25569) * 1e6) / 1e6 }; };
            const dtDia = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? { __data: Date.parse(v + 'T00:00:00Z') / 864e5 + 25569, dia: true } : '');
            const nomeFoto = (o, t) => (idDrive(o['foto_' + t]) ? `DCIM/ordens/OS-${String(o.numero).padStart(4, '0')}-${t}.jpg` : '');
            const co = [['numero', 'Número'], ['tipo', 'Serviço'], ['status', 'Situação'], ['prioridade', 'Prioridade'], ['codigo_arvore', 'Árvore'], ['especie', 'Espécie'], ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['descricao', 'Descrição'], ['responsavel', 'Equipe'], ['prazo', 'Prazo'], ['solicitada_por', 'Pedido por'], ['solicitada_em', 'Pedido em'], ['aberta_por', 'Aberta por'], ['aberta_em', 'Aberta em'], ['iniciada_em', 'Iniciada em'], ['concluida_por', 'Concluída por'], ['concluida_em', 'Concluída em'], ['execucao_obs', 'Observação da execução'], ['iniciada_por', 'Iniciada por'], ['cancelada_por', 'Cancelada por'], ['cancelada_em', 'Cancelada em'], ['no_prazo', 'Concluída no prazo'], ['foto_antes', 'Foto de antes (link)'], ['arq_antes', 'Foto de antes (arquivo no pacote)'], ['foto_depois', 'Foto de depois (link)'], ['arq_depois', 'Foto de depois (arquivo no pacote)'], ['motivo', 'Motivo (cancelamento ou reabertura)'], ['historico', 'Histórico'], ['registro_uuid', 'Identificador da árvore']];
            abas.push({ nome: 'Ordens de serviço', cols: co.map((c) => c[1]), linhas: os.sort((a, b) => +a.numero - +b.numero).map((o) => Object.fromEntries(co.map(([k, t]) => [t, /_em$/.test(k) ? dt(o[k]) : k === 'numero' || k === 'latitude' || k === 'longitude' ? (o[k] === '' || o[k] == null ? '' : +o[k]) : k === 'prazo' ? dtDia(o[k]) : k === 'arq_antes' ? nomeFoto(o, 'antes') : k === 'arq_depois' ? nomeFoto(o, 'depois') : k === 'no_prazo' ? (o.status === 'Concluída' && o.prazo ? (diaLocal(o.concluida_em) <= o.prazo ? 'Sim' : 'Não') : '') : o[k] ?? ''])) ) });
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
        fotos.length <= LIM ? `  DCIM/: ${baixadas} fotos. As dos registros têm o nome da coluna de foto da planilha; as das ordens de serviço ficam em DCIM/ordens/ com o nome indicado nas colunas "arquivo no pacote" da aba Ordens de serviço.` : `  Fotos: são ${fotos.length}, grandes demais para um arquivo só. Peça à Neofloresta o pacote de fotos (pasta DCIM) e coloque ao lado do GeoPackage. Cada linha da planilha tem o link da foto.`,
        '', 'Coordenadas: SIRGAS 2000. Datas e horas no horário de Brasília nas planilhas legíveis e em UTC (ISO 8601) no CSV.', 'Os dados pertencem ao contratante, conforme o termo de uso e privacidade do sistema.'].join('\r\n');
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
      if (/^(uuid|fid|ogc_fid|id|equipe|criado_em|numero_unico|validacao.*|validado_.*|historico|usuario|projeto|atualizado_em|concluido_em|servidor_em|dap_equivalente_cm|cap_equivalente_cm|area_copa_m2|endereco_aprox|bairro_aprox|precisao_gps_m)$/i.test(c)) continue;
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
      h('div', { class: 'cartao' }, h('h3', null, 'Servidor'), h('p', { class: 'dica' }, 'Endereço da ponte com o servidor usada por este aparelho.'), h('button', { class: 'btn sec peq', onclick: configurarServidor }, 'Configurar servidor')),
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
    const btRest = h('button', { class: 'btn perigo', disabled: true, onclick: () => restaurar() }, 'Restaurar esta cópia');
    const carregar = async () => { btRest.disabled = true; selC.replaceChildren(h('option', { value: '' }, 'Carregando...')); try { const cs = await Api.b.backupListar(selP.value); btRest.disabled = !cs.length; selC.replaceChildren(cs.length ? cs.map((c) => h('option', { value: c.id }, /antes da restauração/.test(c.nome) ? 'Estado antes de uma restauração (' + c.nome.slice(-16).replace(/-(\d\d)$/, ':$1') + ')' : 'Cópia de ' + c.dia.split('-').reverse().join('/'))) : h('option', { value: '' }, 'Nenhuma cópia deste projeto ainda')); } catch (e) { selC.replaceChildren(h('option', { value: '' }, e.message)); } };
    const restaurar = async () => {
      const p = projetos.find((x) => x.id === selP.value); if (!selC.value || !p) return toast('Escolha a cópia.');
      const conf = h('input', { class: 'entrada', placeholder: p.nome });
      const ok = await modal('Restaurar cópia', h('div', null, h('p', null, `Os registros e as ordens de serviço de "${p.nome}" vão voltar para: ${selC.selectedOptions[0].textContent}.`), h('div', { class: 'aviso' }, 'O que foi enviado depois dessa data deixa de aparecer na planilha (fica guardado na cópia "antes da restauração"). Avise as equipes antes.'), h('p', null, 'Para confirmar, escreva o nome do projeto:'), conf), [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Restaurar', classe: 'perigo', valor: true }]);
      if (!ok) return; if (conf.value.trim() !== p.nome) return toast('O nome não confere. Nada foi alterado.');
      msg.replaceChildren(h('div', { class: 'info' }, 'Restaurando...'));
      try { const r = await Api.b.backupRestaurar(p.id, selC.value); S.linhas = {}; S.painel = null; msg.replaceChildren(h('div', { class: 'info' }, `Restaurado: ${pl(r.registros, 'registro', 'registros')} e ${pl(r.ordens, 'ordem de serviço', 'ordens de serviço')}. O estado anterior foi guardado e aparece na lista para desfazer.`)); carregar(); } catch (e) { msg.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    };
    selP.addEventListener('change', carregar);
    box.replaceChildren(h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), selP), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Cópia'), selC)), h('div', { class: 'linha-btn' }, btRest), msg);
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
    // satélite: acima do zoom 18 várias cidades não têm imagem ("not available"); o app amplia a do zoom 18
    const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19, crossOrigin: true, attribution: '© OpenStreetMap' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 18, crossOrigin: true, attribution: 'Imagem © Esri, Maxar, Earthstar Geographics' });
    const rot = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 18, crossOrigin: true });
    // se o servidor de mapa recusar o pedido com CORS, volta ao pedido simples (a imagem aparece, só não fica guardada)
    for (const ly of [ruas, sat, rot]) { ly.on('tileload', () => { ly.__falhas = 0; }); ly.on('tileerror', () => { if (ly.options.crossOrigin && navigator.onLine && !ly.__semCors && ++ly.__falhas >= 3) { ly.__semCors = true; ly.options.crossOrigin = false; ly.redraw(); } }); ly.__falhas = 0; }
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
    if (!max && arq.type === 'image/jpeg') return arq; // qualidade original: nem abre a imagem
    let bmp;
    try { bmp = await createImageBitmap(arq, { imageOrientation: 'from-image' }); } catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('formato não suportado')); i.src = URL.createObjectURL(arq); }); }
    // max 0: mantém a foto como a câmera tirou (só converte para JPEG o que não for JPEG, no tamanho original)
    const w = bmp.width, hh = bmp.height, k = max ? Math.min(1, max / Math.max(w, hh)) : 1;
    if (k === 1 && arq.type === 'image/jpeg' && arq.size < 1.5e6) return arq;
    const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(hh * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
  }

  window.__app = { S, Store, Api, sincronizar, proximoCodigo, marcarQuadras, conferirEnvio }; // usados pelos testes de estresse
  iniciar().catch((e) => { $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'aviso' }, 'Erro ao iniciar: ' + e.message), h('button', { class: 'btn', onclick: () => sair(true) }, 'Voltar ao login'))); });
})();
