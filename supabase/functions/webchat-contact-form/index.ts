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
  [key: string]: unknown;
};

type ExtraField = {
  key: string;
  label: string;
  value: string;
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

    const name = sanitizeText(payload.name, 120);
    const email = sanitizeText(payload.email, 180).toLowerCase();
    const phone = sanitizeText(payload.phone, 40);
    const company = sanitizeText(payload.company, 180);
    const message = sanitizeText(payload.message, 4000);
    const sourceDomain = sanitizeText(payload.source_domain, 150);
    const sourceDetail = sanitizeText(payload.source_detail, 120);
    const pageUrl = sanitizeText(payload.page_url, 500);
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

    const { data: conversation, error: conversationError } = await supabase
      .from("webchat_conversations")
      .insert({
        session_id: sessionId,
        source_domain: sourceDomain || null,
        source_channel: "form",
        source_detail: sourceDetail || webchatSettings.form_source_detail || "contact_form",
        page_url: pageUrl || null,
        visitor_name: name,
        visitor_email: email,
        visitor_phone: phone || null,
        status: "open",
        assigned_user_id: null,
        assigned_user_name: null,
        assigned_at: null,
        last_message_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (conversationError || !conversation?.id) {
      return new Response(JSON.stringify({ error: "No se pudo crear conversación" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const composedMessage = buildStructuredChatMessage({
      message,
      name,
      email,
      phone,
      company,
      sourceDomain,
      sourceDetail,
      pageUrl,
      extraFields,
    });

    const { error: messageError } = await supabase
      .from("webchat_messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "visitor",
        sender_id: `form:${email}`,
        sender_name: name,
        message: composedMessage,
        attachments: [],
        created_at: now,
      });

    if (messageError) {
      return new Response(JSON.stringify({ error: "No se pudo registrar mensaje" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          null,
          appUrl,
          webchatSettings.form_notify_subject || "Nuevo formulario de contacto",
          {
            name,
            email,
            phone,
            company,
            message,
            source_domain: sourceDomain,
            source_detail: sourceDetail,
            page_url: pageUrl,
          },
          conversation.id,
          extraFields
        );
      } catch (notifyError) {
        console.error("[WEBCHAT-CONTACT-FORM] Error enviando notificación al agente:", notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversation.id,
        assigned_user_id: null,
        extras_received: extraFields.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
