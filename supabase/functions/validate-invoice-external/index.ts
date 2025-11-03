import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ValidateInvoiceRequest {
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

    const { invoice_id, config_id }: ValidateInvoiceRequest = await req.json();

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
      .eq("config_type", "validation")
      .order("priority", { ascending: false });

    if (config_id) {
      configQuery = configQuery.eq("id", config_id);
    }

    console.log("🔍 Buscando configuraciones de validación DGI (ordenadas por prioridad)...");

    const { data: configs, error: configError } = await configQuery;

    console.log("📋 Configuraciones encontradas:", {
      error: configError,
      configsFound: configs?.length || 0,
      configs: configs?.map(c => ({
        id: c.id,
        name: c.name,
        config_type: c.config_type,
        priority: c.priority
      }))
    });

    if (configError || !configs || configs.length === 0) {
      console.error("❌ No se encontró configuración de DGI:", configError);
      return new Response(
        JSON.stringify({ error: "No hay configuración de DGI activa disponible" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const config = configs[0];
    console.log("✅ Configuración seleccionada (mayor prioridad):", {
      id: config.id,
      name: config.name,
      config_type: config.config_type,
      priority: config.priority,
      api_url: config.api_url
    });

    // Obtener tax_rate de la orden si existe
    const defaultTaxRate = invoice.orders?.tax_rate || invoice.commission_iva_rate || 22;

    // Construir items con IVA incluido
    let items = [];

    // Si es factura de comisiones y no hay order_items, crear item sintético
    if (invoice.is_commission_invoice && (!orderItems || orderItems.length === 0)) {
      const subtotal = parseFloat(String(invoice.subtotal || 0));
      const ivaPorcentaje = parseFloat(String(invoice.commission_iva_rate || defaultTaxRate));
      const iva = parseFloat(String(invoice.tax_amount || 0));
      const total = parseFloat(String(invoice.total_amount || 0));

      items.push({
        descripcion: invoice.notes || "Comisión por ventas",
        cantidad: 1,
        precio_unitario: Math.round(subtotal * 100) / 100,
        iva_porcentaje: ivaPorcentaje,
        subtotal: Math.round(subtotal * 100) / 100,
        iva: Math.round(iva * 100) / 100,
        total: Math.round(total * 100) / 100
      });
    } else {
      // Procesar order_items normales
      items = (orderItems || []).map((item: any, index: number) => {
        const cantidad = parseFloat(String(item.quantity || 1));
        const precioUnitario = parseFloat(String(item.unit_price || 0));
        const ivaPorcentaje = parseFloat(String(item.tax_rate || defaultTaxRate));

        // Buscar metadata del item en invoice.orders.metadata
        let metaItem: any = null;
        let originalPrice = precioUnitario;
        let discountAmount = 0;
        let discountPercentage = 0;

        if (invoice.orders?.metadata?.partners) {
          for (const partner of invoice.orders.metadata.partners) {
            if (partner.items) {
              const foundMetaItem = partner.items.find((mi: any) =>
                mi.name === (item.product_name || item.description)
              );
              if (foundMetaItem) {
                metaItem = foundMetaItem;
                originalPrice = parseFloat(String(metaItem.original_price || metaItem.price_original || precioUnitario));
                discountAmount = parseFloat(String(metaItem.discount_amount || 0));
                discountPercentage = parseFloat(String(metaItem.discount_percentage || 0));
                break;
              }
            }
          }
        }

        const subtotalItem = cantidad * precioUnitario;
        const ivaItem = subtotalItem * (ivaPorcentaje / 100);
        const totalItem = subtotalItem + ivaItem;

        return {
          numero: index + 1,
          descripcion: item.product_name || item.description || "",
          cantidad: cantidad,
          precio_unitario: Math.round(precioUnitario * 100) / 100,
          original_price: Math.round(originalPrice * 100) / 100,
          descuento_porcentaje: discountPercentage,
          descuento: Math.round(discountAmount * 100) / 100,
          iva_porcentaje: ivaPorcentaje,
          line_subtotal: Math.round(subtotalItem * 100) / 100,
          iva: Math.round(ivaItem * 100) / 100,
          total: Math.round(totalItem * 100) / 100
        };
      });
    }

    // Si hay costo de envío, agregarlo como un item adicional
    const shippingCost = parseFloat(String(invoice.orders?.shipping_cost || 0));
    if (shippingCost > 0) {
      const shippingTaxRate = 22; // IVA estándar para envíos en Uruguay
      const shippingSubtotal = shippingCost;
      const shippingIva = shippingSubtotal * (shippingTaxRate / 100);
      const shippingTotal = shippingSubtotal + shippingIva;

      items.push({
        numero: items.length + 1,
        descripcion: "Costo de Envío",
        cantidad: 1,
        precio_unitario: Math.round(shippingSubtotal * 100) / 100,
        original_price: Math.round(shippingSubtotal * 100) / 100,
        descuento_porcentaje: 0,
        descuento: 0,
        iva_porcentaje: shippingTaxRate,
        line_subtotal: Math.round(shippingSubtotal * 100) / 100,
        iva: Math.round(shippingIva * 100) / 100,
        total: Math.round(shippingTotal * 100) / 100
      });
    }

    // Calcular totales basados en la suma de los items
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
    const calculatedIva = items.reduce((sum, item) => sum + item.iva, 0);
    const calculatedTotal = items.reduce((sum, item) => sum + item.total, 0);

    console.log("=== CÁLCULOS DE FACTURA ===");
    console.log("Items:", items.length);
    console.log("Subtotal calculado:", calculatedSubtotal);
    console.log("IVA calculado:", calculatedIva);
    console.log("Total calculado:", calculatedTotal);
    console.log("Shipping cost:", shippingCost);
    console.log("Invoice total_amount:", invoice.total_amount);
    console.log("Items detalle:", JSON.stringify(items, null, 2));

    // Determinar datos del emisor (empresa que emite la factura)
    const emisorRut = "211234560018"; // RUT fijo de la empresa emisora
    const emisorRazonSocial = "Empresa Demo S.A."; // Razón social fija

    // Determinar moneda
    const moneda = invoice.orders?.currency || "UYU";

    // Determinar receptor (cliente o partner)
    let receptorRut = "";
    let receptorRazonSocial = "";

    if (invoice.is_commission_invoice && invoice.partners) {
      // Para facturas de comisiones, el receptor es el partner
      receptorRut = invoice.partners.rut || "";
      receptorRazonSocial = invoice.partners.company_name || invoice.partners.name || "";
    } else if (invoice.clients) {
      // Para facturas normales, el receptor es el cliente
      receptorRut = invoice.clients.tax_id || "";
      receptorRazonSocial = invoice.clients.company_name || `${invoice.clients.first_name || ""} ${invoice.clients.last_name || ""}`.trim();
    }

    const requestPayload = {
      numero_cfe: invoice.invoice_number,
      serie: "A",
      rut_emisor: emisorRut,
      razon_social_emisor: emisorRazonSocial,
      rut_receptor: receptorRut,
      razon_social_receptor: receptorRazonSocial,
      fecha_emision: invoice.issue_date || new Date().toISOString().split('T')[0],
      moneda: moneda,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      iva: Math.round(calculatedIva * 100) / 100,
      total: Math.round(calculatedTotal * 100) / 100,
      items: items,
      datos_adicionales: {
        observaciones: invoice.notes || (invoice.is_commission_invoice ? "Factura de comisiones" : "Venta al público"),
        forma_pago: invoice.orders?.payment_method || "Contado"
      }
    };

    console.log("Request payload (e-Ticket format):", JSON.stringify(requestPayload, null, 2));

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

    let responsePayload: any = null;
    let statusCode = 0;
    let status = "pending";
    let errorMessage: string | null = null;
    let validationResult = "pending";
    let externalReference: string | null = null;
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

          const responseMapping = config.response_mapping as any;

          if (responseMapping.approved) {
            const approvedValue = getNestedValue({ response: responsePayload }, responseMapping.approved);
            validationResult = approvedValue ? "approved" : "rejected";
          }

          if (responseMapping.reference) {
            externalReference = getNestedValue({ response: responsePayload }, responseMapping.reference);
          }

          if (responseMapping.message) {
            errorMessage = getNestedValue({ response: responsePayload }, responseMapping.message);
          }

          break;
        } else {
          errorMessage = responsePayload.message || `HTTP ${statusCode}`;
          status = "error";
          validationResult = "error";

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
          validationResult = "error";
        } else {
          status = "error";
          errorMessage = error.message;
          validationResult = "error";
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

    const { data: logEntry, error: logError } = await supabase
      .from("external_invoice_validation_log")
      .insert({
        invoice_id: invoice_id,
        config_id: config.id,
        request_payload: requestPayload,
        response_payload: responsePayload,
        status_code: statusCode,
        status: status,
        error_message: errorMessage,
        validation_result: validationResult,
        external_reference: externalReference,
        duration_ms: duration,
        retry_count: retryCount,
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging validation:", logError);
    }

    if (validationResult === "approved") {
      const responseMapping = config.response_mapping as any;
      const updateData: any = {
        status: "validated",
        validated_at: new Date().toISOString(),
        validation_response: responsePayload,
        pending_validation: false
      };

      // Mantener el invoice_number original como numero_cfe
      // El DGI devuelve un numero_cfe con sufijo que no queremos usar
      updateData.numero_cfe = invoice.invoice_number;

      if (responseMapping.serie_cfe) {
        const serieCFE = getNestedValue({ response: responsePayload }, responseMapping.serie_cfe);
        if (serieCFE) updateData.serie_cfe = serieCFE;
      }

      if (responseMapping.tipo_cfe) {
        const tipoCFE = getNestedValue({ response: responsePayload }, responseMapping.tipo_cfe);
        if (tipoCFE) updateData.tipo_cfe = tipoCFE;
      }

      if (responseMapping.cae) {
        const cae = getNestedValue({ response: responsePayload }, responseMapping.cae);
        if (cae) updateData.cae = cae;
      }

      if (responseMapping.vencimiento_cae) {
        const vencimientoCAE = getNestedValue({ response: responsePayload }, responseMapping.vencimiento_cae);
        if (vencimientoCAE) updateData.vencimiento_cae = vencimientoCAE;
      }

      if (responseMapping.qr_code) {
        const qrCode = getNestedValue({ response: responsePayload }, responseMapping.qr_code);
        if (qrCode) updateData.qr_code = qrCode;
      }

      if (responseMapping.dgi_estado) {
        const dgiEstado = getNestedValue({ response: responsePayload }, responseMapping.dgi_estado);
        if (dgiEstado) updateData.dgi_estado = dgiEstado;
      }

      if (responseMapping.dgi_codigo_autorizacion) {
        const dgiCodigoAutorizacion = getNestedValue({ response: responsePayload }, responseMapping.dgi_codigo_autorizacion);
        if (dgiCodigoAutorizacion) updateData.dgi_codigo_autorizacion = dgiCodigoAutorizacion;
      }

      if (responseMapping.dgi_mensaje) {
        const dgiMensaje = getNestedValue({ response: responsePayload }, responseMapping.dgi_mensaje);
        if (dgiMensaje) updateData.dgi_mensaje = dgiMensaje;
      }

      if (responseMapping.dgi_id_efactura) {
        const dgiIdEfactura = getNestedValue({ response: responsePayload }, responseMapping.dgi_id_efactura);
        if (dgiIdEfactura) updateData.dgi_id_efactura = dgiIdEfactura;
      }

      if (responseMapping.dgi_fecha_validacion) {
        const dgiFechaValidacion = getNestedValue({ response: responsePayload }, responseMapping.dgi_fecha_validacion);
        if (dgiFechaValidacion) updateData.dgi_fecha_validacion = dgiFechaValidacion;
      }

      console.log("Actualizando factura con datos de validación:", updateData);

      await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoice_id);
    } else if (validationResult === "rejected" || validationResult === "error") {
      console.log("Factura rechazada o con error, actualizando estado a 'refused'");

      await supabase
        .from("invoices")
        .update({
          status: "refused",
          validation_response: responsePayload,
          pending_validation: false,
          dgi_estado: "rechazado",
          dgi_mensaje: errorMessage || "Error en validación",
          observations: `Error DGI: ${errorMessage || "Error en validación"}`
        })
        .eq("id", invoice_id);
    }

    return new Response(
      JSON.stringify({
        success: status === "success",
        validation_result: validationResult,
        external_reference: externalReference,
        status: status,
        status_code: statusCode,
        message: errorMessage || "Validación completada",
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
    console.error("Error validating invoice:", error);
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
