-- ==========================================================
-- NOTIFICATION SYSTEM UPGRADE
-- Additive only. Does NOT touch chat, call, or auth logic —
-- only observes existing tables via triggers and hardens the
-- notifications table itself.
-- ==========================================================

-- --------------------------------------------------------
-- 1. SECURITY FIX: notifications had NO row level security.
--    Any authenticated client could read / write / delete
--    every user's notifications. Lock it down to "own rows".
-- --------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Intentionally NO client-side INSERT policy. Notifications are only
-- ever created by SECURITY DEFINER trigger functions below, so a user
-- can never forge a notification "from" another user.

-- --------------------------------------------------------
-- 2. Richer schema for smart navigation + nicer UI, additive only.
-- --------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS secondary_id UUID; -- e.g. exact message id for deep-linking
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = FALSE;

-- --------------------------------------------------------
-- 3. Friend request notification (previously only "accepted" existed,
--    the incoming request itself never created a notification row —
--    NotificationsPage had to separately query `contacts` directly).
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_contact_request()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'pending') THEN
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, related_id)
    VALUES (NEW.responder_id, NEW.requester_id, 'Friend Request', 'Sent you a friend request', 'friend_request', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contact_request ON public.contacts;
CREATE TRIGGER on_contact_request
AFTER INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.handle_contact_request();

-- --------------------------------------------------------
-- 4. Friend accepted notification: keep existing behaviour (conversation
--    creation logic untouched) but use its own type + actor_id so the
--    client can route it to the right place ("friend_accepted" -> profile,
--    distinct from "friend_request" -> requests list).
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_contact_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  existing_conv_id UUID;
BEGIN
  IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
    -- Check if conversation exists
    SELECT cm1.conversation_id INTO existing_conv_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = NEW.requester_id AND cm2.user_id = NEW.responder_id
    LIMIT 1;

    IF existing_conv_id IS NULL THEN
        -- Create new conversation
        INSERT INTO public.conversations (id) VALUES (uuid_generate_v4()) RETURNING id INTO existing_conv_id;
        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES (existing_conv_id, NEW.requester_id),
               (existing_conv_id, NEW.responder_id);
    END IF;

    -- Notify the original requester that their request was accepted
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, related_id)
    VALUES (NEW.requester_id, NEW.responder_id, 'Friend Request Accepted', 'Accepted your friend request', 'friend_accepted', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- 5. New message notification. This was the biggest gap: the client
--    already filters `notifications` by type = 'message' (see
--    ConversationsPage unread badges) but nothing ever created a row
--    with that type, so message notifications never actually fired.
--    secondary_id stores the exact message id so the client can deep
--    link / scroll straight to it.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  preview TEXT;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  preview := CASE
    WHEN NEW.content_type = 'voice' THEN 'Sent a voice message'
    WHEN NEW.content_type = 'image' THEN 'Sent an image'
    ELSE COALESCE(NULLIF(btrim(NEW.content_body), ''), 'Sent a message')
  END;

  INSERT INTO public.notifications (user_id, actor_id, title, message, type, related_id, secondary_id)
  SELECT cm.user_id, NEW.sender_id, COALESCE(sender_name, 'New message'), preview, 'message', NEW.conversation_id, NEW.id
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id != NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_notification();

-- --------------------------------------------------------
-- 6. Missed call notification, pointing the receiver at Call History.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_missed_call_notification()
RETURNS TRIGGER AS $$
DECLARE
  caller_name TEXT;
BEGIN
  IF (NEW.status = 'missed' AND OLD.status IS DISTINCT FROM 'missed') THEN
    SELECT display_name INTO caller_name FROM public.profiles WHERE id = NEW.caller_id;

    INSERT INTO public.notifications (user_id, actor_id, title, message, type, related_id)
    VALUES (NEW.receiver_id, NEW.caller_id, 'Missed Call', COALESCE(caller_name, 'Someone') || ' tried to call you', 'missed_call', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_missed_call_notification ON public.calls;
CREATE TRIGGER on_missed_call_notification
AFTER UPDATE ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.handle_missed_call_notification();
