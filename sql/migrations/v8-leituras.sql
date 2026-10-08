-- ============================================================
-- v8 — até onde cada um leu, por conversa
--
-- Por que não usar `mensagens.lida`: o mestre lê a linha inteira da mensagem,
-- então enxergaria a marca de leitura junto. RLS filtra linha, não coluna.
-- Aqui cada pessoa só alcança as PRÓPRIAS linhas — nem o mestre vê.
-- ============================================================

create table if not exists public.leituras (
  user_id   uuid not null references auth.users on delete cascade,
  mesa_id   uuid not null references public.mesas on delete cascade,
  chave     text not null,            -- 'u:<id>' ou 'p:<id>': o outro lado da conversa
  lido_ate  timestamptz not null default now(),
  primary key (user_id, mesa_id, chave)
);

alter table public.leituras enable row level security;

drop policy if exists leituras_minhas on public.leituras;
create policy leituras_minhas on public.leituras for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
