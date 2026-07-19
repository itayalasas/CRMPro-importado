/*
  # Add sales pipeline foundation

  1. New Tables
    - `sales_opportunities`: Commercial pipeline records

  2. Changes
    - Link `webchat_conversations` to clients and opportunities
    - Extend `client_interactions` so it can act as the shared timeline
    - Add indexes and disable RLS for external auth compatibility
*/

-- Create sales opportunities table
CREATE TABLE IF NOT EXISTS public.sales_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_number text NOT NULL UNIQUE DEFAULT (
    'OPP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.webchat_conversations(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'prospect' CHECK (
    stage IN ('prospect', 'contacted', 'meeting', 'quote', 'negotiation', 'won', 'lost')
  ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'archived')),
  expected_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  probability integer NOT NULL DEFAULT 20 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  source_channel text NOT NULL DEFAULT 'webchat_form',
  source_detail text,
  assigned_to uuid,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Make the table tolerant if an older partial version already exists
ALTER TABLE public.sales_opportunities
  ADD COLUMN IF NOT EXISTS opportunity_number text;
ALTER TABLE public.sales_opportunities
  ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.sales_opportunities
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

ALTER TABLE public.sales_opportunities
  ALTER COLUMN opportunity_number SET DEFAULT (
    'OPP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

UPDATE public.sales_opportunities
SET opportunity_number = COALESCE(
  NULLIF(trim(opportunity_number), ''),
  'OPP-' || to_char(COALESCE(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(COALESCE(id::text, gen_random_uuid()::text), '-', ''), 1, 8))
)
WHERE opportunity_number IS NULL OR trim(opportunity_number) = '';

ALTER TABLE public.sales_opportunities
  ALTER COLUMN opportunity_number SET NOT NULL;

ALTER TABLE public.sales_opportunities
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS expected_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS probability integer,
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS source_detail text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.sales_opportunities
  ALTER COLUMN title SET DEFAULT 'Oportunidad comercial',
  ALTER COLUMN stage SET DEFAULT 'prospect',
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN expected_amount SET DEFAULT 0,
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN probability SET DEFAULT 20,
  ALTER COLUMN source_channel SET DEFAULT 'webchat_form',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN last_activity_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.sales_opportunities
SET
  title = COALESCE(NULLIF(trim(title), ''), 'Oportunidad ' || opportunity_number),
  stage = CASE
    WHEN stage IN ('prospect', 'contacted', 'meeting', 'quote', 'negotiation', 'won', 'lost') THEN stage
    ELSE 'prospect'
  END,
  status = CASE
    WHEN status IN ('open', 'won', 'lost', 'archived') THEN status
    ELSE 'open'
  END,
  expected_amount = COALESCE(expected_amount, 0),
  currency = COALESCE(NULLIF(trim(currency), ''), 'USD'),
  probability = CASE
    WHEN probability BETWEEN 0 AND 100 THEN probability
    ELSE 20
  END,
  source_channel = COALESCE(NULLIF(trim(source_channel), ''), 'webchat_form'),
  metadata = COALESCE(metadata, '{}'::jsonb),
  last_activity_at = COALESCE(last_activity_at, updated_at, created_at, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE
  title IS NULL
  OR trim(title) = ''
  OR stage IS NULL
  OR stage NOT IN ('prospect', 'contacted', 'meeting', 'quote', 'negotiation', 'won', 'lost')
  OR status IS NULL
  OR status NOT IN ('open', 'won', 'lost', 'archived')
  OR expected_amount IS NULL
  OR currency IS NULL
  OR trim(currency) = ''
  OR probability IS NULL
  OR probability < 0
  OR probability > 100
  OR source_channel IS NULL
  OR trim(source_channel) = ''
  OR metadata IS NULL
  OR last_activity_at IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.sales_opportunities
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN expected_amount SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN probability SET NOT NULL,
  ALTER COLUMN source_channel SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_opportunities'
      AND constraint_name = 'sales_opportunities_stage_check'
  ) THEN
    ALTER TABLE public.sales_opportunities
      ADD CONSTRAINT sales_opportunities_stage_check
      CHECK (stage IN ('prospect', 'contacted', 'meeting', 'quote', 'negotiation', 'won', 'lost'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_opportunities'
      AND constraint_name = 'sales_opportunities_status_check'
  ) THEN
    ALTER TABLE public.sales_opportunities
      ADD CONSTRAINT sales_opportunities_status_check
      CHECK (status IN ('open', 'won', 'lost', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_opportunities'
      AND constraint_name = 'sales_opportunities_probability_check'
  ) THEN
    ALTER TABLE public.sales_opportunities
      ADD CONSTRAINT sales_opportunities_probability_check
      CHECK (probability >= 0 AND probability <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_opportunities'
      AND constraint_name = 'sales_opportunities_client_id_fkey'
  ) THEN
    ALTER TABLE public.sales_opportunities
      ADD CONSTRAINT sales_opportunities_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_opportunities'
      AND constraint_name = 'sales_opportunities_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.sales_opportunities
      ADD CONSTRAINT sales_opportunities_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.webchat_conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_number ON public.sales_opportunities(opportunity_number);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_client_id ON public.sales_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_conversation_id ON public.sales_opportunities(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_stage ON public.sales_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_status ON public.sales_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_assigned_to ON public.sales_opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_created_at ON public.sales_opportunities(created_at);

ALTER TABLE public.sales_opportunities DISABLE ROW LEVEL SECURITY;

-- Add links from webchat conversations to the CRM
ALTER TABLE public.webchat_conversations
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'webchat_conversations'
      AND constraint_name = 'webchat_conversations_client_id_fkey'
  ) THEN
    ALTER TABLE public.webchat_conversations
      ADD CONSTRAINT webchat_conversations_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'webchat_conversations'
      AND constraint_name = 'webchat_conversations_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.webchat_conversations
      ADD CONSTRAINT webchat_conversations_opportunity_id_fkey
      FOREIGN KEY (opportunity_id) REFERENCES public.sales_opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webchat_conversations_client_id ON public.webchat_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_webchat_conversations_opportunity_id ON public.webchat_conversations(opportunity_id);

-- Reuse client_interactions as the shared timeline for CRM and sales events
ALTER TABLE public.client_interactions
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

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
        'task_created'
      )
    );
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_interactions'
      AND constraint_name = 'client_interactions_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.client_interactions
      ADD CONSTRAINT client_interactions_opportunity_id_fkey
      FOREIGN KEY (opportunity_id) REFERENCES public.sales_opportunities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_interactions'
      AND constraint_name = 'client_interactions_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.client_interactions
      ADD CONSTRAINT client_interactions_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.webchat_conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_interactions_opportunity_id ON public.client_interactions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_conversation_id ON public.client_interactions(conversation_id);

ALTER TABLE public.client_interactions DISABLE ROW LEVEL SECURITY;
