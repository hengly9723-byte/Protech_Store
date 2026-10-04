import { useEffect, useState } from "react";
import { getShippingConfigApi } from "../services/api";

let cachedConfig = null;
let cachePromise = null;

/**
 * Returns the admin-configurable shipping rules (free-shipping threshold and
 * flat rate) fetched from GET /api/shipping/config/. The result is cached in
 * module scope so it is only fetched once per session.
 */
const useShippingConfig = () => {
  const [config, setConfig] = useState(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cachedConfig) {
        setConfig(cachedConfig);
        setLoading(false);
        return;
      }
      if (!cachePromise) {
        cachePromise = getShippingConfigApi()
          .then((res) => res.data)
          .catch(() => null)
          .finally(() => {
            cachePromise = null;
          });
      }
      const data = await cachePromise;
      if (data) cachedConfig = data;
      if (!cancelled) {
        setConfig(data);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaults = { free_shipping_threshold: 50, flat_rate: 5 };
  const merged = { ...defaults, ...(config || {}) };

  return {
    config: merged,
    loading,
    freeShippingThreshold: Number(merged.free_shipping_threshold),
    flatRate: Number(merged.flat_rate),
  };
};

export default useShippingConfig;