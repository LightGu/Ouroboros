const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');

const ADMIN = '69cb076a-9966-4c6d-9719-0413ebfcd915';
const OUTRO = '00000000-0000-0000-0000-000000000002';

test('v32 dá visão global somente ao UUID autorizado e audita o acesso', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
      create table perfis(id uuid primary key, nome text);
      create table mesas(id uuid primary key, nome text, mestre_id uuid);
      create table personas(id uuid primary key, nome text);
      create table mensagens(id bigserial primary key, mesa_id uuid, de_user uuid, de_persona uuid,
        para_user uuid, para_persona uuid, texto text, criado_em timestamptz default now());
      insert into perfis values ('${ADMIN}','Admin'),('${OUTRO}','Outro'),('00000000-0000-0000-0000-000000000003','Jogador');
      insert into mesas values ('10000000-0000-0000-0000-000000000001','Minha mesa','${ADMIN}'),
        ('10000000-0000-0000-0000-000000000002','Mesa alheia','${OUTRO}');
      insert into mensagens(mesa_id,de_user,para_user,texto) values
        ('10000000-0000-0000-0000-000000000001','${OUTRO}','00000000-0000-0000-0000-000000000003','mensagem própria'),
        ('10000000-0000-0000-0000-000000000002','${OUTRO}','00000000-0000-0000-0000-000000000003','mensagem global');
    `);
    const migration = fs.readFileSync('sql/migrations/v32-super-mestre.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);

    await db.exec(`set app.uid='${ADMIN}'; set role authenticated;`);
    assert.equal((await db.query('select sou_super_mestre() ok')).rows[0].ok, true);
    const mensagens = (await db.query('select mesa_nome,mesa_propria,texto from painel_super_mestre_mensagens() order by mesa_nome')).rows;
    assert.deepEqual(mensagens, [
      { mesa_nome: 'Mesa alheia', mesa_propria: false, texto: 'mensagem global' },
      { mesa_nome: 'Minha mesa', mesa_propria: true, texto: 'mensagem própria' }
    ]);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int n from acessos_super_mestre')).rows[0].n, 1);

    await db.exec(`set app.uid='${OUTRO}'; set role authenticated;`);
    assert.equal((await db.query('select sou_super_mestre() ok')).rows[0].ok, false);
    await assert.rejects(() => db.query('select * from painel_super_mestre_mensagens()'), /Acesso administrativo negado/);
  } finally { await db.close(); }
});
