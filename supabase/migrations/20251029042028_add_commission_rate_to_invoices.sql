/*
  # Agregar commission_rate a invoices

  1. Problema
    - El trigger generate_invoice_from_order() intenta insertar commission_rate
    - La columna commission_rate no existe en invoices
    - Causa error 42703 al confirmar órdenes

  2. Solución
    - Agregar columna commission_rate a invoices
    - Almacena el porcentaje de comisión (ej: 5.0 para 5%)
    - Diferente de commission_amount que es el monto en dinero

  3. Notas
    - commission_rate: Porcentaje (5.0 = 5%)
    - commission_amount: Monto en dinero ($100)
    - commission_iva_rate: IVA sobre la comisión (ya existe)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE invoices ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0;
    COMMENT ON COLUMN invoices.commission_rate IS 'Commission percentage rate (e.g., 5.0 for 5%)';
    RAISE NOTICE 'Columna commission_rate agregada a invoices';
  ELSE
    RAISE NOTICE 'Columna commission_rate ya existe en invoices';
  END IF;
END $$;
