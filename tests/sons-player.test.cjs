const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contexto = {
  URL, console, document: { activeElement: null },
  $: () => null, $$: () => [], esc: String,
  num: (valor, padrao = 0) => Number(valor) || padrao,
  clearTimeout, setTimeout
};
vm.createContext(contexto);
const fonte = fs.readFileSync(path.resolve(__dirname, '../public/js/sons.js'), 'utf8');
vm.runInContext(`${fonte}\nglobalThis.__Sons = Sons;`, contexto);
const Sons = contexto.__Sons;

assert.equal(Sons.formatarTempo(0), '0:00');
assert.equal(Sons.formatarTempo(65.9), '1:05');
assert.equal(Sons.formatarTempo(3661), '1:01:01');
assert.equal(Sons.formatarTempo(Infinity), '0:00');

console.log('Sons: formatação da minutagem do mini player passou.');
