// Formulário de Divinópolis, versão 15 (app 2.17). Parte do formulário 14.
// node build/divi15.js
//  - saem os campos de formulário anterior ("se saiu do formulário, sai da planilha"): a coluna deles é retirada da planilha pelo
//    "Ajustar registros antigos", depois de converter o que ainda vale (principal alvo e a caixa antiga do tronco paralelo)
//  - tronco paralelo à fiação: com "Fiação ausente" a pergunta não aparece e a planilha recebe "Não" (nada fica em branco)
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 14) throw new Error('Esperava o formulário 14, achei o ' + f.versao);
const fora = f.campos.filter((c) => c.legado).map((c) => c.nome);
const usados = JSON.stringify(f.campos.filter((c) => !c.legado).map((c) => [c.expr, c.calculado]));
for (const n of fora) if (usados.includes('"' + n + '"') || usados.includes('\\"' + n + '\\"')) throw new Error('Campo antigo ainda usado em cálculo: ' + n);
f.campos = f.campos.filter((c) => !c.legado);
f.regras = (f.regras || []).filter((r) => !fora.includes(r.campo)); for (const r of f.regras) for (const k of Object.keys(r.por || {})) for (const n of fora) delete r.por[k][n];
for (const a of f.abas) a.campos = a.campos.filter((x) => !fora.includes(x.campo));
const par = f.campos.find((c) => c.nome === 'Tronco paralelo a fiacao eletrica'); if (!par) throw new Error('Falta o campo do tronco paralelo');
par.vazioSe = { campo: 'Fiação ausente', valor: true, grava: 'Não' };
f.camposRetirados = fora; // o app usa esta lista para tirar as colunas da planilha no ajuste dos registros antigos
f.versao = 15;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos; retirados:', fora.join(', '));
