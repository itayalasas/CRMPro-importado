/*
  # Restaurar grants de anon faltantes en más tablas (rama dev)

  ## Por qué
  Además de las 29 tablas corregidas en 20260921120000 (que tenían RLS
  habilitado), se detectaron 32 tablas más donde el rol `anon` nunca tuvo
  otorgado el GRANT base de SELECT/INSERT/UPDATE/DELETE, aunque RLS ya
  estuviera deshabilitado en ellas. Sin ese grant, PostgREST devuelve
  401/permission denied para el front igual, porque el chequeo de
  privilegios de Postgres es independiente de RLS.

  Mismo criterio que la migración anterior: igualar estas tablas al resto
  del schema (acceso completo para anon, seguridad a nivel de aplicación),
  no una regresión nueva de seguridad respecto a producción (main).
*/

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'calls','campaign_analytics','campaign_email_logs','campaigns',
      'client_interactions','clients','contact_groups','crm_tasks',
      'email_templates','freepbx_config','incoming_calls','invoice_items',
      'invoices','order_items','orders','payment_transactions',
      'sales_opportunities','sales_products','sales_quote_items',
      'sales_quotes','system_users','template_variables','ticket_activity',
      'ticket_attachments','ticket_categories','ticket_comments',
      'ticket_history','tickets','twilio_call_logs','twilio_config',
      'user_sip_extensions','webchat_message_queue'
    ])
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
