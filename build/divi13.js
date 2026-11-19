// Formulário de Divinópolis, versão 13 (decisões do Ciro em 19/11/2026, depois de ver o 12 na tela). Parte do formulário 12.
// node build/divi13.js
// Mudanças da 13 (só formulário; o cálculo do risco não muda):
//  - etapa nova "Alvo", antes da "Risco": alvos na zona, zona do alvo, taxa de ocupação e fator de proteção
//  - "Principal alvo" (um só) sai da tela e dá lugar ao grupo "Alvos na zona": marca todos os que existem
//  - a explicação vai para dentro de cada opção, como já era em probabilidade de falha
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 12) throw new Error('Esperava o formulário 12, achei o ' + f.versao);
const campo = (n) => { const c = f.campos.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const aba = (n) => f.abas.find((a) => a.nome === n);
// ---------- texto dentro das opções (o valor gravado não muda) ----------
const TXT = {
  'Zona do alvo': { 'Projeção da copa': 'o alvo está embaixo da copa', '1 vez a altura': 'o alvo está ao alcance da queda da árvore inteira', '1,5 vez a altura': 'indivíduos maiores: os estilhaços da queda vão além da altura' },
  'Taxa de ocupacao': { Raro: 'quase nunca há alvo na zona', Ocasional: 'presente poucas vezes ou por pouco tempo', Frequente: 'presente em boa parte do dia ou da semana', Constante: 'sempre presente' },
  'Fator de protecao': { Ausente: 'nada entre a árvore e o alvo', Presente: 'outra árvore, muro ou edificação que segura ou desvia a queda' },
  'Principal defeito da arvore': { 'Raízes e colo': 'raiz cortada ou podre, colo soterrado, solo levantando', Tronco: 'oco, lesão, rachadura, codominância', 'Copa e galhos': 'galho seco, podre ou mal inserido' },
  'Carga sobre o defeito': { Pequena: 'parte leve ou protegida do vento', 'Média': 'peso e exposição ao vento moderados', Significativa: 'copa pesada ou galho longo, exposto ao vento' },
};
for (const n of Object.keys(TXT)) for (const o of campo(n).opcoes) { if (!TXT[n][o.v]) throw new Error('Opção sem texto: ' + n + ' / ' + o.v); o.t = o.v + ' (' + TXT[n][o.v] + ')'; }
campo('Zona do alvo').ajuda = 'Área que a árvore, ou a parte dela com defeito, pode atingir se cair (ISA).';
campo('Taxa de ocupacao').ajuda = 'Quanto tempo o alvo fica na zona do alvo (ISA). Com mais de um alvo marcado, responda pelo mais exposto: o que fica mais tempo na zona.';
campo('Fator de protecao').ajuda = 'Algo entre a árvore e o alvo que segura ou desvia a queda (ISA). Quando existe, a chance de atingir o alvo é menor. Com mais de um alvo marcado, responda pelo mais exposto.';
// ---------- "Principal alvo" sai da tela; entra o grupo "Alvos na zona" ----------
const pa = campo('Principal alvo'); pa.legado = true; pa.rotulo += ' (formulário anterior)';
aba('Risco').campos = aba('Risco').campos.filter((x) => x.campo !== 'Principal alvo');
const G = 'Alvos na zona';
const ALVOS = [
  ['Alvo pessoas', 'Pessoas', 'Pedestres, moradores, ponto de ônibus.'],
  ['Alvo veículos estacionados', 'Veículos estacionados', 'Vaga ou garagem sob a árvore.'],
  ['Alvo veículos em movimento', 'Veículos em movimento', 'Trânsito da via.'],
  ['Alvo edificação', 'Edificação', 'Casa, comércio, muro.'],
  ['Alvo rede elétrica ou de serviços', 'Rede elétrica ou de serviços', 'Fios, poste, transformador.'],
  ['Alvo outros', 'Outros', 'Mobiliário urbano, banca, ponto de táxi.'],
].map(([nome, rotulo, ex], i) => ({ armazenar: 'bool', nome, rotulo, tipo: 'bool', ajuda: (i ? '' : 'Alvo é o que pode ser atingido se a árvore ou uma parte dela cair (ISA). Marque todos os que existem na zona do alvo. ') + ex }));
f.campos.splice(f.campos.indexOf(pa) + 1, 0, ...ALVOS);
// ---------- etapa "Alvo", antes da "Risco" ----------
const DA_ALVO = ['Zona do alvo', 'Taxa de ocupacao', 'Fator de protecao'];
aba('Risco').campos = aba('Risco').campos.filter((x) => !DA_ALVO.includes(x.campo));
f.abas.splice(f.abas.indexOf(aba('Risco')), 0, { nome: 'Alvo', campos: ALVOS.map((c) => ({ campo: c.nome, grupo: G })).concat([{ campo: 'Zona do alvo' }, { campo: 'Taxa de ocupacao' }, { campo: 'Fator de protecao' }]) });
f.gruposObrig.push(G);
// ---------- regras: onde o alvo some, os alvos de marcar somem; "Principal alvo" não é mais pedido ----------
for (const r of f.regras) for (const k of Object.keys(r.por || {})) { const P = r.por[k];
  if (P['Zona do alvo'] === 'oculto') for (const c of ALVOS) P[c.nome] = 'oculto';
  delete P['Principal alvo'];
}
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = f.campos.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
const dup = naTela.filter((n, i) => naTela.indexOf(n) !== i); if (dup.length) throw new Error('Campo em duas etapas: ' + dup.join(', '));
f.versao = 13;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
