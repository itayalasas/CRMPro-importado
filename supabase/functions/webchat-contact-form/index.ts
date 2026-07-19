import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Integration-Key, X-API-Key, X-Access-Key",
};

type WebchatSettings = {
  integration_key?: string;
  api_key?: string;
  form_assigned_agent_email?: string;
  form_source_detail?: string;
  form_notify_subject?: string;
};

type SmtpConfig = {
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  from_email?: string;
  from_name?: string;
};

type ContactFormPayload = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  page_url?: string;
  source_domain?: string;
  source_detail?: string;
  estimate_value?: string | number;
  estimated_time?: string;
  timeline?: string;
  budget?: string | number;
  currency?: string;
  project_type?: string;
  session_id?: string;
  source_channel?: string;
  queue_only?: boolean;
  visitor?: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    company?: unknown;
    id?: unknown;
  };
  attachments?: unknown[];
  [key: string]: unknown;
};

type ExtraField = {
  key: string;
  label: string;
  value: string;
};

type SystemUserRecord = {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  is_active: boolean | null;
};

type ClientRecord = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  source: string | null;
};

type SalesOpportunityRecord = {
  id: string;
  opportunity_number: string;
  stage: string;
  status: string;
};

type SalesQuoteRecord = {
  id: string;
  quote_number: string;
  status: string;
  total_amount: number | string;
};

const getHeader = (headers: Headers, ...names: string[]): string | null => {
  for (const name of names) {
    const value = headers.get(name);
    if (value && value.trim().length > 0) return value;
  }
  return null;
};

const sanitizeText = (value: unknown, max = 2000): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const sanitizeAny = (value: unknown, max = 500): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().slice(0, max);
  }
  if (typeof value === "string") {
    return value.trim().slice(0, max);
  }
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return "";
  }
};

const prettifyKey = (key: string): string => {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const getExtraFields = (payload: ContactFormPayload): ExtraField[] => {
  const fieldLabels: Record<string, string> = {
    estimate_value: "Valor estimado",
    estimated_time: "Tiempo estimado",
    timeline: "Timeline",
    budget: "Presupuesto",
    currency: "Moneda",
    project_type: "Tipo de proyecto",
  };

  const reserved = new Set([
    "name",
    "email",
    "phone",
    "company",
    "message",
    "page_url",
    "source_domain",
    "source_detail",
    "session_id",
    "source_channel",
    "queue_only",
    "visitor",
    "attachments",
    "created_at",
    "sender_type",
    "message_type",
  ]);

  const preferredOrder = [
    "estimate_value",
    "currency",
    "estimated_time",
    "timeline",
    "budget",
    "project_type",
  ];

  return Object.entries(payload)
    .filter(([key]) => !reserved.has(key))
    .map(([key, rawValue]) => ({
      key,
      label: fieldLabels[key] || prettifyKey(key),
      value: sanitizeAny(rawValue),
    }))
    .filter((field) => field.value.length > 0)
    .sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.key);
      const indexB = preferredOrder.indexOf(b.key);
      const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      if (rankA !== rankB) return rankA - rankB;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    })
    .slice(0, 30);
};

const buildStructuredChatMessage = (args: {
  message: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  sourceDomain: string;
  sourceDetail: string;
  pageUrl: string;
  extraFields: ExtraField[];
}): string => {
  const {
    message,
    name,
    email,
    phone,
    company,
    sourceDomain,
    sourceDetail,
    pageUrl,
    extraFields,
  } = args;

  const contactLines = [
    `👤 Nombre: ${name}`,
    `📧 Email: ${email}`,
    phone ? `📞 Teléfono: ${phone}` : "",
    company ? `🏢 Empresa: ${company}` : "",
  ].filter(Boolean);

  const originLines = [
    sourceDomain ? `🌐 Dominio: ${sourceDomain}` : "",
    sourceDetail ? `🧭 Origen: ${sourceDetail}` : "",
    pageUrl ? `🔗 Página: ${pageUrl}` : "",
  ].filter(Boolean);

  const extraSection = extraFields.length > 0
    ? [
        "",
        "📌 Datos adicionales:",
        ...extraFields.map((field) => `- ${field.label}: ${field.value}`),
      ]
    : [];

  return [
    "📥 Nuevo formulario web",
    ...contactLines,
    ...originLines,
    "",
    "📝 Mensaje del cliente:",
    message,
    ...extraSection,
  ].join("\n");
};

