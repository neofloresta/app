// Converte um estilo do QGIS (.qml) + estrutura opcional do GeoPackage em formulário do app.
(function (root) {
  const Expr = root.Expr || (typeof require !== 'undefined' ? require('./expr.js') : null);

  // Acentuação só para exibição (os valores gravados não mudam)
  const ACENTOS = {
    avaliacao: 'avaliação', Avaliacao: 'Avaliação', Analise: 'Análise', analise: 'análise', individuo: 'indivíduo',
    Desequilibrio: 'Desequilíbrio', epicormicos: 'epicórmicos', epicormica: 'epicórmica', drastica: 'drástica', Inclinacao: 'Inclinação',
    Codominancia: 'Codominância', Raizes: 'Raízes', raizes: 'raízes', calcada: 'calçada', Area: 'Área', area: 'área',
    bifurcacao: 'bifurcação', protecao: 'proteção', ocupacao: 'ocupação', Remocao: 'Remoção', remocao: 'remoção',
    Restricao: 'Restrição', restricao: 'restrição', Condicoes: 'Condições', condicoes: 'condições', Improvavel: 'Improvável',
    Provavel: 'Provável', provavel: 'provável', Possivel: 'Possível', Consequencias: 'Consequências', Recomendacoes: 'Recomendações',
    mitigacoes: 'mitigações', Observacoes: 'Observações', epifitas: 'epífitas', Nivel: 'Nível', circulacao: 'circulação',
    interferencia: 'interferência', diferenciacao: 'diferenciação', Edificacao: 'Edificação', Projecao: 'Projeção',
    frequencia: 'frequência', nao: 'não', Medio: 'Médio', Comunicacao: 'Comunicação', Codigo: 'Código', codigo: 'código',
    arvore: 'árvore', Arvore: 'Árvore', Especie: 'Espécie', especie: 'espécie', Prazo: 'Prazo', Ocos: 'Ocos',
    Localizacao: 'Localização', localizacao: 'localização', Endereco: 'Endereço', endereco: 'endereço', Numero: 'Número', numero: 'número',
    Fitossanidade: 'Fitossanidade', Conflitos: 'Conflitos', eletrica: 'elétrica', Eletrica: 'Elétrica', Iluminacao: 'Iluminação',
    Distancia: 'Distância', distancia: 'distância', Situacao: 'Situação', situacao: 'situação', Manutencao: 'Manutenção', manutencao: 'manutenção',
    mapa: 'mapa', copa: 'copa', proximo: 'próximo', Proximo: 'Próximo', lessao: 'lesão', hospitalizacao: 'hospitalização',
    interrupcao: 'interrupção', obstrucao: 'obstrução', dificies: 'difíceis', propriedade: 'propriedade', transito: 'trânsito',
    trafego: 'tráfego', lesao: 'lesão', preocupacao: 'preocupação', Arvores: 'Árvores', arvores: 'árvores', ha: 'há', ja: 'já', ate: 'até', provavel_: 'provável', Pequena: 'Pequena', media: 'média', Media: 'Média',
  };
  function bonito(s) {
    if (s == null) return s;
    return String(s).replace(/[A-Za-z_]+/g, (w) => ACENTOS[w] || w).replace(/m2\b/g, 'm²').replace(/\s+/g, ' ').trim();
  }

  function slug(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function optionMap(optEl) {
    // <Option type="Map"> com filhos <Option name="..." value="..."/>
    const res = {};
    if (!optEl) return res;
    for (const o of Array.from(optEl.children)) {
      const n = o.getAttribute('name');
      if (o.getAttribute('type') === 'Map' || o.getAttribute('type') === 'List') res[n] = o;
      else res[n] = o.getAttribute('value');
    }
    return res;
  }

  function valueMapOptions(cfgOpt) {
    const out = [];
    const walk = (el) => {
      for (const o of Array.from(el.children)) {
        if (o.getAttribute('type') === 'Map') {
          for (const kv of Array.from(o.children)) {
            const label = kv.getAttribute('name'); const v = kv.getAttribute('value');
            if (v == null || v === '{2839923C-8B7D-419E-B84B-CA2FE9B80EC7}' || label === '<NULL>') continue;
            out.push({ v, t: bonito(label) });
          }
        } else if (o.children.length) walk(o);
      }
    };
    walk(cfgOpt);
    return out;
  }

  function convert(qmlText, opts) {
    opts = opts || {};
    const Parser = opts.DOMParser || root.DOMParser;
    const doc = new Parser().parseFromString(qmlText, 'text/xml');
    const q = doc.documentElement;
    const kid = (el, tag) => el && Array.from(el.children || el.childNodes || []).find((c) => c.tagName === tag);
    const kids = (el, tag) => el ? Array.from(el.children || []).filter((c) => c.tagName === tag) : [];

    const gp = opts.gpkg || null; // {table, cols:[{name,type}], valores:{campo:[...]}}
    const gtype = {}; if (gp) gp.cols.forEach((c) => (gtype[c.name] = (c.type || '').toUpperCase()));

    const aliases = {}; kids(kid(q, 'aliases'), 'alias').forEach((a) => { if (a.getAttribute('name')) aliases[a.getAttribute('field')] = a.getAttribute('name'); });
    const defaults = {}; kids(kid(q, 'defaults'), 'default').forEach((d) => { const e = d.getAttribute('expression'); if (e) defaults[d.getAttribute('field')] = { expr: e, update: d.getAttribute('applyOnUpdate') === '1' }; });
    const notnull = {}; kids(kid(q, 'constraints'), 'constraint').forEach((c) => { if (+c.getAttribute('notnull_strength') > 0) notnull[c.getAttribute('field')] = true; });
    const cexpr = {}; kids(kid(q, 'constraintExpressions'), 'constraint').forEach((c) => { if (c.getAttribute('exp')) cexpr[c.getAttribute('field')] = { exp: c.getAttribute('exp'), desc: c.getAttribute('desc') }; });

    const campos = []; const avisos = [];
    const fc = kid(q, 'fieldConfiguration');
    for (const f of kids(fc, 'field')) {
      const nome = f.getAttribute('name');
      if (nome === 'fid' || nome === 'geom' || nome === 'geometry') continue;
      const w = kid(f, 'editWidget'); const wt = w ? w.getAttribute('type') : 'TextEdit';
      const cfgOpt = w ? kid(kid(w, 'config'), 'Option') : null;
      const cfg = optionMap(cfgOpt);
      const gt = gtype[nome] || '';
      const c = { nome, rotulo: bonito(aliases[nome] || nome), tipo: 'text' };
      const n = slug(nome);
      if (wt === 'ValueMap') { c.tipo = 'choice'; c.opcoes = valueMapOptions(cfgOpt); }
      else if (wt === 'CheckBox') c.tipo = 'bool';
      else if (wt === 'ExternalResource') c.tipo = 'photo';
      else if (wt === 'DateTime') c.tipo = (cfg.field_format || '').includes('HH') || gt.includes('DATETIME') ? 'datetime' : 'date';
      else if (wt === 'Range') c.tipo = 'number';
      else if (wt === 'Hidden') c.tipo = 'hidden';
      else if (wt === 'ValueRelation') { c.tipo = 'text'; avisos.push(`"${nome}": lista vinculada (ValueRelation) virou texto livre.`); }
      else {
        if (/^(INTEGER|INT|MEDIUMINT|SMALLINT|TINYINT|REAL|DOUBLE|FLOAT)/.test(gt)) c.tipo = 'number';
        else if (gt === 'BOOLEAN') c.tipo = 'bool';
        else if (/^(cap|dap)\b/.test(n)) c.tipo = 'multinumber';
        else if (/especie/.test(n) || /^species/.test(n)) c.tipo = 'species';
        else if (cfg.IsMultiline === 'true') c.tipo = 'textarea';
        if (c.tipo === 'text' && /plaqueta|numero-da-arvore/.test(n)) c.incremento = true;
      }
      if (c.tipo === 'number' && /^(INTEGER|INT)/.test(gt)) c.inteiro = true;
      if (defaults[nome]) {
        const d = defaults[nome];
        if (/^\s*now\s*\(\s*\)\s*$/i.test(d.expr)) c.agora = true;
        else if (Expr && Expr.supported(d.expr)) { c.expr = d.expr; if (d.update || Expr.fields(d.expr).length) c.calculado = true; }
        else avisos.push(`"${nome}": expressão padrão não suportada, campo ficou manual.`);
      }
      if (c.tipo === 'datetime' && !c.expr) c.agora = true;
      if (notnull[nome]) c.obrigatorio = true;
      if (cexpr[nome]) avisos.push(`"${nome}": regra de validação "${cexpr[nome].exp}" não foi importada.`);
      c.armazenar = gt ? (gt === 'BOOLEAN' ? 'bool' : /^(INTEGER|INT)/.test(gt) ? 'int' : /^(REAL|DOUBLE|FLOAT)/.test(gt) ? 'real' : /DATE/.test(gt) ? gt.toLowerCase() : 'text') : (c.tipo === 'bool' ? 'bool' : c.tipo === 'number' ? 'real' : c.tipo === 'datetime' ? 'datetime' : 'text');
      campos.push(c);
    }

    // Abas do formulário
    const abas = []; const usados = new Set();
    const ae = kid(q, 'attributeEditorForm');
    const layout = (q.getElementsByTagName('editorlayout')[0] || {}).textContent;
    const porNome = Object.fromEntries(campos.map((c) => [c.nome, c]));
    function coletar(el, grupo, lista) {
      for (const ch of Array.from(el.children)) {
        if (ch.tagName === 'attributeEditorField') {
          const nm = ch.getAttribute('name');
          if (porNome[nm] && !usados.has(nm)) { usados.add(nm); lista.push(grupo ? { campo: nm, grupo } : { campo: nm }); }
          else if (!porNome[nm] && nm !== 'fid') avisos.push(`Item "${nm}" está no formulário mas não existe na tabela; foi ignorado.`);
        } else if (ch.tagName === 'attributeEditorContainer') coletar(ch, bonito(ch.getAttribute('name')), lista);
      }
    }
    if (ae && layout === 'tablayout') {
      for (const tab of Array.from(ae.children).filter((c) => c.tagName === 'attributeEditorContainer')) {
        const lista = []; coletar(tab, null, lista);
        abas.push({ nome: bonito(tab.getAttribute('name')), campos: lista });
      }
      const soltos = []; for (const ch of Array.from(ae.children)) if (ch.tagName === 'attributeEditorField' && porNome[ch.getAttribute('name')] && !usados.has(ch.getAttribute('name'))) { usados.add(ch.getAttribute('name')); soltos.push({ campo: ch.getAttribute('name') }); }
      if (soltos.length) abas.unshift({ nome: 'Geral', campos: soltos });
    }
    const resto = campos.filter((c) => !usados.has(c.nome) && c.tipo !== 'hidden');
    if (!abas.length) {
      for (let i = 0; i < resto.length; i += 8) abas.push({ nome: 'Parte ' + (i / 8 + 1), campos: resto.slice(i, i + 8).map((c) => ({ campo: c.nome })) });
    } else if (resto.length) abas.push({ nome: 'Outros', campos: resto.map((c) => ({ campo: c.nome })) });

    // Espécies a partir dos dados existentes
    let especies = [];
    const fEsp = campos.find((c) => c.tipo === 'species');
    if (fEsp && gp && gp.valores && gp.valores[fEsp.nome]) {
      const set = new Map();
      for (const v of gp.valores[fEsp.nome]) {
        if (v == null) continue; const s = String(v).replace(/\s+/g, ' ').trim();
        if (!s || /^(morta|morto|seca|n\/?i|indeterminada)$/i.test(s)) continue;
        set.set(s.toLowerCase(), s);
      }
      especies = [...set.values()].sort((a, b) => a.localeCompare(b)).map((s) => ({ cientifico: s, popular: '' }));
    }

    return {
      id: opts.id || slug(opts.nome || (gp && gp.table) || 'formulario'),
      nome: opts.nome || (gp && gp.table) || 'Formulário',
      camada: (gp && gp.table) || opts.id || 'arvores',
      versao: 1,
      campos, abas, especies, avisos,
    };
  }

  const Q2F = { convert, bonito, slug };
  root.Q2F = Q2F;
  if (typeof module !== 'undefined') module.exports = Q2F;
})(typeof window !== 'undefined' ? window : globalThis);
