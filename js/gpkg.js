// Gera GeoPackage (pontos) com sql.js, com os mesmos nomes de campo do formulário.
const Gpkg = (() => {
  let SQLp = null;
  function sql() { if (!SQLp) SQLp = initSqlJs({ locateFile: (f) => 'vendor/' + f }); return SQLp; }

  const EXTRAS = [
    ['equipe', 'TEXT'], ['usuario', 'TEXT'], ['criado_em', 'DATETIME'], ['atualizado_em', 'DATETIME'],
    ['latitude', 'REAL'], ['longitude', 'REAL'], ['precisao_gps_m', 'REAL'], ['uuid', 'TEXT'], ['numero_unico', 'INTEGER'], ['historico', 'TEXT'],
  ];

  function tipoSql(c) {
    switch (c.armazenar) {
      case 'bool': return 'BOOLEAN';
      case 'int': return 'INTEGER';
      case 'real': return 'REAL';
      case 'datetime': return 'DATETIME';
      case 'date': return 'DATE';
      default: return 'TEXT';
    }
  }
  function conv(v, t) {
    if (v === undefined || v === null || v === '') return t === 'BOOLEAN' ? 0 : null;
    if (t === 'BOOLEAN') return v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE' ? 1 : 0;
    if (t === 'INTEGER') { const n = parseInt(String(v).replace(',', '.'), 10); return isNaN(n) ? null : n; }
    if (t === 'REAL') { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
    return String(v);
  }
  function geomBlob(srs, x, y) {
    const b = new ArrayBuffer(8 + 21); const dv = new DataView(b);
    dv.setUint8(0, 0x47); dv.setUint8(1, 0x50); dv.setUint8(2, 0); dv.setUint8(3, 0x01); // GP, v0, LE, sem envelope
    dv.setInt32(4, srs, true);
    dv.setUint8(8, 1); dv.setUint32(9, 1, true); dv.setFloat64(13, x, true); dv.setFloat64(21, y, true);
    return new Uint8Array(b);
  }
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

  async function gerar({ form, linhas, epsg, nomeCamada, estiloQml }) {
    const SQL = await sql();
    const db = new SQL.Database();
    const camada = nomeCamada || form.camada || 'arvores';
    const comPonto = linhas.filter((l) => l.latitude != null && l.longitude != null && l.latitude !== '' && l.longitude !== '');
    let zona = epsg && epsg !== 'auto' ? UTM.fusoDoEpsg(+epsg) : null;
    if (!zona) {
      const lons = comPonto.map((l) => +l.longitude);
      zona = lons.length ? UTM.fuso(lons.reduce((s, v) => s + v, 0) / lons.length) : 22;
    }
    const srs = UTM.epsgDoFuso(zona);
    db.run('PRAGMA application_id = 1196444487'); db.run('PRAGMA user_version = 10400');
    db.run(`CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT)`);
    db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined cartesian SRS',-1,'NONE',-1,'undefined',NULL),('Undefined geographic SRS',0,'NONE',0,'undefined',NULL),
      ('WGS 84 geodetic',4326,'EPSG',4326,'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',NULL)`);
    db.run('INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,NULL)', [`SIRGAS 2000 / UTM zone ${zona}S`, srs, 'EPSG', srs, UTM.wkt(zona)]);
    db.run(`CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER, CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id))`);
    db.run(`CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name))`);

    const campos = form.campos.filter((c) => c.nome !== 'fid');
    const fotos = campos.filter((c) => c.tipo === 'photo');
    const cols = [...campos.map((c) => [c.nome, tipoSql(c)]), ...fotos.map((c) => [c.nome + ' link', 'TEXT']), ...EXTRAS];
    db.run(`CREATE TABLE ${q(camada)} (fid INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, geom POINT, ${cols.map(([n, t]) => q(n) + ' ' + t).join(', ')})`);
    const ins = db.prepare(`INSERT INTO ${q(camada)} (geom, ${cols.map(([n]) => q(n)).join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    db.run('BEGIN');
    for (const l of linhas) {
      let g = null;
      if (l.latitude != null && l.latitude !== '' && l.longitude != null && l.longitude !== '') {
        const p = UTM.paraUTM(+l.latitude, +l.longitude, zona);
        g = geomBlob(srs, p.x, p.y);
        minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y);
      }
      ins.run([g, ...cols.map(([n, t]) => conv(l[n], t))]);
    }
    db.run('COMMIT'); ins.free();
    const ext = isFinite(minx) ? [minx, miny, maxx, maxy] : [null, null, null, null];
    db.run('INSERT INTO gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id) VALUES (?,?,?,?,?,?,?,?)', [camada, 'features', camada, ...ext, srs]);
    db.run('INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,0,0)', [camada, 'geom', 'POINT', srs]);

    if (estiloQml) {
      db.run(`CREATE TABLE layer_styles (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, f_table_catalog TEXT(256), f_table_schema TEXT(256), f_table_name TEXT(256), f_geometry_column TEXT(256), styleName TEXT(30), styleQML TEXT, styleSLD TEXT, useAsDefault BOOLEAN, description TEXT, owner TEXT(30), ui TEXT(30), update_time DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), type TEXT)`);
      db.run('INSERT INTO layer_styles (f_table_catalog,f_table_schema,f_table_name,f_geometry_column,styleName,styleQML,styleSLD,useAsDefault,description,owner,type) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        ['', '', camada, 'geom', camada, estiloQml, '', 1, 'Estilo importado pelo app de coleta', '', 'Point']);
      db.run("INSERT INTO gpkg_contents (table_name, data_type, identifier) VALUES ('layer_styles','attributes','layer_styles')");
    }
    const out = db.export(); db.close();
    return { bytes: out, srs, total: linhas.length, semPonto: linhas.length - comPonto.length };
  }

  // Lê estrutura de um GeoPackage enviado (para importar formulário)
  async function ler(buffer) {
    const SQL = await sql();
    const db = new SQL.Database(new Uint8Array(buffer));
    const tabs = db.exec("SELECT table_name FROM gpkg_contents WHERE data_type='features'");
    if (!tabs.length) throw new Error('Nenhuma camada de feições no GeoPackage.');
    const table = tabs[0].values[0][0];
    const cols = db.exec(`PRAGMA table_info(${q(table)})`)[0].values.map((r) => ({ name: r[1], type: r[2] }));
    const valores = {};
    for (const c of cols) if (/esp[eé]cie/i.test(c.name)) {
      const r = db.exec(`SELECT DISTINCT ${q(c.name)} FROM ${q(table)}`);
      valores[c.name] = r.length ? r[0].values.map((v) => v[0]) : [];
    }
    let estilo = null;
    try { const r = db.exec(`SELECT styleQML FROM layer_styles WHERE f_table_name=${"'" + table.replace(/'/g, "''") + "'"} ORDER BY useAsDefault DESC LIMIT 1`); if (r.length) estilo = r[0].values[0][0]; } catch (e) { /* sem estilo */ }
    db.close();
    return { table, cols, valores, estilo };
  }

  return { gerar, ler };
})();
