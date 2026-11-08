// Camada de quadras: leitura de Shapefile (.zip), GeoPackage, KML e GeoJSON, formato compacto e ponto dentro da quadra.
// Formato guardado: { campo, total, quadras: [{ n: '123', b: [minLon, minLat, maxLon, maxLat], a: [[lon, lat, lon, lat, ...], ...], p: {outros campos} }] }
const Quadras = (() => {
  const dec = new TextDecoder();

  // ---------- zip (só leitura) ----------
  async function inflar(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function lerZip(buf) {
    const b = new Uint8Array(buf); const dv = new DataView(buf);
    let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Arquivo .zip inválido.');
    const n = dv.getUint16(e + 10, true); let o = dv.getUint32(e + 16, true); const arqs = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(o, true) !== 0x02014b50) break;
      const met = dv.getUint16(o + 10, true), tam = dv.getUint32(o + 20, true), ln = dv.getUint16(o + 28, true), lx = dv.getUint16(o + 30, true), lc = dv.getUint16(o + 32, true), loc = dv.getUint32(o + 42, true);
      const nome = dec.decode(b.subarray(o + 46, o + 46 + ln));
      const ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      arqs[nome] = { met, dados: b.subarray(ini, ini + tam) };
      o += 46 + ln + lx + lc;
    }
    return { nomes: Object.keys(arqs), async ler(nome) { const a = arqs[nome]; if (!a) return null; return a.met === 8 ? inflar(a.dados) : a.met === 0 ? a.dados : Promise.reject(new Error('Compressão do .zip não suportada.')); } };
  }

  // ---------- conversão de coordenadas ----------
  function conversorPrj(prj) {
    const t = String(prj || '');
    if (!t || /^GEOGCS/i.test(t.trim())) return null; // já em graus
    const m = t.match(/UTM[ _]zone[ _](\d{1,2})\s*([NS])?/i) || t.match(/UTM_Zone_(\d{1,2})([NS])?/i);
    if (m) { const z = +m[1]; if ((m[2] || 'S').toUpperCase() === 'N') throw new Error('Fuso UTM do hemisfério norte não suportado.'); return (x, y) => { const g = UTM.paraGeo(x, y, z); return [g.lon, g.lat]; }; }
    const cm = t.match(/central_meridian"?,\s*(-?[\d.]+)/i);
    if (/Transverse_Mercator/i.test(t) && cm) { const z = Math.round((+cm[1] + 183) / 6); return (x, y) => { const g = UTM.paraGeo(x, y, z); return [g.lon, g.lat]; }; }
    throw new Error('Sistema de coordenadas do arquivo não reconhecido. Use SIRGAS 2000 (graus ou UTM).');
  }
  function conversorEpsg(epsg) {
    epsg = +epsg; if (!epsg || epsg === 4326 || epsg === 4674 || epsg === 4618) return null;
    const z = UTM.zonaDoEpsg(epsg); if (!z) throw new Error('Sistema de coordenadas EPSG ' + epsg + ' não suportado. Use SIRGAS 2000 (graus ou UTM).');
    return (x, y) => { const g = UTM.paraGeo(x, y, z); return [g.lon, g.lat]; };
  }

  // ---------- shapefile ----------
  function lerDbf(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); const n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
    const campos = []; for (let o = 32; o < hl - 1 && b[o] !== 0x0d; o += 32) { let nm = ''; for (let i = 0; i < 11 && b[o + i]; i++) nm += String.fromCharCode(b[o + i]); campos.push({ nm, t: String.fromCharCode(b[o + 11]), len: b[o + 16] }); }
    const td = (() => { try { return new TextDecoder('utf-8', { fatal: true }); } catch (e) { return dec; } })(); const lat = new TextDecoder('latin1');
    const regs = [];
    for (let r = 0; r < n; r++) {
      let o = hl + r * rl; if (b[o] === 0x2a) { regs.push(null); continue; } o++;
      const reg = {};
      for (const c of campos) { const s = b.subarray(o, o + c.len); let v; try { v = td.decode(s); } catch (e) { v = lat.decode(s); } reg[c.nm] = v.trim(); o += c.len; }
      regs.push(reg);
    }
    return { campos: campos.map((c) => c.nm), regs };
  }
  function lerShp(b, conv) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); const out = []; let o = 100;
    while (o + 8 <= b.length) {
      const len = dv.getInt32(o + 4, false) * 2; const ini = o + 8; const tipo = dv.getInt32(ini, true);
      if (tipo === 5 || tipo === 15 || tipo === 25) {
        const np = dv.getInt32(ini + 36, true), nPts = dv.getInt32(ini + 40, true); const partes = []; for (let i = 0; i < np; i++) partes.push(dv.getInt32(ini + 44 + i * 4, true));
        const p0 = ini + 44 + np * 4; const aneis = [];
        for (let i = 0; i < np; i++) { const fim = i + 1 < np ? partes[i + 1] : nPts; const a = []; for (let k = partes[i]; k < fim; k++) { const x = dv.getFloat64(p0 + k * 16, true), y = dv.getFloat64(p0 + k * 16 + 8, true); a.push(conv ? conv(x, y) : [x, y]); } aneis.push(a); }
        out.push(aneis);
      } else out.push(null);
      o = ini + len;
    }
    return out;
  }
  async function deZip(buf) {
    const z = await lerZip(buf);
    const shp = z.nomes.find((n) => /\.shp$/i.test(n) && !/__MACOSX/.test(n)); if (!shp) throw new Error('O .zip não tem arquivo .shp.');
    const base = shp.slice(0, -4); const achar = (ext) => z.nomes.find((n) => n.toLowerCase() === (base + ext).toLowerCase());
    if (!achar('.dbf')) throw new Error('Falta o arquivo .dbf junto do .shp.');
    const prj = achar('.prj') ? dec.decode(await z.ler(achar('.prj'))) : '';
    const conv = conversorPrj(prj);
    const geoms = lerShp(await z.ler(shp), conv); const dbf = lerDbf(await z.ler(achar('.dbf')));
    return { campos: dbf.campos, feicoes: geoms.map((g, i) => ({ props: dbf.regs[i] || {}, aneis: g })).filter((f) => f.aneis && f.aneis.length), semPrj: !prj };
  }

  // ---------- GeoPackage ----------
  function lerWkb(u8, o, conv, aneis) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const le = u8[o] === 1; let t = dv.getUint32(o + 1, le); o += 5;
    const temZ = (t > 1000 && t < 2000) || (t & 0x80000000) !== 0, temM = (t > 2000 && t < 3000); const base = (t & 0xffff) % 1000; const d = 2 + (temZ ? 1 : 0) + (temM ? 1 : 0) + (t > 3000 && t < 4000 ? 2 : 0);
    const ponto = () => { const x = dv.getFloat64(o, le), y = dv.getFloat64(o + 8, le); o += 8 * d; return conv ? conv(x, y) : [x, y]; };
    if (base === 3) { const nr = dv.getUint32(o, le); o += 4; for (let r = 0; r < nr; r++) { const np = dv.getUint32(o, le); o += 4; const a = []; for (let k = 0; k < np; k++) a.push(ponto()); aneis.push(a); } return o; }
    if (base === 6) { const np = dv.getUint32(o, le); o += 4; for (let i = 0; i < np; i++) o = lerWkb(u8, o, conv, aneis); return o; }
    throw new Error('A camada precisa ser de polígonos.');
  }
  async function deGpkg(buf) {
    const SQL = await initSqlJs({ locateFile: (f) => 'vendor/' + f }); const db = new SQL.Database(new Uint8Array(buf));
    try {
      const gc = db.exec("SELECT table_name, column_name, srs_id FROM gpkg_geometry_columns WHERE upper(geometry_type_name) IN ('POLYGON','MULTIPOLYGON','GEOMETRY','CURVEPOLYGON','MULTISURFACE')");
      if (!gc.length || !gc[0].values.length) throw new Error('O GeoPackage não tem camada de polígonos.');
      const [tab, gcol, srs] = gc[0].values[0]; const conv = conversorEpsg(srs);
      const r = db.exec(`SELECT * FROM "${String(tab).replace(/"/g, '')}"`); if (!r.length) return { campos: [], feicoes: [] };
      const cols = r[0].columns; const gi = cols.indexOf(gcol);
      const feicoes = r[0].values.map((v) => {
        const g = v[gi]; if (!g) return null; const u8 = g instanceof Uint8Array ? g : new Uint8Array(g);
        const fl = u8[3]; const env = [0, 32, 48, 48, 64][(fl >> 1) & 7] || 0; const aneis = []; lerWkb(u8, 8 + env, conv, aneis);
        const props = {}; cols.forEach((c, i) => { if (i !== gi) props[c] = v[i] == null ? '' : String(v[i]); }); return { props, aneis };
      }).filter(Boolean);
      return { campos: cols.filter((c, i) => i !== gi), feicoes };
    } finally { db.close(); }
  }

  // ---------- KML e GeoJSON ----------
  function deKml(texto) {
    const x = new DOMParser().parseFromString(texto, 'application/xml'); if (x.querySelector('parsererror')) throw new Error('KML inválido.');
    const campos = new Set(['nome']); const feicoes = [];
    x.querySelectorAll('Placemark').forEach((pm) => {
      const props = { nome: (pm.querySelector('name') || {}).textContent || '' };
      pm.querySelectorAll('ExtendedData Data').forEach((d) => { const k = d.getAttribute('name'); props[k] = ((d.querySelector('value') || {}).textContent || '').trim(); campos.add(k); });
      pm.querySelectorAll('ExtendedData SimpleData').forEach((d) => { const k = d.getAttribute('name'); props[k] = (d.textContent || '').trim(); campos.add(k); });
      const aneis = []; pm.querySelectorAll('Polygon outerBoundaryIs coordinates, Polygon innerBoundaryIs coordinates').forEach((c) => aneis.push(c.textContent.trim().split(/\s+/).map((t) => t.split(',').slice(0, 2).map(Number))));
      if (aneis.length) feicoes.push({ props, aneis });
    });
    return { campos: [...campos], feicoes };
  }
  function deGeojson(texto) {
    const j = JSON.parse(texto); const fs = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [];
    const crs = j.crs && j.crs.properties && String(j.crs.properties.name || ''); const ep = crs && (crs.match(/EPSG:{1,2}(\d+)/) || [])[1]; const conv = ep ? conversorEpsg(ep) : null;
    const campos = new Set(); const feicoes = [];
    for (const f of fs) {
      const g = f.geometry; if (!g) continue; const props = {}; Object.entries(f.properties || {}).forEach(([k, v]) => { props[k] = v == null ? '' : String(v); campos.add(k); });
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null; if (!polys) continue;
      feicoes.push({ props, aneis: polys.flatMap((p) => p.map((a) => a.map((c) => (conv ? conv(c[0], c[1]) : [c[0], c[1]])))) });
    }
    return { campos: [...campos], feicoes };
  }

  async function lerArquivo(nome, buf) {
    const ext = String(nome).toLowerCase().split('.').pop(); let r;
    if (ext === 'zip') r = await deZip(buf);
    else if (ext === 'gpkg') r = await deGpkg(buf);
    else if (ext === 'kml') r = deKml(dec.decode(buf));
    else if (ext === 'geojson' || ext === 'json') r = deGeojson(dec.decode(buf));
    else if (ext === 'shp') throw new Error('Envie o shapefile compactado num .zip, com os arquivos .shp, .dbf, .shx e .prj juntos.');
    else throw new Error('Formato não suportado. Use shapefile (.zip), GeoPackage, KML ou GeoJSON.');
    if (!r.feicoes.length) throw new Error('Nenhum polígono encontrado no arquivo.');
    const f0 = r.feicoes[0].aneis[0][0];
    if (!(Math.abs(f0[1]) <= 90 && Math.abs(f0[0]) <= 180)) throw new Error('As coordenadas não parecem estar em graus. Confira o sistema de coordenadas (arquivo .prj).');
    return r;
  }
  // sugere o campo do número da quadra
  function campoNumero(campos, feicoes) {
    const pref = campos.find((c) => /^(n[ºo°_ ]*)?(quadra|qd)([_ ]?(n[ºo°]?|num(ero)?))?$/i.test(c)) || campos.find((c) => /quadra|qd|quad/i.test(c)) || campos.find((c) => /^(num|numero|n|id|codigo|cod)$/i.test(c));
    return pref || campos[0] || '';
  }
  function compactar(feicoes, campo, extras = []) {
    const r6 = (v) => Math.round(v * 1e6) / 1e6; const vistos = {}; const quadras = [];
    for (const f of feicoes) {
      let n = String(f.props[campo] ?? '').trim(); if (!n) n = 'sem número ' + (quadras.length + 1);
      const a = f.aneis.map((anel) => { const o = []; let px, py; for (const [x, y] of anel) { const X = r6(x), Y = r6(y); if (X !== px || Y !== py) o.push(X, Y); px = X; py = Y; } return o; }).filter((x) => x.length >= 6);
      if (!a.length) continue;
      let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const anel of a) for (let i = 0; i < anel.length; i += 2) { b = [Math.min(b[0], anel[i]), Math.min(b[1], anel[i + 1]), Math.max(b[2], anel[i]), Math.max(b[3], anel[i + 1])]; }
      const p = {}; extras.forEach((k) => { if (f.props[k] !== '' && f.props[k] != null) p[k] = String(f.props[k]).slice(0, 60); });
      if (vistos[n]) { const q = vistos[n]; q.a.push(...a); q.b = [Math.min(q.b[0], b[0]), Math.min(q.b[1], b[1]), Math.max(q.b[2], b[2]), Math.max(q.b[3], b[3])]; continue; } // mesma quadra em partes
      const q = { n, b, a }; if (Object.keys(p).length) q.p = p; vistos[n] = q; quadras.push(q);
    }
    return { campo, total: quadras.length, quadras };
  }
  // ponto dentro (regra par e ímpar; buracos e partes contam juntos)
  function dentro(lon, lat, q) {
    if (lon < q.b[0] || lon > q.b[2] || lat < q.b[1] || lat > q.b[3]) return false;
    let d = false;
    for (const a of q.a) for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) { const xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d; }
    return d;
  }
  // índice em grade para achar a quadra de muitos pontos depressa
  function indice(qs, passo = 0.002) {
    const g = new Map(); const k = (x, y) => Math.floor(x / passo) + ':' + Math.floor(y / passo);
    qs.forEach((q, i) => { for (let x = Math.floor(q.b[0] / passo); x <= Math.floor(q.b[2] / passo); x++) for (let y = Math.floor(q.b[1] / passo); y <= Math.floor(q.b[3] / passo); y++) { const c = x + ':' + y; if (!g.has(c)) g.set(c, []); g.get(c).push(i); } });
    // dentro da quadra; se não estiver (árvore de calçada), a quadra mais próxima até tol metros
    return {
      achar(lon, lat, tol = 12) {
        const l = g.get(k(lon, lat)); if (l) for (const i of l) if (dentro(lon, lat, qs[i])) return qs[i];
        if (!tol) return null;
        const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110540; let melhor = null, dmin = tol;
        const cx = Math.floor(lon / passo), cy = Math.floor(lat / passo); const vistos = new Set();
        for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const i of g.get(x + ':' + y) || []) {
          if (vistos.has(i)) continue; vistos.add(i); const d = distancia(lon, lat, qs[i], mx, my); if (d < dmin) { dmin = d; melhor = qs[i]; }
        }
        return melhor;
      },
    };
  }
  function distancia(lon, lat, q, mx, my) { // metros até a borda mais próxima
    let d = Infinity;
    for (const a of q.a) for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
      const ax = (a[j] - lon) * mx, ay = (a[j + 1] - lat) * my, bx = (a[i] - lon) * mx, by = (a[i + 1] - lat) * my;
      const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy; const t = l2 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / l2)) : 0;
      d = Math.min(d, Math.hypot(ax + t * vx, ay + t * vy));
    }
    return d;
  }
  function centro(q) { // centro da maior parte, para o número
    let melhor = q.a[0], area = 0;
    for (const a of q.a) { let s = 0; for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) s += a[j] * a[i + 1] - a[i] * a[j + 1]; if (Math.abs(s) > area) { area = Math.abs(s); melhor = a; } }
    let x = 0, y = 0; const n = melhor.length / 2; for (let i = 0; i < melhor.length; i += 2) { x += melhor[i]; y += melhor[i + 1]; } return [y / n, x / n];
  }
  return { lerArquivo, campoNumero, compactar, dentro, indice, centro, lerZip };
})();
