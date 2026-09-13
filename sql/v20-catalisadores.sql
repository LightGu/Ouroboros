-- Restaura a divisão do catálogo. Depois, execute catalogo/seed-itens.sql
-- para carregar as descrições revisadas. Não altera inventários das fichas.
begin;
update public.itens_catalogo set grupo = 'Catalisadores'
where grupo = 'Catalisador'
  or (livro = 'Sobrevivendo ao Horror' and nome in ('Ampliador', 'Perturbador', 'Potencializador', 'Prolongador'))
  or (livro = 'Arquivos Secretos 2' and nome = 'Catalisador Sofisticado e Horrorizado');
update public.itens_catalogo set grupo = 'Itens paranormais'
where livro = 'Sobrevivendo ao Horror'
  and nome in ('Ligação Direta Infernal', 'Medidor de Condição Vertebral', 'Pendrive selado', 'Pé de Morto', 'Valete da Salvação');
-- Estas células da coluna Elemento foram extraídas como nomes de itens.
delete from public.itens_catalogo where livro = 'Sobrevivendo ao Horror'
  and nome in ('Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo');
commit;
