// Pacote final de entrega, chave de integração e restauração pelas telas da coordenação
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs'); const { execSync } = require('child_process');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
(async () => {
  await L.subir(); await L.configurar(); await L.semear(60); await L.post('projeto_salvar', { projeto_dados: { id: 'divinopolis', cliente_ve: 'todos' } });
  const TA = (await P('login', { u: 'admin', s: L.senha() })).token;
  // uma foto real e uma ordem concluída, para o pacote levar fotos
  const foto = fs.readFileSync(__dirname + '/foto.jpg').toString('base64');
  const f1 = await P('foto', { t: TA, projeto: 'divinopolis', nome: 'E1_0.jpg', mime: 'image/jpeg', dados: foto });
  const o = (await P('os_salvar', { t: TA, projeto: 'divinopolis', os: { registro_uuid: 'seed-0', tipo: 'Supressão', responsavel: 'Equipe 1' } })).ordem;
  await P('os_andamento', { t: TA, projeto: 'divinopolis', id: o.id, etapa: 'concluir', dados: { foto_antes: f1.url, foto_depois: f1.url } });
  const b = await chromium.launch(); const { p } = await L.celular(b, { acceptDownloads: true, viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(p, 'admin', L.senha()); await p.waitForTimeout(1200);
  await p.goto(L.WEB + '#admin/exportar'); await p.waitForSelector('text=Exportar dados'); await p.selectOption('.cartao select', 'divinopolis');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('button:has-text("Pacote final de entrega")')]);
  const z = __dirname + '/saida-pacote.zip'; await dl.saveAs(z);
  const lista = execSync(`python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print('\\n'.join(z.namelist())); z.testzip()" ${z}`).toString().trim().split('\n');
  const leia = execSync(`python3 -c "import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read('LEIA-ME.txt').decode('utf-8-sig'))" ${z}`).toString();
  const abas = execSync(`python3 -c "import openpyxl,zipfile,io,sys; z=zipfile.ZipFile(sys.argv[1]); n=[x for x in z.namelist() if x.endswith('.xlsx')][0]; w=openpyxl.load_workbook(io.BytesIO(z.read(n))); print('|'.join(w.sheetnames)); print(w['Ordens de serviço']['C2'].value)" ${z}`).toString();
  const msgP = await p.locator('.cartao .info').last().innerText();
  ok('8.5', ['.gpkg', '.xlsx', '_shapefile.zip', '.csv', '.kml', 'LEIA-ME.txt'].every((x) => lista.some((n) => n.endsWith(x))) && lista.some((n) => /DCIM\/ordens\/OS-0001-antes/.test(n)) && /Ordens de serviço/.test(abas) && /Concluída/.test(abas) && /Responsável técnico/.test(leia),
    `${lista.length} arquivos no zip (${lista.filter((n) => !n.startsWith('DCIM')).join(', ')} + ${lista.filter((n) => n.startsWith('DCIM')).length} fotos); abas do Excel: ${abas.split('\n')[0]}; mensagem: ${msgP}`);
  // chave pela tela
  await p.goto(L.WEB + '#admin/seguranca'); await p.waitForSelector('text=Chaves de integração'); await p.waitForTimeout(800);
  await p.fill('input[placeholder^="Ex.: Sistema"]', 'Sistema da prefeitura'); await p.click('button:has-text("Criar chave")'); await p.waitForTimeout(800);
  const chave = await p.locator('input[readonly]').inputValue();
  const j = await P('painel', { chave_api: chave, projeto: 'divinopolis' });
  const linhaTab = await p.locator('table.tab:has-text("Sistema da prefeitura")').innerText().catch(() => '');
  ok('8.4', /^neo_/.test(chave) && j.ok && j.total === 60 && /Ativa/.test(linhaTab), `chave criada na tela e aceita pelo servidor (painel com ${j.total} registros); lista: ${linhaTab.replace(/\s+/g, ' ').slice(0, 120)}`);
  // restauração pela tela
  await P('backup_agora', { t: TA }); await L.semear(10);
  await p.reload(); await p.waitForSelector('text=Restaurar uma cópia'); await p.waitForTimeout(1500);
  await p.click('button:has-text("Restaurar esta cópia")'); await p.waitForSelector('.folha');
  await p.fill('.folha input', 'nome errado'); await p.click('.folha button:has-text("Restaurar")'); await p.waitForTimeout(400);
  let tot = (await P('listar', { t: TA, projeto: 'divinopolis', de: 0, n: 1 })).total;
  await p.click('button:has-text("Restaurar esta cópia")'); await p.fill('.folha input', 'PMAU Divinópolis'); await p.click('.folha button:has-text("Restaurar")'); await p.waitForTimeout(1500);
  const msgR = await p.locator('.cartao:has-text("Restaurar uma cópia") .info').innerText().catch(() => '');
  const tot2 = (await P('listar', { t: TA, projeto: 'divinopolis', de: 0, n: 1 })).total;
  const opcoes = await p.locator('.cartao:has-text("Restaurar uma cópia") select >> nth=1').innerText();
  await p.screenshot({ path: 'seguranca.png', fullPage: true });
  ok('7.6', tot === 70 && tot2 === 60 && /Restaurado: 60/.test(msgR) && /antes de uma restauração/.test(opcoes), `nome errado não restaura (${tot}); restaurou para ${tot2}; "${msgR}"; opções: ${opcoes.replace(/\n/g, ' / ')}`);
  ok('8.x', !p.erros.length, 'erros de página: ' + JSON.stringify(p.erros));
  fs.writeFileSync('res-b8.json', JSON.stringify(R, null, 1)); await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
