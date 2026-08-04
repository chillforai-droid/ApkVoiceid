import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { getCachedMedia, downloadToCache } from '../lib/mediaCache';
import { getDownloadUrl, ackMedia } from '../lib/api';

export function VoiceMessageBubble({ message, isOwn }: { message: any; isOwn: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const play = async () => {
    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }

    setError(null);
    try {
      let uri = await getCachedMedia(message.id, message.mime_type || 'audio/webm');

      if (!uri) {
        if (!message.b2_object_key) throw new Error('No audio reference');
        setIsLoading(true);
        const remoteUrl = await getDownloadUrl(message.id);
        uri = await downloadToCache(message.id, remoteUrl, message.mime_type || 'audio/webm');
        // Best-effort cleanup ack, same as the web app (server rejects for sender's own message)
        ackMedia(message.id);
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
      });
    } catch (err) {
      console.error('VoiceMessageBubble: failed to play', err);
      setError('वॉइस मैसेज लोड नहीं हो पाया');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)' }]}
        onPress={play}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? '#fff' : '#22C55E'} />
        ) : isPlaying ? (
          <Pause size={16} color={isOwn ? '#fff' : '#22C55E'} />
        ) : (
          <Play size={16} color={isOwn ? '#fff' : '#22C55E'} />
        )}
        <Text style={[styles.duration, { color: isOwn ? '#fff' : '#E2E8F0' }]}>{message.duration || 0}s</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  duration: { fontSize: 13, fontWeight: '600' },
  error: { color: '#F87171', fontSize: 11, marginTop: 4 },
});
