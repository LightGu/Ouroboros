-- v32 — Mestre Principal global, com autorização no banco e auditoria

begin;

create table if not exists public.super_mestres (
  user_id uuid primary key,
  criado_em timestamptz not null default now()
);

insert into public.super_mestres (user_id)
values ('69cb076a-9966-4c6d-9719-0413ebfcd915'::uuid)
on conflict (user_id) do nothing;

create table if not exists public.acessos_super_mestre (
  id bigserial primary key,
  user_id uuid not null,
  acessado_em timestamptz not null default now(),
  origem inet
);

alter table public.super_mestres enable row level security;
alter table public.acessos_super_mestre enable row level security;
revoke all on public.super_mestres, public.acessos_super_mestre from anon, authenticated;

create or replace function public.eh_super_mestre()
returns boolean language sql security definer stable set search_path = public as $$
  select auth.uid() is not null
    and exists (select 1 from public.super_mestres sm where sm.user_id = auth.uid());
$$;

create or replace function public.sou_super_mestre()
returns boolean language sql security definer stable set search_path = public as $$
  select public.eh_super_mestre();
$$;

create index if not exists idx_mensagens_criado_em on public.mensagens (criado_em desc);

create or replace function public.painel_super_mestre_mensagens()
returns table (
  id bigint, mesa_id uuid, mesa_nome text, mesa_propria boolean,
  mestre_nome text, remetente text, destinatario text, texto text, criado_em timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_super_mestre() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;

  insert into public.acessos_super_mestre (user_id, origem)
  values (auth.uid(), inet_client_addr());

  return query
    select msg.id, ms.id, ms.nome, ms.mestre_id = auth.uid(),
      coalesce(pm.nome, 'Conta removida'),
      coalesce(pde.nome, ude.nome, 'Conta removida'),
      coalesce(ppa.nome, upa.nome, 'Conta removida'),
      msg.texto, msg.criado_em
    from public.mensagens msg
    join public.mesas ms on ms.id = msg.mesa_id
    left join public.perfis pm on pm.id = ms.mestre_id
    left join public.personas pde on pde.id = msg.de_persona
    left join public.perfis ude on ude.id = msg.de_user
    left join public.personas ppa on ppa.id = msg.para_persona
    left join public.perfis upa on upa.id = msg.para_user
    order by msg.criado_em desc;
end $$;

revoke all on function public.eh_super_mestre() from public;
revoke all on function public.sou_super_mestre() from public;
revoke all on function public.painel_super_mestre_mensagens() from public;
grant execute on function public.sou_super_mestre() to authenticated;
grant execute on function public.painel_super_mestre_mensagens() to authenticated;

commit;
