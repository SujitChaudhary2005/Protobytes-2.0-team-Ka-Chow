-- ============================================
-- UPA-NP — Storage Bucket for NID Card Images
-- Supabase SQL Editor — Run this in Supabase Dashboard
-- ============================================

-- Create the storage bucket for NID card images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nid-images',
  'nid-images',
  true,                          -- public so NID images are accessible via URL
  2097152,                       -- 2 MB max per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read NID images (for verification display)
CREATE POLICY "Public read access for NID images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nid-images');

-- Allow authenticated users to upload NID images (for admin/system)
CREATE POLICY "Authenticated users can upload NID images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'nid-images' AND auth.role() = 'authenticated');

-- Allow service role to manage NID images
CREATE POLICY "Service role can manage NID images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'nid-images');

-- Note: Upload NID images with the following naming convention:
-- Format: {nid-number}.jpg  (e.g., "123-456-789.jpg", "RAM-KTM-1990-4521.jpg")
-- 
-- Example images to upload:
-- - 123-456-789.jpg        (Tyler Durden)
-- - RAM-KTM-1990-4521.jpg  (Ram Bahadur Thapa)
-- - SITA-PKR-1995-7832.jpg (Sita Sharma)
-- - HARI-LTP-1988-3214.jpg (Hari Prasad Gurung)
