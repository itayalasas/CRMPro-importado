/*
  # Fix cancel_commission_invoice function - Remove updated_at references
  
  1. Changes
    - Actualizar función cancel_commission_invoice para no usar updated_at
    - Actualizar función regenerate_commission_invoice para no usar updated_at
  
  La tabla invoices no tiene columna updated_at, por lo que se remueven esas referencias.
*/

-- Recrear función cancel_commission_invoice sin updated_at
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
    cancellation_reason = p_reason
  WHERE id = p_commission_invoice_id;

  -- Liberar todas las facturas asociadas (marcar como no facturadas)
  UPDATE invoices
  SET 
    commission_invoiced = false,
    commission_invoice_id = NULL
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

-- Recrear función regenerate_commission_invoice sin updated_at
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
    commission_invoice_id = v_new_invoice_id
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

COMMENT ON FUNCTION cancel_commission_invoice IS 'Anula una factura de comisión y libera todas las facturas asociadas (sin updated_at)';
COMMENT ON FUNCTION regenerate_commission_invoice IS 'Regenera una factura de comisión anulada con datos actualizados (sin updated_at)';
