-- Propuesta basada en el esquema inspeccionado el 2026-09-15.
-- NO aplicada automaticamente por pnpm fotos (ni por --dry-run).
begin;

create table public.producto_imagenes (
  id uuid primary key default gen_random_uuid(),
  id_item text not null references public.producto_extra(id_item),
  foto_url text not null check (foto_url ~ '^https://'),
  orden integer not null check (orden > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_item, orden)
);

alter table public.producto_imagenes enable row level security;
revoke all on public.producto_imagenes from anon, authenticated;
grant select on public.producto_imagenes to anon, authenticated;
grant all on public.producto_imagenes to service_role;
create policy "Lectura de imagenes de productos visibles"
on public.producto_imagenes for select to anon, authenticated
using (exists (
  select 1 from public.producto_extra e
  where e.id_item = producto_imagenes.id_item and e.visible
));

-- Conserva fotos anteriores al adoptar la tabla (no hay fotos actualmente).
insert into public.producto_imagenes (id_item, foto_url, orden)
select id_item, foto_url, 1 from public.producto_extra
where foto_url is not null and foto_url ~ '^https://';

-- Una sola transaccion para registrar la galeria y mantener compatible la
-- imagen principal de la tienda. Nunca modifica visible ni nota.
create function public.register_product_image(
  p_id_item text, p_foto_url text, p_orden integer
) returns public.producto_imagenes
language plpgsql security invoker set search_path = '' as $$
declare
  result public.producto_imagenes;
begin
  if p_id_item is null or p_id_item !~ '^[0-9]+$'
    or p_orden is null or p_orden < 1
    or p_foto_url is null or p_foto_url !~ '^https://' then
    raise exception 'Parametros de imagen invalidos';
  end if;

  insert into public.producto_extra (id_item)
  values (p_id_item) on conflict (id_item) do nothing;

  insert into public.producto_imagenes (id_item, foto_url, orden)
  values (p_id_item, p_foto_url, p_orden)
  on conflict (id_item, orden) do update
    set foto_url = excluded.foto_url, updated_at = now()
  returning * into result;

  if p_orden = 1 then
    update public.producto_extra
    set foto_url = p_foto_url, updated_at = now()
    where id_item = p_id_item;
  end if;
  return result;
end;
$$;
revoke all on function public.register_product_image(text, text, integer) from public, anon, authenticated;
grant execute on function public.register_product_image(text, text, integer) to service_role;

commit;
