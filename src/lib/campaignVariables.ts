// Variables que el CRM completa automáticamente al enviar una campaña — por contacto
// (client_name, company_name, etc., leídas de la fila en `contacts`) o por campaña
// (campaign_name, crm_company, etc., calculadas en send-campaign-emails). Cualquier otra
// variable que pida un template de SendCraft se carga a mano en "Parámetros del Template"
// al crear la campaña.
export const DEFAULT_VARIABLE_KEYS = [
  'client_name', 'first_name', 'last_name', 'client_email', 'company_name', 'client_phone',
  'unsubscribe_url', 'campaign_name', 'current_date', 'crm_company', 'company_url'
];
