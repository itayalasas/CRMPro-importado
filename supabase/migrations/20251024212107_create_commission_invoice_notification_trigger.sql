/*
  # Create Commission Invoice Notification Trigger

  1. Purpose
    - Automatically send email notification to partners when commission invoices are created
    - Calls the send-order-communication edge function with partner billing details
  
  2. Trigger Details
    - Fires AFTER INSERT on invoices table
    - Only for commission invoices (is_commission_invoice = true)
    - Sends notification with invoice details and partner information
  
  3. Notification Data
    - template_name: "billing_notification"
    - recipient_email: partner's email
    - invoice_id: the commission invoice ID
    - data: comprehensive invoice and partner details including:
      - partner_name, invoice_number, issue_date
      - period info, currency, amounts, commission details
      - status, due_date, payment_method
*/

-- Function to send commission invoice notification
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
    v_notification_payload := jsonb_build_object(
      'template_name', 'billing_notification',
      'recipient_email', v_partner.email,
      'invoice_id', NEW.id,
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
    
    -- Get the send-order-communication function URL
    v_api_url := current_setting('app.supabase_url', true) || '/functions/v1/send-order-communication';
    
    -- Make async HTTP request to edge function
    PERFORM
      net.http_post(
        url := v_api_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := v_notification_payload
      );
    
    RAISE NOTICE 'Commission invoice notification queued for partner % (invoice %)', 
                 v_partner.name, NEW.invoice_number;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error sending commission invoice notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_send_commission_invoice_notification ON invoices;

CREATE TRIGGER trigger_send_commission_invoice_notification
  AFTER INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.is_commission_invoice = true AND NEW.partner_id IS NOT NULL)
  EXECUTE FUNCTION send_commission_invoice_notification();

-- Add comment
COMMENT ON FUNCTION send_commission_invoice_notification() IS 
  'Sends email notification to partners when a commission invoice is created';
