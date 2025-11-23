/*
  # Add order_id to tickets table

  1. Changes
    - Add `order_id` column to tickets table
    - Add foreign key constraint to orders table
    - Allow null values since not all tickets are related to orders

  2. Purpose
    - Link tickets to specific orders for better tracking
    - Enable creating support tickets directly from orders
*/

-- Add order_id column to tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
