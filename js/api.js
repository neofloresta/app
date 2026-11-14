// Comunicação com o servidor Google (Apps Script) ou modo demonstração (tudo no aparelho).
const Api = (() => {
  let url = null; let cred = null; let aoExpirar = null;

  function achatar(r, form) {
    const l = {
      uuid: r.uuid, projeto: r.projeto, equipe: r.equipe, usuario: r.usuario,
      criado_em: r.criado_em, atualizado_em: r.atualizado_em, concluido_em: r.concluido_em || '',
      latitude: r.lat ?? '', longitude: r.lon ?? '', precisao_gps_m: r.prec ?? '',
      endereco_aprox: r.endereco || '', bairro_aprox: r.bairro || '',
      ...(r.dupla ? { avaliador: r.dupla.av ? r.dupla.av.nome : '', avaliador_id: r.dupla.av ? r.dupla.av.id : '', avaliador_registro: r.dupla.av ? r.dupla.av.registro || '' : '', avaliador_vinculo: r.dupla.av ? r.dupla.av.vinculo : '', auxiliar: r.dupla.ax ? r.dupla.ax.nome : '', auxiliar_id: r.dupla.ax ? r.dupla.ax.id : '', auxiliar_vinculo: r.dupla.ax ? r.dupla.ax.vinculo : '' } : {}),
      ...(r.posManual ? { ponto_ajustado: 'sim', ponto_dist_m: r.posDist ?? '' } : {}),
      ...(r.quadra ? { quadra: String(r.quadra), face: r.face || '' } : {}),
      ...(r.setor != null ? { setor: r.setor || '', fora_do_setor: r.foraSetor ? 'sim' : '' } : {}),
      historico: (r.historico || []).map((x) => `${String(x.em).slice(0, 16).replace('T', ' ')} ${x.por}: ${x.mud.join('; ')}`).join(' | '),
    };
    for (const c of form.campos) {
      if (c.tipo === 'photo') { const f = (r.fotos || {})[c.nome]; l[c.nome] = f ? f.nome : ''; l[c.nome + ' link'] = f && f.url ? f.url : ''; }
      else { let v = (r.valores || {})[c.nome]; if (c.tipo === 'bool') v = v == null ? '' : v ? 1 : 0; l[c.nome] = v ?? ''; }
    }
    return l;
  }

  function paraMapa(linhas, campos) { return { cab: campos, linhas: linhas.map((l) => campos.map((c) => l[c] ?? '')) }; }
  // listas da coordenação: a resposta vale por 1 minuto (trocar de aba fica instantâneo); qualquer gravação limpa
  const MEMO_LEITURA = ['usuarios_listar', 'projetos_listar', 'formularios_listar', 'pessoas_listar', 'times_listar'];
  const LEITURAS = ['conferir', 'trajetos', 'sessao', 'formulario', 'estilo', 'listar', 'mapa', 'painel', 'foto_ver', 'situacao_meus', 'os_listar', 'chaves_listar', 'backup_listar', 'auditoria_listar', 'quadras_camada', 'quadras_situacao', 'faces_situacao', 'pessoas_listar', 'setores_camada', 'setores_situacao', 'producao', 'producao_minha', 'producao_time', 'dias_listar', ...MEMO_LEITURA];
  let memo = new Map(); let comoLogin = null; // coordenação vendo as telas de outro usuário (o servidor só aceita consultas)
  async function chamar(acao, dados, semCred) {
    if (LEITURAS.indexOf(acao) < 0) memo = new Map();
    if (MEMO_LEITURA.indexOf(acao) >= 0) {
      const k = acao + JSON.stringify(dados || {}); const m = memo.get(k);
      if (m && Date.now() - m.t < 60000) return m.p;
      const pr = chamar1(acao, dados, semCred); memo.set(k, { t: Date.now(), p: pr }); pr.catch(() => memo.delete(k)); return pr;
    }
    return chamar1(acao, dados, semCred);
  }
  async function chamar1(acao, dados, semCred) {
    const id = semCred ? {} : cred && cred.t ? { t: cred.t } : { u: cred && cred.u, s: cred && cred.s };
    const corpo = JSON.stringify(Object.assign({ acao }, id, comoLogin && !semCred ? { como: comoLogin } : {}, dados || {}));
    let resp;
    try { resp = await fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' }); } catch (e) { throw Object.assign(new Error('Sem conexão com o servidor. Confira a internet.'), { rede: true }); }
    if (!resp.ok) throw new Error('Servidor respondeu ' + resp.status);
    const j = await resp.json();
    if (!j.ok) { const e = new Error(j.erro || 'Erro no servidor'); e.sessao = !!j.sessao; if (e.sessao && aoExpirar) aoExpirar(e); throw e; }
    return j;
  }

  // ---------- Modo demonstração ----------
  const DEMO_PERFIL = { campo: 'coletor' };
  const Demo = {
    async base() {
      const VERSAO_DEMO = 5;
      let b = await Store.get('demo:base');
      if (!b || b.versao !== VERSAO_DEMO) {
        const form = await (await fetch('forms/divinopolis-inventario.json')).json();
        const risco = await (await fetch('forms/seade-risco.json')).json();
        b = {
          versao: VERSAO_DEMO,
          usuarios: [
            { login: 'admin', senha: '1234', nome: 'Coordenação', perfil: 'admin', projeto: '*', equipe: 'Coordenação', codigo: 'CO' },
            { login: 'revisor', senha: '1234', nome: 'Revisão técnica', perfil: 'revisor', projeto: 'divinopolis-teste', equipe: 'Coordenação', codigo: 'RV' },
            { login: 'equipe1', senha: '1111', nome: 'Equipe 1', perfil: 'coletor', projeto: 'divinopolis-teste', equipe: 'Equipe 1', codigo: 'E1' },
            { login: 'equipe2', senha: '2222', nome: 'Equipe 2', perfil: 'coletor', projeto: 'divinopolis-teste', equipe: 'Equipe 2', codigo: 'E2' },
            { login: 'prefeitura', senha: '1234', nome: 'Prefeitura (cliente)', perfil: 'cliente', projeto: 'divinopolis-teste', equipe: '', codigo: '' },
          ],
          projetos: [{ id: 'divinopolis-teste', nome: 'Divinópolis (demonstração)', formulario: form.id, epsg: 'auto', prefixo: 'divinopolis', contratante: 'Prefeitura (exemplo)', contrato: '', municipio: 'Divinópolis/MG', meta: 10000, cliente_ve: 'todos' }],
          formularios: { [form.id]: form, [risco.id]: risco }, estilos: {}, validacao: {},
        };
        await Store.set('demo:base', b);
      }
      return b;
    },
    async login(u, s) {
      const b = await this.base();
      const us = b.usuarios.find((x) => x.login === u && String(x.senha) === String(s));
      if (!us) throw new Error('Usuário ou senha incorretos.');
      const perfil = DEMO_PERFIL[us.perfil] || us.perfil;
      const projetos = b.projetos.filter((p) => perfil === 'admin' || String(us.projeto).split(',').map((x) => x.trim()).includes(p.id))
        .map((p) => Object.assign({}, p, { equipe: us.equipe, equipeCodigo: us.codigo || '' }));
      return { token: '', usuario: { login: us.login, nome: us.nome, perfil, equipe: us.equipe, termo_aceito_em: us.termo_aceito_em || '' }, projetos };
    },
    async sessao() { return null; },
    async sair() {},
    async aceitarTermo() { const b = await this.base(); const us = b.usuarios.find((x) => x.login === (cred && cred.u)); if (us) { us.termo_aceito_em = new Date().toISOString(); await Store.set('demo:base', b); } },
    async trocarSenha(atual, nova) { const b = await this.base(); const us = b.usuarios.find((x) => x.login === (cred && cred.u)); if (!us || String(us.senha) !== String(atual)) throw new Error('Senha atual incorreta.'); if (String(nova).length < 4) throw new Error('Senha muito curta.'); us.senha = nova; await Store.set('demo:base', b); },
    async formulario(id) { return (await this.base()).formularios[id]; },
    async estilo(id) { const b = await this.base(); if (b.estilos[id]) return b.estilos[id]; try { const r = await fetch(`forms/${id}.qml`); return r.ok ? await r.text() : null; } catch (e) { return null; } },
    async foto() { return { id: '', url: '' }; },
    async registro() { return { ok: true }; },
    async reservar() { return null; }, // na demonstração só existe um aparelho
    async listar(projeto) {
      const b = await this.base(); const p = b.projetos.find((x) => x.id === projeto); const form = b.formularios[p.formulario];
      return (await Store.registros(projeto)).filter((r) => r.status !== 'rascunho').map((r) => Object.assign(achatar(r, form), b.validacao[r.uuid] || { validacao: 'Pendente' }));
    },
    async mapa(projeto, campos) { return paraMapa(await this.listar(projeto), campos); },
    async listarTudo(projeto) { return this.listar(projeto); },
    async painel(projeto) { const b = await this.base(); const p = b.projetos.find((x) => x.id === projeto); return Indicadores.calcular(b.formularios[p.formulario], await this.listar(projeto), p); },
    async fotoVer() { return null; },
    async situacaoMeus() { const b = await this.base(); return Object.entries(b.validacao).filter(([, v]) => v.validacao !== 'Pendente').map(([uuid, v]) => ({ uuid, validacao: v.validacao, obs: v.validacao_obs, em: v.validado_em })); },
    async validar(projeto, itens) {
      const b = await this.base();
      for (const it of itens) { if (it.estado === 'Devolvido' && !String(it.obs || '').trim()) throw new Error('Informe o motivo da devolução.'); b.validacao[it.uuid] = { validacao: it.estado, validacao_obs: it.obs || '', validado_por: cred && cred.u, validado_em: new Date().toISOString() }; }
      await Store.set('demo:base', b); return { alterados: itens.length };
    },
    async importar() { throw new Error('A importação precisa do servidor Google. No modo demonstração os dados ficam só neste aparelho.'); },
    async auditar() {},
    async auditoria() { return []; },
    async backupStatus() { return { ativo: false, emails: '', ultimo: null, pasta: '', demo: true }; },
    async backupConfig() { throw new Error('A cópia de segurança precisa do servidor Google.'); },
    async backupAgora() { throw new Error('A cópia de segurança precisa do servidor Google.'); },
    async usuarioDesbloquear() {},
    async projetosListar() { return (await this.base()).projetos; },
    async projetoSalvar(p) { const b = await this.base(); const i = b.projetos.findIndex((x) => x.id === p.id); if (i >= 0) b.projetos[i] = Object.assign(b.projetos[i], p); else b.projetos.push(p); await Store.set('demo:base', b); },
    async usuariosListar() { return (await this.base()).usuarios.map((u) => Object.assign({}, u, { perfil: DEMO_PERFIL[u.perfil] || u.perfil, senha: undefined })); },
    async usuarioSalvar(u) { const b = await this.base(); const i = b.usuarios.findIndex((x) => x.login === u.login); if (i >= 0) { if (!u.senha) delete u.senha; b.usuarios[i] = Object.assign(b.usuarios[i], u); } else b.usuarios.push(u); await Store.set('demo:base', b); },
    async usuarioRemover(login) { const b = await this.base(); b.usuarios = b.usuarios.filter((x) => x.login !== login); await Store.set('demo:base', b); },
    async formulariosListar() { const b = await this.base(); return Object.values(b.formularios).map((f) => ({ id: f.id, nome: f.nome, campos: f.campos.length, versao: f.versao || '' })); },
    async quadrasCamada() { return { semCamada: true }; },
    async quadrasSituacao() { return { quadras: [], faces: [] }; },
    async conferir() { return null; },
    async trajetoSalvar() { return { ok: true }; }, async trajetos() { return []; },
    async pessoasListar() { return (await this.base()).pessoas || []; },
    async pessoaSalvar(pe) { const b = await this.base(); b.pessoas = b.pessoas || []; const i = b.pessoas.findIndex((x) => x.id === pe.id); if (!pe.id) pe.id = 'P' + Date.now(); if (i >= 0) b.pessoas[i] = Object.assign(b.pessoas[i], pe); else b.pessoas.push(pe); await Store.set('demo:base', b); return { id: pe.id }; },
    async setoresCamada() { return { semCamada: true }; }, async setoresSituacao() { return []; },
    async setoresImportar() { throw new Error('Setores não disponíveis na demonstração.'); },
    async producao() { throw new Error('A produção precisa do servidor.'); }, async producaoMinha() { throw new Error('A produção precisa do servidor.'); }, async timesListar() { return []; }, async diasListar() { return []; }, async timeSalvar() { throw new Error('Os times precisam do servidor.'); }, async diaMarcar() { throw new Error('Precisa do servidor.'); }, async chuvaRegistrar() { return {}; },
    async medicaoFechar() { throw new Error('A produção precisa do servidor.'); }, async auditoriaSortear() { throw new Error('A auditoria precisa do servidor.'); }, async auditoriaConferir() { throw new Error('A auditoria precisa do servidor.'); }, async setoresAtribuir() { throw new Error('Setores não disponíveis na demonstração.'); },
    async quadrasMarcar() { throw new Error('Quadras não disponíveis na demonstração.'); },
    async quadrasImportar() { throw new Error('Quadras não disponíveis na demonstração.'); },
    // ordens de serviço no modo demonstração (mesmas regras do servidor, guardadas no aparelho)
    async osListar(projeto) {
      const b = await this.base(); const u = b.usuarios.find((x) => x.login === (cred && cred.u)) || {};
      let os = (b.ordens || []).filter((o) => o.projeto === projeto);
      if ((DEMO_PERFIL[u.perfil] || u.perfil) === 'coletor') os = os.filter((o) => (o.responsavel === u.equipe && o.status !== 'Solicitada') || o.solicitada_por === u.login);
      return { ordens: os, tipos: ['Poda de limpeza', 'Poda de levantamento de copa', 'Poda de adequação à rede elétrica', 'Poda de condução', 'Supressão', 'Remoção de toco', 'Plantio', 'Substituição', 'Tratamento fitossanitário', 'Avaliação de risco', 'Outro'] };
    },
    async osSalvar(projeto, d) {
      const b = await this.base(); b.ordens = b.ordens || []; const u = b.usuarios.find((x) => x.login === (cred && cred.u)) || {}; const pf = DEMO_PERFIL[u.perfil] || u.perfil; const coord = pf === 'admin' || pf === 'revisor';
      const hist = (t) => `${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${u.login}: ${t}`;
      let o = d.id ? b.ordens.find((x) => x.id === d.id) : b.ordens.find((x) => x.id === d.chave);
      if (o && !d.id) return { ordem: o, ignorado: true };
      if (o) { if (!coord) throw new Error('Seu perfil não tem acesso a esta função.'); ['tipo', 'prioridade', 'descricao', 'prazo', 'responsavel'].forEach((k) => { if (d[k] != null) o[k] = d[k]; }); o.historico += ' | ' + hist('alterou'); await Store.set('demo:base', b); return { ordem: o }; }
      if (!d.tipo) throw new Error('Escolha o tipo de serviço.');
      o = { id: d.chave || String(Date.now()), projeto, numero: b.ordens.filter((x) => x.projeto === projeto).length + 1, tipo: d.tipo, prioridade: d.prioridade || 'Média', descricao: d.descricao || '', prazo: coord ? d.prazo || '' : '', responsavel: coord ? d.responsavel || '' : '' };
      if (d.registro_uuid) { const r = await Store.registro(d.registro_uuid); if (!r) throw new Error('Árvore não encontrada no projeto.'); const f = b.formularios[(b.projetos.find((p) => p.id === projeto) || {}).formulario]; const cc = f.campos.find((c) => c.auto === 'codigo'); const ce = f.campos.find((c) => c.tipo === 'species'); Object.assign(o, { registro_uuid: r.uuid, codigo_arvore: cc ? r.valores[cc.nome] || '' : '', especie: ce ? r.valores[ce.nome] || '' : '', latitude: r.lat, longitude: r.lon, endereco: r.endereco || '', bairro: r.bairro || '' }); }
      else Object.assign(o, { latitude: d.latitude, longitude: d.longitude, endereco: d.endereco || '' });
      if (coord) Object.assign(o, { status: 'Aberta', aberta_por: u.login, aberta_em: new Date().toISOString() }); else Object.assign(o, { status: 'Solicitada', solicitada_por: u.login, solicitada_em: new Date().toISOString() });
      o.historico = hist(coord ? 'abriu a ordem' : 'solicitou o serviço');
      b.ordens.push(o); await Store.set('demo:base', b); return { ordem: o };
    },
    async osAndamento(projeto, id, etapa, d) {
      const b = await this.base(); const o = (b.ordens || []).find((x) => x.id === id); if (!o) throw new Error('Ordem de serviço não encontrada.');
      const u = b.usuarios.find((x) => x.login === (cred && cred.u)) || {}; const agora = new Date().toISOString();
      const hist = (t) => `${agora.slice(0, 16).replace('T', ' ')} ${u.login}: ${t}`;
      const novo = { aprovar: 'Aberta', iniciar: 'Em execução', concluir: 'Concluída', cancelar: 'Cancelada', reabrir: 'Aberta' }[etapa]; if (!novo) throw new Error('Etapa inválida.');
      if (etapa === 'aprovar') Object.assign(o, { responsavel: d.responsavel || o.responsavel, prazo: d.prazo || o.prazo, aberta_por: u.login, aberta_em: agora });
      if (etapa === 'iniciar') Object.assign(o, { iniciada_por: u.login, iniciada_em: agora });
      if (etapa === 'concluir') Object.assign(o, { concluida_por: u.login, concluida_em: agora, execucao_obs: d.obs || '', iniciada_em: o.iniciada_em || agora, iniciada_por: o.iniciada_por || u.login });
      if (etapa === 'cancelar' || etapa === 'reabrir') { if (!d.obs) throw new Error('Informe o motivo.'); o.motivo = d.obs; }
      o.status = novo; o.historico += ' | ' + hist({ aprovar: 'aprovou o pedido', iniciar: 'iniciou a execução', concluir: 'concluiu o serviço', cancelar: 'cancelou (' + d.obs + ')', reabrir: 'reabriu (' + d.obs + ')' }[etapa]);
      await Store.set('demo:base', b); return { ordem: o };
    },
    async formularioSalvar(form, qml) { const b = await this.base(); b.formularios[form.id] = form; if (qml) b.estilos[form.id] = qml; await Store.set('demo:base', b); },
  };

  // ---------- Servidor Google ----------
  const Remoto = {
    async login(u, s, aparelho) { const j = await chamar('login', { u, s, aparelho }, true); return { token: j.token || '', versaoScript: j.versaoScript || '1', usuario: j.usuario, projetos: j.projetos, formularios: j.formularios || {} }; },
    async sessao() { const j = await chamar('sessao'); return { usuario: j.usuario, projetos: j.projetos, versaoScript: j.versaoScript, equipes: j.equipes }; },
    async sair() { if (cred && cred.t) await chamar('sair').catch(() => {}); },
    async aceitarTermo(versao) { return chamar('aceitar_termo', { versao }); },
    async trocarSenha(atual, nova) { return chamar('trocar_senha', { atual, nova }); },
    async formulario(id) { return (await chamar('formulario', { id })).formulario; },
    async estilo(id) { return (await chamar('estilo', { id })).qml || null; },
    async foto(projeto, nome, blob) {
      const dados = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      const j = await chamar('foto', { projeto, nome, mime: blob.type || 'image/jpeg', dados });
      return { id: j.id, url: j.url };
    },
    async registro(projeto, linha) { return chamar('registro', { projeto, linha }); },
    // faixa exclusiva de códigos para este aparelho. Servidor antigo (sem a ação): devolve null e o app usa a sequência local
    async reservar(projeto, prefixo, campo, qtd, minimo) { try { const j = await chamar('reservar', { projeto, prefixo, campo, qtd, minimo }); return { ini: j.ini, fim: j.fim }; } catch (e) { if (/desconhecida/i.test(e.message)) return null; throw e; } },
    async listar(projeto) { return (await chamar('listar', { projeto })).linhas; },
    // só as colunas pedidas, em lista compacta (mapa e sequência do código). Servidor antigo: cai no listar completo.
    async mapa(projeto, campos) {
      try { const j = await chamar('mapa', { projeto, campos }); return { cab: j.cab, linhas: j.linhas }; } catch (e) {
        if (!/desconhecida/i.test(e.message)) throw e;
        return paraMapa(await this.listar(projeto), campos);
      }
    },
    // em páginas, para não estourar a resposta do Google em projetos grandes
    async listarTudo(projeto, progresso) {
      const N = 4000; let out = [];
      for (let de = 0; ; de += N) {
        const j = await chamar('listar', { projeto, de, n: N });
        out = out.concat(j.linhas); if (progresso) progresso(out.length, j.total);
        if ('proximo' in j) { if (j.proximo == null) break; de = j.proximo - N; continue; }
        if (j.total == null || j.linhas.length < N || de + N >= j.total) break; // servidor antigo devolve tudo de uma vez
      }
      return out;
    },
    async painel(projeto) { return chamar('painel', { projeto }); },
    async situacaoMeus(projeto) { return (await chamar('situacao_meus', { projeto })).itens; },
    async fotoVer(projeto, id) { const j = await chamar('foto_ver', { projeto, id }); const bin = atob(j.dados); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: j.mime }); },
    async validar(projeto, itens) { return chamar('validar', { projeto, itens }); },
    async importar(projeto, linhas) { return chamar('importar', { projeto, linhas }); },
    async auditar(tipo, alvo, detalhe) { return chamar('auditar', { tipo, alvo, detalhe }).catch(() => {}); },
    async auditoria(n) { return (await chamar('auditoria_listar', { n })).itens; },
    async backupStatus() { return chamar('backup_status'); },
    async backupConfig(emails, ativo) { return chamar('backup_config', { emails, ativo }); },
    async backupAgora() { return chamar('backup_agora'); },
    async usuarioDesbloquear(login) { return chamar('usuario_desbloquear', { login }); },
    async projetosListar() { return (await chamar('projetos_listar')).projetos; },
    async projetoSalvar(p) { return chamar('projeto_salvar', { projeto_dados: p }); },
    async usuariosListar() { return (await chamar('usuarios_listar')).usuarios; },
    async usuarioSalvar(usr) { return chamar('usuario_salvar', { usuario_dados: usr }); },
    async usuarioRemover(login) { return chamar('usuario_remover', { login }); },
    async formulariosListar() { return (await chamar('formularios_listar')).formularios; },
    async formularioSalvar(form, qml) { return chamar('formulario_salvar', { formulario: form, qml: qml || '' }); },
    async osListar(projeto) { const j = await chamar('os_listar', { projeto }); return { ordens: j.ordens, tipos: j.tipos }; },
    async chavesListar() { return (await chamar('chaves_listar')).chaves; },
    async quadrasImportar(projeto, camada) { return chamar('quadras_importar', { projeto, camada }); },
    async quadrasCamada(projeto, versao) { return chamar('quadras_camada', { projeto, versao: versao || '' }); },
    async quadrasSituacao(projeto) { const j = await chamar('quadras_situacao', { projeto, faces: true }); return { quadras: j.quadras || [], faces: j.faces || [] }; },
    async quadrasMarcar(projeto, itens) { return chamar('quadras_marcar', { projeto, itens }); },
    async conferir(projeto, uuids) { return (await chamar('conferir', { projeto, uuids })).achados; },
    async trajetoSalvar(projeto, trecho) { return chamar('trajeto_salvar', { projeto, trecho }); },
    async trajetos(projeto, dia) { return (await chamar('trajetos', { projeto, dia })).trechos; },
    // servidor antigo (sem pessoas nem setores): lista vazia, o app segue como antes
    async pessoasListar() { try { return (await chamar('pessoas_listar')).pessoas || []; } catch (e) { if (/desconhecida/i.test(e.message)) return []; throw e; } },
    async pessoaSalvar(pessoa) { return chamar('pessoa_salvar', { pessoa }); },
    async setoresImportar(projeto, camada) { return chamar('setores_importar', { projeto, camada }); },
    async setoresCamada(projeto, versao) { try { return await chamar('setores_camada', { projeto, versao: versao || '' }); } catch (e) { if (/desconhecida/i.test(e.message)) return { semCamada: true }; throw e; } },
    async setoresSituacao(projeto) { try { return (await chamar('setores_situacao', { projeto })).setores || []; } catch (e) { if (/desconhecida/i.test(e.message)) return []; throw e; } },
    async setoresAtribuir(projeto, itens) { return chamar('setores_atribuir', { projeto, itens }); },
    async producao(projeto, de, ate) { return chamar('producao', { projeto, de, ate }); },
    async producaoMinha(projeto) { return chamar('producao_minha', { projeto }); },
    async producaoTime(projeto, time) { return chamar('producao_time', time ? { projeto, time } : { projeto }); },
    // servidor antigo (sem times nem dias): lista vazia
    async timesListar() { try { return (await chamar('times_listar')).times || []; } catch (e) { if (/desconhecida/i.test(e.message)) return []; throw e; } },
    async timeSalvar(time) { return chamar('time_salvar', { time }); },
    async diasListar(projeto) { try { return (await chamar('dias_listar', { projeto })).dias || []; } catch (e) { if (/desconhecida/i.test(e.message)) return []; throw e; } },
    async diaMarcar(projeto, dados) { return chamar('dia_marcar', Object.assign({ projeto }, dados)); },
    async chuvaRegistrar(projeto, dados) { return chamar('chuva_registrar', Object.assign({ projeto }, dados)); },
    async medicaoFechar(projeto, de, ate) { return chamar('medicao_fechar', { projeto, de, ate }); },
    async auditoriaSortear(projeto, setor) { return chamar('auditoria_sortear', { projeto, setor }); },
    async auditoriaConferir(projeto, setor, uuid, resultado, motivo) { return chamar('auditoria_conferir', { projeto, setor, uuid, resultado, motivo }); },
    async chaveCriar(nome, projeto) { return chamar('chave_criar', { nome, projeto }); },
    async chaveRevogar(id) { return chamar('chave_revogar', { id }); },
    async backupListar(projeto) { return (await chamar('backup_listar', { projeto })).copias; },
    async backupRestaurar(projeto, arquivo) { return chamar('backup_restaurar', { projeto, arquivo }); },
    async osSalvar(projeto, os) { return chamar('os_salvar', { projeto, os }); },
    async osAndamento(projeto, id, etapa, dados) { return chamar('os_andamento', { projeto, id, etapa, dados }); },
  };

  return {
    achatar,
    configurar(u) { url = u || null; },
    get demo() { return !url; },
    get servidor() { return url; },
    // sessão: { u, t } (token) ou, em servidor antigo, { u, s }
    credenciais(c) { cred = c; },
    como(l) { comoLogin = l || null; memo = new Map(); },
    aoExpirar(fn) { aoExpirar = fn; },
    get b() { return url ? Remoto : Demo; },
  };
})();
