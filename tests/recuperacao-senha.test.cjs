const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('fluxo de recuperação preserva a conta e permite definir uma senha nova', () => {
  const html = ler('public/index.html');
  const nuvem = ler('public/js/nuvem.js');
  const telas = ler('public/js/telas.js');
  const app = ler('public/js/app.js');

  assert.match(html, /id="btn-esqueci-senha"/);
  assert.match(html, /id="view-recuperar"/);
  assert.match(html, /id="form-nova-senha"/);
  assert.match(html, /id="nova-senha"[^>]+minlength="10"/);
  assert.match(html, /id="confirmar-nova-senha"[^>]+minlength="10"/);

  assert.match(nuvem, /resetPasswordForEmail\(email\)/);
  assert.match(nuvem, /updateUser\(\{ password: senha \}\)/);
  assert.match(nuvem, /get\('type'\) === 'recovery'/);
  assert.match(telas, /senha !== confirmar/);
  assert.match(app, /retornoRecuperacao && sessao/);
  assert.match(app, /mostrar\('recuperar'\)/);
});
