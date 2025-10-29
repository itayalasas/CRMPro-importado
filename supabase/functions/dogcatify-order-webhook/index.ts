import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Dogcatify-Signature, X-DogCatiFy-Signature",
};

interface DogCatifyCustomer {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  calle: string;
  numero: string;
  barrio: string;
  codigo_postal: string;
}

interface DogCatifyItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  subtotal: number;
  iva_rate: number;
  iva_amount: number;
  currency: string;
  currency_code_dgi: string;
}

interface DogCatifyPartner {
  id: string;
  business_name: string;
  email: string;
  phone: string;
  rut: string;
  calle: string;
  numero: string;
  barrio: string;
  codigo_postal: string;
  commission_percentage: number;
  is_primary: boolean;
  items: DogCatifyItem[];
  subtotal: number;
  iva_amount: number;
  commission_amount: number;
  partner_amount: number;
  total: number;
}

interface DogCatifyTotals {
  subtotal: number;
  iva_amount: number;
  iva_rate: number;
  iva_included_in_price: boolean;
  shipping_cost: number;
  shipping_iva_amount: number;
  total_commission: number;
  total_partner_amount: number;
  total_amount: number;
  total_partners: number;
}

interface ShippingInfo {
  shipping_cost: number;
  shipping_iva_amount: number;
  shipping_total: number;
  shipping_address: string;
}

interface PaymentInfo {
  payment_id: string | null;
  payment_status: string | null;
  payment_method: string;
  payment_preference_id: string | null;
}

interface DogCatifyOrder {
  id: string;
  status: string;
  order_type: string;
  payment_method: string;
  customer: DogCatifyCustomer;
  partners: DogCatifyPartner[];
  totals: DogCatifyTotals;
  shipping_info: ShippingInfo;
  payment_info: PaymentInfo;
  created_at: string;
  updated_at: string;
}

interface WebhookPayload {
  event: string;
  order_id: string;
  timestamp: string;
  data: DogCatifyOrder;
}

