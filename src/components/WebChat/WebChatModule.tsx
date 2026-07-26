/*
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  MessageCircle,
  UserCheck,
  Users,
  Phone,
  Mail,
  Ticket,
  Tag,
  CheckCircle,
  Clock,
  Send,
  Paperclip,
  Search,
  X,
  RefreshCw,
  UserPlus,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getEnvVar } from '../../lib/envLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDialer } from '../../contexts/DialerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { searchUsers } from '../../lib/userService';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { externalAuth } from '../../lib/externalAuth';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { recordClientInteractionSafely } from '../../lib/clientInteractionLogger';

const sourceLabels: Record<string, string> = {
  widget: 'Widget',
  form: 'Formulario',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  social: 'Red social'
};

const sourceLabels: Record<string, string> = {
  widget: 'Widget',
  form: 'Formulario',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  social: 'Red social'
};

interface WebChatConversation {
  id: string;
  session_id: string;
  source_domain: string | null;
  source_channel?: string | null;
  source_detail?: string | null;
  page_url: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  visitor_id: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: 'open' | 'assigned' | 'taken' | 'resolved' | 'closed';
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_at: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  cause?: string | null;
  cause_custom?: string | null;
  result?: string | null;
  result_notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface WebChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'agent' | 'bot' | 'system';
  sender_id: string | null;
  sender_name: string | null;
  message: string | null;
  attachments: Array<{ filename: string; size: number; type: string; path?: string; url?: string }>;
  created_at: string;
}

interface TicketDraft {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client_id?: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  client_id: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  assigned_user?: { id: string; full_name: string | null; email: string | null } | null;
  created_by: string | null;
  created_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  client_id: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  assigned_user?: { id: string; full_name: string; email: string } | null;
  created_by: string | null;
  created_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  client_id: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  client_id: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface ClientDraft {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'prospect' | 'active' | 'inactive';
}

interface ClientLookup {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'prospect' | 'active' | 'inactive';
}

export function WebChatModule() {
  const { user } = useAuth();
  const toast = useToast();
  const { navigateToInbox, setActiveModule } = useNavigation();
  const { initiateCall } = useDialer();

  const [conversations, setConversations] = useState<WebChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferResults, setTransferResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [sidePanelMode, setSidePanelMode] = useState<'client' | 'ticket' | 'ticket_view' | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientLookup[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientDraft>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    status: 'prospect'
  });
  const [ticketDraft, setTicketDraft] = useState<TicketDraft>({
    subject: '',
    description: '',
    priority: 'medium'
  });
  const [ticketViewLoading, setTicketViewLoading] = useState(false);
  const [ticketViewTicket, setTicketViewTicket] = useState<TicketRecord | null>(null);
  const [ticketViewComments, setTicketViewComments] = useState<TicketComment[]>([]);
  const [ticketViewActivities, setTicketViewActivities] = useState<TicketActivity[]>([]);
  const [ticketViewTab, setTicketViewTab] = useState<'comments' | 'activity'>('comments');
  const [ticketViewNewComment, setTicketViewNewComment] = useState('');
  const [ticketViewIsInternal, setTicketViewIsInternal] = useState(false);
  const [ticketViewHasUpdates, setTicketViewHasUpdates] = useState(false);
  const ticketViewStatusRef = useRef<TicketRecord['status'] | null>(null);
  const [sidePanelSaving, setSidePanelSaving] = useState(false);
  const [linkedTicketStatus, setLinkedTicketStatus] = useState<TicketRecord['status'] | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const lastConvoErrorRef = useRef<number>(0);
  const loadingConversationsRef = useRef(false);
  const lastViewedStorageKey = 'crm_webchat_last_viewed';
  const [lastViewedMap, setLastViewedMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(lastViewedStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const selectedConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<WebChatConversation[]>([]);
  const lastNotifyRef = useRef<Record<string, number>>({});
  const [causeFilter, setCauseFilter] = useState('all');
  const [causeSelection, setCauseSelection] = useState('');
  const [causeCustom, setCauseCustom] = useState('');
  const [resultSelection, setResultSelection] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [savingConversationMeta, setSavingConversationMeta] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'chat' | 'details'>('list');

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const linkedTicketNumber = useMemo(() => {
    if (!selectedConversationId) return null;
    const ticketMsg = [...messages]
      .reverse()
      .find((msg) => typeof msg.message === 'string' && msg.message.includes('Ticket creado:'))
      ?.message;

    if (!ticketMsg) return null;
    const match = ticketMsg.match(/Ticket creado:\s*(TKT-[A-Z0-9-]+)/i);
    return match?.[1] || null;
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (!linkedTicketNumber) {
      setLinkedTicketStatus(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('status')
        .eq('ticket_number', linkedTicketNumber)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.status) {
        setLinkedTicketStatus(null);
        return;
      }
      setLinkedTicketStatus(data.status as TicketRecord['status']);
    })();

    return () => {
      cancelled = true;
    };
  }, [linkedTicketNumber]);

  useEffect(() => {
    ticketViewStatusRef.current = ticketViewTicket?.status ?? null;
  }, [ticketViewTicket?.status]);

  const linkedTicketNumber = useMemo(() => {
    if (!selectedConversationId) return null;
    const ticketMsg = [...messages]
      .reverse()
      .find((msg) => typeof msg.message === 'string' && msg.message.includes('Ticket creado:'))
      ?.message;

    if (!ticketMsg) return null;
    const match = ticketMsg.match(/Ticket creado:\s*(TKT-[A-Z0-9-]+)/i);
    return match?.[1] || null;
  }, [messages, selectedConversationId]);

  const linkedTicketNumber = useMemo(() => {
    if (!selectedConversationId) return null;
    const ticketMsg = [...messages]
      .reverse()
      .find((msg) => typeof msg.message === 'string' && msg.message.includes('Ticket creado:'))
      ?.message;

    if (!ticketMsg) return null;
    const match = ticketMsg.match(/Ticket creado:\s*(TKT-[A-Z0-9-]+)/i);
    return match?.[1] || null;
  }, [messages, selectedConversationId]);

  const isAdmin = user?.role === 'admin';
  const isAssignedToUser = selectedConversation?.assigned_user_id && selectedConversation.assigned_user_id === user?.id;
  const isConversationLocked = !!selectedConversation?.assigned_user_id && !isAssignedToUser;
  const isClosed = selectedConversation?.status === 'closed';
  const isFormConversation = selectedConversation?.source_channel === 'form';
  const linkedClientId = createdClientId || selectedConversation?.client_id || null;

  const causeOptions = [
    'Consulta general',
    'Cotización',
    'Soporte',
    'Reclamo',
    'Reservas',
    'Facturación',
    'Otro'
  ];

  const resultOptions = [
    'Resuelto',
    'Derivado a ticket',
    'Llamada programada',
    'Sin respuesta',
    'No procede'
  ];

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(lastViewedStorageKey, JSON.stringify(lastViewedMap));
  }, [lastViewedMap]);

  const scrollToBottom = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  // Always keep the latest message visible.
  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversationId, scrollToBottom]);

  const markConversationViewed = useCallback((conversationId: string, timestamp?: string | null) => {
    const value = timestamp || new Date().toISOString();
    setLastViewedMap((prev) => ({ ...prev, [conversationId]: value }));
  }, []);

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  const getSourceLabel = (conversation: WebChatConversation) => {
    if (conversation.source_channel) {
      return sourceLabels[conversation.source_channel] || conversation.source_channel;
    }
    if (conversation.source_domain) {
      return `Web (${conversation.source_domain})`;
    }
    return 'Sin origen';
  };

  const sourceLabels: Record<string, string> = {
    widget: 'Widget',
    form: 'Formulario',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    social: 'Red social'
  };

  const getSourceLabel = (conversation: WebChatConversation) => {
    if (conversation.source_channel) {
      return sourceLabels[conversation.source_channel] || conversation.source_channel;
    }
    if (conversation.source_domain) {
      return `Web (${conversation.source_domain})`;
    }
    return 'Sin origen';
  };

  const loadConversations = useCallback(async () => {
    if (loadingConversationsRef.current) return;
    loadingConversationsRef.current = true;
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from('webchat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
      <div
        className={`grid h-[72vh] gap-6 ${
          sidePanelMode ? 'grid-cols-[360px_1fr_360px]' : 'grid-cols-[360px_1fr]'
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="border-b border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, correo, teléfono o fecha..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <select
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 underline decoration-teal-200 decoration-2 underline-offset-4">
                          {conv.visitor_name || 'Visitante anónimo'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {conv.visitor_email || conv.visitor_phone || conv.source_domain || 'sin contacto'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Origen: {getSourceLabel(conv)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        conv.status === 'open'
                          ? 'bg-orange-100 text-orange-700'
                          : conv.status === 'assigned' || conv.status === 'taken'
                            ? 'bg-green-100 text-green-700'
                            : conv.status === 'resolved'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}>
                        {conv.status === 'open'
                          ? 'Abierto'
                          : conv.status === 'assigned' || conv.status === 'taken'
                            ? 'Tomado'
                            : conv.status === 'resolved'
                              ? 'Resuelto'
                              : 'Cerrado'}
                      </span>
                    </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <CauseBadge cause={conv.cause} custom={conv.cause_custom} />
                          <ResultBadge result={conv.result} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          {selectedConversation ? (
            <>
              <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante anónimo'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.visitor_email || selectedConversation.visitor_phone || selectedConversation.source_domain || 'sin contacto'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Origen: {getSourceLabel(selectedConversation)}
                    </p>
                    {(selectedConversation.cause || selectedConversation.cause_custom || selectedConversation.result) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <CauseBadge cause={selectedConversation.cause} custom={selectedConversation.cause_custom} />
                        <ResultBadge result={selectedConversation.result} />
                      </div>
                    )}
                    {isConversationLocked && (
                      <p className="mt-1 text-xs text-red-500">
                        Conversación asignada a otro usuario. Solo un administrador puede liberarla.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConversation.assigned_user_id ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Asignado a {selectedConversation.assigned_user_name || 'Agente'}
                      </span>
                    ) : (
                      <button
                        onClick={handleAssignToMe}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-white shadow-md transition hover:-translate-y-0.5"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Tomar</span>
                      </button>
                    )}
                    {isAdmin && selectedConversation.assigned_user_id && (
                      <button
                        onClick={() => handleUpdateStatus('open')}
                        disabled={isConversationLocked}
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-red-600 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        <span>Liberar</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowTransfer(true)}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isConversationLocked}
                    >
                      <Users className="h-4 w-4" />
                      <span>Transferir</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-5 py-4">
                <button
                  onClick={openEmailComposer}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </button>
                <button
                  onClick={openDialer}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <Phone className="h-4 w-4" />
                  <span>Llamar</span>
                </button>
                <button
                  onClick={handleTicketButtonClick}
                  className={
                    linkedTicketNumber && linkedTicketStatus
                      ? `flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getTicketStatusClasses(linkedTicketStatus)}`
                      : 'flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60'
                  }
                  disabled={isConversationLocked || (!linkedTicketNumber && isClosed)}
                >
                  <Ticket className="h-4 w-4" />
                  <span className="flex flex-col leading-tight">
                    <span>{linkedTicketNumber ? 'Ver Ticket' : 'Crear Ticket'}</span>
                    {linkedTicketNumber && (
                      <span className="text-[10px] font-normal text-slate-500">{linkedTicketNumber}</span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => openClientPanel()}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{createdClientId ? 'Cliente asociado' : 'Crear Cliente'}</span>
                </button>
                <button
                  onClick={handleQuoteButtonClick}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cotizar</span>
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {selectedConversation.status === 'closed' && !isConversationLocked && (
                    <button
                      onClick={() => handleUpdateStatus('open', { preserveAssignment: true })}
                      className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm transition hover:-translate-y-0.5"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Reabrir chat</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus('closed')}
                    disabled={
                      isConversationLocked ||
                      isClosed ||
                      (!!linkedTicketNumber &&
                        (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed')))
                    }
                    title={
                      linkedTicketNumber &&
                      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'))
                        ? 'No puedes cerrar el chat mientras el ticket esté abierto.'
                        : undefined
                    }
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Cerrar chat</span>
                  </button>
                </div>
              </div>

              <div
                ref={messageListRef}
                onScroll={() => {
                  const container = messageListRef.current;
                  if (!container) return;
                  const threshold = 120;
                  autoScrollRef.current =
                    container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
                }}
                className="flex-1 overflow-y-auto bg-slate-50/80 p-6"
              >
                {isConversationLocked || isClosed ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {isClosed ? 'Conversación cerrada. Reabre para ver mensajes.' : 'No tienes acceso a los mensajes de esta conversación.'}
                  </div>
                ) : loadingMessages ? (
                  <div className="text-center text-slate-500">Cargando mensajes...</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
                          (msg.sender_type === 'agent' || msg.sender_type === 'bot')
                            ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="mb-2 text-xs opacity-80">
                          {msg.sender_name || ((msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
                        </div>
                        {msg.message && <p className="text-sm whitespace-pre-line">{msg.message}</p>}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.attachments.map((att, index) => (
                              <a
                                key={`${msg.id}-att-${index}`}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 text-sm ${
                                  (msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'text-white/90' : 'text-blue-600'
                                }`}
                              >
                                <FileText className="h-4 w-4" />
                                <span>{att.filename}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/80 bg-white p-5">
                <div className="mb-3 flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <div className="text-xs text-slate-500">
                    {attachments.length > 0 ? `${attachments.length} adjunto(s)` : 'Sin adjuntos'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isConversationLocked && !isClosed) {
                          handleSendMessage();
                        }
                      }
                    }}
                    rows={2}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-50"
                    disabled={isConversationLocked || isClosed}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-3 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <Send className="h-4 w-4" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Selecciona una conversación para empezar.
            </div>
          )}
        </div>

        {sidePanelMode && selectedConversation && (
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {sidePanelMode === 'client'
                    ? 'Crear Cliente'
                    : sidePanelMode === 'client_view'
                      ? 'Ver Cliente'
                    : sidePanelMode === 'ticket_view'
                      ? 'Ver Ticket'
                      : 'Crear Ticket'}
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span>
                    {sidePanelMode === 'ticket_view' && ticketViewTicket?.ticket_number
                      ? ticketViewTicket.ticket_number
                      : selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}
                  </span>
                  {sidePanelMode === 'ticket_view' &&
                    ticketViewHasUpdates &&
                    (ticketViewTicket?.status === 'resolved' || ticketViewTicket?.status === 'closed') && (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        Actualizado
                      </span>
                    )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSidePanelMode(null);
                  setTicketViewTicket(null);
                  setTicketViewComments([]);
                  setTicketViewActivities([]);
                  setTicketViewNewComment('');
                  setTicketViewIsInternal(false);
                }}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:-translate-y-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {sidePanelMode === 'client' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="text-xs font-semibold text-slate-600">Buscar cliente existente</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="Nombre, email o teléfono"
                      />
                    </div>
                    {clientSearchLoading && (
                      <p className="mt-2 text-xs text-slate-400">Buscando...</p>
                    )}
                    {clientSearch.trim().length >= 2 && !clientSearchLoading && clientResults.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">Sin resultados</p>
                    )}
                    {clientResults.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleAssignExistingClient(client)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50"
                          >
                            <div className="font-semibold text-slate-800">{client.contact_name || 'Sin nombre'}</div>
                            <div className="text-slate-500">{client.email || client.phone || client.company_name || 'Sin contacto'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Nombre del contacto</label>
                    <input
                      value={clientDraft.contact_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, contact_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre y apellido"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Email</label>
                    <input
                      value={clientDraft.email}
                      onChange={(e) => setClientDraft({ ...clientDraft, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="correo@dominio.com"
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Teléfono</label>
                    <input
                      value={clientDraft.phone}
                      onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="+1 809 000 0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Empresa</label>
                    <input
                      value={clientDraft.company_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, company_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Estado</label>
                    <select
                      value={clientDraft.status}
                      onChange={(e) => setClientDraft({ ...clientDraft, status: e.target.value as ClientDraft['status'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="prospect">Prospecto</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              ) : sidePanelMode === 'ticket_view' ? (
                <div className="space-y-4">
                  {ticketViewLoading ? (
                    <div className="text-sm text-slate-500">Cargando ticket...</div>
                  ) : !ticketViewTicket ? (
                    <div className="text-sm text-slate-500">No hay ticket para mostrar.</div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">{ticketViewTicket.ticket_number}</div>
                            <div className="mt-1 font-semibold text-slate-900 truncate">{ticketViewTicket.subject}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTicketStatusClasses(ticketViewTicket.status)}`}>
                              {ticketViewTicket.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTicketPriorityClasses(ticketViewTicket.priority)}`}>
                              {ticketViewTicket.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600">Descripción</label>
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {ticketViewTicket.description}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600">Acciones rápidas</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed') && (
                            <button
                              type="button"
                              onClick={() => handleTicketViewUpdateStatus('open')}
                              className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                            >
                              Reabrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('in_progress')}
                            disabled={true}
                            className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            En Progreso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('waiting')}
                            disabled={true}
                            className="rounded-xl bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            En Espera
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('resolved')}
                            disabled={true}
                            className="rounded-xl bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('closed')}
                            disabled={true}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex gap-2 border-b border-slate-200">
                          <button
                            type="button"
                            onClick={() => setTicketViewTab('comments')}
                            className={`px-2 pb-2 text-xs font-semibold border-b-2 transition ${
                              ticketViewTab === 'comments'
                                ? 'text-teal-700 border-teal-600'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                            }`}
                          >
                            Comentarios ({ticketViewComments.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketViewTab('activity')}
                            className={`px-2 pb-2 text-xs font-semibold border-b-2 transition ${
                              ticketViewTab === 'activity'
                                ? 'text-teal-700 border-teal-600'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                            }`}
                          >
                            Actividad ({ticketViewActivities.length})
                          </button>
                        </div>

                        {ticketViewTab === 'comments' ? (
                          <>
                            <div className="mt-3 space-y-3 max-h-56 overflow-y-auto">
                              {ticketViewComments.length === 0 ? (
                                <div className="text-xs text-slate-500">No hay comentarios.</div>
                              ) : (
                                ticketViewComments.map((c) => (
                                  <div
                                    key={c.id}
                                    className={`rounded-2xl border p-3 text-sm ${
                                      c.is_internal
                                        ? 'border-amber-200 bg-amber-50'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-700 truncate">
                                          {c.user_name || 'Usuario'}
                                        </div>
                                        {c.user_email && <div className="text-[11px] text-slate-400 truncate">{c.user_email}</div>}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {new Date(c.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.comment}</div>
                                    {c.is_internal && (
                                      <div className="mt-2 text-[10px] font-semibold text-amber-700">Interno</div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                              <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={ticketViewIsInternal}
                                  onChange={(e) => setTicketViewIsInternal(e.target.checked)}
                                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                Comentario interno
                              </label>
                              <textarea
                                value={ticketViewNewComment}
                                onChange={(e) => setTicketViewNewComment(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleTicketViewAddComment();
                                  }
                                }}
                                disabled={ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed'}
                                rows={3}
                                placeholder="Escribe un comentario..."
                                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                              />
                              <button
                                type="button"
                                onClick={handleTicketViewAddComment}
                                disabled={ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed'}
                                className="mt-2 w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Enviar
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 space-y-3 max-h-72 overflow-y-auto">
                            {ticketViewActivities.length === 0 ? (
                              <div className="text-xs text-slate-500">No hay actividad registrada.</div>
                            ) : (
                              ticketViewActivities.map((a) => (
                                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className="text-xs font-semibold text-slate-800">{a.action}</div>
                                  {a.field_changed && (
                                    <div className="mt-1 text-xs text-slate-600">
                                      {a.field_changed}: {a.old_value} → {a.new_value}
                                    </div>
                                  )}
                                  {a.description && <div className="mt-1 text-xs text-slate-600">{a.description}</div>}
                                  <div className="mt-2 text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {createdClientId && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Cliente vinculado: {createdClientId.slice(0, 8)}...
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Asunto</label>
                    <input
                      value={ticketDraft.subject}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Asunto del ticket"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Descripción</label>
                    <textarea
                      value={ticketDraft.description}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                      rows={6}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Detalle del caso"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                    <select
                      value={ticketDraft.priority}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value as TicketDraft['priority'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {(sidePanelMode === 'client' || sidePanelMode === 'ticket') && (
              <div className="border-t border-slate-200/80 bg-white px-5 py-4">
                <button
                  onClick={sidePanelMode === 'client' ? handleSaveClient : handleSaveTicket}
                  disabled={sidePanelSaving}
                  className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sidePanelSaving ? 'Guardando...' : sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        status: 'taken',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al transferir conversación');
      return;
    }

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              assigned_user_id: targetUser.id,
              assigned_user_name: targetUser.name,
              assigned_at: new Date().toISOString(),
              status: 'taken',
              updated_at: new Date().toISOString(),
            }
          : conv
      )
    );
    toast.success(`Transferida a ${targetUser.name}`);
    setShowTransfer(false);
    setTransferQuery('');
    setTransferResults([]);
    loadConversations();
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !user?.id) return;
    if (isConversationLocked) {
      toast.error('La conversación está asignada a otro usuario');
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error('Escribe un mensaje o adjunta un archivo');
      return;
    }

    const invalidAttachment = attachments.find(
      (file) => !(file.type && (file.type.startsWith('image/') || file.type === 'application/pdf'))
    );
    if (invalidAttachment) {
      toast.error('Tipo de archivo no permitido. Solo imágenes y PDF.');
      return;
    }

    const uploadedAttachments: WebChatMessage['attachments'] = [];

    for (const file of attachments) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Adjunto supera 10MB: ${file.name}`);
        return;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `conversations/${selectedConversation.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase
        .storage
        .from('webchat-attachments')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        toast.error(uploadError.message || `Error subiendo ${file.name}`);
        return;
      }

      const { data: publicData } = supabase
        .storage
        .from('webchat-attachments')
        .getPublicUrl(path);

      uploadedAttachments.push({
        filename: file.name,
        size: file.size,
        type: file.type,
        path,
        url: publicData.publicUrl,
      });
    }

    const { error } = await supabase
      .from('webchat_messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_type: 'agent',
        sender_id: user.id,
        sender_name: user.name,
        message: messageText.trim() || null,
        attachments: uploadedAttachments,
      });

    if (error) {
      toast.error('Error al enviar mensaje');
      return;
    }

    await supabase
      .from('webchat_conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', selectedConversation.id);

    setMessageText('');
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateStatus = async (
    status: WebChatConversation['status'],
    options: { preserveAssignment?: boolean } = {}
  ) => {
    if (!selectedConversation || !user?.id) return;
    if (isConversationLocked) {
      toast.error('La conversación está asignada a otro usuario');
      return;
    }

    const ticketBlocksClose =
      status === 'closed' &&
      !!linkedTicketNumber &&
      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'));

    if (ticketBlocksClose) {
      toast.error('No puedes cerrar el chat si hay un ticket abierto. Resuelve o cierra el ticket primero.');
      return;
    }

    if (status === 'closed') {
      setShowCloseModal(true);
      return;
    }

    const updateData: Partial<WebChatConversation> & {
      assigned_user_id?: string | null;
      assigned_user_name?: string | null;
      assigned_at?: string | null;
      updated_at?: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'open') {
      if (!options.preserveAssignment) {
        updateData.assigned_user_id = null;
        updateData.assigned_user_name = null;
        updateData.assigned_at = null;
      }
    }

    if (status === 'taken' && !selectedConversation.assigned_user_id) {
      updateData.assigned_user_id = user.id;
      updateData.assigned_user_name = user.name;
      updateData.assigned_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('webchat_conversations')
      .update(updateData)
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al actualizar estado');
      return;
    }

    loadConversations();
  };

  const handleSaveConversationMeta = async () => {
    if (!selectedConversation) return;
    if (isConversationLocked) {
      toast.error('La conversación está asignada a otro usuario');
      return;
    }

    const ticketBlocksClose =
      !!linkedTicketNumber &&
      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'));
    if (ticketBlocksClose) {
      toast.error('No puedes cerrar el chat si hay un ticket abierto. Resuelve o cierra el ticket primero.');
      return;
    }

    if (!causeSelection) {
      toast.error('Selecciona una causa');
      return;
    }

    if (causeSelection === 'Otro' && !causeCustom.trim()) {
      toast.error('Ingresa la causa personalizada');
      return;
    }

    setSavingConversationMeta(true);
    const { error } = await supabase
      .from('webchat_conversations')
      .update({
        cause: causeSelection,
        cause_custom: causeSelection === 'Otro' ? causeCustom.trim() : null,
        result: resultSelection || null,
        result_notes: resultNotes || null,
        updated_at: new Date().toISOString(),
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    setSavingConversationMeta(false);
    if (error) {
      toast.error('Error al guardar la conversación');
      return;
    }

    toast.success('Conversación cerrada');
    setShowCloseModal(false);
    loadConversations();
  };

  const openClientPanel = () => {
    if (!selectedConversation) return;
    setClientDraft({
      company_name: '',
      contact_name: selectedConversation.visitor_name || '',
      email: selectedConversation.visitor_email || '',
      phone: selectedConversation.visitor_phone || '',
      status: 'prospect'
    });
    setClientSearch('');
    setClientResults([]);
    setCreatedClientId(null);
    setSidePanelMode('client');
  };

  const getTicketStatusClasses = (status: TicketRecord['status']) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'closed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTicketPriorityClasses = (priority: TicketRecord['priority']) => {
    switch (priority) {
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const openTicketPanel = useCallback(() => {
    if (!selectedConversation) return;
    const lastVisitorMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender_type === 'visitor')?.message || '';
    setTicketDraft({
      subject: `Chat web - ${selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}`,
      description: `Solicitud desde Chat Web\n\n${lastVisitorMessage}`.trim(),
      priority: 'medium',
      client_id: createdClientId || undefined
    });
    setSidePanelMode('ticket');
  }, [createdClientId, messages, selectedConversation]);

  const openLinkedTicket = useCallback((ticketNumber: string) => {
    localStorage.setItem('tickets_open_ticket_number', ticketNumber);
    setActiveModule('tickets');
  }, [setActiveModule]);

  const handleTicketButtonClick = useCallback(() => {
    if (linkedTicketNumber) {
      openLinkedTicket(linkedTicketNumber);
      return;
    }

    if (!selectedConversation) return;

    const lastVisitorMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender_type === 'visitor')?.message || '';

    localStorage.setItem('ticket_create_draft', JSON.stringify({
      client_id: createdClientId || undefined,
      subject: `Chat web - ${selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}`,
      description: `Solicitud desde Chat Web\n\n${lastVisitorMessage}`.trim(),
      priority: 'medium',
      conversation_id: selectedConversation.id,
      source_module: 'chat_web',
      source_name: selectedConversation.visitor_name || undefined,
      source_email: selectedConversation.visitor_email || undefined,
      source_phone: selectedConversation.visitor_phone || undefined
    }));

    setActiveModule('tickets');
  }, [linkedTicketNumber, openLinkedTicket, selectedConversation, messages, createdClientId, setActiveModule]);

  const handleSaveClient = async () => {
    if (!user?.id) return;
    if (!clientDraft.contact_name.trim()) {
      toast.error('El nombre del contacto es requerido');
      return;
    }
    if (!clientDraft.email.trim()) {
      toast.error('El email es requerido');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(clientDraft.email)) {
      toast.error('Email inválido');
      return;
    }
    if (clientDraft.phone && !/^[\d\s\-+()]+$/.test(clientDraft.phone)) {
      toast.error('Teléfono inválido');
      return;
    }

    setSidePanelSaving(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...clientDraft,
        created_by: user.id
      })
      .select('id')
      .single();

    setSidePanelSaving(false);
    if (error) {
      toast.error(`Error al crear: ${error.message}`);
      return;
    }

    if (selectedConversation) {
      const { error: updateError } = await supabase
        .from('webchat_conversations')
        .update({
          visitor_name: clientDraft.contact_name,
          visitor_email: clientDraft.email,
          visitor_phone: clientDraft.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedConversation.id);

      if (updateError) {
        toast.error('No se pudo actualizar el nombre en el chat');
      } else {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  visitor_name: clientDraft.contact_name,
                  visitor_email: clientDraft.email,
                  visitor_phone: clientDraft.phone || null,
                }
              : conv
          )
        );
        loadMessages(selectedConversation.id);
      }
    }

    setCreatedClientId(data?.id || null);
    toast.success('Cliente creado correctamente');
    setSidePanelMode(null);
    loadConversations();
  };

  const handleAssignExistingClient = async (client: ClientLookup) => {
    if (!selectedConversation) return;
    setCreatedClientId(client.id);
    setClientDraft({
      company_name: client.company_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      status: client.status || 'prospect'
    });

    const { error: updateError } = await supabase
      .from('webchat_conversations')
      .update({
        visitor_name: client.contact_name,
        visitor_email: client.email,
        visitor_phone: client.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    if (updateError) {
      toast.error('No se pudo asignar el cliente al chat');
      return;
    }

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              visitor_name: client.contact_name,
              visitor_email: client.email,
              visitor_phone: client.phone || null,
            }
          : conv
      )
    );
    toast.success('Cliente asignado al chat');
    loadMessages(selectedConversation.id);
    setSidePanelMode(null);
  };

  const handleSaveTicket = async () => {
    if (!selectedConversation || !user?.id) return;
    if (!ticketDraft.subject.trim()) {
      toast.error('Ingresa un asunto');
      return;
    }

    localStorage.setItem('ticket_create_draft', JSON.stringify({
      client_id: ticketDraft.client_id || undefined,
      subject: ticketDraft.subject,
      description: ticketDraft.description,
      priority: ticketDraft.priority,
      assigned_to: user.id,
      conversation_id: selectedConversation.id,
      source_module: 'chat_web',
      source_name: selectedConversation.visitor_name || undefined,
      source_email: selectedConversation.visitor_email || undefined,
      source_phone: selectedConversation.visitor_phone || undefined
    }));

    toast.success('Completá el ticket en el formulario unificado');
    setSidePanelMode(null);
    setActiveModule('tickets');
  };

  const filteredConversations = conversations.filter(conv => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return true;

    const createdAt = conv.created_at ? new Date(conv.created_at) : null;
    const lastMessageAt = conv.last_message_at ? new Date(conv.last_message_at) : null;

    const searchableText = [
      conv.visitor_name,
      conv.visitor_email,
      conv.visitor_phone,
      conv.source_domain,
      conv.source_detail,
      conv.page_url,
      conv.status,
      createdAt?.toLocaleDateString('es-ES'),
      createdAt?.toISOString().slice(0, 10),
      lastMessageAt?.toLocaleDateString('es-ES'),
      lastMessageAt?.toISOString().slice(0, 10)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(search);
  }).filter(conv => {
    if (statusFilter === 'active') return conv.status !== 'closed';
    if (statusFilter === 'all') return true;
    return conv.status === statusFilter;
  }).filter(conv => {
    if (causeFilter === 'all') return true;
    return conv.cause === causeFilter;
  });

  const unreadCount = filteredConversations.filter(conv => {
    const lastViewed = lastViewedMap[conv.id];
    if (!conv.last_message_at) return false;
    if (!lastViewed) return true;
    return new Date(conv.last_message_at).getTime() > new Date(lastViewed).getTime();
  }).length;

  const kpi = {
    total: conversations.length,
    open: conversations.filter(c => c.status === 'open').length,
    assigned: conversations.filter(c => c.status === 'assigned' || c.status === 'taken').length,
    resolved: conversations.filter(c => c.status === 'resolved' || c.result === 'Resuelto').length,
    closed: conversations.filter(c => c.status === 'closed').length,
    unassigned: conversations.filter(c => !c.assigned_user_id && c.status !== 'closed' && c.status !== 'resolved').length,
  };

  const openEmailComposer = () => {
    if (selectedConversation?.visitor_email) {
      const latestVisitorMessage = [...messages]
        .reverse()
        .find((message) => message.sender_type === 'visitor' && message.message?.trim())
        ?.message?.trim();

      const contactName = selectedConversation.visitor_name || selectedConversation.visitor_email;
      const emailSubject = `Re: Consulta desde formulario - ${contactName}`;
      const emailBody = [
        `Hola ${selectedConversation.visitor_name || ''},`,
        '',
        'Gracias por contactarnos. Te respondemos por este medio:',
        '',
        '',
        '---',
        'Datos del contacto:',
        `Nombre: ${selectedConversation.visitor_name || 'N/A'}`,
        `Email: ${selectedConversation.visitor_email}`,
        latestVisitorMessage ? `Mensaje original: ${latestVisitorMessage}` : 'Mensaje original: N/A',
      ].join('\n');

      navigateToInbox(selectedConversation.visitor_email, {
        webchatConversationId: selectedConversation.id,
        sourceChannel: selectedConversation.source_channel || undefined,
        emailSubject,
        emailBody,
      });
    } else {
      toast.error('No hay email del visitante');
    }
  };

  const openDialer = () => {
    if (selectedConversation?.visitor_phone) {
      initiateCall(selectedConversation.visitor_phone);
    } else {
      toast.error('No hay teléfono del visitante');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Chat Web</h2>
                <p className="text-slate-500">Solicitudes de chat desde dogcatify.com</p>
              </div>
            </div>
            {conversationLoadError && (
              <p className="mt-2 text-sm text-red-600">
                {conversationLoadError}
              </p>
            )}
          </div>
          <button
            onClick={loadConversations}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <RefreshCw className={`h-4 w-4 ${loadingConversations ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {sidePanelMode && selectedConversation && (
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}
                </p>
              </div>
              <button
                onClick={() => setSidePanelMode(null)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:-translate-y-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {sidePanelMode === 'client' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="text-xs font-semibold text-slate-600">Buscar cliente existente</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="Nombre, email o teléfono"
                      />
                    </div>
                    {clientSearchLoading && (
                      <p className="mt-2 text-xs text-slate-400">Buscando...</p>
                    )}
                    {clientSearch.trim().length >= 2 && !clientSearchLoading && clientResults.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">Sin resultados</p>
                    )}
                    {clientResults.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleAssignExistingClient(client)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50"
                          >
                            <div className="font-semibold text-slate-800">{client.contact_name || 'Sin nombre'}</div>
                            <div className="text-slate-500">{client.email || client.phone || client.company_name || 'Sin contacto'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Nombre del contacto</label>
                    <input
                      value={clientDraft.contact_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, contact_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre y apellido"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Email</label>
                    <input
                      value={clientDraft.email}
                      onChange={(e) => setClientDraft({ ...clientDraft, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="correo@dominio.com"
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Teléfono</label>
                    <input
                      value={clientDraft.phone}
                      onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="+1 809 000 0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Empresa</label>
                    <input
                      value={clientDraft.company_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, company_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Estado</label>
                    <select
                      value={clientDraft.status}
                      onChange={(e) => setClientDraft({ ...clientDraft, status: e.target.value as ClientDraft['status'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="prospect">Prospecto</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {createdClientId && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Cliente vinculado: {createdClientId.slice(0, 8)}...
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Asunto</label>
                    <input
                      value={ticketDraft.subject}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Asunto del ticket"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Descripción</label>
                    <textarea
                      value={ticketDraft.description}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                      rows={6}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Detalle del caso"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                    <select
                      value={ticketDraft.priority}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value as TicketDraft['priority'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/80 bg-white px-5 py-4">
              <button
                onClick={sidePanelMode === 'client' ? handleSaveClient : handleSaveTicket}
                disabled={sidePanelSaving}
                className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sidePanelSaving ? 'Guardando...' : sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <KpiCard label="Total" value={kpi.total} tone="slate" />
        <KpiCard label="Abiertos" value={kpi.open} tone="orange" />
        <KpiCard label="Tomados" value={kpi.assigned} tone="emerald" />
        <KpiCard label="Resueltos" value={kpi.resolved} tone="teal" />
        <KpiCard label="Cerrados" value={kpi.closed} tone="slate" />
        <KpiCard label="Sin asignar" value={kpi.unassigned} tone="teal" />
        <KpiCard label="No leídos" value={unreadCount} tone="indigo" />
      </div>

      <div
        className={`grid h-[72vh] gap-6 ${
          sidePanelMode ? 'grid-cols-[360px_1fr_360px]' : 'grid-cols-[360px_1fr]'
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="border-b border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, correo, teléfono o fecha..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                        value={clientDraft.phone}
                        onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="+1 809 000 0000"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Empresa</label>
                      <input
                        value={clientDraft.company_name}
                        onChange={(e) => setClientDraft({ ...clientDraft, company_name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Nombre de la empresa"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Estado</label>
                      <select
                        value={clientDraft.status}
                        onChange={(e) => setClientDraft({ ...clientDraft, status: e.target.value as ClientDraft['status'] })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="prospect">Prospecto</option>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {createdClientId && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Cliente vinculado: {createdClientId.slice(0, 8)}...
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Asunto</label>
                      <input
                        value={ticketDraft.subject}
                        onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Asunto del ticket"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Descripción</label>
                      <textarea
                        value={ticketDraft.description}
                        onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                        rows={4}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Detalle del caso"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                      <select
                        value={ticketDraft.priority}
                        onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value as TicketDraft['priority'] })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/80 bg-white px-5 py-4">
                <button
                  onClick={sidePanelMode === 'client' ? handleSaveClient : handleSaveTicket}
                  disabled={sidePanelSaving}
                  className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sidePanelSaving ? 'Guardando...' : sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
                </button>
              </div>
            </div>
          )}

          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            {selectedConversation ? (
              <>
                <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante anónimo'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {selectedConversation.visitor_email || selectedConversation.visitor_phone || selectedConversation.source_domain || 'sin contacto'}
                      </p>
                      {(selectedConversation.cause || selectedConversation.cause_custom || selectedConversation.result) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <CauseBadge cause={selectedConversation.cause} custom={selectedConversation.cause_custom} />
                          <ResultBadge result={selectedConversation.result} />
                        </div>
                      )}
                      {isConversationLocked && (
                        <p className="mt-1 text-xs text-red-500">
                          Conversación asignada a otro usuario. Solo un administrador puede liberarla.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedConversation.assigned_user_id ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          Asignado a {selectedConversation.assigned_user_name || 'Agente'}
                        </span>
                      ) : (
                        <button
                          onClick={handleAssignToMe}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-white shadow-md transition hover:-translate-y-0.5"
                        >
                          <UserCheck className="h-4 w-4" />
                          <span>Tomar</span>
                        </button>
                      )}
                      {isAdmin && selectedConversation.assigned_user_id && (
                        <button
                          onClick={() => handleUpdateStatus('open')}
                          disabled={isConversationLocked}
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-red-600 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          <span>Liberar</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowTransfer(true)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isConversationLocked}
                      >
                        <Users className="h-4 w-4" />
                        <span>Transferir</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-5 py-4">
                  <button
                    onClick={openEmailComposer}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </button>
                  <button
                    onClick={openDialer}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <Phone className="h-4 w-4" />
                    <span>Llamar</span>
                  </button>
                  <button
                    onClick={openTicketPanel}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <Ticket className="h-4 w-4" />
                    <span>Crear Ticket</span>
                  </button>
                  <button
                    onClick={openClientPanel}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isConversationLocked || isClosed}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{createdClientId ? 'Cliente asociado' : 'Crear Cliente'}</span>
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    {selectedConversation.status === 'closed' && !isConversationLocked && (
                      <button
                        onClick={() => handleUpdateStatus('open', { preserveAssignment: true })}
                        className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm transition hover:-translate-y-0.5"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Reabrir chat</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus('closed')}
                      disabled={
                        isConversationLocked ||
                        isClosed ||
                        (!!linkedTicketNumber &&
                          (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed')))
                      }
                      title={
                        linkedTicketNumber &&
                        (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'))
                          ? 'No puedes cerrar el chat mientras el ticket esté abierto.'
                          : undefined
                      }
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Cerrar chat</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/80 p-6">
                  {isConversationLocked || isClosed ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      {isClosed ? 'Conversación cerrada. Reabre para ver mensajes.' : 'No tienes acceso a los mensajes de esta conversación.'}
                    </div>
                  ) : loadingMessages ? (
                    <div className="text-center text-slate-500">Cargando mensajes...</div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
                            (msg.sender_type === 'agent' || msg.sender_type === 'bot')
                              ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                              : 'bg-white text-slate-800 border border-slate-200'
                          }`}
                        >
                          <div className="mb-2 text-xs opacity-80">
                            {msg.sender_name || ((msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
                          </div>
                          {msg.message && <p className="text-sm whitespace-pre-line">{msg.message}</p>}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((att, index) => (
                                <a
                                  key={`${msg.id}-att-${index}`}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 text-sm ${
                                    (msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'text-white/90' : 'text-blue-600'
                                  }`}
                                >
                                  <FileText className="h-4 w-4" />
                                  <span>{att.filename}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/80 bg-white p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isConversationLocked || isClosed}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <div className="text-xs text-slate-500">
                      {attachments.length > 0 ? `${attachments.length} adjunto(s)` : 'Sin adjuntos'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isConversationLocked && !isClosed) {
                            handleSendMessage();
                          }
                        }
                      }}
                      rows={2}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-50"
                      disabled={isConversationLocked || isClosed}
                    />
                    <button
                      onClick={handleSendMessage}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-3 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isConversationLocked || isClosed}
                    >
                      <Send className="h-4 w-4" />
                      <span>Enviar</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Selecciona una conversación para empezar.
              </div>
            )}
          </div>
        </div>

        {sidePanelMode && selectedConversation && (
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}
                </p>
              </div>
              <button
                onClick={() => setSidePanelMode(null)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:-translate-y-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {sidePanelMode === 'client' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Buscar cliente existente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        placeholder="Nombre, email, teléfono o empresa"
                      />
                    </div>
                    {clientSearchLoading ? (
                      <p className="text-xs text-slate-500">Buscando...</p>
                    ) : clientSearch.trim().length >= 2 ? (
                      clientResults.length > 0 ? (
                        <div className="space-y-2">
                          {clientResults.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => handleAssignExistingClient(client)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-800">{client.contact_name || client.company_name || 'Cliente'}</p>
                                  <p className="text-xs text-slate-500">{client.email || client.phone || 'Sin contacto'}</p>
                                </div>
                                <span className="text-[10px] uppercase text-slate-400">{client.status}</span>
                              </div>
                              {client.company_name && (
                                <p className="text-xs text-slate-500 mt-1">{client.company_name}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Sin resultados</p>
                      )
                    ) : (
                      <p className="text-xs text-slate-400">Escribe al menos 2 caracteres.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Nombre del contacto</label>
                    <input
                      value={clientDraft.contact_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, contact_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre y apellido"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Email</label>
                    <input
                      value={clientDraft.email}
                      onChange={(e) => setClientDraft({ ...clientDraft, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="correo@dominio.com"
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Teléfono</label>
                    <input
                      value={clientDraft.phone}
                      onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="+1 809 000 0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Empresa</label>
                    <input
                      value={clientDraft.company_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, company_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Estado</label>
                    <select
                      value={clientDraft.status}
                      onChange={(e) => setClientDraft({ ...clientDraft, status: e.target.value as ClientDraft['status'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="prospect">Prospecto</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {createdClientId && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Cliente vinculado: {createdClientId.slice(0, 8)}...
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Asunto</label>
                    <input
                      value={ticketDraft.subject}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Asunto del ticket"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Descripción</label>
                    <textarea
                      value={ticketDraft.description}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                      rows={6}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Detalle del caso"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                    <select
                      value={ticketDraft.priority}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value as TicketDraft['priority'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/80 bg-white px-5 py-4">
              <button
                onClick={sidePanelMode === 'client' ? handleSaveClient : handleSaveTicket}
                disabled={sidePanelSaving}
                className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sidePanelSaving ? 'Guardando...' : sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showTransfer && selectedConversation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transferir conversación</h3>
              <button onClick={() => setShowTransfer(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-4">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={transferQuery}
                onChange={(e) => handleTransferSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transferResults.length === 0 ? (
                <p className="text-sm text-slate-500">Sin resultados</p>
              ) : (
                transferResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleTransferTo(u)}
                    className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showCloseModal && selectedConversation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Cerrar conversación</h3>
                <p className="text-sm text-slate-500">Completa la causa y el resultado para cerrar el chat.</p>
              </div>
              <button onClick={() => setShowCloseModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Causa</label>
                <select
                  value={causeSelection}
                  onChange={(e) => setCauseSelection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Selecciona una causa</option>
                  {causeOptions.map((cause) => (
                    <option key={cause} value={cause}>{cause}</option>
                  ))}
                </select>
                {causeSelection === 'Otro' && (
                  <input
                    type="text"
                    value={causeCustom}
                    onChange={(e) => setCauseCustom(e.target.value)}
                    placeholder="Describe la causa"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Resultado</label>
                <select
                  value={resultSelection}
                  onChange={(e) => setResultSelection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Selecciona un resultado</option>
                  {resultOptions.map((result) => (
                    <option key={result} value={result}>{result}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-700">Notas del resultado (opcional)</label>
              <textarea
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConversationMeta}
                disabled={savingConversationMeta}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-2 text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingConversationMeta ? 'Guardando...' : 'Cerrar conversación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'orange' | 'emerald' | 'teal' | 'indigo' }) {
  const toneClasses = {
    slate: 'from-slate-600 to-slate-500',
    orange: 'from-orange-500 to-amber-500',
    emerald: 'from-emerald-500 to-teal-500',
    teal: 'from-teal-500 to-emerald-600',
    indigo: 'from-indigo-500 to-purple-500'
  };

  return (
    <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-xl bg-gradient-to-r ${toneClasses[tone]} px-3 py-1 text-xs font-semibold text-white`}>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function CauseBadge({ cause, custom }: { cause?: string | null; custom?: string | null }) {
  const label = cause === 'Otro' ? custom : cause;
  if (!label) return null;

  const meta: Record<string, { icon: ComponentType<{ className?: string }>; className: string }> = {
    'Consulta general': { icon: MessageCircle, className: 'bg-slate-100 text-slate-600' },
    'Cotización': { icon: Mail, className: 'bg-blue-100 text-blue-700' },
    'Soporte': { icon: Ticket, className: 'bg-amber-100 text-amber-700' },
    'Reclamo': { icon: X, className: 'bg-red-100 text-red-700' },
    'Reservas': { icon: Phone, className: 'bg-teal-100 text-teal-700' },
    'Facturación': { icon: FileText, className: 'bg-purple-100 text-purple-700' },
    'Otro': { icon: Tag, className: 'bg-slate-100 text-slate-600' },
  };

  const config = meta[cause || 'Otro'] || meta['Otro'];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${config.className}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}

function ResultBadge({ result }: { result?: string | null }) {
  if (!result) return null;

  const meta: Record<string, { icon: ComponentType<{ className?: string }>; className: string }> = {
    'Resuelto': { icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700' },
    'Derivado a ticket': { icon: Ticket, className: 'bg-blue-100 text-blue-700' },
    'Llamada programada': { icon: Phone, className: 'bg-teal-100 text-teal-700' },
    'Sin respuesta': { icon: Clock, className: 'bg-amber-100 text-amber-700' },
    'No procede': { icon: X, className: 'bg-slate-100 text-slate-600' },
  };

  const config = meta[result] || { icon: Tag, className: 'bg-slate-100 text-slate-600' };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${config.className}`}>
      <Icon className="h-3 w-3" />
      <span>{result}</span>
    </span>
  );
}

*/

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle,
  UserCheck,
  Users,
  Phone,
  Mail,
  Ticket,
  Tag,
  CheckCircle,
  Clock,
  Send,
  Paperclip,
  Search,
  X,
  RefreshCw,
  UserPlus,
  FileText,
  ShoppingCart,
  Globe,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getEnvVar } from '../../lib/envLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDialer } from '../../contexts/DialerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { searchUsers } from '../../lib/userService';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { externalAuth } from '../../lib/externalAuth';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { recordClientInteractionSafely } from '../../lib/clientInteractionLogger';
import { PageHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

interface WebChatConversation {
  id: string;
  session_id: string;
  source_domain: string | null;
  source_channel?: string | null;
  source_detail?: string | null;
  page_url: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  visitor_id: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  status: 'open' | 'assigned' | 'taken' | 'resolved' | 'closed';
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_at: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  cause?: string | null;
  cause_custom?: string | null;
  result?: string | null;
  result_notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface WebChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'agent' | 'bot' | 'system';
  sender_id: string | null;
  sender_name: string | null;
  message: string | null;
  attachments: Array<{ filename: string; size: number; type: string; path?: string; url?: string }>;
  created_at: string;
}

interface TicketDraft {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client_id?: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  client_id: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  assigned_user?: { id: string; full_name: string | null; email: string | null } | null;
  created_by: string | null;
  created_at: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

interface ClientDraft {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'prospect' | 'active' | 'inactive';
}

interface ClientLookup {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'prospect' | 'active' | 'inactive';
}

export function WebChatModule() {
  const { user } = useAuth();
  const toast = useToast();
  const { initiateCall } = useDialer();
  const { setActiveModule } = useNavigation();

  const [conversations, setConversations] = useState<WebChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [channelFilter, setChannelFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferResults, setTransferResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [sidePanelMode, setSidePanelMode] = useState<'client' | 'client_view' | 'ticket' | 'ticket_view' | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientLookup[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientDraft>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    status: 'prospect'
  });
  const [ticketDraft, setTicketDraft] = useState<TicketDraft>({
    subject: '',
    description: '',
    priority: 'medium'
  });
  const [ticketViewLoading, setTicketViewLoading] = useState(false);
  const [ticketViewTicket, setTicketViewTicket] = useState<TicketRecord | null>(null);
  const [ticketViewComments, setTicketViewComments] = useState<TicketComment[]>([]);
  const [ticketViewActivities, setTicketViewActivities] = useState<TicketActivity[]>([]);
  const [ticketViewTab, setTicketViewTab] = useState<'comments' | 'activity'>('comments');
  const [ticketViewNewComment, setTicketViewNewComment] = useState('');
  const [ticketViewIsInternal, setTicketViewIsInternal] = useState(false);
  const [ticketViewHasUpdates, setTicketViewHasUpdates] = useState(false);
  const ticketViewStatusRef = useRef<TicketRecord['status'] | null>(null);
  const [sidePanelSaving, setSidePanelSaving] = useState(false);
  const [linkedTicketStatus, setLinkedTicketStatus] = useState<TicketRecord['status'] | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [clientViewLoading, setClientViewLoading] = useState(false);
  const [clientViewClient, setClientViewClient] = useState<ClientLookup | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const conversationsReloadTimerRef = useRef<number | null>(null);
  const skipAutoSelectOnceRef = useRef(false);
  const lastConvoErrorRef = useRef<number>(0);
  const loadingConversationsRef = useRef(false);
  const lastViewedStorageKey = 'crm_webchat_last_viewed';
  const linkedClientStorageKey = 'crm_webchat_linked_client';
  const [lastViewedMap, setLastViewedMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(lastViewedStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [linkedClientMap, setLinkedClientMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(linkedClientStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const selectedConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<WebChatConversation[]>([]);
  const lastNotifyRef = useRef<Record<string, number>>({});
  const [causeFilter, setCauseFilter] = useState('all');
  const [causeSelection, setCauseSelection] = useState('');
  const [causeCustom, setCauseCustom] = useState('');
  const [resultSelection, setResultSelection] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [savingConversationMeta, setSavingConversationMeta] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'chat' | 'details'>('list');

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const linkedTicketNumber = useMemo(() => {
    if (!selectedConversationId) return null;
    const ticketMsg = [...messages]
      .reverse()
      .find((msg) => typeof msg.message === 'string' && msg.message.includes('Ticket creado:'))
      ?.message;

    if (!ticketMsg) return null;
    const match = ticketMsg.match(/Ticket creado:\s*(TKT-[A-Z0-9-]+)/i);
    return match?.[1] || null;
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (!linkedTicketNumber) {
      setLinkedTicketStatus(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('status')
        .eq('ticket_number', linkedTicketNumber)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.status) {
        setLinkedTicketStatus(null);
        return;
      }
      setLinkedTicketStatus(data.status as TicketRecord['status']);
    })();

    return () => {
      cancelled = true;
    };
  }, [linkedTicketNumber]);

  useEffect(() => {
    ticketViewStatusRef.current = ticketViewTicket?.status ?? null;
  }, [ticketViewTicket?.status]);

  const isAdmin = user?.role === 'admin';
  const isAssignedToUser = selectedConversation?.assigned_user_id && selectedConversation.assigned_user_id === user?.id;
  const isConversationLocked = !!selectedConversation?.assigned_user_id && !isAssignedToUser;
  const isClosed = selectedConversation?.status === 'closed';
  const isFormConversation = selectedConversation?.source_channel === 'form';
  const linkedClientId = createdClientId || selectedConversation?.client_id || null;

  useEffect(() => {
    const rawFocus = localStorage.getItem('webchat_focus_client');
    if (!rawFocus) return;

    try {
      const focus = JSON.parse(rawFocus) as { company_name?: string; contact_name?: string; email?: string; phone?: string };
      const search = [focus.company_name, focus.contact_name, focus.email, focus.phone]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (search) {
        setSearchQuery(search);
        setStatusFilter('all');
      }
    } catch {
      // ignore malformed focus payloads
    } finally {
      localStorage.removeItem('webchat_focus_client');
    }
  }, []);

  const latestVisitorMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find((message) => message.sender_type === 'visitor' && message.message?.trim())
      ?.message?.trim() || '';
  }, [messages]);

  const initialVisitorMessage = useMemo(() => {
    return messages
      .find((message) => message.sender_type === 'visitor' && message.message?.trim())
      ?.message?.trim() || '';
  }, [messages]);

  const buildFormEmailPrefill = useCallback(() => {
    if (!selectedConversation) return { subject: '', body: '' };

    const contactName = selectedConversation.visitor_name || selectedConversation.visitor_email || 'Contacto';
    const subject = `Re: Consulta desde formulario - ${contactName}`;
    const originalFormData = initialVisitorMessage || latestVisitorMessage;
    const body = [
      `Hola ${selectedConversation.visitor_name || ''},`,
      '',
      'Gracias por contactarnos. Te respondemos por este medio:',
      '',
      '',
      '---',
      'Datos del contacto:',
      `Nombre: ${selectedConversation.visitor_name || 'N/A'}`,
      `Email: ${selectedConversation.visitor_email || 'N/A'}`,
      selectedConversation.visitor_phone ? `Teléfono: ${selectedConversation.visitor_phone}` : 'Teléfono: N/A',
      selectedConversation.source_domain ? `Dominio: ${selectedConversation.source_domain}` : 'Dominio: N/A',
      selectedConversation.source_detail ? `Origen: ${selectedConversation.source_detail}` : 'Origen: N/A',
      selectedConversation.page_url ? `Página: ${selectedConversation.page_url}` : 'Página: N/A',
      '',
      'Datos recibidos del formulario:',
      originalFormData || 'N/A',
    ].join('\n');

    return { subject, body };
  }, [initialVisitorMessage, latestVisitorMessage, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) {
      setEmailComposerOpen(false);
      setEmailSubject('');
      setEmailBody('');
      return;
    }

    setEmailComposerOpen(false);
    setEmailSubject('');
    setEmailBody('');
  }, [selectedConversation?.id]);

  const inferSenderType = useCallback((row: any): WebChatMessage['sender_type'] => {
    const base = String(row?.sender_type ?? '').trim().toLowerCase();
    if (base === 'agent' || base === 'bot' || base === 'system' || base === 'visitor') return base as any;

    return 'visitor';
  }, []);

  const inferLegacySenderTypeForDisplay = useCallback((row: any): WebChatMessage['sender_type'] => {
    const base = String(row?.sender_type ?? '').trim().toLowerCase();
    if (base && base !== 'visitor') return (base as any);

    const senderName = String(row?.sender_name ?? '').trim().toLowerCase();
    const text = String(row?.message ?? '').trim().toLowerCase();

    if (senderName.includes('dotty')) return 'bot';

    // Recover common bot/system phrases that older payloads stored as visitor.
    if (text.startsWith('¡hola! soy dotty') || text.includes('soy dotty') || text.includes('asistente virtual')) {
      return 'bot';
    }
    if (text.includes('estamos contactando a un agente disponible') || text.includes('la conversación ha finalizado')) {
      return 'system';
    }

    return inferSenderType(row);
  }, [inferSenderType]);

  const scrollToBottom = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  // Always keep the latest message visible (matches widget behavior).
  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversationId, scrollToBottom]);

  const causeOptions = [
    'Consulta general',
    'Cotización',
    'Soporte',
    'Reclamo',
    'Reservas',
    'Facturación',
    'Otro'
  ];

  const resultOptions = [
    'Resuelto',
    'Derivado a ticket',
    'Llamada programada',
    'Sin respuesta',
    'No procede'
  ];

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(lastViewedStorageKey, JSON.stringify(lastViewedMap));
  }, [lastViewedMap]);

  useEffect(() => {
    localStorage.setItem(linkedClientStorageKey, JSON.stringify(linkedClientMap));
  }, [linkedClientMap]);

  useEffect(() => {
    if (!selectedConversationId) {
      setCreatedClientId(null);
      return;
    }
    setCreatedClientId(linkedClientMap[selectedConversationId] || null);
  }, [linkedClientMap, selectedConversationId]);

  const markConversationViewed = useCallback((conversationId: string, timestamp?: string | null) => {
    const value = timestamp || new Date().toISOString();
    setLastViewedMap((prev) => ({ ...prev, [conversationId]: value }));
  }, []);

  const loadConversations = useCallback(async () => {
    if (loadingConversationsRef.current) return;
    loadingConversationsRef.current = true;
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from('webchat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (error) {
      setConversationLoadError(error.message || 'Error al cargar conversaciones');
      const now = Date.now();
      if (now - lastConvoErrorRef.current > 5000) {
        toast.error('Error al cargar conversaciones');
        lastConvoErrorRef.current = now;
      }
      setLoadingConversations(false);
      loadingConversationsRef.current = false;
      return;
    }

    setConversations(data || []);
    setConversationLoadError(null);
    if (!selectedConversationId && data && data.length > 0) {
      if (skipAutoSelectOnceRef.current) {
        skipAutoSelectOnceRef.current = false;
      } else {
        setSelectedConversationId(data[0].id);
      }
    }
    setLoadingConversations(false);
    loadingConversationsRef.current = false;
  }, [selectedConversationId, toast]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('webchat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Error al cargar mensajes');
      setLoadingMessages(false);
      return;
    }

    const normalized = (data || []).map((row: any) => ({
      ...row,
      sender_type: inferLegacySenderTypeForDisplay(row),
    }));
    setMessages(normalized as WebChatMessage[]);
    setLoadingMessages(false);
  }, [inferLegacySenderTypeForDisplay, toast]);

  const scheduleLoadConversations = useCallback(() => {
    if (conversationsReloadTimerRef.current) {
      window.clearTimeout(conversationsReloadTimerRef.current);
    }
    conversationsReloadTimerRef.current = window.setTimeout(() => {
      conversationsReloadTimerRef.current = null;
      loadConversations();
    }, 250);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (!selectedConversation?.last_message_at) return;
    markConversationViewed(selectedConversationId, selectedConversation.last_message_at);
  }, [markConversationViewed, selectedConversation?.last_message_at, selectedConversationId]);

  useEffect(() => {
    const channel = supabase
      .channel('webchat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webchat_messages' },
        (payload) => {
          const newMessage = payload.new as WebChatMessage | null;
          if (!newMessage) return;

          const effectiveSenderType = inferLegacySenderTypeForDisplay(newMessage);

          const conversationId = newMessage.conversation_id;
          const isActive = conversationId === selectedConversationIdRef.current && !document.hidden;

          if (isActive) {
            markConversationViewed(conversationId, newMessage.created_at);
            loadMessages(conversationId);
          } else if (effectiveSenderType === 'visitor') {
            const lastNotified = lastNotifyRef.current[conversationId] || 0;
            const now = Date.now();
            if (now - lastNotified > 5000) {
              const conv = conversationsRef.current.find((c) => c.id === conversationId);
              toast.info(`Nuevo mensaje de ${conv?.visitor_name || 'Visitante'}`);
              lastNotifyRef.current[conversationId] = now;
            }
          }

          scheduleLoadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [inferLegacySenderTypeForDisplay, loadMessages, markConversationViewed, scheduleLoadConversations, toast]);

  useEffect(() => {
    return () => {
      if (conversationsReloadTimerRef.current) {
        window.clearTimeout(conversationsReloadTimerRef.current);
        conversationsReloadTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('webchat-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webchat_conversations' },
        (payload) => {
          const updated = payload.new as WebChatConversation | null;
          if (!updated) return;

          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (exists) {
              return prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
            }
            return [updated, ...prev];
          });

          if (selectedConversationIdRef.current === updated.id) {
            if (updated.last_message_at && !document.hidden) {
              markConversationViewed(updated.id, updated.last_message_at);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [markConversationViewed]);

  const searchClients = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setClientResults([]);
      return;
    }
    setClientSearchLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, contact_name, email, phone, status')
      .or(
        `contact_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company_name.ilike.%${term}%`
      )
      .limit(6);

    setClientSearchLoading(false);
    if (error) {
      console.warn('[WEBCHAT] Error buscando clientes', error);
      setClientResults([]);
      return;
    }
    setClientResults((data || []) as ClientLookup[]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(clientSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch, searchClients]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (!selectedConversation?.assigned_user_id) {
      setMessages([]);
      return;
    }
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversation?.assigned_user_id, selectedConversationId]);

  const syncQueuedTranscript = useCallback(async (sessionId: string, conversationId: string) => {
    const { data: queued, error: queueError } = await supabase
      .from('webchat_message_queue')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (queueError) {
      console.warn('[WEBCHAT] Error cargando cola', queueError);
      return;
    }

    if (!queued || queued.length === 0) return;

    const mapSenderType = (value: unknown, senderNameValue: unknown): 'visitor' | 'agent' | 'system' => {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (normalized === 'bot') return 'agent';
      if (normalized === 'visitor') {
        const name = String(senderNameValue ?? '').trim().toLowerCase();
        if (name === 'dotty' || name.includes('dotty')) return 'agent';
      }
      if (normalized === 'agent' || normalized === 'system' || normalized === 'visitor') return normalized as any;
      return 'visitor';
    };

    const insertPayload = queued.map((row: any) => ({
      conversation_id: conversationId,
      sender_type: mapSenderType(row.sender_type, row.sender_name),
      sender_id: sessionId,
      sender_name: row.sender_name || null,
      message: row.message || null,
      attachments: [],
      created_at: row.created_at || new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('webchat_messages')
      .insert(insertPayload);

    if (insertError) {
      console.warn('[WEBCHAT] Error sincronizando cola', insertError);
      return;
    }

    const { error: deleteError } = await supabase
      .from('webchat_message_queue')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.warn('[WEBCHAT] Error limpiando cola', deleteError);
    }
  }, []);

  const handleAssignToMe = async () => {
    if (!selectedConversation || !user?.id) return;
    if (selectedConversation.assigned_user_id && !isAdmin) {
      toast.error('Esta conversación ya está asignada');
      return;
    }

    const { error } = await supabase
      .from('webchat_conversations')
      .update({
        assigned_user_id: user.id,
        assigned_user_name: user.name,
        assigned_at: new Date().toISOString(),
        status: 'taken',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al asignar conversación');
      return;
    }

    await syncQueuedTranscript(selectedConversation.session_id, selectedConversation.id);

    toast.success('Conversación asignada');
    loadConversations();
    loadMessages(selectedConversation.id);
  };

  const handleTransferSearch = async (query: string) => {
    setTransferQuery(query);
    if (query.trim().length < 2) {
      setTransferResults([]);
      return;
    }

    const results = await searchUsers(query, 10, 0);
    setTransferResults(results.map(u => ({ id: u.id, name: u.name, email: u.email })));
  };

  const handleTransferTo = async (targetUser: { id: string; name: string; email: string }) => {
    if (!selectedConversation) return;
    if (!isAdmin && selectedConversation.assigned_user_id && selectedConversation.assigned_user_id !== user?.id) {
      toast.error('No tienes permisos para transferir esta conversación');
      return;
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('webchat_conversations')
      .update({
        assigned_user_id: targetUser.id,
        assigned_user_name: targetUser.name,
        assigned_at: nowIso,
        status: 'taken',
        updated_at: nowIso,
      })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al transferir conversación');
      return;
    }

    toast.success(`Transferida a ${targetUser.name}`);

    // Optimistic local update so the current agent gets locked immediately.
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              assigned_user_id: targetUser.id,
              assigned_user_name: targetUser.name,
              assigned_at: nowIso,
              status: 'taken',
              updated_at: nowIso,
            }
          : conv
      )
    );

    setShowTransfer(false);
    setTransferQuery('');
    setTransferResults([]);
    loadConversations();
  };

  const handleUpdateStatus = async (
    status: 'open' | 'closed',
    options: { preserveAssignment?: boolean } = {}
  ) => {
    if (!selectedConversation) return;
    if (isConversationLocked && status === 'open' && !isAdmin) {
      toast.error('No tienes permisos para liberar esta conversación');
      return;
    }

    const ticketBlocksClose =
      status === 'closed' &&
      !!linkedTicketNumber &&
      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'));
    if (ticketBlocksClose) {
      toast.error('No puedes cerrar el chat si hay un ticket abierto. Resuelve o cierra el ticket primero.');
      return;
    }

    const updates: Partial<WebChatConversation> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'closed') {
      updates.closed_at = new Date().toISOString();
    } else {
      updates.closed_at = null;
      if (!options.preserveAssignment) {
        updates.assigned_user_id = null;
        updates.assigned_user_name = null;
        updates.assigned_at = null;
      }
    }

    const { error } = await supabase
      .from('webchat_conversations')
      .update(updates)
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al actualizar estado');
      return;
    }

    loadConversations();
  };

  const handleSaveConversationMeta = async () => {
    if (!selectedConversation) return;
    if (isConversationLocked) {
      toast.error('La conversación está asignada a otro usuario');
      return;
    }

    const ticketBlocksClose =
      !!linkedTicketNumber &&
      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'));
    if (ticketBlocksClose) {
      toast.error('No puedes cerrar el chat si hay un ticket abierto. Resuelve o cierra el ticket primero.');
      return;
    }

    if (!causeSelection) {
      toast.error('Selecciona una causa');
      return;
    }

    if (causeSelection === 'Otro' && !causeCustom.trim()) {
      toast.error('Ingresa la causa personalizada');
      return;
    }

    setSavingConversationMeta(true);
    const { error } = await supabase
      .from('webchat_conversations')
      .update({
        cause: causeSelection,
        cause_custom: causeSelection === 'Otro' ? causeCustom.trim() : null,
        result: resultSelection || null,
        result_notes: resultNotes || null,
        updated_at: new Date().toISOString(),
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    setSavingConversationMeta(false);
    if (error) {
      toast.error('Error al guardar la conversación');
      return;
    }

    toast.success('Conversación cerrada');
    setShowCloseModal(false);

    // After closing, clear the current history selection.
    skipAutoSelectOnceRef.current = true;
    setSelectedConversationId(null);
    setMessages([]);
    setMessageText('');
    setAttachments([]);
    setSidePanelMode(null);
    setMobileTab('list');
    setCauseSelection('');
    setCauseCustom('');
    setResultSelection('');
    setResultNotes('');
    loadConversations();
  };

  const openEmailComposer = () => {
    if (!selectedConversation?.visitor_email) {
      toast.error('No hay email del visitante');
      return;
    }

    if (selectedConversation.source_channel === 'form') {
      if (!selectedConversation.assigned_user_id) {
        toast.info('Primero toma el chat para preparar la respuesta por email.');
        return;
      }
      const prefill = buildFormEmailPrefill();
      setEmailSubject(prefill.subject);
      setEmailBody(prefill.body);
      setEmailComposerOpen(true);
      return;
    }

    if (!emailSubject.trim()) {
      const contactName = selectedConversation.visitor_name || selectedConversation.visitor_email || 'Contacto';
      setEmailSubject(`Re: Consulta de ${contactName}`);
    }
    setEmailComposerOpen(true);
  };

  const openDialer = () => {
    if (selectedConversation?.visitor_phone) {
      initiateCall(selectedConversation.visitor_phone);
    } else {
      toast.error('No hay teléfono del visitante');
    }
  };

  const openClientPanel = (options?: { forceChange?: boolean }) => {
    if (!selectedConversation) return;

    const hasLinkedClient = !!(selectedConversationId && linkedClientMap[selectedConversationId]);
    if (hasLinkedClient && !options?.forceChange) {
      setSidePanelMode('client_view');
      return;
    }

    setClientDraft({
      company_name: '',
      contact_name: selectedConversation.visitor_name || '',
      email: selectedConversation.visitor_email || '',
      phone: selectedConversation.visitor_phone || '',
      status: 'prospect'
    });
    setClientSearch('');
    setClientResults([]);
    setSidePanelMode('client');
    setMobileTab('details');
  };

  useEffect(() => {
    if (sidePanelMode !== 'client_view') return;
    if (!createdClientId) {
      setClientViewClient(null);
      setClientViewLoading(false);
      return;
    }

    let cancelled = false;
    setClientViewLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, email, phone, status')
        .eq('id', createdClientId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setClientViewClient(null);
        setClientViewLoading(false);
        toast.error('No se pudo cargar el cliente');
        return;
      }

      setClientViewClient(data as ClientLookup);
      setClientViewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [createdClientId, sidePanelMode, toast]);

  const getTicketStatusClasses = (status: TicketRecord['status']) => {
    switch (status) {
      case 'open':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
      case 'in_progress':
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30';
      case 'waiting':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30';
      case 'closed':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600';
    }
  };

  const getTicketPriorityClasses = (priority: TicketRecord['priority']) => {
    switch (priority) {
      case 'low':
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30';
      case 'urgent':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600';
    }
  };

  const openTicketPanel = () => {
    if (!selectedConversation) return;
    const lastVisitorMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender_type === 'visitor')?.message || '';
    setTicketDraft({
      subject: `Chat web - ${selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}`,
      description: `Solicitud desde Chat Web\n\n${lastVisitorMessage}`.trim(),
      priority: 'medium',
      client_id: createdClientId || undefined
    });
    setSidePanelMode('ticket');
    setMobileTab('details');
  };

  const loadTicketView = useCallback(async (ticketNumber: string) => {
    const normalizedTicketNumber = (ticketNumber.match(/(TKT-[A-Z0-9-]+)/i)?.[1] || ticketNumber).trim();
    setTicketViewLoading(true);
    setTicketViewTicket(null);
    setTicketViewComments([]);
    setTicketViewActivities([]);
    setTicketViewTab('comments');

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, ticket_number, client_id, subject, description, status, priority, assigned_to, created_by, created_at')
      .eq('ticket_number', normalizedTicketNumber)
      .maybeSingle();

    if (ticketError || !ticket) {
      setTicketViewLoading(false);
      toast.error('No se encontró el ticket');
      return;
    }

    const [{ data: comments }, { data: activities }, { data: assignedUser }] = await Promise.all([
      supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('ticket_activity')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true }),
      ticket.assigned_to
        ? supabase
            .from('system_users')
            .select('id, full_name, email')
            .eq('id', ticket.assigned_to)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    setTicketViewTicket({
      ...(ticket as any),
      assigned_user: (assignedUser as any) || null,
    });
    setTicketViewComments((comments as TicketComment[]) || []);
    setTicketViewActivities((activities as TicketActivity[]) || []);
    setTicketViewLoading(false);
  }, [toast]);

  const openTicketViewPanel = useCallback((ticketNumber: string) => {
    setSidePanelMode('ticket_view');
    setTicketViewHasUpdates(false);
    void loadTicketView(ticketNumber);
  }, [loadTicketView]);

  // If the panel is opened without going through openTicketViewPanel (duplicate UI paths),
  // ensure we still load the linked ticket.
  useEffect(() => {
    if (sidePanelMode !== 'ticket_view') return;
    if (ticketViewLoading) return;
    if (ticketViewTicket) return;
    if (!linkedTicketNumber) return;
    void loadTicketView(linkedTicketNumber);
  }, [linkedTicketNumber, loadTicketView, sidePanelMode, ticketViewLoading, ticketViewTicket]);

  const refreshTicketView = useCallback(async () => {
    if (!ticketViewTicket?.ticket_number) return;
    await loadTicketView(ticketViewTicket.ticket_number);
  }, [loadTicketView, ticketViewTicket?.ticket_number]);

  useEffect(() => {
    if (sidePanelMode !== 'ticket_view') return;
    if (!ticketViewTicket?.id) return;

    const ticketId = ticketViewTicket.id;

    const channel = supabase
      .channel(`webchat-ticket-view-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` },
        () => {
          void refreshTicketView();
          const status = ticketViewStatusRef.current;
          if (status === 'resolved' || status === 'closed') {
            setTicketViewHasUpdates(true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_activity', filter: `ticket_id=eq.${ticketId}` },
        () => {
          void refreshTicketView();
          const status = ticketViewStatusRef.current;
          if (status === 'resolved' || status === 'closed') {
            setTicketViewHasUpdates(true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        () => {
          void refreshTicketView();
          const status = ticketViewStatusRef.current;
          if (status === 'resolved' || status === 'closed') {
            setTicketViewHasUpdates(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTicketView, sidePanelMode, ticketViewTicket?.id]);

  const handleTicketViewUpdateStatus = useCallback(async (newStatus: TicketRecord['status']) => {
    if (!ticketViewTicket?.id) return;
    const updateData: any = { status: newStatus, updated_by: user?.id };
    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    }
    if (newStatus === 'open') {
      updateData.resolved_at = null;
    }
    const { error } = await supabase.from('tickets').update(updateData).eq('id', ticketViewTicket.id);
    if (error) {
      toast.error('Error al actualizar estado');
      return;
    }
    toast.success('Ticket actualizado');
    await refreshTicketView();
  }, [refreshTicketView, toast, ticketViewTicket?.id, user?.id]);

  const handleTicketViewAddComment = useCallback(async () => {
    if (!ticketViewTicket?.id || !ticketViewNewComment.trim()) return;
    if (ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed') {
      toast.error('El ticket está cerrado/resuelto. Reábrelo para agregar comentarios.');
      return;
    }
    await ensureCurrentUserInSystemUsers();
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: ticketViewTicket.id,
      user_id: user?.id,
      user_name: user?.name,
      user_email: user?.email,
      comment: ticketViewNewComment,
      is_internal: ticketViewIsInternal,
    });
    if (error) {
      toast.error('Error al agregar comentario');
      return;
    }
    setTicketViewNewComment('');
    setTicketViewIsInternal(false);
    await refreshTicketView();
  }, [refreshTicketView, ticketViewIsInternal, ticketViewNewComment, ticketViewTicket?.id, ticketViewTicket?.status, toast, user?.email, user?.id, user?.name]);

  const handleTicketButtonClick = useCallback(() => {
    if (linkedTicketNumber) {
      openTicketViewPanel(linkedTicketNumber);
      return;
    }

    if (!selectedConversation || !user?.id) return;

    const lastVisitorMessage = [...messages]
      .reverse()
      .find((msg) => msg.sender_type === 'visitor')?.message || '';

    saveTicketCreateDraft({
      client_id: linkedClientId || createdClientId || undefined,
      subject: `Chat web - ${selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}`,
      description: `Solicitud desde Chat Web\n\n${lastVisitorMessage}`.trim(),
      priority: 'medium',
      assigned_to: user.id,
      conversation_id: selectedConversation.id,
      source_module: 'chat_web',
      source_name: selectedConversation.visitor_name || undefined,
      source_email: selectedConversation.visitor_email || undefined,
      source_phone: selectedConversation.visitor_phone || undefined,
    });

    toast.success('Completá el ticket en el formulario unificado');
    setActiveModule('tickets');
  }, [linkedTicketNumber, openTicketViewPanel, selectedConversation, user?.id, messages, createdClientId, toast, setActiveModule]);

  const handleQuoteButtonClick = useCallback(() => {
    if (!selectedConversation) return;

    if (!linkedClientId) {
      toast.info('Primero crea o vincula el cliente para poder cotizar');
      setMobileTab('details');
      openClientPanel();
      return;
    }

    const quoteNotes = [
      'Solicitud desde Chat Web',
      `Contacto: ${selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}`,
      selectedConversation.source_domain ? `Dominio: ${selectedConversation.source_domain}` : '',
      selectedConversation.source_detail ? `Origen: ${selectedConversation.source_detail}` : '',
      selectedConversation.page_url ? `Página: ${selectedConversation.page_url}` : '',
      latestVisitorMessage ? `Mensaje: ${latestVisitorMessage}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    localStorage.setItem('sales_quote_draft', JSON.stringify({
      client_id: linkedClientId,
      opportunity_id: selectedConversation.opportunity_id || undefined,
      quote_date: new Date().toISOString().slice(0, 10),
      notes: quoteNotes,
      terms: 'Validez 15 días',
      source_module: 'chat_web',
      source_conversation_id: selectedConversation.id,
      source_name: selectedConversation.visitor_name || undefined,
      source_email: selectedConversation.visitor_email || undefined,
      source_phone: selectedConversation.visitor_phone || undefined,
    }));

    toast.success('Llevamos la conversación a Ventas para completar la cotización');
    setActiveModule('ventas');
  }, [latestVisitorMessage, linkedClientId, openClientPanel, selectedConversation, setActiveModule, setMobileTab, toast]);

  const handleSaveClient = async () => {
    if (!user?.id) return;
    if (!clientDraft.contact_name.trim()) {
      toast.error('El nombre del contacto es requerido');
      return;
    }
    if (!clientDraft.email.trim()) {
      toast.error('El email es requerido');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(clientDraft.email)) {
      toast.error('Email inválido');
      return;
    }
    if (clientDraft.phone && !/^[\d\s\-+()]+$/.test(clientDraft.phone)) {
      toast.error('Teléfono inválido');
      return;
    }

    setSidePanelSaving(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...clientDraft,
        created_by: user.id
      })
      .select('id')
      .single();

    setSidePanelSaving(false);
    if (error) {
      toast.error(`Error al crear: ${error.message}`);
      return;
    }

    if (selectedConversation) {
      const { error: updateError } = await supabase
        .from('webchat_conversations')
        .update({
          visitor_name: clientDraft.contact_name,
          visitor_email: clientDraft.email,
          visitor_phone: clientDraft.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedConversation.id);

      if (updateError) {
        toast.error('No se pudo actualizar el nombre en el chat');
      } else {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  visitor_name: clientDraft.contact_name,
                  visitor_email: clientDraft.email,
                  visitor_phone: clientDraft.phone || null,
                }
              : conv
          )
        );
        loadMessages(selectedConversation.id);
      }
    }

    const newClientId = data?.id || null;
    setCreatedClientId(newClientId);
    if (selectedConversationId && newClientId) {
      setLinkedClientMap((prev) => ({ ...prev, [selectedConversationId]: newClientId }));
    }
    toast.success('Cliente creado correctamente');
    setSidePanelMode(null);
    loadConversations();
  };

  const handleAssignExistingClient = async (client: ClientLookup) => {
    if (!selectedConversation) return;
    setCreatedClientId(client.id);
    if (selectedConversationId) {
      setLinkedClientMap((prev) => ({ ...prev, [selectedConversationId]: client.id }));
    }
    setClientDraft({
      company_name: client.company_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      status: client.status || 'prospect'
    });

    const { error: updateError } = await supabase
      .from('webchat_conversations')
      .update({
        visitor_name: client.contact_name,
        visitor_email: client.email,
        visitor_phone: client.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    if (updateError) {
      toast.error('No se pudo asignar el cliente al chat');
      return;
    }

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              visitor_name: client.contact_name,
              visitor_email: client.email,
              visitor_phone: client.phone || null,
            }
          : conv
      )
    );
    toast.success('Cliente asignado al chat');
    loadMessages(selectedConversation.id);
    setSidePanelMode(null);
  };

  const handleSaveTicket = async () => {
    if (!selectedConversation || !user?.id) return;
    if (!ticketDraft.subject.trim()) {
      toast.error('Ingresa un asunto');
      return;
    }

    saveTicketCreateDraft({
      client_id: ticketDraft.client_id || undefined,
      subject: ticketDraft.subject,
      description: ticketDraft.description,
      priority: ticketDraft.priority,
      assigned_to: user.id,
      conversation_id: selectedConversation.id,
      source_module: 'chat_web',
      source_name: selectedConversation.visitor_name || undefined,
      source_email: selectedConversation.visitor_email || undefined,
      source_phone: selectedConversation.visitor_phone || undefined
    });

    toast.success('Completá el ticket en el formulario unificado');
    setSidePanelMode(null);
    setActiveModule('tickets');
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !user?.id) return;
    if (isFormConversation) {
      toast.info('Esta conversación se responde por email desde este panel.');
      setEmailComposerOpen(true);
      return;
    }
    if (isConversationLocked) {
      toast.error('La conversación está asignada a otro usuario');
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error('Escribe un mensaje o adjunta un archivo');
      return;
    }

    const invalidAttachment = attachments.find(
      (file) => !(file.type && (file.type.startsWith('image/') || file.type === 'application/pdf'))
    );
    if (invalidAttachment) {
      toast.error('Tipo de archivo no permitido. Solo imágenes y PDF.');
      return;
    }

    const uploadedAttachments: WebChatMessage['attachments'] = [];

    for (const file of attachments) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Adjunto supera 10MB: ${file.name}`);
        return;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `conversations/${selectedConversation.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase
        .storage
        .from('webchat-attachments')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        toast.error(uploadError.message || `Error subiendo ${file.name}`);
        return;
      }

      const { data: publicData } = supabase
        .storage
        .from('webchat-attachments')
        .getPublicUrl(path);

      uploadedAttachments.push({
        filename: file.name,
        size: file.size,
        type: file.type,
        path,
        url: publicData.publicUrl,
      });
    }

    const { error } = await supabase.from('webchat_messages').insert({
      conversation_id: selectedConversation.id,
      sender_type: 'agent',
      sender_id: user.id,
      sender_name: user.name,
      message: messageText.trim() || null,
      attachments: uploadedAttachments
    });

    if (error) {
      toast.error('Error al enviar mensaje');
      return;
    }

    await supabase
      .from('webchat_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    void recordClientInteractionSafely({
      client_id: linkedClientId || selectedConversation.client_id || null,
      type: 'chat_message_sent',
      description: `Mensaje enviado por chat a ${selectedConversation.visitor_name || selectedConversation.visitor_email || 'visitante'}`,
      metadata: {
        conversation_id: selectedConversation.id,
        source_channel: selectedConversation.source_channel || null,
        message_length: messageText.trim().length,
        attachments_count: uploadedAttachments.length,
      },
      created_by: user.id,
      created_at: new Date().toISOString(),
    });

    setMessageText('');
    setAttachments([]);
    loadMessages(selectedConversation.id);
    loadConversations();
  };

  const handleSendEmailFromChat = async () => {
    if (!selectedConversation || !user?.id) return;
    if (!selectedConversation.visitor_email) {
      toast.error('No hay email del visitante');
      return;
    }
    if (!emailSubject.trim()) {
      toast.error('Ingresa un asunto');
      return;
    }
    if (!emailBody.trim()) {
      toast.error('Ingresa un mensaje');
      return;
    }

    setSendingEmail(true);
    try {
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
      const bodyHtml = emailBody
        .split('\n')
        .map((line) => line.trim())
        .join('<br>');

      const response = await fetch(`${supabaseUrl}/functions/v1/send-inbox-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          to_emails: [selectedConversation.visitor_email],
          cc_emails: [],
          bcc_emails: [],
          subject: emailSubject,
          body_html: bodyHtml,
          body_text: emailBody,
          webchat_conversation_id: selectedConversation.id,
          webchat_source_channel: selectedConversation.source_channel || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Error al enviar email');
      }

      toast.success('Email enviado correctamente');
      void recordClientInteractionSafely({
        client_id: linkedClientId || selectedConversation.client_id || null,
        type: 'email',
        description: `Email enviado desde chat a ${selectedConversation.visitor_email}`,
        metadata: {
          conversation_id: selectedConversation.id,
          source_channel: selectedConversation.source_channel || null,
          subject: emailSubject,
          body_length: emailBody.length,
        },
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
      if (isFormConversation) {
        const prefill = buildFormEmailPrefill();
        setEmailBody(prefill.body);
      } else {
        setEmailBody('');
      }
      await loadMessages(selectedConversation.id);
      await loadConversations();
    } catch (error: any) {
      toast.error(`Error al enviar email: ${error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return true;

    const createdAt = conv.created_at ? new Date(conv.created_at) : null;
    const lastMessageAt = conv.last_message_at ? new Date(conv.last_message_at) : null;

    const searchableText = [
      conv.visitor_name,
      conv.visitor_email,
      conv.visitor_phone,
      conv.source_domain,
      conv.source_detail,
      conv.page_url,
      conv.status,
      createdAt?.toLocaleDateString('es-ES'),
      createdAt?.toISOString().slice(0, 10),
      lastMessageAt?.toLocaleDateString('es-ES'),
      lastMessageAt?.toISOString().slice(0, 10)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(search);
  }).filter(conv => {
    if (statusFilter === 'active') return conv.status !== 'closed';
    if (statusFilter === 'all') return true;
    return conv.status === statusFilter;
  }).filter(conv => {
    if (causeFilter === 'all') return true;
    return conv.cause === causeFilter;
  }).filter(conv => {
    if (channelFilter === 'all') return true;
    if (channelFilter.startsWith('domain:')) {
      return conv.source_domain && `domain:${conv.source_domain}` === channelFilter;
    }
    return conv.source_channel === channelFilter;
  }).filter(conv => {
    if (assignmentFilter === 'mine') return conv.assigned_user_id === user?.id;
    if (assignmentFilter === 'unassigned') return !conv.assigned_user_id;
    return true;
  });

  const unreadCount = filteredConversations.filter(conv => {
    const lastViewed = lastViewedMap[conv.id];
    if (!conv.last_message_at) return false;
    if (!lastViewed) return true;
    return new Date(conv.last_message_at).getTime() > new Date(lastViewed).getTime();
  }).length;

  const normalizeResult = (value: unknown) => String(value ?? '').trim().toLowerCase();

  const kpi = {
    total: conversations.length,
    open: conversations.filter(c => c.status === 'open').length,
    assigned: conversations.filter(c => c.status === 'assigned' || c.status === 'taken').length,
    resolved: conversations.filter(c => c.status === 'resolved' || normalizeResult(c.result) === 'resuelto').length,
    closed: conversations.filter(c => c.status === 'closed').length,
    unassigned: conversations.filter(c => !c.assigned_user_id && c.status !== 'closed' && c.status !== 'resolved').length,
    mine: conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed').length,
  };

  const channelOptions: { value: string; label: string }[] = [
    { value: 'widget', label: 'Widget' },
    { value: 'form', label: 'Formulario web' },
    { value: 'email', label: 'Email' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
  ];
  const getChannelLabel = (value: string) => channelOptions.find((c) => c.value === value)?.label || value;
  const channelCounts = channelOptions.reduce<Record<string, number>>((acc, option) => {
    acc[option.value] = conversations.filter((c) => c.source_channel === option.value).length;
    return acc;
  }, {});
  const activeChannelOptions = channelOptions.filter((option) => channelCounts[option.value] > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat Web"
        subtitle="Solicitudes de chat desde dogcatify.com"
        action={
          <Button
            variant="secondary"
            onClick={loadConversations}
            icon={<RefreshCw className={`h-4 w-4 ${loadingConversations ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
        }
      />
      {conversationLoadError && (
        <p className="-mt-4 text-sm text-rose-600 dark:text-rose-400">
          {conversationLoadError}
        </p>
      )}

      <Card className="p-4">
        <div className="flex gap-4 overflow-x-auto pb-2">
          <KpiCard
            label="Total"
            value={kpi.total}
            tone="slate"
            active={assignmentFilter === 'all'}
            onClick={() => setAssignmentFilter('all')}
          />
          <KpiCard label="Abiertos" value={kpi.open} tone="orange" />
          <KpiCard label="Tomados" value={kpi.assigned} tone="emerald" />
          <KpiCard label="Resueltos" value={kpi.resolved} tone="teal" />
          <KpiCard label="Cerrados" value={kpi.closed} tone="slate" />
          <KpiCard
            label="Mías"
            value={kpi.mine}
            tone="indigo"
            active={assignmentFilter === 'mine'}
            onClick={() => setAssignmentFilter(assignmentFilter === 'mine' ? 'all' : 'mine')}
          />
          <KpiCard
            label="Sin asignar"
            value={kpi.unassigned}
            tone="teal"
            active={assignmentFilter === 'unassigned'}
            onClick={() => setAssignmentFilter(assignmentFilter === 'unassigned' ? 'all' : 'unassigned')}
          />
          <KpiCard label="No leídos" value={unreadCount} tone="indigo" />
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 px-1">
            Canal
          </span>
          <button
            onClick={() => setChannelFilter('all')}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              channelFilter === 'all'
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Todos ({conversations.length})
          </button>
          {activeChannelOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setChannelFilter(channelFilter === option.value ? 'all' : option.value)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                channelFilter === option.value
                  ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {option.label} ({channelCounts[option.value]})
            </button>
          ))}
        </div>
      </Card>

      <div className="md:hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileTab('list')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mobileTab === 'list'
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            disabled={!selectedConversationId}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              mobileTab === 'chat'
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileTab('details')}
            disabled={!selectedConversationId}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              mobileTab === 'details'
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            Detalles
          </button>
        </div>
      </div>

      <div
        className={`grid h-[72vh] gap-6 grid-cols-1 ${
          sidePanelMode ? 'md:grid-cols-[360px_1fr_360px]' : 'md:grid-cols-[360px_1fr]'
        }`}
      >
        <Card className={`${mobileTab === 'list' ? 'flex' : 'hidden'} md:flex h-full flex-col overflow-hidden`}>
          <div className="border-b border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, correo, teléfono o fecha..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
              />
            </div>
            <select
              value={causeFilter}
              onChange={(e) => setCauseFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
            >
              <option value="all">Todas las causas</option>
              {causeOptions.map((cause) => (
                <option key={cause} value={cause}>{cause}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
            >
              <option value="active">Activas (sin cerrados)</option>
              <option value="all">Todos los estados</option>
              <option value="open">Abierto</option>
              <option value="assigned">Asignado</option>
              <option value="taken">Tomado</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                <MessageCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">No hay conversaciones</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {filteredConversations.map((conv) => {
                  const lastViewed = lastViewedMap[conv.id];
                  const hasUnread = !!(
                    conv.last_message_at &&
                    (!lastViewed || new Date(conv.last_message_at).getTime() > new Date(lastViewed).getTime())
                  );
                  const statusBadgeVariant: BadgeVariant =
                    conv.status === 'open'
                      ? 'warning'
                      : conv.status === 'assigned' || conv.status === 'taken'
                        ? 'success'
                        : conv.status === 'resolved'
                          ? 'brand'
                          : 'neutral';
                  const statusLabel =
                    conv.status === 'open'
                      ? 'Abierto'
                      : conv.status === 'assigned' || conv.status === 'taken'
                        ? 'Tomado'
                        : conv.status === 'resolved'
                          ? 'Resuelto'
                          : 'Cerrado';

                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        setMobileTab('chat');
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                        selectedConversationId === conv.id
                          ? 'border-brand-500 bg-brand-50/70 dark:border-brand-500 dark:bg-brand-500/10 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 underline decoration-brand-200 dark:decoration-brand-500/40 decoration-2 underline-offset-4">
                            {conv.visitor_name || 'Visitante anónimo'}
                            {hasUnread && <span className="h-2 w-2 rounded-full bg-accent-500" />}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {conv.visitor_email || conv.visitor_phone || conv.source_domain || 'sin contacto'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                          {conv.source_channel && (
                            <Badge variant="neutral">{getChannelLabel(conv.source_channel)}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                          Último mensaje: {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : '—'}
                          {hasUnread ? (
                            <span className="rounded-full bg-accent-600 px-2 py-0.5 text-[10px] font-semibold text-white">Nuevo</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {conv.assigned_user_id
                            ? conv.assigned_user_id === user?.id
                              ? 'Asignada a mí'
                              : `Asignada a ${conv.assigned_user_name || 'otro agente'}`
                            : 'Sin asignar'}
                        </div>
                      {(conv.cause || conv.cause_custom || conv.result) && (
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <CauseBadge cause={conv.cause} custom={conv.cause_custom} />
                          <ResultBadge result={conv.result} />
                        </div>
                      )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex h-full flex-col overflow-hidden`}>
          {selectedConversation ? (
            <>
              <div className="border-b border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante anónimo'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedConversation.visitor_email || selectedConversation.visitor_phone || selectedConversation.source_domain || 'sin contacto'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {selectedConversation.source_channel
                          ? getChannelLabel(selectedConversation.source_channel)
                          : 'Origen desconocido'}
                        {selectedConversation.source_domain ? ` · ${selectedConversation.source_domain}` : ''}
                      </span>
                      {selectedConversation.page_url && (
                        <a
                          href={selectedConversation.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-[220px] truncate text-brand-600 dark:text-brand-400 hover:underline"
                          title={selectedConversation.page_url}
                        >
                          {selectedConversation.page_url}
                        </a>
                      )}
                    </div>
                    {(selectedConversation.cause || selectedConversation.cause_custom || selectedConversation.result) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <CauseBadge cause={selectedConversation.cause} custom={selectedConversation.cause_custom} />
                        <ResultBadge result={selectedConversation.result} />
                      </div>
                    )}
                    {isConversationLocked && (
                      <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">
                        Conversación asignada a otro usuario. Solo un administrador puede liberarla.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConversation.assigned_user_id ? (
                      <Badge variant="neutral">
                        Asignado a {selectedConversation.assigned_user_name || 'Agente'}
                      </Badge>
                    ) : (
                      <Button onClick={handleAssignToMe} icon={<UserCheck className="h-4 w-4" />}>
                        Tomar
                      </Button>
                    )}
                    {isAdmin && selectedConversation.assigned_user_id && (
                      <Button
                        variant="danger"
                        onClick={() => handleUpdateStatus('open')}
                        disabled={isConversationLocked && !isAdmin}
                        icon={<X className="h-4 w-4" />}
                      >
                        Liberar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setShowTransfer(true)}
                      disabled={isConversationLocked && !isAdmin}
                      icon={<Users className="h-4 w-4" />}
                    >
                      Transferir
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
                <button
                  onClick={openEmailComposer}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isConversationLocked ||
                    isClosed ||
                    (!selectedConversation.visitor_email && isFormConversation) ||
                    (isFormConversation && !selectedConversation.assigned_user_id)
                  }
                >
                  <Mail className="h-4 w-4" />
                  <span>{isFormConversation ? 'Responder por Email' : 'Email'}</span>
                </button>
                <button
                  onClick={openDialer}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <Phone className="h-4 w-4" />
                  <span>Llamar</span>
                </button>
                <button
                  onClick={() => {
                    setMobileTab('details');
                    handleTicketButtonClick();
                  }}
                  className={
                    linkedTicketNumber && linkedTicketStatus
                      ? `flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getTicketStatusClasses(linkedTicketStatus)}`
                      : 'flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60'
                  }
                  disabled={isConversationLocked || (!linkedTicketNumber && isClosed)}
                >
                  <Ticket className="h-4 w-4" />
                  <span className="flex flex-col leading-tight">
                    <span>{linkedTicketNumber ? 'Ver Ticket' : 'Crear Ticket'}</span>
                    {linkedTicketNumber && (
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{linkedTicketNumber}</span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMobileTab('details');
                    openClientPanel();
                  }}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{createdClientId ? 'Cliente asociado' : 'Crear Cliente'}</span>
                </button>
                <button
                  onClick={() => {
                    setMobileTab('details');
                    handleQuoteButtonClick();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 transition hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isConversationLocked || isClosed}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Cotizar</span>
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {selectedConversation.status === 'closed' && !isConversationLocked && (
                    <Button
                      variant="secondary"
                      onClick={() => handleUpdateStatus('open', { preserveAssignment: true })}
                      icon={<RefreshCw className="h-4 w-4" />}
                    >
                      Reabrir chat
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const ticketBlocksClose =
                        !!linkedTicketNumber &&
                        (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'));
                      if (ticketBlocksClose) {
                        toast.error('No puedes cerrar el chat si hay un ticket abierto. Resuelve o cierra el ticket primero.');
                        return;
                      }
                      setShowCloseModal(true);
                    }}
                    disabled={
                      isConversationLocked ||
                      isClosed ||
                      (!!linkedTicketNumber &&
                        (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed')))
                    }
                    title={
                      linkedTicketNumber &&
                      (!linkedTicketStatus || (linkedTicketStatus !== 'resolved' && linkedTicketStatus !== 'closed'))
                        ? 'No puedes cerrar el chat mientras el ticket esté abierto.'
                        : undefined
                    }
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    Cerrar chat
                  </Button>
                </div>
              </div>

              <div ref={messageListRef} className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-slate-900/40 p-6">
                {!selectedConversation?.assigned_user_id && !isClosed ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    Toma este chat para ver los mensajes.
                  </div>
                ) : isConversationLocked || isClosed ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    {isClosed ? 'Conversación cerrada. Reabre para ver mensajes.' : 'No tienes acceso a los mensajes de esta conversación.'}
                  </div>
                ) : loadingMessages ? (
                  <div className="text-center text-slate-500 dark:text-slate-400">Cargando mensajes...</div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-2xl rounded-2xl px-4 py-3 shadow-sm ${
                          (msg.sender_type === 'agent' || msg.sender_type === 'bot')
                            ? 'ml-auto bg-gradient-to-r from-brand-600 to-accent-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        <div className="mb-2 text-xs opacity-80">
                          {msg.sender_name || ((msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
                        </div>
                        {msg.message && <p className="text-sm whitespace-pre-line">{msg.message}</p>}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.attachments.map((att, index) => (
                              <a
                                key={`${msg.id}-att-${index}`}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 text-sm ${
                                  (msg.sender_type === 'agent' || msg.sender_type === 'bot') ? 'text-white/90' : 'text-brand-600 dark:text-brand-400'
                                }`}
                              >
                                <FileText className="h-4 w-4" />
                                <span>{att.filename}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                {emailComposerOpen ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Respuesta por correo</div>
                    <input
                      value={selectedConversation.visitor_email || ''}
                      readOnly
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300"
                    />
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Asunto"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
                      disabled={isConversationLocked || isClosed || sendingEmail}
                    />
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={5}
                      placeholder="Escribe tu respuesta por correo..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800"
                      disabled={isConversationLocked || isClosed || sendingEmail}
                    />
                    <div className="flex items-center justify-end gap-2">
                      {!isFormConversation && (
                        <Button variant="secondary" onClick={() => setEmailComposerOpen(false)} disabled={sendingEmail}>
                          Cancelar
                        </Button>
                      )}
                      <Button
                        onClick={handleSendEmailFromChat}
                        icon={<Send className="h-4 w-4" />}
                        disabled={
                          isConversationLocked ||
                          isClosed ||
                          sendingEmail ||
                          !selectedConversation.visitor_email ||
                          !emailSubject.trim() ||
                          !emailBody.trim()
                        }
                      >
                        {sendingEmail ? 'Enviando...' : 'Enviar email'}
                      </Button>
                    </div>
                  </div>
                ) : isFormConversation ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300">
                    {!selectedConversation.assigned_user_id
                      ? 'Toma el chat para habilitar la respuesta por email.'
                      : 'Haz clic en “Responder por Email” para preparar y enviar una sola respuesta completa.'}
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-2 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isConversationLocked || isClosed}
                      >
                        <Paperclip className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      </button>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {attachments.length > 0 ? `${attachments.length} adjunto(s)` : 'Sin adjuntos'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!isConversationLocked && !isClosed) {
                              handleSendMessage();
                            }
                          }
                        }}
                        rows={2}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800"
                        disabled={isConversationLocked || isClosed}
                      />
                      <Button
                        onClick={handleSendMessage}
                        size="lg"
                        icon={<Send className="h-4 w-4" />}
                        disabled={isConversationLocked || isClosed}
                      >
                        Enviar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Selecciona una conversación para empezar.
            </div>
          )}
        </Card>

        {sidePanelMode && selectedConversation && (
          <Card className={`${mobileTab === 'details' ? 'flex' : 'hidden'} md:flex h-full flex-col overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {sidePanelMode === 'client'
                    ? 'Crear Cliente'
                    : sidePanelMode === 'client_view'
                      ? 'Ver Cliente'
                    : sidePanelMode === 'ticket_view'
                      ? 'Ver Ticket'
                      : 'Crear Ticket'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>
                    {sidePanelMode === 'ticket_view' && ticketViewTicket?.ticket_number
                      ? ticketViewTicket.ticket_number
                      : selectedConversation.visitor_name || selectedConversation.visitor_email || selectedConversation.visitor_phone || 'Visitante'}
                  </span>
                  {sidePanelMode === 'ticket_view' &&
                    ticketViewHasUpdates &&
                    (ticketViewTicket?.status === 'resolved' || ticketViewTicket?.status === 'closed') && (
                      <Badge variant="danger">Actualizado</Badge>
                    )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSidePanelMode(null);
                  setMobileTab('chat');
                  setTicketViewTicket(null);
                  setTicketViewComments([]);
                  setTicketViewActivities([]);
                  setTicketViewNewComment('');
                  setTicketViewIsInternal(false);
                  setTicketViewTab('comments');
                  setTicketViewHasUpdates(false);
                  setClientViewClient(null);
                  setClientViewLoading(false);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-2 text-slate-600 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {sidePanelMode === 'client' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-3 space-y-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Buscar cliente existente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 text-slate-900 dark:text-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
                        placeholder="Nombre, email, teléfono o empresa"
                      />
                    </div>
                    {clientSearchLoading ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Buscando...</p>
                    ) : clientSearch.trim().length >= 2 ? (
                      clientResults.length > 0 ? (
                        <div className="space-y-2">
                          {clientResults.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => handleAssignExistingClient(client)}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 dark:hover:border-brand-500"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-100">{client.contact_name || client.company_name || 'Cliente'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{client.email || client.phone || 'Sin contacto'}</p>
                                </div>
                                <span className="text-[10px] uppercase text-slate-400 dark:text-slate-500">{client.status}</span>
                              </div>
                              {client.company_name && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{client.company_name}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Sin resultados</p>
                      )
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Escribe al menos 2 caracteres.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nombre del contacto</label>
                    <input
                      value={clientDraft.contact_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, contact_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="Nombre y apellido"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email</label>
                    <input
                      value={clientDraft.email}
                      onChange={(e) => setClientDraft({ ...clientDraft, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="correo@dominio.com"
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Teléfono</label>
                    <input
                      value={clientDraft.phone}
                      onChange={(e) => setClientDraft({ ...clientDraft, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="+1 809 000 0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Empresa</label>
                    <input
                      value={clientDraft.company_name}
                      onChange={(e) => setClientDraft({ ...clientDraft, company_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Estado</label>
                    <select
                      value={clientDraft.status}
                      onChange={(e) => setClientDraft({ ...clientDraft, status: e.target.value as ClientDraft['status'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                    >
                      <option value="prospect">Prospecto</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              ) : sidePanelMode === 'client_view' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Cliente cargado</div>
                    {createdClientId && (
                      <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">ID: {createdClientId.slice(0, 8)}...</div>
                    )}
                  </div>

                  {clientViewLoading ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">Cargando cliente...</div>
                  ) : !clientViewClient ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No hay cliente para mostrar.</div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {clientViewClient.contact_name || clientViewClient.company_name || 'Cliente'}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                            {clientViewClient.email || clientViewClient.phone || 'Sin contacto'}
                          </div>
                          {clientViewClient.company_name && (
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{clientViewClient.company_name}</div>
                          )}
                        </div>
                        <span className="text-[10px] uppercase text-slate-400 dark:text-slate-500">{clientViewClient.status}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => openClientPanel({ forceChange: true })}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:-translate-y-0.5"
                  >
                    Cambiar cliente
                  </button>
                </div>
              ) : sidePanelMode === 'ticket_view' ? (
                <div className="space-y-4">
                  {ticketViewLoading ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">Cargando ticket...</div>
                  ) : !ticketViewTicket ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No hay ticket para mostrar.</div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500 dark:text-slate-400">{ticketViewTicket.ticket_number}</div>
                            <div className="mt-1 font-semibold text-slate-900 dark:text-white truncate">{ticketViewTicket.subject}</div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                              {ticketViewTicket.assigned_user?.full_name
                                ? `Asignado a ${ticketViewTicket.assigned_user.full_name}`
                                : 'No asignado'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTicketStatusClasses(ticketViewTicket.status)}`}>
                              {ticketViewTicket.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTicketPriorityClasses(ticketViewTicket.priority)}`}>
                              {ticketViewTicket.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descripción</label>
                        <div className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                          {ticketViewTicket.description}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Acciones rápidas</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed') && (
                            <button
                              type="button"
                              onClick={() => handleTicketViewUpdateStatus('open')}
                              className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 text-xs font-semibold text-brand-700 dark:text-brand-400 transition hover:bg-brand-100 dark:hover:bg-brand-500/20"
                            >
                              Reabrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('in_progress')}
                            disabled={true}
                            className="rounded-xl bg-sky-100 dark:bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-400 transition hover:bg-sky-200 dark:hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            En Progreso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('waiting')}
                            disabled={true}
                            className="rounded-xl bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 transition hover:bg-amber-200 dark:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            En Espera
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('resolved')}
                            disabled={true}
                            className="rounded-xl bg-emerald-100 dark:bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition hover:bg-emerald-200 dark:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTicketViewUpdateStatus('closed')}
                            disabled={true}
                            className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setTicketViewTab('comments')}
                            className={`px-2 pb-2 text-xs font-semibold border-b-2 transition ${
                              ticketViewTab === 'comments'
                                ? 'text-brand-700 dark:text-brand-400 border-brand-600 dark:border-brand-500'
                                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            Comentarios ({ticketViewComments.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketViewTab('activity')}
                            className={`px-2 pb-2 text-xs font-semibold border-b-2 transition ${
                              ticketViewTab === 'activity'
                                ? 'text-brand-700 dark:text-brand-400 border-brand-600 dark:border-brand-500'
                                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            Actividad ({ticketViewActivities.length})
                          </button>
                        </div>

                        {ticketViewTab === 'comments' ? (
                          <>
                            <div className="mt-3 space-y-3 max-h-56 overflow-y-auto">
                              {ticketViewComments.length === 0 ? (
                                <div className="text-xs text-slate-500 dark:text-slate-400">No hay comentarios.</div>
                              ) : (
                                ticketViewComments.map((c) => (
                                  <div
                                    key={c.id}
                                    className={`rounded-2xl border p-3 text-sm ${
                                      c.is_internal
                                        ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                          {c.user_name || 'Usuario'}
                                        </div>
                                        {c.user_email && <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{c.user_email}</div>}
                                      </div>
                                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                        {new Date(c.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{c.comment}</div>
                                    {c.is_internal && (
                                      <div className="mt-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Interno</div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={ticketViewIsInternal}
                                  onChange={(e) => setTicketViewIsInternal(e.target.checked)}
                                  className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                                />
                                Comentario interno
                              </label>
                              <textarea
                                value={ticketViewNewComment}
                                onChange={(e) => setTicketViewNewComment(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleTicketViewAddComment();
                                  }
                                }}
                                disabled={ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed'}
                                rows={3}
                                placeholder="Escribe un comentario..."
                                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900"
                              />
                              <Button
                                onClick={handleTicketViewAddComment}
                                disabled={ticketViewTicket.status === 'resolved' || ticketViewTicket.status === 'closed'}
                                className="mt-2 w-full"
                              >
                                Enviar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 space-y-3 max-h-72 overflow-y-auto">
                            {ticketViewActivities.length === 0 ? (
                              <div className="text-xs text-slate-500 dark:text-slate-400">No hay actividad registrada.</div>
                            ) : (
                              ticketViewActivities.map((a) => (
                                <div key={a.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{a.action}</div>
                                  {a.field_changed && (
                                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                      {a.field_changed}: {a.old_value} → {a.new_value}
                                    </div>
                                  )}
                                  {a.description && <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{a.description}</div>}
                                  <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {createdClientId && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                      Cliente vinculado: {createdClientId.slice(0, 8)}...
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Asunto</label>
                    <input
                      value={ticketDraft.subject}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, subject: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="Asunto del ticket"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descripción</label>
                    <textarea
                      value={ticketDraft.description}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                      rows={6}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                      placeholder="Detalle del caso"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Prioridad</label>
                    <select
                      value={ticketDraft.priority}
                      onChange={(e) => setTicketDraft({ ...ticketDraft, priority: e.target.value as TicketDraft['priority'] })}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {(sidePanelMode === 'client' || sidePanelMode === 'ticket') && (
              <div className="border-t border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
                <Button
                  onClick={sidePanelMode === 'client' ? handleSaveClient : handleSaveTicket}
                  disabled={sidePanelSaving}
                  className="w-full"
                >
                  {sidePanelSaving ? 'Guardando...' : sidePanelMode === 'client' ? 'Crear Cliente' : 'Crear Ticket'}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {showTransfer && selectedConversation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transferir conversación</h3>
              <button onClick={() => setShowTransfer(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-4">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={transferQuery}
                onChange={(e) => handleTransferSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transferResults.length === 0 ? (
                <p className="text-sm text-slate-500">Sin resultados</p>
              ) : (
                transferResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleTransferTo(u)}
                    className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showCloseModal && selectedConversation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Cerrar conversación</h3>
                <p className="text-sm text-slate-500">Completa la causa y el resultado para cerrar el chat.</p>
              </div>
              <button onClick={() => setShowCloseModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Causa</label>
                <select
                  value={causeSelection}
                  onChange={(e) => setCauseSelection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Selecciona una causa</option>
                  {causeOptions.map((cause) => (
                    <option key={cause} value={cause}>{cause}</option>
                  ))}
                </select>
                {causeSelection === 'Otro' && (
                  <input
                    type="text"
                    value={causeCustom}
                    onChange={(e) => setCauseCustom(e.target.value)}
                    placeholder="Describe la causa"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Resultado</label>
                <select
                  value={resultSelection}
                  onChange={(e) => setResultSelection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Selecciona un resultado</option>
                  {resultOptions.map((result) => (
                    <option key={result} value={result}>{result}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-700">Notas del resultado (opcional)</label>
              <textarea
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConversationMeta}
                disabled={savingConversationMeta}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-2 text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingConversationMeta ? 'Guardando...' : 'Cerrar conversación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'orange' | 'emerald' | 'teal' | 'indigo';
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClasses = {
    slate: 'from-slate-600 to-slate-500',
    orange: 'from-orange-500 to-amber-500',
    emerald: 'from-emerald-500 to-teal-500',
    teal: 'from-teal-500 to-emerald-600',
    indigo: 'from-indigo-500 to-purple-500'
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`min-w-[180px] rounded-2xl border p-5 shadow-sm text-left transition ${
        active
          ? 'border-brand-400 dark:border-brand-500 bg-brand-50 dark:bg-brand-500/10 ring-2 ring-brand-200 dark:ring-brand-500/30'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      } ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className={`inline-flex rounded-xl bg-gradient-to-r ${toneClasses[tone]} px-3 py-1 text-xs font-semibold text-white`}>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </Component>
  );
}

function CauseBadge({ cause, custom }: { cause?: string | null; custom?: string | null }) {
  if (!cause && !custom) return null;
  const label = cause === 'Otro' ? custom || 'Otro' : cause || custom || '';
  const styles: Record<string, string> = {
    'Consulta general': 'bg-slate-100 text-slate-700',
    'Cotización': 'bg-blue-100 text-blue-700',
    'Soporte': 'bg-amber-100 text-amber-700',
    'Reclamo': 'bg-rose-100 text-rose-700',
    'Reservas': 'bg-purple-100 text-purple-700',
    'Facturación': 'bg-teal-100 text-teal-700',
    'Otro': 'bg-slate-100 text-slate-600'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${styles[cause || 'Otro'] || 'bg-slate-100 text-slate-700'}`}>
      <Tag className="h-3 w-3" />
      {label}
    </span>
  );
}

function ResultBadge({ result }: { result?: string | null }) {
  if (!result) return null;
  const styles: Record<string, string> = {
    'Resuelto': 'bg-emerald-100 text-emerald-700',
    'Derivado a ticket': 'bg-blue-100 text-blue-700',
    'Llamada programada': 'bg-amber-100 text-amber-700',
    'Sin respuesta': 'bg-slate-100 text-slate-600',
    'No procede': 'bg-rose-100 text-rose-700'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${styles[result] || 'bg-slate-100 text-slate-600'}`}>
      <Clock className="h-3 w-3" />
      {result}
    </span>
  );
}
