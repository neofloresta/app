import sqlite3, sys, json, math
from shapely import wkb
from shapely.ops import unary_union, polygonize, transform
from shapely.strtree import STRtree
from pyproj import Transformer
src, saida = sys.argv[1], sys.argv[2]
c = sqlite3.connect(src)
linhas, nomes = [], []
for g, nome, tipo in c.execute('select geom, nome, tipo_novo from "Logradouros_DIV_SIRGAS200"'):
    if not g: continue
    fl = g[3]; env = [0, 32, 48, 48, 64][(fl >> 1) & 7]
    linhas.append(wkb.loads(bytes(g[8 + env:]))); nomes.append((nome or '').strip())
polys = [p for p in polygonize(unary_union(linhas)) if 800 <= p.area <= 300000]
quad = []
for p in polys:
    q = p.buffer(-4, join_style=2)
    if q.is_empty: continue
    if q.geom_type == 'MultiPolygon': q = max(q.geoms, key=lambda x: x.area)
    quad.append((p, q))
# numeração: faixas de 150 m de norte a sul, oeste para leste, em zigue-zague
faixa = 150
ymax = max(q.centroid.y for _, q in quad)
def chave(item):
    ct = item[1].representative_point(); f = int((ymax - ct.y) // faixa)
    return (f, ct.x if f % 2 == 0 else -ct.x)
quad.sort(key=chave)
arvore = STRtree(linhas)
t = Transformer.from_crs('EPSG:31983', 'EPSG:4674', always_xy=True)
feats = []
for i, (p, q) in enumerate(quad, 1):
    viz = arvore.query(p.boundary.buffer(2))
    conta = {}
    for k in viz:
        n = nomes[k]
        if n and linhas[k].intersection(p.boundary.buffer(2)).length > 15: conta[n] = conta.get(n, 0) + linhas[k].intersection(p.boundary.buffer(2)).length
    ruas = ', '.join(sorted(conta, key=lambda n: -conta[n])[:4])
    g = transform(lambda x, y, z=None: t.transform(x, y), q)
    feats.append({'type': 'Feature', 'properties': {'quadra': str(i), 'ruas': ruas, 'area_m2': round(q.area)}, 'geometry': json.loads(json.dumps(g.__geo_interface__))})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(saida, 'w'), ensure_ascii=False)
print(len(feats), 'quadras; exemplo:', feats[0]['properties'], feats[2000]['properties'])
