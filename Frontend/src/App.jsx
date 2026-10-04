import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/admin/AdminRoute";
import AdminLayout from "./components/admin/AdminLayout";

// Pages
import LoginPage from "./page/auth/LoginPage";
import RegisterPage from "./page/auth/RegisterPage";
import VerifyEmailPage from "./page/auth/VerifyEmailPage";
import ForgotPasswordPage from "./page/auth/ForgotPasswordPage";
import ResetPasswordPage from "./page/auth/ResetPasswordPage";
import ProfilePage from "./page/profile/ProfilePage";
import ProductCatalogPage from "./page/catalog/ProductCatalogPage";
import ProductDetailPage from "./page/catalog/ProductDetailPage";
import SpecificationsPage from "./page/admin/SpecificationsPage";

// Checkout & Order Pages
import CartPage from "./page/checkout/CartPage";
import WishlistPage from "./page/checkout/WishlistPage";
import CheckoutPage from "./page/checkout/CheckoutPage";
import PaymentPage from "./page/checkout/PaymentPage";
import OrderConfirmationPage from "./page/checkout/OrderConfirmationPage";
import OrderHistoryPage from "./page/orders/OrderHistoryPage";
import OrderDetailPage from "./page/orders/OrderDetailPage";

// Admin Pages
import DashboardPage from "./page/admin/DashboardPage";
import ProductsPage from "./page/admin/ProductsPage";
import ProductFormPage from "./page/admin/ProductFormPage";
import CategoriesPage from "./page/admin/CategoriesPage";
import BrandsPage from "./page/admin/BrandsPage";
import OrdersPage from "./page/admin/OrdersPage";
import StockPage from "./page/admin/StockPage";
import DiscountCodesPage from "./page/admin/DiscountCodesPage";
import PromotionsPage from "./page/admin/PromotionsPage";
import ShippingSettingsPage from "./page/admin/ShippingSettingsPage";
import ReviewsPage from "./page/admin/ReviewsPage";
import UsersPage from "./page/admin/UsersPage";
import AuditLogsPage from "./page/admin/AuditLogsPage";

const AppContent = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div
      className={
        isAdminRoute
          ? "h-screen w-full bg-background text-slate-800 flex flex-col selection:bg-blue-400 selection:text-white font-sans overflow-hidden"
          : "min-h-screen w-full bg-background text-slate-800 flex flex-col selection:bg-blue-400 selection:text-white font-sans"
      }
    >
      {/* Main Navigation Header */}
      <Header />

      {/* Page Routing Container */}
      <div
        className={
          isAdminRoute
            ? "flex-1 w-full h-full min-h-0 overflow-hidden"
            : "flex-1 w-full"
        }
      >
        <Routes>
          {/* Public Catalog & Browsing Routes */}
          <Route path="/" element={<ProductCatalogPage />} />
          <Route path="/products" element={<ProductCatalogPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route
            path="/products/:id/variant/:variantId"
            element={<ProductDetailPage />}
          />
          <Route
            path="/categories/:categorySlug"
            element={<ProductCatalogPage />}
          />
          <Route path="/brands/:brandSlug" element={<ProductCatalogPage />} />

          {/* Public Cart & Checkout Routes */}
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/payment" element={<PaymentPage />} />
          <Route path="/checkout/success" element={<OrderConfirmationPage />} />
          <Route
            path="/order-confirmation/:id"
            element={<OrderConfirmationPage />}
          />
          <Route
            path="/orders/:id/success"
            element={<OrderConfirmationPage />}
          />

          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrderHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Panel */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="specifications" element={<SpecificationsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="discount-codes" element={<DiscountCodesPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="shipping" element={<ShippingSettingsPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<ProductCatalogPage />} />
        </Routes>
      </div>

      {/* Footer (storefront only) */}
      {!isAdminRoute && (
        <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              © {new Date().getFullYear()} Protech E-Commerce Store. All rights
              reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/api/docs"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:underline"
              >
                API Docs (Swagger)
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <AppContent />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
