-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Schools Table
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cost_price NUMERIC NOT NULL,
    selling_price NUMERIC NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    optional_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Commissions Table
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1000000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(school_id, product_id)
);

-- Create Sales Table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT DEFAULT 'Cash',
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    total_amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Sale_Items Table
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL,
    is_commissioned BOOLEAN DEFAULT false
);

-- Create Bill_Cancellations Table
CREATE TABLE bill_cancellations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reason TEXT
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_products_school_id ON products(school_id);
CREATE INDEX idx_commissions_school_product ON commissions(school_id, product_id);
CREATE INDEX idx_sales_school_id ON sales(school_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_bill_cancellations_sale_id ON bill_cancellations(sale_id); 