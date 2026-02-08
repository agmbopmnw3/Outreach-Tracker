import { createClient } from '@supabase/supabase-js';

// Fixed: Added quotes (' ') around the URL and Key
const SUPABASE_URL = 'https://nsshssmhuvehafyvysvm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zc2hzc21odXZlaGFmeXZ5c3ZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgxMTAxMCwiZXhwIjoyMDg1Mzg3MDEwfQ.RrMRmogH_9D7Vcs2UUzPZOxMGfbSQa8f5Vy23Q8-p8k';

// This special client has "Admin Superpowers" to create users correctly
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});