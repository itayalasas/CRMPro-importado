/*
  # Copiar partner_id y commission_amount al generar facturas automáticas
  
  1. Problema
    - La función generate_invoice_from_order() no copia partner_id ni commission_amount
    - Las facturas se crean sin partner_id, imposibilitando facturar comisiones
    - commission_amount queda en 0 aunque la orden tenga comisiones
    
  2. Solución
    - Agregar partner_id al INSERT de la factura
    - Agregar commission_amount al INSERT de la factura
    - Esto permitirá que las facturas pendientes aparezcan en el módulo de comisiones
    
  3. Impacto
    - Nuevas facturas tendrán partner_id correcto
    - Nuevas facturas tendrán commission_amount correcto
    - Podrán ser facturadas a los partners
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
BEGIN
  -- Solo procesar si el estado cambió a 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Verificar si ya existe una factura para esta orden
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = NEW.id) THEN
      RAISE NOTICE 'Ya existe una factura para la orden %', NEW.id;
      RETURN NEW;
    END IF;

    -- Obtener datos completos de la orden
    SELECT * INTO v_order_record FROM orders WHERE id = NEW.id;

    -- Generar número de factura único
    v_invoice_number := 'INV-' || EXTRACT(EPOCH FROM NOW())::bigint;

    -- Calcular totales de los items
    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(total_price), 0)
    INTO v_subtotal, v_total_amount
    FROM order_items 
    WHERE order_id = NEW.id;

    -- Usar los valores de la orden si están disponibles
    IF v_order_record.subtotal IS NOT NULL THEN
      v_subtotal := v_order_record.subtotal;
    END IF;

    IF v_order_record.tax_amount IS NOT NULL THEN
      v_tax_amount := v_order_record.tax_amount;
    ELSE
      -- Calcular tax si no existe (usando tax_rate si está disponible)
      IF v_order_record.tax_rate > 0 THEN
        v_tax_amount := v_subtotal * (v_order_record.tax_rate / 100);
      END IF;
    END IF;

    IF v_order_record.discount_amount IS NOT NULL THEN
      v_discount_amount := v_order_record.discount_amount;
    END IF;

    IF v_order_record.total_amount IS NOT NULL THEN
      v_total_amount := v_order_record.total_amount;
    ELSE
      -- Calcular total si no existe
      v_total_amount := v_subtotal + v_tax_amount - v_discount_amount;
    END IF;

    -- Crear la factura en estado 'draft'
    -- IMPORTANTE: Ahora incluye partner_id y commission_amount
    INSERT INTO invoices (
      invoice_number,
      order_id,
      client_id,
      partner_id,              -- ✅ NUEVO: Copiar partner_id de la orden
      issue_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      commission_amount,        -- ✅ NUEVO: Copiar commission_amount de la orden
      status,
      notes,
      terms,
      created_by,
      created_at
    ) VALUES (
      v_invoice_number,
      NEW.id,
      NEW.client_id,
      NEW.partner_id,           -- ✅ NUEVO: partner_id de la orden
      CURRENT_DATE,
      COALESCE(NEW.due_date, CURRENT_DATE + INTERVAL '30 days'),
      v_subtotal,
      v_tax_amount,
      v_discount_amount,
      v_total_amount,
      COALESCE(NEW.commission_amount, 0),  -- ✅ NUEVO: commission_amount de la orden
      'draft',
      COALESCE(NEW.notes, '') || E'\n\nFactura generada automáticamente desde orden ' || NEW.order_number,
      COALESCE(NEW.payment_terms, 'Net 30'),
      NEW.created_by,
      NOW()
    ) RETURNING id INTO v_invoice_id;

    RAISE NOTICE '✅ Factura creada: % para orden % (Partner: %, Comisión: %)', 
                 v_invoice_number, NEW.order_number, NEW.partner_id, COALESCE(NEW.commission_amount, 0);

    -- Copiar los items de la orden a la factura
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
        COALESCE(v_order_item.product_name || ': ' || v_order_item.description, v_order_item.description, 'Item'),
        v_order_item.quantity,
        v_order_item.unit_price,
        COALESCE(v_order_record.tax_rate, 0),
        COALESCE(v_order_item.discount_percent, 0),
        v_order_item.line_total,
        NOW()
      );
    END LOOP;

    RAISE NOTICE '✅ Items de factura copiados: % items', (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = v_invoice_id);

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentario actualizado
COMMENT ON FUNCTION generate_invoice_from_order() IS 
  '[FIXED] Now copies partner_id and commission_amount from order to invoice';

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Función actualizada correctamente';
  RAISE NOTICE '✅ Ahora copia partner_id de la orden';
  RAISE NOTICE '✅ Ahora copia commission_amount de la orden';
  RAISE NOTICE '✅ Las nuevas facturas tendrán datos completos';
  RAISE NOTICE '========================================';
END $$;
