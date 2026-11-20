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
// colunas de formulário antigo: todo campo que já existiu em alguma versão deste formulário e não existe mais (o servidor só tira estas)
const { execSync } = require('child_process'); const raiz = path.join(__dirname, '..'); const jaExistiu = new Set(fora);
for (const h of execSync('git log --format=%h -- forms/divinopolis-inventario.json', { cwd: raiz }).toString().trim().split('\n')) { try { const v = JSON.parse(execSync(`git show ${h}:forms/divinopolis-inventario.json`, { cwd: raiz, maxBuffer: 5e7 }).toString()); (v.campos || []).forEach((c) => jaExistiu.add(c.nome)); } catch (e) { /* versão ilegível: ignora */ } }
const atuais = new Set(f.campos.map((c) => c.nome)); f.camposRetirados = [...jaExistiu].filter((n) => !atuais.has(n)).sort();
f.versao = 15;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos; retirados agora:', fora.join(', '), '| colunas de formulário antigo:', f.camposRetirados.join(', '));
