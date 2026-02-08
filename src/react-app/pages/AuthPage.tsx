import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path if needed (e.g., ../../lib/supabase)
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const email = `${phone}@sbiapp.com`; 
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Incorrect Phone or Password' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* --- ANIMATED BACKGROUND --- */}
      {/* Deep Blue Base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#003d7a] via-slate-900 to-black" />
      
      {/* Moving Blobs */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[80px] animate-pulse delay-700" />
      
      {/* Mesh Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} 
      />

      {/* --- MAIN CARD --- */}
      <div className="w-full max-w-[420px] relative z-10 perspective-1000">
        
        <div className="group relative bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[32px] shadow-2xl transition-all duration-500 hover:shadow-blue-500/10 hover:border-white/20">
          
          {/* Top Gloss Shine */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />

          {/* --- HEADER SECTION --- */}
          <div className="flex flex-col items-center mb-8">
            
            {/* Logo Container (App Icon Style) */}
            <div className="relative mb-6 group-hover:scale-105 transition-transform duration-300 ease-out">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-30 rounded-full"></div>
              <div className="relative w-24 h-24 bg-white rounded-[24px] shadow-lg flex items-center justify-center p-3 border border-white/50">
                <img 
                  src="/sbi-logo.png" 
                  alt="SBI Logo" 
                  className="w-full h-full object-contain drop-shadow-sm"
                  onError={(e) => {
                     e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-logo.svg";
                  }}
                />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight text-center">
              SBI <span className="text-blue-400">Outreach</span>
            </h1>
            <p className="text-blue-200/60 text-xs font-bold tracking-[0.25em] uppercase mt-2">
              Amaravati NW3
            </p>
          </div>

          {/* --- FORM SECTION --- */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Phone Input */}
            <div className="group relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                <Phone size={20} />
              </div>
              <input
                type="tel"
                placeholder="Mobile Number"
                className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-900/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all duration-300 font-medium"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="group relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                <Lock size={20} />
              </div>
              <input
                type="password"
                placeholder="Password"
                className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:bg-slate-900/80 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all duration-300 font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
                <ShieldCheck size={14} /> {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-4 mt-2 group overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(37,99,235,0.5)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Authenticating...
                  </>
                ) : (
                  <>
                    Sign In Securely <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">
              SECURED ACCESS • NW3 TEAM 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}