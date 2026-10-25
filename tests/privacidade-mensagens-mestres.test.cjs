const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('mestre comum não recebe aba nem rota de moderação', () => {
  const app = fs.readFileSync('public/js/app.js', 'utf8');
  assert.match(app, /\$\('#aba-mensagens'\)\.hidden = true/);
  assert.match(app, /if \(tela === 'mensagens'\) return/);
  assert.doesNotMatch(app, /\$\('#aba-mensagens'\)\.hidden = !this\.ehMestre/);
});

test('RLS limita mestre comum a mensagens próprias ou de personas', () => {
  const migration = fs.readFileSync('sql/migrations/v34-privacidade-mensagens-mestres.sql', 'utf8');
  const schema = fs.readFileSync('sql/schema.sql', 'utf8');
  for (const sql of [migration, schema]) {
    assert.match(sql, /de_user = auth\.uid\(\)/);
    assert.match(sql, /para_user = auth\.uid\(\)/);
    assert.match(sql, /public\.eh_mestre\(mesa_id\)[\s\S]*de_persona is not null or para_persona is not null/);
    assert.doesNotMatch(sql, /and \(public\.eh_mestre\(mesa_id\) or de_user/);
  }
});
