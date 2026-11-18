// 2.15 (servidor): marca de quadra (Neofloresta / Em validação)
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
(async () => {
  await L.subir(); await L.configurar(); const vT = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } }); await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } });
  const novo = async (login, ind) => { await L.post('usuario_salvar', { usuario_dados: { login, senha: login + '12345', nome: login, perfil: 'coletor', projeto: PJ, equipe: login.toUpperCase(), codigo: login.slice(0, 3).toUpperCase(), indicacao: ind } }); await L.post('aceitar_termo', { versao: vT }, login, login + '12345'); };
  await novo('maria', 'Gap'); await novo('eq1', 'Neofloresta');
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const viz = cam.quadras.filter((x) => x.f && x.f.length >= 1).slice(0, 8); await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const N = viz.map((x) => x.n); const p = (a, d, u, s) => L.post(a, Object.assign({ projeto: PJ }, d), u, s); const M = ['maria', 'maria12345'], E = ['eq1', 'eq112345'];
  const neg = async (pr) => { try { const r = await pr; return r && r.recusadas && r.recusadas[0] ? r.recusadas[0].motivo : 'aceito'; } catch (e) { return String(e.message || e); } };
  const sit = async () => { const m = {}; (await p('quadras_situacao', {})).quadras.forEach((q) => { m[q.numero] = q; }); return m; };
  // pedido pendente antes da marca
  await p('reserva_pedir', { quadras: [N[2]] }, ...M);
  const r1 = await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[0], marca: 'Neofloresta' }, { tipo: 'quadra', numero: N[1], marca: 'Validação' }, { tipo: 'quadra', numero: N[2], marca: 'Validação' }, { tipo: 'quadra', numero: N[3], marca: 'Inventada' }] }, 'admin', undefined);
  const S = await sit();
  ok('W.1', S[N[0]].marca === 'Neofloresta' && S[N[1]].marca === 'Validação' && r1.recusadas.length === 1 && /inválida/.test(r1.recusadas[0].motivo), `marcas: ${S[N[0]].marca} / ${S[N[1]].marca}; recusadas: ${JSON.stringify(r1.recusadas)}`);
  const ped = (await p('reserva_listar', {}, ...M)).pedidos.find((x) => x.quadra === N[2]);
  ok('W.2', ped && ped.situacao === 'Recusado' && /bloqueada pela coordenação/.test(ped.motivo), `pedido pendente ao marcar: ${ped && ped.situacao} (${ped && ped.motivo})`);
  const rp = await p('reserva_pedir', { quadras: [N[0], N[1]] }, ...M);
  ok('W.3', rp.criados.length === 0 && rp.recusadas.length === 2, `parceiro pede quadra marcada: ${JSON.stringify(rp.recusadas.map((x) => x.motivo))}`);
  const m1 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[0], situacao: 'Em levantamento' }] }, ...M)); const m2 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[1], situacao: 'Em levantamento' }] }, ...E)); const m3 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[0], situacao: 'Em levantamento' }] }, ...E));
  const S2 = await sit();
  ok('W.4', /da Neofloresta/.test(m1) && /validação/.test(m2) && m3 === 'aceito' && S2[N[0]].equipe === 'EQ1', `parceiro em quadra Neofloresta: "${m1}"; equipe nossa em validação: "${m2}"; equipe nossa em quadra Neofloresta: ${m3} (equipe ${S2[N[0]].equipe})`);
  const fv = await neg(p('quadras_marcar', { itens: [{ tipo: 'face', numero: N[1] + '-' + viz[1].f[0].i, situacao: 'Em levantamento' }] }, ...E));
  const t = new Date(Date.now() - 3600e3).toISOString(); const reg = (u, q, usr) => p('registro', { linha: { uuid: u, projeto: PJ, equipe: 'EQ1', criado_em: t, atualizado_em: t, latitude: -20.144, longitude: -44.887, 'Altura total (m)': 5, Categoria: '1', 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', quadra: q } }, ...usr);
  const rv = await neg(reg('dddd0000-0000-4000-8000-000000000001', N[1], E));
  ok('W.5', /validação/.test(fv) && /validação/.test(rv), `face em validação: "${fv}"; árvore em validação: "${rv}"`);
  const r6 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[0], marca: 'Validação' }] }, 'admin', undefined)); const r7 = await neg(p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[1], equipe: 'EQ1' }] }, 'admin', undefined));
  ok('W.6', /já reservada/.test(r6) && /validação/.test(r7), `marcar quadra com equipe: "${r6}"; reservar quadra em validação: "${r7}"`);
  await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[4], marca: 'Validação' }] }, ...M); const S3 = await sit();
  ok('W.7', !(S3[N[4]] || {}).marca, `parceiro tentando se dar a marca: "${(S3[N[4]] || {}).marca || ''}"`);
  await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[1], marca: '' }] }, 'admin', undefined); const rl = await p('reserva_pedir', { quadras: [N[1]] }, ...M);
  ok('W.8', rl.criados.length === 1, `depois de tirar a marca o parceiro pode pedir: ${JSON.stringify(rl.criados.length)}`);
  const f = Object.values(R).filter((x) => !x.passou).length; console.log(f ? f + ' FALHA(S)' : 'TUDO OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
