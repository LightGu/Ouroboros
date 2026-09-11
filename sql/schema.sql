-- ============================================================
-- Mesa do Mestre — schema Supabase
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Pode rodar de novo sem medo: é idempotente.
-- ============================================================

-- ---------- TABELAS ----------

create table if not exists public.perfis (
  id         uuid primary key references auth.users on delete cascade,
  nome       text not null default 'Agente',
  criado_em  timestamptz not null default now()
);

create table if not exists public.mesas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  mestre_id  uuid not null references auth.users on delete cascade,
  codigo     text not null unique,
  criado_em  timestamptz not null default now()
);

create table if not exists public.membros (
  mesa_id    uuid not null references public.mesas on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  papel      text not null check (papel in ('mestre', 'jogador')),
  entrou_em  timestamptz not null default now(),
  primary key (mesa_id, user_id)
);

create table if not exists public.personagens (
  id              uuid primary key default gen_random_uuid(),
  mesa_id         uuid not null references public.mesas on delete cascade,
  dono_id         uuid references auth.users on delete set null,
  ordem           int  not null default 0,
  rapido          boolean not null default false,
  oculto          boolean not null default false,
  dados           jsonb not null default '{}'::jsonb,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users on delete set null
);

create index if not exists idx_personagens_mesa on public.personagens (mesa_id, ordem);

-- Anotações do mestre ficam FORA de `dados`: RLS é por linha, não por coluna,
-- então a única forma de o jogador nunca receber esse texto é ele morar em outra tabela.
create table if not exists public.notas_mestre (
  personagem_id uuid primary key references public.personagens on delete cascade,
  mesa_id       uuid not null references public.mesas on delete cascade,
  texto         text not null default ''
);

