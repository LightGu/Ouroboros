-- Execute antes de publicar o frontend. Migra histórias existentes como privadas.
begin;
create table if not exists public.historias_personagens (
  personagem_id uuid primary key references public.personagens(id) on delete cascade deferrable initially deferred,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  texto text not null default ''
);
alter table public.historias_personagens enable row level security;
grant select on public.historias_personagens to authenticated;
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
-- Sem policies de escrita: a gravação passa pela permissão da própria ficha.
insert into public.historias_personagens (personagem_id, mesa_id, texto)
select id, mesa_id, coalesce(dados->'descricao'->>'historico', '') from public.personagens
on conflict (personagem_id) do nothing;
update public.personagens
set dados = jsonb_set(dados #- '{descricao,historico}', '{historiaPublica}', 'false'::jsonb)
where dados->'descricao' ? 'historico';

create or replace function public.separar_historia_personagem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.dados->'descricao' ? 'historico' then
    insert into public.historias_personagens (personagem_id, mesa_id, texto)
    values (NEW.id, NEW.mesa_id, coalesce(NEW.dados->'descricao'->>'historico', ''))
    on conflict (personagem_id) do update set texto = excluded.texto, mesa_id = excluded.mesa_id;
  end if;
  NEW.dados := NEW.dados #- '{descricao,historico}';
  return NEW;
end $$;
drop trigger if exists trg_separar_historia on public.personagens;
create trigger trg_separar_historia before insert or update on public.personagens
for each row execute function public.separar_historia_personagem();
commit;
