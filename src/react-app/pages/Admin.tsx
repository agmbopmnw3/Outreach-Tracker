import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin'; 
import { useNavigate } from 'react-router-dom'; 
import { 
  UserPlus, Trash2, Shield, Loader2, ArrowLeft, Edit2, 
  RefreshCw, KeyRound, Download, Search, Clock, CalendarX, CheckCircle2, User, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

const TEAMS = [
  'ALL', 'NW3', 'R1 Tirupati', 'R2 Chittoor', 'R3 Nellore', 'R4 Gudur', 
  'R5 Rajampeta', 'R1 Kurnool', 'R2 Nandyal', 'R3 Ananthapur', 'R4 Dharmavaram', 'R5 Kadapa'
];

// --- UPDATED ROLE DEFINITIONS ---
const NW3_ROLES = ['Admin', 'Super Admin'];
const FIELD_ROLES = ['Regional Manager', 'CM Credit & NPA', 'CM Operations', 'CM D&VAS', 'Manager NPA'];

export default function Admin() {
  const navigate = useNavigate(); 
  
  // View State
  const [activeView, setActiveView] = useState<'roster' | 'defaulters'>('roster');
  
  const [selectedTeam, setSelectedTeam] = useState('ALL');
  const [users, setUsers] = useState<any[]>([]);
  const [defaulterRecords, setDefaulterRecords] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Regional Manager', // Will update dynamically
    team: 'R1 Tirupati'       // Default to a field team
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- DYNAMIC ROLE SWITCHING LOGIC ---
  // Whenever the form's team changes, ensure the role is valid for that team
  useEffect(() => {
    const validRoles = formData.team === 'NW3' ? NW3_ROLES : FIELD_ROLES;
    if (!validRoles.includes(formData.role)) {
      setFormData(prev => ({ ...prev, role: validRoles[0] }));
    }
  }, [formData.team]);

  useEffect(() => {
    fetchData();
  }, [selectedTeam, activeView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeView === 'roster') {
        let userQuery = supabase.from('profiles').select('*');
        if (selectedTeam !== 'ALL') userQuery = userQuery.eq('team', selectedTeam);
        const { data } = await userQuery.order('name', { ascending: true });
        setUsers(data || []);
      } else {
        let defQuery = supabase.from('defaulter_logs').select('*');
        if (selectedTeam !== 'ALL') defQuery = defQuery.eq('team', selectedTeam);
        const { data } = await defQuery.order('defaulter_date', { ascending: false });
        setDefaulterRecords(data || []);
      }
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- MANUAL FORCE SYNC ---
  const handleForceSync = async () => {
    if(!window.confirm("Run a manual check for today's defaulters?")) return;
    setActionLoading(true);
    
    try {
      // 1. Get all profiles (excluding NW3/Admin)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('team', 'NW3')
        .neq('role', 'Admin')
        .neq('role', 'Super Admin');

      // 2. Get Today's Activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: activeToday } = await supabase
        .from('staff_activity')
        .select('user_id')
        .gte('created_at', today.toISOString());

      const activeIds = new Set((activeToday || []).map((a: any) => a.user_id));

      // 3. Find Defaulters
      const newDefaulters = (allProfiles || []).filter(u => !activeIds.has(u.id));

      // 4. Save
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: existingLogs } = await supabase.from('defaulter_logs').select('user_id').eq('defaulter_date', todayStr);
      const existingIds = new Set((existingLogs || []).map((l: any) => l.user_id));

      const inserts = newDefaulters
        .filter(u => !existingIds.has(u.id))
        .map(u => ({
          user_id: u.id, 
          name: u.name, 
          phone: u.phone, 
          team: u.team, 
          role: u.role, 
          defaulter_date: todayStr
        }));

      if (inserts.length > 0) {
        await supabase.from('defaulter_logs').insert(inserts);
        alert(`Synced! Added ${inserts.length} defaulters.`);
        fetchData();
      } else {
        alert("List is already up to date.");
      }
    } catch (err: any) {
      alert("Sync Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteDefaulter = async (id: string) => {
    if (!window.confirm("Permanently remove this record?")) return;
    await supabase.from('defaulter_logs').delete().eq('id', id);
    fetchData(); 
  };

  // --- ACTIONS (User Management) ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (editingId) {
        await supabase.from('profiles').update({ ...formData }).eq('id', editingId);
        setEditingId(null);
      } else {
        const cleanPhone = formData.phone.trim();
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: `${cleanPhone}@sbiapp.com`, password: '123456', email_confirm: true, user_metadata: { name: formData.name }
        });
        if (authError) throw authError;
        if (authData.user) await supabase.from('profiles').insert([{ id: authData.user.id, ...formData, phone: cleanPhone }]);
      }
      // Reset form to defaults
      setFormData({ name: '', phone: '', role: 'Regional Manager', team: 'R1 Tirupati' });
      fetchData();
    } catch (err: any) { alert("Error: " + err.message); } finally { setActionLoading(false); }
  };

  const handleResetPassword = async (userId: string) => {
    if (!window.confirm("Reset password to 123456?")) return;
    await supabaseAdmin.auth.admin.updateUserById(userId, { password: '123456' });
    alert("Reset successful.");
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Permanently delete user?")) return;
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await supabase.from('profiles').delete().eq('id', userId);
    fetchData();
  };

  const exportToExcel = () => {
    const data = activeView === 'roster' ? users : defaulterRecords;
    const ws = XLSX.utils.json_to_sheet(data.map(u => ({
      Name: u.name, Phone: u.phone, Role: u.role || 'Defaulter', Team: u.team, 
      Date: u.defaulter_date || new Date().toLocaleDateString()
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeView);
    XLSX.writeFile(wb, `${activeView}_${selectedTeam}.xlsx`);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        setActionLoading(true);
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
            for (const row of data) {
                if (!row.phone || !row.name) continue;
                const cleanPhone = row.phone.toString().trim();
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: `${cleanPhone}@sbiapp.com`, password: '123456', email_confirm: true, user_metadata: { name: row.name.trim() }
                });
                if (!authError && authData.user) {
                    await supabase.from('profiles').upsert([{
                        id: authData.user.id, name: row.name.trim(), phone: cleanPhone, role: row.role || 'Staff', team: row.team || 'NW3'
                    }]);
                }
            }
            alert("Bulk Upload Complete"); fetchData();
        } catch (e: any) { alert(e.message); } finally { setActionLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  // Determine current roles based on selected team in form
  const currentFormRoles = formData.team === 'NW3' ? NW3_ROLES : FIELD_ROLES;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2"><Shield className="text-blue-400" /> Admin Console</h3>
              <p className="text-slate-400 text-xs">Manage Staff & Monitor Daily Activity</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="file" id="bulk-upload" className="hidden" accept=".xlsx, .xls" onChange={handleBulkUpload} />
            <button onClick={() => document.getElementById('bulk-upload')?.click()} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold text-xs flex items-center gap-2"><UserPlus size={16} /> Bulk Upload</button>
            <button onClick={exportToExcel} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"><Download size={20} /></button>
            <button onClick={fetchData} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"><RefreshCw size={20} /></button>
          </div>
        </div>

        {/* TEAM SELECTOR (Global Filter) */}
        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide border-b border-slate-100 bg-white">
          {TEAMS.map(t => (
            <button key={t} onClick={() => setSelectedTeam(t)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedTeam === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {t === 'ALL' ? '🌍 Global View' : t}
            </button>
          ))}
        </div>

        {/* TABS */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4">
          <button onClick={() => setActiveView('roster')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeView === 'roster' ? 'bg-white text-blue-600 shadow-md border border-slate-200' : 'text-slate-400 hover:bg-white/50'}`}>
            <User size={18} /> Staff Roster
          </button>
          <button onClick={() => setActiveView('defaulters')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeView === 'defaulters' ? 'bg-red-50 text-red-600 shadow-md border border-red-100' : 'text-slate-400 hover:bg-white/50'}`}>
            <AlertTriangle size={18} /> Defaulter Log ({defaulterRecords.length})
          </button>
        </div>

        {/* --- VIEW: DEFAULTERS --- */}
        {activeView === 'defaulters' && (
          <div>
            <div className="p-6 bg-red-50 border-b border-red-100 flex justify-between items-center">
              <div>
                <h4 className="text-red-800 font-bold flex items-center gap-2"><CalendarX size={20} /> Defaulter History</h4>
                <p className="text-red-600 text-xs mt-1">
                  Records persist here permanently until you delete them.
                </p>
              </div>
              <button onClick={handleForceSync} disabled={actionLoading} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold text-xs shadow-sm hover:bg-red-200 transition-colors flex items-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} 
                Sync Now
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-3">Defaulter Name</th>
                    <th className="px-6 py-3">Team & Role</th>
                    <th className="px-6 py-3">Date Recorded</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaulterRecords.length > 0 ? defaulterRecords.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{r.name} <div className="text-[10px] text-slate-400 font-normal">{r.phone}</div></td>
                      
                      {/* Team & Role Column */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700 text-xs uppercase">{r.team}</div>
                        <div className="text-[10px] text-slate-500">{r.role || 'Staff'}</div>
                      </td>
                      
                      <td className="px-6 py-4 text-xs font-medium text-red-500">{new Date(r.defaulter_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteDefaulter(r.id)} className="p-2 hover:bg-green-50 text-slate-300 hover:text-green-600 rounded-lg" title="Delete Record">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 text-sm">No defaulter records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW: ROSTER --- */}
        {activeView === 'roster' && (
          <div>
            <div className="p-6 space-y-4 border-b border-slate-100">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search staff..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              
              {/* ADD USER FORM (Dynamic Roles) */}
              <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <input type="text" placeholder="Full Name" className="p-3 rounded-xl text-sm font-bold border-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                <input type="text" placeholder="Mobile" className="p-3 rounded-xl text-sm font-bold border-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                
                {/* Team Select (Determines Roles) */}
                <select className="p-3 rounded-xl text-sm font-bold bg-white border-none" value={formData.team} onChange={e => setFormData({...formData, team: e.target.value})}>
                  {TEAMS.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Role Select (Dynamic based on Team) */}
                <select className="p-3 rounded-xl text-sm font-bold bg-white border-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  {currentFormRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <button type="submit" disabled={actionLoading} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md">{actionLoading ? <Loader2 className="animate-spin mx-auto" /> : (editingId ? 'Update' : 'Add')}</button>
              </form>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                  <tr><th className="px-6 py-3">Member</th><th className="px-6 py-3">Team</th><th className="px-6 py-3">Last Active</th><th className="px-6 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{u.name}<div className="text-[10px] text-slate-500 font-normal">{u.phone} • {u.role}</div></td>
                      <td className="px-6 py-4"><span className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded text-slate-600 uppercase">{u.team}</span></td>
                      <td className="px-6 py-4 text-xs text-slate-500"><Clock size={12} className="inline mr-1"/>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-1">
                        <button onClick={() => handleResetPassword(u.id)} className="p-2 hover:bg-amber-50 text-slate-300 hover:text-amber-600 rounded-lg"><KeyRound size={16} /></button>
                        <button onClick={() => { setEditingId(u.id); setFormData({name: u.name, phone: u.phone, role: u.role, team: u.team}); }} className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(u.id)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}