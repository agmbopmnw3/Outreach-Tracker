import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Check, X, Loader2 } from 'lucide-react';

export default function ChangePassword({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) throw error;

      setMessage({ text: "Password updated successfully!", type: 'success' });
      setTimeout(() => {
        onClose(); // Close modal after success
      }, 1500);

    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Lock className="text-blue-600" size={20} /> Change Password
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          
          {message && (
            <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Password</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
              autoFocus
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-200"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <>Update Password <Check size={18} /></>}
          </button>

          <p className="text-[10px] text-slate-400 text-center px-4">
            Next time you login, you must use this new password.
          </p>
        </form>
      </div>
    </div>
  );
}