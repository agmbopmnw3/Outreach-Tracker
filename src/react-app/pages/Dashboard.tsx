import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Calendar, MapPin, CheckCircle2, Users, 
  Plus, Clock, Shield, ArrowLeft, Phone, Save, X, 
  Camera, Trash2, Filter, Layers, Download, Printer, 
  AlertTriangle, XCircle, Bell, Briefcase, Loader2, Image as LucideImage
} from 'lucide-react';

// --- CONFIGURATION ---
const TEAMS = [
  'ALL', 'NW3', 'R1 Tirupati', 'R2 Chittoor', 'R3 Nellore', 'R4 Gudur', 
  'R5 Rajampeta', 'R1 Kurnool', 'R2 Nandyal', 'R3 Ananthapur', 'R4 Dharmavaram', 'R5 Kadapa'
];

const FOLLOW_UP_STATUSES = ['In Progress', 'Overdue', 'Interested', 'Pending'];

const ROLE_PRIORITY: Record<string, number> = {
  'Regional Manager': 1,
  'CM Credit & NPA': 2,
  'CM D&VAS': 3,
  'CM Operations': 4
};

// Precise Team Order for Sorting
const TEAM_PRIORITY: Record<string, number> = {
  'R1 Tirupati': 1, 'R2 Chittoor': 2, 'R3 Nellore': 3, 'R4 Gudur': 4,
  'R5 Rajampeta': 5, 'R1 Kurnool': 6, 'R2 Nandyal': 7, 'R3 Ananthapur': 8,
  'R3 Anantapur': 8, 'R4 Dharmavaram': 9, 'R5 Kadapa': 10, 'NW3': 99
};

const isValidMobile = (phone: string) => /^[6-9]\d{9}$/.test(phone);

// Helper to get local date string YYYY-MM-DD
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format 24h time to 12h AM/PM
const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  try {
    const [hour, minute] = timeStr.split(':');
    const h = parseInt(hour);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  } catch (e) { return timeStr; }
};

// ==========================================
// 1. INTERNAL COMPONENTS 
// ==========================================

const InternalCamera = ({ onCapture, onCancel, isCompact = false }: { onCapture: (files: File[], loc: string) => void, onCancel?: () => void, isCompact?: boolean }) => {
  const [locating, setLocating] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    setLocating(true);
    const gpsTimeout = setTimeout(() => {
        onCapture(files, "Location Timeout");
        setLocating(false);
    }, 5000);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(gpsTimeout);
          const { latitude, longitude } = position.coords;
          let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            if (data && data.display_name) address = data.display_name.split(',').slice(0, 4).join(', ');
          } catch (err) { console.error("Geocoding failed"); }
          onCapture(files, address);
          setLocating(false);
        },
        (error) => {
          console.warn(error);
          clearTimeout(gpsTimeout);
          onCapture(files, "GPS Denied/Failed");
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      clearTimeout(gpsTimeout);
      onCapture(files, "GPS Not Supported");
      setLocating(false);
    }
  };

  if (locating) return <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 h-32"><Loader2 className="animate-spin text-blue-600" size={24} /><span className="text-xs font-bold text-blue-700">Tagging Location...</span></div>;

  return (
    <div className={`border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center transition-colors hover:bg-slate-100 ${isCompact ? 'p-3' : 'p-6'}`}>
      <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Add Photo </p>
      <div className="flex gap-3 w-full">
        <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 py-3 px-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 flex flex-col items-center gap-1.5 transition-transform"><Camera size={20} /><span className="text-[10px] font-bold">Camera</span></button>
        <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 py-3 px-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 active:scale-95 flex flex-col items-center gap-1.5 transition-transform"><LucideImage size={20} /><span className="text-[10px] font-bold">Gallery</span></button>
      </div>
      <p className="text-[9px] text-slate-400 mt-2">Location auto-tagged</p>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
      {onCancel && <button type="button" onClick={onCancel} className="mt-3 text-[10px] font-bold text-slate-400 underline">Cancel</button>}
    </div>
  );
};

