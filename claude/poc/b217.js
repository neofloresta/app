// 2.16.3 a 2.16.5: formulários 12, 13 e 14 (área livre, posição na calçada, colo soterrado, raiz na via, ficha de alvo e defeito da ISA, fitossanidade na Identificação e tronco paralelo à fiação como pergunta própria)
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const ALVOS = ['Alvo pessoas', 'Alvo veículos estacionados', 'Alvo veículos em movimento', 'Alvo edificação', 'Alvo rede elétrica ou de serviços', 'Alvo outros'];
const NOVOS = ['Area livre (m2)', 'Posicao da arvore na calcada', 'Zona do alvo', 'Taxa de ocupacao', 'Fator de protecao', 'Principal defeito da arvore', 'Carga sobre o defeito'];
const PAR = 'Tronco paralelo a fiacao eletrica'; const MARCAR = [PAR, 'Colo soterrado', 'Afloramento da raiz na via'];
const naTela = (p) => p.evaluate(() => [...document.querySelectorAll('main [data-campo]')].map((c) => c.dataset.campo));
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  const form = JSON.parse(fs.readFileSync(L.APP + '/forms/divinopolis-inventario.json', 'utf8'));
  // 1. o arquivo: versão 12, campos novos com ajuda, e o risco calculado continua com as mesmas três perguntas
  const c = (n) => form.campos.find((x) => x.nome === n); const semAjuda = NOVOS.concat(MARCAR).filter((n) => !c(n) || !c(n).ajuda);
  ok('M.1', form.versao === 15 && c('Alvo rede elétrica ou de serviços') && !c('Tronco paralelo à fiação') && c(PAR).tipo === 'choice' && c(PAR).vazioSe.grava === 'Não' && !c('Principal alvo') && !form.campos.some((x) => x.legado) && form.gruposObrig.includes('Alvos na zona') && c('Taxa de ocupacao').opcoes.every((o) => /\(.+\)$/.test(o.t) && !/\(/.test(o.v)) && !semAjuda.length && /estilhaços/.test(JSON.stringify(c('Zona do alvo').opcoes)) && /funil/.test(c('Colo soterrado').ajuda) && !form.campos.some((x) => /bifurca|Largura da cal|Inclina|Casca|Rachadura/i.test(x.nome)), `formulário ${form.versao}; sem ajuda: ${semAjuda.join(', ') || 'nenhum'}`);
  // 2. árvore na calçada: sem os campos novos não conclui; são todos pedidos
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(300);
  await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await A.abaLivre(p, 'Meio'); const meio = await naTela(p);
  const obrigNaTela = () => p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].filter((x) => /\*/.test((x.querySelector('label, .rot, legend') || x).textContent.slice(0, 60))).map((x) => x.dataset.campo)); const ob1 = await obrigNaTela();
  await A.abaLivre(p, 'Raízes'); const raiz = await naTela(p); await A.abaLivre(p, 'Alvo'); const alvo = await naTela(p); const ob3 = await obrigNaTela(); const desc = await p.evaluate(() => [...document.querySelectorAll('[data-campo="Taxa de ocupacao"] .op')].every((b) => b.querySelector('small') && b.querySelector('small').offsetParent !== null));
  await A.abaLivre(p, 'Risco'); const risco = await naTela(p); const ob2 = await obrigNaTela(); const gf = await A.faltas(p);
  const pedidos = NOVOS.filter((n) => ob1.concat(ob2, ob3).includes(n));
  ok('M.2', NOVOS.slice(0, 2).every((n) => meio.includes(n)) && meio.includes(MARCAR[0]) && MARCAR.slice(1).every((n) => raiz.includes(n)) && ALVOS.concat(NOVOS.slice(2, 5)).every((n) => alvo.includes(n)) && !alvo.includes('Principal alvo') && desc && NOVOS.slice(5).every((n) => risco.includes(n)) && !risco.includes('Zona do alvo') && risco.indexOf('Carga sobre o defeito') < risco.indexOf('Probabilidade de falha') && pedidos.length === NOVOS.length,
    `Meio: ${meio.filter((n) => NOVOS.concat(MARCAR).includes(n)).join(', ')}; Raízes: ${raiz.filter((n) => MARCAR.includes(n)).join(', ')}; Alvo: ${alvo.join(', ')} (texto nas opções: ${desc}); Risco: ${risco.join(', ')}; obrigatórios pedidos: ${pedidos.length} de ${NOVOS.length}`);
  // 3. no canteiro central não existe posição na calçada; o resto continua
  await A.abaLivre(p, 'Identificação'); await A.op(p, 'Local do registro', 'Canteiro central'); await A.abaLivre(p, 'Meio'); const meioCc = await naTela(p); const faltamCc = await A.faltas(p);
  ok('M.3', !meioCc.includes('Posicao da arvore na calcada') && meioCc.includes('Area livre (m2)') && !faltamCc.some((x) => x.includes('Posição da árvore')), `canteiro central: posição na tela ${meioCc.includes('Posicao da arvore na calcada')}, área livre na tela ${meioCc.includes('Area livre (m2)')}`);
  // 4. morto: nada disso aparece
  await A.abaLivre(p, 'Indivíduo'); await A.sit(p, 'Morta'); await p.waitForTimeout(300); const etapas = await p.evaluate(() => [...document.querySelectorAll('.prog [data-aba], .prog button')].map((x) => x.textContent.trim())); const faltamM = await A.faltas(p);
  ok('M.4', !faltamM.some((x) => NOVOS.some((n) => x.includes(c(n).rotulo))), `morta: pendências ${faltamM.join(', ') || 'nenhuma'}; etapas ${etapas.join('/')}`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 8. formulário 14: fitossanidade na Identificação, logo depois da foto geral; tronco paralelo é pergunta própria e some com a fiação ausente
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(300); await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await p.waitForTimeout(200);
  const ident = await naTela(p); const obI = await obrigNaTela(); await A.op(p, 'Situacao', 'Morta'); await p.waitForTimeout(300); const identM = await naTela(p); await A.op(p, 'Situacao', 'Viva'); await p.waitForTimeout(300); await A.abaLivre(p, 'Raízes'); const raiz14 = await naTela(p);
  await A.abaLivre(p, 'Meio'); const meio14 = await naTela(p); const obM = await obrigNaTela(); const ops = (await A.campo(p, PAR).locator('.op').allInnerTexts()).map((t) => t.trim());
  await p.locator('.chip[data-campo="Fiação baixa isolada"]').click(); await p.waitForTimeout(150); const comFio = (await naTela(p)).includes(PAR); await A.op(p, PAR, 'Sim');
  await p.locator('.chip[data-campo="Fiação ausente"]').click(); await p.waitForTimeout(200); const semFio = (await naTela(p)).includes(PAR);
  ok('M.8', ident.indexOf('Situacao') === ident.indexOf('Categoria') + 1 && ident.indexOf('Situacao') < ident.indexOf('Fitossanidade') && !identM.includes('Fitossanidade') && identM.includes('Foto 1') && ident.indexOf('Fitossanidade') === ident.indexOf('Foto 1') + 1 && obI.includes('Fitossanidade') && !raiz14.includes('Fitossanidade') && meio14.includes(PAR) && !meio14.includes('Tronco paralelo à fiação') && meio14.indexOf(PAR) === meio14.indexOf('Marquise ou toldo') - 1 && meio14.indexOf(PAR) === meio14.indexOf('Fiação serviços gerais') + 1 && obM.includes(PAR) && ops.join('/') === 'Não/Sim' && comFio && !semFio,
    `Identificação: ${ident.join(', ')}; morta: ${identM.join(', ')}; fitossanidade pedida: ${obI.includes('Fitossanidade')}; Meio: ${meio14.join(', ')}; opções: ${ops.join('/')}; com fio aparece: ${comFio}; com fiação ausente aparece: ${semFio}`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 5. cadastro completo grava os campos novos e o risco sai da mesma matriz
  const f = await A.arvoreCompleta(p); const rs = await p.evaluate(async () => Store.todosRegistros()); const r = rs.find((x) => x.status !== 'rascunho'); const v = (r && r.valores) || {};
  ok('M.5', f.length === 0 && v.Fitossanidade === 'Boa' && !v[PAR] && v['Area livre (m2)'] === '1 a 2 m²' && v['Posicao da arvore na calcada'] === 'Até 1 m do meio-fio' && v['Zona do alvo'] === 'Projeção da copa' && v['Fator de protecao'] === 'Ausente' && v['Principal defeito da arvore'] === 'Tronco' && v['Carga sobre o defeito'] === 'Pequena' && v['Alvo pessoas'] === true && !v['Principal alvo'] && v['Taxa de ocupacao'] === 'Ocasional' && v.Risco === 'Baixo',
    `pendências: ${f.join(', ') || 'nenhuma'}; área livre "${v['Area livre (m2)']}", posição "${v['Posicao da arvore na calcada']}", zona "${v['Zona do alvo']}", defeito "${v['Principal defeito da arvore']}", risco ${v.Risco}`);
  // 6. chega ao servidor com as colunas novas
  await p.waitForTimeout(4000); const lista = await L.post('listar', { projeto: 'divinopolis' }).catch((e) => ({ erro: String(e) })); const txt = JSON.stringify(lista);
  ok('M.6', /1 a 2 m²/.test(txt) && /Projeção da copa/.test(txt), `no servidor: área livre ${/1 a 2 m²/.test(txt)}, zona do alvo ${/Projeção da copa/.test(txt)}${lista.erro ? ' (' + lista.erro + ')' : ''}`);
  // 9. com fiação marcada, a resposta do tronco paralelo é gravada e chega ao servidor; com fiação ausente (registro do item 5) fica vazia. A exigência está no item 8 (asterisco) e na trava de etapas
  const f9 = await A.arvoreCompleta(p, { fiacao: 'Fiação baixa isolada', paralelo: 'Sim' });
  await p.waitForSelector('button.nova'); await p.waitForTimeout(4000); const rs9 = await p.evaluate(async () => Store.todosRegistros()); const r9 = rs9.find((x) => x.valores && x.valores['Fiação baixa isolada'] === true); const l9 = JSON.stringify(await L.post('listar', { projeto: 'divinopolis' }).catch((e) => ({ erro: String(e) })));
  const noServ = l9.includes('"' + PAR + '":"Sim"');
  ok('M.9', f9.length === 0 && r9 && r9.valores[PAR] === 'Sim' && !r9.valores['Tronco paralelo à fiação'] && noServ && r && (r.valores[PAR] == null || r.valores[PAR] === ''), `pendências: ${f9.join(', ') || 'nenhuma'}; gravado "${r9 && r9.valores[PAR]}"; no servidor: ${noServ}; com fiação ausente fica "${r && r.valores[PAR]}"`);
  ok('M.7', !p.erros.length, p.erros.length ? p.erros.join(' | ') : 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
