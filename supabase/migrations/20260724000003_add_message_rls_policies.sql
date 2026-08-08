-- Add RLS policies for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select messages for their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages into their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );
