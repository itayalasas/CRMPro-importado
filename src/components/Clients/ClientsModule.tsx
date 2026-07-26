import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import {
  Plus, Search, Edit2, Trash2, Mail, Phone, MapPin, TrendingUp,
  DollarSign, ShoppingCart, FileText, Activity, Users, Building2, X,
  Star, Globe, Calendar, User, Briefcase, Tag, ChevronLeft, ChevronRight,
  Eye, CheckCircle2, Clock3, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDialer } from '../../contexts/DialerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { PermissionGate } from '../Common/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  ClientInteractionRecord,
  formatClientActivityDate,
  getClientActivityMeta,
  getClientActivityType,
} from '../../lib/clientActivity';

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'prospect';
  address: string;
  city: string;
  country: string;
  created_at: string;
}

interface ClientStats {
  quoteValue: number;
  quoteCount: number;
  orderValue: number;
  orderCount: number;
}

interface ClientTaskPreview {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ClientQuotePreview {
  id: string;
  quote_number: string;
  status: string;
  total_amount: number | string;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ClientOrderPreview {
  id: string;
  order_number: string;
  status: string;
  total_amount: number | string;
  currency: string;
  created_at: string;
}

const quoteRevenueStatuses = ['draft', 'sent', 'accepted', 'converted'];
type ClientDetailTab = 'summary' | 'timeline' | 'tasks' | 'quotes' | 'orders';

const createEmptyClientStats = (): ClientStats => ({
  quoteValue: 0,
  quoteCount: 0,
  orderValue: 0,
  orderCount: 0,
});

export function ClientsModule() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});
  const [overallStats, setOverallStats] = useState({
    total: 0,
    active: 0,
    prospects: 0,
    inactive: 0,
    newThisMonth: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const { user } = useAuth();
  const toast = useToast();
  const { initiateCall } = useDialer();
  const { navigateToInbox, setActiveModule } = useNavigation();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    status: 'prospect' as const
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    clientId: string | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    clientId: null
  });

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientTab, setSelectedClientTab] = useState<ClientDetailTab>('summary');
  const [clientTimeline, setClientTimeline] = useState<ClientInteractionRecord[]>([]);
  const [clientTasks, setClientTasks] = useState<ClientTaskPreview[]>([]);
  const [clientQuotes, setClientQuotes] = useState<ClientQuotePreview[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrderPreview[]>([]);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      loadClients();
    };
    initialize();

    const quoteChannel = supabase
      .channel('client-quote-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_quotes'
        },
        (payload) => {
          const clientId =
            (payload.new as { client_id?: string } | null)?.client_id ||
            (payload.old as { client_id?: string } | null)?.client_id;

          console.log('[CLIENTS] Quote changed, updating stats:', payload);
          if (clientId) updateClientStats(clientId);
        }
      )
      .subscribe();

    const orderChannel = supabase
      .channel('client-order-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const clientId =
            (payload.new as { client_id?: string } | null)?.client_id ||
            (payload.old as { client_id?: string } | null)?.client_id;

          console.log('[CLIENTS] Order changed, updating stats:', payload);
          if (clientId) updateClientStats(clientId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quoteChannel);
      supabase.removeChannel(orderChannel);
    };
  }, []);

  useEffect(() => {
    const draftRaw = localStorage.getItem('webchat_client_draft');
    if (!draftRaw) return;
    try {
      const draft = JSON.parse(draftRaw);
      setEditingClient(null);
      setFormData((prev) => ({
        ...prev,
        contact_name: draft.contact_name || '',
        email: draft.email || '',
        phone: draft.phone || '',
        company_name: draft.company_name || '',
        status: draft.status || 'prospect'
      }));
      setErrors({});
      setShowModal(true);
    } catch {
      // ignore invalid draft
    } finally {
      localStorage.removeItem('webchat_client_draft');
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClients(data);
      calculateOverallStats(data);
      await loadClientStats(data);
    }
  };

  const calculateOverallStats = (clientsData: Client[]) => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    setOverallStats({
      total: clientsData.length,
      active: clientsData.filter(c => c.status === 'active').length,
      prospects: clientsData.filter(c => c.status === 'prospect').length,
      inactive: clientsData.filter(c => c.status === 'inactive').length,
      newThisMonth: clientsData.filter(c => new Date(c.created_at) >= firstDayThisMonth).length
    });
  };

  const loadClientStats = async (clientsData: Client[]) => {
    const clientIds = clientsData.map((client) => client.id);

    if (clientIds.length === 0) {
      setClientStats({});
      return;
    }

    const stats: Record<string, ClientStats> = {};
    clientIds.forEach((clientId) => {
      stats[clientId] = createEmptyClientStats();
    });

    const [quotesResult, ordersResult] = await Promise.all([
      supabase
        .from('sales_quotes')
        .select('client_id, total_amount, status')
        .in('client_id', clientIds)
        .in('status', quoteRevenueStatuses),
      supabase
        .from('orders')
        .select('client_id, total_amount, status')
        .in('client_id', clientIds)
        .neq('status', 'cancelled')
    ]);

    if (quotesResult.data) {
      for (const quote of quotesResult.data) {
        const clientId = quote.client_id;
        if (!clientId || !stats[clientId]) continue;

        stats[clientId].quoteValue += Number(quote.total_amount || 0);
        stats[clientId].quoteCount += 1;
      }
    }

    if (ordersResult.data) {
      for (const order of ordersResult.data) {
        const clientId = order.client_id;
        if (!clientId || !stats[clientId]) continue;

        stats[clientId].orderValue += Number(order.total_amount || 0);
        stats[clientId].orderCount += 1;
      }
    }

    setClientStats(stats);
  };

  const updateClientStats = async (clientId: string) => {
    const [quoteResult, orderResult] = await Promise.all([
      supabase
        .from('sales_quotes')
        .select('total_amount')
        .eq('client_id', clientId)
        .in('status', quoteRevenueStatuses),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('client_id', clientId)
        .neq('status', 'cancelled')
    ]);

    const updatedStats: ClientStats = {
      quoteValue: quoteResult.data?.reduce((sum, quote) => sum + Number(quote.total_amount || 0), 0) || 0,
      quoteCount: quoteResult.data?.length || 0,
      orderValue: orderResult.data?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0,
      orderCount: orderResult.data?.length || 0,
    };

    setClientStats(prev => ({
      ...prev,
      [clientId]: updatedStats
    }));

    toast?.success('Estadísticas del cliente actualizadas');
  };

  const getLocalDateKey = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const formatMoney = (value: number | string | null | undefined, currency?: string | null) => {
    const amount = Number(value || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const safeCurrency = (currency || '').trim();
    const formatted = new Intl.NumberFormat('es-UY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return safeCurrency ? `${safeCurrency} ${formatted}` : formatted;
  };

  const getQuotePdfUrl = (quote: ClientQuotePreview) => {
    const metadata = quote.metadata && typeof quote.metadata === 'object' ? quote.metadata as Record<string, unknown> : null;
    const communication = metadata && typeof metadata.communication === 'object'
      ? metadata.communication as Record<string, unknown>
      : null;

    const directUrl = communication && typeof communication.pdf_public_url === 'string'
      ? communication.pdf_public_url.trim()
      : '';
    if (directUrl) return directUrl;

    const responsePayload = communication && typeof communication.response_payload === 'object'
      ? communication.response_payload as Record<string, unknown>
      : null;

    return responsePayload && typeof responsePayload.pdf_public_url === 'string'
      ? responsePayload.pdf_public_url.trim()
      : '';
  };

  const loadClientDetail = async (clientId: string) => {
    setClientDetailLoading(true);

    const [timelineResult, tasksResult, quotesResult, ordersResult] = await Promise.all([
      supabase
        .from('client_interactions')
        .select('id, type, description, metadata, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('crm_tasks')
        .select('id, task_number, title, description, task_type, priority, status, due_at, scheduled_at, completed_at, created_at')
        .eq('client_id', clientId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('sales_quotes')
        .select('id, quote_number, status, total_amount, currency, metadata, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('orders')
        .select('id, order_number, status, total_amount, currency, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    if (timelineResult.error) {
      console.error('[CLIENTS] No se pudo cargar el timeline del cliente:', timelineResult.error);
    }
    if (tasksResult.error) {
      console.error('[CLIENTS] No se pudieron cargar las tareas del cliente:', tasksResult.error);
    }
    if (quotesResult.error) {
      console.error('[CLIENTS] No se pudieron cargar las cotizaciones del cliente:', quotesResult.error);
    }
    if (ordersResult.error) {
      console.error('[CLIENTS] No se pudieron cargar las órdenes del cliente:', ordersResult.error);
    }

    setClientTimeline((timelineResult.data || []) as ClientInteractionRecord[]);
    setClientTasks((tasksResult.data || []) as ClientTaskPreview[]);
    setClientQuotes((quotesResult.data || []) as ClientQuotePreview[]);
    setClientOrders((ordersResult.data || []) as ClientOrderPreview[]);
    setClientDetailLoading(false);
  };

  const openClientDetail = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedClientTab('summary');
  };

  const closeClientDetail = () => {
    setSelectedClientId(null);
    setSelectedClientTab('summary');
    setClientTimeline([]);
    setClientTasks([]);
    setClientQuotes([]);
    setClientOrders([]);
  };

  const openAgendaForClient = (client: Client) => {
    const label = client.company_name || client.contact_name || 'Cliente';
    localStorage.setItem('crm_task_draft', JSON.stringify({
      client_id: client.id,
      title: `Seguimiento con ${label}`,
      description: `Seguimiento comercial con ${label}`,
      task_type: 'follow_up',
      priority: 'medium',
      status: 'open',
      due_date: getLocalDateKey(1),
      scheduled_date: getLocalDateKey(1),
    }));
    setActiveModule('agenda');
  };

  const selectedClient = selectedClientId
    ? clients.find((client) => client.id === selectedClientId) || null
    : null;

  const taskStatusLabels: Record<string, string> = {
    open: 'Abierta',
    in_progress: 'En progreso',
    waiting: 'Esperando',
    done: 'Hecha',
    cancelled: 'Cancelada',
  };

  const quoteStatusLabels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    expired: 'Vencida',
    converted: 'Convertida',
  };

  const orderStatusLabels: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'En proceso',
    shipped: 'Enviada',
    delivered: 'Entregada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };

  const getTaskStatusTone = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'waiting':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  const selectedClientStats = selectedClient
    ? clientStats[selectedClient.id] || createEmptyClientStats()
    : createEmptyClientStats();

  useEffect(() => {
    if (!selectedClientId) return;
    void loadClientDetail(selectedClientId);
  }, [selectedClientId]);

  useEffect(() => {
    const pendingClientId = localStorage.getItem('crm_client_detail');
    if (!pendingClientId) return;

    localStorage.removeItem('crm_client_detail');
    setSelectedClientId(pendingClientId);
    setSelectedClientTab('summary');
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim() && !formData.contact_name.trim()) {
      newErrors.contact_name = 'Debe ingresar al menos el nombre del contacto o empresa';
    }

    if (!formData.contact_name.trim() && !formData.company_name.trim()) {
      newErrors.company_name = 'Debe ingresar al menos el nombre del contacto o empresa';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Teléfono inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({ ...formData, updated_by: user?.id })
          .eq('id', editingClient.id);

        if (error) {
          toast.error(`Error al actualizar: ${error.message}`);
          return;
        }

        toast.success('Cliente actualizado correctamente');
        loadClients();
        resetForm();
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({ ...formData, created_by: user?.id });

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          return;
        }

        toast.success('Cliente creado correctamente');
        loadClients();
        resetForm();
      }
    } catch (err) {
      toast.error('Error inesperado al guardar el cliente');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar cliente?',
      message: 'Este cliente se eliminará permanentemente junto con todos sus datos asociados.',
      clientId: id
    });
  };

  const confirmDelete = async () => {
    if (confirmDialog.clientId) {
      const { error } = await supabase.from('clients').delete().eq('id', confirmDialog.clientId);
      if (error) {
        toast.error('Error al eliminar el cliente');
      } else {
        toast.success('Cliente eliminado correctamente');
        loadClients();
      }
    }
    setConfirmDialog({ isOpen: false, title: '', message: '', clientId: null });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      status: client.status
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      status: 'prospect'
    });
    setEditingClient(null);
    setShowModal(false);
    setErrors({});
  };

  const filteredClients = clients.filter(client =>
    (client.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'neutral';
      case 'prospect': return 'info';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✓';
      case 'inactive': return '○';
      case 'prospect': return '★';
      default: return '○';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Gestión de Clientes"
        subtitle="Administra tu cartera de clientes y sus métricas"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard color="brand" icon={<Users />} label="Total Clientes" value={overallStats.total} />
        <StatCard color="success" icon={<TrendingUp />} label="Activos" value={overallStats.active} />
        <StatCard color="info" icon={<Star />} label="Prospectos" value={overallStats.prospects} />
        <StatCard color="neutral" icon={<Activity />} label="Inactivos" value={overallStats.inactive} />
        <StatCard color="warning" icon={<Calendar />} label="Nuevos (mes)" value={overallStats.newThisMonth} />
      </div>

      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por empresa, contacto o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
          <PermissionGate module="clientes" permission="create">
            <Button onClick={() => setShowModal(true)} icon={<Plus className="w-5 h-5" />}>
              Nuevo Cliente
            </Button>
          </PermissionGate>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map((client) => (
          <Card key={client.id} hover className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand-500 to-accent-500" />

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${client.company_name ? 'from-brand-500 to-brand-600' : 'from-accent-500 to-accent-600'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {client.company_name ? <Building2 className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                      {client.company_name || client.contact_name}
                    </h3>
                    {client.company_name && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-1">
                        <User className="w-3 h-3 mr-1" />
                        {client.contact_name}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(client.status)}>
                  {getStatusIcon(client.status)} {client.status === 'active' ? 'Activo' : client.status === 'prospect' ? 'Prospecto' : 'Inactivo'}
                </Badge>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-slate-600 dark:text-slate-300 group">
                  <button
                    onClick={() => navigateToInbox(client.email, {
                      clientId: client.id,
                      emailSubject: `Seguimiento de ${client.company_name || client.contact_name}`,
                    })}
                    className="flex items-center hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex-1"
                    title="Enviar correo"
                  >
                    <Mail className="w-4 h-4 mr-3 text-brand-500 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{client.email}</span>
                  </button>
                </div>
                {client.phone && (
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-300 group">
                    <button
                      onClick={() => initiateCall(client.phone, {
                        id: client.id,
                        company_name: client.company_name,
                        contact_name: client.contact_name,
                        email: client.email,
                        phone: client.phone,
                      })}
                      className="flex items-center hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-1"
                      title="Llamar ahora"
                    >
                      <Phone className="w-4 h-4 mr-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span>{client.phone}</span>
                    </button>
                  </div>
                )}
                {(client.city || client.country) && (
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 mr-3 text-amber-500" />
                    <span>{[client.city, client.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              {clientStats[client.id] && (
                <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ingresos</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      ${clientStats[client.id].quoteValue.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <ShoppingCart className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Órdenes</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      ${clientStats[client.id].orderValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => openClientDetail(client.id)} icon={<Eye className="w-4 h-4" />}>
                  Detalle
                </Button>
                <PermissionGate module="clientes" permission="update">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 !bg-brand-50 !text-brand-700 !border-brand-200 hover:!bg-brand-100 dark:!bg-brand-500/10 dark:!text-brand-400 dark:!border-brand-500/30"
                    onClick={() => handleEdit(client)}
                    icon={<Edit2 className="w-4 h-4" />}
                  >
                    Editar
                  </Button>
                </PermissionGate>
                <PermissionGate module="clientes" permission="delete">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 !bg-rose-50 !text-rose-700 !border-rose-200 hover:!bg-rose-100 dark:!bg-rose-500/10 dark:!text-rose-400 dark:!border-rose-500/30"
                    onClick={() => handleDelete(client.id)}
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    Eliminar
                  </Button>
                </PermissionGate>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredClients.length > itemsPerPage && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: Math.ceil(filteredClients.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-10 h-10 rounded-xl font-semibold transition-colors ${
                  currentPage === page
                    ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg'
                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(Math.ceil(filteredClients.length / itemsPerPage), currentPage + 1))}
            disabled={currentPage === Math.ceil(filteredClients.length / itemsPerPage)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {selectedClientId && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar detalle del cliente"
            onClick={closeClientDetail}
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Detalle de cliente</p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {selectedClient?.company_name || selectedClient?.contact_name || 'Cargando cliente...'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {selectedClient?.company_name && selectedClient?.contact_name
                      ? selectedClient.contact_name
                      : selectedClient?.email || selectedClient?.phone || 'Sin datos adicionales'}
                  </p>
                </div>
                <button
                  onClick={closeClientDetail}
                  className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Ingresos cotizados</p>
                  <p className="mt-2 text-2xl font-bold">${selectedClientStats.quoteValue.toLocaleString()}</p>
                  <p className="text-sm text-slate-300">{selectedClientStats.quoteCount} cotizaciones</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Ingresos en órdenes</p>
                  <p className="mt-2 text-2xl font-bold">${selectedClientStats.orderValue.toLocaleString()}</p>
                  <p className="text-sm text-slate-300">{selectedClientStats.orderCount} órdenes</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Actividad</p>
                  <p className="mt-2 text-2xl font-bold">{clientTimeline.length}</p>
                  <p className="text-sm text-slate-300">Eventos registrados</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Tareas</p>
                  <p className="mt-2 text-2xl font-bold">{clientTasks.length}</p>
                  <p className="text-sm text-slate-300">Seguimientos y recordatorios</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { key: 'summary', label: 'Resumen' },
                  { key: 'timeline', label: `Timeline (${clientTimeline.length})` },
                  { key: 'tasks', label: `Tareas (${clientTasks.length})` },
                  { key: 'quotes', label: `Cotizaciones (${clientQuotes.length})` },
                  { key: 'orders', label: `Órdenes (${clientOrders.length})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedClientTab(tab.key as ClientDetailTab)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selectedClientTab === tab.key
                        ? 'border-white bg-white text-slate-950 shadow-lg'
                        : 'border-white/15 bg-white/10 text-slate-100 hover:bg-white/15'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {clientDetailLoading && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                  Cargando detalle del cliente...
                </div>
              )}

              {!clientDetailLoading && selectedClientTab === 'summary' && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Información general</h3>
                          <p className="text-sm text-slate-500">Datos de contacto y accesos rápidos.</p>
                        </div>
                        <Badge variant={statusBadgeVariant(selectedClient?.status || 'prospect')}>
                          {selectedClient ? (selectedClient.status === 'active' ? 'Activo' : selectedClient.status === 'prospect' ? 'Prospecto' : 'Inactivo') : 'Sin cargar'}
                        </Badge>
                      </div>

                      <div className="mt-5 space-y-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Contacto</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClient?.contact_name || 'Sin contacto'}</p>
                          <p className="text-sm text-slate-500">{selectedClient?.company_name || 'Sin empresa'}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClient?.email || 'Sin email'}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Teléfono</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClient?.phone || 'Sin teléfono'}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Ubicación</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {[selectedClient?.city, selectedClient?.country].filter(Boolean).join(', ') || 'Sin ubicación'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Creado</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedClient?.created_at ? new Date(selectedClient.created_at).toLocaleDateString('es-UY') : 'Sin fecha'}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Acciones rápidas</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              onClick={() => selectedClient && openAgendaForClient(selectedClient)}
                              disabled={!selectedClient}
                              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Calendar className="h-4 w-4" />
                              Crear tarea
                            </button>
                            <button
                              onClick={() => selectedClient?.email && navigateToInbox(selectedClient.email, {
                                clientId: selectedClient.id,
                                emailSubject: `Seguimiento de ${selectedClient.company_name || selectedClient.contact_name}`,
                              })}
                              disabled={!selectedClient?.email}
                              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Mail className="h-4 w-4" />
                              Enviar email
                            </button>
                            <button
                              onClick={() => selectedClient?.phone && initiateCall(selectedClient.phone, {
                                id: selectedClient.id,
                                company_name: selectedClient.company_name,
                                contact_name: selectedClient.contact_name,
                                email: selectedClient.email,
                                phone: selectedClient.phone,
                              })}
                              disabled={!selectedClient?.phone}
                              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Phone className="h-4 w-4" />
                              Llamar
                            </button>
                            <button
                              onClick={closeClientDetail}
                              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Cerrar panel
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Actividad reciente</h3>
                          <p className="text-sm text-slate-500">Últimos movimientos del cliente.</p>
                        </div>
                        <button
                          onClick={() => setSelectedClientTab('timeline')}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                        >
                          Ver todo
                        </button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {clientTimeline.slice(0, 4).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                            Sin actividad todavía.
                          </div>
                        ) : (
                          clientTimeline.slice(0, 4).map((item) => {
                            const activityMeta = getClientActivityMeta(item);
                            const ActivityIcon = activityMeta.icon;

                            return (
                              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activityMeta.className}`}>
                                    <ActivityIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityMeta.className}`}>
                                        {activityMeta.label}
                                      </span>
                                      <span className="text-xs text-slate-500">{formatClientActivityDate(item.created_at)}</span>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-slate-900">
                                      {item.description || activityMeta.detail}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-3">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Tareas recientes</h3>
                        <button onClick={() => setSelectedClientTab('tasks')} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                          Ver todas
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {clientTasks.slice(0, 3).length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No hay tareas vinculadas.
                          </p>
                        ) : (
                          clientTasks.slice(0, 3).map((task) => (
                            <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                                  <p className="text-xs text-slate-500">{task.task_number}</p>
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTaskStatusTone(task.status)}`}>
                                  {taskStatusLabels[task.status] || task.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {formatClientActivityDate(task.created_at)}
                              </p>
                              <p className="mt-1 text-sm text-slate-700">
                                {task.due_at ? `Vence ${new Date(task.due_at).toLocaleDateString('es-UY')}` : task.scheduled_at ? `Programada ${new Date(task.scheduled_at).toLocaleDateString('es-UY')}` : 'Sin fecha definida'}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Cotizaciones recientes</h3>
                        <button onClick={() => setSelectedClientTab('quotes')} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                          Ver todas
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {clientQuotes.slice(0, 3).length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No hay cotizaciones vinculadas.
                          </p>
                        ) : (
                          clientQuotes.slice(0, 3).map((quote) => {
                            const pdfUrl = getQuotePdfUrl(quote);
                            return (
                              <div key={quote.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{quote.quote_number}</p>
                                    <p className="text-xs text-slate-500">{formatClientActivityDate(quote.created_at)}</p>
                                  </div>
                                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                    {quoteStatusLabels[quote.status] || quote.status}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
                                    <p className="text-sm font-bold text-slate-900">{formatMoney(quote.total_amount, quote.currency)}</p>
                                  </div>
                                  {pdfUrl && (
                                    <button
                                      onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                    >
                                      Ver PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Órdenes recientes</h3>
                        <button onClick={() => setSelectedClientTab('orders')} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                          Ver todas
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {clientOrders.slice(0, 3).length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No hay órdenes vinculadas.
                          </p>
                        ) : (
                          clientOrders.slice(0, 3).map((order) => (
                            <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{order.order_number}</p>
                                  <p className="text-xs text-slate-500">{formatClientActivityDate(order.created_at)}</p>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                  {orderStatusLabels[order.status] || order.status}
                                </span>
                              </div>
                              <div className="mt-3">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
                                <p className="text-sm font-bold text-slate-900">{formatMoney(order.total_amount, order.currency)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {!clientDetailLoading && selectedClientTab === 'timeline' && (
                <div className="space-y-3">
                  {clientTimeline.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      Sin eventos en el timeline.
                    </div>
                  ) : (
                    clientTimeline.map((item) => {
                      const activityMeta = getClientActivityMeta(item);
                      const ActivityIcon = activityMeta.icon;

                      return (
                        <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activityMeta.className}`}>
                              <ActivityIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityMeta.className}`}>
                                  {activityMeta.label}
                                </span>
                                <span className="text-xs text-slate-500">{formatClientActivityDate(item.created_at)}</span>
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-900">
                                {item.description || activityMeta.detail}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!clientDetailLoading && selectedClientTab === 'tasks' && (
                <div className="space-y-3">
                  {clientTasks.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      Sin tareas vinculadas.
                    </div>
                  ) : (
                    clientTasks.map((task) => (
                      <div key={task.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {task.task_number}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {taskStatusLabels[task.status] || task.status}
                              </span>
                            </div>
                            <h3 className="mt-3 text-lg font-bold text-slate-900">{task.title}</h3>
                            {task.description && <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{task.description}</p>}
                          </div>
                          <button
                            onClick={() => selectedClient && openAgendaForClient(selectedClient)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Crear seguimiento
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Tipo</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{task.task_type}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Prioridad</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{task.priority}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Vence</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {task.due_at ? new Date(task.due_at).toLocaleString('es-UY') : task.scheduled_at ? new Date(task.scheduled_at).toLocaleString('es-UY') : 'Sin fecha'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!clientDetailLoading && selectedClientTab === 'quotes' && (
                <div className="space-y-3">
                  {clientQuotes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      Sin cotizaciones vinculadas.
                    </div>
                  ) : (
                    clientQuotes.map((quote) => {
                      const pdfUrl = getQuotePdfUrl(quote);

                      return (
                        <div key={quote.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                  {quote.quote_number}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                  {quoteStatusLabels[quote.status] || quote.status}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-slate-500">{formatClientActivityDate(quote.created_at)}</p>
                              <p className="mt-2 text-lg font-bold text-slate-900">{formatMoney(quote.total_amount, quote.currency)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pdfUrl && (
                                <button
                                  onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  Ver PDF
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedClientTab('summary')}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Volver al resumen
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!clientDetailLoading && selectedClientTab === 'orders' && (
                <div className="space-y-3">
                  {clientOrders.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      Sin órdenes vinculadas.
                    </div>
                  ) : (
                    clientOrders.map((order) => (
                      <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {order.order_number}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {orderStatusLabels[order.status] || order.status}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-500">{formatClientActivityDate(order.created_at)}</p>
                            <p className="mt-2 text-lg font-bold text-slate-900">{formatMoney(order.total_amount, order.currency)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingClient ? 'Actualiza la información del cliente' : 'Completa los datos del nuevo cliente'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="text-white hover:bg-white/20 p-2 rounded-xl transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <User className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Nombre del Contacto *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.contact_name ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="Ej: Juan Pérez"
                  />
                  {errors.contact_name && (
                    <p className="text-red-600 text-xs mt-1">{errors.contact_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2 text-blue-600" />
                    Nombre de la Empresa
                    <span className="text-slate-400 text-xs ml-1">(Opcional para personas físicas)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.company_name ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="Ej: Acme Corporation (dejar vacío si es persona física)"
                  />
                  {errors.company_name && (
                    <p className="text-red-600 text-xs mt-1">{errors.company_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Tag className="w-4 h-4 inline mr-2 text-purple-600" />
                    Estado *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value="prospect">Prospecto</option>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2 text-blue-600" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.email ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="contacto@empresa.com"
                  />
                  {errors.email && (
                    <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.phone ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="+1 234 567 8900"
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2 text-orange-600" />
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Calle Principal 123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2 text-blue-600" />
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Nueva York"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Globe className="w-4 h-4 inline mr-2 text-indigo-600" />
                    País
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Estados Unidos"
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <PermissionGate
                  module="clientes"
                  permission={editingClient ? 'update' : 'create'}
                >
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium"
                  >
                    {editingClient ? 'Actualizar Cliente' : 'Crear Cliente'}
                  </button>
                </PermissionGate>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', clientId: null })}
      />
    </div>
  );
}
