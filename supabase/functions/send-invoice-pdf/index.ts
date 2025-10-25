import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendPDFRequest {
  invoice_id: string;
  config_id?: string;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoice_id, config_id }: SendPDFRequest = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (*),
        orders (*),
        partners (*)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Factura no encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", invoice.order_id);

    let configQuery = supabase
      .from("external_invoice_api_config")
      .select("*")
      .eq("is_active", true)
      .eq("config_type", "pdf_generation");

    if (config_id) {
      configQuery = configQuery.eq("id", config_id);
    }

    const { data: configs, error: configError } = await configQuery;

    if (configError || !configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay configuración de PDF activa disponible" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const config = configs[0];

    const defaultTaxRate = invoice.orders?.tax_rate || 22;

    const items = (orderItems || []).map((item: any, index: number) => {
      const cantidad = parseFloat(String(item.quantity || 1));
      const precioUnitario = parseFloat(String(item.unit_price || 0));
      const descuentoPorcentaje = parseFloat(String(item.discount_percent || 0));
      const ivaPorcentaje = parseFloat(String(item.tax_rate || defaultTaxRate));

      // Calcular descuento en valor
      const descuentoValor = precioUnitario * (descuentoPorcentaje / 100);
      const precioConDescuento = precioUnitario - descuentoValor;

      // Calcular subtotal (precio con descuento * cantidad)
      const lineSubtotal = precioConDescuento * cantidad;

      // Calcular IVA sobre el subtotal
      const ivaItem = lineSubtotal * (ivaPorcentaje / 100);

      // Total del item
      const totalItem = lineSubtotal + ivaItem;

      return {
        numero: index + 1,
        descripcion: item.product_name || item.description || "",
        cantidad: cantidad,
        precio_unitario: Math.round(precioUnitario * 100) / 100,
        descuento: Math.round(descuentoValor * cantidad * 100) / 100,
        line_subtotal: Math.round(lineSubtotal * 100) / 100,
        iva_porcentaje: ivaPorcentaje,
        iva: Math.round(ivaItem * 100) / 100,
        total: Math.round(totalItem * 100) / 100
      };
    });

    const shippingCost = parseFloat(String(invoice.orders?.shipping_cost || 0));
    if (shippingCost > 0) {
      const shippingTaxRate = 22;
      const shippingSubtotal = shippingCost;
      const shippingIva = shippingSubtotal * (shippingTaxRate / 100);
      const shippingTotal = shippingSubtotal + shippingIva;

      items.push({
        numero: items.length + 1,
        descripcion: "Costo de Envío",
        cantidad: 1,
        precio_unitario: Math.round(shippingSubtotal * 100) / 100,
        descuento: 0,
        line_subtotal: Math.round(shippingSubtotal * 100) / 100,
        iva_porcentaje: shippingTaxRate,
        iva: Math.round(shippingIva * 100) / 100,
        total: Math.round(shippingTotal * 100) / 100
      });
    }

    const calculatedSubtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const calculatedIva = items.reduce((sum, item) => sum + item.iva, 0);
    const calculatedTotal = items.reduce((sum, item) => sum + item.total, 0);

    const recipientEmail = invoice.clients?.email || invoice.partners?.email || "";

    // Determinar los datos del emisor (issuer)
    // Si es factura de comisión, usar datos del partner
    // Si es factura normal, usar datos de configuración general o valores por defecto
    let issuerData: any = {
      numero_cfe: invoice.invoice_number,
      serie: invoice.serie_cfe || "A",
      fecha_emision: invoice.issue_date || new Date().toISOString().split('T')[0],
      moneda: invoice.currency || "UYU",
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      iva: Math.round(calculatedIva * 100) / 100,
      total: Math.round(calculatedTotal * 100) / 100
    };

    // Si es factura de comisión, usar datos del partner
    if (invoice.is_commission_invoice && invoice.partners) {
      issuerData = {
        ...issuerData,
        rut: invoice.partners.rut || "211234560018",
        razon_social: invoice.partners.company_name || invoice.partners.name || "Partner",
        direccion: invoice.partners.address || "",
        ciudad: invoice.partners.city || "",
        telefono: invoice.partners.phone || "",
        email: invoice.partners.email || ""
      };
    } else {
      // Para facturas normales, usar datos de configuración general
      const { data: generalSettings } = await supabase
        .from("general_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      issuerData = {
        ...issuerData,
        rut: generalSettings?.rut || invoice.rut_emisor || "211234560018",
        razon_social: generalSettings?.company_name || invoice.company_name || "Empresa Demo S.A.",
        direccion: generalSettings?.address || "",
        ciudad: generalSettings?.city || "Montevideo",
        telefono: generalSettings?.phone || "",
        email: generalSettings?.email || ""
      };
    }

    const requestPayload = {
      pdf_template_name: "invoice_email_service",
      recipient_email: recipientEmail,
      order_id: invoice.order_id,
      wait_for_invoice: false,
      data: {
        items: items,
        issuer: issuerData,
        totals: {
          subtotal: Math.round(calculatedSubtotal * 100) / 100,
          tax_label: `IVA (${defaultTaxRate}%)`,
          tax_amount: Math.round(calculatedIva * 100) / 100,
          grand_total: Math.round(calculatedTotal * 100) / 100
        },
        response_payload: {
          success: invoice.dgi_estado ? true : false,
          approved: invoice.dgi_estado === 'aprobado',
          reference: invoice.numero_cfe || invoice.invoice_number || "",
          numero_cfe: invoice.numero_cfe || invoice.invoice_number || "",
          serie_cfe: invoice.serie_cfe || "A",
          tipo_cfe: invoice.tipo_cfe || "101",
          cae: invoice.cae || "",
          vencimiento_cae: invoice.vencimiento_cae || "",
          qr_code: invoice.qr_code || "",
          dgi_estado: invoice.dgi_estado || "pendiente",
          dgi_codigo_autorizacion: invoice.dgi_codigo_autorizacion || "",
          dgi_mensaje: invoice.dgi_mensaje || (invoice.dgi_estado === 'aprobado' ? "Comprobante aprobado correctamente" : "Pendiente de validación"),
          dgi_id_efactura: invoice.dgi_id_efactura || "",
          dgi_fecha_validacion: invoice.dgi_fecha_validacion || new Date().toISOString()
        },
        datos_adicionales: {
          observaciones: invoice.notes || invoice.observations || "",
          forma_pago: invoice.orders?.payment_method || "mercadopago"
        }
      }
    };

    console.log("Request payload (PDF Generation format):", JSON.stringify(requestPayload, null, 2));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = String(value);
      }
    }

    const authCreds = config.auth_credentials as any;

    if (config.auth_type === "basic" && authCreds.username && authCreds.password) {
      const encoded = btoa(`${authCreds.username}:${authCreds.password}`);
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (config.auth_type === "bearer" && authCreds.token) {
      headers["Authorization"] = `Bearer ${authCreds.token}`;
    } else if (config.auth_type === "api_key" && authCreds.key && authCreds.value) {
      headers[authCreds.key] = authCreds.value;
    }

    console.log("Request headers:", JSON.stringify(headers, null, 2));

    let responsePayload: any = null;
    let statusCode = 0;
    let status = "pending";
    let errorMessage: string | null = null;
    let pdfId: string | null = null;
    let retryCount = 0;

    const maxRetries = config.retry_attempts || 3;
    const timeout = config.timeout || 30000;

    while (retryCount <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(config.api_url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        statusCode = response.status;
        responsePayload = await response.json();

        console.log("Response:", JSON.stringify(responsePayload, null, 2));

        if (response.ok) {
          status = "success";

          if (responsePayload.success === true) {
            pdfId = responsePayload.data?.pdf_id || null;
          } else {
            status = "error";
            errorMessage = responsePayload.message || "PDF generation failed";
          }

          break;
        } else {
          errorMessage = responsePayload.message || `HTTP ${statusCode}`;
          status = "error";

          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
        }

        break;
      } catch (error: any) {
        if (error.name === "AbortError") {
          status = "timeout";
          errorMessage = "Request timeout";
        } else {
          status = "error";
          errorMessage = error.message;
        }

        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }

        break;
      }
    }

    const duration = Date.now() - startTime;

    await supabase
      .from("invoice_pdf_queue")
      .update({
        status: status === "success" ? "sent" : "failed",
        last_error: errorMessage,
        pdf_id: pdfId,
        processed_at: new Date().toISOString(),
        attempts: retryCount + 1
      })
      .eq("invoice_id", invoice_id)
      .eq("config_id", config.id);

    const { data: logEntry } = await supabase
      .from("external_invoice_validation_log")
      .insert({
        invoice_id: invoice_id,
        config_id: config.id,
        request_payload: requestPayload,
        response_payload: responsePayload,
        status_code: statusCode,
        status: status,
        error_message: errorMessage,
        validation_result: status === "success" ? "approved" : "error",
        external_reference: pdfId,
        duration_ms: duration,
        retry_count: retryCount,
      })
      .select()
      .single();

    if (status === "success") {
      await supabase
        .from("invoices")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      console.log(`✅ Factura ${invoice_id} marcada como 'sent'`);
    } else {
      await supabase
        .from("invoices")
        .update({
          status: "sent-error",
          observations: `Error al enviar PDF: ${errorMessage || "Error desconocido"}`
        })
        .eq("id", invoice_id);

      console.log(`❌ Factura ${invoice_id} marcada como 'sent-error': ${errorMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: status === "success",
        pdf_id: pdfId,
        status: status,
        status_code: statusCode,
        message: errorMessage || "PDF enviado exitosamente",
        duration_ms: duration,
        retry_count: retryCount,
        log_id: logEntry?.id,
        request_payload: requestPayload,
        response_payload: responsePayload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending PDF:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});