export interface ModulePermissions {
  [key: string]: string[];
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: ModulePermissions;
  metadata?: Record<string, any>;
  last_login?: string;
}

interface AuthResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: AuthUser;
    application: {
      id: string;
      name: string;
      domain: string;
    };
  };
}

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  app_id: string;
  role: string;
  permissions: ModulePermissions;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

import { getEnvVar } from './envLoader';

function getAuthConfig() {
  return {
    AUTH_URL: getEnvVar('VITE_AUTH_URL'),
    APP_ID: getEnvVar('VITE_AUTH_APP_ID'),
    API_KEY: getEnvVar('VITE_AUTH_API_KEY'),
    APP_URL: getEnvVar('VITE_APP_URL') || window.location.origin,
    CODE_EXCHANGE_URL: getEnvVar('VITE_AUTH_CODE_EXCHANGE_URL'),
  };
}

export const externalAuth = {
  redirectToLogin() {
    const { AUTH_URL, APP_ID, APP_URL } = getAuthConfig();
    const redirectUri = `${APP_URL}/callback`;
    const loginUrl = `${AUTH_URL}/login?app_id=${encodeURIComponent(APP_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = loginUrl;
  },

  parseCallbackUrl(url: string): { code: string } | null {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');

      if (!code) {
        return null;
      }

      return {
        code: decodeURIComponent(code)
      };
    } catch (error) {
      return null;
    }
  },

  async exchangeCodeForToken(code: string): Promise<{ token: string; refreshToken: string; userId: string } | null> {
    try {
      const { CODE_EXCHANGE_URL, APP_ID } = getAuthConfig();

      if (!CODE_EXCHANGE_URL) {
        console.error('CODE_EXCHANGE_URL no está configurado');
        return null;
      }

      const response = await fetch(CODE_EXCHANGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          application_id: APP_ID
        })
      });

      if (!response.ok) {
        console.error('Error al intercambiar código:', response.status);
        return null;
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.data.access_token) {
        return {
          token: data.data.access_token,
          refreshToken: data.data.refresh_token || '',
          userId: data.data.user.id
        };
      }

      return null;
    } catch (error) {
      console.error('Error en exchangeCodeForToken:', error);
      return null;
    }
  },

  decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload) as TokenPayload;
    } catch (error) {
      return null;
    }
  },

  getUserFromToken(token: string): AuthUser | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'agent',
      permissions: payload.permissions || {}
    };
  },

  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  },

  storeAuthData(token: string, refreshToken: string, userId: string) {
    this.clearSupabaseStorage();

    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_id', userId);

    const user = this.getUserFromToken(token);
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
  },

  clearSupabaseStorage() {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  getStoredToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  getStoredRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  },

  getStoredUser(): AuthUser | null {
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr) as AuthUser;
    } catch {
      return null;
    }
  },

  clearAuthData() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_user');
    this.clearSupabaseStorage();
  },

  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const { AUTH_URL, APP_ID, API_KEY } = getAuthConfig();
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          api_key: API_KEY
        })
      });

      if (!response.ok) {
        return null;
      }

      const data: AuthResponse = await response.json();
      if (data.success && data.data.access_token) {
        this.storeAuthData(
          data.data.access_token,
          data.data.refresh_token,
          data.data.user.id
        );
        return data.data.access_token;
      }

      return null;
    } catch (error) {
      return null;
    }
  },

  async logout() {
    try {
      const { AUTH_URL, APP_ID, API_KEY } = getAuthConfig();
      const token = this.getStoredToken();
      if (token) {
        await fetch(`${AUTH_URL}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            app_id: APP_ID,
            api_key: API_KEY
          })
        });
      }
    } catch (error) {
    } finally {
      this.clearAuthData();
    }
  },

  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    if (!token) return false;

    if (this.isTokenExpired(token)) {
      const refreshToken = this.getStoredRefreshToken();
      if (refreshToken) {
        return true;
      }
      return false;
    }

    return true;
  },

  getUserRole(): string {
    const user = this.getStoredUser();
    if (!user || !user.role) {
      return 'agent';
    }

    return user.role.toLowerCase();
  }
};
