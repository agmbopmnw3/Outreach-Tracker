import { useState } from 'react';
import { X, Upload, Loader2, MapPin, Plus } from 'lucide-react';
import { useActivities } from '../hooks/useActivities';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import GPSCamera from './GPSCamera';

interface AddActivityModalProps {
  onClose: () => void;
}

export default function AddActivityModal({ onClose }: AddActivityModalProps) {
  const { createActivity } = useActivities();
  const { user } = useAuth();
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    contact: '',
    phone_number: '',
    type: 'Customer Visit',
    customer_type: 'New Customer',
    interest_level: 'Interested',
    notes: '',
    follow_up_date: ''
  });

  // Camera & Location State
  const [photos, setPhotos] = useState<File[]>([]);
  const [location, setLocation] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(true); // Start with camera open if no photos

  // 1. Handle Camera Capture (Appends photos + updates location)
  const handleGPSCapture = (newFiles: File[], loc: string) => {
    // Append new photos to the existing list
    setPhotos(prev => [...prev, ...newFiles]);

    // Update location (only if valid or if we don't have one yet)
    if (!location || (loc && loc !== 'GPS Unavailable')) {
      setLocation(loc);
    }
    
    // Clear any previous errors about location
    if (loc && loc !== 'GPS Unavailable') setError('');

    // Close camera to show preview
    setIsCameraOpen(false);
  };

  // 2. Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contact) {
      setError('Please enter a Customer or Branch Name');
      return;
    }

    if (!location) {
      setError('Please take a photo to tag your location.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // A. Upload Photos to Storage (The Loop)
      const uploadedUrls: string[] = [];
      
      if (photos.length > 0) {
        for (const file of photos) {
          // Generate unique filename: timestamp-random.jpg
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          
          // Upload to Supabase Bucket
          const { error: uploadError } = await supabase.storage
            .from('activity-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get the Public URL
          const { data: { publicUrl } } = supabase.storage
            .from('activity-photos')
            .getPublicUrl(fileName);
          
          uploadedUrls.push(publicUrl);
        }
      }

      // B. Determine Follow-up Date logic
      const finalFollowUpDate = 
        (formData.type === 'Customer Visit' && formData.interest_level === 'Interested') 
        ? formData.follow_up_date 
        : null;

      // C. Save to Database
      await createActivity({
        team: user?.user_metadata?.team || 'General',
        contact: formData.contact,
        phone_number: formData.phone_number,
        type: formData.type,
        customer_type: formData.type === 'Customer Visit' ? formData.customer_type : undefined,
        interest_level: formData.type === 'Customer Visit' ? formData.interest_level : undefined,
        notes: formData.notes,
        location: location,
        gallery: uploadedUrls, // Save array of URLs
        follow_up_date: finalFollowUpDate || null
      });

      window.alert("Activity Added Successfully!");
      onClose();

    } catch (err: any) {
      console.error('Failed to create activity:', err);
      setError(err.message || 'Failed to create activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">New Activity</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="overflow-y-auto p-4 space-y-5">
          
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
              {error}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Customer / Branch</label>
            <input
              type="text"
              required
              value={formData.contact}
              onChange={(e) => setFormData({...formData, contact: e.target.value})}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. State Bank Main Branch"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              >
                <option>Customer Visit</option>
                <option>Branch Visit</option>
                <option>Follow-up</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Phone</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Conditional Fields */}
          {formData.type === 'Customer Visit' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
               <div>
                  <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Customer Type</label>
                  <select
                    value={formData.customer_type}
                    onChange={(e) => setFormData({...formData, customer_type: e.target.value})}
                    className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option>New Customer</option>
                    <option>Existing Customer</option>
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-black uppercase text-blue-900 mb-1">Status</label>
                  <select
                    value={formData.interest_level}
                    onChange={(e) => setFormData({...formData, interest_level: e.target.value})}
                    className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option>Interested</option>
                    <option>Not-Interested</option>
                    <option>Completed</option>
                  </select>
               </div>
            </div>
          )}

          {formData.type === 'Customer Visit' && formData.interest_level === 'Interested' && (
             <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Next Follow-up</label>
                <input
                  type="date"
                  required
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({...formData, follow_up_date: e.target.value})}
                  className="w-full p-3 bg-white border border-blue-300 ring-4 ring-blue-50 rounded-xl focus:ring-blue-500 outline-none font-medium text-blue-900"
                />
             </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
              placeholder="Meeting details..."
            />
          </div>

          {/* --- NEW CAMERA & LOCATION SECTION --- */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
             <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">
               Photo Evidence & Location
             </label>

             {/* MODE 1: CAMERA IS OPEN */}
             {isCameraOpen ? (
               <GPSCamera 
                 onCapture={handleGPSCapture} 
                 onCancel={() => setIsCameraOpen(false)} // Allow closing camera without taking pic
               />
             ) : (
               
               // MODE 2: PREVIEW LIST (When camera is closed)
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative animate-in zoom-in-50">
                 
                 <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">{photos.length} Photos Ready</span>
                    <button 
                      type="button"
                      onClick={() => { setPhotos([]); setLocation(''); setIsCameraOpen(true); }} 
                      className="text-xs text-red-500 font-bold hover:underline"
                    >
                      Clear All
                    </button>
                 </div>

                 {/* Photo Grid */}
                 <div className="grid grid-cols-4 gap-2 mb-3">
                   {photos.map((file, idx) => (
                     <img 
                       key={idx} 
                       src={URL.createObjectURL(file)} 
                       className="w-full h-16 object-cover rounded-lg border border-slate-300" 
                       alt="preview"
                     />
                   ))}
                   
                   {/* ADD MORE BUTTON */}
                   <button 
                     type="button"
                     onClick={() => setIsCameraOpen(true)} 
                     className="w-full h-16 flex flex-col items-center justify-center bg-white border-2 border-dashed border-blue-300 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                   >
                     <Plus size={20} />
                     <span className="text-[9px] font-bold uppercase">Add</span>
                   </button>
                 </div>

                 {/* Location Tag */}
                 <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                   <MapPin size={16} />
                   <span className="text-xs font-mono truncate w-full">
                     {location || "Processing Location..."}
                   </span>
                 </div>
               </div>
             )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:scale-100"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {submitting ? "Uploading..." : "Save Activity"}
          </button>
        </div>

      </div>
    </div>
  );
}