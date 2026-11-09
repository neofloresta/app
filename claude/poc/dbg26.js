const { chromium } = require('playwright'); const L = require('./lib');
(async () => { await L.subir(); await L.configurar(); const b = await chromium.launch(); const { p } = await L.celular(b);
 await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.click('button.nova'); await p.waitForTimeout(1500);
 console.log('erros', p.erros); console.log((await p.locator('main').innerText()).slice(0, 600)); await p.screenshot({ path: 'dbg26.png' }); process.exit(0); })();
