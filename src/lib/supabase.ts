import { createClient } from '@supabase/supabase-js';
import { supabase as supabaseConfig } from '@/lib/config/env';

const supabaseUrl = supabaseConfig.url;
const supabaseServiceRoleKey = supabaseConfig.serviceRoleKey;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase service role key not found. Supabase admin client will not be fully functional.');
}

// Server-side Supabase client (uses service role key, bypasses RLS)
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Type-safe Supabase admin client getter with error handling
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin client not initialized. Please check your SUPABASE_SERVICE_ROLE_KEY environment variable.'
    );
  }
  return supabaseAdmin;
}