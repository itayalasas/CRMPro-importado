import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  applyJobSnapshotToCampaign,
  sendcraftGetJob,
  sendcraftNotify,
  type NotifyRecipient,
} from "../_shared/sendcraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendCampaignRequest {
  campaign_id: string;
  contact_ids?: string[];
  retry_failed?: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildRecipient(contact: any, appPublicUrl: string): NotifyRecipient {
  return {
    email: contact.email,
    data: {
      ...(contact.custom_fields || {}),
      client_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Cliente",
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      client_email: contact.email,
      company_name: contact.company_name || "",
      client_phone: contact.phone || "",
      unsubscribe_url: appPublicUrl && contact.id ? `${appPublicUrl}/desuscribir/${contact.id}` : "",
    },
  };
}

// Same convention as webchat-contact-form's insertClientInteractionSafely: if the
// timeline's type CHECK doesn't yet know about this type, degrade to 'note' instead
// of failing the whole request.
function isClientInteractionTypeConstraintError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("client_interactions_type_check") || message.includes("check constraint");
}

async function insertClientInteractionSafely(supabase: any, payload: Record<string, unknown>) {
  const { error } = await supabase.from("client_interactions").insert(payload);
  if (!error) return;

  if (!isClientInteractionTypeConstraintError(error)) {
    console.error("Error insertando client_interactions:", error);
    return;
  }

  await supabase.from("client_interactions").insert({
    ...payload,
    type: "note",
    metadata: {
      ...((payload.metadata as Record<string, unknown>) || {}),
      original_type: payload.type,
      fallback_reason: "client_interactions_type_check",
    },
  });
}

// Links each campaign contact to a Client card (creates one if none exists yet, matching
// by email — same convention as webchat-contact-form's upsertLeadClient), so campaign
// recipients can be followed up like any other commercial contact. Existing clients are
// only linked, never overwritten, so a real client's data isn't clobbered by lower-quality
// campaign contact data.
async function ensureClientsForContacts(supabase: any, contacts: any[], campaign: any) {
  const toResolve = contacts.filter((c) => !c.client_id && c.email);
  if (toResolve.length === 0) return;

  const emails = [...new Set(toResolve.map((c) => String(c.email).toLowerCase()))];
  const { data: existingClients } = await supabase.from("clients").select("id, email").in("email", emails);

  const clientIdByEmail = new Map<string, string>();
  for (const c of existingClients || []) {
    if (c.email) clientIdByEmail.set(String(c.email).toLowerCase(), c.id);
  }

  const toCreate = toResolve.filter((c) => !clientIdByEmail.has(String(c.email).toLowerCase()));
  if (toCreate.length > 0) {
    const newClientRows = toCreate.map((c) => ({
      company_name: c.company_name || null,
      contact_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email,
      email: c.email,
      phone: c.phone || null,
      status: "prospect",
      source: "campaign",
      created_by: null,
    }));

    const { data: createdClients, error: createError } = await supabase
      .from("clients")
      .insert(newClientRows)
      .select("id, email");

    if (createError) {
      console.error("Error creando clientes desde campaña:", createError);
    }
    for (const c of createdClients || []) {
      if (c.email) clientIdByEmail.set(String(c.email).toLowerCase(), c.id);
    }
  }

  const now = new Date().toISOString();
  for (const contact of toResolve) {
    const clientId = clientIdByEmail.get(String(contact.email).toLowerCase());
    if (!clientId) continue;

    await supabase.from("contacts").update({ client_id: clientId }).eq("id", contact.id);
    contact.client_id = clientId;

    await insertClientInteractionSafely(supabase, {
      client_id: clientId,
      type: "campaign_sent",
      description: `Campaña "${campaign.name}" enviada`,
      metadata: { campaign_id: campaign.id, campaign_name: campaign.name, contact_id: contact.id },
      created_by: null,
      created_at: now,
    });
  }
}

