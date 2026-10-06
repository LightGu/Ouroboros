-- v27 — autoria confiável, rolagem secreta exclusiva do mestre e limites de carga.

drop policy if exists rolagens_criar on public.rolagens;
create policy rolagens_criar on public.rolagens for insert to authenticated
  with check (
    public.eh_membro(mesa_id)
    and autor_id = auth.uid()
    and (not secreta or public.eh_mestre(mesa_id))
  );

-- A interface monta a rolagem, mas identidade, horário e limites são garantidos
-- no banco para impedir falsificação do autor e cargas excessivas pela API.
create or replace function public.validar_rolagem()
returns trigger language plpgsql set search_path = public as $$
begin
  NEW.autor_id := auth.uid();
  select nome into NEW.autor_nome from public.perfis where id = auth.uid();
  NEW.autor_nome := coalesce(NEW.autor_nome, 'Agente');
  NEW.criado_em := now();

  if NEW.secreta and not public.eh_mestre(NEW.mesa_id) then
    raise exception 'Só o mestre pode fazer rolagens secretas';
  end if;
  if length(trim(NEW.rotulo)) not between 1 and 200
     or length(coalesce(NEW.formula, '')) > 500
     or length(coalesce(NEW.personagem_nome, '')) > 200
     or cardinality(NEW.dados) > 100
     or cardinality(NEW.descartados) > 100 then
    raise exception 'Rolagem fora dos limites permitidos';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_validar_rolagem on public.rolagens;
create trigger trg_validar_rolagem before insert on public.rolagens
for each row execute function public.validar_rolagem();
