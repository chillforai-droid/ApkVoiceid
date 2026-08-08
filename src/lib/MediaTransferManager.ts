// src/lib/MediaTransferManager.ts
import { MediaMetadata, CHUNK_SIZE, HEADER_SIZE } from './MediaProtocol';
import { MediaCache } from './MediaCache';
import { calculateSHA256 } from './crypto';
import { supabase } from './supabase';

export class MediaTransferManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private channel: any = null; // Supabase channel

  constructor(private userId: string) {}

  async setupSignaling(messageId: string, role: 'sender' | 'receiver') {
    this.channel = supabase.channel(`media:transfer:${messageId}`);
    
    this.channel
      .on('broadcast', { event: 'offer' }, (payload: any) => { if (role === 'receiver') this.handleOffer(payload); })
      .on('broadcast', { event: 'answer' }, (payload: any) => { if (role === 'sender') this.handleAnswer(payload); })
      .on('broadcast', { event: 'ice-candidate' }, (payload: any) => this.handleIceCandidate(payload))
      .subscribe();
  }

  async createPeerConnection(messageId: string) {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({ type: 'broadcast', event: 'ice-candidate', payload: event.candidate });
      }
    };
  }

  // Framing Helper
  createChunk(index: number, total: number, data: ArrayBuffer): ArrayBuffer {
    const chunk = new ArrayBuffer(HEADER_SIZE + data.byteLength);
    const view = new DataView(chunk);
    view.setUint32(0, index); // Big Endian
    view.setUint32(4, total); // Big Endian
    new Uint8Array(chunk, HEADER_SIZE).set(new Uint8Array(data));
    return chunk;
  }

  async initiateTransfer(metadata: MediaMetadata, blob: Blob) {
    await this.setupSignaling(metadata.messageId, 'sender');
    await this.createPeerConnection(metadata.messageId);

    this.dataChannel = this.pc!.createDataChannel(`transfer-${metadata.messageId}`, { ordered: true });
    this.dataChannel.binaryType = 'arraybuffer';
    
    this.pc!.onnegotiationneeded = async () => {
        const offer = await this.pc!.createOffer();
        await this.pc!.setLocalDescription(offer);
        this.channel.send({ type: 'broadcast', event: 'offer', payload: offer });
    };

    this.dataChannel.onopen = async () => {
      this.dataChannel!.send(JSON.stringify({ type: 'metadata', ...metadata }));

      let offset = 0;
      let chunkIndex = 0;
      this.dataChannel!.bufferedAmountLowThreshold = CHUNK_SIZE * 4;

      const sendNextChunk = () => {
        while (offset < blob.size && this.dataChannel!.bufferedAmount < CHUNK_SIZE * 8) {
          const chunkBlob = blob.slice(offset, offset + CHUNK_SIZE);
          chunkBlob.arrayBuffer().then(buffer => {
             const framed = this.createChunk(chunkIndex++, metadata.totalChunks, buffer);
             this.dataChannel!.send(framed);
          });
          offset += CHUNK_SIZE;
        }
        if (offset < blob.size) {
            this.dataChannel!.onbufferedamountlow = sendNextChunk;
        }
      };
      sendNextChunk();
    };
  }

  // Handle Signaling
  async handleOffer(payload: any) {
    await this.pc!.setRemoteDescription(payload);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.channel.send({ type: 'broadcast', event: 'answer', payload: answer });
  }

  async handleAnswer(payload: any) {
    await this.pc!.setRemoteDescription(payload);
  }

  async handleIceCandidate(payload: any) {
    await this.pc!.addIceCandidate(payload);
  }

  // Receiver Logic
  async receiveTransfer(messageId: string) {
    await this.setupSignaling(messageId, 'receiver');
    await this.createPeerConnection(messageId);

    this.pc!.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this.dataChannel.onmessage = this.handleMessage.bind(this);
    };
  }

  private chunks: Map<string, ArrayBuffer[]> = new Map();
  private metadata: MediaMetadata | null = null;

  async handleMessage(event: MessageEvent) {
    if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'metadata') this.metadata = msg;
        return;
    }

    const data = event.data as ArrayBuffer;
    const view = new DataView(data);
    const chunkIndex = view.getUint32(0);
    const totalChunks = view.getUint32(4);
    const payload = data.slice(HEADER_SIZE);

    if (!this.chunks.has(this.metadata!.messageId)) this.chunks.set(this.metadata!.messageId, new Array(totalChunks).fill(null));
    this.chunks.get(this.metadata!.messageId)![chunkIndex] = payload;

    // Check if complete
    const completed = this.chunks.get(this.metadata!.messageId)!.filter(c => c !== null);
    if (completed.length === totalChunks) {
        await this.finalizeTransfer(this.metadata!.messageId);
    }
  }

  async finalizeTransfer(messageId: string) {
    const chunks = this.chunks.get(messageId)!;
    const blob = new Blob(chunks, { type: this.metadata!.mimeType });
    
    // Integrity
    const hash = await calculateSHA256(blob);
    if (hash !== this.metadata!.sha256) throw new Error('Hash mismatch');
    if (blob.size !== this.metadata!.byteSize) throw new Error('Size mismatch');

    // Persist
    await MediaCache.putMedia({ ...this.metadata!, blob, deliveryStatus: 'delivered', createdAt: Date.now() });
    
    // ACK
    this.channel.send({ type: 'broadcast', event: 'transfer-ack', payload: { messageId } });
    this.cleanup();
  }

  cleanup() {
    this.dataChannel?.close();
    this.pc?.close();
    this.channel.unsubscribe();
  }
}
