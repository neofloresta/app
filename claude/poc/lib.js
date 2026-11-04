// Utilitários da PoC: sobe servidores, configura projeto, gera bases fictícias
const { spawn, execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const APP = process.env.APP || path.join(__dirname, '../..');
const GS = process.env.GS || path.join(__dirname, '../../apps-script/Code.gs');
const MOCK = 'http://localhost:8790/'; const WEB = 'http://localhost:8765/';
const FORM = JSON.parse(fs.readFileSync(path.join(APP, 'forms/divinopolis-inventario.json'), 'utf8'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let senhaAdmin = null;

async function subir() {
  try { execSync('pkill -f "^node mock.js"'); } catch (e) {}
  try { execSync('pkill -f "http.server 8765"'); } catch (e) {}
  await espera(300);
  const web = spawn('python3', ['-m', 'http.server', '8765'], { cwd: APP, stdio: 'ignore', detached: true }); web.unref();
  const log = fs.openSync(path.join(__dirname, 'mock.log'), 'w');
  const m = spawn('node', ['mock.js', GS], { cwd: __dirname, stdio: ['ignore', log, log], detached: true }); m.unref();
  for (let i = 0; i < 50; i++) { await espera(150); try { await fetch(MOCK); await fetch(WEB); break; } catch (e) {} }
  senhaAdmin = fs.readFileSync(path.join(__dirname, 'senha.txt'), 'utf8').trim();
  return senhaAdmin;
}
async function post(acao, dados, u = 'admin', s = senhaAdmin) {
  const r = await fetch(MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao, u, s }, dados)) });
  const j = await r.json(); if (!j.ok) throw new Error(acao + ': ' + j.erro); return j;
}
async function configurar(projeto = 'divinopolis') {
  await post('formulario_salvar', { formulario: FORM });
  await post('projeto_salvar', { projeto_dados: { id: projeto, nome: 'PMAU Divinópolis', formulario: FORM.id, epsg: '' } });
  const us = [['div-1', 'equipe1', 'Equipe 1', 'coletor', 'E1'], ['div-2', 'equipe2', 'Equipe 2', 'coletor', 'E2'], ['outra', 'outra01', 'Outra cidade', 'coletor', 'OC']];
  for (const [login, senha, equipe, perfil, codigo] of us) await post('usuario_salvar', { usuario_dados: { login, senha, nome: equipe, perfil, projeto: login === 'outra' ? 'carmo' : projeto, equipe, codigo } });
  await post('projeto_salvar', { projeto_dados: { id: 'carmo', nome: 'Carmo do Rio Claro', formulario: FORM.id, epsg: '' } });
}
// Base fictícia no formato que o app grava na planilha
function cabecalho() {
  const c = ['uuid', 'projeto', 'equipe', 'usuario', 'criado_em', 'atualizado_em', 'latitude', 'longitude', 'precisao_gps_m'];
  for (const f of FORM.campos) { c.push(f.nome); if (f.tipo === 'photo') c.push(f.nome + ' link'); }
  return c;
}
function gerar(n, projeto = 'divinopolis', semente = 1) {
  let s = semente; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const esp = ['Moquilea tomentosa', 'Cenostigma pluviosum', 'Handroanthus chrysotrichus', 'Murraya paniculata', 'Ficus benjamina', 'Lagerstroemia indica', 'Mangifera indica', 'Terminalia catappa'];
  const linhas = [];
  for (let i = 0; i < n; i++) {
    const eq = i % 2 ? 'E2' : 'E1'; const d = new Date(Date.UTC(2026, 9, 1) + Math.floor(i / 90) * 86400000).toISOString();
    const l = { uuid: 'seed-' + i, projeto, equipe: eq === 'E1' ? 'Equipe 1' : 'Equipe 2', usuario: eq === 'E1' ? 'div-1' : 'div-2', criado_em: d, atualizado_em: d,
      latitude: -20.1436 + (rnd() - 0.5) * 0.06, longitude: -44.8908 + (rnd() - 0.5) * 0.06, precisao_gps_m: Math.round(2 + rnd() * 8) };
    for (const f of FORM.campos) {
      let v = '';
      if (f.auto === 'codigo') v = `${eq}-${String(Math.floor(i / 2) + 1).padStart(4, '0')}`;
      else if (f.tipo === 'choice') v = f.opcoes[Math.floor(rnd() * f.opcoes.length)].v;
      else if (f.tipo === 'bool') v = rnd() < 0.2 ? 1 : 0;
      else if (f.tipo === 'species') v = esp[Math.floor(rnd() * esp.length)];
      else if (f.tipo === 'number') v = Math.round(rnd() * 100) / 10;
      else if (f.tipo === 'multinumber') v = String(Math.round(5 + rnd() * 60));
      else if (f.tipo === 'photo') v = `DCIM/${eq}_${i}.jpg`;
      else if (f.tipo === 'datetime') v = d;
      else if (f.auto === 'coletor') v = eq;
      l[f.nome] = v; if (f.tipo === 'photo') l[f.nome + ' link'] = '';
    }
    // campos ocultos pela categoria ou situação ficam vazios, como no app
    for (const rg of FORM.regras || []) { const cfg = (rg.por || {})[String(l[rg.campo])]; if (!cfg) continue; for (const [nome, est] of Object.entries(cfg)) if (est === 'oculto') { const f = FORM.campos.find((c) => c.nome === nome); l[nome] = f && f.tipo === 'bool' ? 0 : ''; if (f && f.tipo === 'photo') l[nome + ' link'] = ''; } }
    if (rnd() < 0.85 && l['Categoria'] !== '4' && l['Categoria'] !== '5') l.Risco = 'Baixo';
    linhas.push(l);
  }
  return linhas;
}
async function semear(n, projeto = 'divinopolis') {
  const cab = cabecalho(); const todas = gerar(n, projeto);
  for (let i = 0; i < todas.length; i += 5000) {
    const r = await fetch(MOCK + '__seed', { method: 'POST', body: JSON.stringify({ projeto, cab, linhas: todas.slice(i, i + 5000) }) });
    await r.json();
  }
}
async function stats() { return (await fetch(MOCK + '__stats')).json(); }
async function falhar(acao, n) { await fetch(MOCK + '__falhar', { method: 'POST', body: JSON.stringify({ acao, n }) }); }

