// App de coleta Neofloresta
(() => {
  const VERSAO = '1.10.0';
  const S = { sessao: null, projeto: null, form: null, reg: null, aba: 0, tentou: false, pos: null, sincronizando: false, revisao: null, adminAba: 'exportar' };
  const $app = document.getElementById('app');

  // ---------- utilidades ----------
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) el.append(f.nodeType ? f : document.createTextNode(String(f)));
    return el;
  }
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
    if (S.sessao) { Api.credenciais(S.sessao.u, S.sessao.s); await abrirProjeto(S.sessao.projetoAtual); Gps.iniciar(); }
    rota(); sincronizar(true);
  }

  async function abrirProjeto(id) {
    const p = S.sessao.projetos.find((x) => x.id === id) || S.sessao.projetos[0];
    if (!p) { if (S.sessao.usuario.perfil === 'admin') { S.projeto = null; S.form = null; return; } throw new Error('Nenhum projeto liberado para este usuário.'); }
    S.projeto = p; S.sessao.projetoAtual = p.id; await Store.set('sessao', S.sessao);
    S.form = await carregarForm(p.formulario);
    sincronizarSequencia();
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
    if (!S.sessao) return telaLogin();
    const [r, a, b] = location.hash.replace(/^#/, '').split('/');
    if (r === 'form' && a) return telaForm(a, b);
    if (r === 'mapa') return telaMapa();
    if (r === 'admin' && S.sessao.usuario.perfil === 'admin') return telaAdmin(a);
    if (!S.projeto) { if (S.sessao.usuario.perfil === 'admin') return telaAdmin('projetos'); return telaLogin(); }
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
        const r = await Api.b.login(usuario, senha);
        if (!r.projetos.length && r.usuario.perfil !== 'admin') throw new Error('Este usuário não tem projeto liberado.');
        S.sessao = { u: usuario, s: senha, usuario: r.usuario, projetos: r.projetos, projetoAtual: r.projetos.length ? r.projetos[0].id : null, servidor: Api.servidor || '' };
        Api.credenciais(usuario, senha);
        await Store.set('sessao', S.sessao);
        await abrirProjeto(S.sessao.projetoAtual);
        Gps.iniciar();
        ir('#inicio');
      } catch (e) {
        erro.textContent = navigator.onLine ? e.message : 'Sem internet. O primeiro acesso precisa de conexão.'; erro.classList.remove('oculto');
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    }
    s.addEventListener('keydown', (e) => e.key === 'Enter' && entrar());
    $app.replaceChildren(h('div', { class: 'tela-login' }, h('div', { class: 'login' },
      h('div', { class: 'marca' }, h('img', { src: 'icons/logo-basica.png', alt: 'Neofloresta Serviços Ecossistêmicos' }), h('span', null, 'Inventário de arborização urbana')),
      Api.demo ? h('div', { class: 'info' }, 'Modo demonstração: os dados ficam só neste aparelho. Usuários de teste: ', h('b', null, 'admin / 1234'), ', ', h('b', null, 'equipe1 / 1111'), ' e ', h('b', null, 'equipe2 / 2222'), '.') : null,
      h('div', { class: 'campo' }, u), h('div', { class: 'campo' }, s), erro, btn,
      h('button', { class: 'btn linha cheio', style: 'margin-top:12px', onclick: configurarServidor }, 'Configurar servidor'),
      h('p', { class: 'dica', style: 'text-align:center;margin-top:18px' }, 'Versão ' + VERSAO)), h('div', { class: 'padronagem', 'aria-hidden': 'true' })));
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
    S.sessao = null; await Store.del('sessao'); location.hash = ''; telaLogin();
  }

  // ---------- Sincronização ----------
  const $sync = () => document.querySelector('.sync');
  async function pendentes() { return (await Store.todosRegistros()).filter((r) => r.status === 'pendente'); }
  async function atualizarSync() {
    const el = $sync(); if (!el) return;
    const n = (await pendentes()).length;
    el.className = 'sync' + (!navigator.onLine ? ' off' : n ? ' pend' : '');
    el.textContent = S.sincronizando ? 'Enviando...' : !navigator.onLine ? (n ? `Sem rede · ${n}` : 'Sem rede') : n ? `${n} a enviar` : (Api.demo ? 'Demonstração' : 'Em dia');
  }
  async function sincronizar(silencioso) {
    if (S.sincronizando || !S.sessao) return;
    if (!navigator.onLine) { if (!silencioso) toast('Sem internet. Os dados ficam guardados e serão enviados depois.'); return atualizarSync(); }
    const lista = await pendentes(); if (!lista.length) { if (!silencioso) toast('Tudo enviado.'); return atualizarSync(); }
    S.sincronizando = true; atualizarSync();
    let ok = 0, falhas = 0, ultimoErro = '';
    for (const r of lista) {
      try {
        const p = S.sessao.projetos.find((x) => x.id === r.projeto);
        const form = S.projeto && r.projeto === S.projeto.id ? S.form : await carregarForm(p ? p.formulario : '', true);
        for (const [campo, f] of Object.entries(r.fotos || {})) {
          if (!f || f.enviado) continue;
          const blob = await Store.foto(f.chave); if (!blob) { f.enviado = true; continue; }
          const res = await Api.b.foto(r.projeto, f.nome.replace(/^DCIM\//, ''), blob);
          f.enviado = true; f.url = res.url || ''; f.idDrive = res.id || '';
          await Store.salvarRegistro(r);
        }
        await Api.b.registro(r.projeto, Api.achatar(r, form));
        const atual = await Store.registro(r.uuid);
        if (atual && atual.atualizado_em === r.atualizado_em) { atual.status = 'enviado'; atual.fotos = r.fotos; delete atual.erroSync; await Store.salvarRegistro(atual); }
        ok++;
      } catch (e) {
        falhas++; ultimoErro = e.message; r.erroSync = e.message; await Store.salvarRegistro(r);
      }
    }
    S.sincronizando = false; await atualizarSync();
    if (!silencioso || falhas) toast(falhas ? `Enviados ${ok}. Falharam ${falhas}: ${ultimoErro}` : `${ok} registro(s) enviados.`, falhas ? 5000 : 2600);
    if (location.hash === '' || location.hash === '#inicio') listarRegistros();
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
        h('button', { class: 'btn nova canto', onclick: novoRegistro }, ico('mais'), 'Nova árvore'),
        h('div', { class: 'resumo', id: 'stats' }),
        h('div', { class: 'busca-box' }, ico('busca'), busca),
        h('div', { id: 'lista', class: 'lista' })));
    atualizarSync(); listarRegistros();
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
    if (st) st.replaceChildren(h('span', null, h('b', null, todos.filter((r) => r.status !== 'rascunho' && new Date(r.criado_em).toDateString() === hoje).length), ' hoje'),
      h('span', null, h('b', null, todos.filter((r) => r.status !== 'rascunho').length), ' no aparelho'),
      h('span', { class: nPend ? 'pend' : '' }, h('b', null, nPend), ' a enviar'));
    const cc = campoCodigo(S.form), ce = campoEspecie(S.form);
    const f = norm(filtro);
    const lista = todos.filter((r) => !f || norm(camposCodigo(S.form).map((k) => r.valores[k.nome]).join(' ') + ' ' + (ce && r.valores[ce.nome])).includes(f));
    if (!lista.length) return el.replaceChildren(h('div', { class: 'vazio-lista' }, filtro ? 'Nada encontrado.' : 'Nenhuma árvore cadastrada ainda neste aparelho.'));
    const itens = [];
    for (const r of lista.slice(0, 300)) {
      const img = await miniatura(r);
      const rotSt = { rascunho: 'Rascunho', pendente: r.erroSync ? 'Erro' : 'A enviar', enviado: 'Enviado' }[r.status];
      itens.push(h('button', { class: 'reg', onclick: () => ir('#form/' + r.uuid) },
        img ? h('img', { src: img, alt: '' }) : h('div', { class: 'sem' }),
        h('div', { class: 'tx' }, h('b', null, codigoDe(S.form, r.valores) || 'Sem código'),
          h('i', null, (ce && r.valores[ce.nome]) || 'Espécie não informada'), h('small', null, `${dataBR(r.atualizado_em)} · ${r.equipe || ''}`)),
        h('span', { class: 'st ' + (r.erroSync && r.status === 'pendente' ? 'erro' : r.status) }, rotSt)));
    }
    el.replaceChildren(...itens);
  }

  function abrirMenu() {
    const it = (txt, fn) => h('button', { class: 'menu-it', onclick: () => { veu.remove(); fn(); } }, txt);
    const veu = h('div', { class: 'veu', onclick: (e) => e.target === veu && veu.remove() }, h('div', { class: 'folha' },
      h('img', { class: 'folha-marca', src: 'icons/logo-horizontal.png', alt: 'Neofloresta' }),
      h('h3', null, S.sessao.usuario.nome),
      S.sessao.projetos.length > 1 ? it('Trocar projeto', trocarProjeto) : null,
      it('Mapa das árvores', () => ir('#mapa')),
      it('Enviar agora', () => sincronizar()),
      S.sessao.usuario.perfil === 'admin' ? it('Coordenação (exportar, equipes, formulários)', () => ir('#admin/exportar')) : null,
      S.sessao.usuario.perfil === 'admin' ? it('Servidor', configurarServidor) : null,
      it('Sair', () => sair()),
      h('p', { class: 'dica', style: 'margin-top:12px' }, `Versão ${VERSAO} · ${Api.demo ? 'demonstração' : 'conectado ao Google'}`)));
    document.body.append(veu);
  }
  async function trocarProjeto() {
    const r = await modal('Projeto', h('div', null, S.sessao.projetos.map((p) => h('button', { class: 'menu-it', onclick: () => { document.querySelector('.veu').remove(); escolher(p.id); } }, p.nome + (p.id === S.projeto.id ? ' ✓' : '')))), []);
    async function escolher(id) { try { await abrirProjeto(id); ir('#inicio'); } catch (e) { toast(e.message); } }
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
      if (c.min != null && v < c.min) f.push({ nome: c.nome, rotulo: `${c.rotulo}: ${c.limiteMsg || 'abaixo do mínimo de ' + numBR(c.min)}` });
      else if (c.max != null && v > c.max) f.push({ nome: c.nome, rotulo: `${c.rotulo}: ${c.limiteMsgMax || 'acima do máximo de ' + numBR(c.max)}` });
    }
    return f;
  }

  let salvarTimer = null;
  function salvarRascunho() {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(async () => { const r = S.reg; if (!r) return; r.atualizado_em = agoraISO(); if (r.status === 'enviado') r.status = 'pendente'; await Store.salvarRegistro(r); atualizarSync(); }, 350);
  }

  // ---------- Formulário ----------
  async function telaForm(id, abaParam) {
    const r = await Store.registro(id);
    if (!r) { toast('Registro não encontrado.'); return ir('#inicio'); }
    if (r.projeto !== S.projeto.id) await abrirProjeto(r.projeto);
    if (!S.reg || S.reg.uuid !== r.uuid) { S.aba = 0; S.tentou = false; }
    S.reg = r; r.valores = r.valores || {}; r.fotos = r.fotos || {};
    if (r.status !== 'rascunho' && !r.__base) r.__base = JSON.stringify(r.valores);
    if (abaParam != null) S.aba = +abaParam || 0;
    const form = S.form; const abas = form.abas;
    S.aba = Math.min(Math.max(0, S.aba), abas.length - 1);

    const gpsBtn = h('button', { class: 'gps', onclick: abrirLocal });
    function pintarGps() {
      gpsBtn.className = 'gps ' + classeGps(r.prec);
      gpsBtn.textContent = r.lat == null ? (S.posErro ? 'Sem GPS' : 'Buscando GPS...') : `GPS ±${Math.round(r.prec)} m${r.posManual ? ' (ajustado)' : ''}`;
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
    function pintarAbas() {
      const vis = abas.map((x, i) => i).filter((i) => abaVisivel(abas[i]));
      barraAbas.replaceChildren(
        h('button', { class: 'prog-topo', onclick: abrirEtapas },
          h('span', { class: 'prog-nome' }, abas[S.aba].nome), h('span', { class: 'prog-n' }, `${vis.indexOf(S.aba) + 1} de ${vis.length}`), ico('etapas')),
        h('div', { class: 'prog-barra' }, vis.map((i) => h('span', { class: 'seg ' + (i === S.aba ? 'at' : estadoAba(abas[i])), onclick: () => irAba(i) }))));
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
            blocos.push(h('div', { class: 'campo' + (faltaG ? ' falta' : ''), 'data-grupo': grupo || '' }, grupo ? (gObrig ? h('div', { class: 'rot' }, 'Marque pelo menos uma opção', h('span', { class: 'obr' }, '*')) : null) : h('div', { class: 'rot' }, 'Marque o que se aplica'), chips));
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

    function rotulo(c) { return h('label', { class: 'rot' }, c.rotulo, E[c.nome].obrig ? h('span', { class: 'obr' }, '*') : null); }
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
            const b = h('button', { class: 'op' + (String(v) === String(o.v) ? ' sel' : ''), onclick: () => {
              const novo = String(r.valores[c.nome]) === String(o.v) ? null : o.v;
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
          const i = h('input', { class: 'entrada', inputmode: 'decimal', enterkeyhint: 'next', value: numBR(v), oninput: () => mudar(c, c.inteiro ? (paraNum(i.value) == null ? null : Math.round(paraNum(i.value))) : paraNum(i.value)) });
          box.append(rotulo(c), i); break;
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
          ...(f ? [] : [h('button', { class: 'tile-gal', onclick: () => gal.click() }, 'galeria')]), cam, gal);
      };
      async function receber(inp) {
        const arq = inp.files && inp.files[0]; if (!arq) return;
        try {
          const blob = await reduzir(arq, 2048, 0.85);
          const chave = r.uuid + ':' + c.nome + ':' + Date.now();
          await Store.salvarFoto(chave, blob);
          const antiga = r.fotos[c.nome]; if (antiga && !antiga.enviado) Store.apagarFoto(antiga.chave);
          const prefixo = S.projeto.prefixo || S.projeto.id;
          r.fotos[c.nome] = { nome: `DCIM/${prefixo}_${carimbo()}.jpg`, chave, enviado: false, url: '' };
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
        mapa = L.map(div).setView(centro, r.lat != null || S.pos ? 19 : 4);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
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
      if (f.length) {
        pintarAbas();
        const idx = abas.findIndex((a) => a.campos.some((x) => f.some((c) => c.nome === x.campo || (c.grupo && c.grupo === x.grupo))));
        await modal('Faltam campos obrigatórios', h('ul', null, f.map((c) => h('li', null, c.rotulo))), [{ texto: 'Preencher', valor: 1 }]);
        if (idx >= 0) irAba(idx); else render();
        return;
      }
      if (r.lat == null && !(await confirmar('Sem localização', 'Esta árvore ainda não tem posição de GPS. Salvar assim mesmo?', 'Salvar sem GPS'))) return;
      clearTimeout(salvarTimer);
      // campos ocultos pela classe não levam valor antigo para a planilha
      for (const c of form.campos) if (E[c.nome].oculto) { if (c.tipo === 'photo') delete r.fotos[c.nome]; else r.valores[c.nome] = c.tipo === 'bool' ? false : null; }
      recalcular(r);
      anotarHistorico();
      if (!r.concluido_em) r.concluido_em = agoraISO();
      r.status = 'pendente'; r.gpsAuto = false; r.atualizado_em = agoraISO(); delete r.erroSync;
      await Store.salvarRegistro(r);
      Gps.ouvintes.delete(ouvinte); S.reg = null;
      toast('Árvore salva.'); ir('#inicio'); sincronizar(true);
    }
    // registro já concluído que foi alterado: guarda quem mudou o quê e quando
    function anotarHistorico() {
      if (!r.__base) return;
      const antes = JSON.parse(r.__base); const mud = [];
      const fmt = (v) => v == null || v === '' ? 'vazio' : v === true ? 'sim' : v === false ? 'não' : typeof v === 'number' ? numBR(v) : String(v);
      for (const c of form.campos) if (!c.calculado && c.tipo !== 'photo' && fmt(antes[c.nome]) !== fmt(r.valores[c.nome])) mud.push(`${c.rotulo}: ${fmt(antes[c.nome])} → ${fmt(r.valores[c.nome])}`);
      if (mud.length) (r.historico = r.historico || []).push({ em: agoraISO(), por: S.sessao.u, mud });
      delete r.__base;
    }
    async function sairForm() {
      clearTimeout(salvarTimer); Gps.ouvintes.delete(ouvinte); if (r.status !== 'rascunho') anotarHistorico();
      if (r.status === 'rascunho' && !r.mexido && !Object.keys(r.fotos).length) { await Store.apagarRegistro(r.uuid); }
      else { r.atualizado_em = agoraISO(); if (r.status === 'enviado') r.status = 'pendente'; await Store.salvarRegistro(r); if (r.status === 'rascunho') toast('Guardado como rascunho.'); }
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
    const selCor = h('select', { class: 'entrada' }, h('option', { value: 'equipe' }, 'Cor por equipe'), cRisco ? h('option', { value: 'risco' }, 'Cor por risco') : null);
    const conta = h('small', { class: 'mapa-conta' });
    const barra = h('div', { class: 'mapa-filtros' }, busca, h('div', { class: 'mapa-sel' }, selEq, selRisco, selCor), conta);
    $app.replaceChildren(h('div', { class: 'tela-mapa' }, topo('Mapa', S.projeto.nome, h('button', { class: 'ic', onclick: () => ir('#inicio'), 'aria-label': 'Voltar' }, ico('voltar')), h('button', { class: 'gps', onclick: centrar }, 'Minha posição')), barra, div));
    const mapa = L.map(div, { preferCanvas: true }).setView(S.pos ? [S.pos.lat, S.pos.lon] : [-15.8, -47.9], S.pos ? 18 : 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    const render = L.canvas({ padding: 0.3 });
    const cores = ['#00546E', '#CD834C', '#6A1B9A', '#2E7D32', '#C62828', '#12A6C8'];
    const corRisco = { Baixo: '#2E9E4F', 'Médio': '#E3A322', Alto: '#C8423A' };
    const equipes = []; const corEq = (e) => { if (!equipes.includes(e)) equipes.push(e); return cores[equipes.indexOf(e) % cores.length]; };
    // pontos: os do aparelho primeiro (podem ter edição ainda não enviada), depois os do servidor
    const pts = []; const vistos = new Set();
    const add = (o) => { if (o.lat == null || o.lat === '' || isNaN(+o.lat) || vistos.has(o.uid)) return; vistos.add(o.uid); o.lat = +o.lat; o.lon = +o.lon; o.chave = norm(o.cod + ' ' + o.esp); corEq(o.equipe || '-'); pts.push(o); };
    for (const r of await Store.registros(S.projeto.id)) if (r.status !== 'rascunho') add({ uid: r.uuid, lat: r.lat, lon: r.lon, equipe: r.equipe, cod: cc ? r.valores[cc.nome] || '' : '', esp: ce ? r.valores[ce.nome] || '' : '', risco: cRisco ? r.valores[cRisco.nome] : '', cat: cCat ? r.valores[cCat.nome] : '', foto: '', local: true });
    const camada = L.layerGroup().addTo(mapa);
    function desenhar(ajustar) {
      camada.clearLayers(); mapa.closePopup();
      const q = norm(busca.value).trim(), eq = selEq.value, rk = selRisco ? selRisco.value : '', porRisco = selCor.value === 'risco';
      const vis = pts.filter((o) => (!q || o.chave.includes(q)) && (!eq || o.equipe === eq) && (!rk || String(o.risco) === rk));
      for (const o of vis) {
        const fill = porRisco ? corRisco[o.risco] || '#8A969C' : corEq(o.equipe || '-');
        L.circleMarker([o.lat, o.lon], { renderer: render, radius: 6, color: '#fff', weight: 1.5, fillColor: fill, fillOpacity: 0.95 }).on('click', (e) => ficha(o, e.latlng)).addTo(camada);
      }
      conta.textContent = `${vis.length.toLocaleString('pt-BR')} de ${pts.length.toLocaleString('pt-BR')} pontos`;
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
        o.foto ? h('a', { href: o.foto, target: '_blank', rel: 'noopener' }, 'Ver foto') : null,
        o.local ? h('button', { class: 'btn peq', onclick: () => ir('#form/' + o.uid) }, 'Abrir') : null);
      L.popup().setLatLng(ll || [o.lat, o.lon]).setContent(pop).openOn(mapa);
    }
    let leg = null;
    function legenda() {
      if (leg) leg.remove();
      leg = L.control({ position: 'bottomleft' });
      const itens = selCor.value === 'risco' ? Object.entries(corRisco) : equipes.map((e) => [e, corEq(e)]);
      leg.onAdd = () => h('div', { class: 'mapa-leg' }, itens.map(([t, c]) => h('div', null, h('span', { style: `background:${c}` }), t)));
      leg.addTo(mapa);
    }
    let tBusca = null;
    busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => desenhar(!!busca.value.trim()), 250); });
    [selEq, selRisco, selCor].filter(Boolean).forEach((x) => x.addEventListener('change', () => desenhar(x !== selCor)));
    const preencherEquipes = () => { const atual = selEq.value; selEq.replaceChildren(h('option', { value: '' }, 'Todas as equipes'), ...equipes.filter((e) => e !== '-').map((e) => h('option', { value: e, selected: e === atual }, e))); };
    preencherEquipes(); desenhar(true);
    if (!Api.demo && navigator.onLine) {
      conta.textContent = 'Carregando pontos das equipes...';
      try {
        const campos = ['uuid', 'latitude', 'longitude', 'equipe', cc && cc.nome, ce && ce.nome, cRisco && cRisco.nome, cCat && cCat.nome, cFoto && cFoto.nome + ' link'].map((x) => x || '');
        const m = await Api.b.mapa(S.projeto.id, campos);
        for (const l of m.linhas) add({ uid: l[0], lat: l[1], lon: l[2], equipe: l[3], cod: l[4] || '', esp: l[5] || '', risco: l[6], cat: l[7], foto: l[8], local: false });
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
    $app.replaceChildren(...[topo('Coordenação', Api.demo ? 'Modo demonstração' : 'Conectado ao Google', voltar, null),
      !S.projeto ? h('main', { style: 'padding-bottom:0' }, h('div', { class: 'info' }, 'Primeiros passos: 1) em Formulários, instale ou importe um formulário; 2) em Projetos, crie o projeto; 3) em Equipes e usuários, crie os acessos de campo.')) : null,
      h('main', { style: 'padding-bottom:0' }, h('div', { class: 'subabas' }, it('exportar', 'Exportar'), it('projetos', 'Projetos'), it('usuarios', 'Equipes e usuários'), it('formularios', 'Formulários'))), corpo].filter(Boolean));
    corpo.style.paddingTop = '0';
    try {
      if (sub === 'exportar') await adminExportar(corpo);
      else if (sub === 'projetos') await adminProjetos(corpo);
      else if (sub === 'usuarios') await adminUsuarios(corpo);
      else if (sub === 'formularios') await adminFormularios(corpo);
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

  async function adminExportar(corpo) {
    const projetos = await Api.b.projetosListar();
    const sel = h('select', { class: 'entrada' }, projetos.map((p) => h('option', { value: p.id, selected: S.projeto && p.id === S.projeto.id }, p.nome)));
    const status = h('div');
    const links = h('div');
    const mostrarLinks = () => { const p = projetos.find((x) => x.id === sel.value); links.replaceChildren(p && (p.planilha_url || p.pasta_url) ? h('div', { class: 'info' }, p.planilha_url ? h('div', null, h('a', { href: p.planilha_url, target: '_blank' }, 'Abrir planilha do projeto')) : null, p.pasta_url ? h('div', null, h('a', { href: p.pasta_url, target: '_blank' }, 'Abrir pasta do projeto no Drive (fotos em DCIM)')) : null) : ''); };
    sel.addEventListener('change', mostrarLinks); mostrarLinks();
    async function exportar(tipo) {
      status.replaceChildren(h('div', { class: 'info' }, 'Gerando arquivo...'));
      try {
        const p = projetos.find((x) => x.id === sel.value);
        const form = await Api.b.formulario(p.formulario);
        const linhas = await Api.b.listarTudo(p.id, (n, t) => status.replaceChildren(h('div', { class: 'info' }, `Baixando registros: ${n.toLocaleString('pt-BR')}${t ? ' de ' + t.toLocaleString('pt-BR') : ''}...`)));
        if (!linhas.length) throw new Error('Nenhum registro enviado neste projeto ainda.');
        // numeração única do projeto, sem distinção de equipe, pela ordem de coleta
        [...linhas].sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)) || String(a.uuid).localeCompare(String(b.uuid))).forEach((l, i) => { l.numero_unico = i + 1; });
        const cc = campoCodigo(form), ce = campoEspecie(form);
        const dia = new Date().toISOString().slice(0, 10);
        if (tipo === 'gpkg') {
          const estilo = await Api.b.estilo(form.id).catch(() => null);
          const r = await Gpkg.gerar({ form, linhas, epsg: p.epsg, nomeCamada: Q2F.slug(p.id).replace(/-/g, '_'), estiloQml: estilo });
          baixar(`${p.id}_${dia}.gpkg`, r.bytes, 'application/geopackage+sqlite3');
          status.replaceChildren(h('div', { class: 'info' }, `GeoPackage gerado: ${r.total} árvores em SIRGAS 2000 / UTM (EPSG:${r.srs})${r.semPonto ? `, ${r.semPonto} sem coordenada` : ''}${estilo ? ', com o estilo do QGIS embutido' : ''}. Para ver as fotos no QGIS, baixe a pasta DCIM do projeto no Drive e coloque ao lado do arquivo .gpkg.`));
        } else if (tipo === 'kml') {
          const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const chave = (n) => n && /^(numero_unico|equipe|criado_em|precisao_gps_m)$|codigo|especie|categoria|situa|dap|altura|risco|foto 1 link/i.test(norm(n));
          const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter(chave);
          const pms = linhas.filter((l) => l.latitude !== '' && l.latitude != null).map((l) => `<Placemark><name>${x(cc ? l[cc.nome] : l.numero_unico)}</name>${ce && l[ce.nome] ? `<description>${x(l[ce.nome])}</description>` : ''}<ExtendedData>${cols.map((c) => `<Data name="${x(c)}"><value>${x(l[c])}</value></Data>`).join('')}</ExtendedData><Point><coordinates>${+l.longitude},${+l.latitude},0</coordinates></Point></Placemark>`);
          baixar(`${p.id}_${dia}.kml`, `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(p.nome)}</name>${pms.join('\n')}</Document></kml>`, 'application/vnd.google-earth.kml+xml');
          status.replaceChildren(h('div', { class: 'info' }, `KML gerado com ${pms.length} pontos e os campos principais (abre no Google Earth e no Google Maps). A tabela completa está no GeoPackage e na planilha.`));
        } else {
          const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
          const esc = (v) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
          const csv = '﻿' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\r\n');
          baixar(`${p.id}_${dia}.csv`, csv, 'text/csv'); status.replaceChildren(h('div', { class: 'info' }, `Planilha gerada com ${linhas.length} linhas.`));
        }
      } catch (e) { status.replaceChildren(h('div', { class: 'aviso' }, e.message)); }
    }
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Exportar dados'), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projeto'), sel), links,
      h('div', { class: 'linha-btn' }, h('button', { class: 'btn', onclick: () => exportar('gpkg') }, 'GeoPackage (.gpkg)'), h('button', { class: 'btn sec', onclick: () => exportar('csv') }, 'Planilha (.csv)'), h('button', { class: 'btn sec', onclick: () => exportar('kml') }, 'Google Earth (.kml)')),
      h('p', { class: 'dica' }, Api.demo ? 'No modo demonstração a exportação usa os registros deste aparelho.' : 'A exportação usa tudo o que as equipes já enviaram para a planilha do projeto.'), status));
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
      const ok = await modal(novo ? 'Novo projeto' : 'Editar projeto', h('div', null,
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Identificador (sem espaços)'), id), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), nome),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Formulário'), fo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Sistema de coordenadas da exportação'), ep),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Prefixo das fotos'), pre, h('div', { class: 'dica' }, 'As fotos ficam como DCIM/prefixo_AAAAMMDDhhmmssmmm.jpg, igual ao QField.'))),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const pid = Q2F.slug(id.value || nome.value); if (!pid || !nome.value.trim()) return toast('Preencha identificador e nome.');
      if (novo && projetos.some((x) => x.id === pid)) return toast('Já existe projeto com esse identificador.');
      try { await Api.b.projetoSalvar(Object.assign({}, p, { id: pid, nome: nome.value.trim(), formulario: fo.value, epsg: ep.value, prefixo: Q2F.slug(pre.value || pid) })); toast('Projeto salvo.'); await recarregarSessao(); telaAdmin('projetos'); } catch (e) { toast(e.message, 5000); }
    }
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Projetos'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Projeto'), h('th', null, 'Formulário'), h('th', null, '')),
        projetos.map((p) => h('tr', null, h('td', null, h('b', null, p.nome), h('br'), h('small', null, p.id)), h('td', null, (forms.find((f) => f.id === p.formulario) || {}).nome || p.formulario),
          h('td', null, h('button', { class: 'btn sec peq', onclick: () => editar(p) }, 'Editar'))))),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => editar(null) }, '+ Novo projeto'),
      h('p', { class: 'dica' }, Api.demo ? '' : 'Cada projeto novo ganha uma pasta no Drive com a planilha e a subpasta DCIM das fotos.')));
  }

  async function adminUsuarios(corpo) {
    const [us, projetos] = await Promise.all([Api.b.usuariosListar(), Api.b.projetosListar()]);
    async function editar(u) {
      const novo = !u; u = u || { login: '', nome: '', senha: '', perfil: 'campo', projeto: S.projeto ? S.projeto.id : '', equipe: '' };
      const lo = h('input', { class: 'entrada', value: u.login, disabled: !novo, autocapitalize: 'none', placeholder: 'ex.: divi-equipe1' });
      const no = h('input', { class: 'entrada', value: u.nome, placeholder: 'ex.: João e Maria' });
      const se = h('input', { class: 'entrada', value: u.senha || '', placeholder: 'senha' });
      const eq = h('input', { class: 'entrada', value: u.equipe || '', placeholder: 'ex.: Equipe 1' });
      const cod = h('input', { class: 'entrada', value: u.codigo || '', autocapitalize: 'characters', placeholder: 'ex.: E1' });
      const pe = h('select', { class: 'entrada' }, h('option', { value: 'campo', selected: u.perfil === 'campo' }, 'Campo'), h('option', { value: 'admin', selected: u.perfil === 'admin' }, 'Coordenação (vê tudo, exporta)'));
      const marcados = new Set(String(u.projeto || '').split(',').map((x) => x.trim()));
      const prj = h('div', { class: 'chips' }, projetos.map((p) => { const b = h('button', { class: 'chip' + (marcados.has(p.id) ? ' sel' : ''), onclick: () => { b.classList.toggle('sel'); if (marcados.has(p.id)) marcados.delete(p.id); else marcados.add(p.id); } }, p.nome); return b; }));
      const ok = await modal(novo ? 'Novo usuário' : 'Editar usuário', h('div', null,
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Usuário'), lo), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Senha'), se)),
        h('div', { class: 'grade2' }, h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Nome'), no), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Equipe'), eq)),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Código da equipe'), cod, h('div', { class: 'dica' }, 'Prefixo dos códigos das árvores (ex.: E1 gera E1-0001, E1-0002...). Use um diferente para cada equipe.')),
        h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Perfil'), pe), h('div', { class: 'campo' }, h('label', { class: 'rot' }, 'Projetos liberados'), prj)),
        [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Salvar', valor: true }]);
      if (!ok) return;
      const login = lo.value.trim().toLowerCase();
      if (!login || !se.value.trim()) return toast('Preencha usuário e senha.');
      if (novo && us.some((x) => x.login === login)) return toast('Esse usuário já existe.');
      try { await Api.b.usuarioSalvar({ login, nome: no.value.trim() || login, senha: se.value.trim(), perfil: pe.value, projeto: pe.value === 'admin' ? '*' : [...marcados].filter(Boolean).join(','), equipe: eq.value.trim(), codigo: cod.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') }); toast('Usuário salvo.'); telaAdmin('usuarios'); } catch (e) { toast(e.message, 5000); }
    }
    async function remover(u) { if (u.login === S.sessao.u) return toast('Você não pode remover o próprio usuário.'); if (await confirmar('Remover', `Remover o usuário ${u.login}?`, 'Remover', 'perigo')) { await Api.b.usuarioRemover(u.login); telaAdmin('usuarios'); } }
    const nomeP = (ids) => ids === '*' ? 'Todos' : String(ids || '').split(',').map((i) => (projetos.find((p) => p.id === i.trim()) || {}).nome || i).join(', ');
    corpo.replaceChildren(h('div', { class: 'cartao' }, h('h3', null, 'Equipes e usuários'),
      h('table', { class: 'tab' }, h('tr', null, h('th', null, 'Usuário'), h('th', null, 'Equipe / projeto'), h('th', null, '')),
        us.map((u) => h('tr', null, h('td', null, h('b', null, u.login), h('br'), h('small', null, u.perfil === 'admin' ? 'Coordenação' : 'Campo')), h('td', null, u.equipe || '', h('br'), h('small', null, nomeP(u.projeto))),
          h('td', { style: 'white-space:nowrap' }, h('button', { class: 'btn sec peq', onclick: () => editar(u) }, 'Editar'), ' ', h('button', { class: 'btn perigo peq', onclick: () => remover(u) }, '×'))))),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => editar(null) }, '+ Novo usuário'),
      h('p', { class: 'dica' }, 'Cada equipe de campo usa um usuário. Os registros saem com o nome da equipe.')));
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
      try { for (const arq of ['divinopolis-inventario', 'seade-risco']) { const f = await (await fetch(`forms/${arq}.json`)).json(); await Api.b.formularioSalvar(f, null); } toast('Formulários instalados.'); if (S.form) S.form = await carregarForm(S.form.id); telaAdmin('formularios'); } catch (e) { toast(e.message, 5000); }
    }
    async function editar(id) { const form = await Api.b.formulario(id); S.revisao = { form: JSON.parse(JSON.stringify(form)), qml: null, novo: false }; ir('#admin/revisao'); }
    corpo.replaceChildren(
      h('div', { class: 'cartao' }, h('h3', null, 'Formulários'),
        forms.length ? h('table', { class: 'tab' }, forms.map((f) => h('tr', null, h('td', null, h('b', null, f.nome), h('br'), h('small', null, `${f.id} · ${f.campos} campos`)), h('td', null, h('button', { class: 'btn sec peq', onclick: () => editar(f.id) }, 'Revisar'))))) : h('p', null, 'Nenhum formulário ainda.'),
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
