# E-Commerce Platform - Development Progress

> **BACKEND STATUS**: [COMPLETED] (All 36 database tables, DRF APIs, RBAC, atomic checkout, inventory, reviews, marketing, audit logs, and OpenAPI documentation).
> **FRONTEND STATUS**: [COMPLETED] (Authentication, Product Catalog, Filtering, Detail, Reviews, Cart, Wishlist, Checkout, Payment, Orders, and Admin Dashboard UI).

---

## Backend Milestones (Sessions 1 - 7)
- **Session 1 (Accounts & RBAC)**: User models, UUID PKs, JWT authentication, roles & permissions catalogue, address management.
- **Session 2 (Product Catalog)**: Brands, product types (Physical, Digital, Service seeded), categories with subcategory hierarchy, products, variants, images, specifications.
- **Session 3 (Stock & Inventory)**: Real-time stock levels, atomic adjustments with row locking (`select_for_update`), low-stock alerts, audit transactions.
- **Session 4 (Shopping Cart & Wishlist)**: Guest (`X-Session-ID`) and authenticated user carts with automatic cart merging on login, price snapshots, wishlist toggle.
- **Session 5 (Orders & Checkout Lifecycle)**: Atomic checkout, order items snapshotting, stock decrement, mock payments, shipments, refunds, and customer returns flow.
- **Session 6 (Reviews & Marketing)**: Gated verified-purchase reviews, discount codes validation, checkout discount integration, and promotions.
- **Session 7 (Notifications, Audit Logging & Polish)**: In-app notifications, automated audit logging via signals, OpenAPI Swagger UI at `/api/docs/`, global exception handler, rate limiting throttles, and CORS configuration.

---

## Frontend Session 1: Foundation & Authentication
- **React + Vite Setup**: Configured with `react-router-dom`, `axios`, `@react-oauth/google`, `tailwindcss`, and `bootstrap-icons`.
- **In-Memory JWT Access Token**: Stored in memory closure (`inMemoryAccessToken`) with auto token refresh interceptor on 401 Unauthorized.
- **Auth Context ([context/AuthContext.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/context/AuthContext.jsx))**: Global authentication provider with silent session restoration on boot.
- **Auth Pages**: `LoginPage` (`/login`), `RegisterPage` (`/register`), `VerifyEmailPage` (`/verify-email`), `ForgotPasswordPage` (`/forgot-password`), `ResetPasswordPage` (`/reset-password`), `ProfilePage` (`/profile`).

---

## Frontend Session 2: Product Browsing & Catalog Experience

### 1. What was built in this session
- **Product Catalog Page ([page/catalog/ProductCatalogPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/catalog/ProductCatalogPage.jsx))**:
  - Grid view of products consuming `/api/products/`.
  - Multi-criteria filtering: category hierarchy, brands, product type, min/max price range, and featured-only toggle.
  - Search bar and sorting options (`Newest First`, `Price: Low to High`, `Price: High to Low`, `Name`).
  - Server-driven pagination controls.
- **Product Detail Page ([page/catalog/ProductDetailPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/catalog/ProductDetailPage.jsx))**:
  - Image gallery with interactive thumbnail selector.
  - Variant picker with real-time stock inquiry against `/api/stock/<variant_id>`.
  - Pricing display (base price, compare-at price, dynamic discount badge).
  - Quantity counter with available stock ceiling validation.
  - "Add to Cart" (calls `/api/cart/items`) and "Add to Wishlist" (calls `/api/wishlist`) buttons with visual confirmation alerts.
  - Technical specifications table (displaying unit, data types, and values).
  - Customer review list and verified purchase review submission form.
- **Category & Brand Routes**:
  - `/categories/:categorySlug` and `/brands/:brandSlug` dynamically filter the catalog view.
