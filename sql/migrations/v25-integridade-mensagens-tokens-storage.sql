-- v25 — integridade entre mesas e escrita restrita no celular, mapa e Storage.

-- Mensagens: ambos os lados precisam pertencer à mesa; personas também precisam
-- ser da mesma mesa. Mensagens são imutáveis, pois leituras vivem em outra tabela.
drop policy if exists msg_criar on public.mensagens;
drop policy if exists msg_marcar on public.mensagens;
create policy msg_criar on public.mensagens for insert to authenticated
with check (
  public.eh_membro(mesa_id)
  and (
    (de_user = auth.uid() and de_persona is null)
    or (de_user is null and public.eh_mestre(mesa_id) and exists (
      select 1 from public.personas p where p.id = de_persona and p.mesa_id = mensagens.mesa_id
    ))
  )
  and (
    (para_user is not null and para_persona is null and exists (
      select 1 from public.membros mb where mb.mesa_id = mensagens.mesa_id and mb.user_id = para_user
    ))
    or (para_user is null and para_persona is not null and de_persona is null and exists (
      select 1 from public.personas p where p.id = para_persona and p.mesa_id = mensagens.mesa_id
    ))
  )
  and length(trim(texto)) between 1 and 900
);
revoke update on public.mensagens from authenticated;

-- Tokens: garante referências na mesma mesa e impede jogadores de alterar
-- identidade, aparência, visibilidade ou mapa do token durante um UPDATE.
-- RLS autoriza linhas, não colunas. Jogador pode mover o próprio token,
-- mas qualquer outro campo continua reservado ao mestre.
create or replace function public.proteger_token()
returns trigger language plpgsql set search_path = public as $$
declare v_mesa_mapa uuid; v_mesa_personagem uuid;
begin
  select mesa_id into v_mesa_mapa from public.mapas where id = NEW.mapa_id;
  if v_mesa_mapa is distinct from NEW.mesa_id then
    raise exception 'O mapa e o token precisam pertencer à mesma mesa';
  end if;
  if NEW.personagem_id is not null then
    select mesa_id into v_mesa_personagem from public.personagens where id = NEW.personagem_id;
    if v_mesa_personagem is distinct from NEW.mesa_id then
      raise exception 'O personagem e o token precisam pertencer à mesma mesa';
    end if;
  end if;
  if TG_OP = 'UPDATE' and not public.eh_mestre(OLD.mesa_id) and
     (NEW.mapa_id, NEW.mesa_id, NEW.personagem_id, NEW.nome, NEW.imagem,
      NEW.cor, NEW.escala, NEW.oculto)
       is distinct from
     (OLD.mapa_id, OLD.mesa_id, OLD.personagem_id, OLD.nome, OLD.imagem,
      OLD.cor, OLD.escala, OLD.oculto) then
    raise exception 'Jogadores só podem mover o próprio token';
  end if;
  if NEW.x < 0 or NEW.x > 1 or NEW.y < 0 or NEW.y > 1 then
    raise exception 'Posição do token fora do mapa';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_proteger_token on public.tokens;
create trigger trg_proteger_token before insert or update on public.tokens
for each row execute function public.proteger_token();

-- Novos retratos usam mesa/usuario/arquivo. O mestre escreve em toda a própria
-- mesa; jogadores, somente na própria pasta. URLs antigas continuam legíveis.
do $$
begin
  drop policy if exists retratos_enviar on storage.objects;
  drop policy if exists retratos_trocar on storage.objects;
  drop policy if exists retratos_apagar on storage.objects;
  create policy retratos_enviar on storage.objects for insert to authenticated with check (
    bucket_id = 'retratos' and public.eh_membro(((storage.foldername(name))[1])::uuid)
    and (public.eh_mestre(((storage.foldername(name))[1])::uuid)
         or (storage.foldername(name))[2] = auth.uid()::text)
  );
  create policy retratos_trocar on storage.objects for update to authenticated using (
    bucket_id = 'retratos' and public.eh_membro(((storage.foldername(name))[1])::uuid)
    and (public.eh_mestre(((storage.foldername(name))[1])::uuid)
         or (storage.foldername(name))[2] = auth.uid()::text)
  ) with check (
    bucket_id = 'retratos' and public.eh_membro(((storage.foldername(name))[1])::uuid)
    and (public.eh_mestre(((storage.foldername(name))[1])::uuid)
         or (storage.foldername(name))[2] = auth.uid()::text)
  );
  create policy retratos_apagar on storage.objects for delete to authenticated using (
    bucket_id = 'retratos' and public.eh_membro(((storage.foldername(name))[1])::uuid)
    and (public.eh_mestre(((storage.foldername(name))[1])::uuid)
         or (storage.foldername(name))[2] = auth.uid()::text)
  );

  drop policy if exists sons_storage_enviar on storage.objects;
  drop policy if exists sons_storage_apagar on storage.objects;
  create policy sons_storage_enviar on storage.objects for insert to authenticated with check (
    bucket_id = 'sons' and public.eh_mestre(((storage.foldername(name))[1])::uuid)
  );
  create policy sons_storage_apagar on storage.objects for delete to authenticated using (
    bucket_id = 'sons' and public.eh_mestre(((storage.foldername(name))[1])::uuid)
  );
exception when insufficient_privilege then
  raise notice 'Sem permissão para atualizar policies do Storage; aplique-as pelo painel.';
end $$;
