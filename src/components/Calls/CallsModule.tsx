import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { searchUsers } from '../../lib/userService';
import {
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Plus, Clock, User, MessageSquare,
  Ticket, Calendar, Edit2, Trash2, Eye, Volume2, Download, X, UserPlus, Building2, Mail, MapPin,
  RefreshCw, ChevronLeft, ChevronRight, Send, UserCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDialer } from '../../contexts/DialerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { recordClientInteractionSafely } from '../../lib/clientInteractionLogger';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Call {
  id: string;
  client_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: string;
  notes: string;
  created_at: string;
  recording_url?: string;
  recording_sid?: string;
  twilio_call_sid?: string;
  clients?: { company_name: string; contact_name: string; phone: string; email: string };
}

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
}

type ModalMode = 'create' | 'edit' | 'view';

export function CallsModule() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRetryListModal, setShowRetryListModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [callToDelete, setCallToDelete] = useState<Call | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const { user } = useAuth();
  const toast = useToast();
  const { openDialerWithNumber } = useDialer();
  const { setActiveModule } = useNavigation();

  const [formData, setFormData] = useState({
    client_id: '',
    phone_number: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    duration: '',
    status: 'completed',
    notes: ''
  });

  const [newClientData, setNewClientData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: ''
  });

  const [ticketFormData, setTicketFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category_id: '',
    assigned_to: ''
  });

  const [transferFormData, setTransferFormData] = useState({
    assigned_to: '',
    notes: ''
  });

  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    loadCalls();
    loadClients();
    loadCategories();
    loadUsers();
  }, [currentPage]);

  // Suscribirse a cambios en tiempo real para actualizar la lista
  useEffect(() => {
    const channel = supabase
      .channel('calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `caller_id=eq.${user?.id}`
        },
        (payload) => {
          // Recargar las llamadas cuando hay cambios
          loadCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(userSearchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchTerm]);

  const loadCalls = async () => {
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // Filtrar solo las llamadas del usuario logueado
    const { data, count } = await supabase
      .from('calls')
      .select('*, clients(company_name, contact_name, phone, email)', { count: 'exact' })
      .eq('caller_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) setCalls(data);
    if (count) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, company_name, contact_name, phone, email');
    if (data) setClients(data);
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

  const loadUsers = async (query: string = '') => {
    const users = await searchUsers(query, 50, 0);
    setUsers(users);
  };

  const openModal = (mode: ModalMode, call?: Call) => {
    setModalMode(mode);
    if (call) {
      setSelectedCall(call);
      setFormData({
        client_id: call.client_id || '',
        phone_number: call.phone_number || '',
        direction: call.direction,
        duration: call.duration.toString(),
        status: call.status,
        notes: call.notes || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const callData = {
        ...formData,
        duration: parseInt(formData.duration),
        caller_id: user?.id,
        client_id: formData.client_id || null
      };

      if (modalMode === 'edit' && selectedCall) {
        const { error } = await supabase
          .from('calls')
          .update(callData)
          .eq('id', selectedCall.id);

        if (error) throw error;
        toast.success('Llamada actualizada correctamente');
      } else {
        const { data: createdCall, error } = await supabase
          .from('calls')
          .insert(callData)
          .select('id')
          .single();
        if (error) throw error;

        void recordClientInteractionSafely({
          client_id: callData.client_id || null,
          type: 'call',
          description: `Llamada registrada a ${callData.phone_number}`,
          metadata: {
            call_id: createdCall?.id || null,
            phone_number: callData.phone_number,
            direction: callData.direction,
            status: callData.status,
            duration: callData.duration,
          },
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
        });
        toast.success('Llamada registrada correctamente');
      }

      loadCalls();
      resetForm();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!callToDelete) return;

    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', callToDelete.id);

      if (error) throw error;

      toast.success('Llamada eliminada correctamente');
      loadCalls();
      setShowDeleteConfirm(false);
      setCallToDelete(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente creado exitosamente');
      setFormData({ ...formData, client_id: newClient.id, phone_number: newClient.phone });
      setNewClientData({ company_name: '', contact_name: '', email: '', phone: '', address: '' });
      setShowClientModal(false);
      loadClients();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      phone_number: '',
      direction: 'outbound',
      duration: '',
      status: 'completed',
      notes: ''
    });
    setShowModal(false);
    setSelectedCall(null);
  };

  const openCreateTicketModal = (call: Call) => {
    const subject = `Seguimiento de llamada - ${call.clients?.company_name || call.clients?.contact_name || call.phone_number}`;
    const description = `Llamada ${call.direction === 'inbound' ? 'entrante' : 'saliente'} con duración de ${formatDuration(call.duration)}.\n\nNotas de la llamada:\n${call.notes || 'Sin notas'}`;

    saveTicketCreateDraft({
      client_id: call.client_id || undefined,
      subject,
      description,
      priority: 'medium',
      source_module: 'llamadas',
      source_name: call.clients?.contact_name || call.clients?.company_name || undefined,
      source_email: call.clients?.email || undefined,
      source_phone: call.clients?.phone || call.phone_number || undefined
    });

    setShowRetryListModal(false);
    setShowTicketModal(false);
    setSelectedCall(null);
    setActiveModule('tickets');
    toast.success('Completá el ticket en el formulario unificado');
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall) return;

    try {
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

      const { error } = await supabase.from('tickets').insert({
        ticket_number: ticketNumber,
        client_id: selectedCall.client_id,
        source_module: 'llamadas',
        subject: ticketFormData.subject,
        description: ticketFormData.description,
        priority: ticketFormData.priority,
        category_id: ticketFormData.category_id || null,
        status: 'open',
        assigned_to: ticketFormData.assigned_to || user?.id,
        created_by: user?.id
      });

      if (error) throw error;

      void recordClientInteractionSafely({
        client_id: selectedCall.client_id || null,
        type: 'ticket_created',
        description: `Ticket ${ticketNumber} creado desde una llamada`,
        metadata: {
          ticket_number: ticketNumber,
          source_module: 'llamadas',
          source_name: selectedCall.clients?.contact_name || selectedCall.clients?.company_name || null,
          source_email: selectedCall.clients?.email || null,
          source_phone: selectedCall.clients?.phone || selectedCall.phone_number || null,
          call_id: selectedCall.id,
        },
        created_by: user?.id || null,
        created_at: new Date().toISOString(),
      });

      toast.success('Ticket creado exitosamente desde la llamada');
      setShowTicketModal(false);
      setSelectedCall(null);
      setTicketFormData({ subject: '', description: '', priority: 'medium', category_id: '', assigned_to: '' });
    } catch (error: any) {
      toast.error(`Error al crear ticket: ${error.message}`);
    }
  };

  const handleTransferCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall) return;

    try {
      const { error } = await supabase
        .from('calls')
        .update({
          caller_id: transferFormData.assigned_to,
          notes: selectedCall.notes
            ? `${selectedCall.notes}\n\n[Transferida] ${transferFormData.notes}`
            : `[Transferida] ${transferFormData.notes}`
        })
        .eq('id', selectedCall.id);

      if (error) throw error;

      toast.success('Llamada transferida exitosamente');
      setShowTransferModal(false);
      setSelectedCall(null);
      setTransferFormData({ assigned_to: '', notes: '' });
      setUserSearchTerm('');
      loadCalls();
    } catch (error: any) {
      toast.error(`Error al transferir llamada: ${error.message}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusBadgeMeta: Record<string, { variant: BadgeVariant; label: string }> = {
    completed: { variant: 'success', label: 'Completada' },
    in_progress: { variant: 'info', label: 'En Progreso' },
    missed: { variant: 'danger', label: 'Perdida' },
    cancelled: { variant: 'warning', label: 'Cancelada' },
    failed: { variant: 'danger', label: 'Fallida' },
    busy: { variant: 'warning', label: 'Ocupado' },
    no_answer: { variant: 'neutral', label: 'Sin Respuesta' },
    ringing: { variant: 'info', label: 'Timbrando' },
    answered: { variant: 'success', label: 'Contestada' }
  };

  const getStatusBadge = (status: string) => {
    const meta = statusBadgeMeta[status] || { variant: 'neutral' as BadgeVariant, label: status };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
  };

  const totalCalls = calls.length;
  const totalDuration = calls.reduce((sum, call) => sum + call.duration, 0);
  const avgDuration = totalCalls > 0 ? Math.floor(totalDuration / totalCalls) : 0;

  // Llamadas que necesitan reintento
  const failedCalls = calls.filter(call =>
    ['failed', 'busy', 'no_answer', 'missed'].includes(call.status)
  );

  const getFailedCallsForRetry = () => {
    return calls.filter(call =>
      ['failed', 'busy', 'no_answer', 'missed'].includes(call.status)
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Llamadas"
        subtitle="Registra y gestiona tus llamadas"
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setShowRetryListModal(true)}
              disabled={failedCalls.length === 0}
              icon={<RefreshCw className="w-5 h-5" />}
              className={failedCalls.length > 0
                ? '!bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100 dark:!bg-amber-500/10 dark:!text-amber-400 dark:!border-amber-500/30'
                : ''}
            >
              Reintentos ({failedCalls.length})
            </Button>
            <Button onClick={() => openModal('create')} icon={<Plus className="w-5 h-5" />}>
              Registrar Llamada
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard color="brand" icon={<Phone />} label="Total Llamadas" value={totalCalls} />
        <StatCard color="success" icon={<PhoneCall />} label="Tiempo Total" value={formatDuration(totalDuration)} />
        <StatCard color="warning" icon={<Clock />} label="Duración Promedio" value={formatDuration(avgDuration)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Dirección</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Duración</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Estado</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Notas</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                  <td className="px-6 py-4">
                    {call.clients ? (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {call.clients.company_name || call.clients.contact_name}
                        </p>
                        {call.clients.company_name && call.clients.contact_name && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{call.clients.contact_name}</p>
                        )}
                        {call.phone_number && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{call.phone_number}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">{call.phone_number || 'Saliente'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {call.direction === 'inbound' ? (
                        <>
                          <PhoneIncoming className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Entrante</span>
                        </>
                      ) : (
                        <>
                          <PhoneOutgoing className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span className="text-sm text-sky-600 dark:text-sky-400 font-medium">Saliente</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(call.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {call.notes || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(call.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal('view', call)}
                        className="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal('edit', call)}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCallToDelete(call);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openCreateTicketModal(call)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20 transition text-xs font-medium"
                        title="Crear ticket"
                      >
                        <Ticket className="w-3 h-3" />
                        Ticket
                      </button>
                      {['failed', 'busy', 'no_answer', 'missed'].includes(call.status) && (
                        <button
                          onClick={() => {
                            setSelectedCall(call);
                            setShowTransferModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition text-xs font-medium"
                          title="Transferir"
                        >
                          <Send className="w-3 h-3" />
                          Transferir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-accent-600 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {modalMode === 'view' ? 'Detalles de Llamada' :
                       modalMode === 'edit' ? 'Editar Llamada' : 'Registrar Llamada'}
                    </h2>
                    <p className="text-white/80 text-sm mt-0.5">
                      {modalMode === 'view' ? 'Información completa de la llamada' : 'Complete los detalles de la llamada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {modalMode === 'view' && selectedCall ? (
              <div className="p-8 space-y-6">
                {selectedCall.recording_url && (
                  <div className="bg-gradient-to-br from-brand-50 to-accent-50 dark:from-brand-500/10 dark:to-accent-500/10 rounded-xl p-6 border border-brand-200 dark:border-brand-500/30">
                    <h3 className="text-lg font-semibold text-brand-900 dark:text-brand-300 mb-4 flex items-center gap-2">
                      <Volume2 className="w-5 h-5" />
                      Grabación de la Llamada
                    </h3>
                    <audio controls className="w-full mb-3">
                      <source src={selectedCall.recording_url} type="audio/mpeg" />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                    <a
                      href={selectedCall.recording_url}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Descargar Grabación
                    </a>
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Información del Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{selectedCall.clients?.company_name ? 'Empresa' : 'Nombre'}</p>
                      <p className="text-sm text-slate-900 dark:text-white font-medium">
                        {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || 'Sin asignar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Contacto</p>
                      <p className="text-sm text-slate-900 dark:text-white font-medium">
                        {selectedCall.clients?.contact_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Teléfono</p>
                      <p className="text-sm text-slate-900 dark:text-white font-mono">
                        {selectedCall.phone_number || selectedCall.clients?.phone || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {selectedCall.clients?.email || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Detalles de la Llamada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Dirección</p>
                      <div className="flex items-center gap-2">
                        {selectedCall.direction === 'inbound' ? (
                          <>
                            <PhoneIncoming className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Entrante</span>
                          </>
                        ) : (
                          <>
                            <PhoneOutgoing className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            <span className="text-sm text-sky-600 dark:text-sky-400 font-medium">Saliente</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Duración</p>
                      <p className="text-sm text-slate-900 dark:text-white font-mono font-medium">
                        {formatDuration(selectedCall.duration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Estado</p>
                      {getStatusBadge(selectedCall.status)}
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fecha y Hora</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {new Date(selectedCall.created_at).toLocaleString('es-ES', {
                          dateStyle: 'full',
                          timeStyle: 'long'
                        })}
                      </p>
                    </div>
                    {selectedCall.twilio_call_sid && (
                      <div className="md:col-span-3">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Twilio Call SID</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">{selectedCall.twilio_call_sid}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedCall.notes && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      Notas
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedCall.notes}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="primary" onClick={() => openModal('edit', selectedCall)} icon={<Edit2 className="w-4 h-4" />}>
                    Editar Llamada
                  </Button>
                  <Button variant="secondary" onClick={resetForm}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <User className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      Información del Cliente
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowClientModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition text-sm font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      Crear Cliente
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Cliente</label>
                      <select
                        value={formData.client_id}
                        onChange={(e) => {
                          const selectedClient = clients.find(c => c.id === e.target.value);
                          setFormData({
                            ...formData,
                            client_id: e.target.value,
                            phone_number: selectedClient?.phone || formData.phone_number
                          });
                        }}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                        disabled={modalMode === 'view'}
                      >
                        <option value="">Sin cliente asignado</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.company_name || client.contact_name} {client.phone && `• ${client.phone}`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Opcional: Asocia la llamada a un cliente existente</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Número de Teléfono *</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition font-mono"
                        placeholder="+59895148335"
                        required
                        disabled={modalMode === 'view'}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Formato E.164 recomendado (incluye +)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Detalles de la Llamada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Dirección *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${
                          formData.direction === 'outbound'
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-sky-300'
                        }`}>
                          <input
                            type="radio"
                            value="outbound"
                            checked={formData.direction === 'outbound'}
                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                            className="sr-only"
                            disabled={modalMode === 'view'}
                          />
                          <PhoneOutgoing className="w-6 h-6 mb-2" />
                          <span className="text-sm font-medium">Saliente</span>
                        </label>
                        <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${
                          formData.direction === 'inbound'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-300'
                        }`}>
                          <input
                            type="radio"
                            value="inbound"
                            checked={formData.direction === 'inbound'}
                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                            className="sr-only"
                            disabled={modalMode === 'view'}
                          />
                          <PhoneIncoming className="w-6 h-6 mb-2" />
                          <span className="text-sm font-medium">Entrante</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Duración (segundos) *
                      </label>
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                        placeholder="Ej: 120"
                        min="0"
                        required
                        disabled={modalMode === 'view'}
                      />
                      {formData.duration && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                          Equivale a: {formatDuration(parseInt(formData.duration))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Estado de la Llamada</h3>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Estado *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                    required
                    disabled={modalMode === 'view'}
                  >
                    <option value="completed">Completada</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="missed">Perdida</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="failed">Fallida</option>
                    <option value="busy">Ocupado</option>
                    <option value="no_answer">Sin Respuesta</option>
                    <option value="ringing">Timbrando</option>
                    <option value="answered">Contestada</option>
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Notas y Observaciones
                  </h3>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition resize-none"
                    placeholder="Resumen de la conversación, temas tratados, acuerdos alcanzados, próximos pasos..."
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {modalMode === 'edit' ? 'Actualizar Llamada' : 'Registrar Llamada'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Crear Nuevo Cliente</h2>
                    <p className="text-white/80 text-sm mt-0.5">Se asociará automáticamente a la llamada</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateClient} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Nombre de Empresa
                  </label>
                  <input
                    type="text"
                    value={newClientData.company_name}
                    onChange={(e) => setNewClientData({ ...newClientData, company_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    placeholder="Ej: Ayala IT (opcional para personas físicas)"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Opcional si es persona física</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Nombre de Contacto *
                  </label>
                  <input
                    type="text"
                    value={newClientData.contact_name}
                    onChange={(e) => setNewClientData({ ...newClientData, contact_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition font-mono"
                    placeholder="+59895148335"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    placeholder="contacto@empresa.com"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    placeholder="Calle, Ciudad, País"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button type="button" variant="secondary" onClick={() => setShowClientModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Crear y Asociar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && callToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-100 dark:bg-rose-500/10 rounded-full">
                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Eliminar Llamada</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-rose-900 dark:text-rose-300">
                ¿Estás seguro de que deseas eliminar esta llamada con{' '}
                <span className="font-semibold">
                  {callToDelete.clients?.company_name || callToDelete.clients?.contact_name || callToDelete.phone_number}
                </span>?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCallToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Eliminar Definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTicketModal && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-brand-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Crear Ticket desde Llamada</h2>
                    <p className="text-white/80 text-sm mt-0.5">
                      {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || selectedCall.phone_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTicketModal(false);
                    setSelectedCall(null);
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div className="bg-sky-50 dark:bg-sky-500/10 rounded-xl p-4 border border-sky-200 dark:border-sky-500/30">
                <div className="flex items-start gap-3">
                  <PhoneCall className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sky-900 dark:text-sky-300 mb-1">Información de la Llamada</h4>
                    <div className="text-sm text-sky-700 dark:text-sky-400 space-y-1">
                      <p>• Dirección: <span className="font-medium">{selectedCall.direction === 'inbound' ? 'Entrante' : 'Saliente'}</span></p>
                      <p>• Duración: <span className="font-medium">{formatDuration(selectedCall.duration)}</span></p>
                      <p>• Estado: <span className="font-medium capitalize">{selectedCall.status}</span></p>
                      <p>• Fecha: <span className="font-medium">{new Date(selectedCall.created_at).toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Asunto del Ticket *</label>
                <input
                  type="text"
                  value={ticketFormData.subject}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                  placeholder="Ej: Problema con el producto X"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Descripción *</label>
                <textarea
                  value={ticketFormData.description}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition resize-none"
                  placeholder="Describe el problema o requerimiento..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Prioridad *</label>
                  <select
                    value={ticketFormData.priority}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Categoría</label>
                  <select
                    value={ticketFormData.category_id}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, category_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Asignar a</label>
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Buscar usuario por nombre..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition mb-3"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                    <div
                      onClick={() => setTicketFormData({ ...ticketFormData, assigned_to: '' })}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        ticketFormData.assigned_to === ''
                          ? 'bg-brand-100 dark:bg-brand-500/20 border-brand-500 shadow-md'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ticketFormData.assigned_to === ''
                            ? 'bg-brand-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${
                            ticketFormData.assigned_to === ''
                              ? 'text-brand-900 dark:text-brand-300'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            A mí mismo
                          </p>
                        </div>
                        {ticketFormData.assigned_to === '' && (
                          <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    {users.length === 0 ? (
                      <div className="text-center py-8">
                        <User className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">No se encontraron usuarios</p>
                      </div>
                    ) : (
                      users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setTicketFormData({ ...ticketFormData, assigned_to: u.id })}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            ticketFormData.assigned_to === u.id
                              ? 'bg-brand-100 dark:bg-brand-500/20 border-brand-500 shadow-md'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              ticketFormData.assigned_to === u.id
                                ? 'bg-brand-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}>
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${
                                ticketFormData.assigned_to === u.id
                                  ? 'text-brand-900 dark:text-brand-300'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {u.name}
                              </p>
                              <p className={`text-sm truncate ${
                                ticketFormData.assigned_to === u.id
                                  ? 'text-brand-700 dark:text-brand-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                {u.email}
                              </p>
                            </div>
                            {ticketFormData.assigned_to === u.id && (
                              <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowTicketModal(false);
                    setSelectedCall(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Crear Ticket
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRetryListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-amber-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Lista de Reintentos</h2>
                    <p className="text-white/80 text-sm mt-0.5">
                      Llamadas fallidas, ocupadas o sin respuesta ({failedCalls.length})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRetryListModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8">
              {failedCalls.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 text-lg">No hay llamadas para reintentar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {failedCalls.map((call) => (
                    <div
                      key={call.id}
                      className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                              <Phone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {call.clients?.company_name || call.clients?.contact_name || 'Sin cliente'}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">{call.phone_number}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                              {getStatusBadge(call.status)}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Fecha</p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {new Date(call.created_at).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Duración</p>
                              <p className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                                {formatDuration(call.duration)}
                              </p>
                            </div>
                          </div>
                          {call.notes && (
                            <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notas</p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{call.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => {
                              openDialerWithNumber(call.phone_number, call.clients ? {
                                id: call.client_id || undefined,
                                company_name: call.clients.company_name,
                                contact_name: call.clients.contact_name,
                                email: call.clients.email,
                                phone: call.clients.phone,
                              } : null);
                              setShowRetryListModal(false);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <PhoneCall className="w-4 h-4" />
                            Llamar
                          </button>
                          <button
                            onClick={() => openCreateTicketModal(call)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <Ticket className="w-4 h-4" />
                            Crear Ticket
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCall(call);
                              setShowRetryListModal(false);
                              setShowTransferModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <Send className="w-4 h-4" />
                            Transferir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTransferModal && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-sky-600 to-sky-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Transferir Llamada</h2>
                    <p className="text-white/80 text-sm mt-0.5">
                      {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || selectedCall.phone_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedCall(null);
                    setTransferFormData({ assigned_to: '', notes: '' });
                    setUserSearchTerm('');
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleTransferCall} className="p-8 space-y-6">
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
                <div className="flex items-start gap-3">
                  <PhoneCall className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Información de la Llamada</h4>
                    <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                      <p>• Estado: <span className="font-medium capitalize">{selectedCall.status}</span></p>
                      <p>• Teléfono: <span className="font-medium font-mono">{selectedCall.phone_number}</span></p>
                      <p>• Fecha: <span className="font-medium">{new Date(selectedCall.created_at).toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Transferir a *
                </label>
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Buscar usuario por nombre..."
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition mb-3"
                />
                <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                  {users.filter(u => u.id !== user?.id).length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No se encontraron usuarios</p>
                    </div>
                  ) : (
                    users
                      .filter(u => u.id !== user?.id)
                      .map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setTransferFormData({ ...transferFormData, assigned_to: u.id })}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            transferFormData.assigned_to === u.id
                              ? 'bg-sky-100 dark:bg-sky-500/20 border-sky-500 shadow-md'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              transferFormData.assigned_to === u.id
                                ? 'bg-sky-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}>
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${
                                transferFormData.assigned_to === u.id
                                  ? 'text-sky-900 dark:text-sky-300'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {u.name}
                              </p>
                              <p className={`text-sm truncate ${
                                transferFormData.assigned_to === u.id
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                {u.email}
                              </p>
                            </div>
                            {transferFormData.assigned_to === u.id && (
                              <div className="w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Notas de Transferencia *</label>
                <textarea
                  value={transferFormData.notes}
                  onChange={(e) => setTransferFormData({ ...transferFormData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
                  placeholder="Motivo de la transferencia, contexto adicional..."
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedCall(null);
                    setTransferFormData({ assigned_to: '', notes: '' });
                    setUserSearchTerm('');
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Transferir Llamada
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