const canSendSmtp = (cfg: SmtpConfig) => {
  return !!(cfg.host && cfg.port && cfg.username && cfg.password && cfg.from_email);
};

const normalizeForSearch = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const parseMoneyValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCurrency = (value: unknown): string => {
  if (typeof value !== "string") return "USD";
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.slice(0, 3) || "USD";
};

const addTimeUnit = (baseDate: Date, amount: number, unit: "day" | "week" | "month" | "year"): Date => {
  const result = new Date(baseDate);

  if (unit === "day") {
    result.setDate(result.getDate() + amount);
  } else if (unit === "week") {
    result.setDate(result.getDate() + amount * 7);
  } else if (unit === "month") {
    result.setMonth(result.getMonth() + amount);
  } else if (unit === "year") {
    result.setFullYear(result.getFullYear() + amount);
  }

  return result;
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
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("client_interactions_type_check") ||
    message.includes("violates check constraint") ||
    message.includes("check constraint")
  );
};

const fallbackClientInteractionType = (type: string) => {
  if (type === "quote_converted") return "order";
  if (type === "quote_sent") return "email";
  return "note";
};

const insertClientInteractionSafely = async (
  supabaseClient: ReturnType<typeof createClient>,
  payload: ClientInteractionInsert
) => {
  const { error } = await supabaseClient.from("client_interactions").insert(payload as any);
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
      fallback_reason: "client_interactions_type_check",
    },
  };

  const { error: fallbackError } = await supabaseClient
    .from("client_interactions")
    .insert(fallbackPayload as any);

  return { error: fallbackError ?? null, usedFallback: true };
};

const deriveExpectedCloseDate = (...values: Array<string | undefined>): string | null => {
  const now = new Date();

  for (const rawValue of values) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) continue;

    const normalized = normalizeForSearch(value);
    if (["hoy", "today", "ahora"].includes(normalized)) {
      return now.toISOString().slice(0, 10);
    }

    if (["manana", "tomorrow"].includes(normalized)) {
      return addTimeUnit(now, 1, "day").toISOString().slice(0, 10);
    }

    const directDate = new Date(value);
    if (!Number.isNaN(directDate.getTime())) {
      return directDate.toISOString().slice(0, 10);
    }

    const patterns: Array<[RegExp, "day" | "week" | "month" | "year"]> = [
      [/(\d+)\s*(day|days|dia|dias|d)\b/, "day"],
      [/(\d+)\s*(week|weeks|semana|semanas|w)\b/, "week"],
      [/(\d+)\s*(month|months|mes|meses|m)\b/, "month"],
      [/(\d+)\s*(year|years|ano|anos|y)\b/, "year"],
    ];

    for (const [pattern, unit] of patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;

      const amount = Number(match[1]);
      if (Number.isFinite(amount) && amount > 0) {
        return addTimeUnit(now, amount, unit).toISOString().slice(0, 10);
      }
    }
  }

  return null;
};

const resolveAssignedUser = async (supabaseClient: ReturnType<typeof createClient>, email: string | null) => {
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from("system_users")
    .select("id, full_name, email, role, is_active")
    .ilike("email", email)
    .eq("is_active", true)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as SystemUserRecord;
};

const findClientByEmail = async (supabaseClient: ReturnType<typeof createClient>, email: string) => {
  const { data, error } = await supabaseClient
    .from("clients")
    .select("id, company_name, contact_name, email, phone, source")
    .eq("email", email)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as ClientRecord;
};

const findClientByPhone = async (supabaseClient: ReturnType<typeof createClient>, phone: string) => {
  const { data, error } = await supabaseClient
    .from("clients")
    .select("id, company_name, contact_name, email, phone, source")
    .eq("phone", phone)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as ClientRecord;
};

