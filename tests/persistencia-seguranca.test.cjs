const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('falha ao carregar notas privadas não vira conteúdo vazio', async () => {
  const code = fs.readFileSync('js/nuvem.js', 'utf8') + '\nthis.Nuvem = Nuvem;';
  const contexto = { window: {}, Store: {}, num: Number };
  vm.runInNewContext(code, contexto);

  const erro = new Error('notas indisponíveis');
  contexto.Nuvem.cliente = { from(tabela) {
    const resultado = tabela === 'personagens'
      ? { data: [], error: null }
      : { data: null, error: erro };
    const consulta = {
      select() { return this; }, eq() { return this; },
      order() { return Promise.resolve(resultado); },
      then(resolve, reject) { return Promise.resolve(resultado).then(resolve, reject); }
    };
    return consulta;
  }};

  await assert.rejects(contexto.Nuvem.carregarPersonagens('mesa', true), erro);
});

test('políticas impedem jogador de criar ficha sem dono ou ocultar ficha', () => {
  const sql = fs.readFileSync('sql/v24-seguranca-personagens.sql', 'utf8');
  assert.match(sql, /public\.eh_membro\(mesa_id\)/);
  assert.match(sql, /dono_id = auth\.uid\(\)/);
  assert.match(sql, /not rapido and not oculto/);
  assert.match(sql, /NEW\.mesa_id <> OLD\.mesa_id/);
});
