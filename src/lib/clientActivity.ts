import type { ComponentType } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  DollarSign,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  PencilLine,
  Send,
  ShoppingCart,
  Ticket,
  UserPlus,
  XCircle,
} from 'lucide-react';

export interface ClientInteractionRecord {
  id: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ClientActivityMeta = {
  label: string;
  className: string;
  dotClassName: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
};

const clientActivityMeta: Record<string, ClientActivityMeta> = {
  call: {
    label: 'Llamada',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClassName: 'bg-emerald-500',
    detail: 'Llamada registrada',
    icon: Phone,
  },
  email: {
    label: 'Email',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/20',
    dotClassName: 'bg-sky-500',
    detail: 'Correo enviado o recibido',
    icon: Mail,
  },
  chat_opened: {
    label: 'Chat',
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/20',
    dotClassName: 'bg-cyan-500',
    detail: 'Chat abierto',
    icon: MessageCircle,
  },
  chat_message_sent: {
    label: 'Chat enviado',
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/20',
    dotClassName: 'bg-cyan-500',
    detail: 'Mensaje enviado por chat',
    icon: MessageCircle,
  },
  meeting: {
    label: 'Reunion',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20',
    dotClassName: 'bg-indigo-500',
    detail: 'Reunion o cita',
    icon: CalendarDays,
  },
  note: {
    label: 'Nota',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
    dotClassName: 'bg-slate-400',
    detail: 'Seguimiento interno',
    icon: FileText,
  },
  order: {
    label: 'Orden',
    className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/20',
    dotClassName: 'bg-violet-500',
    detail: 'Vinculada a una orden',
    icon: ShoppingCart,
  },
  invoice: {
    label: 'Factura',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
    dotClassName: 'bg-amber-500',
    detail: 'Factura generada',
    icon: DollarSign,
  },
  lead_created: {
    label: 'Lead',
    className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/20',
    dotClassName: 'bg-teal-500',
    detail: 'Lead creado',
    icon: UserPlus,
  },
  quote_requested: {
    label: 'Cotizacion solicitada',
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/20',
    dotClassName: 'bg-cyan-500',
    detail: 'Solicitud registrada desde webchat',
    icon: MessageCircle,
  },
  opportunity_created: {
    label: 'Oportunidad',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20',
    dotClassName: 'bg-blue-500',
    detail: 'Oportunidad comercial creada',
    icon: Briefcase,
  },
  quote_created: {
    label: 'Cotizacion',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
    dotClassName: 'bg-amber-500',
    detail: 'Cotizacion creada',
    icon: FileText,
  },
  quote_sent: {
    label: 'Enviada',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/20',
    dotClassName: 'bg-sky-500',
    detail: 'Cotizacion enviada al cliente',
    icon: Send,
  },
  quote_accepted: {
    label: 'Aceptada',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClassName: 'bg-emerald-500',
    detail: 'Cotizacion aceptada',
    icon: CheckCircle2,
  },
  quote_rejected: {
    label: 'Rechazada',
    className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20',
    dotClassName: 'bg-rose-500',
    detail: 'Cotizacion rechazada',
    icon: XCircle,
  },
  quote_expired: {
    label: 'Vencida',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
    dotClassName: 'bg-slate-400',
    detail: 'Cotizacion vencida',
    icon: Clock3,
  },
  quote_converted: {
    label: 'Convertida',
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20',
    dotClassName: 'bg-purple-500',
    detail: 'Cotizacion convertida en orden',
    icon: ShoppingCart,
  },
  stage_changed: {
    label: 'Etapa',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20',
    dotClassName: 'bg-blue-500',
    detail: 'Etapa comercial modificada',
    icon: ArrowRight,
  },
  task_created: {
    label: 'Tarea creada',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/20',
    dotClassName: 'bg-indigo-500',
    detail: 'Tarea agregada a la agenda',
    icon: CheckSquare2,
  },
  task_completed: {
    label: 'Tarea completada',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClassName: 'bg-emerald-500',
    detail: 'Tarea completada',
    icon: CheckCircle2,
  },
  task_rescheduled: {
    label: 'Reprogramada',
    className: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/20',
    dotClassName: 'bg-fuchsia-500',
    detail: 'Tarea reprogramada',
    icon: PencilLine,
  },
  task_overdue: {
    label: 'Vencida',
    className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20',
    dotClassName: 'bg-rose-500',
    detail: 'Tarea vencida',
    icon: Clock3,
  },
  campaign_sent: {
    label: 'Campaña',
    className: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/20',
    dotClassName: 'bg-pink-500',
    detail: 'Campaña de email enviada',
    icon: Send,
  },
  ticket_created: {
    label: 'Ticket creado',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
    dotClassName: 'bg-amber-500',
    detail: 'Ticket generado desde una interacción',
    icon: Ticket,
  },
};

export const getClientActivityType = (item: ClientInteractionRecord): string => {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  const originalType = metadata && typeof metadata.original_type === 'string' ? metadata.original_type.trim() : '';
  return originalType || item.type;
};

export const getClientActivityMeta = (item: ClientInteractionRecord): ClientActivityMeta => {
  const type = getClientActivityType(item);
  return clientActivityMeta[type] || clientActivityMeta.note;
};

export const formatClientActivityDate = (value: string) =>
  new Date(value).toLocaleString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
