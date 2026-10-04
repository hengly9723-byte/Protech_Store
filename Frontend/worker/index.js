import seedData from "./seedData.json";

const STATE_CACHE_URL = "https://protech-internal-state.local/state-v1";

// Deep clone helper
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// In-memory state (backed by Cloudflare Cache API for cross-request persistence)
let state = null;

async function getState() {
  if (state) return state;
  try {
    const cache = caches.default;
    const cached = await cache.match(STATE_CACHE_URL);
    if (cached) {
      state = await cached.json();
      return state;
    }
  } catch (_) {}

  state = {
    products: clone(seedData.products?.results || []),
    product_details: clone(seedData.product_details || {}),
    variants: clone(seedData.variants?.results || []),
    variant_details: clone(seedData.variant_details || {}),
    categories: clone(seedData.categories || []),
    categories_flat: clone(seedData.categories_flat || []),
    brands: clone(seedData.brands || []),
    product_types: clone(seedData.product_types || []),
    promotions_active: clone(seedData.promotions_active || []),
    promotions: clone(seedData.promotions || []),
    shipping_config: clone(
      seedData.shipping_config || {
        free_shipping_threshold: "500.00",
        flat_rate: "15.00",
      }
    ),
    spec_definitions: clone(seedData.spec_definitions || []),
    spec_options: clone(seedData.spec_options || []),
    discount_codes: clone(seedData.discount_codes || []),
    roles: clone(seedData.roles || []),
    users: clone(seedData.users || []),
    stock: clone(seedData.stock?.results || []),
    carts: {},
    wishlists: {},
    addresses: {},
    orders: [],
    payments: {},
    reviews: {},
    audit_logs: [],
  };
  return state;
}

async function saveState(ctx) {
  if (!state) return;
  const putPromise = (async () => {
    try {
      const cache = caches.default;
      const res = new Response(JSON.stringify(state), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=31536000",
        },
      });
      await cache.put(STATE_CACHE_URL, res);
    } catch (_) {}
  })();
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(putPromise);
  } else {
    await putPromise;
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
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }
  const bitLen = utf8.length * 8;
  const padLen = ((56 - ((utf8.length + 1) % 64)) + 64) % 64;
  const totalLen = utf8.length + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(utf8);
  buf[utf8.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < totalLen; offset += 64) {
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
  const bytes = new TextEncoder().encode(str);
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag, val) {
  const s = String(val);
  const len = s.length < 10 ? `0${s.length}` : `${s.length}`;
  return `${tag}${len}${s}`;
}

function generateKhqrPayload(orderNumber, amount, currency = "USD") {
  const accountId = "ly_sokheng1@bkrt";
  const merchantName = "SOKHENG LY";
  const merchantCity = "PHNOM PENH";
  const currencyCode = currency === "KHR" ? "116" : "840";
  const numAmount = Number(amount || 0);
  const amountStr =
    currency === "KHR"
      ? String(Math.round(numAmount))
      : numAmount % 1 === 0
      ? String(numAmount)
      : numAmount.toFixed(2);

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
  return { access: token, refresh: token };
}

