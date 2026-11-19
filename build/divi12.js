// Formulário de Divinópolis, versão 12 (decisões do Ciro em 19/11/2026). Parte do formulário 11.
// node build/divi12.js
// Mudanças da 12 (só formulário; o cálculo do risco não muda):
//  - Meio: área livre, posição da árvore na calçada e tronco paralelo à fiação
//  - Raízes: colo soterrado e afloramento de raiz na via
//  - Risco: principal alvo, zona do alvo, taxa de ocupação, fator de proteção, principal defeito e carga sobre o defeito (ficha da ISA)
const fs = require('fs'); const path = require('path');
const arq = path.join(__dirname, '..', 'forms/divinopolis-inventario.json');
const f = JSON.parse(fs.readFileSync(arq));
if (f.versao !== 11) throw new Error('Esperava o formulário 11, achei o ' + f.versao);
const campo = (n) => { const c = f.campos.find((x) => x.nome === n); if (!c) throw new Error('Campo não existe: ' + n); return c; };
const op = (l) => l.map((t) => ({ v: t, t }));
const aba = (n) => f.abas.find((a) => a.nome === n);
// põe o campo na base e na etapa, logo antes (ou depois) de um campo que já existe
const poe = (c, etapa, ref, depois, grupo) => {
  f.campos.splice(f.campos.indexOf(campo(ref)) + (depois ? 1 : 0), 0, c);
  const A = aba(etapa).campos; const i = A.findIndex((x) => x.campo === ref); if (i < 0) throw new Error('Não está na etapa ' + etapa + ': ' + ref);
  A.splice(i + (depois ? 1 : 0), 0, grupo ? { campo: c.nome, grupo } : { campo: c.nome });
};
const escolha = (nome, rotulo, ops, ajuda) => ({ armazenar: 'text', nome, rotulo, tipo: 'choice', opcoes: op(ops), ajuda });
const marca = (nome, rotulo, ajuda) => ({ armazenar: 'bool', nome, rotulo, tipo: 'bool', ajuda });
// ---------- Meio ----------
const livre = escolha('Area livre (m2)', 'Área livre (m²)', ['Menor que 1 m²', '1 a 2 m²', '2 a 3 m²', 'Maior que 3 m²'], 'Área de solo sem pavimento em volta do tronco (o canteiro). Estime pela largura e pelo comprimento.');
const posicao = escolha('Posicao da arvore na calcada', 'Posição da árvore na calçada', ['Até 1 m do meio-fio', 'Faixa de circulação', 'Junto ao muro ou divisa'], 'Onde o tronco está na largura da calçada: perto do meio-fio, no meio (onde as pessoas passam) ou encostado no muro ou na divisa do lote.');
poe(livre, 'Meio', 'Conflitos no raio de 2 m', false);
poe(posicao, 'Meio', 'Conflitos no raio de 2 m', false);
poe(marca('Tronco paralelo à fiação', 'Tronco paralelo à fiação', 'O tronco ou um galho principal sobe junto da rede, na mesma direção dos fios.'), 'Meio', 'Fiação ausente', false, 'Fiação aérea');
// ---------- Raízes ----------
poe(marca('Colo soterrado', 'Colo soterrado', 'O colo é a base do tronco, que abre em forma de funil e é sempre um pouco mais larga que o resto. Marque quando não dá para ver esse funil, porque terra, entulho ou calçamento cobriram a base.'), 'Raízes', 'Afloramento da raiz na calçada', true, 'Raízes');
poe(marca('Afloramento da raiz na via', 'Afloramento da raiz na via', 'Raízes que levantaram ou quebraram o meio-fio, a sarjeta ou o asfalto.'), 'Raízes', 'Afloramento da raiz na calçada', true, 'Raízes');
campo('Raízes ausente').ajuda = 'Sem poda de raiz, sem raiz aparente e com o colo à vista.';
// ---------- Risco (ficha de avaliação da ISA) ----------
const risco = [
  escolha('Principal alvo', 'Principal alvo', ['Pessoas', 'Carros estacionados', 'Circulantes da via', 'Edificação', 'Outros'], 'Alvo é o que pode ser atingido se a árvore ou uma parte dela cair (ISA). Marque o mais importante dentro da zona do alvo.'),
  escolha('Zona do alvo', 'Zona do alvo', ['Projeção da copa', '1 vez a altura', '1,5 vez a altura'], 'Área que a árvore, ou a parte dela com defeito, pode atingir se cair (ISA). Projeção da copa: o alvo está embaixo da copa. 1 vez a altura: o alvo está ao alcance da queda da árvore inteira. 1,5 vez a altura: para indivíduos maiores, porque os estilhaços de uma eventual queda vão além da altura da árvore.'),
  escolha('Taxa de ocupacao', 'Taxa de ocupação', ['Raro', 'Ocasional', 'Frequente', 'Constante'], 'Quanto tempo o alvo fica na zona do alvo (ISA). Raro: quase nunca há alvo ali. Ocasional: presente poucas vezes ou por pouco tempo. Frequente: presente em boa parte do dia ou da semana. Constante: sempre presente.'),
  escolha('Fator de protecao', 'Fator de proteção', ['Ausente', 'Presente'], 'Algo entre a árvore e o alvo que segura ou desvia a queda: outra árvore, um muro, uma edificação (ISA). Quando existe, a chance de atingir o alvo é menor.'),
  escolha('Principal defeito da arvore', 'Principal defeito da árvore', ['Raízes e colo', 'Tronco', 'Copa e galhos'], 'A parte da árvore com mais chance de falhar (ISA). É ela que define a probabilidade de falha, logo abaixo.'),
  escolha('Carga sobre o defeito', 'Carga sobre o defeito', ['Pequena', 'Média', 'Significativa'], 'Força que age sobre a parte com defeito: o peso da copa ou dos galhos e a exposição ao vento (ISA).'),
];
for (const c of risco) poe(c, 'Risco', 'Probabilidade de falha', false);
// ---------- regras: onde a etapa já some, os campos novos somem; onde é obrigatória, são obrigatórios ----------
const MEIO = [livre.nome, posicao.nome]; const RIS = risco.map((c) => c.nome);
for (const r of f.regras) for (const k of Object.keys(r.por || {})) { const P = r.por[k];
  if (P['Marquise ou toldo'] === 'oculto') for (const n of MEIO) P[n] = 'oculto';
  if (P['Fiação ausente'] === 'oculto') P['Tronco paralelo à fiação'] = 'oculto';
  if (P['Raízes ausente'] === 'oculto') { P['Colo soterrado'] = 'oculto'; P['Afloramento da raiz na via'] = 'oculto'; }
  if (P['Probabilidade de falha'] === 'oculto') for (const n of RIS) P[n] = 'oculto';
  if (P['Marquise ou toldo'] === 'obrig') for (const n of MEIO) P[n] = 'obrig';
  if (P['Probabilidade de falha'] === 'obrig') for (const n of RIS) P[n] = 'obrig';
}
// no canteiro central não existe posição na calçada (regra depois da de categoria, então vale por último)
f.regras.push({ campo: 'Local do registro', por: { 'Canteiro central': { [posicao.nome]: 'oculto' } } });
const naTela = f.abas.flatMap((a) => a.campos.map((x) => x.campo));
const fora = f.campos.filter((c) => !c.legado && !naTela.includes(c.nome)).map((c) => c.nome); if (fora.length) throw new Error('Campo sem etapa: ' + fora.join(', '));
f.versao = 12;
fs.writeFileSync(arq, JSON.stringify(f, null, 1));
console.log(f.campos.length, 'campos;', f.abas.map((a) => a.nome + ':' + a.campos.length).join(' | '));
