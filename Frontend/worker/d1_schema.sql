-- ============================================================
-- PROTECH E-COMMERCE DATABASE SCHEMA (Cloudflare D1 / SQLite)
-- Converted from root schema.sql with clean product tables
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- AUTH / USERS / RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                        TEXT PRIMARY KEY,
    email                     TEXT NOT NULL UNIQUE,
    password_hash             TEXT NOT NULL DEFAULT '',
    full_name                 TEXT DEFAULT '',
    first_name                TEXT DEFAULT '',
    last_name                 TEXT DEFAULT '',
    phone                     TEXT DEFAULT '',
    avatar_url                TEXT,
    role                      TEXT NOT NULL DEFAULT 'user',
    status                    TEXT NOT NULL DEFAULT 'active',
    is_active                 INTEGER NOT NULL DEFAULT 1,
    is_staff                  INTEGER NOT NULL DEFAULT 0,
    is_superuser              INTEGER NOT NULL DEFAULT 0,
    is_email_verified         INTEGER NOT NULL DEFAULT 1,
    email_verified_at         TEXT,
    email_verification_token  TEXT,
    password_reset_token      TEXT,
    password_reset_expires    TEXT,
    last_login_at             TEXT,
    created_at                TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
    id              TEXT PRIMARY KEY,
    user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id      TEXT,
    type            TEXT NOT NULL DEFAULT 'shipping',
    recipient_name  TEXT,
    phone           TEXT,
    address_line_1  TEXT NOT NULL,
    address_line_2  TEXT,
    city            TEXT,
    state           TEXT,
    postal_code     TEXT,
    country         TEXT,
    is_default      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS brands (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    logo_url    TEXT DEFAULT '',
    website_url TEXT DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_types (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    requires_shipping  INTEGER NOT NULL DEFAULT 1,
    requires_stock     INTEGER NOT NULL DEFAULT 1,
    description        TEXT DEFAULT '',
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url   TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id                 TEXT PRIMARY KEY,
    brand_id           TEXT REFERENCES brands(id) ON DELETE SET NULL,
    category_id        TEXT REFERENCES categories(id) ON DELETE SET NULL,
    type_id            TEXT REFERENCES product_types(id) ON DELETE SET NULL,
    name               TEXT NOT NULL,
    slug               TEXT NOT NULL UNIQUE,
    sku                TEXT,
    short_description  TEXT DEFAULT '',
    description        TEXT DEFAULT '',
    cost_price         TEXT DEFAULT '0.00',
    base_price         TEXT NOT NULL DEFAULT '0.00',
    compare_at_price   TEXT DEFAULT '0.00',
    currency           TEXT NOT NULL DEFAULT 'USD',
    warranty_months    INTEGER DEFAULT 12,
    status             TEXT NOT NULL DEFAULT 'draft',
    is_featured        INTEGER NOT NULL DEFAULT 0,
    is_active          INTEGER NOT NULL DEFAULT 1,
    weight             TEXT DEFAULT '1.000',
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variants (
    id                TEXT PRIMARY KEY,
    product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku               TEXT NOT NULL UNIQUE,
    barcode           TEXT DEFAULT '',
    name              TEXT DEFAULT '',
    price             TEXT NOT NULL DEFAULT '0.00',
    cost_price        TEXT DEFAULT '0.00',
    compare_at_price  TEXT DEFAULT '0.00',
    weight            TEXT DEFAULT '1.000',
    status            TEXT NOT NULL DEFAULT 'active',
    specifications    TEXT NOT NULL DEFAULT '{}',
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id  TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    alt_text    TEXT DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_primary  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SPECIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS specification_definitions (
    id            TEXT PRIMARY KEY,
    category_id   TEXT REFERENCES categories(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL,
    data_type     TEXT NOT NULL DEFAULT 'text',
    unit          TEXT,
    is_filterable INTEGER NOT NULL DEFAULT 0,
    is_required   INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS specification_options (
    id            TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_specifications (
    id                TEXT PRIMARY KEY,
    product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    specification_id  TEXT NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
    value_text        TEXT,
    value_number      REAL,
    value_boolean     INTEGER
);

-- ============================================================
-- STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS stock (
    id                  TEXT PRIMARY KEY,
    variant_id          TEXT NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity_available  INTEGER NOT NULL DEFAULT 0,
    quantity_reserved   INTEGER NOT NULL DEFAULT 0,
    quantity_damaged    INTEGER NOT NULL DEFAULT 0,
    reorder_level       INTEGER NOT NULL DEFAULT 5,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id               TEXT PRIMARY KEY,
    variant_id       TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    type             TEXT NOT NULL,
    quantity         INTEGER NOT NULL,
    reference_type   TEXT,
    reference_id     TEXT,
    note             TEXT DEFAULT '',
    created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_by_email TEXT DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CART / WISHLIST
-- ============================================================

CREATE TABLE IF NOT EXISTS carts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    currency    TEXT NOT NULL DEFAULT 'USD',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
    id          TEXT PRIMARY KEY,
    cart_id     TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id  TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1,
    unit_price  TEXT NOT NULL DEFAULT '0.00',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlists (
    id         TEXT PRIMARY KEY,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id           TEXT PRIMARY KEY,
    wishlist_id  TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id   TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ORDERS / PAYMENTS / SHIPPING
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id                        TEXT PRIMARY KEY,
    user_id                   TEXT REFERENCES users(id) ON DELETE SET NULL,
    order_number              TEXT NOT NULL UNIQUE,
    status                    TEXT NOT NULL DEFAULT 'pending',
    payment_method            TEXT NOT NULL DEFAULT 'bakong_khqr',
    payment_status            TEXT NOT NULL DEFAULT 'unpaid',
    fulfillment_status        TEXT NOT NULL DEFAULT 'unfulfilled',
    currency                  TEXT NOT NULL DEFAULT 'USD',
    subtotal                  TEXT NOT NULL DEFAULT '0.00',
    discount                  TEXT NOT NULL DEFAULT '0.00',
    shipping_cost             TEXT NOT NULL DEFAULT '0.00',
    tax                       TEXT NOT NULL DEFAULT '0.00',
    total                     TEXT NOT NULL DEFAULT '0.00',
    shipping_address_snapshot TEXT DEFAULT '{}',
    billing_address_snapshot  TEXT DEFAULT '{}',
    guest_email               TEXT,
    created_at                TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
    id                    TEXT PRIMARY KEY,
    order_id              TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id            TEXT REFERENCES products(id) ON DELETE SET NULL,
    variant_id            TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot          TEXT,
    variant_snapshot      TEXT DEFAULT '{}',
    unit_price            TEXT NOT NULL DEFAULT '0.00',
    quantity              INTEGER NOT NULL DEFAULT 1,
    discount              TEXT NOT NULL DEFAULT '0.00',
    tax                   TEXT NOT NULL DEFAULT '0.00',
    total                 TEXT NOT NULL DEFAULT '0.00'
);

CREATE TABLE IF NOT EXISTS payments (
    id               TEXT PRIMARY KEY,
    order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway          TEXT NOT NULL DEFAULT 'bakong_khqr',
    transaction_id   TEXT,
    amount           TEXT NOT NULL DEFAULT '0.00',
    currency         TEXT NOT NULL DEFAULT 'USD',
    status           TEXT NOT NULL DEFAULT 'pending',
    gateway_response TEXT DEFAULT '{}',
    paid_at          TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refunds (
    id            TEXT PRIMARY KEY,
    payment_id    TEXT REFERENCES payments(id) ON DELETE CASCADE,
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount        TEXT NOT NULL DEFAULT '0.00',
    reason        TEXT,
    status        TEXT NOT NULL DEFAULT 'completed',
    processed_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at  TEXT
);

CREATE TABLE IF NOT EXISTS shipments (
    id               TEXT PRIMARY KEY,
    order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier          TEXT,
    tracking_number  TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',
    shipped_at       TEXT,
    delivered_at     TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS returns (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'requested',
    reason      TEXT,
    resolution  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
    id             TEXT PRIMARY KEY,
    return_id      TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id  TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity       INTEGER NOT NULL,
    condition      TEXT,
    note           TEXT
);

-- ============================================================
-- REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    id                   TEXT PRIMARY KEY,
    product_id           TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_name            TEXT DEFAULT 'Customer',
    order_item_id        TEXT REFERENCES order_items(id) ON DELETE SET NULL,
    rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                TEXT DEFAULT '',
    content              TEXT DEFAULT '',
    is_verified_purchase INTEGER NOT NULL DEFAULT 1,
    status               TEXT NOT NULL DEFAULT 'approved',
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- MARKETING: DISCOUNT CODES / PROMOTIONS / SHIPPING CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS discount_codes (
    id                   TEXT PRIMARY KEY,
    code                 TEXT NOT NULL UNIQUE,
    type                 TEXT NOT NULL DEFAULT 'percentage',
    value                TEXT NOT NULL DEFAULT '0.00',
    minimum_order_value  TEXT,
    maximum_discount     TEXT,
    usage_limit          INTEGER,
    usage_count          INTEGER NOT NULL DEFAULT 0,
    per_customer_limit   INTEGER,
    starts_at            TEXT,
    expires_at           TEXT,
    is_active            INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discount_code_products (
    discount_code_id TEXT NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_code_id, product_id)
);

CREATE TABLE IF NOT EXISTS discount_code_categories (
    discount_code_id TEXT NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    category_id      TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (discount_code_id, category_id)
);

CREATE TABLE IF NOT EXISTS promotions (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    description      TEXT DEFAULT '',
    type             TEXT NOT NULL DEFAULT 'seasonal',
    banner_image_url TEXT DEFAULT '',
    discount_type    TEXT NOT NULL DEFAULT 'percentage',
    discount_value   TEXT NOT NULL DEFAULT '0.00',
    starts_at        TEXT,
    ends_at          TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotion_products (
    promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS shipping_config (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    free_shipping_threshold TEXT NOT NULL DEFAULT '50.00',
    flat_rate               TEXT NOT NULL DEFAULT '0.01'
);

-- ============================================================
-- NOTIFICATIONS / AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    message    TEXT,
    type       TEXT,
    read_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    old_values  TEXT,
    new_values  TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type_id);
CREATE INDEX IF NOT EXISTS idx_specification_definitions_category ON specification_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_specification_options_definition ON specification_options(definition_id);
CREATE INDEX IF NOT EXISTS idx_product_specifications_product ON product_specifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_variant ON stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_variant ON stock_transactions(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================
-- SEED DATA: Admin User, Product Types, Brands, Categories, Specs
-- (Products table is intentionally left 100% clean: 0 products)
-- ============================================================

INSERT OR IGNORE INTO users (
    id, email, password_hash, full_name, first_name, last_name, avatar_url,
    role, status, is_active, is_staff, is_superuser, is_email_verified, created_at, updated_at
) VALUES (
    '4ff01caf-621f-47e4-b19a-742afdad4f9d',
    'hengly9723@gmail.com',
    'pbkdf2_sha256$admin',
    'Ly Sokheng',
    'Ly',
    'Sokheng',
    'https://i.pinimg.com/736x/78/dd/11/78dd11c9091e82cd365499bbdb5918a9.jpg',
    'admin',
    'active',
    1,
    1,
    1,
    1,
    '2026-09-29T17:18:05.131539Z',
    '2026-10-04T16:33:17.467349Z'
);

INSERT OR IGNORE INTO product_types (id, name, requires_shipping, requires_stock, description) VALUES
    ('ebbc92bd-6490-4b3d-8f3e-208613a56448', 'Physical', 1, 1, 'Ships to the customer and tracked in stock, e.g. phones, laptops, accessories'),
    ('40a2087e-4c94-42a8-911b-468403cf3cce', 'Digital', 0, 0, 'Delivered electronically, e.g. software license, e-book'),
    ('6bb0b574-aa01-4285-b9fd-c3aeb35b8a5b', 'Service', 0, 0, 'A service rendered rather than a shipped item, e.g. installation, repair, warranty');

INSERT OR IGNORE INTO brands (id, name, slug, description, logo_url, website_url, is_active) VALUES
    ('0e9d2b74-a8cd-4bee-a425-468d503fb432', 'Apple', 'Apple', '', 'https://www.apple.com/assets-www/en_WW/mac/04_product_tile/large/mbp_14_16_028335cc2_2x.jpg', '', 1),
    ('abeab198-4828-45b3-b311-7f0325ca34bd', 'Asus', 'Asus', '', 'https://dlcdnwebimgs.asus.com/gain/D293897B-7F67-4CC9-8C4E-7796764031C8/w717/h525/fwebp/w273', '', 1);

INSERT OR IGNORE INTO categories (id, parent_id, name, slug, description, image_url, is_active, sort_order) VALUES
    ('a39faaa8-5889-4f7d-b07f-9b142abbc7cb', NULL, 'Monitor', 'hardware-specs', NULL, NULL, 1, 2),
    ('f708ef8f-0b49-498e-a38c-6aa611e9ac1e', NULL, 'laptop', 'laptop', '', 'https://dlcdnwebimgs.asus.com/gain/D293897B-7F67-4CC9-8C4E-7796764031C8/w717/h525/fwebp/w273', 1, 3),
    ('74cb279e-b6fe-46ef-90fc-6f8137d108ef', 'f708ef8f-0b49-498e-a38c-6aa611e9ac1e', 'gaming laptop', 'gaming-laptop', '', 'https://dlcdnwebimgs.asus.com/gain/D293897B-7F67-4CC9-8C4E-7796764031C8/w717/h525/fwebp/w273', 1, 1);

INSERT OR IGNORE INTO specification_definitions (id, category_id, name, slug, data_type, unit, is_filterable, is_required, sort_order) VALUES
    ('5925b4e3-fba9-46a5-b347-01d8b66d531e', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'OS', 'os', 'text', NULL, 1, 0, 1),
    ('5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'Processor', 'processor', 'text', NULL, 1, 0, 2),
    ('76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'Graphics', 'graphics', 'text', NULL, 1, 0, 3),
    ('d3096975-f6a1-417c-896b-b22f921930d9', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'RAM', 'ram', 'text', NULL, 1, 0, 4),
    ('b2c2f529-b9ca-4020-90d2-ee41e05970f6', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'Storage', 'storage', 'text', NULL, 1, 0, 5),
    ('d7004110-3f02-43b5-adfe-35ebf44003c2', 'a39faaa8-5889-4f7d-b07f-9b142abbc7cb', 'Display', 'display', 'text', NULL, 1, 0, 6);

INSERT OR IGNORE INTO specification_options (id, definition_id, label, sort_order) VALUES
    ('9992b025-11cf-4743-95de-b6ea77621c5b', '5925b4e3-fba9-46a5-b347-01d8b66d531e', 'Windows 11 Home', 1),
    ('425e841a-067b-4943-8ae8-332830ed26d4', '5925b4e3-fba9-46a5-b347-01d8b66d531e', 'Windows 11 Pro', 2),
    ('c50709cf-15bf-420d-a572-336f9477b07b', '5925b4e3-fba9-46a5-b347-01d8b66d531e', 'macOS Sequoia', 4),
    ('6995c7fe-a217-4c3c-9bf6-b139b8eef445', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'AMD Ryzen 7 9800X3D', 1),
    ('fc7bd0dc-28ff-4796-8f46-b3c3444a744a', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'Intel Core i5-14400F', 2),
    ('c56ac9f6-f754-4841-b6d2-96d25b72dd96', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'AMD Ryzen 7 8845HS', 3),
    ('d6a494e8-d5ae-45a5-9c44-b56f06c3838d', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'AMD Ryzen 9 9955HX', 4),
    ('76cf7c2d-d189-433f-98ce-2073e5d6fc37', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'Apple M4', 4),
    ('d687653d-8948-43f1-ac3d-9332bd32da3d', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'Apple M4 Pro', 5),
    ('cc454b43-6a46-48d0-ae7e-a7c0d388b61d', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'AMD Ryzen™ AI MAX+ 395 Processor', 6),
    ('e1785606-c2bf-4bf5-ba41-c141f2c02630', '5b8d32f8-6ec0-44b6-bed3-79e11f23df46', 'Intel Core Ultra 9 275HX', 6),
    ('7ecca176-ac88-4360-a5c3-0e5d1b90fd48', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5090 Laptop GPU', 1),
    ('784728f6-894b-40e4-99ef-9e3adb1cb8dd', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5080 Ti Laptop GPU', 2),
    ('ba2a1350-342b-46de-bcc7-368423ff2931', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5080 Laptop GPU', 3),
    ('2c015fd0-5dcd-4a89-8e30-c6b66b8f22be', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5070 Ti Laptop GPU', 4),
    ('10ede5b8-438d-4970-ad8a-6bf6109f4b58', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5070 Laptop GPU', 5),
    ('19cb9b11-e58c-4654-bf24-a36decb6cfdc', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5060 Laptop GPU', 6),
    ('7febad63-dd60-4b71-941f-d6fe684d809b', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 5050 Laptop GPU', 7),
    ('654a485a-7229-435c-ad9d-3da7ee84c9b2', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 4070 Super Ti Laptop GPU', 8),
    ('7264419d-7caa-4511-ae2f-91af398f8a1e', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 4070 Super Laptop GPU', 9),
    ('6a3f1b2c-7196-4635-a6c6-99738905fabc', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', '10-core GPU', 10),
    ('e7bcc8d1-d80c-4568-b8db-1eca4e7b2ef5', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 4070 Laptop GPU', 10),
    ('27255192-9b12-4af1-a384-1a280fd899c8', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 4060 Ti (8GB) Laptop GPU', 11),
    ('15375ea2-3a8a-44ab-92b5-b1659fea6e72', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 4060 Laptop GPU', 13),
    ('689e0c2d-34c1-47b8-a131-613894b1b7ea', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'NVIDIA® GeForce RTX™ 3050 Laptop GPU', 14),
    ('f0c719b8-04ed-4bdd-ab2c-823381d6b7a8', '76dcd0f9-20ac-4da1-a1b1-4aab8c196e81', 'AMD XDNA™ NPU up to 50TOPS', 15),
    ('c9e26b07-2da3-4749-986f-56ec90952a8f', 'd3096975-f6a1-417c-896b-b22f921930d9', '8 GB DDR4', 1),
    ('8a79cb8c-15ae-4d56-8736-6e911258c763', 'd3096975-f6a1-417c-896b-b22f921930d9', '16 GB DDR5', 2),
    ('e1a26ff8-4bd1-4aba-a6f8-4b099d3e1256', 'd3096975-f6a1-417c-896b-b22f921930d9', '32 GB DDR5', 3),
    ('4cc2ec70-272f-43d8-b9a9-b68f320cfed7', 'd3096975-f6a1-417c-896b-b22f921930d9', '64 GB DDR5', 4),
    ('cc7f0e4c-b8b8-48d6-bb11-5e9e1ee29831', 'b2c2f529-b9ca-4020-90d2-ee41e05970f6', '256 GB SSD', 1),
    ('fc34b879-1362-4560-82a5-1be1f48ff8af', 'b2c2f529-b9ca-4020-90d2-ee41e05970f6', '512 GB SSD', 2),
    ('27c2d15a-d254-4404-89d9-a0529d611da5', 'b2c2f529-b9ca-4020-90d2-ee41e05970f6', '1 TB NVMe SSD', 3),
    ('d601f744-a8a7-4d0b-bd31-3bbb71e9fb00', 'b2c2f529-b9ca-4020-90d2-ee41e05970f6', '2 TB NVMe SSD', 4),
    ('92bf5347-6db5-419d-ad16-9a2f37ce2601', 'd7004110-3f02-43b5-adfe-35ebf44003c2', '14" FHD IPS 60 Hz', 1),
    ('ac5aa8d8-6e50-49be-bec0-459af254779e', 'd7004110-3f02-43b5-adfe-35ebf44003c2', '15.6" FHD IPS 144 Hz', 2),
    ('fa4f7742-d8c4-4c7c-ad70-d7771a1297fc', 'd7004110-3f02-43b5-adfe-35ebf44003c2', '16" QHD+ 240 Hz', 3),
    ('b0eefc50-197a-4dad-af26-1692bbe6602c', 'd7004110-3f02-43b5-adfe-35ebf44003c2', '18" 4K OLED 120 Hz', 4),
    ('1d843db0-eac2-4872-ad3c-ae8b0a9b8945', 'd7004110-3f02-43b5-adfe-35ebf44003c2', '13.4" 2.5K (2560 x 1600, WQXGA) 16:10 180Hz ROG', 6);

INSERT OR IGNORE INTO shipping_config (id, free_shipping_threshold, flat_rate) VALUES
    (1, '50.00', '0.01');

INSERT OR IGNORE INTO promotions (
    id, name, description, type, banner_image_url, discount_type, discount_value, starts_at, ends_at, is_active
) VALUES (
    '06c913d0-9e3d-4b90-941a-9455ebb356c1',
    'Pchum Ben',
    'Level up your battle station with high-performance desktop hardware, next-gen GPUs, and elite gaming peripherals at limited-time promotional pricing.',
    'seasonal',
    '/media/banners/banner_f81c380d7b65.png',
    'percentage',
    '20.00',
    '2026-10-02T02:49:00Z',
    '2026-10-30T09:18:00Z',
    1
);
