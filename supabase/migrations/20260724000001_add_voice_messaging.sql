-- Add voice messaging columns to messages table
ALTER TABLE IF EXISTS public.messages 
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS server_delete_after TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS storage_deleted_at TIMESTAMPTZ;

-- Constraints for voice messages
ALTER TABLE public.messages 
ADD CONSTRAINT valid_voice_metadata CHECK (
    (content_type <> 'voice') OR (
        storage_path IS NOT NULL AND
        duration > 0 AND duration <= 120 AND
        mime_type IS NOT NULL
    )
);

-- Message Receipts table
CREATE TABLE IF NOT EXISTS public.message_receipts (
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    delivered_at TIMESTAMPTZ,
    played_at TIMESTAMPTZ,
    local_persist_confirmed_at TIMESTAMPTZ,
    PRIMARY KEY (message_id, user_id)
);

-- RLS for receipts
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select receipts for own conversations" ON public.message_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE m.id = message_receipts.message_id AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert receipts for own conversations" ON public.message_receipts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE m.id = message_id AND cm.user_id = auth.uid() AND m.sender_id <> auth.uid()
        )
    );

CREATE POLICY "Users can update own receipts" ON public.message_receipts
    FOR UPDATE USING (
        auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE m.id = message_id AND cm.user_id = auth.uid()
        )
    );

-- Trigger for voice expiry
CREATE OR REPLACE FUNCTION public.voiceid_set_voice_expiry_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content_type = 'voice' THEN
        NEW.expires_at := now() + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS voiceid_set_voice_expiry_before_insert ON public.messages;
CREATE TRIGGER voiceid_set_voice_expiry_before_insert
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE PROCEDURE public.voiceid_set_voice_expiry_before_insert();

-- RPC for delivery
CREATE OR REPLACE FUNCTION public.acknowledge_voice_delivery(p_message_id UUID)
RETURNS VOID AS $$
DECLARE
    v_conversation_id UUID;
    v_sender_id UUID;
BEGIN
    SELECT conversation_id, sender_id INTO v_conversation_id, v_sender_id 
    FROM public.messages WHERE id = p_message_id AND content_type = 'voice';

    IF NOT FOUND OR v_sender_id = auth.uid() OR NOT EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id = v_conversation_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized or invalid message';
    END IF;

    INSERT INTO public.message_receipts (message_id, user_id, delivered_at, local_persist_confirmed_at)
    VALUES (p_message_id, auth.uid(), now(), now())
    ON CONFLICT (message_id, user_id) DO UPDATE SET
        delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
        local_persist_confirmed_at = COALESCE(message_receipts.local_persist_confirmed_at, EXCLUDED.local_persist_confirmed_at);

    UPDATE public.messages
    SET server_delete_after = now() + INTERVAL '24 hours'
    WHERE id = p_message_id AND server_delete_after IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC for played
CREATE OR REPLACE FUNCTION public.acknowledge_voice_played(p_message_id UUID)
RETURNS VOID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    SELECT conversation_id INTO v_conversation_id 
    FROM public.messages WHERE id = p_message_id AND content_type = 'voice';

    IF NOT FOUND OR NOT EXISTS (
        SELECT 1 FROM public.conversation_members 
        WHERE conversation_id = v_conversation_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE public.message_receipts
    SET played_at = COALESCE(played_at, now())
    WHERE message_id = p_message_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages-temp', 'voice-messages-temp', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policies
-- SELECT: Users can read if they are members of the conversation
DROP POLICY IF EXISTS "Users can select own voice messages" ON storage.objects;
CREATE POLICY "Users can select own voice messages" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'voice-messages-temp' AND
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE m.storage_path = name AND cm.user_id = auth.uid()
        )
    );

-- INSERT: Users can upload if they are sender and members of the conversation
DROP POLICY IF EXISTS "Users can insert own voice messages" ON storage.objects;
CREATE POLICY "Users can insert own voice messages" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'voice-messages-temp' AND
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE m.storage_path = name AND m.sender_id = auth.uid() AND cm.user_id = auth.uid()
        )
    );
