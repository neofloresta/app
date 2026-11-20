// 2.17 (servidor): time da casa trabalha junto nas faces e quadras, registro profissional opcional, quadra validada, corrigir posição e prêmio sem teto
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
(async () => {
  await L.subir(); await L.configurar(); const vT = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } }); await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } });
  const novo = async (login, ind) => { await L.post('usuario_salvar', { usuario_dados: { login, senha: login + '12345', nome: login, perfil: 'coletor', projeto: PJ, equipe: login.toUpperCase(), codigo: login.slice(0, 3).toUpperCase(), indicacao: ind } }); await L.post('aceitar_termo', { versao: vT }, login, login + '12345'); };
  await novo('maria', 'Gap'); await novo('neo1', 'Neofloresta'); await novo('neo2', 'Neofloresta');
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const viz = cam.quadras.filter((x) => x.f && x.f.length >= 2).slice(0, 6); await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const N = viz.map((x) => x.n); const p = (a, d, u, s) => L.post(a, Object.assign({ projeto: PJ }, d), u, s); const M = ['maria', 'maria12345'], E1 = ['neo1', 'neo112345'], E2 = ['neo2', 'neo212345'];
  const neg = async (pr) => { try { const r = await pr; return r && r.recusadas && r.recusadas[0] ? r.recusadas[0].motivo : 'aceito'; } catch (e) { return String(e.message || e); } };
  const sit = async (u) => { const j = await p('quadras_situacao', { faces: true }, ...(u || ['admin', undefined])); const m = { q: {}, f: {}, parceiras: j.parceiras }; j.quadras.forEach((q) => { m.q[q.numero] = q; }); (j.faces || []).forEach((f) => { m.f[f.numero] = f; }); return m; };
  // 1. registro profissional do avaliador é opcional
  const pe = await neg(L.post('pessoa_salvar', { pessoa: { projeto: PJ, nome: 'Vitor Sem Registro', funcao: 'Avaliador', vinculo: 'CLT', time: 'Neofloresta' } }).then((r) => (r.id ? 'aceito' : 'sem id')));
  ok('T.1', pe === 'aceito', `avaliador sem registro profissional: ${pe}`);
  // 2. time da casa: a neo1 começa a quadra e a face, a neo2 encerra a face, encerra as demais e fecha a quadra; o parceiro continua de fora
  const q0 = viz[0]; const fid = (q, i) => q.n + '-' + q.f[i].i;
  await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: q0.n, situacao: 'Em levantamento' }, { tipo: 'face', numero: fid(q0, 0), situacao: 'Em levantamento' }] }, ...E1);
  const a1 = await neg(p('quadras_marcar', { itens: [{ tipo: 'face', numero: fid(q0, 0), situacao: 'Levantada' }] }, ...E2)); const s1 = await sit();
  const a2 = await neg(p('quadras_marcar', { itens: q0.f.slice(1).map((f) => ({ tipo: 'face', numero: q0.n + '-' + f.i, situacao: 'Levantada' })) }, ...E2));
  const pm = await neg(p('quadras_marcar', { itens: [{ tipo: 'face', numero: fid(viz[1], 0), situacao: 'Em levantamento' }] }, ...E1)); const pm2 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: q0.n, situacao: 'Em levantamento' }] }, ...M));
  const a3 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: q0.n, fechar: true }] }, ...E2)); const s2 = await sit();
  ok('T.2', a1 === 'aceito' && s1.f[fid(q0, 0)].situacao === 'Levantada' && s1.f[fid(q0, 0)].marcada_por === 'neo2' && a2 === 'aceito' && a3 === 'aceito' && !!s2.q[q0.n].fechada_em && s2.q[q0.n].equipe === 'NEO1' && /NEO1|reservada|Neofloresta/i.test(pm2) && pm === 'aceito' && /neo2/.test(s2.q[q0.n].historico || ''),
    `neo2 encerra a face que a neo1 começou: ${a1} (marcada por ${s1.f[fid(q0, 0)].marcada_por}); demais faces: ${a2}; neo2 fecha a quadra da neo1: ${a3} (equipe da quadra continua ${s2.q[q0.n].equipe}); parceiro na mesma quadra: "${pm2}"`);
  // 3. o app recebe quais equipes são de time parceiro (para as cores por time)
  const sc = await sit(E1);
  ok('T.3', Array.isArray(sc.parceiras) && sc.parceiras.join() === 'maria', `equipes parceiras enviadas ao coletor: ${JSON.stringify(sc.parceiras)}`);
  // 4. quadra validada: automática, com todos os registros validados; volta a levantada com devolução ou registro novo
  const t = new Date(Date.now() - 3600e3).toISOString(); const reg = (u, q, usr, extra) => p('registro', { linha: Object.assign({ uuid: u, projeto: PJ, equipe: usr[0].toUpperCase(), criado_em: t, atualizado_em: t, concluido_em: t, latitude: -20.144, longitude: -44.887, 'Altura total (m)': 5, Categoria: '1', 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', quadra: q }, extra || {}) }, ...usr);
  const U = (k) => 'eeee0000-0000-4000-8000-00000000000' + k; await reg(U(1), q0.n, E1); await reg(U(2), q0.n, E2);
  const v0 = (await sit()).q[q0.n].validada; await p('validar', { itens: [{ uuid: U(1), estado: 'Validado' }] }); const v1 = (await sit()).q[q0.n].validada;
  await p('validar', { itens: [{ uuid: U(2), estado: 'Validado' }] }); const v2 = (await sit()).q[q0.n].validada; const sitV = (await sit()).q[q0.n].situacao;
  await p('validar', { itens: [{ uuid: U(2), estado: 'Devolvido', obs: 'conferir a espécie' }] }); const v3 = (await sit()).q[q0.n].validada;
  await p('validar', { itens: [{ uuid: U(2), estado: 'Descartado', obs: 'duplicado' }] }); const v4 = (await sit()).q[q0.n].validada;
  await reg(U(3), q0.n, E1); const v5 = (await sit()).q[q0.n].validada;
  ok('T.4', !v0 && !v1 && v2 === true && sitV === 'Levantada' && !v3 && v4 === true && !v5, `sem validar: ${!!v0}; um de dois validados: ${!!v1}; todos validados: ${!!v2} (situação gravada continua "${sitV}"); um devolvido: ${!!v3}; o devolvido foi reprovado (não conta): ${!!v4}; entrou registro novo: ${!!v5}`);
  // 5. corrigir a posição: coordenação move o ponto, mesmo validado; quadra e histórico acompanham; a equipe não pode
  const antes = (await p('listar', {})).linhas.find((l) => l.uuid === U(1));
  const mv = await p('registro_posicao', { uuid: U(1), lat: -20.14412, lon: -44.88705, quadra: N[1], face: N[1] + '-' + viz[1].f[0].i });
  const dep = (await p('listar', {})).linhas.find((l) => l.uuid === U(1));
  const negE = await neg(p('registro_posicao', { uuid: U(1), lat: -20.1442, lon: -44.8871 }, ...E1).then(() => 'aceito')); const longe = await neg(p('registro_posicao', { uuid: U(1), lat: -20.5, lon: -44.887 }).then(() => 'aceito')); const nada = await p('registro_posicao', { uuid: U(1), lat: -20.14412, lon: -44.88705 });
  ok('T.5', mv.atualizado && mv.dist > 10 && mv.dist < 20 && Math.abs(+dep.latitude + 20.14412) < 1e-7 && Math.abs(+dep.longitude + 44.88705) < 1e-7 && String(dep.quadra) === String(N[1]) && dep.validacao === 'Validado' && /posição corrigida pela coordenação \(1\d,\d m; antes -20\.144000, -44\.887000\); quadra /.test(dep.historico || '') && dep.ponto_ajustado === 'sim' && /perfil/.test(negE) && /5 km/.test(longe) && nada.atualizado === false,
    `movido ${mv.dist} m; quadra ${antes.quadra} → ${dep.quadra}; continua "${dep.validacao}"; histórico: "${String(dep.historico || '').slice(-140)}"; equipe tentando: "${negE}"; a 40 km: "${longe}"; mesmo ponto de novo: ${nada.atualizado}`);
  // 6. prêmio do time da casa pelo regulamento: superação de R$ 2,00 (avaliador) e R$ 1,00 (auxiliar), sem teto; agrupamento conta como um registro
  const prj = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ);
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj, { meta_dia: '100', teto_dia: '0', premio_meta_av: '250', premio_meta_ax: '150', sup_av: '2', sup_ax: '1' }) });
  const nova = async (pe2) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe2) })).id;
  const idAna = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', vinculo: 'CLT', time: 'Neofloresta' }); const idCaio = await nova({ nome: 'Caio Reis', funcao: 'Auxiliar', vinculo: 'CLT', time: 'Neofloresta' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', avaliador_id: idAna, auxiliar_id: idCaio } });
  const ids = []; for (const dia of ['02', '03']) for (let k = 0; k < 150; k++) { const uuid = `pr-${dia}-${k}`; const tt = `2026-11-${dia}T${String(11 + Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}:00.000Z`; ids.push(uuid);
    await L.post('registro', { projeto: PJ, linha: { uuid, projeto: PJ, equipe: 'Equipe 1', criado_em: tt, atualizado_em: tt, concluido_em: tt, latitude: -20.15, longitude: -44.85, 'Altura total (m)': 5, Categoria: k === 0 ? '7' : '1', 'Qtde estimada de individuos': k === 0 ? 40 : '', 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', Codigo: 'P' + dia + k } }, 'div-1', 'equipe01'); }
  for (let i = 0; i < ids.length; i += 100) await p('validar', { itens: ids.slice(i, i + 100).map((uuid) => ({ uuid, estado: 'Validado' })) });
  const P = await L.post('producao', { projeto: PJ, de: '2026-11-02', ate: '2026-11-08' }); const sA = P.semanas.find((x) => x.nome === 'Ana Souza') || {}; const sC = P.semanas.find((x) => x.nome === 'Caio Reis') || {};
  // conferência com a tabela do regulamento (21 dias trabalhados no mês): média 130 dá 1.510 e 780; média 150 dá 2.350 e 1.200
  const tab = (media) => [(media - 100) * 21 * 2 + 250, (media - 100) * 21 * 1 + 150];
  ok('T.6', sA.media === 150 && sA.diasTrabalhados === 2 && sA.superacao === 200 && sC.superacao === 100 && sA.premioMeta === 62.5 && sC.premioMeta === 37.5 && sA.teto === 0 && tab(130).join() === '1510,780' && tab(150).join() === '2350,1200',
    `semana com média ${sA.media} em ${sA.diasTrabalhados} dias (o agrupamento contou como 1): superação ${sA.superacao} (avaliadora) e ${sC.superacao} (auxiliar), sem teto (com o teto de 130 seriam 120 e 60); prêmio de meta da semana ${sA.premioMeta} e ${sC.premioMeta}; tabela do regulamento: média 130 = ${tab(130).join(' e ')}, média 150 = ${tab(150).join(' e ')}`);
  const f = Object.values(R).filter((x) => !x.passou).length; console.log(f ? f + ' FALHA(S)' : 'TUDO OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
