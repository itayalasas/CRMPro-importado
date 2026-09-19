/*
  # Variables personalizadas por campaña

  ## Why
  Cada template de SendCraft puede pedir variables que no dependen del contacto
  (ej: sender_name, signup_url, support_email, trial_days) además de las que el
  CRM ya completa automáticamente por contacto (client_name, company_name,
  client_email, client_phone, unsubscribe_url) o por campaña (campaign_name,
  current_date, crm_company, company_url). Estas variables "extra" se cargan una
  vez por campaña desde el modal de "Nueva Campaña" y se envían como shared_data
  a SendCraft en cada envío.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'custom_variables'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN custom_variables jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
