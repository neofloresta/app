// Formulário de Divinópolis, versão 6 (decisões do Ciro em 07 e 08/11/2026 e revisão de UX). Gera forms/divinopolis-inventario.json
// node build/divi6.js
// Mudanças da 6: data e hora só leitura; 'Ausente' primeiro; Fitossanidade e Risco em etapas separadas (risco no topo);
// calçada sem árvores só com a foto (sem largura); fotos com legenda antes das observações.
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..');
const antigo = JSON.parse(fs.readFileSync(path.join(raiz, 'forms/divinopolis-inventario.json')));
const C = []; const A = []; let aba = null;
const tab = (n) => { aba = { nome: n, campos: [] }; A.push(aba); };
const add = (c, grupo) => { C.push(Object.assign({ armazenar: c.tipo === 'bool' ? 'bool' : c.tipo === 'number' ? 'real' : c.tipo === 'datetime' ? 'datetime' : 'text' }, c)); aba.campos.push(grupo ? { campo: c.nome, grupo } : { campo: c.nome }); };
const ch = (nome, rotulo, ops, extra = {}) => add(Object.assign({ nome, rotulo, tipo: 'choice', opcoes: ops.map((t) => ({ v: typeof t === 'string' ? t : t[0], t: typeof t === 'string' ? t : t[1] })) }, extra));
const b = (nome, rotulo, grupo, extra = {}) => add(Object.assign({ nome, rotulo: rotulo || nome, tipo: 'bool' }, extra), grupo);
const n = (nome, rotulo, extra = {}) => add(Object.assign({ nome, rotulo, tipo: 'number' }, extra));
const foto = (nome, rotulo, extra = {}) => add(Object.assign({ nome, rotulo, tipo: 'photo' }, extra));

tab('Identificação');
add({ nome: 'Codigo', rotulo: 'Código da árvore', tipo: 'text', auto: 'codigo', ajuda: 'Gerado pelo app, sem repetir entre equipes. Não precisa digitar.' });
add({ nome: 'Data e hora', rotulo: 'Data e hora da avaliação', tipo: 'datetime', agora: true, somenteLeitura: true, ajuda: 'O app grava a hora em que o cadastro começou. Não dá para mudar.' });
add({ nome: 'Coletor', rotulo: 'Coletor', tipo: 'text', auto: 'coletor', ajuda: 'Nome de quem está logado no app.' });
ch('Local do registro', 'Local do registro', ['Via pública (calçada)', 'Canteiro central'], { obrigatorio: true, ajuda: 'Onde está o ponto: na calçada ou no canteiro central da via.' });
ch('Categoria', 'Categoria', [['1', 'Árvore (altura igual ou superior a 2 m)'], ['2', 'Arbusto (altura igual ou superior a 2 m)'], ['3', 'Palmeira (altura igual ou superior a 2 m)'], ['5', 'Calçada sem árvores']], { obrigatorio: true, ajuda: 'Árvore, arbusto e palmeira entram a partir de 2 m de altura. Calçada sem árvores: trecho de calçada sem nenhum indivíduo.' });
foto('Foto 1', 'Foto geral', { obrigatorio: true, ajuda: 'Árvore, arbusto ou palmeira: o indivíduo inteiro, da base ao topo da copa. Calçada sem árvores: a calçada inteira, no sentido do comprimento.' });

