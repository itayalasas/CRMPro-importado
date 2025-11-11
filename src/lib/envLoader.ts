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
      this.config = data.variables;

      console.log('✅ Configuración cargada exitosamente');
      console.log('📦 Proyecto:', data.project_name);
      console.log('📝 Descripción:', data.description);
      console.log('🕒 Última actualización:', new Date(data.updated_at).toLocaleString());

      this.injectIntoImportMeta();
    } catch (error) {
      console.error('❌ Error cargando configuración desde API:', error);
      console.warn('⚠️ Usando variables de entorno locales (.env) como fallback');

      this.config = {
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
        VITE_AUTH_URL: import.meta.env.VITE_AUTH_URL || '',
        VITE_AUTH_SYSTEM_URL: import.meta.env.VITE_AUTH_SYSTEM_URL || '',
        VITE_AUTH_APP_ID: import.meta.env.VITE_AUTH_APP_ID || '',
        VITE_AUTH_API_KEY: import.meta.env.VITE_AUTH_API_KEY || '',
        VITE_APP_URL: import.meta.env.VITE_APP_URL || '',
        VITE_AUTH_CODE_EXCHANGE_URL: import.meta.env.VITE_AUTH_CODE_EXCHANGE_URL || '',
      };

      this.injectIntoImportMeta();
    }
  }

  private injectIntoImportMeta(): void {
    if (!this.config) return;

    Object.entries(this.config).forEach(([key, value]) => {
      (import.meta.env as any)[key] = value;
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
}

export const envLoader = EnvironmentLoader.getInstance();

export const getEnvVar = (key: keyof EnvConfig['variables']): string => {
  return envLoader.get(key);
};

export const waitForConfig = async (): Promise<void> => {
  await envLoader.loadConfig();
};
