/*
  # Restaurar grants de service_role (rama dev)

  ## Por qué
  20260921120000_restore_anon_access_dev_rls_tables.sql y
  20260921130000_restore_anon_grants_dev_remaining_tables.sql regrantaron
  SELECT/INSERT/UPDATE/DELETE a `anon, authenticated` sobre 61 tablas después
  de que se habilitara RLS por error en esta rama "dev" y se revocaran los
  grants base — pero ninguna de las dos le devolvió el grant a `service_role`.

  Como TODAS las Edge Functions se conectan con SUPABASE_SERVICE_ROLE_KEY
  (rol `service_role`), cualquier función que toque una de esas 61 tablas
  falla con "permission denied for table X" (confirmado en vivo contra
  `campaigns`: send-campaign-emails devolvía 404 "Campaña no encontrada"
  porque el error real de Postgres — 42501, permission denied — quedaba
  enmascarado por el mensaje genérico de "no encontrada").

  ## Fix
  En vez de repetir la misma lista de 61 tablas (y arriesgarse a que quede
  una afuera otra vez), se otorga el grant a nivel de esquema completo, más
  default privileges para que las tablas que se creen de aca en mas ya
  vengan con el grant correcto sin depender de acordarse de agregarlo en
  cada migracion nueva.
*/

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
