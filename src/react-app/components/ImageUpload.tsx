import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';

interface ImageUploadProps {
  onImageUpload: (url: string) => void;
  currentImage?: string;
}

export default function ImageUpload({ onImageUpload, currentImage }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentImage || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      onImageUpload(data.key);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
      setPreview('');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleRemove = () => {
    setPreview('');
    onImageUpload('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  if (preview) {
    return (
      <div className="relative">
        <img
          src={preview}
          alt="Preview"
          className="w-full h-64 object-cover rounded-lg"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>
        {uploading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Uploading...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Camera Capture */}
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        disabled={uploading}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full">
            <Camera className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-slate-700 font-medium text-sm">Take Photo</p>
            <p className="text-slate-400 text-xs mt-1">Use camera</p>
          </div>
        </div>
      </button>

      {/* Gallery Upload */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-slate-700 font-medium text-sm">Upload Photo</p>
            <p className="text-slate-400 text-xs mt-1">From gallery</p>
          </div>
        </div>
      </button>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
