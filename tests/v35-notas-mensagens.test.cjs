const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');

const ADMIN = '69cb076a-9966-4c6d-9719-0413ebfcd915';
const MESTRE = '00000000-0000-0000-0000-000000000002';
const AUTOR = '00000000-0000-0000-0000-000000000003';
const LEITOR = '00000000-0000-0000-0000-000000000004';
const FORA = '00000000-0000-0000-0000-000000000005';
const MESA = '10000000-0000-0000-0000-000000000001';
const NOTA = '20000000-0000-0000-0000-000000000001';

async function banco() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${ADMIN}'),('${MESTRE}'),('${AUTOR}'),('${LEITOR}'),('${FORA}');
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('app.uid', true), '')::uuid
    $$;
    create table perfis(id uuid primary key, nome text);
    insert into perfis values ('${ADMIN}','Principal'),('${MESTRE}','Mestre comum'),
      ('${AUTOR}','Autora'),('${LEITOR}','Leitora'),('${FORA}','De fora');
    create table mesas(id uuid primary key, nome text, mestre_id uuid);
    insert into mesas values ('${MESA}','Mesa teste','${MESTRE}');
    create table membros(mesa_id uuid, user_id uuid, papel text, primary key(mesa_id,user_id));
    insert into membros values ('${MESA}','${MESTRE}','mestre'),('${MESA}','${AUTOR}','jogador'),('${MESA}','${LEITOR}','jogador');
    create function eh_membro(p_mesa uuid) returns boolean language sql security definer as $$
      select exists(select 1 from membros where mesa_id=p_mesa and user_id=auth.uid())
    $$;
    create function eh_mestre(p_mesa uuid) returns boolean language sql security definer as $$
      select exists(select 1 from mesas where id=p_mesa and mestre_id=auth.uid())
    $$;
    create table personas(id uuid primary key, nome text);
    create table mensagens(id bigserial primary key, mesa_id uuid, de_user uuid, de_persona uuid,
      para_user uuid, para_persona uuid, texto text, criado_em timestamptz default now());
    alter table mensagens enable row level security;
    grant select on mensagens to authenticated;
    insert into mensagens(mesa_id,de_user,para_user,texto) values
      ('${MESA}','${AUTOR}','${LEITOR}','segredo entre jogadores');
    create table anotacoes(
      id uuid primary key, mesa_id uuid references mesas(id), autor_id uuid references auth.users(id),
      tipo text default 'Nota', titulo text not null, texto text not null default '', etiquetas text[] default '{}',
      fixada boolean default false, compartilhada boolean default false,
      criado_em timestamptz default now(), atualizado_em timestamptz default now()
    );
    create unique index idx_anotacoes_titulo on anotacoes(mesa_id,autor_id,lower(titulo));
    alter table anotacoes enable row level security;
    create policy anot_ler on anotacoes for select to authenticated using
      (eh_membro(mesa_id) and (eh_mestre(mesa_id) or autor_id=auth.uid() or compartilhada));
    create policy anot_criar on anotacoes for insert to authenticated with check (autor_id=auth.uid() and eh_membro(mesa_id));
    create policy anot_mexer on anotacoes for update to authenticated using (autor_id=auth.uid());
    create policy anot_apagar on anotacoes for delete to authenticated using (autor_id=auth.uid());
    grant select,insert,update,delete on anotacoes to authenticated;
    insert into anotacoes(id,mesa_id,autor_id,titulo,texto) values
      ('${NOTA}','${MESA}','${AUTOR}','Alvo [x].+','texto da nota'),
      ('20000000-0000-0000-0000-000000000002','${MESA}','${AUTOR}','Referências',
       '[[Alvo [x].+]] [[Alvo [x].+#Seção]] [[Alvo [x].+|rótulo]] comum Alvo [x].+ [[Alvo [x].+ extra]]'),
      ('20000000-0000-0000-0000-000000000003','${MESA}','${LEITOR}','Outra autora','Veja [[Alvo [x].+|aqui]]');
  `);
  await db.exec(fs.readFileSync('sql/migrations/v32-super-mestre.sql', 'utf8'));
  await db.exec(fs.readFileSync('sql/migrations/v34-privacidade-mensagens-mestres.sql', 'utf8'));
  const v35 = fs.readFileSync('sql/migrations/v35-mensagens-e-compartilhamento-notas.sql', 'utf8');
  await db.exec(v35); await db.exec(v35);
  return db;
}

test('v35 mantém mensagens globais exclusivas do Mestre Principal', async () => {
  const db = await banco();
  try {
    await db.exec(`set app.uid='${ADMIN}'; set role authenticated;`);
    const msgs = (await db.query('select texto from painel_super_mestre_mensagens()')).rows;
    assert.deepEqual(msgs, [{ texto: 'segredo entre jogadores' }]);
    await db.exec('reset role');
    await db.exec(`set app.uid='${MESTRE}'; set role authenticated;`);
    assert.equal((await db.query('select count(*)::int n from mensagens')).rows[0].n, 0);
    await assert.rejects(() => db.query('select * from painel_super_mestre_mensagens()'), /Acesso administrativo negado/);
  } finally { await db.close(); }
});

test('compartilhamento seletivo usa RLS e não dá visão ao mestre comum', async () => {
  const db = await banco();
  try {
    await db.exec(`set app.uid='${AUTOR}'; set role authenticated;`);
    const ids = (await db.query(`select definir_compartilhamento_anotacao('${NOTA}', array['${LEITOR}'::uuid]) ids`)).rows[0].ids;
    assert.deepEqual(ids, [LEITOR]);
    await db.exec(`reset role; set app.uid='${LEITOR}'; set role authenticated;`);
    assert.equal((await db.query(`select count(*)::int n from anotacoes where id='${NOTA}'`)).rows[0].n, 1);
    await db.exec(`reset role; set app.uid='${MESTRE}'; set role authenticated;`);
    assert.equal((await db.query(`select count(*)::int n from anotacoes where id='${NOTA}'`)).rows[0].n, 0);
    await db.exec(`reset role; set app.uid='${FORA}'; set role authenticated;`);
    assert.equal((await db.query(`select count(*)::int n from anotacoes where id='${NOTA}'`)).rows[0].n, 0);
    await db.exec(`reset role; set app.uid='${ADMIN}'; set role authenticated;`);
    assert.equal((await db.query(`select count(*)::int n from anotacoes where id='${NOTA}'`)).rows[0].n, 1);
  } finally { await db.close(); }
});

test('rename transacional preserva alias e âncora sem tocar texto comum ou links parciais', async () => {
  const db = await banco();
  try {
    await db.exec(`set app.uid='${AUTOR}'; set role authenticated;`);
    await db.query(`select renomear_anotacao('${NOTA}', 'Novo (A+B)?')`);
    await db.exec('reset role');
    const rows = (await db.query(`select titulo,texto from anotacoes order by titulo`)).rows;
    assert.equal(rows.find(r => r.titulo === 'Novo (A+B)?').texto, 'texto da nota');
    assert.equal(rows.find(r => r.titulo === 'Referências').texto,
      '[[Novo (A+B)?]] [[Novo (A+B)?#Seção]] [[Novo (A+B)?|rótulo]] comum Alvo [x].+ [[Alvo [x].+ extra]]');
    assert.equal(rows.find(r => r.titulo === 'Outra autora').texto, 'Veja [[Novo (A+B)?|aqui]]');

    await db.exec(`set app.uid='${AUTOR}'; set role authenticated;`);
    await db.query(`select renomear_anotacao('${NOTA}', 'Novo (A+B)?')`);
    assert.equal((await db.query(`select texto from anotacoes where titulo='Referências'`)).rows[0].texto,
      '[[Novo (A+B)?]] [[Novo (A+B)?#Seção]] [[Novo (A+B)?|rótulo]] comum Alvo [x].+ [[Alvo [x].+ extra]]');
  } finally { await db.close(); }
});
