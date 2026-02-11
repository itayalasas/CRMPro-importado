import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Integration-Key",
};

type WebchatSettings = {
  integration_key?: string;
  integration_header?: string;
  api_key?: string;
};

type BotProxyRequest = {
  message?: unknown;
};

const getHeader = (headers: Headers, ...names: string[]): string | null => {
  for (const name of names) {
    const value = headers.get(name);
    if (value && value.trim().length > 0) return value;
  }
  return null;
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

  const botApiUrl = Deno.env.get("BOT_API_URL");
  if (!botApiUrl) {
    return new Response(JSON.stringify({ error: "BOT_API_URL no configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botIntegrationKey = Deno.env.get("BOT_INTEGRATION_KEY") || "";
  const botIntegrationHeader = Deno.env.get("BOT_INTEGRATION_HEADER") || "X-Integration-Key";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const providedIntegrationKey = getHeader(
      req.headers,
      "x-integration-key",
      "X-Integration-Key",
      "apikey",
      "Apikey",
      "x-api-key",
      "X-API-KEY"
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

    const settings = (settingsRow?.setting_value || {}) as WebchatSettings;
    const expectedIntegrationKey = settings.integration_key || settings.api_key || "";

    if (!expectedIntegrationKey || !providedIntegrationKey || providedIntegrationKey !== expectedIntegrationKey) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyText = await req.text();
    let parsed: BotProxyRequest = {};
    try {
      parsed = bodyText ? (JSON.parse(bodyText) as BotProxyRequest) : {};
    } catch {
      parsed = {};
    }

    const messageText = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (!messageText) {
      return new Response(JSON.stringify({ error: "message requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    try {
      const upstreamResponse = await fetch(botApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(botIntegrationKey ? { [botIntegrationHeader]: botIntegrationKey } : {}),
        },
        body: JSON.stringify({ message: messageText }),
        ...(controller ? { signal: controller.signal } : {}),
      });

      const responseText = await upstreamResponse.text().catch(() => "");
      const contentType = upstreamResponse.headers.get("content-type") || "application/json";

      return new Response(responseText || JSON.stringify({ error: "Respuesta vacía del bot" }), {
        status: upstreamResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
        },
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
    return new Response(JSON.stringify({ error: "Error en proxy", message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
