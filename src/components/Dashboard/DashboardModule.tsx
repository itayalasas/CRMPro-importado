import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Mail, PhoneCall, RefreshCw, Ticket, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';

interface TopClient {
  id: string;
  company_name: string;
  contact_name: string;
  revenue: number;
}

interface ClientRecord {
  id: string;
  company_name: string;
  contact_name: string;
  status: string;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
}

interface InvoiceRecord {
  client_id: string;
  total_amount: number | string;
  status: string;
}

interface IncomingCallRecord {
  id: string;
  status: string;
}

interface OutboundCallRecord {
  id: string;
  status: string;
}

interface InboxEmailRecord {
  id: string;
  folder: string;
  is_read: boolean;
  is_deleted: boolean;
  is_archived: boolean;
}

interface ChatConversationRecord {
  id: string;
  status: 'open' | 'assigned' | 'taken' | 'resolved' | 'closed' | string;
}

interface WeeklyPoint {
  label: string;
  value: number;
}

export function DashboardModule() {
  const [loading, setLoading] = useState(true);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [recentTickets, setRecentTickets] = useState<TicketRecord[]>([]);
  const [weeklyTickets, setWeeklyTickets] = useState<WeeklyPoint[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState({
    open: 0,
    in_progress: 0,
    waiting: 0,
    resolved: 0,
    closed: 0,
  });
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    activeClients: 0,
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    incomingCalls: 0,
    missedCalls: 0,
    totalCalls: 0,
    totalEmails: 0,
    unreadEmails: 0,
    totalChats: 0,
    openChats: 0,
  });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    const [
      { data: clients },
      { data: tickets },
      { data: invoices },
      { data: incomingCalls },
      { data: outboundCalls },
      { data: inboxEmails },
      { data: chatConversations },
    ] = await Promise.all([
      supabase
        .from('clients')
        .select('id, company_name, contact_name, status'),
      supabase
        .from('tickets')
        .select('id, ticket_number, subject, status, priority, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('client_id, total_amount, status'),
      supabase
        .from('incoming_calls')
        .select('id, status'),
      supabase
        .from('calls')
        .select('id, status'),
      supabase
        .from('inbox_emails')
        .select('id, folder, is_read, is_deleted, is_archived'),
      supabase
        .from('webchat_conversations')
        .select('id, status'),
    ]);

    const clientsData = (clients || []) as ClientRecord[];
    const ticketsData = (tickets || []) as TicketRecord[];
    const invoicesData = (invoices || []) as InvoiceRecord[];
    const incomingCallsData = (incomingCalls || []) as IncomingCallRecord[];
    const outboundCallsData = (outboundCalls || []) as OutboundCallRecord[];
    const inboxEmailsData = (inboxEmails || []) as InboxEmailRecord[];
    const chatConversationsData = (chatConversations || []) as ChatConversationRecord[];

    const activeClients = clientsData.filter((item) => item.status === 'active').length;
    const openTickets = ticketsData.filter((item) => ['open', 'in_progress', 'waiting'].includes(item.status)).length;
    const resolvedTickets = ticketsData.filter((item) => ['resolved', 'closed'].includes(item.status)).length;

    const incomingCallsCount = incomingCallsData.length;
    const missedCallsCount = incomingCallsData.filter((item) => ['missed', 'no-answer', 'busy', 'failed'].includes(String(item.status || '').toLowerCase())).length;
    const totalCallsCount = incomingCallsCount + outboundCallsData.length;

    const activeInboxEmails = inboxEmailsData.filter((item) => item.folder === 'inbox' && !item.is_deleted && !item.is_archived);
    const totalEmailsCount = activeInboxEmails.length;
    const unreadEmailsCount = activeInboxEmails.filter((item) => !item.is_read).length;

    const totalChatsCount = chatConversationsData.length;
    const openChatsCount = chatConversationsData.filter((item) => ['open', 'assigned', 'taken'].includes(String(item.status || '').toLowerCase())).length;

    const paidInvoices = invoicesData.filter((item) => item.status === 'paid');

    const breakdown = {
      open: ticketsData.filter((item) => item.status === 'open').length,
      in_progress: ticketsData.filter((item) => item.status === 'in_progress').length,
      waiting: ticketsData.filter((item) => item.status === 'waiting').length,
      resolved: ticketsData.filter((item) => item.status === 'resolved').length,
      closed: ticketsData.filter((item) => item.status === 'closed').length,
    };

    const last7Days: WeeklyPoint[] = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'short' });
      const dayKey = date.toISOString().slice(0, 10);
      const dayTotal = ticketsData.filter((ticket) => ticket.created_at?.slice(0, 10) === dayKey).length;
      return {
        label: `${dayLabel[0].toUpperCase()}${dayLabel.slice(1, 3)}`,
        value: dayTotal,
      };
    });

    const revenueByClient = new Map<string, number>();
    paidInvoices.forEach((invoice) => {
      const currentValue = revenueByClient.get(invoice.client_id) || 0;
      revenueByClient.set(invoice.client_id, currentValue + Number(invoice.total_amount || 0));
    });

    const topClientsData = clientsData
      .map((client) => ({
        id: client.id,
        company_name: client.company_name,
        contact_name: client.contact_name,
        revenue: revenueByClient.get(client.id) || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    setMetrics({
      totalClients: clientsData.length,
      activeClients,
      totalTickets: ticketsData.length,
      openTickets,
      resolvedTickets,
      incomingCalls: incomingCallsCount,
      missedCalls: missedCallsCount,
      totalCalls: totalCallsCount,
      totalEmails: totalEmailsCount,
      unreadEmails: unreadEmailsCount,
      totalChats: totalChatsCount,
      openChats: openChatsCount,
    });
    setStatusBreakdown(breakdown);
    setWeeklyTickets(last7Days);
    setTopClients(topClientsData);
    setRecentTickets(ticketsData.slice(0, 8));
    setLoading(false);
  }, []);

  const maxWeeklyValue = useMemo(() => Math.max(...weeklyTickets.map((item) => item.value), 1), [weeklyTickets]);

  useEffect(() => {
    const initializeDashboard = async () => {
      await ensureCurrentUserInSystemUsers();
      await loadDashboardData();
    };

    initializeDashboard();

    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    const clientsChannel = supabase
      .channel('dashboard-clients')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const ticketsChannel = supabase
      .channel('dashboard-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const invoicesChannel = supabase
      .channel('dashboard-invoices')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('dashboard-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const incomingCallsChannel = supabase
      .channel('dashboard-incoming-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incoming_calls'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const inboxChannel = supabase
      .channel('dashboard-inbox-emails')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbox_emails'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel('dashboard-webchat-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webchat_conversations'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(incomingCallsChannel);
      supabase.removeChannel(inboxChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [loadDashboardData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Dashboard CRM
          </h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base lg:text-lg">Vista general de operación comercial y soporte</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="inline-flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Clientes Totales</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.totalClients.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Activos: {metrics.activeClients.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Tickets Totales</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.totalTickets.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Abiertos: {metrics.openTickets.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Resueltos</span>
            <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.resolvedTickets.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">
            Tasa resolución: {metrics.totalTickets > 0 ? Math.round((metrics.resolvedTickets / metrics.totalTickets) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Llamadas Recibidas</span>
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.incomingCalls.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Perdidas: {metrics.missedCalls.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <PhoneCall className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Estadísticas de Llamadas</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.totalCalls.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Totales (entrantes + salientes)</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Estadísticas de Correos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.totalEmails.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">No leídos: {metrics.unreadEmails.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Estadísticas de Chat</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.totalChats.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Activos: {metrics.openChats.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Análisis de Tickets por Estado</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: 'open', label: 'Abiertos', color: 'bg-blue-500' },
              { key: 'in_progress', label: 'En progreso', color: 'bg-purple-500' },
              { key: 'waiting', label: 'En espera', color: 'bg-amber-500' },
              { key: 'resolved', label: 'Resueltos', color: 'bg-green-500' },
              { key: 'closed', label: 'Cerrados', color: 'bg-slate-500' },
            ].map((item) => {
              const value = statusBreakdown[item.key as keyof typeof statusBreakdown] || 0;
              const percentage = metrics.totalTickets > 0 ? Math.round((value / metrics.totalTickets) * 100) : 0;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="text-slate-500">{value} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Actividad de Tickets (7 días)</h2>
          </div>

          <div className="h-64 flex items-end justify-between gap-3 border border-slate-100 rounded-xl p-4 bg-slate-50/60">
            {weeklyTickets.map((point) => {
              const heightPercent = Math.max(Math.round((point.value / maxWeeklyValue) * 100), point.value > 0 ? 12 : 4);
              return (
                <div key={point.label} className="flex-1 flex flex-col items-center justify-end gap-2">
                  <span className="text-xs text-slate-500 font-medium">{point.value}</span>
                  <div className="w-full max-w-[36px] rounded-t-md bg-blue-600/90" style={{ height: `${heightPercent}%` }} />
                  <span className="text-xs text-slate-500">{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Top Clientes y Últimos Tickets</h2>
          <span className="text-sm text-slate-500">Actualizado en tiempo real</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
          <div className="p-6 border-b xl:border-b-0 xl:border-r border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Clientes con mayor facturación</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Empresa</th>
                    <th className="pb-3 font-medium">Contacto</th>
                    <th className="pb-3 font-medium text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client, index) => (
                    <tr key={client.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 text-slate-700 font-semibold">{index + 1}</td>
                      <td className="py-3 text-slate-900 font-medium">{client.company_name}</td>
                      <td className="py-3 text-slate-600">{client.contact_name || '—'}</td>
                      <td className="py-3 text-right text-green-600 font-semibold">${client.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                  {topClients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">Sin datos de facturación disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Últimos tickets creados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Ticket</th>
                    <th className="pb-3 font-medium">Asunto</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 text-slate-900 font-medium">{ticket.ticket_number || '—'}</td>
                      <td className="py-3 text-slate-700 max-w-[220px] truncate">{ticket.subject || '(Sin asunto)'}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{ticket.priority}</td>
                    </tr>
                  ))}
                  {recentTickets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">No hay tickets recientes</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          Actualizando dashboard...
        </div>
      )}
    </div>
  );
}
