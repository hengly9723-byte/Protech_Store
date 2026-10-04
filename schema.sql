-- ============================================================
-- E-COMMERCE DATABASE SCHEMA (PostgreSQL)
-- Updated: warehouses removed, inventory -> stock,
--          suppliers / purchase_orders removed
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- AUTH / USERS / RBAC
-- ============================================================

CREATE TABLE users (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                     VARCHAR(255) NOT NULL UNIQUE,
    password_hash             VARCHAR(255) NOT NULL,
    first_name                VARCHAR(100),
    last_name                 VARCHAR(100),
    phone                     VARCHAR(30),
    avatar_url                TEXT,
    status                    VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, banned
    is_staff                  BOOLEAN NOT NULL DEFAULT FALSE,        -- can access admin panel
    is_superuser              BOOLEAN NOT NULL DEFAULT FALSE,        -- bypasses permission checks
    email_verified_at         TIMESTAMP,
    email_verification_token  VARCHAR(255),
    password_reset_token      VARCHAR(255),
    password_reset_expires    TIMESTAMP,
    last_login_at             TIMESTAMP,
    created_at                TIMESTAMP NOT NULL DEFAULT now(),
    updated_at                TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE customer_profiles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth  DATE,
    created_at     TIMESTAMP NOT NULL DEFAULT now(),
    updated_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL DEFAULT 'shipping',
    recipient_name  VARCHAR(150),
    phone           VARCHAR(30),
    address_line_1  VARCHAR(255) NOT NULL,
    address_line_2  VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         VARCHAR(100),
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- CATALOG
-- ============================================================

CREATE TABLE brands (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    logo_url    VARCHAR(500),
    website_url VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_types (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(100) NOT NULL UNIQUE, -- e.g. Physical, Digital, Service
    requires_shipping  BOOLEAN NOT NULL DEFAULT true,
    requires_stock     BOOLEAN NOT NULL DEFAULT true,
    description        TEXT,
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    image_url   VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id           UUID REFERENCES brands(id) ON DELETE SET NULL,
    category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
    type_id            UUID REFERENCES product_types(id) ON DELETE SET NULL,
    name               VARCHAR(255) NOT NULL,
    slug               VARCHAR(255) NOT NULL UNIQUE,
    sku                VARCHAR(100) UNIQUE,
    short_description  TEXT,
    description        TEXT,
    cost_price         DECIMAL(12,2),
    base_price         DECIMAL(12,2) NOT NULL,
    compare_at_price   DECIMAL(12,2),
    currency           VARCHAR(10) NOT NULL DEFAULT 'USD',
    warranty_months    INT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft',
    is_featured        BOOLEAN NOT NULL DEFAULT false,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    weight             DECIMAL(10,3),
    created_at         TIMESTAMP NOT NULL DEFAULT now(),
    updated_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku               VARCHAR(100) NOT NULL UNIQUE,
    barcode           VARCHAR(100),
    name              VARCHAR(255),
    price             DECIMAL(12,2) NOT NULL,
    cost_price        DECIMAL(12,2),
    compare_at_price  DECIMAL(12,2),
    weight            DECIMAL(10,3),
    status            VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id  UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    alt_text    VARCHAR(255),
    sort_order  INT NOT NULL DEFAULT 0,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- SPECIFICATIONS (dynamic specs per category, e.g. RAM, CPU, GPU)
-- ============================================================

CREATE TABLE specification_definitions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID REFERENCES categories(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,   -- e.g. "RAM", "CPU", "Screen Size"
    slug          VARCHAR(150) NOT NULL,
    data_type     VARCHAR(20) NOT NULL,    -- text, number, boolean
    unit          VARCHAR(30),             -- e.g. "GB", "inch"
    is_filterable BOOLEAN NOT NULL DEFAULT false,
    is_required   BOOLEAN NOT NULL DEFAULT false,
    sort_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE product_specifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    specification_id  UUID NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
    value_text        TEXT,
    value_number      DECIMAL(20,4),
    value_boolean     BOOLEAN
);

-- ============================================================
-- STOCK  (formerly warehouses + inventory)
-- ============================================================

CREATE TABLE stock (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id          UUID NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity_available  INT NOT NULL DEFAULT 0,
    quantity_reserved   INT NOT NULL DEFAULT 0,
    quantity_damaged    INT NOT NULL DEFAULT 0,
    reorder_level       INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE stock_transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id     UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    type           VARCHAR(30) NOT NULL, -- restock, sale, damaged, adjustment, return
    quantity       INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id   UUID,
    note           TEXT,
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- CART / WISHLIST
-- ============================================================

CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id  VARCHAR(255),
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    currency    VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity    INT NOT NULL DEFAULT 1,
    unit_price  DECIMAL(12,2) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE wishlists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE wishlist_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id  UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- ORDERS / PAYMENTS / SHIPPING
-- ============================================================

CREATE TABLE orders (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
    order_number              VARCHAR(50) NOT NULL UNIQUE,
    status                    VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_status            VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    fulfillment_status        VARCHAR(20) NOT NULL DEFAULT 'unfulfilled',
    currency                  VARCHAR(10) NOT NULL DEFAULT 'USD',
    subtotal                  DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount                  DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_cost             DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax                       DECIMAL(12,2) NOT NULL DEFAULT 0,
    total                     DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_address_snapshot JSONB,
    billing_address_snapshot  JSONB,
    guest_email               VARCHAR(255),
    created_at                TIMESTAMP NOT NULL DEFAULT now(),
    updated_at                TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id            UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    sku_snapshot          VARCHAR(100),
    variant_snapshot      JSONB,
    unit_price            DECIMAL(12,2) NOT NULL,
    quantity              INT NOT NULL,
    discount              DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax                   DECIMAL(12,2) NOT NULL DEFAULT 0,
    total                 DECIMAL(12,2) NOT NULL
);

CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway          VARCHAR(50) NOT NULL,
    transaction_id   VARCHAR(255),
    amount           DECIMAL(12,2) NOT NULL,
    currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    paid_at          TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    reason        TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    processed_at  TIMESTAMP
);

CREATE TABLE shipments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier          VARCHAR(100),
    tracking_number  VARCHAR(150),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    shipped_at       TIMESTAMP,
    delivered_at     TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE returns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'requested',
    reason      TEXT,
    resolution  VARCHAR(50),
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE return_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id      UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id  UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity       INT NOT NULL,
    condition      VARCHAR(30),
    note           TEXT
);

-- ============================================================
-- REVIEWS
-- ============================================================

CREATE TABLE reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
    order_item_id        UUID REFERENCES order_items(id) ON DELETE SET NULL,
    rating               INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                VARCHAR(255),
    content              TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMP NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- MARKETING: DISCOUNT CODES / PROMOTIONS
-- ============================================================

CREATE TABLE discount_codes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 VARCHAR(50) NOT NULL UNIQUE,
    type                 VARCHAR(20) NOT NULL, -- percentage, fixed
    value                DECIMAL(12,2) NOT NULL,
    minimum_order_value  DECIMAL(12,2),
    maximum_discount     DECIMAL(12,2),
    usage_limit          INT,
    usage_count          INT NOT NULL DEFAULT 0,
    per_customer_limit   INT,
    starts_at            TIMESTAMP,
    expires_at           TIMESTAMP,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE discount_code_products (
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_code_id, product_id)
);

CREATE TABLE discount_code_categories (
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    category_id       UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_code_id, category_id)
);

