import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, MapPin, User, MessageSquare } from 'lucide-react';

export default function ActivityList({ team }: { team: string }) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activities')
        .select(`*, profiles(phone)`)
        .eq('team', team)
        .order('created_at', { ascending: false });
      if (data) setActivities(data);
    };

    fetchActivities();
    // Subscribe to real-time updates
    const channel = supabase.channel('realtime-activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, fetchActivities)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [team]);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        <Clock className="text-blue-600" size={20} /> Recent Activities ({team})
      </h3>
      {activities.length === 0 && <p className="text-slate-400 text-sm italic">No activities logged yet.</p>}
      {activities.map((act) => (
        <div key={act.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
              {act.activity_type}
            </span>
            <span className="text-[10px] text-slate-400 font-medium italic">
              {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <User size={14} className="text-slate-400" /> {act.profiles?.phone || 'Unknown User'}
            </div>
            {act.location && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin size={14} className="text-slate-400" /> {act.location}
              </div>
            )}
            {act.notes && (
              <div className="flex gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                <MessageSquare size={14} className="text-slate-400 shrink-0" /> {act.notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}