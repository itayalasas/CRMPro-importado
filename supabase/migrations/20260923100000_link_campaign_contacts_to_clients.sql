/*
  # Vincular contactos de campaña con tarjetas de Cliente

  ## Why
  Hoy `contacts` (destinatarios de campañas) y `clients` (CRM comercial: Ventas,
  Tickets, Llamadas, Agenda) son entidades completamente desconectadas. El pedido
  es que al enviar una campaña, cada destinatario quede disponible como una
  tarjeta de Cliente para poder hacerle seguimiento igual que a cualquier otro
  contacto comercial — replicando el mismo patrón que ya usa
  webchat-contact-form (upsertLeadClient): busca por email, si no existe crea
  un cliente 'prospect' con source='campaign', y dejar un registro en
  client_interactions para que aparezca en el timeline del cliente.

  ## Changes
  - `contacts.client_id`: referencia al cliente vinculado/creado, para no
    tener que re-resolverlo (por email) en cada envío/reintento.
  - `client_interactions_type_check`: agrega 'campaign_sent' a los tipos
    permitidos (mismo patrón que 20260922120000_add_chat_interaction_types.sql).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);

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
      'chat_message_sent',
      'campaign_sent'
    )
  );
