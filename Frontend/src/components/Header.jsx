import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import logo from "../assets/cpu-logo-black-bold2.png";
import UserAvatar from "./UserAvatar";

const Header = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userDisplayRole =
    user?.is_superuser || user?.role === "admin"
      ? "Admin"
      : user?.is_staff || user?.role === "staff"
      ? "Staff"
      : "Customer";

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/login");
  };

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors duration-200 ${
      isActive
        ? "text-button font-semibold"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <header className="sticky top-0 z-50 shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img className="w-6 md:w-8" src={logo} alt="Protech logo" />
            <div className="flex items-center gap-1 relative">
              <span className="text-lg sm:text-xl font-bold text-black tracking-tight">
                PROTECH
              </span>
              <div className="absolute bottom-[6px] right-[-7px] w-[5px] h-[5px] rounded-full bg-primary"></div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/" className={navLinkClass}>
              Catalog
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/orders" className={navLinkClass}>
                Orders
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
            <NavLink to="/profile" className={navLinkClass}>
              Account
            </NavLink>
          </nav>

          {/* Right side: cart is always visible, everything else adapts */}
          <div className="flex items-center gap-1 sm:gap-3">
            {/* Wishlist — desktop/tablet only, moved to drawer on mobile */}
            <Link
              to="/wishlist"
              title="Wishlist"
              className="hidden sm:flex justify-center items-center relative h-10 w-10 rounded-full text-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <i className="bi bi-heart text-lg" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart — always visible, this is the one thing mobile users need at a glance */}
            <Link
              to="/cart"
              title="Shopping Cart"
              className="flex justify-center items-center relative h-10 w-10 rounded-full text-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <i className="bi bi-cart3 text-lg" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 rounded-full hover:bg-gray-100/80 transition-colors focus:outline-hidden"
                >
                  <UserAvatar
                    src={user?.avatar_url}
                    name={user?.full_name}
                    email={user?.email}
                    size="w-8 h-8 sm:w-9 sm:h-9"
                    className="ring-2 ring-sky-500/30"
                  />
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-sm font-semibold text-gray-800 leading-tight">
                      {user?.full_name || user?.email?.split("@")[0]}
                    </span>
                    <span className="text-[11px] text-gray-500 capitalize">
                      {userDisplayRole}
                    </span>
                  </div>
                  <i className="bi bi-chevron-down text-xs text-gray-400 hidden lg:inline-block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-xs text-gray-400 font-medium">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {user?.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/orders"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-sky-50/80 hover:text-sky-700 transition-colors"
                        >
                          <i className="bi bi-box-seam text-base text-gray-400" />{" "}
                          My Orders
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-sky-50/80 hover:text-sky-700 transition-colors"
                        >
                          <i className="bi bi-heart text-base text-gray-400" />{" "}
                          My Wishlist
                        </Link>
                        <Link
                          to="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-sky-50/80 hover:text-sky-700 transition-colors"
                        >
                          <i className="bi bi-person text-base text-gray-400" />{" "}
                          My Profile
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-sky-50/80 hover:text-sky-700 transition-colors"
                          >
                            <i className="bi bi-shield-lock text-base text-gray-400" />{" "}
                            Admin Panel
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-gray-100 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <i className="bi bi-box-arrow-right text-base text-red-400" />{" "}
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              // Auth buttons: only on sm+ now — mobile gets them in the drawer instead
              <div className="hidden sm:flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-sky-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-button hover:bg-button-hover rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95 transition-all duration-200 shrink-0"
            >
              <i
                className={`bi ${
                  mobileMenuOpen ? "bi-x-lg rotate-90" : "bi-list rotate-0"
                } text-xl inline-block transition-transform duration-300 ease-in-out`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer with smooth drop-down animation */}
        <div
          className={`md:hidden grid transition-all duration-350 ease-out ${
            mobileMenuOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`py-3 border-t border-gray-100 flex flex-col gap-2 transition-all duration-350 ease-out ${
                mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
              }`}
            >
              <NavLink
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Catalog
              </NavLink>
              <NavLink
                to="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <span>Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {wishlistCount}
                  </span>
                )}
              </NavLink>
              {isAuthenticated && (
                <NavLink
                  to="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Orders
                </NavLink>
              )}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Admin Panel
                </NavLink>
              )}
              <NavLink
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                My Profile
              </NavLink>

              {!isAuthenticated && (
                <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-gray-100">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-center text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-center text-white bg-button hover:bg-button-hover transition-colors"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
