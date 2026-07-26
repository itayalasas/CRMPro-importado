export interface QuoteCommunicationCompanySettings {
  company_name?: string;
  company_legal_name?: string;
  company_rut?: string;
  company_tax_id?: string;
  company_address?: string;
  company_city?: string;
  company_country?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  company_logo_url?: string;
  primary_color?: string;
  accent_color?: string;
}

export interface QuoteCommunicationClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface QuoteCommunicationItem {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  description?: string | null;
  item_type: string;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  line_total?: number | string | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface QuoteCommunicationQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  expiry_date: string | null;
  status: string;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  notes: string | null;
  terms: string | null;
  order_id?: string | null;
  order?: { order_number?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  client?: QuoteCommunicationClient | null;
  items?: QuoteCommunicationItem[] | null;
}

export interface QuoteCommunicationResponse {
  success: boolean;
  message?: string;
  log_id?: string;
  pdf_log_id?: string;
  pdf_filename?: string;
  pdf_size_bytes?: number;
  pdf_attached_inline?: boolean;
  pdf_public_url?: string;
  resend_email_id?: string;
  processing_time_ms?: number;
  [key: string]: unknown;
}

export interface QuoteCommunicationRequest {
  recipient_email: string;
  order_id: string;
  email: {
    template_name: string;
    subject: string;
    data: Record<string, unknown>;
  };
  attachment: {
    pdf_template_name: string;
    filename: string;
    data: Record<string, unknown>;
  };
  wait_for_invoice: boolean;
}

type QuoteMetadata = Record<string, unknown> | null | undefined;

const DEFAULT_PRIMARY_COLOR = '#0f172a';
const DEFAULT_ACCENT_COLOR = '#f97316';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateValue = (value: string | null | undefined) => {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAmount = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatDate = (value: string | null | undefined) => {
  const date = parseDateValue(value);
  if (!date) return 'Sin fecha';

  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()),
  ].join('/');
};

const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return 'Sin fecha';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getQuoteMetadata = (quote: QuoteCommunicationQuote | null | undefined): Record<string, unknown> | null => {
  if (!quote?.metadata || typeof quote.metadata !== 'object') return null;
  return quote.metadata;
};

const getCommunicationRecord = (quote: QuoteCommunicationQuote | null | undefined): Record<string, unknown> | null => {
  const metadata = getQuoteMetadata(quote);
  if (!metadata) return null;

  const communication = metadata.communication;
  if (!communication || typeof communication !== 'object') return null;

  return communication as Record<string, unknown>;
};

const getStringValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getObjectValue = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : null);

const getCompanyAddress = (company: QuoteCommunicationCompanySettings) => {
  const directAddress = getStringValue(company.company_address);
  if (directAddress) return directAddress;

  const parts = [company.company_city, company.company_country]
    .map(getStringValue)
    .filter(Boolean);

  return parts.join(', ');
};

const getClientAddress = (client?: QuoteCommunicationClient | null) => {
  if (!client) return '';

  const directAddress = getStringValue(client.address);
  if (directAddress) return directAddress;

  const parts = [client.city, client.country]
    .map(getStringValue)
    .filter(Boolean);

  return parts.join(', ');
};

const getValidityLabel = (quoteDate: string, expiryDate: string | null) => {
  if (!expiryDate) return 'Sin vencimiento';

  const start = parseDateValue(quoteDate);
  const end = parseDateValue(expiryDate);

  if (!start || !end) {
    return formatDate(expiryDate);
  }

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.max(0, Math.round((endUtc - startUtc) / 86400000));

  if (diffDays === 0) return 'Vence hoy';
  if (diffDays === 1) return '1 día';
  return `${diffDays} días`;
};

const getQuoteItems = (quote: QuoteCommunicationQuote) => {
  const items = Array.isArray(quote.items) ? [...quote.items] : [];
  return items.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
};

