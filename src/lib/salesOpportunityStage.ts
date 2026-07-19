import { supabase } from './supabase';

export const DEFAULT_SALES_OPPORTUNITY_STAGE_ID = '04541c75-b5c1-476d-9d91-fe17f628bb5e';

let cachedSalesOpportunityStageId: string | null = null;
let stageIdPromise: Promise<string> | null = null;

export const resolveDefaultSalesOpportunityStageId = async (): Promise<string> => {
  if (cachedSalesOpportunityStageId) {
    return cachedSalesOpportunityStageId;
  }

  if (stageIdPromise) {
    return stageIdPromise;
  }

  stageIdPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('sales_opportunities')
        .select('stage_id')
        .not('stage_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && typeof (data as { stage_id?: unknown }).stage_id === 'string') {
        const stageId = String((data as { stage_id: string }).stage_id).trim();
        if (stageId) {
          cachedSalesOpportunityStageId = stageId;
          return stageId;
        }
      }
    } catch (error) {
      console.warn('No se pudo resolver stage_id desde sales_opportunities:', error);
    }

    cachedSalesOpportunityStageId = DEFAULT_SALES_OPPORTUNITY_STAGE_ID;
    return DEFAULT_SALES_OPPORTUNITY_STAGE_ID;
  })().finally(() => {
    stageIdPromise = null;
  });

  return stageIdPromise;
};
