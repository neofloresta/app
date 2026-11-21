// Formulário de Divinópolis, versão 16 (decisões do Ciro em 20/11/2026, depois do treinamento de campo com a Gap). Parte do 15.
// node build/divi16.js
//  - manejo: saem "Remoção do alvo" e "Suporte complementar"; "Avaliação nível 2 ou 3" vira "Avaliação nível 3"
//    (a marca antiga é aproveitada no ajuste dos registros, pela lista `renomeados`)
//  - categoria nova "Fragmento florestal" (código 8): mato nativo de várias espécies invadindo a calçada, avaliado como um maciço.
//    Mesmas regras do agrupamento, sem espécie
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 15) throw new Error('Esperava o formulário 15, achei o ' + f.versao);
const campo = (n) => { const c = f.campos.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const SAI = ['Manejo remoção do alvo', 'Manejo suporte complementar', 'Manejo avaliação nível 2 ou 3']; const NOVO = 'Manejo avaliação nível 3';
const velho = campo('Manejo avaliação nível 2 ou 3'); SAI.forEach(campo);
const novo = Object.assign({}, velho, { nome: NOVO, rotulo: 'Avaliação nível 3', ajuda: 'Para exemplar de grande porte ou valor que merece um exame aprofundado (tomografia, por exemplo) antes de decidir.' });
f.campos.splice(f.campos.indexOf(velho), 1, novo); f.campos = f.campos.filter((c) => !SAI.includes(c.nome));
const M = f.abas.find((a) => a.nome === 'Manejo'); M.campos = M.campos.map((x) => (x.campo === 'Manejo avaliação nível 2 ou 3' ? Object.assign({}, x, { campo: NOVO }) : x)).filter((x) => !SAI.includes(x.campo));
for (const r of f.regras) for (const k of Object.keys(r.por || {})) { const P = r.por[k]; if ('Manejo avaliação nível 2 ou 3' in P) P[NOVO] = P['Manejo avaliação nível 2 ou 3']; SAI.forEach((n) => delete P[n]); }
f.regras = f.regras.filter((r) => !SAI.includes(r.campo));
f.renomeados = Object.assign({}, f.renomeados, { [NOVO]: 'Manejo avaliação nível 2 ou 3' });
f.camposRetirados = [...new Set((f.camposRetirados || []).concat(SAI))].sort();
// ---------- Fragmento florestal ----------
const cat = campo('Categoria'); if (cat.opcoes.some((o) => String(o.v) === '8')) throw new Error('Já existe a categoria 8');
const iAg = cat.opcoes.findIndex((o) => String(o.v) === '7'); cat.opcoes.splice(iAg + 1, 0, { v: '8', t: 'Fragmento florestal' });
cat.ajuda = (cat.ajuda ? cat.ajuda + ' ' : '') + 'Fragmento florestal: mato nativo de várias espécies que avança sobre a calçada; é avaliado como um maciço só, sem espécie. Agrupamento é para muitos indivíduos da mesma espécie.';
const rc = f.regras.find((r) => r.campo === 'Categoria'); if (!rc || !rc.por['7']) throw new Error('Falta a regra do agrupamento');
rc.por['8'] = Object.assign({}, rc.por['7'], { Especie: 'oculto' }); if (campo('Especie suspeita')) rc.por['8']['Especie suspeita'] = 'oculto';
const q = campo('Qtde estimada de individuos'); q.ajuda = 'Agrupamento ou fragmento florestal: quantos indivíduos há no conjunto, por contagem visual.';
// toda regra de outro campo que cita a categoria por código não muda; confere que nada ficou sem etapa
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo)); const fora = f.campos.filter((c) => !c.legado && c.tipo !== 'hidden' && !c.calculado && !c.auto && !naTela.includes(c.nome)).map((c) => c.nome);
const n15 = JSON.parse(require('child_process').execSync('git show HEAD:forms/divinopolis-inventario.json', { cwd: path.join(__dirname, '..'), maxBuffer: 5e7 }).toString()); const naTela15 = n15.abas.flatMap((a) => a.campos.map((x) => x.campo));
const novosFora = fora.filter((n) => naTela15.includes(n)); if (novosFora.length) throw new Error('Campo perdeu a etapa: ' + novosFora.join(', '));
f.versao = 16;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos; manejo:', M.campos.map((x) => x.campo).join(' | '));
