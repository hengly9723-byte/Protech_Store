import axios from "axios";

// Base API URL pointing to the Django REST Framework backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

// In-memory token store to avoid storing raw JWT access tokens in localStorage (mitigating XSS)
let inMemoryAccessToken = null;

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => {
  return inMemoryAccessToken;
};

// Session ID for guest cart / session tracking
export const getSessionId = () => {
  let sessionId = localStorage.getItem("protech_session_id");
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("protech_session_id", sessionId);
  }
  return sessionId;
};

// ------------------------------------------------------------------
// 429 rate-limit cooldown
// When DRF throttles a request, we remember the endpoint and short-circuit
// repeat requests to it for a short window so the app does not keep hammering
// the server while it is rate limited.
// ------------------------------------------------------------------
const rateLimitedUntil = new Map();
const RATE_LIMIT_COOLDOWN_MS = 30 * 1000;

const makeRateLimitError = (config) => {
  const err = new Error("Too many requests. Please slow down and try again shortly.");
  err.isRateLimited = true;
  err.config = config;
  err.response = {
    status: 429,
    statusText: "Too Many Requests",
    data: { error: "Too many requests. Please try again in a moment." },
    headers: {},
    config,
  };
  return err;
};

const isRateLimitedKey = (config) => {
  if (!config) return false;
  const key = `${config.method || "get"} ${config.url || ""}`;
  const until = rateLimitedUntil.get(key);
  if (until && Date.now() < until) return true;
  if (until) rateLimitedUntil.delete(key); // cooldown expired
  return false;
};

const markRateLimited = (config) => {
  const key = `${config.method || "get"} ${config.url || ""}`;
  rateLimitedUntil.set(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
};

// Guest email used to look up guest orders (backend requires ?guest_email for guest access)
export const getGuestEmail = () => localStorage.getItem("protech_guest_email") || "";

export const setGuestEmail = (email) => {
  if (email) {
    localStorage.setItem("protech_guest_email", email);
  } else {
    localStorage.removeItem("protech_guest_email");
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  },
});

