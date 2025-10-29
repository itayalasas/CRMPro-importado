/*
  # Incluir Costo de Envío en Generación Automática de Facturas

  1. Problema
    - Las facturas no incluyen el shipping_cost de la orden
    - Orden: $3,030 (subtotal $2,073.77 + envío $500 + IVA $456.23)
    - Factura: $2,530 (solo productos, falta envío)

  2. Solución
    - Agregar shipping_cost al cálculo del subtotal de la factura
    - Incluir shipping_cost como un item separado en invoice_items
    - Asegurar que el total_amount de la factura coincida con el de la orden

  3. Notas
    - El shipping_cost ya tiene IVA incluido en la orden
    - Se agrega como item "Envío" en la factura
    - El total de la factura debe ser = orden.total_amount
*/

CREATE OR REPLACE FUNCTION generate_invoice_from_order()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_order_record record;
  v_order_item record;
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_discount_amount numeric := 0;
  v_total_amount numeric := 0;
  v_shipping_cost numeric := 0;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = NEW.id) THEN
      RAISE NOTICE 'Ya existe una factura para la orden %', NEW.id;
      RETURN NEW;
    END IF;

    SELECT * INTO v_order_record FROM orders WHERE id = NEW.id;

    -- Generar número de factura único (sin sufijo)
    v_invoice_number := 'INV-' || EXTRACT(EPOCH FROM NOW())::bigint;

    -- Calcular totales de los items (sin envío)
    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(total_price), 0)
    INTO v_subtotal, v_total_amount
    FROM order_items 
    WHERE order_id = NEW.id;

    -- Obtener costo de envío
    v_shipping_cost := COALESCE(v_order_record.shipping_cost, 0);

    -- Usar los valores de la orden
    IF v_order_record.subtotal IS NOT NULL THEN
      v_subtotal := v_order_record.subtotal;
    END IF;

    -- Agregar shipping al subtotal
    IF v_shipping_cost > 0 THEN
      v_subtotal := v_subtotal + v_shipping_cost;
    END IF;

    IF v_order_record.tax_amount IS NOT NULL THEN
      v_tax_amount := v_order_record.tax_amount;
    ELSE
      IF v_order_record.tax_rate > 0 THEN
        v_tax_amount := v_subtotal * (v_order_record.tax_rate / 100);
      END IF;
    END IF;

    IF v_order_record.discount_amount IS NOT NULL THEN
      v_discount_amount := v_order_record.discount_amount;
    END IF;

    -- El total debe ser igual al de la orden
    IF v_order_record.total_amount IS NOT NULL THEN
      v_total_amount := v_order_record.total_amount;
    ELSE
      v_total_amount := v_subtotal + v_tax_amount - v_discount_amount;
    END IF;

    INSERT INTO invoices (
      invoice_number,
      order_id,
      client_id,
      partner_id,
      issue_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      commission_amount,
      commission_rate,
      status,
      notes,
      terms,
      created_by,
      created_at
    ) VALUES (
      v_invoice_number,
      NEW.id,
      NEW.client_id,
      NEW.partner_id,
      CURRENT_DATE,
      COALESCE(NEW.due_date, CURRENT_DATE + INTERVAL '30 days'),
      v_subtotal,
      v_tax_amount,
      v_discount_amount,
      v_total_amount,
      COALESCE(NEW.commission_amount, 0),
      COALESCE(NEW.commission_rate, 0),
      'draft',
      COALESCE(NEW.notes, '') || E'\n\nFactura generada automáticamente desde orden ' || NEW.order_number,
      COALESCE(NEW.payment_terms, 'Net 30'),
      NEW.created_by,
      NOW()
    ) RETURNING id INTO v_invoice_id;

    RAISE NOTICE 'Factura creada: % para orden % (Total: %, Envío: %)', 
      v_invoice_number, NEW.order_number, v_total_amount, v_shipping_cost;

    -- Copiar items de productos
    FOR v_order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      INSERT INTO invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        tax_rate,
        discount,
        subtotal,
        created_at
      ) VALUES (
        v_invoice_id,
        COALESCE(v_order_item.description, v_order_item.product_name, 'Item'),
        v_order_item.quantity,
        v_order_item.unit_price,
        COALESCE(v_order_record.tax_rate, 0),
        COALESCE(v_order_item.discount_percent, 0),
        v_order_item.line_total,
        NOW()
      );
    END LOOP;

    -- Agregar item de envío si existe
    IF v_shipping_cost > 0 THEN
      INSERT INTO invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        tax_rate,
        discount,
        subtotal,
        created_at
      ) VALUES (
        v_invoice_id,
        'Envío',
        1,
        v_shipping_cost,
        COALESCE(v_order_record.tax_rate, 0),
        0,
        v_shipping_cost,
        NOW()
      );
      
      RAISE NOTICE 'Item de envío agregado: $%', v_shipping_cost;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_from_order() IS 
  'Genera factura automática desde orden confirmada incluyendo shipping_cost como item separado';
