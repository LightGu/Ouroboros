-- v26 — impede vazamento de anotações e valida marcadores de leitura.

-- Uma nota compartilhada pertence à mesa, não a todos os usuários do sistema.
drop policy if exists anot_ler on public.anotacoes;
drop policy if exists anot_mexer on public.anotacoes;
create policy anot_ler on public.anotacoes for select to authenticated
using (
  public.eh_membro(mesa_id)
  and (public.eh_mestre(mesa_id) or autor_id = auth.uid() or compartilhada)
);
create policy anot_mexer on public.anotacoes for update to authenticated
using (autor_id = auth.uid() and public.eh_membro(mesa_id))
with check (autor_id = auth.uid() and public.eh_membro(mesa_id));

-- Mesmo o dono não pode transportar uma nota para outra mesa ou trocar o autor.
create or replace function public.proteger_identidade_anotacao()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.mesa_id is distinct from OLD.mesa_id or NEW.autor_id is distinct from OLD.autor_id then
    raise exception 'Não é permitido mover uma anotação ou trocar seu autor';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_proteger_identidade_anotacao on public.anotacoes;
create trigger trg_proteger_identidade_anotacao before update on public.anotacoes
for each row execute function public.proteger_identidade_anotacao();

-- Cada marcador precisa ser do usuário atual, numa mesa da qual ele participa,
-- e apontar para um usuário ou persona que realmente pertence àquela mesa.
drop policy if exists leituras_minhas on public.leituras;
create policy leituras_minhas on public.leituras for all to authenticated
using (
  user_id = auth.uid() and public.eh_membro(mesa_id)
  and (
    exists (select 1 from public.membros mb
            where mb.mesa_id = leituras.mesa_id and 'u:' || mb.user_id::text = leituras.chave)
    or exists (select 1 from public.personas p
               where p.mesa_id = leituras.mesa_id and 'p:' || p.id::text = leituras.chave)
  )
)
with check (
  user_id = auth.uid() and public.eh_membro(mesa_id)
  and (
    exists (select 1 from public.membros mb
            where mb.mesa_id = leituras.mesa_id and 'u:' || mb.user_id::text = leituras.chave)
    or exists (select 1 from public.personas p
               where p.mesa_id = leituras.mesa_id and 'p:' || p.id::text = leituras.chave)
  )
);
