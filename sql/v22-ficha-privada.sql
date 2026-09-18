-- Fichas novas e legadas ficam privadas por padrão; mestre e dono sempre veem.
drop policy if exists pers_ler on public.personagens;
create policy pers_ler on public.personagens for select to authenticated
  using (public.eh_membro(mesa_id) and (not oculto or public.eh_mestre(mesa_id))
    and (public.eh_mestre(mesa_id) or dono_id = auth.uid()
         or coalesce(dados->>'fichaPrivada', 'true') <> 'true'));

drop policy if exists pers_criar on public.personagens;
create policy pers_criar on public.personagens for insert to authenticated
  with check (
    public.eh_membro(mesa_id)
    and (not rapido or public.eh_mestre(mesa_id))
    and (not oculto or public.eh_mestre(mesa_id))
    and (public.eh_mestre(mesa_id) or dono_id = auth.uid()
         or coalesce(dados->>'fichaPrivada', 'true') <> 'true')
  );

drop policy if exists historias_ler on public.historias_personagens;
create policy historias_ler on public.historias_personagens for select to authenticated
using (exists (
  select 1 from public.personagens p
  where p.id = personagem_id and p.mesa_id = historias_personagens.mesa_id
    and public.eh_membro(p.mesa_id)
    and (public.eh_mestre(p.mesa_id) or p.dono_id = auth.uid()
         or (coalesce(p.dados->>'fichaPrivada', 'true') <> 'true'
             and p.dados->'historiaPublica' = 'true'::jsonb))
));