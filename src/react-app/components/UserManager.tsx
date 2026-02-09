import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin'; 
import { 
  UserPlus, Trash2, Shield, Loader2, X, Edit2, 
  RefreshCw, KeyRound, Download, Search, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import * as XLSX from 'xlsx';

const TEAMS = [
  'ALL', 'NW3', 'R1 Tirupati', 'R2 Chittoor', 'R3 Nellore', 'R4 Gudur', 
  'R5 Rajampeta', 'R1 Kurnool', 'R2 Nandyal', 'R3 Ananthapur', 'R4 Dharmavaram', 'R5 Kadapa'
];

const ROLES = ['Staff', 'Admin', 'Super Admin', 'Regional Manager', 'CM Ops', 'CM Credit', 'CM D & Vas'];

export default function UserManager({ onClose }: { onClose: () => void }) {
  const [selectedTeam, setSelectedTeam] = useState('ALL');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Regional Manager',
    team: 'NW3'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamUsers();
  }, [selectedTeam]);

  // --- FIXED: Fetch from PROFILES, not activities ---
  const fetchTeamUsers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*'); // Correct Table
      
      if (selectedTeam !== 'ALL') {
        query = query.eq('team', selectedTeam);
      }
      
      const { data, error } = await query.order('name', { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    return TEAMS.filter(t => t !== 'ALL').map(team => ({
      name: team,
      count: users.filter(u => u.team === team).length
    }));
  }, [users]);

  const roleData = useMemo(() => {
    return ROLES.map(role => ({
      name: role,
      value: users.filter(u => u.role === role).length
    })).filter(r => r.value > 0);
  }, [users]);

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (u.phone || '').includes(searchQuery)
  );

  // --- SAVE USER LOGIC ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone.length < 10) return alert("Enter valid 10-digit mobile.");
    setActionLoading(true);

    try {
      if (editingId) {
        // Update existing user
        const { error } = await supabase.from('profiles').update({
          name: formData.name.trim(),
          role: formData.role,
          team: formData.team,
          phone: formData.phone.trim()
        }).eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
      } else {
        // Create New User
        const cleanPhone = formData.phone.trim();
        const email = `${cleanPhone}@sbiapp.com`; 
        
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: '123456',
          email_confirm: true,
          user_metadata: { name: formData.name.trim() }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create user ID");

        // 2. Create Profile
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: authData.user.id,
          name: formData.name.trim(),
          phone: cleanPhone,
          role: formData.role,
          team: formData.team
        }]);

        if (profileError) throw profileError;
      }
      
      setFormData({ name: '', phone: '', role: 'Regional Manager', team: 'NW3' });
      fetchTeamUsers();
      if (!editingId) alert("User created! Default password: '123456'");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- BULK UPLOAD ---
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
          const email = `${cleanPhone}@sbiapp.com`;

          // Check if exists logic omitted for brevity, Supabase returns error on duplicate email usually
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: '123456',
            email_confirm: true,
            user_metadata: { name: row.name.trim() }
          });

          // If user created successfully (or already exists handle appropriately), insert profile
          if (!authError && authData.user) {
            await supabase.from('profiles').upsert([{
              id: authData.user.id,
              name: row.name.trim(),
              phone: cleanPhone,
              role: row.role || 'Regional Manager',
              team: row.team || 'NW3'
            }]);
          }
        }
        alert(`Import complete!`);
        fetchTeamUsers();
      } catch (err: any) {
        alert("Error during import: " + err.message);
      } finally {
        setActionLoading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- RESET PASSWORD ---
  const handleResetPassword = async (userId: string, userName: string) => {
    if (!window.confirm(`Reset password for ${userName} to "123456"?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: '123456' }
      );
      if (error) throw error;
      alert("Password reset successfully.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- DELETE USER ---
  const handleDelete = async (userId: string) => {
    if (!window.confirm("Permanently delete this user? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      // Delete from Auth (Cascade should handle profile, but we do manual to be safe)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      // Delete from Profiles (if cascade didn't catch it)
      await supabase.from('profiles').delete().eq('id', userId);
      
      fetchTeamUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredUsers.map(u => ({
      Name: u.name, Phone: u.phone, Role: u.role, Team: u.team, 
      LastActive: u.last_login ? new Date(u.last_login).toLocaleString('en-IN') : 'Never'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, `Staff_Roster_${selectedTeam}.xlsx`);
  };

  return (
    <div className="mt-6 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
      {/* HEADER */}
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Shield className="text-indigo-600" /> Organization Roster
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{filteredUsers.length}</span>
          </h3>
        </div>
        <div className="flex gap-2">
          <input type="file" id="bulk-upload" className="hidden" accept=".xlsx, .xls" onChange={handleBulkUpload} />
          <button onClick={() => document.getElementById('bulk-upload')?.click()} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full transition-colors" title="Bulk Upload">
            <UserPlus size={20} />
          </button>
          <button onClick={exportToExcel} className="p-2 hover:bg-green-50 text-green-600 rounded-full transition-colors"><Download size={20} /></button>
          <button onClick={fetchTeamUsers} className="p-2 hover:bg-slate-200 text-slate-400 rounded-full transition-colors"><RefreshCw size={20} /></button>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
        </div>
      </div>

      {/* TEAM SELECTOR */}
      <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide border-b border-slate-100 bg-white shrink-0">
        {TEAMS.map(t => (
          <button key={t} onClick={() => setSelectedTeam(t)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedTeam === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {t === 'ALL' ? '🌍 Global View' : t}
          </button>
        ))}
      </div>

      {/* ANALYTICS (Only show if not empty) */}
      <div className="p-6 bg-white border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="md:col-span-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" hide />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                {chartData.map((e, i) => <Cell key={i} fill={e.name === selectedTeam ? '#4f46e5' : '#cbd5e1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-40 border-l border-slate-50 pl-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={roleData} innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                {roleData.map((_, i) => <Cell key={i} fill={['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b'][i % 4]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEARCH & FORM */}
      <div className="p-6 space-y-4 shrink-0">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search roster..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
          <input type="text" placeholder="Full Name" className="p-3 rounded-xl text-sm font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="text" placeholder="Mobile" className="p-3 rounded-xl text-sm font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
          <select className="p-3 rounded-xl text-sm font-bold bg-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="p-3 rounded-xl text-sm font-bold bg-white" value={formData.team} onChange={e => setFormData({...formData, team: e.target.value})}>
            {TEAMS.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="submit" disabled={actionLoading} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md">
            {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : (editingId ? 'Update' : 'Add')}
          </button>
        </form>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b z-10">
            <tr>
              <th className="px-6 py-3">Member</th>
              <th className="px-6 py-3">Team</th>
              <th className="px-6 py-3">Last Active</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length > 0 ? filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${u.last_login && (Date.now() - new Date(u.last_login).getTime() < 86400000) ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                  <div>
                    <div className="font-bold text-slate-800">{u.name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{u.phone} • {u.role}</div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded text-slate-600 uppercase">{u.team}</span></td>
                <td className="px-6 py-4 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1"><Clock size={12} className="text-slate-300" /> {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</div>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-1">
                  <button onClick={() => handleResetPassword(u.id, u.name)} className="p-2 hover:bg-amber-50 text-slate-300 hover:text-amber-600 rounded-lg" title="Reset Password"><KeyRound size={16} /></button>
                  <button onClick={() => { setEditingId(u.id); setFormData({name: u.name, phone: u.phone, role: u.role, team: u.team})}} className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(u.id)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-12 text-center text-slate-400 text-sm">No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}