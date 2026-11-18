# Formulário de Divinópolis, versão 11: lista de espécies ampliada (build/lista_de_especies.xlsx).
# python3 build/especies11.py
# Mantém as espécies que já estavam, completa o nome popular quando faltava e acrescenta as novas.
import json, openpyxl, os
raiz = os.path.join(os.path.dirname(__file__), '..')
arq = os.path.join(raiz, 'forms/divinopolis-inventario.json')
f = json.load(open(arq, encoding='utf8'))
assert f['versao'] == 10, f['versao']
ws = openpyxl.load_workbook(os.path.join(os.path.dirname(__file__), 'lista_de_especies.xlsx'), read_only=True).active
novas = {}
for c, p in ws.iter_rows(min_row=2, values_only=True):
    if not c: continue
    c = ' '.join(str(c).split()); p = ' '.join(str(p or '').split())
    novas[c.lower()] = {'cientifico': c, 'popular': p}
atual = {e['cientifico'].lower(): dict(e) for e in f['especies']}
for k, e in novas.items():
    if k in atual:
        if not atual[k].get('popular'): atual[k]['popular'] = e['popular']
    else:
        atual[k] = e
nid = atual.pop('não identificada', None)
resto = sorted(atual.values(), key=lambda e: e['cientifico'].lower())
f['especies'] = ([nid] if nid else []) + resto
f['versao'] = 11
json.dump(f, open(arq, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(f['especies']), 'espécies; versão', f['versao'])
