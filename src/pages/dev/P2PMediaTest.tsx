import React, { useState, useEffect } from 'react';
import { MediaTransferManager } from '../../lib/MediaTransferManager';
import { MediaCache } from '../../lib/MediaCache';
import { calculateSHA256 } from '../../lib/crypto';
import { CHUNK_SIZE } from '../../lib/MediaProtocol';

export default function P2PMediaTest() {
  const [role, setRole] = useState<'sender' | 'receiver'>('sender');
  const [messageId, setMessageId] = useState('test-transfer-123');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [receivedMedia, setReceivedMedia] = useState<any>(null);
  const [manager] = useState(new MediaTransferManager('test-user'));

  const handleSender = async () => {
    if (!file) return;
    setStatus('Preparing...');
    const sha256 = await calculateSHA256(file);
    const metadata = {
        protocolVersion: 1,
        messageId,
        conversationId: 'test-conv',
        senderId: 'user-a',
        mediaType: file.type.startsWith('image') ? 'image' : 'voice',
        mimeType: file.type,
        byteSize: file.size,
        sha256,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE)
    };
    await MediaCache.putMedia({ ...metadata, blob: file, deliveryStatus: 'pending', createdAt: Date.now() });
    setStatus('Ready to transfer');
    await manager.initiateTransfer(metadata, file);
    setStatus('Transferring...');
  };

  const handleReceiver = async () => {
    setStatus('Waiting for sender...');
    await manager.receiveTransfer(messageId);
    setStatus('Connected, receiving...');
    
    // Simple way to check for completion in this test harness
    const check = setInterval(async () => {
        const meta = await MediaCache.getMetadata(messageId);
        if (meta) {
            setStatus('Delivered! Verify hash.');
            const data = await MediaCache.getMedia(messageId);
            setReceivedMedia(data);
            clearInterval(check);
        }
    }, 1000);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">P2P Media Test Harness</h1>
      <div className="flex gap-4 mb-4">
        <button onClick={() => setRole('sender')} className="p-2 border rounded">Sender</button>
        <button onClick={() => setRole('receiver')} className="p-2 border rounded">Receiver</button>
      </div>
      <input value={messageId} onChange={e => setMessageId(e.target.value)} className="border p-2 mb-4 w-full" />
      
      {role === 'sender' ? (
        <>
            <input type="file" onChange={e => setFile(e.target.files![0])} className="mb-4" />
            <button onClick={handleSender} className="bg-blue-500 text-white p-2 rounded">Start Sender</button>
        </>
      ) : (
        <button onClick={handleReceiver} className="bg-green-500 text-white p-2 rounded">Join Receiver</button>
      )}

      <div className="mt-4 p-4 bg-gray-100 rounded">Status: {status}</div>
      {receivedMedia && (
        <div className="mt-4">
            <h2 className="font-bold">Received:</h2>
            <p>Type: {receivedMedia.mimeType}</p>
            <p>Size: {receivedMedia.byteSize}</p>
            {receivedMedia.mimeType.startsWith('image') && <img src={URL.createObjectURL(receivedMedia.blob)} className="max-w-xs mt-2" />}
        </div>
      )}
    </div>
  );
}
