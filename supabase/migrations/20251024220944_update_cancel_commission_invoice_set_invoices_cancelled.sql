/*
  # Update cancel_commission_invoice to cancel associated invoices
  
  1. Changes
    - Modificar función cancel_commission_invoice para cambiar el estado de facturas asociadas a 'cancelled'
    - Las facturas individuales asociadas también deben ser canceladas cuando se anula la factura de comisión
  
  2. Behavior
    - Marca la factura de comisión como anulada (cancelled_at, cancelled_by, cancellation_reason)
    - Cambia el estado de todas las facturas asociadas a 'cancelled'
    - Libera las facturas (commission_invoiced = false, commission_invoice_id = NULL)
*/

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
    status = 'cancelled'
  WHERE id = p_commission_invoice_id;

  -- Cancelar todas las facturas asociadas y liberarlas
  UPDATE invoices
  SET 
    status = 'cancelled',
    commission_invoiced = false,
    commission_invoice_id = NULL,
    cancelled_at = now(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = 'Factura de comisión anulada: ' || COALESCE(p_reason, 'Sin motivo especificado')
  WHERE commission_invoice_id = p_commission_invoice_id;

  GET DIAGNOSTICS v_affected_invoices = ROW_COUNT;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'commission_invoice_id', p_commission_invoice_id,
    'cancelled_invoices_count', v_affected_invoices,
    'partner_id', v_commission_invoice.partner_id,
    'cancelled_at', now()
  );

  RAISE NOTICE 'Factura de comisión % anulada. % facturas canceladas.', p_commission_invoice_id, v_affected_invoices;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_commission_invoice IS 'Anula una factura de comisión y cancela todas las facturas asociadas';
