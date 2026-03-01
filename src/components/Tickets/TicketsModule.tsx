import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, MessageSquare, AlertCircle, Clock, CheckCircle, X, Search,
  Calendar, User, Tag, Activity,
  AlertTriangle, HelpCircle, GitPullRequest, Bug, BookOpen, Building2,
  Send, Ticket
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { consumeTicketCreateDraft, type TicketCreateDraft } from '../../lib/ticketDraft';

interface Ticket {
  id: string;
  ticket_number: string;
  client_id: string;
  source_module: string | null;
  subject: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  tags: string[] | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { company_name: string; contact_name: string; email: string; phone?: string };
  ticket_categories?: { name: string; color: string; icon: string };
}

interface Comment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface Activity {
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

interface TicketAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

interface TicketStatusParameter {
  id: string;
  code: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface TicketSlaSettings {
  low_hours: number;
  medium_hours: number;
  high_hours: number;
  urgent_hours: number;
  low_estimated_hours: number;
  medium_estimated_hours: number;
  high_estimated_hours: number;
  urgent_estimated_hours: number;
}

const fallbackTicketStatuses: TicketStatusParameter[] = [
  { id: 'fallback-open', code: 'open', name: 'Abierto', color: '#ef4444', sort_order: 1, is_active: true },
  { id: 'fallback-in-progress', code: 'in_progress', name: 'En Progreso', color: '#3b82f6', sort_order: 2, is_active: true },
  { id: 'fallback-waiting', code: 'waiting', name: 'En Espera', color: '#eab308', sort_order: 3, is_active: true },
  { id: 'fallback-resolved', code: 'resolved', name: 'Resuelto', color: '#10b981', sort_order: 4, is_active: true },
  { id: 'fallback-closed', code: 'closed', name: 'Cerrado', color: '#64748b', sort_order: 5, is_active: true }
];

const defaultTicketSlaSettings: TicketSlaSettings = {
  low_hours: 72,
  medium_hours: 24,
  high_hours: 8,
  urgent_hours: 4,
  low_estimated_hours: 2,
  medium_estimated_hours: 4,
  high_estimated_hours: 8,
  urgent_estimated_hours: 12
};

const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateInputValue(date);
};

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasHtmlContent = (value: string): boolean => /<[^>]+>/.test(value || '');

const sanitizeHtmlForTicketView = (value: string): string =>
  (value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

const getSourceLabel = (source: string | null | undefined): string => {
  switch ((source || '').toLowerCase()) {
    case 'email':
    case 'mail':
    case 'correo':
    case 'buzon':
      return 'Email';
    case 'chat_web':
    case 'webchat':
    case 'chat':
      return 'Chat Web';
    case 'llamadas':
    case 'llamada':
    case 'llamada_modal':
    case 'call':
      return 'Llamada';
    case 'ordenes':
      return 'Órdenes';
    default:
      return 'Manual';
  }
};

const getSourceBadgeClass = (source: string | null | undefined): string => {
  switch ((source || '').toLowerCase()) {
    case 'email':
    case 'mail':
    case 'correo':
    case 'buzon':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'chat_web':
    case 'webchat':
    case 'chat':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'llamadas':
    case 'llamada':
    case 'llamada_modal':
    case 'call':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export function TicketsModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [notifyPayload, setNotifyPayload] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [ticketStatuses, setTicketStatuses] = useState<TicketStatusParameter[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [detailClientSearchTerm, setDetailClientSearchTerm] = useState('');
  const [showDetailClientDropdown, setShowDetailClientDropdown] = useState(false);
  const [detailUploadingAttachments, setDetailUploadingAttachments] = useState(false);
  const [ticketSlaSettings, setTicketSlaSettings] = useState<TicketSlaSettings>(defaultTicketSlaSettings);
  const [detailDueDate, setDetailDueDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [ticketPreviewNumber, setTicketPreviewNumber] = useState('');
  const [initialComment, setInitialComment] = useState('');
  const [draftSourceModule, setDraftSourceModule] = useState<string | null>(null);
  const [draftSourceContact, setDraftSourceContact] = useState<{ module: string; name?: string; email?: string; phone?: string } | null>(null);
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const [draftRichDescription, setDraftRichDescription] = useState<string | null>(null);
  const pageSize = 10;
  const { user } = useAuth();
  const { showToast } = useToast();
  const [webchatDraft, setWebchatDraft] = useState<{ conversationId: string | null } | null>(null);

  const [formData, setFormData] = useState({
    ticket_number: '',
    client_id: '',
    subject: '',
    description: '',
    priority: 'medium' as const,
    status: 'open',
    category_id: '',
    assigned_to: '',
    due_date: '',
    tags: '',
    estimated_hours: String(defaultTicketSlaSettings.medium_estimated_hours)
  });

  useEffect(() => {
    const initializeModule = async () => {
      await ensureCurrentUserInSystemUsers();
      loadTickets();
      loadClients();
      loadUsers();
      loadCategories();
      loadTicketStatuses();
      loadTicketSlaSettings();
    };
    initializeModule();
  }, []);

  useEffect(() => {
    const draft = consumeTicketCreateDraft();
    if (!draft) return;

    const typedDraft = draft as TicketCreateDraft;
    const draftPriority = (typedDraft.priority as Ticket['priority']) || 'medium';
    const estimatedByPriority: Record<Ticket['priority'], number> = {
      low: ticketSlaSettings.low_estimated_hours,
      medium: ticketSlaSettings.medium_estimated_hours,
      high: ticketSlaSettings.high_estimated_hours,
      urgent: ticketSlaSettings.urgent_estimated_hours
    };
    const draftHtmlDescription = (typedDraft.description_html || '').trim();
    const draftPlainDescription = (typedDraft.description || '').trim()
      || (draftHtmlDescription ? stripHtmlTags(draftHtmlDescription) : '');

    setFormData((prev) => ({
      ...prev,
      client_id: typedDraft.client_id || '',
      subject: typedDraft.subject || '',
      description: draftPlainDescription,
      priority: draftPriority,
      status: typedDraft.status || prev.status || 'open',
      category_id: typedDraft.category_id || '',
      assigned_to: typedDraft.assigned_to || '',
      estimated_hours: prev.estimated_hours || String(estimatedByPriority[draftPriority])
    }));

    setDraftRichDescription(draftHtmlDescription || null);

    setDraftOrderId(typedDraft.order_id || null);
    setWebchatDraft({ conversationId: typedDraft.conversation_id || null });
    setDraftSourceModule(typedDraft.source_module || null);

    if (typedDraft.source_name || typedDraft.source_email || typedDraft.source_phone) {
      setDraftSourceContact({
        module: typedDraft.source_module || 'origen',
        name: typedDraft.source_name,
        email: typedDraft.source_email,
        phone: typedDraft.source_phone
      });
    } else {
      setDraftSourceContact(null);
    }

    setTicketPreviewNumber(generateTicketNumber());
    setShowModal(true);
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchTerm, filterStatus, filterPriority, filterAssignedTo, onlyOverdue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterAssignedTo, onlyOverdue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-dropdown-container')) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showClientDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.client-dropdown-container')) {
          setShowClientDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAssigneeDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.assignee-dropdown-container')) {
          setShowAssigneeDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDetailClientDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.detail-client-dropdown-container')) {
          setShowDetailClientDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetailClientDropdown]);

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        clients(company_name, contact_name, email, phone),
        ticket_categories(name, color, icon)
      `)
      .or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id},client_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Error al cargar tickets', 'error');
      return;
    }
    if (data) setTickets(data);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, contact_name, company_name, email, phone')
      .in('status', ['active', 'prospect'])
      .order('contact_name');
    if (data) {
      setClients(data);
      setFilteredClients(data);
    }
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('system_users')
      .select('id, email, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      return;
    }

    if (data) {
      const formattedUsers = data.map((u: any) => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        role: u.role
      }));
      setUsers(formattedUsers);
      setFilteredUsers(formattedUsers);
    }
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setCategories(data);
      return;
    }

    const { data: fallbackData } = await supabase
      .from('ticket_categories')
      .select('*')
      .order('name');

    if (fallbackData) setCategories(fallbackData);
  };

  const loadTicketStatuses = async () => {
    const { data, error } = await supabase
      .from('ticket_statuses')
      .select('id, code, name, color, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      setTicketStatuses(fallbackTicketStatuses);
      setFormData((prev) => ({ ...prev, status: fallbackTicketStatuses[0].code }));
      return;
    }

    if (data && data.length > 0) {
      setTicketStatuses(data);
      setFormData((prev) => {
        if (prev.status && data.some((status) => status.code === prev.status)) {
          return prev;
        }
        return { ...prev, status: data[0].code };
      });
      return;
    }

    setTicketStatuses(fallbackTicketStatuses);
    setFormData((prev) => ({ ...prev, status: fallbackTicketStatuses[0].code }));
  };

  const loadTicketSlaSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'ticket_sla_settings')
      .maybeSingle();

    if (error || !data?.setting_value) {
      setTicketSlaSettings(defaultTicketSlaSettings);
      return;
    }

    const parsed = data.setting_value as Partial<TicketSlaSettings>;
    setTicketSlaSettings({
      low_hours: Number(parsed.low_hours || defaultTicketSlaSettings.low_hours),
      medium_hours: Number(parsed.medium_hours || defaultTicketSlaSettings.medium_hours),
      high_hours: Number(parsed.high_hours || defaultTicketSlaSettings.high_hours),
      urgent_hours: Number(parsed.urgent_hours || defaultTicketSlaSettings.urgent_hours),
      low_estimated_hours: Number(parsed.low_estimated_hours || defaultTicketSlaSettings.low_estimated_hours),
      medium_estimated_hours: Number(parsed.medium_estimated_hours || defaultTicketSlaSettings.medium_estimated_hours),
      high_estimated_hours: Number(parsed.high_estimated_hours || defaultTicketSlaSettings.high_estimated_hours),
      urgent_estimated_hours: Number(parsed.urgent_estimated_hours || defaultTicketSlaSettings.urgent_estimated_hours)
    });
  };

  const loadComments = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const loadHistory = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setHistory(data);
  };

  const loadActivities = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('ticket_activity')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      return;
    }

    setActivities((data as Activity[]) || []);
  };

  const loadAttachments = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('ticket_attachments')
      .select('id, file_name, file_url, file_size, file_type, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) {
      setAttachments([]);
      return;
    }

    setAttachments((data as TicketAttachment[]) || []);
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.ticket_number.toLowerCase().includes(search) ||
        ticket.subject.toLowerCase().includes(search) ||
        ticket.description.toLowerCase().includes(search) ||
        ticket.clients?.company_name?.toLowerCase().includes(search) ||
        ticket.clients?.contact_name?.toLowerCase().includes(search) ||
        getSourceLabel(ticket.source_module).toLowerCase().includes(search)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === filterPriority);
    }

    if (filterAssignedTo !== 'all') {
      if (filterAssignedTo === 'unassigned') {
        filtered = filtered.filter((ticket) => !ticket.assigned_to);
      } else {
        filtered = filtered.filter((ticket) => ticket.assigned_to === filterAssignedTo);
      }
    }

    if (onlyOverdue) {
      const now = new Date();
      filtered = filtered.filter((ticket) => {
        if (!ticket.due_date) return false;
        return new Date(ticket.due_date) < now && !['resolved', 'closed'].includes(ticket.status);
      });
    }

    setFilteredTickets(filtered);
  };

  const handleUserSearch = (searchValue: string) => {
    setUserSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredUsers(users);
      setShowUserDropdown(false);
      return;
    }

    const search = searchValue.toLowerCase();
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
    setFilteredUsers(filtered);
    setShowUserDropdown(true);
  };

  const handleClientSearch = (searchValue: string) => {
    setClientSearchTerm(searchValue);

    if (!searchValue.trim()) {
      setFilteredClients(clients);
      setShowClientDropdown(true);
      return;
    }

    const search = searchValue.toLowerCase();
    const filtered = clients.filter((client) =>
      (client.contact_name || '').toLowerCase().includes(search) ||
      (client.company_name || '').toLowerCase().includes(search) ||
      (client.email || '').toLowerCase().includes(search) ||
      (client.phone || '').toLowerCase().includes(search)
    );
    setFilteredClients(filtered);
    setShowClientDropdown(true);
  };

  const calculateDueDateByPriority = (priority: Ticket['priority']): string => {
    const slaHoursByPriority: Record<Ticket['priority'], number> = {
      low: ticketSlaSettings.low_hours,
      medium: ticketSlaSettings.medium_hours,
      high: ticketSlaSettings.high_hours,
      urgent: ticketSlaSettings.urgent_hours
    };

    const now = new Date();
    const due = new Date(now.getTime() + slaHoursByPriority[priority] * 60 * 60 * 1000);
    return formatDateInputValue(due);
  };

  const calculateEstimatedHoursByPriority = (priority: Ticket['priority']): number => {
    const estimatedHoursByPriority: Record<Ticket['priority'], number> = {
      low: ticketSlaSettings.low_estimated_hours,
      medium: ticketSlaSettings.medium_estimated_hours,
      high: ticketSlaSettings.high_estimated_hours,
      urgent: ticketSlaSettings.urgent_estimated_hours
    };

    return estimatedHoursByPriority[priority];
  };

  const handlePriorityChange = (priority: Ticket['priority']) => {
    const estimated = calculateEstimatedHoursByPriority(priority);
    setFormData((prev) => ({
      ...prev,
      priority,
      due_date: calculateDueDateByPriority(priority),
      estimated_hours: String(estimated)
    }));
  };

  const addPendingAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextFiles = Array.from(files);
    setPendingAttachments((prev) => {
      const seen = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const unique = nextFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...prev, ...unique];
    });
  };

  const removePendingAttachment = (indexToRemove: number) => {
    setPendingAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadTicketAttachments = async (ticketId: string) => {
    if (pendingAttachments.length === 0) return true;

    setUploadingAttachments(true);
    try {
      const attachmentRows: Array<{
        ticket_id: string;
        file_name: string;
        file_url: string;
        file_size: number;
        file_type: string | null;
        uploaded_by: string | null | undefined;
      }> = [];

      for (let index = 0; index < pendingAttachments.length; index += 1) {
        const file = pendingAttachments[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `tickets/${ticketId}/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('webchat-attachments')
          .upload(filePath, file, { upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage.from('webchat-attachments').getPublicUrl(filePath);

        attachmentRows.push({
          ticket_id: ticketId,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: user?.id
        });
      }

      const { error: insertError } = await supabase.from('ticket_attachments').insert(attachmentRows);
      if (insertError) {
        throw new Error(insertError.message);
      }

      return true;
    } catch {
      showToast('El ticket se creó, pero falló la carga de adjuntos', 'warning');
      return false;
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id) {
      showToast('Selecciona un cliente para continuar', 'error');
      return;
    }

    const ticketNumber = ticketPreviewNumber || generateTicketNumber();
    const defaultStatus = ticketStatuses[0]?.code || fallbackTicketStatuses[0].code;
    const selectedStatus = formData.status || defaultStatus;
    const finalDescription = draftRichDescription || formData.description;
    const finalEstimatedHours = formData.estimated_hours
      ? parseFloat(formData.estimated_hours)
      : calculateEstimatedHoursByPriority(formData.priority);

    const ticketData: any = {
      ticket_number: ticketNumber,
      client_id: formData.client_id,
      source_module: draftSourceModule || null,
      subject: formData.subject,
      description: finalDescription,
      priority: formData.priority,
      status: selectedStatus,
      category_id: formData.category_id || null,
      assigned_to: formData.assigned_to || user?.id,
      due_date: formData.due_date || calculateDueDateByPriority(formData.priority),
      estimated_hours: Number.isFinite(finalEstimatedHours) ? finalEstimatedHours : null,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
      created_by: user?.id
    };

    if (draftOrderId) {
      ticketData.order_id = draftOrderId;
    }

    const { data: createdTicket, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select('id')
      .single();

    if (error) {
      showToast('Error al crear ticket', 'error');
      return;
    }

    if (createdTicket?.id && initialComment.trim()) {
      await supabase.from('ticket_comments').insert({
        ticket_id: createdTicket.id,
        user_id: user?.id,
        user_name: user?.name,
        user_email: user?.email,
        comment: initialComment.trim(),
        is_internal: false,
      });
    }

    if (createdTicket?.id && pendingAttachments.length > 0) {
      await uploadTicketAttachments(createdTicket.id);
    }

    if (webchatDraft?.conversationId) {
      await supabase.from('webchat_messages').insert({
        conversation_id: webchatDraft.conversationId,
        sender_type: 'agent',
        sender_id: user?.id || null,
        sender_name: user?.name || user?.email || null,
        message: `Ticket creado: ${ticketData.ticket_number}`,
        attachments: []
      });
      await supabase
        .from('webchat_conversations')
        .update({ result: 'Derivado a ticket', updated_at: new Date().toISOString() })
        .eq('id', webchatDraft.conversationId);
      setWebchatDraft(null);
    }

    showToast('Ticket creado exitosamente', 'success');
    loadTickets();
    resetForm();
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) return;

    await ensureCurrentUserInSystemUsers();

    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: selectedTicket.id,
      user_id: user?.id,
      user_name: user?.name,
      user_email: user?.email,
      comment: newComment,
      is_internal: isInternalComment
    });

    if (error) {
      showToast('Error al agregar comentario', 'error');
      return;
    }

    showToast('Comentario agregado', 'success');
    setNewComment('');
    setIsInternalComment(false);
    loadComments(selectedTicket.id);
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    const updateData: any = { status: newStatus, updated_by: user?.id };
    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase.from('tickets').update(updateData).eq('id', ticketId);

    if (error) {
      showToast('Error al actualizar estado', 'error');
      return;
    }

    showToast(`Ticket ${newStatus === 'closed' ? 'cerrado' : 'actualizado'}`, 'success');
    loadTickets();
    if (selectedTicket?.id === ticketId) {
      const updated = tickets.find(t => t.id === ticketId);
      if (updated) setSelectedTicket({ ...updated, status: newStatus as any });
      loadActivities(ticketId);
    }
  };

  const handleAssignUser = async (ticketId: string, userId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: userId || null, updated_by: user?.id })
      .eq('id', ticketId);

