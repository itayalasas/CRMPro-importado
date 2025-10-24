/*
  # Add commission_amount column to invoices table
  
  1. Changes
    - Add `commission_amount` column to invoices table
    - This column stores the commission amount for each invoice
    - Used when generating commission invoices for partners
  
  2. Notes
    - Default value is 0
    - Nullable to allow for non-commission invoices
*/

-- Add commission_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN commission_amount numeric(10, 2) DEFAULT 0;
    
    COMMENT ON COLUMN invoices.commission_amount IS 'Monto de comisión de esta factura (para facturación de partners)';
  END IF;
END $$;
