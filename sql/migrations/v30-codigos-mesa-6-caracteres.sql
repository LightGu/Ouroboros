-- v30 — códigos de convite de mesa voltam a ter 6 caracteres.

alter table public.mesas drop constraint if exists mesas_codigo_formato;

do $$
declare
  v_mesa record;
  v_codigo text;
begin
  for v_mesa in select id from public.mesas where codigo !~ '^[0-9A-F]{6}$' loop
    loop
      v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (select 1 from public.mesas where codigo = v_codigo);
    end loop;
    update public.mesas set codigo = v_codigo where id = v_mesa.id;
  end loop;
end $$;

alter table public.mesas add constraint mesas_codigo_formato check (codigo ~ '^[0-9A-F]{6}$');

create or replace function public.criar_mesa(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_codigo text; v_nome text;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  v_nome := coalesce(nullif(trim(p_nome), ''), 'Minha mesa');
  if length(v_nome) > 80 then raise exception 'Nome da mesa longo demais'; end if;
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.mesas where codigo = v_codigo);
  end loop;
  insert into public.mesas (nome, mestre_id, codigo)
  values (v_nome, auth.uid(), v_codigo) returning id into v_id;
  insert into public.membros (mesa_id, user_id, papel) values (v_id, auth.uid(), 'mestre');
  return v_id;
end $$;

create or replace function public.entrar_na_mesa(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mesa uuid; v_quantidade int; v_agora timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  insert into public.tentativas_entrada (user_id, janela, quantidade)
  values (auth.uid(), v_agora, 1)
  on conflict (user_id) do update set
    quantidade = case when tentativas_entrada.janela < v_agora - interval '1 minute'
                      then 1 else least(100, tentativas_entrada.quantidade + 1) end,
    janela = case when tentativas_entrada.janela < v_agora - interval '1 minute'
                  then v_agora else tentativas_entrada.janela end
  returning quantidade into v_quantidade;
  if v_quantidade > 10 or p_codigo is null or length(trim(p_codigo)) <> 6 then return null; end if;
  select id into v_mesa from public.mesas where codigo = upper(trim(p_codigo));
  if v_mesa is null then return null; end if;
  insert into public.membros (mesa_id, user_id, papel)
  values (v_mesa, auth.uid(), 'jogador') on conflict (mesa_id, user_id) do nothing;
  return v_mesa;
end $$;