- **Reusable Catalog Components**:
  - `ProductCard` ([components/catalog/ProductCard.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/ProductCard.jsx)): Clean product card with discount badges, price display, and wishlist toggle button.
  - `ProductGrid` ([components/catalog/ProductGrid.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/ProductGrid.jsx)): Responsive product grid with loading skeleton states and empty search result indicators.
  - `FilterSidebar` ([components/catalog/FilterSidebar.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/FilterSidebar.jsx)): Sticky desktop sidebar and mobile slide-over drawer for category/brand/price filtering.
  - `VariantSelector` ([components/catalog/VariantSelector.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/VariantSelector.jsx)): Variant option tiles and live stock badges (`In Stock`, `Low Stock`, `Out of Stock`).
  - `StarRating` ([components/catalog/StarRating.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/StarRating.jsx)): Bootstrap Icon star rating indicator and interactive rating picker.
  - `ReviewList` & `ReviewForm` ([components/catalog/ReviewList.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/ReviewList.jsx) & [components/catalog/ReviewForm.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/catalog/ReviewForm.jsx)): Verified purchase customer reviews and submission form.

---

### 2. Updated Frontend Folder Structure
```
Frontend/src/
├── components/
│   ├── catalog/
│   │   ├── FilterSidebar.jsx
│   │   ├── ProductCard.jsx
│   │   ├── ProductGrid.jsx
│   │   ├── ReviewForm.jsx
│   │   ├── ReviewList.jsx
│   │   ├── StarRating.jsx
│   │   └── VariantSelector.jsx
│   ├── Header.jsx
│   └── ProtectedRoute.jsx
├── context/
│   ├── AuthContext.jsx
│   └── CartContext.jsx
├── page/
│   ├── auth/
│   │   ├── ForgotPasswordPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── ResetPasswordPage.jsx
│   │   └── VerifyEmailPage.jsx
│   ├── catalog/
│   │   ├── ProductCatalogPage.jsx
│   │   └── ProductDetailPage.jsx
│   ├── checkout/
│   │   ├── CartPage.jsx
│   │   ├── CheckoutPage.jsx
│   │   ├── OrderConfirmationPage.jsx
│   │   ├── PaymentPage.jsx
│   │   └── WishlistPage.jsx
│   ├── orders/
│   │   ├── OrderDetailPage.jsx
│   │   └── OrderHistoryPage.jsx
│   ├── profile/
│   │   └── ProfilePage.jsx
│   └── HomePage.jsx
├── services/
│   └── api.js
├── utils/
│   └── format.js
├── App.jsx
└── main.jsx
```

---

### 3. Next Session Roadmap
- **Frontend Session 3 (Shopping Cart, Wishlist, Checkout & Order Tracking)**:
  - Build `CartPage` (`/cart`) with quantity updates, line item subtotals, and empty state.
  - Build `WishlistPage` (`/wishlist`) with move-to-cart actions.
  - Build `CheckoutPage` (`/checkout`) with address selection, discount code validation, order summary, and atomic order placement.
  - Build `OrderHistoryPage` (`/orders`) and `OrderDetailPage` (`/orders/:id`) with real-time tracking badges and returns request modal.

---

## Frontend Session 3: Cart, Wishlist, Checkout & Order Tracking

### 1. What was built in this session
- **Cart Context ([context/CartContext.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/context/CartContext.jsx))**: Global cart state shared across the app. Loads the active cart (guest or authenticated) on boot and re-syncs on auth changes (guest carts merge on login). Exposes `cartCount` for the header badge plus shared `discountCode` / `discountInfo` state used by both the Cart and Checkout pages.
- **Cart Page ([page/checkout/CartPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/checkout/CartPage.jsx))** at `/cart`:
  - Cart line items with product image, name, variant, unit price, and line subtotals.
  - Quantity stepper clamped to `available_stock` with inline "Only X left in stock" warnings, remove-item and clear-cart actions.
  - Discount code input calling `/api/discount-codes/validate/` with applied/error feedback.
  - Order summary (subtotal, discount, shipping, tax) and a "Proceed to Checkout" button.
