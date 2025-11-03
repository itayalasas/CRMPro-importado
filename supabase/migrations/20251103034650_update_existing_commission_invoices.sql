/*
  # Actualizar Facturas de Comisión Existentes - Agregar Cliente e Items

  1. Summary
    - Actualiza todas las facturas de comisión existentes para incluir:
      - client_id basado en datos del partner
      - invoice_items con descripción "Comisión por ventas"

  2. Process
    - Para cada factura de comisión sin client_id:
      1. Busca o crea cliente basado en el partner
      2. Actualiza la factura con el client_id
      3. Crea invoice_item si no existe

  3. Safety
    - Solo actualiza facturas de comisión (is_commission_invoice = true)
    - No sobrescribe client_id existentes
    - No duplica invoice_items existentes
*/

DO $$
DECLARE
  v_invoice record;
  v_partner record;
  v_client_id uuid;
  v_existing_item_count integer;
  v_updated_count integer := 0;
  v_items_created integer := 0;
BEGIN
  RAISE NOTICE 'Iniciando actualización de facturas de comisión existentes...';

  -- Iterar sobre todas las facturas de comisión sin client_id
  FOR v_invoice IN
    SELECT
      i.id,
      i.invoice_number,
      i.partner_id,
      i.subtotal,
      i.commission_iva_rate
    FROM invoices i
    WHERE i.is_commission_invoice = true
      AND i.client_id IS NULL
      AND i.partner_id IS NOT NULL
  LOOP
    BEGIN
      -- Obtener datos del partner
      SELECT * INTO v_partner
      FROM partners
      WHERE id = v_invoice.partner_id;

      IF FOUND AND v_partner.rut IS NOT NULL THEN
        -- Buscar cliente existente por RUT
        SELECT id INTO v_client_id
        FROM clients
        WHERE rut = v_partner.rut
        LIMIT 1;

        -- Si no existe, crear cliente
        IF v_client_id IS NULL THEN
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

          RAISE NOTICE 'Cliente creado para partner %: %', v_partner.name, v_client_id;
        END IF;

        -- Actualizar factura con client_id
        UPDATE invoices
        SET
          client_id = v_client_id,
          updated_at = now()
        WHERE id = v_invoice.id;

        v_updated_count := v_updated_count + 1;
        RAISE NOTICE 'Factura % actualizada con client_id %', v_invoice.invoice_number, v_client_id;

        -- Verificar si ya tiene invoice_items
        SELECT COUNT(*) INTO v_existing_item_count
        FROM invoice_items
        WHERE invoice_id = v_invoice.id;

        -- Si no tiene items, crear el item de comisión
        IF v_existing_item_count = 0 THEN
          INSERT INTO invoice_items (
            invoice_id,
            description,
            quantity,
            unit_price,
            tax_rate,
            discount,
            subtotal
          ) VALUES (
            v_invoice.id,
            'Comisión por ventas',
            1,
            v_invoice.subtotal,
            COALESCE(v_invoice.commission_iva_rate, 22.00),
            0,
            v_invoice.subtotal
          );

          v_items_created := v_items_created + 1;
          RAISE NOTICE 'Item de factura creado para %', v_invoice.invoice_number;
        ELSE
          RAISE NOTICE 'Factura % ya tiene % items existentes', v_invoice.invoice_number, v_existing_item_count;
        END IF;

      ELSE
        RAISE NOTICE 'Partner no encontrado o sin RUT para factura %', v_invoice.invoice_number;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error actualizando factura %: %', v_invoice.invoice_number, SQLERRM;
        CONTINUE;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Actualización completada!';
  RAISE NOTICE 'Facturas actualizadas: %', v_updated_count;
  RAISE NOTICE 'Items creados: %', v_items_created;
  RAISE NOTICE '========================================';
END $$;

-- Verificar resultados finales
DO $$
DECLARE
  v_total_commission_invoices integer;
  v_invoices_with_client integer;
  v_invoices_without_client integer;
  v_invoices_with_items integer;
  v_invoices_without_items integer;
BEGIN
  SELECT COUNT(*) INTO v_total_commission_invoices
  FROM invoices
  WHERE is_commission_invoice = true;

  SELECT COUNT(*) INTO v_invoices_with_client
  FROM invoices
  WHERE is_commission_invoice = true
    AND client_id IS NOT NULL;

  SELECT COUNT(*) INTO v_invoices_without_client
  FROM invoices
  WHERE is_commission_invoice = true
    AND client_id IS NULL;

  SELECT COUNT(DISTINCT i.id) INTO v_invoices_with_items
  FROM invoices i
  INNER JOIN invoice_items ii ON ii.invoice_id = i.id
  WHERE i.is_commission_invoice = true;

  SELECT COUNT(*) INTO v_invoices_without_items
  FROM invoices i
  WHERE i.is_commission_invoice = true
    AND NOT EXISTS (
      SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id
    );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN FINAL:';
  RAISE NOTICE 'Total facturas de comisión: %', v_total_commission_invoices;
  RAISE NOTICE 'Facturas con client_id: %', v_invoices_with_client;
  RAISE NOTICE 'Facturas SIN client_id: %', v_invoices_without_client;
  RAISE NOTICE 'Facturas con items: %', v_invoices_with_items;
  RAISE NOTICE 'Facturas SIN items: %', v_invoices_without_items;
  RAISE NOTICE '========================================';
END $$;
