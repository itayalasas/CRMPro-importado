import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnvVar } from './envLoader';
import { externalAuth } from './externalAuth';

type SupabaseLike = {
	from: SupabaseClient['from'];
	rpc: SupabaseClient['rpc'];
	channel: SupabaseClient['channel'];
	removeChannel: SupabaseClient['removeChannel'];
	removeAllChannels: SupabaseClient['removeAllChannels'];
	storage: SupabaseClient['storage'];
	functions: SupabaseClient['functions'];
	auth: SupabaseClient['auth'];
};

let baseClient: SupabaseClient | null = null;
let authedClient: SupabaseClient | null = null;
let authedToken: string | null = null;

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
	try {
		const base64Url = token.split('.')[1];
		if (!base64Url) return null;
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
				.join('')
		);
		return JSON.parse(jsonPayload) as Record<string, unknown>;
	} catch {
		return null;
	}
};

const isSupabaseJwt = (token: string, supabaseUrl: string): boolean => {
	const payload = decodeJwtPayload(token);
	if (!payload) return false;

	const issuer = typeof payload.iss === 'string' ? payload.iss : '';
	const expectedIssuerPrefix = `${supabaseUrl}/auth/v1`;
	if (issuer && issuer.startsWith(expectedIssuerPrefix)) {
		return true;
	}

	return false;
};

const resolveSupabaseConfig = () => {
	const url = getEnvVar('VITE_SUPABASE_URL');
	const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
	return { url, anonKey };
};

const getBaseClient = (): SupabaseClient => {
	const { url, anonKey } = resolveSupabaseConfig();

	if (!url || !anonKey) {
		throw new Error('Supabase no configurado: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
	}

	if (!baseClient) {
		baseClient = createClient(url, anonKey);
		return baseClient;
	}

	const currentUrl = (baseClient as unknown as { supabaseUrl?: string }).supabaseUrl;
	if (currentUrl && currentUrl !== url) {
		baseClient = createClient(url, anonKey);
	}

	return baseClient;
};

const getAuthenticatedClient = (): SupabaseClient => {
	const token = externalAuth.getStoredToken();
	const { url, anonKey } = resolveSupabaseConfig();

	if (!token || !url || !isSupabaseJwt(token, url)) {
		authedClient = null;
		authedToken = null;
		return getBaseClient();
	}

	if (!authedClient || authedToken !== token) {
		authedToken = token;
		authedClient = createClient(url, anonKey, {
			global: {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		});
	}

	return authedClient;
};

const getActiveClient = (): SupabaseClient => {
	const token = externalAuth.getStoredToken();
	if (token) return getAuthenticatedClient();
	return getBaseClient();
};

export const supabase: SupabaseLike = new Proxy({} as SupabaseLike, {
	get(_, prop: keyof SupabaseLike) {
		const client = getActiveClient();
		const value = (client as unknown as SupabaseLike)[prop];

		if (typeof value === 'function') {
			return value.bind(client);
		}

		return value;
	},
});
