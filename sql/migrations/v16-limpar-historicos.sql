-- Limpeza dos históricos da mesa, exclusiva do mestre.
begin;
alter table public.mesas add column if not exists logs_limpos_em timestamptz;
alter table public.mesas add column if not exists rolagens_limpas_em timestamptz;
create or replace function public.limpar_historico(p_mesa uuid, p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare corte timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not exists (
    select 1 from public.mesas where id = p_mesa and mestre_id = auth.uid()
  ) then raise exception 'Somente o mestre pode limpar o histórico.'; end if;
  if p_tipo = 'logs' then
    delete from public.logs where mesa_id = p_mesa and criado_em <= corte;
    update public.mesas set logs_limpos_em = corte where id = p_mesa;
  elsif p_tipo = 'rolagens' then
    delete from public.rolagens where mesa_id = p_mesa and criado_em <= corte;
    update public.mesas set rolagens_limpas_em = corte where id = p_mesa;
  else raise exception 'Histórico inválido.';
  end if;
end $$;
revoke all on function public.limpar_historico(uuid, text) from public;
grant execute on function public.limpar_historico(uuid, text) to authenticated;
commit;