// --- REMINDER POPUP ---
const FollowUpReminderModal = ({ tasks, onClose, onView, teamMembers, currentProfile }: any) => {
  const isAdmin = ['Admin', 'Super Admin', 'NW3'].includes(currentProfile?.role || currentProfile?.team);
  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-blue-200">
        <div className="bg-blue-50 p-6 border-b border-blue-100 flex justify-between items-start">
          <div className="flex items-start gap-4"><div className="p-3 bg-blue-100 text-blue-600 rounded-full animate-bounce"><Bell size={24} fill="currentColor" /></div><div><h3 className="text-xl font-bold text-blue-900">Follow-ups Due Today</h3><p className="text-sm text-blue-700 font-medium mt-1">You have {tasks.length} client{tasks.length > 1 ? 's' : ''} scheduled.</p></div></div>
          <button onClick={onClose} className="text-blue-300 hover:text-blue-500 transition-colors"><X size={24} /></button>
        </div>
        <div className="p-0 max-h-[50vh] overflow-y-auto divide-y divide-slate-100">
          {tasks.map((task: any, i: number) => {
            const owner = teamMembers?.find((m: any) => m.id === task.user_id);
            return (
              <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{task.client_name}</p>
                  {isAdmin && owner && <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mt-0.5 mb-1">{owner.name} • {owner.team} • {owner.role}</p>}
                  <div className="flex items-center gap-2 mt-1 mb-1">
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{task.notes || 'No notes'}</p>
                    {task.follow_up_time && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={10}/> {formatTime(task.follow_up_time)}</span>}
                  </div>
                  {task.phone && <a href={`tel:${task.phone}`} className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1 mt-1"><Phone size={10} /> {task.phone}</a>}
                </div>
                <button onClick={() => { onClose(); onView(task); }} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50">View</button>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end"><button onClick={onClose} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg">Got it</button></div>
      </div>
    </div>
  );
};

// --- EDIT MODAL ---
const EditActivityModal = ({ activity, currentUser, onClose, onUpdate, onImageClick }: any) => {
  const isOwner = currentUser?.id === activity.user_id;
  const [loading, setLoading] = useState(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [formData, setFormData] = useState({
    client_name: activity.client_name,
    phone: activity.phone || '',
    customer_activity: activity.customer_activity || '',
    status: activity.status,
    notes: activity.notes || '',
    follow_up_date: activity.follow_up_date || '',
    follow_up_time: activity.follow_up_time || ''
  });

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); 
    if (value.length <= 10) setFormData({...formData, phone: value});
  };

  const handleNewGPSCapture = (files: File[], loc: string) => {
    setNewPhotos(prev => [...prev, ...files]);
    if (loc && loc !== "GPS Denied/Failed") setNewLocation(loc);
    setShowCamera(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (formData.phone && !isValidMobile(formData.phone)) { alert("Invalid Phone Number"); return; }
    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      if (newPhotos.length > 0) {
        for (const file of newPhotos) {
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const { error: uploadError } = await supabase.storage.from('activity-photos').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('activity-photos').getPublicUrl(fileName);
          uploadedUrls.push(data.publicUrl);
        }
      }
      let existingGallery = activity.gallery;
      if (!existingGallery && activity.image_url) existingGallery = [activity.image_url];
      if (!Array.isArray(existingGallery)) existingGallery = [];
      const finalGallery = [...existingGallery, ...uploadedUrls];
      const finalLocation = newLocation || activity.location;

      const { error } = await supabase.from('staff_activity').update({
          client_name: formData.client_name, phone: formData.phone, customer_activity: formData.customer_activity,
          status: formData.status, notes: formData.notes,
          follow_up_date: formData.follow_up_date || null, follow_up_time: formData.follow_up_time || null,
          gallery: finalGallery, location: finalLocation
        }).eq('id', activity.id);
      if (error) throw error;
      onUpdate(); onClose();
    } catch (err: any) { alert("Update failed: " + err.message); } finally { setLoading(false); }
  };

  const displayGallery = [...(activity.gallery || (activity.image_url ? [activity.image_url] : [])), ...newPhotos.map(f => URL.createObjectURL(f))];
  const isToday = formData.follow_up_date === getTodayDateString();

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
          <div><h3 className="text-lg font-bold text-slate-800">Activity Details</h3><p className="text-xs text-slate-500">{isOwner ? "Edit details below." : "View only mode"}</p></div>
          <button onClick={onClose} className="p-2 bg-white border rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Client Name</label><input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} disabled={!isOwner} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none disabled:opacity-70" /></div>
            <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone</label><input type="tel" value={formData.phone} onChange={handlePhoneInput} disabled={!isOwner} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none disabled:opacity-70" /></div>
               <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Customer Activity</label><input type="text" value={formData.customer_activity} onChange={e => setFormData({...formData, customer_activity: e.target.value})} disabled={!isOwner} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none disabled:opacity-70" /></div>
            </div>
            <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notes</label><textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={!isOwner} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none resize-none disabled:opacity-70" /></div>
            <div className="pt-2 pb-2 border-t border-b border-dashed border-slate-200">
               <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Photo & Location</label>
               <div className="grid grid-cols-4 gap-2 mb-3">
                  {displayGallery.map((url: string, i: number) => (
                      <img key={`img-${i}`} src={url} onClick={() => onImageClick(url)} className="w-full h-16 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-90" />
                  ))}
                  {isOwner && !showCamera && <button type="button" onClick={() => setShowCamera(true)} className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors h-16"><Plus size={20} /><span className="text-[9px] font-bold">Add</span></button>}
               </div>
               {showCamera && <div className="animate-in slide-in-from-top-2 mb-3"><InternalCamera onCapture={handleNewGPSCapture} onCancel={() => setShowCamera(false)} isCompact /></div>}
               {newLocation ? <div className="text-[10px] text-green-600 font-bold flex items-center gap-1"><MapPin size={10}/> New Location: {newLocation}</div> : activity.location && <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><MapPin size={10}/> Recorded: {activity.location}</div>}
            </div>
            <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Status (Outcome)</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} disabled={!isOwner} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none disabled:opacity-70"><option>Interested</option><option>In Progress</option><option>Converted</option><option value="Closed">Not Interested</option><option>Pending</option></select></div>
            {(formData.status === 'Interested' || formData.status === 'In Progress') && (<div className="animate-in fade-in slide-in-from-top-2"><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Next Follow-up</label><div className="flex gap-2"><input type="date" value={formData.follow_up_date} onChange={e => setFormData({...formData, follow_up_date: e.target.value})} disabled={!isOwner} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none disabled:opacity-70" />{isToday && <input type="time" value={formData.follow_up_time} onChange={e => setFormData({...formData, follow_up_time: e.target.value})} disabled={!isOwner} className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none disabled:opacity-70 animate-in slide-in-from-left-2" />}</div></div>)}
            {isOwner && <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg mt-4">{loading ? "Updating..." : "Update Activity"}</button>}
          </form>
        </div>
      </div>
    </div>
  );
};

// --- DEFAULTER MODAL ---
const DefaulterModal = ({ defaulters, role, onClose, teamMembers }: { defaulters: any[], role: string, onClose: () => void, teamMembers: any[] }) => {
  if (!defaulters || defaulters.length === 0) return null;
  const isManagement = ['Admin', 'Super Admin', 'Regional Manager'].includes(role) || role === 'NW3';
  const sortedDefaulters = useMemo(() => {
    return [...defaulters].sort((a, b) => {
      const teamA = TEAM_PRIORITY[a.team] || 99, teamB = TEAM_PRIORITY[b.team] || 99;
      if (teamA !== teamB) return teamA - teamB;
      const roleA = teamMembers?.find(m => m.id === a.user_id)?.role, roleB = teamMembers?.find(m => m.id === b.user_id)?.role;
      return (ROLE_PRIORITY[roleA] || 99) - (ROLE_PRIORITY[roleB] || 99);
    });
  }, [defaulters, teamMembers]);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-200">
        <div className="bg-red-50 p-6 border-b border-red-100 flex justify-between items-start">
          <div className="flex items-start gap-4"><div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={24} /></div><div><h3 className="text-xl font-bold text-red-900">{!isManagement ? 'Activity Missing' : 'Team Alert'}</h3><p className="text-sm text-red-700 font-medium mt-1">{!isManagement ? "You did not record any activity yesterday." : `There are ${defaulters.length} staff members with zero activity yesterday.`}</p></div></div>
          <button onClick={onClose} className="text-red-300 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>
        <div className="p-0 max-h-[60vh] overflow-y-auto">
          {!isManagement ? (<div className="p-6 text-slate-600 text-sm">Please ensure you update your daily activities.</div>) : (<table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0"><tr><th className="px-4 py-3 border-b">Name</th><th className="px-4 py-3 border-b">Team</th><th className="px-4 py-3 border-b">Role</th><th className="px-4 py-3 border-b">Phone</th></tr></thead><tbody className="divide-y divide-slate-100">{sortedDefaulters.map((d, i) => { const staffRole = teamMembers?.find(m => m.id === d.user_id)?.role || '-'; return (<tr key={i} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-700">{d.name}</td><td className="px-4 py-3 text-slate-500">{d.team}</td><td className="px-4 py-3 text-slate-500 text-xs">{staffRole}</td><td className="px-4 py-3 text-blue-500 font-mono text-xs">{d.phone}</td></tr>) })}</tbody></table>)}
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end"><button onClick={onClose} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">Acknowledge</button></div>
      </div>
    </div>
  );
};

