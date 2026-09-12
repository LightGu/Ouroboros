-- ============================================================
-- v12 — catálogo de itens (o popup "Do catálogo" no inventário da ficha)
--
-- A tabela é global: o catálogo é o mesmo para todas as mesas, ninguém
-- edita pelo site. Quem escreve é o dono do projeto, rodando o
-- catalogo/seed-itens.sql gerado por sql/gerar-catalogo.py.
--
-- Por que não é um arquivo JSON no site: são as estatísticas dos livros da
-- Jambô. Atrás do login, é a mesa consultando o material que comprou; como
-- arquivo público do Vercel, é distribuição. Daí o select ser só para
-- `authenticated` e não existir política de insert/update/delete — nem o
-- mestre escreve aqui pelo navegador.
-- ============================================================

create table if not exists public.itens_catalogo (
  id         bigint generated always as identity primary key,
  nome       text not null,
  grupo      text not null default 'Equipamento',   -- Arma, Munição, Explosivo, Proteção...
  categoria  smallint not null default 0,           -- 0 a IV, como no livro
  espacos    numeric(5,1) not null default 1,
  dano       text not null default '',
  critico    text not null default '',
  alcance    text not null default '',
  tipo_dano  text not null default '',
  descricao  text not null default '',
  livro      text not null default '',
  pagina     text not null default '',
  unique (nome, livro)
);

create index if not exists idx_catalogo_grupo on public.itens_catalogo (grupo, nome);

alter table public.itens_catalogo enable row level security;

drop policy if exists catalogo_ler on public.itens_catalogo;

-- só leitura, e só para quem está logado
create policy catalogo_ler on public.itens_catalogo
  for select to authenticated using (true);

-- confere (vai dar 0 até rodar o catalogo/seed-itens.sql)
select count(*) as itens_no_catalogo from public.itens_catalogo;
