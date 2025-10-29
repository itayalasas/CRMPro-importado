/*
  # Add commission_percentage to partners table

  1. Changes
    - Add commission_percentage column to partners table (decimal, default 5.0)
    - This stores the commission percentage that each partner receives
    - Comes from DogCatify webhook data

  2. Notes
    - Default 5% commission for existing partners
    - Can be updated per partner based on their agreement
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'commission_percentage'
  ) THEN
    ALTER TABLE partners ADD COLUMN commission_percentage DECIMAL(5,2) DEFAULT 5.0;
    COMMENT ON COLUMN partners.commission_percentage IS 'Commission percentage for this partner (e.g., 5.0 for 5%)';
  END IF;
END $$;
