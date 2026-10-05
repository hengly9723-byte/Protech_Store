// ============================================================================
// Protech Store — Cloudflare Worker API Backed by Cloudflare D1 (SQLite)
// ============================================================================
import { WorkerMailer } from "worker-mailer";

let schemaInitialized = false;

const INIT_SQL_STATEMENTS = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    full_name TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_staff INTEGER NOT NULL DEFAULT 0,
    is_superuser INTEGER NOT NULL DEFAULT 0,
    is_email_verified INTEGER NOT NULL DEFAULT 1,
    email_verified_at TEXT,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    type TEXT NOT NULL DEFAULT 'shipping',
    recipient_name TEXT,
    phone TEXT,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    website_url TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS product_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    requires_shipping INTEGER NOT NULL DEFAULT 1,
    requires_stock INTEGER NOT NULL DEFAULT 1,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    type_id TEXT REFERENCES product_types(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT,
    short_description TEXT DEFAULT '',
    description TEXT DEFAULT '',
    cost_price TEXT DEFAULT '0.00',
    base_price TEXT NOT NULL DEFAULT '0.00',
    compare_at_price TEXT DEFAULT '0.00',
    currency TEXT NOT NULL DEFAULT 'USD',
    warranty_months INTEGER DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'draft',
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    weight TEXT DEFAULT '1.000',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT DEFAULT '',
    name TEXT DEFAULT '',
    price TEXT NOT NULL DEFAULT '0.00',
    cost_price TEXT DEFAULT '0.00',
    compare_at_price TEXT DEFAULT '0.00',
    weight TEXT DEFAULT '1.000',
    status TEXT NOT NULL DEFAULT 'active',
    specifications TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS specification_definitions (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'text',
    unit TEXT,
    is_filterable INTEGER NOT NULL DEFAULT 0,
    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS specification_options (
    id TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS product_specifications (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    specification_id TEXT NOT NULL REFERENCES specification_definitions(id) ON DELETE CASCADE,
    value_text TEXT,
    value_number REAL,
    value_boolean INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS stock (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_damaged INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    note TEXT DEFAULT '',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_by_email TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price TEXT NOT NULL DEFAULT '0.00',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS wishlist_items (
    id TEXT PRIMARY KEY,
    wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'bakong_khqr',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal TEXT NOT NULL DEFAULT '0.00',
    discount TEXT NOT NULL DEFAULT '0.00',
    shipping_cost TEXT NOT NULL DEFAULT '0.00',
    tax TEXT NOT NULL DEFAULT '0.00',
    total TEXT NOT NULL DEFAULT '0.00',
    shipping_address_snapshot TEXT DEFAULT '{}',
    billing_address_snapshot TEXT DEFAULT '{}',
    guest_email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT,
    variant_snapshot TEXT DEFAULT '{}',
    unit_price TEXT NOT NULL DEFAULT '0.00',
    quantity INTEGER NOT NULL DEFAULT 1,
    discount TEXT NOT NULL DEFAULT '0.00',
    tax TEXT NOT NULL DEFAULT '0.00',
    total TEXT NOT NULL DEFAULT '0.00'
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL DEFAULT 'bakong_khqr',
    transaction_id TEXT,
    amount TEXT NOT NULL DEFAULT '0.00',
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    gateway_response TEXT DEFAULT '{}',
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    payment_id TEXT REFERENCES payments(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount TEXT NOT NULL DEFAULT '0.00',
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    processed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier TEXT,
    tracking_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    shipped_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    reason TEXT,
    resolution TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT DEFAULT 'Customer',
    order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    is_verified_purchase INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'percentage',
    value TEXT NOT NULL DEFAULT '0.00',
    minimum_order_value TEXT,
    maximum_discount TEXT,
    usage_limit INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    per_customer_limit INTEGER,
    starts_at TEXT,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'seasonal',
    banner_image_url TEXT DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value TEXT NOT NULL DEFAULT '0.00',
    starts_at TEXT,
    ends_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS promotion_products (
    promotion_id TEXT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (promotion_id, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS shipping_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    free_shipping_threshold TEXT NOT NULL DEFAULT '50.00',
    flat_rate TEXT NOT NULL DEFAULT '0.01'
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS _d1_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

const WIPE_ALL_TABLES_SQL = [
  `DELETE FROM audit_logs`,
  `DELETE FROM promotion_products`,
  `DELETE FROM promotions`,
  `DELETE FROM discount_codes`,
  `DELETE FROM shipping_config`,
  `DELETE FROM reviews`,
  `DELETE FROM returns`,
  `DELETE FROM shipments`,
  `DELETE FROM refunds`,
  `DELETE FROM payments`,
  `DELETE FROM order_items`,
  `DELETE FROM orders`,
  `DELETE FROM wishlist_items`,
  `DELETE FROM wishlists`,
  `DELETE FROM cart_items`,
  `DELETE FROM carts`,
  `DELETE FROM stock_transactions`,
  `DELETE FROM stock`,
  `DELETE FROM product_specifications`,
  `DELETE FROM specification_options`,
  `DELETE FROM specification_definitions`,
  `DELETE FROM product_images`,
  `DELETE FROM product_variants`,
  `DELETE FROM products`,
  `DELETE FROM categories`,
  `DELETE FROM product_types`,
  `DELETE FROM brands`,
  `DELETE FROM addresses`,
  `DELETE FROM roles`,
  `DELETE FROM users`,
  `INSERT OR REPLACE INTO _d1_meta (key, value) VALUES ('clean_wipe_20261005', datetime('now'))`,
];

async function ensureD1(db) {
  await db.prepare("PRAGMA foreign_keys = ON").run();
  if (schemaInitialized) return;
  try {
    await db.batch(INIT_SQL_STATEMENTS.map((sql) => db.prepare(sql)));
    const wipeCheck = await db
      .prepare("SELECT value FROM _d1_meta WHERE key = 'clean_wipe_20261005'")
      .first();
    if (!wipeCheck) {
      await db.batch(WIPE_ALL_TABLES_SQL.map((sql) => db.prepare(sql)));
    }
    schemaInitialized = true;
  } catch (err) {
    console.error("D1 schema init error:", err);
  }
}

// ==========================================
// Pure-JS MD5 & CRC16 for Bakong KHQR
// ==========================================
function md5(input) {
  const utf8 = new TextEncoder().encode(input);
  function leftRotate(x, c) {
    return (x << c) | (x >>> (32 - c));
  }
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }
  const bitLen = utf8.length * 8;
  const padLen = ((56 - ((utf8.length + 1) % 64)) + 64) % 64;
  const buf = new Uint8Array(utf8.length + 1 + padLen + 8);
  buf.set(utf8);
  buf[utf8.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 8, bitLen >>> 0, true);
  view.setUint32(buf.length - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

  let a0 = 0x67452301 >>> 0;
  let b0 = 0xefcdab89 >>> 0;
  let c0 = 0x98badcfe >>> 0;
  let d0 = 0x10325476 >>> 0;

  for (let offset = 0; offset < buf.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + leftRotate(F, s[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return Array.from(out)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag, val) {
  const s = String(val);
  return `${tag}${String(s.length).padStart(2, "0")}${s}`;
}

function generateKhqrPayload(orderNumber, amount, currency = "USD") {
  const accountId = "ly_sokheng1@bkrt";
  const merchantName = "SOKHENG LY";
  const merchantCity = "PHNOM PENH";
  const currencyCode = currency === "KHR" ? "116" : "840";
  const amountStr =
    currency === "KHR"
      ? String(Math.round(Number(amount)))
      : Number(amount).toFixed(2);
  const nowMs = Date.now();
  const expMs = nowMs + 30 * 60 * 1000;

  const tags = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("29", tlv("00", accountId)),
    tlv("52", "5999"),
    tlv("53", currencyCode),
    tlv("54", amountStr),
    tlv("58", "KH"),
    tlv("59", merchantName),
    tlv("60", merchantCity),
    tlv("62", tlv("01", String(orderNumber || "ORDER").slice(0, 25)) + tlv("03", merchantName)),
    tlv("99", tlv("00", String(nowMs)) + tlv("01", String(expMs))),
  ];
  const noCrc = tags.join("") + "6304";
  const qr = noCrc + crc16(noCrc);
  const hash = md5(qr);
  return {
    qr,
    md5: hash,
    expires_at: Math.floor(expMs / 1000),
  };
}

let bakongToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiYTY5Zjg2M2M2NDc3NDUwMSJ9LCJpYXQiOjE3ODc0MTc2NzcsImV4cCI6MTc5NTE5MzY3N30.UR9za6IwFsygrM2qtmb6uQWU1YvkQ1BX6kQUfOPN1rQ";

async function checkBakongMd5(md5Hash) {
  const baseUrl = "https://api-bakong.nbc.gov.kh";
  try {
    let resp = await fetch(`${baseUrl}/v1/check_transaction_by_md5`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bakongToken}`,
        "X-Device-Id": "protech-cloudflare-worker",
        "X-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({ md5: md5Hash }),
    });
    let data = await resp.json().catch(() => ({}));
    if (resp.status === 401 || data?.errorCode === 6) {
      const renewResp = await fetch(`${baseUrl}/v1/renew_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hengly9723@gmail.com" }),
      });
      const renewData = await renewResp.json().catch(() => ({}));
      if (renewData?.data?.token) {
        bakongToken = renewData.data.token;
        resp = await fetch(`${baseUrl}/v1/check_transaction_by_md5`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bakongToken}`,
            "X-Device-Id": "protech-cloudflare-worker",
            "X-Request-Id": crypto.randomUUID(),
          },
          body: JSON.stringify({ md5: md5Hash }),
        });
        data = await resp.json().catch(() => ({}));
      }
    }
    const paid = data?.responseCode === 0 && Boolean(data?.data);
    return { paid, response_code: data?.responseCode ?? null, raw: data };
  } catch (e) {
    return { paid: false, response_code: null, error: String(e) };
  }
}

// ==========================================
// Token & Auth Helpers
// ==========================================
function formatUserRow(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name:
      u.full_name ||
      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
      u.email.split("@")[0],
    first_name: u.first_name || "",
    last_name: u.last_name || "",
    phone: u.phone || "",
    avatar_url: u.avatar_url || null,
    role: u.role || (u.is_superuser || u.is_staff ? "admin" : "user"),
    roles: [],
    status: u.status || "active",
    is_active: Boolean(u.is_active),
    is_staff: Boolean(u.is_staff),
    is_superuser: Boolean(u.is_superuser),
    is_email_verified: Boolean(u.is_email_verified),
    permissions: [],
    last_login_at: u.last_login_at || null,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

function makeTokens(user) {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          user_id: user.id,
          email: user.email,
          exp: Math.floor(Date.now() / 1000) + 7 * 86400,
        })
      )
    )
  );
  const token = `cf.${payload}.sig`;
  return {
    access: token,
    refresh: token,
    access_token: token,
    refresh_token: token,
  };
}

async function getUserFromRequest(request, db) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
      const uid = decoded.user_id || decoded.sub || decoded.id;
      const email = decoded.email;
      let row = null;
      if (uid) {
        row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(String(uid)).first();
      }
      if (!row && email) {
        row = await db
          .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
          .bind(String(email))
          .first();
      }
      return formatUserRow(row);
    }
  } catch (_) {}
  return null;
}

function decodeJwtPayload(jwt) {
  try {
    const parts = String(jwt).split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch (_) {
    return null;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

const safeJsonParse = (str, fallback = {}) => {
  if (!str) return fallback;
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
};

// ==========================================
// D1 Query & Serialization Helpers
// ==========================================
async function getCategoriesFlat(db) {
  const { results } = await db
    .prepare("SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC")
    .all();
  return (results || []).map((c) => ({
    id: c.id,
    parent: c.parent_id || null,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image_url: c.image_url,
    is_active: Boolean(c.is_active),
    sort_order: Number(c.sort_order || 0),
    children: [],
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
}

async function getCategoriesTree(db) {
  const flat = await getCategoriesFlat(db);
  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parent && byId.has(c.parent)) {
      byId.get(c.parent).children.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

async function getBrandsList(db) {
  const { results } = await db.prepare("SELECT * FROM brands ORDER BY name ASC").all();
  return (results || []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description || "",
    logo_url: b.logo_url || "",
    website_url: b.website_url || "",
    is_active: Boolean(b.is_active),
    created_at: b.created_at,
    updated_at: b.updated_at,
  }));
}

async function getProductTypesList(db) {
  const { results } = await db.prepare("SELECT * FROM product_types ORDER BY name ASC").all();
  return (results || []).map((t) => ({
    id: t.id,
    name: t.name,
    requires_shipping: Boolean(t.requires_shipping),
    requires_stock: Boolean(t.requires_stock),
    description: t.description || "",
    created_at: t.created_at,
  }));
}

async function getAllProductsHydrated(db) {
  const [
    { results: prodRows },
    { results: varRows },
    { results: imgRows },
    { results: stockRows },
    brands,
    catsFlat,
    types,
  ] = await Promise.all([
    db.prepare("SELECT * FROM products ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM product_variants ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM product_images ORDER BY is_primary DESC, sort_order ASC, created_at ASC").all(),
    db.prepare("SELECT * FROM stock").all(),
    getBrandsList(db),
    getCategoriesFlat(db),
    getProductTypesList(db),
  ]);

  const brandMap = new Map(brands.map((b) => [String(b.id), b]));
  const catMap = new Map(catsFlat.map((c) => [String(c.id), c]));
  const typeMap = new Map(types.map((t) => [String(t.id), t]));
  const stockByVar = new Map((stockRows || []).map((s) => [String(s.variant_id), s]));

  const imgsByProd = new Map();
  for (const img of imgRows || []) {
    const formatted = {
      id: img.id,
      product: img.product_id,
      variant: img.variant_id || null,
      image_url: img.image_url,
      alt_text: img.alt_text || "",
      sort_order: Number(img.sort_order || 0),
      is_primary: Boolean(img.is_primary),
      created_at: img.created_at,
    };
    const pid = String(img.product_id);
    if (!imgsByProd.has(pid)) imgsByProd.set(pid, []);
    imgsByProd.get(pid).push(formatted);
  }

  const varsByProd = new Map();
  const allVariants = [];
  const prodById = new Map((prodRows || []).map((p) => [String(p.id), p]));

  for (const v of varRows || []) {
    const pid = String(v.product_id);
    const parentRow = prodById.get(pid);
    if (!parentRow) continue; // Only include variants with an existing product

    const brandObj = brandMap.get(String(parentRow.brand_id)) || null;
    const catObj = catMap.get(String(parentRow.category_id)) || null;
    const typeObj = typeMap.get(String(parentRow.type_id)) || types[0] || null;
    const prodImgs = imgsByProd.get(pid) || [];
    const varSpecificImgs = prodImgs.filter((i) => String(i.variant) === String(v.id));
    const effectiveImgs = varSpecificImgs.length > 0 ? varSpecificImgs : prodImgs;
    const primaryImg =
      varSpecificImgs.find((i) => i.is_primary) ||
      varSpecificImgs[0] ||
      prodImgs.find((i) => i.is_primary) ||
      prodImgs[0] ||
      null;

    const stockRec = stockByVar.get(String(v.id));
    const qtyAvail = stockRec ? Number(stockRec.quantity_available) : 0;

    const hydratedVar = {
      id: v.id,
      product: pid,
      product_id: pid,
      product_name: parentRow.name,
      product_slug: parentRow.slug,
      sku: v.sku,
      barcode: v.barcode || "",
      name: v.name || parentRow.name,
      price: String(v.price || "0.00"),
      cost_price: String(v.cost_price || "0.00"),
      compare_at_price: String(v.compare_at_price || v.price || "0.00"),
      effective_compare_at_price: Number(v.compare_at_price || v.price || 0),
      weight: String(v.weight || "1.000"),
      status: v.status || "active",
      specifications: safeJsonParse(v.specifications, {}),
      brand: brandObj,
      brand_id: brandObj?.id || null,
      brand_name: brandObj?.name || "",
      category: catObj,
      category_id: catObj?.id || null,
      category_name: catObj?.name || "",
      type_name: typeObj?.name || "Physical",
      is_featured: Boolean(parentRow.is_featured),
      primary_image: primaryImg,
      images: effectiveImgs,
      in_stock: qtyAvail > 0,
      stock_quantity: qtyAvail,
      created_at: v.created_at,
      updated_at: v.updated_at,
    };

    allVariants.push(hydratedVar);
    if (!varsByProd.has(pid)) varsByProd.set(pid, []);
    varsByProd.get(pid).push(hydratedVar);
  }

  const productList = [];
  const productDetailsMap = new Map();

  for (const p of prodRows || []) {
    const pid = String(p.id);
    const brandObj = brandMap.get(String(p.brand_id)) || null;
    const catObj = catMap.get(String(p.category_id)) || null;
    const typeObj = typeMap.get(String(p.type_id)) || types[0] || null;
    const pVars = varsByProd.get(pid) || [];
    const pImgs = imgsByProd.get(pid) || [];
    const primaryImg = pImgs.find((i) => i.is_primary) || pImgs[0] || null;

    const effectivePrice =
      pVars.length > 0 && Number(p.base_price || 0) === 0
        ? String(pVars[0].price)
        : String(p.base_price || pVars[0]?.price || "0.00");
    const effectiveCompare =
      pVars.length > 0 && Number(p.compare_at_price || 0) === 0
        ? String(pVars[0].compare_at_price || pVars[0].price)
        : String(p.compare_at_price || effectivePrice);
    const effectiveSku = p.sku || pVars[0]?.sku || "";

    const listItem = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: effectiveSku,
      short_description: p.short_description || "",
      base_price: effectivePrice,
      compare_at_price: effectiveCompare,
      currency: p.currency || "USD",
      status: p.status || "active",
      is_featured: Boolean(p.is_featured),
      is_active: Boolean(p.is_active),
      brand: brandObj?.id || null,
      brand_id: brandObj?.id || null,
      brand_name: brandObj?.name || "",
      category: catObj?.id || null,
      category_id: catObj?.id || null,
      category_name: catObj?.name || "",
      type: typeObj?.id || null,
      type_id: typeObj?.id || null,
      type_name: typeObj?.name || "Physical",
      primary_image: primaryImg,
      variants_count: pVars.length,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };

    const detailItem = {
      ...listItem,
      description: p.description || "",
      cost_price: String(p.cost_price || pVars[0]?.cost_price || "0.00"),
      warranty_months: p.warranty_months ?? 12,
      weight: String(p.weight || pVars[0]?.weight || "1.000"),
      brand: brandObj,
      category: catObj,
      type: typeObj,
      variants: pVars,
      images: pImgs,
      specifications: [],
    };

    productList.push(listItem);
    productDetailsMap.set(pid, detailItem);
    if (p.slug) productDetailsMap.set(String(p.slug), detailItem);
  }

  return {
    products: productList,
    productDetailsMap,
    variants: allVariants,
    categoriesFlat: catsFlat,
    brands,
    types,
  };
}

async function getPromotionsHydrated(db, productsList = null) {
  const prods = productsList || (await getAllProductsHydrated(db)).products;
  const prodMap = new Map(prods.map((p) => [String(p.id), p]));

  const [{ results: promoRows }, { results: linkRows }] = await Promise.all([
    db.prepare("SELECT * FROM promotions ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM promotion_products").all(),
  ]);

  const linksByPromo = new Map();
  for (const l of linkRows || []) {
    const pid = String(l.promotion_id);
    if (!linksByPromo.has(pid)) linksByPromo.set(pid, []);
    const matched = prodMap.get(String(l.product_id));
    if (matched) linksByPromo.get(pid).push(matched);
  }

  return (promoRows || []).map((r) => {
    const linked = linksByPromo.get(String(r.id)) || [];
    return {
      id: r.id,
      name: r.name,
      description: r.description || "",
      type: r.type || "seasonal",
      banner_image_url: r.banner_image_url || "",
      bannerImageUrl: r.banner_image_url || "",
      discount_type: r.discount_type || "percentage",
      discountType: r.discount_type || "percentage",
      discount_value: String(r.discount_value || "0.00"),
      discountValue: String(r.discount_value || "0.00"),
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      is_active: Boolean(r.is_active),
      products: linked,
      featuredProducts: linked,
      products_count: linked.length,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

function getVariantPromoPrice(variant, activePromos) {
  const basePrice = Number(variant.price || 0);
  const rawCompare = Number(variant.compare_at_price || 0);
  const origPrice = rawCompare > basePrice ? rawCompare : basePrice;

  const activePromo = (activePromos || []).find(
    (p) =>
      p.is_active &&
      (p.products || []).some(
        (prod) => String(prod.id) === String(variant.product_id || variant.product)
      )
  );
  if (activePromo) {
    const dVal = Number(activePromo.discount_value || 0);
    const dType = activePromo.discount_type || "percentage";
    if (dVal > 0) {
      let finalP = basePrice;
      if (dType === "percentage") {
        finalP = Math.max(0, basePrice * (1 - dVal / 100));
      } else {
        finalP = Math.max(0, basePrice - dVal);
      }
      return {
        unit_price: finalP.toFixed(2),
        original_price: basePrice.toFixed(2),
        has_discount: finalP < basePrice,
        discount_badge:
          dType === "percentage" ? `-${Math.round(dVal)}% OFF` : `-$${dVal.toFixed(2)} OFF`,
      };
    }
  }
  return {
    unit_price: basePrice.toFixed(2),
    original_price: origPrice.toFixed(2),
    has_discount: basePrice < origPrice,
    discount_badge:
      origPrice > basePrice
        ? `-${Math.round(((origPrice - basePrice) / origPrice) * 100)}% OFF`
        : "",
  };
}

async function getOrCreateCart(db, user, sessionId, createIfMissing = true) {
  let cart = null;
  if (user) {
    cart = await db
      .prepare("SELECT * FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1")
      .bind(user.id)
      .first();
  }
  if (!cart) {
    cart = await db
      .prepare("SELECT * FROM carts WHERE session_id = ? AND status = 'active' LIMIT 1")
      .bind(sessionId)
      .first();
  }
  if (!cart && createIfMissing) {
    const cid = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO carts (id, user_id, session_id, status, currency, created_at, updated_at) VALUES (?, ?, ?, 'active', 'USD', ?, ?)"
      )
      .bind(cid, user ? user.id : null, sessionId, now, now)
      .run();
    cart = {
      id: cid,
      user_id: user ? user.id : null,
      session_id: sessionId,
      status: "active",
      currency: "USD",
      created_at: now,
      updated_at: now,
    };
  }
  return cart;
}

async function buildCartResponseD1(db, user, request) {
  const sid = request.headers.get("X-Session-ID") || "default_guest";
  const cart = await getOrCreateCart(db, user, sid, false);
  if (!cart) {
    return {
      id: null,
      user: user ? user.id : null,
      session_id: sid,
      status: "active",
      currency: "USD",
      total_items: 0,
      subtotal: "0.00",
      items: [],
      created_at: null,
      updated_at: new Date().toISOString(),
    };
  }
  const [{ results: itemRows }, catalog, allPromos] = await Promise.all([
    db
      .prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY created_at ASC")
      .bind(cart.id)
      .all(),
    getAllProductsHydrated(db),
    getPromotionsHydrated(db),
  ]);

  const activePromos = allPromos.filter((p) => p.is_active);
  const varMap = new Map(catalog.variants.map((v) => [String(v.id), v]));

  let totalItems = 0;
  let subtotalNum = 0;
  const enrichedItems = [];

  for (const item of itemRows || []) {
    const v = varMap.get(String(item.variant_id));
    if (!v) {
      // Clean up orphaned cart item if variant was deleted
      await db.prepare("DELETE FROM cart_items WHERE id = ?").bind(item.id).run();
      continue;
    }
    const pricing = getVariantPromoPrice(v, activePromos);
    const unitPrice = Number(pricing.unit_price);
    const lineTotal = unitPrice * Number(item.quantity);
    totalItems += Number(item.quantity);
    subtotalNum += lineTotal;

    enrichedItems.push({
      id: item.id,
      variant: v.id,
      variant_sku: v.sku || "",
      variant_name: v.name || "",
      product_id: v.product_id,
      product_name: v.product_name || "",
      product_slug: v.product_slug || "",
      product_image: v.primary_image?.image_url || null,
      unit_price: unitPrice.toFixed(2),
      original_price: pricing.original_price,
      has_discount: pricing.has_discount,
      discount_badge: pricing.discount_badge,
      quantity: Number(item.quantity),
      line_total: lineTotal.toFixed(2),
      available_stock: v.stock_quantity,
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
  }

  return {
    id: cart.id,
    user: user ? user.id : null,
    session_id: sid,
    status: "active",
    currency: "USD",
    total_items: totalItems,
    subtotal: subtotalNum.toFixed(2),
    items: enrichedItems,
    created_at: cart.created_at,
    updated_at: new Date().toISOString(),
  };
}

async function getOrdersHydrated(db, filters = {}) {
  let sql = "SELECT o.*, u.email as user_email FROM orders o LEFT JOIN users u ON u.id = o.user_id";
  const conds = [];
  const binds = [];
  if (filters.status) {
    conds.push("o.status = ?");
    binds.push(filters.status);
  }
  if (filters.payment_status) {
    conds.push("o.payment_status = ?");
    binds.push(filters.payment_status);
  }
  if (filters.orderIdOrNumber) {
    conds.push("(o.id = ? OR o.order_number = ?)");
    binds.push(filters.orderIdOrNumber, filters.orderIdOrNumber);
  }
  if (conds.length > 0) {
    sql += " WHERE " + conds.join(" AND ");
  }
  sql += " ORDER BY o.created_at DESC";

  const [
    { results: orderRows },
    { results: itemRows },
    { results: payRows },
    { results: shipRows },
    { results: refundRows },
    { results: returnRows },
  ] = await Promise.all([
    db.prepare(sql).bind(...binds).all(),
    db.prepare("SELECT * FROM order_items").all(),
    db.prepare("SELECT * FROM payments ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM shipments ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM refunds ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all(),
  ]);

  const group = (rows) => {
    const m = new Map();
    for (const r of rows || []) {
      const oid = String(r.order_id);
      if (!m.has(oid)) m.set(oid, []);
      m.get(oid).push(r);
    }
    return m;
  };

  const itemsMap = group(itemRows);
  const paysMap = group(payRows);
  const shipsMap = group(shipRows);
  const refundsMap = group(refundRows);
  const returnsMap = group(returnRows);

  return (orderRows || []).map((o) => {
    const oid = String(o.id);
    const items = (itemsMap.get(oid) || []).map((i) => ({
      id: i.id,
      product: i.product_id,
      variant: i.variant_id,
      product_name_snapshot: i.product_name_snapshot,
      sku_snapshot: i.sku_snapshot,
      variant_snapshot: safeJsonParse(i.variant_snapshot, {}),
      unit_price: i.unit_price,
      quantity: Number(i.quantity),
      discount: i.discount,
      tax: i.tax,
      total: i.total,
    }));
    const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);
    return {
      id: o.id,
      order_number: o.order_number,
      user: o.user_id,
      guest_email: o.guest_email || o.user_email || "",
      customer_email: o.user_email || o.guest_email || "",
      status: o.status,
      payment_method: o.payment_method || "bakong_khqr",
      payment_status: o.payment_status,
      fulfillment_status: o.fulfillment_status,
      currency: o.currency || "USD",
      subtotal: o.subtotal,
      discount: o.discount,
      shipping_cost: o.shipping_cost,
      tax: o.tax,
      total: o.total,
      items_count: totalQty,
      shipping_address_snapshot: safeJsonParse(o.shipping_address_snapshot, {}),
      billing_address_snapshot: safeJsonParse(o.billing_address_snapshot, {}),
      items,
      payments: (paysMap.get(oid) || []).map((p) => ({
        ...p,
        order: p.order_id,
        gateway_response: safeJsonParse(p.gateway_response, {}),
      })),
      shipments: (shipsMap.get(oid) || []).map((s) => ({ ...s, order: s.order_id })),
      refunds: (refundsMap.get(oid) || []).map((r) => ({ ...r, order: r.order_id })),
      returns: (returnsMap.get(oid) || []).map((r) => ({ ...r, order: r.order_id })),
      created_at: o.created_at,
      updated_at: o.updated_at,
    };
  });
}

// ==========================================
// Main Cloudflare Worker Fetch Handler
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (!path.startsWith("/api/") && path !== "/api") {
      return env.ASSETS.fetch(request);
    }

    const db = env.DB;
    if (!db) {
      return jsonResponse(
        { error: "Cloudflare D1 database binding (env.DB) is not configured." },
        500
      );
    }

    await ensureD1(db);

    const method = request.method.toUpperCase();
    const apiPath = path.replace(/^\/api\/?/, "").replace(/\/+$/, "");
    const user = await getUserFromRequest(request, db);
    const sid = request.headers.get("X-Session-ID") || "default_guest";

    let body = {};
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const ct = request.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          body = await request.json();
        }
      } catch (_) {}
    }

    // --- AUTH & USERS ---
    if (apiPath === "auth/login" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      let row = await db
        .prepare("SELECT * FROM users WHERE lower(email) = ?")
        .bind(email)
        .first();
      if (!row && email) {
        const id = crypto.randomUUID();
        const isAdmin = email === "hengly9723@gmail.com" ? 1 : 0;
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO users (id, email, password_hash, full_name, role, status, is_active, is_staff, is_superuser, is_email_verified, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, 1, ?, ?)`
          )
          .bind(id, email, password, email.split("@")[0], isAdmin ? "admin" : "user", isAdmin, isAdmin, now, now)
          .run();
        row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      }
      if (!row) {
        return jsonResponse({ error: "Invalid email or password." }, 401);
      }
      const now = new Date().toISOString();
      if (password && (!row.password_hash || row.password_hash === "pbkdf2_sha256$admin")) {
        await db
          .prepare("UPDATE users SET password_hash = ?, last_login_at = ?, updated_at = ? WHERE id = ?")
          .bind(password, now, now, row.id)
          .run();
      } else {
        await db
          .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
          .bind(now, row.id)
          .run();
      }
      const formatted = formatUserRow(row);
      const tokens = makeTokens(formatted);
      return jsonResponse({
        message: "Login successful!",
        user: formatted,
        tokens,
        ...tokens,
      });
    }

    if (apiPath === "auth/google" && method === "POST") {
      const jwt = body.token || body.credential;
      const decoded = decodeJwtPayload(jwt) || {};
      const email = (decoded.email || "hengly9723@gmail.com").toLowerCase();
      const name = decoded.name || email.split("@")[0];
      const picture = decoded.picture || null;
      const isAdmin = email === "hengly9723@gmail.com" ? 1 : 0;
      const now = new Date().toISOString();

      let row = await db
        .prepare("SELECT * FROM users WHERE lower(email) = ?")
        .bind(email)
        .first();
      if (!row) {
        const id = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO users (id, email, full_name, avatar_url, role, status, is_active, is_staff, is_superuser, is_email_verified, last_login_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, 1, ?, ?, ?)`
          )
          .bind(id, email, name, picture, isAdmin ? "admin" : "user", isAdmin, isAdmin, now, now, now)
          .run();
        row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      } else {
        await db
          .prepare("UPDATE users SET last_login_at = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
          .bind(now, picture, row.id)
          .run();
        row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(row.id).first();
      }
      const formatted = formatUserRow(row);
      const tokens = makeTokens(formatted);
      return jsonResponse({
        message: "Google login successful!",
        user: formatted,
        tokens,
        ...tokens,
      });
    }

    if (apiPath === "auth/register" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email) return jsonResponse({ error: "Email is required." }, 400);
      const fullName =
        body.full_name ||
        [body.first_name, body.last_name].filter(Boolean).join(" ") ||
        email.split("@")[0];
      const now = new Date().toISOString();

      const existing = await db
        .prepare("SELECT * FROM users WHERE lower(email) = ?")
        .bind(email)
        .first();
      if (existing) {
        // Allow claiming/setting password on the pre-seeded admin account or unactivated account
        if (
          email === "hengly9723@gmail.com" ||
          !existing.password_hash ||
          existing.password_hash === "pbkdf2_sha256$admin"
        ) {
          await db
            .prepare(
              `UPDATE users SET
                 password_hash = ?,
                 full_name = COALESCE(NULLIF(?, ''), full_name),
                 last_login_at = ?,
                 updated_at = ?
               WHERE id = ?`
            )
            .bind(password, fullName, now, now, existing.id)
            .run();
          const updatedRow = await db.prepare("SELECT * FROM users WHERE id = ?").bind(existing.id).first();
          const formatted = formatUserRow(updatedRow);
          const tokens = makeTokens(formatted);
          return jsonResponse({ message: "Registration successful!", user: formatted, tokens, ...tokens }, 201);
        }
        return jsonResponse({ error: "User with this email already exists. Please sign in instead." }, 400);
      }
      const id = crypto.randomUUID();
      const isAdmin = email === "hengly9723@gmail.com" ? 1 : 0;
      await db
        .prepare(
          `INSERT INTO users (id, email, password_hash, full_name, first_name, last_name, role, status, is_active, is_staff, is_superuser, is_email_verified, last_login_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
          id,
          email,
          password,
          fullName,
          body.first_name || "",
          body.last_name || "",
          isAdmin ? "admin" : "user",
          isAdmin,
          isAdmin,
          now,
          now,
          now
        )
        .run();
      const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      const formatted = formatUserRow(row);
      const tokens = makeTokens(formatted);
      return jsonResponse({ message: "Registration successful!", user: formatted, tokens, ...tokens }, 201);
    }

    if (apiPath === "auth/request-password-reset" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return jsonResponse({ error: "Email is required." }, 400);
      const resetToken = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date(Date.now() + 3600 * 1000).toISOString();
      const now = new Date().toISOString();
      const row = await db.prepare("SELECT * FROM users WHERE lower(email) = ?").bind(email).first();
      if (row) {
        await db
          .prepare("UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = ? WHERE id = ?")
          .bind(resetToken, expires, now, row.id)
          .run();

        const frontendUrl = (env.FRONTEND_URL || url.origin).replace(/\/+$/, "");
        const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(row.email)}`;
        const recipientName = row.full_name || "there";
        const subject = "Password Reset Request - Protech Store";
        const textBody =
          `Hello ${recipientName},\n\n` +
          `You requested a password reset for your Protech Store account.\n\n` +
          `Your Reset Token:\n${resetToken}\n\n` +
          `Or click the link below to set a new password directly:\n${resetUrl}\n\n` +
          `This token will expire in 1 hour.\n` +
          `If you did not request this, please ignore this email.`;
        const htmlBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 16px; color: #111827;">
            <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 800;">Password Reset Request</h2>
            <p style="margin: 0 0 16px; font-size: 14px; color: #4b5563; line-height: 1.6;">
              Hello <strong>${recipientName}</strong>, you requested a password reset for your Protech Store account.
            </p>
            <div style="margin: 20px 0; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px;">
                Your Reset Token
              </div>
              <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #111827; word-break: break-all;">
                ${resetToken}
              </div>
            </div>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 10px;">
                Reset Password
              </a>
            </p>
            <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
              This token expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
        `;

        const smtpHost = env.EMAIL_HOST || "smtp.gmail.com";
        const smtpUser = env.EMAIL_HOST_USER || "hengly9723@gmail.com";
        const smtpPassword = env.EMAIL_HOST_PASSWORD || "acyuzizkjdtrtksq";

        try {
          if (env.RESEND_API_KEY) {
            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: env.DEFAULT_FROM_EMAIL || `Protech Store <onboarding@resend.dev>`,
                to: [row.email],
                subject,
                text: textBody,
                html: htmlBody,
              }),
            });
            if (!resendRes.ok) {
              const errText = await resendRes.text();
              throw new Error(`Resend API error: ${errText}`);
            }
          } else {
            try {
              await WorkerMailer.send(
                {
                  host: smtpHost,
                  port: Number(env.EMAIL_PORT || 587),
                  secure: false,
                  startTls: true,
                  authType: ["plain", "login"],
                  credentials: {
                    username: smtpUser,
                    password: smtpPassword,
                  },
                },
                {
                  from: { name: "Protech Store", email: smtpUser },
                  to: row.email,
                  subject,
                  text: textBody,
                  html: htmlBody,
                }
              );
            } catch (err587) {
              // Fallback to implicit TLS on port 465 if port 587 STARTTLS fails
              await WorkerMailer.send(
                {
                  host: smtpHost,
                  port: 465,
                  secure: true,
                  startTls: false,
                  authType: ["plain", "login"],
                  credentials: {
                    username: smtpUser,
                    password: smtpPassword,
                  },
                },
                {
                  from: { name: "Protech Store", email: smtpUser },
                  to: row.email,
                  subject,
                  text: textBody,
                  html: htmlBody,
                }
              );
            }
          }
        } catch (mailErr) {
          console.error("Failed to send password reset email:", mailErr);
          return jsonResponse(
            { error: `Failed to send password reset email: ${mailErr.message || String(mailErr)}` },
            500
          );
        }
      }
      return jsonResponse({
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    if (apiPath === "auth/reset-password" && method === "POST") {
      const token = String(body.token || "").trim();
      const newPassword = String(body.password || body.new_password || "");
      if (!token) {
        return jsonResponse({ error: "Reset token is required." }, 400);
      }
      if (!newPassword || newPassword.length < 8) {
        return jsonResponse({ error: "Password must be at least 8 characters long." }, 400);
      }
      const row = await db
        .prepare("SELECT * FROM users WHERE password_reset_token = ?")
        .bind(token)
        .first();
      if (!row) {
        return jsonResponse({ error: "Invalid or expired reset token." }, 400);
      }
      const now = new Date().toISOString();
      await db
        .prepare(
          "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = ? WHERE id = ?"
        )
        .bind(newPassword, now, row.id)
        .run();
      return jsonResponse({ message: "Password has been reset successfully. You can now sign in." });
    }

    if (apiPath === "auth/verify-email" && method === "POST") {
      return jsonResponse({ message: "Email verified successfully!" });
    }

    if (apiPath === "auth/refresh" && method === "POST") {
      let targetUser = user;
      if (!targetUser && body.refresh && body.refresh !== "undefined" && body.refresh !== "null") {
        const decoded = decodeJwtPayload(body.refresh);
        if (decoded) {
          const uid = decoded.user_id || decoded.sub || decoded.id;
          const email = decoded.email;
          let row = null;
          if (uid) {
            row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(String(uid)).first();
          }
          if (!row && email) {
            row = await db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").bind(String(email)).first();
          }
          targetUser = formatUserRow(row);
        }
      }
      if (!targetUser) {
        return jsonResponse({ error: "Invalid or expired refresh token." }, 401);
      }
      return jsonResponse(makeTokens(targetUser));
    }

    if (apiPath === "users/me") {
      if (!user) return jsonResponse({ error: "Authentication required." }, 401);
      if (method === "PATCH" || method === "PUT") {
        const now = new Date().toISOString();
        await db
          .prepare(
            `UPDATE users SET
               full_name = COALESCE(?, full_name),
               first_name = COALESCE(?, first_name),
               last_name = COALESCE(?, last_name),
               phone = COALESCE(?, phone),
               avatar_url = COALESCE(?, avatar_url),
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body.full_name ?? null,
            body.first_name ?? null,
            body.last_name ?? null,
            body.phone ?? null,
            body.avatar_url ?? null,
            now,
            user.id
          )
          .run();
        const updated = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
        return jsonResponse(formatUserRow(updated));
      }
      return jsonResponse(user);
    }

    // --- CATALOG: PRODUCTS ---
    if (apiPath === "products" && method === "GET") {
      const catalog = await getAllProductsHydrated(db);
      let list = [...catalog.products];
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const category = url.searchParams.get("category");
      const brand = url.searchParams.get("brand");
      const type = url.searchParams.get("type");
      const status = url.searchParams.get("status");
      const isFeatured = url.searchParams.get("is_featured");

      if (status) list = list.filter((p) => p.status === status);
      if (search) {
        list = list.filter(
          (p) =>
            (p.name || "").toLowerCase().includes(search) ||
            (p.sku || "").toLowerCase().includes(search) ||
            (p.brand_name || "").toLowerCase().includes(search)
        );
      }
      if (category) {
        list = list.filter(
          (p) =>
            String(p.category) === String(category) ||
            String(p.category_name).toLowerCase() === String(category).toLowerCase()
        );
      }
      if (brand) {
        list = list.filter(
          (p) =>
            String(p.brand) === String(brand) ||
            String(p.brand_name).toLowerCase() === String(brand).toLowerCase()
        );
      }
      if (type) {
        list = list.filter(
          (p) =>
            String(p.type) === String(type) ||
            String(p.type_name).toLowerCase() === String(type).toLowerCase()
        );
      }
      if (isFeatured === "true" || isFeatured === "1") {
        list = list.filter((p) => Boolean(p.is_featured));
      }

      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const pageSize = Math.max(1, parseInt(url.searchParams.get("page_size") || "12", 10));
      const start = (page - 1) * pageSize;
      const paged = list.slice(start, start + pageSize);

      return jsonResponse({
        count: list.length,
        next: start + pageSize < list.length ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null,
        results: paged,
      });
    }

    if (apiPath === "products" && method === "POST") {
      const pid = crypto.randomUUID();
      const brandId = body.brand_id || body.brand || null;
      const catId = body.category_id || body.category || null;
      let typeId = body.type_id || body.type || null;
      if (!typeId) {
        const defaultType = await db
          .prepare("SELECT id FROM product_types WHERE name = 'Physical' LIMIT 1")
          .first();
        typeId = defaultType?.id || null;
      }
      let baseSlug =
        body.slug ||
        (body.name || "product")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      if (!baseSlug) baseSlug = `product-${pid.slice(0, 8)}`;
      const existingSlug = await db
        .prepare("SELECT id FROM products WHERE slug = ?")
        .bind(baseSlug)
        .first();
      const slug = existingSlug ? `${baseSlug}-${pid.slice(0, 6)}` : baseSlug;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO products (
            id, brand_id, category_id, type_id, name, slug, sku, short_description, description,
            cost_price, base_price, compare_at_price, currency, warranty_months, status,
            is_featured, is_active, weight, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          pid,
          brandId,
          catId,
          typeId,
          body.name || "",
          slug,
          body.sku || null,
          body.short_description || "",
          body.description || "",
          String(body.cost_price || "0.00"),
          String(body.base_price || "0.00"),
          String(body.compare_at_price || body.base_price || "0.00"),
          body.currency || "USD",
          Number(body.warranty_months || 12),
          body.status || "active",
          body.is_featured ? 1 : 0,
          body.is_active === false ? 0 : 1,
          String(body.weight || "1.000"),
          now,
          now
        )
        .run();

      const catalog = await getAllProductsHydrated(db);
      return jsonResponse(catalog.productDetailsMap.get(pid), 201);
    }

    const prodReviewsMatch = apiPath.match(/^products\/([^/]+)\/reviews$/);
    if (prodReviewsMatch) {
      const pid = prodReviewsMatch[1];
      if (method === "GET") {
        const [{ results: revRows }, prodRow] = await Promise.all([
          db
            .prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC")
            .bind(pid)
            .all(),
          db.prepare("SELECT name FROM products WHERE id = ?").bind(pid).first(),
        ]);
        const list = (revRows || []).map((r) => ({
          ...r,
          product: r.product_id,
          user: r.user_id,
          is_verified_purchase: Boolean(r.is_verified_purchase),
        }));
        return jsonResponse({
          product_id: pid,
          product_name: prodRow?.name || "",
          reviews_count: list.length,
          reviews: list,
        });
      }
      if (method === "POST") {
        const rid = crypto.randomUUID();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO reviews (id, product_id, user_id, user_name, rating, title, content, is_verified_purchase, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'approved', ?, ?)`
          )
          .bind(
            rid,
            pid,
            user?.id || null,
            user?.full_name || "Customer",
            Number(body.rating || 5),
            body.title || "",
            body.content || "",
            now,
            now
          )
          .run();
        const row = await db.prepare("SELECT * FROM reviews WHERE id = ?").bind(rid).first();
        return jsonResponse({ message: "Review submitted!", review: row }, 201);
      }
    }

    const prodMatch = apiPath.match(/^products\/([^/]+)$/);
    if (prodMatch) {
      const idOrSlug = prodMatch[1];
      if (method === "GET") {
        const catalog = await getAllProductsHydrated(db);
        const detail = catalog.productDetailsMap.get(idOrSlug);
        if (!detail) return jsonResponse({ error: "Product not found." }, 404);
        return jsonResponse(detail);
      }
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM products WHERE id = ? OR slug = ?")
          .bind(idOrSlug, idOrSlug)
          .first();
        if (!existing) return jsonResponse({ error: "Product not found." }, 404);

        const brandId =
          "brand_id" in body ? body.brand_id || null : "brand" in body ? body.brand || null : existing.brand_id;
        const catId =
          "category_id" in body ? body.category_id || null : "category" in body ? body.category || null : existing.category_id;
        const typeId =
          "type_id" in body ? body.type_id || null : "type" in body ? body.type || null : existing.type_id;
        const now = new Date().toISOString();

        await db
          .prepare(
            `UPDATE products SET
               brand_id = ?,
               category_id = ?,
               type_id = ?,
               name = ?,
               slug = ?,
               short_description = ?,
               description = ?,
               currency = ?,
               warranty_months = ?,
               status = ?,
               is_featured = ?,
               is_active = ?,
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            brandId,
            catId,
            typeId,
            body.name ?? existing.name,
            body.slug || existing.slug,
            body.short_description ?? existing.short_description,
            body.description ?? existing.description,
            body.currency ?? existing.currency,
            body.warranty_months !== undefined ? Number(body.warranty_months) : existing.warranty_months,
            body.status ?? existing.status,
            body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured,
            body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
            now,
            existing.id
          )
          .run();

        const catalog = await getAllProductsHydrated(db);
        return jsonResponse(catalog.productDetailsMap.get(existing.id));
      }
      if (method === "DELETE") {
        const existing = await db
          .prepare("SELECT id FROM products WHERE id = ? OR slug = ?")
          .bind(idOrSlug, idOrSlug)
          .first();
        if (existing) {
          // Foreign keys ON DELETE CASCADE automatically deletes variants, images, stock, cart_items, wishlist_items
          await db.prepare("DELETE FROM products WHERE id = ?").bind(existing.id).run();
        }
        return jsonResponse({ deleted: true });
      }
    }

    // --- CATALOG: VARIANTS ---
    if (apiPath === "variants/generate-barcode" && method === "GET") {
      const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
      return jsonResponse({ barcode: "2" + randomDigits.slice(1) });
    }

    if (apiPath === "variants" && method === "POST") {
      const vid = crypto.randomUUID();
      const pid = String(body.product || body.product_id || "");
      const prodRow = await db.prepare("SELECT * FROM products WHERE id = ?").bind(pid).first();
      if (!prodRow) return jsonResponse({ error: "Parent product not found." }, 404);

      const now = new Date().toISOString();
      const sku = String(body.sku || `SKU-${vid.slice(0, 8).toUpperCase()}`).trim();
      const price = String(body.price || prodRow.base_price || "0.00");
      const compareAt = String(body.compare_at_price || price);
      const costPrice = String(body.cost_price || "0.00");
      const weight = String(body.weight || "1.000");
      const specsJson = JSON.stringify(body.specifications || {});

      await db.batch([
        db
          .prepare(
            `INSERT INTO product_variants (
              id, product_id, sku, barcode, name, price, cost_price, compare_at_price,
              weight, status, specifications, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            vid,
            pid,
            sku,
            body.barcode || "",
            body.name || prodRow.name,
            price,
            costPrice,
            compareAt,
            weight,
            body.status || "active",
            specsJson,
            now,
            now
          ),
        db
          .prepare(
            `INSERT INTO stock (
              id, variant_id, quantity_available, quantity_reserved, quantity_damaged, reorder_level, updated_at
            ) VALUES (?, ?, ?, 0, 0, 5, ?)`
          )
          .bind(crypto.randomUUID(), vid, Number(body.stock_quantity ?? 25), now),
        db
          .prepare(
            `UPDATE products SET
               base_price = CASE WHEN base_price = '0.00' OR base_price = '0' THEN ? ELSE base_price END,
               compare_at_price = CASE WHEN compare_at_price = '0.00' OR compare_at_price = '0' THEN ? ELSE compare_at_price END,
               sku = COALESCE(sku, ?),
               updated_at = ?
             WHERE id = ?`
          )
          .bind(price, compareAt, sku, now, pid),
      ]);

      const catalog = await getAllProductsHydrated(db);
      const created = catalog.variants.find((v) => String(v.id) === vid);
      return jsonResponse(created, 201);
    }

    if (apiPath === "variants" && method === "GET") {
      const catalog = await getAllProductsHydrated(db);
      let list = [...catalog.variants];
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const category = url.searchParams.get("category");
      const brand = url.searchParams.get("brand");
      const product = url.searchParams.get("product");
      const type = url.searchParams.get("type");
      const minPrice = url.searchParams.get("min_price");
      const maxPrice = url.searchParams.get("max_price");
      const inStock = url.searchParams.get("in_stock");
      const isFeatured = url.searchParams.get("is_featured");
      const ordering = url.searchParams.get("ordering");

      if (product) {
        list = list.filter((v) => String(v.product_id) === String(product));
      }
      if (search) {
        list = list.filter(
          (v) =>
            (v.name || "").toLowerCase().includes(search) ||
            (v.product_name || "").toLowerCase().includes(search) ||
            (v.sku || "").toLowerCase().includes(search) ||
            (v.brand_name || "").toLowerCase().includes(search)
        );
      }
      if (category) {
        const matchingCatIds = new Set([String(category)]);
        for (const c of catalog.categoriesFlat) {
          if (
            String(c.id) === String(category) ||
            String(c.slug).toLowerCase() === String(category).toLowerCase() ||
            String(c.name).toLowerCase() === String(category).toLowerCase()
          ) {
            matchingCatIds.add(String(c.id));
          }
        }
        for (const c of catalog.categoriesFlat) {
          if (c.parent && matchingCatIds.has(String(c.parent))) {
            matchingCatIds.add(String(c.id));
          }
        }
        list = list.filter(
          (v) =>
            matchingCatIds.has(String(v.category_id)) ||
            String(v.category_name || "").toLowerCase() === String(category).toLowerCase()
        );
      }
      if (brand) {
        const brandList = brand.split(",").map((b) => b.trim().toLowerCase());
        list = list.filter(
          (v) =>
            brandList.includes(String(v.brand_id || "").toLowerCase()) ||
            brandList.includes(String(v.brand_name || "").toLowerCase())
        );
      }
      if (type) {
        list = list.filter(
          (v) => String(v.type_name || "").toLowerCase() === String(type).toLowerCase()
        );
      }
      if (isFeatured === "true" || isFeatured === "1") {
        list = list.filter((v) => Boolean(v.is_featured));
      }
      if (minPrice !== null && minPrice !== "") {
        list = list.filter((v) => Number(v.price) >= Number(minPrice));
      }
      if (maxPrice !== null && maxPrice !== "") {
        list = list.filter((v) => Number(v.price) <= Number(maxPrice));
      }
      if (inStock === "true" || inStock === "1") {
        list = list.filter((v) => v.in_stock && Number(v.stock_quantity) > 0);
      }
      for (const [k, val] of url.searchParams.entries()) {
        if (k.startsWith("spec_") && val) {
          const specKey = k.slice(5).toLowerCase();
          const allowedVals = val.split(",").map((s) => s.trim().toLowerCase());
          list = list.filter((v) => {
            const entries = Object.entries(v.specifications || {});
            const found = entries.find(([sk]) => sk.toLowerCase() === specKey);
            return found && allowedVals.includes(String(found[1]).toLowerCase());
          });
        }
      }
      if (ordering === "price" || ordering === "base_price") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (ordering === "-price" || ordering === "-base_price") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
      } else if (ordering === "name") {
        list.sort((a, b) =>
          String(a.product_name || a.name).localeCompare(String(b.product_name || b.name))
        );
      } else if (ordering === "created_at") {
        list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      } else {
        list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      }

      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const pageSize = Math.max(1, parseInt(url.searchParams.get("page_size") || "12", 10));
      const start = (page - 1) * pageSize;
      const paged = list.slice(start, start + pageSize);

      return jsonResponse({
        count: list.length,
        next: start + pageSize < list.length ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null,
        results: paged,
      });
    }

    const varMatch = apiPath.match(/^variants\/([^/]+)$/);
    if (varMatch) {
      const vid = varMatch[1];
      if (method === "GET") {
        const catalog = await getAllProductsHydrated(db);
        const v = catalog.variants.find(
          (x) => String(x.id) === vid || String(x.sku) === vid
        );
        if (!v) return jsonResponse({ error: "Variant not found." }, 404);
        return jsonResponse(v);
      }
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM product_variants WHERE id = ?")
          .bind(vid)
          .first();
        if (!existing) return jsonResponse({ error: "Variant not found." }, 404);
        const now = new Date().toISOString();
        const nextPrice = body.price !== undefined ? String(body.price) : existing.price;
        const nextCompare =
          body.compare_at_price !== undefined
            ? String(body.compare_at_price || nextPrice)
            : existing.compare_at_price;
        const nextSpecs =
          body.specifications !== undefined
            ? JSON.stringify(body.specifications)
            : existing.specifications;

        await db
          .prepare(
            `UPDATE product_variants SET
               sku = ?,
               barcode = ?,
               name = ?,
               price = ?,
               cost_price = ?,
               compare_at_price = ?,
               weight = ?,
               status = ?,
               specifications = ?,
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body.sku ?? existing.sku,
            body.barcode ?? existing.barcode,
            body.name ?? existing.name,
            nextPrice,
            body.cost_price !== undefined ? String(body.cost_price) : existing.cost_price,
            nextCompare,
            body.weight !== undefined ? String(body.weight) : existing.weight,
            body.status ?? existing.status,
            nextSpecs,
            now,
            vid
          )
          .run();

        const catalog = await getAllProductsHydrated(db);
        return jsonResponse(catalog.variants.find((x) => String(x.id) === vid) || {});
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM product_variants WHERE id = ?").bind(vid).run();
        return jsonResponse({ deleted: true });
      }
    }

    // --- PRODUCT IMAGES ---
    if (apiPath === "product-images") {
      if (method === "GET") {
        const pid = url.searchParams.get("product");
        const { results } = await db
          .prepare(
            "SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC"
          )
          .bind(pid)
          .all();
        return jsonResponse(
          (results || []).map((i) => ({
            id: i.id,
            product: i.product_id,
            variant: i.variant_id || null,
            image_url: i.image_url,
            alt_text: i.alt_text || "",
            sort_order: Number(i.sort_order || 0),
            is_primary: Boolean(i.is_primary),
            created_at: i.created_at,
          }))
        );
      }
      if (method === "POST") {
        const iid = crypto.randomUUID();
        const pid = String(body.product || "");
        const isPrimary = body.is_primary ? 1 : 0;
        const now = new Date().toISOString();
        if (isPrimary) {
          await db
            .prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?")
            .bind(pid)
            .run();
        }
        await db
          .prepare(
            `INSERT INTO product_images (id, product_id, variant_id, image_url, alt_text, sort_order, is_primary, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            iid,
            pid,
            body.variant || null,
            body.image_url || "",
            body.alt_text || "",
            Number(body.sort_order ?? 0),
            isPrimary,
            now
          )
          .run();
        return jsonResponse(
          {
            id: iid,
            product: pid,
            variant: body.variant || null,
            image_url: body.image_url || "",
            alt_text: body.alt_text || "",
            sort_order: Number(body.sort_order ?? 0),
            is_primary: Boolean(isPrimary),
            created_at: now,
          },
          201
        );
      }
    }

    const prodImgMatch = apiPath.match(/^product-images\/([^/]+)$/);
    if (prodImgMatch) {
      const iid = prodImgMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM product_images WHERE id = ?")
          .bind(iid)
          .first();
        if (!existing) return jsonResponse({ error: "Image not found." }, 404);
        if (body.is_primary) {
          await db
            .prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?")
            .bind(existing.product_id)
            .run();
        }
        await db
          .prepare(
            `UPDATE product_images SET
               variant_id = ?,
               image_url = ?,
               alt_text = ?,
               sort_order = ?,
               is_primary = ?
             WHERE id = ?`
          )
          .bind(
            body.variant !== undefined ? body.variant || null : existing.variant_id,
            body.image_url ?? existing.image_url,
            body.alt_text ?? existing.alt_text,
            body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
            body.is_primary !== undefined ? (body.is_primary ? 1 : 0) : existing.is_primary,
            iid
          )
          .run();
        const updated = await db
          .prepare("SELECT * FROM product_images WHERE id = ?")
          .bind(iid)
          .first();
        return jsonResponse({
          id: updated.id,
          product: updated.product_id,
          variant: updated.variant_id || null,
          image_url: updated.image_url,
          alt_text: updated.alt_text || "",
          sort_order: Number(updated.sort_order || 0),
          is_primary: Boolean(updated.is_primary),
          created_at: updated.created_at,
        });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM product_images WHERE id = ?").bind(iid).run();
        return jsonResponse({ deleted: true });
      }
    }

    // --- CATEGORIES, BRANDS, PRODUCT TYPES, SPECS ---
    if (apiPath === "categories") {
      if (method === "GET") {
        const allFlat = url.searchParams.get("all_flat");
        const data =
          allFlat === "true" || allFlat === "1"
            ? await getCategoriesFlat(db)
            : await getCategoriesTree(db);
        return jsonResponse(data);
      }
      if (method === "POST") {
        const cid = crypto.randomUUID();
        const slug =
          body.slug ||
          (body.name || "category")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO categories (id, parent_id, name, slug, description, image_url, is_active, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            cid,
            body.parent || null,
            body.name || "",
            slug,
            body.description || "",
            body.image_url || null,
            body.is_active === false ? 0 : 1,
            Number(body.sort_order ?? 1),
            now,
            now
          )
          .run();
        const flat = await getCategoriesFlat(db);
        return jsonResponse(flat.find((c) => c.id === cid), 201);
      }
    }

    const catMatch = apiPath.match(/^categories\/([^/]+)$/);
    if (catMatch) {
      const cid = catMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM categories WHERE id = ?")
          .bind(cid)
          .first();
        if (!existing) return jsonResponse({ error: "Category not found." }, 404);
        await db
          .prepare(
            `UPDATE categories SET
               parent_id = ?,
               name = ?,
               slug = ?,
               description = ?,
               image_url = ?,
               is_active = ?,
               sort_order = ?,
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body.parent !== undefined ? body.parent || null : existing.parent_id,
            body.name ?? existing.name,
            body.slug || existing.slug,
            body.description ?? existing.description,
            body.image_url !== undefined ? body.image_url : existing.image_url,
            body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
            body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
            new Date().toISOString(),
            cid
          )
          .run();
        const flat = await getCategoriesFlat(db);
        return jsonResponse(flat.find((c) => c.id === cid) || {});
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM categories WHERE id = ?").bind(cid).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "brands") {
      if (method === "GET") return jsonResponse(await getBrandsList(db));
      if (method === "POST") {
        const bid = crypto.randomUUID();
        const slug =
          body.slug ||
          (body.name || "brand")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO brands (id, name, slug, description, logo_url, website_url, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            bid,
            body.name || "",
            slug,
            body.description || "",
            body.logo_url || "",
            body.website_url || "",
            body.is_active === false ? 0 : 1,
            now,
            now
          )
          .run();
        const brands = await getBrandsList(db);
        return jsonResponse(brands.find((b) => b.id === bid), 201);
      }
    }

    const brandMatch = apiPath.match(/^brands\/([^/]+)$/);
    if (brandMatch) {
      const bid = brandMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db.prepare("SELECT * FROM brands WHERE id = ?").bind(bid).first();
        if (!existing) return jsonResponse({ error: "Brand not found." }, 404);
        await db
          .prepare(
            `UPDATE brands SET name = ?, slug = ?, description = ?, logo_url = ?, website_url = ?, is_active = ?, updated_at = ? WHERE id = ?`
          )
          .bind(
            body.name ?? existing.name,
            body.slug || existing.slug,
            body.description ?? existing.description,
            body.logo_url ?? existing.logo_url,
            body.website_url ?? existing.website_url,
            body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
            new Date().toISOString(),
            bid
          )
          .run();
        const brands = await getBrandsList(db);
        return jsonResponse(brands.find((b) => b.id === bid) || {});
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM brands WHERE id = ?").bind(bid).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "product-types" && method === "GET") {
      return jsonResponse(await getProductTypesList(db));
    }

    if (apiPath === "specification-definitions") {
      if (method === "GET") {
        const [{ results: defs }, { results: opts }] = await Promise.all([
          db.prepare("SELECT * FROM specification_definitions ORDER BY sort_order ASC").all(),
          db.prepare("SELECT * FROM specification_options ORDER BY sort_order ASC").all(),
        ]);
        const optsByDef = new Map();
        for (const o of opts || []) {
          const did = String(o.definition_id);
          if (!optsByDef.has(did)) optsByDef.set(did, []);
          optsByDef.get(did).push({
            id: o.id,
            definition: o.definition_id,
            label: o.label,
            sort_order: Number(o.sort_order || 0),
          });
        }
        return jsonResponse(
          (defs || []).map((d) => ({
            id: d.id,
            category: d.category_id,
            name: d.name,
            slug: d.slug,
            data_type: d.data_type || "text",
            unit: d.unit,
            is_filterable: Boolean(d.is_filterable),
            is_required: Boolean(d.is_required),
            sort_order: Number(d.sort_order || 0),
            options: optsByDef.get(String(d.id)) || [],
          }))
        );
      }
      if (method === "POST") {
        const did = crypto.randomUUID();
        const slug =
          body.slug ||
          (body.name || "spec")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_");
        await db
          .prepare(
            `INSERT INTO specification_definitions (id, category_id, name, slug, data_type, unit, is_filterable, is_required, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            did,
            body.category || null,
            body.name || "",
            slug,
            body.data_type || "text",
            body.unit || null,
            body.is_filterable ? 1 : 0,
            body.is_required ? 1 : 0,
            Number(body.sort_order || 0)
          )
          .run();
        return jsonResponse(
          {
            id: did,
            category: body.category || null,
            name: body.name || "",
            slug,
            data_type: body.data_type || "text",
            unit: body.unit || null,
            is_filterable: Boolean(body.is_filterable),
            is_required: Boolean(body.is_required),
            sort_order: Number(body.sort_order || 0),
            options: [],
          },
          201
        );
      }
    }

    const specDefMatch = apiPath.match(/^specification-definitions\/([^/]+)$/);
    if (specDefMatch) {
      const did = specDefMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM specification_definitions WHERE id = ?")
          .bind(did)
          .first();
        if (!existing) return jsonResponse({ error: "Not found." }, 404);
        await db
          .prepare(
            `UPDATE specification_definitions SET name = ?, slug = ?, data_type = ?, unit = ?, is_filterable = ?, is_required = ?, sort_order = ? WHERE id = ?`
          )
          .bind(
            body.name ?? existing.name,
            body.slug ?? existing.slug,
            body.data_type ?? existing.data_type,
            body.unit !== undefined ? body.unit : existing.unit,
            body.is_filterable !== undefined ? (body.is_filterable ? 1 : 0) : existing.is_filterable,
            body.is_required !== undefined ? (body.is_required ? 1 : 0) : existing.is_required,
            body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
            did
          )
          .run();
        return jsonResponse({ id: did, ...body });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM specification_definitions WHERE id = ?").bind(did).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "specification-options") {
      if (method === "GET") {
        const defId = url.searchParams.get("definition");
        const stmt = defId
          ? db
              .prepare(
                "SELECT * FROM specification_options WHERE definition_id = ? ORDER BY sort_order ASC"
              )
              .bind(defId)
          : db.prepare("SELECT * FROM specification_options ORDER BY sort_order ASC");
        const { results } = await stmt.all();
        return jsonResponse(
          (results || []).map((o) => ({
            id: o.id,
            definition: o.definition_id,
            label: o.label,
            sort_order: Number(o.sort_order || 0),
          }))
        );
      }
      if (method === "POST") {
        const oid = crypto.randomUUID();
        const defId = body.definition || body.definition_id;
        await db
          .prepare(
            "INSERT INTO specification_options (id, definition_id, label, sort_order) VALUES (?, ?, ?, ?)"
          )
          .bind(oid, defId, body.label || "", Number(body.sort_order ?? 1))
          .run();
        return jsonResponse(
          {
            id: oid,
            definition: defId,
            label: body.label || "",
            sort_order: Number(body.sort_order ?? 1),
          },
          201
        );
      }
    }

    const specOptMatch = apiPath.match(/^specification-options\/([^/]+)$/);
    if (specOptMatch) {
      const oid = specOptMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM specification_options WHERE id = ?")
          .bind(oid)
          .first();
        if (!existing) return jsonResponse({ error: "Option not found." }, 404);
        await db
          .prepare("UPDATE specification_options SET label = ?, sort_order = ? WHERE id = ?")
          .bind(
            body.label ?? existing.label,
            body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
            oid
          )
          .run();
        return jsonResponse({
          id: oid,
          definition: existing.definition_id,
          label: body.label ?? existing.label,
          sort_order:
            body.sort_order !== undefined ? Number(body.sort_order) : Number(existing.sort_order),
        });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM specification_options WHERE id = ?").bind(oid).run();
        return jsonResponse({ deleted: true });
      }
    }

    // --- PROMOTIONS & DISCOUNT CODES ---
    if (apiPath === "promotions/active" && method === "GET") {
      const all = await getPromotionsHydrated(db);
      return jsonResponse(all.filter((p) => p.is_active));
    }

    if (apiPath === "promotions") {
      if (method === "GET") {
        return jsonResponse(await getPromotionsHydrated(db));
      }
      if (method === "POST") {
        const pid = crypto.randomUUID();
        const now = new Date().toISOString();
        const banner = body.banner_image_url || body.bannerImageUrl || "";
        const dType = body.discount_type || body.discountType || "percentage";
        const dVal = String(body.discount_value ?? body.discountValue ?? "0.00");
        await db
          .prepare(
            `INSERT INTO promotions (id, name, description, type, banner_image_url, discount_type, discount_value, starts_at, ends_at, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            pid,
            body.name || "",
            body.description || "",
            body.type || "seasonal",
            banner,
            dType,
            dVal,
            body.starts_at || now,
            body.ends_at || null,
            body.is_active === false ? 0 : 1,
            now,
            now
          )
          .run();
        const pIds = Array.isArray(body.product_ids) ? body.product_ids : [];
        if (pIds.length > 0) {
          await db.batch(
            pIds.map((prodId) =>
              db
                .prepare(
                  "INSERT OR IGNORE INTO promotion_products (promotion_id, product_id) VALUES (?, ?)"
                )
                .bind(pid, prodId)
            )
          );
        }
        const all = await getPromotionsHydrated(db);
        return jsonResponse(all.find((p) => p.id === pid), 201);
      }
    }

    const promoMatch = apiPath.match(/^promotions\/([^/]+)$/);
    if (promoMatch) {
      const pid = promoMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(pid).first();
        if (!existing) return jsonResponse({ error: "Promotion not found." }, 404);
        await db
          .prepare(
            `UPDATE promotions SET
               name = ?,
               description = ?,
               type = ?,
               banner_image_url = ?,
               discount_type = ?,
               discount_value = ?,
               starts_at = ?,
               ends_at = ?,
               is_active = ?,
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body.name ?? existing.name,
            body.description ?? existing.description,
            body.type ?? existing.type,
            body.banner_image_url ?? body.bannerImageUrl ?? existing.banner_image_url,
            body.discount_type ?? body.discountType ?? existing.discount_type,
            body.discount_value !== undefined
              ? String(body.discount_value)
              : existing.discount_value,
            body.starts_at !== undefined ? body.starts_at : existing.starts_at,
            body.ends_at !== undefined ? body.ends_at : existing.ends_at,
            body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
            new Date().toISOString(),
            pid
          )
          .run();
        if (Array.isArray(body.product_ids)) {
          await db.prepare("DELETE FROM promotion_products WHERE promotion_id = ?").bind(pid).run();
          if (body.product_ids.length > 0) {
            await db.batch(
              body.product_ids.map((prodId) =>
                db
                  .prepare(
                    "INSERT OR IGNORE INTO promotion_products (promotion_id, product_id) VALUES (?, ?)"
                  )
                  .bind(pid, prodId)
              )
            );
          }
        }
        const all = await getPromotionsHydrated(db);
        return jsonResponse(all.find((p) => p.id === pid) || {});
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM promotions WHERE id = ?").bind(pid).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "discount-codes") {
      if (method === "GET") {
        const { results } = await db
          .prepare("SELECT * FROM discount_codes ORDER BY created_at DESC")
          .all();
        return jsonResponse(
          (results || []).map((d) => ({ ...d, is_active: Boolean(d.is_active) }))
        );
      }
      if (method === "POST") {
        const dcid = crypto.randomUUID();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO discount_codes (
              id, code, type, value, minimum_order_value, maximum_discount,
              usage_limit, usage_count, per_customer_limit, starts_at, expires_at, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
          )
          .bind(
            dcid,
            String(body.code || "").trim().toUpperCase(),
            body.type || "percentage",
            String(body.value || "0.00"),
            body.minimum_order_value ? String(body.minimum_order_value) : null,
            body.maximum_discount ? String(body.maximum_discount) : null,
            body.usage_limit ? Number(body.usage_limit) : null,
            body.per_customer_limit ? Number(body.per_customer_limit) : null,
            body.starts_at || null,
            body.expires_at || null,
            body.is_active === false ? 0 : 1,
            now
          )
          .run();
        const row = await db
          .prepare("SELECT * FROM discount_codes WHERE id = ?")
          .bind(dcid)
          .first();
        return jsonResponse({ ...row, is_active: Boolean(row.is_active) }, 201);
      }
    }

    const dcMatch = apiPath.match(/^discount-codes\/([^/]+)$/);
    if (dcMatch && dcMatch[1] !== "validate") {
      const dcid = dcMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db
          .prepare("SELECT * FROM discount_codes WHERE id = ?")
          .bind(dcid)
          .first();
        if (!existing) return jsonResponse({ error: "Not found." }, 404);
        await db
          .prepare(
            `UPDATE discount_codes SET
               code = ?, type = ?, value = ?, minimum_order_value = ?, maximum_discount = ?,
               usage_limit = ?, per_customer_limit = ?, starts_at = ?, expires_at = ?, is_active = ?
             WHERE id = ?`
          )
          .bind(
            body.code ? String(body.code).toUpperCase() : existing.code,
            body.type ?? existing.type,
            body.value !== undefined ? String(body.value) : existing.value,
            body.minimum_order_value !== undefined
              ? body.minimum_order_value
              : existing.minimum_order_value,
            body.maximum_discount !== undefined ? body.maximum_discount : existing.maximum_discount,
            body.usage_limit !== undefined ? body.usage_limit : existing.usage_limit,
            body.per_customer_limit !== undefined
              ? body.per_customer_limit
              : existing.per_customer_limit,
            body.starts_at !== undefined ? body.starts_at : existing.starts_at,
            body.expires_at !== undefined ? body.expires_at : existing.expires_at,
            body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
            dcid
          )
          .run();
        const updated = await db
          .prepare("SELECT * FROM discount_codes WHERE id = ?")
          .bind(dcid)
          .first();
        return jsonResponse({ ...updated, is_active: Boolean(updated.is_active) });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM discount_codes WHERE id = ?").bind(dcid).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "discount-codes/validate" && method === "POST") {
      const codeStr = String(body.code || "").trim().toUpperCase();
      const cartTotal = Number(body.cart_total || 0);
      const disc = await db
        .prepare("SELECT * FROM discount_codes WHERE upper(code) = ? AND is_active = 1")
        .bind(codeStr)
        .first();
      if (!disc) {
        return jsonResponse({ valid: false, error: "Invalid or inactive discount code." }, 400);
      }
      const val = Number(disc.value || 0);
      let discAmount = disc.type === "percentage" ? (cartTotal * val) / 100 : val;
      if (disc.maximum_discount && Number(disc.maximum_discount) > 0) {
        discAmount = Math.min(discAmount, Number(disc.maximum_discount));
      }
      discAmount = Math.min(cartTotal, discAmount);
      return jsonResponse({
        valid: true,
        code: disc.code,
        type: disc.type,
        value: String(disc.value),
        discount_amount: discAmount.toFixed(2),
        new_subtotal: Math.max(0, cartTotal - discAmount).toFixed(2),
        message: `Discount code '${disc.code}' applied successfully!`,
      });
    }

    // --- SHIPPING CONFIG ---
    if (apiPath === "shipping/config") {
      if (method === "PUT") {
        await db
          .prepare(
            `INSERT INTO shipping_config (id, free_shipping_threshold, flat_rate)
             VALUES (1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               free_shipping_threshold = excluded.free_shipping_threshold,
               flat_rate = excluded.flat_rate`
          )
          .bind(
            String(body.free_shipping_threshold ?? "50.00"),
            String(body.flat_rate ?? "0.01")
          )
          .run();
      }
      const cfg = (await db.prepare("SELECT * FROM shipping_config WHERE id = 1").first()) || {
        free_shipping_threshold: "50.00",
        flat_rate: "0.01",
      };
      return jsonResponse({
        free_shipping_threshold: cfg.free_shipping_threshold,
        flat_rate: cfg.flat_rate,
      });
    }

    // --- STOCK ---
    if ((apiPath === "stock" || apiPath === "stock/low") && method === "GET") {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const { results } = await db
        .prepare(
          `SELECT s.*, v.sku as variant_sku, v.name as variant_name, p.name as product_name
           FROM stock s
           INNER JOIN product_variants v ON v.id = s.variant_id
           INNER JOIN products p ON p.id = v.product_id
           ORDER BY s.updated_at DESC`
        )
        .all();

      let list = (results || []).map((s) => {
        const avail = Number(s.quantity_available || 0);
        const reorder = Number(s.reorder_level || 5);
        return {
          id: s.id,
          variant: s.variant_id,
          variant_sku: s.variant_sku,
          variant_name: s.variant_name || s.product_name,
          product_name: s.product_name,
          quantity_available: avail,
          quantity_reserved: Number(s.quantity_reserved || 0),
          quantity_damaged: Number(s.quantity_damaged || 0),
          reorder_level: reorder,
          is_low_stock: avail <= reorder,
          in_stock: avail > 0,
          updated_at: s.updated_at,
        };
      });

      if (search) {
        list = list.filter(
          (s) =>
            (s.product_name || "").toLowerCase().includes(search) ||
            (s.variant_name || "").toLowerCase().includes(search) ||
            (s.variant_sku || "").toLowerCase().includes(search)
        );
      }
      if (apiPath === "stock/low") {
        list = list.filter((s) => s.is_low_stock);
      }

      return jsonResponse({
        count: list.length,
        next: null,
        previous: null,
        results: list,
      });
    }

    if (apiPath === "stock/transactions" && method === "GET") {
      const { results } = await db
        .prepare(
          `SELECT t.*, v.sku as variant_sku, v.name as variant_name, p.name as product_name
           FROM stock_transactions t
           LEFT JOIN product_variants v ON v.id = t.variant_id
           LEFT JOIN products p ON p.id = v.product_id
           ORDER BY t.created_at DESC LIMIT 100`
        )
        .all();
      const formatted = (results || []).map((t) => ({
        id: t.id,
        variant: t.variant_id,
        variant_sku: t.variant_sku || "",
        variant_name: t.variant_name || t.product_name || "",
        type: t.type,
        quantity: Number(t.quantity),
        note: t.note || "",
        created_by_email: t.created_by_email || "admin",
        created_at: t.created_at,
      }));
      return jsonResponse({ count: formatted.length, results: formatted });
    }

    const stockAdjustMatch = apiPath.match(/^stock\/([^/]+)\/adjust$/);
    if (stockAdjustMatch && method === "POST") {
      const vid = stockAdjustMatch[1];
      const delta = parseInt(body.quantity || 0, 10);
      const txType = body.type || "adjustment";
      const now = new Date().toISOString();

      let s = await db.prepare("SELECT * FROM stock WHERE variant_id = ?").bind(vid).first();
      if (!s) {
        const sidNew = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO stock (id, variant_id, quantity_available, quantity_reserved, quantity_damaged, reorder_level, updated_at) VALUES (?, ?, 0, 0, 0, 5, ?)"
          )
          .bind(sidNew, vid, now)
          .run();
        s = await db.prepare("SELECT * FROM stock WHERE variant_id = ?").bind(vid).first();
      }

      let newAvail = Number(s.quantity_available || 0);
      let newDamaged = Number(s.quantity_damaged || 0);
      if (txType === "damaged") {
        newDamaged += Math.abs(delta);
        newAvail = Math.max(0, newAvail - Math.abs(delta));
      } else {
        newAvail = Math.max(0, newAvail + delta);
      }

      await db.batch([
        db
          .prepare(
            "UPDATE stock SET quantity_available = ?, quantity_damaged = ?, updated_at = ? WHERE variant_id = ?"
          )
          .bind(newAvail, newDamaged, now, vid),
        db
          .prepare(
            `INSERT INTO stock_transactions (id, variant_id, type, quantity, note, created_by, created_by_email, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            vid,
            txType,
            txType === "damaged" ? -Math.abs(delta) : delta,
            body.note || "",
            user?.id || null,
            user?.email || "admin",
            now
          ),
      ]);

      return jsonResponse({
        variant: vid,
        quantity_available: newAvail,
        quantity_damaged: newDamaged,
        in_stock: newAvail > 0,
        updated_at: now,
      });
    }

    const stockVarMatch = apiPath.match(/^stock\/([^/]+)$/);
    if (stockVarMatch && method === "GET") {
      const vid = stockVarMatch[1];
      const s = await db.prepare("SELECT * FROM stock WHERE variant_id = ?").bind(vid).first();
      const avail = s ? Number(s.quantity_available || 0) : 0;
      return jsonResponse({
        variant: vid,
        quantity_available: avail,
        in_stock: avail > 0,
      });
    }

    // --- CART ---
    if (apiPath === "cart") {
      if (method === "DELETE") {
        const cart = await getOrCreateCart(db, user, sid);
        await db.prepare("DELETE FROM cart_items WHERE cart_id = ?").bind(cart.id).run();
      }
      return jsonResponse(await buildCartResponseD1(db, user, request));
    }

    if (apiPath === "cart/items" && method === "POST") {
      const vid = String(body.variant_id || body.variant || "");
      const qty = Math.max(1, parseInt(body.quantity || 1, 10));
      const cart = await getOrCreateCart(db, user, sid);
      const existing = await db
        .prepare("SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ?")
        .bind(cart.id, vid)
        .first();
      const now = new Date().toISOString();
      if (existing) {
        await db
          .prepare("UPDATE cart_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?")
          .bind(qty, now, existing.id)
          .run();
      } else {
        await db
          .prepare(
            "INSERT INTO cart_items (id, cart_id, variant_id, quantity, unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, '0.00', ?, ?)"
          )
          .bind(crypto.randomUUID(), cart.id, vid, qty, now, now)
          .run();
      }
      return jsonResponse(await buildCartResponseD1(db, user, request), 201);
    }

    const cartItemMatch = apiPath.match(/^cart\/items\/([^/]+)$/);
    if (cartItemMatch) {
      const itemId = cartItemMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const qty = Math.max(1, parseInt(body.quantity || 1, 10));
        await db
          .prepare("UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?")
          .bind(qty, new Date().toISOString(), itemId)
          .run();
      } else if (method === "DELETE") {
        await db.prepare("DELETE FROM cart_items WHERE id = ?").bind(itemId).run();
      }
      return jsonResponse(await buildCartResponseD1(db, user, request));
    }

    // --- WISHLIST ---
    async function getOrCreateWishlist(db, user, sessionId, createIfMissing = true) {
      let wl = null;
      if (user) {
        wl = await db
          .prepare("SELECT * FROM wishlists WHERE user_id = ? LIMIT 1")
          .bind(user.id)
          .first();
      }
      if (!wl) {
        wl = await db
          .prepare("SELECT * FROM wishlists WHERE session_id = ? LIMIT 1")
          .bind(sessionId)
          .first();
      }
      if (!wl && createIfMissing) {
        const wid = crypto.randomUUID();
        const now = new Date().toISOString();
        await db
          .prepare("INSERT INTO wishlists (id, user_id, session_id, created_at) VALUES (?, ?, ?, ?)")
          .bind(wid, user ? user.id : null, sessionId, now)
          .run();
        wl = { id: wid, user_id: user ? user.id : null, session_id: sessionId, created_at: now };
      }
      return wl;
    }

    async function buildWishlistResponse(db, wl) {
      if (!wl) {
        return {
          id: null,
          user: user ? user.id : null,
          total_items: 0,
          items: [],
        };
      }
      const [{ results: rows }, catalog] = await Promise.all([
        db
          .prepare("SELECT * FROM wishlist_items WHERE wishlist_id = ? ORDER BY created_at DESC")
          .bind(wl.id)
          .all(),
        getAllProductsHydrated(db),
      ]);
      const prodMap = new Map(catalog.products.map((p) => [String(p.id), p]));
      const varMap = new Map(catalog.variants.map((v) => [String(v.id), v]));
      const items = [];
      for (const r of rows || []) {
        const p = prodMap.get(String(r.product_id));
        const v = r.variant_id ? varMap.get(String(r.variant_id)) : null;
        if (!p) continue;
        items.push({
          id: r.id,
          product: p.id,
          product_name: p.name,
          product_slug: p.slug,
          variant: v ? v.id : null,
          variant_id: v ? v.id : null,
          base_price: v ? v.price : p.base_price,
          primary_image:
            v?.primary_image?.image_url || p.primary_image?.image_url || null,
          created_at: r.created_at,
        });
      }
      return {
        id: wl.id,
        user: wl.user_id,
        total_items: items.length,
        items,
      };
    }

    if (apiPath === "wishlist" && method === "GET") {
      const wl = await getOrCreateWishlist(db, user, sid, false);
      return jsonResponse(await buildWishlistResponse(db, wl));
    }

    if ((apiPath === "wishlist" || apiPath === "wishlist/toggle") && method === "POST") {
      const targetId = String(body.product_id || body.variant_id || "");
      const wl = await getOrCreateWishlist(db, user, sid);
      const existing = await db
        .prepare(
          "SELECT * FROM wishlist_items WHERE wishlist_id = ? AND (product_id = ? OR variant_id = ?)"
        )
        .bind(wl.id, targetId, targetId)
        .first();
      let added = false;
      if (existing && body.desired_state !== true) {
        await db.prepare("DELETE FROM wishlist_items WHERE id = ?").bind(existing.id).run();
      } else if (!existing && body.desired_state !== false) {
        const varRow = await db
          .prepare("SELECT id, product_id FROM product_variants WHERE id = ?")
          .bind(targetId)
          .first();
        const prodId = varRow ? varRow.product_id : targetId;
        const varId = varRow ? varRow.id : null;
        const prodCheck = await db
          .prepare("SELECT id FROM products WHERE id = ?")
          .bind(prodId)
          .first();
        if (prodCheck) {
          await db
            .prepare(
              "INSERT INTO wishlist_items (id, wishlist_id, product_id, variant_id, created_at) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(crypto.randomUUID(), wl.id, prodId, varId, new Date().toISOString())
            .run();
          added = true;
        }
      }
      const resData = await buildWishlistResponse(db, wl);
      return jsonResponse({ added, in_wishlist: added, ...resData });
    }

    if (apiPath === "wishlist" && method === "DELETE") {
      const targetId = url.searchParams.get("product_id");
      const wl = await getOrCreateWishlist(db, user, sid);
      await db
        .prepare(
          "DELETE FROM wishlist_items WHERE wishlist_id = ? AND (product_id = ? OR variant_id = ?)"
        )
        .bind(wl.id, targetId, targetId)
        .run();
      return jsonResponse(await buildWishlistResponse(db, wl));
    }

    // --- ADDRESSES ---
    if (apiPath === "addresses" && method === "GET") {
      const stmt = user
        ? db.prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC").bind(user.id)
        : db.prepare("SELECT * FROM addresses WHERE session_id = ? ORDER BY created_at DESC").bind(sid);
      const { results } = await stmt.all();
      return jsonResponse(
        (results || []).map((a) => ({ ...a, is_default: Boolean(a.is_default) }))
      );
    }

    if (apiPath === "addresses" && method === "POST") {
      const aid = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO addresses (
            id, user_id, session_id, type, recipient_name, phone,
            address_line_1, address_line_2, city, state, postal_code, country, is_default, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          aid,
          user ? user.id : null,
          sid,
          body.type || "shipping",
          body.recipient_name || "",
          body.phone || "",
          body.address_line_1 || "",
          body.address_line_2 || "",
          body.city || "",
          body.state || "",
          body.postal_code || "",
          body.country || "Cambodia",
          body.is_default ? 1 : 0,
          now,
          now
        )
        .run();
      const row = await db.prepare("SELECT * FROM addresses WHERE id = ?").bind(aid).first();
      return jsonResponse({ ...row, is_default: Boolean(row.is_default) }, 201);
    }

    const addrMatch = apiPath.match(/^addresses\/([^/]+)$/);
    if (addrMatch) {
      const aid = addrMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const existing = await db.prepare("SELECT * FROM addresses WHERE id = ?").bind(aid).first();
        if (!existing) return jsonResponse({ error: "Address not found." }, 404);
        await db
          .prepare(
            `UPDATE addresses SET
               type = ?, recipient_name = ?, phone = ?, address_line_1 = ?, address_line_2 = ?,
               city = ?, state = ?, postal_code = ?, country = ?, is_default = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body.type ?? existing.type,
            body.recipient_name ?? existing.recipient_name,
            body.phone ?? existing.phone,
            body.address_line_1 ?? existing.address_line_1,
            body.address_line_2 ?? existing.address_line_2,
            body.city ?? existing.city,
            body.state ?? existing.state,
            body.postal_code ?? existing.postal_code,
            body.country ?? existing.country,
            body.is_default !== undefined ? (body.is_default ? 1 : 0) : existing.is_default,
            new Date().toISOString(),
            aid
          )
          .run();
        const updated = await db.prepare("SELECT * FROM addresses WHERE id = ?").bind(aid).first();
        return jsonResponse({ ...updated, is_default: Boolean(updated.is_default) });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM addresses WHERE id = ?").bind(aid).run();
        return jsonResponse({ deleted: true });
      }
    }

    // --- CHECKOUT & ORDERS ---
    if (apiPath === "checkout" && method === "POST") {
      const cartData = await buildCartResponseD1(db, user, request);
      if (!cartData.items.length) {
        return jsonResponse({ error: "Your cart is empty." }, 400);
      }
      const cfg = (await db.prepare("SELECT * FROM shipping_config WHERE id = 1").first()) || {
        free_shipping_threshold: "50.00",
        flat_rate: "0.01",
      };
      const subtotal = Number(cartData.subtotal);
      const threshold = Number(cfg.free_shipping_threshold || 50);
      const flatRate = Number(cfg.flat_rate || 0.01);
      const shippingCost = subtotal >= threshold ? 0 : flatRate;
      const discount = 0;
      const tax = Number(((subtotal - discount) * 0.08).toFixed(2));
      const total = Math.max(0, subtotal + shippingCost + tax - discount);

      const orderId = crypto.randomUUID();
      const orderNum = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${orderId
        .slice(0, 6)
        .toUpperCase()}`;
      const now = new Date().toISOString();

      const shipSnap = JSON.stringify(
        body.shipping_address || {
          recipient_name: user?.full_name || "Customer",
          address_line_1: "Phnom Penh",
        }
      );
      const billSnap = JSON.stringify(body.billing_address || body.shipping_address || {});

      const stmts = [
        db
          .prepare(
            `INSERT INTO orders (
              id, user_id, order_number, status, payment_method, payment_status, fulfillment_status,
              currency, subtotal, discount, shipping_cost, tax, total,
              shipping_address_snapshot, billing_address_snapshot, guest_email, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', 'bakong_khqr', 'unpaid', 'unfulfilled', 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            orderId,
            user ? user.id : null,
            orderNum,
            subtotal.toFixed(2),
            discount.toFixed(2),
            shippingCost.toFixed(2),
            tax.toFixed(2),
            total.toFixed(2),
            shipSnap,
            billSnap,
            body.guest_email || user?.email || "guest@example.com",
            now,
            now
          ),
      ];

      for (const item of cartData.items) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO order_items (
                id, order_id, product_id, variant_id, product_name_snapshot, sku_snapshot,
                variant_snapshot, unit_price, quantity, discount, tax, total
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '0.00', '0.00', ?)`
            )
            .bind(
              crypto.randomUUID(),
              orderId,
              item.product_id,
              item.variant,
              item.product_name,
              item.variant_sku,
              JSON.stringify({ name: item.variant_name }),
              item.unit_price,
              item.quantity,
              item.line_total
            )
        );
        stmts.push(
          db
            .prepare(
              "UPDATE stock SET quantity_available = MAX(0, quantity_available - ?), updated_at = ? WHERE variant_id = ?"
            )
            .bind(item.quantity, now, item.variant)
        );
      }

      stmts.push(db.prepare("DELETE FROM cart_items WHERE cart_id = ?").bind(cartData.id));
      await db.batch(stmts);

      const [order] = await getOrdersHydrated(db, { orderIdOrNumber: orderId });
      return jsonResponse({ message: "Order created successfully!", order }, 201);
    }

    if (apiPath === "orders" && method === "GET") {
      const list = await getOrdersHydrated(db, {
        status: url.searchParams.get("status"),
        payment_status: url.searchParams.get("payment_status"),
      });
      return jsonResponse(list);
    }

    const orderStatusMatch = apiPath.match(/^orders\/([^/]+)\/status$/);
    if (orderStatusMatch && (method === "PATCH" || method === "PUT")) {
      const oid = orderStatusMatch[1];
      const existing = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(oid).first();
      if (!existing) return jsonResponse({ error: "Order not found." }, 404);
      await db
        .prepare(
          `UPDATE orders SET status = ?, fulfillment_status = ?, payment_status = ?, updated_at = ? WHERE id = ?`
        )
        .bind(
          body.status ?? existing.status,
          body.fulfillment_status ?? existing.fulfillment_status,
          body.payment_status ?? existing.payment_status,
          new Date().toISOString(),
          oid
        )
        .run();
      const [ord] = await getOrdersHydrated(db, { orderIdOrNumber: oid });
      return jsonResponse({ message: "Order status updated.", order: ord });
    }

    const orderShipMatch = apiPath.match(/^orders\/([^/]+)\/ship$/);
    if (orderShipMatch && method === "POST") {
      const oid = orderShipMatch[1];
      const now = new Date().toISOString();
      const shipId = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            `INSERT INTO shipments (id, order_id, carrier, tracking_number, status, shipped_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            shipId,
            oid,
            body.carrier || "Standard Courier",
            body.tracking_number || "",
            body.status || "shipped",
            now,
            now,
            now
          ),
        db
          .prepare(
            "UPDATE orders SET fulfillment_status = 'fulfilled', status = 'completed', updated_at = ? WHERE id = ?"
          )
          .bind(now, oid),
      ]);
      const [ord] = await getOrdersHydrated(db, { orderIdOrNumber: oid });
      return jsonResponse({ message: "Shipment created.", order: ord });
    }

    const orderRefundMatch = apiPath.match(/^orders\/([^/]+)\/refund$/);
    if (orderRefundMatch && method === "POST") {
      const oid = orderRefundMatch[1];
      const existing = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(oid).first();
      if (!existing) return jsonResponse({ error: "Order not found." }, 404);
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            `INSERT INTO refunds (id, order_id, amount, reason, status, processed_by, created_at, processed_at)
             VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            oid,
            String(body.amount || existing.total),
            body.reason || "",
            user?.id || null,
            now,
            now
          ),
        db
          .prepare("UPDATE orders SET payment_status = 'refunded', updated_at = ? WHERE id = ?")
          .bind(now, oid),
      ]);
      const [ord] = await getOrdersHydrated(db, { orderIdOrNumber: oid });
      return jsonResponse({ message: "Refund processed.", order: ord });
    }

    const orderMatch = apiPath.match(/^orders\/([^/]+)$/);
    if (orderMatch && method === "GET") {
      const oid = orderMatch[1];
      const [ord] = await getOrdersHydrated(db, { orderIdOrNumber: oid });
      if (!ord) return jsonResponse({ error: "Order not found." }, 404);
      return jsonResponse(ord);
    }

    // --- BAKONG KHQR PAYMENTS ---
    if (apiPath === "payments/khqr/generate" && method === "POST") {
      const oid = body.order_id;
      const [ord] = await getOrdersHydrated(db, oid ? { orderIdOrNumber: oid } : {});
      if (!ord) return jsonResponse({ error: "Order not found." }, 404);

      const amount = body.amount ?? ord.total;
      const currency = body.currency || ord.currency || "USD";
      const gen = generateKhqrPayload(ord.order_number, amount, currency);
      const paymentId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO payments (id, order_id, gateway, transaction_id, amount, currency, status, created_at, updated_at)
           VALUES (?, ?, 'bakong_khqr', ?, ?, ?, 'pending', ?, ?)`
        )
        .bind(paymentId, ord.id, gen.md5, String(amount), currency, now, now)
        .run();

      const [freshOrd] = await getOrdersHydrated(db, { orderIdOrNumber: ord.id });
      return jsonResponse({
        message: "KHQR generated successfully. Scan to pay.",
        qr: gen.qr,
        md5: gen.md5,
        deep_link: null,
        expires_at: gen.expires_at,
        payment_id: paymentId,
        order: freshOrd,
      });
    }

    if (apiPath === "payments/khqr/check-status" && method === "GET") {
      const md5Hash = url.searchParams.get("md5");
      const payRow = await db
        .prepare("SELECT * FROM payments WHERE transaction_id = ? LIMIT 1")
        .bind(md5Hash)
        .first();
      const res = await checkBakongMd5(md5Hash);
      const now = new Date().toISOString();
      if (res.paid && payRow) {
        await db.batch([
          db
            .prepare("UPDATE payments SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
            .bind(now, now, payRow.id),
          db
            .prepare(
              "UPDATE orders SET payment_status = 'paid', status = 'processing', updated_at = ? WHERE id = ?"
            )
            .bind(now, payRow.order_id),
        ]);
      }
      const [ord] = payRow
        ? await getOrdersHydrated(db, { orderIdOrNumber: payRow.order_id })
        : [];
      return jsonResponse({
        paid: Boolean(res.paid),
        status: res.paid ? "SUCCESS" : "PENDING",
        order: ord || null,
      });
    }

    if (
      (apiPath === "payments/verify" || apiPath === "payments/check-status") &&
      method === "POST"
    ) {
      const oid = body.order_id;
      const [ord] = await getOrdersHydrated(db, oid ? { orderIdOrNumber: oid } : {});
      const md5Hash = body.md5 || ord?.payments?.[0]?.transaction_id;
      if (!md5Hash) {
        return jsonResponse({ paid: false, status: "PENDING", order: ord || null });
      }
      const res = await checkBakongMd5(md5Hash);
      if (res.paid && ord) {
        const now = new Date().toISOString();
        await db.batch([
          db
            .prepare(
              "UPDATE payments SET status = 'paid', paid_at = ?, updated_at = ? WHERE order_id = ?"
            )
            .bind(now, now, ord.id),
          db
            .prepare(
              "UPDATE orders SET payment_status = 'paid', status = 'processing', updated_at = ? WHERE id = ?"
            )
            .bind(now, ord.id),
        ]);
      }
      const [freshOrd] = ord ? await getOrdersHydrated(db, { orderIdOrNumber: ord.id }) : [];
      return jsonResponse({
        paid: Boolean(res.paid),
        status: res.paid ? "SUCCESS" : "PENDING",
        order: freshOrd || null,
      });
    }

    // --- ADMIN USERS, ROLES, REVIEWS, AUDIT LOGS ---
    if (apiPath === "users" && method === "GET") {
      const { results } = await db
        .prepare("SELECT * FROM users ORDER BY created_at DESC")
        .all();
      return jsonResponse((results || []).map(formatUserRow));
    }

    const userMatch = apiPath.match(/^users\/([^/]+)$/);
    if (userMatch && (method === "PATCH" || method === "PUT")) {
      const uid = userMatch[1];
      const existing = await db.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first();
      if (!existing) return jsonResponse({ error: "User not found." }, 404);
      await db
        .prepare(
          `UPDATE users SET
             full_name = ?, role = ?, status = ?, is_active = ?, is_staff = ?, is_superuser = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          body.full_name ?? existing.full_name,
          body.role ?? existing.role,
          body.status ?? existing.status,
          body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
          body.is_staff !== undefined ? (body.is_staff ? 1 : 0) : existing.is_staff,
          body.is_superuser !== undefined ? (body.is_superuser ? 1 : 0) : existing.is_superuser,
          new Date().toISOString(),
          uid
        )
        .run();
      const updated = await db.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first();
      return jsonResponse(formatUserRow(updated));
    }

    if (apiPath === "roles" && method === "GET") {
      const { results } = await db.prepare("SELECT * FROM roles ORDER BY name ASC").all();
      return jsonResponse(results || []);
    }

    if (apiPath === "reviews" && method === "GET") {
      const { results } = await db
        .prepare(
          `SELECT r.*, p.name as product_name
           FROM reviews r
           LEFT JOIN products p ON p.id = r.product_id
           ORDER BY r.created_at DESC`
        )
        .all();
      return jsonResponse(
        (results || []).map((r) => ({
          ...r,
          product: r.product_id,
          user: r.user_id,
          is_verified_purchase: Boolean(r.is_verified_purchase),
        }))
      );
    }

    const revMatch = apiPath.match(/^reviews\/([^/]+)$/);
    if (revMatch) {
      const rid = revMatch[1];
      if (method === "PATCH" || method === "PUT") {
        await db
          .prepare("UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?")
          .bind(body.status || "approved", new Date().toISOString(), rid)
          .run();
        const row = await db.prepare("SELECT * FROM reviews WHERE id = ?").bind(rid).first();
        return jsonResponse(row || {});
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM reviews WHERE id = ?").bind(rid).run();
        return jsonResponse({ deleted: true });
      }
    }

    if (apiPath === "audit-logs" && method === "GET") {
      const { results } = await db
        .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")
        .all();
      return jsonResponse({
        count: (results || []).length,
        next: null,
        previous: null,
        results: results || [],
      });
    }

    return jsonResponse({ error: `Endpoint /api/${apiPath} not found.` }, 404);
  },
};
