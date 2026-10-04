import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { getWishlistApi, toggleWishlistApi } from "../services/api";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);

const STORAGE_KEY = "protech_wishlist_ids";

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // Wishlist IDs stored as a Set for instantaneous O(1) lookups
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [wishlistCount, setWishlistCount] = useState(() => wishlistIds.size);
  const [isLoading, setIsLoading] = useState(false);

  // Full wishlist items array (used by WishlistPage)
  const [wishlistItems, setWishlistItems] = useState([]);

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  // Active in-flight requests map: productId -> AbortController
  // Ensures rapid clicking aborts prior conflicting network calls (no race conditions)
  const inFlightAbortControllers = useRef(new Map());

  // Guards against duplicate fetches
  const fetchingRef = useRef(false);
  const loadedRef = useRef(false);
  const prevAuthRef = useRef(isAuthenticated);

  // Helper to trigger floating toast alerts
  const showToast = useCallback((message, type = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 3.2 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync state to localStorage cache
  const updateCachedIds = useCallback((set) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch (e) {
      // Storage quota or private mode fallback
    }
  }, []);

  // Fetch complete wishlist from backend
  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistIds(new Set());
      setWishlistCount(0);
      setWishlistItems([]);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const res = await getWishlistApi();
      const items = res.data?.items || [];
      // Support tracking by variant id (preferred for multi-variant products) or fallback to product id
      const idSet = new Set(
        items.map((item) =>
          String(item.variant || item.variant_id || item.product),
        ),
      );

      setWishlistItems(items);
      setWishlistIds(idSet);
      setWishlistCount(idSet.size);
      updateCachedIds(idSet);
      return res.data;
    } catch (err) {
      console.warn("Failed to load wishlist:", err);
      return null;
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, updateCachedIds]);

  // Sync on mount or auth change
  useEffect(() => {
    if (loadedRef.current && prevAuthRef.current === isAuthenticated) return;
    loadedRef.current = true;
    prevAuthRef.current = isAuthenticated;
    refreshWishlist();
  }, [isAuthenticated, refreshWishlist]);

  // Fast O(1) membership check
  const isWishlisted = useCallback(
    (productId) => {
      if (!productId) return false;
      return wishlistIds.has(String(productId));
    },
    [wishlistIds],
  );

  /**
   * Optimistic Wishlist Toggle:
   * 1. 0ms Immediate UI State Update (Heart turns red / turns empty instantly).
   * 2. Rapid Clicking & Spam Protection: Aborts any in-flight requests for this product.
   * 3. Sends background API call with abort signal.
   * 4. Graceful Error Rollback: If API fails, reverts state and alerts user via toast.
   */
  const toggleWishlist = useCallback(
    async (productOrId, options = {}) => {
      // Prioritize the card's specific item id (variant id if variant, otherwise product id)
      const targetId = String(
        typeof productOrId === "object"
          ? productOrId.id || productOrId.variant_id || productOrId.product_id
          : productOrId,
      );

      if (!targetId) return;

      if (!isAuthenticated) {
        showToast("Please sign in to save items to your wishlist.", "warning");
        return;
      }

      const productName =
        typeof productOrId === "object"
          ? (productOrId.product_name || productOrId.name || "Item") +
            (productOrId.sku ? ` (${productOrId.sku})` : "")
          : "Item";

      // 1. Snapshot previous state for rollback
      const prevIds = new Set(wishlistIds);
      const isCurrentlyWishlisted = prevIds.has(targetId);
      const targetState = !isCurrentlyWishlisted;

      // 2. Immediate Optimistic UI Update (0ms delay)
      const nextIds = new Set(prevIds);
      if (targetState) {
        nextIds.add(targetId);
      } else {
        nextIds.delete(targetId);
      }

      setWishlistIds(nextIds);
      setWishlistCount(nextIds.size);
      updateCachedIds(nextIds);

      // Optimistically update full items list if removing from wishlist
      if (!targetState) {
        setWishlistItems((prev) =>
          prev.filter((it) => {
            const itId = String(it.variant || it.variant_id || it.product);
            return itId !== targetId && String(it.product) !== targetId;
          }),
        );
      }

      // Visual feedback toast
      showToast(
        targetState
          ? `Added ${productName} to your wishlist`
          : `Removed ${productName} from your wishlist`,
        targetState ? "success" : "info",
      );

      // 3. Debouncing / Rapid Clicking Protection
      // Abort any prior in-flight request for this specific product/variant
      const existingController = inFlightAbortControllers.current.get(targetId);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      inFlightAbortControllers.current.set(targetId, controller);

      // 4. Background Network Synchronization
      try {
        const res = await toggleWishlistApi(targetId, targetState, {
          signal: controller.signal,
        });

        // Clean up controller ref on completion
        if (inFlightAbortControllers.current.get(targetId) === controller) {
          inFlightAbortControllers.current.delete(targetId);
        }

        // Align count with server if returned
        if (typeof res.data?.total_items === "number") {
          setWishlistCount(res.data.total_items);
        }

        if (options.onSuccess) options.onSuccess(targetState);
      } catch (err) {
        // If request was aborted due to rapid click, ignore without rollback (a newer request took over)
        if (
          axios.isCancel(err) ||
          err.name === "CanceledError" ||
          err.name === "AbortError"
        ) {
          return;
        }

        // Clean up controller ref
        if (inFlightAbortControllers.current.get(targetId) === controller) {
          inFlightAbortControllers.current.delete(targetId);
        }

        console.error("Wishlist sync error:", err);

        // 5. Graceful Rollback on True Network/Server Failure
        setWishlistIds(prevIds);
        setWishlistCount(prevIds.size);
        updateCachedIds(prevIds);

        // Re-fetch full items if rollback occurs on WishlistPage
        if (!targetState) {
          refreshWishlist();
        }

        const serverError =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          "Unable to update wishlist. Please try again.";

        showToast(serverError, "error");

        if (options.onError) options.onError(err);
      }
    },
    [isAuthenticated, wishlistIds, updateCachedIds, showToast, refreshWishlist],
  );

  const value = useMemo(
    () => ({
      wishlistIds,
      wishlistCount,
      wishlistItems,
      isLoading,
      isWishlisted,
      toggleWishlist,
      refreshWishlist,
      showToast,
    }),
    [
      wishlistIds,
      wishlistCount,
      wishlistItems,
      isLoading,
      isWishlisted,
      toggleWishlist,
      refreshWishlist,
      showToast,
    ],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}

      {/* Floating Animated Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 z-50 flex flex-col items-center sm:items-end gap-2.5 pointer-events-none w-[calc(100%-2rem)] sm:w-full max-w-sm"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 w-full ${
              t.type === "error"
                ? "bg-rose-950/90 text-white border-rose-800/80"
                : t.type === "warning"
                  ? "bg-amber-950/90 text-amber-100 border-amber-800/80"
                  : t.type === "success"
                    ? "bg-slate-900/90 text-white border-emerald-500/40"
                    : "bg-slate-900/90 text-white border-slate-700/60"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* <span className="shrink-0 text-base">
                {t.type === "error" && (
                  <i className="bi bi-exclamation-triangle-fill text-rose-400" />
                )}
                {t.type === "warning" && (
                  <i className="bi bi-shield-exclamation text-amber-400" />
                )}
                {t.type === "success" && (
                  <i className="bi bi-heart-fill text-rose-500 animate-pulse" />
                )}
                {t.type === "info" && (
                  <i className="bi bi-info-circle-fill text-sky-400" />
                )}
              </span> */}
              <p className="text-xs sm:text-sm font-medium leading-snug truncate">
                {t.message}
              </p>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-gray-400 hover:text-white shrink-0 p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Dismiss toast"
            >
              <i className="bi bi-x text-base leading-none" />
            </button>
          </div>
        ))}
      </div>
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

export default WishlistContext;
