import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { ImageMessageBubble } from './ImageMessageBubble';

function MessageBubbleImpl({ message, isOwn }: { message: any; isOwn: boolean }) {
  return (
    <View style={[styles.row, { justifyContent: isOwn ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          message.content_type !== 'text' && styles.mediaBubble,
        ]}
      >
        {message.content_type === 'voice' ? (
          <VoiceMessageBubble message={message} isOwn={isOwn} />
        ) : message.content_type === 'image' ? (
          <ImageMessageBubble message={message} />
        ) : (
          <Text style={[styles.text, { color: isOwn ? '#fff' : '#F1F5F9' }]}>{message.content_body}</Text>
        )}
        <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl, (prev, next) => prev.message.id === next.message.id && prev.message.content_body === next.message.content_body);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: 12 },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  mediaBubble: { padding: 6 },
  ownBubble: { backgroundColor: '#22C55E', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1E293B', borderBottomLeftRadius: 4 },
  text: { fontSize: 15.5, lineHeight: 21 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});
