import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, Search, MapPin, Calendar, User, 
  Clock, CheckCircle2, MoreVertical, Filter 
} from 'lucide-react';

interface ActivitiesPageProps {
  profile: any;
  onBack: () => void;
}

export default function ActivitiesPage({ profile, onBack }: ActivitiesPageProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      let query = supabase
        .from('staff_activity')
        .select('*')
        .order('created_at', { ascending: false });

      // If NOT Admin, strictly show only their own activities
      if (profile?.role !== 'Admin' && profile?.role !== 'Super Admin') {
        // query = query.eq('user_id', profile.id); // Uncomment if RLS isn't auto-handling this
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- MOCK DATA (Fallback if DB is empty) ---
  const mockActivities = [
    {
      id: 1,
      client_name: 'Arun',
      role: 'CM Operations',
      type: 'Customer Visit',
      location: 'Abids Road, Hyderabad',
      date: 'Feb 5, 2026',
      status: 'Done',
      notes: 'Customer requested waiver on interest.'
    },
    {
      id: 2,
      client_name: 'Tirupati Branch Audit',
      role: 'Regional Manager',
      type: 'Branch Visit',
      location: 'Tirupati Main Branch',
      date: 'Feb 2, 2026',
      status: 'Pending',
      notes: 'Reviewing Q4 loan dispersals.'
    },
    {
      id: 3,
      client_name: 'Suresh Kumar',
      role: 'Field Officer',
      type: 'Recovery',
      location: 'Nellore, Andhra Pradesh',
      date: 'Jan 28, 2026',
      status: 'Overdue',
      notes: ' borrower not available at location.'
    }
  ];

  const displayList = activities.length > 0 ? activities : mockActivities;
  
  const filteredList = displayList.filter(item => 
    item.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    item.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* --- HEADER --- */}
      <div className="bg-white sticky top-0 z-10 border-b border-slate-100 px-4 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Field Activities</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all" 
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-lg shadow-sm text-slate-400">
            <Filter size={16} />
          </div>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="p-4 space-y-4 pb-20">
        {loading ? (
          <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : filteredList.map((item, index) => (
          <div key={index} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative group active:scale-[0.99] transition-transform">
            
            {/* Top Row: Name & Status */}
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-800 text-lg">{item.client_name}</h3>
              {item.status === 'Done' ? (
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> Done
                </span>
              ) : (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  item.status === 'Overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {item.status}
                </span>
              )}
            </div>

            {/* Badges */}
            <div className="flex gap-2 mb-4">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-md">
                {item.type}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">
                {item.role || 'Visit'}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-slate-500">
                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <p className="text-xs font-medium leading-relaxed">{item.location || 'No location recorded'}</p>
              </div>
              
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar size={16} className="text-slate-400" />
                <p className="text-xs font-medium">{item.date || new Date().toLocaleDateString()}</p>
              </div>

              {item.notes && (
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <p className="text-xs text-slate-400 italic">"{item.notes}"</p>
                </div>
              )}
            </div>

          </div>
        ))}

        {filteredList.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p>No activities found matching "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}