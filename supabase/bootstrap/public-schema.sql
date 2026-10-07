-- Esquema público observado el 2026-10-07. Solo para un proyecto NUEVO y vacío.
-- Sin datos de clientes, contadores, credenciales ni objetos de Storage.
-- Incluye el estado de las dos migraciones de fotos existentes; no volver a aplicarlas.
BEGIN;
SET LOCAL check_function_bodies = false;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') THEN
    RAISE EXCEPTION 'Bootstrap reservado para un esquema public vacío. No ejecutar en producción.';
  END IF;
END $$;

CREATE TABLE public."contador_pedido" (
  "anio" integer NOT NULL,
  "ultimo" integer DEFAULT 0 NOT NULL
);
ALTER TABLE public."contador_pedido" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."contador_pedido" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."pedido" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "numero" text NOT NULL,
  "estado" text DEFAULT 'pendiente'::text NOT NULL,
  "comprador_nombre" text NOT NULL,
  "comprador_email" text NOT NULL,
  "comprador_telefono" text NOT NULL,
  "comprador_documento" text,
  "envio_departamento" text,
  "envio_ciudad" text NOT NULL,
  "envio_direccion" text NOT NULL,
  "envio_notas" text,
  "subtotal" integer NOT NULL,
  "costo_envio" integer DEFAULT 0 NOT NULL,
  "total" integer NOT NULL,
  "pasarela" text,
  "referencia_pago" text,
  "transaccion_id" text,
  "metodo_pago" text,
  "pagado_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."pedido" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."pedido" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."pedido_item" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "pedido_id" uuid NOT NULL,
  "id_item" text NOT NULL,
  "descripcion" text NOT NULL,
  "precio_unitario" integer NOT NULL,
  "cantidad" integer NOT NULL,
  "subtotal" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."pedido_item" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."pedido_item" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."product_image_import_lock" (
  "name" text NOT NULL,
  "owner" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
ALTER TABLE public."product_image_import_lock" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."product_image_import_lock" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."producto_extra" (
  "id_item" text NOT NULL,
  "foto_url" text,
  "visible" boolean DEFAULT true NOT NULL,
  "nota" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."producto_extra" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."producto_extra" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."producto_imagen_importaciones" (
  "source_key" text NOT NULL,
  "id_item" text NOT NULL,
  "orden" integer NOT NULL,
  "source_name" text NOT NULL,
  "observed_version" text NOT NULL,
  "published_version" text,
  "published_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."producto_imagen_importaciones" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."producto_imagen_importaciones" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."producto_imagen_intentos" (
  "source_key" text NOT NULL,
  "source_version" text NOT NULL,
  "sha256" text NOT NULL,
  "storage_path" text NOT NULL,
  "uploaded_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."producto_imagen_intentos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."producto_imagen_intentos" FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public."producto_imagenes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_item" text NOT NULL,
  "foto_url" text NOT NULL,
  "orden" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."producto_imagenes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."producto_imagenes" FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public."contador_pedido" ADD CONSTRAINT "contador_pedido_pkey" PRIMARY KEY (anio);
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_costo_envio_check" CHECK ((costo_envio >= 0));
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'fallido'::text, 'cancelado'::text, 'reembolsado'::text])));
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_numero_key" UNIQUE (numero);
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_pkey" PRIMARY KEY (id);
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_subtotal_check" CHECK ((subtotal >= 0));
ALTER TABLE public."pedido" ADD CONSTRAINT "pedido_total_check" CHECK ((total >= 0));
ALTER TABLE public."pedido_item" ADD CONSTRAINT "pedido_item_cantidad_check" CHECK ((cantidad > 0));
ALTER TABLE public."pedido_item" ADD CONSTRAINT "pedido_item_pkey" PRIMARY KEY (id);
ALTER TABLE public."pedido_item" ADD CONSTRAINT "pedido_item_precio_unitario_check" CHECK ((precio_unitario >= 0));
ALTER TABLE public."pedido_item" ADD CONSTRAINT "pedido_item_subtotal_check" CHECK ((subtotal >= 0));
ALTER TABLE public."product_image_import_lock" ADD CONSTRAINT "product_image_import_lock_name_check" CHECK ((name = 'products'::text));
ALTER TABLE public."product_image_import_lock" ADD CONSTRAINT "product_image_import_lock_pkey" PRIMARY KEY (name);
ALTER TABLE public."producto_extra" ADD CONSTRAINT "producto_extra_pkey" PRIMARY KEY (id_item);
ALTER TABLE public."producto_imagen_importaciones" ADD CONSTRAINT "producto_imagen_importaciones_id_item_check" CHECK ((id_item ~ '^[0-9]+$'::text));
ALTER TABLE public."producto_imagen_importaciones" ADD CONSTRAINT "producto_imagen_importaciones_id_item_orden_key" UNIQUE (id_item, orden);
ALTER TABLE public."producto_imagen_importaciones" ADD CONSTRAINT "producto_imagen_importaciones_orden_check" CHECK ((orden >= 1));
ALTER TABLE public."producto_imagen_importaciones" ADD CONSTRAINT "producto_imagen_importaciones_pkey" PRIMARY KEY (source_key);
ALTER TABLE public."producto_imagen_importaciones" ADD CONSTRAINT "producto_imagen_importaciones_source_key_check" CHECK ((source_key ~ '^[A-Za-z0-9_-]+$'::text));
ALTER TABLE public."producto_imagen_intentos" ADD CONSTRAINT "producto_imagen_intentos_pkey" PRIMARY KEY (source_key, source_version, sha256);
ALTER TABLE public."producto_imagen_intentos" ADD CONSTRAINT "producto_imagen_intentos_sha256_check" CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public."producto_imagenes" ADD CONSTRAINT "producto_imagenes_foto_url_check" CHECK ((foto_url ~ '^https://'::text));
ALTER TABLE public."producto_imagenes" ADD CONSTRAINT "producto_imagenes_id_item_orden_key" UNIQUE (id_item, orden);
ALTER TABLE public."producto_imagenes" ADD CONSTRAINT "producto_imagenes_orden_check" CHECK ((orden > 0));
ALTER TABLE public."producto_imagenes" ADD CONSTRAINT "producto_imagenes_pkey" PRIMARY KEY (id);
ALTER TABLE public."pedido_item" ADD CONSTRAINT "pedido_item_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE;
ALTER TABLE public."producto_imagen_intentos" ADD CONSTRAINT "producto_imagen_intentos_source_key_fkey" FOREIGN KEY (source_key) REFERENCES producto_imagen_importaciones(source_key);
ALTER TABLE public."producto_imagenes" ADD CONSTRAINT "producto_imagenes_id_item_fkey" FOREIGN KEY (id_item) REFERENCES producto_extra(id_item);
CREATE INDEX idx_pedido_created_at ON public.pedido USING btree (created_at DESC);
CREATE INDEX idx_pedido_estado ON public.pedido USING btree (estado);
CREATE INDEX idx_pedido_referencia_pago ON public.pedido USING btree (referencia_pago);
CREATE INDEX idx_pedido_item_pedido_id ON public.pedido_item USING btree (pedido_id);
CREATE INDEX product_image_attempt_paths ON public.producto_imagen_intentos USING btree (storage_path);
CREATE INDEX product_image_pending_attempts ON public.producto_imagen_intentos USING btree (created_at) WHERE (completed_at IS NULL);