    if (error) {
      showToast('Error al asignar usuario', 'error');
      return;
    }

    showToast('Usuario asignado correctamente', 'success');
    loadTickets();
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) => (prev ? { ...prev, assigned_to: userId || null } : prev));
      loadActivities(ticketId);
    }
  };

  const handleUpdateDueDate = async (ticketId: string, dueDate: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ due_date: dueDate || null, updated_by: user?.id })
      .eq('id', ticketId);

    if (error) {
      showToast('Error al actualizar fecha fin', 'error');
      return;
    }

    setSelectedTicket((prev) => (prev ? { ...prev, due_date: dueDate || null } : prev));
    loadTickets();
    loadActivities(ticketId);
    showToast('Fecha fin actualizada', 'success');
  };

  const extractStoragePathFromPublicUrl = (publicUrl: string): string | null => {
    const marker = '/webchat-attachments/';
    const markerIndex = publicUrl.indexOf(marker);
    if (markerIndex === -1) return null;

    const encodedPath = publicUrl.slice(markerIndex + marker.length);
    if (!encodedPath) return null;

    return decodeURIComponent(encodedPath.split('?')[0]);
  };

  const handleUpdateTicketClient = async (ticketId: string, clientId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ client_id: clientId, updated_by: user?.id })
      .eq('id', ticketId);

    if (error) {
      showToast('Error al actualizar cliente del ticket', 'error');
      return;
    }

    const selectedClient = clients.find((client) => client.id === clientId);
    setSelectedTicket((prev) => {
      if (!prev || prev.id !== ticketId) return prev;
      return {
        ...prev,
        client_id: clientId,
        clients: selectedClient
          ? {
              company_name: selectedClient.company_name || '',
              contact_name: selectedClient.contact_name || '',
              email: selectedClient.email || '',
              phone: selectedClient.phone || ''
            }
          : prev.clients
      };
    });

    loadTickets();
    showToast('Cliente actualizado', 'success');
  };

  const handleUploadDetailAttachments = async (ticketId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setDetailUploadingAttachments(true);
    try {
      const inputFiles = Array.from(files);
      const rowsToInsert: Array<{
        ticket_id: string;
        file_name: string;
        file_url: string;
        file_size: number;
        file_type: string | null;
        uploaded_by: string | null | undefined;
      }> = [];

      for (let index = 0; index < inputFiles.length; index += 1) {
        const file = inputFiles[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `tickets/${ticketId}/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('webchat-attachments')
          .upload(filePath, file, { upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage.from('webchat-attachments').getPublicUrl(filePath);
        rowsToInsert.push({
          ticket_id: ticketId,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: user?.id
        });
      }

      const { error: insertError } = await supabase.from('ticket_attachments').insert(rowsToInsert);
      if (insertError) {
        throw new Error(insertError.message);
      }

      await loadAttachments(ticketId);
      showToast('Adjuntos agregados correctamente', 'success');
    } catch {
      showToast('No se pudieron agregar los adjuntos', 'error');
    } finally {
      setDetailUploadingAttachments(false);
    }
  };

  const handleDeleteAttachment = async (attachment: TicketAttachment) => {
    if (!selectedTicket) return;

    const confirmed = window.confirm(`¿Eliminar adjunto "${attachment.file_name}"?`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from('ticket_attachments').delete().eq('id', attachment.id);
    if (deleteError) {
      showToast('No se pudo eliminar el adjunto', 'error');
      return;
    }

    const storagePath = extractStoragePathFromPublicUrl(attachment.file_url);
    if (storagePath) {
      await supabase.storage.from('webchat-attachments').remove([storagePath]);
    }

    await loadAttachments(selectedTicket.id);
    showToast('Adjunto eliminado', 'success');
  };

  const resetForm = () => {
    const defaultStatus = ticketStatuses[0]?.code || fallbackTicketStatuses[0].code;

    setFormData({
      ticket_number: '',
      client_id: '',
      subject: '',
      description: '',
      priority: 'medium',
      status: defaultStatus,
      category_id: '',
      assigned_to: '',
      due_date: calculateDueDateByPriority('medium'),
      tags: '',
      estimated_hours: String(calculateEstimatedHoursByPriority('medium'))
    });
    setUserSearchTerm('');
    setClientSearchTerm('');
    setFilteredClients(clients);
    setInitialComment('');
    setPendingAttachments([]);
    setDraftSourceModule(null);
    setDraftSourceContact(null);
    setDraftOrderId(null);
    setDraftRichDescription(null);
    setShowUserDropdown(false);
    setShowClientDropdown(false);
    setTicketPreviewNumber('');
    setShowModal(false);
  };

  const openCreateModal = () => {
    const defaultStatus = ticketStatuses[0]?.code || fallbackTicketStatuses[0].code;
    setFormData((prev) => ({
      ...prev,
      status: prev.status || defaultStatus,
      assigned_to: prev.assigned_to || '',
      due_date: prev.due_date || calculateDueDateByPriority(prev.priority),
      estimated_hours: prev.estimated_hours || String(calculateEstimatedHoursByPriority(prev.priority))
    }));
    setTicketPreviewNumber(generateTicketNumber());
    setFilteredClients(clients);
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal || !formData.client_id || clientSearchTerm.trim()) return;
    const selectedClient = clients.find((client) => client.id === formData.client_id);
    if (!selectedClient) return;
    setClientSearchTerm(selectedClient.company_name || selectedClient.contact_name || selectedClient.email || '');
  }, [showModal, formData.client_id, clientSearchTerm, clients]);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setAssigneeSearchTerm('');
    setShowAssigneeDropdown(false);
    loadComments(ticket.id);
    loadHistory(ticket.id);
    loadActivities(ticket.id);
    loadAttachments(ticket.id);
    setShowDetailModal(true);
  };

  useEffect(() => {
    if (!showDetailModal || !selectedTicket) return;
    const assignedUser = users.find((u) => u.id === selectedTicket.assigned_to);
    setAssigneeSearchTerm(assignedUser?.name || '');
  }, [showDetailModal, selectedTicket, users]);

  useEffect(() => {
    if (!showDetailModal || !selectedTicket) return;
    setDetailDueDate(toDateInputValue(selectedTicket.due_date));
  }, [showDetailModal, selectedTicket]);

  useEffect(() => {
    if (!showDetailModal || !selectedTicket) return;
    const clientLabel =
      selectedTicket.clients?.company_name ||
      selectedTicket.clients?.contact_name ||
      selectedTicket.clients?.email ||
      '';
    setDetailClientSearchTerm(clientLabel);
  }, [showDetailModal, selectedTicket]);
  // Notificación en tiempo real de cambios/comentarios
  useEffect(() => {
    if (!selectedTicket) return;
    // Import dinámico para evitar error SSR
    import('../../hooks/useTicketNotification').then(({ useTicketNotification }) => {
      useTicketNotification(selectedTicket.id, (payload) => {
        setNotifyPayload(payload);
        if (payload.type === 'comment') {
          loadComments(selectedTicket.id);
        } else if (payload.type === 'status') {
          loadHistory(selectedTicket.id);
        }
      });
    });
    // eslint-disable-next-line
  }, [selectedTicket]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusConfig = (statusCode: string) => {
    const config = ticketStatuses.find((item) => item.code === statusCode);
    if (config) return config;

    const fallbackMap: Record<string, { name: string; color: string }> = {
      open: { name: 'Abierto', color: '#ef4444' },
      in_progress: { name: 'En Progreso', color: '#3b82f6' },
      waiting: { name: 'En Espera', color: '#eab308' },
      resolved: { name: 'Resuelto', color: '#10b981' },
      closed: { name: 'Cerrado', color: '#64748b' },
    };

    const fallback = fallbackMap[statusCode] || { name: statusCode.replace(/_/g, ' '), color: '#64748b' };
    return { id: `fallback-${statusCode}`, code: statusCode, name: fallback.name, color: fallback.color, sort_order: 999, is_active: true };
  };

  const getStatusLabel = (statusCode: string) => getStatusConfig(statusCode).name;

  const isClosedStatus = (statusCode: string) => ['resolved', 'closed'].includes(statusCode);

  const getStatusBadgeStyle = (statusCode: string) => {
    const { color } = getStatusConfig(statusCode);
    return {
      borderColor: color,
      color,
      backgroundColor: `${color}20`,
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'waiting': return <AlertTriangle className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getCategoryIcon = (iconName: string | undefined) => {
    const icons: any = {
      'AlertCircle': AlertCircle,
      'HelpCircle': HelpCircle,
      'GitPullRequest': GitPullRequest,
      'Bug': Bug,
      'BookOpen': BookOpen,
      'AlertTriangle': AlertTriangle
    };
    const Icon = icons[iconName || 'AlertCircle'];
    return Icon ? <Icon className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />;
  };

  const totalCount = filteredTickets.length;
  const completedCount = filteredTickets.filter((ticket) => isClosedStatus(ticket.status)).length;
  const inProgressCount = filteredTickets.filter((ticket) => !isClosedStatus(ticket.status)).length;
  const urgentCount = filteredTickets.filter((ticket) => ['high', 'urgent'].includes(ticket.priority)).length;

  const overdueCount = filteredTickets.filter((ticket) => {
    if (!ticket.due_date) return false;
    return new Date(ticket.due_date) < new Date() && !isClosedStatus(ticket.status);
  }).length;

  const unassignedCount = filteredTickets.filter((ticket) => !ticket.assigned_to).length;

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectedTicketNextStatuses = selectedTicket
    ? ticketStatuses.filter((status) => status.code !== selectedTicket.status).slice(0, 4)
    : [];

  const getAssignedUserLabel = (assignedTo: string | null) => {
    if (!assignedTo) return 'Sin asignar';
    const assignedUser = users.find((item) => item.id === assignedTo);
    return assignedUser?.name || 'Sin asignar';
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Tickets de Soporte</h1>
          <p className="text-slate-600 mt-2">Gestiona y resuelve tickets de clientes</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Nuevo Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-indigo-500 p-3 rounded-xl">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{totalCount}</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Total tickets</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-emerald-500 p-3 rounded-xl">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{completedCount}</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Completados</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-500 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{inProgressCount}</span>
          </div>
          <p className="text-sm font-medium text-slate-600">En gestión</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-amber-500 p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{urgentCount}</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Alta/Urgente</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-rose-500 p-3 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{overdueCount}</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Vencidos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {ticketStatuses.slice(0, 4).map((status) => (
          <div key={status.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: status.color }}>
                {getStatusIcon(status.code) || <Ticket className="w-6 h-6 text-white" />}
              </div>
              <span className="text-3xl font-bold text-slate-900">{filteredTickets.filter((ticket) => ticket.status === status.code).length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">{status.name}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar tickets por número, asunto, cliente..."
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              {ticketStatuses.map((status) => (
                <option key={status.id} value={status.code}>{status.name}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las prioridades</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <select
              value={filterAssignedTo}
              onChange={(e) => setFilterAssignedTo(e.target.value)}
              className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los asignados</option>
              <option value="unassigned">Sin asignar</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Solo vencidos
            </label>
          </div>
          <div className="mt-4 text-sm text-slate-600 flex items-center gap-6">
            <span>Total: <strong>{filteredTickets.length}</strong></span>
            <span>Sin asignar: <strong>{unassignedCount}</strong></span>
            <span>Vencidos: <strong>{overdueCount}</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-800 mb-1">No se encontraron tickets</h3>
              <p className="text-sm text-slate-600">Intenta ajustar la búsqueda o los filtros.</p>
            </div>
          ) : (
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Asignado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vencimiento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedTickets.map((ticket) => {
                  const statusStyle = getStatusBadgeStyle(ticket.status);
                  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && !isClosedStatus(ticket.status);

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: ticket.ticket_categories?.color ? `${ticket.ticket_categories.color}20` : '#f1f5f9' }}
                          >
                            {ticket.ticket_categories ? getCategoryIcon(ticket.ticket_categories.icon) : <AlertCircle className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500 font-mono">{ticket.ticket_number}</p>
                            <p className="text-sm font-semibold text-slate-900 truncate max-w-[300px]">{ticket.subject}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[320px]">{stripHtmlTags(ticket.description || '')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {ticket.clients?.company_name || ticket.clients?.contact_name || 'Sin cliente'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${getSourceBadgeClass(ticket.source_module)}`}>
                          {getSourceLabel(ticket.source_module)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
                          style={statusStyle}
                        >
                          {getStatusIcon(ticket.status)}
                          {getStatusLabel(ticket.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{getAssignedUserLabel(ticket.assigned_to)}</td>
                      <td className="px-4 py-4 text-sm">
                        {ticket.due_date ? (
                          <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                            {new Date(ticket.due_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin fecha</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-lg">
                      {ticketPreviewNumber || 'TKT-XXXXXX-XXX'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border"
                      style={getStatusBadgeStyle(formData.status)}
                    >
                      {getStatusIcon(formData.status)}
                      {getStatusLabel(formData.status)}
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${getPriorityColor(formData.priority)}`}>
                      {formData.priority.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Nuevo Ticket de Soporte</h2>
                  <p className="text-slate-300 mt-1 text-sm">Complete toda la información necesaria para registrar el ticket</p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Descripción</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto *</label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="Resumen breve del problema"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Descripción Detallada *</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={7}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="Describe el problema en detalle..."
                          required
                        />
                      </div>
                      {draftSourceModule === 'email' && draftRichDescription && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Vista previa del correo</label>
                          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                            <div
                              className="prose prose-sm max-w-none break-words"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtmlForTicketView(draftRichDescription) }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Historial / Comentarios</h3>
                    <textarea
                      value={initialComment}
                      onChange={(e) => setInitialComment(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="Comentario inicial para el historial (opcional)"
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Actividades / Cambios de estado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Estado inicial</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        >
                          {ticketStatuses.map((status) => (
                            <option key={status.id} value={status.code}>{status.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Categoría</label>
                        <select
                          value={formData.category_id}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        >
                          <option value="">Sin categoría</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Asignado</h3>
                    <div className="relative user-dropdown-container">
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        onFocus={() => setShowUserDropdown(true)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Buscar usuario por nombre o email..."
                      />
                      {showUserDropdown && filteredUsers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border-2 border-slate-300 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {filteredUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, assigned_to: u.id });
                                setUserSearchTerm(u.name);
                                setShowUserDropdown(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                            >
                              <div className="font-medium text-slate-900">{u.name}</div>
                              <div className="text-xs text-slate-500">{u.email} • {u.role}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">SLA</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Prioridad *</label>
                        <select
                          value={formData.priority}
                          onChange={(e) => handlePriorityChange(e.target.value as Ticket['priority'])}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        >
                          <option value="low">🟢 Baja</option>
                          <option value="medium">🟡 Media</option>
                          <option value="high">🟠 Alta</option>
                          <option value="urgent">🔴 Urgente</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha de vencimiento</label>
                        <input
                          type="date"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Horas estimadas</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formData.estimated_hours}
                          onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Cliente</h3>
                    <div className="relative client-dropdown-container">
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleClientSearch(value);
                          if (!value.trim()) {
                            setFormData((prev) => ({ ...prev, client_id: '' }));
                          }
                        }}
                        onFocus={() => {
                          setFilteredClients(clients);
                          setShowClientDropdown(true);
                        }}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Buscar por nombre, teléfono o correo"
                        required
                      />
                      {showClientDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                          {filteredClients.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-500">Sin resultados</p>
                          ) : (
                            filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, client_id: client.id });
                                  setClientSearchTerm(client.company_name || client.contact_name || client.email || '');
                                  setShowClientDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                              >
                                <div className="font-medium text-slate-900">{client.company_name || client.contact_name || 'Sin nombre'}</div>
                                <div className="text-xs text-slate-500">
                                  {client.contact_name || 'Sin contacto'}
                                  {client.email ? ` • ${client.email}` : ''}
                                  {client.phone ? ` • ${client.phone}` : ''}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Etiquetas</label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="bug, urgente"
                      />
                    </div>
                    {draftSourceContact && (
                      <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-700">Contacto origen ({draftSourceContact.module})</p>
                        {draftSourceContact.name && <p>Nombre: {draftSourceContact.name}</p>}
                        {draftSourceContact.email && <p>Email: {draftSourceContact.email}</p>}
                        {draftSourceContact.phone && <p>Teléfono: {draftSourceContact.phone}</p>}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Archivos adjuntos</h3>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        addPendingAttachments(e.target.files);
                        e.currentTarget.value = '';
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                    />
                    {pendingAttachments.length === 0 ? (
                      <p className="text-sm text-slate-500 mt-3">Aún no hay archivos seleccionados.</p>
                    ) : (
                      <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                        {pendingAttachments.map((file, index) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-slate-900 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingAttachment(index)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 sticky bottom-0 bg-slate-50">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white hover:border-slate-400 transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingAttachments}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-semibold shadow-lg flex items-center gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  {uploadingAttachments ? 'Subiendo adjuntos...' : 'Crear Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex-shrink-0 border-b border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-lg">
                      {selectedTicket.ticket_number}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border"
                      style={getStatusBadgeStyle(selectedTicket.status)}
                    >
                      {getStatusIcon(selectedTicket.status)}
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-4 text-sm text-white/80">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Descripción</h3>
                    {hasHtmlContent(selectedTicket.description || '') ? (
                      <div
                        className="prose max-w-none text-sm text-slate-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtmlForTicketView(selectedTicket.description || '') }}
                      />
                    ) : (
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Historial / Comentarios</h3>
                    <div className="space-y-4 mb-6 max-h-72 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No hay comentarios aún</p>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className={`rounded-xl p-4 ${comment.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {comment.user_name || 'Usuario Desconocido'}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {comment.user_email || 'Sin email'}
                                  </span>
                                </div>
                                {comment.is_internal && (
                                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                                    Interno
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {history.length > 0 && (
                      <div className="mb-6 border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">Eventos de historial</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {history.map((event) => (
                            <div key={event.id} className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              {event.action || event.event || 'Cambio registrado'}
                              {event.created_at && (
                                <span className="ml-2 text-slate-400">{new Date(event.created_at).toLocaleString()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-4">
                      <div className="mb-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={(e) => setIsInternalComment(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Comentario interno (no visible para el cliente)
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escribe un comentario..."
                          rows={3}
                          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleAddComment();
                            }
                          }}
                        />
                        <button
                          onClick={handleAddComment}
                          className="px-6 h-fit bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-2 font-medium shadow-lg"
                        >
                          <Send className="w-4 h-4" />
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Actividades / Cambios de estado</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {activities.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No hay actividad registrada</p>
                      ) : (
                        activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Activity className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-900">
                                <span className="font-semibold">{activity.action}</span>
                                {activity.field_changed && (
                                  <>
                                    {' - '}
                                    <span className="text-slate-600">
                                      {activity.field_changed}: {activity.old_value} → {activity.new_value}
                                    </span>
                                  </>
                                )}
                              </p>
                              {activity.description && (
                                <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                              )}
                              <span className="text-xs text-slate-500 mt-1 block">
                                {new Date(activity.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Asignado</h3>
                    <div className="relative assignee-dropdown-container">
                      <div className="relative">
                        <input
                          type="text"
                          value={assigneeSearchTerm}
                          onChange={(e) => {
                            setAssigneeSearchTerm(e.target.value);
                            setShowAssigneeDropdown(true);
                          }}
                          onFocus={() => setShowAssigneeDropdown(true)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-10"
                          placeholder="Buscar usuario..."
                        />
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>

                      {showAssigneeDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              handleAssignUser(selectedTicket.id, '');
                              setAssigneeSearchTerm('');
                              setShowAssigneeDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100"
                          >
                            <div className="font-medium text-slate-900">Sin asignar</div>
                            <div className="text-xs text-slate-500">Quitar asignación</div>
                          </button>
                          {users
                            .filter((u) => {
                              const term = assigneeSearchTerm.trim().toLowerCase();
                              if (!term) return true;
                              return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                            })
                            .map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  handleAssignUser(selectedTicket.id, u.id);
                                  setAssigneeSearchTerm(u.name);
                                  setShowAssigneeDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                              >
                                <div className="font-medium text-slate-900">{u.name}</div>
                                <div className="text-xs text-slate-500">{u.email} • {u.role}</div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">SLA</h3>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="text-slate-500">Vencimiento: </span>
                        {selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString() : 'Sin fecha'}
                      </p>
                      <p>
                        <span className="text-slate-500">Estado SLA: </span>
                        {selectedTicket.due_date && new Date(selectedTicket.due_date) < new Date() && !isClosedStatus(selectedTicket.status)
                          ? <span className="text-rose-600 font-semibold">Vencido</span>
                          : <span className="text-emerald-600 font-semibold">En tiempo</span>}
                      </p>
                      <p>
                        <span className="text-slate-500">Horas estimadas: </span>
                        {selectedTicket.estimated_hours ? `${selectedTicket.estimated_hours}h` : 'Sin definir'}
                      </p>
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <label className="block text-xs font-semibold text-slate-600">Fecha fin (editable)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={detailDueDate}
                            onChange={(e) => setDetailDueDate(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateDueDate(selectedTicket.id, detailDueDate)}
                            disabled={!detailDueDate}
                            className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Cliente</h3>
                    <div className="relative detail-client-dropdown-container">
                      <input
                        type="text"
                        value={detailClientSearchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDetailClientSearchTerm(value);
                          setShowDetailClientDropdown(true);
                        }}
                        onFocus={() => setShowDetailClientDropdown(true)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Buscar cliente por nombre, teléfono o correo"
                      />
                      {showDetailClientDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                          {clients
                            .filter((client) => {
                              const term = detailClientSearchTerm.trim().toLowerCase();
                              if (!term) return true;
                              return (
                                (client.contact_name || '').toLowerCase().includes(term) ||
                                (client.company_name || '').toLowerCase().includes(term) ||
                                (client.email || '').toLowerCase().includes(term) ||
                                (client.phone || '').toLowerCase().includes(term)
                              );
                            })
                            .slice(0, 50)
                            .map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  handleUpdateTicketClient(selectedTicket.id, client.id);
                                  setDetailClientSearchTerm(client.company_name || client.contact_name || client.email || '');
                                  setShowDetailClientDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                              >
                                <div className="font-medium text-slate-900">{client.company_name || client.contact_name || 'Sin nombre'}</div>
                                <div className="text-xs text-slate-500">
                                  {client.contact_name || 'Sin contacto'}
                                  {client.email ? ` • ${client.email}` : ''}
                                  {client.phone ? ` • ${client.phone}` : ''}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-slate-700 mt-3">
                      <p className="font-medium text-slate-900">{selectedTicket.clients?.company_name || selectedTicket.clients?.contact_name || 'Sin cliente'}</p>
                      <p>{selectedTicket.clients?.email || 'Sin email'}</p>
                      {selectedTicket.clients?.phone && <p>{selectedTicket.clients.phone}</p>}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Archivos adjuntos</h3>
                    <div className="mb-3">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          handleUploadDetailAttachments(selectedTicket.id, e.target.files);
                          e.currentTarget.value = '';
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={detailUploadingAttachments}
                      />
                      {detailUploadingAttachments && (
                        <p className="text-xs text-slate-500 mt-2">Subiendo adjuntos...</p>
                      )}
                    </div>
                    {attachments.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay adjuntos en este ticket.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {attachments.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm text-blue-600 hover:underline min-w-0 truncate"
                            >
                              {file.file_name}
                              {file.file_size ? ` · ${(file.file_size / 1024).toFixed(1)} KB` : ''}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(file)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Cambiar estado</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicketNextStatuses.map((status) => (
                        <button
                          key={status.id}
                          onClick={() => handleUpdateStatus(selectedTicket.id, status.code)}
                          className="px-3 py-1.5 text-xs rounded-lg border transition font-medium"
                          style={getStatusBadgeStyle(status.code)}
                        >
                          {status.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
