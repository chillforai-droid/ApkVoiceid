import { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Send, X, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MediaCache } from '../../lib/MediaCache';

export function VoiceRecorder({ onSent, onAudioPreview }: { onSent: () => void, onAudioPreview?: (isPreview: boolean) => void }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  // Preview playback: reuse one object URL / Audio instance instead of
  // creating a new one on every click of the preview-play button, which
  // previously leaked a Blob URL each time.
  const previewUrlRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (onAudioPreview) {
      onAudioPreview(!!audioBlob);
    }
  }, [audioBlob, onAudioPreview]);

  useEffect(() => {
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      previewAudioRef.current?.pause();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    if (!window.isSecureContext) {
      setError("Microphone recording is unavailable in this insecure context.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const actualDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        setDuration(Math.max(1, Math.min(actualDuration, 120)));
      };
      
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError("Microphone permission is blocked. Please allow microphone access in your browser.");
      } else if (window.self !== window.top) {
        setError("Microphone recording may be unavailable in this iframe. Open in a new tab.");
      } else {
        setError(`Microphone error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const playPreview = () => {
    if (!audioBlob) return;
    if (!previewUrlRef.current) {
      previewUrlRef.current = URL.createObjectURL(audioBlob);
    }
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(previewUrlRef.current);
    }
    previewAudioRef.current.currentTime = 0;
    previewAudioRef.current.play();
  };

  const discardPreview = () => {
    previewAudioRef.current?.pause();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    previewAudioRef.current = null;
    setAudioBlob(null);
  };

  const sendAudio = async () => {
    if (!audioBlob) {
      setError('No recording to send.');
      return;
    }
    if (!id) {
      setError('Cannot send: conversation not loaded.');
      return;
    }
    if (!user) {
      setError('Cannot send: not signed in.');
      return;
    }

    setError(null);

    // 1. Calculate Hash
    let sha256: string;
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err: any) {
      setError('Failed to process recording.');
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    // 2. Upload via the server-side proxy: /api/media/upload
    // (Same endpoint used by image upload in ChatPage.tsx. The server holds
    // the authenticated S3 client and uploads to B2 itself, so the browser
    // never needs to talk to B2 directly.)
    const uploadUrl = "/api/media/upload";
    let objectKey: string;
    try {
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": audioBlob.type,
          "Authorization": `Bearer ${token}`
        },
        body: audioBlob,
      });

      if (!uploadRes.ok) {
        setError('Failed to upload audio.');
        return;
      }

      const json = await uploadRes.json();
      objectKey = json.objectKey;

      if (!objectKey) {
        setError('Failed to upload audio.');
        return;
      }
    } catch (err: any) {
      setError(`Failed to send voice message: ${err?.message || 'Unknown error'}`);
      return;
    }

    // 3. Insert metadata
    const messageId = crypto.randomUUID();
    try {
      const { error: dbError } = await supabase.from('messages').insert({
          id: messageId,
          conversation_id: id,
          sender_id: user.id,
          content_body: '',
          content_type: 'voice',
          b2_object_key: objectKey,
          sha256: sha256,
          media_status: 'pending',
          duration: duration,
          mime_type: audioBlob.type,
          byte_size: audioBlob.size
      });

      if (dbError) {
          setError('Failed to save message.');
          return;
      }
    } catch (err: any) {
      setError(`Failed to send voice message: ${err?.message || 'Unknown error'}`);
      return;
    }

    try {
      await MediaCache.putMedia({
          messageId: messageId,
          mediaType: 'voice',
          blob: audioBlob,
          mimeType: audioBlob.type,
          byteSize: audioBlob.size,
          createdAt: Date.now(),
          sha256: sha256,
          deliveryStatus: 'pending'
      });
    } catch (err: any) {
      // Non-fatal: the message is already saved server-side, so don't block on local cache failure.
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    previewAudioRef.current = null;
    setAudioBlob(null);
    onSent();
  };

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {error && <p className="text-red-500 text-xs sm:text-sm break-words max-w-[60vw] sm:max-w-xs">{error}</p>}
      <div className="flex items-center gap-2">
        {audioBlob ? (
          <>
            <button type="button" onClick={discardPreview} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            <button type="button" onClick={playPreview} className="p-3 bg-gray-100 text-gray-700 rounded-full"><Play size={20} /></button>
            <button
              type="button"
              onClick={() => sendAudio()}
              className="p-3 bg-blue-600 text-white rounded-full"
            >
              <Send size={20} />
            </button>
          </>
        ) : isRecording ? (
          <button type="button" onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full animate-pulse"><StopCircle size={20} /></button>
        ) : (
          <button type="button" onClick={startRecording} className="p-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full"><Mic size={20} /></button>
        )}
      </div>
    </div>
  );
  }