export const getQuoteCommunicationPublicToken = (quote: QuoteCommunicationQuote | null | undefined) => {
  const communication = getCommunicationRecord(quote);
  const token = communication ? getStringValue(communication.public_token) : '';
  return token;
};

export const getQuoteCommunicationPdfUrl = (quote: QuoteCommunicationQuote | null | undefined) => {
  const communication = getCommunicationRecord(quote);
  if (!communication) return '';

  const directUrl = getStringValue(communication.pdf_public_url);
  if (directUrl) return directUrl;

  const response = getObjectValue(communication.response_payload);
  return response ? getStringValue(response.pdf_public_url) : '';
};

export const getQuoteCommunicationPdfFilename = (quote: QuoteCommunicationQuote | null | undefined) => {
  const communication = getCommunicationRecord(quote);
  if (!communication) {
    return quote ? `cotizacion-${quote.quote_number}.pdf` : 'cotizacion.pdf';
  }

  const directFilename = getStringValue(communication.pdf_filename);
  if (directFilename) return directFilename;

  const response = getObjectValue(communication.response_payload);
  const responseFilename = response ? getStringValue(response.pdf_filename) : '';
  return responseFilename || `cotizacion-${quote?.quote_number || 'sin-numero'}.pdf`;
};

export const buildQuoteCommunicationRequest = (
  quote: QuoteCommunicationQuote,
  client: QuoteCommunicationClient | null,
  company: QuoteCommunicationCompanySettings,
  appUrl: string,
  publicToken: string,
  generatedAt: string
): QuoteCommunicationRequest => {
  const quoteItems = getQuoteItems(quote);
  const normalizedAppUrl = normalizeBaseUrl(appUrl);
  const quotePath = `${normalizedAppUrl}/cotizaciones/${encodeURIComponent(quote.quote_number)}`;
  const publicUrl = `${quotePath}?t=${encodeURIComponent(publicToken)}`;
  const downloadUrl = `${quotePath}/descargar?t=${encodeURIComponent(publicToken)}`;
  const acceptUrl = `${quotePath}/aceptar?t=${encodeURIComponent(publicToken)}`;
  const rejectUrl = `${quotePath}/rechazar?t=${encodeURIComponent(publicToken)}`;
  const companyName = getStringValue(company.company_name) || 'Mi Empresa';
  const companyLegalName = getStringValue(company.company_legal_name) || companyName;
  const companyTaxId = getStringValue(company.company_rut) || getStringValue(company.company_tax_id);
  const companyEmail = getStringValue(company.company_email);
  const companyPhone = getStringValue(company.company_phone);
  const companyWebsite = getStringValue(company.company_website) || normalizedAppUrl;
  const companyLogoUrl = getStringValue(company.company_logo_url);
  const companyAddress = getCompanyAddress(company);
  const clientName = getStringValue(client?.company_name) || getStringValue(client?.contact_name) || 'Cliente';
  const clientContactName = getStringValue(client?.contact_name) || clientName;
  const clientEmail = getStringValue(client?.email);
  const clientPhone = getStringValue(client?.phone);
  const clientAddress = getClientAddress(client);
  const validityLabel = getValidityLabel(quote.quote_date, quote.expiry_date);
  const totalAmount = toNumber(quote.total_amount);
  const subtotalAmount = toNumber(quote.subtotal);
  const discountAmount = toNumber(quote.discount_amount);
  const taxAmount = toNumber(quote.tax_amount);
  const taxRate = toNumber(quote.tax_rate);
  const hasDiscount = discountAmount > 0;
  const orderId = quote.quote_number;

  return {
    recipient_email: clientEmail,
    order_id: orderId,
    email: {
      template_name: 'quote_share_email_v2',
      subject: `Tu cotización ${quote.quote_number} está lista`,
      data: {
        order_id: orderId,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        email_subject: `Tu cotización ${quote.quote_number} está lista`,
        preheader: 'Revisa la cotización y responde aceptando o rechazando la propuesta.',
        client_name: clientName,
        client_email: clientEmail,
        quote_date: formatDate(quote.quote_date),
        expiry_date: quote.expiry_date ? formatDate(quote.expiry_date) : '',
        status: quote.status,
        status_label: quote.status === 'draft'
          ? 'Borrador'
          : quote.status === 'sent'
            ? 'Enviada'
            : quote.status === 'accepted'
              ? 'Aceptada'
              : quote.status === 'rejected'
                ? 'Rechazada'
                : quote.status === 'expired'
                  ? 'Vencida'
                  : 'Convertida',
        currency: quote.currency,
        quote_total: totalAmount,
        formatted_total: formatAmount(totalAmount),
        validity_label: validityLabel,
        terms: quote.terms || '',
        notes: quote.notes || '',
        company_name: companyName,
        company_legal_name: companyLegalName,
        company_tax_id: companyTaxId,
        company_email: companyEmail,
        company_phone: companyPhone,
        company_website: companyWebsite,
        company_logo_url: companyLogoUrl,
        company_address: companyAddress,
        primary_color: getStringValue(company.primary_color) || DEFAULT_PRIMARY_COLOR,
        accent_color: getStringValue(company.accent_color) || DEFAULT_ACCENT_COLOR,
        public_url: publicUrl,
        download_url: downloadUrl,
        accept_url: acceptUrl,
        reject_url: rejectUrl,
        reference_type: 'quote',
        reference_id: quote.id,
      },
    },
    attachment: {
      pdf_template_name: 'quote_document_pdf_v2',
      filename: `cotizacion-${quote.quote_number}.pdf`,
      data: {
        order_id: orderId,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        quote_date: formatDate(quote.quote_date),
        expiry_date: quote.expiry_date ? formatDate(quote.expiry_date) : '',
        expiry_date_label: quote.expiry_date ? formatDate(quote.expiry_date) : 'Sin fecha',
        generated_at: formatDateTime(generatedAt),
        status: quote.status,
        status_label: quote.status === 'draft'
          ? 'Borrador'
          : quote.status === 'sent'
            ? 'Enviada'
            : quote.status === 'accepted'
              ? 'Aceptada'
              : quote.status === 'rejected'
                ? 'Rechazada'
                : quote.status === 'expired'
                  ? 'Vencida'
                  : 'Convertida',
        currency: quote.currency,
        subtotal: subtotalAmount,
        discount_amount: discountAmount,
        has_discount: hasDiscount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        formatted_subtotal: formatAmount(subtotalAmount),
        formatted_discount_amount: formatAmount(discountAmount),
        formatted_tax_amount: formatAmount(taxAmount),
        formatted_total_amount: formatAmount(totalAmount),
        notes: quote.notes || '',
        terms: quote.terms || '',
        validity_label: validityLabel,
        company_name: companyName,
        company_legal_name: companyLegalName,
        company_tax_id: companyTaxId,
        company_email: companyEmail,
        company_phone: companyPhone,
        company_website: companyWebsite,
        company_logo_url: companyLogoUrl,
        company_address: companyAddress,
        primary_color: getStringValue(company.primary_color) || DEFAULT_PRIMARY_COLOR,
        accent_color: getStringValue(company.accent_color) || DEFAULT_ACCENT_COLOR,
        client_id: client?.id || '',
        client_company_name: clientName,
        client_contact_name: clientContactName,
        client_tax_id: '',
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        items: quoteItems.map((item, index) => {
          const quantity = toNumber(item.quantity);
          const unitPrice = toNumber(item.unit_price);
          const discountPercent = toNumber(item.discount_percent);
          const discountValue = toNumber(item.discount_amount);
          const lineTotal = toNumber(item.line_total);

          return {
            numero: index + 1,
            id: item.id,
            product_id: item.product_id || '',
            product_name: item.product_name || item.description || '',
            description: item.description || item.product_name || '',
            item_type: item.item_type,
            quantity,
            unit_price: unitPrice,
            formatted_unit_price: formatAmount(unitPrice),
            discount_percent: discountPercent,
            discount_amount: discountValue,
            line_total: lineTotal,
            formatted_line_total: formatAmount(lineTotal),
            currency: item.currency || quote.currency,
          };
        }),
        metadata: {
          source: getStringValue(quote.metadata?.source) || 'sales_module',
          channel: getStringValue(quote.metadata?.channel) || 'manual',
          reference_type: 'quote',
          reference_id: quote.id,
        },
      },
    },
    wait_for_invoice: false,
  };
};

