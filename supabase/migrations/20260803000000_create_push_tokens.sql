-- push_tokens: one row per user, holding their current device's FCM token, used by
-- api/send-call-push.ts (triggered by a Database Webhook on calls INSERT) to wake the
-- Android app for an incoming call even when it's backgrounded or killed.
CREATE TABLE public.push_tokens (
    user_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Each user can only manage their own token row. The server side (api/send-call-push.ts)
-- reads this table with the Supabase service-role key, which bypasses RLS entirely, so no
-- SELECT policy for "the other party in a call" is needed here.
CREATE POLICY "Users can view own push token" ON public.push_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own push token" ON public.push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push token" ON public.push_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push token" ON public.push_tokens
    FOR DELETE USING (auth.uid() = user_id);
