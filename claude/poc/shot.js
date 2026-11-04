const { chromium } = require('playwright'); const L = require('./lib');
(async () => { await L.subir(); await L.configurar(); const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, process.argv[2] || 'div-1', process.argv[3] || 'equipe1'); await p.waitForTimeout(2500); await p.screenshot({ path: 'dbg.png' }); console.log(p.url(), p.erros); await b.close(); process.exit(0); })();
