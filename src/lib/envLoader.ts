interface EnvConfig {
  project_name: string;
  description: string;
  variables: {
    VITE_SUPABASE_ANON_KEY: string;
    VITE_SUPABASE_URL: string;
    VITE_AUTH_URL: string;
    VITE_AUTH_SYSTEM_URL: string;
    VITE_AUTH_APP_ID: string;
    VITE_AUTH_API_KEY: string;
    VITE_APP_URL: string;
    VITE_AUTH_CODE_EXCHANGE_URL: string;
    VITE_WIDGET_URL: string;
    VITE_WIDGET_APIKEY: string; 
  };
  updated_at: string;
}

class EnvironmentLoader {
  private static instance: EnvironmentLoader;
  private config: EnvConfig['variables'] | null = null;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): EnvironmentLoader {
    if (!EnvironmentLoader.instance) {
      EnvironmentLoader.instance = new EnvironmentLoader();
    }
    return EnvironmentLoader.instance;
  }

  async loadConfig(): Promise<void> {
    if (this.config) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loading = true;
    this.loadPromise = this.fetchConfig();
    await this.loadPromise;
    this.loading = false;
  }

  private async fetchConfig(): Promise<void> {
    const API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
    const ACCESS_KEY = '05c04864455effee17737adb494eb95db4e30fd7a41fe358eea0fe621b06c67b';

    try {
      console.log('🔄 Cargando configuración desde API...');

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'X-Access-Key': ACCESS_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: EnvConfig = await response.json();
      const variables = (data as unknown as { variables?: unknown })?.variables;
      const apiVars = this.normalizeVariables(variables);
      const localVars = this.normalizeVariables(import.meta.env as unknown);
      this.config = this.mergeVariables(apiVars, localVars);

      console.log('✅ Configuración cargada exitosamente');
      console.log('📦 Proyecto:', data.project_name);
      console.log('📝 Descripción:', data.description);
      console.log('🕒 Última actualización:', new Date(data.updated_at).toLocaleString());

      if (!this.config.VITE_WIDGET_URL) {
        console.warn('⚠️ VITE_WIDGET_URL no está configurado (API y local). El widget mostrará "Missing VITE_WIDGET_URL".');
      }
      if (!this.config.VITE_WIDGET_APIKEY) {
        console.warn('⚠️ VITE_WIDGET_APIKEY no está configurado (API y local).');
      }

      this.injectIntoImportMeta();
    } catch (error) {
      console.error('❌ Error cargando configuración desde API:', error);
      console.warn('⚠️ Usando variables de entorno locales (.env) como fallback');

      this.config = this.normalizeVariables(import.meta.env as unknown);

      this.injectIntoImportMeta();
    }
  }

  private injectIntoImportMeta(): void {
    if (!this.config) return;

    Object.entries(this.config).forEach(([key, value]) => {
      const env = import.meta.env as unknown as Record<string, unknown>;
      env[key] = value;
    });
  }

  getConfig(): EnvConfig['variables'] | null {
    return this.config;
  }

  get(key: keyof EnvConfig['variables']): string {
    if (!this.config) {
      console.warn(`⚠️ Config no cargado aún, intentando obtener ${key} desde import.meta.env`);
      return import.meta.env[key] || '';
    }
    return this.config[key] || '';
  }

  isLoaded(): boolean {
    return this.config !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  private normalizeVariables(input: unknown): EnvConfig['variables'] {
    const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};

    const read = (...candidates: string[]): string => {
      for (const candidate of candidates) {
        const value = raw[candidate];
        if (typeof value === 'string' && value.trim().length > 0) return value;
      }
      return '';
    };

    return {
      VITE_SUPABASE_ANON_KEY: read('VITE_SUPABASE_ANON_KEY', 'vite_supabase_anon_key'),
      VITE_SUPABASE_URL: read('VITE_SUPABASE_URL', 'vite_supabase_url'),
      VITE_AUTH_URL: read('VITE_AUTH_URL', 'vite_auth_url'),
      VITE_AUTH_SYSTEM_URL: read('VITE_AUTH_SYSTEM_URL', 'vite_auth_system_url'),
      VITE_AUTH_APP_ID: read('VITE_AUTH_APP_ID', 'vite_auth_app_id'),
      VITE_AUTH_API_KEY: read('VITE_AUTH_API_KEY', 'vite_auth_api_key'),
      VITE_APP_URL: read('VITE_APP_URL', 'vite_app_url'),
      VITE_AUTH_CODE_EXCHANGE_URL: read('VITE_AUTH_CODE_EXCHANGE_URL', 'vite_auth_code_exchange_url'),

      // Widget/bot settings (support common naming variants)
      VITE_WIDGET_URL: read(
        'VITE_WIDGET_URL',
        'vite_widget_url',
        'WIDGET_URL',
        'widget_url',
        'widgetUrl',
        'botApiUrl',
        'bot_api_url'
      ),
      VITE_WIDGET_APIKEY: read(
        'VITE_WIDGET_APIKEY',
        'VITE_WIDGET_API_KEY',
        'vite_widget_apikey',
        'vite_widget_api_key',
        'WIDGET_APIKEY',
        'WIDGET_API_KEY',
        'widget_apikey',
        'widget_api_key',
        'widgetApiKey',
        'botIntegrationKey',
        'bot_integration_key'
      ),
    };
  }

  private mergeVariables(primary: EnvConfig['variables'], fallback: EnvConfig['variables']): EnvConfig['variables'] {
    return {
      VITE_SUPABASE_ANON_KEY: primary.VITE_SUPABASE_ANON_KEY || fallback.VITE_SUPABASE_ANON_KEY,
      VITE_SUPABASE_URL: primary.VITE_SUPABASE_URL || fallback.VITE_SUPABASE_URL,
      VITE_AUTH_URL: primary.VITE_AUTH_URL || fallback.VITE_AUTH_URL,
      VITE_AUTH_SYSTEM_URL: primary.VITE_AUTH_SYSTEM_URL || fallback.VITE_AUTH_SYSTEM_URL,
      VITE_AUTH_APP_ID: primary.VITE_AUTH_APP_ID || fallback.VITE_AUTH_APP_ID,
      VITE_AUTH_API_KEY: primary.VITE_AUTH_API_KEY || fallback.VITE_AUTH_API_KEY,
      VITE_APP_URL: primary.VITE_APP_URL || fallback.VITE_APP_URL,
      VITE_AUTH_CODE_EXCHANGE_URL: primary.VITE_AUTH_CODE_EXCHANGE_URL || fallback.VITE_AUTH_CODE_EXCHANGE_URL,
      VITE_WIDGET_URL: primary.VITE_WIDGET_URL || fallback.VITE_WIDGET_URL,
      VITE_WIDGET_APIKEY: primary.VITE_WIDGET_APIKEY || fallback.VITE_WIDGET_APIKEY,
    };
  }
}

export const envLoader = EnvironmentLoader.getInstance();

export const getEnvVar = (key: keyof EnvConfig['variables']): string => {
  return envLoader.get(key);
};

export const waitForConfig = async (): Promise<void> => {
  await envLoader.loadConfig();
};