const upsertLeadClient = async (args: {
  supabaseClient: ReturnType<typeof createClient>;
  name: string;
  email: string;
  phone: string;
  company: string;
  now: string;
}) => {
  const { supabaseClient, name, email, phone, company, now } = args;
  const foundByEmail = await findClientByEmail(supabaseClient, email);
  const foundClient = foundByEmail || (phone ? await findClientByPhone(supabaseClient, phone) : null);
  const companyName = company || foundClient?.company_name || name || "Lead web";
  const contactName = name || foundClient?.contact_name || email;

  if (foundClient) {
    const { error } = await supabaseClient
      .from("clients")
      .update({
        company_name: companyName,
        contact_name: contactName,
        email,
        phone: phone || foundClient.phone || null,
        updated_at: now,
      })
      .eq("id", foundClient.id);

    if (error) {
      throw new Error(`No se pudo actualizar el cliente: ${error.message}`);
    }

    return {
      client: {
        ...foundClient,
        company_name: companyName,
        contact_name: contactName,
        email,
        phone: phone || foundClient.phone || null,
      },
      created: false,
    };
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .insert({
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone || null,
      status: "prospect",
      source: "webchat",
      created_by: null,
      updated_at: now,
    })
    .select("id, company_name, contact_name, email, phone, source")
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear el cliente: ${error?.message || "sin detalle"}`);
  }

  return {
    client: data as ClientRecord,
    created: true,
  };
};

const buildOpportunityTitle = (args: {
  company: string;
  name: string;
  projectType: string;
}): string => {
  const { company, name, projectType } = args;
  const base = company || name || "Lead web";
  const suffix = projectType || "Nueva cotizacion";
  return `${base} - ${suffix}`.slice(0, 180);
};

const buildOpportunityMetadata = (args: {
  payload: ContactFormPayload;
  extraFields: ExtraField[];
  sourceDomain: string;
  sourceDetail: string;
  pageUrl: string;
  projectType: string;
  estimateValue: string;
  estimatedTime: string;
  timeline: string;
  budget: string;
  currency: string;
}) => {
  const {
    payload,
    extraFields,
    sourceDomain,
    sourceDetail,
    pageUrl,
    projectType,
    estimateValue,
    estimatedTime,
    timeline,
    budget,
    currency,
  } = args;

  return {
    source_channel: "webchat_form",
    source_detail: sourceDetail,
    source_domain: sourceDomain || null,
    page_url: pageUrl || null,
    project_type: projectType || null,
    estimate_value: estimateValue || null,
    estimated_time: estimatedTime || null,
    timeline: timeline || null,
    budget: budget || null,
    currency: currency || "USD",
    extra_fields: extraFields,
    payload,
  };
};

const DEFAULT_SALES_OPPORTUNITY_STAGE_ID = "04541c75-b5c1-476d-9d91-fe17f628bb5e";

const resolveDefaultSalesOpportunityStageId = async (
  supabaseClient: ReturnType<typeof createClient>
) => {
  try {
    const { data, error } = await supabaseClient
      .from("sales_opportunities")
      .select("stage_id")
      .not("stage_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && typeof (data as { stage_id?: unknown }).stage_id === "string") {
      const stageId = String((data as { stage_id: string }).stage_id).trim();
      if (stageId) {
        return stageId;
      }
    }
  } catch (error) {
    console.warn("[WEBCHAT-CONTACT-FORM] No se pudo resolver stage_id por defecto:", error);
  }

  return DEFAULT_SALES_OPPORTUNITY_STAGE_ID;
};

const createSalesOpportunity = async (args: {
  supabaseClient: ReturnType<typeof createClient>;
  stageId: string;
  clientId: string;
  conversationId: string;
  assignedUserId: string | null;
  name: string;
  company: string;
  projectType: string;
  estimateValue: string;
  estimatedTime: string;
  timeline: string;
  budget: string;
  currency: string;
  sourceDetail: string;
  sourceDomain: string;
  pageUrl: string;
  payload: ContactFormPayload;
  extraFields: ExtraField[];
  now: string;
}) => {
  const {
    supabaseClient,
    stageId,
    clientId,
    conversationId,
    assignedUserId,
    name,
    company,
    projectType,
    estimateValue,
    estimatedTime,
    timeline,
    budget,
    currency,
    sourceDetail,
    sourceDomain,
    pageUrl,
    payload,
    extraFields,
    now,
  } = args;

  const rawAmount = parseMoneyValue(estimateValue) ?? parseMoneyValue(budget) ?? 0;
  const probability = rawAmount > 0 ? 35 : 20;
  const expectedCloseDate = deriveExpectedCloseDate(estimatedTime, timeline);
  const opportunityTitle = buildOpportunityTitle({ company, name, projectType });
  const safeStageId = stageId || DEFAULT_SALES_OPPORTUNITY_STAGE_ID;

  const { data, error } = await supabaseClient
    .from("sales_opportunities")
    .insert({
      client_id: clientId,
      conversation_id: conversationId,
      stage_id: safeStageId,
      contact_name: name || company || "Cliente",
      contact_email: payload.email || null,
      contact_phone: payload.phone || null,
      title: opportunityTitle,
      stage: "prospect",
      status: "open",
      amount: rawAmount,
      expected_amount: rawAmount,
      currency,
      probability,
      expected_close_date: expectedCloseDate,
      source_channel: "webchat_form",
      source_detail: sourceDetail,
      assigned_to: assignedUserId,
      created_by: null,
      metadata: buildOpportunityMetadata({
        payload,
        extraFields,
        sourceDomain,
        sourceDetail,
        pageUrl,
        projectType,
        estimateValue,
        estimatedTime,
        timeline,
        budget,
        currency,
      }),
      last_activity_at: now,
      updated_at: now,
    })
    .select("id, opportunity_number, stage, status")
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear la oportunidad: ${error?.message || "sin detalle"}`);
  }

  return data as SalesOpportunityRecord;
};

