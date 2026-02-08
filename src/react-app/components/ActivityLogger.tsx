import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Send, MapPin, ClipboardList, Loader2, Camera, X } from 'lucide-react';

export default function ActivityLogger({ profile, onSave }: { profile: any, onSave: () => void }) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('Field Visit');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  
  // New State for Photo
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalImageUrl = null;

      // 1. UPLOAD IMAGE (If selected)
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${profile.team}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('activity-photos')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        // Get the Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('activity-photos')
          .getPublicUrl(filePath);
          
        finalImageUrl = publicUrl;
      }

      // 2. SAVE ACTIVITY TO DB
      const { error } = await supabase.from('activities').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        team: profile.team,
        activity_type: type,
        location: location,
        notes: notes,
        image_url: finalImageUrl // Save the link!
      });

      if (error) throw error;

      // Reset Form
      setNotes('');
      setLocation('');
      setImageFile(null);
      setPreviewUrl(null);
      onSave();

    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={20} /> Log New Activity
        </h3>
        
        {/* CAMERA BUTTON */}
        <div className="relative">
           <input 
             type="file" 
             accept="image/*" 
             capture="environment" // Forces rear camera on mobile
             onChange={handleFileSelect}
             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
           />
           <button type="button" className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl font-bold text-xs hover:bg-blue-100">
             <Camera size={16} /> {imageFile ? 'Retake Photo' : 'Add Photo'}
           </button>
        </div>
      </div>

      {/* PHOTO PREVIEW */}
      {previewUrl && (
        <div className="relative w-full h-48 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          <button 
            type="button"
            onClick={() => { setImageFile(null); setPreviewUrl(null); }}
            className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
          >
            <X size={16} />
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Activity Type</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
          >
            <option>Field Visit</option>
            <option>Customer Meeting</option>
            <option>Tele-Calling</option>
            <option>Marketing Event</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Location / Area</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="e.g. Amaravati Main Branch"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase">Notes / Remarks</label>
        <textarea 
          placeholder="Describe the activity..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium h-24"
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-100"
      >
        {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Save Activity</>}
      </button>
    </form>
  );
}