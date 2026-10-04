# ⚡ Protech E-Commerce Platform

Enterprise Full-Stack E-Commerce Platform built with **Django REST Framework + PostgreSQL** (Backend) and **React 18 + Vite + TailwindCSS** (Frontend).

---

## 🏛️ System Architecture

```
ReactJsXdjango/
├── Backend/                 # Django 6 + Django REST Framework
│   ├── core/                # Project settings, URLs, Swagger docs, global exceptions
│   ├── accounts/            # Users, JWT Auth, RBAC Roles & Permissions, Addresses
│   ├── catalog/             # Brands, Categories, Products, Variants, Images, Specs
│   ├── stock/               # Real-time stock levels, Atomic adjustments, Audit logs
│   ├── shopping/            # Shopping Cart (Guest & Auth), Wishlists
│   ├── orders/              # Atomic Checkout, Payments, Shipments, Refunds, Returns
│   ├── marketing/           # Customer Reviews (verified purchase gating), Discount Codes, Promotions
│   ├── notifications/       # In-app notifications & Automated system audit logs
│   └── manage.py
├── Frontend/                # React + Vite + TailwindCSS Frontend Application
│   ├── src/
│   │   ├── components/      # Navbar, Sidebar, Modals, Product Cards
│   │   ├── page/            # Home, Product, Auth, Cart, Checkout
│   │   └── App.jsx
│   └── package.json
├── schema.sql               # 36-table enterprise PostgreSQL database schema
├── PROGRESS.md              # Milestone tracking and development progress log
└── README.md
```

---

## 🚀 Backend Quickstart

### 1. Prerequisites
- Python 3.11+ / 3.14
- PostgreSQL 14+ running locally

### 2. Environment Setup
```powershell
cd Backend
python -m venv venv
.\venv\Scripts\activate

# Install required Python packages
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers psycopg[binary] python-decouple google-auth
```

### 3. Configure Database
Copy `.env.example` to `.env` in `Backend/` and configure your PostgreSQL database credentials:
```env
DB_NAME=protech_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

### 4. Apply Database Migrations
```powershell
python manage.py migrate
```

### 5. Create Superuser (Admin)
```powershell
python manage.py createsuperuser
```

### 6. Run the Development Server
```powershell
python manage.py runserver
```
Backend API will be live at `http://127.0.0.1:8000/`.

### Bakong KHQR token (important)
Set `BAKONG_TOKEN` in the deployment environment (e.g. Vercel project settings or `Backend/.env`):
```env
# Production (real payments): https://api-bakong.nbc.gov.kh
# Sandbox (testing only): https://sit-api-bakong.nbc.gov.kh
# IMPORTANT: The base URL must match where the merchant Bakong account
# (`BAKONG_MERCHANT_ID`) is registered AND where the token was issued.
# Production tokens come from https://api-bakong.nbc.gov.kh/register/.
# If the base URL points to the SIT sandbox while the customer pays via the
# real Bakong app, the payment will never be verified (always "not found").
BAKONG_BASE_URL=https://api-bakong.nbc.gov.kh
BAKONG_TOKEN=<token from the NBC developer portal>
BAKONG_MOCK_MODE=False
```
- Bakong JWTs **expire** (typically ~30 days). When the token is missing, expired,
  or rejected, the check-status/verify endpoints return `error_code: "AUTH_CONFIG_ERROR"`
  with HTTP 500 — a server configuration problem, **not** an unpaid order.
- The server logs exactly where it expected the token (`settings.BAKONG_TOKEN` /
  env var `BAKONG_TOKEN`) and warns ~7 days before expiry. Renew it from
  https://api-bakong.nbc.gov.kh/register/ and redeploy.
- Never commit a real token; `.env` is gitignored.

---

## 📖 Interactive API Documentation

Visit **`http://127.0.0.1:8000/api/docs/`** for the full interactive **Swagger UI Documentation & Sandbox**.

### Key API Endpoints

| Domain | Route | Method | Description |
|---|---|---|---|
| **Auth** | `/api/auth/register` | POST | Register new customer account |
| **Auth** | `/api/auth/login` | POST | Obtain JWT access + refresh tokens |
| **Auth** | `/api/auth/google/` | POST | Google OAuth Sign-in & token exchange |
| **Auth** | `/api/users/me` | GET / PATCH | Authenticated user profile & permissions |
| **Catalog** | `/api/products/` | GET | Browse products (filters: category, brand, price, search) |
| **Catalog** | `/api/categories/` | GET | List product categories and hierarchy |
| **Stock** | `/api/stock/<variant_id>` | GET | Real-time available stock level |
| **Stock** | `/api/stock/<variant_id>/adjust` | POST | Admin-only atomic stock adjustment |
| **Cart** | `/api/cart` | GET / DELETE | Get or clear active shopping cart |
| **Cart** | `/api/cart/items` | POST | Add variant to cart (with stock validation) |
| **Orders** | `/api/checkout` | POST | Atomic checkout (creates order, deducts stock, clears cart) |
| **Orders** | `/api/orders` | GET | List user's order history |
| **Orders** | `/api/orders/<id>/pay` | POST | Record order payment |
| **Marketing**| `/api/discount-codes/validate`| POST | Validate coupon code & calculate savings |
| **Reviews** | `/api/products/<id>/reviews` | GET / POST | View & post product reviews (verified purchase only) |
| **Notifications** | `/api/notifications` | GET | View in-app notifications |

---

## 🎨 Frontend Setup

```powershell
cd Frontend
npm install
npm run dev
```
Frontend will be running at `http://localhost:5173`.
