import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Phone, Mic, UserPlus, Loader2, UserCheck, UserX, Ban, Share } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVoiceCall } from '../hooks/useVoiceCall';
import { usePresence } from '../context/PresenceContext';
import { useSEO } from '../hooks/useSEO';

export default function UserProfilePage() {
  const { id, username } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { initiateCall, canCallUser } = useVoiceCall();
  const { isUserOnline } = usePresence();
  const [profile, setProfile] = useState<any>(null);
  const [contactRelation, setContactRelation] = useState<{ status: string | null, isIncoming: boolean }>({ status: null, isIncoming: false });
  const [profileLoading, setProfileLoading] = useState(true);
  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>(null);
  const navigate = useNavigate();

  useSEO({
      title: profile ? `${profile.display_name} (@${profile.username}) | VoiceID` : 'VoiceID Profile',
      description: profile ? `Connect with @${profile.username} on VoiceID.` : 'VoiceID Profile',
      canonical: profile ? `https://voiceid.online/u/${profile.username}` : `https://voiceid.online/`,
      robots: profile ? 'index, follow' : 'noindex, follow',
      jsonLd: profile ? [{
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        dateCreated: profile.created_at || undefined,
        mainEntity: {
          '@type': 'Person',
          name: profile.display_name,
          alternateName: profile.username,
          url: `https://voiceid.online/u/${profile.username}`,
          image: profile.avatar_url || undefined,
        },
      }] : undefined,
  });

  useEffect(() => {
    if (authLoading) return;
    const resolveId = async () => {
        if (id) {
            setResolvedProfileId(id === 'me' ? user?.id || null : id);
        } else if (username) {
            const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
            setResolvedProfileId(data?.id || null);
        }
        setProfileLoading(false);
    };
    resolveId();
  }, [id, username, authLoading, user]);

  const isOnline = resolvedProfileId ? isUserOnline(resolvedProfileId) : false;

  useEffect(() => {
    if (authLoading || !resolvedProfileId) return;
    const fetchData = async () => {
      setProfileLoading(true);
      const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', resolvedProfileId).maybeSingle();
      if (error) console.error("PROFILE FETCH ERROR:", error);
      setProfile(profileData);
      
      if (user && resolvedProfileId && user.id !== resolvedProfileId) {
        const { data: contacts } = await supabase
            .from('contacts')
            .select('status, requester_id, responder_id')
            .or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`);
            
        if (contacts && contacts.length > 0) {
            const bestContact = contacts.sort((a, b) => {
                const priority = { 'accepted': 3, 'pending': 2, 'blocked': 1 };
                return (priority[b.status as keyof typeof priority] || 0) - (priority[a.status as keyof typeof priority] || 0);
            })[0];
            
            setContactRelation({
                status: bestContact.status,
                isIncoming: bestContact.responder_id === user?.id
            });
        } else {
            setContactRelation({ status: null, isIncoming: false });
        }
      }
      setProfileLoading(false);
    };
    fetchData();
  }, [resolvedProfileId, user, authLoading]);

  const handleCall = async () => {
      const { canCall, reason } = await canCallUser(resolvedProfileId!);
      if (!canCall) {
          alert(reason);
      } else {
          initiateCall(resolvedProfileId!);
      }
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/u/${profile.username}`;
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${profile.display_name} on VoiceID`,
                text: `Connect with @${profile.username} on VoiceID.`,
                url: profileUrl,
            });
        } catch (err) {
            console.error('Error sharing:', err);
        }
    } else {
        try {
            await navigator.clipboard.writeText(profileUrl);
            alert('Profile link copied');
        } catch (err) {
            console.error('Error copying:', err);
        }
    }
  };

  const handleContactAction = async (action: 'add' | 'accept' | 'reject' | 'remove' | 'block' | 'unblock') => {
    if (!user || user.id === resolvedProfileId) return;
    
    let error;
    let rowsAffected: any[] | null = null;
    if (action === 'add') {
        const { error: err } = await supabase.from('contacts').insert({ requester_id: user?.id, responder_id: resolvedProfileId, status: 'pending' });
        error = err;
    } else if (action === 'remove' || action === 'reject') {
        // .select() forces the delete to report back which rows it actually
        // removed. Without it, a delete blocked by RLS (0 rows affected)
        // still returns error: null, making a no-op look successful.
        const { data, error: err } = await supabase.from('contacts').delete().or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`).select();
        error = err;
        rowsAffected = data;
    } else if (action === 'accept') {
        const { error: err } = await supabase.from('contacts').update({ status: 'accepted' }).or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`);
        error = err;
    } else if (action === 'block') {
        const { error: err } = await supabase.from('contacts').upsert({ requester_id: user?.id, responder_id: resolvedProfileId, status: 'blocked' }).or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`);
        error = err;
    } else if (action === 'unblock') {
        const { data, error: err } = await supabase.from('contacts').delete().or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`).select();
        error = err;
        rowsAffected = data;
    }

    if ((action === 'remove' || action === 'reject' || action === 'unblock') && !error && (!rowsAffected || rowsAffected.length === 0)) {
        console.error(`Contact ${action} affected 0 rows (blocked by RLS or already removed)`, resolvedProfileId);
        alert(`Failed to ${action === 'unblock' ? 'unblock user' : action === 'reject' ? 'reject request' : 'remove contact'}: permission denied.`);
        return;
    }

    if (!error) {
        // Refetch relationship state
        const { data: contacts } = await supabase
            .from('contacts')
            .select('status, requester_id, responder_id')
            .or(`and(requester_id.eq.${user?.id},responder_id.eq.${resolvedProfileId}),and(requester_id.eq.${resolvedProfileId},responder_id.eq.${user?.id})`);
            
        if (contacts && contacts.length > 0) {
            const bestContact = contacts.sort((a, b) => {
                const priority = { 'accepted': 3, 'pending': 2, 'blocked': 1 };
                return (priority[b.status as keyof typeof priority] || 0) - (priority[a.status as keyof typeof priority] || 0);
            })[0];
            
            setContactRelation({
                status: bestContact.status,
                isIncoming: bestContact.responder_id === user?.id
            });
        } else {
            setContactRelation({ status: null, isIncoming: false });
        }
    }
  };

  const handleMessageAction = async () => {
    try {
        if (!user || !resolvedProfileId) return;

        const { data: conversationId, error: rpcError } = await supabase.rpc('create_private_conversation', {
            other_user_id: resolvedProfileId
        });

        if (rpcError) {
            console.error('Conversation creation failed:', JSON.stringify(rpcError, null, 2));
            alert('Could not start conversation. Please try again.');
            return;
        }

        if (!conversationId) {
            console.error('Conversation creation returned null ID');
            return;
        }

        navigate(`/dashboard/chat/${conversationId}`);
    } catch (err) {
        console.error('Unexpected error in handleMessageAction:', err);
    }
  };

  if (profileLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;
  if (!profile) return <div className="text-center py-20">Profile not found</div>;

  return (
    <div className="max-w-xl mx-auto p-5 sm:p-8 bg-white border border-gray-100 rounded-3xl shadow-sm">
      <div className="text-center">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gray-100 mx-auto mb-6 overflow-hidden border-2 border-gray-200 relative">
            {profile.avatar_url && <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />}
            {user?.id !== resolvedProfileId && (
                <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            )}
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-1 break-words">{profile.display_name}</h1>
        <p className="text-blue-600 font-medium text-base sm:text-lg mb-2 break-words">@{profile.username}</p>
        <p className="text-gray-500 text-sm mb-6">{isOnline ? '🟢 Online' : 'Offline'}</p>
        <p className="text-gray-600 text-base sm:text-lg mb-10 leading-relaxed break-words">{profile.bio || 'No bio yet.'}</p>
        
        {user?.id === resolvedProfileId && (
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center mb-10">
                <button onClick={() => navigate('/dashboard/profile/edit')} className="px-6 py-2.5 bg-blue-600 text-white rounded-full">Edit Profile</button>
                <button onClick={handleShare} className="p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200" aria-label="Share profile"><Share size={22} /></button>
            </div>
        )}
        
        {user?.id !== resolvedProfileId && (
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
                <button onClick={handleCall} aria-label="Call" className={`p-3.5 sm:p-5 rounded-full transition ${!isOnline || contactRelation.status !== 'accepted' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}><Phone size={22} /></button>
                <button onClick={handleMessageAction} aria-label="Message" className="p-3.5 sm:p-5 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition"><Mic size={22} /></button>
                <button onClick={handleShare} aria-label="Share profile" className="p-3.5 sm:p-5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition"><Share size={22} /></button>
                {contactRelation.status === null && <button onClick={() => handleContactAction('add')} aria-label="Add contact" className="p-3.5 sm:p-5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition"><UserPlus size={22} /></button>}
                {contactRelation.status === 'pending' && contactRelation.isIncoming && (
                    <>
                        <button onClick={() => handleContactAction('accept')} aria-label="Accept request" className="p-3.5 sm:p-5 bg-green-50 text-green-600 rounded-full"><UserCheck size={22} /></button>
                        <button onClick={() => handleContactAction('reject')} aria-label="Reject request" className="p-3.5 sm:p-5 bg-red-50 text-red-600 rounded-full"><UserX size={22} /></button>
                    </>
                )}
                {contactRelation.status === 'pending' && !contactRelation.isIncoming && <button aria-label="Request pending" className="p-3.5 sm:p-5 bg-yellow-50 text-yellow-600 rounded-full"><UserCheck size={22} /></button>}
                {contactRelation.status === 'accepted' && <button onClick={() => handleContactAction('remove')} aria-label="Remove contact" className="p-3.5 sm:p-5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition"><UserX size={22} /></button>}
                {contactRelation.status !== 'blocked' ? 
                    <button onClick={() => handleContactAction('block')} aria-label="Block user" className="p-3.5 sm:p-5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition"><Ban size={22} /></button> :
                    <button onClick={() => handleContactAction('unblock')} aria-label="Unblock user" className="p-3.5 sm:p-5 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition"><UserPlus size={22} /></button>
                }
            </div>
        )}
      </div>
    </div>
  );
}
