const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const campos = {
  '#sm-arq': { files: [], addEventListener() {} },
  '#sm-url': { value: ' https://cdn.exemplo.com/trilha.mp3 ' },
  '#sm-nome': { value: 'Tema do chefe' },
  '#sm-cat': { value: 'Combate' },
  '#sm-vol': { value: '0.65' },
  '#sm-loop': { checked: true },
  '[data-modal-ok]': { disabled: false, textContent: '' }
};
let modal;
let enviado = false;
let criado;
const contexto = {
  URL,
  console,
  App: { mesa: { id: 'mesa-1' }, faltaMigracao() {} },
  Modal: { abrir(opcoes) { modal = opcoes; } },
  Nuvem: {
    async enviarSom() { enviado = true; },
    async criarSom(som) { criado = { id: 'som-1', ...som }; return criado; }
  },
  $: seletor => campos[seletor],
  $$: () => [],
  esc: String,
  num: (valor, padrao = 0) => Number(valor) || padrao,
  toast() {},
  Audio: function () {},
  clearTimeout,
  setTimeout
};
vm.createContext(contexto);
const fonte = fs.readFileSync(path.resolve(__dirname, '../js/sons.js'), 'utf8');
vm.runInContext(`${fonte}\nglobalThis.__Sons = Sons;`, contexto);
const Sons = contexto.__Sons;
Sons.render = () => {};

assert.equal(Sons.urlAudio('javascript:alert(1)'), '');
assert.equal(Sons.urlAudio('arquivo.mp3'), '');
assert.equal(Sons.urlAudio(' https://cdn.exemplo.com/a.mp3 '), 'https://cdn.exemplo.com/a.mp3');

Sons.modalNovo();
assert.match(modal.corpo, /Link direto do áudio/);
assert.match(modal.corpo, /YouTube ou Spotify não funcionam/);

(async () => {
  await modal.onConfirmar();
  assert.equal(enviado, false, 'um link não deve ser reenviado ao Storage');
  assert.deepEqual(
    JSON.parse(JSON.stringify(criado)),
    {
      id: 'som-1', mesa_id: 'mesa-1', nome: 'Tema do chefe', categoria: 'Combate',
      arquivo: 'https://cdn.exemplo.com/trilha.mp3', caminho: null,
      volume: 0.65, loop: true, ordem: 0
    }
  );
  console.log('Sons: cadastro por link e validação de URL passaram.');
})().catch(erro => { console.error(erro); process.exit(1); });
