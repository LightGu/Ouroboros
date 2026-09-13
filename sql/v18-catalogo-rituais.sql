-- Catálogo privado de rituais. Depois, importar catalogo/seed-rituais.sql.
begin;
create table if not exists public.rituais_catalogo (
  id bigint generated always as identity primary key,
  nome text not null,
  elemento text not null,
  elementos text[] not null default '{}',
  circulo smallint not null check (circulo between 1 and 4),
  execucao text not null default '',
  alcance text not null default '',
  alvo text not null default '',
  duracao text not null default '',
  resistencia text not null default '',
  descricao text not null default '',
  livro text not null,
  pagina text not null,
  unique (nome, livro)
);
alter table public.rituais_catalogo enable row level security;
revoke all on public.rituais_catalogo from anon, authenticated;
grant select on public.rituais_catalogo to authenticated;
drop policy if exists rituais_catalogo_ler on public.rituais_catalogo;
create policy rituais_catalogo_ler on public.rituais_catalogo
  for select to authenticated using (true);

-- Componentes básicos: categoria 0, um espaço por conjunto (Básico, p. 66–67).
insert into public.itens_catalogo (nome, grupo, categoria, espacos, livro, pagina, descricao)
select 'Componentes ritualísticos de ' || elemento, 'Itens paranormais', 0, 1,
  'Livro Básico', '66–67', 'Conjunto de componentes para conjurar rituais de ' || elemento || '. Medo não utiliza componentes ritualísticos.'
from unnest(array['Sangue', 'Morte', 'Conhecimento', 'Energia']) as elementos(elemento)
on conflict (nome, livro) do update set
  grupo = excluded.grupo, categoria = excluded.categoria, espacos = excluded.espacos,
  pagina = excluded.pagina, descricao = excluded.descricao;
commit;
