import { TrendingUp, LayoutGrid, AlertCircle, CheckCircle2, MapPin } from "lucide-react";

interface StatsCardProps {
  title: string;
  count: number;
  trend?: string; // Made optional
  color: 'indigo' | 'red' | 'emerald' | 'blue' | 'amber';
  onClick?: () => void;
  isActive?: boolean;
}

export default function StatsCard({ title, count, trend, color, onClick, isActive }: StatsCardProps) {
  
  const colorStyles = {
    indigo: "bg-indigo-50 text-indigo-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600"
  };

  // Smart Icon Selection based on Title
  let Icon = LayoutGrid;
  if (title === 'Overdue') Icon = AlertCircle;
  if (title === 'Completed') Icon = CheckCircle2;
  if (title === 'Branch Visits') Icon = MapPin;

  return (
    <div 
      onClick={onClick}
      className={`bg-white p-3 rounded-2xl border shadow-sm transition-all cursor-pointer h-full flex flex-col justify-between
        ${isActive 
          ? `border-${color}-500 ring-1 ring-${color}-200 bg-${color}-50/10` 
          : 'border-slate-100 hover:border-slate-300' 
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-xl ${colorStyles[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{count}</h3>
      </div>
    </div>
  );
}