const createLeadTimelineEntry = async (args: {
  supabaseClient: ReturnType<typeof createClient>;
  clientId: string;
  opportunityId: string;
  conversationId: string;
  assignedUserId: string | null;
  sourceDetail: string;
  sourceDomain: string;
  pageUrl: string;
  payload: ContactFormPayload;
  extraFields: ExtraField[];
  now: string;
}) => {
  const {
    supabaseClient,
    clientId,
    opportunityId,
    conversationId,
    assignedUserId,
    sourceDetail,
    sourceDomain,
    pageUrl,
    payload,
    extraFields,
    now,
  } = args;

  const { error } = await insertClientInteractionSafely(supabaseClient, {
      client_id: clientId,
      opportunity_id: opportunityId,
      conversation_id: conversationId,
      type: "quote_requested",
      description: "Solicitud de cotizacion desde webchat",
      metadata: {
        source_channel: "webchat_form",
        source_detail: sourceDetail,
        source_domain: sourceDomain || null,
        page_url: pageUrl || null,
        payload,
        extra_fields: extraFields,
      },
      created_by: assignedUserId,
      created_at: now,
    });

  if (error) {
    throw new Error(`No se pudo registrar el historial: ${error.message}`);
  }
};

const shouldCreateAutoQuote = (args: {
  message: string;
  projectType: string;
  sourceDetail: string;
  estimateValue: string;
  budget: string;
}) => {
  const rawAmount = parseMoneyValue(args.estimateValue) ?? parseMoneyValue(args.budget) ?? 0;
  if (rawAmount > 0) return true;

  const haystack = normalizeForSearch([args.message, args.projectType, args.sourceDetail].filter(Boolean).join(" "));
  return ["cotiz", "quote", "presup", "proposal", "propuesta", "pricing", "precio"].some((term) =>
    haystack.includes(term)
  );
};

