-- SalePoint Database Schema for MySQL/Amazon RDS

-- Create database (if not already created through RDS)
-- CREATE DATABASE salepointdb;

-- USE salepointdb;

-- Users table to store system users (sales representatives, managers, etc.)
CREATE TABLE users (
    user_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL, -- 'SALES_REP', 'MANAGER', 'ADMIN'
    department VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_user_role (role)
);

-- Customers table to store customer basic information
-- Note: More detailed customer information and sales rep assignments are in DynamoDB
CREATE TABLE customers (
    customer_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_email (email),
    INDEX idx_customer_name (name)
);

-- Product categories
CREATE TABLE categories (
    category_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id VARCHAR(36) NULL,
    FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

-- Products table
CREATE TABLE products (
    product_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id VARCHAR(36) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    cost DECIMAL(12, 2),
    stock INT NOT NULL DEFAULT 0,
    sku VARCHAR(50) UNIQUE,
    barcode VARCHAR(50) UNIQUE,
    weight DECIMAL(8, 2),
    dimensions VARCHAR(50), -- Format: 'LxWxH'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    INDEX idx_product_category (category_id),
    INDEX idx_product_name (name),
    INDEX idx_product_sku (sku)
);

-- Product images (references to S3)
CREATE TABLE product_images (
    image_id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    s3_key VARCHAR(255) NOT NULL, -- Path in S3 bucket
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_image (product_id)
);

-- Product documents (references to S3)
CREATE TABLE product_documents (
    document_id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'SPEC', 'MANUAL', 'WARRANTY', etc.
    title VARCHAR(100) NOT NULL,
    s3_key VARCHAR(255) NOT NULL, -- Path in S3 bucket
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_document (product_id)
);

-- Sales transactions
CREATE TABLE sales (
    sale_id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    sales_rep_id VARCHAR(36) NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) NOT NULL, -- 'PENDING', 'COMPLETED', 'CANCELLED'
    payment_method VARCHAR(50),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (sales_rep_id) REFERENCES users(user_id),
    INDEX idx_sale_customer (customer_id),
    INDEX idx_sale_rep (sales_rep_id),
    INDEX idx_sale_date (sale_date),
    INDEX idx_sale_status (status)
);

-- Sale items
CREATE TABLE sale_items (
    sale_item_id VARCHAR(36) PRIMARY KEY,
    sale_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL, -- Price at time of sale
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_sale_item_sale (sale_id),
    INDEX idx_sale_item_product (product_id)
);

-- Inventory transactions
CREATE TABLE inventory_transactions (
    transaction_id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN'
    quantity INT NOT NULL, -- Positive for in, negative for out
    reference_id VARCHAR(36), -- Can link to a sale_id or purchase_id
    notes TEXT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_inventory_product (product_id),
    INDEX idx_inventory_date (transaction_date),
    INDEX idx_inventory_type (transaction_type)
);

-- Marketing campaigns
CREATE TABLE marketing_campaigns (
    campaign_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_campaign_dates (start_date, end_date),
    INDEX idx_campaign_status (status)
);

