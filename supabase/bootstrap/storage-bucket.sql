-- Configuración del bucket observada el 2026-10-07. Solo para un proyecto NUEVO.
-- No incluye objetos: recuperar las fotos desde su copia/Drive con el importador.
-- Un bucket público permite descargar fotos, no escribirlas con anon.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('productos', 'productos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);
COMMIT;
