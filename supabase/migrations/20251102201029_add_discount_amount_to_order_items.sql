/*
  # Add discount_amount to order_items

  1. Changes
    - Add `discount_amount` column to `order_items` table
    - This column stores the absolute discount value in the item's currency
    - Used for items from DogCatify that include discount information
*/

-- Add discount_amount column
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN order_items.discount_amount IS 'Absolute discount amount in item currency (from discount_percentage applied to original_price)';