tab('Indivíduo');
ch('Situacao', 'Situação', ['Viva', 'Morta'], { ajuda: 'Morta: sem folhas vivas nem brotação, fora da época de queda natural das folhas. Para morta, o cadastro é só o ponto e a foto geral.' });
add({ nome: 'Especie', rotulo: 'Espécie', tipo: 'species', ajuda: 'Digite parte do nome científico ou popular. Se não souber, escolha "Não identificada": o app pede as fotos para identificação.' });
add({ nome: 'CAP (cm)', rotulo: 'CAP (cm)', tipo: 'multinumber', maxFustes: 3, avisoMin: 2, avisoMax: 900, ajuda: 'Circunferência do caule a 1,30 m do chão, medida com fita, em centímetros. Com mais de um caule abaixo de 1,30 m, escolha os três mais representativos (os maiores) e meça somente esses, um em cada linha (máximo de 3).' });
n('Altura total (m)', 'Altura total (m)', { min: 2, avisoMax: 40, limiteMsg: 'abaixo do critério de inclusão (altura a partir de 2 m)', ajuda: 'Do chão ao ponto mais alto da copa, em metros.' });
add({ nome: 'Modo de copa', rotulo: 'Modo de medir a copa', tipo: 'hidden', auto: 'modocopa', armazenar: 'text', ajuda: 'Raios ou área medida, conforme a preferência de quem coletou.' });
for (const k of [1, 2, 3, 4]) n(`Raio de copa ${k} (m)`, `Raio de copa ${k} (m)`, { avisoMin: 0.1, avisoMax: 20, ajuda: 'Distância do centro do tronco até a borda da copa, em metros, em quatro direções em cruz (ao longo da calçada e perpendicular a ela).', oculto: true });
const R = (k) => `"Raio de copa ${k} (m)"`;
add({ nome: 'Area de copa (m2)', rotulo: 'Área de copa (m²)', tipo: 'text', armazenar: 'real', calculado: true, oculto: true, expr: `round(3.1416 * ((${R(1)} + ${R(2)} + ${R(3)} + ${R(4)}) / 4) * ((${R(1)} + ${R(2)} + ${R(3)} + ${R(4)}) / 4), 2)`, ajuda: 'Calculada pelos quatro raios: área do círculo com o raio médio.' });
n('Area de copa medida (m2)', 'Área de copa medida (m²)', { oculto: true, avisoMin: 1, avisoMax: 1200, ajuda: 'Área da projeção da copa medida direto, com trena a laser, em metros quadrados.' });
foto('Foto folha face superior', 'Foto da folha: face de cima', { oculto: true, ajuda: 'Uma folha inteira e madura, aberta sobre a mão ou um fundo liso, com a face de cima para a câmera. Encha a tela com a folha.' });
foto('Foto folha face inferior', 'Foto da folha: face de baixo', { oculto: true, ajuda: 'A mesma folha virada, com a face de baixo para a câmera. Mostra pelos, nervuras e cor, que ajudam a identificar.' });
foto('Foto ramo filotaxia', 'Foto do ramo (filotaxia)', { oculto: true, ajuda: 'Um ramo com várias folhas presas, mostrando como elas saem do ramo (alternadas, opostas ou em roseta) e se a folha é simples ou composta.' });
foto('Foto tronco detalhe', 'Foto do detalhe do tronco', { oculto: true, ajuda: 'A casca do tronco de perto, a cerca de um palmo de distância, na altura do peito.' });

