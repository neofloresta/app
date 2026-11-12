// Geração de arquivos de entrega: ZIP, Excel (.xlsx), Shapefile e leitura de CSV.
const Arquivos = (() => {
  const enc = new TextEncoder();
  const TAB = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function deflate(raw) {
    if (typeof CompressionStream === 'undefined' || raw.length < 256) return null;
    try { return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; }
  }
  // ZIP com nomes em UTF-8; comprime quando o navegador permite
  async function zip(arquivos) {
    const d = new Date(); const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const partes = []; const central = []; let off = 0;
    for (const a of arquivos) {
      const nome = enc.encode(a.nome); const raw = typeof a.dados === 'string' ? enc.encode(a.dados) : a.dados;
      const crc = crc32(raw); const z = await deflate(raw); const comp = z && z.length < raw.length ? z : raw; const met = comp === raw ? 0 : 8;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, met, true); lh.setUint16(10, hora, true); lh.setUint16(12, data, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nome.length, true); lh.setUint16(28, 0, true);
      partes.push(new Uint8Array(lh.buffer), nome, comp);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, met, true); ch.setUint16(12, hora, true); ch.setUint16(14, data, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, nome.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nome);
      off += 30 + nome.length + comp.length;
    }
    const tamC = central.reduce((a, b) => a + b.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tamC, true); fim.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: 'application/zip' });
  }

  // ---------- Excel ----------
  const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function letra(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // planilhas = [{ nome, cols, linhas }]
  async function xlsx(planilhas) {
    const arqs = [];
    const sheets = planilhas.map((p, k) => {
      const linhas = [`<row r="1">${p.cols.map((c, j) => `<c r="${letra(j)}1" t="inlineStr" s="1"><is><t>${xml(c)}</t></is></c>`).join('')}</row>`];
      p.linhas.forEach((l, i) => {
        const r = i + 2;
        linhas.push(`<row r="${r}">${p.cols.map((c, j) => { const v = l[c]; if (v === '' || v == null) return ''; if (typeof v === 'number' && isFinite(v)) return `<c r="${letra(j)}${r}"><v>${v}</v></c>`; if (v && typeof v === 'object' && v.__data != null) return `<c r="${letra(j)}${r}" s="${v.dia ? 3 : 2}"><v>${v.__data}</v></c>`; return `<c r="${letra(j)}${r}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`; }).join('')}</row>`);
      });
      const ult = letra(Math.max(0, p.cols.length - 1)) + (p.linhas.length + 1);
      arqs.push({ nome: `xl/worksheets/sheet${k + 1}.xml`, dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${Math.max(1, p.cols.length)}" width="18" customWidth="1"/></cols><sheetData>${linhas.join('')}</sheetData>${p.linhas.length ? `<autoFilter ref="A1:${ult}"/>` : ''}</worksheet>` });
      return `<sheet name="${xml(String(p.nome).slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`;
    });
    arqs.push({ nome: '[Content_Types].xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${planilhas.map((p, k) => `<Override PartName="/xl/worksheets/sheet${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` });
    arqs.push({ nome: '_rels/.rels', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    arqs.push({ nome: 'xl/workbook.xml', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.join('')}</sheets></workbook>` });
    arqs.push({ nome: 'xl/_rels/workbook.xml.rels', dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas.map((p, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join('')}<Relationship Id="rId${planilhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
    arqs.push({ nome: 'xl/styles.xml', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F6B45"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    const b = await zip(arqs);
    return new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- Shapefile (pontos) ----------
  function nomesDbf(cols) {
    const usados = new Set(); const mapa = [];
    for (const c of cols) {
      let base = String(c).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'CAMPO';
      let n = base.slice(0, 10); let k = 1;
      while (usados.has(n)) { const suf = String(k++); n = base.slice(0, 10 - suf.length) + suf; }
      usados.add(n); mapa.push([c, n]);
    }
    return mapa;
  }
  function cortaBytes(s, max) { let b = enc.encode(s); if (b.length <= max) return b; let t = s; while (enc.encode(t).length > max) t = t.slice(0, -1); return enc.encode(t); }
  // pontos = [{ x, y } | null], linhas = objetos, cols = colunas
  async function shapefile({ nome, cols, linhas, pontos, prj }) {
    const n = linhas.length;
    const comPonto = pontos.filter(Boolean);
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of comPonto) { if (p.x < bbox[0]) bbox[0] = p.x; if (p.y < bbox[1]) bbox[1] = p.y; if (p.x > bbox[2]) bbox[2] = p.x; if (p.y > bbox[3]) bbox[3] = p.y; }
    if (!comPonto.length) bbox.fill(0);
    const tamRec = (p) => (p ? 28 : 12);
    const shpLen = 100 + pontos.reduce((a, p) => a + tamRec(p), 0);
    const shp = new DataView(new ArrayBuffer(shpLen)); const shx = new DataView(new ArrayBuffer(100 + 8 * n));
    const cab = (dv, len) => { dv.setInt32(0, 9994); dv.setInt32(24, len / 2); dv.setInt32(28, 1000, true); dv.setInt32(32, 1, true); bbox.forEach((v, i) => dv.setFloat64(36 + i * 8, v, true)); };
    cab(shp, shpLen); cab(shx, 100 + 8 * n);
    let o = 100;
    pontos.forEach((p, i) => {
      shx.setInt32(100 + i * 8, o / 2); shx.setInt32(104 + i * 8, (tamRec(p) - 8) / 2);
      shp.setInt32(o, i + 1); shp.setInt32(o + 4, (tamRec(p) - 8) / 2);
      if (p) { shp.setInt32(o + 8, 1, true); shp.setFloat64(o + 12, p.x, true); shp.setFloat64(o + 20, p.y, true); } else shp.setInt32(o + 8, 0, true);
      o += tamRec(p);
    });
    // DBF
    const mapa = nomesDbf(cols);
    const campos = mapa.map(([c, nm]) => {
      const vs = linhas.map((l) => l[c]).filter((v) => v !== '' && v != null);
      const num = vs.length && vs.every((v) => typeof v === 'number' && isFinite(v));
      if (num) { const dec = Math.min(8, Math.max(0, ...vs.map((v) => (String(v).split('.')[1] || '').length))); const int = Math.max(1, ...vs.map((v) => String(Math.trunc(Math.abs(v))).length)) + 1; return { c, nm, t: 'N', len: Math.min(19, int + (dec ? dec + 1 : 0)), dec }; }
      return { c, nm, t: 'C', len: Math.max(1, Math.min(254, Math.max(1, ...vs.map((v) => enc.encode(String(v)).length)))), dec: 0 };
    });
    // o registro do DBF tem no máximo 65.535 bytes: encurta os textos longos se o formulário for muito largo
    while (1 + campos.reduce((a, f) => a + f.len, 0) > 65000) { const f = campos.filter((x) => x.t === 'C').sort((a, b) => b.len - a.len)[0]; if (!f || f.len <= 20) break; f.len = Math.floor(f.len * 0.8); }
    const recLen = 1 + campos.reduce((a, f) => a + f.len, 0); const hdrLen = 32 + 32 * campos.length + 1;
    const dbf = new Uint8Array(hdrLen + recLen * n + 1); const dv = new DataView(dbf.buffer); const d = new Date();
    dv.setUint8(0, 3); dv.setUint8(1, d.getFullYear() - 1900); dv.setUint8(2, d.getMonth() + 1); dv.setUint8(3, d.getDate());
    dv.setUint32(4, n, true); dv.setUint16(8, hdrLen, true); dv.setUint16(10, recLen, true); dv.setUint8(29, 0);
    campos.forEach((f, i) => { const b = 32 + i * 32; dbf.set(enc.encode(f.nm).slice(0, 10), b); dbf[b + 11] = f.t.charCodeAt(0); dbf[b + 16] = f.len; dbf[b + 17] = f.dec; });
    dbf[hdrLen - 1] = 0x0D;
    linhas.forEach((l, i) => {
      let p = hdrLen + i * recLen; dbf[p++] = 0x20;
      for (const f of campos) {
        const v = l[f.c]; let b;
        if (f.t === 'N') { const s = v === '' || v == null ? '' : Number(v).toFixed(f.dec); b = enc.encode(s.padStart(f.len, ' ').slice(-f.len)); }
        else { b = cortaBytes(v == null ? '' : String(v), f.len); }
        const cel = new Uint8Array(f.len).fill(0x20); cel.set(b, f.t === 'N' ? f.len - b.length : 0); dbf.set(cel, p); p += f.len;
      }
    });
    dbf[dbf.length - 1] = 0x1A;
    const legenda = 'nome_no_shapefile;nome_completo\r\n' + mapa.map(([c, nm]) => `${nm};${String(c).replace(/;/g, ',')}`).join('\r\n');
    return zip([{ nome: nome + '.shp', dados: new Uint8Array(shp.buffer) }, { nome: nome + '.shx', dados: new Uint8Array(shx.buffer) }, { nome: nome + '.dbf', dados: dbf },
      { nome: nome + '.prj', dados: prj }, { nome: nome + '.cpg', dados: 'UTF-8' }, { nome: nome + '_campos.csv', dados: '﻿' + legenda }]);
  }

  // ---------- CSV (leitura para importação) ----------
  function lerTexto(buf) {
    const u8 = new Uint8Array(buf);
    let t = new TextDecoder('utf-8').decode(u8);
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(u8);
    return t.replace(/^﻿/, '');
  }
  function lerCsv(texto) {
    const prim = texto.split(/\r?\n/, 1)[0];
    const sep = [';', ',', '\t'].map((s) => [s, prim.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const linhas = []; let campo = '', linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; continue; }
      if (c === '"' && campo === '') aspas = true; else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); campo = ''; if (linha.some((x) => x !== '')) linhas.push(linha); linha = []; }
      else campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((x) => x !== '')) linhas.push(linha); }
    const cols = (linhas.shift() || []).map((c) => c.trim());
    return { cols, linhas: linhas.map((l) => Object.fromEntries(cols.map((c, i) => [c, (l[i] ?? '').trim()]))) };
  }
  return { zip, xlsx, shapefile, lerCsv, lerTexto, crc32 };
})();
if (typeof module !== 'undefined') module.exports = Arquivos;
