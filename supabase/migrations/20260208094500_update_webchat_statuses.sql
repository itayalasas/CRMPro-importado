/*
  # Update WebChat statuses
*/

ALTER TABLE webchat_conversations
  DROP CONSTRAINT IF EXISTS webchat_conversations_status_check;

ALTER TABLE webchat_conversations
  ADD CONSTRAINT webchat_conversations_status_check
  CHECK (status IN ('open', 'assigned', 'taken', 'resolved', 'closed'));