const createLeadQuote = async (args: {
  supabaseClient: ReturnType<typeof createClient>;
  stageId: string;
  clientId: string;
  opportunityId: string;
  assignedUserId: string | null;
  name: string;
  company: string;
  message: string;
  projectType: string;
  estimateValue: string;
  budget: string;
  currency: string;
  sourceDetail: string;
  sourceDomain: string;
  pageUrl: string;
  payload: ContactFormPayload;
  extraFields: ExtraField[];
  now: string;
}) => {
  const {
    supabaseClient,
    stageId,
    clientId,
    opportunityId,
    assignedUserId,
    name,
    company,
    message,
    projectType,
    estimateValue,
    budget,
    currency,
    sourceDetail,
    sourceDomain,
    pageUrl,
    payload,
    extraFields,
    now,
  } = args;

  if (!shouldCreateAutoQuote({ message, projectType, sourceDetail, estimateValue, budget })) {
    return null;
  }

  const rawAmount = parseMoneyValue(estimateValue) ?? parseMoneyValue(budget) ?? 0;
  const normalizedCurrency = normalizeCurrency(currency);
  const quoteDate = now.slice(0, 10);
  const expiryDate = addTimeUnit(new Date(now), 15, "day").toISOString().slice(0, 10);
  const subjectLabel = projectType || sourceDetail || company || name || "Solicitud web";
  const safeStageId = stageId || DEFAULT_SALES_OPPORTUNITY_STAGE_ID;
  const quoteNotes = [
    "Cotización generada automáticamente desde formulario web.",
    `Cliente: ${company || name || "N/A"}`,
    sourceDetail ? `Origen: ${sourceDetail}` : "",
    sourceDomain ? `Dominio: ${sourceDomain}` : "",
    pageUrl ? `Página: ${pageUrl}` : "",
    message ? `Mensaje original: ${message}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: quote, error: quoteError } = await supabaseClient
    .from("sales_quotes")
    .insert({
      client_id: clientId,
      opportunity_id: opportunityId,
      status: "draft",
      quote_date: quoteDate,
      expiry_date: expiryDate,
      currency: normalizedCurrency,
      notes: quoteNotes,
      terms: "Validez 15 días",
      created_by: assignedUserId,
      metadata: {
        source_channel: "webchat_form",
        auto_created: true,
        quote_intent: true,
        has_amount: rawAmount > 0,
        raw_amount: rawAmount,
        project_type: projectType || null,
        source_detail: sourceDetail || null,
        source_domain: sourceDomain || null,
        page_url: pageUrl || null,
        payload,
        extra_fields: extraFields,
      },
      updated_at: now,
    })
    .select("id, quote_number, status, total_amount")
    .single();

  if (quoteError || !quote) {
    throw new Error(`No se pudo crear la cotización: ${quoteError?.message || "sin detalle"}`);
  }

  const { error: quoteItemError } = await supabaseClient
    .from("sales_quote_items")
    .insert({
      quote_id: quote.id,
      product_name: subjectLabel,
      description: rawAmount > 0
        ? `Propuesta inicial - ${subjectLabel}`
        : `Borrador de cotización - ${subjectLabel}`,
      item_type: "service",
      quantity: 1,
      unit_price: rawAmount,
      discount_percent: 0,
      currency: normalizedCurrency,
      metadata: {
        source_channel: "webchat_form",
        auto_created: true,
        has_amount: rawAmount > 0,
        raw_amount: rawAmount,
      },
    });

  if (quoteItemError) {
    await supabaseClient.from("sales_quotes").delete().eq("id", quote.id);
    throw new Error(`No se pudieron crear los items de la cotización: ${quoteItemError.message}`);
  }

  const { error: opportunityUpdateError } = await supabaseClient
    .from("sales_opportunities")
    .update({
      stage_id: safeStageId,
      contact_name: name || company || "Cliente",
      contact_email: payload.email || null,
      contact_phone: payload.phone || null,
      stage: "quote",
      probability: 65,
      amount: rawAmount,
      expected_amount: rawAmount,
      last_activity_at: now,
      updated_at: now,
    })
    .eq("id", opportunityId);

  if (opportunityUpdateError) {
    console.error("[WEBCHAT-CONTACT-FORM] No se pudo actualizar la oportunidad a etapa quote:", opportunityUpdateError);
  }

  const { error: quoteInteractionError } = await insertClientInteractionSafely(supabaseClient, {
      client_id: clientId,
      opportunity_id: opportunityId,
      quote_id: quote.id,
      type: "quote_created",
      description: `Cotización ${quote.quote_number} creada automáticamente desde webchat`,
      metadata: {
        source_channel: "webchat_form",
        auto_created: true,
        quote_number: quote.quote_number,
        quote_id: quote.id,
        raw_amount: rawAmount,
        has_amount: rawAmount > 0,
      },
      created_by: assignedUserId,
      created_at: now,
    });

  if (quoteInteractionError) {
    console.error("[WEBCHAT-CONTACT-FORM] No se pudo registrar la cotización en el historial:", quoteInteractionError);
  }

  return quote as SalesQuoteRecord;
};

const sendAgentNotification = async (
  smtpConfig: SmtpConfig,
  toEmail: string,
  toName: string | null,
  appUrl: string | null,
  subject: string,
  payload: ContactFormPayload,
  conversationId: string,
  extraFields: ExtraField[]
) => {
  if (!canSendSmtp(smtpConfig)) return;

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: !!smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.verify();

  const subjectLine = subject || "Nuevo formulario de contacto";
  const conversationUrl = appUrl ? `${appUrl}` : "";
  const extraFieldsHtml = extraFields.length > 0
    ? `<p><strong>Datos adicionales:</strong></p><ul>${extraFields
        .map((field) => `<li><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</li>`)
        .join("")}</ul>`
    : "";
  const extraFieldsText = extraFields.length > 0
    ? `\nDatos adicionales:\n${extraFields
        .map((field) => `- ${field.label}: ${field.value}`)
        .join("\n")}`
    : "";

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.45;">
      <h3 style="margin: 0 0 14px;">Nuevo formulario de contacto</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
        <tr><td style="padding: 6px 8px; background: #f8fafc; width: 160px;"><strong>Contacto</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.name || "Sin nombre")}</td></tr>
        <tr><td style="padding: 6px 8px; background: #f8fafc;"><strong>Email</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.email || "Sin email")}</td></tr>
        <tr><td style="padding: 6px 8px; background: #f8fafc;"><strong>Teléfono</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.phone || "Sin teléfono")}</td></tr>
        <tr><td style="padding: 6px 8px; background: #f8fafc;"><strong>Empresa</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.company || "Sin empresa")}</td></tr>
        <tr><td style="padding: 6px 8px; background: #f8fafc;"><strong>Dominio</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.source_domain || "N/A")}</td></tr>
        <tr><td style="padding: 6px 8px; background: #f8fafc;"><strong>Detalle origen</strong></td><td style="padding: 6px 8px;">${escapeHtml(payload.source_detail || "N/A")}</td></tr>
      </table>
      <p style="margin: 0 0 6px;"><strong>Mensaje:</strong></p>
      <div style="padding: 12px; border-left: 3px solid #0ea5e9; background: #f8fafc; border-radius: 6px; white-space: pre-line;">${escapeHtml(payload.message || "")}</div>
      ${extraFieldsHtml}
      <p style="margin-top: 16px;"><strong>Conversation ID:</strong> ${escapeHtml(conversationId)}</p>
      ${conversationUrl ? `<p>Gestiona este caso en CRMPro: <a href="${conversationUrl}" target="_blank">Abrir CRMPro</a></p>` : ""}
    </div>
  `;

  await transporter.sendMail({
    from: smtpConfig.from_name
      ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
      : smtpConfig.from_email,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    subject: subjectLine,
    text: `Nuevo formulario de contacto\n\nContacto: ${payload.name || "Sin nombre"}\nEmail: ${payload.email || "Sin email"}\nTeléfono: ${payload.phone || "Sin teléfono"}\nEmpresa: ${payload.company || "Sin empresa"}\n\nMensaje:\n${payload.message || ""}${extraFieldsText}\n\nConversation ID: ${conversationId}`,
    html,
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const providedKey = getHeader(
      req.headers,
      "x-integration-key",
      "X-Integration-Key",
      "x-api-key",
      "X-API-Key",
      "x-access-key",
      "X-Access-Key",
      "apikey",
      "Apikey"
    );

    const { data: settingsRow, error: settingsError } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "webchat_settings")
      .maybeSingle();

    if (settingsError) {
      return new Response(JSON.stringify({ error: "No se pudo leer configuración" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webchatSettings = (settingsRow?.setting_value || {}) as WebchatSettings;
    const validKeys = [
      webchatSettings.integration_key,
      webchatSettings.api_key,
    ]
      .map((key) => (typeof key === "string" ? key.trim() : ""))
      .filter((key) => key.length > 0);

    if (!providedKey || validKeys.length === 0 || !validKeys.includes(providedKey)) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyText = await req.text();
    let payload: ContactFormPayload = {};
    try {
      payload = bodyText ? (JSON.parse(bodyText) as ContactFormPayload) : {};
    } catch {
      payload = {};
    }

    const visitor = isRecord(payload.visitor) ? payload.visitor : null;
    const rawName = payload.name ?? visitor?.name;
    const rawEmail = payload.email ?? visitor?.email;
    const rawPhone = payload.phone ?? visitor?.phone;
    const rawCompany = payload.company ?? visitor?.company;

    const name = sanitizeText(rawName, 120);
    const email = sanitizeText(rawEmail, 180).toLowerCase();
    const phone = sanitizeText(rawPhone, 40);
    const company = sanitizeText(rawCompany, 180);
    const message = sanitizeText(payload.message, 4000);
    const sourceDomain = sanitizeText(payload.source_domain, 150);
    const sourceDetail = sanitizeText(payload.source_detail, 120);
    const pageUrl = sanitizeText(payload.page_url, 500);
    const projectType = sanitizeText(payload.project_type, 180);
    const estimatedTime = sanitizeText(payload.estimated_time, 120);
    const timeline = sanitizeText(payload.timeline, 120);
    const budget = sanitizeText(payload.budget, 120);
    const estimateValue = sanitizeText(payload.estimate_value, 120);
    const currency = normalizeCurrency(payload.currency);
    const extraFields = getExtraFields(payload);

    if (!name) {
      return new Response(JSON.stringify({ error: "name requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "email requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "message requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let assignedUserEmail: string | null = null;

    if (!assignedUserEmail && webchatSettings.form_assigned_agent_email) {
      assignedUserEmail = webchatSettings.form_assigned_agent_email;
    }

    const now = new Date().toISOString();
    const sessionId = `form_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const sourceDetailValue = sourceDetail || webchatSettings.form_source_detail || "contact_form";
    const assignedUser = await resolveAssignedUser(supabase, assignedUserEmail);
    const clientResult = await upsertLeadClient({
      supabaseClient: supabase,
      name,
      email,
      phone,
      company: company || name || "Lead web",
      now,
    });

    let conversationId = "";
    let opportunityId = "";
    let opportunityNumber = "";
    let opportunityStage = "";
    let opportunityStatus = "";
    let quoteId = "";
    let quoteNumber = "";
    let quoteCreated = false;
    let cleanupConversation = false;
    let cleanupOpportunity = false;

    try {
      const { data: conversation, error: conversationError } = await supabase
        .from("webchat_conversations")
        .insert({
          session_id: sessionId,
          client_id: clientResult.client.id,
          source_domain: sourceDomain || null,
          source_channel: "form",
          source_detail: sourceDetailValue,
          page_url: pageUrl || null,
          visitor_name: name,
          visitor_email: email,
          visitor_phone: phone || null,
          status: assignedUser ? "assigned" : "open",
          assigned_user_id: assignedUser?.id || null,
          assigned_user_name: assignedUser?.full_name || null,
          assigned_at: assignedUser ? now : null,
          last_message_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (conversationError || !conversation?.id) {
        throw new Error("No se pudo crear conversacion");
      }

      conversationId = conversation.id;
      cleanupConversation = true;
      const stageId = await resolveDefaultSalesOpportunityStageId(supabase);

      const opportunity = await createSalesOpportunity({
        supabaseClient: supabase,
        stageId,
        clientId: clientResult.client.id,
        conversationId,
        assignedUserId: assignedUser?.id || null,
        name,
        company: clientResult.client.company_name,
        projectType,
        estimateValue,
        estimatedTime,
        timeline,
        budget,
        currency,
        sourceDetail: sourceDetailValue,
        sourceDomain,
        pageUrl,
        payload,
        extraFields,
        now,
      });

      opportunityId = opportunity.id;
      opportunityNumber = opportunity.opportunity_number;
      opportunityStage = opportunity.stage;
      opportunityStatus = opportunity.status;
      cleanupOpportunity = true;

      const { error: conversationLinkError } = await supabase
        .from("webchat_conversations")
        .update({
          opportunity_id: opportunityId,
          updated_at: now,
        })
        .eq("id", conversationId);

      if (conversationLinkError) {
        throw new Error(`No se pudo vincular la oportunidad a la conversacion: ${conversationLinkError.message}`);
      }

      const composedMessage = buildStructuredChatMessage({
        message,
        name,
        email,
        phone,
        company,
        sourceDomain,
        sourceDetail: sourceDetailValue,
        pageUrl,
        extraFields,
      });

      const { error: messageError } = await supabase
        .from("webchat_messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "visitor",
          sender_id: `form:${email}`,
          sender_name: name,
          message: composedMessage,
          attachments: [],
          created_at: now,
        });

      if (messageError) {
        throw new Error(`No se pudo registrar mensaje: ${messageError.message}`);
      }

      try {
        await createLeadTimelineEntry({
          supabaseClient: supabase,
          clientId: clientResult.client.id,
          opportunityId,
          conversationId,
          assignedUserId: assignedUser?.id || null,
          sourceDetail: sourceDetailValue,
          sourceDomain,
          pageUrl,
          payload,
          extraFields,
          now,
        });
      } catch (timelineError) {
        console.error("[WEBCHAT-CONTACT-FORM] Error registrando timeline:", timelineError);
      }

      try {
        const quote = await createLeadQuote({
          supabaseClient: supabase,
          stageId,
          clientId: clientResult.client.id,
          opportunityId,
          assignedUserId: assignedUser?.id || null,
          name,
          company: clientResult.client.company_name,
          message,
          projectType,
          estimateValue,
          budget,
          currency,
          sourceDetail: sourceDetailValue,
          sourceDomain,
          pageUrl,
          payload,
          extraFields,
          now,
        });

        if (quote) {
          quoteId = quote.id;
          quoteNumber = quote.quote_number;
          quoteCreated = true;
          opportunityStage = "quote";
        }
      } catch (quoteError) {
        console.error("[WEBCHAT-CONTACT-FORM] Error creando cotización automática:", quoteError);
      }

      if (assignedUserEmail) {
        const { data: smtpSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "smtp_config")
          .maybeSingle();

        const { data: generalSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "general_settings")
          .maybeSingle();

        const smtpConfig = (smtpSetting?.setting_value || {}) as SmtpConfig;
        const appUrl = (generalSetting?.setting_value?.app_url as string | undefined) || null;

        try {
          await sendAgentNotification(
            smtpConfig,
            assignedUserEmail,
            assignedUser?.full_name || null,
            appUrl,
            webchatSettings.form_notify_subject || "Nuevo formulario de contacto",
            {
              name,
              email,
              phone,
              company,
              message,
              source_domain: sourceDomain,
              source_detail: sourceDetailValue,
              page_url: pageUrl,
            },
            conversationId,
            extraFields
          );
        } catch (notifyError) {
          console.error("[WEBCHAT-CONTACT-FORM] Error enviando notificacion al agente:", notifyError);
        }
      }

      cleanupConversation = false;
      cleanupOpportunity = false;

      return new Response(
        JSON.stringify({
          success: true,
          client_id: clientResult.client.id,
          client_created: clientResult.created,
          conversation_id: conversationId,
          opportunity_id: opportunityId,
          opportunity_number: opportunityNumber,
          opportunity_stage: opportunityStage,
          opportunity_status: opportunityStatus,
          quote_created: quoteCreated,
          quote_id: quoteId || null,
          quote_number: quoteNumber || null,
          assigned_user_id: assignedUser?.id || null,
          assigned_user_name: assignedUser?.full_name || null,
          extras_received: extraFields.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (flowError) {
      if (cleanupConversation && conversationId) {
        await supabase.from("webchat_conversations").delete().eq("id", conversationId);
      }

      if (cleanupOpportunity && opportunityId) {
        await supabase.from("sales_opportunities").delete().eq("id", opportunityId);
      }

      if (clientResult.created && clientResult.client.id) {
        await supabase.from("clients").delete().eq("id", clientResult.client.id);
      }

      throw flowError;
    }
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "Error desconocido";

    return new Response(JSON.stringify({ error: "Error procesando formulario", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
