-- Allow anon users to upload/read webchat attachments (widget/CRM without Supabase auth)
CREATE POLICY "Anon can upload webchat attachments"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'webchat-attachments');

CREATE POLICY "Anon can read webchat attachments"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'webchat-attachments');