// --- IMAGE MODAL ---
const ImageModal = ({ imageUrl, onClose }: { imageUrl: string | null, onClose: () => void }) => {
  if (!imageUrl) return null;
  return (<div className="fixed inset-0 z-[10002] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}><button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"><X size={28} strokeWidth={3} /></button><img src={imageUrl} alt="Full View" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>);
};

const StatCard = ({ icon, label, value, color, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start gap-3 active:scale-95 transition-transform text-left w-full hover:bg-slate-50">
    <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
    <div><p className="text-xs text-slate-400 font-bold uppercase">{label}</p><p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p></div>
  </button>
);

const ActivityCard = ({ task, currentUser, currentProfile, onDelete, onSelect, onImageClick, teamMembers }: any) => {
  const isGlobalAdmin = ['Admin', 'Super Admin'].includes(currentProfile?.role) || currentProfile?.team === 'NW3';
  const isRegionalManager = currentProfile?.role === 'Regional Manager' && currentProfile?.team === task.team;
  const isOwner = currentUser?.id === task.user_id;
  const canDelete = isGlobalAdmin || isRegionalManager || isOwner;
  const ownerProfile = teamMembers.find((m: any) => m.id === task.user_id);
  const displayTeam = ownerProfile?.team || task.team || 'Unknown';
  const displayRole = ownerProfile?.role || task.role || 'Staff';

  let statusColor = "bg-slate-100 text-slate-600 border-slate-200"; 
  if (task.status === 'Converted') statusColor = "bg-green-50 text-green-700 border-green-100";
  if (task.status === 'Closed') statusColor = "bg-red-50 text-red-700 border-red-100";
  if (FOLLOW_UP_STATUSES.includes(task.status)) statusColor = "bg-blue-50 text-blue-700 border-blue-100";
  if (task.status === 'Overdue') statusColor = "bg-orange-50 text-orange-700 border-orange-100";

  const galleryImages = Array.isArray(task.gallery) ? task.gallery : (task.image_url ? [task.image_url] : []);

  return (
    <div onClick={(e) => { if(!e.target.closest('button') && !e.target.closest('a')) onSelect(task); }} className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 relative group transition-all hover:shadow-md hover:border-blue-300 cursor-pointer active:scale-[0.99]">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{task.client_name}</h3>
        {canDelete && <button onClick={() => onDelete(task.id)} className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 z-10 hover:bg-red-100"><Trash2 size={16} /></button>}
        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${statusColor}`}>{task.status === 'Closed' ? 'Not Interested' : task.status}</span>
      </div>
      
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {galleryImages.map((url: string, index: number) => (
           <img key={index} src={url} alt={`Photo ${index + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-zoom-in flex-shrink-0" onClick={(e) => { e.stopPropagation(); onImageClick(url); }} onError={(e) => (e.currentTarget.style.display = 'none')} />
        ))}
        {isOwner && (
          <button onClick={(e) => { e.stopPropagation(); onSelect(task); }} className="w-16 h-16 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors flex-shrink-0">
            <Camera size={20} /><span className="text-[8px] font-bold uppercase mt-1">Add</span>
          </button>
        )}
      </div>
      
      {!isOwner && galleryImages.length === 0 && (<div className="h-8 bg-slate-50 rounded-lg mb-3 flex items-center justify-center text-[10px] text-slate-400">No photos</div>)}

      {isOwner && <div className="mb-4"><button onClick={(e) => { e.stopPropagation(); onSelect(task); }} className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors w-full justify-center"><Camera size={14} /><span>Add / Edit Photos</span></button></div>}

      <div className="flex flex-wrap gap-2 mb-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-lg">{displayRole}</span><span className="px-3 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg">{task.type || 'Activity'}</span></div>
      {task.customer_activity && <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100"><Briefcase size={14} className="text-slate-400" /><span className="font-semibold">{task.customer_activity}</span></div>}
      <div className="mb-4"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg flex items-center w-fit gap-1"><Users size={12} /> {task.assigned_by} {displayTeam && `• ${displayTeam}`}</span></div>
      <div className="h-px bg-slate-100 w-full mb-4" />
      <div className="flex gap-3 mb-2"><MapPin size={18} className="text-indigo-500 shrink-0 mt-0.5" /><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 font-bold underline line-clamp-2 hover:text-blue-700 z-10 relative">{task.location || 'No location'}</a></div>
      {task.phone && <div className="flex gap-3 mb-4"><Phone size={18} className="text-blue-500 shrink-0 mt-0.5" /><a href={`tel:${task.phone}`} className="text-xs text-blue-500 font-bold hover:underline z-10 relative">{task.phone}</a></div>}
      <div className="flex justify-between text-[11px] font-bold text-slate-400">
        <span className="flex items-center gap-1"><Calendar size={14}/> {task.follow_up_date || 'None'} {task.follow_up_time && <span className="text-orange-500 bg-orange-50 px-1.5 rounded ml-1">{formatTime(task.follow_up_time)}</span>}</span>
        <span className="flex items-center gap-1"><Clock size={14}/> {task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}</span>
      </div>
    </div>
  );
};

// ==========================================
// 2. SUB-PAGES
// ==========================================

function ActivitiesView({ tasks, initialFilter = 'ALL', onBack, onDelete, onSelect, onImageClick, user, profile, onPrint, teamMembers, dateFilter, setDateFilter, teamFilter, setTeamFilter, roleFilter, setRoleFilter, availableRoles, isGlobalAdmin }: any) {
  const [filter, setFilter] = useState(initialFilter); 
  const filteredItems = tasks.filter((t: any) => {
    if (filter === 'FOLLOW_UP') return t.status !== 'Converted' && t.status !== 'Closed' && t.status !== 'Completed';
    if (filter === 'CONVERTED') return t.status === 'Converted';
    if (filter === 'NOT_INTERESTED') return t.status === 'Closed'; 
    if (filter === 'BRANCH') return t.type === 'Branch Visit';
    return true; 
  });
  
  const handleExport = () => {
    if (filteredItems.length === 0) return alert("No data to export");
    const headers = ['Client Name', 'Customer Activity', 'Type', 'Outcome', 'Location', 'Phone', 'Assigned By', 'Role', 'Date', 'Image URL'];
    const csvRows = [headers.join(','), ...filteredItems.map((row: any) => {
         const imgs = Array.isArray(row.gallery) ? row.gallery.join(' | ') : (row.image_url || '');
         return [`"${row.client_name}"`, `"${row.customer_activity || ''}"`, `"${row.type}"`, `"${row.status}"`, `"${row.location}"`, `"${row.phone}"`, `"${row.assigned_by}"`, `"${row.role}"`, `"${new Date(row.created_at).toLocaleDateString()}"`, `"${imgs}"`].join(',');
    })];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Activities_Report_${filter}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-white sticky top-0 z-10 p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4"><button onClick={onBack}><ArrowLeft className="text-slate-600"/></button><h1 className="font-bold text-lg">Activities ({filter})</h1></div>
        <div className="flex gap-2">
          {onPrint && <button onClick={onPrint} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors shadow-sm" title="Save as PDF"><Printer size={20} /></button>}
          <button onClick={handleExport} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors shadow-sm" title="Download Report"><Download size={20} /></button>
        </div>
      </div>
      
      <div className="p-4 flex gap-2 overflow-x-auto scrollbar-hide">
         <div className="relative min-w-[130px]">
            <input type="date" className="w-full appearance-none bg-white text-slate-600 text-xs font-bold py-2 pl-3 pr-3 rounded-lg outline-none border border-slate-200" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            {dateFilter && <button onClick={() => setDateFilter('')} className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-red-400 hover:text-red-600"><X size={12} /></button>}
         </div>
         {isGlobalAdmin && (
            <>
              <div className="relative min-w-[140px]">
                <select className="w-full appearance-none bg-indigo-50 text-indigo-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none border border-indigo-100" value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); setRoleFilter('ALL'); }}>{TEAMS.map(team => <option key={team} value={team}>{team}</option>)}</select>
                <Layers size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
              </div>
              <div className="relative min-w-[140px]">
                <select className="w-full appearance-none bg-slate-100 text-slate-600 text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none border border-slate-200" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="ALL">All Roles</option>{availableRoles.map((role: string) => <option key={role} value={role}>{role}</option>)}</select>
                <Filter size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </>
         )}
         {['ALL', 'FOLLOW_UP', 'CONVERTED', 'NOT_INTERESTED'].map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border'}`}>{f.replace('_', ' ')}</button>))}
      </div>
      
      <div className="px-4 pb-4 space-y-4">{filteredItems.map((t: any) => (<ActivityCard key={t.id} task={t} currentUser={user} currentProfile={profile} onDelete={onDelete} onSelect={onSelect} onImageClick={onImageClick} teamMembers={teamMembers} />))}</div>
    </div>
  );
}

function TeamView({ profile, onBack }: any) {
  const [team, setTeam] = useState<any[]>([]);
  const isGlobalAdmin = profile && (['Admin', 'Super Admin'].includes(profile.role) || profile.team === 'NW3');

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      if (!data) return;
      let filteredData = isGlobalAdmin ? data : (profile?.team ? data.filter(m => m.team === profile.team) : []);
      filteredData.sort((a, b) => (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99));
      setTeam(filteredData);
    });
  }, [profile, isGlobalAdmin]);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-white sticky top-0 z-10 p-4 border-b flex items-center gap-4"><button onClick={onBack}><ArrowLeft className="text-slate-600"/></button><h1 className="font-bold text-lg">Team Directory</h1></div>
      <div className="p-4 space-y-3">{team.map((m, i) => (<div key={i} className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">{m.name?.charAt(0)}</div><div className="flex-1"><div className="flex justify-between items-start"><div><div className="font-bold text-sm text-slate-800">{m.name}</div><div className="text-xs text-slate-500 font-medium">{m.role} • {m.team}</div></div>{(isGlobalAdmin || profile?.role === 'Regional Manager') && m.last_login && <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">Active: {new Date(m.last_login).toLocaleDateString()}</span>}</div>{m.phone && <a href={`tel:${m.phone}`} className="text-xs text-blue-600 font-bold flex gap-1 items-center mt-2"><Phone size={10} /> {m.phone}</a>}</div></div>))}</div>
    </div>
  );
}

