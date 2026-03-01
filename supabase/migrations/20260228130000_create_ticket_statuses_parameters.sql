/*
  # Create Ticket Statuses Parameters

  1. New table
    - `ticket_statuses`
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `name` (text)
      - `color` (text)
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow authenticated users to read and manage rows

  3. Compatibility
    - Normalize existing `tickets.status` values
    - Enforce allowed technical status codes
*/

CREATE TABLE IF NOT EXISTS ticket_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_statuses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_statuses'
      AND policyname = 'Anyone can view active ticket statuses'
  ) THEN
    CREATE POLICY "Anyone can view active ticket statuses"
      ON ticket_statuses FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_statuses'
      AND policyname = 'Authenticated users can manage ticket statuses'
  ) THEN
    CREATE POLICY "Authenticated users can manage ticket statuses"
      ON ticket_statuses FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_statuses_code ON ticket_statuses(code);
CREATE INDEX IF NOT EXISTS idx_ticket_statuses_is_active ON ticket_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_ticket_statuses_sort_order ON ticket_statuses(sort_order);

INSERT INTO ticket_statuses (code, name, color, sort_order, is_active) VALUES
  ('open', 'Abierto', '#ef4444', 1, true),
  ('in_progress', 'En Progreso', '#3b82f6', 2, true),
  ('waiting', 'En Espera', '#eab308', 3, true),
  ('resolved', 'Resuelto', '#10b981', 4, true),
  ('closed', 'Cerrado', '#64748b', 5, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

UPDATE tickets
SET status = 'open'
WHERE status IS NULL
   OR status NOT IN ('open', 'in_progress', 'waiting', 'resolved', 'closed');

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname
  INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'tickets'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status IN%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tickets DROP CONSTRAINT %I', existing_constraint);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'tickets'
      AND con.conname = 'tickets_status_check'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_status_check
      CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed'));
  END IF;
END $$;
