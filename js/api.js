// Comunicação com a ponte Google (Apps Script) ou modo demonstração (tudo no aparelho).
const Api = (() => {
  let url = null; let cred = null;

  function achatar(r, form) {
    const l = {
      uuid: r.uuid, projeto: r.projeto, equipe: r.equipe, usuario: r.usuario,
      criado_em: r.criado_em, atualizado_em: r.atualizado_em,
      latitude: r.lat ?? '', longitude: r.lon ?? '', precisao_gps_m: r.prec ?? '',
    };
    for (const c of form.campos) {
      if (c.tipo === 'photo') { const f = (r.fotos || {})[c.nome]; l[c.nome] = f ? f.nome : ''; l[c.nome + ' link'] = f && f.url ? f.url : ''; }
      else { let v = (r.valores || {})[c.nome]; if (c.tipo === 'bool') v = v ? 1 : 0; l[c.nome] = v ?? ''; }
    }
    return l;
  }

  async function chamar(acao, dados) {
    const corpo = JSON.stringify(Object.assign({ acao, u: cred && cred.u, s: cred && cred.s }, dados || {}));
    const resp = await fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    if (!resp.ok) throw new Error('Servidor respondeu ' + resp.status);
    const j = await resp.json();
    if (!j.ok) throw new Error(j.erro || 'Erro no servidor');
    return j;
  }

  // ---------- Modo demonstração ----------
  const Demo = {
    async base() {
      let b = await Store.get('demo:base');
      if (!b) {
        const form = await (await fetch('forms/seade-risco.json')).json();
        b = {
          usuarios: [
            { login: 'admin', senha: '1234', nome: 'Coordenação', perfil: 'admin', projeto: '*', equipe: 'Coordenação' },
            { login: 'equipe1', senha: '1111', nome: 'Equipe 1', perfil: 'campo', projeto: 'demo-seade', equipe: 'Equipe 1' },
            { login: 'equipe2', senha: '2222', nome: 'Equipe 2', perfil: 'campo', projeto: 'demo-seade', equipe: 'Equipe 2' },
          ],
          projetos: [{ id: 'demo-seade', nome: 'Demonstração SEADE', formulario: form.id, epsg: 'auto', prefixo: 'demo-seade' }],
          formularios: { [form.id]: form }, estilos: {},
        };
        await Store.set('demo:base', b);
      }
      return b;
    },
    async login(u, s) {
      const b = await this.base();
      const us = b.usuarios.find((x) => x.login === u && String(x.senha) === String(s));
      if (!us) throw new Error('Usuário ou senha incorretos.');
      const projetos = b.projetos.filter((p) => us.perfil === 'admin' || us.projeto === p.id || String(us.projeto).split(',').map((x) => x.trim()).includes(p.id))
        .map((p) => Object.assign({}, p, { equipe: us.equipe }));
      return { usuario: { login: us.login, nome: us.nome, perfil: us.perfil }, projetos };
    },
    async formulario(id) { return (await this.base()).formularios[id]; },
    async estilo(id) { return (await this.base()).estilos[id] || null; },
    async foto() { return { id: '', url: '' }; },
    async registro() { return { ok: true }; },
    async listar(projeto) {
      const b = await this.base(); const p = b.projetos.find((x) => x.id === projeto); const form = b.formularios[p.formulario];
      return (await Store.registros(projeto)).filter((r) => r.status !== 'rascunho').map((r) => achatar(r, form));
    },
    async projetosListar() { return (await this.base()).projetos; },
    async projetoSalvar(p) { const b = await this.base(); const i = b.projetos.findIndex((x) => x.id === p.id); if (i >= 0) b.projetos[i] = p; else b.projetos.push(p); await Store.set('demo:base', b); },
    async usuariosListar() { return (await this.base()).usuarios; },
    async usuarioSalvar(u) { const b = await this.base(); const i = b.usuarios.findIndex((x) => x.login === u.login); if (i >= 0) b.usuarios[i] = u; else b.usuarios.push(u); await Store.set('demo:base', b); },
    async usuarioRemover(login) { const b = await this.base(); b.usuarios = b.usuarios.filter((x) => x.login !== login); await Store.set('demo:base', b); },
    async formulariosListar() { const b = await this.base(); return Object.values(b.formularios).map((f) => ({ id: f.id, nome: f.nome, campos: f.campos.length })); },
    async formularioSalvar(form, qml) { const b = await this.base(); b.formularios[form.id] = form; if (qml) b.estilos[form.id] = qml; await Store.set('demo:base', b); },
  };

  // ---------- Servidor Google ----------
  const Remoto = {
    async login(u, s) { const j = await chamar('login', { u, s }); return { usuario: j.usuario, projetos: j.projetos }; },
    async formulario(id) { return (await chamar('formulario', { id })).formulario; },
    async estilo(id) { return (await chamar('estilo', { id })).qml || null; },
    async foto(projeto, nome, blob) {
      const dados = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      const j = await chamar('foto', { projeto, nome, mime: blob.type || 'image/jpeg', dados });
      return { id: j.id, url: j.url };
    },
    async registro(projeto, linha) { return chamar('registro', { projeto, linha }); },
    async listar(projeto) { return (await chamar('listar', { projeto })).linhas; },
    async projetosListar() { return (await chamar('projetos_listar')).projetos; },
    async projetoSalvar(p) { return chamar('projeto_salvar', { projeto_dados: p }); },
    async usuariosListar() { return (await chamar('usuarios_listar')).usuarios; },
    async usuarioSalvar(usr) { return chamar('usuario_salvar', { usuario_dados: usr }); },
    async usuarioRemover(login) { return chamar('usuario_remover', { login }); },
    async formulariosListar() { return (await chamar('formularios_listar')).formularios; },
    async formularioSalvar(form, qml) { return chamar('formulario_salvar', { formulario: form, qml: qml || '' }); },
  };

  return {
    achatar,
    configurar(u) { url = u || null; },
    get demo() { return !url; },
    get servidor() { return url; },
    credenciais(u, s) { cred = { u, s }; },
    get b() { return url ? Remoto : Demo; },
  };
})();
