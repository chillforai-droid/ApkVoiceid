-- Create notifications table
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT NOT NULL, -- 'contact_request', 'new_message'
    related_id UUID, -- id of contact request or message
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to create conversation on contact acceptance
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

    -- Add notification
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (NEW.requester_id, 'Contact Accepted', 'Your contact request was accepted!', 'contact_request', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_contact_acceptance
AFTER UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.handle_contact_acceptance();
