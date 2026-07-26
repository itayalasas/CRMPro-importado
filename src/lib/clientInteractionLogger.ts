import { supabase } from './supabase';

export interface ClientInteractionInsertPayload {
  client_id: string | null;
  opportunity_id?: string | null;
  quote_id?: string | null;
  conversation_id?: string | null;
  task_id?: string | null;
  order_id?: string | null;
  type: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export const isClientInteractionTypeConstraintError = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('client_interactions_type_check') ||
    message.includes('violates check constraint') ||
    message.includes('check constraint')
  );
};

export const recordClientInteractionSafely = async (payload: ClientInteractionInsertPayload) => {
  const insertPayload = {
    ...payload,
    metadata: payload.metadata ?? {},
  };

  const { error } = await supabase.from('client_interactions').insert(insertPayload as any);
  if (!error) {
    return { error: null, usedFallback: false };
  }

  if (!isClientInteractionTypeConstraintError(error)) {
    return { error, usedFallback: false };
  }

  const fallbackPayload = {
    ...insertPayload,
    type: 'note',
    metadata: {
      ...(insertPayload.metadata || {}),
      original_type: payload.type,
      fallback_type: 'note',
      fallback_reason: 'client_interactions_type_check',
    },
  };

  const { error: fallbackError } = await supabase.from('client_interactions').insert(fallbackPayload as any);
  return { error: fallbackError ?? null, usedFallback: true };
};
