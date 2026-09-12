-- ============================================================
-- v11 — tabela de sons
-- Última sobra do bloco v3, que abortou no meio. O bucket já foi criado
-- pela v10; falta a tabela que guarda nome, categoria, volume e ordem.
-- ============================================================

create table if not exists public.sons (
  id         uuid primary key default gen_random_uuid(),
  mesa_id    uuid not null references public.mesas on delete cascade,
  nome       text not null default 'Som',
  categoria  text not null default '',
  arquivo    text not null,
  caminho    text,                                   -- pra conseguir apagar do storage depois
  volume     real not null default 0.8,
  loop       boolean not null default false,
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_sons_mesa on public.sons (mesa_id, ordem);

alter table public.sons enable row level security;

drop policy if exists sons_ler   on public.sons;
drop policy if exists sons_mexer on public.sons;

-- o som toca só na máquina do mestre, então o acervo inteiro é dele.
-- (nome de som entrega spoiler: "Rugido do que mora no subsolo")
create policy sons_ler   on public.sons for select to authenticated using (public.eh_mestre(mesa_id));
create policy sons_mexer on public.sons for all    to authenticated
  using (public.eh_mestre(mesa_id)) with check (public.eh_mestre(mesa_id));

-- confere
select count(*) as sons_cadastrados from public.sons;
