import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  CheckSquare2,
  Trash2,
  User,
  Users,
  X,
  ArrowRight,
  Briefcase,
  DollarSign,
  ShoppingCart,
  MessageCircle,
  Truck,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useDialer } from '../../contexts/DialerContext';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { recordClientInteractionSafely } from '../../lib/clientInteractionLogger';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

type TaskType = 'call' | 'email' | 'meeting' | 'follow_up' | 'payment' | 'delivery' | 'other';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'open' | 'in_progress' | 'waiting' | 'done' | 'cancelled';

interface AgendaClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
}

interface AgendaUser {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
}

interface AgendaTask {
  id: string;
  task_number: string;
  client_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  order_id: string | null;
  title: string;
  description: string | null;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  due_at: string | null;
  scheduled_at: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  clients?: AgendaClient | null;
}

interface TaskFormState {
  client_id: string;
  title: string;
  description: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string;
  due_date: string;
  due_time: string;
  scheduled_date: string;
  scheduled_time: string;
  reminder_date: string;
  reminder_time: string;
}

const taskTypeMeta: Record<TaskType, { label: string; icon: ComponentType<{ className?: string }>; variant: BadgeVariant }> = {
  call: { label: 'Llamada', icon: Phone, variant: 'success' },
  email: { label: 'Email', icon: Mail, variant: 'info' },
  meeting: { label: 'Reunión', icon: CalendarDays, variant: 'brand' },
  follow_up: { label: 'Seguimiento', icon: MessageCircle, variant: 'info' },
  payment: { label: 'Cobro', icon: DollarSign, variant: 'warning' },
  delivery: { label: 'Entrega', icon: Truck, variant: 'brand' },
  other: { label: 'Otro', icon: FileText, variant: 'neutral' },
};

const taskStatusMeta: Record<TaskStatus, { label: string; variant: BadgeVariant; icon: ComponentType<{ className?: string }> }> = {
  open: { label: 'Abierta', variant: 'info', icon: CheckSquare2 },
  in_progress: { label: 'En progreso', variant: 'warning', icon: Clock3 },
  waiting: { label: 'Esperando', variant: 'neutral', icon: AlertCircle },
  done: { label: 'Hecha', variant: 'success', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'danger', icon: X },
};

const priorityMeta: Record<TaskPriority, { label: string; variant: BadgeVariant }> = {
  low: { label: 'Baja', variant: 'neutral' },
  medium: { label: 'Media', variant: 'warning' },
  high: { label: 'Alta', variant: 'danger' },
  urgent: { label: 'Urgente', variant: 'danger' },
};

const defaultTaskForm: TaskFormState = {
  client_id: '',
  title: '',
  description: '',
  task_type: 'follow_up',
  priority: 'medium',
  status: 'open',
  assigned_to: '',
  due_date: '',
  due_time: '',
  scheduled_date: '',
  scheduled_time: '',
  reminder_date: '',
  reminder_time: '',
};

const todayKey = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const parseLocalDateTime = (value: string | null) => {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};

