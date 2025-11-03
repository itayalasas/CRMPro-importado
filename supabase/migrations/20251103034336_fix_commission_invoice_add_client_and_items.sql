/*
  # Fix Commission Invoice Generation - Add Client and Items

  1. Summary
    - Updates the regenerate_commission_invoice function to include:
      - client_id based on partner data
      - invoice_items for detailed line items

  2. Changes
    - Modified regenerate_commission_invoice function to:
      - Get or create client based on partner
      - Add invoice items with "Comisión por ventas" description

  3. Notes
    - This ensures commission invoices have complete fiscal data
    - Items will appear in invoice PDFs and DGI validation
*/

-- Drop existing function
DROP FUNCTION IF EXISTS regenerate_commission_invoice(uuid, text, numeric);

-- Recreate function with client_id and invoice_items support
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
  v_client_id uuid;
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

  -- Obtener o crear cliente basado en el partner
  SELECT id INTO v_client_id
  FROM clients
  WHERE rut = v_partner.rut
  LIMIT 1;

  IF v_client_id IS NULL THEN
    -- Crear cliente automáticamente
    INSERT INTO clients (
      name,
      company_name,
      rut,
      email,
      phone,
      address,
      city,
      postal_code,
      country,
      is_active
    ) VALUES (
      v_partner.name,
      COALESCE(v_partner.company_name, v_partner.name),
      v_partner.rut,
      v_partner.email,
      v_partner.phone,
      v_partner.address,
      v_partner.city,
      v_partner.postal_code,
      COALESCE(v_partner.country, 'Uruguay'),
      true
    ) RETURNING id INTO v_client_id;
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
    v_client_id,
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

  -- Crear item de factura
  INSERT INTO invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    discount,
    subtotal
  ) VALUES (
    v_new_invoice_id,
    'Comisión por ventas',
    1,
    v_commission_total,
    p_tax_rate,
    0,
    v_commission_total
  );

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

-- Comentario
COMMENT ON FUNCTION regenerate_commission_invoice IS 'Regenera una factura de comisión anulada con client_id e invoice_items';
