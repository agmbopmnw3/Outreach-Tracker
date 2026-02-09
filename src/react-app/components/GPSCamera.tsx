import { useState, useRef } from 'react';
import { Camera, X, Plus, Check, MapPin, WifiOff } from 'lucide-react';

interface GPSCameraProps {
  onCapture: (files: File[], locationString: string) => void;
  onCancel?: () => void;
}

export default function GPSCamera({ onCapture, onCancel }: GPSCameraProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [locationSaved, setLocationSaved] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSecure = window.isSecureContext;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // 1. Get ALL new files
    const newFiles = Array.from(e.target.files);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));

    // 2. APPEND to existing files
    setImages(prev => [...prev, ...newFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
    
    // 3. Clear input so "Add" works again
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 4. Get GPS if missing
    if (!locationSaved) getGPS();
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const getGPS = () => {
    if (!isSecure) { setStatus("BLOCKED: Use HTTPS"); return; }
    if (!navigator.geolocation) { setStatus("GPS Not Supported"); return; }

    setStatus("🛰️ Locating...");
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setLocationSaved(loc);
        setStatus(`✅ GPS Locked`);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setStatus("⚠️ GPS Weak (Using Low Accuracy)");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFinish = () => {
    if (images.length === 0) return;
    onCapture(images, locationSaved || "GPS Unavailable");
  };

  return (
    <div className="w-full space-y-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
      
      {/* GPS Status */}
      {isSecure && (
        <div className={`p-2 rounded-lg text-xs font-bold text-center border ${
          locationSaved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-100'
        }`}>
           {locationSaved ? `📍 ${locationSaved}` : (status || "Ready to capture")}
        </div>
      )}

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, idx) => (
            <div key={idx} className="relative aspect-square">
              <img src={src} className="w-full h-full object-cover rounded-lg border border-slate-300" />
              <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md">
                <X size={12} />
              </button>
            </div>
          ))}
          {/* Add More Button (Inside Camera) */}
          <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-blue-500">
            <Plus size={24} />
          </button>
        </div>
      )}

      <input type="file" accept="image/*" multiple capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-3 bg-white text-slate-600 border border-slate-300 rounded-xl font-bold">
            Cancel
          </button>
        )}
        
        {images.length === 0 ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
            <Camera size={20} /> Take Photos
          </button>
        ) : (
          <button type="button" onClick={handleFinish} disabled={loading && !locationSaved} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
            {loading && !locationSaved ? "Waiting for GPS..." : `Save ${images.length} Photos`} 
            {(!loading || locationSaved) && <Check size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}