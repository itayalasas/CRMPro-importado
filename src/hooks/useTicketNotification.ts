import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook para notificar cambios de estado y nuevos comentarios en ticket.
 * Llama a onNotify con info relevante cuando hay update.
 */
export function useTicketNotification(ticketId: number, onNotify: (payload: { type: 'comment' | 'status', data: any }) => void) {
  useEffect(() => {
    if (!ticketId) return;
    // Suscripción a comentarios
    const commentSub = supabase
      .channel('ticket_comments_' + ticketId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_comments',
        filter: `ticket_id=eq.${ticketId}`
      }, payload => {
        onNotify({ type: 'comment', data: payload.new });
      })
      .subscribe();

    // Suscripción a historial de estado
    const historySub = supabase
      .channel('ticket_history_' + ticketId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_history',
        filter: `ticket_id=eq.${ticketId}`
      }, payload => {
        onNotify({ type: 'status', data: payload.new });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentSub);
      supabase.removeChannel(historySub);
    };
  }, [ticketId, onNotify]);
}
