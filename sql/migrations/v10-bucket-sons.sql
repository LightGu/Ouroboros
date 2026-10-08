-- ============================================================
-- v10 — bucket de áudio
-- Estava no bloco v3, mas aquela execução do schema.sql abortou antes de
-- chegar aqui (erro de assinatura em minhas_mesas). Sem o bucket, subir som
-- dá "Bucket not found" — e listar não acusa nada, porque bucket inexistente
-- devolve lista vazia em vez de erro.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('sons', 'sons', true, 20971520)          -- 20 MB por arquivo
on conflict (id) do update set public = true, file_size_limit = 20971520;

do $$
begin
  drop policy if exists sons_storage_ler    on storage.objects;
  drop policy if exists sons_storage_enviar on storage.objects;
  drop policy if exists sons_storage_apagar on storage.objects;

  create policy sons_storage_ler    on storage.objects for select using (bucket_id = 'sons');
  create policy sons_storage_enviar on storage.objects for insert to authenticated with check (bucket_id = 'sons');
  create policy sons_storage_apagar on storage.objects for delete to authenticated using (bucket_id = 'sons');
exception when insufficient_privilege then
  raise notice 'Sem permissão nas policies de storage. Crie as regras do bucket "sons" pelo painel.';
end $$;

-- confere: tem que listar 'retratos' e 'sons'
select id, public, file_size_limit from storage.buckets order by id;
