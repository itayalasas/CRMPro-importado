import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SENDCRAFT_BASE_URL, getSendcraftApiKey } from "../_shared/sendcraft.ts";

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

// Thin authenticated proxy to SendCraft's POST /send-email-with-pdf. The Sales module
// (quotes/orders) builds the full request payload client-side in src/lib/quoteCommunication.ts
// (no secrets involved, just data shaping) and posts it here unchanged; this function only
// adds the x-api-key server-side so it never reaches the browser, per SendCraft's own docs
// ("nunca expongas tu API key en código del lado del cliente").
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    if (!payload?.recipient_email || !payload?.email?.template_name) {
      return jsonResponse(
        { success: false, error: "recipient_email y email.template_name son requeridos" },
        400
      );
    }

    const res = await fetch(`${SENDCRAFT_BASE_URL}/send-email-with-pdf`, {
      method: "POST",
      headers: {
        "x-api-key": getSendcraftApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error en send-quote-communication:", error);
    return jsonResponse({ success: false, error: error.message || "Error interno del servidor" }, 500);
  }
});