tab('Meio');
ch('Conflitos no raio de 2 m', 'Conflitos no raio de 2 m', ['Ausente', 'Presente'], { ajuda: 'Elementos a até 2 m do tronco que disputam espaço com a árvore: poste, placa, entrada de garagem, boca de lobo, hidrante, muro.' });
const fiacaoAj = { ajudaImg: 'forms/ajuda/fiacao.svg' };
b('Fiação baixa isolada', 'Baixa isolada', 'Fiação aérea', Object.assign({ ajuda: 'Rede de baixa tensão em cabo único trançado (multiplexado), preto, logo abaixo da média tensão.' }, fiacaoAj));
b('Fiação baixa nua', 'Baixa nua', 'Fiação aérea', Object.assign({ ajuda: 'Rede de baixa tensão com fios separados e sem capa, presos em fila vertical no poste.' }, fiacaoAj));
b('Fiação média compacta', 'Média compacta', 'Fiação aérea', Object.assign({ ajuda: 'Rede de média tensão com cabos cobertos presos em espaçadores, no alto do poste.' }, fiacaoAj));
b('Fiação média nua', 'Média nua', 'Fiação aérea', Object.assign({ ajuda: 'Rede de média tensão com fios sem capa, apoiados em isoladores numa cruzeta no topo do poste.' }, fiacaoAj));
b('Fiação derivação', 'Derivação', 'Fiação aérea', Object.assign({ ajuda: 'Ramal que sai da rede e vai até o imóvel (entrada de energia).' }, fiacaoAj));
b('Fiação serviços gerais', 'Serviços gerais', 'Fiação aérea', Object.assign({ ajuda: 'Cabos de telefone, internet e TV, presos mais baixo no poste.' }, fiacaoAj));
b('Fiação ausente', 'Ausente', 'Fiação aérea', { exclusivo: true, ajuda: 'Nenhuma fiação aérea sobre ou ao lado da copa.' });
ch('Marquise ou toldo', 'Presença de marquise ou toldo', ['Ausente', 'Presente'], { ajuda: 'Marquise, toldo ou cobertura da fachada que encosta ou fica a menos de 1 m da copa.' });
b('Interfere pedestres', 'Pedestres', 'Interferência no tráfego', { ajuda: 'Galhos abaixo de cerca de 2,4 m sobre a calçada ou tronco que estreita a passagem.' });
b('Interfere veículos', 'Veículos', 'Interferência no tráfego', { ajuda: 'Galhos abaixo de cerca de 4,5 m sobre a pista, ou que encostam em veículos altos.' });
b('Tráfego sem interferência', 'Ausente', 'Interferência no tráfego', { exclusivo: true, ajuda: 'A árvore não atrapalha pedestres nem veículos.' });

tab('Podas e danos');
const pod = { 'Danos por podas': 'Cortes mal feitos, lascas ou tocos deixados por podas anteriores.', 'Galhos secos, podres ou com risco de queda': 'Galhos mortos, ocos, rachados ou pendurados.', 'Poda drástica': 'Copa reduzida a poucos galhos grossos (poda em "cabeça de palito").', 'Poda de raiz': 'Raízes cortadas, por obra na calçada ou na rede.' };
for (const [f, aj] of Object.entries(pod)) b(f, f, 'Podas', { ajuda: aj });
b('Podas ausente', 'Ausente', 'Podas', { exclusivo: true, ajuda: 'Nenhum sinal de poda ou dano por poda.' });
b('Lesões no tronco', 'Lesões no tronco', 'Danos', { ajuda: 'Feridas, casca arrancada, batidas de veículo, vandalismo.' });
b('Codominância de troncos', 'Codominância de troncos', 'Danos', { ajuda: 'Dois ou mais troncos de grossura parecida saindo do mesmo ponto, em V fechado.' });
b('Danos ausente', 'Ausente', 'Danos', { exclusivo: true, ajuda: 'Tronco sem lesões nem codominância.' });
ch('Ocos e cavidades', 'Ocos e cavidades no tronco', ['Ausente', 'Presente (menor que 1/3)', 'Presente (maior que 1/3)'], { ajuda: 'Compare o tamanho do oco com o diâmetro do tronco naquele ponto.' });
b('Afloramento da raiz no canteiro', 'Afloramento da raiz no canteiro', 'Raízes', { ajuda: 'Raízes aparentes dentro do canteiro.' });
b('Afloramento da raiz na calçada', 'Afloramento da raiz na calçada', 'Raízes', { ajuda: 'Raízes que levantaram ou quebraram o piso da calçada.' });
b('Raízes ausente', 'Ausente', 'Raízes', { exclusivo: true, ajuda: 'Nenhuma raiz aparente.' });

