// Simulação mínima de Apps Script para rodar Code.gs
const http = require('http'); const fs = require('fs'); const vm = require('vm');
let seq = 0; const nid = () => 'id' + (++seq);
const files = {}, folders = {};
function parseCell(v) { if (typeof v !== 'string') return v; if (v.startsWith("'")) return v; if (/^-?\d+([.,]\d+)?$/.test(v)) return parseFloat(v.replace(',', '.')); return v; }
class Range { constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const l = []; for (let j = 0; j < this.nc; j++) l.push(((this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]) ?? ''); o.push(l); } return o; }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) { v.forEach((l, i) => l.forEach((x, j) => { const row = this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || []; row[this.c - 1 + j] = parseCell(x); })); return this; }
  setFontWeight() { return this; } setNumberFormats() { return this; }
  createTextFinder(t) { const self = this; return { matchEntireCell() { return this; }, findNext() { for (let i = 0; i < self.nr; i++) if (String(((self.sh.d[self.r - 1 + i] || [])[self.c - 1]) ?? '') === t) return { getRow: () => self.r + i }; return null; } }; }
}
class Sheet { constructor(n) { this.n = n; this.d = []; }
  setName(n) { this.n = n; return this; } appendRow(l) { this.d.push(l.map(parseCell)); }
  getLastRow() { return this.d.length; } getLastColumn() { return Math.max(0, ...this.d.map((l) => l.length)); }
  getDataRange() { return new Range(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  setFrozenRows() {} deleteRow(r) { this.d.splice(r - 1, 1); } }
const sss = {};
const SpreadsheetApp = { create(n) { const id = nid(); const s = { id, sheets: [new Sheet('Planilha1')], getId: () => id, getSheets() { return this.sheets; }, getSheetByName(n) { return this.sheets.find((x) => x.n === n); }, insertSheet(n) { const x = new Sheet(n); this.sheets.push(x); return x; } }; sss[id] = s; files[id] = { name: n, moveTo() {} }; return s; }, openById(id) { return sss[id]; } };
function mkFolder(name) { const id = nid(); const f = { id, name, kids: [], files: [], getId: () => id, getUrl: () => 'https://drive/' + id,
  createFolder(n) { const k = mkFolder(n); this.kids.push(k); return k; },
  getFoldersByName(n) { return it(this.kids.filter((k) => k.name === n)); },
  getFilesByName(n) { return it(this.files.filter((k) => k.name === n)); }, getFiles() { return it(this.files); },
  createFile(a, b, c) { const fl = typeof a === 'string' ? mkFile(a, b) : mkFile(a.name, a.bytes); this.files.push(fl); return fl; } }; folders[id] = f; return f; }
function mkFile(name, content) { const id = nid(); const f = { id, name, content, getId: () => id, getName: () => name, setContent(c) { this.content = c; }, getBlob() { const s = this; return { getDataAsString: () => s.content }; }, moveTo() {} }; files[id] = f; return f; }
function it(a) { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; }
const props = {};
const ctx = { console, JSON, Date, Math, String, Object, Array, Number,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => (props[k] = v) }) },
  SpreadsheetApp, DriveApp: { createFolder: mkFolder, getFolderById: (id) => folders[id], getFileById: (id) => files[id] || mkFile('x', '') },
  Utilities: { base64Decode: (s) => Buffer.from(s, 'base64'), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
  Logger: { log: (m) => console.log('[GAS]', m) } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
ctx.configurar();
const senha = String(SpreadsheetApp.openById(props.BASE_ID).getSheetByName('Usuarios').d[1][1]);
fs.writeFileSync('senha.txt', senha);
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': '*' }); return res.end(); }
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    if (req.url.startsWith('/__seed')) { const q = JSON.parse(b); const p = ctx.tabela('Projetos').find((x) => x.id === q.projeto); const sh = sss[p.planilha_id].getSheetByName('Registros'); if (!sh.d.length) sh.d.push(q.cab); for (const l of q.linhas) sh.d.push(q.cab.map((c) => l[c] ?? '')); res.writeHead(200); return res.end(JSON.stringify({ ok: true, linhas: sh.d.length - 1 })); }
    if (req.url.startsWith('/__stats')) { const out = {}; for (const s of Object.values(sss)) for (const x of s.sheets) out[s.id + ':' + x.n] = { linhas: x.d.length, celulas: x.d.reduce((a, l) => a + l.length, 0) }; out.dcim = Object.values(folders).filter((f) => f.name === 'DCIM').map((f) => f.files.length); res.writeHead(200); return res.end(JSON.stringify(out)); }
    if (req.url.startsWith('/__falhar')) { global.FALHAR = JSON.parse(b || '{}'); res.writeHead(200); return res.end('{}'); }
    if (global.FALHAR && global.FALHAR.n > 0 && req.method === 'POST' && b.includes('"acao":"' + global.FALHAR.acao + '"')) { global.FALHAR.n--; req.socket.destroy(); return; }
    const t0 = Date.now();
    const out = req.method === 'POST' ? ctx.doPost({ postData: { contents: b } }) : ctx.doGet();
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out.t); try { const a = JSON.parse(b).acao; if (Date.now() - t0 > 200) console.log('[lento]', a, Date.now() - t0, 'ms', out.t.length, 'bytes'); } catch (e) {}
  });
}).listen(+process.env.PORTA || 8790, () => console.log('mock ok'));
process.on('SIGUSR2', () => { const ps = Object.values(sss).map(s=>s.sheets.map(x=>({n:x.n,d:x.d}))); fs.writeFileSync('dump.json', JSON.stringify({ps, dcim:Object.values(folders).filter(f=>f.name==='DCIM').map(f=>f.files.map(x=>x.name+':'+(x.content&&x.content.length)))},null,1)); });
// caso real: linha antiga do admin com apóstrofo literal

