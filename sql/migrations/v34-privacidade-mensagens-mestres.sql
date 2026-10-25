-- ============================================================
-- v34 — mensagens privadas não ficam visíveis a mestres comuns
-- ============================================================

-- O mestre da mesa ainda participa normalmente do celular e pode usar personas.
-- Somente o Mestre Principal consulta todas as conversas, por meio do RPC
-- painel_super_mestre_mensagens(), cuja autorização é validada no servidor.

drop policy if exists msg_ler on public.mensagens;

create policy msg_ler on public.mensagens for select to authenticated
  using (
    public.eh_membro(mesa_id)
    and (
      de_user = auth.uid()
      or para_user = auth.uid()
      or (public.eh_mestre(mesa_id) and (de_persona is not null or para_persona is not null))
    )
  );
