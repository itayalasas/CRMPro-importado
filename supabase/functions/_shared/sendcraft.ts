// Thin client for SendCraft's bulk email API (POST /notify, GET /notify/:job_id).
// Docs: https://sendcraft.net/docs

export const SENDCRAFT_BASE_URL =
  Deno.env.get("SENDCRAFT_API_URL") || "https://api.sendcraft.net";

export function getSendcraftApiKey(): string {
  const key = Deno.env.get("SENDCRAFT_API_KEY");
  if (!key) {
    throw new Error(
      "SENDCRAFT_API_KEY no está configurada como secreto de la Edge Function"
    );
  }
  return key;
}

export interface SendcraftNotifyResult {
  email: string;
  status: "sent" | "failed";
  log_id?: string;
  error?: string;
}

export interface SendcraftJob {
  job_id?: string;
  id?: string;
  status: "pending" | "processing" | "done" | "failed" | "cancelled";
  total: number;
  processed?: number;
  sent: number;
  failed: number;
  results?: SendcraftNotifyResult[];
}

async function sendcraftFetch(path: string, init: RequestInit): Promise<SendcraftJob> {
  const res = await fetch(`${SENDCRAFT_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": getSendcraftApiKey(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message || `SendCraft respondió HTTP ${res.status}`;
    throw new Error(message);
  }

  return payload as SendcraftJob;
}

export interface NotifyRecipient {
  email: string;
  data?: Record<string, unknown>;
}

export function sendcraftNotify(body: {
  type: "email" | "email_pdf" | "pdf";
  template_name: string;
  recipients: NotifyRecipient[];
  shared_data?: Record<string, unknown>;
  options?: { concurrency?: number; batch_delay_ms?: number; max_retries?: number };
}) {
  return sendcraftFetch("/notify", { method: "POST", body: JSON.stringify(body) });
}

export function sendcraftGetJob(jobId: string) {
  return sendcraftFetch(`/notify/${jobId}`, { method: "GET" });
}

/**
 * Applies a SendCraft job snapshot (from POST /notify or GET /notify/:id) to our own
 * campaign_email_logs / campaigns rows. SendCraft only returns `email` per result (no
 * external_reference_id on /notify), so matching is by campaign_id + email.
 */
export async function applyJobSnapshotToCampaign(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  campaignId: string,
  job: SendcraftJob
) {
  const jobId = job.job_id || job.id || null;

  if (job.results && job.results.length > 0) {
    for (const result of job.results) {
      await supabase
        .from("campaign_email_logs")
        .update({
          status: result.status,
          error_message: result.status === "failed" ? result.error || "Error desconocido" : null,
          sent_at: result.status === "sent" ? new Date().toISOString() : null,
          metadata: { sendcraft_log_id: result.log_id ?? null, sendcraft_job_id: jobId },
        })
        .eq("campaign_id", campaignId)
        .eq("email", result.email);
    }
  }

  const isTerminal =
    job.status === "done" || job.status === "failed" || job.status === "cancelled";

  // Derive sent/failed from the actual per-recipient logs rather than job.sent/job.failed:
  // a retry only resubmits the failed subset as its own SendCraft job, so that job's own
  // counters only cover those few recipients, not the whole campaign. The logs are the
  // real source of truth for the campaign's cumulative totals.
  const { data: logs } = await supabase
    .from("campaign_email_logs")
    .select("status")
    .eq("campaign_id", campaignId);
  // deno-lint-ignore no-explicit-any
  const sentCount = (logs || []).filter((l: any) => l.status === "sent").length;
  // deno-lint-ignore no-explicit-any
  const failedCount = (logs || []).filter((l: any) => l.status === "failed" || l.status === "bounced").length;

  const update: Record<string, unknown> = {
    sent_count: sentCount,
    failed_count: failedCount,
    status: isTerminal ? "sent" : "sending",
  };
  if (jobId) update.sendcraft_job_id = jobId;
  if (isTerminal) update.sent_at = new Date().toISOString();

  await supabase.from("campaigns").update(update).eq("id", campaignId);
}
