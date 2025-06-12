-- Seed data for testing

-- Insert sample schools
INSERT INTO schools (name) VALUES 
    ('Springfield Elementary'),
    ('Riverside High School'),
    ('Oakwood Academy');

-- Insert sample products
INSERT INTO products (name, cost_price, selling_price, stock_quantity, optional_fields) VALUES 
    ('School Notebook', 2.50, 5.00, 100, '{"size": "A4", "pages": 200}'),
    ('Ballpoint Pen - Blue', 0.75, 1.50, 500, '{"color": "blue", "type": "ballpoint"}'),
    ('Ballpoint Pen - Black', 0.75, 1.50, 500, '{"color": "black", "type": "ballpoint"}'),
    ('Scientific Calculator', 15.00, 30.00, 50, '{"model": "FX-82MS", "brand": "Casio"}'),
    ('Geometry Set', 8.00, 15.00, 75, '{"items": ["compass", "protractor", "ruler"]}'),
    ('School Bag', 20.00, 45.00, 30, '{"size": "medium", "color": "navy"}'),
    ('Art Supplies Kit', 12.00, 25.00, 40, '{"items": ["pencils", "erasers", "sharpener", "ruler"]}');

-- Get school IDs for commission setup
DO $$
DECLARE
    springfield_id UUID;
    riverside_id UUID;
    oakwood_id UUID;
    notebook_id UUID;
    pen_blue_id UUID;
    pen_black_id UUID;
    calculator_id UUID;
    geometry_id UUID;
    bag_id UUID;
    art_kit_id UUID;
BEGIN
    -- Get school IDs
    SELECT id INTO springfield_id FROM schools WHERE name = 'Springfield Elementary';
    SELECT id INTO riverside_id FROM schools WHERE name = 'Riverside High School';
    SELECT id INTO oakwood_id FROM schools WHERE name = 'Oakwood Academy';
    
    -- Get product IDs
    SELECT id INTO notebook_id FROM products WHERE name = 'School Notebook';
    SELECT id INTO pen_blue_id FROM products WHERE name = 'Ballpoint Pen - Blue';
    SELECT id INTO pen_black_id FROM products WHERE name = 'Ballpoint Pen - Black';
    SELECT id INTO calculator_id FROM products WHERE name = 'Scientific Calculator';
    SELECT id INTO geometry_id FROM products WHERE name = 'Geometry Set';
    SELECT id INTO bag_id FROM products WHERE name = 'School Bag';
    SELECT id INTO art_kit_id FROM products WHERE name = 'Art Supplies Kit';
    
    -- Set up commissions (fixed amounts in rupees)
    INSERT INTO commissions (school_id, product_id, commission_rate) VALUES
        -- Springfield Elementary (lower commission)
        (springfield_id, notebook_id, 5),
        (springfield_id, pen_blue_id, 2),
        (springfield_id, pen_black_id, 2),
        (springfield_id, geometry_id, 10),
        (springfield_id, art_kit_id, 25),
        
        -- Riverside High School (medium commission)
        (riverside_id, notebook_id, 7),
        (riverside_id, calculator_id, 50),
        (riverside_id, geometry_id, 15),
        (riverside_id, bag_id, 40),
        
        -- Oakwood Academy (higher commission)
        (oakwood_id, notebook_id, 10),
        (oakwood_id, pen_blue_id, 3),
        (oakwood_id, calculator_id, 75),
        (oakwood_id, bag_id, 50),
        (oakwood_id, art_kit_id, 40);
END $$; 