function getUserFromRequest(request, st) {
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
      const found = st.users.find(
        (u) => (uid && String(u.id) === String(uid)) || (email && u.email.toLowerCase() === String(email).toLowerCase())
      );
      if (found) return found;
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

// ==========================================
// Cart & Pricing Helpers
// ==========================================
function getVariantPromoPrice(variant, st) {
  const basePrice = Number(variant.price || 0);
  const rawCompare = Number(variant.compare_at_price || 0);
  const origPrice = rawCompare > basePrice ? rawCompare : basePrice;

  const activePromo = (st.promotions_active || []).find(
    (p) =>
      p.is_active &&
      (p.products || []).some((prod) => String(prod.id) === String(variant.product))
  );
  if (activePromo) {
    const dVal = Number(activePromo.discount_value || activePromo.discountValue || 0);
    const dType = activePromo.discount_type || activePromo.discountType || "percentage";
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

function getCartKey(request, user) {
  if (user) return `user_${user.id}`;
  const sid = request.headers.get("X-Session-ID") || "default_guest";
  return `sess_${sid}`;
}

function buildCartResponse(cartKey, user, request, st) {
  const sid = request.headers.get("X-Session-ID") || "default_guest";
  if (!st.carts[cartKey]) {
    st.carts[cartKey] = {
      id: crypto.randomUUID(),
      user: user ? user.id : null,
      session_id: sid,
      status: "active",
      currency: "USD",
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const cart = st.carts[cartKey];
  let totalItems = 0;
  let subtotalNum = 0;
  const enrichedItems = cart.items.map((item) => {
    const v =
      st.variant_details[item.variant] ||
      st.variants.find((x) => String(x.id) === String(item.variant)) ||
      {};
    const pDetail = st.product_details[v.product] || {};
    const pricing = getVariantPromoPrice(v, st);
    const unitPrice = Number(pricing.unit_price);
    const lineTotal = unitPrice * item.quantity;
    totalItems += item.quantity;
    subtotalNum += lineTotal;
    const stockRec = st.stock.find((s) => String(s.variant) === String(v.id));
    const primaryImg =
      (v.images && v.images[0]?.image_url) ||
      (pDetail.images && pDetail.images[0]?.image_url) ||
      null;
    return {
      id: item.id,
      variant: v.id || item.variant,
      variant_sku: v.sku || "",
      variant_name: v.name || "",
      product_id: v.product || pDetail.id || "",
      product_name: v.product_name || pDetail.name || "",
      product_slug: v.product_slug || pDetail.slug || "",
      product_image: primaryImg,
      unit_price: unitPrice.toFixed(2),
      original_price: pricing.original_price,
      has_discount: pricing.has_discount,
      discount_badge: pricing.discount_badge,
      quantity: item.quantity,
      line_total: lineTotal.toFixed(2),
      available_stock: stockRec ? stockRec.quantity_available : 25,
      created_at: item.created_at,
      updated_at: new Date().toISOString(),
    };
  });

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

    const st = await getState();
    const method = request.method.toUpperCase();
    const apiPath = path.replace(/^\/api\/?/, "").replace(/\/+$/, "");
    const user = getUserFromRequest(request, st);

    let body = {};
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const ct = request.headers.get("Content-Type") || "";
        if (ct.includes("application/json")) {
          body = await request.json();
        }
      } catch (_) {}
    }

    // --- AUTH ENDPOINTS ---
    if (apiPath === "auth/google" && method === "POST") {
      const idToken = body.token || body.id_token || body.credential;
      const decoded = decodeJwtPayload(idToken);
      if (!decoded || !decoded.email) {
        return jsonResponse({ error: "Invalid Google token." }, 400);
      }
      const email = decoded.email.toLowerCase();
      let u = st.users.find((x) => x.email.toLowerCase() === email);
      if (!u) {
        const isAdminEmail = email === "hengly9723@gmail.com";
        u = {
          id: crypto.randomUUID(),
          email: decoded.email,
          full_name: decoded.name || decoded.email.split("@")[0],
          avatar_url: decoded.picture || "",
          role: isAdminEmail ? "admin" : "user",
          roles: [],
          status: "active",
          is_active: true,
          is_staff: isAdminEmail,
          is_superuser: isAdminEmail,
          is_email_verified: true,
          permissions: [],
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        st.users.push(u);
      } else {
        if (decoded.picture && !u.avatar_url) u.avatar_url = decoded.picture;
        u.last_login_at = new Date().toISOString();
      }
      await saveState(ctx);
      const tokens = makeTokens(u);
      return jsonResponse({
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        access: tokens.access,
        refresh: tokens.refresh,
        user: u,
      });
    }

    if (apiPath === "auth/login" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      let u = st.users.find((x) => x.email.toLowerCase() === email);
      if (!u) {
        return jsonResponse({ error: "Invalid email or password." }, 401);
      }
      if (u.password && body.password && u.password !== body.password) {
        return jsonResponse({ error: "Invalid email or password." }, 401);
      }
      u.last_login_at = new Date().toISOString();
      await saveState(ctx);
      const tokens = makeTokens(u);
      return jsonResponse({
        access: tokens.access,
        refresh: tokens.refresh,
        user: u,
      });
    }

    if (apiPath === "auth/register" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) {
        return jsonResponse({ error: "Email is required." }, 400);
      }
      if (st.users.some((x) => x.email.toLowerCase() === email)) {
        return jsonResponse({ error: "An account with this email already exists." }, 400);
      }
      const isAdminEmail = email === "hengly9723@gmail.com";
      const newUser = {
        id: crypto.randomUUID(),
        email: body.email.trim(),
        full_name: body.full_name || body.name || email.split("@")[0],
        avatar_url: "",
        password: body.password || "",
        role: isAdminEmail ? "admin" : "user",
        roles: [],
        status: "active",
        is_active: true,
        is_staff: isAdminEmail,
        is_superuser: isAdminEmail,
        is_email_verified: true,
        permissions: [],
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      st.users.push(newUser);
      await saveState(ctx);
      const tokens = makeTokens(newUser);
      return jsonResponse(
        {
          message: "Registration successful!",
          access: tokens.access,
          refresh: tokens.refresh,
          tokens,
          user: newUser,
        },
        201
      );
    }

    if (apiPath === "auth/refresh" && method === "POST") {
      const refresh = body.refresh || "";
      const decoded = decodeJwtPayload(refresh);
      const u =
        (decoded &&
          st.users.find(
            (x) =>
              String(x.id) === String(decoded.user_id) ||
              (decoded.email && x.email.toLowerCase() === String(decoded.email).toLowerCase())
          )) ||
        st.users[0];
      const tokens = makeTokens(u);
      return jsonResponse({ access: tokens.access, refresh: tokens.refresh });
    }

    if (apiPath === "users/me") {
      if (!user) return jsonResponse({ error: "Authentication required." }, 401);
      if (method === "PATCH" || method === "PUT") {
        if (body.full_name !== undefined) user.full_name = body.full_name;
        if (body.avatar_url !== undefined) user.avatar_url = body.avatar_url;
        user.updated_at = new Date().toISOString();
        await saveState(ctx);
      }
      return jsonResponse(user);
    }

    // --- CATALOG: PRODUCTS ---
    if (apiPath === "products" && method === "GET") {
      let list = [...st.products];
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const category = url.searchParams.get("category");
      const brand = url.searchParams.get("brand");
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
            (p.category_name || "").toLowerCase() === category.toLowerCase()
        );
      }
      if (brand) {
        list = list.filter(
          (p) =>
            String(p.brand) === String(brand) ||
            (p.brand_name || "").toLowerCase() === brand.toLowerCase()
        );
      }
      return jsonResponse({
        count: list.length,
        next: null,
        previous: null,
        results: list,
      });
    }

    const prodReviewMatch = apiPath.match(/^products\/([^/]+)\/reviews$/);
    if (prodReviewMatch) {
      const pid = prodReviewMatch[1];
      const list = st.reviews[pid] || [];
      if (method === "GET") {
        const prod = st.product_details[pid] || st.products.find((p) => String(p.id) === pid);
        return jsonResponse({
          product_id: pid,
          product_name: prod?.name || "",
          reviews_count: list.length,
          reviews: list,
        });
      }
      if (method === "POST") {
        const rev = {
          id: crypto.randomUUID(),
          product: pid,
          user: user?.id || null,
          user_name: user?.full_name || "Customer",
          rating: Number(body.rating || 5),
          title: body.title || "",
          content: body.content || "",
          is_verified_purchase: true,
          status: "approved",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        st.reviews[pid] = [rev, ...list];
        await saveState(ctx);
        return jsonResponse({ message: "Review submitted!", review: rev }, 201);
      }
    }

    const prodMatch = apiPath.match(/^products\/([^/]+)$/);
    if (prodMatch && method === "GET") {
      const idOrSlug = prodMatch[1];
      const detail =
        st.product_details[idOrSlug] ||
        Object.values(st.product_details).find(
          (p) => String(p.id) === idOrSlug || String(p.slug) === idOrSlug
        );
      if (!detail) return jsonResponse({ error: "Product not found." }, 404);
      return jsonResponse(detail);
    }

    // --- CATALOG: VARIANTS ---
    if (apiPath === "variants/generate-barcode" && method === "GET") {
      const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
      return jsonResponse({ barcode: "2" + randomDigits.slice(1) });
    }

    if (apiPath === "variants" && method === "GET") {
      let list = [...st.variants];
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const category = url.searchParams.get("category");
      const brand = url.searchParams.get("brand");
      const product = url.searchParams.get("product");
      const minPrice = url.searchParams.get("min_price");
      const maxPrice = url.searchParams.get("max_price");
      const inStock = url.searchParams.get("in_stock");
      const ordering = url.searchParams.get("ordering");

      if (product) {
        list = list.filter((v) => String(v.product) === String(product));
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
        // Match category or child categories
        const matchingCatIds = new Set([String(category)]);
        for (const c of st.categories_flat) {
          if (
            String(c.id) === String(category) ||
            String(c.slug).toLowerCase() === String(category).toLowerCase() ||
            String(c.name).toLowerCase() === String(category).toLowerCase()
          ) {
            matchingCatIds.add(String(c.id));
          }
        }
        for (const c of st.categories_flat) {
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
      if (minPrice !== null && minPrice !== "") {
        list = list.filter((v) => Number(v.price) >= Number(minPrice));
      }
      if (maxPrice !== null && maxPrice !== "") {
        list = list.filter((v) => Number(v.price) <= Number(maxPrice));
      }
      if (inStock === "true" || inStock === "1") {
        list = list.filter((v) => v.in_stock !== false && Number(v.stock_quantity ?? 10) > 0);
      }
      // Specification filters (spec_<key>=val)
      for (const [k, val] of url.searchParams.entries()) {
        if (k.startsWith("spec_") && val) {
          const specKey = k.slice(5);
          const allowedVals = val.split(",").map((s) => s.trim().toLowerCase());
          list = list.filter((v) => {
            const vSpec = v.specifications?.[specKey];
            return vSpec && allowedVals.includes(String(vSpec).toLowerCase());
          });
        }
      }
      if (ordering === "price") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (ordering === "-price") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
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
    if (varMatch && method === "GET") {
      const vid = varMatch[1];
      const v =
        st.variant_details[vid] ||
        st.variants.find((x) => String(x.id) === vid || String(x.sku) === vid);
      if (!v) return jsonResponse({ error: "Variant not found." }, 404);
      return jsonResponse(v);
    }

    // --- CATEGORIES, BRANDS, PRODUCT TYPES, SPECS ---
    if (apiPath === "categories" && method === "GET") {
      const allFlat = url.searchParams.get("all_flat");
      return jsonResponse(
        allFlat === "true" || allFlat === "1" ? st.categories_flat : st.categories
      );
    }
    if (apiPath === "brands" && method === "GET") {
      return jsonResponse(st.brands);
    }
    if (apiPath === "product-types" && method === "GET") {
      return jsonResponse(st.product_types);
    }
    if (apiPath === "specification-definitions" && method === "GET") {
      return jsonResponse(st.spec_definitions);
    }
    if (apiPath === "specification-options" && method === "GET") {
      return jsonResponse(st.spec_options);
    }

    // --- PROMOTIONS & DISCOUNT CODES ---
    if (apiPath === "promotions/active" && method === "GET") {
      return jsonResponse(st.promotions_active);
    }
    if (apiPath === "promotions" && method === "GET") {
      return jsonResponse(st.promotions);
    }
    if (apiPath === "discount-codes" && method === "GET") {
      return jsonResponse(st.discount_codes);
    }
    if (apiPath === "discount-codes/validate" && method === "POST") {
      const codeStr = String(body.code || "").trim().toUpperCase();
      const cartTotal = Number(body.cart_total || 0);
      const disc = st.discount_codes.find((d) => String(d.code).toUpperCase() === codeStr);
      if (!disc || !disc.is_active) {
        return jsonResponse({ valid: false, error: "Invalid or inactive discount code." }, 400);
      }
      const val = Number(disc.value || 0);
      let discAmount =
        disc.type === "percentage" ? (cartTotal * val) / 100 : val;
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
        st.shipping_config = {
          free_shipping_threshold: String(
            body.free_shipping_threshold ?? st.shipping_config.free_shipping_threshold
          ),
          flat_rate: String(body.flat_rate ?? st.shipping_config.flat_rate),
        };
        await saveState(ctx);
      }
      return jsonResponse(st.shipping_config);
    }

    // --- STOCK ---
    if (apiPath === "stock" && method === "GET") {
      return jsonResponse({
        count: st.stock.length,
        next: null,
        previous: null,
        results: st.stock,
      });
    }
    if (apiPath === "stock/low" && method === "GET") {
      const low = st.stock.filter((s) => s.is_low_stock || s.quantity_available <= 5);
      return jsonResponse({ count: low.length, results: low });
    }
    if (apiPath === "stock/transactions" && method === "GET") {
      return jsonResponse({ count: 0, results: [] });
    }
    const stockVarMatch = apiPath.match(/^stock\/([^/]+)$/);
    if (stockVarMatch && method === "GET") {
      const vid = stockVarMatch[1];
      const s = st.stock.find((x) => String(x.variant) === vid) || {
        variant: vid,
        quantity_available: 25,
        in_stock: true,
      };
      return jsonResponse(s);
    }

    // --- CART ---
    const cartKey = getCartKey(request, user);
    if (apiPath === "cart") {
      if (method === "DELETE") {
        if (st.carts[cartKey]) st.carts[cartKey].items = [];
        await saveState(ctx);
      }
      return jsonResponse(buildCartResponse(cartKey, user, request, st));
    }

    if (apiPath === "cart/items" && method === "POST") {
      const vid = body.variant_id || body.variant;
      const qty = Math.max(1, parseInt(body.quantity || 1, 10));
      buildCartResponse(cartKey, user, request, st);
      const cart = st.carts[cartKey];
      const existing = cart.items.find((i) => String(i.variant) === String(vid));
      if (existing) {
        existing.quantity += qty;
      } else {
        cart.items.push({
          id: crypto.randomUUID(),
          variant: vid,
          quantity: qty,
          created_at: new Date().toISOString(),
        });
      }
      await saveState(ctx);
      return jsonResponse(buildCartResponse(cartKey, user, request, st), 201);
    }

    const cartItemMatch = apiPath.match(/^cart\/items\/([^/]+)$/);
    if (cartItemMatch) {
      const itemId = cartItemMatch[1];
      buildCartResponse(cartKey, user, request, st);
      const cart = st.carts[cartKey];
      if (method === "PATCH" || method === "PUT") {
        const item = cart.items.find((i) => String(i.id) === itemId);
        if (item) item.quantity = Math.max(1, parseInt(body.quantity || 1, 10));
      } else if (method === "DELETE") {
        cart.items = cart.items.filter((i) => String(i.id) !== itemId);
      }
      await saveState(ctx);
      return jsonResponse(buildCartResponse(cartKey, user, request, st));
    }

    // --- WISHLIST ---
    const wishKey = cartKey;
    if (!st.wishlists[wishKey]) st.wishlists[wishKey] = [];
    if (apiPath === "wishlist" && method === "GET") {
      const items = st.wishlists[wishKey];
      return jsonResponse({
        id: crypto.randomUUID(),
        user: user?.id || null,
        total_items: items.length,
        items,
      });
    }
    if ((apiPath === "wishlist" || apiPath === "wishlist/toggle") && method === "POST") {
      const pid = body.product_id || body.variant_id;
      const items = st.wishlists[wishKey];
      const idx = items.findIndex(
        (x) => String(x.product) === String(pid) || String(x.variant) === String(pid)
      );
      let added = false;
      if (idx >= 0 && body.desired_state !== true) {
        items.splice(idx, 1);
      } else if (idx < 0 && body.desired_state !== false) {
        const prod =
          st.product_details[pid] ||
          st.products.find((p) => String(p.id) === String(pid)) ||
          st.variants.find((v) => String(v.id) === String(pid));
        items.push({
          id: crypto.randomUUID(),
          product: prod?.product || prod?.id || pid,
          product_name: prod?.product_name || prod?.name || "Product",
          product_slug: prod?.product_slug || prod?.slug || "",
          variant: prod?.product ? prod.id : null,
          variant_id: prod?.product ? prod.id : null,
          base_price: prod?.price || prod?.base_price || "0.00",
          primary_image: prod?.primary_image?.image_url || prod?.primary_image || null,
          created_at: new Date().toISOString(),
        });
        added = true;
      }
      await saveState(ctx);
      return jsonResponse({
        added,
        in_wishlist: added,
        total_items: items.length,
        items,
      });
    }
    if (apiPath === "wishlist" && method === "DELETE") {
      const pid = url.searchParams.get("product_id");
      st.wishlists[wishKey] = st.wishlists[wishKey].filter(
        (x) => String(x.product) !== String(pid) && String(x.variant) !== String(pid)
      );
      await saveState(ctx);
      return jsonResponse({ total_items: st.wishlists[wishKey].length, items: st.wishlists[wishKey] });
    }

    // --- ADDRESSES ---
    const addrKey = user ? `user_${user.id}` : cartKey;
    if (!st.addresses[addrKey]) st.addresses[addrKey] = [];
    if (apiPath === "addresses" && method === "GET") {
      return jsonResponse(st.addresses[addrKey]);
    }
    if (apiPath === "addresses" && method === "POST") {
      const addr = {
        id: crypto.randomUUID(),
        ...body,
        created_at: new Date().toISOString(),
      };
      st.addresses[addrKey].push(addr);
      await saveState(ctx);
      return jsonResponse(addr, 201);
    }
    const addrMatch = apiPath.match(/^addresses\/([^/]+)$/);
    if (addrMatch) {
      const aid = addrMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const a = st.addresses[addrKey].find((x) => String(x.id) === aid);
        if (a) Object.assign(a, body);
        await saveState(ctx);
        return jsonResponse(a || {});
      }
      if (method === "DELETE") {
        st.addresses[addrKey] = st.addresses[addrKey].filter((x) => String(x.id) !== aid);
        await saveState(ctx);
        return jsonResponse({ deleted: true });
      }
    }

    // --- CHECKOUT & ORDERS ---
    if (apiPath === "checkout" && method === "POST") {
      const cartData = buildCartResponse(cartKey, user, request, st);
      if (!cartData.items.length) {
        return jsonResponse({ error: "Your cart is empty." }, 400);
      }
      const subtotal = Number(cartData.subtotal);
      const threshold = Number(st.shipping_config.free_shipping_threshold || 500);
      const flatRate = Number(st.shipping_config.flat_rate || 15);
      const shippingCost = subtotal >= threshold ? 0 : flatRate;
      const discount = 0;
      const tax = Number(((subtotal - discount) * 0.08).toFixed(2));
      const total = Math.max(0, subtotal + shippingCost + tax - discount);

      const orderId = crypto.randomUUID();
      const orderNum = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${orderId
        .slice(0, 6)
        .toUpperCase()}`;

      const orderItems = cartData.items.map((item) => ({
        id: crypto.randomUUID(),
        product: item.product_id,
        variant: item.variant,
        product_name_snapshot: item.product_name,
        sku_snapshot: item.variant_sku,
        variant_snapshot: { name: item.variant_name },
        unit_price: item.unit_price,
        quantity: item.quantity,
        discount: "0.00",
        tax: "0.00",
        total: item.line_total,
      }));

      const order = {
        id: orderId,
        order_number: orderNum,
        user: user?.id || null,
        guest_email: body.guest_email || user?.email || "guest@example.com",
        customer_email: user?.email || body.guest_email || "guest@example.com",
        status: "pending",
        payment_method: "bakong_khqr",
        payment_status: "unpaid",
        fulfillment_status: "unfulfilled",
        currency: "USD",
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        shipping_cost: shippingCost.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        items_count: cartData.total_items,
        shipping_address_snapshot: body.shipping_address || {
          recipient_name: user?.full_name || "Customer",
          address_line_1: "Phnom Penh",
        },
        billing_address_snapshot: body.billing_address || body.shipping_address || {},
        items: orderItems,
        payments: [],
        refunds: [],
        shipments: [],
        returns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      st.orders.unshift(order);
      if (st.carts[cartKey]) st.carts[cartKey].items = [];
      await saveState(ctx);

      return jsonResponse({ message: "Order created successfully!", order }, 201);
    }

    if (apiPath === "orders" && method === "GET") {
      return jsonResponse({
        count: st.orders.length,
        next: null,
        previous: null,
        results: st.orders,
      });
    }

    const orderMatch = apiPath.match(/^orders\/([^/]+)$/);
    if (orderMatch && method === "GET") {
      const oid = orderMatch[1];
      const ord = st.orders.find(
        (o) => String(o.id) === oid || String(o.order_number) === oid
      );
      if (!ord) return jsonResponse({ error: "Order not found." }, 404);
      return jsonResponse(ord);
    }

    // --- BAKONG KHQR PAYMENTS ---
    if (apiPath === "payments/khqr/generate" && method === "POST") {
      const oid = body.order_id;
      const ord = st.orders.find((o) => String(o.id) === String(oid)) || st.orders[0];
      if (!ord) return jsonResponse({ error: "Order not found." }, 404);

      const amount = body.amount ?? ord.total;
      const currency = body.currency || ord.currency || "USD";
      const gen = generateKhqrPayload(ord.order_number, amount, currency);
      const paymentId = crypto.randomUUID();
      const paymentObj = {
        id: paymentId,
        order: ord.id,
        gateway: "bakong_khqr",
        transaction_id: gen.md5,
        amount: String(amount),
        currency,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      ord.payments = [paymentObj];
      st.payments[gen.md5] = { payment: paymentObj, orderId: ord.id };
      await saveState(ctx);

      return jsonResponse({
        message: "KHQR generated successfully. Scan to pay.",
        qr: gen.qr,
        md5: gen.md5,
        deep_link: null,
        expires_at: gen.expires_at,
        payment_id: paymentId,
        order: ord,
      });
    }

    if (apiPath === "payments/khqr/check-status" && method === "GET") {
      const md5Hash = url.searchParams.get("md5");
      const rec = st.payments[md5Hash];
      const ord =
        (rec && st.orders.find((o) => String(o.id) === String(rec.orderId))) ||
        st.orders[0];
      const res = await checkBakongMd5(md5Hash);
      if (res.paid && ord) {
        ord.payment_status = "paid";
        ord.status = "processing";
        if (rec?.payment) rec.payment.status = "paid";
        await saveState(ctx);
      }
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
      const ord = st.orders.find((o) => String(o.id) === String(oid)) || st.orders[0];
      const md5Hash = body.md5 || ord?.payments?.[0]?.transaction_id;
      if (!md5Hash) {
        return jsonResponse({ paid: false, status: "PENDING", order: ord || null });
      }
      const res = await checkBakongMd5(md5Hash);
      if (res.paid && ord) {
        ord.payment_status = "paid";
        ord.status = "processing";
        await saveState(ctx);
      }
      return jsonResponse({
        paid: Boolean(res.paid),
        status: res.paid ? "SUCCESS" : "PENDING",
        order: ord || null,
      });
    }

    // --- ADMIN ENDPOINTS ---
    if (apiPath === "users" && method === "GET") {
      return jsonResponse(st.users);
    }
    if (apiPath === "roles" && method === "GET") {
      return jsonResponse(st.roles);
    }
    if (apiPath === "reviews" && method === "GET") {
      return jsonResponse(Object.values(st.reviews).flat());
    }
    if (apiPath === "audit-logs" && method === "GET") {
      return jsonResponse({ count: 0, results: [] });
    }

    return jsonResponse({ error: `Endpoint /api/${apiPath} not found.` }, 404);
  },
};
