/**
 * ArborizIA · dados de demonstração (arquivo separado do Código.gs)
 *
 * gerarDemonstracao(): cria o projeto "Demonstração (dados de teste)" com mais de 1.000 coletas inventadas,
 *   de duas equipes da Neofloresta (CLT) e três avaliadores do parceiro Gap, com registros validados,
 *   em validação, devolvidos e pagos, mais os acessos de teste (equipes, cliente e parceiro).
 * apagarDemonstracao(): apaga tudo o que o gerarDemonstracao criou.
 *
 * Nada aqui mexe nos projetos de verdade. Como usar: no editor, escolha a função na lista ao lado de
 * "Depuração" e clique em Executar. O resultado (logins e senha de teste) aparece no Registro de execução.
 */
const DEMO_ID = 'demonstracao';
const DEMO_FOTO = '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';

function gerarDemonstracao() {
  if (tabela('Projetos', true).some((p) => p.id === DEMO_ID)) throw new Error('O projeto de demonstração já existe. Rode apagarDemonstracao primeiro.');
  const modelo = tabela('Projetos').find((p) => p.id === 'divinopolis') || tabela('Projetos')[0];
  if (!modelo) throw new Error('Crie um projeto de verdade antes de gerar a demonstração (ela copia o formulário dele).');
  let s = 20261112; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const entre = (a, b) => a + rnd() * (b - a); const sorteio = (pesos) => { let x = rnd() * pesos.reduce((a, p) => a + p[1], 0); for (const p of pesos) { x -= p[1]; if (x <= 0) return p[0]; } return pesos[0][0]; };
  const form = lerFormulario(modelo.formulario);
  salvarProjeto({ id: DEMO_ID, nome: 'Demonstração (dados de teste)', formulario: modelo.formulario, epsg: modelo.epsg || '', contratante: 'Prefeitura de teste', contrato: 'Teste 000/2026', municipio: modelo.municipio || 'Divinópolis/MG', meta: '10000' });
  const P = (nome, funcao, registro, vinculo, equipe, empresa) => { const id = salvarPessoa({ nome: nome, funcao: funcao, registro: registro, vinculo: vinculo, empresa: empresa || '', projeto: DEMO_ID, equipe: equipe }); return { id: id, nome: nome, registro: registro, vinculo: vinculo }; };
  const equipes = [
    { login: 'demo-eq1', equipe: 'Equipe 1', cod: 'D1', time: '', copa: 'area', dias: [0, 1, 3, 5, 7], porDia: [92, 122], av: P('Teste Ana Souza', 'Avaliador', 'CREA-MG 000001 (teste)', 'CLT', 'Equipe 1'), ax: P('Teste João Lima', 'Auxiliar', '', 'CLT', 'Equipe 1') },
    { login: 'demo-eq2', equipe: 'Equipe 2', cod: 'D2', time: '', copa: 'area', dias: [0, 2, 4, 6, 8], porDia: [88, 116], av: P('Teste Bruno Alves', 'Avaliador', 'CRBio 000002 (teste)', 'CLT', 'Equipe 2'), ax: P('Teste Carla Dias', 'Auxiliar', '', 'CLT', 'Equipe 2') },
    { login: 'demo-gap1', equipe: 'Gap 1', cod: 'G1', time: 'Gap', copa: 'raios', dias: [1, 2, 3, 9, 10], porDia: [32, 56], av: P('Teste Davi Rocha', 'Avaliador', 'CRBio 000003 (teste)', 'Parceiro', 'Gap 1', 'Gap'), ax: P('Teste Elisa Nunes', 'Auxiliar', '', 'Parceiro', 'Gap 1', 'Gap') },
    { login: 'demo-gap2', equipe: 'Gap 2', cod: 'G2', time: 'Gap', copa: 'raios', dias: [4, 5, 6, 10, 11], porDia: [30, 52], av: P('Teste Fábio Reis', 'Avaliador', 'CRBio 000004 (teste)', 'Parceiro', 'Gap 2', 'Gap'), ax: P('Teste Gabi Melo', 'Auxiliar', '', 'Parceiro', 'Gap 2', 'Gap') },
    { login: 'demo-gap3', equipe: 'Gap 3', cod: 'G3', time: 'Gap', copa: 'raios', dias: [7, 8, 9, 10, 11], porDia: [24, 40], av: P('Teste Helena Prado', 'Avaliador', 'CRBio 000005 (teste)', 'Parceiro', 'Gap 3', 'Gap'), ax: null },
  ];
  const senha = 'demo' + String(Math.floor(100000 + Math.random() * 900000));
  equipes.forEach((e) => salvarUsuario({ login: e.login, senha: senha, nome: e.equipe + ' (teste)', perfil: 'coletor', projeto: DEMO_ID, equipe: e.equipe, codigo: e.cod, modo_copa: e.copa, avaliador_id: e.av.id, auxiliar_id: e.ax ? e.ax.id : '', indicacao: e.time }));
  salvarUsuario({ login: 'demo-cliente', senha: senha, nome: 'Prefeitura (teste)', perfil: 'cliente', projeto: DEMO_ID, equipe: 'Cliente' });
  salvarUsuario({ login: 'demo-parceiro', senha: senha, nome: 'Gap (teste)', perfil: 'time', projeto: DEMO_ID, equipe: 'Gap', indicacao: 'Gap' });

  // últimos 12 dias úteis, terminando ontem
  const dias = []; for (let d = new Date(Date.now() - 864e5); dias.length < 12; d = new Date(d.getTime() - 864e5)) { const dd = Utilities.formatDate(d, FUSO, 'yyyy-MM-dd'); const sem = new Date(dd + 'T12:00:00-03:00').getUTCDay(); if (sem !== 0 && sem !== 6) dias.unshift(dd); }

  // pontos ao longo das bordas das quadras de verdade (quando o projeto modelo tem a camada); senão, quarteirões inventados
  const proj = projeto(DEMO_ID); const pasta = DriveApp.getFolderById(proj.pasta_id);
  let quadras = null; const info = infoQuadras(modelo.id);
  if (info && info.id) try {
    const arq = DriveApp.getFileById(info.id); quadras = JSON.parse(arq.getBlob().getDataAsString()).quadras;
    const copia = arq.makeCopy('Quadras - Demonstração.json', pasta);
    PROPS.setProperty('QD_' + DEMO_ID, JSON.stringify({ id: copia.getId(), em: new Date().toISOString(), total: quadras.length, faces: info.faces || 0, campo: info.campo || '' }));
  } catch (e) { quadras = null; Logger.log('Sem camada de quadras: ' + e.message); }
  const KY = 110540; const metros = (x1, y1, x2, y2) => { const kx = 111320 * Math.cos((y1 * Math.PI) / 180); return Math.sqrt(Math.pow((x2 - x1) * kx, 2) + Math.pow((y2 - y1) * KY, 2)); };
  let cx = -44.8908, cy = -20.1436;
  if (quadras && quadras.length) { const xs = quadras.map((q) => (q.b[0] + q.b[2]) / 2).sort((a, b) => a - b); const ys = quadras.map((q) => (q.b[1] + q.b[3]) / 2).sort((a, b) => a - b); cx = xs[Math.floor(xs.length / 2)]; cy = ys[Math.floor(ys.length / 2)]; }
  const sementes = [[-0.006, 0.005], [0.007, 0.004], [-0.005, -0.007], [0.006, -0.006], [0.0005, 0.0115]];
  function caminho(t) { // devolve uma função que entrega o próximo ponto da equipe t
    const sx = cx + sementes[t][0], sy = cy + sementes[t][1]; let aneis;
    if (quadras && quadras.length) {
      aneis = quadras.map((q) => ({ q: q, d: metros(sx, sy, (q.b[0] + q.b[2]) / 2, (q.b[1] + q.b[3]) / 2) })).filter((x) => x.d < 900).sort((a, b) => a.d - b.d).map((x) => ({ n: x.q.n, a: x.q.a[0] }))
        .filter((x) => { let per = 0; for (let i = 0; i + 3 < x.a.length; i += 2) per += metros(x.a[i], x.a[i + 1], x.a[i + 2], x.a[i + 3]); return per > 150 && per < 900; });
    }
    if (!aneis || aneis.length < 8) { aneis = []; const dx = 100 / (111320 * Math.cos((sy * Math.PI) / 180)), dy = 100 / KY; for (let k = 0; k < 40; k++) { const x0 = sx + ((k % 6) - 3) * dx * 1.12, y0 = sy + (Math.floor(k / 6) - 3) * dy * 1.12; aneis.push({ n: '', a: [x0, y0, x0 + dx, y0, x0 + dx, y0 + dy, x0, y0 + dy, x0, y0] }); } }
    let qi = 0, ei = 0, pos = 5;
    return function () {
      for (let guarda = 0; guarda < 100000; guarda++) {
        const an = aneis[qi % aneis.length]; const a = an.a;
        if (ei + 3 >= a.length) { qi++; ei = 0; pos = 5; continue; }
        const L = metros(a[ei], a[ei + 1], a[ei + 2], a[ei + 3]);
        if (pos > L - 4) { ei += 2; pos = 5; continue; }
        const f = pos / L; pos += entre(6, 17); const volta = Math.floor(qi / aneis.length) * 0.000012;
        return { lon: a[ei] + (a[ei + 2] - a[ei]) * f + entre(-1, 1) * 0.000008 + volta, lat: a[ei + 1] + (a[ei + 3] - a[ei + 1]) * f + entre(-1, 1) * 0.000008 + volta, quadra: an.n };
      }
      return { lon: sx, lat: sy, quadra: '' };
    };
  }

  const foto = salvarFoto(DEMO_ID, 'foto-de-teste.jpg', 'image/jpeg', DEMO_FOTO).url;
  const temCampo = {}; form.campos.forEach((c) => { temCampo[c.nome] = c; });
  const especies = (form.especies || []).map((e) => e.cientifico || e).filter((e) => e && !/n[aã]o identificada/i.test(e));
  const COMUNS = ['Moquilea tomentosa', 'Cenostigma pluviosum', 'Handroanthus chrysotrichus', 'Murraya paniculata', 'Lagerstroemia indica', 'Ligustrum lucidum', 'Bauhinia variegata', 'Handroanthus impetiginosus', 'Terminalia catappa', 'Schinus molle', 'Ficus benjamina', 'Mangifera indica'];
  especies.sort((x, y) => { const ix = COMUNS.indexOf(x), iy = COMUNS.indexOf(y); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy); }); // as mais comuns de rua primeiro
  if (!especies.length) especies.push('Moquilea tomentosa', 'Cenostigma pluviosum', 'Handroanthus chrysotrichus', 'Murraya paniculata', 'Lagerstroemia indica');
  const GRUPOS = [['Fiação ausente', ['Fiação baixa isolada', 'Fiação baixa nua', 'Fiação média compacta', 'Fiação derivação', 'Fiação serviços gerais'], 0.4], ['Tráfego sem interferência', ['Interfere pedestres', 'Interfere veículos'], 0.15],
    ['Podas ausente', ['Danos por podas', 'Galhos secos, podres ou com risco de queda', 'Poda drástica'], 0.3], ['Danos ausente', ['Lesões no tronco', 'Codominância de troncos'], 0.2], ['Raízes ausente', ['Afloramento da raiz no canteiro', 'Afloramento da raiz na calçada'], 0.3],
    ['Fitossanidade ausente', ['Cupim', 'Erva-de-passarinho', 'Fungo', 'Broca'], 0.14], ['Manejo nenhum', ['Manejo poda', 'Manejo poda', 'Manejo aumento de canteiro', 'Manejo tutoramento', 'Manejo adubação'], 0.38]];
  const BAIRROS = ['Centro', 'Sidil', 'Bom Pastor', 'Esplanada', 'Niterói'];
  const OBS_DEV = ['Foto sem a árvore inteira', 'CAP parece errado, conferir', 'Espécie não confere com a foto', 'Ponto longe da calçada'];
  const linhas = []; let num = 0; const agora = new Date().toISOString();
  equipes.forEach((e, t) => {
    const proximo = caminho(t); let seq = 0;
    e.dias.forEach((di) => {
      const d = dias[di]; const n = Math.round(entre(e.porDia[0], e.porDia[1])); const passo = 470 / n;
      for (let i = 0; i < n; i++) {
        const min = 8 * 60 + Math.round(i * passo) + (i * passo > 240 ? 90 : 0); const quando = new Date(d + 'T' + ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2) + ':' + ('0' + Math.floor(rnd() * 60)).slice(-2) + '-03:00').toISOString();
        const pt = proximo(); seq++; num++;
        const o = { uuid: 'demo-' + e.cod.toLowerCase() + '-' + ('0000' + seq).slice(-4), projeto: DEMO_ID, equipe: e.equipe, usuario: e.login, criado_em: quando, atualizado_em: quando, concluido_em: quando, latitude: Math.round(pt.lat * 1e7) / 1e7, longitude: Math.round(pt.lon * 1e7) / 1e7, precisao_gps_m: Math.round(entre(2, 7)), endereco_aprox: '', bairro_aprox: BAIRROS[t % BAIRROS.length],
          avaliador: e.av.nome, avaliador_id: e.av.id, avaliador_registro: e.av.registro, avaliador_vinculo: e.av.vinculo, auxiliar: e.ax ? e.ax.nome : '', auxiliar_id: e.ax ? e.ax.id : '', auxiliar_vinculo: e.ax ? e.ax.vinculo : '', historico: '', origem: 'demonstração' };
        form.campos.forEach((c) => { let v = ''; if (c.auto === 'codigo') v = e.cod + '-' + ('0000' + seq).slice(-4); else if (c.auto === 'coletor') v = e.cod; else if (c.tipo === 'datetime') v = quando; else if (c.tipo === 'bool') v = 0; else if (c.tipo === 'choice' && c.opcoes && c.opcoes.length && !c.calculado) v = c.opcoes[0].v; o[c.nome] = v; if (c.tipo === 'photo') o[c.nome + ' link'] = ''; });
        const por = (nome, v) => { if (temCampo[nome]) o[nome] = v; };
        const cat = sorteio([['1', 80], ['2', 8], ['3', 7], ['5', 5]]); por('Categoria', cat); por('Local do registro', rnd() < 0.92 ? 'Via pública (calçada)' : 'Canteiro central');
        const viva = rnd() < 0.96; por('Situacao', viva ? 'Viva' : 'Morta');
        por('Especie', especies[Math.floor(especies.length * Math.pow(rnd(), 2.4))]);
        const alt = cat === '2' ? entre(2, 3.6) : cat === '3' ? entre(3, 12) : entre(2.5, 16); por('Altura total (m)', Math.round(alt * 10) / 10); por('CAP (cm)', String(Math.round(cat === '2' ? entre(8, 30) : 12 + alt * entre(6, 11))));
        const raio = Math.max(0.6, alt * entre(0.22, 0.42)); const r1 = Math.round(raio * entre(0.85, 1.2) * 10) / 10, r2 = Math.round(raio * entre(0.8, 1.15) * 10) / 10; por('Modo de copa', e.copa);
        if (e.copa === 'area') { const ar = Math.round(Math.PI * raio * raio * 10) / 10; por('Area de copa medida (m2)', ar); }
        else { por('Raio de copa 1 (m)', r1); por('Raio de copa 2 (m)', r2); por('Raio de copa 3 (m)', r1); por('Raio de copa 4 (m)', r2); por('Area de copa (m2)', String(Math.round(Math.PI * Math.pow((r1 + r2) / 2, 2) * 100) / 100)); }
        por('Conflitos no raio de 2 m', rnd() < 0.76 ? 'Ausente' : 'Presente'); por('Marquise ou toldo', rnd() < 0.9 ? 'Ausente' : 'Presente');
        por('Ocos e cavidades', sorteio([['Ausente', 88], ['Presente (menor que 1/3)', 9], ['Presente (maior que 1/3)', 3]])); por('Qualidade da copa', sorteio([['Normal', 85], ['Estressada', 10], ['Sem folhagem (sazonal)', 3], ['Sem folhagem (poda)', 2]]));
        GRUPOS.forEach((g) => { if (!temCampo[g[0]]) return; if (rnd() < g[2]) { const k = g[1][Math.floor(rnd() * g[1].length)]; if (temCampo[k]) { o[k] = 1; o[g[0]] = 0; return; } } o[g[0]] = 1; });
        const risco = sorteio([['Baixo', 84], ['Médio', 11], ['Alto', 4], ['Severo', 1]]); por('Risco', risco);
        por('Probabilidade de falha', { Baixo: '4', 'Médio': '3', Alto: '2', Severo: '1' }[risco]); por('Probabilidade de impacto', { Baixo: '2', 'Médio': '3', Alto: '3', Severo: '4' }[risco]); por('Consequencias', { Baixo: '1', 'Médio': '2', Alto: '3', Severo: '4' }[risco]);
        if (risco === 'Alto' || risco === 'Severo') { por('Manejo nenhum', 0); por(risco === 'Severo' ? 'Manejo remoção do indivíduo' : 'Manejo poda', 1); }
        const pf = form.campos.find((c) => c.tipo === 'photo'); if (pf) { o[pf.nome] = 'DCIM/foto-de-teste.jpg'; o[pf.nome + ' link'] = foto; }
        // o que a categoria ou a situação esconde fica vazio, como no app
        (form.regras || []).forEach((rg) => { const cfg = (rg.por || {})[String(o[rg.campo])]; if (!cfg) return; Object.keys(cfg).forEach((nome) => { if (cfg[nome] !== 'oculto') return; const f = temCampo[nome]; o[nome] = f && f.tipo === 'bool' ? 0 : ''; if (f && f.tipo === 'photo') o[nome + ' link'] = ''; }); });
        // validação: dias antigos conferidos, os mais recentes ainda na fila
        const x = rnd(); let val = 'Pendente', obs = '';
        if (di <= 6 || (di <= 8 && x < 0.6)) { val = x > 0.995 ? 'Descartado' : x > 0.955 ? 'Devolvido' : 'Validado'; if (val === 'Devolvido') obs = OBS_DEV[Math.floor(rnd() * OBS_DEV.length)]; if (val === 'Descartado') obs = 'Registro duplicado'; }
        o.validacao = val; o.validacao_obs = obs; o.validado_por = val === 'Pendente' ? '' : 'admin'; o.validado_em = val === 'Pendente' ? '' : new Date(new Date(quando).getTime() + 26 * 36e5).toISOString(); o.validacao_hist = ''; o.numero_unico = num; o.servidor_em = agora; o.pagamento = '';
        linhas.push(o);
      }
    });
  });
  const sh = planilha(DEMO_ID); const chaves = {}; linhas.forEach((l) => Object.keys(l).forEach((k) => { chaves[k] = 1; }));
  const cab = cabecalho(sh, Object.keys(chaves).concat(COLS_SISTEMA));
  const valores = linhas.map((l) => cab.map((c) => celula(l[c])));
  if (sh.getMaxRows && sh.getMaxRows() < valores.length + 1) sh.insertRowsAfter(sh.getMaxRows(), valores.length + 1 - sh.getMaxRows()); // planilha nova vem com 1.000 linhas
  const rg = sh.getRange(2, 1, valores.length, cab.length);
  rg.setNumberFormats(valores.map((l) => l.map((v) => (typeof v === 'number' ? '0.##########' : '@')))); rg.setValues(valores);
  PROPS.setProperty('NUM_' + DEMO_ID, String(num));
  let medicao = ''; try { const m = fecharMedicao(DEMO_ID, dias[0], dias[4], { login: 'admin', nome: 'Coordenação' }); medicao = dias[0] + ' a ' + dias[4] + ' (' + m.medicao.arvores + ' árvores pagas)'; } catch (e) { medicao = 'não fechada: ' + e.message; }
  auditar('admin', 'demonstracao_gerar', DEMO_ID, linhas.length + ' registros de teste');
  const resumo = { projeto: 'Demonstração (dados de teste)', registros: linhas.length, de: dias[0], ate: dias[dias.length - 1], medicao: medicao, logins: equipes.map((e) => e.login).concat(['demo-cliente', 'demo-parceiro']), senha: senha, comQuadras: !!(quadras && quadras.length) };
  Logger.log('PRONTO: ' + resumo.registros + ' registros de teste no projeto "' + resumo.projeto + '", de ' + resumo.de + ' a ' + resumo.ate + '.');
  Logger.log('Medição de teste: ' + medicao);
  Logger.log('Acessos de teste (todos com a mesma senha): ' + resumo.logins.join(', '));
  Logger.log('Senha dos acessos de teste: ' + senha);
  Logger.log('Para apagar tudo: rode a função apagarDemonstracao.');
  return resumo;
}

