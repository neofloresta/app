// Conversão geográfica (SIRGAS 2000 ~ GRS80) para UTM Sul. EPSG 31978..31985 = fusos 18S..25S.
const UTM = (() => {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  function fuso(lon) { return Math.floor((lon + 180) / 6) + 1; }
  function epsgDoFuso(z) { return 31960 + z; } // 31978 = 18S
  function fusoDoEpsg(epsg) { return epsg - 31960; }
  function paraUTM(lat, lon, zona) {
    const z = zona || fuso(lon);
    const lon0 = ((z - 1) * 6 - 180 + 3) * Math.PI / 180;
    const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lon0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
    y += 10000000; // hemisfério sul
    return { x, y, zona: z, epsg: epsgDoFuso(z) };
  }
  function wkt(z) {
    const cm = (z - 1) * 6 - 180 + 3;
    return `PROJCS["SIRGAS 2000 / UTM zone ${z}S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY["EPSG","6674"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4674"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${cm}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","${epsgDoFuso(z)}"]]`;
  }
  return { fuso, epsgDoFuso, fusoDoEpsg, paraUTM, wkt };
})();
if (typeof module !== 'undefined') module.exports = UTM;
