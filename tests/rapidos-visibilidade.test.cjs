const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ console, document: { addEventListener() {} }, App: { sessao: { user: { id: 'jogador' } } } });
for (const file of ['dados', 'ui', 'store', 'mesa']) {
  vm.runInContext(fs.readFileSync(`public/js/${file}.js`, 'utf8'), ctx);
}
vm.runInContext('globalThis.S = Store; globalThis.M = Mesa;', ctx);
const { S, M } = ctx;
const p = Object.assign(S.fichaVazia(), {
  id: 'inimigo', rapido: true, nome: 'Criatura <sombria>', classe: 'Classe secreta',
  imagem: 'normal.jpg', imagemFerido: 'ferido.jpg', imagemCritica: 'critica.jpg',
  imagemInconsciente: 'inconsciente.jpg', notas: 'Nota secreta',
  condicoes: ['Inconsciente'], pv: { atual: 0, max: 987 },
  ataques: [{ nome: 'Ataque secreto', dano: '9d12', usaMunicao: true, municaoAtual: 3, pente: 7 }],
  bonus: { corpo: 2 }, aliados: [{ nome: 'Aliado secreto' }]
});
for (const ativo of [false, true]) {
  S.estado.combate = { ativo, indice: 0 };
  S.ehMestre = false;
  const publico = M.card(p, 0);
  assert.match(publico, /Criatura &lt;sombria&gt;/);
  assert.match(publico, /normal.jpg/);
  assert.doesNotMatch(publico, /987|Inconsciente|secreta|secreto|9d12|CAÍDO|abatido|ferido.jpg|critica.jpg|inconsciente.jpg|stat-barra|condicoes|data-abrir|data-menu|data-ajuste/);
  p.pv.atual = 987;
  p.condicoes = [];
  assert.equal(M.card(p, 0), publico, 'Alterar a vida e condições não muda o card público');
  p.pv.atual = 0;
  p.condicoes = ['Inconsciente'];
  S.ehMestre = true;
  const mestre = M.card(p, 0);
  for (const texto of ['987', 'Inconsciente', 'Nota secreta', 'Ataque secreto', 'CAÍDO', 'inconsciente.jpg', 'data-ajuste']) {
    assert.ok(mestre.includes(texto), `Mestre continua vendo ${texto}`);
  }
}
S.ehMestre = false;
p.rapido = false;
assert.match(M.card(p, 0), /stat-barra/);
p.rapido = true;
p.imagem = '';
assert.match(M.card(p, 0), /retrato-vazio/);
assert.doesNotMatch(M.card(p, 0), /<img/);
// Não grava PV no DOM nem dispara animações de dano/cura para jogadores.
S.estado.personagens = [p];
vm.runInContext(`
  const gridTeste = { innerHTML: '' };
  const cardTeste = { dataset: { id: 'inimigo' } };
  const retratoTeste = { dataset: {} };
  document.querySelector = sel => sel === '#grid' ? gridTeste : {};
  gridTeste.querySelectorAll = () => [cardTeste];
  cardTeste.querySelector = () => retratoTeste;
  animarVida = () => { throw Error('PV exposto pela animação'); };
  Mesa.renderTurno = () => {};
  Mesa.ligarDragAndDrop = () => {};
  Mesa.render();
`, ctx);
console.log('Personagens rápidos: privacidade do card, retrato e animação; mestre e fichas normais preservados.');
