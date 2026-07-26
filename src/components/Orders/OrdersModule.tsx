import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  DollarSign, Calendar, Building2, Search, Eye, X, ShoppingCart,
  FileText, Truck, MapPin, CreditCard, LifeBuoy, Send
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  address: string;
  city: string;
  country: string;
}

interface OrderItem {
  id: string;
  item_type: 'product' | 'service';
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_total: number;
  notes: string;
  currency?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  numero_cfe?: string;
  serie_cfe?: string;
  tipo_cfe?: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  dgi_estado?: string;
  dgi_codigo_autorizacion?: string;
  observations?: string;
}

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  status: string;
  order_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  shipping_cost: number;
  total_amount: number;
  currency: string;
  notes: string;
  customer_notes: string;
  shipping_address: string;
  billing_address: string;
  payment_terms: string;
  payment_status: string;
  created_at: string;
  clients?: Client;
  external_order_id?: string;
  external_partner_id?: string;
  payment_method?: string;
  metadata?: any;
}

export function OrdersModule() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketCategories, setTicketCategories] = useState<any[]>([]);
  const [ticketFormData, setTicketFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category_id: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    thisMonth: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const { setActiveModule } = useNavigation();

  const convertCurrencyCode = (code: string | undefined): string => {
    if (!code) return 'UYU';
    const currencyMap: { [key: string]: string } = {
      '858': 'UYU',
      '840': 'USD',
      '032': 'ARS',
      '986': 'BRL',
      'UYU': 'UYU',
      'USD': 'USD',
      'ARS': 'ARS',
      'BRL': 'BRL'
    };
    return currencyMap[code] || code;
  };

  useEffect(() => {
    loadOrders();
    loadTicketCategories();

    const ordersChannel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, searchTerm ? 500 : 0);

    return () => clearTimeout(timer);
  }, [currentPage, searchTerm]);

  useEffect(() => {
    if (searchTerm) {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      setTotalOrders(count || 0);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('orders')
        .select(`
          *,
          clients (
            id,
            company_name,
            contact_name,
            email,
            address,
            city,
            country
          )
        `);

      if (searchTerm) {
        query = query.or(`order_number.ilike.%${searchTerm}%,clients.company_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setOrders(data);

        const { data: allData } = await supabase
          .from('orders')
          .select('status, payment_status, total_amount, created_at');

        if (allData) {
          calculateStats(allData);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersData: Order[]) => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidOrders = ordersData.filter(o =>
      o.payment_status === 'paid' || o.payment_status === 'confirmed'
    );

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    setStats({
      total: ordersData.length,
      pending: ordersData.filter(o => o.status === 'pending' || o.payment_status === 'unpaid').length,
      confirmed: ordersData.filter(o => o.status === 'confirmed').length,
      shipped: ordersData.filter(o => o.status === 'shipped').length,
      completed: ordersData.filter(o => o.status === 'completed' || o.payment_status === 'paid').length,
      cancelled: ordersData.filter(o => o.status === 'cancelled').length,
      totalRevenue,
      avgOrderValue: paidOrders.length > 0
        ? totalRevenue / paidOrders.length
        : 0,
      thisMonth: ordersData.filter(o => new Date(o.created_at) >= firstDayThisMonth).length
    });
  };

  const loadTicketCategories = async () => {
    const { data, error } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setTicketCategories(data);
      return;
    }

    const { data: fallbackData } = await supabase
      .from('ticket_categories')
      .select('*')
      .order('name');

    if (fallbackData) {
      setTicketCategories(fallbackData);
    }
  };

  const handleCreateTicket = (order: Order) => {
    saveTicketCreateDraft({
      client_id: order.client_id || undefined,
      order_id: order.id,
      subject: `Soporte para Orden ${order.order_number}`,
      description: `Cliente: ${order.clients?.company_name || order.clients?.contact_name}\nOrden: ${order.order_number}\nMonto: $${order.total_amount}\n\nDescripción del problema:\n`,
      priority: 'medium',
      source_module: 'ordenes',
      source_name: order.clients?.contact_name || order.clients?.company_name || undefined,
      source_email: order.clients?.email || undefined
    });

    setShowTicketModal(false);
    setActiveModule('tickets');
    toast.success('Completá el ticket en el formulario unificado');
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder || !user) {
      toast.error('Error al crear el ticket');
      return;
    }

    try {
      const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          client_id: selectedOrder.client_id,
          order_id: selectedOrder.id,
          subject: ticketFormData.subject,
          description: ticketFormData.description,
          priority: ticketFormData.priority,
          category_id: ticketFormData.category_id || null,
          status: 'open',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Ticket ${ticketNumber} creado exitosamente`);
      setShowTicketModal(false);
      setTicketFormData({
        subject: '',
        description: '',
        priority: 'medium',
        category_id: ''
      });
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast.error('Error al crear el ticket');
    }
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at');

    if (itemsData) {
      setSelectedOrderItems(itemsData);
    }

    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invoiceData) {
      setSelectedInvoice(invoiceData);
    } else {
      setSelectedInvoice(null);
    }

    setShowViewModal(true);
  };

  const getStatusVariant = (status: string): BadgeVariant => {
    const statusVariants: { [key: string]: BadgeVariant } = {
      pending: 'warning',
      confirmed: 'info',
      processing: 'info',
      shipped: 'brand',
      delivered: 'success',
      completed: 'success',
      cancelled: 'danger'
    };
    return statusVariants[status] || 'neutral';
  };

  const getPaymentStatusVariant = (status: string): BadgeVariant => {
    const statusVariants: { [key: string]: BadgeVariant } = {
      unpaid: 'danger',
      pending: 'warning',
      partial: 'warning',
      paid: 'success',
      confirmed: 'success',
      refunded: 'brand',
      cancelled: 'neutral'
    };
    return statusVariants[status] || 'neutral';
  };

  const totalPages = Math.ceil(totalOrders / itemsPerPage);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Gestión de Órdenes"
        subtitle="Seguimiento de órdenes y facturación"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          color="brand"
          icon={<Package />}
          label="Total Órdenes"
          value={stats.total}
        />
        <StatCard
          color="success"
          icon={<DollarSign />}
          label="Ingresos Totales"
          value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        />
        <StatCard
          color="warning"
          icon={<Clock />}
          label="Pendientes"
          value={stats.pending}
        />
        <StatCard
          color="info"
          icon={<CheckCircle />}
          label="Valor Promedio"
          value={`$${stats.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        />
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Orden</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Monto</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Estado</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Pago</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-brand-200 dark:border-brand-500/30 border-t-brand-600 rounded-full animate-spin"></div>
                      <p className="text-slate-500 dark:text-slate-400">Cargando órdenes...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Package className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-lg">No hay órdenes registradas</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Las órdenes de Dogcatify aparecerán aquí</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="bg-brand-100 dark:bg-brand-500/10 p-2 rounded-lg">
                          <ShoppingCart className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{order.order_number}</span>
                          {order.external_order_id && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">DC: {order.external_order_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-900 dark:text-white font-medium">
                          {order.clients?.company_name || order.clients?.contact_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                        ${Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{convertCurrencyCode(order.currency)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {new Date(order.order_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={getPaymentStatusVariant(order.payment_status)}>
                        {order.payment_status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateTicket(order)}
                          className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition"
                          title="Crear Ticket de Soporte"
                        >
                          <LifeBuoy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Página {currentPage} de {totalPages} ({totalOrders} órdenes en total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-accent-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Orden {selectedOrder.order_number}</h2>
                  <p className="text-white/80 mt-1">Detalles completos de la orden</p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">CLIENTE</h3>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedOrder.clients?.company_name || selectedOrder.clients?.contact_name}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">{selectedOrder.clients?.email}</p>
                  {selectedOrder.clients?.address && (
                    <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {selectedOrder.clients.address}, {selectedOrder.clients.city}, {selectedOrder.clients.country}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="mb-4 flex justify-end gap-2">
                    <Badge variant={getStatusVariant(selectedOrder.status)} className="!text-sm !px-4 !py-2">
                      {selectedOrder.status}
                    </Badge>
                    <Badge variant={getPaymentStatusVariant(selectedOrder.payment_status)} className="!text-sm !px-4 !py-2">
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-600 dark:text-slate-300 flex items-center justify-end gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">Fecha:</span> {new Date(selectedOrder.order_date).toLocaleDateString()}
                    </p>
                    {selectedOrder.payment_method && (
                      <p className="text-slate-600 dark:text-slate-300 flex items-center justify-end gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-medium">Pago:</span> {selectedOrder.payment_method}
                      </p>
                    )}
                    {selectedOrder.external_order_id && (
                      <p className="text-slate-600 dark:text-slate-300 flex items-center justify-end gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span className="font-medium">ID Externo:</span> {selectedOrder.external_order_id}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.shipping_address && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Truck className="w-5 h-5 text-slate-600 dark:text-slate-300 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Dirección de Envío</h4>
                      <p className="text-slate-700 dark:text-slate-300 text-sm">{selectedOrder.shipping_address}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Items de la Orden</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</th>
                      <th className="text-center py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Cantidad</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Precio Unit.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Desc.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-3 text-slate-900 dark:text-white">
                          {item.description}
                          {item.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 text-center text-slate-700 dark:text-slate-300">{item.quantity}</td>
                        <td className="py-3 text-right text-slate-700 dark:text-slate-300">
                          ${item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-slate-700 dark:text-slate-300">
                          {item.discount_percent > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {item.discount_percent}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">
                          ${item.line_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="w-96 space-y-3">
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Descuento:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">-${selectedOrder.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>IVA ({selectedOrder.tax_rate}%):</span>
                    <span className="font-semibold">${selectedOrder.tax_amount.toFixed(2)}</span>
                  </div>
                  {selectedOrder.shipping_cost > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Envío:</span>
                      <span className="font-semibold">${selectedOrder.shipping_cost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-2xl font-bold text-brand-600 dark:text-brand-400 pt-3 border-t-2 border-brand-200 dark:border-brand-500/30">
                    <span>TOTAL:</span>
                    <span>${selectedOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl p-6 border border-emerald-200 dark:border-emerald-500/30">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-600 rounded-lg">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Información de Factura</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Número de Factura</p>
                            <p className="font-bold text-slate-900 dark:text-white">{selectedInvoice.invoice_number}</p>
                          </div>
                          {selectedInvoice.numero_cfe && (
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">CFE</p>
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">{selectedInvoice.numero_cfe}</p>
                              {selectedInvoice.serie_cfe && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Serie: {selectedInvoice.serie_cfe}</p>
                              )}
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Estado</p>
                            <Badge variant="success">{selectedInvoice.status}</Badge>
                          </div>
                          {selectedInvoice.dgi_estado && (
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Estado DGI</p>
                              <Badge variant={selectedInvoice.dgi_estado === 'aprobado' ? 'success' : 'danger'}>
                                {selectedInvoice.dgi_estado}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Fecha de Emisión</p>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Monto Total</p>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              ${selectedInvoice.total_amount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {selectedInvoice.observations && (
                          <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Observaciones</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{selectedInvoice.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!selectedInvoice && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-6 border border-amber-200 dark:border-amber-500/30 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
                    <p className="text-slate-700 dark:text-slate-200 font-medium">No hay factura asociada a esta orden</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">La factura será agregada desde el sistema contable</p>
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Notas Internas</h4>
                  <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.customer_notes && (
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Notas del Cliente</h4>
                  <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">{selectedOrder.customer_notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                  Cerrar
                </Button>
                <Button
                  variant="secondary"
                  className="!bg-emerald-600 !text-white !border-emerald-600 hover:!bg-emerald-700"
                  onClick={() => {
                    if (selectedOrder) {
                      handleCreateTicket(selectedOrder);
                      setShowViewModal(false);
                    }
                  }}
                  icon={<LifeBuoy className="w-5 h-5" />}
                >
                  Crear Ticket de Soporte
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTicketModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Crear Ticket de Soporte</h2>
                  <p className="text-emerald-100 mt-1">Orden: {selectedOrder.order_number}</p>
                </div>
                <button
                  onClick={() => setShowTicketModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-6 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {selectedOrder.clients?.company_name || selectedOrder.clients?.contact_name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{selectedOrder.clients?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">Orden:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-2">{selectedOrder.order_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-300">Monto:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-2">
                      ${selectedOrder.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Asunto *
                </label>
                <input
                  type="text"
                  value={ticketFormData.subject}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Resumen del problema"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Descripción *
                </label>
                <textarea
                  value={ticketFormData.description}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={6}
                  placeholder="Describe el problema detalladamente..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Prioridad *
                  </label>
                  <select
                    value={ticketFormData.priority}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Categoría
                  </label>
                  <select
                    value={ticketFormData.category_id}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, category_id: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Sin categoría</option>
                    {ticketCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowTicketModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 !bg-emerald-600 hover:!from-emerald-700 hover:!to-emerald-700 !from-emerald-600 !to-emerald-600"
                  icon={<Send className="w-5 h-5" />}
                >
                  Crear Ticket
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
