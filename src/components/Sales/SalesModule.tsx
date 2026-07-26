import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Download,
  Edit2,
  FileText,
  Eye,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import { getEnvVar, waitForConfig } from '../../lib/envLoader';
import {
  buildOrderCommunicationRequest,
  buildQuoteCommunicationMetadata,
  buildQuoteCommunicationRequest,
  getQuoteCommunicationPdfFilename,
  getQuoteCommunicationPdfUrl,
  getQuoteCommunicationPublicToken,
  type QuoteCommunicationCompanySettings,
  type QuoteCommunicationResponse,
} from '../../lib/quoteCommunication';
import { resolveDefaultSalesOpportunityStageId } from '../../lib/salesOpportunityStage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Card } from '../ui/Card';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

type SalesTab = 'quotes' | 'products';
type ProductType = 'product' | 'service';
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

interface SalesProduct {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  product_type: ProductType;
  unit_price: number | string;
  cost_price: number | string;
  currency: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SalesClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: string | null;
}

interface SalesOpportunity {
  id: string;
  opportunity_number: string;
  title: string;
  client_id: string | null;
  stage: string;
  status: string;
  expected_amount: number | string;
  currency: string;
}

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number | string;
}

interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string | null;
  description: string;
  item_type: ProductType;
  quantity: number | string;
  unit_price: number | string;
  discount_percent: number | string;
  discount_amount: number | string;
  line_total: number | string;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  product?: SalesProduct | null;
}

const buildQuoteFormFromQuote = (quote: SalesQuote): QuoteFormState => ({
  client_id: quote.client_id || '',
  opportunity_id: quote.opportunity_id || '',
  quote_date: quote.quote_date || todayDate(),
  expiry_date: quote.expiry_date || '',
  currency: normalizeCurrency(quote.currency),
  tax_rate: String(parseDecimal(quote.tax_rate) || 0),
  discount_amount: String(parseDecimal(quote.discount_amount) || 0),
  notes: quote.notes || '',
  terms: quote.terms || '',
});

const buildQuoteItemsFromQuote = (quote: SalesQuote): QuoteDraftItem[] => {
  const sourceItems = quote.items?.length ? quote.items : [];

  if (!sourceItems.length) {
    return [createDraftItem(quote.currency)];
  }

  return sourceItems.map((item) => ({
    id: item.id,
    product_id: item.product_id || '',
    product_name: item.product_name || '',
    description: item.description || item.product_name || '',
    item_type: item.item_type,
    quantity: String(item.quantity ?? 1),
    unit_price: String(item.unit_price ?? ''),
    discount_percent: String(item.discount_percent ?? 0),
    currency: normalizeCurrency(item.currency || quote.currency),
  }));
};

interface QuoteTimelineItem {
  id: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

interface SalesQuote {
  id: string;
  quote_number: string;
  client_id: string | null;
  opportunity_id: string | null;
  order_id: string | null;
  status: QuoteStatus;
  quote_date: string;
  expiry_date: string | null;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  notes: string | null;
  terms: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  accepted_at: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: SalesClient | null;
  opportunity?: SalesOpportunity | null;
  order?: SalesOrder | null;
  items?: QuoteItem[] | null;
}

interface SystemUser {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  is_active: boolean | null;
}

interface ProductFormState {
  sku: string;
  name: string;
  description: string;
  category: string;
  product_type: ProductType;
  unit_price: string;
  cost_price: string;
  currency: string;
  is_active: boolean;
}

interface QuoteFormState {
  client_id: string;
  opportunity_id: string;
  quote_date: string;
  expiry_date: string;
  currency: string;
  tax_rate: string;
  discount_amount: string;
  notes: string;
  terms: string;
}

interface QuoteDraftItem {
  id: string;
  product_id: string;
  product_name: string;
  description: string;
  item_type: ProductType;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  currency: string;
}

const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  converted: 'Convertida',
};

const quoteStatusClasses: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-sky-100 text-sky-700 border-sky-200',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  expired: 'bg-amber-100 text-amber-700 border-amber-200',
  converted: 'bg-violet-100 text-violet-700 border-violet-200',
};

const quoteStatusBadgeVariant: Record<QuoteStatus, BadgeVariant> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  converted: 'brand',
};

const productTypeLabels: Record<ProductType, string> = {
  product: 'Producto',
  service: 'Servicio',
};

const initialProductForm = (): ProductFormState => ({
  sku: '',
  name: '',
  description: '',
  category: '',
  product_type: 'product',
  unit_price: '',
  cost_price: '',
  currency: 'USD',
  is_active: true,
});

const todayDate = () => new Date().toISOString().slice(0, 10);

const initialQuoteForm = (): QuoteFormState => ({
  client_id: '',
  opportunity_id: '',
  quote_date: todayDate(),
  expiry_date: '',
  currency: 'USD',
  tax_rate: '22',
  discount_amount: '0',
  notes: '',
  terms: 'Valida por 15 dias',
});

const createDraftItem = (currency = 'USD'): QuoteDraftItem => ({
  id: crypto.randomUUID(),
  product_id: '',
  product_name: '',
  description: '',
  item_type: 'product',
  quantity: '1',
  unit_price: '',
  discount_percent: '0',
  currency,
});

const parseDecimal = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrency = (currency: string | null | undefined) => {
  const safe = String(currency || 'USD').trim().toUpperCase();
  return safe || 'USD';
};

const formatCurrency = (value: number, currency: string) => {
  const safeCurrency = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 0,
    }).format(value);
  }
};

const formatDate = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getQuoteStatusMeta = (status: QuoteStatus) => ({
  label: quoteStatusLabels[status],
  className: quoteStatusClasses[status],
});

const quoteStatusDescriptions: Record<QuoteStatus, string> = {
  draft: 'Aún está en borrador. Puedes editarla, enviarla o seguir armando los items.',
  sent: 'Ya fue enviada al cliente y quedó esperando respuesta.',
  accepted: 'El cliente la aceptó y ya puede convertirse en orden.',
  rejected: 'El cliente la rechazó. Puedes revisarla, editarla o generar una nueva propuesta.',
  expired: 'Se venció por fecha límite antes de cerrarse.',
  converted: 'Ya se convirtió en una orden y queda bloqueada para mantener la trazabilidad.',
};

const quoteNextActionLabels: Record<QuoteStatus, string> = {
  draft: 'Enviar al cliente',
  sent: 'Esperar o marcar respuesta',
  accepted: 'Convertir a orden',
  rejected: 'Revisar y reenviar',
  expired: 'Renovar propuesta',
  converted: 'Orden creada',
};

const quoteTimelineTypeMeta: Record<string, { label: string; className: string; detail: string; dotClassName: string }> = {
  quote_created: {
    label: 'Creada',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    detail: 'Se registró la cotización',
    dotClassName: 'bg-slate-500',
  },
  quote_sent: {
    label: 'Enviada',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
    detail: 'Se marcó como enviada al cliente',
    dotClassName: 'bg-sky-500',
  },
  quote_accepted: {
    label: 'Aceptada',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    detail: 'El cliente aceptó la propuesta',
    dotClassName: 'bg-emerald-500',
  },
  quote_rejected: {
    label: 'Rechazada',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    detail: 'El cliente rechazó la propuesta',
    dotClassName: 'bg-rose-500',
  },
  quote_expired: {
    label: 'Vencida',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    detail: 'La cotización venció sin respuesta',
    dotClassName: 'bg-amber-500',
  },
  quote_converted: {
    label: 'Convertida',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
    detail: 'Se transformó en una orden',
    dotClassName: 'bg-violet-500',
  },
  note: {
    label: 'Nota',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    detail: 'Seguimiento interno',
    dotClassName: 'bg-slate-400',
  },
  order: {
    label: 'Orden',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
    detail: 'Vinculada a una orden',
    dotClassName: 'bg-violet-500',
  },
  email: {
    label: 'Correo',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
    detail: 'Envío registrado',
    dotClassName: 'bg-sky-500',
  },
};

const quoteStateTypes = new Set([
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_rejected',
  'quote_expired',
  'quote_converted',
]);

const getTimelineEventType = (item: QuoteTimelineItem) => {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  const originalType = metadata && typeof metadata.original_type === 'string' ? metadata.original_type.trim() : '';
  return originalType || item.type;
};

const getTimelineEventMeta = (item: QuoteTimelineItem) => {
  const type = getTimelineEventType(item);
  return quoteTimelineTypeMeta[type] || quoteTimelineTypeMeta.note;
};

const getQuoteJourneyEvents = (quote: SalesQuote | null, timeline: QuoteTimelineItem[]) => {
  if (!quote) return [];

  const events: Array<{
    key: string;
    type: string;
    label: string;
    detail: string;
    timestamp: string | null;
    className: string;
  }> = [
    {
      key: 'quote_created',
      type: 'quote_created',
      label: 'Creada',
      detail: 'Cotización registrada en el sistema',
      timestamp: quote.created_at,
      className: quoteTimelineTypeMeta.quote_created.className,
    },
  ];

  const timelineStateEvents = timeline
    .filter((item) => quoteStateTypes.has(getTimelineEventType(item)))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const seenStateTypes = new Set<string>();

  for (const item of timelineStateEvents) {
    const type = getTimelineEventType(item);
    if (type === 'quote_created' || seenStateTypes.has(type)) continue;
    seenStateTypes.add(type);
    const meta = quoteTimelineTypeMeta[type] || quoteTimelineTypeMeta.note;
    events.push({
      key: item.id,
      type,
      label: meta.label,
      detail: item.description || meta.detail,
      timestamp: item.created_at,
      className: meta.className,
    });
  }

  const fallbackStateEntries: Record<QuoteStatus, { type: string; timestamp: string | null }> = {
    draft: { type: 'quote_created', timestamp: quote.created_at },
    sent: { type: 'quote_sent', timestamp: quote.sent_at },
    accepted: { type: 'quote_accepted', timestamp: quote.accepted_at },
    rejected: { type: 'quote_rejected', timestamp: quote.updated_at },
    expired: { type: 'quote_expired', timestamp: quote.updated_at },
    converted: { type: 'quote_converted', timestamp: quote.converted_at },
  };

  const currentStateType = fallbackStateEntries[quote.status];
  if (currentStateType && !seenStateTypes.has(currentStateType.type) && currentStateType.type !== 'quote_created') {
    const meta = quoteTimelineTypeMeta[currentStateType.type] || quoteTimelineTypeMeta.note;
    events.push({
      key: `${quote.id}-${currentStateType.type}`,
      type: currentStateType.type,
      label: meta.label,
      detail: meta.detail,
      timestamp: currentStateType.timestamp,
      className: meta.className,
    });
  }

  return events.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeA - timeB;
  });
};

