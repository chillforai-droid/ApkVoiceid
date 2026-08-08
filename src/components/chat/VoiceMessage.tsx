import { memo, useState, useRef, useEffect } from 'react';
import { Play, Loader2, Pause } from 'lucide-react';
import { VoiceAudioCache } from '../../lib/VoiceAudioCache';
import { MediaCache } from '../../lib/MediaCache';
import { supabase } from '../../lib/supabase';
import { fetchAndCacheMedia } from '../../lib/mediaDownload';

function VoiceMessageImpl({ message }: { message: any }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Blob URL backing the current <audio> element, if any — revoked before
  // creating the next one and on unmount so it can't leak.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const playAudio = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setError(null);

    try {
      // 1. Local cache first (MediaCache backs new B2 voice notes, VoiceAudioCache
      //    backs legacy ones already played on this device).
      let blob: Blob | null = (await MediaCache.getMedia(message.id))?.blob ?? null;
      if (!blob) blob = (await VoiceAudioCache.getAudio(message.id)) ?? null;

      if (!blob) {
        setIsDownloading(true);
        if (message.b2_object_key) {
          // New voice messages: same B2 download flow already used by ImageMessage.
          blob = await fetchAndCacheMedia(message, 'voice');
        } else if (message.storage_path) {
          // Legacy voice messages recorded before the B2 migration.
          const { data, error: dlError } = await supabase.storage
            .from('voice-messages-temp')
            .download(message.storage_path);
          if (dlError || !data) throw dlError || new Error('Empty legacy voice download');
          blob = data;
          await VoiceAudioCache.saveAudio(message.id, blob);
        } else {
          throw new Error('Voice message has no stored audio reference');
        }
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      await audio.play();
      setIsPlaying(true);
      // Durable message read receipt. The legacy played RPC remains for
      // voice-message expiry/cleanup semantics.
      try {
        await supabase.rpc('mark_message_read', { p_message_id: message.id });
      } catch (err) {
        console.warn('Failed to mark voice message read', err);
      }
      try {
        await supabase.rpc('acknowledge_voice_played', { p_message_id: message.id });
      } catch (_) {
        // Legacy RPC may be unavailable for newer message rows; do not block playback.
      }
    } catch (err) {
      console.error('VoiceMessage: failed to play audio', err);
      setError('Failed to load voice message.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={playAudio} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 text-gray-900 text-sm font-medium hover:bg-white transition">
        {isDownloading ? <Loader2 className="animate-spin" size={16} /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
        <span>{message.duration || 0}s</span>
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

// Memoized for the same reason as ImageMessage: prevents the whole chat
// message list re-rendering (and re-checking playback state) from
// touching every voice bubble on unrelated state changes.
export const VoiceMessage = memo(VoiceMessageImpl, (prev, next) => prev.message.id === next.message.id);
