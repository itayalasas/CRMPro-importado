/*
  # Agregar payment_id a orders

  1. Problema
    - El webhook intenta actualizar payment_id en orders
    - La columna payment_id no existe
    - Error: "Could not find the 'payment_id' column of 'orders'"

  2. Solución
    - Agregar columna payment_id a tabla orders
    - Almacena el ID del pago de MercadoPago/DogCatify
    - Útil para rastrear el pago asociado a la orden

  3. Notas
    - payment_id: ID externo del pago (ej: MP-123456)
    - payment_status: Estado del pago (paid, unpaid, etc)
    - payment_method: Método de pago (mercadopago, etc)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_id TEXT;
    COMMENT ON COLUMN orders.payment_id IS 'External payment ID from payment provider (e.g., MercadoPago)';
    RAISE NOTICE 'Columna payment_id agregada a orders';
  ELSE
    RAISE NOTICE 'Columna payment_id ya existe en orders';
  END IF;
END $$;

-- Crear índice para búsquedas rápidas por payment_id
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;

COMMENT ON INDEX idx_orders_payment_id IS 'Index for quick lookups by external payment ID';
