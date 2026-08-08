-- Create calls table
CREATE TABLE public.calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    caller_id UUID REFERENCES public.profiles(id) NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT CHECK (status IN ('ringing', 'accepted', 'rejected', 'ended', 'missed', 'cancelled', 'failed')) DEFAULT 'ringing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Add RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calls" ON public.calls
    FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert own calls" ON public.calls
    FOR INSERT WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update own calls" ON public.calls
    FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
