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


test('mensagens, tokens e Storage ficam presos à mesa e ao proprietário', () => {
  const sql = fs.readFileSync('sql/v25-integridade-mensagens-tokens-storage.sql', 'utf8');
  assert.match(sql, /p\.mesa_id = mensagens\.mesa_id/);
  assert.match(sql, /mb\.mesa_id = mensagens\.mesa_id/);
  assert.match(sql, /revoke update on public\.mensagens from authenticated/);
  assert.match(sql, /Jogadores só podem mover o próprio token/);
  assert.match(sql, /v_mesa_mapa is distinct from NEW\.mesa_id/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[2\] = auth\.uid\(\)::text/);
  assert.match(sql, /bucket_id = 'sons' and public\.eh_mestre/);
});

test('uploads novos incluem a pasta do usuário', () => {
  const js = fs.readFileSync('js/nuvem.js', 'utf8');
  assert.match(js, /`\$\{mesaId\}\/\$\{dono\}\/\$\{personagemId\}/);
  assert.match(js, /`\$\{mesaId\}\/\$\{dono\}\/mapa-/);
});


test('anotações compartilhadas e leituras continuam limitadas à própria mesa', () => {
  const sql = fs.readFileSync('sql/v26-integridade-anotacoes-leituras.sql', 'utf8');
  assert.match(sql, /public\.eh_membro\(mesa_id\)[\s\S]*compartilhada/);
  assert.match(sql, /NEW\.mesa_id is distinct from OLD\.mesa_id/);
  assert.match(sql, /NEW\.autor_id is distinct from OLD\.autor_id/);
  assert.match(sql, /'u:' \|\| mb\.user_id::text = leituras\.chave/);
  assert.match(sql, /'p:' \|\| p\.id::text = leituras\.chave/);
});
