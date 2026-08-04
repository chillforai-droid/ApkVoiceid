import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, MediaStream } from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type CallState = 'idle' | 'ringing-outgoing' | 'ringing-incoming' | 'connecting' | 'connected';
type CallContextValue = {
  callState: CallState; activeCall: any | null; otherProfile: any | null;
  initiateCall: (receiverId: string) => Promise<void>; acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>; endCall: () => Promise<void>;
  isMuted: boolean; toggleMute: () => void;
};
const VoiceCallContext = createContext<CallContextValue>({} as CallContextValue);
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const stateRef = useRef<CallState>('idle');
  const [activeCall, setActiveCall] = useState<any>(null);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const pc = useRef<any>(null);
  const localStream = useRef<MediaStream | null>(null);
  const signal = useRef<RealtimeChannel | null>(null);
  const incoming = useRef<RealtimeChannel | null>(null);
  const callUpdates = useRef<RealtimeChannel | null>(null);
  const iceQueue = useRef<any[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = callState; }, [callState]);

  const loadOther = useCallback(async (call: any) => {
    if (!call || !user) return;
    const id = call.caller_id === user.id ? call.receiver_id : call.caller_id;
    const { data } = await supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id', id).maybeSingle();
    setOtherProfile(data ?? null);
  }, [user]);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    try { pc.current?.close(); } catch {}
    pc.current = null;
    localStream.current?.getTracks().forEach((t: any) => t.stop());
    localStream.current = null;
    if (signal.current) supabase.removeChannel(signal.current);
    signal.current = null;
    if (callUpdates.current) supabase.removeChannel(callUpdates.current);
    callUpdates.current = null;
    iceQueue.current = [];
    setCallState('idle'); setActiveCall(null); setOtherProfile(null); setIsMuted(false);
  }, []);

  const ensureMic = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Microphone permission denied');
    }
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false }) as MediaStream;
    localStream.current = stream;
    return stream;
  }, []);

  const watchCall = useCallback((callId: string) => {
    if (callUpdates.current) supabase.removeChannel(callUpdates.current);
    callUpdates.current = supabase.channel(`call-row:${callId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` }, (p) => {
        const s = (p.new as any).status;
        if (['ended','rejected','missed','cancelled','failed'].includes(s)) cleanup();
      }).subscribe();
  }, [cleanup]);

  const setupPeer = useCallback(async () => {
    const peer: any = new RTCPeerConnection(ICE_SERVERS as any);
    pc.current = peer;
    const stream = await ensureMic();
    stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
    peer.onicecandidate = (e: any) => {
      if (e.candidate) signal.current?.send({ type: 'broadcast', event: 'ice-candidate', payload: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallState('connected');
      if (['failed','closed'].includes(peer.connectionState)) cleanup();
    };
    return peer;
  }, [cleanup, ensureMic]);

  useEffect(() => {
    if (!user) return;
    incoming.current = supabase.channel(`calls:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` }, (p) => {
        const c: any = p.new;
        if (c.status === 'ringing' && stateRef.current === 'idle') {
          setActiveCall(c); loadOther(c); setCallState('ringing-incoming'); watchCall(c.id);
        }
      }).subscribe();
    return () => { if (incoming.current) supabase.removeChannel(incoming.current); incoming.current = null; };
  }, [user, loadOther, watchCall]);

  const initiateCall = useCallback(async (receiverId: string) => {
    if (!user || stateRef.current !== 'idle' || !receiverId) return;
    const { data: contact } = await supabase.from('contacts').select('id')
      .or(`and(requester_id.eq.${user.id},responder_id.eq.${receiverId}),and(requester_id.eq.${receiverId},responder_id.eq.${user.id})`)
      .eq('status','accepted').maybeSingle();
    if (!contact) { Alert.alert('कॉल नहीं हो सकती', 'Voice call के लिए दोनों users का contact होना जरूरी है।'); return; }
    const { data: call, error } = await supabase.from('calls').insert({ caller_id:user.id, receiver_id:receiverId, status:'ringing' }).select().single();
    if (error || !call) { Alert.alert('कॉल शुरू नहीं हुई', error?.message ?? 'Unknown error'); return; }
    setActiveCall(call); loadOther(call); setCallState('ringing-outgoing'); watchCall(call.id);
    signal.current = supabase.channel(`voice-call:${call.id}`);
    signal.current.on('broadcast',{event:'receiver-ready'}, async () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCallState('connecting');
      const peer:any = await setupPeer();
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      await signal.current?.send({type:'broadcast',event:'offer',payload:offer});
    });
    signal.current.on('broadcast',{event:'answer'}, async ({payload}:any) => {
      await pc.current?.setRemoteDescription(new RTCSessionDescription(payload));
      for (const c of iceQueue.current) await pc.current?.addIceCandidate(c); iceQueue.current=[];
    });
    signal.current.on('broadcast',{event:'ice-candidate'}, async ({payload}:any) => {
      const c = new RTCIceCandidate(payload); if (pc.current?.remoteDescription) await pc.current.addIceCandidate(c); else iceQueue.current.push(c);
    });
    signal.current.subscribe();
    timeoutRef.current = setTimeout(async () => {
      if (stateRef.current === 'ringing-outgoing') {
        await supabase.from('calls').update({status:'missed',ended_at:new Date().toISOString()}).eq('id',call.id); cleanup();
      }
    },30000);
  }, [user, cleanup, loadOther, setupPeer, watchCall]);

  const acceptCall = useCallback(async () => {
    if (!activeCall || stateRef.current !== 'ringing-incoming') return;
    setCallState('connecting');
    signal.current = supabase.channel(`voice-call:${activeCall.id}`);
    signal.current.on('broadcast',{event:'offer'}, async ({payload}:any) => {
      const peer:any = await setupPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(payload));
      for (const c of iceQueue.current) await peer.addIceCandidate(c); iceQueue.current=[];
      const answer=await peer.createAnswer(); await peer.setLocalDescription(answer);
      await signal.current?.send({type:'broadcast',event:'answer',payload:answer});
    });
    signal.current.on('broadcast',{event:'ice-candidate'}, async ({payload}:any) => {
      const c=new RTCIceCandidate(payload); if(pc.current?.remoteDescription) await pc.current.addIceCandidate(c); else iceQueue.current.push(c);
    });
    signal.current.subscribe(async (status) => {
      if(status==='SUBSCRIBED') await signal.current?.send({type:'broadcast',event:'receiver-ready',payload:{ready:true}});
    });
    const { error } = await supabase.from('calls').update({status:'accepted',answered_at:new Date().toISOString()}).eq('id',activeCall.id);
    if(error){ Alert.alert('कॉल स्वीकार नहीं हुई',error.message); cleanup(); }
  }, [activeCall, cleanup, setupPeer]);

  const rejectCall = useCallback(async () => {
    if (activeCall) await supabase.from('calls').update({status:'rejected',ended_at:new Date().toISOString()}).eq('id',activeCall.id);
    cleanup();
  }, [activeCall, cleanup]);
  const endCall = useCallback(async () => {
    if (activeCall) await supabase.from('calls').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',activeCall.id);
    cleanup();
  }, [activeCall, cleanup]);
  const toggleMute = useCallback(() => {
    const track:any=localStream.current?.getAudioTracks()?.[0]; if(!track)return; track.enabled=!track.enabled; setIsMuted(!track.enabled);
  },[]);


  const value=useMemo(()=>({callState,activeCall,otherProfile,initiateCall,acceptCall,rejectCall,endCall,isMuted,toggleMute}),[callState,activeCall,otherProfile,initiateCall,acceptCall,rejectCall,endCall,isMuted,toggleMute]);
  return <VoiceCallContext.Provider value={value}>{children}</VoiceCallContext.Provider>;
}
export const useVoiceCall=()=>useContext(VoiceCallContext);
