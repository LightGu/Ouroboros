-- ============================================================
-- v5 — personagem rápido é ferramenta de mestre
-- Só o mestre pode criar ficha com rapido = true. Esconder o botão não
-- basta: o jogador chamaria a função pelo console. Quem decide é o banco.
-- ============================================================

drop policy if exists pers_criar on public.personagens;
create policy pers_criar on public.personagens for insert to authenticated
  with check (
    public.eh_membro(mesa_id)
    and (not rapido  or public.eh_mestre(mesa_id))
    and (not oculto  or public.eh_mestre(mesa_id))
  );
