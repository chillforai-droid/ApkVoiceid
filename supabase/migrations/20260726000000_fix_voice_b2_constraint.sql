-- ==========================================================================
-- Fix: voice messages sent via the B2 upload flow could never be inserted.
--
-- Root cause: the `valid_voice_metadata` CHECK constraint added in
-- 20260724000001_add_voice_messaging.sql hard-requires `storage_path`
-- (the old Supabase Storage flow) for every voice message. VoiceRecorder.tsx
-- now uploads voice notes to B2 and only sets `b2_object_key`, so every
-- voice insert violated the constraint and silently failed.
--
-- This migration is purely additive:
--   1. Ensures the B2 metadata columns used across the app (images already
--      rely on these) exist, so this migration is self-contained even on a
--      fresh database.
--   2. Replaces the CHECK constraint with one that accepts EITHER the
--      legacy `storage_path` (Supabase Storage) OR the new `b2_object_key`
--      (B2), so old voice rows keep working and new ones can be inserted.
-- No existing column, table, or row is removed or renamed.
-- ==========================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS b2_object_key TEXT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS media_status TEXT,
  ADD COLUMN IF NOT EXISTS byte_size BIGINT;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS valid_voice_metadata;

ALTER TABLE public.messages
  ADD CONSTRAINT valid_voice_metadata CHECK (
    (content_type <> 'voice') OR (
      (storage_path IS NOT NULL OR b2_object_key IS NOT NULL) AND
      duration > 0 AND duration <= 120 AND
      mime_type IS NOT NULL
    )
  );