const getOpportunitySyncForQuoteStatus = (status: QuoteStatus) => {
  if (status === 'sent') return { stage: 'quote', status: 'open', probability: 65 };
  if (status === 'accepted') return { stage: 'negotiation', status: 'open', probability: 80 };
  if (status === 'rejected' || status === 'expired') return { stage: 'lost', status: 'lost', probability: 0 };
  if (status === 'converted') return { stage: 'won', status: 'won', probability: 100 };
  return null;
};

const getQuoteMetadataRecord = (quote: SalesQuote) =>
  quote.metadata && typeof quote.metadata === 'object' ? (quote.metadata as Record<string, unknown>) : null;

const getQuoteOpportunityTitle = (quote: SalesQuote) => {
  const clientName = quote.client?.company_name?.trim() || quote.client?.contact_name?.trim() || 'Cliente';
  return `Cotizacion ${quote.quote_number} - ${clientName}`;
};

const getQuoteOpportunitySourceChannel = (quote: SalesQuote) => {
  const metadata = getQuoteMetadataRecord(quote);
  const sourceChannel = metadata && typeof metadata.source_channel === 'string' ? metadata.source_channel.trim() : '';
  if (sourceChannel) return sourceChannel;

  const source = metadata && typeof metadata.source === 'string' ? metadata.source.trim() : '';
  return source || 'sales_quote';
};

const getQuoteOpportunitySourceDetail = (quote: SalesQuote) => {
  const metadata = getQuoteMetadataRecord(quote);
  const sourceDetail = metadata && typeof metadata.source_detail === 'string' ? metadata.source_detail.trim() : '';
  if (sourceDetail) return sourceDetail;

  const clientName = quote.client?.company_name?.trim() || quote.client?.contact_name?.trim() || '';
  return clientName ? `Cotizacion desde ventas para ${clientName}` : 'Cotizacion desde ventas';
};

type ClientInteractionInsert = {
  client_id: string | null;
  opportunity_id?: string | null;
  quote_id?: string | null;
  conversation_id?: string | null;
  type: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

const isClientInteractionTypeConstraintError = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('client_interactions_type_check') ||
    message.includes('violates check constraint') ||
    message.includes('check constraint')
  );
};

const fallbackClientInteractionType = (type: string) => {
  if (type === 'quote_converted') return 'order';
  if (type === 'quote_sent') return 'email';
  return 'note';
};

const insertClientInteractionSafely = async (payload: ClientInteractionInsert) => {
  const { error } = await supabase.from('client_interactions').insert(payload as any);
  if (!error) {
    return { error: null, usedFallback: false };
  }

  if (!isClientInteractionTypeConstraintError(error)) {
    return { error, usedFallback: false };
  }

  const fallbackType = fallbackClientInteractionType(payload.type);
  const fallbackPayload = {
    ...payload,
    type: fallbackType,
    metadata: {
      ...(payload.metadata || {}),
      original_type: payload.type,
      fallback_type: fallbackType,
      fallback_reason: 'client_interactions_type_check',
    },
  };

  const { error: fallbackError } = await supabase.from('client_interactions').insert(fallbackPayload as any);
  return { error: fallbackError ?? null, usedFallback: true };
};

const calculateDraftTotals = (items: QuoteDraftItem[], discountAmount: number, taxRate: number) => {
  const subtotal = items.reduce((sum, item) => {
    const quantity = parseDecimal(item.quantity) || 0;
    const unitPrice = parseDecimal(item.unit_price) || 0;
    const discountPercent = parseDecimal(item.discount_percent) || 0;
    const gross = quantity * unitPrice;
    const lineDiscount = gross * (discountPercent / 100);
    return sum + Math.max(gross - lineDiscount, 0);
  }, 0);

  const taxableBase = Math.max(subtotal - discountAmount, 0);
  const taxAmount = taxableBase * (taxRate / 100);
  const total = taxableBase + taxAmount;

  return {
    subtotal,
    taxAmount,
    total,
    lineCount: items.length,
  };
};

const buildProductPayload = (form: ProductFormState) => ({
  sku: form.sku.trim() || null,
  name: form.name.trim(),
  description: form.description.trim() || null,
  category: form.category.trim() || null,
  product_type: form.product_type,
  unit_price: parseDecimal(form.unit_price),
  cost_price: parseDecimal(form.cost_price),
  currency: normalizeCurrency(form.currency),
  is_active: form.is_active,
  metadata: {},
  updated_at: new Date().toISOString(),
});

const buildQuoteItemPayload = (item: QuoteDraftItem, currency: string) => ({
  product_id: item.product_id || null,
  product_name: item.product_name.trim() || null,
  description: item.description.trim() || item.product_name.trim() || 'Item',
  item_type: item.item_type,
  quantity: parseDecimal(item.quantity) || 1,
  unit_price: parseDecimal(item.unit_price) || 0,
  discount_percent: parseDecimal(item.discount_percent) || 0,
  discount_amount: Math.max(
    (parseDecimal(item.quantity) || 1) *
      (parseDecimal(item.unit_price) || 0) *
      ((parseDecimal(item.discount_percent) || 0) / 100),
    0
  ),
  line_total: Math.max(
    (parseDecimal(item.quantity) || 1) *
      (parseDecimal(item.unit_price) || 0) -
      Math.max(
        (parseDecimal(item.quantity) || 1) *
          (parseDecimal(item.unit_price) || 0) *
          ((parseDecimal(item.discount_percent) || 0) / 100),
        0
      ),
    0
  ),
  currency: normalizeCurrency(currency || item.currency),
  metadata: {},
});

const buildQuoteItemRestorePayload = (item: QuoteItem) => ({
  id: item.id,
  quote_id: item.quote_id,
  product_id: item.product_id || null,
  product_name: item.product_name || null,
  description: item.description || item.product_name || 'Item',
  item_type: item.item_type,
  quantity: parseDecimal(item.quantity) || 1,
  unit_price: parseDecimal(item.unit_price) || 0,
  discount_percent: parseDecimal(item.discount_percent) || 0,
  discount_amount: parseDecimal(item.discount_amount) || 0,
  line_total: parseDecimal(item.line_total) || 0,
  currency: normalizeCurrency(item.currency),
  metadata: item.metadata || {},
  created_at: item.created_at || new Date().toISOString(),
});

const buildOrderItemPayload = (item: QuoteItem, currency: string) => ({
  product_name: item.product_name || item.description || null,
  external_product_id: item.product_id || null,
  item_type: item.item_type,
  description: item.description || item.product_name || 'Item',
  quantity: parseDecimal(item.quantity) || 1,
  unit_price: parseDecimal(item.unit_price) || 0,
  discount_percent: parseDecimal(item.discount_percent) || 0,
  line_total: parseDecimal(item.line_total) || 0,
  total_price: parseDecimal(item.line_total) || 0,
  notes: null,
});

