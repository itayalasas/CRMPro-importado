/*
  # Web Chat System

  ## 1. New Tables
    - webchat_conversations
    - webchat_messages

  ## 2. Storage
    - webchat-attachments bucket (public)

  ## 3. Security
    - Enable RLS and allow authenticated access
*/

CREATE TABLE IF NOT EXISTS webchat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  source_domain text,
  page_url text,
  visitor_id text,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'closed')),
  assigned_user_id text,
  assigned_user_name text,
  assigned_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webchat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES webchat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('visitor', 'agent', 'system')),
  sender_id text,
  sender_name text,
  message text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webchat_conversations_status ON webchat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_webchat_conversations_assigned ON webchat_conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_webchat_conversations_last_message ON webchat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_webchat_messages_conversation_id ON webchat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_webchat_messages_created_at ON webchat_messages(created_at DESC);

ALTER TABLE webchat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webchat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read webchat conversations"
  ON webchat_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert webchat conversations"
  ON webchat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update webchat conversations"
  ON webchat_conversations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read webchat messages"
  ON webchat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert webchat messages"
  ON webchat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('webchat-attachments', 'webchat-attachments', true)
ON CONFLICT (id) DO NOTHING;
