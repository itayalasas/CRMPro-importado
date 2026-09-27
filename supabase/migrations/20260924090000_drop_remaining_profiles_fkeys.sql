/*
  # Eliminar foreign keys a profiles pendientes (contact_groups, campaigns, email_templates)

  ## Why
  20251012170118_fix_contact_groups_created_by_nullable.sql quito el NOT NULL de
  created_by en estas tres tablas para que funcionaran con auth externo, pero nunca
  elimino la propia foreign key hacia profiles(id) (a diferencia de
  20251012191922_remove_all_profiles_foreign_keys.sql, que si lo hizo para clients,
  invoices, calls, tickets, ticket_comments, client_interactions y system_settings).

  El resultado: crear un grupo de contactos (o una campana, o una plantilla) SI manda
  un created_by (el id del usuario externo, via `if (user?.id) { data.created_by =
  user.id }` en el frontend) rompe con "violates foreign key constraint
  contact_groups_created_by_fkey" porque ese id de auth externo no existe en profiles.
  Mismo patron de fix que la migracion de 2025-10-12, aplicado a las tres tablas que
  quedaron afuera.

  De paso, `contacts` (destinatarios de campana, ContactsManager.tsx) tiene el mismo
  problema latente: su created_by tambien referencia profiles(id) y nunca fue
  liberado, asi que "Agregar Contacto" e "Importar CSV" van a fallar igual apenas
  created_by lleve un id real de auth externo.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contact_groups_created_by_fkey' AND table_name = 'contact_groups'
  ) THEN
    ALTER TABLE contact_groups DROP CONSTRAINT contact_groups_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'campaigns_created_by_fkey' AND table_name = 'campaigns'
  ) THEN
    ALTER TABLE campaigns DROP CONSTRAINT campaigns_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_templates_created_by_fkey' AND table_name = 'email_templates'
  ) THEN
    ALTER TABLE email_templates DROP CONSTRAINT email_templates_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contacts_created_by_fkey' AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_created_by_fkey;
  END IF;
END $$;
