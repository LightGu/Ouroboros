-- v24 — fecha alterações de ficha reservadas ao mestre
-- Jogador cria e edita apenas ficha própria, normal, visível e dentro de uma mesa da qual participa.

drop policy if exists pers_criar  on public.personagens;
drop policy if exists pers_editar on public.personagens;

create policy pers_criar on public.personagens for insert to authenticated
  with check (
    public.eh_membro(mesa_id)
    and (not rapido or public.eh_mestre(mesa_id))
    and (not oculto or public.eh_mestre(mesa_id))
    and (public.eh_mestre(mesa_id) or dono_id = auth.uid())
  );

create policy pers_editar on public.personagens for update to authenticated
  using (public.eh_mestre(mesa_id) or dono_id = auth.uid())
  with check (
    public.eh_membro(mesa_id)
    and (public.eh_mestre(mesa_id)
      or (dono_id = auth.uid() and not rapido and not oculto))
  );

create or replace function public.bloquear_troca_mesa_personagem()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.mesa_id <> OLD.mesa_id then
    raise exception 'Não é permitido mover personagem entre mesas';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_bloquear_troca_mesa_personagem on public.personagens;
create trigger trg_bloquear_troca_mesa_personagem
  before update on public.personagens
  for each row execute function public.bloquear_troca_mesa_personagem();
