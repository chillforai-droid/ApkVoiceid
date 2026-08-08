import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PhoneMissed, PhoneOutgoing, PhoneIncoming, PhoneOff, Loader2, Phone } from 'lucide-react';
import { relativeTime } from '../lib/timeFormat';

interface CallRow {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  caller: { display_name: string; avatar_url: string | null } | null;
  receiver: { display_name: string; avatar_url: string | null } | null;
}

function callMeta(status: string, isOutgoing: boolean) {
  if (status === 'missed' || status === 'cancelled') return { icon: PhoneMissed, color: 'text-red-500', label: 'Missed' };
  if (status === 'rejected') return { icon: PhoneOff, color: 'text-red-500', label: 'Declined' };
  if (isOutgoing) return { icon: PhoneOutgoing, color: 'text-green-600', label: 'Outgoing' };
  return { icon: PhoneIncoming, color: 'text-blue-600', label: 'Incoming' };
}

export default function CallHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('id, caller_id, receiver_id, status, created_at, ended_at, caller:caller_id(display_name, avatar_url), receiver:receiver_id(display_name, avatar_url)')
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        if (!error && data) setCalls(data as any);
        setLoading(false);
      }
    };
    fetchCalls();

    const channel = supabase
      .channel('call-history-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `receiver_id=eq.${user.id}` }, fetchCalls)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `caller_id=eq.${user.id}` }, fetchCalls)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Call History</h1>

      {calls.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Phone className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">No calls yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {calls.map((call) => {
            const isOutgoing = call.caller_id === user?.id;
            const other = isOutgoing ? call.receiver : call.caller;
            const meta = callMeta(call.status, isOutgoing);
            const Icon = meta.icon;
            const otherId = isOutgoing ? call.receiver_id : call.caller_id;
            return (
              <div
                key={call.id}
                onClick={() => navigate(`/dashboard/profile/${otherId}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition border-b last:border-b-0 border-gray-100 min-h-[44px]"
              >
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
                  {other?.avatar_url ? (
                    <img src={other.avatar_url} alt={other?.display_name || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    (other?.display_name || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{other?.display_name || 'Unknown'}</p>
                  <p className={`text-sm flex items-center gap-1 ${meta.color}`}>
                    <Icon size={14} /> {meta.label}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{relativeTime(call.created_at)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
