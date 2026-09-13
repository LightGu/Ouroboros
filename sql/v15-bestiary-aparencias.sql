-- Atualização das imagens sem duplicar o acervo privado existente.
begin;
alter table public.bestiary add column if not exists image_revision integer not null default 1 check (image_revision > 0);
grant update (image_path, image_revision, notes) on public.bestiary to authenticated;
drop policy if exists bestiary_update on public.bestiary;
create policy bestiary_update on public.bestiary for update to authenticated
using (owner_id = auth.uid() and public.pode_usar_bestiario())
with check (owner_id = auth.uid() and public.pode_usar_bestiario());
commit;
