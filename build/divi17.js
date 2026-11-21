// Formulário de Divinópolis, versão 17 (pontos que o Ciro ditou no treinamento de campo de 21/11/2026). Parte do 16.
// node build/divi17.js
//  - conflito no raio de 2 m: muro não conta (sai da explicação; entram lixeira e faixa de pedestre, que ele citou)
//  - manejo: sai "Adubação"
//  - fiação aérea: o grupo passa a dizer que é PRESENÇA de fiação, e não conflito com a copa
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 16) throw new Error('Esperava o formulário 16, achei o ' + f.versao);
const campo = (n) => { const c = f.campos.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
campo('Conflitos no raio de 2 m').ajuda = 'Elementos a até 2 m do tronco que disputam espaço com a árvore: poste, placa, entrada de garagem, boca de lobo, hidrante, lixeira, faixa de pedestre. Muro não conta como conflito.';
const SAI = ['Manejo adubação']; SAI.forEach(campo);
f.campos = f.campos.filter((c) => !SAI.includes(c.nome));
for (const a of f.abas) a.campos = a.campos.filter((x) => !SAI.includes(x.campo));
for (const r of f.regras) for (const k of Object.keys(r.por || {})) SAI.forEach((n) => delete r.por[k][n]);
f.regras = f.regras.filter((r) => !SAI.includes(r.campo));
f.camposRetirados = [...new Set((f.camposRetirados || []).concat(SAI))].sort();
const G0 = 'Fiação aérea', G1 = 'Fiação aérea presente (mesmo sem tocar a copa)';
let n = 0; for (const a of f.abas) for (const x of a.campos) if (x.grupo === G0) { x.grupo = G1; n++; }
if (n !== 7) throw new Error('Esperava 7 campos no grupo da fiação, achei ' + n);
const troca = (l) => (l || []).map((g) => (g === G0 ? G1 : g && g.grupo === G0 ? Object.assign({}, g, { grupo: G1 }) : g));
f.gruposObrig = troca(f.gruposObrig); f.gruposConfirmar = troca(f.gruposConfirmar);
if (JSON.stringify(f).includes('"' + G0 + '"')) throw new Error('Sobrou referência ao nome antigo do grupo');
campo('Fiação ausente').ajuda = 'Nenhuma fiação aérea passando no trecho da árvore.';
for (const nm of ['Fiação baixa isolada', 'Fiação baixa nua', 'Fiação média compacta', 'Fiação média nua', 'Fiação derivação', 'Fiação serviços gerais']) { const c = campo(nm); if (!/Marque o que existe/.test(c.ajuda)) c.ajuda += ' Marque o que existe no trecho da árvore, encoste ou não na copa.'; }
f.versao = 17;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos; manejo:', f.abas.find((a) => a.nome === 'Manejo').campos.map((x) => x.campo).join(' | '));