function apagarDemonstracao() {
  const p = tabela('Projetos', true).find((x) => x.id === DEMO_ID);
  const us = tabela('Usuarios', true).filter((u) => /^demo-/.test(String(u.login)) && String(u.projeto) === DEMO_ID).map((u) => u.login);
  us.forEach((l) => { try { encerrarSessoesDe(l); } catch (e) { /* sem sessão */ } removerLinha('Usuarios', 'login', l); });
  garantirAba('Pessoas', COLS_PESSOAS); const ps = tabela('Pessoas', true).filter((x) => String(x.projeto) === DEMO_ID).map((x) => x.id);
  ps.forEach((id) => removerLinha('Pessoas', 'id', id));
  if (p) { try { DriveApp.getFolderById(p.pasta_id).setTrashed(true); } catch (e) { Logger.log('Pasta: ' + e.message); } removerLinha('Projetos', 'id', DEMO_ID); }
  ['QD_', 'NUM_', 'ST_'].forEach((k) => { try { if (PROPS.deleteProperty) PROPS.deleteProperty(k + DEMO_ID); else PROPS.setProperty(k + DEMO_ID, ''); } catch (e) { /* segue */ } });
  try { CacheService.getScriptCache().removeAll(['qdidx:' + DEMO_ID, 'painel:' + DEMO_ID + ':todos', 'painel:' + DEMO_ID + ':validados']); } catch (e) { /* segue */ }
  if (p) auditar('admin', 'demonstracao_apagar', DEMO_ID, us.length + ' acessos e ' + ps.length + ' pessoas');
  Logger.log(p ? 'Demonstração apagada: projeto, planilha e fotos de teste (na lixeira do Drive), ' + us.length + ' acessos e ' + ps.length + ' pessoas.' : 'Não havia projeto de demonstração. Removidos ' + us.length + ' acessos e ' + ps.length + ' pessoas de teste.');
  return { projeto: !!p, usuarios: us.length, pessoas: ps.length };
}
