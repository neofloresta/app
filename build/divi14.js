// Formulário de Divinópolis, versão 14 (Ciro em 19/11/2026). Parte do formulário 13.
// node build/divi14.js
// Mudança da 14: "Rede elétrica ou de serviços" sai dos alvos na zona. A rede já é registrada na etapa Meio (fiação aérea).
// O campo existiu só no formulário 13, publicado no mesmo dia e com a base zerada: sai de vez, sem ficar como campo de formulário anterior.
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 13) throw new Error('Esperava o formulário 13, achei o ' + f.versao);
const SAI = 'Alvo rede elétrica ou de serviços';
if (!f.campos.some((c) => c.nome === SAI)) throw new Error('Campo não existe: ' + SAI);
f.campos = f.campos.filter((c) => c.nome !== SAI);
for (const a of f.abas) a.campos = a.campos.filter((x) => x.campo !== SAI);
for (const r of f.regras) for (const k of Object.keys(r.por || {})) delete r.por[k][SAI];
const o = f.campos.find((c) => c.nome === 'Alvo outros'); o.ajuda = 'Mobiliário urbano, banca, ponto de táxi. A rede elétrica não entra aqui: ela é registrada na etapa Meio, em fiação aérea.';
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = f.campos.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
f.versao = 14;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
