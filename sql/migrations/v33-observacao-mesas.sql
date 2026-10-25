-- v33 — observação global de mesas em modo estritamente somente leitura

begin;

alter table public.acessos_super_mestre
  add column if not exists acao text not null default 'mensagens',
  add column if not exists mesa_id uuid;

create or replace function public.listar_mesas_observacao()
returns table (id uuid, nome text, sistema text, mestre_nome text, criado_em timestamptz)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.eh_super_mestre() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;
  return query
    select ms.id, ms.nome, ms.sistema, coalesce(p.nome, 'Conta removida'), ms.criado_em
    from public.mesas ms
    left join public.perfis p on p.id = ms.mestre_id
    where ms.mestre_id <> auth.uid()
    order by ms.criado_em desc;
end $$;

create or replace function public.observar_mesa(p_mesa uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if not public.eh_super_mestre() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'mesa', jsonb_build_object(
      'id', ms.id, 'nome', ms.nome, 'sistema', ms.sistema, 'combate', ms.combate,
      'mestre_id', ms.mestre_id, 'papel', 'observador'
    ),
    'personagens', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'notas', coalesce(n.texto, ''),
          'historia', jsonb_build_object(
            'texto', coalesce(h.texto, ''),
            'personalidade', coalesce(h.personalidade, ''),
            'objetivo', coalesce(h.objetivo, '')
          )
        ) order by p.ordem
      )
      from public.personagens p
      left join public.notas_mestre n on n.personagem_id = p.id
      left join public.historias_personagens h on h.personagem_id = p.id
      where p.mesa_id = ms.id
    ), '[]'::jsonb)
  ) into v_resultado
  from public.mesas ms where ms.id = p_mesa;

  if v_resultado is null then raise exception 'Mesa não encontrada'; end if;
  insert into public.acessos_super_mestre (user_id, origem, acao, mesa_id)
  values (auth.uid(), inet_client_addr(), 'observar_mesa', p_mesa);
  return v_resultado;
end $$;

revoke all on function public.listar_mesas_observacao() from public;
revoke all on function public.observar_mesa(uuid) from public;
grant execute on function public.listar_mesas_observacao() to authenticated;
grant execute on function public.observar_mesa(uuid) to authenticated;

commit;
