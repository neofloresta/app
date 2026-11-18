// 2.14 (servidor): pedido de reserva de quadra pelos coletores parceiros (por pessoa, até 5, aprovação na ordem de chegada)
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
const falha = async (fn) => { try { await fn(); return ''; } catch (e) { return String(e.message); } };
(async () => {
  await L.subir(); await L.configurar();
  const vTermo = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const novo = async (login, senha, perfil, equipe, extra = {}) => { await L.post('usuario_salvar', { usuario_dados: Object.assign({ login, senha, nome: equipe || login, perfil, projeto: PJ, equipe, codigo: login.slice(0, 3).toUpperCase() }, extra) }); await L.post('aceitar_termo', { versao: vTermo }, login, senha); };
  await novo('rev1', 'revisor01', 'revisor', ''); await novo('cli1', 'cliente01', 'cliente', ''); await novo('time-gap', 'timegap01', 'time', '', { indicacao: 'Gap' });
  const parc = ['joao', 'maria', 'jose']; for (const n of parc) await novo(n, n + '12345', 'coletor', n.toUpperCase(), { indicacao: 'Gap' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', indicacao: 'Neofloresta' } });
  const U = { joao: ['joao', 'joao12345'], maria: ['maria', 'maria12345'], jose: ['jose', 'jose12345'], rev: ['rev1', 'revisor01'], cli: ['cli1', 'cliente01'], time: ['time-gap', 'timegap01'], div: ['div-1', 'equipe01'], adm: ['admin', L.senha()] };
  const p = (acao, dados, [u, s]) => L.post(acao, Object.assign({ projeto: PJ }, dados), u, s);
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const base = cam.quadras.find((x) => x.f && x.f.length >= 2); const viz = [base].concat(cam.quadras.filter((x) => x.f && x.f.length >= 1 && x.n !== base.n).slice(0, 19));
  await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const N = viz.map((x) => x.n); const sit = async () => { const m = {}; (await p('quadras_situacao', {}, U.adm)).quadras.forEach((q) => { m[q.numero] = q; }); return m; };
  // 1. pedir
  const r1 = await p('reserva_pedir', { quadras: [N[0]] }, U.joao); const lj = (await p('reserva_listar', {}, U.joao)).pedidos; const lr = (await p('reserva_listar', {}, U.rev)).pedidos; const lm = (await p('reserva_listar', {}, U.maria)).pedidos;
  ok('T.1', r1.criados.length === 1 && lj.length === 1 && lj[0].situacao === 'Aguardando' && lj[0].equipe === 'JOAO' && lr.length === 1 && lm.length === 0, `criados ${r1.criados}; o João vê ${lj.length}; a coordenação vê ${lr.length}; a Maria vê ${lm.length}`);
  // 2. quem não é parceiro, quadra inexistente, repetido
  const e1 = await falha(() => p('reserva_pedir', { quadras: [N[1]] }, U.div)); const r2 = await p('reserva_pedir', { quadras: ['999999999'] }, U.joao); const r3 = await p('reserva_pedir', { quadras: [N[0]] }, U.joao);
  const ec = await falha(() => p('reserva_pedir', { quadras: [N[1]] }, U.cli)); const et = await falha(() => p('reserva_listar', {}, U.time)); const ed = await falha(() => p('reserva_decidir', { id: lj[0].id, decisao: 'Aprovado' }, U.joao));
  ok('T.2', /parceiro/.test(e1) && r2.recusadas.length === 1 && /não existe/.test(r2.recusadas[0].motivo) && r3.recusadas.length === 1 && /já pediu/.test(r3.recusadas[0].motivo) && /não tem acesso/.test(ec) && /não tem acesso/.test(et) && /não tem acesso/.test(ed), `Neofloresta: "${e1}"; inexistente: "${(r2.recusadas[0] || {}).motivo}"; repetido: "${(r3.recusadas[0] || {}).motivo}"; cliente: "${ec}"; time: "${et}"; coletor decidindo: "${ed}"`);
  // 3. dois pedidos da mesma quadra: aprova o primeiro, o outro cai sozinho
  await p('reserva_pedir', { quadras: [N[0]] }, U.maria); await p('reserva_pedir', { quadras: [N[0]] }, U.jose);
  let todos = (await p('reserva_listar', {}, U.rev)).pedidos; const pJ = todos.find((x) => x.login === 'joao' && x.quadra === N[0]); const pM = todos.find((x) => x.login === 'maria' && x.quadra === N[0]);
  const ap = await p('reserva_decidir', { id: pJ.id, decisao: 'Aprovado' }, U.rev); todos = (await p('reserva_listar', {}, U.rev)).pedidos;
  const aposM = todos.find((x) => x.id === pM.id); const aposZ = todos.find((x) => x.login === 'jose' && x.quadra === N[0]); const S = await sit();
  ok('T.3', ap.situacao === 'Aprovado' && aposM.situacao === 'Recusado' && aposM.decidido_por === 'sistema' && /outra pessoa/.test(aposM.motivo) && aposZ.situacao === 'Recusado' && S[N[0]].equipe === 'JOAO' && S[N[0]].atribuida === 'sim', `aprovado: ${ap.situacao}; Maria: ${aposM.situacao} (${aposM.decidido_por}, "${aposM.motivo}"); José: ${aposZ.situacao}; quadra ${N[0]} agora é da equipe ${S[N[0]].equipe}`);
  // 4. a quadra aprovada libera só para quem pediu primeiro; as outras seguem bloqueadas para os parceiros
  const fa = viz.find((x) => x.n === N[0]).f[0]; const fb = viz.find((x) => x.n === N[1]).f[0];
  const m1 = await p('quadras_marcar', { itens: [{ tipo: 'face', numero: N[0] + '-' + fa.i, situacao: 'Em levantamento' }] }, U.joao); const m2 = await p('quadras_marcar', { itens: [{ tipo: 'face', numero: N[0] + '-' + fa.i, situacao: 'Em levantamento' }] }, U.maria); const m3 = await p('quadras_marcar', { itens: [{ tipo: 'face', numero: N[1] + '-' + fb.i, situacao: 'Em levantamento' }] }, U.joao);
  ok('T.4', m1.recusadas.length === 0 && m2.recusadas.length === 1 && /não reservada/.test(m2.recusadas[0].motivo) && m3.recusadas.length === 1 && /não reservada/.test(m3.recusadas[0].motivo), `João na quadra dele: ${m1.recusadas.length} recusadas; Maria na quadra do João: "${(m2.recusadas[0] || {}).motivo}"; João em quadra não reservada: "${(m3.recusadas[0] || {}).motivo}"`);
  // 5. recusar com motivo; a pessoa vê o motivo e pode pedir de novo
  await p('reserva_pedir', { quadras: [N[2]] }, U.maria); const pm2 = (await p('reserva_listar', {}, U.rev)).pedidos.find((x) => x.login === 'maria' && x.quadra === N[2]);
  await p('reserva_decidir', { id: pm2.id, decisao: 'Recusado', motivo: 'Quadra em validação' }, U.rev); const vm = (await p('reserva_listar', {}, U.maria)).pedidos.find((x) => x.id === pm2.id); const de_novo = await p('reserva_pedir', { quadras: [N[2]] }, U.maria);
  const dupla = await falha(() => p('reserva_decidir', { id: pm2.id, decisao: 'Aprovado' }, U.rev));
  ok('T.5', vm.situacao === 'Recusado' && vm.motivo === 'Quadra em validação' && de_novo.criados.length === 1 && /já foi recusado/.test(dupla), `Maria vê "${vm.situacao}: ${vm.motivo}"; pediu de novo: ${de_novo.criados.length}; decidir de novo: "${dupla}"`);
  // 6. cancelar o próprio pedido; ninguém cancela o dos outros
  const pm3 = (await p('reserva_listar', {}, U.maria)).pedidos.find((x) => x.quadra === N[2] && x.situacao === 'Aguardando'); const eo = await falha(() => p('reserva_cancelar', { id: pm3.id }, U.jose)); const cx = await p('reserva_cancelar', { id: pm3.id }, U.maria);
  ok('T.6', /outra pessoa/.test(eo) && cx.situacao === 'Cancelado', `outro tenta cancelar: "${eo}"; dono cancela: ${cx.situacao}`);
  // 7. limite de 5 por pessoa: reservadas mais pedidas
  const lote = await p('reserva_pedir', { quadras: N.slice(3, 8) }, U.jose); const seis = await p('reserva_pedir', { quadras: [N[8]] }, U.jose);
  const grande = await falha(() => p('reserva_pedir', { quadras: N.slice(0, 6) }, U.jose));
  ok('T.7', lote.criados.length === 5 && seis.criados.length === 0 && /Limite de 5/.test((seis.recusadas[0] || {}).motivo) && /No máximo 5/.test(grande), `pediu 5: ${lote.criados.length}; o sexto: "${(seis.recusadas[0] || {}).motivo}"; lote de 6: "${grande}"`);
  // 8. aprovar já com 5 reservadas (coordenação deu quadras direto): não passa; quadra reservada direto cai como recusada
  await p('reserva_pedir', { quadras: [N[14]] }, U.maria); await p('quadras_marcar', { itens: N.slice(9, 14).map((n) => ({ tipo: 'quadra', numero: n, equipe: 'MARIA' })) }, U.rev); const pm5 = (await p('reserva_listar', {}, U.rev)).pedidos.find((x) => x.login === 'maria' && x.quadra === N[14]);
  const lim = await falha(() => p('reserva_decidir', { id: pm5.id, decisao: 'Aprovado' }, U.rev));
  await p('quadras_marcar', { itens: [{ tipo: 'quadra', numero: N[3], equipe: 'MARIA' }] }, U.rev); const ped3 = (await p('reserva_listar', {}, U.rev)).pedidos.find((x) => x.login === 'jose' && x.quadra === N[3]); const jaRes = ped3; // desde a 2.14 o pedido já cai sozinho quando a coordenação dá a quadra a outra pessoa
  ok('T.8', /já tem 5/.test(lim) && jaRes.situacao === 'Recusado' && /reservada para outra pessoa/.test(jaRes.motivo), `com 5 reservadas: "${lim}"; quadra dada direto a outra pessoa: ${jaRes.situacao} ("${jaRes.motivo}")`);
  // 9. quadra fechada deixa de contar no limite (a pessoa pode pedir outra)
  const rest = (await p('reserva_listar', {}, U.maria)); ok('T.9', rest.max === 5 && rest.ativas >= 5, `limite ${rest.max}; a Maria tem ${rest.ativas} reservadas`);
  const falhou = Object.entries(R).filter(([, v]) => !v.passou); console.log(`\n${Object.keys(R).length - falhou.length}/${Object.keys(R).length} passaram`); process.exit(falhou.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
