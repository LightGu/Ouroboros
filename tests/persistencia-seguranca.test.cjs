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


test('rolagens têm autoria do banco, limites e segredo exclusivo do mestre', () => {
  const sql = fs.readFileSync('sql/v27-integridade-rolagens.sql', 'utf8');
  assert.match(sql, /NEW\.autor_id := auth\.uid\(\)/);
  assert.match(sql, /NEW\.criado_em := now\(\)/);
  assert.match(sql, /NEW\.secreta and not public\.eh_mestre/);
  assert.match(sql, /cardinality\(NEW\.dados\) > 100/);
  assert.match(sql, /length\(trim\(NEW\.rotulo\)\) not between 1 and 200/);
});

test('versão publicada é 1.27 em todos os pontos', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const pacote = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(html, /class="app-versao">v1\.27</);
  assert.equal(pacote.version, '1.27.0');
});


test('pré-lançamento limita convites, abuso de volume e RPCs anônimas', () => {
  const sql = fs.readFileSync('sql/v28-hardening-pre-lancamento.sql', 'utf8');
  assert.match(sql, /1, 12/);
  assert.match(sql, /v_quantidade > 10/);
  assert.match(sql, /interval '1 minute'/);
  assert.match(sql, /revoke all on function public\.entrar_na_mesa\(text\) from public/);
  assert.match(sql, /where id = p_id and dono_id is null/);
  assert.match(sql, /get diagnostics v_alteradas = row_count/);
  assert.match(sql, /pg_column_size\(dados\) <= 2000000/);
});

test('produção usa CSP sem JavaScript inline', () => {
  const headers = fs.readFileSync('_headers', 'utf8');
  const fontes = fs.readFileSync('index.html', 'utf8') + fs.readFileSync('js/campanha.js', 'utf8');
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.doesNotMatch(headers, /script-src [^;]*'unsafe-inline'/);
  assert.doesNotMatch(fontes, /onclick=/);
});


test('perfis e mensagens exigem vínculo atual entre usuários', () => {
  const sql = fs.readFileSync('sql/v28-hardening-pre-lancamento.sql', 'utf8');
  assert.match(sql, /create policy perfis_ler[\s\S]*public\.compartilha_mesa\(id\)/);
  assert.match(sql, /join public\.membros pessoa on pessoa\.mesa_id = eu\.mesa_id/);
  assert.match(sql, /create policy msg_ler[\s\S]*public\.eh_membro\(mesa_id\)/);
  assert.match(sql, /revoke all on function public\.compartilha_mesa\(uuid\) from public/);
});
