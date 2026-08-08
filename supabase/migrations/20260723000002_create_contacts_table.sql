-- Create contacts table
CREATE TABLE public.contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    responder_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "Users can insert own contact requests" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own contact status" ON public.contacts
    FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = responder_id);