CREATE OR REPLACE FUNCTION public.acquire_product_image_import_lock(p_owner uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare acquired boolean;
begin
  insert into public.product_image_import_lock(name, owner, expires_at)
  values ('products', p_owner, now() + interval '2 hours')
  on conflict (name) do update set owner = excluded.owner, expires_at = excluded.expires_at
    where product_image_import_lock.expires_at < now() or product_image_import_lock.owner = p_owner
  returning true into acquired;
  return coalesce(acquired, false);
end; $function$
;

CREATE OR REPLACE FUNCTION public.assert_product_image_import_lock(p_owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists(select 1 from public.product_image_import_lock
    where name = 'products' and owner = p_owner and expires_at > now()) then
    raise exception 'Import lock missing or expired';
  end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.complete_drive_product_image(p_owner uuid, p_source_key text, p_version text, p_sha256 text, p_foto_url text)
 RETURNS producto_imagen_importaciones
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.confirm_drive_image_upload(p_owner uuid, p_source_key text, p_version text, p_sha256 text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.assert_product_image_import_lock(p_owner);
  update public.producto_imagen_intentos set uploaded_at=now(),updated_at=now(),last_error=null
    where source_key=p_source_key and source_version=p_version and sha256=p_sha256;
  if not found then raise exception 'Missing upload intent'; end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.generate_numero_pedido()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  -- Se usa la zona horaria de Colombia para que el año no cambie
  -- antes de tiempo por la diferencia con UTC el 31 de diciembre
  v_anio integer := extract(year from (now() at time zone 'America/Bogota'));
  v_ultimo integer;
begin
  insert into contador_pedido (anio, ultimo)
  values (v_anio, 1)
  on conflict (anio) do update
    set ultimo = contador_pedido.ultimo + 1
  returning ultimo into v_ultimo;

  return 'BB-' || v_anio::text || '-' || lpad(v_ultimo::text, 5, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_drive_product_image(p_owner uuid, p_source_key text, p_version text, p_sha256 text, p_storage_path text)
 RETURNS producto_imagen_intentos
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.register_product_image(p_id_item text, p_foto_url text, p_orden integer)
 RETURNS producto_imagenes
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.release_product_image_import_lock(p_owner uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  delete from public.product_image_import_lock where name = 'products' and owner = p_owner;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_drive_product_images(p_owner uuid, p_files jsonb)
 RETURNS SETOF producto_imagen_importaciones
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.touch_product_image_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin new.updated_at := now(); return new; end; $function$
;
CREATE TRIGGER product_images_updated_at BEFORE UPDATE ON public.producto_imagenes FOR EACH ROW EXECUTE FUNCTION touch_product_image_timestamp();
CREATE POLICY "Lectura publica de producto_extra" ON public."producto_extra" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Lectura de imagenes de productos visibles" ON public."producto_imagenes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((EXISTS ( SELECT 1
   FROM producto_extra e
  WHERE ((e.id_item = producto_imagenes.id_item) AND e.visible))));
GRANT DELETE ON public."contador_pedido" TO "anon";
GRANT INSERT ON public."contador_pedido" TO "anon";
GRANT REFERENCES ON public."contador_pedido" TO "anon";
GRANT SELECT ON public."contador_pedido" TO "anon";
GRANT TRIGGER ON public."contador_pedido" TO "anon";
GRANT TRUNCATE ON public."contador_pedido" TO "anon";
GRANT UPDATE ON public."contador_pedido" TO "anon";
GRANT DELETE ON public."contador_pedido" TO "authenticated";
GRANT INSERT ON public."contador_pedido" TO "authenticated";
GRANT REFERENCES ON public."contador_pedido" TO "authenticated";
GRANT SELECT ON public."contador_pedido" TO "authenticated";
GRANT TRIGGER ON public."contador_pedido" TO "authenticated";
GRANT TRUNCATE ON public."contador_pedido" TO "authenticated";
GRANT UPDATE ON public."contador_pedido" TO "authenticated";
GRANT DELETE ON public."contador_pedido" TO "service_role";
GRANT INSERT ON public."contador_pedido" TO "service_role";
GRANT REFERENCES ON public."contador_pedido" TO "service_role";
GRANT SELECT ON public."contador_pedido" TO "service_role";
GRANT TRIGGER ON public."contador_pedido" TO "service_role";
GRANT TRUNCATE ON public."contador_pedido" TO "service_role";
GRANT UPDATE ON public."contador_pedido" TO "service_role";
GRANT DELETE ON public."pedido" TO "anon";
GRANT INSERT ON public."pedido" TO "anon";
GRANT REFERENCES ON public."pedido" TO "anon";
GRANT SELECT ON public."pedido" TO "anon";
GRANT TRIGGER ON public."pedido" TO "anon";
GRANT TRUNCATE ON public."pedido" TO "anon";
GRANT UPDATE ON public."pedido" TO "anon";
GRANT DELETE ON public."pedido" TO "authenticated";
GRANT INSERT ON public."pedido" TO "authenticated";
GRANT REFERENCES ON public."pedido" TO "authenticated";
GRANT SELECT ON public."pedido" TO "authenticated";
GRANT TRIGGER ON public."pedido" TO "authenticated";
GRANT TRUNCATE ON public."pedido" TO "authenticated";
GRANT UPDATE ON public."pedido" TO "authenticated";
GRANT DELETE ON public."pedido" TO "service_role";
GRANT INSERT ON public."pedido" TO "service_role";
GRANT REFERENCES ON public."pedido" TO "service_role";
GRANT SELECT ON public."pedido" TO "service_role";
GRANT TRIGGER ON public."pedido" TO "service_role";
GRANT TRUNCATE ON public."pedido" TO "service_role";
GRANT UPDATE ON public."pedido" TO "service_role";
GRANT DELETE ON public."pedido_item" TO "anon";
GRANT INSERT ON public."pedido_item" TO "anon";
GRANT REFERENCES ON public."pedido_item" TO "anon";
GRANT SELECT ON public."pedido_item" TO "anon";
GRANT TRIGGER ON public."pedido_item" TO "anon";
GRANT TRUNCATE ON public."pedido_item" TO "anon";
GRANT UPDATE ON public."pedido_item" TO "anon";
GRANT DELETE ON public."pedido_item" TO "authenticated";
GRANT INSERT ON public."pedido_item" TO "authenticated";
GRANT REFERENCES ON public."pedido_item" TO "authenticated";
GRANT SELECT ON public."pedido_item" TO "authenticated";
GRANT TRIGGER ON public."pedido_item" TO "authenticated";
GRANT TRUNCATE ON public."pedido_item" TO "authenticated";
GRANT UPDATE ON public."pedido_item" TO "authenticated";
GRANT DELETE ON public."pedido_item" TO "service_role";
GRANT INSERT ON public."pedido_item" TO "service_role";
GRANT REFERENCES ON public."pedido_item" TO "service_role";
GRANT SELECT ON public."pedido_item" TO "service_role";
GRANT TRIGGER ON public."pedido_item" TO "service_role";
GRANT TRUNCATE ON public."pedido_item" TO "service_role";
GRANT UPDATE ON public."pedido_item" TO "service_role";
GRANT DELETE ON public."product_image_import_lock" TO "service_role";
GRANT INSERT ON public."product_image_import_lock" TO "service_role";
GRANT REFERENCES ON public."product_image_import_lock" TO "service_role";
GRANT SELECT ON public."product_image_import_lock" TO "service_role";
GRANT TRIGGER ON public."product_image_import_lock" TO "service_role";
GRANT TRUNCATE ON public."product_image_import_lock" TO "service_role";
GRANT UPDATE ON public."product_image_import_lock" TO "service_role";
GRANT DELETE ON public."producto_extra" TO "anon";
GRANT INSERT ON public."producto_extra" TO "anon";
GRANT REFERENCES ON public."producto_extra" TO "anon";
GRANT SELECT ON public."producto_extra" TO "anon";
GRANT TRIGGER ON public."producto_extra" TO "anon";
GRANT TRUNCATE ON public."producto_extra" TO "anon";
GRANT UPDATE ON public."producto_extra" TO "anon";
GRANT DELETE ON public."producto_extra" TO "authenticated";
GRANT INSERT ON public."producto_extra" TO "authenticated";
GRANT REFERENCES ON public."producto_extra" TO "authenticated";
GRANT SELECT ON public."producto_extra" TO "authenticated";
GRANT TRIGGER ON public."producto_extra" TO "authenticated";
GRANT TRUNCATE ON public."producto_extra" TO "authenticated";
GRANT UPDATE ON public."producto_extra" TO "authenticated";
GRANT DELETE ON public."producto_extra" TO "service_role";
GRANT INSERT ON public."producto_extra" TO "service_role";
GRANT REFERENCES ON public."producto_extra" TO "service_role";
GRANT SELECT ON public."producto_extra" TO "service_role";
GRANT TRIGGER ON public."producto_extra" TO "service_role";
GRANT TRUNCATE ON public."producto_extra" TO "service_role";
GRANT UPDATE ON public."producto_extra" TO "service_role";
GRANT DELETE ON public."producto_imagen_importaciones" TO "service_role";
GRANT INSERT ON public."producto_imagen_importaciones" TO "service_role";
GRANT REFERENCES ON public."producto_imagen_importaciones" TO "service_role";
GRANT SELECT ON public."producto_imagen_importaciones" TO "service_role";
GRANT TRIGGER ON public."producto_imagen_importaciones" TO "service_role";
GRANT TRUNCATE ON public."producto_imagen_importaciones" TO "service_role";
GRANT UPDATE ON public."producto_imagen_importaciones" TO "service_role";
GRANT DELETE ON public."producto_imagen_intentos" TO "service_role";
GRANT INSERT ON public."producto_imagen_intentos" TO "service_role";
GRANT REFERENCES ON public."producto_imagen_intentos" TO "service_role";
GRANT SELECT ON public."producto_imagen_intentos" TO "service_role";
GRANT TRIGGER ON public."producto_imagen_intentos" TO "service_role";
GRANT TRUNCATE ON public."producto_imagen_intentos" TO "service_role";
GRANT UPDATE ON public."producto_imagen_intentos" TO "service_role";
GRANT SELECT ON public."producto_imagenes" TO "anon";
GRANT SELECT ON public."producto_imagenes" TO "authenticated";
GRANT DELETE ON public."producto_imagenes" TO "service_role";
GRANT INSERT ON public."producto_imagenes" TO "service_role";
GRANT REFERENCES ON public."producto_imagenes" TO "service_role";
GRANT SELECT ON public."producto_imagenes" TO "service_role";
GRANT TRIGGER ON public."producto_imagenes" TO "service_role";
GRANT TRUNCATE ON public."producto_imagenes" TO "service_role";
GRANT UPDATE ON public."producto_imagenes" TO "service_role";
REVOKE ALL ON FUNCTION public.generate_numero_pedido() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_product_image(text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.touch_product_image_timestamp() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.acquire_product_image_import_lock(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_product_image_import_lock(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_product_image_import_lock(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_drive_product_images(uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_drive_product_image(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.confirm_drive_image_upload(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_drive_product_image(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_numero_pedido() TO "service_role";
GRANT EXECUTE ON FUNCTION public.register_product_image(text,text,integer) TO "service_role";
GRANT EXECUTE ON FUNCTION public.touch_product_image_timestamp() TO "service_role";
GRANT EXECUTE ON FUNCTION public.acquire_product_image_import_lock(uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.assert_product_image_import_lock(uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.release_product_image_import_lock(uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.reserve_drive_product_images(uuid,jsonb) TO "service_role";
GRANT EXECUTE ON FUNCTION public.prepare_drive_product_image(uuid,text,text,text,text) TO "service_role";
GRANT EXECUTE ON FUNCTION public.confirm_drive_image_upload(uuid,text,text,text) TO "service_role";
GRANT EXECUTE ON FUNCTION public.complete_drive_product_image(uuid,text,text,text,text) TO "service_role";
COMMIT;
