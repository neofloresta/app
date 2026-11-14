// Rotina LIBERAR VERSÃO: só publica se tudo passar.
// uso: node liberar.js   (na pasta claude/poc)
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const APP = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const res = []; const ok = (nome, passou, obs) => { res.push({ nome, passou, obs }); console.log(passou ? 'OK   ' : 'FALHA', nome, '|', obs); };

// 1. versões batem
const vApp = (ler('js/app.js').match(/VERSAO\s*=\s*'([\d.]+)'/) || [])[1];
const vJson = JSON.parse(ler('version.json')).versao;
const vSw = (ler('sw.js').match(/coleta-v([\d.]+)/) || [])[1];
ok('versões iguais (app, version.json, cache)', vApp && vApp === vJson && vJson === vSw, `app ${vApp}, version.json ${vJson}, cache ${vSw}`);
const notas = JSON.parse(ler('version.json')).notas || [];
ok('notas da versão preenchidas', notas.length > 0, notas.join(' / ').slice(0, 120));

// 2. sintaxe
for (const f of ['js/app.js', 'js/api.js', 'js/store.js', 'js/gpkg.js', 'js/arquivos.js', 'js/indicadores.js', 'js/utm.js', 'js/quadras.js', 'sw.js']) {
  if (!fs.existsSync(path.join(APP, f))) continue;
  try { execSync(`node --check ${path.join(APP, f)}`, { stdio: 'pipe' }); ok('sintaxe ' + f, true, 'ok'); } catch (e) { ok('sintaxe ' + f, false, String(e.stderr).slice(0, 200)); }
}

// 3. baterias de teste (uma de cada vez, mesmas portas)
const suites = [
  ['servidor', 'node srv.js', /(\d+) falha\(s\) de (\d+)/],
  ['servidor: ordens de serviço', 'node sos.js', /(\d+) falha\(s\) de (\d+)/],
  ['servidor: chave de integração e restauração', 'node skr.js', /(\d+) falha\(s\) de (\d+)/],
  ['servidor: quadras', 'node sqd.js', /(\d+) falha\(s\) de (\d+)/],
  ['servidor 2.10: times, auxiliar, prêmio por semana, chuva, vigência das regras, telas de outro perfil', 'node s210.js', /(\d+) falha\(s\) de (\d+)/],
  ['coleta e envio', 'node b12.js'],
  ['coordenação, cliente, exportação', 'node b47.js 3000'],
  ['mapa 5 mil', 'node b3.js 5000'],
  ['exportações 2 mil', 'node b5.js 2000'],
  ['permissões', 'node b7.js'],
  ['ordens de serviço nas telas', 'node bos.js'],
  ['pacote de entrega, chave e restauração nas telas', 'node b8.js'],
  ['quadras nas telas', 'node bqd.js'],
  ['servidor: faces de quadra', 'node sfc.js'],
  ['faces de quadra nas telas', 'node bfc.js'],
  ['formulário de Divinópolis (categorias, CAP, risco, ajuda)', 'node bf5.js'],
  ['rendimento por equipe e filtro de dia no mapa', 'node brend.js'],
  ['GPS parado, códigos em dois celulares, toque no ponto', 'node b9.js'],
  ['versão e atualização', 'node bv.js'],
  ['2.5.1: espécie letra por letra, mapa sem internet, toque fantasma, satélite', 'node b251.js'],
  ['2.6: marcação do ponto, trava de etapas, espécie, fotos no Wi-Fi, conferência, Hoje no campo, modo Sol', 'node b26.js'],
  ['2.6: termo por perfil com novo aceite, ajuda com busca e "?" nas telas', 'node b26b.js'],
  ['2.6: turno com trajeto e trajeto da equipe no mapa e no Hoje no campo', 'node b26c.js'],
  ['2.6: coordenação (menu agrupado, equipes em série, formulário que não perde o digitado, desativar, painel em abas, Desfazer na validação)', 'node b26d.js'],
  ['2.7: mapa primeiro, cancelar registro, risco com descrição, primeiro acesso em telas próprias', 'node b27.js'],
  ['2.7: pessoas, dupla do dia, árvore repetida, setores censitários, parceiro sem jornada', 'node b27e.js'],
  ['2.7: produção, prêmio, bônus, auditoria por setor e fechamento da medição', 'node b27f.js'],
  ['2.8: tela de coleta limpa, começar e encerrar o dia, sino, Meu dia e dupla fixa', 'node b28.js'],
  ['2.10: projetos da coordenação, times, usuário por perfil, turno do parceiro, chuva, Minha produção, auxiliar e painéis dos outros perfis', 'node b210.js'],
  ['estresse: 2 mil cadastros em 6 celulares (5 equipes), servidor lento, sem internet e quedas', 'node bstress.js 2000', null, { LATENCIA: '300', UI: '2' }],
  ['velocidade com servidor lento (1,5 s por consulta) e celular fraco', 'node perf.js', null, { LATENCIA: '1500', ROTULO: 'liberar' }],
];
for (const [nome, cmd, rx, env] of suites) {
  let out = ''; let erro = false;
  try { out = execSync(cmd, { cwd: __dirname, timeout: 600000, stdio: 'pipe', maxBuffer: 64e6, env: Object.assign({}, process.env, env || {}) }).toString(); } catch (e) { erro = true; out = String(e.stdout || '') + String(e.stderr || ''); }
  const falhas = out.split('\n').filter((l) => /FALHOU|^ERRO |PERMITIU|texto puro: true/.test(l));
  const pag = (out.match(/ERROS DE PÁGINA (.*)/) || [])[1];
  let passou = !erro && falhas.length === 0 && (!pag || /^\[\]( \[\])?$/.test(pag.trim()));
  if (rx) { const m = out.match(rx); passou = passou && m && m[1] === '0'; }
  const n = (out.match(/PASSOU/g) || []).length;
  ok('testes: ' + nome, passou, passou ? `${n || 'todos'} passaram` : (falhas.slice(0, 3).join(' || ') || out.slice(-300)).slice(0, 400));
}

const reprov = res.filter((r) => !r.passou);
fs.writeFileSync(path.join(__dirname, 'res-liberar.json'), JSON.stringify({ versao: vApp, em: new Date().toISOString(), resultado: res }, null, 1));
console.log('\n' + (reprov.length ? `NÃO LIBERAR: ${reprov.length} problema(s)` : `PODE SEGUIR para os agentes verificadores (versão ${vApp})`));
process.exit(reprov.length ? 1 : 0);
