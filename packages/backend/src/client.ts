import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BackendConfig } from './types.js';

export function createBackendClient(config: BackendConfig): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required.');
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
}
