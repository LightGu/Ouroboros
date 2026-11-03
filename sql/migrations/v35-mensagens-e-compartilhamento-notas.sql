-- ============================================================
-- v35 — painel global confiável, compartilhamento seletivo e rename de notas
-- ============================================================

begin;

-- O painel do Mestre Principal usa uma função SECURITY DEFINER. Recriá-la
-- aqui evita que a policy restritiva de mensagens dos mestres comuns resulte
-- numa lista vazia em instalações atualizadas fora de ordem.
create or replace function public.painel_super_mestre_mensagens()
returns table (
  id bigint, mesa_id uuid, mesa_nome text, mesa_propria boolean,
  mestre_nome text, remetente text, destinatario text, texto text, criado_em timestamptz
)
language plpgsql security definer set search_path = public set row_security = off as $$
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

revoke all on function public.painel_super_mestre_mensagens() from public;
grant execute on function public.painel_super_mestre_mensagens() to authenticated;

-- Cada compartilhamento liga uma nota a um integrante específico da mesa.
create table if not exists public.anotacao_compartilhamentos (
  anotacao_id uuid not null references public.anotacoes(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (anotacao_id, user_id)
);
create index if not exists idx_anotacao_compartilhamentos_mesa_usuario
  on public.anotacao_compartilhamentos (mesa_id, user_id);
alter table public.anotacao_compartilhamentos enable row level security;

-- Converte o compartilhamento antigo "com todos" em destinatários explícitos.
insert into public.anotacao_compartilhamentos (anotacao_id, mesa_id, user_id)
select a.id, a.mesa_id, mb.user_id
from public.anotacoes a
join public.membros mb on mb.mesa_id = a.mesa_id
where a.compartilhada and mb.user_id is distinct from a.autor_id
on conflict (anotacao_id, user_id) do nothing;
update public.anotacoes set compartilhada = false where compartilhada;

create or replace function public.eh_autor_anotacao(p_anotacao uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.anotacoes a
    where a.id = p_anotacao and a.autor_id = auth.uid()
  );
$$;

create or replace function public.pode_ler_anotacao(p_anotacao uuid, p_mesa uuid, p_autor uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.eh_super_mestre()
    or (
      public.eh_membro(p_mesa)
      and (
        p_autor = auth.uid()
        or exists (
          select 1 from public.anotacao_compartilhamentos c
          where c.anotacao_id = p_anotacao and c.user_id = auth.uid()
        )
      )
    );
$$;

drop policy if exists anot_ler on public.anotacoes;
create policy anot_ler on public.anotacoes for select to authenticated
  using (public.pode_ler_anotacao(id, mesa_id, autor_id));

drop policy if exists anot_comp_ler on public.anotacao_compartilhamentos;
create policy anot_comp_ler on public.anotacao_compartilhamentos for select to authenticated
  using (
    public.eh_super_mestre()
    or user_id = auth.uid()
    or public.eh_autor_anotacao(anotacao_id)
  );

revoke insert, update, delete on public.anotacao_compartilhamentos from anon, authenticated;
grant select on public.anotacao_compartilhamentos to authenticated;

create or replace function public.definir_compartilhamento_anotacao(
  p_anotacao uuid, p_usuarios uuid[] default '{}'
)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_nota public.anotacoes%rowtype;
  v_usuarios uuid[] := coalesce(p_usuarios, '{}'::uuid[]);
  v_resultado uuid[];
begin
  select * into v_nota from public.anotacoes where id = p_anotacao for update;
  if not found or v_nota.autor_id is distinct from auth.uid()
     or not public.eh_membro(v_nota.mesa_id) then
    raise exception 'Somente o autor pode compartilhar esta anotação' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(v_usuarios) u(user_id)
    where u.user_id is distinct from auth.uid()
      and not exists (
        select 1 from public.membros mb
        where mb.mesa_id = v_nota.mesa_id and mb.user_id = u.user_id
      )
  ) then
    raise exception 'Destinatário não pertence à mesa' using errcode = '23514';
  end if;

  delete from public.anotacao_compartilhamentos where anotacao_id = p_anotacao;
  insert into public.anotacao_compartilhamentos (anotacao_id, mesa_id, user_id)
  select p_anotacao, v_nota.mesa_id, u.user_id
  from (select distinct unnest(v_usuarios) as user_id) u
  where u.user_id is distinct from auth.uid();

  -- Dispara o realtime da nota sem mudar seu conteúdo.
  update public.anotacoes set atualizado_em = now() where id = p_anotacao;
  select coalesce(array_agg(c.user_id order by c.user_id), '{}'::uuid[])
    into v_resultado
    from public.anotacao_compartilhamentos c where c.anotacao_id = p_anotacao;
  return v_resultado;
end $$;

-- Reescreve somente o alvo dentro de [[...]], preservando #âncora e |rótulo.
-- O parser deliberadamente não usa regex, portanto títulos com ., +, (, [ etc.
-- não precisam de escape e nunca causam substituições parciais.
create or replace function public.reescrever_wikilinks(
  p_texto text, p_antigo text, p_novo text
)
returns text language plpgsql immutable set search_path = public as $$
declare
  v_saida text := '';
  v_pos integer := 1;
  v_abre_rel integer;
  v_abre integer;
  v_fecha_rel integer;
  v_fecha integer;
  v_interno text;
  v_alvo text;
  v_sufixo text;
  v_hash integer;
  v_alias integer;
  v_corte integer;
  v_esq integer;
  v_dir integer;
begin
  if p_texto is null or p_antigo is null or p_novo is null then return p_texto; end if;
  loop
    v_abre_rel := strpos(substr(p_texto, v_pos), '[[');
    if v_abre_rel = 0 then return v_saida || substr(p_texto, v_pos); end if;
    v_abre := v_pos + v_abre_rel - 1;
    v_saida := v_saida || substr(p_texto, v_pos, v_abre - v_pos + 2);
    v_fecha_rel := strpos(substr(p_texto, v_abre + 2), ']]');
    if v_fecha_rel = 0 then return v_saida || substr(p_texto, v_abre + 2); end if;
    v_fecha := v_abre + v_fecha_rel + 1;
    v_interno := substr(p_texto, v_abre + 2, v_fecha - v_abre - 2);
    v_hash := strpos(v_interno, '#');
    v_alias := strpos(v_interno, '|');
    v_corte := case
      when v_hash = 0 then v_alias
      when v_alias = 0 then v_hash
      else least(v_hash, v_alias)
    end;
    if v_corte = 0 then
      v_alvo := v_interno;
      v_sufixo := '';
    else
      v_alvo := substr(v_interno, 1, v_corte - 1);
      v_sufixo := substr(v_interno, v_corte);
    end if;
    if lower(btrim(v_alvo)) = lower(btrim(p_antigo)) then
      v_esq := length(v_alvo) - length(ltrim(v_alvo));
      v_dir := length(v_alvo) - length(rtrim(v_alvo));
      v_alvo := substr(v_alvo, 1, v_esq) || p_novo
        || case when v_dir > 0 then substr(v_alvo, length(v_alvo) - v_dir + 1) else '' end;
    end if;
    v_saida := v_saida || v_alvo || v_sufixo || ']]';
    v_pos := v_fecha + 2;
  end loop;
end $$;

create or replace function public.renomear_anotacao(p_anotacao uuid, p_novo_titulo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nota public.anotacoes%rowtype;
  v_novo text := btrim(coalesce(p_novo_titulo, ''));
  v_resultado public.anotacoes%rowtype;
begin
  select * into v_nota from public.anotacoes where id = p_anotacao for update;
  if not found or v_nota.autor_id is distinct from auth.uid()
     or not public.eh_membro(v_nota.mesa_id) then
    raise exception 'Somente o autor pode renomear esta anotação' using errcode = '42501';
  end if;
  if v_novo = '' or length(v_novo) > 200 then
    raise exception 'O título precisa ter entre 1 e 200 caracteres' using errcode = '23514';
  end if;
  if v_novo = v_nota.titulo then return to_jsonb(v_nota); end if;
  if exists (
    select 1 from public.anotacoes a
    where a.mesa_id = v_nota.mesa_id and a.autor_id = v_nota.autor_id
      and lower(a.titulo) = lower(v_novo) and a.id <> p_anotacao
  ) then
    raise exception 'Já existe uma anotação com esse título' using errcode = '23505';
  end if;

  update public.anotacoes set titulo = v_novo where id = p_anotacao;
  update public.anotacoes
     set texto = public.reescrever_wikilinks(texto, v_nota.titulo, v_novo)
   where mesa_id = v_nota.mesa_id and strpos(texto, '[[') > 0
     and public.reescrever_wikilinks(texto, v_nota.titulo, v_novo) is distinct from texto;
  select * into v_resultado from public.anotacoes where id = p_anotacao;
  return to_jsonb(v_resultado);
end $$;

revoke all on function public.eh_autor_anotacao(uuid) from public;
revoke all on function public.pode_ler_anotacao(uuid, uuid, uuid) from public;
revoke all on function public.definir_compartilhamento_anotacao(uuid, uuid[]) from public;
revoke all on function public.reescrever_wikilinks(text, text, text) from public;
revoke all on function public.renomear_anotacao(uuid, text) from public;
grant execute on function public.eh_autor_anotacao(uuid) to authenticated;
grant execute on function public.pode_ler_anotacao(uuid, uuid, uuid) to authenticated;
grant execute on function public.definir_compartilhamento_anotacao(uuid, uuid[]) to authenticated;
grant execute on function public.renomear_anotacao(uuid, text) to authenticated;

commit;
