import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Mic, Square, Play, X, Send } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { handleSessionExpired } from '../lib/api';

interface Props {
  onSend: (localUri: string, durationSec: number, mimeType: string) => Promise<void>;
  onRecordingStateChange?: (isRecordingOrPreview: boolean) => void;
}

export function VoiceRecorderBar({ onSend, onRecordingStateChange }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [sending, setSending] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const startTimeRef = useRef(0);

  const notifyState = (active: boolean) => onRecordingStateChange?.(active);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('माइक्रोफ़ोन अनुमति चाहिए', 'वॉइस मैसेज भेजने के लिए माइक्रोफ़ोन एक्सेस दें');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      notifyState(true);
    } catch (err) {
      console.error('startRecording error', err);
      Alert.alert('गड़बड़ी', 'रिकॉर्डिंग शुरू नहीं हो पाई');
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    const actualDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
    setDuration(Math.max(1, Math.min(actualDuration, 120)));
    setRecordedUri(uri);
    recordingRef.current = null;
  };

  const playPreview = async () => {
    if (!recordedUri) return;
    if (previewSoundRef.current) await previewSoundRef.current.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: recordedUri }, { shouldPlay: true });
    previewSoundRef.current = sound;
  };

  const discard = async () => {
    if (previewSoundRef.current) await previewSoundRef.current.unloadAsync();
    previewSoundRef.current = null;
    setRecordedUri(null);
    setDuration(0);
    notifyState(false);
  };

  const send = async () => {
    if (!recordedUri) return;
    setSending(true);
    try {
      await onSend(recordedUri, duration, 'audio/m4a');
      setRecordedUri(null);
      setDuration(0);
      notifyState(false);
    } catch (err: any) {
      console.error('send voice error', err);
      const handled = await handleSessionExpired(err);
      if (!handled) Alert.alert('गड़बड़ी', 'वॉइस मैसेज नहीं भेजा जा सका: ' + (err?.message ?? 'अनजान वजह'));
    } finally {
      setSending(false);
    }
  };

  if (recordedUri) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.iconBtn} onPress={discard}>
          <X size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={playPreview}>
          <Play size={20} color="#94A3B8" />
        </TouchableOpacity>
        <Text style={styles.durationText}>{duration}s</Text>
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
          <Send size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.micBtn, isRecording && styles.micBtnActive]}
      onPress={isRecording ? stopRecording : startRecording}
    >
      {isRecording ? <Square size={20} color="#fff" /> : <Mic size={20} color="#94A3B8" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 10 },
  micBtn: { padding: 10, borderRadius: 20 },
  micBtnActive: { backgroundColor: '#DC2626' },
  durationText: { color: '#94A3B8', fontSize: 13, minWidth: 28 },
  sendBtn: { backgroundColor: '#22C55E', padding: 10, borderRadius: 20 },
});
