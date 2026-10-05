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

