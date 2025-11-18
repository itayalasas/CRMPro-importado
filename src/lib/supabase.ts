import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { externalAuth } from './externalAuth';
import { getEnvVar } from './envLoader';

let baseClient: SupabaseClient | null = null;
let authenticatedClient: SupabaseClient | null = null;

function getSupabaseCredentials() {
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getBaseClient(): SupabaseClient {
  if (!baseClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
    baseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'external-auth'
      }
    });
  }
  return baseClient;
}

function getAuthenticatedClient(): SupabaseClient {
  if (!authenticatedClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'external-auth-authenticated'
      }
    });
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

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getBaseClient();
    const token = externalAuth.getStoredToken();

    if (token && (prop === 'from' || prop === 'rpc')) {
      return getAuthenticatedClient()[prop as keyof SupabaseClient];
    }

    return client[prop as keyof SupabaseClient];
  }
}) as SupabaseClient;
