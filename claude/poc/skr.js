// Chave de integração (8.4) e restauração de cópia (7.6): teste direto do servidor
const L = require('./lib'); const R = []; const ok = (n, c, o = '') => { R.push([n, c]); console.log(c ? 'OK  ' : 'FALHA', n, o); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
(async () => {
  await L.subir(); await L.configurar(); await L.semear(300);
  const T = (await P('login', { u: 'admin', s: L.senha() })).token;
  const T1 = (await P('login', { u: 'div-1', s: 'equipe01' })).token;
  // 8.4
  let j = await P('chave_criar', { t: T1, nome: 'x', projeto: 'divinopolis' }); ok('equipe não cria chave', !j.ok, j.erro);
  j = await P('chave_criar', { t: T, nome: 'Sistema da prefeitura', projeto: 'divinopolis' }); const K = j.chave; ok('coordenação cria chave (mostrada uma vez)', j.ok && /^neo_[a-f0-9]{48}$/.test(K), j.erro);
  j = await P('chaves_listar', { t: T }); ok('lista não mostra a chave nem o resumo', j.ok && j.chaves.length === 1 && !JSON.stringify(j).includes(K) && !('hash' in j.chaves[0]), JSON.stringify(j.chaves));
  j = await P('listar', { chave_api: K, projeto: 'divinopolis', de: 0, n: 100 }); ok('sistema externo lê os registros em páginas', j.ok && j.linhas.length === 100 && j.total === 300 && j.proximo === 100, j.erro);
  j = await P('os_listar', { chave_api: K, projeto: 'divinopolis' }); ok('lê as ordens de serviço', j.ok && Array.isArray(j.ordens), j.erro);
  j = await P('painel', { chave_api: K, projeto: 'divinopolis' }); ok('lê os indicadores', j.ok && j.total === 300, j.erro);
  j = await P('registro', { chave_api: K, projeto: 'divinopolis', linha: { uuid: 'api1' } }); ok('chave não grava registro', !j.ok, j.erro);
  j = await P('validar', { chave_api: K, projeto: 'divinopolis', itens: [] }); ok('chave não valida', !j.ok, j.erro);
  j = await P('usuarios_listar', { chave_api: K }); ok('chave não lê usuários', !j.ok, j.erro);
  j = await P('listar', { chave_api: K, projeto: 'carmo' }); ok('chave não lê outro projeto', !j.ok, j.erro);
  j = await P('listar', { chave_api: 'neo_' + 'a'.repeat(48), projeto: 'divinopolis' }); ok('chave inventada recusada', !j.ok && j.sessao, j.erro);
  j = await P('auditoria_listar', { t: T, n: 50 }); ok('uso da chave fica na auditoria', j.itens.some((x) => x.acao === 'api_listar' && /prefeitura/.test(x.login)));
  const id = (await P('chaves_listar', { t: T })).chaves[0].id;
  j = await P('chave_revogar', { t: T, id }); j = await P('listar', { chave_api: K, projeto: 'divinopolis' }); ok('chave revogada para de funcionar', !j.ok, j.erro);
  // 7.6
  j = await P('backup_agora', { t: T }); ok('cópia feita', j.ok, j.erro || j.resumo);
  j = await P('backup_listar', { t: T, projeto: 'divinopolis' }); const copia = j.copias && j.copias[0]; ok('lista as cópias do projeto', j.ok && copia && /PMAU Divinópolis/.test(copia.nome), JSON.stringify(j.copias));
  await L.semear(50); // dados que chegaram depois da cópia
  j = await P('listar', { t: T, projeto: 'divinopolis', de: 0, n: 1 }); const depois = j.total;
  j = await P('backup_restaurar', { t: T1, projeto: 'divinopolis', arquivo: copia.id }); ok('equipe não restaura', !j.ok, j.erro);
  j = await P('backup_restaurar', { t: T, projeto: 'divinopolis', arquivo: 'qualquer' }); ok('arquivo fora das cópias recusado', !j.ok, j.erro);
  j = await P('backup_restaurar', { t: T, projeto: 'divinopolis', arquivo: copia.id }); ok('restaura e guarda o estado anterior', j.ok && j.registros === 300 && j.copiaAnterior, j.erro || JSON.stringify(j));
  j = await P('listar', { t: T, projeto: 'divinopolis', de: 0, n: 1 }); ok('planilha voltou ao conteúdo da cópia', j.total === 300 && depois === 350, `antes ${depois}, depois ${j.total}`);
  j = await P('backup_listar', { t: T, projeto: 'divinopolis' }); const ant = j.copias.find((c) => /antes da restauração/.test(c.nome)); ok('cópia "antes da restauração" aparece para desfazer', !!ant, JSON.stringify(j.copias.map((c) => c.nome)));
  j = await P('backup_restaurar', { t: T, projeto: 'divinopolis', arquivo: ant.id }); j = await P('listar', { t: T, projeto: 'divinopolis', de: 0, n: 1 }); ok('desfazer a restauração devolve os dados novos', j.total === 350, String(j.total));
  const f = R.filter((x) => !x[1]).length; console.log(`\n${f} falha(s) de ${R.length}`); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
