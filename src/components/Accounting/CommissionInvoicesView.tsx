import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText, AlertCircle, RefreshCw, X, Eye, Calendar, DollarSign,
  ChevronDown, ChevronRight, Users, CheckCircle, Clock, XCircle
} from 'lucide-react';
import { ConfirmDialog } from '../Common/ConfirmDialog';

interface CommissionInvoice {
  id: string;
  invoice_number: string;
  partner_id: string;
  payment_period_id?: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  is_commission_invoice: boolean;
  commission_iva_rate: number;
  notes?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  replaced_by_invoice_id?: string;
  created_at: string;
  partners?: {
    name: string;
    company_name: string;
    rut: string;
  };
  payment_periods?: {
    name: string;
    start_date: string;
    end_date: string;
  };
}

interface AssociatedInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  commission_amount: number;
  issue_date: string;
  status: string;
}

interface PaymentPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface PeriodGroup {
  period: PaymentPeriod;
  invoices: CommissionInvoice[];
  stats: {
    totalInvoices: number;
    activeInvoices: number;
    cancelledInvoices: number;
    totalAmount: number;
    totalCommissions: number;
    uniquePartners: number;
  };
}

interface CommissionInvoicesViewProps {
  onInvoiceCancelled?: () => void;
}

export function CommissionInvoicesView({ onInvoiceCancelled }: CommissionInvoicesViewProps) {
  const [periodGroups, setPeriodGroups] = useState<PeriodGroup[]>([]);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [selectedInvoice, setSelectedInvoice] = useState<CommissionInvoice | null>(null);
  const [associatedInvoices, setAssociatedInvoices] = useState<AssociatedInvoice[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('active');
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchCommissionInvoicesByPeriod();
  }, [filter]);

  const fetchCommissionInvoicesByPeriod = async () => {
    try {
      // Fetch all payment periods
      const { data: periods, error: periodsError } = await supabase
        .from('payment_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (periodsError) throw periodsError;

      if (!periods || periods.length === 0) {
        setPeriodGroups([]);
        return;
      }

      // Fetch all commission invoices
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          *,
          partners (name, company_name, rut),
          payment_periods (name, start_date, end_date)
        `)
        .eq('is_commission_invoice', true);

      if (filter === 'active') {
        invoicesQuery = invoicesQuery.is('cancelled_at', null);
      } else if (filter === 'cancelled') {
        invoicesQuery = invoicesQuery.not('cancelled_at', 'is', null);
      }

      const { data: invoices, error: invoicesError } = await invoicesQuery;

      if (invoicesError) throw invoicesError;

      // Group invoices by period
      const groups: PeriodGroup[] = periods.map(period => {
        const periodInvoices = (invoices || []).filter(
          inv => inv.payment_period_id === period.id
        );

        const uniquePartners = new Set(periodInvoices.map(inv => inv.partner_id)).size;
        const activeInvoices = periodInvoices.filter(inv => !inv.cancelled_at);
        const cancelledInvoices = periodInvoices.filter(inv => inv.cancelled_at);
        const totalAmount = activeInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const totalCommissions = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);

        return {
          period,
          invoices: periodInvoices as CommissionInvoice[],
          stats: {
            totalInvoices: periodInvoices.length,
            activeInvoices: activeInvoices.length,
            cancelledInvoices: cancelledInvoices.length,
            totalAmount,
            totalCommissions,
            uniquePartners
          }
        };
      });

      // Filter out periods with no invoices if showing only active/cancelled
      const filteredGroups = filter === 'all'
        ? groups
        : groups.filter(g => g.invoices.length > 0);

      setPeriodGroups(filteredGroups);
    } catch (error: any) {
      console.error('Error fetching commission invoices:', error);
      toast.error('Error al cargar facturas de comisión');
    }
  };

  const togglePeriod = (periodId: string) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodId)) {
      newExpanded.delete(periodId);
    } else {
      newExpanded.add(periodId);
    }
    setExpandedPeriods(newExpanded);
  };

  const fetchAssociatedInvoices = async (commissionInvoiceId: string) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, commission_amount, issue_date, status')
      .eq('commission_invoice_id', commissionInvoiceId)
      .order('issue_date', { ascending: false });

    if (!error && data) {
      setAssociatedInvoices(data);
    }
  };

  const handleViewDetails = async (invoice: CommissionInvoice) => {
    setSelectedInvoice(invoice);
    await fetchAssociatedInvoices(invoice.id);
    setShowDetailModal(true);
  };

  const handleCancelInvoice = (invoice: CommissionInvoice) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Anular factura de comisión?',
      message: `Esta acción liberará todas las facturas asociadas (${associatedInvoices.length}) para que puedan ser re-facturadas. ¿Desea continuar?`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('cancel_commission_invoice', {
            p_commission_invoice_id: invoice.id,
            p_cancelled_by: user?.email || 'unknown',
            p_reason: 'Anulada desde interfaz de usuario'
          });

          if (error) throw error;

          toast.success(`Factura anulada. ${data.freed_invoices_count} facturas liberadas`);
          setShowDetailModal(false);
          fetchCommissionInvoicesByPeriod();

          if (onInvoiceCancelled) {
            onInvoiceCancelled();
          }
        } catch (error: any) {
          toast.error('Error al anular factura: ' + error.message);
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleRegenerateInvoice = (invoice: CommissionInvoice) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Regenerar factura de comisión?',
      message: 'Se creará una nueva factura con las facturas pendientes actuales del partner. ¿Desea continuar?',
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.rpc('regenerate_commission_invoice', {
            p_old_commission_invoice_id: invoice.id,
            p_generated_by: user?.email || 'unknown'
          });

          if (error) throw error;

          toast.success('Factura regenerada exitosamente');
          setShowDetailModal(false);
          fetchCommissionInvoicesByPeriod();
        } catch (error: any) {
          toast.error('Error al regenerar factura: ' + error.message);
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'draft': 'Borrador',
      'sent': 'Enviada',
      'paid': 'Pagada',
      'overdue': 'Vencida',
      'cancelled': 'Anulada'
    };
    return labels[status] || status;
  };

  const getPeriodStatusInfo = (stats: PeriodGroup['stats']) => {
    if (stats.totalInvoices === 0) {
      return {
        icon: Clock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        label: 'Sin facturas'
      };
    }
    if (stats.cancelledInvoices > 0) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: `${stats.cancelledInvoices} anulada${stats.cancelledInvoices > 1 ? 's' : ''}`
      };
    }
    if (stats.activeInvoices === stats.totalInvoices) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Completo'
      };
    }
    return {
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      label: 'En progreso'
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Facturas de Comisión</h2>
          <p className="text-gray-600 mt-1">Gestiona las facturas de comisiones agrupadas por quincena</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Activas
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'cancelled'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Anuladas
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todas
        </button>
      </div>

      <div className="space-y-4">
        {periodGroups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'cancelled'
                ? 'No hay facturas anuladas'
                : 'No hay facturas de comisión generadas'}
            </p>
          </div>
        ) : (
          periodGroups.map((group) => {
            const isExpanded = expandedPeriods.has(group.period.id);
            const statusInfo = getPeriodStatusInfo(group.stats);
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={group.period.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Period Header */}
                <button
                  onClick={() => togglePeriod(group.period.id)}
                  className="w-full p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${statusInfo.bgColor}`}>
                        <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-900">{group.period.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(group.period.start_date).toLocaleDateString()} - {new Date(group.period.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      {/* Stats Summary */}
                      <div className="grid grid-cols-4 gap-6 text-center">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{group.stats.totalInvoices}</p>
                          <p className="text-xs text-gray-500">Facturas</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">${group.stats.totalAmount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{group.stats.uniquePartners}</p>
                          <p className="text-xs text-gray-500">Partners</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-700">
                            {group.stats.activeInvoices}/{group.stats.totalInvoices}
                          </p>
                          <p className="text-xs text-gray-500">Activas</p>
                        </div>
                      </div>

                      {/* Expand Icon */}
                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="w-6 h-6" />
                        ) : (
                          <ChevronRight className="w-6 h-6" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Invoice List */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {group.invoices.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No hay facturas en este período
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {group.invoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition ${
                              invoice.cancelled_at ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="text-lg font-semibold text-gray-900">{invoice.invoice_number}</h4>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    invoice.cancelled_at
                                      ? 'bg-red-100 text-red-800'
                                      : getStatusColor(invoice.status)
                                  }`}>
                                    {invoice.cancelled_at ? 'Anulada' : getStatusLabel(invoice.status)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Partner:</span>
                                    <p className="font-medium">{invoice.partners?.name}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <p className="font-semibold text-lg text-green-600">
                                      ${invoice.total_amount.toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Fecha:</span>
                                    <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</p>
                                  </div>
                                </div>

                                {invoice.cancelled_at && (
                                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                      <div className="text-sm">
                                        <p className="font-medium text-red-800">Factura anulada</p>
                                        <p className="text-red-600">
                                          {new Date(invoice.cancelled_at).toLocaleDateString()} por {invoice.cancelled_by}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleViewDetails(invoice)}
                                className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoice_number}</h2>
                <p className="text-gray-600">{selectedInvoice.partners?.name}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-600">Subtotal Comisiones</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">${selectedInvoice.subtotal.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-600">Total con IVA</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${selectedInvoice.total_amount.toFixed(2)}</p>
                </div>
              </div>

              {selectedInvoice.payment_periods && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Período de Pago</span>
                  </div>
                  <p className="text-gray-700">{selectedInvoice.payment_periods.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedInvoice.payment_periods.start_date).toLocaleDateString()} -{' '}
                    {new Date(selectedInvoice.payment_periods.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-3">
                  Facturas Incluidas ({associatedInvoices.length})
                </h3>
                <div className="space-y-2">
                  {associatedInvoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-500">{new Date(inv.issue_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">${inv.commission_amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">de ${inv.total_amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!selectedInvoice.cancelled_at && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleCancelInvoice(selectedInvoice)}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition"
                  >
                    <X className="w-5 h-5" />
                    Anular Factura
                  </button>
                </div>
              )}

              {selectedInvoice.cancelled_at && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleRegenerateInvoice(selectedInvoice)}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Regenerar Factura
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
