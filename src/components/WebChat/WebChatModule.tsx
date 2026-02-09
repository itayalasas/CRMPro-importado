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
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useDialer } from '../../contexts/DialerContext';
import { searchUsers } from '../../lib/userService';

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
  sender_type: 'visitor' | 'agent' | 'system';
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
  const { navigateToInbox } = useNavigation();
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferResults, setTransferResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [sidePanelMode, setSidePanelMode] = useState<'client' | 'ticket' | null>(null);
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
  const [sidePanelSaving, setSidePanelSaving] = useState(false);
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

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const isAdmin = user?.role === 'admin';
  const isAssignedToUser = selectedConversation?.assigned_user_id && selectedConversation.assigned_user_id === user?.id;
  const isConversationLocked = !!selectedConversation?.assigned_user_id && !isAssignedToUser && !isAdmin;
  const isClosed = selectedConversation?.status === 'closed';

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

  useLayoutEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const scrollToBottom = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

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
                placeholder="Buscar conversación..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <select
              value={causeFilter}
              onChange={(e) => setCauseFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              <option value="all">Todas las causas</option>
              {causeOptions.map((cause) => (
                <option key={cause} value={cause}>{cause}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
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
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                <MessageCircle className="h-10 w-10 text-slate-300" />
                <p className="text-sm">No hay conversaciones</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                      selectedConversationId === conv.id
                        ? 'border-teal-500 bg-teal-50/70 shadow-md'
                        : 'border-slate-200 bg-white'
                    }`}
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
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        Último mensaje: {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : '—'}
                        {(() => {
                          const lastViewed = lastViewedMap[conv.id];
                          if (!conv.last_message_at) return null;
                          if (!lastViewed || new Date(conv.last_message_at).getTime() > new Date(lastViewed).getTime()) {
                            return <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">Nuevo</span>;
                          }
                          return null;
                        })()}
                      </div>
                      {(conv.cause || conv.cause_custom || conv.result) && (
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
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-red-600 shadow-sm transition hover:-translate-y-0.5"
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
                  <span>Crear Cliente</span>
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
                    disabled={isConversationLocked || isClosed}
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
                          msg.sender_type === 'agent'
                            ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="mb-2 text-xs opacity-80">
                          {msg.sender_name || (msg.sender_type === 'agent' ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
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
                                  msg.sender_type === 'agent' ? 'text-white/90' : 'text-blue-600'
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
  };

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

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    setSidePanelSaving(true);
    const { error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        client_id: ticketDraft.client_id || null,
        subject: ticketDraft.subject,
        description: ticketDraft.description,
        priority: ticketDraft.priority,
        status: 'open',
        assigned_to: user.id,
        created_by: user.id
      });

    setSidePanelSaving(false);
    if (error) {
      toast.error('Error al crear ticket');
      return;
    }

    await supabase.from('webchat_messages').insert({
      conversation_id: selectedConversation.id,
      sender_type: 'agent',
      sender_id: user.id,
      sender_name: user.name,
      message: `Ticket creado: ${ticketNumber}`,
      attachments: []
    });

    await supabase
      .from('webchat_conversations')
      .update({ result: 'Derivado a ticket', updated_at: new Date().toISOString() })
      .eq('id', selectedConversation.id);

    toast.success('Ticket creado');
    setSidePanelMode(null);
    loadConversations();
    loadMessages(selectedConversation.id);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const search = searchQuery.toLowerCase();
    return (
      conv.visitor_name?.toLowerCase().includes(search) ||
      conv.visitor_email?.toLowerCase().includes(search) ||
      conv.visitor_phone?.toLowerCase().includes(search) ||
      conv.source_domain?.toLowerCase().includes(search)
    );
  }).filter(conv => {
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
      navigateToInbox(selectedConversation.visitor_email);
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
                placeholder="Buscar conversación..."
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
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-red-600 shadow-sm transition hover:-translate-y-0.5"
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
                    <span>Crear Cliente</span>
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
                      disabled={isConversationLocked || isClosed}
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
                            msg.sender_type === 'agent'
                              ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                              : 'bg-white text-slate-800 border border-slate-200'
                          }`}
                        >
                          <div className="mb-2 text-xs opacity-80">
                            {msg.sender_name || (msg.sender_type === 'agent' ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
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
                                    msg.sender_type === 'agent' ? 'text-white/90' : 'text-blue-600'
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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useDialer } from '../../contexts/DialerContext';
import { searchUsers } from '../../lib/userService';

interface WebChatConversation {
  id: string;
  session_id: string;
  source_domain: string | null;
  source_channel?: string | null;
  source_detail?: string | null;
  page_url: string | null;
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
  sender_type: 'visitor' | 'agent' | 'system';
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
  const { navigateToInbox } = useNavigation();
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferResults, setTransferResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [sidePanelMode, setSidePanelMode] = useState<'client' | 'ticket' | null>(null);
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
  const [sidePanelSaving, setSidePanelSaving] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
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

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const isAdmin = user?.role === 'admin';
  const isAssignedToUser = selectedConversation?.assigned_user_id && selectedConversation.assigned_user_id === user?.id;
  const isConversationLocked = !!selectedConversation?.assigned_user_id && !isAssignedToUser && !isAdmin;
  const isClosed = selectedConversation?.status === 'closed';

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
      setSelectedConversationId(data[0].id);
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

    setMessages(data || []);
    setLoadingMessages(false);
  }, [toast]);

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

          const conversationId = newMessage.conversation_id;
          const isActive = conversationId === selectedConversationIdRef.current && !document.hidden;

          if (isActive) {
            markConversationViewed(conversationId, newMessage.created_at);
            loadMessages(conversationId);
          } else if (newMessage.sender_type === 'visitor') {
            const lastNotified = lastNotifyRef.current[conversationId] || 0;
            const now = Date.now();
            if (now - lastNotified > 5000) {
              const conv = conversationsRef.current.find((c) => c.id === conversationId);
              toast.info(`Nuevo mensaje de ${conv?.visitor_name || 'Visitante'}`);
              lastNotifyRef.current[conversationId] = now;
            }
          }

          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, loadMessages, markConversationViewed, toast]);

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
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

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

    toast.success('Conversación asignada');
    loadConversations();
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

    const { error } = await supabase
      .from('webchat_conversations')
      .update({
        assigned_user_id: targetUser.id,
        assigned_user_name: targetUser.name,
        assigned_at: new Date().toISOString(),
        status: 'taken',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Error al transferir conversación');
      return;
    }

    toast.success(`Transferida a ${targetUser.name}`);
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

  const openEmailComposer = () => {
    if (selectedConversation?.visitor_email) {
      navigateToInbox(selectedConversation.visitor_email);
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
  };

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

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    setSidePanelSaving(true);
    const { error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        client_id: ticketDraft.client_id || null,
        subject: ticketDraft.subject,
        description: ticketDraft.description,
        priority: ticketDraft.priority,
        status: 'open',
        assigned_to: user.id,
        created_by: user.id
      });

    setSidePanelSaving(false);
    if (error) {
      toast.error('Error al crear ticket');
      return;
    }

    await supabase.from('webchat_messages').insert({
      conversation_id: selectedConversation.id,
      sender_type: 'agent',
      sender_id: user.id,
      sender_name: user.name,
      message: `Ticket creado: ${ticketNumber}`,
      attachments: []
    });

    await supabase
      .from('webchat_conversations')
      .update({ result: 'Derivado a ticket', updated_at: new Date().toISOString() })
      .eq('id', selectedConversation.id);

    toast.success('Ticket creado');
    setSidePanelMode(null);
    loadConversations();
    loadMessages(selectedConversation.id);
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

    setMessageText('');
    setAttachments([]);
    loadMessages(selectedConversation.id);
    loadConversations();
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const search = searchQuery.toLowerCase();
    return (
      conv.visitor_name?.toLowerCase().includes(search) ||
      conv.visitor_email?.toLowerCase().includes(search) ||
      conv.visitor_phone?.toLowerCase().includes(search) ||
      conv.source_domain?.toLowerCase().includes(search)
    );
  }).filter(conv => {
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
    resolved: conversations.filter(c => c.status === 'resolved').length,
    closed: conversations.filter(c => c.status === 'closed').length,
    unassigned: conversations.filter(c => !c.assigned_user_id && c.status !== 'closed' && c.status !== 'resolved').length,
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
                placeholder="Buscar conversación..."
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <select
              value={causeFilter}
              onChange={(e) => setCauseFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              <option value="all">Todas las causas</option>
              {causeOptions.map((cause) => (
                <option key={cause} value={cause}>{cause}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
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
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                <MessageCircle className="h-10 w-10 text-slate-300" />
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

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                        selectedConversationId === conv.id
                          ? 'border-teal-500 bg-teal-50/70 shadow-md'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="flex items-center gap-2 font-semibold text-slate-800 underline decoration-teal-200 decoration-2 underline-offset-4">
                            {conv.visitor_name || 'Visitante anónimo'}
                            {hasUnread && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                          </p>
                          <p className="text-xs text-slate-500">
                            {conv.visitor_email || conv.visitor_phone || conv.source_domain || 'sin contacto'}
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
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          Último mensaje: {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : '—'}
                          {hasUnread ? (
                            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">Nuevo</span>
                          ) : null}
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
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-red-600 shadow-sm transition hover:-translate-y-0.5"
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
                  <span>Crear Cliente</span>
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
                    onClick={() => setShowCloseModal(true)}
                    disabled={isConversationLocked || isClosed}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Cerrar chat</span>
                  </button>
                </div>
              </div>

              <div ref={messageListRef} className="flex-1 overflow-y-auto bg-slate-50/80 p-6">
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
                          msg.sender_type === 'agent'
                            ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="mb-2 text-xs opacity-80">
                          {msg.sender_name || (msg.sender_type === 'agent' ? 'Agente' : 'Visitante')} · {new Date(msg.created_at).toLocaleString()}
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
                                  msg.sender_type === 'agent' ? 'text-white/90' : 'text-blue-600'
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