export interface QuoteCommunicationOrderInfo {
  order_number: string;
  order_date?: string | null;
}

export const buildOrderCommunicationRequest = (
  quote: QuoteCommunicationQuote,
  order: QuoteCommunicationOrderInfo,
  client: QuoteCommunicationClient | null,
  company: QuoteCommunicationCompanySettings,
  appUrl: string,
  publicToken: string,
  generatedAt: string,
  acceptedAt: string | null
): QuoteCommunicationRequest => {
  const quoteItems = getQuoteItems(quote);
  const normalizedAppUrl = normalizeBaseUrl(appUrl);
  const orderId = order.order_number;
  const orderPath = `${normalizedAppUrl}/ordenes/${encodeURIComponent(orderId)}`;
  const publicUrl = `${orderPath}?t=${encodeURIComponent(publicToken)}`;
  const downloadUrl = `${orderPath}/descargar?t=${encodeURIComponent(publicToken)}`;
  const companyName = getStringValue(company.company_name) || 'Mi Empresa';
  const companyLegalName = getStringValue(company.company_legal_name) || companyName;
  const companyTaxId = getStringValue(company.company_rut) || getStringValue(company.company_tax_id);
  const companyEmail = getStringValue(company.company_email);
  const companyPhone = getStringValue(company.company_phone);
  const companyWebsite = getStringValue(company.company_website) || normalizedAppUrl;
  const companyLogoUrl = getStringValue(company.company_logo_url);
  const companyAddress = getCompanyAddress(company);
  const clientName = getStringValue(client?.company_name) || getStringValue(client?.contact_name) || 'Cliente';
  const clientContactName = getStringValue(client?.contact_name) || clientName;
  const clientEmail = getStringValue(client?.email);
  const clientPhone = getStringValue(client?.phone);
  const clientAddress = getClientAddress(client);
  const totalAmount = toNumber(quote.total_amount);
  const subtotalAmount = toNumber(quote.subtotal);
  const discountAmount = toNumber(quote.discount_amount);
  const taxAmount = toNumber(quote.tax_amount);
  const taxRate = toNumber(quote.tax_rate);
  const hasDiscount = discountAmount > 0;
  const orderDateLabel = formatDate(order.order_date || generatedAt);
  const acceptedAtLabel = formatDateTime(acceptedAt || generatedAt);
  const emailSubject = `Tu orden ${orderId} fue generada`;

  return {
    recipient_email: clientEmail,
    order_id: orderId,
    email: {
      template_name: 'quote_accepted_order_email_v2',
      subject: emailSubject,
      data: {
        order_id: orderId,
        order_number: orderId,
        order_date: orderDateLabel,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        email_subject: emailSubject,
        preheader: 'Tu cotización fue aceptada y la orden ya está disponible.',
        client_name: clientName,
        client_email: clientEmail,
        quote_date: formatDate(quote.quote_date),
        accepted_at: acceptedAtLabel,
        status: 'accepted',
        status_label: 'Aceptada',
        currency: quote.currency,
        order_total: totalAmount,
        formatted_total: formatAmount(totalAmount),
        terms: quote.terms || '',
        notes: quote.notes || '',
        company_name: companyName,
        company_legal_name: companyLegalName,
        company_tax_id: companyTaxId,
        company_email: companyEmail,
        company_phone: companyPhone,
        company_website: companyWebsite,
        company_logo_url: companyLogoUrl,
        company_address: companyAddress,
        primary_color: getStringValue(company.primary_color) || DEFAULT_PRIMARY_COLOR,
        accent_color: getStringValue(company.accent_color) || DEFAULT_ACCENT_COLOR,
        public_url: publicUrl,
        download_url: downloadUrl,
        reference_type: 'order',
        reference_id: orderId,
      },
    },
    attachment: {
      pdf_template_name: 'order_document_pdf_v2',
      filename: `orden-${orderId}.pdf`,
      data: {
        order_id: orderId,
        order_number: orderId,
        order_date: orderDateLabel,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        quote_date: formatDate(quote.quote_date),
        accepted_at: acceptedAtLabel,
        generated_at: formatDateTime(generatedAt),
        status: 'accepted',
        status_label: 'Aceptada',
        currency: quote.currency,
        subtotal: subtotalAmount,
        discount_amount: discountAmount,
        has_discount: hasDiscount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        formatted_subtotal: formatAmount(subtotalAmount),
        formatted_discount_amount: formatAmount(discountAmount),
        formatted_tax_amount: formatAmount(taxAmount),
        formatted_total_amount: formatAmount(totalAmount),
        notes: quote.notes || '',
        terms: quote.terms || '',
        company_name: companyName,
        company_legal_name: companyLegalName,
        company_tax_id: companyTaxId,
        company_email: companyEmail,
        company_phone: companyPhone,
        company_website: companyWebsite,
        company_logo_url: companyLogoUrl,
        company_address: companyAddress,
        primary_color: getStringValue(company.primary_color) || DEFAULT_PRIMARY_COLOR,
        accent_color: getStringValue(company.accent_color) || DEFAULT_ACCENT_COLOR,
        client_id: client?.id || '',
        client_company_name: clientName,
        client_contact_name: clientContactName,
        client_tax_id: '',
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        items: quoteItems.map((item, index) => {
          const quantity = toNumber(item.quantity);
          const unitPrice = toNumber(item.unit_price);
          const discountPercent = toNumber(item.discount_percent);
          const discountValue = toNumber(item.discount_amount);
          const lineTotal = toNumber(item.line_total);

          return {
            numero: index + 1,
            id: item.id,
            product_id: item.product_id || '',
            product_name: item.product_name || item.description || '',
            description: item.description || item.product_name || '',
            item_type: item.item_type,
            quantity,
            unit_price: unitPrice,
            formatted_unit_price: formatAmount(unitPrice),
            discount_percent: discountPercent,
            discount_amount: discountValue,
            line_total: lineTotal,
            formatted_line_total: formatAmount(lineTotal),
            currency: item.currency || quote.currency,
          };
        }),
        metadata: {
          source: getStringValue(quote.metadata?.source) || 'sales_module',
          channel: 'quote_acceptance',
          reference_type: 'order',
          reference_id: orderId,
          source_quote_id: quote.id,
          source_quote_number: quote.quote_number,
        },
      },
    },
    wait_for_invoice: false,
  };
};

export const buildQuoteCommunicationMetadata = (
  quote: QuoteCommunicationQuote,
  requestPayload: QuoteCommunicationRequest,
  responsePayload: QuoteCommunicationResponse,
  publicToken: string,
  sentAt: string
) => {
  const existingMetadata = getQuoteMetadata(quote) || {};

  return {
    ...existingMetadata,
    communication: {
      public_token: publicToken,
      sent_at: sentAt,
      request_payload: requestPayload,
      response_payload: responsePayload,
      pdf_public_url: responsePayload.pdf_public_url || '',
      pdf_filename: responsePayload.pdf_filename || `cotizacion-${quote.quote_number}.pdf`,
      pdf_size_bytes: responsePayload.pdf_size_bytes ?? null,
      log_id: responsePayload.log_id || '',
      pdf_log_id: responsePayload.pdf_log_id || '',
      resend_email_id: responsePayload.resend_email_id || '',
      processing_time_ms: responsePayload.processing_time_ms ?? null,
    },
  };
};
