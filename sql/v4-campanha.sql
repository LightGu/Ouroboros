-- ============================================================
-- v4 — caderno de campanha do mestre (só ele lê, só ele escreve)
-- Os links entre anotações saem do próprio texto, no formato [[Título]],
-- então não existe tabela de arestas: o grafo é derivado na hora.
-- ============================================================

create table if not exists public.anotacoes (
  id             uuid primary key default gen_random_uuid(),
  mesa_id        uuid not null references public.mesas on delete cascade,
  tipo           text not null default 'Nota',
  titulo         text not null,
  texto          text not null default '',
  etiquetas      text[] not null default '{}',
  fixada         boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_anotacoes_mesa on public.anotacoes (mesa_id, atualizado_em desc);

-- título único por mesa (sem diferenciar maiúscula): é o que faz [[Fulano]]
-- apontar sempre pra uma anotação só
create unique index if not exists idx_anotacoes_titulo
  on public.anotacoes (mesa_id, lower(titulo));

alter table public.anotacoes enable row level security;

drop policy if exists anotacoes_mestre on public.anotacoes;
create policy anotacoes_mestre on public.anotacoes for all to authenticated
  using (public.eh_mestre(mesa_id)) with check (public.eh_mestre(mesa_id));

create or replace function public.carimbar_anotacao()
returns trigger language plpgsql as $$
begin
  NEW.atualizado_em := now();
  return NEW;
end $$;

drop trigger if exists trg_carimbar_anotacao on public.anotacoes;
create trigger trg_carimbar_anotacao
  before update on public.anotacoes
  for each row execute function public.carimbar_anotacao();

do $$
begin
  begin alter publication supabase_realtime add table public.anotacoes; exception when duplicate_object then null; end;
end $$;
