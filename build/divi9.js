// Formulário de Divinópolis, versão 9 (decisões do Ciro em 17/11/2026). Parte do formulário 8.
// node build/divi9.js
// Mudanças da 9:
//  - "Fitossanidade" (Boa, Regular, Ruim), nota da árvore inteira, no fim da etapa Raízes, no lugar de "Doença aparente" e "Praga aparente"
//  - cadastro rápido nas faces com calçada irregular: avaliação de risco nível 1 (ABNT NBR 16246-3), com um campo de risco só
//  - categoria "Sem acesso" (quadra onde a equipe não entra): só a foto e o motivo; não aparece na escolha de categoria
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 8) throw new Error('Esperava o formulário 8, achei o ' + f.versao);
const C = f.campos; const campo = (n) => { const c = C.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const depois = (ref, novo) => { C.splice(C.indexOf(campo(ref)) + 1, 0, novo); return novo; };
const op = (l) => l.map((t) => ({ v: t, t }));

// ---------- campos novos ----------
depois('Pragas nas raízes ausente', { armazenar: 'text', nome: 'Fitossanidade', rotulo: 'Fitossanidade', tipo: 'choice', opcoes: op(['Boa', 'Regular', 'Ruim']),
  ajuda: 'Nota da árvore inteira. Boa: sem sinais de praga ou doença. Regular: sinais leves ou localizados, sem comprometer a árvore. Ruim: ataque intenso ou generalizado, com comprometimento visível.' });
depois('Risco', { armazenar: 'text', nome: 'Risco nivel 1', rotulo: 'Risco', tipo: 'choice', oculto: true, opcoes: op(['Baixo', 'Médio', 'Alto', 'Severo']),
  nota: 'Avaliação de risco nível 1 (ABNT NBR 16246-3): visual, sem a matriz.',
  ajuda: 'Avaliação de risco nível 1 (ABNT NBR 16246-3): julgamento visual, sem a matriz de probabilidade e consequências. Usada no cadastro rápido das faces com calçada irregular.' });
depois('Risco nivel 1', { armazenar: 'text', nome: 'Nivel da avaliacao', rotulo: 'Nível da avaliação de risco', tipo: 'hidden', nivelAuto: true,
  ajuda: 'Preenchido pelo app (ABNT NBR 16246-3): 1 no cadastro rápido das faces com calçada irregular; 2 no cadastro completo.' });
depois('Foto 1', { armazenar: 'text', nome: 'Motivo sem acesso', rotulo: 'Por que não dá para entrar?', tipo: 'text', oculto: true,
  ajuda: 'Exemplos: condomínio fechado, área particular, área de risco.' });

// ---------- categoria "Sem acesso" ----------
const cat = campo('Categoria'); cat.opcoes.push({ v: '6', t: 'Sem acesso' });
campo('Foto 1').ajuda = (campo('Foto 1').ajuda || '').replace(/\s*Quadra sem acesso:.*$/, '') + ' Quadra sem acesso: a entrada (portaria, portão ou cerca).';

// ---------- campos que saem da tela ----------
for (const n of ['Doença aparente', 'Praga aparente']) { const c = campo(n); c.legado = true; c.rotulo = n + ' (formulário anterior)'; }

// ---------- etapas ----------
const aba = (n) => f.abas.find((a) => a.nome === n);
aba('Copa').campos = aba('Copa').campos.filter((x) => !['Doença aparente', 'Praga aparente'].includes(x.campo));
aba('Raízes').campos.push({ campo: 'Fitossanidade' }); aba('Raízes').nomeRapido = 'Fitossanidade';
aba('Risco').campos.push({ campo: 'Risco nivel 1' }, { campo: 'Nivel da avaliacao' });
const id = aba('Identificação').campos; id.splice(id.findIndex((x) => x.campo === 'Foto 1') + 1, 0, { campo: 'Motivo sem acesso' });

// ---------- regras ----------
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = C.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
const rc = f.regras.find((r) => r.campo === 'Categoria').por; const sit = f.regras.find((r) => r.campo === 'Situacao').por;
for (const k of ['1', '2', '3']) rc[k].Fitossanidade = 'obrig';
for (const alvo of [rc['5'], sit.Morta]) { alvo.Fitossanidade = 'oculto'; alvo['Risco nivel 1'] = 'oculto'; }
// sem acesso: só a foto e o motivo
const fixos = ['Codigo', 'Data e hora', 'Coletor', 'Categoria', 'Foto 1', 'Motivo sem acesso', 'Nivel da avaliacao'];
rc['6'] = {}; for (const c of C) if (!fixos.includes(c.nome)) rc['6'][c.nome] = 'oculto';
rc['6']['Foto 1'] = 'obrig'; rc['6']['Motivo sem acesso'] = 'opcional';
// cadastro rápido (nível 1): local, categoria, foto geral, situação, espécie (com as fotos de identificação), CAP, altura, fitossanidade e risco
const ficaRapido = new Set([...aba('Identificação').campos.map((x) => x.campo), 'Situacao', 'Especie', 'Especie suspeita', 'Altura total (m)', 'Fitossanidade', 'Risco nivel 1', 'Nivel da avaliacao',
  ...C.filter((c) => /^CAP|^Foto (folha|ramo|tronco|detalhe)|identifica/i.test(c.nome)).map((c) => c.nome)]);
const idFotos = Object.keys(f.regras.find((r) => r.campo === 'Especie').por['Não identificada']); idFotos.forEach((n) => ficaRapido.add(n));
const n1 = {}; for (const c of C) if (!c.legado && !ficaRapido.has(c.nome) && c.nome !== 'Motivo sem acesso') n1[c.nome] = 'oculto';
n1['Risco nivel 1'] = 'obrig';
f.regras.push({ campo: 'Nivel da avaliacao', por: { 1: n1 } });
f.gruposObrig = f.gruposObrig; f.marcaVersao = 'Galhos secos ou podres';
f.versao = 9;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(C.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
console.log('rápido mostra:', C.filter((c) => !c.legado && !n1[c.nome] || n1[c.nome] === 'obrig').map((c) => c.nome).join(', '));
