/*
  # Sistema de Quincenas de Pago y Gestión de Facturas de Comisión
  
  1. Nueva Tabla
    - `payment_periods` - Gestiona quincenas de pago
      - `id` (uuid, primary key)
      - `name` (text) - Ej: "Octubre 2025 - Primera Quincena"
      - `start_date` (date) - Fecha inicio del período
      - `end_date` (date) - Fecha fin del período
      - `status` (text) - pending, closed, paid
      - `created_at`, `updated_at`
  
  2. Mejoras a Tabla Existente
    - Agregar `payment_period_id` a `invoices` (para facturas de comisión)
    - Agregar `cancelled_at` y `cancelled_by` para anulaciones
    - Agregar `replaced_by_invoice_id` para tracking de regeneraciones
    - Cambiar `commission_billed` por `commission_invoiced` (más consistente)
  
  3. Funciones
    - Función para anular factura de comisión y liberar facturas asociadas
    - Función para regenerar factura de comisión
  
  4. Seguridad
    - RLS policies para payment_periods
*/

-- Crear tabla de períodos de pago (quincenas)
CREATE TABLE IF NOT EXISTS payment_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  
  CONSTRAINT payment_periods_status_check CHECK (status IN ('pending', 'closed', 'paid'))
);

-- Índices para payment_periods
CREATE INDEX IF NOT EXISTS idx_payment_periods_dates ON payment_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payment_periods_status ON payment_periods(status);

-- Habilitar RLS
ALTER TABLE payment_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies para payment_periods
CREATE POLICY "Permitir lectura de períodos"
  ON payment_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserción de períodos"
  ON payment_periods FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualización de períodos"
  ON payment_periods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Agregar columnas a invoices si no existen
DO $$
BEGIN
  -- Agregar payment_period_id (para facturas de comisión)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_period_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_period_id uuid REFERENCES payment_periods(id);
    CREATE INDEX IF NOT EXISTS idx_invoices_payment_period ON invoices(payment_period_id);
  END IF;

  -- Agregar campos para anulación
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cancelled_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cancellation_reason text;
  END IF;

  -- Agregar tracking de reemplazo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'replaced_by_invoice_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN replaced_by_invoice_id uuid REFERENCES invoices(id);
  END IF;

  -- Cambiar commission_billed por commission_invoiced (más consistente)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'commission_invoiced'
  ) THEN
    ALTER TABLE invoices ADD COLUMN commission_invoiced boolean DEFAULT false;
    -- Copiar datos si existe commission_billed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name = 'commission_billed'
    ) THEN
      UPDATE invoices SET commission_invoiced = commission_billed WHERE commission_billed IS NOT NULL;
    END IF;
  END IF;

  -- Agregar índice para facturas canceladas
  CREATE INDEX IF NOT EXISTS idx_invoices_cancelled ON invoices(cancelled_at) WHERE cancelled_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_invoices_commission_invoiced ON invoices(commission_invoiced) WHERE is_commission_invoice = false;
END $$;

