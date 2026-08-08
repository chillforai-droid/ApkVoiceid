import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Mic, Phone } from 'lucide-react';

export default function ActivityFeed() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(display_name)')
        .eq('conversation_id', '...') // This needs to be dynamic, but for now just fetch recent messages
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (!error && data) {
          setActivities(data);
      }
      setLoading(false);
    };
    
    fetchActivities();
  }, [user]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
      {activities.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No recent activity</div>
      ) : (
        <div className="space-y-4">
          {activities.map((act) => (
            <div key={act.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition">
                <div className="p-2 bg-gray-100 rounded-full">
                    {act.content_type === 'voice' ? <Mic size={20}/> : <MessageSquare size={20}/>}
                </div>
                <div>
                    <p className="font-medium">{act.sender?.display_name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{new Date(act.created_at).toLocaleDateString()}</p>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
