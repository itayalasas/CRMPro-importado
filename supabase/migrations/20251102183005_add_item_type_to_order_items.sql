/*
  # Agregar tipo de item a order_items

  1. New Columns
    - `item_type` (text) - Tipo de item: 'product' o 'service'

  2. Changes
    - Agrega columna item_type a order_items
    - Valor por defecto es 'product' para compatibilidad con items existentes
    - Constraint para solo permitir 'product' o 'service'
*/

-- Agregar columna item_type
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'product';

-- Agregar constraint para valores permitidos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_items_item_type_check'
  ) THEN
    ALTER TABLE order_items
    ADD CONSTRAINT order_items_item_type_check 
    CHECK (item_type IN ('product', 'service'));
  END IF;
END $$;