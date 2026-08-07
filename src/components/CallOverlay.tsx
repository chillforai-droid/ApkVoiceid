import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Share } from 'react-native';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff, SwitchCamera, Bug, Share2 } from 'lucide-react-native';
import { RTCView } from 'react-native-webrtc';
import { useVoiceCall } from '../context/VoiceCallContext';

export default function CallOverlay() {
  const {
    callState, callMode, otherProfile, localStream, remoteStream,
    acceptCall, rejectCall, endCall, isMuted, toggleMute,
    isSpeakerOn, toggleSpeaker, isCameraOn, toggleCamera, switchCamera,
    diagnostics, diagnosticStage, diagnosticReport,
  } = useVoiceCall();
  const [sec, setSec] = useState(0);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    if (callState !== 'connected') { setSec(0); return; }
    const t = setInterval(() => setSec(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  if (callState === 'idle') return null;
  const tm = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const video = callMode === 'video';
  const shareDiagnostic = async () => {
    try { await Share.share({ message: diagnosticReport(), title: 'VoiceID Call Diagnostic' }); } catch {}
  };

  return <Modal visible animationType="fade">
    <View style={s.root}>
      {video && remoteStream ? <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={false} /> : null}
      {video && localStream ? <RTCView streamURL={localStream.toURL()} style={s.selfVideo} objectFit="cover" mirror /> : null}

      <TouchableOpacity style={s.diagButton} onPress={() => setShowDiag(v => !v)}>
        <Bug color="#fff" size={18} /><Text style={s.diagButtonText}>Call Debug</Text>
      </TouchableOpacity>

      {showDiag && <View style={s.diagPanel}>
        <View style={s.diagHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.diagTitle}>CALL DIAGNOSTIC</Text>
            <Text style={s.diagStage}>Latest: {diagnosticStage}</Text>
          </View>
          <TouchableOpacity style={s.shareButton} onPress={shareDiagnostic}>
            <Share2 color="#fff" size={16} /><Text style={s.shareText}>Share</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.diagScroll} contentContainerStyle={{ paddingBottom: 8 }}>
          {diagnostics.length === 0 ? <Text style={s.diagLine}>No call events yet.</Text> : diagnostics.slice(-24).map((d, i) => (
            <Text key={`${d.at}-${i}`} style={[s.diagLine, /FAILED|ERROR/.test(d.step) && s.diagError, /CONNECTED/.test(d.step) && s.diagGood]}>
              {d.step}{d.detail ? ` • ${d.detail}` : ''}
            </Text>
          ))}
        </ScrollView>
        <Text style={s.diagHint}>अटकने पर इस panel का screenshot भेजें। “Share” से पूरी report भेज सकते हैं।</Text>
      </View>}

      <View style={[s.info, video && { backgroundColor: 'rgba(7,17,31,.48)', padding: 14, borderRadius: 18 }]}>
        <View style={s.avatar}>{otherProfile?.avatar_url ? <Image source={{ uri: otherProfile.avatar_url }} style={s.img} /> : <Text style={s.av}>{(otherProfile?.display_name || '?')[0].toUpperCase()}</Text>}</View>
        <Text style={s.name}>{otherProfile?.display_name || 'VoiceID User'}</Text>
        <Text style={s.status}>{callState === 'ringing-incoming' ? `Incoming ${video ? 'video' : 'voice'} call` : callState === 'ringing-outgoing' ? `${video ? 'Video c' : 'C'}alling…` : callState === 'connecting' ? 'Connecting…' : tm}</Text>
        {callState === 'connecting' && <Text style={s.stage}>Debug: {diagnosticStage}</Text>}
      </View>

      {callState === 'ringing-incoming' ? <View style={s.controls}>
        <TouchableOpacity style={[s.circle, s.red]} onPress={rejectCall}><PhoneOff color="#fff" size={30} /></TouchableOpacity>
        <TouchableOpacity style={[s.circle, s.green]} onPress={acceptCall}><Phone color="#fff" size={30} /></TouchableOpacity>
      </View> : <View style={s.controls}>
        {callState === 'connected' && <>
          <TouchableOpacity style={[s.circle, s.ctrl, isMuted && s.active]} onPress={toggleMute}>{isMuted ? <MicOff color="#fff" /> : <Mic color="#fff" />}</TouchableOpacity>
          <TouchableOpacity style={[s.circle, s.ctrl, isSpeakerOn && s.active]} onPress={toggleSpeaker}>{isSpeakerOn ? <Volume2 color="#fff" /> : <VolumeX color="#fff" />}</TouchableOpacity>
          {video && <>
            <TouchableOpacity style={[s.circle, s.ctrl, !isCameraOn && s.active]} onPress={toggleCamera}>{isCameraOn ? <Video color="#fff" /> : <VideoOff color="#fff" />}</TouchableOpacity>
            <TouchableOpacity style={[s.circle, s.ctrl]} onPress={switchCamera}><SwitchCamera color="#fff" /></TouchableOpacity>
          </>}
        </>}
        <TouchableOpacity style={[s.circle, s.red]} onPress={endCall}><PhoneOff color="#fff" size={30} /></TouchableOpacity>
      </View>}
      <Text style={s.note}>{video ? 'VoiceID • App-only video call' : callState === 'connected' ? (isSpeakerOn ? 'Loudspeaker' : 'Handset') : 'VoiceID secure voice call'}</Text>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07111F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  selfVideo: { position: 'absolute', right: 18, top: 55, width: 112, height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827', zIndex: 5 },
  info: { alignItems: 'center', zIndex: 4 }, avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 22 },
  img: { width: '100%', height: '100%' }, av: { fontSize: 46, fontWeight: '800', color: '#fff' }, name: { fontSize: 26, fontWeight: '800', color: '#fff' }, status: { fontSize: 17, color: '#CBD5E1', marginTop: 10 }, stage: { fontSize: 12, color: '#FBBF24', marginTop: 7, maxWidth: 320, textAlign: 'center' },
  controls: { position: 'absolute', bottom: 90, left: 15, right: 15, flexDirection: 'row', gap: 14, alignItems: 'center', justifyContent: 'center', zIndex: 10 }, circle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' }, red: { backgroundColor: '#EF4444' }, green: { backgroundColor: '#22C55E' }, ctrl: { backgroundColor: 'rgba(51,65,85,.9)' }, active: { backgroundColor: '#2563EB' }, note: { position: 'absolute', bottom: 35, color: '#94A3B8', zIndex: 10 },
  diagButton: { position: 'absolute', top: 42, left: 16, zIndex: 30, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#7C3AED', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, diagButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  diagPanel: { position: 'absolute', zIndex: 40, top: 84, left: 12, right: 12, maxHeight: '52%', backgroundColor: 'rgba(2,6,23,.97)', borderColor: '#7C3AED', borderWidth: 1, borderRadius: 14, padding: 12 }, diagHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, diagTitle: { color: '#fff', fontWeight: '900', fontSize: 14 }, diagStage: { color: '#FBBF24', fontSize: 11, marginTop: 2 }, diagScroll: { maxHeight: 260 }, diagLine: { color: '#CBD5E1', fontSize: 11, lineHeight: 17, fontFamily: 'monospace', borderBottomColor: '#1E293B', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 3 }, diagError: { color: '#FCA5A5' }, diagGood: { color: '#86EFAC' }, diagHint: { color: '#94A3B8', fontSize: 10, marginTop: 8 }, shareButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, shareText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});
