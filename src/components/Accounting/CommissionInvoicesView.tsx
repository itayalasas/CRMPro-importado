import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, AlertCircle, RefreshCw, X, Eye, Calendar, DollarSign } from 'lucide-react';
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

export function CommissionInvoicesView() {
  const [invoices, setInvoices] = useState<CommissionInvoice[]>([]);
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
    fetchCommissionInvoices();
  }, [filter]);

  const fetchCommissionInvoices = async () => {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        partners (name, company_name, rut),
        payment_periods (name, start_date, end_date)
      `)
      .eq('is_commission_invoice', true)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.is('cancelled_at', null);
    } else if (filter === 'cancelled') {
      query = query.not('cancelled_at', 'is', null);
    }

    const { data, error } = await query;

    if (!error && data) {
      setInvoices(data as any);
    }
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
          fetchCommissionInvoices();
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
          fetchCommissionInvoices();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Facturas de Comisión</h2>
          <p className="text-gray-600 mt-1">Gestiona las facturas de comisiones generadas</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Activas
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'cancelled'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Anuladas
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todas
        </button>
      </div>

      <div className="grid gap-4">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'cancelled'
                ? 'No hay facturas anuladas'
                : 'No hay facturas de comisión generadas'}
            </p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition ${
                invoice.cancelled_at ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{invoice.invoice_number}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      invoice.cancelled_at
                        ? 'bg-red-100 text-red-800'
                        : getStatusColor(invoice.status)
                    }`}>
                      {invoice.cancelled_at ? 'Anulada' : getStatusLabel(invoice.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                    {invoice.payment_periods && (
                      <div>
                        <span className="text-gray-500">Período:</span>
                        <p className="font-medium">{invoice.payment_periods.name}</p>
                      </div>
                    )}
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
                          {invoice.cancellation_reason && (
                            <p className="text-red-600 mt-1">{invoice.cancellation_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleViewDetails(invoice)}
                  className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
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
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
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
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
