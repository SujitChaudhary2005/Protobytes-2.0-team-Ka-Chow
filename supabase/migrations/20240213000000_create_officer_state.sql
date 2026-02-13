-- Create the officer_state table to track selected UPAs per user
CREATE TABLE IF NOT EXISTS public.officer_state (
    user_id UUID PRIMARY KEY,
    selected_upa_address TEXT NOT NULL,
    selected_intent_code TEXT,
    last_qr_payload JSONB,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.officer_state ENABLE ROW LEVEL SECURITY;

-- Allow public access (Demo Mode) or restrict based on auth.uid()
-- For the hackathon demo, we often allow public access or match user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'officer_state' AND policyname = 'Enable access for all users'
    ) THEN
        CREATE POLICY "Enable access for all users" ON public.officer_state FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
