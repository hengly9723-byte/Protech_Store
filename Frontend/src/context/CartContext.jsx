import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { getCartApi } from "../services/api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [cart, setCart] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);

  // Discount code state shared between Cart page and Checkout page
  const [discountCode, setDiscountCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState(null);

  // Guards against duplicate /cart/ requests: dedupe concurrent calls and only
  // re-sync when the auth state actually transitions (not on every re-render).
  const fetchingRef = useRef(false);
  const loadedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);

  const refreshCart = useCallback(async () => {
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    setCartLoading(true);
    try {
      const res = await getCartApi();
      setCart(res.data);
      setCartCount(res.data.total_items || 0);
      return res.data;
    } catch (err) {
      console.warn("Failed to load cart:", err);
      setCart(null);
      setCartCount(0);
      return null;
    } finally {
      fetchingRef.current = false;
      setCartLoading(false);
    }
  }, []);

  // Load cart on mount, and re-sync whenever auth changes (guest carts merge on login).
  // The ref guard prevents the double-fetch caused by React StrictMode.
  useEffect(() => {
    if (loadedRef.current && prevAuthRef.current === isAuthenticated) return;
    loadedRef.current = true;
    prevAuthRef.current = isAuthenticated;
    refreshCart();
  }, [isAuthenticated, refreshCart]);

  const applyDiscount = useCallback((code, info) => {
    setDiscountCode(code);
    setDiscountInfo(info);
  }, []);

  const clearDiscount = useCallback(() => {
    setDiscountCode("");
    setDiscountInfo(null);
  }, []);

  const value = useMemo(
    () => ({
      cart,
      cartCount,
      cartLoading,
      refreshCart,
      discountCode,
      discountInfo,
      applyDiscount,
      clearDiscount,
    }),
    [cart, cartCount, cartLoading, refreshCart, discountCode, discountInfo, applyDiscount, clearDiscount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