export function SalesModule() {
  const [activeTab, setActiveTab] = useState<SalesTab>('quotes');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [timeline, setTimeline] = useState<QuoteTimelineItem[]>([]);
  const [assignedFilter, setAssignedFilter] = useState('');
  const [currentMonthOnly, setCurrentMonthOnly] = useState(true);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [quotesPage, setQuotesPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const quotesPerPage = 6;
  const productsPerPage = 9;
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(initialProductForm);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(initialQuoteForm);
  const [quoteItems, setQuoteItems] = useState<QuoteDraftItem[]>([createDraftItem()]);
  const selectedQuoteIdRef = useRef<string | null>(null);

  const { user } = useAuth();
  const { canCreate, canUpdate } = usePermissions();
  const toast = useToast();

  const canViewAllUsers = user?.role === 'admin' || user?.role === 'manager';

  const usersById = useMemo(() => {
    return users.reduce<Record<string, SystemUser>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [users]);

  const loadTimeline = async (quoteId: string | null) => {
    if (!quoteId) {
      setTimeline([]);
      return;
    }

    const { data, error } = await supabase
      .from('client_interactions')
      .select('id, type, description, metadata, created_by, created_at')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTimeline(data as QuoteTimelineItem[]);
    }
  };

  const loadSalesData = async () => {
    const currentSelectedQuoteId = selectedQuoteIdRef.current;
    setLoading(true);
    try {
      const [
        productsResult,
        quotesResult,
        clientsResult,
        opportunitiesResult,
        usersResult,
      ] = await Promise.all([
        supabase
          .from('sales_products')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_quotes')
          .select(`
            id,
            quote_number,
            client_id,
            opportunity_id,
            order_id,
            status,
            quote_date,
            expiry_date,
            currency,
            subtotal,
            discount_amount,
            tax_rate,
            tax_amount,
            total_amount,
            notes,
            terms,
            metadata,
            sent_at,
            accepted_at,
            converted_at,
            created_by,
            created_at,
            updated_at,
            client:clients!sales_quotes_client_id_fkey (
              id,
              company_name,
              contact_name,
              email,
              phone,
              address,
              city,
              country,
              status
            ),
            opportunity:sales_opportunities!sales_quotes_opportunity_id_fkey (
              id,
              opportunity_number,
              title,
              client_id,
              stage,
              status,
              expected_amount,
              currency
            ),
            order:orders!sales_quotes_order_id_fkey (
              id,
              order_number,
              status,
              total_amount
            ),
            items:sales_quote_items!sales_quote_items_quote_id_fkey (
              id,
              quote_id,
              product_id,
              product_name,
              description,
              item_type,
              quantity,
              unit_price,
              discount_percent,
              discount_amount,
              line_total,
              currency,
              metadata,
              created_at,
              product:sales_products!sales_quote_items_product_id_fkey (
                id,
                sku,
                name,
                category,
                product_type,
                unit_price,
                currency,
                is_active
              )
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, company_name, contact_name, email, phone, address, city, country, status')
          .order('company_name', { ascending: true }),
        supabase
          .from('sales_opportunities')
          .select('id, opportunity_number, title, client_id, stage, status, expected_amount, currency')
          .order('created_at', { ascending: false }),
        supabase
          .from('system_users')
          .select('id, full_name, email, role, is_active')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ]);

      if (!productsResult.error && productsResult.data) {
        setProducts(productsResult.data as SalesProduct[]);
      }

      if (!quotesResult.error && quotesResult.data) {
        const quotesData = quotesResult.data as SalesQuote[];
        setQuotes(quotesData);

        if (!currentSelectedQuoteId || !quotesData.some((quote) => quote.id === currentSelectedQuoteId)) {
          setSelectedQuoteId(quotesData[0]?.id || null);
        }
      }

      if (!clientsResult.error && clientsResult.data) {
        setClients(clientsResult.data as SalesClient[]);
      }

      if (!opportunitiesResult.error && opportunitiesResult.data) {
        setOpportunities(opportunitiesResult.data as SalesOpportunity[]);
      }

      if (!usersResult.error && usersResult.data) {
        setUsers(usersResult.data as SystemUser[]);
      }

      if (currentSelectedQuoteId && quotesResult.data) {
        const stillSelected = (quotesResult.data as SalesQuote[]).some((quote) => quote.id === currentSelectedQuoteId);
        if (stillSelected) {
          await loadTimeline(currentSelectedQuoteId);
        }
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
      toast.error('No se pudo cargar el modulo de ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      await loadSalesData();
    };

    initialize();

    const productsChannel = supabase
      .channel('sales-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_products' }, () => {
        loadSalesData();
      })
      .subscribe();

    const quotesChannel = supabase
      .channel('sales-quotes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_quotes' }, () => {
        loadSalesData();
      })
      .subscribe();

    const quoteItemsChannel = supabase
      .channel('sales-quote-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_quote_items' }, () => {
        loadSalesData();
      })
      .subscribe();

    const opportunitiesChannel = supabase
      .channel('sales-opportunities-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_opportunities' }, () => {
        loadSalesData();
      })
      .subscribe();

    const interactionsChannel = supabase
      .channel('sales-interactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_interactions' }, (payload) => {
        const changedQuoteId = (payload.new as { quote_id?: string } | null)?.quote_id;
        if (changedQuoteId && changedQuoteId === selectedQuoteIdRef.current) {
          loadTimeline(changedQuoteId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(quoteItemsChannel);
      supabase.removeChannel(opportunitiesChannel);
      supabase.removeChannel(interactionsChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedQuoteId) {
      setTimeline([]);
      return;
    }

    loadTimeline(selectedQuoteId);
  }, [selectedQuoteId]);

  useEffect(() => {
    selectedQuoteIdRef.current = selectedQuoteId;
  }, [selectedQuoteId]);

  useEffect(() => {
    const rawDraft = localStorage.getItem('sales_quote_draft');
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        client_id?: string;
        opportunity_id?: string;
        quote_date?: string;
        notes?: string;
        terms?: string;
        currency?: string;
      };

      setActiveTab('quotes');
      setShowQuoteModal(true);
      setQuoteForm((prev) => ({
        ...prev,
        client_id: draft.client_id || prev.client_id,
        opportunity_id: draft.opportunity_id || prev.opportunity_id,
        quote_date: draft.quote_date || prev.quote_date,
        notes: draft.notes?.trim() || prev.notes,
        terms: draft.terms?.trim() || prev.terms,
        currency: draft.currency ? normalizeCurrency(draft.currency) : prev.currency,
      }));
    } catch {
      // ignore invalid draft
    } finally {
      localStorage.removeItem('sales_quote_draft');
    }
  }, []);

  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedQuoteId) || null,
    [quotes, selectedQuoteId]
  );

  const selectedQuoteClient = useMemo(() => {
    if (!selectedQuote) return null;
    return selectedQuote.client || clients.find((entry) => entry.id === selectedQuote.client_id) || null;
  }, [clients, selectedQuote]);

  const selectedQuoteCommunicationToken = useMemo(
    () => (selectedQuote ? getQuoteCommunicationPublicToken(selectedQuote) : ''),
    [selectedQuote]
  );

  const selectedQuotePdfUrl = useMemo(
    () => getQuoteCommunicationPdfUrl(selectedQuote),
    [selectedQuote]
  );

  const selectedQuotePdfFilename = useMemo(
    () => getQuoteCommunicationPdfFilename(selectedQuote),
    [selectedQuote]
  );

  const selectedQuoteLocked = Boolean(
    selectedQuote && (selectedQuote.status === 'converted' || selectedQuote.order_id)
  );

  const selectedQuoteSendLabel = selectedQuote?.status === 'sent' ? 'Reenviar' : 'Enviar al cliente';
  const selectedQuoteRecipientEmail = (selectedQuote?.client?.email || selectedQuoteClient?.email || '').trim();
  const selectedQuoteCanSend = Boolean(
    selectedQuote &&
      !selectedQuoteLocked &&
      selectedQuoteRecipientEmail &&
      selectedQuote.status !== 'accepted'
  );

  const selectedOrderCanSend = Boolean(
    selectedQuote &&
      selectedQuote.status === 'converted' &&
      selectedQuote.order_id &&
      selectedQuoteRecipientEmail
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || activeTab !== 'products') return products;

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.category,
        product.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [activeTab, products, searchTerm]);

  const filteredQuotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const fromDate = customDateFrom ? new Date(customDateFrom) : null;
    const toDate = customDateTo ? new Date(customDateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return quotes.filter((quote) => {
      if (term) {
        const haystack = [
          quote.quote_number,
          quote.client?.company_name,
          quote.client?.contact_name,
          quote.opportunity?.opportunity_number,
          quote.opportunity?.title,
          quote.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (!canViewAllUsers) {
        if (quote.created_by !== user?.id) return false;
      } else if (assignedFilter && quote.created_by !== assignedFilter) {
        return false;
      }

      const quoteDate = new Date(quote.quote_date);
      const hasQuoteDate = !Number.isNaN(quoteDate.getTime());

      if (fromDate || toDate) {
        if (!hasQuoteDate) return false;
        if (fromDate && quoteDate < fromDate) return false;
        if (toDate && quoteDate > toDate) return false;
      } else if (currentMonthOnly) {
        if (
          !hasQuoteDate ||
          quoteDate.getFullYear() !== now.getFullYear() ||
          quoteDate.getMonth() !== now.getMonth()
        ) {
          return false;
        }
      }

      return true;
    });
  }, [quotes, searchTerm, canViewAllUsers, assignedFilter, currentMonthOnly, customDateFrom, customDateTo, user?.id]);

  useEffect(() => {
    setQuotesPage(1);
  }, [searchTerm, assignedFilter, currentMonthOnly, customDateFrom, customDateTo, activeTab]);

  useEffect(() => {
    setProductsPage(1);
  }, [searchTerm, activeTab]);

  const paginatedQuotes = useMemo(
    () => filteredQuotes.slice((quotesPage - 1) * quotesPerPage, quotesPage * quotesPerPage),
    [filteredQuotes, quotesPage]
  );

  const paginatedProducts = useMemo(
    () => filteredProducts.slice((productsPage - 1) * productsPerPage, productsPage * productsPerPage),
    [filteredProducts, productsPage]
  );

  const quoteTotalsPreview = useMemo(
    () =>
      calculateDraftTotals(
        quoteItems,
        parseDecimal(quoteForm.discount_amount),
        parseDecimal(quoteForm.tax_rate)
      ),
    [quoteForm.discount_amount, quoteForm.tax_rate, quoteItems]
  );

  const activeProductsCount = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products]
  );

  const draftQuotesCount = useMemo(
    () => quotes.filter((quote) => quote.status === 'draft').length,
    [quotes]
  );

  const sentQuotesCount = useMemo(
    () => quotes.filter((quote) => quote.status === 'sent').length,
    [quotes]
  );

  const acceptedQuotesCount = useMemo(
    () => quotes.filter((quote) => quote.status === 'accepted').length,
    [quotes]
  );

  const convertedQuotesCount = useMemo(
    () => quotes.filter((quote) => quote.status === 'converted').length,
    [quotes]
  );

  const openQuoteValue = useMemo(
    () =>
      quotes
        .filter((quote) => ['draft', 'sent', 'accepted'].includes(quote.status))
        .reduce((sum, quote) => sum + parseDecimal(quote.total_amount), 0),
    [quotes]
  );

  const conversionRate = useMemo(() => {
    if (!quotes.length) return 0;
    return Math.round((convertedQuotesCount / quotes.length) * 100);
  }, [convertedQuotesCount, quotes.length]);

  const opportunityOptions = useMemo(() => {
    if (!quoteForm.client_id) return opportunities;
    return opportunities.filter((opportunity) => opportunity.client_id === quoteForm.client_id);
  }, [opportunities, quoteForm.client_id]);

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm(initialProductForm());
  };

  const resetQuoteForm = () => {
    setEditingQuoteId(null);
    setQuoteForm(initialQuoteForm());
    setQuoteItems([createDraftItem()]);
  };

  const openProductModal = (product?: SalesProduct) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        product_type: product.product_type,
        unit_price: String(product.unit_price ?? ''),
        cost_price: String(product.cost_price ?? ''),
        currency: normalizeCurrency(product.currency),
        is_active: Boolean(product.is_active),
      });
    } else {
      resetProductForm();
    }

    setShowProductModal(true);
  };

  const openQuoteModal = (quote?: SalesQuote) => {
    if (quote) {
      setEditingQuoteId(quote.id);
      setQuoteForm(buildQuoteFormFromQuote(quote));
      setQuoteItems(buildQuoteItemsFromQuote(quote));
      setSelectedQuoteId(quote.id);
    } else {
      resetQuoteForm();
    }

    setActiveTab('quotes');
    setShowQuoteModal(true);
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    resetQuoteForm();
  };

  const handleQuoteItemChange = (
    itemId: string,
    field: keyof QuoteDraftItem,
    value: string
  ) => {
    setQuoteItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) return item;

        const nextItem = { ...item, [field]: value };

        if (field === 'product_id') {
          const product = products.find((entry) => entry.id === value) || null;
          if (product) {
            nextItem.product_name = product.name;
            nextItem.description = product.description || product.name;
            nextItem.unit_price = String(product.unit_price ?? '');
            nextItem.currency = normalizeCurrency(product.currency);
            nextItem.item_type = product.product_type;
          } else {
            nextItem.product_name = '';
            nextItem.description = '';
            nextItem.unit_price = '';
          }
        }

        return nextItem;
      })
    );
  };

  const addQuoteItem = () => {
    setQuoteItems((currentItems) => [
      ...currentItems,
      createDraftItem(quoteForm.currency),
    ]);
  };

  const removeQuoteItem = (itemId: string) => {
    setQuoteItems((currentItems) => {
      if (currentItems.length === 1) return currentItems;
      return currentItems.filter((item) => item.id !== itemId);
    });
  };

  const handleSaveProduct = async () => {
    if (!canCreate('ventas') && !editingProductId) {
      toast.error('No tienes permisos para crear productos');
      return;
    }

    if (!canUpdate('ventas') && editingProductId) {
      toast.error('No tienes permisos para editar productos');
      return;
    }

    if (!productForm.name.trim()) {
      toast.error('Escribe un nombre para el producto');
      return;
    }

    const payload = buildProductPayload(productForm);
    const now = new Date().toISOString();

    if (editingProductId) {
      const { error } = await supabase
        .from('sales_products')
        .update({
          ...payload,
          updated_at: now,
        })
        .eq('id', editingProductId);

      if (error) {
        toast.error(`No se pudo actualizar el producto: ${error.message}`);
        return;
      }

      toast.success('Producto actualizado');
    } else {
      const { error } = await supabase
        .from('sales_products')
        .insert({
          ...payload,
          created_by: user?.id || null,
          created_at: now,
        });

      if (error) {
        toast.error(`No se pudo crear el producto: ${error.message}`);
        return;
      }

      toast.success('Producto creado');
    }

    setShowProductModal(false);
    resetProductForm();
    await loadSalesData();
  };

  const handleSaveQuote = async () => {
    const isEditingQuote = Boolean(editingQuoteId);

    if (isEditingQuote ? !canUpdate('ventas') : !canCreate('ventas')) {
      toast.error(isEditingQuote ? 'No tienes permisos para editar cotizaciones' : 'No tienes permisos para crear cotizaciones');
      return;
    }

    if (!quoteForm.client_id) {
      toast.error('Selecciona un cliente');
      return;
    }

    const validItems = quoteItems.filter((item) => {
      const description = item.description.trim() || item.product_name.trim();
      return description.length > 0;
    });

    if (!validItems.length) {
      toast.error('Agrega al menos un item a la cotizacion');
      return;
    }

    const now = new Date().toISOString();
    const discountAmount = parseDecimal(quoteForm.discount_amount);
    const taxRate = parseDecimal(quoteForm.tax_rate);
    const totals = calculateDraftTotals(validItems, discountAmount, taxRate);
    const opportunity = quoteForm.opportunity_id
      ? opportunities.find((entry) => entry.id === quoteForm.opportunity_id) || null
      : null;
    const quoteCurrency = normalizeCurrency(quoteForm.currency);

    if (isEditingQuote) {
      const currentQuote = quotes.find((entry) => entry.id === editingQuoteId) || null;
      if (!currentQuote) {
        toast.error('La cotizacion que intentas editar ya no existe');
        return;
      }

      if (currentQuote.status === 'converted' || currentQuote.order_id) {
        toast.error('Las cotizaciones convertidas no se pueden editar');
        return;
      }

      const originalQuoteSnapshot = {
        client_id: currentQuote.client_id,
        opportunity_id: currentQuote.opportunity_id,
        quote_date: currentQuote.quote_date,
        expiry_date: currentQuote.expiry_date,
        currency: currentQuote.currency,
        subtotal: currentQuote.subtotal,
        discount_amount: currentQuote.discount_amount,
        tax_rate: currentQuote.tax_rate,
        tax_amount: currentQuote.tax_amount,
        total_amount: currentQuote.total_amount,
        notes: currentQuote.notes,
        terms: currentQuote.terms,
        metadata: currentQuote.metadata || {},
        updated_at: currentQuote.updated_at,
      };

      const quotePayload = {
        client_id: quoteForm.client_id,
        opportunity_id: quoteForm.opportunity_id || null,
        quote_date: quoteForm.quote_date || todayDate(),
        expiry_date: quoteForm.expiry_date || null,
        currency: quoteCurrency,
        subtotal: totals.subtotal,
        discount_amount: discountAmount,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: quoteForm.notes.trim() || null,
        terms: quoteForm.terms.trim() || null,
        metadata: {
          ...(currentQuote.metadata || {}),
          source: (currentQuote.metadata as Record<string, unknown> | null)?.source || 'sales_module',
          item_count: validItems.length,
          updated_from_editor: true,
          updated_at: now,
        },
        updated_at: now,
      };

      const { error: quoteUpdateError } = await supabase
        .from('sales_quotes')
        .update(quotePayload)
        .eq('id', editingQuoteId);

      if (quoteUpdateError) {
        toast.error(`No se pudo actualizar la cotizacion: ${quoteUpdateError.message}`);
        return;
      }

      const originalItems = [...(currentQuote.items || [])];
      const originalItemIds = originalItems.map((item) => item.id);

      if (originalItemIds.length) {
        const { error: deleteItemsError } = await supabase
          .from('sales_quote_items')
          .delete()
          .in('id', originalItemIds);

        if (deleteItemsError) {
          await supabase
            .from('sales_quotes')
            .update(originalQuoteSnapshot)
            .eq('id', editingQuoteId);
          toast.error(`No se pudieron actualizar los items: ${deleteItemsError.message}`);
          return;
        }
      }

      const updatedItemsPayload = validItems.map((item) => ({
        id: item.id,
        quote_id: editingQuoteId,
        ...buildQuoteItemPayload(item, quoteCurrency),
      }));

      const { error: insertItemsError } = await supabase
        .from('sales_quote_items')
        .insert(updatedItemsPayload);

      if (insertItemsError) {
        if (originalItems.length) {
          await supabase
            .from('sales_quote_items')
            .insert(originalItems.map((item) => buildQuoteItemRestorePayload(item)));
        }

        await supabase
          .from('sales_quotes')
          .update(originalQuoteSnapshot)
          .eq('id', editingQuoteId);

        toast.error(`No se pudieron guardar los items: ${insertItemsError.message}`);
        return;
      }

      const { error: interactionError } = await insertClientInteractionSafely({
        client_id: quoteForm.client_id,
        opportunity_id: quoteForm.opportunity_id || null,
        quote_id: editingQuoteId,
        type: 'note',
        description: `Cotizacion ${currentQuote.quote_number} actualizada desde ventas`,
        metadata: {
          action: 'quote_updated',
          quote_number: currentQuote.quote_number,
          item_count: validItems.length,
          currency: quoteCurrency,
          subtotal: totals.subtotal,
          total_amount: totals.total,
        },
        created_by: user?.id || null,
        created_at: now,
      });

      if (interactionError) {
        toast.error(`La cotizacion fue actualizada, pero no se pudo registrar el historial: ${interactionError.message}`);
      }

      toast.success(`Cotizacion ${currentQuote.quote_number} actualizada`);
      setShowQuoteModal(false);
      resetQuoteForm();
      await loadSalesData();
      setSelectedQuoteId(editingQuoteId);
      return;
    }

    const { data: quoteData, error: quoteError } = await supabase
      .from('sales_quotes')
      .insert({
        client_id: quoteForm.client_id,
        opportunity_id: quoteForm.opportunity_id || null,
        status: 'draft',
        quote_date: quoteForm.quote_date || todayDate(),
        expiry_date: quoteForm.expiry_date || null,
        currency: quoteCurrency,
        subtotal: totals.subtotal,
        discount_amount: discountAmount,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: quoteForm.notes.trim() || null,
        terms: quoteForm.terms.trim() || null,
        created_by: user?.id || null,
        metadata: {
          source: 'sales_module',
          item_count: validItems.length,
        },
        created_at: now,
        updated_at: now,
      })
      .select('id, quote_number')
      .single();

    if (quoteError || !quoteData) {
      toast.error(`No se pudo crear la cotizacion: ${quoteError?.message || 'error desconocido'}`);
      return;
    }

    const quoteId = quoteData.id;

    const itemsPayload = validItems.map((item) => ({
      quote_id: quoteId,
      ...buildQuoteItemPayload(item, quoteCurrency),
    }));

    const { error: itemsError } = await supabase
      .from('sales_quote_items')
      .insert(itemsPayload);

    if (itemsError) {
      await supabase.from('sales_quotes').delete().eq('id', quoteId);
      toast.error(`No se pudieron crear los items: ${itemsError.message}`);
      return;
    }

    if (opportunity) {
      const stageUpdate = getOpportunitySyncForQuoteStatus('sent');
      await supabase
        .from('sales_opportunities')
        .update({
          stage: stageUpdate?.stage || 'quote',
          status: stageUpdate?.status || 'open',
          probability: stageUpdate?.probability || 65,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', opportunity.id);
    }

    const { error: interactionError } = await insertClientInteractionSafely({
      client_id: quoteForm.client_id,
      opportunity_id: quoteForm.opportunity_id || null,
      quote_id: quoteId,
      type: 'quote_created',
      description: `Cotizacion ${quoteData.quote_number} creada desde ventas`,
      metadata: {
        quote_number: quoteData.quote_number,
        item_count: validItems.length,
        currency: quoteCurrency,
        subtotal: totals.subtotal,
        total_amount: totals.total,
      },
      created_by: user?.id || null,
      created_at: now,
    });

    if (interactionError) {
      toast.error(`La cotizacion fue creada, pero no se pudo registrar el historial: ${interactionError.message}`);
    }

    toast.success(`Cotizacion ${quoteData.quote_number} creada`);
    setShowQuoteModal(false);
    resetQuoteForm();
    await loadSalesData();
    setSelectedQuoteId(quoteId);
  };

  const loadQuoteCompanySettings = async (): Promise<QuoteCommunicationCompanySettings> => {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'general_settings')
      .maybeSingle();

    const settingValue = data?.setting_value;
    if (!settingValue || typeof settingValue !== 'object') {
      return {};
    }

    return settingValue as QuoteCommunicationCompanySettings;
  };

  const resolveQuoteOpportunityForStatus = async (
    quote: SalesQuote,
    nextStatus: QuoteStatus,
    timestamp: string
  ) => {
    const opportunitySync = getOpportunitySyncForQuoteStatus(nextStatus);
    if (!opportunitySync || !quote.client_id) {
      return quote.opportunity_id || null;
    }

    const stageId = await resolveDefaultSalesOpportunityStageId();
    let opportunityId = quote.opportunity_id || null;
    const contactName = quote.client?.contact_name?.trim() || quote.client?.company_name?.trim() || 'Cliente';
    const contactEmail = quote.client?.email?.trim() || null;
    const contactPhone = quote.client?.phone?.trim() || null;
    const quoteAmount = parseDecimal(quote.total_amount);

    if (!opportunityId) {
      const { data: existingOpportunity, error: existingOpportunityError } = await supabase
        .from('sales_opportunities')
        .select('id')
        .eq('client_id', quote.client_id)
        .eq('status', 'open')
        .in('stage', ['prospect', 'contacted', 'meeting', 'quote', 'negotiation'])
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOpportunityError) {
        throw existingOpportunityError;
      }

      opportunityId = existingOpportunity?.id || null;
    }

    if (!opportunityId) {
      const createPayload: Record<string, unknown> = {
        client_id: quote.client_id,
        stage_id: stageId,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        title: getQuoteOpportunityTitle(quote),
        stage: opportunitySync.stage,
        status: opportunitySync.status,
        amount: quoteAmount,
        expected_amount: quoteAmount,
        currency: normalizeCurrency(quote.currency),
        probability: opportunitySync.probability,
        expected_close_date: quote.expiry_date || null,
        source_channel: getQuoteOpportunitySourceChannel(quote),
        source_detail: getQuoteOpportunitySourceDetail(quote),
        assigned_to: quote.created_by || user?.id || null,
        created_by: quote.created_by || user?.id || null,
        metadata: {
          source: 'sales_module',
          origin: 'quote_sync',
          quote_id: quote.id,
          quote_number: quote.quote_number,
          quote_status: nextStatus,
          quote_total_amount: parseDecimal(quote.total_amount),
        },
        last_activity_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      };

      if (quote.expiry_date) {
        createPayload.expected_close_date = quote.expiry_date;
      }

      const { data: createdOpportunity, error: createOpportunityError } = await supabase
        .from('sales_opportunities')
        .insert(createPayload)
        .select('id')
        .single();

      if (createOpportunityError || !createdOpportunity) {
        throw new Error(
          `No se pudo crear la oportunidad para la cotizacion: ${
            createOpportunityError?.message || 'sin detalle'
          }`
        );
      }

      opportunityId = createdOpportunity.id;
    }

    const opportunityUpdates: Record<string, unknown> = {
      stage_id: stageId,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      stage: opportunitySync.stage,
      status: opportunitySync.status,
      probability: opportunitySync.probability,
      amount: quoteAmount,
      expected_amount: quoteAmount,
      currency: normalizeCurrency(quote.currency),
      last_activity_at: timestamp,
      updated_at: timestamp,
    };

    if (quote.expiry_date) {
      opportunityUpdates.expected_close_date = quote.expiry_date;
    }

    const { error: opportunityUpdateError } = await supabase
      .from('sales_opportunities')
      .update(opportunityUpdates)
      .eq('id', opportunityId);

    if (opportunityUpdateError) {
      throw opportunityUpdateError;
    }

    return opportunityId;
  };

  const sendQuoteToClient = async (quote: SalesQuote) => {
    if (!canUpdate('ventas')) {
      toast.error('No tienes permisos para enviar cotizaciones');
      return;
    }

    if (quote.status === 'accepted' || quote.status === 'converted') {
      toast.info('Esta cotizacion ya no puede reenviarse desde este estado');
      return;
    }

    await waitForConfig().catch(() => undefined);

    const emailUrl = getEnvVar('VITE_EMAIL_URL').trim();
    const emailKey = getEnvVar('VITE_EMAIL_KEY').trim();

    if (!emailUrl || !emailKey) {
      toast.error('Falta configurar VITE_EMAIL_URL o VITE_EMAIL_KEY');
      return;
    }

    const recipientEmail = (quote.client?.email || selectedQuoteClient?.email || '').trim();
    if (!recipientEmail) {
      toast.error('La cotizacion no tiene un correo de cliente configurado');
      return;
    }

    const confirmed = window.confirm(
      `Enviar la cotizacion ${quote.quote_number} a ${recipientEmail}?`
    );

    if (!confirmed) return;

    const companySettings = await loadQuoteCompanySettings();
    const publicToken = (selectedQuote?.id === quote.id ? selectedQuoteCommunicationToken : '') ||
      getQuoteCommunicationPublicToken(quote) ||
      crypto.randomUUID();
    const generatedAt = new Date().toISOString();
    const requestPayload = buildQuoteCommunicationRequest(
      quote,
      quote.client || selectedQuoteClient,
      companySettings,
      getEnvVar('VITE_APP_URL') || window.location.origin,
      publicToken,
      generatedAt
    );

    toast.info('Enviando cotizacion al cliente...');

    let serviceResult: QuoteCommunicationResponse = { success: false };

    try {
      const response = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': emailKey,
        },
        body: JSON.stringify(requestPayload),
      });

      const responseText = await response.text();
      try {
        serviceResult = responseText ? JSON.parse(responseText) as QuoteCommunicationResponse : { success: response.ok };
      } catch {
        serviceResult = {
          success: response.ok,
          message: responseText || 'Respuesta no JSON del servicio de correo',
        };
      }

      if (!response.ok || serviceResult.success === false) {
        throw new Error(serviceResult.message || `No se pudo enviar la cotizacion (${response.status})`);
      }
    } catch (error) {
      console.error('Error enviando cotizacion:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la cotizacion');
      return;
    }

    let opportunityId = quote.opportunity_id || null;
    try {
      opportunityId = await resolveQuoteOpportunityForStatus(quote, 'sent', generatedAt);
    } catch (error) {
      console.error('Error sincronizando la oportunidad de la cotizacion:', error);
      toast.error(
        error instanceof Error
          ? `La cotizacion se envio, pero no se pudo sincronizar el pipeline: ${error.message}`
          : 'La cotizacion se envio, pero no se pudo sincronizar el pipeline'
      );
    }

    const metadata = buildQuoteCommunicationMetadata(
      quote,
      requestPayload,
      serviceResult,
      publicToken,
      generatedAt
    );

    const { error: quoteUpdateError } = await supabase
      .from('sales_quotes')
      .update({
        status: 'sent',
        sent_at: generatedAt,
        updated_at: generatedAt,
        opportunity_id: opportunityId,
        metadata,
      })
      .eq('id', quote.id);

    if (quoteUpdateError) {
      toast.error(`El correo se envio, pero no se pudo guardar la cotizacion: ${quoteUpdateError.message}`);
      return;
    }

    const { error: interactionError } = await insertClientInteractionSafely({
      client_id: quote.client_id,
      opportunity_id: opportunityId,
      quote_id: quote.id,
      type: 'quote_sent',
      description: `Cotizacion ${quote.quote_number} enviada al cliente`,
      metadata: {
        quote_number: quote.quote_number,
        recipient_email: recipientEmail,
        log_id: serviceResult.log_id || null,
        pdf_log_id: serviceResult.pdf_log_id || null,
        pdf_public_url: serviceResult.pdf_public_url || null,
        resend_email_id: serviceResult.resend_email_id || null,
        processing_time_ms: serviceResult.processing_time_ms || null,
        public_token: publicToken,
      },
      created_by: user?.id || null,
      created_at: generatedAt,
    });

    if (interactionError) {
      toast.error(`La cotizacion se envio, pero no se pudo registrar el historial: ${interactionError.message}`);
    }

    toast.success(`Cotizacion ${quote.quote_number} enviada al cliente`);
    await loadSalesData();
    setSelectedQuoteId(quote.id);
  };

  const sendOrderToClient = async (quote: SalesQuote) => {
    if (!canUpdate('ventas')) {
      toast.error('No tienes permisos para enviar la orden');
      return;
    }

    if (quote.status !== 'converted' || !quote.order_id) {
      toast.info('Esta cotizacion todavia no se convirtio en una orden');
      return;
    }

    const orderNumber = quote.order?.order_number;
    if (!orderNumber) {
      toast.error('No se encontro el numero de la orden. Actualiza la pagina e intenta de nuevo');
      return;
    }

    await waitForConfig().catch(() => undefined);

    const emailUrl = getEnvVar('VITE_EMAIL_URL').trim();
    const emailKey = getEnvVar('VITE_EMAIL_KEY').trim();

    if (!emailUrl || !emailKey) {
      toast.error('Falta configurar VITE_EMAIL_URL o VITE_EMAIL_KEY');
      return;
    }

    const recipientEmail = (quote.client?.email || selectedQuoteClient?.email || '').trim();
    if (!recipientEmail) {
      toast.error('La orden no tiene un correo de cliente configurado');
      return;
    }

    const confirmed = window.confirm(
      `Enviar la orden aprobada (cotizacion ${quote.quote_number}) a ${recipientEmail}?`
    );

    if (!confirmed) return;

    const companySettings = await loadQuoteCompanySettings();
    const publicToken = (selectedQuote?.id === quote.id ? selectedQuoteCommunicationToken : '') ||
      getQuoteCommunicationPublicToken(quote) ||
      crypto.randomUUID();
    const generatedAt = new Date().toISOString();
    const requestPayload = buildOrderCommunicationRequest(
      quote,
      { order_number: orderNumber, order_date: quote.converted_at },
      quote.client || selectedQuoteClient,
      companySettings,
      getEnvVar('VITE_APP_URL') || window.location.origin,
      publicToken,
      generatedAt,
      quote.accepted_at || quote.converted_at
    );

    toast.info('Enviando orden aprobada al cliente...');

    let serviceResult: QuoteCommunicationResponse = { success: false };

    try {
      const response = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': emailKey,
        },
        body: JSON.stringify(requestPayload),
      });

      const responseText = await response.text();
      try {
        serviceResult = responseText ? JSON.parse(responseText) as QuoteCommunicationResponse : { success: response.ok };
      } catch {
        serviceResult = {
          success: response.ok,
          message: responseText || 'Respuesta no JSON del servicio de correo',
        };
      }

      if (!response.ok || serviceResult.success === false) {
        console.error('Respuesta del servicio de correo (enviar orden):', response.status, responseText);
        throw new Error(serviceResult.message || `No se pudo enviar la orden (${response.status})`);
      }
    } catch (error) {
      console.error('Error enviando la orden aprobada:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la orden');
      return;
    }

    const metadata = buildQuoteCommunicationMetadata(
      quote,
      requestPayload,
      serviceResult,
      publicToken,
      generatedAt
    );

    const { error: quoteUpdateError } = await supabase
      .from('sales_quotes')
      .update({
        updated_at: generatedAt,
        metadata,
      })
      .eq('id', quote.id);

    if (quoteUpdateError) {
      toast.error(`El correo se envio, pero no se pudo guardar el enlace del PDF: ${quoteUpdateError.message}`);
      return;
    }

    const { error: interactionError } = await insertClientInteractionSafely({
      client_id: quote.client_id,
      opportunity_id: quote.opportunity_id,
      quote_id: quote.id,
      type: 'email',
      description: `Orden aprobada (cotizacion ${quote.quote_number}) enviada al cliente`,
      metadata: {
        quote_number: quote.quote_number,
        order_id: quote.order_id,
        recipient_email: recipientEmail,
        log_id: serviceResult.log_id || null,
        pdf_log_id: serviceResult.pdf_log_id || null,
        pdf_public_url: serviceResult.pdf_public_url || null,
        resend_email_id: serviceResult.resend_email_id || null,
        processing_time_ms: serviceResult.processing_time_ms || null,
        public_token: publicToken,
        reference: 'order_confirmation',
      },
      created_by: user?.id || null,
      created_at: generatedAt,
    });

    if (interactionError) {
      toast.error(`La orden se envio, pero no se pudo registrar el historial: ${interactionError.message}`);
    }

    toast.success('Orden aprobada enviada al cliente');
    await loadSalesData();
    setSelectedQuoteId(quote.id);
    await loadTimeline(quote.id);
  };

  const updateQuoteStatus = async (quote: SalesQuote, nextStatus: QuoteStatus) => {
    if (!canUpdate('ventas')) {
      toast.error('No tienes permisos para actualizar cotizaciones');
      return;
    }

    const now = new Date().toISOString();
    let opportunityId = quote.opportunity_id || null;
    try {
      opportunityId = await resolveQuoteOpportunityForStatus(quote, nextStatus, now);
    } catch (error) {
      console.error('Error sincronizando la oportunidad de la cotizacion:', error);
      toast.error(
        error instanceof Error
          ? `No se pudo sincronizar el pipeline: ${error.message}`
          : 'No se pudo sincronizar el pipeline'
      );
    }

    const updates: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
      opportunity_id: opportunityId,
    };

    if (nextStatus === 'sent') {
      updates.sent_at = now;
    }

    if (nextStatus === 'accepted') {
      updates.accepted_at = now;
    }

    if (nextStatus === 'converted') {
      updates.converted_at = now;
    }

    const { error } = await supabase
      .from('sales_quotes')
      .update(updates)
      .eq('id', quote.id);

    if (error) {
      toast.error(`No se pudo actualizar la cotizacion: ${error.message}`);
      return;
    }

    const interactionTypeMap: Partial<Record<QuoteStatus, string>> = {
      sent: 'quote_sent',
      accepted: 'quote_accepted',
      rejected: 'quote_rejected',
      expired: 'quote_expired',
      converted: 'quote_converted',
    };

    const interactionType = interactionTypeMap[nextStatus];
    if (interactionType) {
      const { error: interactionError } = await insertClientInteractionSafely({
        client_id: quote.client_id,
        opportunity_id: opportunityId,
        quote_id: quote.id,
        type: interactionType,
        description: `Cotizacion ${quote.quote_number} ${quoteStatusLabels[nextStatus].toLowerCase()}`,
        metadata: {
          quote_number: quote.quote_number,
          previous_status: quote.status,
          next_status: nextStatus,
        },
        created_by: user?.id || null,
        created_at: now,
      });

      if (interactionError) {
        toast.error(`La cotizacion cambio de estado, pero no se pudo registrar el historial: ${interactionError.message}`);
      }
    }

    toast.success(`Cotizacion ${quoteStatusLabels[nextStatus].toLowerCase()}`);
    await loadSalesData();
    setSelectedQuoteId(quote.id);
  };

  const convertQuoteToOrder = async (quote: SalesQuote) => {
    if (!canUpdate('ventas')) {
      toast.error('No tienes permisos para convertir cotizaciones');
      return;
    }

    if (quote.order_id) {
      toast.info('Esta cotizacion ya fue convertida a una orden');
      return;
    }

    if (!quote.items || !quote.items.length) {
      toast.error('La cotizacion no tiene items para convertir');
      return;
    }

    const confirmed = window.confirm(
      `Convertir la cotizacion ${quote.quote_number} en una orden?`
    );

    if (!confirmed) return;

    const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
    if (orderNumberError) {
      toast.error(`No se pudo generar el numero de orden: ${orderNumberError.message}`);
      return;
    }

    const now = new Date().toISOString();
    const quoteItemsSorted = [...(quote.items || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const orderTotal = parseDecimal(quote.total_amount);
    const orderSubtotal = parseDecimal(quote.subtotal);
    const orderDiscount = parseDecimal(quote.discount_amount);
    const orderTaxRate = parseDecimal(quote.tax_rate);
    const orderTaxAmount = parseDecimal(quote.tax_amount);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: String(orderNumber || `ORD-${Date.now()}`),
        client_id: quote.client_id,
        quote_id: quote.id,
        status: 'pending',
        order_date: quote.quote_date,
        due_date: quote.expiry_date || null,
        subtotal: orderSubtotal,
        tax_rate: orderTaxRate,
        tax_amount: orderTaxAmount,
        discount_amount: orderDiscount,
        shipping_cost: 0,
        total_amount: orderTotal,
        currency: quote.currency,
        notes: quote.notes || null,
        customer_notes: quote.notes || null,
        payment_terms: quote.terms || null,
        payment_status: 'unpaid',
        created_by: user?.id || null,
        metadata: {
          source: 'sales_quote',
          quote_id: quote.id,
          opportunity_id: quote.opportunity_id,
        },
        created_at: now,
        updated_at: now,
      })
      .select('id, order_number')
      .single();

    if (orderError || !orderData) {
      toast.error(`No se pudo crear la orden: ${orderError?.message || 'error desconocido'}`);
      return;
    }

    const orderId = orderData.id;
    const orderItemsPayload = quoteItemsSorted.map((item) => ({
      order_id: orderId,
      ...buildOrderItemPayload(item, quote.currency),
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (orderItemsError) {
      await supabase.from('orders').delete().eq('id', orderId);
      toast.error(`No se pudieron crear los items de la orden: ${orderItemsError.message}`);
      return;
    }

    let opportunityId = quote.opportunity_id || null;
    try {
      opportunityId = await resolveQuoteOpportunityForStatus(quote, 'converted', now);
    } catch (error) {
      console.error('Error sincronizando la oportunidad de la cotizacion convertida:', error);
      toast.error(
        error instanceof Error
          ? `La orden se creo, pero no se pudo sincronizar el pipeline: ${error.message}`
          : 'La orden se creo, pero no se pudo sincronizar el pipeline'
      );
    }

    const { error: quoteUpdateError } = await supabase
      .from('sales_quotes')
      .update({
        status: 'converted',
        order_id: orderId,
        converted_at: now,
        updated_at: now,
        opportunity_id: opportunityId,
      })
      .eq('id', quote.id);

    if (quoteUpdateError) {
      toast.error(`La orden se creo, pero no se pudo actualizar la cotizacion: ${quoteUpdateError.message}`);
    }

    if (opportunityId && opportunityId !== quote.opportunity_id) {
      const { error: orderMetadataError } = await supabase
        .from('orders')
        .update({
          metadata: {
            source: 'sales_quote',
            quote_id: quote.id,
            opportunity_id: opportunityId,
          },
        })
        .eq('id', orderId);

      if (orderMetadataError) {
        console.error('No se pudo actualizar la metadata de la orden con la oportunidad:', orderMetadataError);
      }
    }

    const { error: interactionError } = await insertClientInteractionSafely({
      client_id: quote.client_id,
      opportunity_id: opportunityId,
      quote_id: quote.id,
      type: 'quote_converted',
      description: `Cotizacion ${quote.quote_number} convertida en orden ${orderData.order_number}`,
      metadata: {
        quote_number: quote.quote_number,
        order_number: orderData.order_number,
        order_id: orderId,
      },
      created_by: user?.id || null,
      created_at: now,
    });

    if (interactionError) {
      toast.error(`La orden se creo, pero no se pudo registrar el historial: ${interactionError.message}`);
    }

    toast.success(`Orden ${orderData.order_number} creada`);
    await loadSalesData();
    setSelectedQuoteId(quote.id);
  };

  const handleDeleteQuote = async (quote: SalesQuote) => {
    if (!canUpdate('ventas')) {
      toast.error('No tienes permisos para eliminar cotizaciones');
      return;
    }

    if (quote.status === 'converted' || quote.order_id) {
      toast.error('Las cotizaciones convertidas no se pueden eliminar');
      return;
    }

    const confirmed = window.confirm(
      `Eliminar la cotizacion ${quote.quote_number}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('sales_quotes')
      .delete()
      .eq('id', quote.id);

    if (error) {
      toast.error(`No se pudo eliminar la cotizacion: ${error.message}`);
      return;
    }

    toast.success(`Cotizacion ${quote.quote_number} eliminada`);
    await loadSalesData();
  };

  const handleRefresh = async () => {
    await loadSalesData();
    if (selectedQuoteId) {
      await loadTimeline(selectedQuoteId);
    }
  };

  const handleOpenQuotePdf = (pdfUrl: string) => {
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQuotePdf = async (pdfUrl: string, filename: string) => {
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Error descargando el PDF:', error);
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      toast.info('No se pudo descargar directamente; se abrió el PDF en una nueva pestaña');
    }
  };

  const selectedQuoteItems = useMemo(() => {
    if (!selectedQuote?.items?.length) return [];
    return [...selectedQuote.items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [selectedQuote]);

  const selectedQuoteJourney = useMemo(
    () => getQuoteJourneyEvents(selectedQuote, timeline),
    [selectedQuote, timeline]
  );

  const selectedQuoteLastJourneyEvent = selectedQuoteJourney[selectedQuoteJourney.length - 1] || null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Cotizaciones y catalogo de productos"
        subtitle="Reutilizamos oportunidades, clientes y ordenes existentes para convertir solicitudes comerciales en cotizaciones, productos y ventas reales."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="md" icon={<RefreshCw className="h-4 w-4" />} onClick={handleRefresh}>
              Refrescar
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => (activeTab === 'products' ? openProductModal() : openQuoteModal())}
            >
              {activeTab === 'products' ? 'Nuevo producto' : 'Nueva cotizacion'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          color="warning"
          icon={<Package />}
          label="Productos activos"
          value={activeProductsCount}
        />
        <StatCard
          color="info"
          icon={<FileText />}
          label="Cotizaciones abiertas"
          value={draftQuotesCount + sentQuotesCount + acceptedQuotesCount}
        />
        <StatCard
          color="success"
          icon={<CircleDollarSign />}
          label="Valor abierto"
          value={formatCurrency(openQuoteValue, 'USD')}
        />
        <StatCard
          color="brand"
          icon={<BarChart3 />}
          label="Conversion"
          value={`${conversionRate}%`}
        />
      </div>

      <div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
            <button
              onClick={() => setActiveTab('quotes')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === 'quotes'
                  ? 'bg-slate-900 dark:bg-brand-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cotizaciones
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === 'products'
                  ? 'bg-slate-900 dark:bg-brand-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Productos
            </button>
          </div>

          <div className="flex flex-1 items-center gap-3 xl:max-w-2xl">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Buscar ${activeTab === 'quotes' ? 'cotizaciones' : 'productos'}...`}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white shadow-sm outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-brand-500"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              className="shrink-0 !rounded-2xl"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => (activeTab === 'products' ? openProductModal() : openQuoteModal())}
            >
              {activeTab === 'products' ? 'Producto' : 'Cotizacion'}
            </Button>
          </div>
        </div>

        {activeTab === 'quotes' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canViewAllUsers ? (
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={assignedFilter}
                  onChange={(event) => setAssignedFilter(event.target.value)}
                  className="w-full sm:w-56 appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-white outline-none transition focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">Todos los usuarios</option>
                  {users.map((systemUser) => (
                    <option key={systemUser.id} value={systemUser.id}>
                      {systemUser.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Badge variant="brand" icon={<User className="h-3 w-3" />}>
                Mostrando tus cotizaciones
              </Badge>
            )}

            <button
              type="button"
              onClick={() => {
                setCurrentMonthOnly((prev) => !prev);
                setCustomDateFrom('');
                setCustomDateTo('');
              }}
              className={[
                'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-medium transition',
                currentMonthOnly && !customDateFrom && !customDateTo
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              <Calendar className="h-4 w-4" />
              Solo este mes
            </button>

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Desde</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={(event) => setCustomDateFrom(event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white outline-none transition focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <span>Hasta</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(event) => setCustomDateTo(event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white outline-none transition focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {(assignedFilter || customDateFrom || customDateTo || !currentMonthOnly) && (
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="h-4 w-4" />}
                onClick={() => {
                  setAssignedFilter('');
                  setCurrentMonthOnly(true);
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
              >
                Limpiar
              </Button>
            )}

            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {filteredQuotes.length} resultado{filteredQuotes.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {loading ? (
          <Card className="mt-6 p-10 text-center text-slate-500 dark:text-slate-400">
            Cargando ventas...
          </Card>
        ) : activeTab === 'products' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Catalogo de productos</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Productos y servicios que puedes reutilizar en cada cotizacion.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Tag className="h-4 w-4" />
                  {filteredProducts.length} resultados
                </div>
              </div>

              {filteredProducts.length ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {paginatedProducts.map((product) => (
                    <Card
                      key={product.id}
                      hover
                      className="p-4 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{product.name}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {product.sku || 'Sin SKU'} · {productTypeLabels[product.product_type]}
                          </div>
                        </div>
                        <Badge variant={product.is_active ? 'success' : 'neutral'}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                        {product.description || 'Sin descripcion'}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Precio</div>
                          <div className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatCurrency(parseDecimal(product.unit_price), product.currency)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit2 className="h-3.5 w-3.5" />}
                            onClick={() => openProductModal(product)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={product.is_active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            onClick={async () => {
                              const now = new Date().toISOString();
                              const { error } = await supabase
                                .from('sales_products')
                                .update({
                                  is_active: !product.is_active,
                                  updated_at: now,
                                })
                                .eq('id', product.id);

                              if (error) {
                                toast.error(`No se pudo actualizar el producto: ${error.message}`);
                                return;
                              }

                              toast.success(
                                product.is_active ? 'Producto desactivado' : 'Producto activado'
                              );
                              await loadSalesData();
                            }}
                          >
                            {product.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}

              {filteredProducts.length > productsPerPage && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setProductsPage((page) => Math.max(1, page - 1))}
                    disabled={productsPage === 1}
                    className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Pagina {productsPage} de {Math.ceil(filteredProducts.length / productsPerPage)}
                  </span>
                  <button
                    onClick={() =>
                      setProductsPage((page) =>
                        Math.min(Math.ceil(filteredProducts.length / productsPerPage), page + 1)
                      )
                    }
                    disabled={productsPage >= Math.ceil(filteredProducts.length / productsPerPage)}
                    className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!filteredProducts.length && (
                <div className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-6 py-10 text-center">
                  <Package className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No hay productos todavia</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Crea tu primer producto o servicio para acelerar la generacion de cotizaciones.
                  </p>
                  <Button variant="primary" size="md" className="mt-5" icon={<Plus className="h-4 w-4" />} onClick={() => openProductModal()}>
                    Nuevo producto
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 dark:bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Consejo comercial</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Usa productos para estandarizar y cotizar mas rapido.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Lineas del catalogo
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{products.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Productos activos
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{activeProductsCount}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Servicios
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                    {products.filter((product) => product.product_type === 'service').length}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cotizaciones</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Crea, envía y convierte propuestas comerciales en ordenes.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <FileText className="h-4 w-4" />
                  {filteredQuotes.length} resultados
                </div>
              </div>

              {filteredQuotes.length ? (
                <div className="mt-6 space-y-4">
                  {paginatedQuotes.map((quote) => {
                    return (
                      <button
                        key={quote.id}
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedQuoteId === quote.id
                            ? 'border-slate-900 dark:border-brand-500 bg-slate-900 dark:bg-brand-600 text-white shadow-lg'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold">
                              {quote.quote_number}
                            </div>
                            <Badge
                              variant={quoteStatusBadgeVariant[quote.status]}
                              className={`mt-2 ${selectedQuoteId === quote.id ? '!border-white/20 !bg-white/10 !text-white' : ''}`}
                            >
                              {quoteStatusLabels[quote.status]}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs ${selectedQuoteId === quote.id ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              {quote.client?.company_name || 'Sin cliente'}
                            </div>
                            {canViewAllUsers && quote.created_by && usersById[quote.created_by] && (
                              <div className={`text-[11px] ${selectedQuoteId === quote.id ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                {usersById[quote.created_by].full_name}
                              </div>
                            )}
                            <div
                              className={`mt-1 text-lg font-bold ${
                                selectedQuoteId === quote.id ? 'text-white' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {formatCurrency(parseDecimal(quote.total_amount), quote.currency)}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`mt-4 grid gap-3 text-xs ${
                            selectedQuoteId === quote.id ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                          } sm:grid-cols-3`}
                        >
                          <div className="rounded-xl bg-white/10 p-3">
                            <div className="font-semibold">Oportunidad</div>
                            <div className="mt-1">
                              {quote.opportunity?.opportunity_number || 'No vinculada'}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/10 p-3">
                            <div className="font-semibold">Fecha</div>
                            <div className="mt-1">{formatDate(quote.quote_date)}</div>
                          </div>
                          <div className="rounded-xl bg-white/10 p-3">
                            <div className="font-semibold">Items</div>
                            <div className="mt-1">{quote.items?.length || 0} lineas</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {filteredQuotes.length > quotesPerPage && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setQuotesPage((page) => Math.max(1, page - 1))}
                    disabled={quotesPage === 1}
                    className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Pagina {quotesPage} de {Math.ceil(filteredQuotes.length / quotesPerPage)}
                  </span>
                  <button
                    onClick={() =>
                      setQuotesPage((page) => Math.min(Math.ceil(filteredQuotes.length / quotesPerPage), page + 1))
                    }
                    disabled={quotesPage >= Math.ceil(filteredQuotes.length / quotesPerPage)}
                    className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!filteredQuotes.length && (
                <div className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-6 py-10 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No hay cotizaciones todavia</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Crea la primera cotizacion para empezar a cerrar ventas.
                  </p>
                  <Button variant="primary" size="md" className="mt-5" icon={<Plus className="h-4 w-4" />} onClick={() => openQuoteModal()}>
                    Nueva cotizacion
                  </Button>
                </div>
              )}
            </Card>

            <aside className="space-y-6">
              {selectedQuote ? (
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Detalle
                      </div>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {selectedQuote.quote_number}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {selectedQuote.client?.company_name || 'Sin cliente vinculado'}
                      </p>
                    </div>
                    <Badge variant={quoteStatusBadgeVariant[selectedQuote.status]}>
                      {quoteStatusLabels[selectedQuote.status]}
                    </Badge>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(parseDecimal(selectedQuote.total_amount), selectedQuote.currency)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Vence
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {formatDate(selectedQuote.expiry_date)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
                      <span>Cliente</span>
                      <strong className="text-slate-900 dark:text-white">
                        {selectedQuote.client?.company_name || 'Sin cliente'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
                      <span>Oportunidad</span>
                      <strong className="text-slate-900 dark:text-white">
                        {selectedQuote.opportunity?.opportunity_number || 'No vinculada'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
                      <span>Orden</span>
                      <strong className="text-slate-900 dark:text-white">
                        {selectedQuote.order?.order_number || 'Pendiente'}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                      Estado y recorrido
                    </div>
                    <div className="p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-xl space-y-2">
                          <div
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getQuoteStatusMeta(selectedQuote.status).className}`}
                          >
                            {getQuoteStatusMeta(selectedQuote.status).label}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {quoteStatusDescriptions[selectedQuote.status]}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Acción sugerida: {quoteNextActionLabels[selectedQuote.status]}.
                          </p>
                        </div>

                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                          <div className="rounded-xl border border-white dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              Último movimiento
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                              {selectedQuoteLastJourneyEvent?.label || 'Creada'}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {selectedQuoteLastJourneyEvent?.timestamp
                                ? formatDateTime(selectedQuoteLastJourneyEvent.timestamp)
                                : formatDateTime(selectedQuote.created_at)}
                            </div>
                          </div>

                          <div className="rounded-xl border border-white dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              Siguiente acción
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                              {selectedQuote.status === 'converted'
                                ? 'La cotización ya se convirtió'
                                : selectedQuote.status === 'rejected'
                                  ? 'Revisar y reenviar'
                                  : selectedQuote.status === 'expired'
                                    ? 'Renovar propuesta'
                                    : quoteNextActionLabels[selectedQuote.status]}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              Usa las acciones del panel para moverla al siguiente estado.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedQuoteJourney.map((event) => (
                          <div key={event.key} className="flex gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-sm">
                            <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${quoteTimelineTypeMeta[event.type]?.dotClassName || 'bg-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {event.label}
                                </div>
                                <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${event.className}`}>
                                  {event.type}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                {event.detail}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {formatDateTime(event.timestamp)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                      Acciones
                    </div>
                    <div className="grid gap-2 p-4 sm:grid-cols-2">
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Edit2 className="h-4 w-4" />}
                        onClick={() => selectedQuote && !selectedQuoteLocked && openQuoteModal(selectedQuote)}
                        disabled={selectedQuoteLocked}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        className="!bg-rose-50 dark:!bg-rose-500/10 !text-rose-700 dark:!text-rose-400 !border !border-rose-200 dark:!border-rose-500/30 !shadow-none hover:!bg-rose-100 dark:hover:!bg-rose-500/20"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => selectedQuote && !selectedQuoteLocked && handleDeleteQuote(selectedQuote)}
                        disabled={selectedQuoteLocked}
                      >
                        Eliminar
                      </Button>
                      {selectedQuote?.status === 'converted' ? (
                        <Button
                          variant="secondary"
                          size="md"
                          className="!bg-emerald-50 dark:!bg-emerald-500/10 !text-emerald-700 dark:!text-emerald-400 !border !border-emerald-200 dark:!border-emerald-500/30 hover:!bg-emerald-100 dark:hover:!bg-emerald-500/20"
                          icon={<Send className="h-4 w-4" />}
                          onClick={() => selectedQuote && sendOrderToClient(selectedQuote)}
                          disabled={!selectedOrderCanSend}
                        >
                          Enviar orden aprobada
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="md"
                          icon={<Send className="h-4 w-4" />}
                          onClick={() => selectedQuote && sendQuoteToClient(selectedQuote)}
                          disabled={!selectedQuoteCanSend}
                        >
                          {selectedQuoteSendLabel}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="md"
                        className="!bg-emerald-50 dark:!bg-emerald-500/10 !text-emerald-700 dark:!text-emerald-400 !border !border-emerald-200 dark:!border-emerald-500/30 hover:!bg-emerald-100 dark:hover:!bg-emerald-500/20"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => updateQuoteStatus(selectedQuote, 'accepted')}
                        disabled={selectedQuoteLocked}
                      >
                        Marcar como aceptada
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        className="!bg-rose-50 dark:!bg-rose-500/10 !text-rose-700 dark:!text-rose-400 !border !border-rose-200 dark:!border-rose-500/30 !shadow-none hover:!bg-rose-100 dark:hover:!bg-rose-500/20"
                        icon={<XCircle className="h-4 w-4" />}
                        onClick={() => updateQuoteStatus(selectedQuote, 'rejected')}
                        disabled={selectedQuoteLocked}
                      >
                        Marcar como rechazada
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        icon={<ArrowRight className="h-4 w-4" />}
                        onClick={() => convertQuoteToOrder(selectedQuote)}
                        disabled={selectedQuoteLocked}
                      >
                        Convertir a orden
                      </Button>
                    </div>
                    {selectedQuotePdfUrl ? (
                      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">PDF generado</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {selectedQuotePdfFilename}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Eye className="h-4 w-4" />}
                              onClick={() => handleOpenQuotePdf(selectedQuotePdfUrl)}
                            >
                              Ver PDF
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Download className="h-4 w-4" />}
                              onClick={() => handleDownloadQuotePdf(selectedQuotePdfUrl, selectedQuotePdfFilename)}
                            >
                              Descargar PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        Envía la cotización para generar el PDF y dejar el enlace disponible aquí.
                      </div>
                    )}
                    {selectedQuoteLocked ? (
                      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        Esta cotizacion ya fue convertida a una orden. Para proteger la trazabilidad no se puede editar ni eliminar.
                      </div>
                    ) : (
                      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        Cada cambio de estado queda registrado en el recorrido superior y en el historial completo.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                      Items
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {selectedQuoteItems.map((item) => (
                        <div key={item.id} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.product_name || item.description}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {productTypeLabels[item.item_type]} · {parseDecimal(item.quantity)} u
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(parseDecimal(item.line_total), item.currency)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatCurrency(parseDecimal(item.unit_price), item.currency)} c/u
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-8 text-center shadow-sm">
                  <AlertCircle className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Selecciona una cotizacion</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Aqui veras el detalle completo, el historial y las acciones de cierre.
                  </p>
                </div>
              )}

              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 dark:bg-slate-700 p-3 text-slate-700 dark:text-slate-200">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historial de la cotizacion</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Cada cambio de estado y cada nota quedan registrados en orden cronologico.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {timeline.length ? (
                    timeline.map((item) => (
                      <div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getTimelineEventMeta(item).dotClassName}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.description || getTimelineEventMeta(item).label}
                          </div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTimelineEventMeta(item).className}`}>
                              {getTimelineEventMeta(item).label}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {getTimelineEventType(item)} | {formatDateTime(item.created_at)}
                          </div>
                          {getTimelineEventType(item) !== item.type ? (
                            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                              Tipo original preservado desde el historial
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-6 text-sm text-slate-500 dark:text-slate-400">
                      Todavia no hay eventos para esta cotizacion.
                    </div>
                  )}
                </div>
              </Card>
            </aside>
          </div>
        )}
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingProductId ? 'Editar producto' : 'Nuevo producto'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Configura un producto o servicio reutilizable para tus cotizaciones.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  resetProductForm();
                }}
                className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SKU</span>
                <input
                  value={productForm.sku}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="SKU-001"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</span>
                <input
                  value={productForm.name}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="Hosting premium"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripcion</span>
                <textarea
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="min-h-28 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="Descripcion comercial del producto o servicio"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoria</span>
                <input
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="Hosting, Consultoria, Licencias"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</span>
                <select
                  value={productForm.product_type}
                  onChange={(event) =>
                    setProductForm((prev) => ({
                      ...prev,
                      product_type: event.target.value as ProductType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                >
                  <option value="product">Producto</option>
                  <option value="service">Servicio</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Precio de venta</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.unit_price}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, unit_price: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="120.00"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Costo</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.cost_price}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, cost_price: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="80.00"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Moneda</span>
                <input
                  value={productForm.currency}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, currency: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                  placeholder="USD"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-600 px-4 py-3">
                <input
                  type="checkbox"
                  checked={productForm.is_active}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, is_active: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-brand-500 focus:ring-slate-400"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">Activo</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Visible en cotizaciones</div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowProductModal(false);
                  resetProductForm();
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="md" onClick={handleSaveProduct}>
                {editingProductId ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingQuoteId ? 'Editar cotizacion' : 'Nueva cotizacion'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingQuoteId
                    ? 'Actualiza los datos, los items y los montos de la propuesta comercial.'
                    : 'Vincula cliente, oportunidad y productos para generar una propuesta comercial.'}
                </p>
              </div>
              <button
                onClick={closeQuoteModal}
                className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</span>
                    <select
                      value={quoteForm.client_id}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({
                          ...prev,
                          client_id: event.target.value,
                          opportunity_id: '',
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    >
                      <option value="">Seleccionar cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.company_name} · {client.contact_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Oportunidad</span>
                    <select
                      value={quoteForm.opportunity_id}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({
                          ...prev,
                          opportunity_id: event.target.value,
                          client_id:
                            opportunities.find((entry) => entry.id === event.target.value)?.client_id ||
                            prev.client_id,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    >
                      <option value="">Sin oportunidad</option>
                      {opportunityOptions.map((opportunity) => (
                        <option key={opportunity.id} value={opportunity.id}>
                          {opportunity.opportunity_number} · {opportunity.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</span>
                    <input
                      type="date"
                      value={quoteForm.quote_date}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({ ...prev, quote_date: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vence</span>
                    <input
                      type="date"
                      value={quoteForm.expiry_date}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({ ...prev, expiry_date: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Moneda</span>
                    <input
                      value={quoteForm.currency}
                      onChange={(event) => {
                        const value = event.target.value;
                        setQuoteForm((prev) => ({ ...prev, currency: value }));
                        setQuoteItems((currentItems) =>
                          currentItems.map((item) => ({ ...item, currency: value }))
                        );
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                      placeholder="USD"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">IVA %</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quoteForm.tax_rate}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({ ...prev, tax_rate: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Descuento global</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quoteForm.discount_amount}
                      onChange={(event) =>
                        setQuoteForm((prev) => ({ ...prev, discount_amount: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas internas</span>
                  <textarea
                    value={quoteForm.notes}
                    onChange={(event) =>
                      setQuoteForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    placeholder="Contexto comercial, negociacion, observaciones..."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Terminos</span>
                  <textarea
                    value={quoteForm.terms}
                    onChange={(event) =>
                      setQuoteForm((prev) => ({ ...prev, terms: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                    placeholder="Valida por 15 dias, pago contado, etc."
                  />
                </label>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Resumen preliminar</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Se recalcula con cada linea.</p>
                    </div>
                    <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addQuoteItem}>
                      Agregar linea
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Subtotal</div>
                      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(quoteTotalsPreview.subtotal, quoteForm.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">IVA</div>
                      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(quoteTotalsPreview.taxAmount, quoteForm.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(quoteTotalsPreview.total, quoteForm.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Lineas de cotizacion</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Elige productos del catalogo o escribe items manuales.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addQuoteItem}>
                    Agregar
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  {quoteItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <Tag className="h-4 w-4" />
                          Linea {index + 1}
                        </div>
                        <button
                          onClick={() => removeQuoteItem(item.id)}
                          className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Quitar
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</span>
                          <select
                            value={item.product_id}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'product_id', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                          >
                            <option value="">Manual</option>
                            {products
                              .filter((product) => product.is_active)
                              .map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} · {formatCurrency(parseDecimal(product.unit_price), product.currency)}
                                </option>
                              ))}
                          </select>
                        </label>

                        <label className="space-y-2 md:col-span-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripcion</span>
                          <input
                            value={item.description}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'description', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                            placeholder="Descripcion del item"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad</span>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'quantity', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Precio unitario</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'unit_price', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Descuento %</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount_percent}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'discount_percent', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</span>
                          <select
                            value={item.item_type}
                            onChange={(event) =>
                              handleQuoteItemChange(item.id, 'item_type', event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-brand-500"
                          >
                            <option value="product">Producto</option>
                            <option value="service">Servicio</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <button
                onClick={closeQuoteModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuote}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {editingQuoteId ? 'Guardar cambios' : 'Crear cotizacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
