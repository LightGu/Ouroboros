-- v28 — pré-lançamento: convite forte, rate limit, RPCs fechadas e reivindicação atômica.

create table if not exists public.tentativas_entrada (
  user_id uuid primary key references auth.users on delete cascade,
  janela timestamptz not null,
  quantidade smallint not null check (quantidade between 1 and 100)
);
alter table public.tentativas_entrada enable row level security;
revoke all on public.tentativas_entrada from anon, authenticated;

-- A troca invalida os códigos antigos de 24 bits.
update public.mesas set codigo = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where codigo !~ '^[0-9A-F]{12}$';
alter table public.mesas drop constraint if exists mesas_codigo_formato;
alter table public.mesas add constraint mesas_codigo_formato check (codigo ~ '^[0-9A-F]{12}$');

create or replace function public.criar_mesa(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_codigo text; v_nome text;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  v_nome := coalesce(nullif(trim(p_nome), ''), 'Minha mesa');
  if length(v_nome) > 80 then raise exception 'Nome da mesa longo demais'; end if;
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.mesas where codigo = v_codigo);
  end loop;
  insert into public.mesas (nome, mestre_id, codigo)
  values (v_nome, auth.uid(), v_codigo) returning id into v_id;
  insert into public.membros (mesa_id, user_id, papel) values (v_id, auth.uid(), 'mestre');
  return v_id;
end $$;

-- Retorna NULL em falhas para manter o contador gravado e não revelar se o código existe.
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
  if v_quantidade > 10 or p_codigo is null or length(trim(p_codigo)) <> 12 then return null; end if;
  select id into v_mesa from public.mesas where codigo = upper(trim(p_codigo));
  if v_mesa is null then return null; end if;
  insert into public.membros (mesa_id, user_id, papel)
  values (v_mesa, auth.uid(), 'jogador') on conflict (mesa_id, user_id) do nothing;
  return v_mesa;
end $$;

create or replace function public.reivindicar_personagem(p_id uuid, p_cor text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mesa uuid; v_alteradas int;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  select mesa_id into v_mesa from public.personagens where id = p_id;
  if v_mesa is null then raise exception 'Personagem não encontrado'; end if;
  if not public.eh_membro(v_mesa) then raise exception 'Você não está nesta mesa'; end if;
  if p_cor is not null and p_cor !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida'; end if;
  update public.personagens
     set dono_id = auth.uid(),
         dados = case when p_cor is null then dados else jsonb_set(dados, '{cor}', to_jsonb(p_cor)) end
   where id = p_id and dono_id is null;
  get diagnostics v_alteradas = row_count;
  if v_alteradas <> 1 then raise exception 'Este personagem já tem dono'; end if;
  return true;
end $$;

-- Perfis só são visíveis para a própria conta e pessoas que compartilham mesa.
create or replace function public.compartilha_mesa(outro uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select outro = auth.uid() or exists (
    select 1 from public.membros eu
    join public.membros pessoa on pessoa.mesa_id = eu.mesa_id
    where eu.user_id = auth.uid() and pessoa.user_id = outro
  );
$$;
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
using (public.compartilha_mesa(id));

-- Remover alguém da mesa também encerra o acesso ao histórico daquela mesa.
drop policy if exists msg_ler on public.mensagens;
create policy msg_ler on public.mensagens for select to authenticated
using (
  public.eh_membro(mesa_id)
  and (public.eh_mestre(mesa_id) or de_user = auth.uid() or para_user = auth.uid())
);

-- Limites de tamanho contra abuso de armazenamento por chamadas diretas à API.
alter table public.perfis drop constraint if exists perfis_nome_tamanho;
alter table public.perfis add constraint perfis_nome_tamanho
  check (length(trim(nome)) between 1 and 80 and (foto is null or octet_length(foto) <= 1000000));
alter table public.anotacoes drop constraint if exists anotacoes_tamanho;
alter table public.anotacoes add constraint anotacoes_tamanho
  check (length(trim(titulo)) between 1 and 200 and octet_length(texto) <= 1000000
         and cardinality(etiquetas) <= 50);
alter table public.personagens drop constraint if exists personagens_dados_tamanho;
alter table public.personagens add constraint personagens_dados_tamanho
  check (pg_column_size(dados) <= 2000000);

create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  v_nome := left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)), 80);
  insert into public.perfis (id, nome) values (new.id, v_nome) on conflict (id) do nothing;
  return new;
end $$;

-- v28 — PUBLIC inclui anon; a superfície RPC fica explicitamente autenticada.
revoke all on function public.novo_usuario() from public;
revoke all on function public.registrar_log() from public;
revoke all on function public.carimbar() from public;
revoke all on function public.bloquear_troca_mesa_personagem() from public;
revoke all on function public.validar_rolagem() from public;
revoke all on function public.proteger_token() from public;
revoke all on function public.carimbar_anotacao() from public;
revoke all on function public.proteger_identidade_anotacao() from public;
revoke all on function public.separar_historia_personagem() from public;
revoke all on function public.compartilha_mesa(uuid) from public;
revoke all on function public.eh_membro(uuid) from public;
revoke all on function public.eh_mestre(uuid) from public;
revoke all on function public.criar_mesa(text) from public;
revoke all on function public.entrar_na_mesa(text) from public;
revoke all on function public.minhas_mesas() from public;
revoke all on function public.reivindicar_personagem(uuid, text) from public;
revoke all on function public.liberar_personagem(uuid) from public;
revoke all on function public.liberar_contato(uuid, uuid) from public;
grant execute on function public.compartilha_mesa(uuid) to authenticated;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.eh_mestre(uuid) to authenticated;
grant execute on function public.criar_mesa(text) to authenticated;
grant execute on function public.entrar_na_mesa(text) to authenticated;
grant execute on function public.minhas_mesas() to authenticated;
grant execute on function public.reivindicar_personagem(uuid, text) to authenticated;
grant execute on function public.liberar_personagem(uuid) to authenticated;
grant execute on function public.liberar_contato(uuid, uuid) to authenticated;