async function loadSharedData(supabase: any, campaign: any) {
  const { data: generalSettings } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "general_settings")
    .maybeSingle();
  const general = (generalSettings?.setting_value as any) || {};

  return {
    ...(campaign.custom_variables || {}),
    campaign_name: campaign.name,
    current_date: new Date().toLocaleDateString("es-MX"),
    crm_company: general.company_name || "CRM Pro",
    company_url: general.company_website || "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaign_id, contact_ids, retry_failed }: SendCampaignRequest = await req.json();

    if (!campaign_id) {
      return jsonResponse({ error: "campaign_id es requerido" }, 400);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return jsonResponse({ error: "Campaña no encontrada" }, 404);
    }

    const templateName = campaign.email_templates?.sendcraft_template_name;
    if (!templateName) {
      return jsonResponse(
        {
          error:
            "La plantilla de esta campaña no tiene un 'sendcraft_template_name' configurado. Edítala y vincúlala con el template ya creado en el dashboard de SendCraft.",
        },
        400
      );
    }

    const appPublicUrl = (Deno.env.get("APP_PUBLIC_URL") || "").replace(/\/+$/, "");

    // --- Retry path: re-reads the CURRENT contact data (not what SendCraft stored on the
    // original job) so an edited email/name/phone actually takes effect, then submits a
    // fresh /notify job with just the failed recipients.
    if (retry_failed) {
      const { data: failedLogs } = await supabase
        .from("campaign_email_logs")
        .select("id, contact_id, email")
        .eq("campaign_id", campaign_id)
        .eq("status", "failed");

      if (!failedLogs || failedLogs.length === 0) {
        return jsonResponse({ error: "No hay destinatarios fallidos para reintentar" }, 400);
      }

      const contactIds = failedLogs.map((l: any) => l.contact_id).filter(Boolean);
      const { data: currentContacts } = contactIds.length
        ? await supabase.from("contacts").select("*").in("id", contactIds)
        : { data: [] };
      const contactsById = new Map((currentContacts || []).map((c: any) => [c.id, c]));

      await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign_id);

      const retryContacts: any[] = [];
      for (const log of failedLogs) {
        const current = log.contact_id ? contactsById.get(log.contact_id) : null;
        const contact = current || { id: log.contact_id, email: log.email };

        await supabase
          .from("campaign_email_logs")
          .update({ status: "pending", error_message: null, email: contact.email })
          .eq("id", log.id);

        retryContacts.push(contact);
      }

      const recipients = retryContacts.map((c) => buildRecipient(c, appPublicUrl));
      const sharedData = await loadSharedData(supabase, campaign);

      const notifyResponse = await sendcraftNotify({
        type: "email",
        template_name: templateName,
        recipients,
        shared_data: sharedData,
        options: { concurrency: 5, batch_delay_ms: 2000 },
      });

      const retryJobId = notifyResponse.job_id || notifyResponse.id;
      const fullJob = retryJobId ? await sendcraftGetJob(retryJobId) : notifyResponse;
      await applyJobSnapshotToCampaign(supabase, campaign_id, fullJob);

      return jsonResponse({
        success: true,
        job: fullJob,
        message: `Reintento: ${fullJob.sent} enviados, ${fullJob.failed} fallidos`,
      });
    }

    // --- New send: resolve recipients.
    let contacts;
    if (contact_ids && contact_ids.length > 0) {
      const { data } = await supabase.from("contacts").select("*").in("id", contact_ids);
      contacts = data;
    } else if (campaign.group_id) {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("group_id", campaign.group_id)
        .eq("status", "active");
      contacts = data;
    } else {
      contacts = [];
    }

    if (!contacts || contacts.length === 0) {
      return jsonResponse({ error: "No hay contactos para enviar" }, 400);
    }

    await ensureClientsForContacts(supabase, contacts, campaign);

    await supabase
      .from("campaigns")
      .update({
        status: "sending",
        total_recipients: contacts.length,
        sent_count: 0,
        failed_count: 0,
        sendcraft_job_id: null,
      })
      .eq("id", campaign_id);

    // Clear any previous logs for this campaign before starting a fresh send.
    await supabase.from("campaign_email_logs").delete().eq("campaign_id", campaign_id);

    const initialLogs = contacts.map((contact: any) => ({
      campaign_id,
      contact_id: contact.id,
      email: contact.email,
      status: "pending",
    }));
    await supabase.from("campaign_email_logs").insert(initialLogs);

    const recipients: NotifyRecipient[] = contacts.map((contact: any) => buildRecipient(contact, appPublicUrl));
    const sharedData = await loadSharedData(supabase, campaign);

    const notifyResponse = await sendcraftNotify({
      type: "email",
      template_name: templateName,
      recipients,
      shared_data: sharedData,
      options: { concurrency: 5, batch_delay_ms: 2000 },
    });

    const jobId = notifyResponse.job_id || notifyResponse.id;
    const fullJob = jobId ? await sendcraftGetJob(jobId) : notifyResponse;
    await applyJobSnapshotToCampaign(supabase, campaign_id, fullJob);

    return jsonResponse({
      success: true,
      job: fullJob,
      message:
        fullJob.status === "done" || fullJob.status === "failed"
          ? `Enviados: ${fullJob.sent}, Fallidos: ${fullJob.failed}`
          : `Envío en curso (job ${jobId}). Consulta el progreso en tiempo real.`,
    });
  } catch (error: any) {
    console.error("Error en send-campaign-emails:", error);
    return jsonResponse({ error: error.message || "Error interno del servidor" }, 500);
  }
});
