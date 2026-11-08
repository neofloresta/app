# Gera quadras de teste (grade de ~100 m) em volta do centro usado pelos testes, em 4 formatos
import json, struct, sqlite3, zipfile, io, os, sys
import shapefile
from pyproj import Transformer
D = os.path.dirname(os.path.abspath(__file__))
lat0, lon0, meia = -20.1436, -44.8908, 0.032
passo = 0.0009  # ~100 m
rua = 0.00012   # largura da rua
quadras = []
n = 0
la = lat0 - meia
while la < lat0 + meia:
    lo = lon0 - meia
    while lo < lon0 + meia:
        n += 1
        anel = [[lo + rua, la + rua], [lo + passo - rua, la + rua], [lo + passo - rua, la + passo - rua], [lo + rua, la + passo - rua], [lo + rua, la + rua]]
        quadras.append({'num': n, 'bairro': ['Centro', 'Sidil', 'Bom Pastor', 'Esplanada', 'Niterói'][n % 5], 'anel': anel})
        lo += passo
    la += passo
print(len(quadras), 'quadras')
# GeoJSON (WGS 84)
gj = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'QUADRA': q['num'], 'BAIRRO': q['bairro']}, 'geometry': {'type': 'Polygon', 'coordinates': [q['anel']]}} for q in quadras]}
json.dump(gj, open(D + '/quadras.geojson', 'w'))
# Shapefile em SIRGAS 2000 / UTM 23S, compactado
t = Transformer.from_crs('EPSG:4674', 'EPSG:31983', always_xy=True)
buf = {k: io.BytesIO() for k in ('shp', 'shx', 'dbf')}
w = shapefile.Writer(shp=buf['shp'], shx=buf['shx'], dbf=buf['dbf'], shapeType=shapefile.POLYGON)
w.field('QD_NUM', 'C', 10); w.field('BAIRRO', 'C', 30)
for q in quadras:
    pts = [list(t.transform(x, y)) for x, y in q['anel']]
    pts = pts[::-1]  # sentido horário, como no padrão shapefile
    w.poly([pts]); w.record('Q' + str(q['num']).zfill(4), q['bairro'])
w.close()
prj = 'PROJCS["SIRGAS 2000 / UTM zone 23S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-45],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]'
with zipfile.ZipFile(D + '/quadras_shp.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for k in buf: z.writestr('quadras_divinopolis.' + k, buf[k].getvalue())
    z.writestr('quadras_divinopolis.prj', prj); z.writestr('quadras_divinopolis.cpg', 'UTF-8')
# KML com as 300 primeiras (com número no ExtendedData)
pm = ''.join(f'<Placemark><name>Quadra {q["num"]}</name><ExtendedData><Data name="numero"><value>{q["num"]}</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>{" ".join(f"{x},{y},0" for x, y in q["anel"])}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>' for q in quadras[:300])
open(D + '/quadras.kml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>{pm}</Document></kml>')
# GeoPackage em UTM 23S (MultiPolygon), 500 primeiras
g = D + '/quadras.gpkg'
if os.path.exists(g): os.remove(g)
c = sqlite3.connect(g); c.execute('PRAGMA application_id=1196444487')
c.executescript('''CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT, srs_id INTEGER PRIMARY KEY, organization TEXT, organization_coordsys_id INTEGER, definition TEXT, description TEXT);
CREATE TABLE gpkg_contents (table_name TEXT PRIMARY KEY, data_type TEXT, identifier TEXT, description TEXT, last_change TEXT, min_x REAL, min_y REAL, max_x REAL, max_y REAL, srs_id INTEGER);
CREATE TABLE gpkg_geometry_columns (table_name TEXT, column_name TEXT, geometry_type_name TEXT, srs_id INTEGER, z TINYINT, m TINYINT);
CREATE TABLE lotes_quadras (fid INTEGER PRIMARY KEY, geom BLOB, nr_quadra INTEGER, setor TEXT);''')
c.execute("INSERT INTO gpkg_spatial_ref_sys VALUES ('SIRGAS 2000 / UTM zone 23S', 31983, 'EPSG', 31983, ?, '')", (prj,))
c.execute("INSERT INTO gpkg_contents VALUES ('lotes_quadras','features','lotes_quadras','', '2026-11-07', 0,0,0,0, 31983)")
c.execute("INSERT INTO gpkg_geometry_columns VALUES ('lotes_quadras','geom','MULTIPOLYGON',31983,0,0)")
for q in quadras[:500]:
    pts = [t.transform(x, y) for x, y in q['anel']]
    wkb = struct.pack('<BII', 1, 6, 1) + struct.pack('<BII', 1, 3, 1) + struct.pack('<I', len(pts)) + b''.join(struct.pack('<dd', x, y) for x, y in pts)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    head = b'GP' + bytes([0, 0b00000011]) + struct.pack('<i', 31983) + struct.pack('<dddd', min(xs), max(xs), min(ys), max(ys))
    c.execute('INSERT INTO lotes_quadras (geom, nr_quadra, setor) VALUES (?,?,?)', (head + wkb, q['num'], 'S' + str(q['num'] % 9)))
c.commit(); c.close()
print('ok')
