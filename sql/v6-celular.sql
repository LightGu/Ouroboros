-- ============================================================
-- v6 — celular: mensagens privadas e "outros números" do mestre
-- ============================================================

-- Personas: números falsos que o mestre usa pra falar com os jogadores
-- sem ser ele mesmo (um NPC, um número desconhecido, etc.)
create table if not exists public.personas (
  id         uuid primary key default gen_random_uuid(),
  mesa_id    uuid not null references public.mesas on delete cascade,
  nome       text not null default 'Desconhecido',
  foto       text,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_personas_mesa on public.personas (mesa_id);

-- Cada mensagem tem exatamente um remetente e um destinatário, e cada lado
-- é OU um usuário OU uma persona. Os CHECKs garantem isso no banco.
create table if not exists public.mensagens (
  id           bigserial primary key,
  mesa_id      uuid not null references public.mesas on delete cascade,
  de_user      uuid references auth.users on delete set null,
  de_persona   uuid references public.personas on delete cascade,
  para_user    uuid references auth.users on delete set null,
  para_persona uuid references public.personas on delete cascade,
  texto        text not null,
  lida         boolean not null default false,
  criado_em    timestamptz not null default now(),
  constraint um_remetente    check (num_nonnulls(de_user, de_persona) = 1),
  constraint um_destinatario check (num_nonnulls(para_user, para_persona) = 1)
);
create index if not exists idx_mensagens_mesa on public.mensagens (mesa_id, criado_em);

alter table public.personas  enable row level security;
alter table public.mensagens enable row level security;

-- Persona é ferramenta de mestre, mas o jogador precisa ler o nome e a foto
-- de quem está falando com ele.
drop policy if exists personas_ler   on public.personas;
drop policy if exists personas_mexer on public.personas;
create policy personas_ler   on public.personas for select to authenticated using (public.eh_membro(mesa_id));
create policy personas_mexer on public.personas for all    to authenticated
  using (public.eh_mestre(mesa_id)) with check (public.eh_mestre(mesa_id));

-- O mestre lê tudo da mesa — inclusive conversa entre dois jogadores.
-- Não existe aviso disso para eles: RLS decide no servidor, em silêncio.
drop policy if exists msg_ler    on public.mensagens;
drop policy if exists msg_criar  on public.mensagens;
drop policy if exists msg_marcar on public.mensagens;

create policy msg_ler on public.mensagens for select to authenticated
  using (
    public.eh_mestre(mesa_id)
    or de_user   = auth.uid()
    or para_user = auth.uid()
  );

-- Jogador só manda como ele mesmo. Só o mestre pode falar como persona.
create policy msg_criar on public.mensagens for insert to authenticated
  with check (
    public.eh_membro(mesa_id)
    and (
      (de_user = auth.uid() and de_persona is null)
      or (de_persona is not null and public.eh_mestre(mesa_id))
    )
  );

-- A coluna `lida` existe mas o app NÃO a usa: nada de confirmação de leitura.
-- O aviso de mensagem nova é só visual e vive na memória da aba. Assim
-- ninguém — nem o mestre — descobre se o outro abriu a conversa.
-- A política fica aqui caso um dia se queira o recurso.
create policy msg_marcar on public.mensagens for update to authenticated
  using (para_user = auth.uid()) with check (para_user = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.mensagens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.personas;  exception when duplicate_object then null; end;
end $$;
