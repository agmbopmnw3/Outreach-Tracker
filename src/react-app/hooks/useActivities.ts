import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Activity {
  id: number;
  created_at: string;
  team: string;
  contact: string;
  phone_number: string;
  type: string;
  customer_type?: string;
  interest_level?: string;
  notes: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  follow_up_date: string | null;
  is_completed: number;
  user_id: string;
  profiles?: { email: string }; // New: We fetch the user's email
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    try {
      // We explicitly ask for the profile email related to the user_id
      const { data, error } = await supabase
        .from('activities')
        .select('*, profiles:user_id (email)') 
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // TypeScript casting to handle the joined data
      setActivities((data as any) || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createActivity(activityData: Omit<Activity, 'id' | 'created_at' | 'user_id' | 'is_completed' | 'profiles'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("You must be logged in.");

      const newActivity = {
        ...activityData,
        user_id: user.id,
        is_completed: 0
      };

      const { data, error } = await supabase
        .from('activities')
        .insert([newActivity])
        .select();

      if (error) throw error;

      // When adding locally, we just attach the current user's email immediately
      // so the UI updates without needing a refresh
      const activityWithProfile = {
        ...data[0],
        profiles: { email: user.email }
      };

      setActivities([activityWithProfile, ...activities]);
      return data[0];
    } catch (error) {
      console.error("FAILED TO CREATE ACTIVITY:", error);
      throw error;
    }
  }

  return { activities, loading, createActivity, refreshActivities: fetchActivities };
}