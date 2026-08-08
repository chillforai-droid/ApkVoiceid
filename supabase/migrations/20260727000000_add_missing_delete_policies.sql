-- ==========================================================================
-- Fix: deletes (and message edits) appeared to succeed in the UI but
-- reverted after a page refresh.
--
-- Root cause: RLS is enabled on `messages` and `contacts`, but no DELETE
-- policy was ever created for either table (and no UPDATE policy for
-- `messages`). The frontend uses the public anon key, so every request is
-- subject to RLS.
--
-- With RLS enabled and zero policies for a given command, Postgres denies
-- that command by default -- but a DELETE/UPDATE that matches zero rows is
-- NOT an error from PostgREST/supabase-js's point of view. The request
-- comes back with `error: null` and an empty result set. The frontend code
-- only checked `error`, saw none, and optimistically removed the item from
-- local state -- so the UI looked correct until the next fetch pulled the
-- untouched row back from the database.
--
-- This migration is purely additive: it does not touch existing SELECT/
-- INSERT/UPDATE policies, tables, or data.
-- ==========================================================================

-- messages: allow the sender to delete their own message
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = sender_id);

-- messages: allow the sender to edit their own message (the edit/update
-- flow in ChatPage.tsx has the identical symptom for the same reason --
-- there was never an UPDATE policy on this table).
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);

-- contacts: allow either party in a contact row to delete it. This covers
-- "remove contact", "reject request", and "unblock user" -- all of which
-- issue a DELETE on this table from the client.
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = responder_id);

-- Secondary fix uncovered by the same audit: ChatPage.tsx subscribes to
-- realtime DELETE events on `messages` filtered by conversation_id, so the
-- *other* participant's screen updates live when a message is deleted.
-- Postgres' default REPLICA IDENTITY only includes the primary key (`id`)
-- in the DELETE payload's `old` record, so `conversation_id` is missing and
-- the realtime filter never matches -- the other participant only sees the
-- message disappear on their next full refetch, not live. REPLICA IDENTITY
-- FULL makes the complete old row available to the filter.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
