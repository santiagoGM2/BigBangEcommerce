begin;

-- Identidad y posicion permanentes. El ERP vive en MariaDB: no se inventa una FK hacia el catalogo.
create table public.producto_imagen_importaciones (
  source_key text primary key check (source_key ~ '^[A-Za-z0-9_-]+$'),
  id_item text not null check (id_item ~ '^[0-9]+$'),
  orden integer not null check (orden >= 1),
  source_name text not null,
  observed_version text not null,
  published_version text,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_item, orden)
);

-- Diario antes de Storage: conserva incluso intentos cuya respuesta de red se perdio.
create table public.producto_imagen_intentos (
  source_key text not null references public.producto_imagen_importaciones(source_key),
  source_version text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null,
  uploaded_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_key, source_version, sha256)
);
create index product_image_pending_attempts on public.producto_imagen_intentos(created_at)
  where completed_at is null;
create index product_image_attempt_paths on public.producto_imagen_intentos(storage_path);

create table public.product_image_import_lock (
  name text primary key check (name = 'products'),
  owner uuid not null,
  expires_at timestamptz not null
);

alter table public.producto_imagen_importaciones enable row level security;
alter table public.producto_imagen_intentos enable row level security;
alter table public.product_image_import_lock enable row level security;
revoke all on public.producto_imagen_importaciones, public.producto_imagen_intentos,
  public.product_image_import_lock from public, anon, authenticated;
grant all on public.producto_imagen_importaciones, public.producto_imagen_intentos,
  public.product_image_import_lock to service_role;

create function public.acquire_product_image_import_lock(p_owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare acquired boolean;
begin
  insert into public.product_image_import_lock(name, owner, expires_at)
  values ('products', p_owner, now() + interval '2 hours')
  on conflict (name) do update set owner = excluded.owner, expires_at = excluded.expires_at
    where product_image_import_lock.expires_at < now() or product_image_import_lock.owner = p_owner
  returning true into acquired;
  return coalesce(acquired, false);
end; $$;

create function public.assert_product_image_import_lock(p_owner uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.product_image_import_lock
    where name = 'products' and owner = p_owner and expires_at > now()) then
    raise exception 'Import lock missing or expired';
  end if;
end; $$;

create function public.release_product_image_import_lock(p_owner uuid) returns void
language sql security invoker set search_path = '' as $$
  delete from public.product_image_import_lock where name = 'products' and owner = p_owner;
$$;

create function public.reserve_drive_product_images(p_owner uuid, p_files jsonb)
returns setof public.producto_imagen_importaciones
language plpgsql security invoker set search_path = '' as $$
declare entry jsonb; result public.producto_imagen_importaciones; chosen integer; product_id text;
begin
  perform public.assert_product_image_import_lock(p_owner);
  perform pg_catalog.pg_advisory_xact_lock(734228110);
  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'Invalid reservation batch';
  end if;
  if jsonb_array_length(p_files) > 1000 then
    raise exception 'Invalid reservation batch';
  end if;
  for entry in select value from jsonb_array_elements(p_files) loop
    product_id := entry->>'id_item';
    if product_id is null or product_id !~ '^[0-9]+$' or
       coalesce(entry->>'source_key','') !~ '^[A-Za-z0-9_-]+$' or
       coalesce(entry->>'source_version','') = '' or coalesce(entry->>'source_name','') = '' or
       coalesce((entry->>'orden')::integer,0) < 1 then raise exception 'Invalid source'; end if;
    select * into result from public.producto_imagen_importaciones
      where source_key = entry->>'source_key' for update;
    if found then
      if result.id_item <> product_id then raise exception 'Source renamed to another product: manual review required'; end if;
      update public.producto_imagen_importaciones set source_name = entry->>'source_name',
        observed_version = entry->>'source_version', updated_at = now()
        where source_key = result.source_key returning * into result;
    else
      chosen := (entry->>'orden')::integer;
      if chosen is null then raise exception 'Order is required'; end if;
      if exists(select 1 from public.producto_imagenes where id_item=product_id and orden=chosen)
        or exists(select 1 from public.producto_imagen_importaciones where id_item=product_id and orden=chosen) then
        chosen := 2;
        while exists(select 1 from public.producto_imagenes where id_item=product_id and orden=chosen)
          or exists(select 1 from public.producto_imagen_importaciones where id_item=product_id and orden=chosen) loop
          if chosen = 2147483647 then raise exception 'No image slot available'; end if;
          chosen := chosen + 1;
        end loop;
      end if;
      insert into public.producto_imagen_importaciones(source_key,id_item,orden,source_name,observed_version)
      values(entry->>'source_key',product_id,chosen,entry->>'source_name',entry->>'source_version') returning * into result;
    end if;
    return next result;
  end loop;
end; $$;

create function public.prepare_drive_product_image(p_owner uuid, p_source_key text, p_version text,
  p_sha256 text, p_storage_path text) returns public.producto_imagen_intentos
language plpgsql security invoker set search_path = '' as $$
declare source public.producto_imagen_importaciones; result public.producto_imagen_intentos; basename text;
begin
  perform public.assert_product_image_import_lock(p_owner);
  select * into strict source from public.producto_imagen_importaciones where source_key=p_source_key for update;
  if source.observed_version <> p_version then raise exception 'Source version changed'; end if;
  basename := source.id_item || case when source.orden=1 then '' else '-' || (source.orden-1)::text end || '.webp';
  if p_storage_path <> 'drive/' || p_source_key || '/' || p_sha256 || '/' || basename then
    raise exception 'Invalid deterministic storage path';
  end if;
  insert into public.producto_imagen_intentos(source_key,source_version,sha256,storage_path)
  values(p_source_key,p_version,p_sha256,p_storage_path)
  on conflict (source_key,source_version,sha256) do update set updated_at=now()
  returning * into result;
  return result;
end; $$;

create function public.confirm_drive_image_upload(p_owner uuid,p_source_key text,p_version text,p_sha256 text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.assert_product_image_import_lock(p_owner);
  update public.producto_imagen_intentos set uploaded_at=now(),updated_at=now(),last_error=null
    where source_key=p_source_key and source_version=p_version and sha256=p_sha256;
  if not found then raise exception 'Missing upload intent'; end if;
end; $$;

create function public.complete_drive_product_image(p_owner uuid,p_source_key text,p_version text,
  p_sha256 text,p_foto_url text) returns public.producto_imagen_importaciones
language plpgsql security invoker set search_path = '' as $$
declare source public.producto_imagen_importaciones; attempt public.producto_imagen_intentos;
begin
  perform public.assert_product_image_import_lock(p_owner);
  select * into strict source from public.producto_imagen_importaciones where source_key=p_source_key for update;
  select * into strict attempt from public.producto_imagen_intentos
    where source_key=p_source_key and source_version=p_version and sha256=p_sha256;
  if source.observed_version <> p_version or attempt.uploaded_at is null then raise exception 'Upload not confirmed'; end if;
  if p_foto_url !~ '^https://' or right(p_foto_url,length(attempt.storage_path)) <> attempt.storage_path then
    raise exception 'Published URL does not match intent';
  end if;
  perform public.register_product_image(source.id_item,p_foto_url,source.orden);
  update public.producto_imagen_importaciones set published_version=p_version,published_url=p_foto_url,updated_at=now()
    where source_key=p_source_key returning * into source;
  update public.producto_imagen_intentos set completed_at=now(),updated_at=now(),last_error=null
    where source_key=p_source_key and source_version=p_version and sha256=p_sha256;
  return source;
end; $$;

create function public.touch_product_image_timestamp() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger product_images_updated_at before update on public.producto_imagenes
for each row execute function public.touch_product_image_timestamp();

revoke all on function public.acquire_product_image_import_lock(uuid),
  public.assert_product_image_import_lock(uuid),public.release_product_image_import_lock(uuid),
  public.reserve_drive_product_images(uuid,jsonb),public.prepare_drive_product_image(uuid,text,text,text,text),
  public.confirm_drive_image_upload(uuid,text,text,text),public.complete_drive_product_image(uuid,text,text,text,text),
  public.touch_product_image_timestamp() from public,anon,authenticated;
grant execute on function public.acquire_product_image_import_lock(uuid),
  public.assert_product_image_import_lock(uuid),public.release_product_image_import_lock(uuid),
  public.reserve_drive_product_images(uuid,jsonb),public.prepare_drive_product_image(uuid,text,text,text,text),
  public.confirm_drive_image_upload(uuid,text,text,text),public.complete_drive_product_image(uuid,text,text,text,text)
  to service_role;
commit;
