-- v31 — sistema por mesa e suporte a Dungeons & Dragons 5e
-- Mesas existentes continuam como Ordem Paranormal.

begin;

alter table public.mesas
  add column if not exists sistema text not null default 'ouroboros';

alter table public.mesas drop constraint if exists mesas_sistema_check;
alter table public.mesas add constraint mesas_sistema_check
  check (sistema in ('ouroboros', 'dnd5e'));

drop function if exists public.criar_mesa(text);
drop function if exists public.criar_mesa(text, text);
create function public.criar_mesa(p_nome text, p_sistema text default 'ouroboros')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_codigo text; v_nome text; v_sistema text;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  v_nome := coalesce(nullif(trim(p_nome), ''), 'Minha mesa');
  if length(v_nome) > 80 then raise exception 'Nome da mesa longo demais'; end if;
  v_sistema := lower(coalesce(nullif(trim(p_sistema), ''), 'ouroboros'));
  if v_sistema not in ('ouroboros', 'dnd5e') then raise exception 'Sistema de RPG inválido'; end if;
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.mesas where codigo = v_codigo);
  end loop;
  insert into public.mesas (nome, mestre_id, codigo, sistema)
  values (v_nome, auth.uid(), v_codigo, v_sistema) returning id into v_id;
  insert into public.membros (mesa_id, user_id, papel) values (v_id, auth.uid(), 'mestre');
  return v_id;
end $$;

drop function if exists public.minhas_mesas();
create function public.minhas_mesas()
returns table (id uuid, nome text, codigo text, papel text, mestre_id uuid, combate jsonb, sistema text)
language sql security definer stable set search_path = public as $$
  select m.id, m.nome, m.codigo, mb.papel, m.mestre_id, m.combate, m.sistema
  from mesas m
  join membros mb on mb.mesa_id = m.id
  where mb.user_id = auth.uid()
  order by m.criado_em;
$$;

revoke all on function public.criar_mesa(text, text) from public;
revoke all on function public.minhas_mesas() from public;
grant execute on function public.criar_mesa(text, text) to authenticated;
grant execute on function public.minhas_mesas() to authenticated;

commit;
