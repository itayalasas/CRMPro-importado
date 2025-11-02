/*
  # Agregar item de ajuste a facturas con diferencia

  1. Problema
    - Algunas órdenes de DogCatify tienen total_amount mayor que la suma de items
    - Ejemplo: Orden $650 pero items suman $532.79, diferencia $117.21
    - El modal muestra TOTAL: $650 pero suma items: $532.79, confunde al usuario

  2. Solución
    - Detectar facturas donde total_amount > suma de invoice_items
    - Agregar item "IVA Adicional DGI" o "Ajuste" por la diferencia
    - Solo para facturas de órdenes DogCatify (external_order_id not null)

  3. Implementación
    - Crear función para agregar item de ajuste
    - Ejecutar solo para facturas con diferencia > $1
*/

-- Función para agregar item de ajuste
CREATE OR REPLACE FUNCTION add_invoice_adjustment_item(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_invoice RECORD;
  v_items_subtotal NUMERIC;
  v_items_tax NUMERIC;
  v_items_total NUMERIC;
  v_difference NUMERIC;
BEGIN
  -- Obtener factura con su orden
  SELECT i.*, o.external_order_id
  INTO v_invoice
  FROM invoices i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calcular suma de items
  SELECT 
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(subtotal * (tax_rate/100)), 0)
  INTO v_items_subtotal, v_items_tax
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;

  v_items_total := v_items_subtotal + v_items_tax;

  -- Calcular diferencia
  v_difference := v_invoice.total_amount - v_items_total;

  RAISE NOTICE 'Factura %: Total BD=%, Items total=%, Diferencia=%', 
    v_invoice.invoice_number, v_invoice.total_amount, v_items_total, v_difference;

  -- Si hay diferencia significativa (> $1) agregar item de ajuste
  IF ABS(v_difference) > 1 AND v_invoice.external_order_id IS NOT NULL THEN
    -- Calcular subtotal e IVA del ajuste (asumiendo 22% IVA)
    DECLARE
      v_adj_subtotal NUMERIC;
      v_adj_tax_rate NUMERIC := 22;
      v_adj_iva NUMERIC;
    BEGIN
      -- El ajuste incluye IVA, calcular subtotal
      v_adj_subtotal := v_difference / (1 + v_adj_tax_rate / 100);
      v_adj_iva := v_difference - v_adj_subtotal;

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
        p_invoice_id,
        'Recargo Adicional',
        1,
        v_adj_subtotal,
        v_adj_tax_rate,
        0,
        v_adj_subtotal,
        NOW()
      );

      RAISE NOTICE 'Item de ajuste agregado: Subtotal=%, IVA=%, Total=%', 
        v_adj_subtotal, v_adj_iva, v_difference;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a facturas existentes con diferencia
DO $$
DECLARE
  v_invoice RECORD;
  v_count INT := 0;
BEGIN
  FOR v_invoice IN 
    SELECT 
      i.id,
      i.invoice_number,
      i.total_amount,
      (SELECT COALESCE(SUM(subtotal * (1 + tax_rate/100)), 0) 
       FROM invoice_items WHERE invoice_id = i.id) as items_total
    FROM invoices i
    WHERE EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = i.order_id 
        AND o.external_order_id IS NOT NULL
    )
  LOOP
    IF ABS(v_invoice.total_amount - v_invoice.items_total) > 1 THEN
      PERFORM add_invoice_adjustment_item(v_invoice.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Facturas ajustadas: %', v_count;
END $$;