- **Wishlist Page ([page/checkout/WishlistPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/checkout/WishlistPage.jsx))** at `/wishlist` (auth-protected): wishlist item cards, remove, and "Move to Cart" which resolves an active variant, adds it via `/api/cart/items/`, removes it from the wishlist, and refreshes the cart.
- **Checkout Page ([page/checkout/CheckoutPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/checkout/CheckoutPage.jsx))** at `/checkout`:
  - Saved-address radio selection or new-address entry for authenticated users; guest email + address entry for guests.
  - Reusable discount code validation and live order summary.
  - "Place Order" calls `/api/checkout/` (atomic), then forwards to `/checkout/payment?order=<id>`. Guest email is persisted to `localStorage` so guest order lookups work.
- **Payment Page ([page/checkout/PaymentPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/checkout/PaymentPage.jsx))** at `/checkout/payment`: mock card form calling `/api/orders/<id>/pay/` and redirecting to the order confirmation page.
- **Order Confirmation ([page/checkout/OrderConfirmationPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/checkout/OrderConfirmationPage.jsx))** at `/order-confirmation/:id`: success summary with order number, totals, items, and shipping details.
- **Order History ([page/orders/OrderHistoryPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/orders/OrderHistoryPage.jsx))** at `/orders` (auth-protected): list of the logged-in user's orders with status / payment / fulfillment badges.
- **Order Detail ([page/orders/OrderDetailPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/orders/OrderDetailPage.jsx))** at `/orders/:id` (auth-protected): order status overview, items + totals, tracking information (carrier, tracking #, shipped/delivered dates), payments, returns history, and a "Request Return" modal (items, reason, resolution) shown when the order has a delivered shipment and no pending return.
- **Header Cart Badge ([components/Header.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/Header.jsx))**: cart icon now shows a live item-count badge (capped at "99+") driven by `useCart().cartCount`, plus wishlist/orders links for logged-in users.
- **Stock Error Handling**: cart quantity steppers are clamped to `available_stock` with inline "Only X left in stock" notices; add-to-cart / quantity-update server errors (e.g. "Insufficient stock. Only N available") surface as readable inline messages.

### 2. Guest Checkout Fix
The backend `OrderViewSet` only exposes guest orders when a `guest_email` query param is supplied. The frontend now persists the guest email after checkout (`localStorage["protech_guest_email"]`) and `getOrdersApi` / `getOrderDetailApi` automatically attach it, so guests can reach Payment, Confirmation, and order lookups for the order they just placed.

---

## Frontend Session 4: Admin Dashboard UI

### 1. What was built in this session
- **Admin Access Control**:
  - `AdminRoute` ([components/admin/AdminRoute.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/admin/AdminRoute.jsx)): route guard — requires authentication and passes `isAdminUser(user)` (superuser, staff, `role === 'admin'`, an `admin` role in M2M roles, or `view_dashboard` permission). Unauthenticated → `/login`, non-admin → `/`.
  - `AdminLayout` ([components/admin/AdminLayout.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/admin/AdminLayout.jsx)): fixed sidebar (desktop) + horizontal scroll nav (mobile), top bar with current admin, storefront/logout links.
  - Header ([components/Header.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/Header.jsx)): "Admin"/"Admin Panel" links appear in desktop nav, dropdown, and mobile drawer only for `isAdmin` users.
  - `AuthContext` now refreshes the full profile (`/api/users/me/`) right after Google login so roles/permissions are populated before admin gating.
- **Shared Admin UI ([components/admin/ui.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/components/admin/ui.jsx))**: `PageHeader`, `Spinner`, `EmptyState`, `Badge`, `Modal`, `Input`, `Select`, `TextArea`, `Checkbox`, `Button`, `TableWrap`, `TableHead`.
- **Dashboard ([page/admin/DashboardPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/DashboardPage.jsx))** at `/admin`: KPI cards (orders, paid revenue, low-stock alerts, pending reviews), low-stock table, recent orders.
- **Products ([page/admin/ProductsPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/ProductsPage.jsx))** at `/admin/products`: searchable/filterable list with delete; links to create/edit form.
- **Product Form ([page/admin/ProductFormPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/ProductFormPage.jsx))** at `/admin/products/new` & `/admin/products/:id/edit`: tabbed editor (Details / Variants / Images / Specifications) with inline create/edit modals for variants, images, and spec values.
- **Categories ([page/admin/CategoriesPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/CategoriesPage.jsx))** at `/admin/categories` and **Brands ([page/admin/BrandsPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/BrandsPage.jsx))** at `/admin/brands`: full CRUD.
- **Orders ([page/admin/OrdersPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/OrdersPage.jsx))** at `/admin/orders`: table with status/fulfillment/payment update controls, refund & ship modals, detail modal with items, shipments, refunds, returns and approve/reject return actions.
- **Stock ([page/admin/StockPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/StockPage.jsx))** at `/admin/stock`: stock-level table (available/reserved/damaged/reorder, low badges) with adjust modal, plus a transactions audit tab. Added backend `StockListView` at `GET /api/stock/` (admin) to list all stock with product/SKU search.
- **Discount Codes ([page/admin/DiscountCodesPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/DiscountCodesPage.jsx))** at `/admin/discount-codes` and **Promotions ([page/admin/PromotionsPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/PromotionsPage.jsx))** at `/admin/promotions`: CRUD with product/category restriction pickers.
- **Reviews ([page/admin/ReviewsPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/ReviewsPage.jsx))** at `/admin/reviews`: status filter and approve/reject moderation.
- **Users ([page/admin/UsersPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/UsersPage.jsx))** at `/admin/users`: user list with role assignment modal (`role`, M2M `role_ids`, staff/superuser/active/email-verified toggles) via `PATCH /api/users/<uuid:id>`.
- **Audit Logs ([page/admin/AuditLogsPage.jsx](file:///d:/For_selfleaning/ReactJsXdjango/Frontend/src/page/admin/AuditLogsPage.jsx))** at `/admin/audit-logs`: read-only paginated log browser with action/entity filters and a JSON old/new-values detail modal.
- **Backend additions this session**:
  - `accounts/serializers.py` + `accounts/views.py`: `AdminUserSerializer`, `AdminUserViewSet` (`GET/PATCH /api/users/`, `GET/PATCH /api/users/<uuid:id>/`, admin-gated).
  - `marketing/views.py` + `marketing/urls.py`: `AdminReviewListView` (`GET /api/reviews/`, optional `?status=`, admin-gated).
  - `stock/views.py` + `stock/urls.py`: `StockListView` (`GET /api/stock/`, admin-gated).
  - `notifications/serializers.py`: fixed `AuditLogSerializer` bug (`read_only_fields = '__all__'` → explicit field list).

### 2. Verified
- `manage.py check` passes; admin endpoints verified with an admin JWT (stock list, transactions, reviews list, roles, users, audit logs all 200).
- `npm run build` passes (Vite production build); `npm run lint` reports no errors (remaining warnings are pre-existing in non-admin pages).

### 3. Known Gaps / Future Work
- **Payment gateway is still mocked** (`/api/orders/<id>/pay/` accepts any mock card). Swap in a real provider (Stripe etc.) when ready.
- **Transactional email is not wired** to a real SMTP provider (verification/password-reset links are returned in the API response and shown in the UI, not emailed).
- **`Backend/api/tests.py` is stale** — it references `api.urls`, which is not mounted in `core/urls.py`; those tests 404 and were intentionally left out of scope.
- **`Frontend/.env` / `Frontend/.env.production`** still use the placeholder ngrok base URL for Google OAuth; replace with the production domain.
- **Chunk-size warning** in the Vite build (bundle > 500 kB) — could be addressed later with route-level code-splitting via `lazy()`.
- Google OAuth login auto-grants admin to `SUPERUSER_EMAILS` (currently `hengly9723@gmail.com`).
