-- ============================================================
-- v7 — "Tornar meu personagem"
-- Um personagem sem dono só o mestre edita, então o jogador não conseguiria
-- se apropriar dele por UPDATE normal. Esta função faz isso de forma atômica,
-- e só quando a ficha está mesmo livre.
-- ============================================================

create or replace function public.reivindicar_personagem(p_id uuid, p_cor text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mesa uuid; v_dono uuid;
begin
  if auth.uid() is null then raise exception 'Precisa estar logado'; end if;

  select mesa_id, dono_id into v_mesa, v_dono from personagens where id = p_id;
  if v_mesa is null then raise exception 'Personagem não encontrado'; end if;
  if not public.eh_membro(v_mesa) then raise exception 'Você não está nesta mesa'; end if;
  if v_dono is not null then raise exception 'Este personagem já tem dono'; end if;

  update personagens
     set dono_id = auth.uid(),
         dados   = case when p_cor is null then dados
                        else jsonb_set(dados, '{cor}', to_jsonb(p_cor)) end
   where id = p_id;
  return true;
end $$;

-- O mestre libera uma ficha para os jogadores reivindicarem.
create or replace function public.liberar_personagem(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mesa uuid;
begin
  select mesa_id into v_mesa from personagens where id = p_id;
  if v_mesa is null then raise exception 'Personagem não encontrado'; end if;
  if not public.eh_mestre(v_mesa) then raise exception 'Só o mestre libera fichas'; end if;
  update personagens set dono_id = null where id = p_id;
  return true;
end $$;
