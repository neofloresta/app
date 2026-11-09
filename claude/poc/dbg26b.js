const { chromium } = require('playwright'); const L = require('./lib');
(async () => { await L.subir(); await L.configurar(); const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  console.log(await p.evaluate(() => new Promise((ok) => { const t = Date.now(); navigator.geolocation.getCurrentPosition((x) => ok("ok " + (Date.now() - t)), (e) => ok("erro " + e.code + e.message), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }); }))); await p.click("button.nova"); await p.waitForTimeout(6000); await p.screenshot({ path: 'dbg26b.png' });
  console.log(await p.evaluate(() => document.body.innerText.slice(0, 600))); console.log(p.erros); await b.close(); process.exit(0); })();
