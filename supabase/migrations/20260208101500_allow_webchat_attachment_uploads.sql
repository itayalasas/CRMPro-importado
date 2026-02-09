-- Allow authenticated users to upload webchat attachments
CREATE POLICY "Authenticated can upload webchat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'webchat-attachments');

CREATE POLICY "Authenticated can read webchat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'webchat-attachments');
