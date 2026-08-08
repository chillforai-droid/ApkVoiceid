import React, { useEffect, useState } from 'react';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export const CallManager = () => {
    const { callState, activeCall, acceptCall, endCall, remoteAudioRef, isMuted, toggleMute, isSpeakerOn, toggleSpeaker, isOutputSelectionSupported } = useVoiceCall();
    const [otherProfile, setOtherProfile] = useState<any>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!activeCall) {
            setOtherProfile(null);
            return;
        }
        const otherId = activeCall.caller_id === user?.id ? activeCall.receiver_id : activeCall.caller_id;
        supabase.from('profiles').select('*').eq('id', otherId).maybeSingle().then(({ data }) => setOtherProfile(data));
    }, [activeCall, user]);

    if (callState === 'idle') return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 pt-safe pb-safe">
            <audio ref={remoteAudioRef} autoPlay playsInline />
            {otherProfile && (
                <div className="w-24 h-24 rounded-full bg-gray-100 mb-6 overflow-hidden">
                    {otherProfile.avatar_url && <img src={otherProfile.avatar_url} alt={otherProfile.display_name} decoding="async" className="w-full h-full object-cover" />}
                </div>
            )}
            
            {callState === 'ringing-outgoing' && (
                <div className="text-center space-y-4">
                    <h2 className="text-xl font-bold px-4 max-w-full truncate">{otherProfile?.display_name || 'Calling...'}</h2>
                    <p className="text-gray-500">Calling...</p>
                    <button onClick={endCall} className="p-4 bg-red-500 text-white rounded-full">
                        <PhoneOff size={32} />
                    </button>
                </div>
            )}
            {callState === 'ringing-incoming' && (
                <div className="text-center space-y-4">
                    <h2 className="text-xl font-bold px-4 max-w-full truncate">{otherProfile?.display_name || 'Incoming Call'}</h2>
                    <p className="text-gray-500">Incoming voice call</p>
                    <div className="flex gap-4">
                        <button onClick={acceptCall} className="p-4 bg-green-500 text-white rounded-full">Accept</button>
                        <button onClick={endCall} className="p-4 bg-red-500 text-white rounded-full">Decline</button>
                    </div>
                </div>
            )}
             {callState === 'connected' && (
                <div className="text-center space-y-4">
                    <h2 className="text-xl font-bold px-4 max-w-full truncate">{otherProfile?.display_name || 'Connected'}</h2>
                    <p className="text-gray-500">Connected</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={toggleMute} className={`p-4 rounded-full ${isMuted ? 'bg-gray-400' : 'bg-gray-100'}`}>
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                        {isOutputSelectionSupported && (
                             <button onClick={toggleSpeaker} className={`p-4 rounded-full ${isSpeakerOn ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                                {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                            </button>
                        )}
                        <button onClick={endCall} className="p-4 bg-red-500 text-white rounded-full">
                            <PhoneOff size={32} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
