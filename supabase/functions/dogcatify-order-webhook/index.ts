import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("📦 Webhook recibido:", JSON.stringify(payload, null, 2));

    const { event, data: orderData } = payload;

    if (!event || !orderData) {
      throw new Error("Payload inválido: falta 'event' o 'data'");
    }

    switch (event) {
      case "order.created": {
        console.log("🆕 Procesando order.created...");

        const customerData = orderData.customer;
        const fullAddress = `${customerData.calle} ${customerData.numero}, ${customerData.barrio}`;

        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("external_id", customerData.id)
          .maybeSingle();

        let clientId: string;

        if (existingClient) {
          clientId = existingClient.id;
          await supabase
            .from("clients")
            .update({
              contact_name: customerData.display_name,
              email: customerData.email,
              phone: customerData.phone,
              address: fullAddress,
              city: customerData.barrio,
              country: "Uruguay",
            })
            .eq("id", clientId);
          console.log("✓ Cliente actualizado");
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({
              external_id: customerData.id,
              contact_name: customerData.display_name,
              company_name: customerData.display_name,
              email: customerData.email,
              phone: customerData.phone,
              address: fullAddress,
              city: customerData.barrio,
              country: "Uruguay",
              status: "active",
              source: "dogcatify",
            })
            .select("id")
            .single();

          if (clientError) throw clientError;
          clientId = newClient.id;
          console.log("✓ Cliente creado");
        }

        const timestamp = Date.now();
        const orderNumber = `DC-${timestamp}`;

        const primaryPartner = orderData.partners.find((p: any) => p.is_primary) || orderData.partners[0];
        const orderCurrency = primaryPartner?.items?.[0]?.currency || "UYU";
        const partnerId = primaryPartner?.id || null;

        const totals = orderData.totals;
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            external_order_id: orderData.id,
            client_id: clientId,
            partner_id: partnerId,
            status: orderData.status || "pending",
            order_date: new Date().toISOString(),
            subtotal: totals.subtotal,
            tax_rate: totals.iva_rate,
            tax_amount: totals.iva_amount,
            discount_amount: 0,
            shipping_cost: totals.shipping_cost || 0,
            total_amount: totals.total_amount,
            currency: orderCurrency,
            payment_method: orderData.payment_method || "mercadopago",
            payment_status: orderData.payment_info?.payment_status || "pending",
            payment_id: orderData.payment_info?.payment_id || null,
            notes: orderData.booking_info ?
              `Pet: ${orderData.booking_info.pet_name}, Cita: ${orderData.booking_info.appointment_date} ${orderData.booking_info.appointment_time}` :
              "",
            metadata: orderData,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        console.log(`✓ Orden creada: ${orderNumber}`);

        for (const partner of orderData.partners) {
          for (const item of partner.items) {
            await supabase
              .from("order_items")
              .insert({
                order_id: order.id,
                product_name: item.name,
                description: item.name,
                quantity: item.quantity,
                unit_price: totals.subtotal / item.quantity,
                discount_percent: item.discount_percentage || 0,
                discount_amount: item.discount_amount || 0,
                line_total: totals.subtotal,
                total_price: totals.subtotal,
                currency: item.currency,
                item_type: item.type || "product",
              });
          }
        }

        console.log("✓ Items de orden insertados");
        console.log("ℹ️ Las facturas se generarán automáticamente cuando la orden cambie a 'confirmed'");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden procesada exitosamente",
            order: {
              id: order.id,
              order_number: orderNumber,
              total_partners: orderData.partners.length,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "order.updated":
      case "payment.updated": {
        console.log(`🔄 Procesando ${event}...`);

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (!existingOrder) {
          throw new Error(`Orden no encontrada: ${orderData.id}`);
        }

        await supabase
          .from("orders")
          .update({
            status: orderData.status,
            payment_status: orderData.payment_info?.payment_status,
            payment_id: orderData.payment_info?.payment_id,
            total_amount: orderData.totals?.total_amount,
            metadata: orderData,
          })
          .eq("id", existingOrder.id);

        console.log("✓ Orden actualizada");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden actualizada exitosamente",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "order.cancelled": {
        console.log("❌ Procesando order.cancelled...");

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (!existingOrder) {
          throw new Error(`Orden no encontrada: ${orderData.id}`);
        }

        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            metadata: orderData,
          })
          .eq("id", existingOrder.id);

        console.log("✓ Orden cancelada");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden cancelada exitosamente",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        console.log(`⚠️ Evento no manejado: ${event}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Evento ${event} recibido pero no procesado`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
