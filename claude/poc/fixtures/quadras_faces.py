# Quadras e faces de quadra a partir das linhas de logradouro da prefeitura.
# Uso: python3 -I quadras_faces.py logradouros.gpkg saida.geojson
# A numeração das quadras é a mesma de quadras_de_ruas.py (mesma ordem), então a situação já marcada continua valendo.
# Cada quadra leva "faces": [{i: letra, r: rua, c: comprimento em m, s: lado da rua, k: [vértice inicial, vértice final]}],
# com os vértices contados no contorno externo da própria quadra (o app desenha a face sobre o contorno;
# o último vértice do contorno repete o primeiro, então a contagem é circular).
import sqlite3, sys, json, math
from shapely import wkb
from shapely.geometry import Point, LineString
from shapely.ops import unary_union, polygonize, transform, linemerge
from shapely.strtree import STRtree
from pyproj import Transformer
src, saida = sys.argv[1], sys.argv[2]
c = sqlite3.connect(src)
tab = c.execute('select table_name from gpkg_geometry_columns').fetchone()[0]
cols = [r[1] for r in c.execute(f'pragma table_info("{tab}")')]
gcol = c.execute('select column_name from gpkg_geometry_columns').fetchone()[0]
linhas, nomes = [], []
for g, nome in c.execute(f'select "{gcol}", nome from "{tab}"'):
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
faixa = 150
ymax = max(q.centroid.y for _, q in quad)
def chave(item):
    ct = item[1].representative_point(); f = int((ymax - ct.y) // faixa)
    return (f, ct.x if f % 2 == 0 else -ct.x)
quad.sort(key=chave)
arvore = STRtree(linhas)
t = Transformer.from_crs('EPSG:31983', 'EPSG:4674', always_xy=True)

# ruas juntadas por nome: cada trecho contínuo é um "componente"; o lado da rua é medido nele
comp_de = {}  # índice do trecho -> (nome, nº do componente, linha juntada)
por_nome = {}
for k, n in enumerate(nomes): por_nome.setdefault(n, []).append(k)
for n, ks in por_nome.items():
    u = unary_union([linhas[k] for k in ks])
    m = linemerge(u) if u.geom_type == 'MultiLineString' else u
    partes = list(m.geoms) if m.geom_type == 'MultiLineString' else [m]
    for k in ks:
        meio = linhas[k].interpolate(0.5, normalized=True)
        j = min(range(len(partes)), key=lambda i: partes[i].distance(meio))
        comp_de[k] = (n, j, partes[j])
lados = {}
def lado_id(n, j, sinal):
    key = (n, j, sinal)
    if key not in lados: lados[key] = str(len(lados) + 1)
    return lados[key]
def letra(i):
    s = ''; i += 1
    while i: i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s
r6 = lambda v: round(v, 6)

feats = []; nfaces = 0
for num, (p, q) in enumerate(quad, 1):
    # contorno externo em metros e em graus, sem vértices repetidos depois do arredondamento (igual ao app)
    P, G = [], []
    for x, y in q.exterior.coords:
        lon, lat = t.transform(x, y); g = (r6(lon), r6(lat))
        if G and G[-1] == g: continue
        P.append((x, y)); G.append(g)
    nseg = len(P) - 1
    seg = []  # (chave da rua, comprimento)
    for k in range(nseg):
        a, b = P[k], P[k + 1]; mid = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        idx = arvore.query_nearest(mid, max_distance=15)
        if len(idx): kk = min(idx, key=lambda i: linhas[i].distance(mid)); n, j, _ = comp_de[kk]; ch = (n, j)
        else: ch = ('', -1)
        seg.append([ch, math.dist(a, b)])
    # sequências de segmentos da mesma rua viram uma face
    runs = []
    for k, (ch, L) in enumerate(seg):
        if runs and runs[-1][0] == ch: runs[-1][2] = k; runs[-1][3] += L
        else: runs.append([ch, k, k, L])
    if len(runs) > 1 and runs[0][0] == runs[-1][0]:  # a face que passa pelo início do contorno
        ult = runs.pop(); runs[0][1] = ult[1]; runs[0][3] += ult[3]
    # pedaços curtos de esquina entram na face vizinha mais longa
    mudou = True
    while mudou and len(runs) > 1:
        mudou = False
        for i, r in enumerate(runs):
            if r[3] < 8:
                ant, prox = runs[i - 1], runs[(i + 1) % len(runs)]
                if ant[3] >= prox[3]: ant[2] = r[2]; ant[3] += r[3]
                else: prox[1] = r[1]; prox[3] += r[3]
                runs.pop(i); mudou = True; break
    faces = []
    for i, (ch, k0, k1, L) in enumerate(runs):
        n, j = ch
        # lado da rua: de que lado da linha juntada fica o meio da face
        s = ''
        if j >= 0:
            comp = comp_de[next(k for k in por_nome[n] if comp_de[k][1] == j)][2]
            ks = [(k0 + d) % nseg for d in range(((k1 - k0) % nseg) + 1)]
            km = ks[len(ks) // 2]; a, b = P[km], P[km + 1]; m = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            d = comp.project(m); A = comp.interpolate(max(0, d - 1)); B = comp.interpolate(min(comp.length, d + 1))
            cr = (B.x - A.x) * (m.y - A.y) - (B.y - A.y) * (m.x - A.x)
            s = lado_id(n, j, 1 if cr > 0 else -1)
        faces.append({'i': letra(i), 'r': (n or 'Via sem nome')[:60], 'c': round(L), 's': s, 'k': [k0, (k1 + 1) % nseg]})  # início = fim: a face dá a volta inteira
    nfaces += len(faces)
    viz = arvore.query(p.boundary.buffer(2)); conta = {}
    for k in viz:
        n = nomes[k]
        if n and linhas[k].intersection(p.boundary.buffer(2)).length > 15: conta[n] = conta.get(n, 0) + linhas[k].intersection(p.boundary.buffer(2)).length
    ruas = ', '.join(sorted(conta, key=lambda n: -conta[n])[:4])
    aneis = [[list(g) for g in G]] + [[[r6(v) for v in t.transform(x, y)] for x, y in h.coords] for h in q.interiors]
    feats.append({'type': 'Feature', 'properties': {'quadra': str(num), 'ruas': ruas, 'area_m2': round(q.area), 'faces': faces}, 'geometry': {'type': 'Polygon', 'coordinates': aneis}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(saida, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(feats), 'quadras,', nfaces, 'faces,', len(lados), 'lados de rua; ex.:', feats[0]['properties']['faces'][:2])
