/*
  # Arreglar Notificación de Factura de Comisión - Usar order_id Correcto

  1. Problema Identificado
    - Al crear factura de comisión, se envía invoice_id en lugar de order_id
    - Cuando DGI aprueba, se envía invoice.order_id
    - Esto causa inconsistencia: dos order_id diferentes para la misma factura
    
  2. Solución
    - Actualizar trigger para enviar order_id en lugar de invoice_id
    - Las facturas de comisión ya tienen un order_id asociado
    - Usar ese order_id garantiza consistencia en ambos flujos
    
  3. Flujo Correcto
    - Crear factura de comisión → envía order_id = invoice.order_id
    - DGI aprueba → envía order_id = invoice.order_id
    - Ambos usan el mismo order_id ✅
*/

-- Actualizar función para usar order_id en lugar de invoice_id
CREATE OR REPLACE FUNCTION send_commission_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_partner RECORD;
  v_currency_code TEXT;
  v_payment_method TEXT;
  v_api_url TEXT;
  v_notification_payload JSONB;
BEGIN
  -- Only process commission invoices
  IF NEW.is_commission_invoice = true AND NEW.partner_id IS NOT NULL THEN
    
    -- Get partner details
    SELECT * INTO v_partner
    FROM partners
    WHERE id = NEW.partner_id;
    
    IF v_partner.id IS NULL THEN
      RAISE WARNING 'Partner not found for commission invoice %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Get currency code (default to UYU if not found)
    SELECT code INTO v_currency_code
    FROM currencies
    WHERE is_default = true
    LIMIT 1;
    
    IF v_currency_code IS NULL THEN
      v_currency_code := 'UYU';
    END IF;
    
    -- Get payment method (default to "Transferencia bancaria - BROU")
    SELECT name INTO v_payment_method
    FROM payment_methods
    WHERE code = 'transfer'
    LIMIT 1;
    
    IF v_payment_method IS NULL THEN
      v_payment_method := 'Transferencia bancaria - BROU';
    END IF;
    
    -- Build notification payload
    -- IMPORTANTE: Usar order_id en lugar de invoice_id para consistencia
    v_notification_payload := jsonb_build_object(
      'template_name', 'billing_notification',
      'recipient_email', v_partner.email,
      'order_id', NEW.order_id,  -- CAMBIADO: era invoice_id, ahora es order_id
      'wait_for_invoice', true,
      'data', jsonb_build_object(
        'partner_name', v_partner.name,
        'invoice_number', NEW.invoice_number,
        'issue_date', NEW.issue_date,
        'period_start', COALESCE(NEW.issue_date::text, to_char(now() - interval '15 days', 'YYYY-MM-DD')),
        'period_end', COALESCE(NEW.issue_date::text, to_char(now(), 'YYYY-MM-DD')),
        'currency', v_currency_code,
        'services_total', COALESCE(NEW.subtotal, 0)::text,
        'commission_rate', COALESCE(NEW.commission_iva_rate, 22)::text || '%',
        'commission_amount', COALESCE(NEW.tax_amount, 0)::text,
        'adjustments', COALESCE(NEW.notes, 'Sin ajustes'),
        'net_payable', COALESCE(NEW.total_amount, 0)::text,
        'status', 'Emitida',
        'due_date', COALESCE(NEW.due_date::text, (now() + interval '30 days')::date::text),
        'payment_method', v_payment_method,
        'invoice_url', 'https://app.dogcatify.com/facturas/' || NEW.invoice_number
      )
    );
    
    -- Insert into partner_notification_queue instead of direct HTTP call
    INSERT INTO partner_notification_queue (
      invoice_id,
      partner_id,
      notification_type,
      recipient_email,
      payload,
      status
    ) VALUES (
      NEW.id,
      NEW.partner_id,
      'billing_notification',
      v_partner.email,
      v_notification_payload,
      'pending'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Commission invoice notification queued for partner % (invoice %, order %)', 
                 v_partner.name, NEW.invoice_number, NEW.order_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error sending commission invoice notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION send_commission_invoice_notification() IS 
  '[FIXED] Sends email notification to partners when a commission invoice is created - uses order_id for consistency';
