// Formulário de Divinópolis, versão 10 (decisões do Ciro em 18/11/2026). Parte do formulário 9.
// node build/divi10.js
// Mudanças da 10:
//  - sai a calçada irregular: campos "Risco nivel 1" e "Nivel da avaliacao", a etapa rápida e as regras deles
//  - "Motivo sem acesso" vira lista (condomínio ou área particular, relevo, obra ou interdição, outro) e "Outro" pede o texto
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 9) throw new Error('Esperava o formulário 9, achei o ' + f.versao);
const C = f.campos; const campo = (n) => { const c = C.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const op = (l) => l.map((t) => ({ v: t, t }));
const aba = (n) => f.abas.find((a) => a.nome === n);
// ---------- sai a calçada irregular ----------
const SAI = ['Risco nivel 1', 'Nivel da avaliacao'];
f.campos = f.campos.filter((c) => !SAI.includes(c.nome));
for (const a of f.abas) { a.campos = a.campos.filter((x) => !SAI.includes(x.campo)); delete a.nomeRapido; }
f.regras = f.regras.filter((r) => !SAI.includes(r.campo));
for (const r of f.regras) for (const k of Object.keys(r.por || {})) for (const n of SAI) delete r.por[k][n];
// ---------- motivo da face ou quadra sem acesso ----------
const m = f.campos.find((c) => c.nome === 'Motivo sem acesso');
m.tipo = 'choice'; m.opcoes = op(['Condomínio ou área particular', 'Relevo', 'Obra ou interdição', 'Outro']); m.rotulo = 'Por que não dá para entrar?';
m.ajuda = 'Escolha o motivo. Em "Outro", escreva qual. O auditor confere a foto.';
f.campos.splice(f.campos.indexOf(m) + 1, 0, { armazenar: 'text', nome: 'Motivo sem acesso (outro)', rotulo: 'Qual o motivo?', tipo: 'text', oculto: true, ajuda: 'Escreva em poucas palavras.' });
aba('Identificação').campos.splice(aba('Identificação').campos.findIndex((x) => x.campo === 'Motivo sem acesso') + 1, 0, { campo: 'Motivo sem acesso (outro)' });
const rc = f.regras.find((r) => r.campo === 'Categoria').por;
rc['6']['Motivo sem acesso'] = 'obrig'; delete rc['6']['Motivo sem acesso (outro)'];
f.regras.push({ campo: 'Motivo sem acesso', por: { Outro: { 'Motivo sem acesso (outro)': 'obrig' } } });
// ---------- categoria "Agrupamento" (cerca-viva, calçada sem uso: dezenas de indivíduos juntos) ----------
const cat = f.campos.find((c) => c.nome === 'Categoria'); cat.opcoes.splice(cat.opcoes.findIndex((o) => o.v === '5'), 0, { v: '7', t: 'Agrupamento' });
cat.ajuda += ' Agrupamento: muitos indivíduos juntos (cerca-viva, calçada sem uso). Um registro só, com a quantidade estimada, o CAP de 3 indivíduos e a altura média.';
const q = { armazenar: 'real', nome: 'Qtde estimada de individuos', rotulo: 'Quantidade estimada de indivíduos', tipo: 'number', min: 2, avisoMax: 500, oculto: true, ajuda: 'Agrupamento: quantos indivíduos há no conjunto, por contagem visual.' };
f.campos.splice(f.campos.findIndex((c) => c.nome === 'Especie suspeita') + 1, 0, q);
aba('Indivíduo').campos.splice(aba('Indivíduo').campos.findIndex((x) => x.campo === 'Especie suspeita') + 1, 0, { campo: q.nome });
const cap = f.campos.find((c) => c.nome === 'CAP (cm)'); cap.ajuda += ' Agrupamento: meça 3 indivíduos escolhidos por média visual (um em cada linha).';
const alt = f.campos.find((c) => c.nome === 'Altura total (m)'); alt.ajuda += ' Agrupamento: altura média dos indivíduos.';
rc['7'] = JSON.parse(JSON.stringify(rc['1'])); rc['7'][q.nome] = 'obrig';
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = f.campos.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
f.versao = 10;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
