-- Separa itens paranormais dos amaldiçoados e equipamentos no catálogo.
-- Pode ser executado novamente; preserva estatísticas e itens das fichas.
begin;
update public.itens_catalogo as item
set grupo = 'Itens paranormais'
from (values
  ('Amarras elementais', 'Livro Básico'),
  ('Ampliador', 'Sobrevivendo ao Horror'),
  ('Catalisador Sofisticado e Horrorizado', 'Arquivos Secretos 2'),
  ('Conhecimento', 'Sobrevivendo ao Horror'),
  ('Crânio Dominador', 'Arquivos Secretos 3'),
  ('Energia', 'Sobrevivendo ao Horror'),
  ('Gaiola do Corvo', 'Arquivos Secretos 3'),
  ('Ligação Direta Infernal', 'Sobrevivendo ao Horror'),
  ('Medidor de Condição Vertebral', 'Sobrevivendo ao Horror'),
  ('Medo', 'Sobrevivendo ao Horror'),
  ('Morte', 'Sobrevivendo ao Horror'),
  ('Pendrive selado', 'Sobrevivendo ao Horror'),
  ('Perturbador', 'Sobrevivendo ao Horror'),
  ('Potencializador', 'Sobrevivendo ao Horror'),
  ('Prolongador', 'Sobrevivendo ao Horror'),
  ('Pé de Morto', 'Sobrevivendo ao Horror'),
  ('Sangue', 'Sobrevivendo ao Horror'),
  ('Valete da Salvação', 'Sobrevivendo ao Horror')
) as corrigidos(nome, livro)
where item.nome = corrigidos.nome and item.livro = corrigidos.livro;
commit;
