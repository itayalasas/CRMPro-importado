/*
  # Create Partner Commission Notification Queue System

  1. New Table
    - `partner_notification_queue`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, references invoices)
      - `partner_id` (uuid, references partners)
      - `notification_type` (text) - Type of notification (e.g., 'billing_notification')
      - `recipient_email` (text) - Email to send notification to
      - `payload` (jsonb) - Full notification payload
      - `status` (text) - pending, processing, sent, error
      - `attempts` (integer) - Number of send attempts
      - `last_error` (text) - Last error message if any
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz)
  
  2. Trigger
    - Automatically queue notifications when commission invoices are created
    - Populates the queue with all necessary partner and invoice data
  
  3. Security
    - Enable RLS on queue table
    - Add policies for authenticated users
*/

-- Create partner notification queue table
CREATE TABLE IF NOT EXISTS partner_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'billing_notification',
  recipient_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'error')),
  attempts integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partner_notification_queue_status ON partner_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_partner_notification_queue_invoice_id ON partner_notification_queue(invoice_id);
CREATE INDEX IF NOT EXISTS idx_partner_notification_queue_partner_id ON partner_notification_queue(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_notification_queue_created_at ON partner_notification_queue(created_at);

-- Enable RLS
ALTER TABLE partner_notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all access to partner notification queue"
  ON partner_notification_queue
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE partner_notification_queue;

-- Function to queue commission invoice notification
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
    
    RAISE NOTICE 'Commission invoice notification queued for partner % (invoice %)', 
                 v_partner.name, NEW.invoice_number;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error queuing commission invoice notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_send_commission_invoice_notification ON invoices;

-- Create new trigger
CREATE TRIGGER trigger_queue_commission_invoice_notification
  AFTER INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.is_commission_invoice = true AND NEW.partner_id IS NOT NULL)
  EXECUTE FUNCTION queue_commission_invoice_notification();

-- Add comment
COMMENT ON TABLE partner_notification_queue IS 
  'Queue for partner commission invoice notifications';

COMMENT ON FUNCTION queue_commission_invoice_notification() IS 
  'Queues email notification to partners when a commission invoice is created';
