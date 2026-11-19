// 2.16.3: formulário 12 (área livre, posição na calçada, tronco paralelo à fiação, colo soterrado, raiz na via e ficha de alvo e defeito da ISA)
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const NOVOS = ['Area livre (m2)', 'Posicao da arvore na calcada', 'Principal alvo', 'Zona do alvo', 'Taxa de ocupacao', 'Fator de protecao', 'Principal defeito da arvore', 'Carga sobre o defeito'];
const MARCAR = ['Tronco paralelo à fiação', 'Colo soterrado', 'Afloramento da raiz na via'];
const naTela = (p) => p.evaluate(() => [...document.querySelectorAll('main [data-campo]')].map((c) => c.dataset.campo));
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  const form = JSON.parse(fs.readFileSync(L.APP + '/forms/divinopolis-inventario.json', 'utf8'));
  // 1. o arquivo: versão 12, campos novos com ajuda, e o risco calculado continua com as mesmas três perguntas
  const c = (n) => form.campos.find((x) => x.nome === n); const semAjuda = NOVOS.concat(MARCAR).filter((n) => !c(n) || !c(n).ajuda);
  ok('M.1', form.versao === 12 && !semAjuda.length && /estilhaços/.test(c('Zona do alvo').ajuda) && /funil/.test(c('Colo soterrado').ajuda) && !form.campos.some((x) => /bifurca|Largura da cal|Inclina|Casca|Rachadura/i.test(x.nome)), `formulário ${form.versao}; sem ajuda: ${semAjuda.join(', ') || 'nenhum'}`);
  // 2. árvore na calçada: sem os campos novos não conclui; são todos pedidos
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(300);
  await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await A.abaLivre(p, 'Meio'); const meio = await naTela(p);
  const obrigNaTela = () => p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].filter((x) => /\*/.test((x.querySelector('label, .rot, legend') || x).textContent.slice(0, 60))).map((x) => x.dataset.campo)); const ob1 = await obrigNaTela();
  await A.abaLivre(p, 'Raízes'); const raiz = await naTela(p); await A.abaLivre(p, 'Risco'); const risco = await naTela(p); const ob2 = await obrigNaTela();
  const pedidos = NOVOS.filter((n) => ob1.concat(ob2).includes(n));
  ok('M.2', NOVOS.slice(0, 2).every((n) => meio.includes(n)) && meio.includes(MARCAR[0]) && MARCAR.slice(1).every((n) => raiz.includes(n)) && NOVOS.slice(2).every((n) => risco.includes(n)) && risco.indexOf('Carga sobre o defeito') < risco.indexOf('Probabilidade de falha') && pedidos.length === NOVOS.length,
    `Meio: ${meio.filter((n) => NOVOS.concat(MARCAR).includes(n)).join(', ')}; Raízes: ${raiz.filter((n) => MARCAR.includes(n)).join(', ')}; Risco: ${risco.slice(0, 7).join(', ')}; obrigatórios pedidos: ${pedidos.length} de ${NOVOS.length}`);
  // 3. no canteiro central não existe posição na calçada; o resto continua
  await A.abaLivre(p, 'Identificação'); await A.op(p, 'Local do registro', 'Canteiro central'); await A.abaLivre(p, 'Meio'); const meioCc = await naTela(p); const faltamCc = await A.faltas(p);
  ok('M.3', !meioCc.includes('Posicao da arvore na calcada') && meioCc.includes('Area livre (m2)') && !faltamCc.some((x) => x.includes('Posição da árvore')), `canteiro central: posição na tela ${meioCc.includes('Posicao da arvore na calcada')}, área livre na tela ${meioCc.includes('Area livre (m2)')}`);
  // 4. morto: nada disso aparece
  await A.abaLivre(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Morta'); await p.waitForTimeout(300); const etapas = await p.evaluate(() => [...document.querySelectorAll('.prog [data-aba], .prog button')].map((x) => x.textContent.trim())); const faltamM = await A.faltas(p);
  ok('M.4', !faltamM.some((x) => NOVOS.some((n) => x.includes(c(n).rotulo))), `morta: pendências ${faltamM.join(', ') || 'nenhuma'}; etapas ${etapas.join('/')}`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 5. cadastro completo grava os campos novos e o risco sai da mesma matriz
  const f = await A.arvoreCompleta(p); const rs = await p.evaluate(async () => Store.todosRegistros()); const r = rs.find((x) => x.status !== 'rascunho'); const v = (r && r.valores) || {};
  ok('M.5', f.length === 0 && v['Area livre (m2)'] === '1 a 2 m²' && v['Posicao da arvore na calcada'] === 'Até 1 m do meio-fio' && v['Zona do alvo'] === 'Projeção da copa' && v['Fator de protecao'] === 'Ausente' && v['Principal defeito da arvore'] === 'Tronco' && v['Carga sobre o defeito'] === 'Pequena' && v['Principal alvo'] === 'Pessoas' && v['Taxa de ocupacao'] === 'Ocasional' && v.Risco === 'Baixo',
    `pendências: ${f.join(', ') || 'nenhuma'}; área livre "${v['Area livre (m2)']}", posição "${v['Posicao da arvore na calcada']}", zona "${v['Zona do alvo']}", defeito "${v['Principal defeito da arvore']}", risco ${v.Risco}`);
  // 6. chega ao servidor com as colunas novas
  await p.waitForTimeout(4000); const lista = await L.post('listar', { projeto: 'divinopolis' }).catch((e) => ({ erro: String(e) })); const txt = JSON.stringify(lista);
  ok('M.6', /1 a 2 m²/.test(txt) && /Projeção da copa/.test(txt), `no servidor: área livre ${/1 a 2 m²/.test(txt)}, zona do alvo ${/Projeção da copa/.test(txt)}${lista.erro ? ' (' + lista.erro + ')' : ''}`);
  ok('M.7', !p.erros.length, p.erros.length ? p.erros.join(' | ') : 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
