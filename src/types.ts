export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'voice';
  created_at: string;
  storage_path?: string | null;
  duration?: number | null;
  mime_type?: string | null;
  expires_at?: string | null;
  server_delete_after?: string | null;
  storage_deleted_at?: string | null;
}

export interface MessageReceipt {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  played_at: string | null;
  read_at?: string | null;
  local_persist_confirmed_at: string | null;
}