// Request Interceptor: Attach JWT Bearer token and X-Session-ID
api.interceptors.request.use(
  (config) => {
    // Short-circuit requests that were recently rate limited so we don't spam
    // the server during a 429 cooldown window.
    if (isRateLimitedKey(config)) {
      return Promise.reject(makeRateLimitError(config));
    }

    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const sessionId = getSessionId();
    if (sessionId) {
      config.headers["X-Session-ID"] = sessionId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh on 401 Unauthorized
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle rate limiting: remember the endpoint, surface a friendly error,
    // and never auto-retry so we don't create a request storm against DRF.
    if (error.response?.status === 429) {
      markRateLimited(originalRequest);
      return Promise.reject(makeRateLimitError(originalRequest));
    }

    // Do not attempt token refresh for authentication endpoints
    if (
      originalRequest.url.includes("/auth/login") ||
      originalRequest.url.includes("/auth/refresh") ||
      originalRequest.url.includes("/auth/register")
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("protech_refresh_token");

      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh: refreshToken,
        });

        const newAccessToken = response.data.access;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("protech_refresh_token");
        localStorage.removeItem("protech_user");
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent("protech:auth_logout"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ==========================================
// API Endpoint Helpers
// ==========================================

// Auth Endpoints
export const loginApi = (email, password) => api.post("/auth/login", { email, password });
export const registerApi = (data) => api.post("/auth/register", data);
export const googleLoginApi = (token) => api.post("/auth/google/", { token });
export const refreshTokenApi = (refresh) => api.post("/auth/refresh", { refresh });
export const verifyEmailApi = (token) => api.post("/auth/verify-email", { token });
export const requestPasswordResetApi = (email) => api.post("/auth/request-password-reset", { email });
export const resetPasswordApi = (token, password, confirmPassword) =>
  api.post("/auth/reset-password", {
    token,
    password,
    confirm_password: confirmPassword || password,
  });
export const getUserMeApi = () => api.get("/users/me");
export const updateUserMeApi = (data) => api.patch("/users/me", data);

// Address Endpoints
export const getAddressesApi = () => api.get("/addresses/");
export const createAddressApi = (data) => api.post("/addresses/", data);
export const updateAddressApi = (id, data) => api.patch(`/addresses/${id}/`, data);
export const deleteAddressApi = (id) => api.delete(`/addresses/${id}/`);

// Catalog Endpoints
export const getProductsApi = (params = {}) => api.get("/products/", { params });
export const getProductDetailApi = (idOrSlug) => api.get(`/products/${idOrSlug}/`);
export const getCatalogVariantsApi = (params = {}) => api.get("/variants/", { params });
export const getVariantDetailApi = (variantId) => api.get(`/variants/${variantId}/`);
export const getCategoriesApi = (params = {}) => api.get("/categories/", { params });
export const getBrandsApi = (params = {}) => api.get("/brands/", { params });
export const getProductTypesApi = () => api.get("/product-types/");

// Stock Endpoints
export const getVariantStockApi = (variantId) => api.get(`/stock/${variantId}/`);

// Cart & Wishlist Endpoints
export const getCartApi = () => api.get("/cart/");
export const addToCartApi = (variant_id, quantity = 1) =>
  api.post("/cart/items/", { variant_id, quantity: Math.max(1, parseInt(quantity, 10) || 1) });
export const updateCartItemApi = (itemId, quantity) => api.patch(`/cart/items/${itemId}/`, { quantity });
export const removeCartItemApi = (itemId) => api.delete(`/cart/items/${itemId}/`);
export const clearCartApi = () => api.delete("/cart/");
export const getWishlistApi = (config = {}) => api.get("/wishlist/", config);
export const toggleWishlistApi = (productId, desiredState = null, config = {}) =>
  api.post("/wishlist/toggle/", { product_id: productId, desired_state: desiredState }, config);
export const addToWishlistApi = (product_id, config = {}) => api.post("/wishlist/", { product_id }, config);
export const removeFromWishlistApi = (productId, config = {}) => api.delete(`/wishlist/?product_id=${productId}`, config);

// Reviews Endpoints
export const getProductReviewsApi = (productId) => api.get(`/products/${productId}/reviews/`);
export const submitProductReviewApi = (productId, data) => api.post(`/products/${productId}/reviews/`, data);

// Marketing / Discount Code Endpoints
export const validateDiscountCodeApi = (code, cart_total) =>
  api.post("/discount-codes/validate/", { code, cart_total });

// Shipping rules (admin-configurable) — used for frontend estimates
export const getShippingConfigApi = () => api.get("/shipping/config/");
export const updateShippingConfigApi = (data) => api.put("/shipping/config/", data);

// Orders & Checkout Endpoints
export const checkoutApi = (checkoutData) => api.post("/checkout/", checkoutData);
export const getOrdersApi = () => {
  const params = {};
  const guestEmail = getGuestEmail();
  if (guestEmail) params.guest_email = guestEmail;
  return api.get("/orders/", { params });
};
export const getOrderDetailApi = (orderId) => {
  const params = {};
  const guestEmail = getGuestEmail();
  if (guestEmail) params.guest_email = guestEmail;
  return api.get(`/orders/${orderId}/`, { params });
};
export const requestOrderReturnApi = (orderId, returnData) => api.post(`/orders/${orderId}/return/`, returnData);

// Bakong KHQR Payment Endpoints
export const generateKhqrApi = (orderId, data = {}) =>
  api.post("/payments/khqr/generate/", { order_id: orderId, ...data });
export const checkKhqrStatusApi = (md5, params = {}) =>
  api.get(`/payments/khqr/check-status/`, { params: { md5, ...params } });
export const verifyPaymentApi = (data) => api.post("/payments/verify/", data);

// ==========================================
// Admin Endpoints
// ==========================================

// Dashboard / Orders
export const getAdminOrdersApi = (params = {}) => api.get("/orders/", { params });
export const updateOrderStatusApi = (id, data) => api.patch(`/orders/${id}/status`, data);
export const refundOrderApi = (id, data) => api.post(`/orders/${id}/refund`, data);
export const shipOrderApi = (id, data) => api.post(`/orders/${id}/ship`, data);
export const updateReturnStatusApi = (id, status) => api.patch(`/orders/returns/${id}`, { status });

// Products & catalog management
export const createProductApi = (data) => api.post("/products/", data);
export const updateProductApi = (id, data) => api.patch(`/products/${id}/`, data);
export const deleteProductApi = (id) => api.delete(`/products/${id}/`);
export const getVariantsApi = (params = {}) => api.get("/variants/", { params });
export const generateBarcodeApi = () => api.get("/variants/generate-barcode/");
export const createVariantApi = (data) => api.post("/variants/", data);
export const updateVariantApi = (id, data) => api.patch(`/variants/${id}/`, data);
export const deleteVariantApi = (id) => api.delete(`/variants/${id}/`);
export const getProductImagesApi = (params = {}) => api.get("/product-images/", { params });
export const createProductImageApi = (data) => api.post("/product-images/", data);
export const updateProductImageApi = (id, data) => api.patch(`/product-images/${id}/`, data);
export const deleteProductImageApi = (id) => api.delete(`/product-images/${id}/`);
export const getProductSpecsApi = (params = {}) => api.get("/product-specifications/", { params });
export const createProductSpecApi = (data) => api.post("/product-specifications/", data);
export const updateProductSpecApi = (id, data) => api.patch(`/product-specifications/${id}/`, data);
export const deleteProductSpecApi = (id) => api.delete(`/product-specifications/${id}/`);
export const getSpecDefinitionsApi = (params = {}) => api.get("/specification-definitions/", { params });
export const createSpecDefinitionApi = (data) => api.post("/specification-definitions/", data);
export const updateSpecDefinitionApi = (id, data) => api.patch(`/specification-definitions/${id}/`, data);
export const deleteSpecDefinitionApi = (id) => api.delete(`/specification-definitions/${id}/`);
export const getSpecOptionsApi = (params = {}) => api.get("/specification-options/", { params });
export const createSpecOptionApi = (data) => api.post("/specification-options/", data);
export const updateSpecOptionApi = (id, data) => api.patch(`/specification-options/${id}/`, data);
export const deleteSpecOptionApi = (id) => api.delete(`/specification-options/${id}/`);

// Categories & Brands
export const getAdminCategoriesApi = (params = {}) => api.get("/categories/", { params });
export const createCategoryApi = (data) => api.post("/categories/", data);
export const updateCategoryApi = (id, data) => api.patch(`/categories/${id}/`, data);
export const deleteCategoryApi = (id) => api.delete(`/categories/${id}/`);
export const getAdminBrandsApi = (params = {}) => api.get("/brands/", { params });
export const createBrandApi = (data) => api.post("/brands/", data);
export const updateBrandApi = (id, data) => api.patch(`/brands/${id}/`, data);
export const deleteBrandApi = (id) => api.delete(`/brands/${id}/`);

// Stock
export const getStockApi = (params = {}) => api.get("/stock/", { params });
export const getLowStockApi = (params = {}) => api.get("/stock/low", { params });
export const getStockTransactionsApi = (params = {}) => api.get("/stock/transactions/", { params });
export const adjustStockApi = (variantId, data) => api.post(`/stock/${variantId}/adjust`, data);

// Marketing
export const getAdminDiscountCodesApi = () => api.get("/discount-codes/");
export const createDiscountCodeApi = (data) => api.post("/discount-codes/", data);
export const updateDiscountCodeApi = (id, data) => api.patch(`/discount-codes/${id}/`, data);
export const deleteDiscountCodeApi = (id) => api.delete(`/discount-codes/${id}/`);
export const getAdminPromotionsApi = () => api.get("/promotions/");
export const getActivePromotionsApi = () => api.get("/promotions/active/");
export const createPromotionApi = (data) => api.post("/promotions/", data);
export const updatePromotionApi = (id, data) => api.patch(`/promotions/${id}/`, data);
export const deletePromotionApi = (id) => api.delete(`/promotions/${id}/`);
export const uploadPromotionBannerApi = (file) => {
  const formData = new FormData();
  formData.append("banner", file);
  return api.post("/promotions/upload-banner/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// Reviews moderation
export const getAdminReviewsApi = (params = {}) => api.get("/reviews/", { params });
export const updateReviewStatusApi = (id, status) => api.patch(`/reviews/${id}/`, { status });

// Users
export const getAdminUsersApi = (params = {}) => api.get("/users/", { params });
export const updateAdminUserApi = (id, data) => api.patch(`/users/${id}/`, data);
export const getAdminRolesApi = () => api.get("/roles/");

// Audit logs
export const getAuditLogsApi = (params = {}) => api.get("/audit-logs/", { params });

export default api;

