-- Add is_active column to products table
ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Set all existing products as active
UPDATE products SET is_active = true WHERE is_active IS NULL; 