// Navegador com perfil de celular Android
async function celular(b, extra = {}) {
  const { devices } = require('playwright');
  const ctx = await b.newContext({ ...devices['Pixel 7'], geolocation: { latitude: -20.1436, longitude: -44.8908, accuracy: 4 }, permissions: ['geolocation'], locale: 'pt-BR', ...extra });
  const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message));
  return { ctx, p };
}
async function logar(p, u, s) {
  await p.goto(WEB); await p.waitForTimeout(400);
  if (await p.locator('text=Configurar servidor').count()) {
    await p.click('text=Configurar servidor'); await p.fill('.folha input', MOCK); await p.click('.folha >> text=Salvar'); await p.waitForTimeout(300);
  }
  await p.fill('input[placeholder=Usuário]', u); await p.fill('input[placeholder=Senha]', s); await p.click('text=Entrar');
  // primeiro acesso: aceita o termo de uso
  try { await p.waitForSelector('button:has-text("Li e aceito"), button.nova, .painel, .subabas', { timeout: 15000 }); } catch (e) { return; }
  if (await p.locator('button:has-text("Li e aceito")').count()) { await p.click('button:has-text("Li e aceito")'); await p.waitForTimeout(600); }
}
module.exports = { subir, post, configurar, semear, gerar, cabecalho, stats, falhar, celular, logar, espera, FORM, MOCK, WEB, APP, senha: () => senhaAdmin };
