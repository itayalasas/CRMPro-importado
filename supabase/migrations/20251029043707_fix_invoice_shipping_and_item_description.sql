/*
  # Arreglar shipping_cost y descripción de items en facturas

  1. Problemas
    - El trigger generate_invoice_from_order() no copia shipping_cost
    - La descripción de items concatena product_name + description
    - Esto puede duplicar información si description ya contiene el nombre

  2. Solución
    - Agregar shipping_cost a la tabla invoices si no existe
    - Actualizar trigger para copiar shipping_cost de orders
    - Cambiar descripción de items para usar solo description (sin concatenar)

  3. Notas
    - shipping_cost viene de shipping_info.shipping_cost en el webhook
    - description ahora solo contiene el nombre del producto (sin partner)
*/

-- Agregar columna shipping_cost a invoices si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE invoices ADD COLUMN shipping_cost DECIMAL(12,2) DEFAULT 0;
    COMMENT ON COLUMN invoices.shipping_cost IS 'Shipping cost from order';
    RAISE NOTICE 'Columna shipping_cost agregada a invoices';
  ELSE
    RAISE NOTICE 'Columna shipping_cost ya existe en invoices';
  END IF;
END $$;

-- Actualizar función para incluir shipping_cost y arreglar descripción
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

    v_invoice_number := 'INV-' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || substring(NEW.id::text, 1, 8);

    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(total_price), 0)
    INTO v_subtotal, v_total_amount
    FROM order_items 
    WHERE order_id = NEW.id;

    IF v_order_record.subtotal IS NOT NULL THEN
      v_subtotal := v_order_record.subtotal;
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

    -- Obtener shipping_cost
    v_shipping_cost := COALESCE(v_order_record.shipping_cost, 0);

    IF v_order_record.total_amount IS NOT NULL THEN
      v_total_amount := v_order_record.total_amount;
    ELSE
      v_total_amount := v_subtotal + v_tax_amount - v_discount_amount + v_shipping_cost;
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
      shipping_cost,
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
      v_shipping_cost,
      v_total_amount,
      COALESCE(NEW.commission_amount, 0),
      COALESCE(NEW.commission_rate, 0),
      'draft',
      COALESCE(NEW.notes, '') || E'\n\nFactura generada automáticamente desde orden ' || NEW.order_number,
      COALESCE(NEW.payment_terms, 'Net 30'),
      NEW.created_by,
      NOW()
    ) RETURNING id INTO v_invoice_id;

    RAISE NOTICE 'Factura creada: % para orden % (shipping: $%)', v_invoice_number, NEW.order_number, v_shipping_cost;

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

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_from_order() IS 
  'Generates invoice from order with shipping_cost and clean item descriptions';
