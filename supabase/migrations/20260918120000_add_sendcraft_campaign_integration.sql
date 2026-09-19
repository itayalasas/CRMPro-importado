/*
  # SendCraft integration for Campaigns

  ## Why
  Campaign sending moves from direct SMTP (nodemailer) to SendCraft's
  POST /notify (bulk email API). This requires:

  1. `campaigns.sendcraft_job_id` - the job id returned by SendCraft's
     /notify endpoint, used to poll GET /notify/:job_id for per-recipient
     status (sent/failed) and to power native retries via retry_job_id.

  2. `email_templates.sendcraft_template_name` - SendCraft has no public
     API to list or create templates yet; templates are authored in the
     SendCraft dashboard and referenced here by name. The local html_body
     editor becomes a visual reference/staging tool, not the source of
     truth for what gets sent.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'sendcraft_job_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN sendcraft_job_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'sendcraft_template_name'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN sendcraft_template_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_sendcraft_job_id ON campaigns(sendcraft_job_id);
