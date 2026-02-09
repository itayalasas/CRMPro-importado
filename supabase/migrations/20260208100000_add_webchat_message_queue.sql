-- Create queue for webchat messages before agent request
CREATE TABLE IF NOT EXISTS public.webchat_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('visitor', 'bot', 'system')),
  sender_name text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz NOT NULL DEFAULT now(),
  source_domain text,
  source_channel text,
  source_detail text,
  page_url text
);

CREATE INDEX IF NOT EXISTS webchat_message_queue_session_id_idx
  ON public.webchat_message_queue (session_id);

CREATE INDEX IF NOT EXISTS webchat_message_queue_created_at_idx
  ON public.webchat_message_queue (created_at);
