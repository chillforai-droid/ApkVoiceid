-- user_settings existed with correct RLS for reading/writing your OWN row,
-- but nothing anywhere else in the app ever checked another user's
-- contact_requests / calls / voice_messages preference before letting an
-- action reach them — the settings were stored but inert.
--
-- We can't fix this by widening the SELECT policy on user_settings: that
-- would let any authenticated user read another user's full settings row,
-- including unrelated notification preferences. Instead this adds a
-- SECURITY DEFINER function that answers a single yes/no question about
-- one specific interaction, without exposing the underlying row.
--
-- 'contacts_of_contacts' (contact_requests only) is treated as satisfied
-- when the requester is already an accepted contact of the target, OR
-- shares at least one mutual accepted contact with them.
CREATE OR REPLACE FUNCTION public.can_user_receive(p_owner_id UUID, p_kind TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_requester UUID := auth.uid();
    v_setting TEXT;
    v_is_contact BOOLEAN;
BEGIN
    IF v_requester IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_requester = p_owner_id THEN
        RETURN TRUE;
    END IF;

    IF p_kind NOT IN ('contact_request', 'call', 'voice_message') THEN
        RAISE EXCEPTION 'Invalid kind: %', p_kind;
    END IF;

    SELECT
        CASE p_kind
            WHEN 'contact_request' THEN contact_requests
            WHEN 'call' THEN calls
            WHEN 'voice_message' THEN voice_messages
        END
    INTO v_setting
    FROM public.user_settings
    WHERE user_id = p_owner_id;

    -- No settings row yet (lazily created) — fall back to the same
    -- defaults declared on the table itself.
    IF v_setting IS NULL THEN
        v_setting := CASE p_kind WHEN 'contact_request' THEN 'everyone' ELSE 'contacts' END;
    END IF;

    IF v_setting = 'everyone' THEN
        RETURN TRUE;
    END IF;

    IF v_setting = 'nobody' THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE status = 'accepted'
        AND ((requester_id = v_requester AND responder_id = p_owner_id)
          OR (requester_id = p_owner_id AND responder_id = v_requester))
    ) INTO v_is_contact;

    IF v_setting = 'contacts' THEN
        RETURN v_is_contact;
    END IF;

    -- 'contacts_of_contacts' (contact_requests only)
    IF v_is_contact THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.contacts c1
        JOIN public.contacts c2 ON
            (c1.requester_id = c2.requester_id OR c1.requester_id = c2.responder_id
             OR c1.responder_id = c2.requester_id OR c1.responder_id = c2.responder_id)
        WHERE c1.status = 'accepted' AND c2.status = 'accepted'
        AND (c1.requester_id = v_requester OR c1.responder_id = v_requester)
        AND (c2.requester_id = p_owner_id OR c2.responder_id = p_owner_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_user_receive(UUID, TEXT) TO authenticated;
