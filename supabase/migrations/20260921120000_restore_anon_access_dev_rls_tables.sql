/*
  # Revertir RLS quedado a medias en rama dev

  ## Por qué
  En la rama dev de Supabase se habilitó RLS en 29 tablas con políticas
  `TO authenticated` y se revocaron los grants base de `anon`. El frontend
  de este CRM usa autenticación externa (ver src/lib/externalAuth.ts) y
  nunca llega a PostgREST como `authenticated` — siempre pega como `anon`
  (ver src/lib/supabase.ts, isSupabaseJwt()). Resultado: esas 29 tablas
  quedaron con "permission denied" para el front.

  Esto no es una regresión de seguridad nueva: iguala estas 29 tablas al
  mismo estado (RLS deshabilitado, acceso completo para anon) que ya tiene
  el resto del schema en producción (main), donde la seguridad se maneja
  a nivel de aplicación, no de RLS.

  Pendiente aparte: contacts, profiles y email_accounts deberían migrar a
  un modelo de acceso más restringido (RPC SECURITY DEFINER acotadas, como
  ya se hizo para el unsubscribe público de contacts, o JWT propio firmado
  por el auth externo) — no resuelto en esta migración a propósito, es un
  fix de urgencia para destrabar dev.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'branches','contacts','currencies','email_accounts','email_drafts',
      'email_folders','emails','external_invoice_api_config',
      'external_invoice_validation_log','group_contacts','inbox_emails',
      'invoice_email_queue','invoice_pdf_queue','invoice_statuses',
      'item_types','order_communications_queue','order_statuses',
      'partner_notification_queue','partners','payment_methods',
      'payment_periods','payment_statuses','profiles','revenue_analytics',
      'system_settings','ticket_sla','ticket_statuses',
      'webchat_conversations','webchat_messages'
    ])
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
