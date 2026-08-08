-- VoiceID: durable delivered/read receipts for all message types.
-- Additive migration: keeps existing voice receipt fields and APIs intact.
ALTER TABLE public.message_receipts
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Allow realtime updates for receipt changes (safe if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_message_delivered(p_message_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = p_message_id
      AND cm.user_id = auth.uid()
      AND m.sender_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized or invalid message';
  END IF;

  INSERT INTO public.message_receipts(message_id, user_id, delivered_at, local_persist_confirmed_at)
  VALUES (p_message_id, auth.uid(), now(), now())
  ON CONFLICT (message_id, user_id) DO UPDATE SET
    delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
    local_persist_confirmed_at = COALESCE(message_receipts.local_persist_confirmed_at, EXCLUDED.local_persist_confirmed_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = p_message_id
      AND cm.user_id = auth.uid()
      AND m.sender_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized or invalid message';
  END IF;

  INSERT INTO public.message_receipts(message_id, user_id, delivered_at, local_persist_confirmed_at, read_at)
  VALUES (p_message_id, auth.uid(), now(), now(), now())
  ON CONFLICT (message_id, user_id) DO UPDATE SET
    delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
    local_persist_confirmed_at = COALESCE(message_receipts.local_persist_confirmed_at, EXCLUDED.local_persist_confirmed_at),
    read_at = COALESCE(message_receipts.read_at, EXCLUDED.read_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
