import { supabase } from './supabase';

const STAGE_ORDER = ['prospect', 'contacted', 'meeting', 'quote', 'negotiation', 'won', 'lost'] as const;
const EARLY_STAGES: string[] = ['prospect', 'contacted'];

/**
 * Cualquier tarea (llamada, reunion, seguimiento, etc.) vinculada a una
 * oportunidad la hace avanzar a la etapa 'meeting' si todavia esta en una
 * etapa temprana (prospect/contacted). Nunca retrocede una oportunidad que
 * ya avanzo mas (quote/negotiation/won/lost); en esos casos solo actualiza
 * last_activity_at para que el pipeline refleje la actividad reciente.
 */
export const advanceOpportunityOnLinkedTask = async (opportunityId: string, timestamp: string) => {
  const { data: opportunity, error: fetchError } = await supabase
    .from('sales_opportunities')
    .select('id, stage')
    .eq('id', opportunityId)
    .maybeSingle();

  if (fetchError || !opportunity) return;

  const updates: Record<string, unknown> = {
    last_activity_at: timestamp,
    updated_at: timestamp,
  };

  if (EARLY_STAGES.includes(opportunity.stage as string)) {
    updates.stage = 'meeting' satisfies (typeof STAGE_ORDER)[number];
  }

  await supabase.from('sales_opportunities').update(updates).eq('id', opportunityId);
};

/**
 * Resuelve la oportunidad abierta mas reciente de un cliente, para vincular
 * automaticamente tareas nuevas sin que el usuario tenga que elegirla a mano.
 * No crea una oportunidad nueva (a diferencia del flujo de cotizaciones):
 * una tarea generica (ej. "llamar para cobrar factura") no siempre implica
 * una oportunidad de venta nueva, asi que solo vincula si ya existe una abierta.
 */
export const resolveOpenOpportunityForClient = async (clientId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('sales_opportunities')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
};
