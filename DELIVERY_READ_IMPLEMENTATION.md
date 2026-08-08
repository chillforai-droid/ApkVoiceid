# Delivery / Read implementation

Implemented in the Web Version:

- `message_receipts.read_at` additive migration.
- `mark_message_delivered(message_id)` RPC.
- `mark_message_read(message_id)` RPC.
- `message_receipts` added to Supabase Realtime publication when absent.
- Global incoming-message listener marks a message delivered even when the chat page is not open; if the conversation is active it marks it read.
- Chat page marks loaded incoming messages read.
- Sender subscribes to receipt INSERT/UPDATE and renders ✓ / ✓✓ / blue ✓✓.
- Voice playback marks the message read and preserves the existing voice played/expiry RPC.
- Typing is ephemeral Realtime Broadcast (`typing`) and is not stored in the database.
- Online/offline browser state is shown; text messages are queued in localStorage while offline and flushed after reconnect.

Images/voice uploads still require network and are not falsely queued as complete offline.
