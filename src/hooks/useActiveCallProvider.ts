import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CallProvider = 'twilio' | 'freepbx';

export function useActiveCallProvider(): CallProvider {
  const [provider, setProvider] = useState<CallProvider>('twilio');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from('freepbx_config')
        .select('is_default_provider')
        .eq('is_active', true)
        .maybeSingle();

      if (mounted && data?.is_default_provider) {
        setProvider('freepbx');
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return provider;
}
