import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { externalAuth } from './externalAuth';
import { getEnvVar } from './envLoader';

function getSupabaseCredentials() {
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { supabaseUrl, supabaseAnonKey };
}

const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
const baseClient = createClient(supabaseUrl, supabaseAnonKey);
let authenticatedClient: SupabaseClient | null = null;

function getAuthenticatedClient(): SupabaseClient {
  if (!authenticatedClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  const token = externalAuth.getStoredToken();
  if (token) {
    (authenticatedClient as any).rest.headers = {
      ...(authenticatedClient as any).rest.headers,
      Authorization: `Bearer ${token}`
    };
  }

  return authenticatedClient;
}

export const supabase = new Proxy(baseClient, {
  get(target, prop) {
    const token = externalAuth.getStoredToken();
    if (token && (prop === 'from' || prop === 'rpc')) {
      return getAuthenticatedClient()[prop as keyof SupabaseClient];
    }
    return target[prop as keyof SupabaseClient];
  }
}) as SupabaseClient;
