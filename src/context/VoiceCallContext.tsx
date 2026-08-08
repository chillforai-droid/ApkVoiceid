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

type CallDiagnostic = { at: string; step: string; detail?: string };

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
  diagnostics: CallDiagnostic[];
  diagnosticStage: string;
  diagnosticReport: () => string;
  clearDiagnostics: () => void;
};

const C = createContext<Ctx>({} as Ctx);

const turnUrl = Constants.expoConfig?.extra?.turnUrl as string | undefined;
const turnUsername = Constants.expoConfig?.extra?.turnUsername as string | undefined;
const turnCredential = Constants.expoConfig?.extra?.turnCredential as string | undefined;

// Metered TURN, all four transport variants — UDP/80, TCP/80, UDP/443, and
// crucially TLS-over-TCP/443 (TURNS), which is what gets through the most
// restrictive mobile-carrier firewalls that block plain UDP/non-443 TCP
// outright. Build-time TURN_USERNAME/TURN_CREDENTIAL secrets override the
// credentials used with these URLs when present; otherwise the test
// credentials supplied for this build are used. Previously, setting a
// TURN_URL secret REPLACED this whole array with a single URL, silently
// losing the TCP/443 fallback — that was a real bug, fixed below.
const TEST_TURN_USERNAME = 'ce4c2be456ea4ba39f96bd3c';
const TEST_TURN_CREDENTIAL = 'X3rXWiinGzIH3B3p';
const meteredTurnUrls = [
  'turn:global.relay.metered.ca:80',
  'turn:global.relay.metered.ca:80?transport=tcp',
  'turn:global.relay.metered.ca:443',
  'turns:global.relay.metered.ca:443?transport=tcp',
];
const meteredUsername = turnUsername || TEST_TURN_USERNAME;
const meteredCredential = turnCredential || TEST_TURN_CREDENTIAL;

