-- v29 — saldos e histórico financeiro dos personagens
begin;

create table if not exists public.configuracoes_financeiras (
  mesa_id uuid primary key references public.mesas on delete cascade,
  verba_diaria_centavos bigint not null default 10000
    check (verba_diaria_centavos between 0 and 100000000000)
);

create table if not exists public.saldos_personagens (
  personagem_id uuid primary key references public.personagens on delete cascade,
  mesa_id uuid not null references public.mesas on delete cascade,
  saldo_centavos bigint not null default 0 check (saldo_centavos >= 0),
  atualizado_em timestamptz not null default now(),
  unique (personagem_id, mesa_id)
);
create index if not exists idx_saldos_personagens_mesa
  on public.saldos_personagens (mesa_id);

create table if not exists public.operacoes_financeiras (
  id uuid primary key,
  mesa_id uuid not null references public.mesas on delete cascade,
  tipo text not null check (tipo in ('verba_diaria', 'desconto_coletivo', 'ajuste_individual')),
  valor_centavos bigint not null check (valor_centavos <> 0),
  motivo text,
  autor_id uuid not null references auth.users on delete restrict,
  afetados integer not null default 0 check (afetados >= 0),
  criado_em timestamptz not null default now(),
  check (motivo is null or length(motivo) <= 500)
);
create index if not exists idx_operacoes_financeiras_mesa
  on public.operacoes_financeiras (mesa_id, criado_em desc);

create table if not exists public.transacoes_financeiras (
  id bigserial primary key,
  operacao_id uuid not null references public.operacoes_financeiras on delete restrict,
  mesa_id uuid not null references public.mesas on delete cascade,
  personagem_id uuid references public.personagens on delete set null,
  personagem_nome text not null,
  valor_centavos bigint not null check (valor_centavos <> 0),
  saldo_apos_centavos bigint not null check (saldo_apos_centavos >= 0),
  motivo text,
  responsavel_id uuid references auth.users on delete set null,
  responsavel_nome text not null,
  criado_em timestamptz not null default now(),
  unique (operacao_id, personagem_id)
);
create index if not exists idx_transacoes_financeiras_mesa
  on public.transacoes_financeiras (mesa_id, criado_em desc);

alter table public.configuracoes_financeiras enable row level security;
alter table public.saldos_personagens enable row level security;
alter table public.operacoes_financeiras enable row level security;
alter table public.transacoes_financeiras enable row level security;

drop policy if exists configuracoes_financeiras_ler on public.configuracoes_financeiras;
create policy configuracoes_financeiras_ler on public.configuracoes_financeiras
  for select to authenticated using (public.eh_mestre(mesa_id));

drop policy if exists saldos_personagens_ler on public.saldos_personagens;
create policy saldos_personagens_ler on public.saldos_personagens
  for select to authenticated using (
    public.eh_mestre(mesa_id) or exists (
      select 1 from public.personagens p
      where p.id = saldos_personagens.personagem_id
        and p.mesa_id = saldos_personagens.mesa_id and p.dono_id = auth.uid()
    )
  );

drop policy if exists operacoes_financeiras_ler on public.operacoes_financeiras;
create policy operacoes_financeiras_ler on public.operacoes_financeiras
  for select to authenticated using (public.eh_mestre(mesa_id));

drop policy if exists transacoes_financeiras_ler on public.transacoes_financeiras;
create policy transacoes_financeiras_ler on public.transacoes_financeiras
  for select to authenticated using (public.eh_mestre(mesa_id));

-- As tabelas são somente leitura para o cliente. Toda escrita passa pelas RPCs
-- SECURITY DEFINER, que repetem a autorização e executam o lote numa transação.
revoke all on public.configuracoes_financeiras, public.saldos_personagens,
  public.operacoes_financeiras, public.transacoes_financeiras from anon;
revoke insert, update, delete on public.configuracoes_financeiras, public.saldos_personagens,
  public.operacoes_financeiras, public.transacoes_financeiras from authenticated;
grant select on public.configuracoes_financeiras, public.saldos_personagens,
  public.operacoes_financeiras, public.transacoes_financeiras to authenticated;

create or replace function public.configurar_verba_diaria(p_mesa uuid, p_valor_centavos bigint)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_mestre(p_mesa) then raise exception 'Apenas o mestre pode configurar a verba'; end if;
  if p_valor_centavos is null or p_valor_centavos < 0 or p_valor_centavos > 100000000000 then
    raise exception 'Valor de verba inválido';
  end if;
  insert into public.configuracoes_financeiras (mesa_id, verba_diaria_centavos)
  values (p_mesa, p_valor_centavos)
  on conflict (mesa_id) do update set verba_diaria_centavos = excluded.verba_diaria_centavos;
  return p_valor_centavos;
end $$;

