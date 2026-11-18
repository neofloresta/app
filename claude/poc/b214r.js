// 2.14 (correções do verificador): quadra em levantamento não entra em pedido; reserva direta derruba pedidos; aprovar a própria quadra; cancelados fora da lista
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
(async () => {
  await L.subir(); await L.configurar(); const vT = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const novo = async (login, ind) => { await L.post('usuario_salvar', { usuario_dados: { login, senha: login + '12345', nome: login, perfil: 'coletor', projeto: PJ, equipe: login.toUpperCase(), codigo: login.slice(0, 3).toUpperCase(), indicacao: ind } }); await L.post('aceitar_termo', { versao: vT }, login, login + '12345'); };
  await novo('maria', 'Gap'); await novo('joao', 'Gap'); await novo('eq1', '');
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const viz = cam.quadras.filter((x) => x.f && x.f.length >= 1).slice(0, 6); await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const N = viz.map((x) => x.n); const p = (a, d, u, s) => L.post(a, Object.assign({ projeto: PJ }, d), u, s); const M = ['maria', 'maria12345'], J = ['joao', 'joao12345'];
  // 1. face começada por outra equipe: pedido recusado
  await p('quadras_marcar', { itens: [{ tipo: 'face', numero: N[0] + '-' + viz[0].f[0].i, situacao: 'Em levantamento' }] }, 'admin', undefined);
  const r1 = await p('reserva_pedir', { quadras: [N[0]] }, ...M);
  ok('V.1', r1.criados.length === 0 && /em levantamento/.test((r1.recusadas[0] || {}).motivo), `pedido: ${JSON.stringify(r1)}`);
  // 2. coordenação reserva direto: pedido pendente cai
  await p('reserva_pedir', { quadras: [N[1]] }, ...M); await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[1], equipe: 'EQ1' }] }, 'admin', undefined);
  const l2 = (await p('reserva_listar', {}, 'admin', undefined)).pedidos.find((x) => x.quadra === N[1]);
  ok('V.2', l2 && l2.situacao === 'Recusado' && l2.decidido_por === 'sistema', `pedido: ${l2 && l2.situacao}/${l2 && l2.decidido_por}: ${l2 && l2.motivo}`);
  // 3. dono da quadra reservada direto: o pedido vira Aprovado
  await p('reserva_pedir', { quadras: [N[2]] }, ...J); const pj = (await p('reserva_listar', {}, ...J)).pedidos.find((x) => x.quadra === N[2]);
  await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[2], equipe: 'JOAO' }] }, 'admin', undefined); const l3 = (await p('reserva_listar', {}, ...J)).pedidos.find((x) => x.id === pj.id);
  ok('V.3', l3.situacao === 'Aprovado', `pedido do dono: ${l3.situacao} (${l3.motivo})`);
  // 4. cancelados não vão para a coordenação
  await p('reserva_pedir', { quadras: [N[3]] }, ...M); const pm = (await p('reserva_listar', {}, ...M)).pedidos.find((x) => x.quadra === N[3]); await p('reserva_cancelar', { id: pm.id }, ...M);
  const la = (await p('reserva_listar', {}, 'admin', undefined)).pedidos; const lm = (await p('reserva_listar', {}, ...M)).pedidos;
  ok('V.4', !la.some((x) => x.situacao === 'Cancelado') && lm.some((x) => x.situacao === 'Cancelado'), `coordenação vê cancelados: ${la.filter((x) => x.situacao === 'Cancelado').length}; a Maria vê: ${lm.filter((x) => x.situacao === 'Cancelado').length}`);
  const f = Object.values(R).filter((x) => !x.passou).length; console.log(f ? f + ' FALHA(S)' : 'TUDO OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
