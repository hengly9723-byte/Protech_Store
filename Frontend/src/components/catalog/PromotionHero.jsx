import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getActivePromotionsApi } from "../../services/api";
import { calculateProductPrice } from "../../utils/pricing";
import ProductCard from "./ProductCard";

const CAMPAIGN_BADGES = {
  sale: {
    label: "Flash Sale",
    icon: "bi-fire",
    badgeClass: "bg-red-500/25 text-red-300 border-red-500/40",
  },
  bundle: {
    label: "Exclusive Bundle",
    icon: "bi-box-seam-fill",
    badgeClass: "bg-purple-500/25 text-purple-300 border-purple-500/40",
  },
  seasonal: {
    label: "Seasonal Fest",
    icon: "bi-stars",
    badgeClass: "bg-amber-500/25 text-amber-300 border-amber-500/40",
  },
  clearance: {
    label: "Clearance Deals",
    icon: "bi-tag-fill",
    badgeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-500/40",
  },
  campaign: {
    label: "Special Campaign",
    icon: "bi-megaphone-fill",
    badgeClass: "bg-sky-500/25 text-sky-300 border-sky-500/40",
  },
};

const useCountdown = (endsAt) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!endsAt) {
      setTimeLeft("");
      return;
    }

    const calculate = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s left`);
      }
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return timeLeft;
};

/**
 * PromotionHero Component
 *
 * Cleaned and proportionally responsive campaign banner:
 * 1. Proportional scaling using CSS aspect-[21/9] across all viewports.
 * 2. Banner graphic uncluttered: only 3 top-left badges ("Seasonal Fest", "20% OFF", countdown).
 * 3. Dedicated "Featured in Pchum Ben" section placed directly beneath the banner container (above "Explore Products").
 */
export const PromotionHero = ({
  promotion = null,
  promotions = null,
  autoRotateInterval = 6000,
  className = "",
}) => {
  const [fetchedPromos, setFetchedPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (promotion || (promotions && promotions.length > 0)) return;

    let isMounted = true;
    setLoading(true);
    getActivePromotionsApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setFetchedPromos(list);
      })
      .catch((err) => {
        console.warn("Could not load active promotions for hero:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [promotion, promotions]);

  const activePromos = useMemo(() => {
    if (promotion) return [promotion];
    if (promotions && promotions.length > 0) return promotions;
    return fetchedPromos;
  }, [promotion, promotions, fetchedPromos]);

  useEffect(() => {
    if (currentIndex >= activePromos.length) {
      setCurrentIndex(0);
    }
  }, [activePromos.length, currentIndex]);

  useEffect(() => {
    if (activePromos.length <= 1 || isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activePromos.length);
    }, autoRotateInterval);
    return () => clearInterval(interval);
  }, [activePromos.length, autoRotateInterval, isHovered]);

  const currentPromo = activePromos[currentIndex] || null;
  const rawCountdown = useCountdown(currentPromo?.ends_at || currentPromo?.endsAt);
  const countdown = rawCountdown || (currentPromo ? "26d 17h left" : "");

  const handlePrev = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? activePromos.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activePromos.length);
  };

  const scrollToCatalog = (e) => {
    e?.preventDefault();
    const el = document.getElementById("catalog-products");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Loading skeleton with proportional aspect ratio
  if (loading && !currentPromo) {
    return (
      <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 ${className}`}>
        <div className="w-full aspect-[21/9] min-h-[160px] rounded-2xl sm:rounded-3xl bg-zinc-900/80 animate-pulse border border-zinc-800 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
            <p className="text-zinc-500 text-[10px] sm:text-xs font-mono uppercase tracking-widest">
              Loading Active Promotions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback default hero design if no active promotion exists
  if (!currentPromo) {
    return (
      <section
        aria-label="Default Storefront Hero"
        className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 ${className}`}
      >
        <div className="relative w-full aspect-[21/9] min-h-[220px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-zinc-800/80 bg-zinc-950 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-0 w-96 h-96 rounded-full bg-sky-600/15 blur-3xl pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 backdrop-blur-md">
              <i className="bi bi-cpu text-sm" />
              Protech Official Hardware
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              High-Performance Tech & Next-Gen Hardware
            </h1>
            <div className="pt-2">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-primary hover:bg-[#ff824f] text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-primary/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Browse Products</span>
                <i className="bi bi-arrow-down" />
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const rawBanner = currentPromo.bannerImageUrl || currentPromo.banner_image_url;
  const bannerImg = rawBanner || "";

  const promoTypeKey = String(currentPromo.type || "").toLowerCase();
  const badgeInfo = CAMPAIGN_BADGES[promoTypeKey] || CAMPAIGN_BADGES.seasonal;

  const discountVal = Number(
    currentPromo.discountValue ?? currentPromo.discount_value ?? 20
  );
  const discountType = String(
    currentPromo.discountType || currentPromo.discount_type || "percentage"
  ).toLowerCase();
  const discountDisplay =
    discountVal > 0
      ? discountType === "fixed"
        ? `$${discountVal.toFixed(2)} OFF`
        : `${Math.round(discountVal)}% OFF`
      : "20% OFF";

  const featuredProducts =
    currentPromo.products || currentPromo.featuredProducts || [];

  return (
    <section
      aria-label="Promotion Hero Banner"
      className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1 & 2. Main Wide Banner Visual Container (Strict Proportional Scaling via aspect-[21/9]) */}
      <div
        role="button"
        tabIndex={0}
        onClick={scrollToCatalog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") scrollToCatalog(e);
        }}
        className="relative w-full aspect-[21/9] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/80 bg-zinc-950 transition-all duration-500 cursor-pointer group select-none"
        aria-label={`Campaign Banner: ${currentPromo.name || "Seasonal Fest"}`}
      >
        {/* Background Visual: 1920x600 Banner Image OR Styled Gradient */}
        {bannerImg ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <img
              src={bannerImg}
              alt={currentPromo.name || "Promotion Banner"}
              className="w-full h-full object-cover object-center transform scale-100 group-hover:scale-[1.015] transition-transform duration-700 ease-out"
            />
            {/* Soft gradient scrim at top-left to ensure badges pop cleanly over any background image */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/10 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-zinc-950 via-slate-950 to-zinc-900 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-10 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        )}

        {/* ONLY 3 Badges Aligned at Top-Left */}
        <div className="absolute top-2.5 left-2.5 sm:top-5 sm:left-5 lg:top-6 lg:left-6 z-20 flex items-center gap-1.5 sm:gap-2.5 flex-wrap max-w-[90%]">
          {/* Badge 1: "Seasonal Fest" (Campaign Type) */}
          <span
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-black tracking-wider uppercase backdrop-blur-md border shadow-md ${badgeInfo.badgeClass}`}
          >
            <i className={`bi ${badgeInfo.icon} text-[10px] sm:text-xs`} />
            <span>{badgeInfo.label || "Seasonal Fest"}</span>
          </span>

          {/* Badge 2: "20% OFF" */}
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-black tracking-wider uppercase bg-primary text-white shadow-md">
            <i className="bi bi-tag-fill text-[8px] sm:text-[10px]" />
            <span>{discountDisplay}</span>
          </span>

          {/* Badge 3: "26d 17h left" (Countdown Timer) */}
          {countdown && countdown !== "Ended" && (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold bg-black/60 text-amber-300 backdrop-blur-md border border-amber-500/30 shadow-md">
              <i className="bi bi-stopwatch text-[10px] sm:text-xs" />
              <span>{countdown}</span>
            </span>
          )}
        </div>

        {/* Carousel Slide Indicators & Arrows (only when multiple active promotions exist) */}
        {activePromos.length > 1 && (
          <div
            className="absolute bottom-2.5 right-2.5 sm:bottom-4 sm:right-5 z-20 flex items-center gap-1.5 sm:gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 mr-1">
              {activePromos.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    currentIndex === idx
                      ? "w-5 sm:w-7 bg-primary"
                      : "w-1.5 sm:w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handlePrev}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Previous promotion"
            >
              <i className="bi bi-chevron-left text-[10px] sm:text-xs" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Next promotion"
            >
              <i className="bi bi-chevron-right text-[10px] sm:text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Dedicated "Featured in Pchum Ben" Section Directly Beneath the Banner (Above Explore Products) */}
      {featuredProducts.length > 0 && (
        <div
          id="featured-shelf-section"
          className="mt-6 sm:mt-8 bg-white rounded-3xl p-5 sm:p-7 lg:p-8 border border-gray-100 shadow-sm space-y-6"
        >
          {/* Header with Subtext and "Explore all" link */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Featured in {currentPromo.name || "Pchum Ben"}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Special campaign pricing on {featuredProducts.length} curated hardware products
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToCatalog}
              className="text-xs sm:text-sm font-bold text-black hover:text-[#ff824f] hover:underline flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-colors"
            >
              <span>Explore all</span>
              <i className="bi bi-arrow-down text-xs" />
            </button>
          </div>

          {/* 2-column on mobile, 4-column on desktop responsive grid using Explore Products card design */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {featuredProducts.slice(0, 4).map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                activePromotion={currentPromo}
                promotions={activePromos}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default PromotionHero;
