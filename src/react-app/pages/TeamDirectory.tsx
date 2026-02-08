import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Search, Phone, Mail, Shield, User } from 'lucide-react';

interface TeamDirectoryProps {
  profile: any;
  onBack: () => void;
}

export default function TeamDirectory({ profile, onBack }: TeamDirectoryProps) {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      // Fetch all profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setTeam(data || []);
    } catch (err) {
      console.error("Error fetching team:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeam = team.filter(member => 
    member.name?.toLowerCase().includes(search.toLowerCase()) ||
    member.phone?.includes(search) ||
    member.team?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <div className="bg-white sticky top-0 z-10 border-b border-slate-100 px-4 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Team Directory</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search colleagues..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-purple-500/20 font-medium transition-all" 
          />
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 grid gap-4 pb-20">
        {loading ? (
          <div className="text-center p-10 text-slate-400">Loading directory...</div>
        ) : filteredTeam.map((member) => (
          <div key={member.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            
            {/* Avatar Circle */}
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${
              member.role === 'Admin' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
            }`}>
              {member.name ? member.name.charAt(0).toUpperCase() : <User size={20}/>}
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800">{member.name}</h3>
                {member.role === 'Admin' && <Shield size={14} className="text-blue-500 mt-1" />}
              </div>
              
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                {member.role || 'Staff'} • {member.team || 'General'}
              </p>

              <div className="flex items-center gap-4 mt-2">
                <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-green-600 transition-colors">
                  <Phone size={12} /> {member.phone}
                </a>
              </div>
            </div>
          </div>
        ))}
        
        {filteredTeam.length === 0 && !loading && (
          <div className="text-center p-10 text-slate-400">No members found.</div>
        )}
      </div>
    </div>
  );
}