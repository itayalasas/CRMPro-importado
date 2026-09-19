/*
  # Sincronización automática de campañas "sending"

  ## Why
  Una campaña puede quedar en status='sending' indefinidamente si nadie abre el
  modal de monitoreo (CampaignMonitorModal) para disparar el polling manual contra
  SendCraft. Este cron llama periódicamente a la edge function
  sync-pending-campaigns, que recorre TODAS las campañas en 'sending' y las
  resincroniza (GET /notify/:job_id en SendCraft + actualiza campaign_email_logs
  y campaigns), sin depender de que haya un usuario mirando la pantalla.

  ## Extensions
  - pg_cron: para programar el job periódico dentro de Postgres.
  - pg_net: para poder hacer el POST HTTP a la edge function desde el cron.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-pending-campaigns') THEN
    PERFORM cron.unschedule('sync-pending-campaigns');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-pending-campaigns',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://satzkpynnuloncwgxeev.supabase.co/functions/v1/sync-pending-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhdHprcHlubnVsb25jd2d4ZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNTIyMjEsImV4cCI6MjA3NTcyODIyMX0.wAbnVUDMmN2B_HG4DEJS6gL74ume2YbB0pcZ15bOa5k'
    ),
    body := '{}'::jsonb
  );
  $$
);
