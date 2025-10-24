/*
  # Fix cancel_commission_invoice - Keep invoices active for regeneration
  
  1. Changes
    - Al anular una factura de comisión, las facturas asociadas NO se cancelan
    - Solo se liberan para poder volver a generar una nueva factura de comisión
    - Las facturas mantienen su estado original (validated, sent, etc.)
  
  2. Behavior
    - Marca la factura de comisión como anulada
    - Libera las facturas asociadas (commission_invoiced = false, commission_invoice_id = NULL)
    - Las facturas vuelven a aparecer disponibles en la lista para generar una nueva factura
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

  -- Liberar todas las facturas asociadas (NO cancelarlas)
  -- Solo se desvinculan para poder volver a generar una factura de comisión
  UPDATE invoices
  SET 
    commission_invoiced = false,
    commission_invoice_id = NULL
  WHERE commission_invoice_id = p_commission_invoice_id
    AND is_commission_invoice = false;

  GET DIAGNOSTICS v_affected_invoices = ROW_COUNT;

  -- Preparar resultado
  v_result := json_build_object(
    'success', true,
    'commission_invoice_id', p_commission_invoice_id,
    'freed_invoices_count', v_affected_invoices,
    'partner_id', v_commission_invoice.partner_id,
    'cancelled_at', now()
  );

  RAISE NOTICE 'Factura de comisión % anulada. % facturas liberadas para regeneración.', p_commission_invoice_id, v_affected_invoices;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_commission_invoice IS 'Anula una factura de comisión y libera las facturas asociadas para poder regenerarlas';
