/*
  # CRM Tasks and Agenda Foundation

  Adds a reusable task table for client follow-ups, meetings, and agenda items.
  Also expands client interaction types so timeline events can track task lifecycle.
*/

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number text NOT NULL UNIQUE DEFAULT (
    'TSK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.sales_quotes(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'follow_up' CHECK (
    task_type IN ('call', 'email', 'meeting', 'follow_up', 'payment', 'delivery', 'other')
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')
  ),
  assigned_to uuid,
  created_by uuid,
  due_at timestamptz,
  scheduled_at timestamptz,
  reminder_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS task_number text,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.crm_tasks
  ALTER COLUMN task_number SET DEFAULT (
    'TSK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  ALTER COLUMN task_type SET DEFAULT 'follow_up',
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.crm_tasks
SET
  task_number = COALESCE(
    NULLIF(trim(task_number), ''),
    'TSK-' || to_char(COALESCE(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(COALESCE(id::text, gen_random_uuid()::text), '-', ''), 1, 8))
  ),
  title = COALESCE(NULLIF(trim(title), ''), 'Tarea sin título'),
  description = NULLIF(trim(description), ''),
  task_type = CASE
    WHEN task_type IN ('call', 'email', 'meeting', 'follow_up', 'payment', 'delivery', 'other') THEN task_type
    ELSE 'follow_up'
  END,
  priority = CASE
    WHEN priority IN ('low', 'medium', 'high', 'urgent') THEN priority
    ELSE 'medium'
  END,
  status = CASE
    WHEN status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled') THEN status
    ELSE 'open'
  END,
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE
  task_number IS NULL
  OR trim(task_number) = ''
  OR title IS NULL
  OR trim(title) = ''
  OR task_type IS NULL
  OR task_type NOT IN ('call', 'email', 'meeting', 'follow_up', 'payment', 'delivery', 'other')
  OR priority IS NULL
  OR priority NOT IN ('low', 'medium', 'high', 'urgent')
  OR status IS NULL
  OR status NOT IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.crm_tasks
  ALTER COLUMN task_number SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN task_type SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_tasks'
      AND constraint_name = 'crm_tasks_client_id_fkey'
  ) THEN
    ALTER TABLE public.crm_tasks
      ADD CONSTRAINT crm_tasks_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_tasks'
      AND constraint_name = 'crm_tasks_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.crm_tasks
      ADD CONSTRAINT crm_tasks_opportunity_id_fkey
      FOREIGN KEY (opportunity_id) REFERENCES public.sales_opportunities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_tasks'
      AND constraint_name = 'crm_tasks_quote_id_fkey'
  ) THEN
    ALTER TABLE public.crm_tasks
      ADD CONSTRAINT crm_tasks_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_tasks'
      AND constraint_name = 'crm_tasks_order_id_fkey'
  ) THEN
    ALTER TABLE public.crm_tasks
      ADD CONSTRAINT crm_tasks_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_client_id ON public.crm_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_opportunity_id ON public.crm_tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_quote_id ON public.crm_tasks(quote_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_order_id ON public.crm_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_priority ON public.crm_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_at ON public.crm_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_scheduled_at ON public.crm_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON public.crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_created_at ON public.crm_tasks(created_at);

ALTER TABLE public.crm_tasks DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_interactions
  ADD COLUMN IF NOT EXISTS task_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_interactions'
      AND constraint_name = 'client_interactions_task_id_fkey'
  ) THEN
    ALTER TABLE public.client_interactions
      ADD CONSTRAINT client_interactions_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.crm_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_interactions_task_id ON public.client_interactions(task_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_interactions'
      AND constraint_name = 'client_interactions_type_check'
  ) THEN
    ALTER TABLE public.client_interactions DROP CONSTRAINT client_interactions_type_check;
  END IF;

  ALTER TABLE public.client_interactions
    ADD CONSTRAINT client_interactions_type_check
    CHECK (
      type IN (
        'call',
        'email',
        'meeting',
        'note',
        'order',
        'invoice',
        'lead_created',
        'quote_requested',
        'opportunity_created',
        'quote_created',
        'quote_converted',
        'stage_changed',
        'quote_sent',
        'quote_accepted',
        'quote_rejected',
        'quote_expired',
        'task_created',
        'task_completed',
        'task_rescheduled',
        'task_overdue'
      )
    );
END $$;

