-- Cleanup duplicated inbox emails and enforce uniqueness at DB level

BEGIN;

-- 1) Remove duplicate rows keeping the newest per (account_id, message_id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, message_id
      ORDER BY email_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM inbox_emails
  WHERE message_id IS NOT NULL AND btrim(message_id) <> ''
)
DELETE FROM inbox_emails ie
USING ranked r
WHERE ie.id = r.id
  AND r.rn > 1;

-- 2) Ensure canonical uniqueness exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inbox_emails_account_id_message_id_key'
      AND conrelid = 'inbox_emails'::regclass
  ) THEN
    ALTER TABLE inbox_emails
      ADD CONSTRAINT inbox_emails_account_id_message_id_key UNIQUE (account_id, message_id);
  END IF;
END $$;

COMMIT;