const combineDateTime = (date: string, time: string) => {
  if (!date) return null;
  const safeTime = time || '00:00';
  const next = new Date(`${date}T${safeTime}`);
  return Number.isNaN(next.getTime()) ? null : next.toISOString();
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const isTaskActive = (task: AgendaTask) => !['done', 'cancelled'].includes(task.status);

export function AgendaModule() {
  const { user } = useAuth();
  const toast = useToast();
  const { navigateToInbox, setActiveModule } = useNavigation();
  const { initiateCall } = useDialer();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [clients, setClients] = useState<AgendaClient[]>([]);
  const [users, setUsers] = useState<AgendaUser[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'today' | 'overdue' | 'done'>('all');
  const [saveLoading, setSaveLoading] = useState(false);
  const [formData, setFormData] = useState<TaskFormState>(defaultTaskForm);

  const canManageTasks = canCreate('clientes') || canCreate('ventas') || canCreate('tickets');
  const canEditTasks = canUpdate('clientes') || canUpdate('ventas') || canUpdate('tickets');
  const canRemoveTasks = canDelete('clientes') || canDelete('ventas') || canDelete('tickets');

  const loadAgenda = useCallback(async () => {
    setLoading(true);

    const [tasksResult, clientsResult, usersResult] = await Promise.all([
      supabase
        .from('crm_tasks')
        .select(`
          id,
          task_number,
          client_id,
          opportunity_id,
          quote_id,
          order_id,
          title,
          description,
          task_type,
          priority,
          status,
          assigned_to,
          due_at,
          scheduled_at,
          reminder_at,
          completed_at,
          metadata,
          created_at,
          updated_at,
          clients (
            id,
            company_name,
            contact_name,
            email,
            phone
          )
        `)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, company_name, contact_name, email, phone')
        .order('company_name', { ascending: true }),
      supabase
        .from('system_users')
        .select('id, full_name, email, role, is_active')
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
    ]);

    if (tasksResult.error) {
      toast.error(`No se pudieron cargar las tareas: ${tasksResult.error.message}`);
    } else if (tasksResult.data) {
      setTasks(tasksResult.data as AgendaTask[]);
    }

    if (clientsResult.error) {
      toast.error(`No se pudieron cargar los clientes: ${clientsResult.error.message}`);
    } else if (clientsResult.data) {
      setClients(clientsResult.data as AgendaClient[]);
    }

    if (usersResult.error) {
      toast.error(`No se pudieron cargar los usuarios: ${usersResult.error.message}`);
    } else if (usersResult.data) {
      setUsers(usersResult.data as AgendaUser[]);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      await loadAgenda();
    };

    void initialize();
  }, [loadAgenda]);

  useEffect(() => {
    const draftRaw = localStorage.getItem('crm_task_draft');
    if (!draftRaw) return;

    try {
      const draft = JSON.parse(draftRaw) as Partial<TaskFormState>;
      setEditingTask(null);
      setFormData((prev) => ({
        ...prev,
        ...draft,
      }));
      setShowModal(true);
    } catch {
      // ignore malformed drafts
    } finally {
      localStorage.removeItem('crm_task_draft');
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('crm-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_tasks' },
        () => {
          void loadAgenda();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAgenda]);

  const resetForm = () => {
    setFormData(defaultTaskForm);
    setEditingTask(null);
    setShowModal(false);
  };

  const openTaskModal = (task?: AgendaTask) => {
    if (task) {
      const due = parseLocalDateTime(task.due_at);
      const scheduled = parseLocalDateTime(task.scheduled_at);
      const reminder = parseLocalDateTime(task.reminder_at);

      setEditingTask(task);
      setFormData({
        client_id: task.client_id || '',
        title: task.title,
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to || '',
        due_date: due.date,
        due_time: due.time,
        scheduled_date: scheduled.date,
        scheduled_time: scheduled.time,
        reminder_date: reminder.date,
        reminder_time: reminder.time,
      });
    } else {
      setEditingTask(null);
      setFormData(defaultTaskForm);
    }

    setShowModal(true);
  };

  const openClientInClientsModule = (clientId: string) => {
    localStorage.setItem('crm_client_detail', clientId);
    setActiveModule('clients');
  };

  const getTaskClientInfo = (task: AgendaTask) => {
    if (!task.client_id || !task.clients) return null;

    return {
      id: task.client_id,
      company_name: task.clients.company_name,
      contact_name: task.clients.contact_name,
      email: task.clients.email,
      phone: task.clients.phone || undefined,
    };
  };

  const openTaskCall = (task: AgendaTask) => {
    const contact = getTaskClientInfo(task);
    if (!contact?.phone) {
      toast.info('Este cliente no tiene teléfono registrado');
      return;
    }

    initiateCall(contact.phone, contact);
  };

  const openTaskEmail = (task: AgendaTask) => {
    const contact = getTaskClientInfo(task);
    if (!contact?.email) {
      toast.info('Este cliente no tiene email registrado');
      return;
    }

    navigateToInbox(contact.email, {
      clientId: contact.id,
      emailSubject: `Seguimiento de ${task.title}`,
      emailBody: `Hola ${contact.contact_name || contact.company_name || 'cliente'},\n\nEscribo para dar seguimiento a la tarea "${task.title}".\n\nSaludos.`
    });
  };

  const openTaskChat = (task: AgendaTask) => {
    const contact = getTaskClientInfo(task);
    if (!contact) {
      toast.info('Selecciona un cliente para abrir el chat');
      return;
    }

    localStorage.setItem('webchat_focus_client', JSON.stringify(contact));
    setActiveModule('webchat');
  };

  const openTaskTicket = (task: AgendaTask) => {
    const contact = getTaskClientInfo(task);
    if (!contact) {
      toast.info('Selecciona un cliente para crear el ticket');
      return;
    }

    saveTicketCreateDraft({
      client_id: contact.id,
      subject: `Seguimiento de ${task.title}`,
      description: task.description || `Ticket generado desde la agenda para ${task.title}`,
      priority: task.priority === 'urgent'
        ? 'urgent'
        : task.priority === 'high'
          ? 'high'
          : task.priority === 'low'
            ? 'low'
            : 'medium',
      source_module: 'agenda',
      source_name: contact.contact_name || contact.company_name || undefined,
      source_email: contact.email || undefined,
      source_phone: contact.phone || undefined,
    });

    setActiveModule('tickets');
    toast.info('Completá el ticket en el formulario unificado');
  };

  const createTaskInteraction = async (task: AgendaTask, type: 'task_created' | 'task_completed' | 'task_rescheduled') => {
    const { error } = await recordClientInteractionSafely({
      client_id: task.client_id,
      opportunity_id: task.opportunity_id,
      quote_id: task.quote_id,
      order_id: task.order_id,
      type,
      description:
        type === 'task_completed'
          ? `Tarea ${task.task_number} completada`
          : type === 'task_rescheduled'
            ? `Tarea ${task.task_number} reprogramada`
            : `Tarea ${task.task_number} creada`,
      metadata: {
        task_number: task.task_number,
        task_title: task.title,
        task_type: task.task_type,
        priority: task.priority,
        due_at: task.due_at,
        scheduled_at: task.scheduled_at,
        reminder_at: task.reminder_at,
        task_status: task.status,
      },
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      task_id: task.id,
    });

    if (error) {
      console.error('[AGENDA] No se pudo registrar el historial de tarea:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    setSaveLoading(true);
    const now = new Date().toISOString();
    const dueAt = combineDateTime(formData.due_date, formData.due_time);
    const scheduledAt = combineDateTime(formData.scheduled_date, formData.scheduled_time);
    const reminderAt = combineDateTime(formData.reminder_date, formData.reminder_time);

    const basePayload = {
      client_id: formData.client_id || null,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      task_type: formData.task_type,
      priority: formData.priority,
      status: formData.status,
      assigned_to: formData.assigned_to || null,
      due_at: dueAt,
      scheduled_at: scheduledAt,
      reminder_at: reminderAt,
      completed_at: formData.status === 'done' ? now : null,
      updated_at: now,
    };

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('crm_tasks')
          .update(basePayload as any)
          .eq('id', editingTask.id);

        if (error) {
          toast.error(`No se pudo actualizar la tarea: ${error.message}`);
          setSaveLoading(false);
          return;
        }

        const taskAfterSave: AgendaTask = {
          ...editingTask,
          ...basePayload,
          id: editingTask.id,
          task_number: editingTask.task_number,
          created_at: editingTask.created_at,
          updated_at: now,
          clients: editingTask.clients,
        };

        if (
          editingTask.due_at !== dueAt ||
          editingTask.scheduled_at !== scheduledAt ||
          editingTask.reminder_at !== reminderAt
        ) {
          await createTaskInteraction(taskAfterSave, 'task_rescheduled');
        }

        toast.success('Tarea actualizada');
      } else {
        const { data, error } = await supabase
          .from('crm_tasks')
          .insert({
            ...basePayload,
            created_by: user?.id || null,
          })
          .select('*')
          .single();

        if (error || !data) {
          toast.error(`No se pudo crear la tarea: ${error?.message || 'sin detalle'}`);
          setSaveLoading(false);
          return;
        }

        await createTaskInteraction(data as AgendaTask, 'task_created');
        toast.success('Tarea creada');
      }

      resetForm();
      await loadAgenda();
    } catch (error) {
      console.error('[AGENDA] Error guardando tarea:', error);
      toast.error('No se pudo guardar la tarea');
    } finally {
      setSaveLoading(false);
    }
  };

  const markTaskDone = async (task: AgendaTask) => {
    if (!canEditTasks) {
      toast.error('No tienes permisos para completar tareas');
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('crm_tasks')
      .update({
        status: 'done',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', task.id);

    if (error) {
      toast.error(`No se pudo completar la tarea: ${error.message}`);
      return;
    }

    await createTaskInteraction({ ...task, status: 'done', completed_at: now }, 'task_completed');
    toast.success('Tarea completada');
    await loadAgenda();
  };

  const deleteTask = async (task: AgendaTask) => {
    if (!canRemoveTasks) {
      toast.error('No tienes permisos para eliminar tareas');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar la tarea ${task.task_number}?`);
    if (!confirmed) return;

    const { error } = await supabase.from('crm_tasks').delete().eq('id', task.id);
    if (error) {
      toast.error(`No se pudo eliminar la tarea: ${error.message}`);
      return;
    }

    toast.success('Tarea eliminada');
    await loadAgenda();
  };

  const filteredTasks = useMemo(() => {
    const today = todayKey();
    const now = new Date();
    const search = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const taskText = [
        task.task_number,
        task.title,
        task.description || '',
        task.clients?.company_name || '',
        task.clients?.contact_name || '',
        task.clients?.email || '',
      ]
        .join(' ')
        .toLowerCase();

      if (search && !taskText.includes(search)) return false;

      if (statusFilter === 'open') return ['open', 'in_progress', 'waiting'].includes(task.status);
      if (statusFilter === 'done') return task.status === 'done';
      if (statusFilter === 'today') {
        const dateValue = task.due_at || task.scheduled_at;
        if (!dateValue) return false;
        return dateValue.slice(0, 10) === today;
      }
      if (statusFilter === 'overdue') {
        if (!isTaskActive(task) || !task.due_at) return false;
        return new Date(task.due_at).getTime() < now.getTime();
      }

      return true;
    });
  }, [searchTerm, statusFilter, tasks]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = todayKey();

    const open = tasks.filter((task) => ['open', 'in_progress', 'waiting'].includes(task.status)).length;
    const done = tasks.filter((task) => task.status === 'done').length;
    const overdue = tasks.filter((task) => isTaskActive(task) && task.due_at && new Date(task.due_at).getTime() < now.getTime()).length;
    const dueToday = tasks.filter((task) => isTaskActive(task) && ((task.due_at && task.due_at.slice(0, 10) === today) || (task.scheduled_at && task.scheduled_at.slice(0, 10) === today))).length;

    return { open, done, overdue, dueToday };
  }, [tasks]);

  const agendaByDay = useMemo(() => {
    const nextTasks = tasks
      .filter((task) => isTaskActive(task) && (task.due_at || task.scheduled_at))
      .sort((a, b) => {
        const dateA = new Date(a.due_at || a.scheduled_at || a.created_at).getTime();
        const dateB = new Date(b.due_at || b.scheduled_at || b.created_at).getTime();
        return dateA - dateB;
      });

    return nextTasks.reduce<Record<string, AgendaTask[]>>((acc, task) => {
      const key = (task.due_at || task.scheduled_at || task.created_at).slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const agendaKeys = Object.keys(agendaByDay).slice(0, 7);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Agenda comercial y seguimiento"
        subtitle="Organizamos tareas, recordatorios y seguimientos comerciales con foco en clientes, cotizaciones y órdenes."
        action={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={loadAgenda}
              icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refrescar
            </Button>
            <Button onClick={() => openTaskModal()} disabled={!canManageTasks} icon={<Plus className="h-4 w-4" />}>
              Nueva tarea
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard color="brand" icon={<CheckSquare2 />} label="Tareas abiertas" value={stats.open} />
        <StatCard color="info" icon={<CalendarDays />} label="Para hoy" value={stats.dueToday} />
        <StatCard color="danger" icon={<AlertCircle />} label="Vencidas" value={stats.overdue} />
        <StatCard color="success" icon={<CheckCircle2 />} label="Completadas" value={stats.done} />
      </div>

      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar tarea, cliente o número..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-12 py-3 text-sm outline-none transition focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'open', label: 'Abiertas' },
              { key: 'today', label: 'Hoy' },
              { key: 'overdue', label: 'Vencidas' },
              { key: 'done', label: 'Hechas' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  statusFilter === item.key
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            {loading ? (
              <Card className="border-dashed p-8 text-center text-slate-500 dark:text-slate-400">
                Cargando tareas...
              </Card>
            ) : filteredTasks.length === 0 ? (
              <Card className="border-dashed p-8 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No hay tareas para mostrar</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Prueba con otro filtro o crea una tarea para empezar a organizar el seguimiento.
                </p>
              </Card>
            ) : (
              filteredTasks.map((task) => {
                const taskType = taskTypeMeta[task.task_type] || taskTypeMeta.other;
                const status = taskStatusMeta[task.status] || taskStatusMeta.open;
                const priority = priorityMeta[task.priority] || priorityMeta.medium;
                const TaskTypeIcon = taskType.icon;
                const TaskStatusIcon = status.icon;
                const isOverdue = isTaskActive(task) && !!task.due_at && new Date(task.due_at).getTime() < Date.now();

                return (
                  <Card key={task.id} hover className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={taskType.variant} icon={<TaskTypeIcon className="h-3.5 w-3.5" />}>
                            {taskType.label}
                          </Badge>
                          <Badge variant={status.variant} icon={<TaskStatusIcon className="h-3.5 w-3.5" />}>
                            {status.label}
                          </Badge>
                          <Badge variant={priority.variant}>
                            Prioridad {priority.label}
                          </Badge>
                          {isOverdue && <Badge variant="danger">Vencida</Badge>}
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{task.title}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{task.task_number}</p>
                        {task.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{task.description}</p>}

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Cliente</p>
                            <button
                              onClick={() => task.client_id && openClientInClientsModule(task.client_id)}
                              className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
                              disabled={!task.client_id}
                            >
                              <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              {task.clients?.company_name || task.clients?.contact_name || 'Sin cliente'}
                            </button>
                          </div>
                          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Fecha límite</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(task.due_at || task.scheduled_at)}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openTaskCall(task)}
                            disabled={!task.client_id || !task.clients?.phone}
                            className="rounded-full !bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100 dark:!bg-emerald-500/10 dark:!text-emerald-400 dark:!border-emerald-500/30"
                            icon={<Phone className="h-3.5 w-3.5" />}
                          >
                            Llamar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openTaskEmail(task)}
                            disabled={!task.client_id || !task.clients?.email}
                            className="rounded-full !bg-sky-50 !text-sky-700 !border-sky-200 hover:!bg-sky-100 dark:!bg-sky-500/10 dark:!text-sky-400 dark:!border-sky-500/30"
                            icon={<Mail className="h-3.5 w-3.5" />}
                          >
                            Email
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openTaskChat(task)}
                            disabled={!task.client_id}
                            className="rounded-full !bg-accent-50 !text-accent-700 !border-accent-200 hover:!bg-accent-100 dark:!bg-accent-500/10 dark:!text-accent-400 dark:!border-accent-500/30"
                            icon={<MessageCircle className="h-3.5 w-3.5" />}
                          >
                            Chat
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openTaskTicket(task)}
                            disabled={!task.client_id}
                            className="rounded-full !bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100 dark:!bg-amber-500/10 dark:!text-amber-400 dark:!border-amber-500/30"
                            icon={<FileText className="h-3.5 w-3.5" />}
                          >
                            Ticket
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:w-56">
                        <Button
                          variant="secondary"
                          onClick={() => markTaskDone(task)}
                          disabled={!canEditTasks || task.status === 'done'}
                          className="!bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100 dark:!bg-emerald-500/10 dark:!text-emerald-400 dark:!border-emerald-500/30"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          Completar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => openTaskModal(task)}
                          disabled={!canEditTasks}
                          className="!bg-brand-50 !text-brand-700 !border-brand-200 hover:!bg-brand-100 dark:!bg-brand-500/10 dark:!text-brand-400 dark:!border-brand-500/30"
                          icon={<Edit2 className="h-4 w-4" />}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => deleteTask(task)}
                          disabled={!canRemoveTasks}
                          className="!bg-rose-50 !text-rose-700 !border-rose-200 hover:!bg-rose-100 dark:!bg-rose-500/10 dark:!text-rose-400 dark:!border-rose-500/30"
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          <aside className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Agenda de hoy</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Tareas y seguimientos más próximos.</p>
                </div>
                <CalendarDays className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              </div>

              <div className="mt-5 space-y-3">
                {agendaKeys.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No hay tareas agendadas todavía.
                  </div>
                ) : (
                  agendaKeys.map((dayKey) => (
                    <div key={dayKey} className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDateShort(dayKey)}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{agendaByDay[dayKey].length} tareas</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {agendaByDay[dayKey].slice(0, 4).map((task) => (
                          <div key={task.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{task.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {task.clients?.company_name || task.clients?.contact_name || 'Sin cliente'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(task.due_at || task.scheduled_at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Accesos rápidos</h3>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => openTaskModal()}
                  disabled={!canManageTasks}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Nueva tarea manual
                </button>
                <button
                  onClick={() => setActiveModule('ventas')}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Ir a ventas y cotizaciones
                </button>
                <button
                  onClick={() => setActiveModule('clients')}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Volver a clientes
                </button>
              </div>
            </Card>
          </aside>
        </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingTask ? 'Editar tarea' : 'Nueva tarea'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Organiza seguimientos, reuniones y recordatorios comerciales.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="rounded-xl p-2 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Cliente</span>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, client_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">Sin cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name || client.contact_name} - {client.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Asignado a</span>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData((prev) => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">Sin asignar</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name} {item.email ? `(${item.email})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Título</span>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Llamar para seguimiento de cotización"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Descripción</span>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Detalle de la acción, objeción o seguimiento."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</span>
                <select
                  value={formData.task_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, task_type: e.target.value as TaskType }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {Object.entries(taskTypeMeta).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Prioridad</span>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {Object.entries(priorityMeta).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Estado</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {Object.entries(taskStatusMeta).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 p-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fecha límite</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={formData.due_time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, due_time: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 p-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Programada</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_time: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recordatorio</p>
                <div className="mt-3 grid grid-cols-2 gap-3 md:max-w-md">
                  <input
                    type="date"
                    value={formData.reminder_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reminder_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <input
                    type="time"
                    value={formData.reminder_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reminder_time: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveLoading || !canManageTasks} loading={saveLoading}>
                  {editingTask ? 'Actualizar tarea' : 'Crear tarea'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
