/*
  # Agregar tipos de interaccion de chat al historial de clientes

  ## Por que
  client_interactions_type_check no incluia 'chat_opened' ni
  'chat_message_sent', a pesar de que el codigo del chat web (tanto el
  flujo existente de respuesta a conversaciones como el nuevo de "Nueva
  conversacion" iniciada por un agente) ya intenta grabar esos tipos.
  recordClientInteractionSafely degrada silenciosamente a 'note' cuando
  el constraint rechaza el tipo, asi que no rompia nada, pero el timeline
  del cliente perdia el icono/color especifico de chat (ya definidos en
  clientActivity.ts) y quedaba como una nota generica.
*/

ALTER TABLE public.client_interactions DROP CONSTRAINT IF EXISTS client_interactions_type_check;

ALTER TABLE public.client_interactions
  ADD CONSTRAINT client_interactions_type_check
  CHECK (
    type IN (
      'call',
      'email',
      'meeting',
      'note',
      'order',
      'invoice',
      'lead_created',
      'quote_requested',
      'opportunity_created',
      'quote_created',
      'quote_converted',
      'stage_changed',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'quote_expired',
      'task_created',
      'task_completed',
      'task_rescheduled',
      'task_overdue',
      'chat_opened',
      'chat_message_sent'
    )
  );
