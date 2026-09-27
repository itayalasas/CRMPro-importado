import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendcraftNotify } from "../_shared/sendcraft.ts";

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

// Thin authenticated proxy so a CRM agent can notify a client by email, via SendCraft,
// that a chat conversation was started for them from the CRM. Unlike send-quote-communication
// this has no PDF attachment, so it goes through SendCraft's plain /notify endpoint
// (sendcraftNotify) instead of /send-email-with-pdf.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { recipient_email, template_name, data } = payload || {};

    if (!recipient_email || !template_name) {
      return jsonResponse(
        { success: false, error: "recipient_email y template_name son requeridos" },
        400
      );
    }

    const job = await sendcraftNotify({
      type: "email",
      template_name,
      recipients: [{ email: recipient_email, data: data || {} }],
    });

    const result = job.results?.[0];
    const success = !result || result.status === "sent";

    return jsonResponse({
      success,
      job,
      error: result?.status === "failed" ? result.error : undefined,
    });
  } catch (error: any) {
    console.error("Error en send-chat-invite:", error);
    return jsonResponse({ success: false, error: error.message || "Error interno del servidor" }, 500);
  }
});
