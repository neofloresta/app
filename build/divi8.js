// Formulário de Divinópolis, versão 8 (decisões do Ciro em 15/11/2026). Parte do formulário 7 e gera forms/divinopolis-inventario.json
// node build/divi8.js
// Mudanças da 8: etapas por parte da árvore (Meio logo depois da dendrometria; Copa, Tronco e Raízes no lugar de "Podas e danos" e
// "Fitossanidade"); pragas e doenças por parte; galhos secos ou podres em percentual; risco calculado no fim da etapa;
// fotos 2 a 5 sem descrição. Os campos que saem da tela continuam em "campos" (legado: true) para os registros antigos.
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 7) throw new Error('Esperava o formulário 7, achei o ' + f.versao);
const C = f.campos; const campo = (n) => { const c = C.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const depois = (ref, novo) => { C.splice(C.indexOf(campo(ref)) + 1, 0, novo); return novo; };
const bool = (nome, rotulo, ajuda, extra = {}) => Object.assign({ armazenar: 'bool', nome, rotulo, tipo: 'bool', ajuda }, extra);

// ---------- campos novos ----------
depois('Qualidade da copa', { armazenar: 'text', nome: 'Galhos secos ou podres', rotulo: 'Galhos secos ou podres', tipo: 'choice',
  opcoes: ['Ausente', '0-25%', '25-50%', '50-75%', 'acima de 75%'].map((t) => ({ v: t, t })),
  ajuda: 'Parte da copa com galhos mortos, secos ou podres, em relação à copa inteira. Ausente: nenhum galho seco ou podre.' });
let ref = 'Praga aparente';
for (const [n, r, a, x] of [
  ['Fungo na copa', 'Fungo', 'Corpos de fungo (orelhas, chapéus) nos galhos.'],
  ['Cupim na copa', 'Cupim', 'Galerias de terra ou cupinzeiro nos galhos.'],
  ['Broca na copa', 'Broca', 'Furos com serragem nos galhos.'],
  ['Pragas na copa ausente', 'Ausente', 'Nenhum sinal de praga ou doença na copa.', { exclusivo: true }],
  ['Fungo no tronco', 'Fungo', 'Corpos de fungo (orelhas, chapéus) no tronco.'],
  ['Cupim no tronco', 'Cupim', 'Galerias de terra no tronco ou cupinzeiro preso a ele.'],
  ['Broca no tronco', 'Broca', 'Furos com serragem no tronco.'],
  ['Pragas no tronco ausente', 'Ausente', 'Nenhum sinal de praga no tronco.', { exclusivo: true }],
  ['Fungo nas raízes', 'Fungo', 'Corpos de fungo na base do tronco ou nas raízes aparentes.'],
  ['Cupim nas raízes', 'Cupim', 'Galerias de terra ou cupinzeiro na base do tronco ou nas raízes.'],
  ['Pragas nas raízes ausente', 'Ausente', 'Nenhum sinal de praga na base nem nas raízes.', { exclusivo: true }],
]) { depois(ref, bool(n, r, a, x || {})); ref = n; }
depois('Foto 4', { armazenar: 'text', nome: 'Foto 5', rotulo: 'Foto 5', tipo: 'photo', ajuda: 'Opcional.' });
for (const k of [2, 3, 4]) { const c = campo('Foto ' + k); c.rotulo = 'Foto ' + k; c.ajuda = 'Opcional.'; }

// ---------- campos que saem da tela (ficam na base para os registros antigos) ----------
const LEGADO = ['Fungo', 'Cupim', 'Broca', 'Fitossanidade ausente', 'Galhos secos, podres ou com risco de queda'];
for (const n of LEGADO) { const c = campo(n); c.legado = true; delete c.exclusivo; }
campo('Fungo').rotulo = 'Fungo (formulário anterior)'; campo('Cupim').rotulo = 'Cupim (formulário anterior)'; campo('Broca').rotulo = 'Broca (formulário anterior)';
campo('Fitossanidade ausente').rotulo = 'Fitossanidade ausente (formulário anterior)';
campo('Podas ausente').ajuda = 'Nenhum dano por poda na copa.';
campo('Raízes ausente').ajuda = 'Sem poda de raiz e sem raiz aparente.';
campo('Danos ausente').ajuda = 'Tronco sem lesões nem codominância.';
campo('Erva-de-passarinho').ajuda = 'Planta parasita presa nos galhos, com folhagem diferente da árvore.';
campo('Doença aparente').ajuda = 'Manchas nas folhas, cancros ou exsudação (resina, seiva escorrendo) nos ramos.';
campo('Praga aparente').ajuda = 'Insetos em quantidade nas folhas e ramos: cochonilhas, lagartas, pulgões.';
campo('Risco').ajuda = 'Calculado pelo app depois das três respostas acima: probabilidade de falha com a de impacto dá a probabilidade; com as consequências dá o risco (matriz da ISA).';

// ---------- etapas ----------
const antiga = (n) => f.abas.find((a) => a.nome === n).campos;
const g = (grupo, nomes) => nomes.map((n) => { campo(n); return { campo: n, grupo }; });
const s = (nomes) => nomes.map((n) => { campo(n); return { campo: n }; });
const PC = 'Pragas e doenças na copa', PT = 'Pragas no tronco', PR = 'Pragas nas raízes';
f.abas = [
  { nome: 'Identificação', campos: antiga('Identificação') },
  { nome: 'Indivíduo', campos: antiga('Indivíduo') },
  { nome: 'Meio', campos: antiga('Meio') },
  { nome: 'Copa', campos: [...s(['Qualidade da copa', 'Galhos secos ou podres']), ...g('Podas', ['Podas ausente', 'Danos por podas', 'Poda drástica']),
    ...g(PC, ['Pragas na copa ausente', 'Fungo na copa', 'Cupim na copa', 'Broca na copa', 'Erva-de-passarinho', 'Doença aparente', 'Praga aparente'])] },
  { nome: 'Tronco', campos: [...g('Danos no tronco', ['Danos ausente', 'Lesões no tronco', 'Codominância de troncos']), ...s(['Ocos e cavidades']),
    ...g(PT, ['Pragas no tronco ausente', 'Fungo no tronco', 'Cupim no tronco', 'Broca no tronco'])] },
  { nome: 'Raízes', campos: [...g('Raízes', ['Raízes ausente', 'Poda de raiz', 'Afloramento da raiz no canteiro', 'Afloramento da raiz na calçada']),
    ...g(PR, ['Pragas nas raízes ausente', 'Fungo nas raízes', 'Cupim nas raízes'])] },
  { nome: 'Risco', campos: s(['Probabilidade de falha', 'Probabilidade de impacto', 'Falha+Impacto', 'Matriz de Probabilidade', 'Consequencias', 'Matriz de Prob + Conseq', 'Risco']) },
  { nome: 'Manejo', campos: antiga('Manejo') },
  { nome: 'Fotos e observações', campos: s(['Foto 2', 'Foto 3', 'Foto 4', 'Foto 5', 'Observacoes']) },
];
f.gruposObrig = ['Fiação aérea', 'Interferência no tráfego', 'Podas', PC, 'Danos no tronco', PT, 'Raízes', PR];

// ---------- regras ----------
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = C.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome);
if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
const cat = f.regras.find((r) => r.campo === 'Categoria').por; const sit = f.regras.find((r) => r.campo === 'Situacao').por;
for (const k of ['1', '2', '3']) cat[k]['Galhos secos ou podres'] = 'obrig';
const novos = ['Galhos secos ou podres', 'Fungo na copa', 'Cupim na copa', 'Broca na copa', 'Pragas na copa ausente', 'Fungo no tronco', 'Cupim no tronco', 'Broca no tronco', 'Pragas no tronco ausente', 'Fungo nas raízes', 'Cupim nas raízes', 'Pragas nas raízes ausente', 'Foto 5'];
for (const n of novos) { cat['5'][n] = 'oculto'; sit.Morta[n] = 'oculto'; }
for (const n of LEGADO) { delete cat['5'][n]; delete sit.Morta[n]; }
f.versao = 8;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(C.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
