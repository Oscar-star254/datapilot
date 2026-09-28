-- Storage bucket policies for 'datasets' bucket
-- Run this after creating the 'datasets' bucket in Supabase Storage

-- Allow authenticated users to upload to their own folder
CREATE POLICY "storage_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own files
CREATE POLICY "storage_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY "storage_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Note: The backend uses service_role key which bypasses RLS for admin operations
