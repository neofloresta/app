// Avaliador mínimo de expressões do QGIS usadas em valores padrão:
// "campo", 'texto', números, ||, + - * /, =, <>, !=, <, >, <=, >=, AND, OR, NOT,
// CASE WHEN ... THEN ... [ELSE ...] END, coalesce(), round(), to_real(), to_int(),
// upper(), lower(), trim(), now(), concat()
(function (root) {
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') j++; t.push({ k: 'field', v: src.slice(i + 1, j) }); i = j + 1; continue; }
      if (c === "'") { let j = i + 1, s = ''; while (j < src.length) { if (src[j] === "'" && src[j + 1] === "'") { s += "'"; j += 2; continue; } if (src[j] === "'") break; s += src[j++]; } t.push({ k: 'str', v: s }); i = j + 1; continue; }
      if (/[0-9]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; t.push({ k: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue; }
      const two = src.substr(i, 2);
      if (['||', '<>', '!=', '<=', '>='].includes(two)) { t.push({ k: 'op', v: two }); i += 2; continue; }
      if ('=<>+-*/(),'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++; const w = src.slice(i, j); t.push({ k: 'word', v: w.toUpperCase(), raw: w }); i = j; continue; }
      throw new Error('Caractere inesperado: ' + c);
    }
    return t;
  }

  function parse(src) {
    const t = tokenize(src); let p = 0;
    const peek = () => t[p], next = () => t[p++];
    const isW = (w) => peek() && peek().k === 'word' && peek().v === w;
    const isO = (o) => peek() && peek().k === 'op' && peek().v === o;
    function expect(kind, v) { const x = next(); if (!x || x.k !== kind || (v && x.v !== v)) throw new Error('Esperado ' + (v || kind)); return x; }
    function pOr() { let l = pAnd(); while (isW('OR')) { next(); l = { t: 'or', l, r: pAnd() }; } return l; }
    function pAnd() { let l = pNot(); while (isW('AND')) { next(); l = { t: 'and', l, r: pNot() }; } return l; }
    function pNot() { if (isW('NOT')) { next(); return { t: 'not', e: pNot() }; } return pCmp(); }
    function pCmp() {
      let l = pCat();
      while (peek() && peek().k === 'op' && ['=', '<>', '!=', '<', '>', '<=', '>='].includes(peek().v)) { const o = next().v; l = { t: 'cmp', o, l, r: pCat() }; }
      if (isW('IS')) { next(); let neg = false; if (isW('NOT')) { next(); neg = true; } expect('word', 'NULL'); l = { t: 'isnull', e: l, neg }; }
      return l;
    }
    function pCat() { let l = pAdd(); while (isO('||')) { next(); l = { t: 'cat', l, r: pAdd() }; } return l; }
    function pAdd() { let l = pMul(); while (isO('+') || isO('-')) { const o = next().v; l = { t: 'ar', o, l, r: pMul() }; } return l; }
    function pMul() { let l = pUn(); while (isO('*') || isO('/')) { const o = next().v; l = { t: 'ar', o, l, r: pUn() }; } return l; }
    function pUn() { if (isO('-')) { next(); return { t: 'ar', o: '-', l: { t: 'lit', v: 0 }, r: pUn() }; } return pPrim(); }
    function pPrim() {
      const x = next(); if (!x) throw new Error('Fim inesperado');
      if (x.k === 'field') return { t: 'field', v: x.v };
      if (x.k === 'str' || x.k === 'num') return { t: 'lit', v: x.v };
      if (x.k === 'op' && x.v === '(') { const e = pOr(); expect('op', ')'); return e; }
      if (x.k === 'word') {
        if (x.v === 'NULL') return { t: 'lit', v: null };
        if (x.v === 'TRUE') return { t: 'lit', v: true };
        if (x.v === 'FALSE') return { t: 'lit', v: false };
        if (x.v === 'CASE') {
          const ws = []; let el = null;
          while (isW('WHEN')) { next(); const c = pOr(); expect('word', 'THEN'); ws.push([c, pOr()]); }
          if (isW('ELSE')) { next(); el = pOr(); }
          expect('word', 'END'); return { t: 'case', ws, el };
        }
        if (isO('(')) { next(); const args = []; if (!isO(')')) { args.push(pOr()); while (isO(',')) { next(); args.push(pOr()); } } expect('op', ')'); return { t: 'fn', n: x.v.toLowerCase(), args }; }
        return { t: 'field', v: x.raw };
      }
      throw new Error('Expressão inválida');
    }
    const ast = pOr(); if (p < t.length) throw new Error('Sobrou texto na expressão');
    return ast;
  }

  function ev(n, get) {
    switch (n.t) {
      case 'lit': return n.v;
      case 'field': { const v = get(n.v); return v === undefined || v === '' ? null : v; }
      case 'cat': { const a = ev(n.l, get), b = ev(n.r, get); return a === null || b === null ? null : String(a) + String(b); }
      case 'ar': { const a = ev(n.l, get), b = ev(n.r, get); if (a === null || b === null) return null; const x = +String(a).replace(',', '.'), y = +String(b).replace(',', '.'); return n.o === '+' ? x + y : n.o === '-' ? x - y : n.o === '*' ? x * y : y === 0 ? null : x / y; }
      case 'cmp': { const a = ev(n.l, get), b = ev(n.r, get); if (a === null || b === null) return null; const num = typeof a === 'number' || typeof b === 'number'; const x = num ? +a : String(a), y = num ? +b : String(b); switch (n.o) { case '=': return x == y; case '<>': case '!=': return x != y; case '<': return x < y; case '>': return x > y; case '<=': return x <= y; default: return x >= y; } }
      case 'isnull': { const v = ev(n.e, get); return n.neg ? v !== null : v === null; }
      case 'and': return !!ev(n.l, get) && !!ev(n.r, get);
      case 'or': return !!ev(n.l, get) || !!ev(n.r, get);
      case 'not': return !ev(n.e, get);
      case 'case': { for (const [c, r] of n.ws) if (ev(c, get) === true) return ev(r, get); return n.el ? ev(n.el, get) : null; }
      case 'fn': {
        const a = n.args.map((x) => ev(x, get));
        switch (n.n) {
          case 'coalesce': return a.find((v) => v !== null) ?? null;
          case 'concat': return a.map((v) => v ?? '').join('');
          case 'round': return a[0] === null ? null : +(+a[0]).toFixed(a[1] || 0);
          case 'to_real': return a[0] === null ? null : parseFloat(String(a[0]).replace(',', '.'));
          case 'to_int': return a[0] === null ? null : parseInt(a[0], 10);
          case 'upper': return a[0] === null ? null : String(a[0]).toUpperCase();
          case 'lower': return a[0] === null ? null : String(a[0]).toLowerCase();
          case 'trim': return a[0] === null ? null : String(a[0]).trim();
          case 'now': return new Date().toISOString();
          default: throw new Error('Função não suportada: ' + n.n);
        }
      }
    }
    return null;
  }

  function fieldsOf(n, out = new Set()) {
    if (!n || typeof n !== 'object') return out;
    if (n.t === 'field') out.add(n.v);
    for (const k of ['l', 'r', 'e', 'el']) if (n[k]) fieldsOf(n[k], out);
    if (n.ws) n.ws.forEach(([c, r]) => { fieldsOf(c, out); fieldsOf(r, out); });
    if (n.args) n.args.forEach((x) => fieldsOf(x, out));
    return out;
  }

  const cache = new Map();
  function compile(src) { if (!cache.has(src)) cache.set(src, parse(src)); return cache.get(src); }
  const Expr = {
    parse, compile,
    evaluate(src, get) { return ev(compile(src), get); },
    fields(src) { return [...fieldsOf(compile(src))]; },
    supported(src) { try { parse(src); return true; } catch (e) { return false; } },
  };
  root.Expr = Expr;
  if (typeof module !== 'undefined') module.exports = Expr;
})(typeof window !== 'undefined' ? window : globalThis);
