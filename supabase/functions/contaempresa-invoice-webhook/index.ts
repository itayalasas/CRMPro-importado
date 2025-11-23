import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceWebhookPayload {
  order_number: string;
  invoice_number: string;
  numero_cfe?: string;
  serie_cfe?: string;
  tipo_cfe?: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  dgi_estado?: string;
  dgi_codigo_autorizacion?: string;
  dgi_mensaje?: string;
  observations?: string;
  payment_status?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    subtotal: number;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: InvoiceWebhookPayload = await req.json();

    console.log('Received invoice webhook from ContaEmpresa:', payload);

    const { order_number, payment_status, items, ...invoiceData } = payload;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, client_id')
      .eq('order_number', order_number)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order not found:', order_number, orderError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found',
          order_number
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existingInvoice) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          ...invoiceData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingInvoice.id);

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update invoice',
            details: updateError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (items && items.length > 0) {
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', existingInvoice.id);

        const itemsToInsert = items.map(item => ({
          invoice_id: existingInvoice.id,
          ...item
        }));

        await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
      }

      console.log('Invoice updated successfully:', existingInvoice.id);
    } else {
      const { data: newInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          order_id: order.id,
          client_id: order.client_id,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating invoice:', insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create invoice',
            details: insertError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (items && items.length > 0 && newInvoice) {
        const itemsToInsert = items.map(item => ({
          invoice_id: newInvoice.id,
          ...item
        }));

        await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
      }

      console.log('Invoice created successfully:', newInvoice?.id);
    }

    if (payment_status) {
      await supabase
        .from('orders')
        .update({
          payment_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice processed successfully',
        order_number
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});