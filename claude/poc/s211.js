// 2.11: modo quadra (reserva, fechar quadra, pagamento só com quadra fechada), foto da face, copa por time, legenda (teste direto do servidor)
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = []; const ok = (n, c, o = '') => { R.push([n, c]); console.log(c ? 'OK  ' : 'FALHA', n, '|', o); };
const PJ = 'divinopolis'; const neg = (p) => p.then(() => 'ACEITOU').catch((e) => e.message);
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx);
(async () => {
  await L.subir(); await L.configurar();
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const ana = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', time: 'Neofloresta' }); const bia = await nova({ nome: 'Bia Gap', funcao: 'Avaliador', registro: 'CRBio 2', vinculo: 'Parceiro', time: 'Gap' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', perfil: 'coletor', avaliador_id: ana } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', perfil: 'coletor', avaliador_id: bia } });
  const s1 = (await L.post('sessao', {}, 'div-1', 'equipe01')), s2 = (await L.post('sessao', {}, 'div-2', 'equipe02')), sa = await L.post('sessao', {});
  const e2 = (sa.equipes || []).find((x) => x.equipe === 'Equipe 2') || {};
  ok('copa e modo quadra pelo time; legenda', s1.usuario.modo_copa === 'area' && s2.usuario.modo_copa === 'raios2' && s2.usuario.modoQuadra === true && s1.usuario.modoQuadra === false && e2.parceiro === true && e2.time === 'Gap' && e2.av === 'Bia' && !(s2.equipes || []).length, `casa mede ${s1.usuario.modo_copa}, parceiro ${s2.usuario.modo_copa}; modo quadra só no parceiro; legenda "${e2.time} · ${e2.av}"; equipe de campo não recebe a lista`);
  const Q = ctx.Quadras; const r = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(r.feicoes, 'quadra', ['ruas']); cam.quadras = cam.quadras.filter((x) => ['2459', '2460'].includes(x.n)); cam.total = cam.quadras.length;
  await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(cam) }); const q1 = cam.quadras[0], q2 = cam.quadras[1]; const fid = (q, k) => q.n + '-' + q.f[k].i;
  const semRes = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, situacao: 'Em levantamento' }] }, 'div-2', 'equipe02'); const auto = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, situacao: 'Em levantamento', auto: true }] }, 'div-2', 'equipe02');
  const casa = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q2.n, situacao: 'Em levantamento' }] }, 'div-1', 'equipe01');
  ok('parceiro só trabalha em quadra reservada', semRes.recusadas.length === 1 && /reserva/.test(semRes.recusadas[0].motivo) && !auto.recusadas.length && auto.alteradas === 0 && casa.alteradas === 1, `sem reserva: "${semRes.recusadas[0] && semRes.recusadas[0].motivo}"; equipe da casa assume quadra livre`);
  await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, equipe: 'Equipe 2' }] });
  let sit = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const sq = () => sit.quadras.find((x) => x.numero === q1.n) || {};
  // registros na quadra reservada: validados, mas a quadra ainda está aberta
  const enviar = async (k) => { const uuid = `aaaa0000-0000-4000-8000-00000000000${k}`; const t = new Date(Date.now() - 3600e3).toISOString(); await L.post('registro', { projeto: PJ, linha: { uuid, projeto: PJ, equipe: 'Equipe 2', criado_em: t, atualizado_em: t, latitude: -20.144, longitude: -44.887, 'Altura total (m)': 5, Categoria: '1', 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', auxiliar_id: '', quadra: q1.n, face: fid(q1, 0) } }, 'div-2', 'equipe02'); return uuid; };
  const us = [await enviar(1), await enviar(2), await enviar(3)]; await L.post('validar', { projeto: PJ, itens: us.map((uuid) => ({ uuid, estado: 'Validado' })) });
  const hj = new Date().toISOString().slice(0, 10); const de = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  let P = await L.post('producao', { projeto: PJ, de, ate: hj }); const M0 = await L.post('producao_minha', { projeto: PJ }, 'div-2', 'equipe02');
  const semFecho = await neg(L.post('medicao_fechar', { projeto: PJ, de, ate: hj }));
  ok('quadra aberta: registro validado ainda não entra na medição', sq().reservada_em && P.totais.arvoresPagar === 0 && P.totais.quadraAberta === 3 && P.totais.totalPagar === 0 && (M0.pessoas[0] || {}).quadraAberta === 3 && (M0.pessoas[0] || {}).aReceber === 0 && /Nenhuma/.test(semFecho), `a pagar ${P.totais.totalPagar}; ${P.totais.quadraAberta} registros esperando a quadra fechar; a avaliadora vê o aviso (${(M0.pessoas[0] || {}).quadraAberta})`);
  // fechar: faltam faces; encerra todas (a primeira com foto) e fecha
  const f0 = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, fechar: true }] }, 'div-2', 'equipe02');
  const itensF = q1.f.map((f, k) => Object.assign({ tipo: 'face', numero: q1.n + '-' + f.i, situacao: 'Levantada' }, k === 0 ? { foto: 'https://drive.google.com/file/d/fotoDaFace01/view' } : k === 1 ? { foto: 'javascript:alert(1)' } : {}));
  await L.post('quadras_marcar', { projeto: PJ, itens: itensF }, 'div-2', 'equipe02'); const outro = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, fechar: true }] }, 'div-1', 'equipe01');
  const f1 = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, fechar: true }] }, 'div-2', 'equipe02'); sit = await L.post('quadras_situacao', { projeto: PJ, faces: true });
  const fa = sit.faces.find((x) => x.numero === fid(q1, 0)) || {}, fb = sit.faces.find((x) => x.numero === fid(q1, 1)) || {}; const reabre = await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q1.n, situacao: 'Em levantamento' }] }, 'div-2', 'equipe02');
  const sc = await L.post('quadras_situacao', { projeto: PJ, faces: true }, 'pref', 'x').catch(() => null);
  P = await L.post('producao', { projeto: PJ, de, ate: hj });
  ok('fechar quadra e foto da face', f0.recusadas.length === 1 && /Faltam \d+ face/.test(f0.recusadas[0].motivo) && outro.recusadas.length === 1 && !f1.recusadas.length && !!sq().fechada_em && sq().situacao === 'Levantada' && /fotoDaFace01/.test(fa.foto) && !fb.foto && reabre.recusadas.length === 1 && /coordenação reabre/.test(reabre.recusadas[0].motivo) && P.totais.arvoresPagar === 3 && P.totais.totalPagar === 7.5 && P.totais.quadraAberta === 0,
    `com faces abertas: "${f0.recusadas[0] && f0.recusadas[0].motivo}"; outra equipe não fecha; fechada em ${String(sq().fechada_em).slice(0, 10)}; foto da face guardada, link estranho recusado; só a coordenação reabre; agora a pagar ${P.totais.totalPagar}`);
  // reserva: 5 dias sem começar libera; começada ganha mais 3; depois libera e as árvores ficam
  await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q2.n, equipe: 'Equipe 2' }] });
  const velha = async (dias) => fetch(L.MOCK + '__teste', { method: 'POST', body: JSON.stringify({ aba: 'Quadras', chave: 'numero', valor: q2.n, campo: 'reservada_em', novo: new Date(Date.now() - dias * 864e5).toISOString(), projeto: PJ, limparCache: 'reservas:' + PJ }) }).then((x) => x.json());
  const t1 = await velha(4); sit = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const d4 = (sit.quadras.find((x) => x.numero === q2.n) || {}).equipe;
  await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fid(q2, 0), situacao: 'Levantada' }] }, 'div-2', 'equipe02');
  await velha(6); sit = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const d6 = (sit.quadras.find((x) => x.numero === q2.n) || {}).equipe;
  await velha(9); sit = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const q9 = sit.quadras.find((x) => x.numero === q2.n) || {}; const f9 = sit.faces.find((x) => x.numero === fid(q2, 0)) || {};
  await L.post('quadras_marcar', { projeto: PJ, itens: [{ numero: q2.n, equipe: 'Equipe 2' }] }); await velha(6); await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fid(q2, 0), situacao: 'A levantar' }] }); await velha(6); sit = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const q6 = sit.quadras.find((x) => x.numero === q2.n) || {};
  ok('reserva de 5 dias e mais 3', t1.ok && d4 === 'Equipe 2' && d6 === 'Equipe 2' && q9.equipe === '' && /vencida/.test(q9.historico) && f9.situacao === 'Levantada' && q6.equipe === '', `4 dias: segue com a ${d4}; 6 dias com uma face encerrada: segue; 9 dias: livre de novo ("${String(q9.historico).slice(-60)}"), a face encerrada fica; 6 dias sem começar: livre`);
  const falhas = R.filter((x) => !x[1]).length; console.log(`\n${falhas} falha(s) de ${R.length}`); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
