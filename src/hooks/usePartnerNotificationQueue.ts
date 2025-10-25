import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getEnvVar } from '../lib/envLoader';

export function usePartnerNotificationQueue() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const processingRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const processFunction = async () => {
      if (processingRef.current) {
        console.log('⏸️ Procesamiento de notificaciones de partners ya en curso, saltando...');
        return;
      }

      processingRef.current = true;

      try {
        console.log('🔍 Verificando notificaciones de partners pendientes...');

        const { data: pendingNotifications } = await supabase
          .from('partner_notification_queue')
          .select('id, invoice_id, partner_id, payload, recipient_email')
          .eq('status', 'pending')
          .limit(5);

        if (pendingNotifications && pendingNotifications.length > 0) {
          console.log(`📧 Encontradas ${pendingNotifications.length} notificaciones pendientes, procesando...`);

          for (const notification of pendingNotifications) {
            try {
              await supabase
                .from('partner_notification_queue')
                .update({ status: 'processing' })
                .eq('id', notification.id);

              const response = await fetch(
                `${getEnvVar('VITE_SUPABASE_URL')}/functions/v1/send-order-communication`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${getEnvVar('VITE_SUPABASE_ANON_KEY')}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(notification.payload),
                }
              );

              if (response.ok) {
                const result = await response.json();
                console.log('✅ Notificación enviada:', result);

                await supabase
                  .from('partner_notification_queue')
                  .update({
                    status: 'sent',
                    processed_at: new Date().toISOString()
                  })
                  .eq('id', notification.id);
              } else {
                const errorText = await response.text();
                console.error('❌ Error enviando notificación:', errorText);

                await supabase
                  .from('partner_notification_queue')
                  .update({
                    status: 'error',
                    attempts: notification.attempts ? notification.attempts + 1 : 1,
                    last_error: errorText
                  })
                  .eq('id', notification.id);
              }
            } catch (error: any) {
              console.error('❌ Error procesando notificación:', error);

              await supabase
                .from('partner_notification_queue')
                .update({
                  status: 'error',
                  attempts: notification.attempts ? notification.attempts + 1 : 1,
                  last_error: error.message
                })
                .eq('id', notification.id);
            }
          }
        } else {
          console.log('✅ No hay notificaciones de partners pendientes');
        }
      } catch (error) {
        console.error('❌ Error en procesamiento automático de notificaciones:', error);
      } finally {
        processingRef.current = false;
      }
    };

    // Procesar al inicio
    processFunction();

    // Procesar cada 30 segundos (polling para asegurar que se procese)
    intervalRef.current = window.setInterval(() => {
      processFunction();
    }, 30000);

    console.log('👂 Iniciando escucha de cola de notificaciones de partners...');

    // Escuchar cambios en la cola
    channelRef.current = supabase
      .channel('partner-notification-queue-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'partner_notification_queue',
          filter: 'status=eq.pending',
        },
        (payload) => {
          console.log('🔔 Nueva notificación de partner en cola:', payload);
          setTimeout(() => processFunction(), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción de cola de notificaciones de partners:', status);
      });

    return () => {
      console.log('🛑 Cerrando suscripción de cola de notificaciones de partners...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
