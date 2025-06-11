-- Add amount_paid field to sales table
ALTER TABLE sales ADD COLUMN amount_paid NUMERIC;

-- Set default amount_paid equal to total_amount for existing records
UPDATE sales SET amount_paid = total_amount WHERE amount_paid IS NULL;

-- Make amount_paid NOT NULL now that we've set defaults
ALTER TABLE sales ALTER COLUMN amount_paid SET NOT NULL; 