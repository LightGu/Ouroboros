const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');

const ADMIN = '69cb076a-9966-4c6d-9719-0413ebfcd915';
const MESTRE = '00000000-0000-0000-0000-000000000002';
const J1 = '00000000-0000-0000-0000-000000000003';
const J2 = '00000000-0000-0000-0000-000000000004';
const MESA_ADMIN = '10000000-0000-0000-0000-000000000001';
const MESA_COMUM = '10000000-0000-0000-0000-000000000002';

test('v36 libera somente Mestre Principal que também é mestre da mesa', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
      create table mesas(id uuid primary key, mestre_id uuid);
      insert into mesas values ('${MESA_ADMIN}','${ADMIN}'),('${MESA_COMUM}','${MESTRE}');
      create table membros(mesa_id uuid, user_id uuid, primary key(mesa_id,user_id));
      insert into membros values
        ('${MESA_ADMIN}','${ADMIN}'),('${MESA_ADMIN}','${J1}'),('${MESA_ADMIN}','${J2}'),
        ('${MESA_COMUM}','${MESTRE}'),('${MESA_COMUM}','${J1}'),('${MESA_COMUM}','${J2}');
      create function eh_membro(p_mesa uuid) returns boolean language sql security definer as $$
        select exists(select 1 from membros where mesa_id=p_mesa and user_id=auth.uid()) $$;
      create function eh_mestre(p_mesa uuid) returns boolean language sql security definer as $$
        select exists(select 1 from mesas where id=p_mesa and mestre_id=auth.uid()) $$;
      create table super_mestres(user_id uuid primary key);
      insert into super_mestres values ('${ADMIN}');
      create function eh_super_mestre() returns boolean language sql security definer stable as $$
        select exists(select 1 from super_mestres where user_id=auth.uid()) $$;
      create table acessos_super_mestre(id bigserial primary key, user_id uuid, origem inet,
        acessado_em timestamptz default now(), acao text default 'mensagens', mesa_id uuid);
      create table mensagens(id bigserial primary key, mesa_id uuid, de_user uuid, de_persona uuid,
        para_user uuid, para_persona uuid, texto text, criado_em timestamptz default now());
      insert into mensagens(mesa_id,de_user,para_user,texto) values
        ('${MESA_ADMIN}','${J1}','${J2}','privada da mesa principal'),
        ('${MESA_COMUM}','${J1}','${J2}','privada da mesa comum');
      alter table mensagens enable row level security;
      grant select on mensagens to authenticated;
    `);
    await db.exec(fs.readFileSync('sql/migrations/v34-privacidade-mensagens-mestres.sql', 'utf8'));
    const migration = fs.readFileSync('sql/migrations/v36-mensagens-locais-mestre-principal.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);

    await db.exec(`set app.uid='${ADMIN}'; set role authenticated;`);
    assert.deepEqual((await db.query(`select texto from painel_super_mestre_mensagens_mesa('${MESA_ADMIN}')`)).rows,
      [{ texto: 'privada da mesa principal' }]);
    await assert.rejects(() => db.query(`select * from painel_super_mestre_mensagens_mesa('${MESA_COMUM}')`),
      /Acesso local do Mestre Principal negado/);

    await db.exec(`reset role; set app.uid='${MESTRE}'; set role authenticated;`);
    assert.equal((await db.query(`select count(*)::int n from mensagens where mesa_id='${MESA_COMUM}'`)).rows[0].n, 0);
    await assert.rejects(() => db.query(`select * from painel_super_mestre_mensagens_mesa('${MESA_COMUM}')`),
      /Acesso local do Mestre Principal negado/);

    await db.exec(`reset role; set app.uid='${J1}'; set role authenticated;`);
    await assert.rejects(() => db.query(`select * from painel_super_mestre_mensagens_mesa('${MESA_ADMIN}')`),
      /Acesso local do Mestre Principal negado/);
    await db.exec('reset role');
    const auditoria = (await db.query(`select acao,mesa_id from acessos_super_mestre where acao='mensagens_mesa'`)).rows;
    assert.deepEqual(auditoria, [{ acao: 'mensagens_mesa', mesa_id: MESA_ADMIN }]);
  } finally { await db.close(); }
});