-- Campaign products (which products are included in a campaign)
CREATE TABLE campaign_products (
    campaign_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    special_price DECIMAL(12, 2) NULL,
    PRIMARY KEY (campaign_id, product_id),
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Activity log
CREATE TABLE activity_log (
    log_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'CUSTOMER', 'SALE', etc.
    entity_id VARCHAR(36) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_activity_user (user_id),
    INDEX idx_activity_entity (entity_type, entity_id),
    INDEX idx_activity_date (created_at)
);

-- Create initial admin user
INSERT INTO users (
    user_id, username, password_hash, name, email, role
) VALUES (
    'admin-001', 
    'admin', 
    '$2a$12$tH7RT1b4KWSIcPGWZpYAV.O3hLC7mOoxGBOU0YtcCH9KMI/BdHQM2', -- hashed 'Password123!'
    'System Administrator', 
    'admin@salepoint.com', 
    'ADMIN'
);

-- Create sample categories
INSERT INTO categories (category_id, name, description) VALUES
('cat-001', 'Electronics', 'Electronic devices and accessories'),
('cat-002', 'Furniture', 'Home and office furniture'),
('cat-003', 'Clothing', 'Apparel and fashion items');

-- Create sample products
INSERT INTO products (product_id, name, description, category_id, price, cost, stock, sku) VALUES
('prod-001', 'Smartphone X', 'Latest smartphone with amazing features', 'cat-001', 999.99, 750.00, 50, 'SP-X001'),
('prod-002', 'Office Chair', 'Ergonomic office chair with lumbar support', 'cat-002', 249.99, 150.00, 20, 'OC-E100'),
('prod-003', 'Winter Jacket', 'Warm winter jacket with water-resistant exterior', 'cat-003', 129.99, 80.00, 30, 'CL-WJ01');

-- Create sample customers
INSERT INTO customers (customer_id, name, email, phone, address) VALUES
('cust-001', 'John Doe', 'john.doe@example.com', '555-0101', '123 Main St, Anytown, AN 12345'),
('cust-002', 'Jane Smith', 'jane.smith@example.com', '555-0102', '456 Oak Ave, Someville, SV 67890'),
('cust-003', 'Robert Johnson', 'robert.johnson@example.com', '555-0103', '789 Pine Rd, Otherburg, OB 54321');

-- Create sample sales representatives
INSERT INTO users (user_id, username, password_hash, name, email, role, department) VALUES
('user-001', 'jwhite', '$2a$12$M5XBY/hbA3qZrJMJIMrN3uVZefG6q89luhPB.CXFKhUJSiXG8OJmG', 'James White', 'james.white@salepoint.com', 'SALES_REP', 'Electronics'),
('user-002', 'mgarcia', '$2a$12$kq0ZWDK4Ntcj3LurITs9deRM47ArAf3lIvzfAYTUIXJDFK54gIlfu', 'Maria Garcia', 'maria.garcia@salepoint.com', 'SALES_REP', 'Furniture'),
('user-003', 'tlee', '$2a$12$8e3i5w99F1VQUhN5tHjifuvns2XnREvhKMPyRvHzEPYEY1MA0QSoS', 'Tim Lee', 'tim.lee@salepoint.com', 'SALES_REP', 'Clothing');

-- Create sample sales manager
INSERT INTO users (user_id, username, password_hash, name, email, role, department) VALUES
('user-004', 'sbrown', '$2a$12$eJ2j5Jq0s7fkHs5BFr/uC.m11JTd0XVEL.OxFWmOzT93fBiDGYOOi', 'Sarah Brown', 'sarah.brown@salepoint.com', 'MANAGER', 'Sales');

-- Create sample sales transactions
INSERT INTO sales (sale_id, customer_id, sales_rep_id, sale_date, total_amount, status) VALUES
('sale-001', 'cust-001', 'user-001', DATE_SUB(NOW(), INTERVAL 5 DAY), 999.99, 'COMPLETED'),
('sale-002', 'cust-002', 'user-002', DATE_SUB(NOW(), INTERVAL 3 DAY), 499.98, 'COMPLETED'),
('sale-003', 'cust-003', 'user-003', DATE_SUB(NOW(), INTERVAL 1 DAY), 129.99, 'PENDING');

-- Create sample sale items
INSERT INTO sale_items (sale_item_id, sale_id, product_id, quantity, price) VALUES
('item-001', 'sale-001', 'prod-001', 1, 999.99),
('item-002', 'sale-002', 'prod-002', 2, 249.99),
('item-003', 'sale-003', 'prod-003', 1, 129.99);

-- Update inventory based on sales
UPDATE products SET stock = stock - 1 WHERE product_id = 'prod-001';
UPDATE products SET stock = stock - 2 WHERE product_id = 'prod-002';
UPDATE products SET stock = stock - 1 WHERE product_id = 'prod-003';

-- Log inventory transactions for the sales
INSERT INTO inventory_transactions (transaction_id, product_id, transaction_type, quantity, reference_id, created_by) VALUES
('inv-001', 'prod-001', 'SALE', -1, 'sale-001', 'user-001'),
('inv-002', 'prod-002', 'SALE', -2, 'sale-002', 'user-002'),
('inv-003', 'prod-003', 'SALE', -1, 'sale-003', 'user-003');
