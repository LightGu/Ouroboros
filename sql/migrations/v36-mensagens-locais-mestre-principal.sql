-- ============================================================
-- v36 — aba local de mensagens do Mestre Principal
-- ============================================================

begin;

-- Não altera msg_ler: mestres comuns continuam sem acesso a conversas entre
-- jogadores. Esta função só libera uma mesa quando a conta é simultaneamente
-- Mestre Principal e mestre daquela mesa, e registra o acesso administrativo.
create or replace function public.painel_super_mestre_mensagens_mesa(p_mesa uuid)
returns table (
  id bigint, mesa_id uuid, de_user uuid, de_persona uuid,
  para_user uuid, para_persona uuid, texto text, criado_em timestamptz
)
language plpgsql security definer set search_path = public set row_security = off as $$
begin
  if not public.eh_super_mestre() or not public.eh_mestre(p_mesa) then
    raise exception 'Acesso local do Mestre Principal negado' using errcode = '42501';
  end if;

  insert into public.acessos_super_mestre (user_id, origem, acao, mesa_id)
  values (auth.uid(), inet_client_addr(), 'mensagens_mesa', p_mesa);

  return query
    select msg.id, msg.mesa_id, msg.de_user, msg.de_persona,
      msg.para_user, msg.para_persona, msg.texto, msg.criado_em
    from public.mensagens msg
    where msg.mesa_id = p_mesa
    order by msg.criado_em;
end $$;

revoke all on function public.painel_super_mestre_mensagens_mesa(uuid) from public;
grant execute on function public.painel_super_mestre_mensagens_mesa(uuid) to authenticated;

commit;
