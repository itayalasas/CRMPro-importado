import { supabase } from './supabase';

export interface FreePBXConfig {
  id: string;
  provider: string;
  sip_domain: string;
  websocket_url: string;
  default_country_code: string;
  outbound_caller_id: string | null;
  stun_server: string | null;
  is_active: boolean;
  is_default_provider: boolean;
}

export interface UserSipExtension {
  id: string;
  user_id: string;
  sip_extension: string;
  sip_auth_user: string;
  sip_password: string;
  display_name: string | null;
  is_active: boolean;
}

class FreePBXService {
  private config: FreePBXConfig | null = null;
  private extension: UserSipExtension | null = null;

  async loadConfig(forceReload = false): Promise<FreePBXConfig | null> {
    if (!forceReload && this.config) {
      return this.config;
    }

    const { data, error } = await supabase
      .from('freepbx_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      this.config = null;
      return null;
    }

    this.config = data as FreePBXConfig;
    return this.config;
  }

  async loadUserExtension(userId: string, forceReload = false): Promise<UserSipExtension | null> {
    if (!forceReload && this.extension && this.extension.user_id === userId) {
      return this.extension;
    }

    const { data, error } = await supabase
      .from('user_sip_extensions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      this.extension = null;
      return null;
    }

    this.extension = data as UserSipExtension;
    return this.extension;
  }

  clearConfig(): void {
    this.config = null;
    this.extension = null;
  }

  getConfig(): FreePBXConfig | null {
    return this.config;
  }
}

export const freepbxService = new FreePBXService();
