// Formulário de Divinópolis, versão 14 (decisões do Ciro em 19/11/2026, à noite). Parte do formulário 13.
// node build/divi14.js
// Mudanças da 14 (só formulário; o cálculo do risco não muda):
//  - Fitossanidade (Boa, Regular, Ruim) sai da etapa Raízes e vai para a Identificação, depois da foto geral
//  - "Tronco paralelo à fiação elétrica aérea?" vira pergunta própria (Não ou Sim), fora do grupo da fiação;
//    não aparece quando a fiação é "Ausente". A caixa de marcar antiga fica só na base, para os registros dos formulários 12 e 13
// A rede elétrica continua entre os alvos na zona. A largura da calçada já não existia no formulário (calçada sem árvores pede só a foto).
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 13) throw new Error('Esperava o formulário 13, achei o ' + f.versao);
const campo = (n) => { const c = f.campos.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const aba = (n) => { const a = f.abas.find((x) => x.nome === n); if (!a) throw new Error('Etapa não existe: ' + n); return a; };
// ---------- Fitossanidade: da etapa Raízes para a Identificação ----------
campo('Fitossanidade');
aba('Raízes').campos = aba('Raízes').campos.filter((x) => x.campo !== 'Fitossanidade');
const I = aba('Identificação').campos; const iFoto = I.findIndex((x) => x.campo === 'Foto 1'); if (iFoto < 0) throw new Error('Foto 1 não está na Identificação');
I.splice(iFoto + 1, 0, { campo: 'Fitossanidade' });
// ---------- Tronco paralelo: pergunta própria ----------
const ANT = 'Tronco paralelo à fiação'; const NOVO = 'Tronco paralelo a fiacao eletrica';
const ant = campo(ANT); ant.legado = true; ant.rotulo = 'Tronco paralelo à fiação (formulário anterior)';
const novo = { armazenar: 'text', nome: NOVO, rotulo: 'Tronco paralelo à fiação elétrica aérea?', tipo: 'choice', opcoes: [{ v: 'Não', t: 'Não' }, { v: 'Sim', t: 'Sim' }], ajuda: 'O tronco ou um galho principal sobe junto da rede, na mesma direção dos fios. Sem fiação aérea, a pergunta não aparece.' };
f.campos.splice(f.campos.indexOf(ant) + 1, 0, novo);
const M = aba('Meio').campos; aba('Meio').campos = M.filter((x) => x.campo !== ANT);
const M2 = aba('Meio').campos; let ult = -1; M2.forEach((x, i) => { if (x.grupo === 'Fiação aérea') ult = i; }); if (ult < 0) throw new Error('Grupo Fiação aérea não está na etapa Meio');
M2.splice(ult + 1, 0, { campo: NOVO });
for (const r of f.regras) for (const k of Object.keys(r.por || {})) { const P = r.por[k];
  delete P[ANT];
  if (P['Fiação ausente'] === 'oculto') P[NOVO] = 'oculto';
  if (P['Marquise ou toldo'] === 'obrig') P[NOVO] = 'obrig';
}
// sem fiação aérea, a pergunta não aparece (regra por caixa de marcar: o valor marcado chega como "true")
f.regras.push({ campo: 'Fiação ausente', por: { true: { [NOVO]: 'oculto' } } });
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = f.campos.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
const dup = naTela.filter((n, i) => naTela.indexOf(n) !== i); if (dup.length) throw new Error('Campo em duas etapas: ' + dup.join(', '));
if (!f.campos.some((c) => c.nome === 'Alvo rede elétrica ou de serviços' && !c.legado)) throw new Error('A rede elétrica tem de continuar entre os alvos');
f.versao = 14;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