async function verifySignature(payloadString: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get("DOGCATIFY_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error("DOGCATIFY_WEBHOOK_SECRET no está configurado");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString);
    const key = encoder.encode(webhookSecret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expected = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log("Firma esperada:", expected);
    console.log("Firma recibida:", signature);
    console.log("¿Coinciden?", signature === expected);

    return signature === expected;
  } catch (error) {
    console.error("Error verificando firma:", error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
        message: "Este endpoint solo acepta peticiones POST"
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log("=== WEBHOOK DOGCATIFY RECIBIDO ===");

    let signature = req.headers.get("x-dogcatify-signature") || req.headers.get("X-DogCatiFy-Signature");

    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({
          error: "Invalid content type",
          message: "El Content-Type debe ser application/json"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bodyText = await req.text();
    console.log("Body recibido (primeros 500 chars):", bodyText.substring(0, 500));

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON",
          message: "El body no es un JSON válido"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Payload parseado exitosamente");

    const { event, order_id, data: orderData } = payload;

    if (!event || !order_id || !orderData) {
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          message: "El payload debe contener event, order_id y data"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Evento:", event);
    console.log("Order ID:", order_id);
    console.log("Total Partners:", orderData.partners?.length || 0);

    if (signature) {
      console.log("Verificando firma...");
      const isValid = await verifySignature(bodyText, signature);
      if (!isValid) {
        console.error("⚠️ Firma inválida - CONTINUANDO DE TODOS MODOS (modo debug)");
      } else {
        console.log("✅ Firma verificada correctamente");
      }
    } else {
      console.log("⚠️ No se recibió firma");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event) {
      case "order.created": {
        console.log("Procesando nueva orden con múltiples partners...");

        const customerData = orderData.customer;
        let clientId = null;

        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("external_id", customerData.id)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          console.log("✓ Cliente existente encontrado:", clientId);

          const fullAddress = `${customerData.calle} ${customerData.numero}, ${customerData.barrio}`;
          await supabase
            .from("clients")
            .update({
              contact_name: customerData.display_name,
              email: customerData.email,
              phone: customerData.phone,
              address: fullAddress,
              city: customerData.barrio,
              country: "Uruguay",
              updated_at: new Date().toISOString()
            })
            .eq("id", clientId);

          console.log("✓ Datos del cliente actualizados");
        } else {
          const fullAddress = `${customerData.calle} ${customerData.numero}, ${customerData.barrio}`;

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
              source: "dogcatify"
            })
            .select("id")
            .single();

          if (clientError) {
            console.error("Error creando cliente:", clientError);
            throw clientError;
          }

          clientId = newClient.id;
          console.log("✓ Cliente creado:", clientId);
        }

        const primaryPartner = orderData.partners.find(p => p.is_primary) || orderData.partners[0];
        const orderNumber = `DC-${Date.now()}`;
        const orderCurrency = primaryPartner.items[0]?.currency || 'UYU';

        console.log("Partner primario:", primaryPartner.business_name);
        console.log("Totales globales:", orderData.totals);

        let primaryPartnerId = null;
        const partnerData = primaryPartner;

        const { data: existingPartner } = await supabase
          .from("partners")
          .select("id")
          .eq("external_id", partnerData.id)
          .maybeSingle();

        if (existingPartner) {
          primaryPartnerId = existingPartner.id;
          console.log("✓ Partner primario existente:", primaryPartnerId);

          await supabase
            .from("partners")
            .update({
              name: partnerData.business_name,
              business_name: partnerData.business_name,
              rut: partnerData.rut,
              email: partnerData.email,
              phone: partnerData.phone,
              calle: partnerData.calle,
              numero: partnerData.numero,
              barrio: partnerData.barrio,
              postal_code: partnerData.codigo_postal,
              address: `${partnerData.calle} ${partnerData.numero}, ${partnerData.barrio}`,
              city: partnerData.barrio,
              country: "Uruguay",
              commission_percentage: partnerData.commission_percentage,
              updated_at: new Date().toISOString()
            })
            .eq("id", primaryPartnerId);

          console.log("✓ Partner primario actualizado");
        } else {
          const { data: newPartner, error: partnerError } = await supabase
            .from("partners")
            .insert({
              external_id: partnerData.id,
              name: partnerData.business_name,
              business_name: partnerData.business_name,
              rut: partnerData.rut,
              email: partnerData.email,
              phone: partnerData.phone,
              calle: partnerData.calle,
              numero: partnerData.numero,
              barrio: partnerData.barrio,
              postal_code: partnerData.codigo_postal,
              address: `${partnerData.calle} ${partnerData.numero}, ${partnerData.barrio}`,
              city: partnerData.barrio,
              country: "Uruguay",
              commission_percentage: partnerData.commission_percentage,
              is_active: true
            })
            .select("id")
            .single();

          if (partnerError) {
            console.error("Error creando partner primario:", partnerError);
          } else {
            primaryPartnerId = newPartner.id;
            console.log("✓ Partner primario creado:", primaryPartnerId);
          }
        }

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            partner_id: primaryPartnerId,
            status: orderData.status || 'pending',
            payment_status: orderData.payment_info?.payment_status || 'unpaid',
            payment_method: orderData.payment_method || 'mercadopago',
            total_amount: orderData.totals.total_amount,
            subtotal: orderData.totals.subtotal,
            tax_rate: orderData.totals.iva_rate,
            tax_amount: orderData.totals.iva_amount + orderData.totals.shipping_iva_amount,
            discount_amount: 0,
            shipping_cost: orderData.totals.shipping_cost,
            shipping_address: orderData.shipping_info.shipping_address,
            billing_address: orderData.shipping_info.shipping_address,
            currency: orderCurrency,
            external_order_id: orderData.id,
            external_partner_id: primaryPartner.id,
            commission_amount: orderData.totals.total_commission,
            commission_rate: primaryPartner.commission_percentage,
            notes: `Orden multi-partner desde DogCatify\nTipo: ${orderData.order_type}\nMétodo de pago: ${orderData.payment_method}\nTotal Partners: ${orderData.totals.total_partners}\nTotal Comisión: $${orderData.totals.total_commission}\nTotal Partner: $${orderData.totals.total_partner_amount}`,
            metadata: orderData,
            order_date: new Date(orderData.created_at).toISOString().split('T')[0]
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }

        console.log("✓ Orden creada:", orderNumber, "ID:", order.id);

        for (const partner of orderData.partners) {
          for (const item of partner.items) {
            const itemUnitPriceWithoutTax = item.subtotal / item.quantity;

            await supabase
              .from("order_items")
              .insert({
                order_id: order.id,
                product_name: item.name,
                description: `${item.name} (Partner: ${partner.business_name})`,
                quantity: item.quantity,
                unit_price: parseFloat(itemUnitPriceWithoutTax.toFixed(2)),
                discount_percent: 0,
                line_total: parseFloat(item.subtotal.toFixed(2)),
                total_price: parseFloat((item.subtotal + item.iva_amount).toFixed(2)),
                currency: item.currency
              });
          }
        }

        console.log("✓ Items de orden insertados");

        const createdInvoices = [];

        for (const partner of orderData.partners) {
          console.log(`\n📄 Procesando factura para partner: ${partner.business_name}`);

          let partnerIdForInvoice = primaryPartnerId;

          if (partner.id !== primaryPartner.id) {
            const { data: otherPartner } = await supabase
              .from("partners")
              .select("id")
              .eq("external_id", partner.id)
              .maybeSingle();

            if (otherPartner) {
              partnerIdForInvoice = otherPartner.id;
            } else {
              const { data: newOtherPartner } = await supabase
                .from("partners")
                .insert({
                  external_id: partner.id,
                  name: partner.business_name,
                  business_name: partner.business_name,
                  rut: partner.rut,
                  email: partner.email,
                  phone: partner.phone,
                  calle: partner.calle,
                  numero: partner.numero,
                  barrio: partner.barrio,
                  postal_code: partner.codigo_postal,
                  address: `${partner.calle} ${partner.numero}, ${partner.barrio}`,
                  city: partner.barrio,
                  country: "Uruguay",
                  commission_percentage: partner.commission_percentage,
                  is_active: true
                })
                .select("id")
                .single();

              if (newOtherPartner) {
                partnerIdForInvoice = newOtherPartner.id;
              }
            }
          }

          const invoiceNumber = `INV-${Date.now()}-${partner.id.substring(0, 8)}`;
          const issueDate = new Date().toISOString().split('T')[0];
          const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const { data: invoice, error: invoiceError } = await supabase
            .from("invoices")
            .insert({
              invoice_number: invoiceNumber,
              client_id: clientId,
              order_id: order.id,
              partner_id: partnerIdForInvoice,
              issue_date: issueDate,
              due_date: dueDate,
              status: 'draft',
              subtotal: partner.subtotal,
              tax_amount: partner.iva_amount,
              discount_amount: 0,
              total_amount: partner.total,
              commission_amount: partner.commission_amount,
              commission_rate: partner.commission_percentage,
              notes: `Factura para partner: ${partner.business_name}\nComisión: ${partner.commission_percentage}%\nMonto comisión: $${partner.commission_amount}\nMonto partner: $${partner.partner_amount}`,
              terms: `Pago a 30 días\nComisión: ${partner.commission_percentage}%`
            })
            .select()
            .single();

          if (invoiceError) {
            console.error(`Error creando factura para ${partner.business_name}:`, invoiceError);
            continue;
          }

          console.log(`✓ Factura creada: ${invoiceNumber}`);

          for (const item of partner.items) {
            const itemUnitPriceWithoutTax = item.subtotal / item.quantity;

            await supabase
              .from("invoice_items")
              .insert({
                invoice_id: invoice.id,
                description: item.name,
                quantity: item.quantity,
                unit_price: parseFloat(itemUnitPriceWithoutTax.toFixed(2)),
                tax_rate: item.iva_rate,
                discount: 0,
                subtotal: parseFloat(item.subtotal.toFixed(2))
              });
          }

          console.log(`✓ Items de factura insertados para ${partner.business_name}`);
          createdInvoices.push({
            partner: partner.business_name,
            invoice_number: invoiceNumber,
            amount: partner.total,
            commission: partner.commission_amount,
            commission_percentage: partner.commission_percentage
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden procesada exitosamente con múltiples partners",
            order: {
              id: order.id,
              order_number: orderNumber,
              total_partners: orderData.partners.length
            },
            invoices: createdInvoices
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "order.updated":
      case "payment.updated": {
        console.log(`Procesando ${event}...`);

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id, order_number, status, payment_status")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (!existingOrder) {
          console.error(`No se encontró orden con external_order_id: ${orderData.id}`);
          return new Response(
            JSON.stringify({
              error: "Order not found",
              message: `No se encontró una orden con external_order_id: ${orderData.id}`
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const updateData: any = {
          status: orderData.status || existingOrder.status,
          updated_at: new Date().toISOString()
        };

        if (orderData.payment_info) {
          updateData.payment_status = orderData.payment_info.payment_status || existingOrder.payment_status;

          if (orderData.payment_info.payment_id) {
            updateData.payment_id = orderData.payment_info.payment_id;
          }

          if (orderData.payment_info.payment_method) {
            updateData.payment_method = orderData.payment_info.payment_method;
          }

          console.log(`Payment info: status=${updateData.payment_status}, id=${orderData.payment_info.payment_id}`);
        }

        if (orderData.totals && orderData.totals.total_amount) {
          updateData.total_amount = orderData.totals.total_amount;
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", existingOrder.id);

        if (updateError) {
          console.error("Error actualizando orden:", updateError);
          throw updateError;
        }

        console.log(`✓ Orden actualizada: ${existingOrder.order_number}`);
        console.log(`  Estado anterior: ${existingOrder.status} → ${updateData.status}`);
        console.log(`  Pago anterior: ${existingOrder.payment_status} → ${updateData.payment_status}`);

        if (updateData.payment_status === 'paid' || updateData.payment_status === 'confirmed') {
          console.log("🎉 Pago confirmado! La orden puede cambiar a 'confirmed' automáticamente");
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `${event === 'payment.updated' ? 'Pago' : 'Orden'} actualizado exitosamente`,
            order: {
              id: existingOrder.id,
              order_number: existingOrder.order_number,
              previous_status: existingOrder.status,
              new_status: updateData.status,
              previous_payment_status: existingOrder.payment_status,
              new_payment_status: updateData.payment_status
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        console.log("Evento no manejado:", event);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Evento ${event} recibido pero no procesado`
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error procesando webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Error desconocido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
