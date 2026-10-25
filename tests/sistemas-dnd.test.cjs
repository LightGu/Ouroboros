const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');

test('v31 preserva mesas antigas e cria mesas D&D', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('app.uid', true), '')::uuid
      $$;
      create table public.mesas (
        id uuid primary key default gen_random_uuid(), nome text not null, mestre_id uuid not null,
        codigo text not null unique, criado_em timestamptz not null default now(),
        combate jsonb not null default '{"ativo":false,"indice":0,"rodada":1}'::jsonb
      );
      create table public.membros (
        mesa_id uuid references mesas(id) on delete cascade, user_id uuid not null,
        papel text not null, primary key(mesa_id,user_id)
      );
      insert into mesas(nome,mestre_id,codigo) values
        ('Antiga','00000000-0000-0000-0000-000000000001','ABC123');
    `);
    const sql = fs.readFileSync('sql/migrations/v31-sistemas-dnd.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    assert.equal((await db.query(`select sistema from mesas where nome='Antiga'`)).rows[0].sistema, 'ouroboros');

    await db.exec(`set app.uid='00000000-0000-0000-0000-000000000001'; set role authenticated;`);
    await db.query(`select criar_mesa('Aventura','dnd5e')`);
    const novas = await db.query(`select nome,sistema,papel from minhas_mesas() where nome='Aventura'`);
    assert.deepEqual(novas.rows, [{ nome: 'Aventura', sistema: 'dnd5e', papel: 'mestre' }]);
    await assert.rejects(() => db.query(`select criar_mesa('Inválida','outro')`), /Sistema de RPG inválido/);
  } finally {
    await db.close();
  }
});
