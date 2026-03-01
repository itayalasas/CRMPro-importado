export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketCreateDraft {
  client_id?: string;
  subject?: string;
  description?: string;
  description_html?: string;
  priority?: TicketPriority;
  status?: string;
  category_id?: string;
  assigned_to?: string;
  conversation_id?: string;
  order_id?: string;
  source_module?: string;
  source_name?: string;
  source_email?: string;
  source_phone?: string;
}

const TICKET_CREATE_DRAFT_KEY = 'ticket_create_draft';
const LEGACY_WEBCHAT_DRAFT_KEY = 'webchat_ticket_draft';

export const saveTicketCreateDraft = (draft: TicketCreateDraft): void => {
  localStorage.setItem(TICKET_CREATE_DRAFT_KEY, JSON.stringify(draft));
};

export const consumeTicketCreateDraft = (): TicketCreateDraft | null => {
  const draftKeys = [TICKET_CREATE_DRAFT_KEY, LEGACY_WEBCHAT_DRAFT_KEY];

  for (const key of draftKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    localStorage.removeItem(key);

    try {
      return JSON.parse(raw) as TicketCreateDraft;
    } catch {
      return null;
    }
  }

  return null;
};
