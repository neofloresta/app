// Bloco 5 (exportação) e tempos de exportação do bloco 6
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const N = +(process.argv[2] || 5000);
(async () => {
  await L.subir(); await L.configurar(); await L.semear(N);
  const b = await chromium.launch(); const { p, ctx } = await L.celular(b, { acceptDownloads: true, viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(p, 'admin', L.senha()); await p.waitForTimeout(1500);
  await p.goto(L.WEB + '#admin/exportar'); await p.waitForSelector('text=Exportar dados');
  await p.selectOption('.cartao select', 'divinopolis');
  const res = { N };
  for (const [tipo, rot] of [['gpkg', 'GeoPackage'], ['xlsx', 'Excel'], ['shp', 'Shapefile'], ['csv', 'CSV'], ['kml', 'Google Earth']]) {
    const t = Date.now();
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 300000 }), p.click(`button:has-text("${rot}")`)]);
    const arq = `${__dirname}/saida-${N}.${tipo}`; await dl.saveAs(arq);
    res[tipo] = { s: (Date.now() - t) / 1000, MB: +(fs.statSync(arq).size / 1e6).toFixed(1) };
    res[tipo + 'Msg'] = await p.locator('.cartao .info').last().innerText();
  }
  res.erros = p.erros; console.log(JSON.stringify(res)); fs.writeFileSync(`${__dirname}/res-b5-${N}.json`, JSON.stringify(res));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
