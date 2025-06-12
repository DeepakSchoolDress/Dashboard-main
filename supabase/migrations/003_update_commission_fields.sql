-- Rename commission_rate to commission_amount to better reflect its purpose
ALTER TABLE commissions RENAME COLUMN commission_rate TO commission_amount;

-- Drop the old constraint
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_commission_rate_check;

-- Add new constraint for rupee-based commission
ALTER TABLE commissions ADD CONSTRAINT commissions_commission_amount_check 
CHECK (commission_amount >= 0 AND commission_amount <= 1000000);

-- Add commission_amount to sale_items table to store the actual commission at time of sale
ALTER TABLE sale_items ADD COLUMN commission_amount NUMERIC DEFAULT 0;

-- Update existing sale_items with commission amounts
UPDATE sale_items si
SET commission_amount = COALESCE(
  (
    SELECT c.commission_amount 
    FROM commissions c 
    WHERE c.product_id = si.product_id 
    AND c.school_id = (
      SELECT school_id 
      FROM sales s 
      WHERE s.id = si.sale_id
    )
  ), 
  0
)
WHERE is_commissioned = true; 