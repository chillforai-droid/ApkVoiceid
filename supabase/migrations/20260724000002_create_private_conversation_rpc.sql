-- RPC to create a private conversation securely
CREATE OR REPLACE FUNCTION public.create_private_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    existing_conv_id UUID;
    new_conv_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- 1. Validate auth
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Validate input
    IF other_user_id = current_user_id THEN
        RAISE EXCEPTION 'Cannot create conversation with yourself';
    END IF;

    -- 3. Verify other user exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_user_id) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- 4. Check if conversation already exists
    SELECT cm1.conversation_id INTO existing_conv_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = current_user_id
      AND cm2.user_id = other_user_id
      AND NOT EXISTS (
          SELECT 1 FROM public.conversation_members cm3
          WHERE cm3.conversation_id = cm1.conversation_id
          AND cm3.user_id NOT IN (current_user_id, other_user_id)
      );

    IF existing_conv_id IS NOT NULL THEN
        RETURN existing_conv_id;
    END IF;

    -- 5. Create new conversation
    INSERT INTO public.conversations (is_group) VALUES (FALSE) RETURNING id INTO new_conv_id;

    -- 6. Insert members
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (new_conv_id, current_user_id), (new_conv_id, other_user_id);

    RETURN new_conv_id;
END;
$$;

-- Grant execution to authenticated users
REVOKE ALL ON FUNCTION public.create_private_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_private_conversation(UUID) TO authenticated;

-- Policies for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = conversations.id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" ON public.conversations
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversation memberships" ON public.conversation_members;
CREATE POLICY "Users can view own conversation memberships" ON public.conversation_members
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert conversation memberships" ON public.conversation_members;
CREATE POLICY "Users can insert conversation memberships" ON public.conversation_members
    FOR INSERT TO authenticated WITH CHECK (true);
