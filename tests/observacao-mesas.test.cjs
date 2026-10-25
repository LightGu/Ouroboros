const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const ADMIN = '69cb076a-9966-4c6d-9719-0413ebfcd915';
const OUTRO = '00000000-0000-0000-0000-000000000002';

test('v33 lista e observa mesas alheias sem conceder escrita', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
      create table perfis(id uuid primary key, nome text);
      create table mesas(id uuid primary key, nome text, mestre_id uuid, sistema text, combate jsonb, criado_em timestamptz default now());
      create table personas(id uuid primary key, nome text);
      create table mensagens(id bigserial primary key, mesa_id uuid, de_user uuid, de_persona uuid,
        para_user uuid, para_persona uuid, texto text, criado_em timestamptz default now());
      create table personagens(id uuid primary key, mesa_id uuid, dono_id uuid, ordem int, rapido boolean,
        oculto boolean, dados jsonb, atualizado_em timestamptz default now(), atualizado_por uuid);
      create table notas_mestre(personagem_id uuid primary key, mesa_id uuid, texto text);
      create table historias_personagens(personagem_id uuid primary key, mesa_id uuid, texto text, personalidade text, objetivo text);
      insert into perfis values ('${ADMIN}','Admin'),('${OUTRO}','Outro mestre');
      insert into mesas values ('10000000-0000-0000-0000-000000000001','Minha','${ADMIN}','ouroboros','{}',now()),
        ('10000000-0000-0000-0000-000000000002','Alheia','${OUTRO}','dnd5e','{"ativo":false}',now());
      insert into personagens values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
        '${OUTRO}',0,false,true,'{"nome":"Ficha privada","fichaPrivada":true}',now(),null);
      insert into notas_mestre values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','nota secreta');
      insert into historias_personagens values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','história','personalidade','objetivo');
    `);
    await db.exec(fs.readFileSync('sql/migrations/v32-super-mestre.sql', 'utf8'));
    const v33 = fs.readFileSync('sql/migrations/v33-observacao-mesas.sql', 'utf8');
    await db.exec(v33); await db.exec(v33);
    await db.exec(`set app.uid='${ADMIN}'; set role authenticated;`);
    const lista = (await db.query('select nome,mestre_nome from listar_mesas_observacao()')).rows;
    assert.deepEqual(lista, [{ nome: 'Alheia', mestre_nome: 'Outro mestre' }]);
    const pacote = (await db.query(`select observar_mesa('10000000-0000-0000-0000-000000000002') dados`)).rows[0].dados;
    assert.equal(pacote.mesa.papel, 'observador');
    assert.equal(pacote.personagens[0].dados.nome, 'Ficha privada');
    assert.equal(pacote.personagens[0].notas, 'nota secreta');
    await assert.rejects(() => db.query(`update mesas set nome='Ataque'`), /permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int n from acessos_super_mestre where acao='observar_mesa'`)).rows[0].n, 1);
    await db.exec(`set app.uid='${OUTRO}'; set role authenticated;`);
    await assert.rejects(() => db.query('select * from listar_mesas_observacao()'), /Acesso administrativo negado/);
  } finally { await db.close(); }
});
