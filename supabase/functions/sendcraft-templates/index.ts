import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SENDCRAFT_BASE_URL, getSendcraftApiKey } from "../_shared/sendcraft.ts";

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

// Thin authenticated proxy to SendCraft's template endpoints:
//   GET  /list-templates   -> list templates already created in the SendCraft dashboard
//   POST /create-template  -> create a new email template from the CRM
// Both need the server-side SENDCRAFT_API_KEY, so this can't be called directly from the browser.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const type = url.searchParams.get("type");
      const target = new URL(`${SENDCRAFT_BASE_URL}/list-templates`);
      if (type) target.searchParams.set("type", type);

      const res = await fetch(target.toString(), {
        headers: { "x-api-key": getSendcraftApiKey() },
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const payload = await req.json();

      if (!payload?.name || !payload?.html_content) {
        return jsonResponse({ error: "name y html_content son requeridos" }, 400);
      }

      const res = await fetch(`${SENDCRAFT_BASE_URL}/create-template`, {
        method: "POST",
        headers: {
          "x-api-key": getSendcraftApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ template_type: "email", ...payload }),
      });

      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return jsonResponse({ error: "Método no soportado" }, 405);
  } catch (error: any) {
    console.error("Error en sendcraft-templates:", error);
    return jsonResponse({ error: error.message || "Error interno del servidor" }, 500);
  }
});
