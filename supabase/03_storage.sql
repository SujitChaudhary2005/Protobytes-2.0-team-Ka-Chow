-- ============================================
-- UPA-NP — Storage Bucket for QR Codes
-- Supabase SQL Editor — Run after 02_seed.sql
-- ============================================

-- Create the storage bucket for QR code images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-codes',
  'qr-codes',
  true,                          -- public so QR images are accessible via URL
  524288,                        -- 512 KB max per file
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read QR images (they need to be scannable via URL)
CREATE POLICY "Public read access for QR codes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qr-codes');

-- Allow authenticated users to upload QR images
CREATE POLICY "Authenticated users can upload QR codes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qr-codes');

-- Allow anon uploads too (service uses anon key)
CREATE POLICY "Anon can upload QR codes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qr-codes');

-- Allow overwriting existing QR images
CREATE POLICY "Allow update QR codes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'qr-codes');