create or replace function public.aplicar_verba_diaria(
  p_mesa uuid, p_motivo text, p_operacao uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_valor bigint; v_afetados integer; v_autor_nome text; v_existente public.operacoes_financeiras%rowtype;
begin
  if not public.eh_mestre(p_mesa) then raise exception 'Apenas o mestre pode adicionar verba'; end if;
  if p_operacao is null then raise exception 'Identificador da operação ausente'; end if;
  if length(coalesce(p_motivo, '')) > 500 then raise exception 'Motivo longo demais'; end if;
  perform 1 from public.mesas where id = p_mesa for update;
  select * into v_existente from public.operacoes_financeiras where id = p_operacao;
  if found then
    if v_existente.mesa_id <> p_mesa or v_existente.tipo <> 'verba_diaria' then
      raise exception 'Identificador já usado em outra operação';
    end if;
    return jsonb_build_object('afetados', v_existente.afetados, 'valor_centavos', v_existente.valor_centavos, 'duplicada', true);
  end if;
  insert into public.configuracoes_financeiras (mesa_id) values (p_mesa) on conflict do nothing;
  select verba_diaria_centavos into v_valor from public.configuracoes_financeiras where mesa_id = p_mesa;
  if v_valor <= 0 then raise exception 'Configure uma verba maior que zero'; end if;
  select coalesce(nome, 'Mestre') into v_autor_nome from public.perfis where id = auth.uid();
  insert into public.operacoes_financeiras (id, mesa_id, tipo, valor_centavos, motivo, autor_id)
  values (p_operacao, p_mesa, 'verba_diaria', v_valor, nullif(trim(p_motivo), ''), auth.uid());
  insert into public.saldos_personagens (personagem_id, mesa_id, saldo_centavos)
    select id, mesa_id, 0 from public.personagens where mesa_id = p_mesa and not rapido
    on conflict (personagem_id) do nothing;
  with alterados as (
    update public.saldos_personagens s set saldo_centavos = s.saldo_centavos + v_valor, atualizado_em = now()
    from public.personagens p where p.id = s.personagem_id and p.mesa_id = p_mesa and not p.rapido
    returning s.personagem_id, s.saldo_centavos, p.dados->>'nome' as nome
  ), gravados as (
    insert into public.transacoes_financeiras
      (operacao_id, mesa_id, personagem_id, personagem_nome, valor_centavos, saldo_apos_centavos, motivo, responsavel_id, responsavel_nome)
    select p_operacao, p_mesa, personagem_id, coalesce(nullif(nome, ''), 'Sem nome'), v_valor,
      saldo_centavos, nullif(trim(p_motivo), ''), auth.uid(), coalesce(v_autor_nome, 'Mestre') from alterados
    returning 1
  ) select count(*) into v_afetados from gravados;
  update public.operacoes_financeiras set afetados = v_afetados where id = p_operacao;
  return jsonb_build_object('afetados', v_afetados, 'valor_centavos', v_valor, 'duplicada', false);
end $$;

create or replace function public.descontar_todos(
  p_mesa uuid, p_valor_centavos bigint, p_motivo text, p_operacao uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_afetados integer; v_insuficientes text; v_autor_nome text; v_existente public.operacoes_financeiras%rowtype;
begin
  if not public.eh_mestre(p_mesa) then raise exception 'Apenas o mestre pode descontar dinheiro'; end if;
  if p_valor_centavos is null or p_valor_centavos <= 0 or p_valor_centavos > 100000000000 then raise exception 'Valor inválido'; end if;
  if p_operacao is null then raise exception 'Identificador da operação ausente'; end if;
  if length(coalesce(p_motivo, '')) > 500 then raise exception 'Motivo longo demais'; end if;
  perform 1 from public.mesas where id = p_mesa for update;
  select * into v_existente from public.operacoes_financeiras where id = p_operacao;
  if found then
    if v_existente.mesa_id <> p_mesa or v_existente.tipo <> 'desconto_coletivo' or v_existente.valor_centavos <> -p_valor_centavos then
      raise exception 'Identificador já usado em outra operação';
    end if;
    return jsonb_build_object('afetados', v_existente.afetados, 'valor_centavos', p_valor_centavos, 'duplicada', true);
  end if;
  insert into public.saldos_personagens (personagem_id, mesa_id, saldo_centavos)
    select id, mesa_id, 0 from public.personagens where mesa_id = p_mesa and not rapido
    on conflict (personagem_id) do nothing;
  select string_agg(coalesce(nullif(p.dados->>'nome', ''), 'Sem nome'), ', ' order by p.ordem)
    into v_insuficientes from public.personagens p
    join public.saldos_personagens s on s.personagem_id = p.id
    where p.mesa_id = p_mesa and not p.rapido and s.saldo_centavos < p_valor_centavos;
  if v_insuficientes is not null then raise exception 'Saldo insuficiente: %', v_insuficientes; end if;
  select coalesce(nome, 'Mestre') into v_autor_nome from public.perfis where id = auth.uid();
  insert into public.operacoes_financeiras (id, mesa_id, tipo, valor_centavos, motivo, autor_id)
  values (p_operacao, p_mesa, 'desconto_coletivo', -p_valor_centavos, nullif(trim(p_motivo), ''), auth.uid());
  with alterados as (
    update public.saldos_personagens s set saldo_centavos = s.saldo_centavos - p_valor_centavos, atualizado_em = now()
    from public.personagens p where p.id = s.personagem_id and p.mesa_id = p_mesa and not p.rapido
    returning s.personagem_id, s.saldo_centavos, p.dados->>'nome' as nome
  ), gravados as (
    insert into public.transacoes_financeiras
      (operacao_id, mesa_id, personagem_id, personagem_nome, valor_centavos, saldo_apos_centavos, motivo, responsavel_id, responsavel_nome)
    select p_operacao, p_mesa, personagem_id, coalesce(nullif(nome, ''), 'Sem nome'), -p_valor_centavos,
      saldo_centavos, nullif(trim(p_motivo), ''), auth.uid(), coalesce(v_autor_nome, 'Mestre') from alterados returning 1
  ) select count(*) into v_afetados from gravados;
  update public.operacoes_financeiras set afetados = v_afetados where id = p_operacao;
  return jsonb_build_object('afetados', v_afetados, 'valor_centavos', p_valor_centavos, 'duplicada', false);
end $$;

create or replace function public.ajustar_saldo_personagem(
  p_personagem uuid, p_valor_centavos bigint, p_motivo text, p_operacao uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mesa uuid; v_nome text; v_saldo bigint; v_autor_nome text; v_existente public.operacoes_financeiras%rowtype;
begin
  select mesa_id, coalesce(nullif(dados->>'nome', ''), 'Sem nome') into v_mesa, v_nome
    from public.personagens where id = p_personagem and not rapido;
  if v_mesa is null or not public.eh_mestre(v_mesa) then raise exception 'Apenas o mestre pode ajustar este saldo'; end if;
  if p_valor_centavos is null or p_valor_centavos = 0 or abs(p_valor_centavos) > 100000000000 then raise exception 'Valor inválido'; end if;
  if p_operacao is null then raise exception 'Identificador da operação ausente'; end if;
  if length(coalesce(p_motivo, '')) > 500 then raise exception 'Motivo longo demais'; end if;
  perform 1 from public.mesas where id = v_mesa for update;
  select * into v_existente from public.operacoes_financeiras where id = p_operacao;
  if found then
    if v_existente.mesa_id <> v_mesa or v_existente.tipo <> 'ajuste_individual' or v_existente.valor_centavos <> p_valor_centavos then
      raise exception 'Identificador já usado em outra operação';
    end if;
    select saldo_apos_centavos into v_saldo from public.transacoes_financeiras
      where operacao_id = p_operacao and personagem_id = p_personagem;
    if not found then raise exception 'Identificador já usado para outro personagem'; end if;
    return jsonb_build_object('saldo_centavos', v_saldo, 'duplicada', true);
  end if;
  insert into public.saldos_personagens (personagem_id, mesa_id, saldo_centavos)
    values (p_personagem, v_mesa, 0) on conflict (personagem_id) do nothing;
  select saldo_centavos into v_saldo from public.saldos_personagens where personagem_id = p_personagem for update;
  if v_saldo + p_valor_centavos < 0 then raise exception 'Saldo insuficiente para %', v_nome; end if;
  select coalesce(nome, 'Mestre') into v_autor_nome from public.perfis where id = auth.uid();
  insert into public.operacoes_financeiras (id, mesa_id, tipo, valor_centavos, motivo, autor_id, afetados)
  values (p_operacao, v_mesa, 'ajuste_individual', p_valor_centavos, nullif(trim(p_motivo), ''), auth.uid(), 1);
  update public.saldos_personagens set saldo_centavos = saldo_centavos + p_valor_centavos, atualizado_em = now()
    where personagem_id = p_personagem returning saldo_centavos into v_saldo;
  insert into public.transacoes_financeiras
    (operacao_id, mesa_id, personagem_id, personagem_nome, valor_centavos, saldo_apos_centavos, motivo, responsavel_id, responsavel_nome)
  values (p_operacao, v_mesa, p_personagem, v_nome, p_valor_centavos, v_saldo,
    nullif(trim(p_motivo), ''), auth.uid(), coalesce(v_autor_nome, 'Mestre'));
  return jsonb_build_object('saldo_centavos', v_saldo, 'duplicada', false);
end $$;

revoke all on function public.configurar_verba_diaria(uuid, bigint) from public;
revoke all on function public.aplicar_verba_diaria(uuid, text, uuid) from public;
revoke all on function public.descontar_todos(uuid, bigint, text, uuid) from public;
revoke all on function public.ajustar_saldo_personagem(uuid, bigint, text, uuid) from public;
grant execute on function public.configurar_verba_diaria(uuid, bigint) to authenticated;
grant execute on function public.aplicar_verba_diaria(uuid, text, uuid) to authenticated;
grant execute on function public.descontar_todos(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.ajustar_saldo_personagem(uuid, bigint, text, uuid) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.saldos_personagens; exception when duplicate_object then null; end;
end $$;

commit;
