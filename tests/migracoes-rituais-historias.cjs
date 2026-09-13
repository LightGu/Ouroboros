/* PGLITE_PATH=/path/to/@electric-sql/pglite node tests/migracoes-rituais-historias.cjs */
const {PGlite} = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.mesas (id uuid primary key);
      create table public.personagens (id uuid primary key, mesa_id uuid references mesas(id), dono_id uuid, dados jsonb not null);
      grant select on public.personagens to authenticated;
      create function public.eh_membro(uuid) returns boolean language sql as $$ select auth.uid() in (
        '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid,
        '00000000-0000-0000-0000-000000000003'::uuid) $$;
      create function public.eh_mestre(uuid) returns boolean language sql as $$ select auth.uid() = '00000000-0000-0000-0000-000000000003'::uuid $$;
      insert into mesas values ('10000000-0000-0000-0000-000000000000');
      insert into personagens values ('20000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001',
        '{"descricao":{"historico":"história antiga","personalidade":"personalidade antiga","objetivo":"objetivo antigo","aparencia":"visível"}}');
    `);
    const migration = async name => db.exec(fs.readFileSync('sql/'+name, 'utf8'));
    await migration('v12-catalogo-itens.sql');
    await migration('v13-historias-privadas.sql');
    await migration('v18-catalogo-rituais.sql');
    await migration('v18-catalogo-rituais.sql');
    assert.equal((await db.query('select count(*)::int n from itens_catalogo')).rows[0].n,4);
    if (fs.existsSync('catalogo/seed-rituais.sql')) {
      const seed=fs.readFileSync('catalogo/seed-rituais.sql','utf8');
      await db.exec(seed); await db.exec(seed);
      assert.equal((await db.query('select count(*)::int n from rituais_catalogo')).rows[0].n,107);
    }
    await migration('v19-descricao-privada.sql');
    await migration('v19-descricao-privada.sql');
    let priv=(await db.query('select * from historias_personagens')).rows[0];
    assert.equal(priv.texto,'história antiga');assert.equal(priv.personalidade,'personalidade antiga');assert.equal(priv.objetivo,'objetivo antigo');
    assert.deepEqual((await db.query('select dados from personagens')).rows[0].dados.descricao,{aparencia:'visível'});
    await db.exec(`update personagens set dados=jsonb_set(dados,'{descricao,objetivo}','"objetivo novo"');`);
    priv=(await db.query('select * from historias_personagens')).rows[0];
    assert.equal(priv.texto,'história antiga');assert.equal(priv.personalidade,'personalidade antiga');assert.equal(priv.objetivo,'objetivo novo');
    await db.exec(`update personagens set dados=jsonb_set(dados,'{descricao,objetivo}','""');`);
    assert.equal((await db.query('select objetivo from historias_personagens')).rows[0].objetivo,'');
    const countAs = async uid => {
      await db.exec(`set role authenticated; set app.uid = '00000000-0000-0000-0000-00000000000${uid}';`);
      try { return (await db.query('select count(*)::int n from historias_personagens')).rows[0].n; }
      finally { await db.exec('reset role;'); }
    };
    assert.equal(await countAs(1),1);assert.equal(await countAs(2),0);assert.equal(await countAs(3),1);assert.equal(await countAs(4),0);
    await db.exec(`update personagens set dados=jsonb_set(dados,'{historiaPublica}','true');`);
    assert.equal(await countAs(2),1);assert.equal(await countAs(4),0);
    await db.exec(`update personagens set dados=jsonb_set(dados,'{historiaPublica}','false');`);
    assert.equal(await countAs(2),0);
    await db.exec('set role anon;');
    await assert.rejects(()=>db.query('select * from rituais_catalogo'),/permission denied/);
    await db.exec('reset role; set role authenticated;');
    await assert.rejects(()=>db.query("insert into rituais_catalogo (nome,elemento,circulo,livro,pagina) values ('x','medo',1,'x','1')"),/permission denied/);
    await assert.rejects(()=>db.query("update historias_personagens set objetivo='ataque'"),/permission denied/);
    await db.exec('reset role;');
    console.log('SQL: migrações e seed repetíveis, preservação, atualizações parciais, RLS e catálogo privado passaram.');
  } finally { await db.close(); }
})().catch(e => {console.error(e);process.exit(1);});