tab('Fitossanidade');
ch('Qualidade da copa', 'Qualidade da copa', ['Normal', 'Estressada', 'Sem folhagem (sazonal)', 'Sem folhagem (poda)'], { ajuda: 'Estressada: folhas pequenas, amareladas ou copa rala para a espécie.' });
const fit = { Fungo: 'Corpos de fungo (orelhas, chapéus) no tronco, nos galhos ou na base.', Cupim: 'Galerias de terra no tronco ou cupinzeiro.', Broca: 'Furos com serragem no tronco ou nos galhos.', 'Erva-de-passarinho': 'Planta parasita presa nos galhos, com folhagem diferente da árvore.', 'Doença aparente': 'Manchas, cancros ou exsudação (resina, seiva escorrendo).', 'Praga aparente': 'Insetos em quantidade: cochonilhas, lagartas, pulgões.' };
for (const [f, aj] of Object.entries(fit)) b(f, f, 'Fitossanidade', { ajuda: aj });
b('Fitossanidade ausente', 'Ausente', 'Fitossanidade', { exclusivo: true, ajuda: 'Nenhum sinal de praga ou doença.' });
tab('Risco');
// risco pela ISA, mesma matriz do formulário da SEADE
const seade = JSON.parse(fs.readFileSync(path.join(raiz, 'forms/seade-risco.json')));
const sc = (nome) => JSON.parse(JSON.stringify(seade.campos.find((c) => c.nome === nome)));
const pf = sc('Probabilidade de falha'); pf.ajuda = 'Chance de falha (queda da árvore ou de um galho) no período de 1 ano, pela avaliação visual (ISA).'; add(pf);
const pi = sc('Probabilidade de impacto'); pi.opcoes.forEach((o) => { o.t = o.t.replace(' - ', ', '); }); pi.ajuda = 'Chance de a parte que pode falhar atingir um alvo (pessoas, veículos, imóveis, rede).'; add(pi);
const fi = sc('Falha+Impacto'); add(fi);
const mp = sc('Matriz de Probabilidade'); mp.tipo = 'hidden'; add(mp);
const co = sc('Consequencias'); co.ajuda = 'Gravidade do dano se a falha atingir o alvo.'; add(co);
const mc = sc('Matriz de Prob + Conseq'); add(mc);
const cr = sc('Categoria de Risco');
add({ nome: 'Risco', rotulo: 'Risco (calculado pela matriz da ISA)', tipo: 'choice', calculado: true, armazenar: 'text', opcoes: ['Baixo', 'Médio', 'Alto', 'Severo'].map((t) => ({ v: t, t })), expr: cr.expr.replace(/'Medio'/g, "'Médio'"), ajuda: 'Calculado pelo app: probabilidade de falha com a de impacto dá a probabilidade; com as consequências dá o risco (matriz da ISA).' });

tab('Manejo');
const man = { 'Remoção do indivíduo': 'Supressão da árvore.', 'Remoção do alvo': 'Tirar ou afastar o que pode ser atingido (ex.: mudar vaga de estacionamento).', Poda: 'Poda de limpeza, levantamento ou adequação.', Tutoramento: 'Tutor para muda ou árvore jovem inclinada.', 'Adubação': 'Adubação ou correção do solo.', 'Aumento de canteiro': 'Ampliar a área livre em volta do tronco.', 'Limpeza de epífitas e parasitas': 'Retirar erva-de-passarinho e outras plantas sobre a árvore.', 'Suporte complementar': 'Cabos ou escoras para reduzir o risco de falha.', 'Avaliação nível 2 ou 3': 'Avaliação detalhada, com instrumentos (ex.: tomografia).' };
for (const [f, aj] of Object.entries(man)) b('Manejo ' + f.toLowerCase(), f, 'Manejo e mitigações', { ajuda: aj });
b('Manejo nenhum', 'Nenhum', 'Manejo e mitigações', { exclusivo: true, ajuda: 'Nenhum manejo necessário agora.' });
add({ nome: 'Outras mitigacoes', rotulo: 'Outras mitigações', tipo: 'textarea', ajuda: 'Outra medida, se nenhuma acima servir.' });

