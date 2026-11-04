const L = require('./lib');
(async () => {
  await L.subir(); await L.configurar();
  const t = async (nome, f) => { try { await f(); console.log(nome, 'PERMITIU'); } catch (e) { console.log(nome, 'BLOQUEOU:', e.message); } };
  await t('7.2 outra cidade lê Divinópolis', () => L.post('listar', { projeto: 'divinopolis' }, 'outra', 'outra001'));
  await t('7.2 outra cidade grava em Divinópolis', () => L.post('registro', { projeto: 'divinopolis', linha: { uuid: 'x' } }, 'outra', 'outra001'));
  await t('7.1 coletor lista usuários', () => L.post('usuarios_listar', {}, 'div-1', 'equipe01'));
  await t('7.1 coletor cria usuário', () => L.post('usuario_salvar', { usuario_dados: { login: 'hack', senha: '1' } }, 'div-1', 'equipe01'));
  await t('7.1 coletor altera formulário', () => L.post('formulario_salvar', { formulario: { id: 'x', campos: [] } }, 'div-1', 'equipe01'));
  let n = 0; for (let i = 0; i < 8; i++) { try { await L.post('login', {}, 'div-1', 'errada' + i); } catch (e) { n++; } }
  await t('7.5 login certo após 8 senhas erradas', () => L.post('login', {}, 'div-1', 'equipe01'));
  const us = await L.post('usuarios_listar', {}); console.log('7.5 senha guardada em texto puro:', us.usuarios.some((u) => u.senha === 'equipe01'));
  process.exit(0);
})();
