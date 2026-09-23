/*
# Create storage bucket for evidence photos

1. Create a public storage bucket called 'evidencias' for temperature reading photos.
2. Add storage policies allowing authenticated users to upload and read photos.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to evidencias"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidencias');

-- Allow anyone to read (public bucket)
CREATE POLICY "Allow public read of evidencias"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'evidencias');

-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated update of evidencias"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidencias' AND owner = auth.uid())
WITH CHECK (bucket_id = 'evidencias' AND owner = auth.uid());

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated delete of evidencias"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidencias' AND owner = auth.uid());