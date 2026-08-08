// src/lib/MediaProtocol.ts

export const PROTOCOL_VERSION = 1;
export const CHUNK_SIZE = 16 * 1024; // 16 KiB
export const HEADER_SIZE = 8; // 4 bytes Index + 4 bytes Total

export type MediaType = 'voice' | 'image';

export interface MediaMetadata {
  protocolVersion: number;
  messageId: string;
  conversationId: string;
  senderId: string;
  mediaType: MediaType;
  mimeType: string;
  byteSize: number;
  sha256: string;
  totalChunks: number;
}

export interface ChunkPayload {
  messageId: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;
}
