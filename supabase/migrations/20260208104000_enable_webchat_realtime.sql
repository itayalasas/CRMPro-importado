-- Enable realtime for webchat tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE webchat_messages;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'webchat_messages already in supabase_realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE webchat_conversations;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'webchat_conversations already in supabase_realtime';
  END;
END $$;