CREATE TABLE promotions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(150) NOT NULL,
    description      TEXT,
    type             VARCHAR(30) NOT NULL,
    banner_image_url TEXT,
    discount_type    VARCHAR(20) NOT NULL DEFAULT 'percentage',
    discount_value   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    starts_at        TIMESTAMP,
    ends_at          TIMESTAMP,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE promotion_products (
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, product_id)
);

-- ============================================================
-- NOTIFICATIONS / AUDIT LOG
-- ============================================================

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    type       VARCHAR(30),
    read_at    TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES (recommended for common lookups)
-- ============================================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_type ON products(type_id);
CREATE INDEX idx_specification_definitions_category ON specification_definitions(category_id);
CREATE INDEX idx_product_specifications_product ON product_specifications(product_id);
CREATE INDEX idx_product_specifications_spec ON product_specifications(specification_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_stock_variant ON stock(variant_id);
CREATE INDEX idx_stock_transactions_variant ON stock_transactions(variant_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_users_email_token ON users(email_verification_token);
CREATE INDEX idx_users_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================
-- SEED DATA: default product types (example)
-- ============================================================

INSERT INTO product_types (name, requires_shipping, requires_stock, description) VALUES
    ('Physical', true, true, 'Ships to the customer and tracked in stock, e.g. phones, laptops, accessories'),
    ('Digital', false, false, 'Delivered electronically, e.g. software license, e-book'),
    ('Service', false, false, 'A service rendered rather than a shipped item, e.g. installation, repair, warranty');

-- ============================================================
-- AUTO-UPDATE updated_at ON ROW CHANGES
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stock_updated_at BEFORE UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_returns_updated_at BEFORE UPDATE ON returns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
