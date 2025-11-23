import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  DollarSign, Calendar, Building2, Search, Eye, X, ShoppingCart,
  FileText, Truck, MapPin, CreditCard, LifeBuoy, Send
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

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
    const { data } = await supabase
      .from('ticket_categories')
      .select('*')
      .order('name');

    if (data) {
      setTicketCategories(data);
    }
  };

  const handleCreateTicket = (order: Order) => {
    setSelectedOrder(order);
    setTicketFormData({
      subject: `Soporte para Orden ${order.order_number}`,
      description: `Cliente: ${order.clients?.company_name || order.clients?.contact_name}\nOrden: ${order.order_number}\nMonto: $${order.total_amount}\n\nDescripción del problema:\n`,
      priority: 'medium',
      category_id: ''
    });
    setShowTicketModal(true);
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

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
      processing: 'bg-cyan-100 text-cyan-700 border-cyan-300',
      shipped: 'bg-purple-100 text-purple-700 border-purple-300',
      delivered: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      completed: 'bg-green-100 text-green-700 border-green-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300'
    };
    return statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const getPaymentStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      unpaid: 'bg-red-100 text-red-700 border-red-300',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      partial: 'bg-orange-100 text-orange-700 border-orange-300',
      paid: 'bg-green-100 text-green-700 border-green-300',
      confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      refunded: 'bg-purple-100 text-purple-700 border-purple-300',
      cancelled: 'bg-slate-100 text-slate-700 border-slate-300'
    };
    return statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const totalPages = Math.ceil(totalOrders / itemsPerPage);

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Gestión de Órdenes</h1>
        <p className="text-slate-600">Seguimiento de órdenes y facturación</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Package className="w-8 h-8" />
            </div>
            <TrendingUp className="w-5 h-5 opacity-80" />
          </div>
          <div className="space-y-1">
            <p className="text-blue-100 text-sm font-medium">Total Órdenes</p>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-blue-100 text-xs">{stats.thisMonth} este mes</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-emerald-100 text-sm font-medium">Ingresos Totales</p>
            <p className="text-3xl font-bold">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-emerald-100 text-xs">{stats.completed} completadas</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Clock className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-amber-100 text-sm font-medium">Pendientes</p>
            <p className="text-3xl font-bold">{stats.pending}</p>
            <p className="text-amber-100 text-xs">requieren atención</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <CheckCircle className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-violet-100 text-sm font-medium">Valor Promedio</p>
            <p className="text-3xl font-bold">${stats.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-violet-100 text-xs">por orden</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Orden</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Cliente</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Monto</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Fecha</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Estado</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Pago</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-slate-500">Cargando órdenes...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">No hay órdenes registradas</p>
                    <p className="text-slate-400 text-sm mt-2">Las órdenes de Dogcatify aparecerán aquí</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <ShoppingCart className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">{order.order_number}</span>
                          {order.external_order_id && (
                            <p className="text-xs text-slate-500">DC: {order.external_order_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900 font-medium">
                          {order.clients?.company_name || order.clients?.contact_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-lg font-bold text-blue-600">
                        ${Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-xs text-slate-500">{convertCurrencyCode(order.currency)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-600">
                        {new Date(order.order_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateTicket(order)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Página {currentPage} de {totalPages} ({totalOrders} órdenes en total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Orden {selectedOrder.order_number}</h2>
                  <p className="text-blue-100 mt-1">Detalles completos de la orden</p>
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
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">CLIENTE</h3>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedOrder.clients?.company_name || selectedOrder.clients?.contact_name}
                  </p>
                  <p className="text-slate-600">{selectedOrder.clients?.email}</p>
                  {selectedOrder.clients?.address && (
                    <p className="text-slate-600 mt-2 text-sm flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {selectedOrder.clients.address}, {selectedOrder.clients.city}, {selectedOrder.clients.country}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="mb-4 flex justify-end gap-2">
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                      {selectedOrder.payment_status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-600 flex items-center justify-end gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">Fecha:</span> {new Date(selectedOrder.order_date).toLocaleDateString()}
                    </p>
                    {selectedOrder.payment_method && (
                      <p className="text-slate-600 flex items-center justify-end gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-medium">Pago:</span> {selectedOrder.payment_method}
                      </p>
                    )}
                    {selectedOrder.external_order_id && (
                      <p className="text-slate-600 flex items-center justify-end gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span className="font-medium">ID Externo:</span> {selectedOrder.external_order_id}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.shipping_address && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-start gap-3">
                    <Truck className="w-5 h-5 text-slate-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Dirección de Envío</h4>
                      <p className="text-slate-700 text-sm">{selectedOrder.shipping_address}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Items de la Orden</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 text-sm font-semibold text-slate-700">Descripción</th>
                      <th className="text-center py-3 text-sm font-semibold text-slate-700">Cantidad</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Precio Unit.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Desc.</th>
                      <th className="text-right py-3 text-sm font-semibold text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 text-slate-900">
                          {item.description}
                          {item.notes && (
                            <p className="text-xs text-slate-500 mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 text-center text-slate-700">{item.quantity}</td>
                        <td className="py-3 text-right text-slate-700">
                          ${item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-slate-700">
                          {item.discount_percent > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {item.discount_percent}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-900">
                          ${item.line_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-6">
                <div className="w-96 space-y-3">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Descuento:</span>
                      <span className="font-semibold text-red-600">-${selectedOrder.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700">
                    <span>IVA ({selectedOrder.tax_rate}%):</span>
                    <span className="font-semibold">${selectedOrder.tax_amount.toFixed(2)}</span>
                  </div>
                  {selectedOrder.shipping_cost > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Envío:</span>
                      <span className="font-semibold">${selectedOrder.shipping_cost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-2xl font-bold text-blue-600 pt-3 border-t-2 border-blue-200">
                    <span>TOTAL:</span>
                    <span>${selectedOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice && (
                <div className="border-t border-slate-200 pt-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-600 rounded-lg">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Información de Factura</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Número de Factura</p>
                            <p className="font-bold text-slate-900">{selectedInvoice.invoice_number}</p>
                          </div>
                          {selectedInvoice.numero_cfe && (
                            <div>
                              <p className="text-sm text-slate-600 mb-1">CFE</p>
                              <p className="font-bold text-emerald-600">{selectedInvoice.numero_cfe}</p>
                              {selectedInvoice.serie_cfe && (
                                <p className="text-xs text-slate-500">Serie: {selectedInvoice.serie_cfe}</p>
                              )}
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Estado</p>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">
                              {selectedInvoice.status}
                            </span>
                          </div>
                          {selectedInvoice.dgi_estado && (
                            <div>
                              <p className="text-sm text-slate-600 mb-1">Estado DGI</p>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                selectedInvoice.dgi_estado === 'aprobado'
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {selectedInvoice.dgi_estado}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Fecha de Emisión</p>
                            <p className="font-semibold text-slate-900">
                              {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Monto Total</p>
                            <p className="text-xl font-bold text-emerald-600">
                              ${selectedInvoice.total_amount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {selectedInvoice.observations && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
                            <p className="text-sm font-semibold text-slate-900 mb-1">Observaciones</p>
                            <p className="text-sm text-slate-700">{selectedInvoice.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!selectedInvoice && (
                <div className="border-t border-slate-200 pt-6">
                  <div className="bg-amber-50 rounded-xl p-6 border border-amber-200 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                    <p className="text-slate-700 font-medium">No hay factura asociada a esta orden</p>
                    <p className="text-sm text-slate-600 mt-1">La factura será agregada desde el sistema contable</p>
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Notas Internas</h4>
                  <p className="text-slate-700 bg-slate-50 p-4 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.customer_notes && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Notas del Cliente</h4>
                  <p className="text-slate-700 bg-slate-50 p-4 rounded-lg">{selectedOrder.customer_notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    if (selectedOrder) {
                      handleCreateTicket(selectedOrder);
                      setShowViewModal(false);
                    }
                  }}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium flex items-center gap-2"
                >
                  <LifeBuoy className="w-5 h-5" />
                  Crear Ticket de Soporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTicketModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedOrder.clients?.company_name || selectedOrder.clients?.contact_name}
                    </p>
                    <p className="text-sm text-slate-600">{selectedOrder.clients?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600">Orden:</span>
                    <span className="font-semibold text-slate-900 ml-2">{selectedOrder.order_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Monto:</span>
                    <span className="font-semibold text-slate-900 ml-2">
                      ${selectedOrder.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Asunto *
                </label>
                <input
                  type="text"
                  value={ticketFormData.subject}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Resumen del problema"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción *
                </label>
                <textarea
                  value={ticketFormData.description}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={6}
                  placeholder="Describe el problema detalladamente..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Prioridad *
                  </label>
                  <select
                    value={ticketFormData.priority}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Categoría
                  </label>
                  <select
                    value={ticketFormData.category_id}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, category_id: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Crear Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
