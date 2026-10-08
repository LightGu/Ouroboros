const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('v28 executa e bloqueia brute force e dupla reivindicação', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('app.uid', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;

      create table public.perfis(id uuid primary key references auth.users, nome text not null, foto text);
      create table public.mesas(id uuid primary key, nome text not null default 'Mesa', mestre_id uuid references auth.users,
        codigo text not null unique, criado_em timestamptz default now());
      create table public.membros(mesa_id uuid references mesas, user_id uuid references auth.users,
        papel text not null, primary key(mesa_id,user_id));
      create table public.personagens(id uuid primary key, mesa_id uuid references mesas, dono_id uuid references auth.users,
        dados jsonb not null default '{}'::jsonb);
      create table public.anotacoes(id uuid primary key, mesa_id uuid, autor_id uuid, titulo text not null,
        texto text not null default '', etiquetas text[] not null default '{}', compartilhada boolean default false);
      create table public.mensagens(id bigint primary key, mesa_id uuid, de_user uuid, para_user uuid);

      create function public.eh_membro(m uuid) returns boolean language sql security definer stable set search_path=public as $$
        select exists(select 1 from membros where mesa_id=m and user_id=auth.uid())
      $$;
      create function public.eh_mestre(m uuid) returns boolean language sql security definer stable set search_path=public as $$
        select exists(select 1 from mesas where id=m and mestre_id=auth.uid())
      $$;
      create function public.minhas_mesas() returns setof uuid language sql as $$ select id from mesas where false $$;
      create function public.liberar_personagem(uuid) returns boolean language sql as $$ select false $$;
      create function public.liberar_contato(uuid,uuid) returns boolean language sql as $$ select false $$;
      create function public.novo_usuario() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.registrar_log() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.carimbar() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.bloquear_troca_mesa_personagem() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.validar_rolagem() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.proteger_token() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.carimbar_anotacao() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.proteger_identidade_anotacao() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.separar_historia_personagem() returns trigger language plpgsql as $$ begin return new; end $$;

      insert into auth.users(id,email) values
        ('00000000-0000-0000-0000-000000000001','a@x.test'),
        ('00000000-0000-0000-0000-000000000002','b@x.test');
      insert into perfis values ('00000000-0000-0000-0000-000000000001','A',null),
        ('00000000-0000-0000-0000-000000000002','B',null);
      insert into mesas values ('10000000-0000-0000-0000-000000000000','Mesa',
        '00000000-0000-0000-0000-000000000001','ABC123',now());
      insert into membros values ('10000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000001','mestre');
      insert into personagens values ('20000000-0000-0000-0000-000000000000',
        '10000000-0000-0000-0000-000000000000',null,'{}');
    `);
    await db.exec(fs.readFileSync('sql/migrations/v28-hardening-pre-lancamento.sql','utf8'));
    const codigo = (await db.query('select codigo from mesas')).rows[0].codigo;
    assert.match(codigo, /^[0-9A-F]{12}$/);

    await db.exec(`set role authenticated; set app.uid='00000000-0000-0000-0000-000000000002';`);
    for (let i=0;i<11;i++) {
      const r = await db.query("select public.entrar_na_mesa('000000000000') id");
      assert.equal(r.rows[0].id, null);
    }
    await db.exec('reset role;');
    assert.equal((await db.query('select quantidade from tentativas_entrada')).rows[0].quantidade, 11);
    await db.exec("update tentativas_entrada set janela=now()-interval '2 minutes'; set role authenticated; set app.uid='00000000-0000-0000-0000-000000000002';");
    assert.equal((await db.query(`select public.entrar_na_mesa('${codigo}') id`)).rows[0].id,
      '10000000-0000-0000-0000-000000000000');
    assert.equal((await db.query("select public.reivindicar_personagem('20000000-0000-0000-0000-000000000000','#112233') ok")).rows[0].ok, true);
    await assert.rejects(() => db.query("select public.reivindicar_personagem('20000000-0000-0000-0000-000000000000','#112233')"), /já tem dono/);
  } finally { await db.close(); }
});
