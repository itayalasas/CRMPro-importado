import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { applyJobSnapshotToCampaign, sendcraftGetJob } from "../_shared/sendcraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Pulls the latest job status from SendCraft (GET /notify/:job_id) and syncs it into
// campaign_email_logs / campaigns. SendCraft has no outbound webhook for per-recipient
// events, so the frontend polls this endpoint while a campaign is "sending".
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return jsonResponse({ error: "campaign_id es requerido" }, 400);
    }

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, sendcraft_job_id, status")
      .eq("id", campaign_id)
      .maybeSingle();

    if (error || !campaign) {
      return jsonResponse({ error: "Campaña no encontrada" }, 404);
    }

    if (!campaign.sendcraft_job_id) {
      return jsonResponse({
        success: true,
        synced: false,
        message: "La campaña todavía no tiene un job de SendCraft asociado",
      });
    }

    const job = await sendcraftGetJob(campaign.sendcraft_job_id);
    await applyJobSnapshotToCampaign(supabase, campaign_id, job);

    return jsonResponse({ success: true, synced: true, job });
  } catch (error: any) {
    console.error("Error en campaign-notify-status:", error);
    return jsonResponse({ error: error.message || "Error interno del servidor" }, 500);
  }
});