create table if not exists public.logs (
  id               bigserial primary key,
  mesa_id          uuid not null references public.mesas on delete cascade,
  personagem_id    uuid,
  personagem_nome  text,
  autor_id         uuid,
  autor_nome       text,
  acao             text not null,          -- 'criou' | 'removeu' | 'vida' | 'ficha'
  detalhe          text,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_logs_mesa on public.logs (mesa_id, criado_em desc);

-- ---------- FUNÇÕES DE APOIO ----------
-- SECURITY DEFINER de propósito: se a policy de `membros` consultasse `membros`
-- direto, o Postgres entraria em recursão infinita.

create or replace function public.eh_membro(m uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from membros where mesa_id = m and user_id = auth.uid());
$$;

create or replace function public.eh_mestre(m uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from mesas where id = m and mestre_id = auth.uid());
$$;

-- ---------- PERFIL AUTOMÁTICO NO CADASTRO ----------

create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- ---------- CRIAR / ENTRAR EM MESA ----------

create or replace function public.criar_mesa(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_codigo text;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from mesas where codigo = v_codigo);
  end loop;

  insert into mesas (nome, mestre_id, codigo)
  values (coalesce(nullif(trim(p_nome), ''), 'Minha mesa'), auth.uid(), v_codigo)
  returning id into v_id;

  insert into membros (mesa_id, user_id, papel) values (v_id, auth.uid(), 'mestre');
  return v_id;
end $$;

-- Precisa ser DEFINER: quem está entrando ainda não é membro, então não
-- enxergaria a mesa pra descobrir o id a partir do código.
create or replace function public.entrar_na_mesa(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mesa uuid;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;
  select id into v_mesa from mesas where upper(codigo) = upper(trim(p_codigo));
  if v_mesa is null then raise exception 'Código de mesa não encontrado'; end if;

  insert into membros (mesa_id, user_id, papel)
  values (v_mesa, auth.uid(), 'jogador')
  on conflict (mesa_id, user_id) do nothing;

  return v_mesa;
end $$;

-- o bloco v2 mais abaixo redefine esta função com uma coluna a mais;
-- o drop deixa o arquivo rodável quantas vezes for preciso
drop function if exists public.minhas_mesas();
create or replace function public.minhas_mesas()
returns table (id uuid, nome text, codigo text, papel text, mestre_id uuid)
language sql security definer stable set search_path = public as $$
  select m.id, m.nome, m.codigo, mb.papel, m.mestre_id
  from mesas m
  join membros mb on mb.mesa_id = m.id
  where mb.user_id = auth.uid()
  order by m.criado_em;
$$;

-- ---------- LOG AUTOMÁTICO ----------
-- Roda no banco, não no navegador: o jogador não tem como "esquecer" de registrar.

create or replace function public.registrar_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_autor      uuid := auth.uid();
  v_autor_nome text;
  v_nome       text;
  v_vida       text := '';
  v_ficha      text := '';
  antes        jsonb;
  depois       jsonb;
  v_id         bigint;
begin
  select nome into v_autor_nome from perfis where id = v_autor;
  v_autor_nome := coalesce(v_autor_nome, 'alguém');

  if TG_OP = 'DELETE' then
    -- se a mesa inteira está sendo apagada, não há log a guardar
    if exists (select 1 from mesas where id = OLD.mesa_id) then
      insert into logs (mesa_id, personagem_id, personagem_nome, autor_id, autor_nome, acao, detalhe)
      values (OLD.mesa_id, OLD.id, coalesce(OLD.dados->>'nome', 'sem nome'), v_autor, v_autor_nome,
              'removeu', 'tirou da mesa');
    end if;
    return OLD;
  end if;

  v_nome := coalesce(nullif(NEW.dados->>'nome', ''), 'sem nome');

  if TG_OP = 'INSERT' then
    insert into logs (mesa_id, personagem_id, personagem_nome, autor_id, autor_nome, acao, detalhe)
    values (NEW.mesa_id, NEW.id, v_nome, v_autor, v_autor_nome, 'criou',
            case when NEW.rapido then 'personagem rápido' else 'ficha nova' end);
    return NEW;
  end if;

  antes  := OLD.dados;
  depois := NEW.dados;

  -- PV / PE / Sanidade: sempre viram log próprio, é o que interessa na sessão
  if (antes->'pv'->>'atual') is distinct from (depois->'pv'->>'atual')
     and (antes->'pv'->>'atual') is not null and (depois->'pv'->>'atual') is not null then
    v_vida := v_vida || format('PV %s → %s. ', antes->'pv'->>'atual', depois->'pv'->>'atual');
  end if;
  if (antes->'pe'->>'atual') is distinct from (depois->'pe'->>'atual')
     and (antes->'pe'->>'atual') is not null and (depois->'pe'->>'atual') is not null then
    v_vida := v_vida || format('PE %s → %s. ', antes->'pe'->>'atual', depois->'pe'->>'atual');
  end if;
  if (antes->'san'->>'atual') is distinct from (depois->'san'->>'atual')
     and (antes->'san'->>'atual') is not null and (depois->'san'->>'atual') is not null then
    v_vida := v_vida || format('SAN %s → %s. ', antes->'san'->>'atual', depois->'san'->>'atual');
  end if;

  if v_vida <> '' then
    insert into logs (mesa_id, personagem_id, personagem_nome, autor_id, autor_nome, acao, detalhe)
    values (NEW.mesa_id, NEW.id, v_nome, v_autor, v_autor_nome, 'vida', trim(v_vida));
  end if;

  -- Demais campos da ficha
  if (antes - 'pv' - 'pe' - 'san') is distinct from (depois - 'pv' - 'pe' - 'san') then
    if (antes->>'nome') is distinct from (depois->>'nome') then
      v_ficha := format('renomeou de "%s" para "%s"', coalesce(antes->>'nome','sem nome'), v_nome);
    else
      v_ficha := 'mexeu na ficha';
    end if;

    -- Digitar na ficha dispara muitos updates. Se já existe um log de ficha
    -- do mesmo autor nos últimos 5 min, atualiza ele em vez de empilhar.
    select id into v_id from logs
     where personagem_id = NEW.id and autor_id = v_autor and acao = 'ficha'
       and criado_em > now() - interval '5 minutes'
     order by criado_em desc limit 1;

    if v_id is not null then
      update logs set criado_em = now(), detalhe = v_ficha, personagem_nome = v_nome where id = v_id;
    else
      insert into logs (mesa_id, personagem_id, personagem_nome, autor_id, autor_nome, acao, detalhe)
      values (NEW.mesa_id, NEW.id, v_nome, v_autor, v_autor_nome, 'ficha', v_ficha);
    end if;
  end if;

  return NEW;
end $$;

drop trigger if exists trg_log_personagens on public.personagens;
create trigger trg_log_personagens
  after insert or update or delete on public.personagens
  for each row execute function public.registrar_log();

-- mantém atualizado_em/por sempre corretos, sem depender do cliente
create or replace function public.carimbar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.atualizado_em  := now();
  NEW.atualizado_por := auth.uid();
  return NEW;
end $$;

drop trigger if exists trg_carimbar on public.personagens;
create trigger trg_carimbar
  before insert or update on public.personagens
  for each row execute function public.carimbar();

-- ---------- RLS ----------

alter table public.perfis        enable row level security;
alter table public.mesas         enable row level security;
alter table public.membros       enable row level security;
alter table public.personagens   enable row level security;
alter table public.notas_mestre  enable row level security;
alter table public.logs          enable row level security;

drop policy if exists perfis_ler    on public.perfis;
drop policy if exists perfis_editar on public.perfis;
create policy perfis_ler    on public.perfis for select to authenticated using (true);
create policy perfis_editar on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists mesas_ler      on public.mesas;
drop policy if exists mesas_editar   on public.mesas;
drop policy if exists mesas_apagar   on public.mesas;
create policy mesas_ler    on public.mesas for select to authenticated using (public.eh_membro(id));
create policy mesas_editar on public.mesas for update to authenticated using (mestre_id = auth.uid());
create policy mesas_apagar on public.mesas for delete to authenticated using (mestre_id = auth.uid());

drop policy if exists membros_ler    on public.membros;
drop policy if exists membros_sair   on public.membros;
create policy membros_ler  on public.membros for select to authenticated using (public.eh_membro(mesa_id));
create policy membros_sair on public.membros for delete to authenticated
  using (user_id = auth.uid() or public.eh_mestre(mesa_id));

-- Jogador só enxerga o que não está oculto. O mestre enxerga tudo.
drop policy if exists pers_ler    on public.personagens;
drop policy if exists pers_criar  on public.personagens;
drop policy if exists pers_editar on public.personagens;
drop policy if exists pers_apagar on public.personagens;

create policy pers_ler on public.personagens for select to authenticated
  using (public.eh_membro(mesa_id) and (not oculto or public.eh_mestre(mesa_id)));

create policy pers_criar on public.personagens for insert to authenticated
  with check (public.eh_membro(mesa_id));

create policy pers_editar on public.personagens for update to authenticated
  using  (public.eh_mestre(mesa_id) or dono_id = auth.uid())
  with check (public.eh_mestre(mesa_id) or dono_id = auth.uid());

create policy pers_apagar on public.personagens for delete to authenticated
  using (public.eh_mestre(mesa_id) or dono_id = auth.uid());

-- Anotações do mestre: só o mestre, ponto.
drop policy if exists notas_mestre_tudo on public.notas_mestre;
create policy notas_mestre_tudo on public.notas_mestre for all to authenticated
  using (public.eh_mestre(mesa_id)) with check (public.eh_mestre(mesa_id));

-- Logs: só o mestre lê. A escrita é do trigger (SECURITY DEFINER), não do cliente.
drop policy if exists logs_ler on public.logs;
create policy logs_ler on public.logs for select to authenticated using (public.eh_mestre(mesa_id));

-- ---------- REALTIME ----------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  begin alter publication supabase_realtime add table public.personagens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.logs;        exception when duplicate_object then null; end;
end $$;

-- ---------- STORAGE (retratos) ----------

insert into storage.buckets (id, name, public)
values ('retratos', 'retratos', true)
on conflict (id) do nothing;

do $$
begin
  drop policy if exists retratos_ler    on storage.objects;
  drop policy if exists retratos_enviar on storage.objects;
  drop policy if exists retratos_trocar on storage.objects;
  drop policy if exists retratos_apagar on storage.objects;

  create policy retratos_ler    on storage.objects for select using (bucket_id = 'retratos');
  create policy retratos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'retratos');
  create policy retratos_trocar on storage.objects for update to authenticated using (bucket_id = 'retratos');
  create policy retratos_apagar on storage.objects for delete to authenticated using (bucket_id = 'retratos');
exception when insufficient_privilege then
  raise notice 'Sem permissão pra mexer nas policies de storage. Crie as 4 regras do bucket "retratos" pelo painel (Storage > Policies).';
end $$;


-- ============================================================
-- v2 — rolagens, iniciativa compartilhada, mapa com fog of war
-- ============================================================

-- ---------- COMBATE COMPARTILHADO ----------
-- Fica na mesa pra todo mundo ver de quem é a vez. Só o mestre escreve
-- (a policy mesas_editar já garante isso).

alter table public.mesas
  add column if not exists combate jsonb not null
  default '{"ativo": false, "indice": 0, "rodada": 1}'::jsonb;

drop function if exists public.minhas_mesas();
create or replace function public.minhas_mesas()
returns table (id uuid, nome text, codigo text, papel text, mestre_id uuid, combate jsonb)
language sql security definer stable set search_path = public as $$
  select m.id, m.nome, m.codigo, mb.papel, m.mestre_id, m.combate
  from mesas m
  join membros mb on mb.mesa_id = m.id
  where mb.user_id = auth.uid()
  order by m.criado_em;
$$;

-- ---------- ROLAGENS ----------

create table if not exists public.rolagens (
  id               bigserial primary key,
  mesa_id          uuid not null references public.mesas on delete cascade,
  autor_id         uuid references auth.users on delete set null,
  autor_nome       text,
  personagem_nome  text,
  rotulo           text not null,        -- "Luta", "Dano — Fuzil", "Iniciativa"
  formula          text,                 -- "3d20 (maior) + 10"
  dados            int[] not null default '{}',
  descartados      int[] not null default '{}',
  resultado        int not null,
  secreta          boolean not null default false,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_rolagens_mesa on public.rolagens (mesa_id, criado_em desc);

alter table public.rolagens enable row level security;

drop policy if exists rolagens_ler   on public.rolagens;
drop policy if exists rolagens_criar on public.rolagens;

-- rolagem secreta do mestre não aparece pros jogadores
create policy rolagens_ler on public.rolagens for select to authenticated
  using (public.eh_membro(mesa_id) and (not secreta or public.eh_mestre(mesa_id)));

create policy rolagens_criar on public.rolagens for insert to authenticated
  with check (public.eh_membro(mesa_id) and autor_id = auth.uid());

-- ---------- MAPAS ----------
-- fog é uma string de '0' (coberto) e '1' (revelado), uma posição por célula,
-- lida em linhas. Barato de guardar e de mandar pela rede.

create table if not exists public.mapas (
  id          uuid primary key default gen_random_uuid(),
  mesa_id     uuid not null references public.mesas on delete cascade,
  nome        text not null default 'Mapa',
  imagem      text,
  colunas     int not null default 30,
  linhas      int not null default 20,
  grade       boolean not null default true,
  fog_ligado  boolean not null default true,
  fog         text not null default '',
  ativo       boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_mapas_mesa on public.mapas (mesa_id);

create table if not exists public.tokens (
  id             uuid primary key default gen_random_uuid(),
  mapa_id        uuid not null references public.mapas on delete cascade,
  mesa_id        uuid not null references public.mesas on delete cascade,
  personagem_id  uuid references public.personagens on delete set null,
  nome           text not null default '',
  imagem         text,
  cor            text,
  x              real not null default 0.5,   -- fração da largura do mapa (0..1)
  y              real not null default 0.5,   -- fração da altura
  escala         real not null default 1,     -- múltiplo de uma célula
  oculto         boolean not null default false
);

create index if not exists idx_tokens_mapa on public.tokens (mapa_id);

alter table public.mapas  enable row level security;
alter table public.tokens enable row level security;

drop policy if exists mapas_ler  on public.mapas;
drop policy if exists mapas_mexer on public.mapas;
create policy mapas_ler   on public.mapas for select to authenticated using (public.eh_membro(mesa_id));
create policy mapas_mexer on public.mapas for all    to authenticated
  using (public.eh_mestre(mesa_id)) with check (public.eh_mestre(mesa_id));

drop policy if exists tokens_ler    on public.tokens;
drop policy if exists tokens_criar  on public.tokens;
drop policy if exists tokens_mover  on public.tokens;
drop policy if exists tokens_apagar on public.tokens;

create policy tokens_ler on public.tokens for select to authenticated
  using (public.eh_membro(mesa_id) and (not oculto or public.eh_mestre(mesa_id)));

create policy tokens_criar on public.tokens for insert to authenticated
  with check (public.eh_mestre(mesa_id));

-- jogador arrasta o token do próprio personagem; mestre arrasta qualquer um
create policy tokens_mover on public.tokens for update to authenticated
  using (
    public.eh_mestre(mesa_id) or exists (
      select 1 from personagens p where p.id = tokens.personagem_id and p.dono_id = auth.uid()
    )
  )
  with check (
    public.eh_mestre(mesa_id) or exists (
      select 1 from personagens p where p.id = tokens.personagem_id and p.dono_id = auth.uid()
    )
  );

create policy tokens_apagar on public.tokens for delete to authenticated
  using (public.eh_mestre(mesa_id));

-- ---------- REALTIME v2 ----------

do $$
begin
  begin alter publication supabase_realtime add table public.rolagens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mapas;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tokens;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mesas;    exception when duplicate_object then null; end;
end $$;


-- ============================================================
-- v3 — trilha sonora da mesa
-- (munição vive dentro de personagens.dados, não precisa de tabela)
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

do $$
begin
  begin alter publication supabase_realtime add table public.sons; exception when duplicate_object then null; end;
end $$;

-- bucket separado: áudio é pesado e tem regra de tamanho diferente de retrato
insert into storage.buckets (id, name, public, file_size_limit)
values ('sons', 'sons', true, 20971520)          -- 20 MB por arquivo
on conflict (id) do update set file_size_limit = 20971520;

do $$
begin
  drop policy if exists sons_storage_ler    on storage.objects;
  drop policy if exists sons_storage_enviar on storage.objects;
  drop policy if exists sons_storage_apagar on storage.objects;

  create policy sons_storage_ler    on storage.objects for select using (bucket_id = 'sons');
  create policy sons_storage_enviar on storage.objects for insert to authenticated with check (bucket_id = 'sons');
  create policy sons_storage_apagar on storage.objects for delete to authenticated using (bucket_id = 'sons');
exception when insufficient_privilege then
  raise notice 'Sem permissão nas policies de storage. Crie as regras do bucket "sons" pelo painel.';
end $$;


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