-- Función para anular factura de comisión y liberar facturas asociadas
CREATE OR REPLACE FUNCTION cancel_commission_invoice(
  p_commission_invoice_id uuid,
  p_cancelled_by text,
  p_reason text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_commission_invoice record;
  v_affected_invoices integer;
  v_result json;
BEGIN
  -- Obtener la factura de comisión
  SELECT * INTO v_commission_invoice
  FROM invoices
  WHERE id = p_commission_invoice_id
    AND is_commission_invoice = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura de comisión no encontrada';
  END IF;

  IF v_commission_invoice.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta factura ya está anulada';
  END IF;

  -- Marcar la factura de comisión como anulada
  UPDATE invoices
  SET 
    cancelled_at = now(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason,
    updated_at = now()
  WHERE id = p_commission_invoice_id;

  -- Liberar todas las facturas asociadas (marcar como no facturadas)
  UPDATE invoices
  SET 
    commission_invoiced = false,
    commission_invoice_id = NULL,
    updated_at = now()
  WHERE commission_invoice_id = p_commission_invoice_id;

  GET DIAGNOSTICS v_affected_invoices = ROW_COUNT;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'commission_invoice_id', p_commission_invoice_id,
    'freed_invoices_count', v_affected_invoices,
    'partner_id', v_commission_invoice.partner_id,
    'cancelled_at', now()
  );

  RAISE NOTICE 'Factura de comisión % anulada. % facturas liberadas.', p_commission_invoice_id, v_affected_invoices;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Función para regenerar factura de comisión
CREATE OR REPLACE FUNCTION regenerate_commission_invoice(
  p_old_commission_invoice_id uuid,
  p_generated_by text,
  p_tax_rate numeric DEFAULT 22.00
)
RETURNS uuid AS $$
DECLARE
  v_old_invoice record;
  v_new_invoice_id uuid;
  v_partner record;
  v_commission_total numeric;
  v_tax_amount numeric;
  v_total_with_tax numeric;
  v_invoice_count integer;
  v_invoice_number text;
BEGIN
  -- Obtener la factura de comisión antigua
  SELECT * INTO v_old_invoice
  FROM invoices
  WHERE id = p_old_commission_invoice_id
    AND is_commission_invoice = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura de comisión no encontrada';
  END IF;

  -- Verificar que la factura esté anulada
  IF v_old_invoice.cancelled_at IS NULL THEN
    RAISE EXCEPTION 'Solo se pueden regenerar facturas anuladas';
  END IF;

  -- Obtener datos del partner
  SELECT * INTO v_partner
  FROM partners
  WHERE id = v_old_invoice.partner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner no encontrado';
  END IF;

  -- Calcular totales de facturas pendientes del partner
  SELECT 
    COUNT(*) as invoice_count,
    COALESCE(SUM(commission_amount), 0) as commission_total
  INTO v_invoice_count, v_commission_total
  FROM invoices
  WHERE partner_id = v_old_invoice.partner_id
    AND commission_invoiced = false
    AND is_commission_invoice = false
    AND status IN (
      SELECT code FROM invoice_statuses WHERE is_active = true
    );

  IF v_invoice_count = 0 THEN
    RAISE EXCEPTION 'No hay facturas pendientes para este partner';
  END IF;

  -- Calcular IVA
  v_tax_amount := v_commission_total * (p_tax_rate / 100);
  v_total_with_tax := v_commission_total + v_tax_amount;

  -- Generar número de factura
  v_invoice_number := 'COM-' || EXTRACT(EPOCH FROM NOW())::bigint;

  -- Crear nueva factura de comisión
  INSERT INTO invoices (
    invoice_number,
    client_id,
    partner_id,
    payment_period_id,
    issue_date,
    due_date,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    status,
    is_commission_invoice,
    commission_iva_rate,
    notes,
    created_at,
    created_by
  ) VALUES (
    v_invoice_number,
    v_old_invoice.client_id,
    v_old_invoice.partner_id,
    v_old_invoice.payment_period_id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '15 days',
    v_commission_total,
    v_tax_amount,
    0,
    v_total_with_tax,
    'draft',
    true,
    p_tax_rate,
    format('Factura de comisiones regenerada - %s facturas incluidas. Reemplaza factura: %s', v_invoice_count, v_old_invoice.invoice_number),
    now(),
    p_generated_by
  ) RETURNING id INTO v_new_invoice_id;

  -- Actualizar la factura antigua para referenciar la nueva
  UPDATE invoices
  SET replaced_by_invoice_id = v_new_invoice_id
  WHERE id = p_old_commission_invoice_id;

  -- Marcar las facturas como facturadas con la nueva factura de comisión
  UPDATE invoices
  SET 
    commission_invoiced = true,
    commission_invoice_id = v_new_invoice_id,
    updated_at = now()
  WHERE partner_id = v_old_invoice.partner_id
    AND commission_invoiced = false
    AND is_commission_invoice = false
    AND status IN (
      SELECT code FROM invoice_statuses WHERE is_active = true
    );

  RAISE NOTICE 'Factura de comisión regenerada: % (reemplaza a %)', v_new_invoice_id, p_old_commission_invoice_id;

  RETURN v_new_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE payment_periods IS 'Gestión de quincenas y períodos de pago para comisiones';
COMMENT ON FUNCTION cancel_commission_invoice IS 'Anula una factura de comisión y libera todas las facturas asociadas';
COMMENT ON FUNCTION regenerate_commission_invoice IS 'Regenera una factura de comisión anulada con datos actualizados';