tab('Fotos e observações');
foto('Foto 2', 'Foto 2: copa e entorno', { ajuda: 'Opcional: a copa e o que está em volta (fiação, fachada, poste).' });
foto('Foto 3', 'Foto 3: base e calçada', { ajuda: 'Opcional: a base do tronco, o canteiro e a calçada.' });
foto('Foto 4', 'Foto 4: detalhe', { ajuda: 'Opcional: um detalhe que precisa de atenção (lesão, oco, praga, poda malfeita).' });
add({ nome: 'Observacoes', rotulo: 'Observações', tipo: 'textarea', ajuda: 'Qualquer informação útil que não cabe nos campos.' });

// o risco calculado fica no topo da etapa Risco, sempre à vista
{ const ar = A.find((a) => a.nome === 'Risco'); ar.campos.sort((x, y) => (y.campo === 'Risco') - (x.campo === 'Risco')); }
// ---------- regras ----------
const nomesAba = (nm) => A.find((a) => a.nome === nm).campos.map((x) => x.campo);
const set = (o, cs, e) => cs.forEach((k) => { o[k] = e; });
const VIVO = {}; // árvore, arbusto e palmeira
set(VIVO, ['Situacao', 'Especie', 'CAP (cm)', 'Altura total (m)', 'Conflitos no raio de 2 m', 'Marquise ou toldo', 'Ocos e cavidades', 'Qualidade da copa', 'Probabilidade de falha', 'Probabilidade de impacto', 'Consequencias'], 'obrig');
const CAL = {}; // calçada sem árvores: só o ponto e a foto da calçada inteira
for (const t of ['Indivíduo', 'Meio', 'Podas e danos', 'Fitossanidade', 'Risco', 'Manejo', 'Fotos e observações']) set(CAL, nomesAba(t), 'oculto');
const MORTA = {}; // morta: só ponto e foto geral
set(MORTA, nomesAba('Indivíduo').filter((k) => k !== 'Situacao'), 'oculto');
for (const t of ['Meio', 'Podas e danos', 'Fitossanidade', 'Risco', 'Manejo', 'Fotos e observações']) set(MORTA, nomesAba(t), 'oculto');
const RAIOS = {}; set(RAIOS, [1, 2, 3, 4].map((k) => `Raio de copa ${k} (m)`), 'obrig'); RAIOS['Area de copa (m2)'] = 'mostrar'; RAIOS['Area de copa medida (m2)'] = 'oculto';
const AREA = {}; set(AREA, [1, 2, 3, 4].map((k) => `Raio de copa ${k} (m)`), 'oculto'); AREA['Area de copa (m2)'] = 'oculto'; AREA['Area de copa medida (m2)'] = 'obrig';
const NAOID = {}; set(NAOID, ['Foto folha face superior', 'Foto folha face inferior', 'Foto ramo filotaxia', 'Foto tronco detalhe'], 'obrig');
const form = {
  id: 'divinopolis-inventario', nome: 'Inventário de arborização viária (Divinópolis)', camada: 'divinopolis_arvores', versao: 6, campos: C, abas: A,
  gruposObrig: ['Fiação aérea', 'Interferência no tráfego', 'Podas', 'Danos', 'Raízes', 'Fitossanidade'],
  gruposConfirmar: [{ grupo: 'Manejo e mitigações', campo: 'Manejo nenhum', pergunta: 'Nenhum manejo foi marcado. Confirma que esta árvore não precisa de manejo?' }],
  especies: [{ cientifico: 'Não identificada', popular: 'espécie não identificada em campo' }, ...antigo.especies.filter((e) => e.cientifico !== 'Não identificada')],
  regras: [
    { campo: 'Categoria', por: { 1: VIVO, 2: VIVO, 3: VIVO, 5: CAL } },
    { campo: 'Modo de copa', por: { raios: RAIOS, area: AREA } },
    { campo: 'Especie', por: { 'Não identificada': NAOID } },
    { campo: 'Situacao', por: { Morta: MORTA } },
  ],
};
fs.writeFileSync(path.join(raiz, 'forms/divinopolis-inventario.json'), JSON.stringify(form, null, 1));
console.log(C.length, 'campos;', A.map((a) => a.nome + ':' + a.campos.length).join(' | '));
