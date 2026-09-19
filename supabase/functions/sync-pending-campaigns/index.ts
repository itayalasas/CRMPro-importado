import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { applyJobSnapshotToCampaign, sendcraftGetJob } from "../_shared/sendcraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Batch version of campaign-notify-status: resyncs every campaign stuck in "sending"
// against SendCraft. Meant to be triggered periodically by pg_cron (see migration
// 20260919120000_schedule_campaign_sync.sql) so campaigns get finalized even when
// nobody has the monitor modal open to drive the per-campaign poll.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: pending, error } = await supabase
      .from("campaigns")
      .select("id, name, sendcraft_job_id")
      .eq("status", "sending")
      .not("sendcraft_job_id", "is", null);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    const results: { campaign_id: string; name: string; status?: string; error?: string }[] = [];

    for (const campaign of pending || []) {
      try {
        const job = await sendcraftGetJob(campaign.sendcraft_job_id as string);
        await applyJobSnapshotToCampaign(supabase, campaign.id, job);
        results.push({ campaign_id: campaign.id, name: campaign.name, status: job.status });
      } catch (err: any) {
        console.error(`Error sincronizando campaña ${campaign.id}:`, err);
        results.push({ campaign_id: campaign.id, name: campaign.name, error: err.message || String(err) });
      }
    }

    return jsonResponse({ success: true, checked: (pending || []).length, results });
  } catch (error: any) {
    console.error("Error en sync-pending-campaigns:", error);
    return jsonResponse({ error: error.message || "Error interno del servidor" }, 500);
  }
});
