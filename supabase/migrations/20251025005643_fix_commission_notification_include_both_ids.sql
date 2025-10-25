/*
  # Corregir Notificación de Comisión - Incluir order_id Y invoice_id
  
  1. Problema Identificado
    - El payload solo tiene invoice_id, pero NO tiene order_id
    - send-order-communication usa: order_id || invoice_id
    - Como no hay order_id, usa invoice_id como order_id
    - Esto causa que el order_id sea diferente al PDF
    
  2. Solución
    - Incluir AMBOS campos en el payload:
      - invoice_id: para referencia interna
      - order_id: para enviar al API (debe coincidir con el PDF)
    
  3. Resultado
    - Email: order_id = invoice.order_id
    - PDF: order_id = invoice.order_id
    - Ambos coinciden ✅
*/

-- Actualizar función para incluir ambos IDs en el payload
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
    -- IMPORTANTE: Incluir AMBOS invoice_id Y order_id
    v_notification_payload := jsonb_build_object(
      'template_name', 'billing_notification',
      'recipient_email', v_partner.email,
      'invoice_id', NEW.id,  -- Para referencia interna
      'order_id', NEW.order_id,  -- Para enviar al API (debe coincidir con PDF)
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
    
    -- Insert into partner_notification_queue
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
    
    RAISE NOTICE '✅ Commission invoice notification queued: invoice %, order %', 
                 NEW.invoice_number, NEW.order_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error sending commission invoice notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION send_commission_invoice_notification() IS 
  '[FIXED v2] Includes BOTH invoice_id and order_id in payload - order_id matches PDF generation';

-- Log
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Trigger actualizado: ahora incluye ambos invoice_id Y order_id';
  RAISE NOTICE '✅ order_id = invoice.order_id (coincide con PDF)';
  RAISE NOTICE '✅ invoice_id = invoice.id (referencia interna)';
  RAISE NOTICE '========================================';
END $$;
