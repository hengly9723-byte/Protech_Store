import React, { useEffect, useState, useCallback } from "react";
import {
  getShippingConfigApi,
  updateShippingConfigApi,
} from "../../services/api";
import { PageHeader, Button, Input, Spinner } from "../../components/admin/ui";

const ShippingSettingsPage = () => {
  const [flatRate, setFlatRate] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getShippingConfigApi();
      setFlatRate(res.data.flat_rate);
      setFreeShippingThreshold(res.data.free_shipping_threshold);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load shipping settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateShippingConfigApi({
        flat_rate: flatRate,
        free_shipping_threshold: freeShippingThreshold,
      });
      setMessage("Shipping settings updated successfully.");
      await load();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          Object.values(err.response?.data || {}).flat().join(", ") ||
          "Failed to update shipping settings."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Shipping Settings"
        subtitle="Configure the flat shipping rate and free-shipping threshold"
      />

      {loading ? (
        <Spinner label="Loading shipping settings..." />
      ) : (
        <form onSubmit={handleSave} className="max-w-xl bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
          <Input
            label="Flat Shipping Rate ($)"
            type="number"
            step="0.01"
            min="0"
            value={flatRate}
            onChange={(e) => setFlatRate(e.target.value)}
            placeholder="e.g. 5.00"
            hint="Charged on orders below the free-shipping threshold."
          />
          <Input
            label="Free Shipping Threshold ($)"
            type="number"
            step="0.01"
            min="0"
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(e.target.value)}
            placeholder="e.g. 50.00"
            hint="Orders with a subtotal at or above this amount ship free."
          />

          {message && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3.5 py-2.5">
              <i className="bi bi-check-circle-fill" />
              {message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3.5 py-2.5">
              <i className="bi bi-exclamation-triangle-fill" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={load} disabled={saving}>
              Reset
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ShippingSettingsPage;