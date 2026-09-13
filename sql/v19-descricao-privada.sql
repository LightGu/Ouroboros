-- Execute antes de atualizar o site. A mesma visibilidade protege os três campos.
begin;
alter table public.historias_personagens add column if not exists personalidade text not null default '';
alter table public.historias_personagens add column if not exists objetivo text not null default '';

-- Migra apenas campos ainda presentes no JSON compartilhado. Reexecutar não apaga dados privados.
insert into public.historias_personagens as historia (personagem_id, mesa_id, texto, personalidade, objetivo)
select id, mesa_id, coalesce(dados->'descricao'->>'historico', ''),
  coalesce(dados->'descricao'->>'personalidade', ''), coalesce(dados->'descricao'->>'objetivo', '')
from public.personagens
on conflict (personagem_id) do update set
  personalidade = case when (select p.dados->'descricao' ? 'personalidade' from public.personagens p where p.id = excluded.personagem_id)
    then excluded.personalidade else historia.personalidade end,
  objetivo = case when (select p.dados->'descricao' ? 'objetivo' from public.personagens p where p.id = excluded.personagem_id)
    then excluded.objetivo else historia.objetivo end;

create or replace function public.separar_historia_personagem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(NEW.dados->'descricao', '{}'::jsonb) ?| array['historico', 'personalidade', 'objetivo'] then
    insert into public.historias_personagens as historia (personagem_id, mesa_id, texto, personalidade, objetivo)
    values (NEW.id, NEW.mesa_id, coalesce(NEW.dados->'descricao'->>'historico', ''),
      coalesce(NEW.dados->'descricao'->>'personalidade', ''), coalesce(NEW.dados->'descricao'->>'objetivo', ''))
    on conflict (personagem_id) do update set
      texto = case when NEW.dados->'descricao' ? 'historico' then excluded.texto else historia.texto end,
      personalidade = case when NEW.dados->'descricao' ? 'personalidade' then excluded.personalidade else historia.personalidade end,
      objetivo = case when NEW.dados->'descricao' ? 'objetivo' then excluded.objetivo else historia.objetivo end,
      mesa_id = excluded.mesa_id;
  end if;
  NEW.dados := NEW.dados #- '{descricao,historico}' #- '{descricao,personalidade}' #- '{descricao,objetivo}';
  return NEW;
end $$;

update public.personagens
set dados = dados #- '{descricao,personalidade}' #- '{descricao,objetivo}'
where dados->'descricao' ?| array['personalidade', 'objetivo'];
-- A policy historias_ler da v13 já protege a linha inteira para dono/mestre ou história pública.
commit;