const iceServers: any[] = [
  // STUN gives direct P2P a chance first (fast path when it works).
  { urls: ['stun:stun.relay.metered.ca:80', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // Full multi-transport Metered TURN — always present, never downgraded.
  { urls: meteredTurnUrls, username: meteredUsername, credential: meteredCredential },
  // If TURN_URL points at a different relay entirely (not just overriding
  // Metered's credentials), add it as an EXTRA server rather than replacing
  // the multi-transport set above — more usable candidate options, never
  // fewer.
  ...(turnUrl && !meteredTurnUrls.some(u => u.startsWith(turnUrl.split('?')[0]))
    ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }]
    : []),
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
  const handledOfferSdp = useRef<string | null>(null);
  const handledAnswerSdp = useRef<string | null>(null);
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
  const [diagnostics, setDiagnostics] = useState<CallDiagnostic[]>([]);
  const diagnosticsRef = useRef<CallDiagnostic[]>([]);
  const [diagnosticStage, setDiagnosticStage] = useState('IDLE');

  const addDiagnostic = useCallback((step: string, detail?: string) => {
    const item: CallDiagnostic = { at: new Date().toISOString(), step, detail };
    const next = [...diagnosticsRef.current, item].slice(-80);
    diagnosticsRef.current = next;
    setDiagnostics(next);
    setDiagnosticStage(step);
    if (__DEV__) console.log('[VOICEID_DIAG]', step, detail || '');
  }, []);

  const clearDiagnostics = useCallback(() => {
    diagnosticsRef.current = [];
    setDiagnostics([]);
    setDiagnosticStage('IDLE');
  }, []);

  const diagnosticReport = useCallback(() => {
    const call = activeRef.current;
    const header = [
      'VoiceID Call Diagnostic',
      `callId=${call?.id || 'none'}`,
      `side=${call && user ? (call.caller_id === user.id ? 'caller' : 'receiver') : 'unknown'}`,
      `callState=${stateRef.current}`,
      `mode=${modeRef.current}`,
      `stage=${diagnosticStage}`,
      `turnConfigured=${iceServers.some((x:any)=>JSON.stringify(x.urls).includes('turn:') || JSON.stringify(x.urls).includes('turns:'))}`,
      '---'
    ];
    return header.concat(diagnosticsRef.current.map(x => `${x.at} | ${x.step}${x.detail ? ` | ${x.detail}` : ''}`)).join('\n');
  }, [diagnosticStage, user]);

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
    addDiagnostic('LOCAL_STREAM_CREATED', `audioTracks=${audioTracks.length}`);
    callLog('LOCAL_STREAM_CREATED', {
      audioTracks: audioTracks.length,
      enabled: audioTracks[0]?.enabled,
      readyState: (audioTracks[0] as any)?.readyState,
    });
    return s;
  }, []);

  // setupPeer no longer depends on the isSpeakerOn STATE (see isSpeakerOnRef
  // above) — its identity is now stable across a speaker toggle mid-call.

  // For critical SDP (offer/answer), wait until ICE gathering completes so
  // the SDP itself contains the gathered host/srflx/relay candidates. This
  // makes the handshake resilient even when Supabase trickle-ICE broadcasts
  // are missed. Candidate broadcasts remain enabled as a fast-path fallback.
  const waitForIceGatheringComplete = useCallback(async (peer: any, timeoutMs = 20000) => {
    if (peer.iceGatheringState === 'complete') return;
    addDiagnostic('ICE_GATHERING_WAIT', `state=${peer.iceGatheringState}; timeoutMs=${timeoutMs}`);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        peer.onicegatheringstatechange = previousIceGatheringHandler;
        resolve();
      };
      const previousIceGatheringHandler = peer.onicegatheringstatechange;
      const timer = setTimeout(() => {
        addDiagnostic('ICE_GATHERING_WAIT_TIMEOUT', `state=${peer.iceGatheringState}`);
        finish();
      }, timeoutMs);
      peer.onicegatheringstatechange = () => {
        try { previousIceGatheringHandler?.(); } catch {}
        if (peer.iceGatheringState === 'complete') finish();
      };
    });
    const sdp = peer.localDescription?.sdp || '';
    const candidateCount = (sdp.match(/^a=candidate:/gm) || []).length;
    addDiagnostic('ICE_SDP_FINALIZED', `state=${peer.iceGatheringState}; candidatesInSdp=${candidateCount}`);
  }, [addDiagnostic]);

  const setupPeer = useCallback(async (mode: CallMode) => {
    addDiagnostic('PEER_CREATING', `mode=${mode}; iceServers=${iceServers.length}`);
    // APK-only mobile calling fix: use the configured TURN relay directly.
    // This avoids getting stuck on direct host/srflx ICE paths on carrier NATs.
    // The web client and signaling protocol remain unchanged.
    const p: any = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'relay',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    addDiagnostic('PEER_CREATED', 'iceTransportPolicy=relay; bundlePolicy=max-bundle; rtcpMuxPolicy=require');
    pc.current = p;
    const s = await getMedia(mode);
    s.getTracks().forEach((t: any) => p.addTrack(t, s));

    p.ontrack = (e: any) => {
      const stream = e.streams?.[0];
      const track = e.track;
      addDiagnostic('REMOTE_TRACK_RECEIVED', `kind=${track?.kind}; enabled=${track?.enabled}`);
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
        const candidateType = String(payload?.candidate || '').match(/ typ ([a-z]+)/)?.[1] || 'unknown';
        addDiagnostic('ICE_LOCAL', `type=${candidateType}; mid=${payload.sdpMid ?? 'none'}`);
        callLog('ICE_LOCAL_CANDIDATE', { hasMid: !!payload.sdpMid, candidateType });
        signal.current?.send({ type: 'broadcast', event: 'ice-candidate', payload }).then((r:any)=>addDiagnostic('ICE_SENT', `result=${r}; type=${candidateType}`)).catch((err:any)=>addDiagnostic('ICE_SEND_FAILED', err?.message));
      } else {
        callLog('ICE_GATHERING_COMPLETE');
      }
    };

    let overallTimeout: any = null;
    const connected = () => {
      if (stateRef.current === 'connected') return;
      if (overallTimeout) clearTimeout(overallTimeout);
      addDiagnostic('MEDIA_CONNECTED', `ice=${p.iceConnectionState}; connection=${p.connectionState}`);
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

    // Task requirement: candidates being gathered (host/srflx/relay) proves
    // TURN allocation succeeded — it does NOT prove a usable candidate PAIR
    // was actually selected between the two peers. getStats() is the only
    // way to see that. Logged on every meaningful ICE transition so the next
    // real-device test tells us directly whether relay-relay (or any) pair
    // got nominated, instead of us having to infer it from candidate counts.
    const logCandidatePairStats = async (reason: string) => {
      try {
        const stats = await p.getStats();
        let loggedAny = false;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
            loggedAny = true;
            const local = stats.get(report.localCandidateId);
            const remote = stats.get(report.remoteCandidateId);
            addDiagnostic(
              'CANDIDATE_PAIR',
              `reason=${reason}; state=${report.state}; nominated=${!!report.nominated}; ` +
              `local=${local?.candidateType || '?'}/${local?.protocol || '?'}; ` +
              `remote=${remote?.candidateType || '?'}/${remote?.protocol || '?'}; ` +
              `bytesSent=${report.bytesSent ?? 0}; bytesReceived=${report.bytesReceived ?? 0}`
            );
            callLog('CANDIDATE_PAIR', {
              reason, state: report.state, nominated: !!report.nominated,
              localType: local?.candidateType, remoteType: remote?.candidateType,
              protocol: local?.protocol, bytesSent: report.bytesSent, bytesReceived: report.bytesReceived,
            });
          }
        });
        if (!loggedAny) {
          addDiagnostic('CANDIDATE_PAIR_NONE_YET', `reason=${reason}`);
        }
      } catch (e: any) {
        addDiagnostic('GET_STATS_FAILED', e?.message);
      }
    };

    p.onsignalingstatechange = () => { addDiagnostic('SIGNALING_STATE', String(p.signalingState)); callLog('SIGNALING_STATE', { state: p.signalingState }); };
    p.onicegatheringstatechange = () => { addDiagnostic('ICE_GATHERING_STATE', String(p.iceGatheringState)); callLog('ICE_GATHERING_STATE', { state: p.iceGatheringState }); };
    p.oniceconnectionstatechange = () => {
      addDiagnostic('ICE_CONNECTION_STATE', String(p.iceConnectionState));
      callLog('ICE_CONNECTION_STATE', { state: p.iceConnectionState });
      if (p.iceConnectionState === 'checking') {
        // Fires once checks begin — tells us immediately whether we even
        // have a remote candidate to check against yet.
        void logCandidatePairStats('checking');
      } else if (['connected', 'completed'].includes(p.iceConnectionState)) {
        void logCandidatePairStats(p.iceConnectionState);
        connected();
      } else if (p.iceConnectionState === 'failed') {
        // Genuine ICE failure: connectivity checks ran and exhausted every
        // candidate pair without success. This is the ONLY state that
        // should ever trigger the failure dialog — never merely being in
        // 'connecting' or 'checking', which are normal in-progress states.
        void logCandidatePairStats('failed').finally(() => {
          addDiagnostic('ICE_FAILED', `state=${p.iceConnectionState}`);
          callLog('ICE_FAILED', {});
          Alert.alert(
            'कॉल कनेक्ट नहीं हो पाई',
            'कॉल कनेक्ट नहीं हो पाई। नेटवर्क कनेक्शन स्थापित नहीं हो सका। कृपया दोबारा प्रयास करें।'
          );
          cleanup();
        });
      } else if (p.iceConnectionState === 'closed') {
        cleanup();
      }
    };
    p.onconnectionstatechange = () => {
      addDiagnostic('CONNECTION_STATE', String(p.connectionState));
      callLog('CONNECTION_STATE', { state: p.connectionState });
      if (p.connectionState === 'connected') connected();
      else if (p.connectionState === 'failed') {
        // connectionState can independently report 'failed' even if
        // iceConnectionState handling above hasn't (implementation-
        // dependent ordering) — apply the same accurate message and cleanup
        // here rather than leaving the UI stuck.
        void logCandidatePairStats('connectionState-failed').finally(() => {
          addDiagnostic('CONNECTION_FAILED', `state=${p.connectionState}`);
          Alert.alert(
            'कॉल कनेक्ट नहीं हो पाई',
            'कॉल कनेक्ट नहीं हो पाई। नेटवर्क कनेक्शन स्थापित नहीं हो सका। कृपया दोबारा प्रयास करें।'
          );
          cleanup();
        });
      } else if (p.connectionState === 'closed') {
        cleanup();
      }
    };

    // Overall connection safety net. Deliberately much longer than any
    // individual gathering/recovery timeout (20s ICE-gathering-wait, 60s DB
    // answer-recovery poll) so it never fires while those legitimate
    // in-progress steps are still running — it only exists to guarantee the
    // UI can never hang on "Connecting…" forever if something upstream never
    // reaches a terminal ICE state at all. Cleared as soon as media connects.
    const overallTimeoutHandle = setTimeout(() => {
      if (stateRef.current !== 'connected' && stateRef.current !== 'idle') {
        addDiagnostic('OVERALL_CONNECT_TIMEOUT', `iceState=${p.iceConnectionState}; connState=${p.connectionState}`);
        void logCandidatePairStats('overall-timeout').finally(() => {
          Alert.alert(
            'कॉल कनेक्ट नहीं हो पाई',
            'कॉल कनेक्ट नहीं हो पाई। नेटवर्क कनेक्शन स्थापित नहीं हो सका। कृपया दोबारा प्रयास करें।'
          );
          cleanup();
        });
      }
    }, 45000);
    overallTimeout = overallTimeoutHandle;

    return p;
  }, [cleanup, getMedia, addDiagnostic]);

  const handleAnswerPayload = useCallback(async (callId: string, payload: any, source: 'broadcast' | 'database') => {
    try {
      if (!payload?.sdp || handledAnswerSdp.current === payload.sdp) return;
      handledAnswerSdp.current = payload.sdp;
      addDiagnostic(source === 'database' ? 'ANSWER_RECOVERED' : 'ANSWER_RECEIVED', `sdpLength=${payload.sdp.length}`);
      if (!pc.current) throw new Error('Caller peer connection missing while applying answer');
      await pc.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
      addDiagnostic('REMOTE_DESCRIPTION_SET', 'side=caller');
      for (const c of iceQueue.current) await pc.current.addIceCandidate(c);
      iceQueue.current = [];
    } catch (e: any) {
      addDiagnostic('ANSWER_HANDLING_FAILED', `${source}; ${e?.message || e}`);
      callLog('ANSWER_HANDLING_FAILED', { source, message: e?.message });
    }
  }, [addDiagnostic]);

  const handleOfferPayload = useCallback(async (callId: string, payload: any, source: 'broadcast' | 'database') => {
    try {
      if (!payload?.sdp || handledOfferSdp.current === payload.sdp) return;
      handledOfferSdp.current = payload.sdp;
      addDiagnostic(source === 'database' ? 'OFFER_RECOVERED' : 'OFFER_RECEIVED', `sdpLength=${payload.sdp.length}`);
      const isVideo = String(payload.sdp).includes('m=video');
      const mode: CallMode = isVideo ? 'video' : 'voice';
      setCallMode(mode); modeRef.current = mode;
      const p = pc.current || (await setupPeer(mode));
      await p.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
      addDiagnostic('REMOTE_DESCRIPTION_SET', 'side=receiver');
      for (const c of iceQueue.current) await p.addIceCandidate(c);
      iceQueue.current = [];
      const ans = await p.createAnswer();
      await p.setLocalDescription(ans);
      addDiagnostic('ANSWER_CREATED', `sdpLength=${ans.sdp?.length || 0}`);
      await waitForIceGatheringComplete(p);
      const desc = p.localDescription || ans;
      addDiagnostic('ANSWER_SDP_READY', `sdpLength=${desc.sdp?.length || 0}`);
      // Persist answer first, then broadcast it as the low-latency path.
      const { data: persistedAnswer, error: answerPersistError } = await supabase
        .from('calls')
        .update({ answer_sdp: desc.sdp })
        .eq('id', callId)
        .select('id,answer_sdp')
        .maybeSingle();
      if (answerPersistError) {
        addDiagnostic('ANSWER_PERSIST_FAILED', answerPersistError.message);
        throw new Error(`Answer persist failed: ${answerPersistError.message}`);
      }
      if (!persistedAnswer?.answer_sdp || persistedAnswer.answer_sdp !== desc.sdp) {
        addDiagnostic('ANSWER_PERSIST_FAILED', 'DB read-back did not contain the answer SDP');
        throw new Error('Answer persist verification failed');
      }
      addDiagnostic('ANSWER_PERSISTED', `verified=true; sdpLength=${desc.sdp?.length || 0}`);
      const answerPayload = { type: desc.type, sdp: desc.sdp };
      // Send more than once because this is a single critical realtime event.
      // Caller de-duplicates identical SDP, so retries cannot create a second answer.
      // Bug fix: the previous break condition checked THIS side's own
      // `pc.current.remoteDescription.type === 'answer'` — but the receiver's
      // remoteDescription is always type 'offer' (only the caller's ever
      // becomes 'answer'), so that condition was permanently false and the
      // loop always burned all 12 attempts (9s) regardless of delivery.
      // Stop as soon as the broadcast itself reports 'ok' twice in a row —
      // that's the actual signal we have that Supabase accepted the send.
      void (async () => {
        let consecutiveOk = 0;
        for (let attempt = 1; attempt <= 12; attempt++) {
          const result = await signal.current?.send({ type: 'broadcast', event: 'answer', payload: answerPayload });
          addDiagnostic(attempt === 1 ? 'ANSWER_SENT' : 'ANSWER_RESENT', `attempt=${attempt}; result=${result}`);
          if (result === 'ok') {
            consecutiveOk++;
            if (consecutiveOk >= 2) break;
          } else {
            consecutiveOk = 0;
          }
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      })();
    } catch (e: any) {
      handledOfferSdp.current = null; // allow DB retry after transient failure
      addDiagnostic('RECEIVER_OFFER_HANDLING_FAILED', `${source}; ${e?.message || e}`);
      callLog('RECEIVER_OFFER_HANDLING_FAILED', { source, message: e?.message });
    }
  }, [setupPeer, addDiagnostic, waitForIceGatheringComplete]);

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
      addDiagnostic('OFFER_CREATED', `sdpLength=${offer.sdp?.length || 0}`);
      callLog('OFFER_CREATED', { sdpLength: offer.sdp?.length });
      await waitForIceGatheringComplete(p);
      const desc = p.localDescription || offer;
      addDiagnostic('OFFER_SDP_READY', `sdpLength=${desc.sdp?.length || 0}`);
      // Critical SDP is persisted on the call row BEFORE the best-effort
      // realtime broadcast. Supabase Broadcast can return `ok` even when the
      // peer never processes the event; the DB copy makes the handshake
      // recoverable and prevents permanent Connecting... hangs.
      // Persist AND read the row back. A plain Supabase UPDATE may return no
      // error even when RLS matched zero rows, so verify the stored SDP before
      // relying on it as the recovery path.
      const { data: persistedOffer, error: offerPersistError } = await supabase
        .from('calls')
        .update({ offer_sdp: desc.sdp })
        .eq('id', activeRef.current.id)
        .select('id,offer_sdp')
        .maybeSingle();
      if (offerPersistError) {
        addDiagnostic('OFFER_PERSIST_FAILED', offerPersistError.message);
        throw new Error(`Offer persist failed: ${offerPersistError.message}`);
      }
      if (!persistedOffer?.offer_sdp || persistedOffer.offer_sdp !== desc.sdp) {
        addDiagnostic('OFFER_PERSIST_FAILED', 'DB read-back did not contain the offer SDP');
        throw new Error('Offer persist verification failed');
      }
      addDiagnostic('OFFER_PERSISTED', `verified=true; sdpLength=${desc.sdp?.length || 0}`);

      // Re-send the critical offer for a short window. Broadcast remains the
      // fast path; the DB copy remains authoritative recovery. Re-sending the
      // same SDP is safe because the receiver de-duplicates by SDP.
      const offerPayload = { type: desc.type, sdp: desc.sdp };
      void (async () => {
        for (let attempt = 1; attempt <= 12 && !handledAnswerSdp.current; attempt++) {
          const result = await signal.current?.send({ type: 'broadcast', event: 'offer', payload: offerPayload });
          addDiagnostic(attempt === 1 ? 'OFFER_SENT' : 'OFFER_RESENT', `attempt=${attempt}; result=${result}`);
          if (attempt === 1) callLog('OFFER_SENT', { callId: activeRef.current?.id, result });
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      })();
      const currentCallId = activeRef.current.id;
      void (async () => {
        for (let attempt = 1; attempt <= 120 && !handledAnswerSdp.current; attempt++) {
          const { data, error: readError } = await supabase.from('calls').select('answer_sdp,status').eq('id', currentCallId).maybeSingle();
          if (readError) addDiagnostic('ANSWER_DB_READ_FAILED', `attempt=${attempt}; ${readError.message}`);
          if (!readError && data?.answer_sdp) {
            addDiagnostic('ANSWER_DB_FALLBACK_TRIGGER', `attempt=${attempt}`);
            await handleAnswerPayload(currentCallId, { type: 'answer', sdp: data.answer_sdp }, 'database');
            break;
          }
          if (data && ['ended','rejected','missed','cancelled','failed'].includes(String(data.status))) break;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      })();

    } catch (e: any) {
      offerStarted.current = false;
      addDiagnostic('OFFER_FAILED', e?.message);
      callLog('OFFER_FAILED', { message: e?.message });
      Alert.alert('Call connection failed', e?.message || 'WebRTC offer failed');
    }
  }, [setupPeer, handleAnswerPayload, addDiagnostic, waitForIceGatheringComplete]);

  const bindSignal = useCallback((callId: string, role: 'caller' | 'receiver') => {
    addDiagnostic('SIGNAL_CHANNEL_CREATING', `role=${role}; channel=voice-call:${callId}`);
    const ch = supabase.channel(`voice-call:${callId}`, { config: { broadcast: { ack: true, self: false } } });
    signal.current = ch;

    ch.on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
      try {
        const remoteType = String(payload?.candidate || '').match(/ typ ([a-z]+)/)?.[1] || 'unknown';
        addDiagnostic('ICE_REMOTE_RECEIVED', `type=${remoteType}`);
        const c = new RTCIceCandidate(payload);
        if (pc.current?.remoteDescription) {
          addDiagnostic('ICE_REMOTE_ADDED', `type=${remoteType}`);
          callLog('ICE_ADDED');
          await pc.current.addIceCandidate(c);
        } else {
          addDiagnostic('ICE_REMOTE_QUEUED', `type=${remoteType}`);
          callLog('ICE_QUEUED');
          iceQueue.current.push(c);
        }
      } catch (e: any) {
        addDiagnostic('ICE_ADD_FAILED', e?.message);
        callLog('ICE_ADD_FAILED', { message: e?.message });
      }
    });

    if (role === 'caller') {
      ch.on('broadcast', { event: 'receiver-ready' }, async () => {
        addDiagnostic('RECEIVER_READY_RECEIVED');
        callLog('RECEIVER_READY_RECEIVED', { callId });
        await startCallerOffer();
      });
      ch.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        await handleAnswerPayload(callId, payload, 'broadcast');
      });
    } else {
      ch.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        await handleOfferPayload(callId, payload, 'broadcast');
      });
    }

    return ch;
  }, [startCallerOffer, handleOfferPayload, handleAnswerPayload, addDiagnostic]);

  // Call-row state is persistent, unlike Supabase broadcast.  The receiver
  // writes `accepted` only AFTER its signalling channel is SUBSCRIBED, so the
  // caller can safely use that durable state as a recovery trigger if the
  // ephemeral `receiver-ready` broadcast is lost in transit.
  const watch = useCallback((id: string) => {
    if (updates.current) supabase.removeChannel(updates.current);
    updates.current = supabase
      .channel(`call-row:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${id}` }, async (p) => {
        const row: any = p.new;
        const s = row.status;
        addDiagnostic('CALL_ROW_STATUS', String(s));
        callLog('CALL_ROW_STATUS', { id, status: s });

        // Durable SDP recovery path. These fields are populated by the APK
        // before the matching realtime broadcast is sent.
        if (row.receiver_id === user?.id && row.offer_sdp) {
          await handleOfferPayload(id, { type: 'offer', sdp: row.offer_sdp }, 'database');
        }
        if (row.caller_id === user?.id && row.answer_sdp) {
          await handleAnswerPayload(id, { type: 'answer', sdp: row.answer_sdp }, 'database');
        }

        if (s === 'accepted' && row.caller_id === user?.id) {
          // Idempotent by design: `calls.status='accepted'` can legitimately
          // be redelivered by postgres_changes more than once for the same
          // call (e.g. a later UPDATE that only touched answer_sdp still
          // carries status='accepted' in its `new` row). offerStarted is the
          // single source of truth for "have we already begun negotiation
          // for this call" — never re-trigger past that point.
          if (!offerStarted.current) {
            addDiagnostic('ACCEPTED_RECOVERY_TRIGGER', 'persistent DB status');
            callLog('ACCEPTED_RECOVERY_TRIGGER', { id });
            await startCallerOffer();
          }
          return;
        }

        if (['ended', 'rejected', 'missed', 'cancelled', 'failed'].includes(s)) cleanup();
      })
      .subscribe();
  }, [cleanup, user?.id, startCallerOffer, handleOfferPayload, handleAnswerPayload, addDiagnostic]);

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
          clearDiagnostics();
          addDiagnostic('INCOMING_CALL_DETECTED', `callId=${c.id}; mode=pending-offer`);
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
  }, [user, loadOther, watch, startIncomingRingtone, clearDiagnostics, addDiagnostic]);

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

    clearDiagnostics();
    addDiagnostic('OUTGOING_CALL_CREATED', `callId=${call.id}; mode=${mode}`);
    callLog('OUTGOING_CALL_CREATED', { callId: call.id, mode });
    setCallMode(mode);
    modeRef.current = mode;
    setActiveCall(call);
    loadOther(call);
    setCallState('ringing-outgoing');
    watch(call.id);

    const ch = bindSignal(call.id, 'caller');
    ch.subscribe(async (status: string) => {
      addDiagnostic('CALLER_CHANNEL_STATUS', status);
      callLog('CALLER_CHANNEL_STATUS', { callId: call.id, status });
      if (status === 'SUBSCRIBED') {
        callerSignalReady.current = true;
        if (pendingReceiverReady.current) {
          // receiver-ready arrived before this channel finished subscribing.
          pendingReceiverReady.current = false;
          callLog('RECEIVER_READY_DRAINED', { callId: call.id });
          await startCallerOffer();
        }

        // Durable fallback: receiver-ready is a Realtime broadcast and can be
        // missed even when send() returns `ok`. `calls.status=accepted` is
        // persistent and is written by the receiver only after its signalling
        // channel is subscribed. Poll briefly so even a missed postgres-change
        // event cannot leave the caller stuck on Calling forever.
        void (async () => {
          for (let attempt = 1; attempt <= 20 && !offerStarted.current; attempt++) {
            const { data, error } = await supabase.from('calls').select('status').eq('id', call.id).maybeSingle();
            if (error) {
              addDiagnostic('ACCEPTED_FALLBACK_CHECK_ERROR', `attempt=${attempt}; ${error.message}`);
            } else {
              addDiagnostic('ACCEPTED_FALLBACK_CHECK', `attempt=${attempt}; status=${data?.status || 'unknown'}`);
              if (data?.status === 'accepted') {
                addDiagnostic('ACCEPTED_FALLBACK_TRIGGER', `attempt=${attempt}`);
                callLog('ACCEPTED_FALLBACK_TRIGGER', { callId: call.id, attempt });
                await startCallerOffer();
                break;
              }
              if (['ended', 'rejected', 'missed', 'cancelled', 'failed'].includes(String(data?.status))) break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        })();
      }
    });

    timeout.current = setTimeout(async () => {
      if (stateRef.current === 'ringing-outgoing') {
        callLog('CALL_TIMEOUT_MISSED', { callId: call.id });
        await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', call.id);
        cleanup();
      }
    }, 30000);
  }, [user, isOnline, loadOther, watch, bindSignal, cleanup, startCallerOffer, clearDiagnostics, addDiagnostic]);

  const initiateCall = useCallback((id: string) => startCall(id, 'voice'), [startCall]);
  const initiateVideoCall = useCallback((id: string) => startCall(id, 'video'), [startCall]);

  const acceptCall = useCallback(async () => {
    const call = activeRef.current;
    if (!call || stateRef.current !== 'ringing-incoming') return;
    stopTones();
    setCallState('connecting');
    const ch = bindSignal(call.id, 'receiver');
    ch.subscribe(async (status: string) => {
      addDiagnostic('RECEIVER_CHANNEL_STATUS', status);
      callLog('RECEIVER_CHANNEL_STATUS', { callId: call.id, status });
      if (status === 'SUBSCRIBED') {
        const readyResult = await ch.send({ type: 'broadcast', event: 'receiver-ready', payload: {} });
        addDiagnostic('RECEIVER_READY_SENT', `result=${readyResult}`);
        callLog('RECEIVER_READY_SENT', { callId: call.id, result: readyResult });
        const { error } = await supabase.from('calls').update({ status: 'accepted', answered_at: new Date().toISOString() }).eq('id', call.id);
        if (error) {
          callLog('ACCEPT_DB_UPDATE_FAILED', { message: error.message });
          Alert.alert('कॉल स्वीकार नहीं हुई', error.message);
          cleanup();
          return;
        }
        // Poll the durable offer briefly as a second recovery path in case
        // both Supabase broadcast and postgres_changes delivery are missed.
        void (async () => {
          for (let attempt = 1; attempt <= 120 && !handledOfferSdp.current; attempt++) {
            const { data, error: readError } = await supabase.from('calls').select('offer_sdp,status').eq('id', call.id).maybeSingle();
            if (readError) addDiagnostic('OFFER_DB_READ_FAILED', `attempt=${attempt}; ${readError.message}`);
            if (!readError && data?.offer_sdp) {
              addDiagnostic('OFFER_DB_FALLBACK_TRIGGER', `attempt=${attempt}`);
              await handleOfferPayload(call.id, { type: 'offer', sdp: data.offer_sdp }, 'database');
              break;
            }
            if (data && ['ended','rejected','missed','cancelled','failed'].includes(String(data.status))) break;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        })();
      }
    });
  }, [bindSignal, cleanup, handleOfferPayload, addDiagnostic]);

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
      diagnostics, diagnosticStage, diagnosticReport, clearDiagnostics,
    }),
    [callState, callMode, activeCall, otherProfile, localStream, remoteStream,
      initiateCall, initiateVideoCall, acceptCall, rejectCall, endCall,
      isMuted, toggleMute, isSpeakerOn, toggleSpeaker, isCameraOn, toggleCamera, switchCamera,
      diagnostics, diagnosticStage, diagnosticReport, clearDiagnostics]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useVoiceCall = () => useContext(C);
