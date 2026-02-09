ALTER TABLE IF EXISTS public.webchat_conversations
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS source_detail text;

CREATE INDEX IF NOT EXISTS idx_webchat_conversations_source_channel
  ON public.webchat_conversations (source_channel);

CREATE SEQUENCE IF NOT EXISTS public.webchat_visitor_seq;

CREATE OR REPLACE FUNCTION public.next_webchat_visitor_number()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_num bigint;
BEGIN
  SELECT nextval('public.webchat_visitor_seq') INTO v_num;
  RETURN v_num;
END;
$$;
