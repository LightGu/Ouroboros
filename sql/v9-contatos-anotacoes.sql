-- ============================================================
-- v9 — liberar contato de persona + anotações dos jogadores
-- ============================================================

-- ---------- quem enxerga qual persona ----------
-- A persona já só aparece pra quem trocou mensagem com ela. Esta tabela é a
-- outra porta: o mestre libera na mão, ou um jogador passa o número a outro.
create table if not exists public.contatos_liberados (
  mesa_id     uuid not null references public.mesas on delete cascade,
  persona_id  uuid not null references public.personas on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  por_id      uuid references auth.users on delete set null,
  criado_em   timestamptz not null default now(),
  primary key (persona_id, user_id)
);

alter table public.contatos_liberados enable row level security;

drop policy if exists cl_ler on public.contatos_liberados;
create policy cl_ler on public.contatos_liberados for select to authenticated
  using (user_id = auth.uid() or public.eh_mestre(mesa_id));

-- Inserção só pela função abaixo, que valida quem pode passar o quê.
drop policy if exists cl_apagar on public.contatos_liberados;
create policy cl_apagar on public.contatos_liberados for delete to authenticated
  using (public.eh_mestre(mesa_id));

/* Só passa adiante um número que você mesmo já tem. O mestre passa qualquer um. */
create or replace function public.liberar_contato(p_persona uuid, p_para uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mesa uuid; v_tem boolean;
begin
  select mesa_id into v_mesa from personas where id = p_persona;
  if v_mesa is null then raise exception 'Número não encontrado'; end if;
  if not public.eh_membro(v_mesa) then raise exception 'Você não está nesta mesa'; end if;

  if not exists (select 1 from membros where mesa_id = v_mesa and user_id = p_para) then
    raise exception 'Essa pessoa não está na mesa';
  end if;

  if not public.eh_mestre(v_mesa) then
    select exists (
      select 1 from mensagens
       where (de_persona = p_persona and para_user = auth.uid())
          or (para_persona = p_persona and de_user = auth.uid())
      union all
      select 1 from contatos_liberados
       where persona_id = p_persona and user_id = auth.uid()
    ) into v_tem;
    if not v_tem then raise exception 'Você não tem esse contato'; end if;
  end if;

  insert into contatos_liberados (mesa_id, persona_id, user_id, por_id)
  values (v_mesa, p_persona, p_para, auth.uid())
  on conflict (persona_id, user_id) do nothing;
  return true;
end $$;

-- ---------- anotações dos jogadores ----------
-- A tabela já existia, mas só o mestre alcançava. Agora cada um tem o
-- próprio caderno, e pode marcar uma anotação como compartilhada.
alter table public.anotacoes add column if not exists autor_id uuid references auth.users on delete set null;
alter table public.anotacoes add column if not exists compartilhada boolean not null default false;

-- o que já existe é do mestre da mesa
update public.anotacoes a
   set autor_id = m.mestre_id
  from public.mesas m
 where m.id = a.mesa_id and a.autor_id is null;

-- título único POR AUTOR: dois jogadores podem ter uma "Igreja" cada um
drop index if exists public.idx_anotacoes_titulo;
create unique index if not exists idx_anotacoes_titulo
  on public.anotacoes (mesa_id, autor_id, lower(titulo));

drop policy if exists anotacoes_mestre on public.anotacoes;
drop policy if exists anot_ler on public.anotacoes;
drop policy if exists anot_criar on public.anotacoes;
drop policy if exists anot_mexer on public.anotacoes;

-- vejo as minhas, as que alguém compartilhou, e o mestre vê tudo
create policy anot_ler on public.anotacoes for select to authenticated
  using (
    public.eh_mestre(mesa_id)
    or autor_id = auth.uid()
    or compartilhada
  );

create policy anot_criar on public.anotacoes for insert to authenticated
  with check (public.eh_membro(mesa_id) and autor_id = auth.uid());

-- editar e apagar: só o dono da anotação (o mestre mexe nas dele também)
create policy anot_mexer on public.anotacoes for update to authenticated
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());

drop policy if exists anot_apagar on public.anotacoes;
create policy anot_apagar on public.anotacoes for delete to authenticated
  using (autor_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.contatos_liberados; exception when duplicate_object then null; end;
end $$;
