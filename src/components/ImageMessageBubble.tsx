import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getCachedMedia, downloadToCache } from '../lib/mediaCache';
import { getDownloadUrl, ackMedia } from '../lib/api';

export function ImageMessageBubble({ message }: { message: any }) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let cached = await getCachedMedia(message.id, message.mime_type || 'image/jpeg');
        if (!cached) {
          if (!message.b2_object_key) throw new Error('No image reference');
          const remoteUrl = await getDownloadUrl(message.id);
          cached = await downloadToCache(message.id, remoteUrl, message.mime_type || 'image/jpeg');
          ackMedia(message.id);
        }
        if (!cancelled) setUri(cached);
      } catch (err) {
        console.error('ImageMessageBubble: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [message.id]);

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (error || !uri) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.errorText}>इमेज लोड नहीं हो पाई</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  image: { width: 220, height: 220, borderRadius: 14 },
  placeholder: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#94A3B8', fontSize: 12 },
});
