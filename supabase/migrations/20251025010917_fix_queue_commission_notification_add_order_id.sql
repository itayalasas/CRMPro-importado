/*
  # Corregir función queue_commission_invoice_notification - Agregar order_id
  
  1. Problema
    - La función actual solo incluye invoice_id en el payload
    - Falta el campo order_id necesario para coincidir con el PDF
    
  2. Solución
    - Agregar 'order_id', NEW.order_id al payload
    - Ahora el payload tendrá AMBOS: invoice_id y order_id
    
  3. Resultado
    - Email: order_id = invoice.order_id ✅
    - PDF: order_id = invoice.order_id ✅
    - Ambos coinciden ✅
*/

CREATE OR REPLACE FUNCTION queue_commission_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_partner RECORD;
  v_currency_code TEXT;
  v_payment_method TEXT;
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
    
    -- Validate partner has email
    IF v_partner.email IS NULL OR v_partner.email = '' THEN
      RAISE WARNING 'Partner % does not have an email address', v_partner.name;
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
    -- CRÍTICO: Incluir AMBOS invoice_id Y order_id
    v_notification_payload := jsonb_build_object(
      'template_name', 'billing_notification',
      'recipient_email', v_partner.email,
      'invoice_id', NEW.id,        -- Para referencia interna
      'order_id', NEW.order_id,    -- Para enviar al API (debe coincidir con PDF)
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
    
    -- Insert into notification queue
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
    );
    
    RAISE NOTICE '✅ Commission notification queued: invoice %, order %', 
                 NEW.invoice_number, NEW.order_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Error queuing commission notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentario actualizado
COMMENT ON FUNCTION queue_commission_invoice_notification() IS 
  '[FIXED] Now includes BOTH invoice_id and order_id in payload for consistency';

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Función actualizada correctamente';
  RAISE NOTICE '✅ Ahora incluye order_id en el payload';
  RAISE NOTICE '✅ Email y PDF usarán el mismo order_id';
  RAISE NOTICE '========================================';
END $$;
