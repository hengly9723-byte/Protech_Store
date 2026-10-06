import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getUserMeApi,
  updateUserMeApi,
  getAddressesApi,
  createAddressApi,
  deleteAddressApi,
} from "../../services/api";
import UserAvatar from "../../components/UserAvatar";

const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("profile"); // profile, addresses, permissions
  const [profileData, setProfileData] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Profile Edit State
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    avatar_url: "",
  });

  // New Address State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({
    recipient_name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Cambodia",
    type: "shipping",
    is_default: false,
  });

  // Guard so /users/me + /addresses/ are fetched only once per mount, even
  // under React StrictMode's double-invoked effects.
  const fetchedRef = useRef(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userRes, addrRes] = await Promise.all([
        getUserMeApi(),
        getAddressesApi().catch(() => ({ data: [] })),
      ]);
      setProfileData(userRes.data);
      setFormData({
        full_name: userRes.data.full_name || "",
        phone: userRes.data.phone || "",
        date_of_birth: userRes.data.customer_profile?.date_of_birth || "",
        avatar_url: userRes.data.avatar_url || "",
      });
      setAddresses(addrRes.data?.results || addrRes.data || []);
    } catch (err) {
      setError("Failed to load profile details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchData();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    setError(null);
    try {
      const payload = {
        full_name: formData.full_name,
        avatar_url: formData.avatar_url,
        customer_profile: formData.date_of_birth
          ? { date_of_birth: formData.date_of_birth }
          : undefined,
      };
      const result = await updateUser(payload);
      if (result?.success) {
        setProfileData(result.user);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setError(result?.error || "Failed to update profile.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update profile.",
      );
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await createAddressApi(newAddress);
      setShowAddressModal(false);
      setNewAddress({
        recipient_name: "",
        phone: "",
        address_line_1: "",
        address_line_2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "United States",
        type: "shipping",
        is_default: false,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add address.");
    }
  };

  const handleDeleteAddress = async (id) => {
    if (confirm("Are you sure you want to delete this address?")) {
      try {
        await deleteAddressApi(id);
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        alert("Failed to delete address.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
        <p className="text-gray-500 text-sm animate-pulse">
          Loading Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <UserAvatar
            src={formData.avatar_url || profileData?.avatar_url}
            name={profileData?.full_name}
            email={profileData?.email}
            size="w-24 h-24"
            textSize="text-3xl"
            className="ring-4 ring-sky-500/20 shadow-md"
          />

          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-black text-gray-900">
                {profileData?.full_name || "Protech Member"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/60">
                {profileData?.is_superuser
                  ? "Super Admin"
                  : profileData?.role ||
                    profileData?.roles?.[0]?.name ||
                    "Customer"}
              </span>
              {profileData?.is_staff && !profileData?.is_superuser && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                  Staff
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-1">{profileData?.email}</p>

            <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <i className="bi bi-shield-check text-emerald-500 text-sm" />
                {profileData?.email_verified_at
                  ? "Email Verified"
                  : "Active Member"}
              </span>
              <span>•</span>
              <span>
                Joined {new Date(profileData?.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <i className="bi bi-box-arrow-right" />
          Sign Out
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto gap-4">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "profile"
              ? "border-button text-button"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <i className="bi bi-person-gear mr-2" />
          Personal Details
        </button>
        <button
          onClick={() => setActiveTab("addresses")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "addresses"
              ? "border-button text-button"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <i className="bi bi-geo-alt mr-2" />
          Saved Addresses ({addresses.length})
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "permissions"
              ? "border-button text-button"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <i className="bi bi-key mr-2" />
          Roles & Permissions
        </button>
      </div>

      {/* Profile Form Tab */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Edit Profile</h2>

          {saveSuccess && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
              <i className="bi bi-check-circle-fill text-lg text-emerald-500" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill text-lg text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={profileData?.email || ""}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Email cannot be changed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) =>
                  setFormData({ ...formData, date_of_birth: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Profile Avatar URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://lh3.googleusercontent.com/... or https://..."
                  value={formData.avatar_url}
                  onChange={(e) =>
                    setFormData({ ...formData, avatar_url: e.target.value })
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                {profileData?.email && (
                  <button
                    type="button"
                    onClick={() => {
                      const emailTrimmed = profileData.email
                        .trim()
                        .toLowerCase();
                      setFormData((prev) => ({
                        ...prev,
                        avatar_url: `https://unavatar.io/${encodeURIComponent(emailTrimmed)}?fallback=https://www.gravatar.com/avatar/?d=identicon`,
                      }));
                    }}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                    title="Auto-fetch profile image based on email"
                  >
                    Auto Fetch
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Direct image link or click &quot;Auto Fetch&quot; to look up an
                avatar from your email.
              </p>
            </div>

            <button
              type="submit"
              className="mt-4 px-6 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Addresses Tab */}
      {activeTab === "addresses" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Your Addresses</h2>
            <button
              onClick={() => setShowAddressModal(true)}
              className="px-4 py-2 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="bi bi-plus-lg" />
              Add Address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
              <i className="bi bi-geo-alt text-4xl text-gray-300 mb-3 block" />
              <p className="text-sm font-semibold text-gray-700">
                No saved addresses yet
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Add an address for streamlined checkout.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`bg-white rounded-2xl p-5 border relative shadow-xs ${
                    addr.is_default
                      ? "border-sky-500 ring-2 ring-sky-500/10"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {addr.type}
                    </span>
                    {addr.is_default && (
                      <span className="text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-gray-900">
                    {addr.recipient_name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {addr.address_line_1}
                  </p>
                  {addr.address_line_2 && (
                    <p className="text-xs text-gray-600">
                      {addr.address_line_2}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    {addr.city}, {addr.state} {addr.postal_code}
                  </p>
                  <p className="text-xs text-gray-600">{addr.country}</p>
                  {addr.phone && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                      <i className="bi bi-telephone" />
                      <span>{addr.phone}</span>
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roles and Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Assigned Roles & Access
          </h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                User Roles
              </p>
              <div className="flex flex-wrap gap-2">
                {profileData?.roles?.length ? (
                  profileData.roles.map((r) => (
                    <span
                      key={r.id}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold"
                    >
                      {r.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">
                    Customer (Standard Access)
                  </span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Flattened Permissions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profileData?.permissions?.length ? (
                  profileData.permissions.map((perm, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[11px] font-mono"
                    >
                      {perm}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">
                    Standard shopping & customer permissions
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Add New Address
            </h3>

            <form onSubmit={handleAddAddress} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newAddress.recipient_name}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        recipient_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={newAddress.phone}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={newAddress.address_line_1}
                  onChange={(e) =>
                    setNewAddress({
                      ...newAddress,
                      address_line_1: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={newAddress.state}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, state: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    ZIP / Postal
                  </label>
                  <input
                    type="text"
                    required
                    value={newAddress.postal_code}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        postal_code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newAddress.is_default}
                  onChange={(e) =>
                    setNewAddress({
                      ...newAddress,
                      is_default: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <label htmlFor="is_default" className="text-xs text-gray-600">
                  Set as default address
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-button hover:bg-button-hover text-white text-sm font-bold shadow-md"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
