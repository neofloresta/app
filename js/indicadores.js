// Indicadores do painel. A mesma conta roda no servidor (Code.gs) e aqui (modo demonstração).
const Indicadores = (() => {
  function valorNum(v, multi) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return v;
    const ps = String(v).split(';').map((x) => parseFloat(String(x).replace(',', '.'))).filter((x) => isFinite(x));
    if (!ps.length) return null;
    return multi ? Math.sqrt(ps.reduce((a, b) => a + b * b, 0)) : ps[0];
  }
  function calcular(form, linhas, p) {
    const ativos = linhas.filter((l) => l.validacao !== 'Descartado');
    const conta = (arr, f) => { const m = {}; arr.forEach((l) => { const k = f(l); if (k === '' || k == null) return; m[k] = (m[k] || 0) + 1; }); return m; };
    const esp = form.campos.find((c) => c.tipo === 'species');
    const escolhas = {}; form.campos.filter((c) => c.tipo === 'choice').forEach((c) => (escolhas[c.nome] = conta(ativos, (l) => l[c.nome])));
    const marcados = {}; form.campos.filter((c) => c.tipo === 'bool').forEach((c) => (marcados[c.nome] = ativos.filter((l) => l[c.nome] === 1 || l[c.nome] === true || l[c.nome] === '1').length));
    const numeros = {}; form.campos.filter((c) => c.tipo === 'number' || c.tipo === 'multinumber' || c.armazenar === 'real').forEach((c) => {
      const vs = ativos.map((l) => valorNum(l[c.nome], c.tipo === 'multinumber')).filter((x) => x != null && isFinite(x));
      if (vs.length) { vs.sort((a, b) => a - b); numeros[c.nome] = { n: vs.length, min: vs[0], max: vs[vs.length - 1], media: vs.reduce((a, b) => a + b, 0) / vs.length, mediana: vs[Math.floor(vs.length / 2)] }; }
    });
    const dap = form.campos.find((c) => c.tipo === 'multinumber' && /dap/i.test(c.nome));
    const classesDap = dap ? (() => { const cl = [[0, 10], [10, 20], [20, 30], [30, 50], [50, 80], [80, 1e9]]; const vs = ativos.map((l) => valorNum(l[dap.nome], true)).filter((x) => x != null); return cl.map(([a, b]) => ({ de: a, ate: b === 1e9 ? null : b, n: vs.filter((v) => v >= a && v < b).length })); })() : [];
    const especies = esp ? Object.entries(conta(ativos, (l) => String(l[esp.nome] || '').trim())).sort((a, b) => b[1] - a[1]) : [];
    const diaBR = (iso) => { const x = new Date(iso); if (isNaN(x)) return String(iso || '').slice(0, 10); try { return x.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); } catch (e) { return String(iso).slice(0, 10); } };
    const porDia = {}; ativos.forEach((l) => { const d = l.criado_em ? diaBR(l.criado_em) : ''; if (!d) return; const e = l.equipe || '-'; porDia[d] = porDia[d] || {}; porDia[d][e] = (porDia[d][e] || 0) + 1; });
    const gps = ativos.map((l) => +l.precisao_gps_m).filter((x) => x > 0).sort((a, b) => a - b);
    return {
      gerado_em: new Date().toISOString(), projeto: p ? { id: p.id, nome: p.nome, contratante: p.contratante || '', contrato: p.contrato || '', municipio: p.municipio || '', meta: +p.meta || 0, responsavel: p.responsavel || '', registro_profissional: p.registro_profissional || '', art: p.art || '' } : null,
      total: ativos.length, descartados: linhas.length - ativos.length,
      validacao: conta(ativos, (l) => l.validacao || 'Pendente'), equipes: conta(ativos, (l) => l.equipe || '-'),
      escolhas, marcados, numeros, classesDap,
      especies: especies.slice(0, 40), nEspecies: especies.length, porDia,
      gps: gps.length ? { mediana: gps[Math.floor(gps.length / 2)], ate5m: gps.filter((x) => x <= 5).length / gps.length } : null,
      semCoordenada: ativos.filter((l) => l.latitude === '' || l.latitude == null).length,
    };
  }
  return { calcular, valorNum };
})();
if (typeof module !== 'undefined') module.exports = Indicadores;
