import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, MediaStream } from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import InCallManager from 'react-native-incall-manager';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { usePresence } from './PresenceContext';

// ============================================================================
// PROTOCOL NOTE — do not change channel name, event names, or payload shapes
// without also changing the web client. This file intentionally mirrors:
//   web:    VoiceID-main/src/context/VoiceCallContext.tsx
//   native: app/src/main/java/com/voiceid/app/call/WebRtcCallManager.kt
//   spec:   VoiceID-main/BACKEND_README.md §6.3(A)
// Channel:  voice-call:{callId}
// Events:   receiver-ready, offer, answer, ice-candidate
// Payloads: offer/answer -> plain { type, sdp }
//           ice-candidate -> plain { candidate, sdpMid, sdpMLineIndex }
// This was already correctly aligned (see WEB_CALL_PROTOCOL_ALIGNMENT.md) —
// verified line-by-line against the web source again in this pass. The bugs
// fixed here are React lifecycle / channel-churn / logging issues, NOT
// protocol differences.
// ============================================================================

type CallState = 'idle' | 'ringing-outgoing' | 'ringing-incoming' | 'connecting' | 'connected';
type CallMode = 'voice' | 'video';

type Ctx = {
  callState: CallState;
  callMode: CallMode;
  activeCall: any;
  otherProfile: any;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (id: string) => Promise<void>;
  initiateVideoCall: (id: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  isMuted: boolean;
  toggleMute: () => void;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  switchCamera: () => void;
};

const C = createContext<Ctx>({} as Ctx);

const turnUrl = Constants.expoConfig?.extra?.turnUrl as string | undefined;
const turnUsername = Constants.expoConfig?.extra?.turnUsername as string | undefined;
const turnCredential = Constants.expoConfig?.extra?.turnCredential as string | undefined;

// Temporary Metered TURN fallback for real-device testing. Build-time TURN_*
// values still take priority, so these test credentials can be replaced later
// without touching calling/signalling code.
const TEST_TURN_USERNAME = 'ce4c2be456ea4ba39f96bd3c';
const TEST_TURN_CREDENTIAL = 'X3rXWiinGzIH3B3p';
const meteredTurnUrls = [
  'turn:global.relay.metered.ca:80',
  'turn:global.relay.metered.ca:80?transport=tcp',
  'turn:global.relay.metered.ca:443',
  'turns:global.relay.metered.ca:443?transport=tcp',
];

const iceServers: any[] = [
  // Metered STUN + Google STUN give direct P2P a chance first.
  { urls: ['stun:stun.relay.metered.ca:80', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // If TURN_* secrets are present in the build, use those. Otherwise use the
  // temporary Metered credential supplied for this APK test build.
  turnUrl
    ? { urls: turnUrl, username: turnUsername, credential: turnCredential }
    : { urls: meteredTurnUrls, username: TEST_TURN_USERNAME, credential: TEST_TURN_CREDENTIAL },
];

// ---------------------------------------------------------------------------
// Structured development logger. Never logs tokens/secrets — only call IDs,
// event names, and WebRTC state enums.
// ---------------------------------------------------------------------------
function callLog(step: string, extra?: Record<string, any>) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[VOICEID_CALL]', step, extra ?? '');
  }
}

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isOnline } = usePresence();

  const [callState, setCallState] = useState<CallState>('idle');
  const stateRef = useRef<CallState>('idle');
  const [callMode, setCallMode] = useState<CallMode>('voice');
  const modeRef = useRef<CallMode>('voice');
  const [activeCall, setActiveCall] = useState<any>(null);
  const activeRef = useRef<any>(null);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  // Bug fix: setupPeer previously closed over the `isSpeakerOn` STATE value,
  // which put it in setupPeer's useCallback dependency array. Every speaker
  // toggle during a call therefore produced a brand new setupPeer identity,
  // which cascaded into new startCallerOffer / bindSignal / watch identities,
  // which in turn re-ran the incoming-call listener effect below and tore
  // down + resubscribed the persistent `calls:{userId}` channel mid-session
  // (exactly the "component re-renders creating multiple channels" failure
  // mode). Reading from a ref instead removes the dependency entirely.
  const isSpeakerOnRef = useRef(false);
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pc = useRef<any>(null);
  const local = useRef<MediaStream | null>(null);
  const signal = useRef<RealtimeChannel | null>(null);
  const incoming = useRef<RealtimeChannel | null>(null);
  const updates = useRef<RealtimeChannel | null>(null);
  const iceQueue = useRef<any[]>([]);
  const timeout = useRef<any>(null);
  // Bug fix: this used to be a plain boolean that startCallerOffer checked
  // once and, if false, permanently dropped the receiver-ready event (no
  // buffering, no re-check). If the caller's own channel took even a little
  // longer to reach SUBSCRIBED than the receiver's round trip, the call
  // would hang forever with no recovery — matching the exact "stuck on
  // Calling…" symptom. Now receiver-ready is buffered if it arrives early,
  // and callerSignalReady becoming true drains the buffered signal. This is
  // NOT a blind timed retry — it's a one-time, event-driven catch-up for a
  // message that was legitimately received but couldn't be acted on yet.
  const callerSignalReady = useRef(false);
  const pendingReceiverReady = useRef(false);
  const offerStarted = useRef(false);
  // Receiver ringtone is played with expo-av instead of InCallManager.startRingtone.
  // startRingtone is a native call that was crashing the receiver process on some
  // Android builds before the user could even press Accept. WebRTC/InCallManager
  // is still used for in-call audio routing after the peer connection succeeds.
  const ringtoneSound = useRef<Audio.Sound | null>(null);

  useEffect(() => { stateRef.current = callState; }, [callState]);
  useEffect(() => { activeRef.current = activeCall; }, [activeCall]);
  useEffect(() => { modeRef.current = callMode; }, [callMode]);

  const loadOther = useCallback(async (call: any) => {
    if (!call || !user) return;
    const id = call.caller_id === user.id ? call.receiver_id : call.caller_id;
    const { data } = await supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id', id).maybeSingle();
    setOtherProfile(data || null);
  }, [user]);

  const stopTones = () => {
    // Do not call stopRingtone here: the receiver ringtone is owned by expo-av.
    // Keeping native ringtone APIs out of the incoming-call path avoids the
    // receiver-side native crash seen on the test devices.
    const sound = ringtoneSound.current;
    ringtoneSound.current = null;
    if (sound) {
      void sound.stopAsync().catch(() => undefined).finally(() => {
        void sound.unloadAsync().catch(() => undefined);
      });
    }
    try { InCallManager.stopRingback(); } catch {}
  };

  const startIncomingRingtone = useCallback(async () => {
    try {
      stopTones();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/voiceid-ringtone.wav'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      ringtoneSound.current = sound;
      callLog('RINGTONE_STARTED_SAFE');
    } catch (e: any) {
      callLog('RINGTONE_START_FAILED_SAFE', { message: e?.message });
      // Ringtone failure must never crash or block an incoming call.
    }
  }, []);

  const cleanup = useCallback(() => {
    callLog('CLEANUP', { callId: activeRef.current?.id });
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    stopTones();
    try { InCallManager.stop(); } catch {}
    try { pc.current?.close(); } catch {}
    pc.current = null;
    local.current?.getTracks().forEach((t: any) => t.stop());
    local.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    if (signal.current) supabase.removeChannel(signal.current);
    signal.current = null;
    if (updates.current) supabase.removeChannel(updates.current);
    updates.current = null;
    iceQueue.current = [];
    callerSignalReady.current = false;
    pendingReceiverReady.current = false;
    offerStarted.current = false;
    setCallState('idle');
    setActiveCall(null);
    setOtherProfile(null);
    setCallMode('voice');
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsCameraOn(true);
  }, []);

  const getMedia = useCallback(async (mode: CallMode) => {
    if (Platform.OS === 'android') {
      const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (mode === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      const r = await PermissionsAndroid.requestMultiple(perms);
      if (r[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Microphone permission denied');
      }
      if (mode === 'video' && r[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Camera permission denied');
      }
    }
    const s = (await mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any,
      video: mode === 'video' ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false,
    })) as MediaStream;
    local.current = s;
    setLocalStream(s);
    const audioTracks = s.getAudioTracks();
    callLog('LOCAL_STREAM_CREATED', {
      audioTracks: audioTracks.length,
      enabled: audioTracks[0]?.enabled,
      readyState: (audioTracks[0] as any)?.readyState,
    });
    return s;
  }, []);

  // setupPeer no longer depends on the isSpeakerOn STATE (see isSpeakerOnRef
  // above) — its identity is now stable across a speaker toggle mid-call.
  const setupPeer = useCallback(async (mode: CallMode) => {
    const p: any = new RTCPeerConnection({ iceServers });
    pc.current = p;
    const s = await getMedia(mode);
    s.getTracks().forEach((t: any) => p.addTrack(t, s));

    p.ontrack = (e: any) => {
      const stream = e.streams?.[0];
      const track = e.track;
      callLog('REMOTE_TRACK_RECEIVED', { kind: track?.kind, enabled: track?.enabled, readyState: track?.readyState });
      if (stream) {
        callLog('REMOTE_STREAM_RECEIVED', { audioTracks: stream.getAudioTracks().length });
        setRemoteStream(stream);
      }
    };
    // Legacy event kept for older react-native-webrtc behavior; ontrack
    // (Unified Plan) is the primary path for the installed version (^124).
    p.onaddstream = (e: any) => {
      if (e.stream) {
        callLog('REMOTE_STREAM_RECEIVED_LEGACY', { audioTracks: e.stream.getAudioTracks().length });
        setRemoteStream(e.stream);
      }
    };

    p.onicecandidate = (e: any) => {
      if (e.candidate) {
        const payload = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
        callLog('ICE_LOCAL_CANDIDATE', { hasMid: !!payload.sdpMid });
        signal.current?.send({ type: 'broadcast', event: 'ice-candidate', payload });
      } else {
        callLog('ICE_GATHERING_COMPLETE');
      }
    };

    const connected = () => {
      if (stateRef.current === 'connected') return;
      callLog('MEDIA_CONNECTED', { iceState: p.iceConnectionState, connState: p.connectionState });
      stopTones();
      try {
        InCallManager.start({ media: mode === 'video' ? 'video' : 'audio', auto: true });
        InCallManager.setForceSpeakerphoneOn(mode === 'video' ? true : isSpeakerOnRef.current);
        if (mode === 'video') setIsSpeakerOn(true);
      } catch (err) {
        callLog('AUDIO_ROUTING_ERROR', { message: (err as any)?.message });
      }
      setCallState('connected');
    };

    p.onsignalingstatechange = () => callLog('SIGNALING_STATE', { state: p.signalingState });
    p.onicegatheringstatechange = () => callLog('ICE_GATHERING_STATE', { state: p.iceGatheringState });
    p.oniceconnectionstatechange = () => {
      callLog('ICE_CONNECTION_STATE', { state: p.iceConnectionState });
      if (['connected', 'completed'].includes(p.iceConnectionState)) {
        connected();
      } else if (p.iceConnectionState === 'failed') {
        // This is the specific state that means signaling worked but no
        // media path could be established — almost always NAT traversal /
        // missing TURN. See CALLING_DEBUG_REPORT.md §M.
        callLog('ICE_FAILED_LIKELY_NAT', { hadTurn: !!turnUrl });
        Alert.alert(
          'कॉल कनेक्ट नहीं हो पाई',
          turnUrl
            ? 'नेटवर्क कनेक्शन की समस्या के कारण कॉल कनेक्ट नहीं हो सकी।'
            : 'दोनों फ़ोन के नेटवर्क के बीच सीधा कनेक्शन नहीं बन पाया (सामान्यतः मोबाइल डेटा पर)। इसे ठीक करने के लिए TURN सर्वर की ज़रूरत है।'
        );
        cleanup();
      } else if (p.iceConnectionState === 'closed') {
        cleanup();
      }
    };
    p.onconnectionstatechange = () => {
      callLog('CONNECTION_STATE', { state: p.connectionState });
      if (p.connectionState === 'connected') connected();
      else if (['failed', 'closed'].includes(p.connectionState)) cleanup();
    };

    return p;
  }, [cleanup, getMedia]);

  const startCallerOffer = useCallback(async () => {
    if (offerStarted.current || !activeRef.current) return;
    if (!callerSignalReady.current) {
      // Caller's own channel isn't SUBSCRIBED yet — buffer this instead of
      // dropping it. Once callerSignalReady flips true (see bindSignal's
      // subscribe callback below), it re-invokes startCallerOffer.
      pendingReceiverReady.current = true;
      callLog('RECEIVER_READY_BUFFERED', { callId: activeRef.current?.id });
      return;
    }
    offerStarted.current = true;
    try {
      if (timeout.current) clearTimeout(timeout.current);
      stopTones();
      setCallState('connecting');
      const mode = modeRef.current;
      const p = pc.current || (await setupPeer(mode));
      const offer = await p.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === 'video' });
      await p.setLocalDescription(offer);
      callLog('OFFER_CREATED', { sdpLength: offer.sdp?.length });
      const desc = p.localDescription || offer;
      const result = await signal.current?.send({ type: 'broadcast', event: 'offer', payload: { type: desc.type, sdp: desc.sdp } });
      callLog('OFFER_SENT', { callId: activeRef.current?.id, result });
    } catch (e: any) {
      offerStarted.current = false;
      callLog('OFFER_FAILED', { message: e?.message });
      Alert.alert('Call connection failed', e?.message || 'WebRTC offer failed');
    }
  }, [setupPeer]);

  const bindSignal = useCallback((callId: string, role: 'caller' | 'receiver') => {
    const ch = supabase.channel(`voice-call:${callId}`, { config: { broadcast: { ack: true, self: false } } });
    signal.current = ch;

    ch.on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
      try {
        const c = new RTCIceCandidate(payload);
        if (pc.current?.remoteDescription) {
          callLog('ICE_ADDED');
          await pc.current.addIceCandidate(c);
        } else {
          callLog('ICE_QUEUED');
          iceQueue.current.push(c);
        }
      } catch (e: any) {
        callLog('ICE_ADD_FAILED', { message: e?.message });
      }
    });

    if (role === 'caller') {
      ch.on('broadcast', { event: 'receiver-ready' }, async () => {
        callLog('RECEIVER_READY_RECEIVED', { callId });
        await startCallerOffer();
      });
      ch.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        try {
          callLog('ANSWER_RECEIVED', { callId, sdpLength: payload?.sdp?.length });
          await pc.current?.setRemoteDescription(new RTCSessionDescription(payload));
          callLog('REMOTE_DESCRIPTION_SET', { side: 'caller' });
          for (const c of iceQueue.current) await pc.current?.addIceCandidate(c);
          iceQueue.current = [];
        } catch (e: any) {
          callLog('ANSWER_HANDLING_FAILED', { message: e?.message });
        }
      });
    } else {
      ch.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        try {
          callLog('OFFER_RECEIVED', { callId, sdpLength: payload?.sdp?.length });
          const isVideo = String(payload?.sdp || '').includes('m=video');
          const mode: CallMode = isVideo ? 'video' : 'voice';
          setCallMode(mode);
          modeRef.current = mode;
          const p = pc.current || (await setupPeer(mode));
          await p.setRemoteDescription(new RTCSessionDescription(payload));
          callLog('REMOTE_DESCRIPTION_SET', { side: 'receiver' });
          for (const c of iceQueue.current) await p.addIceCandidate(c);
          iceQueue.current = [];
          const ans = await p.createAnswer();
          await p.setLocalDescription(ans);
          callLog('ANSWER_CREATED', { sdpLength: ans.sdp?.length });
          const desc = p.localDescription || ans;
          const result = await ch.send({ type: 'broadcast', event: 'answer', payload: { type: desc.type, sdp: desc.sdp } });
          callLog('ANSWER_SENT', { callId, result });
        } catch (e: any) {
          callLog('RECEIVER_OFFER_HANDLING_FAILED', { message: e?.message });
          Alert.alert('Call connection failed', e?.message || 'WebRTC answer failed');
        }
      });
    }

    return ch;
  }, [setupPeer, startCallerOffer]);

  const watch = useCallback((id: string) => {
    if (updates.current) supabase.removeChannel(updates.current);
    updates.current = supabase
      .channel(`call-row:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, (p) => {
        const s = (p.new as any).status;
        callLog('CALL_ROW_STATUS', { id, status: s });
        if (['ended', 'rejected', 'missed', 'cancelled', 'failed'].includes(s)) cleanup();
      })
      .subscribe();
  }, [cleanup]);

  // Persistent, singleton listener for incoming calls. Deliberately depends
  // only on [user, loadOther, watch] — both loadOther and watch are now
  // stable across a call's lifetime (watch no longer depends on the
  // offer-triggering callback chain), so this effect does not re-run and
  // does not tear down/resubscribe `calls:{userId}` mid-call.
  useEffect(() => {
    if (!user) return;
    incoming.current = supabase
      .channel(`calls:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` }, (p) => {
        const c: any = p.new;
        if (c.status === 'ringing' && stateRef.current === 'idle') {
          callLog('INCOMING_CALL_DETECTED', { callId: c.id });
          setActiveCall(c);
          loadOther(c);
          setCallMode('voice');
          modeRef.current = 'voice';
          setCallState('ringing-incoming');
          watch(c.id);
          // Receiver only. Use JS-managed bundled audio here; do not invoke
          // InCallManager.startRingtone in the INSERT callback because that
          // native call was the only native operation executed before Accept
          // and could terminate the Android process on affected devices.
          void startIncomingRingtone();
        }
      })
      .subscribe();
    return () => {
      if (incoming.current) supabase.removeChannel(incoming.current);
    };
  }, [user, loadOther, watch, startIncomingRingtone]);

  const startCall = useCallback(async (receiverId: string, mode: CallMode) => {
    if (!user || stateRef.current !== 'idle') return;

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .or(`and(requester_id.eq.${user.id},responder_id.eq.${receiverId}),and(requester_id.eq.${receiverId},responder_id.eq.${user.id})`)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!contact) return void Alert.alert('कॉल नहीं हो सकती', 'कॉल के लिए दोनों users का friend होना जरूरी है।');

    if (!isOnline(receiverId)) {
      await supabase.from('calls').insert({ caller_id: user.id, receiver_id: receiverId, status: 'missed', ended_at: new Date().toISOString() });
      return void Alert.alert('यूज़र ऑफलाइन है', 'कॉल नहीं लगाई गई। Missed call दर्ज कर दी गई है।');
    }

    const { data: call, error } = await supabase.from('calls').insert({ caller_id: user.id, receiver_id: receiverId, status: 'ringing' }).select().single();
    if (error || !call) return void Alert.alert('कॉल शुरू नहीं हुई', error?.message || 'Unknown error');

    callLog('OUTGOING_CALL_CREATED', { callId: call.id, mode });
    setCallMode(mode);
    modeRef.current = mode;
    setActiveCall(call);
    loadOther(call);
    setCallState('ringing-outgoing');
    watch(call.id);

    const ch = bindSignal(call.id, 'caller');
    ch.subscribe(async (status: string) => {
      callLog('CALLER_CHANNEL_STATUS', { callId: call.id, status });
      if (status === 'SUBSCRIBED') {
        callerSignalReady.current = true;
        if (pendingReceiverReady.current) {
          // receiver-ready arrived before this channel finished
          // subscribing — process the buffered signal now.
          pendingReceiverReady.current = false;
          callLog('RECEIVER_READY_DRAINED', { callId: call.id });
          await startCallerOffer();
        }
      }
    });

    timeout.current = setTimeout(async () => {
      if (stateRef.current === 'ringing-outgoing') {
        callLog('CALL_TIMEOUT_MISSED', { callId: call.id });
        await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', call.id);
        cleanup();
      }
    }, 30000);
  }, [user, isOnline, loadOther, watch, bindSignal, cleanup, startCallerOffer]);

  const initiateCall = useCallback((id: string) => startCall(id, 'voice'), [startCall]);
  const initiateVideoCall = useCallback((id: string) => startCall(id, 'video'), [startCall]);

  const acceptCall = useCallback(async () => {
    const call = activeRef.current;
    if (!call || stateRef.current !== 'ringing-incoming') return;
    stopTones();
    setCallState('connecting');
    const ch = bindSignal(call.id, 'receiver');
    ch.subscribe(async (status: string) => {
      callLog('RECEIVER_CHANNEL_STATUS', { callId: call.id, status });
      if (status === 'SUBSCRIBED') {
        const readyResult = await ch.send({ type: 'broadcast', event: 'receiver-ready', payload: {} });
        callLog('RECEIVER_READY_SENT', { callId: call.id, result: readyResult });
        const { error } = await supabase.from('calls').update({ status: 'accepted', answered_at: new Date().toISOString() }).eq('id', call.id);
        if (error) {
          callLog('ACCEPT_DB_UPDATE_FAILED', { message: error.message });
          Alert.alert('कॉल स्वीकार नहीं हुई', error.message);
          cleanup();
        }
      }
    });
  }, [bindSignal, cleanup]);

  const rejectCall = useCallback(async () => {
    if (activeRef.current) {
      await supabase.from('calls').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', activeRef.current.id);
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(async () => {
    if (activeRef.current) {
      await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', activeRef.current.id);
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const t: any = local.current?.getAudioTracks()?.[0];
    if (t) {
      t.enabled = !t.enabled;
      setIsMuted(!t.enabled);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((v) => {
      const n = !v;
      try {
        InCallManager.setForceSpeakerphoneOn(n);
      } catch {}
      return n;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const t: any = local.current?.getVideoTracks()?.[0];
    if (t) {
      t.enabled = !t.enabled;
      setIsCameraOn(t.enabled);
    }
  }, []);

  const switchCamera = useCallback(() => {
    const t: any = local.current?.getVideoTracks()?.[0];
    try {
      t?._switchCamera?.();
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      callState, callMode, activeCall, otherProfile, localStream, remoteStream,
      initiateCall, initiateVideoCall, acceptCall, rejectCall, endCall,
      isMuted, toggleMute, isSpeakerOn, toggleSpeaker, isCameraOn, toggleCamera, switchCamera,
    }),
    [callState, callMode, activeCall, otherProfile, localStream, remoteStream,
      initiateCall, initiateVideoCall, acceptCall, rejectCall, endCall,
      isMuted, toggleMute, isSpeakerOn, toggleSpeaker, isCameraOn, toggleCamera, switchCamera]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useVoiceCall = () => useContext(C);
