import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Mail, PhoneCall, RefreshCw, ShoppingCart, Ticket, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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

interface OpportunityRecord {
  id: string;
  status: 'open' | 'won' | 'lost' | 'archived' | string;
  expected_amount: number | string;
}

interface ProductRecord {
  id: string;
  is_active: boolean;
}

interface QuoteRecord {
  id: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted' | string;
  total_amount: number | string;
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
    totalOpportunities: 0,
    openOpportunities: 0,
    pipelineValue: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalQuotes: 0,
    openQuotes: 0,
    sentQuotes: 0,
    acceptedQuotes: 0,
    convertedQuotes: 0,
    quotePipelineValue: 0,
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
      { data: opportunities },
      { data: products },
      { data: quotes },
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
      supabase
        .from('sales_opportunities')
        .select('id, status, expected_amount'),
      supabase
        .from('sales_products')
        .select('id, is_active'),
      supabase
        .from('sales_quotes')
        .select('id, status, total_amount'),
    ]);

    const clientsData = (clients || []) as ClientRecord[];
    const ticketsData = (tickets || []) as TicketRecord[];
    const invoicesData = (invoices || []) as InvoiceRecord[];
    const incomingCallsData = (incomingCalls || []) as IncomingCallRecord[];
    const outboundCallsData = (outboundCalls || []) as OutboundCallRecord[];
    const inboxEmailsData = (inboxEmails || []) as InboxEmailRecord[];
    const chatConversationsData = (chatConversations || []) as ChatConversationRecord[];
    const opportunitiesData = (opportunities || []) as OpportunityRecord[];
    const productsData = (products || []) as ProductRecord[];
    const quotesData = (quotes || []) as QuoteRecord[];

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
    const openOpportunitiesCount = opportunitiesData.filter((item) => String(item.status || '').toLowerCase() === 'open').length;
    const pipelineValue = opportunitiesData
      .filter((item) => String(item.status || '').toLowerCase() === 'open')
      .reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
    const openQuotesCount = quotesData.filter((item) => ['draft', 'sent', 'accepted'].includes(String(item.status || '').toLowerCase())).length;
    const sentQuotesCount = quotesData.filter((item) => String(item.status || '').toLowerCase() === 'sent').length;
    const acceptedQuotesCount = quotesData.filter((item) => String(item.status || '').toLowerCase() === 'accepted').length;
    const convertedQuotesCount = quotesData.filter((item) => String(item.status || '').toLowerCase() === 'converted').length;
    const quotePipelineValue = quotesData
      .filter((item) => ['draft', 'sent', 'accepted'].includes(String(item.status || '').toLowerCase()))
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const activeProductsCount = productsData.filter((item) => item.is_active).length;

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
      totalOpportunities: opportunitiesData.length,
      openOpportunities: openOpportunitiesCount,
      pipelineValue,
      totalProducts: productsData.length,
      activeProducts: activeProductsCount,
      totalQuotes: quotesData.length,
      openQuotes: openQuotesCount,
      sentQuotes: sentQuotesCount,
      acceptedQuotes: acceptedQuotesCount,
      convertedQuotes: convertedQuotesCount,
      quotePipelineValue,
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

    const opportunitiesChannel = supabase
      .channel('dashboard-sales-opportunities')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_opportunities'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const productsChannel = supabase
      .channel('dashboard-sales-products')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_products'
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const quotesChannel = supabase
      .channel('dashboard-sales-quotes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_quotes'
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
      supabase.removeChannel(opportunitiesChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, [loadDashboardData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Dashboard CRM"
        subtitle="Vista general de operación comercial y soporte"
        action={
          <Button variant="secondary" onClick={loadDashboardData} icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}>
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          color="brand"
          icon={<Users />}
          label="Clientes Totales"
          value={metrics.totalClients.toLocaleString()}
        />
        <StatCard
          color="info"
          icon={<Ticket />}
          label="Tickets Totales"
          value={metrics.totalTickets.toLocaleString()}
        />
        <StatCard
          color="success"
          icon={<CheckCircle2 />}
          label="Resueltos"
          value={metrics.resolvedTickets.toLocaleString()}
        />
        <StatCard
          color="warning"
          icon={<PhoneCall />}
          label="Llamadas Recibidas"
          value={metrics.incomingCalls.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <PhoneCall className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Llamadas</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalCalls.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Totales (entrantes + salientes)</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Correos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalEmails.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No leídos: {metrics.unreadEmails.toLocaleString()}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chat</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalChats.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Activos: {metrics.openChats.toLocaleString()}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pipeline</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalOpportunities.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Abiertas: {metrics.openOpportunities.toLocaleString()} | Valor: {metrics.pipelineValue.toLocaleString()}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ventas</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalQuotes.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Activas: {metrics.openQuotes.toLocaleString()} | Convertidas: {metrics.convertedQuotes.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Análisis de Tickets por Estado</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: 'open', label: 'Abiertos', color: 'bg-sky-500' },
              { key: 'in_progress', label: 'En progreso', color: 'bg-brand-500' },
              { key: 'waiting', label: 'En espera', color: 'bg-amber-500' },
              { key: 'resolved', label: 'Resueltos', color: 'bg-emerald-500' },
              { key: 'closed', label: 'Cerrados', color: 'bg-slate-400' },
            ].map((item) => {
              const value = statusBreakdown[item.key as keyof typeof statusBreakdown] || 0;
              const percentage = metrics.totalTickets > 0 ? Math.round((value / metrics.totalTickets) * 100) : 0;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{item.label}</span>
                    <span className="text-slate-500 dark:text-slate-400">{value} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Actividad de Tickets (7 días)</h2>
          </div>

          <div className="h-64 flex items-end justify-between gap-3 border border-slate-100 dark:border-slate-700 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-900/40">
            {weeklyTickets.map((point) => {
              const heightPercent = Math.max(Math.round((point.value / maxWeeklyValue) * 100), point.value > 0 ? 12 : 4);
              return (
                <div key={point.label} className="flex-1 flex flex-col items-center justify-end gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{point.value}</span>
                  <div className="w-full max-w-[36px] rounded-t-md bg-gradient-to-t from-brand-600 to-accent-500" style={{ height: `${heightPercent}%` }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{point.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Top Clientes y Últimos Tickets</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Actualizado en tiempo real</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
          <div className="p-6 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Clientes con mayor facturación</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Empresa</th>
                    <th className="pb-3 font-medium">Contacto</th>
                    <th className="pb-3 font-medium text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client, index) => (
                    <tr key={client.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                      <td className="py-3 text-slate-700 dark:text-slate-300 font-semibold">{index + 1}</td>
                      <td className="py-3 text-slate-900 dark:text-white font-medium">{client.company_name}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{client.contact_name || '—'}</td>
                      <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">${client.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                  {topClients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">Sin datos de facturación disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Últimos tickets creados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-3 font-medium">Ticket</th>
                    <th className="pb-3 font-medium">Asunto</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                      <td className="py-3 text-slate-900 dark:text-white font-medium">{ticket.ticket_number || '—'}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-300 max-w-[220px] truncate">{ticket.subject || '(Sin asunto)'}</td>
                      <td className="py-3">
                        <Badge variant="neutral">{ticket.status}</Badge>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{ticket.priority}</td>
                    </tr>
                  ))}
                  {recentTickets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">No hay tickets recientes</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-slate-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          Actualizando dashboard...
        </div>
      )}
    </div>
  );
}
