-- Bestiário pessoal do mestre. Execute no SQL Editor antes de publicar o site.
begin;
create or replace function public.pode_usar_bestiario()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mesas where mestre_id = auth.uid());
$$;
revoke all on function public.pode_usar_bestiario() from public;
grant execute on function public.pode_usar_bestiario() to authenticated;

create table if not exists public.bestiary (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  element text,
  vd integer check (vd >= 0),
  type text,
  tags text[] not null default '{}',
  notes text,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  constraint bestiary_image_owner check (split_part(image_path, '/', 1) = owner_id::text)
);
create index if not exists bestiary_owner_name on public.bestiary (owner_id, name);
alter table public.bestiary enable row level security;
grant select, insert on public.bestiary to authenticated;
drop policy if exists bestiary_read on public.bestiary;
create policy bestiary_read on public.bestiary for select to authenticated
using (owner_id = auth.uid() and public.pode_usar_bestiario());
drop policy if exists bestiary_insert on public.bestiary;
create policy bestiary_insert on public.bestiary for insert to authenticated
with check (owner_id = auth.uid() and public.pode_usar_bestiario());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bestiary-images', 'bestiary-images', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Restritiva também bloqueia este bucket caso exista alguma policy ampla de outro recurso.
drop policy if exists bestiary_storage_guard on storage.objects;
create policy bestiary_storage_guard on storage.objects as restrictive for all to public
using (bucket_id <> 'bestiary-images' or
  (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text))
with check (bucket_id <> 'bestiary-images' or
  (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text));
drop policy if exists bestiary_images_read on storage.objects;
create policy bestiary_images_read on storage.objects for select to authenticated
using (bucket_id = 'bestiary-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.pode_usar_bestiario());
drop policy if exists bestiary_images_insert on storage.objects;
create policy bestiary_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'bestiary-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.pode_usar_bestiario());
-- Permite limpar um upload quando o cadastro falha.
drop policy if exists bestiary_images_delete on storage.objects;
create policy bestiary_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'bestiary-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.pode_usar_bestiario());
commit;
