import { MapPin, Calendar, Clock, User } from "lucide-react";
import { Activity } from "../hooks/useActivities";
import { useAuth } from "../contexts/AuthContext";

export default function ActivityCard({ activity }: { activity: Activity }) {
  const { user } = useAuth();
  
  // Check if this activity belongs to someone else
  const isOtherUser = activity.profiles?.email && activity.profiles.email !== user?.email;

  return (
    <div className={`p-4 rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative
      ${isOtherUser ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
      
      {/* If it's another user, show a small badge at the top right */}
      {isOtherUser && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
          <User className="w-3 h-3 text-indigo-500" />
          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">
            {activity.profiles?.email?.split('@')[0]}
          </span>
        </div>
      )}

      <div className="flex justify-between items-start mb-3 pr-20">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">{activity.contact}</h3>
          
          <div className="flex flex-wrap gap-2 mt-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
              ${activity.type === 'Customer Visit' ? 'bg-blue-50 text-blue-600' : 
                activity.type === 'Branch Visit' ? 'bg-purple-50 text-purple-600' : 
                activity.type === 'Follow-up' ? 'bg-amber-50 text-amber-600' : 
                'bg-slate-100 text-slate-600'}`}>
              {activity.type}
            </span>

            {/* Show Interest Status if available */}
            {activity.interest_level && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border
                ${activity.interest_level === 'Interested' ? 'bg-green-50 text-green-700 border-green-200' : 
                  activity.interest_level === 'Not-Interested' ? 'bg-red-50 text-red-700 border-red-200' : 
                  'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {activity.interest_level}
              </span>
            )}
          </div>
        </div>
        
        {activity.image_url && (
          <img 
            src={activity.image_url} 
            alt="Visit" 
            className="w-16 h-16 rounded-lg object-cover border border-slate-100 mt-6 sm:mt-0"
          />
        )}
      </div>

      {activity.notes && (
        <p className="text-slate-600 text-sm mb-3 line-clamp-2">{activity.notes}</p>
      )}

      <div className="space-y-2 text-sm text-slate-500">
        {activity.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="truncate text-xs">{activity.location}</span>
          </div>
        )}
        
        <div className="flex items-center gap-4 text-xs">
           <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{new Date(activity.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
             <Clock className="w-4 h-4 text-slate-400" />
             <span>{new Date(activity.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
      </div>
    </div>
  );
}