function AdvancedAddActivity({ profile, onBack, onSave }: any) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [location, setLocation] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [followUpList, setFollowUpList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({ activityType: 'New Customer Visit', customerType: 'New Customer', name: '', phone: '', customerActivity: '', notes: '', interestStatus: 'Interested', date: '', time: '' });

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('staff_activity').select('*').eq('user_id', profile.id).neq('status', 'Converted').neq('status', 'Closed').neq('status', 'Completed').order('created_at', { ascending: false }).then(({ data }) => { if (data) setFollowUpList(data); });
  }, [profile]);

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value.replace(/\D/g, ''); if (value.length <= 10) setForm({ ...form, phone: value }); };
  const handleFollowUpSelect = (e: any) => {
    const taskId = e.target.value;
    if (!taskId) { setSelectedFollowUpId(null); return; }
    const task = followUpList.find(t => t.id === taskId);
    if (task) { setSelectedFollowUpId(taskId); setForm(prev => ({ ...prev, name: task.client_name, phone: task.phone || '', customerActivity: task.customer_activity || '', notes: `Follow up on: ${task.notes || ''}` })); }
  };

  const handleGPSCapture = (newFiles: File[], loc: string) => { setPhotos(prev => [...prev, ...newFiles]); if (!location || (loc && loc !== 'GPS Unavailable')) setLocation(loc); setError(''); setIsCameraOpen(false); };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!location && photos.length > 0) return setError("Please wait for GPS location to lock before saving.");
    if (form.phone && !isValidMobile(form.phone)) return setError("Invalid Phone Number");

    setLoading(true); setError('');
    let finalType = form.activityType === 'New Customer Visit' ? `${form.customerType} Visit` : form.activityType;
    let finalStatus = 'Completed'; 
    if (['New Customer Visit', 'Follow-up'].includes(form.activityType)) {
      if (form.interestStatus === 'Interested') finalStatus = 'In Progress';
      if (form.interestStatus === 'Not Interested') finalStatus = 'Closed'; 
      if (form.interestStatus === 'Converted') finalStatus = 'Converted';
    }

    try {
      const uploadedUrls: string[] = [];
      if (photos.length > 0) {
        for (const file of photos) {
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const { error: uploadError } = await supabase.storage.from('activity-photos').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('activity-photos').getPublicUrl(fileName);
          uploadedUrls.push(data.publicUrl);
        }
      }
      // @ts-ignore
      const { error: insertError } = await supabase.from('staff_activity').insert([{
        client_name: form.name, phone: form.phone, customer_activity: form.customerActivity, type: finalType, status: finalStatus, notes: form.notes, location: location, 
        follow_up_date: (form.interestStatus === 'Interested') ? form.date : null, follow_up_time: (form.interestStatus === 'Interested' && form.date === getTodayDateString()) ? form.time : null,
        role: profile?.role || 'Staff', assigned_by: profile?.name || 'Self', user_id: profile?.id, gallery: uploadedUrls, image_url: uploadedUrls[0] || null 
      }]);
      if (insertError) throw insertError;
      if (selectedFollowUpId) { await supabase.from('staff_activity').update({ status: 'Completed', follow_up_date: null }).eq('id', selectedFollowUpId); }
      setShowSuccess(true);
    } catch (err: any) { setError(err.message); setLoading(false); }
  };

  const isToday = form.date === getTodayDateString();

  if (showSuccess) return (<div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300 text-center"><div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-50"><CheckCircle2 size={48} className="text-green-600 drop-shadow-sm" strokeWidth={2.5} /></div><h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Activity Saved!</h2><p className="text-slate-500 font-medium mb-10 max-w-xs leading-relaxed">Your visit details and GPS location have been successfully recorded.</p><button onClick={onSave} className="w-full max-w-[280px] py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2">Return to Dashboard</button></div>);

  return (
    <div className="min-h-screen bg-white pb-20">
       <div className="p-4 border-b flex items-center gap-3 sticky top-0 bg-white z-10"><button onClick={onBack}><ArrowLeft className="text-slate-500"/></button><h1 className="font-bold text-lg">New Activity</h1></div>
       <form onSubmit={handleSubmit} className="p-6 space-y-5 max-w-lg mx-auto">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
          <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Activity Type</label><select name="activityType" value={form.activityType} onChange={handleChange} className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none"><option>New Customer Visit</option><option>Follow-up</option></select></div>
          {form.activityType === 'Follow-up' && <div className="animate-in fade-in slide-in-from-top-2 bg-blue-50 p-4 rounded-xl"><label className="text-xs font-bold text-blue-600 uppercase mb-1 block">Select Pending Task</label><select onChange={handleFollowUpSelect} className="w-full p-3 bg-white rounded-lg font-bold border-none outline-none text-sm"><option value="">-- Select a client --</option>{followUpList.map(t => (<option key={t.id} value={t.id}>{t.client_name} ({t.status})</option>))}</select></div>}
          {form.activityType === 'New Customer Visit' && <div className="animate-in fade-in slide-in-from-top-2"><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Customer Type</label><select name="customerType" value={form.customerType} onChange={handleChange} className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none"><option>New Customer</option><option>Existing Customer</option></select></div>}
          <div className="space-y-4">
            <input name="name" value={form.name} onChange={handleChange} placeholder="Customer Name" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none placeholder:text-slate-400" required />
            <input name="phone" value={form.phone} onChange={handlePhoneChange} placeholder="Phone (10 Digits)" type="tel" className={`w-full p-4 bg-slate-50 rounded-xl font-bold outline-none placeholder:text-slate-400 ${form.phone && !isValidMobile(form.phone) ? 'border-2 border-red-400' : ''}`} />
            <input name="customerActivity" value={form.customerActivity} onChange={handleChange} placeholder="Customer Activity" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none placeholder:text-slate-400" />
            <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Add notes..." rows={3} className="w-full p-4 bg-slate-50 rounded-xl font-medium outline-none placeholder:text-slate-400 resize-none" />
          </div>
          
          <div className="space-y-3 pt-2 border-t border-slate-100">
             <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Photo  & Location</label>
             {/* UPDATED: ALWAYS SHOW LIST OF PHOTOS IF ANY EXIST */}
             {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                   {photos.map((file, idx) => (
                      <img key={idx} src={URL.createObjectURL(file)} className="w-full h-16 object-cover rounded-lg border border-slate-300" />
                   ))}
                </div>
             )}
             
             {isCameraOpen ? <InternalCamera onCapture={handleGPSCapture} onCancel={() => setIsCameraOpen(false)} /> : (
                <button type="button" onClick={() => setIsCameraOpen(true)} className="w-full py-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
                  <Camera size={24} className="text-slate-400"/>
                  {photos.length > 0 ? "Add Another Photo" : "Tap to Take Photo"}
                </button>
             )}
             {location && <div className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-2"><MapPin size={10}/> Location: {location}</div>}
          </div>

          {(form.activityType === 'New Customer Visit' || form.activityType === 'Follow-up') && (
            <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-dashed">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Outcome</label>
              <div className="grid grid-cols-1 gap-4">
                <select name="interestStatus" value={form.interestStatus} onChange={handleChange} className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none"><option>Interested</option><option>Not Interested</option><option>Converted</option></select>
                
                {form.interestStatus === 'Interested' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Follow Up Date</label>
                    <div className="flex gap-2">
                      <input type="date" name="date" value={form.date} onChange={handleChange} className="flex-1 p-4 bg-slate-50 rounded-xl font-bold outline-none text-slate-600" required />
                      
                      {isToday && (
                        <input 
                          type="time" 
                          name="time" 
                          value={form.time} 
                          onChange={handleChange} 
                          className="w-32 p-4 bg-slate-50 rounded-xl font-bold outline-none text-slate-600 animate-in slide-in-from-left-2" 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform mt-4">{loading ? 'Saving...' : <><Save size={20}/> Submit Activity</>}</button>
       </form>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, followUp: 0, completed: 0, notInterested: 0, teams: 0 });
  const [allActivities, setAllActivities] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  const [defaulterList, setDefaulterList] = useState<any[]>([]);
  const [showDefaulterPopup, setShowDefaulterPopup] = useState(false);
  const [dueFollowUps, setDueFollowUps] = useState<any[]>([]);
  const [showFollowUpPopup, setShowFollowUpPopup] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null); 
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL'); 
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  // UPDATED: DEFAULT DATE IS TODAY
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(getTodayDateString());
  const [activeTab, setActiveTab] = useState<'home' | 'activities' | 'team' | 'add'>('home');
  const [activitiesFilter, setActivitiesFilter] = useState<'ALL' | 'FOLLOW_UP' | 'CONVERTED' | 'NOT_INTERESTED' | 'BRANCH'>('ALL');
  const [loading, setLoading] = useState(true);

  // *** FIXED: Defined fetchDashboardData outside useEffect so it can be called by handlers ***
  const fetchDashboardData = async (currentUser?: any) => {
    try {
      const activeUser = currentUser || user;
      if (!activeUser) return;

      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', activeUser.id).single();
      if (profileError || !profileData) {
         console.error("Profile Error:", profileError);
         setLoading(false);
         return; 
      }

      setProfile(profileData);
      
      const { data: allStaff } = await supabase.from('profiles').select('*');
      setTeamMembers(allStaff || []);
      const { data: tasks } = await supabase.from('staff_activity').select('*').order('created_at', { ascending: false });
      setAllActivities(tasks || []);
      
      const isGlobalAdmin = ['Admin', 'Super Admin'].includes(profileData.role) || profileData.team === 'NW3';
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      let defQuery = supabase.from('defaulter_logs').select('*').eq('defaulter_date', yesterday.toISOString().split('T')[0]);
      if (!isGlobalAdmin) defQuery = defQuery.eq('user_id', activeUser.id);
      defQuery.then(({data}) => { if(data && data.length) { setDefaulterList(data); setShowDefaulterPopup(true); }});

      const todayStr = new Date().toISOString().split('T')[0];
      const followUps = (tasks || []).filter((t:any) => t.follow_up_date === todayStr && t.status !== 'Converted' && t.status !== 'Closed' && t.status !== 'Completed' && (isGlobalAdmin ? true : t.user_id === activeUser.id));
      if(followUps.length > 0) { setDueFollowUps(followUps); setShowFollowUpPopup(true); }

      const visibleTeamCount = isGlobalAdmin ? (allStaff?.length || 0) : (allStaff?.filter((m: any) => m.team === profileData.team).length || 0);
      setStats({ 
        total: tasks?.length || 0, 
        followUp: tasks?.filter((t:any) => ['In Progress','Overdue','Interested','Pending'].includes(t.status)).length || 0, 
        completed: tasks?.filter((t:any) => t.status === 'Converted').length || 0, 
        notInterested: tasks?.filter((t:any) => t.status === 'Closed').length || 0, 
        teams: visibleTeamCount 
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setUser(user);
      fetchDashboardData(user);
    };
    init();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };
  
  const handleDeleteActivity = async (id: string) => { 
      if (!window.confirm("Delete?")) return; 
      try { 
          await supabase.from('staff_activity').delete().eq('id', id); 
          fetchDashboardData(); 
      } catch (err: any) { alert("Error: " + err.message); } 
  };
  
  const displayedActivities = useMemo(() => {
    const isGlobalAdmin = ['Admin', 'Super Admin'].includes(profile?.role) || profile?.team === 'NW3';
    const userTeam = profile?.team;

    return allActivities.filter(task => {
      const staffMember = teamMembers.find(m => m.id === task.user_id);
      
      // *** FIXED: PRIORITY TO LIVE PROFILE TEAM FOR FILTERING TOO ***
      const effectiveTeam = staffMember?.team || task.team; 
      const effectiveRole = staffMember?.role || task.role;

      // 1. Mandatory Team Security: If not Admin, ONLY show own team.
      if (!isGlobalAdmin && effectiveTeam !== userTeam) {
          return false;
      }

      // 2. Admin Team Filter
      if (isGlobalAdmin && selectedTeamFilter !== 'ALL') { 
          if (effectiveTeam !== selectedTeamFilter) return false; 
      }
      
      // 3. Role Filter
      if (selectedRoleFilter !== 'ALL') { 
          if (effectiveRole !== selectedRoleFilter) return false; 
      }

      // 4. Date Filter (Fixed Timezone Issue)
      if (selectedDateFilter) {
          const taskDateStr = task.created_at.split('T')[0]; // Simple string compare is safest for "Database Day"
          if (taskDateStr !== selectedDateFilter) return false;
      }

      return true;
    });
  }, [allActivities, teamMembers, selectedTeamFilter, selectedRoleFilter, selectedDateFilter, profile, user]);

  const availableRoles = useMemo(() => { const staffInTeam = selectedTeamFilter === 'ALL' ? teamMembers : teamMembers.filter(m => m.team === selectedTeamFilter); const roles = staffInTeam.map(m => m.role).filter(Boolean); return [...new Set(roles)]; }, [teamMembers, selectedTeamFilter]);
  
  const handlePrint = () => {
    if (displayedActivities.length === 0) return alert("No data to print");
    const tasksByTeam: Record<string, any[]> = {};
    displayedActivities.forEach(task => { const staff = teamMembers.find(m => m.id === task.user_id); const teamName = staff?.team || task.team || 'Unassigned'; if (!tasksByTeam[teamName]) tasksByTeam[teamName] = []; tasksByTeam[teamName].push(task); });
    const sortedTeams = Object.keys(tasksByTeam).sort((a, b) => (a === 'NW3' ? -1 : b === 'NW3' ? 1 : a.localeCompare(b)));
    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;
    
    const getRolePriority = (task: any) => {
       const staff = teamMembers.find(m => m.id === task.user_id);
       const role = task.role || staff?.role;
       return ROLE_PRIORITY[role] || 99;
    };

    printWindow.document.write(`<html><head><title>Report</title><style>body{font-family:sans-serif;padding:20px;font-size:11px}table{width:100%;border-collapse:collapse;margin-bottom:20px;table-layout:fixed}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;word-wrap:break-word}th{background:#f3f4f6}.header{background:#f3f4f6;padding:10px;font-weight:bold;margin-bottom:5px}.notes-cell{width:35%;background-color:#fffbeb;border-left:2px solid #fcd34d;font-weight:600}.gallery-thumbs{display:flex;gap:2px;flex-wrap:wrap}.gallery-img{width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #ddd}</style></head><body><h1>Outreach Report</h1><div style="margin-bottom:20px">Generated: ${new Date().toLocaleString()}</div>${sortedTeams.map(team => {
      const sortedTasks = tasksByTeam[team].sort((a, b) => getRolePriority(a) - getRolePriority(b));
      return `<div class="header">${team}</div><table><colgroup><col style="width:10%"><col style="width:15%"><col style="width:20%"><col style="width:10%"><col style="width:10%"><col style="width:35%"></colgroup><thead><tr><th>Date</th><th>Staff</th><th>Client</th><th>Type</th><th>Status</th><th>Notes</th></tr></thead><tbody>${sortedTasks.map(t => {
         const images = Array.isArray(t.gallery) ? t.gallery : (t.image_url ? [t.image_url] : []);
         // UPDATED: Show 10 images with COMPRESSION query for smaller PDF size
         const imgHtml = images.length > 0 ? `<div class="gallery-thumbs">${images.slice(0, 10).map((src:string) => `<img src="${src}?width=150&quality=50" class="gallery-img"/>`).join('')}</div>` : '';
         return `<tr><td>${new Date(t.created_at).toLocaleDateString()}</td><td>${t.assigned_by}<br/><span style="color:#888;font-size:9px">${t.role}</span></td><td><strong>${t.client_name}</strong><br/><span style="font-size:10px;color:#666">${t.customer_activity||''}</span><br/><span style="font-size:9px;color:#888">${t.location||''}</span>${imgHtml}</td><td>${t.type}</td><td>${t.status}</td><td class="notes-cell">${t.notes||'-'}</td></tr>`;
      }).join('')}</tbody></table>`;
    }).join('')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleExport = () => {
    if (displayedActivities.length === 0) return alert("No data to export");
    const headers = ['Client Name', 'Customer Activity', 'Type', 'Outcome', 'Location', 'Phone', 'Assigned By', 'Role', 'Date', 'Image URL'];
    const csvRows = [headers.join(','), ...displayedActivities.map((row: any) => {
         const imgs = Array.isArray(row.gallery) ? row.gallery.join(' | ') : (row.image_url || '');
         return [`"${row.client_name}"`, `"${row.customer_activity || ''}"`, `"${row.type}"`, `"${row.status}"`, `"${row.location}"`, `"${row.phone}"`, `"${row.assigned_by}"`, `"${row.role}"`, `"${new Date(row.created_at).toLocaleDateString()}"`, `"${imgs}"`].join(',');
    })];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Activities_Report_${new Date().toISOString()}.csv`; a.click();
  };

  // 1. RENDER MODALS AT ROOT LEVEL (FIXES BACK BUTTON BUG)
  const modals = (
    <>
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      {showDefaulterPopup && <DefaulterModal defaulters={defaulterList} role={profile?.role} onClose={() => setShowDefaulterPopup(false)} teamMembers={teamMembers} />}
      
      {/* UPDATED FOLLOW UP MODAL WITH ADMIN INFO */}
      {showFollowUpPopup && (
        <FollowUpReminderModal 
          tasks={dueFollowUps} 
          onClose={() => setShowFollowUpPopup(false)} 
          onView={(task) => setSelectedActivity(task)} 
          teamMembers={teamMembers}
          currentProfile={profile}
        />
      )}
      
      {selectedActivity && <EditActivityModal activity={selectedActivity} currentUser={user} onClose={() => setSelectedActivity(null)} onUpdate={() => { fetchDashboardData(); setSelectedActivity(null); }} onImageClick={setSelectedImage} />}
    </>
  );

  // 2. RENDER MAIN VIEW
  const renderView = () => {
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    const isGlobalAdmin = ['Admin', 'Super Admin'].includes(profile?.role) || profile?.team === 'NW3';

    if (activeTab === 'activities') return <ActivitiesView 
      tasks={displayedActivities} 
      initialFilter={activitiesFilter} 
      onBack={() => setActiveTab('home')} 
      onDelete={handleDeleteActivity} 
      onSelect={setSelectedActivity} 
      onImageClick={setSelectedImage} 
      user={user} 
      profile={profile} 
      onPrint={handlePrint} 
      teamMembers={teamMembers} 
      dateFilter={selectedDateFilter} 
      setDateFilter={setSelectedDateFilter}
      teamFilter={selectedTeamFilter}
      setTeamFilter={setSelectedTeamFilter}
      roleFilter={selectedRoleFilter}
      setRoleFilter={setSelectedRoleFilter}
      availableRoles={availableRoles}
      isGlobalAdmin={isGlobalAdmin}
    />;
    
    if (activeTab === 'team') return <TeamView profile={profile} onBack={() => setActiveTab('home')} />;
    if (activeTab === 'add') return <AdvancedAddActivity profile={profile} onBack={() => setActiveTab('home')} onSave={() => { setActiveTab('home'); fetchDashboardData(); }} />;

    // HOME DASHBOARD VIEW
    return (
      <div className="min-h-screen bg-slate-50 pb-20 relative animate-in fade-in duration-300">
        <header className="bg-white px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-10 border-b border-slate-100">
          <div><h1 className="text-2xl font-bold text-blue-700 tracking-tight">Outreach</h1><p className="text-sm text-slate-500 font-medium mt-0.5">Welcome {profile?.name || 'User'}, {profile?.role || 'Staff'}, {profile?.team || 'General'}</p></div>
          <div className="flex gap-2">
            {isGlobalAdmin && <button onClick={() => navigate('/admin')} className="bg-blue-100 text-blue-700 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-blue-200 transition-colors"><Shield size={16} /> Admin</button>}
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut size={22} /></button>
          </div>
        </header>
        
        <main className="p-4 space-y-6">
          {/* STATS GRID */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={<Calendar size={20}/>} label="Total" value={stats.total} color="bg-blue-50 text-blue-600" onClick={() => { setActivitiesFilter('ALL'); setActiveTab('activities'); }} />
            <StatCard icon={<MapPin size={20}/>} label="Follow Up" value={stats.followUp} color="bg-blue-50 text-blue-600" onClick={() => { setActivitiesFilter('FOLLOW_UP'); setActiveTab('activities'); }} />
            <StatCard icon={<CheckCircle2 size={20}/>} label="Converted" value={stats.completed} color="bg-green-50 text-green-600" onClick={() => { setActivitiesFilter('CONVERTED'); setActiveTab('activities'); }} />
            <StatCard icon={<XCircle size={20}/>} label="Not Interested" value={stats.notInterested} color="bg-red-50 text-red-600" onClick={() => { setActivitiesFilter('NOT_INTERESTED'); setActiveTab('activities'); }} />
          </div>

          <button onClick={() => setActiveTab('team')} className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:bg-purple-50 transition-colors active:scale-95"><div className="p-3 rounded-xl bg-purple-50 text-purple-600"><Users size={24} /></div><div className="flex-1 text-left"><p className="text-xs text-slate-400 font-bold uppercase">Team Directory</p><p className="text-xl font-bold text-slate-800">{stats.teams} Members</p></div><ArrowLeft className="rotate-180 text-slate-300" size={20}/></button>

          {/* ACTIVITY FEED */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2 px-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Recent Tasks</h3>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors" title="Save as PDF"><Printer size={12} /> PDF</button>
                    <button onClick={handleExport} className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors"><Download size={12} /> CSV</button>
                </div>
              </div>
              
              {/* FILTERS */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <div className="relative min-w-[140px]">
                     <input type="date" className="w-full appearance-none bg-white text-slate-600 text-xs font-bold py-2 pl-3 pr-3 rounded-lg outline-none border border-slate-200" value={selectedDateFilter} onChange={(e) => setSelectedDateFilter(e.target.value)} />
                     {selectedDateFilter && (<button onClick={() => setSelectedDateFilter('')} className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-red-400 hover:text-red-600"><X size={12} /></button>)}
                  </div>

                  {(isGlobalAdmin) && (
                    <>
                      <div className="relative min-w-[140px]">
                        <select className="w-full appearance-none bg-indigo-50 text-indigo-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none border border-indigo-100" value={selectedTeamFilter} onChange={(e) => { setSelectedTeamFilter(e.target.value); setSelectedRoleFilter('ALL'); }}>{TEAMS.map(team => <option key={team} value={team}>{team}</option>)}</select>
                        <Layers size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                      </div>
                      <div className="relative min-w-[140px]">
                        <select className="w-full appearance-none bg-slate-100 text-slate-600 text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none border border-slate-200" value={selectedRoleFilter} onChange={(e) => setSelectedRoleFilter(e.target.value)}><option value="ALL">All Roles</option>{availableRoles.map(role => <option key={role} value={role}>{role}</option>)}</select>
                        <Filter size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </>
                  )}
              </div>
            </div>

            {/* LIST */}
            {displayedActivities.slice(0, 10).map((task) => (
               <ActivityCard key={task.id} task={task} currentUser={user} currentProfile={profile} onDelete={handleDeleteActivity} onSelect={setSelectedActivity} onImageClick={setSelectedImage} teamMembers={teamMembers} />
            ))}
            {displayedActivities.length === 0 && <div className="p-8 text-center bg-white rounded-[20px] border border-dashed border-slate-200"><p className="text-slate-400 font-bold text-sm">No tasks found.</p></div>}
          </div>
        </main>
        
        <button onClick={() => setActiveTab('add')} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/30 flex items-center justify-center active:scale-90 transition-transform z-20"><Plus size={28} strokeWidth={2.5} /></button>
      </div>
    );
  };

  return (
    <>
      {modals}
      {renderView()}
    </>
  );
}