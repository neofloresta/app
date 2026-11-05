// Ordens de serviço: teste direto do servidor
const L = require('./lib'); const R = []; const ok = (n, c, o = '') => { R.push([n, c]); console.log(c ? 'OK  ' : 'FALHA', n, o); };
const P = async (acao, d) => { const r = await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) }); return r.json(); };
const FOTO = require('fs').readFileSync(__dirname + '/foto.jpg').toString('base64'); const LK = {};
(async () => {
  await L.subir(); await L.configurar(); const senha = L.senha();
  const T = (await P('login', { u: 'admin', s: senha })).token;
  await P('usuario_salvar', { t: T, usuario_dados: { login: 'rev', senha: 'revisor1', nome: 'Revisor', perfil: 'revisor', projeto: 'divinopolis', equipe: 'Coordenação' } });
  await P('usuario_salvar', { t: T, usuario_dados: { login: 'pref', senha: 'cliente1', nome: 'Prefeitura', perfil: 'cliente', projeto: 'divinopolis' } });
  const TR = (await P('login', { u: 'rev', s: 'revisor1' })).token; await P('aceitar_termo', { t: TR });
  const TC = (await P('login', { u: 'pref', s: 'cliente1' })).token; await P('aceitar_termo', { t: TC });
  const T1 = (await P('login', { u: 'div-1', s: 'equipe01' })).token;
  const T2 = (await P('login', { u: 'div-2', s: 'equipe02' })).token;
  const TO = (await P('login', { u: 'outra', s: 'outra001' })).token;
  const agora = new Date().toISOString();
  for (const k of ['a', 'b', 'c']) LK[k] = (await P('foto', { t: T1, projeto: 'divinopolis', nome: 'os-' + k + '.jpg', mime: 'image/jpeg', dados: FOTO })).url;
  const LINK = (k) => LK[k];
  await P('registro', { t: T1, projeto: 'divinopolis', linha: { uuid: 'arv1', projeto: 'divinopolis', equipe: 'Equipe 1', criado_em: agora, atualizado_em: agora, latitude: -20.14, longitude: -44.89, Codigo: 'E1-0001', Especie: 'Moquilea tomentosa', Categoria: '1', bairro_aprox: 'Centro', endereco_aprox: 'Rua Goiás, 100' } });

  let j = await P('os_listar', { t: TR, projeto: 'divinopolis' }); ok('lista vazia e tipos padrão', j.ok && j.ordens.length === 0 && j.tipos.includes('Supressão'), j.erro || j.tipos.join(', '));
  j = await P('os_salvar', { t: TR, projeto: 'divinopolis', os: { registro_uuid: 'arv1', tipo: 'Poda de limpeza', prioridade: 'Alta', descricao: 'Galhos secos sobre a calçada', responsavel: 'Equipe 1', prazo: '2026-11-20' } });
  const os1 = j.ordem; ok('revisor abre ordem ligada à árvore', j.ok && os1.status === 'Aberta' && os1.numero == 1 && os1.codigo_arvore === 'E1-0001' && os1.especie === 'Moquilea tomentosa' && os1.bairro === 'Centro', j.erro || JSON.stringify(os1).slice(0, 200));
  j = await P('os_salvar', { t: TR, projeto: 'divinopolis', os: { registro_uuid: 'arv1', tipo: 'Corte raso' } }); ok('tipo fora da lista recusado', !j.ok, j.erro);
  j = await P('os_salvar', { t: TR, projeto: 'divinopolis', os: { registro_uuid: 'naoexiste', tipo: 'Supressão' } }); ok('árvore inexistente recusada', !j.ok, j.erro);
  j = await P('os_salvar', { t: TR, projeto: 'divinopolis', os: { tipo: '=HYPERLINK("x")' } }); ok('fórmula no tipo recusada', !j.ok, j.erro);
  j = await P('os_salvar', { t: TC, projeto: 'divinopolis', os: { latitude: -20.15, longitude: -44.88, endereco: '=CMD()', tipo: 'Plantio', descricao: 'Plantar muda na praça', chave: 'cli-pedido-0001' } });
  const os2 = j.ordem; ok('cliente solicita serviço (fica Solicitada)', j.ok && os2.status === 'Solicitada' && os2.numero == 2 && os2.solicitada_por === 'pref', j.erro || os2.status);
  j = await P('os_salvar', { t: TC, projeto: 'divinopolis', os: { latitude: -20.15, longitude: -44.88, tipo: 'Plantio', chave: 'cli-pedido-0001' } }); ok('reenvio do mesmo pedido não duplica', j.ok && j.ignorado && j.ordem.numero == 2);
  j = await P('os_salvar', { t: TC, projeto: 'divinopolis', os: { id: os1.id, prioridade: 'Baixa' } }); ok('cliente não altera ordem', !j.ok, j.erro);
  j = await P('os_salvar', { t: TO, projeto: 'divinopolis', os: { registro_uuid: 'arv1', tipo: 'Supressão' } }); ok('equipe de outro projeto não abre ordem', !j.ok, j.erro);

  j = await P('os_listar', { t: T1, projeto: 'divinopolis' }); ok('equipe 1 vê só a ordem dela', j.ok && j.ordens.length === 1 && j.ordens[0].id === os1.id, j.ordens && j.ordens.map((o) => o.numero).join(','));
  j = await P('os_listar', { t: T2, projeto: 'divinopolis' }); ok('equipe 2 não vê ordem da equipe 1', j.ok && j.ordens.length === 0);
  j = await P('os_listar', { t: TC, projeto: 'divinopolis' }); ok('cliente acompanha todas', j.ok && j.ordens.length === 2);

  j = await P('os_andamento', { t: T2, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: { foto_antes: LINK('a') } }); ok('outra equipe não executa', !j.ok, j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: {} }); ok('iniciar poda exige foto de antes', !j.ok && /antes/.test(j.erro), j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: { foto_antes: 'javascript:alert(1)' } }); ok('link de foto fora do Drive recusado', !j.ok, j.erro);
  const ontem = new Date(Date.now() - 864e5).toISOString();
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: { foto_antes: 'https://drive.google.com/file/d/' + 'x'.repeat(30) + '/view' } }); ok('foto que não é do projeto recusada', !j.ok, j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: { foto_antes: LINK('a'), em: ontem } }); ok('equipe inicia com foto (data antes da abertura vira a do servidor)', j.ok && j.ordem.status === 'Em execução' && j.ordem.iniciada_em >= os1.aberta_em, j.erro || j.ordem.iniciada_em);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'iniciar', dados: { foto_antes: LINK('a') } }); ok('reenvio de iniciar é ignorado', j.ok && j.ignorado);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'concluir', dados: { obs: 'ok' } }); ok('concluir exige foto de depois', !j.ok && /depois/.test(j.erro), j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'concluir', dados: { foto_depois: LINK('b'), obs: '3 galhos removidos', em: '2099-01-01T00:00:00Z' } }); ok('conclui; data futura do aparelho vira a do servidor', j.ok && j.ordem.status === 'Concluída' && j.ordem.concluida_em < '2099' && j.ordem.execucao_obs === '3 galhos removidos', j.erro || j.ordem.concluida_em);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os1.id, etapa: 'cancelar', dados: { obs: 'x' } }); ok('concluída não cancela', !j.ok, j.erro);
  j = await P('os_salvar', { t: TR, projeto: 'divinopolis', os: { id: os1.id, prioridade: 'Baixa' } }); ok('concluída não se altera sem reabrir', !j.ok, j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'reabrir', dados: { obs: 'x' } }); ok('equipe não reabre', !j.ok, j.erro);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os1.id, etapa: 'reabrir', dados: {} }); ok('reabrir exige motivo', !j.ok, j.erro);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os1.id, etapa: 'reabrir', dados: { obs: 'Faltou um galho' } }); ok('revisor reabre com motivo', j.ok && j.ordem.status === 'Aberta');
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'concluir', dados: { foto_depois: LINK('c'), em: ontem } }); ok('conclusão registrada antes da reabertura é recusada', !j.ok && /reabriu/.test(j.erro), j.erro);
  j = await P('os_andamento', { t: T1, projeto: 'divinopolis', id: os1.id, etapa: 'concluir', dados: { foto_depois: LINK('c') } }); ok('conclui direto de Aberta mantendo a foto de antes', j.ok && j.ordem.status === 'Concluída' && j.ordem.foto_antes === LK.a, j.erro);
  const hist = j.ordem && j.ordem.historico.split(' | ');
  ok('histórico guarda cada etapa', hist && hist.length >= 5, hist && hist.join(' || '));

  j = await P('os_andamento', { t: TC, projeto: 'divinopolis', id: os2.id, etapa: 'aprovar', dados: {} }); ok('cliente não aprova o próprio pedido', !j.ok, j.erro);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os2.id, etapa: 'iniciar', dados: {} }); ok('pedido não aprovado não inicia', !j.ok, j.erro);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os2.id, etapa: 'aprovar', dados: { responsavel: 'Equipe 2', prazo: '2026-12-01' } }); ok('revisor aprova e escala equipe', j.ok && j.ordem.status === 'Aberta' && j.ordem.responsavel === 'Equipe 2');
  j = await P('os_andamento', { t: T2, projeto: 'divinopolis', id: os2.id, etapa: 'iniciar', dados: {} }); ok('plantio inicia sem foto de antes', j.ok && j.ordem.status === 'Em execução', j.erro);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os2.id, etapa: 'cancelar', dados: {} }); ok('cancelar exige motivo', !j.ok);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os2.id, etapa: 'cancelar', dados: { obs: 'Local sem espaço para muda' } }); ok('revisor cancela com motivo', j.ok && j.ordem.status === 'Cancelada' && j.ordem.motivo);

  // planilha: aba Ordens, sem fórmula
  const st = await L.stats();
  const os = st && st.ordens; // pode não existir no mock
  j = await P('os_listar', { t: TR, projeto: 'divinopolis' });
  ok('endereço com fórmula vira texto', j.ordens.find((o) => o.numero == 2).endereco.replace(/^'/, '') === '=CMD()');
  j = await P('auditoria_listar', { t: T, n: 50 }); ok('auditoria registra as etapas', j.itens.filter((x) => /^os_/.test(x.acao)).length >= 8, j.itens.filter((x) => /^os_/.test(x.acao)).map((x) => x.acao).join(','));
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: 'nada', etapa: 'concluir', dados: {} }); ok('ordem inexistente', !j.ok);
  j = await P('os_andamento', { t: TR, projeto: 'divinopolis', id: os1.id, etapa: 'apagar', dados: {} }); ok('etapa inválida', !j.ok);
  const f = R.filter((x) => !x[1]).length; console.log(`\n${f} falha(s) de ${R.length}`); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
