import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getEnvVar } from '../lib/envLoader';

export function useInvoiceAutoValidation() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const processFunction = async () => {
      if (processingRef.current) {
        console.log('⏸️ Procesamiento ya en curso, saltando...');
        return;
      }

      processingRef.current = true;

      try {
        console.log('🔍 Verificando facturas pendientes de validación...');

        const { data: pendingInvoices } = await supabase
          .from('invoices')
          .select('id, invoice_number')
          .eq('pending_validation', true)
          .eq('status', 'draft')
          .limit(5);

        if (pendingInvoices && pendingInvoices.length > 0) {
          console.log(`📋 Encontradas ${pendingInvoices.length} facturas pendientes, enviando a procesar...`);

          const response = await fetch(
            `${getEnvVar('VITE_SUPABASE_URL')}/functions/v1/process-pending-invoices`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${getEnvVar('VITE_SUPABASE_ANON_KEY')}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Facturas procesadas:', result);
          } else {
            console.error('❌ Error procesando facturas:', await response.text());
          }
        }
      } catch (error) {
        console.error('❌ Error en procesamiento automático:', error);
      } finally {
        processingRef.current = false;
      }
    };

    processFunction();

    console.log('👂 Iniciando escucha de facturas con pending_validation...');

    channelRef.current = supabase
      .channel('invoice-validation-listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: 'pending_validation=eq.true',
        },
        (payload) => {
          console.log('🔔 Factura detectada con pending_validation:', payload);
          setTimeout(() => processFunction(), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción de validación:', status);
      });

    return () => {
      console.log('🛑 Cerrando suscripción de validación...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);
}
