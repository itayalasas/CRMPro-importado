/*
  # Add WebChat cause and result fields
*/

ALTER TABLE webchat_conversations
  ADD COLUMN IF NOT EXISTS cause text,
  ADD COLUMN IF NOT EXISTS cause_custom text,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS result_notes text;
