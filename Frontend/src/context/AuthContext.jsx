import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  loginApi,
  registerApi,
  googleLoginApi,
  refreshTokenApi,
  getUserMeApi,
  updateUserMeApi,
  verifyEmailApi,
  requestPasswordResetApi,
  resetPasswordApi,
  setAccessToken,
  getAccessToken,
} from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("protech_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Guard so the session-restore effect only fires once even under StrictMode's
  // double-invocation (prevents duplicate /auth/refresh + /users/me requests).
  const sessionInitializedRef = useRef(false);

  // Synchronize user to local storage for instant UI render
  const updateUserState = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem("protech_user", JSON.stringify(userData));
    } else {
      localStorage.removeItem("protech_user");
    }
  };

  // Rehydrate session from refresh token on startup
  useEffect(() => {
    if (sessionInitializedRef.current) return;
    sessionInitializedRef.current = true;

    const initAuth = async () => {
      const storedRefresh = localStorage.getItem("protech_refresh_token");
      if (storedRefresh && storedRefresh !== "undefined" && storedRefresh !== "null") {
        try {
          const res = await refreshTokenApi(storedRefresh);
          const newAccess = res.data.access || res.data.access_token;
          setAccessToken(newAccess);

          // Fetch fresh user profile
          const userRes = await getUserMeApi();
          updateUserState(userRes.data);
        } catch (err) {
          console.warn("Session restore failed, logging out:", err);
          logout();
        }
      } else if (storedRefresh) {
        localStorage.removeItem("protech_refresh_token");
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for global logout events from axios interceptor
    const handleGlobalLogout = () => logout();
    window.addEventListener("protech:auth_logout", handleGlobalLogout);
    return () => window.removeEventListener("protech:auth_logout", handleGlobalLogout);
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await loginApi(email, password);
      const { access, refresh, user: loggedUser } = res.data;

      setAccessToken(access);
      localStorage.setItem("protech_refresh_token", refresh);
      updateUserState(loggedUser);
      return { success: true, user: loggedUser };
    } catch (err) {
      let errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data?.detail;

      if (!errorMsg && err.response?.data && typeof err.response.data === "object") {
        const firstKey = Object.keys(err.response.data)[0];
        const val = err.response.data[firstKey];
        if (Array.isArray(val) && val.length > 0) {
          errorMsg = `${val[0]}`;
        } else if (typeof val === "string") {
          errorMsg = val;
        }
      }
      errorMsg = errorMsg || "Invalid email or password.";
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await registerApi(formData);
      const { tokens, access, refresh, user: newUser } = res.data;
      const accessToken = tokens?.access || access;
      const refreshToken = tokens?.refresh || refresh;

      if (accessToken) {
        setAccessToken(accessToken);
      }
      if (refreshToken) {
        localStorage.setItem("protech_refresh_token", refreshToken);
      }
      if (newUser) {
        updateUserState(newUser);
      }
      return { success: true, data: res.data, user: newUser };
    } catch (err) {
      let errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data?.detail;

      if (!errorMsg && err.response?.data && typeof err.response.data === "object") {
        const firstKey = Object.keys(err.response.data)[0];
        const val = err.response.data[firstKey];
        if (Array.isArray(val) && val.length > 0) {
          errorMsg = `${val[0]}`;
        } else if (typeof val === "string") {
          errorMsg = val;
        }
      }
      errorMsg = errorMsg || "Registration failed. Please check your details.";
      setAuthError(errorMsg);
      return { success: false, error: errorMsg, fieldErrors: err.response?.data };
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (idToken) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await googleLoginApi(idToken);
      const access_token = res.data.access_token || res.data.access || res.data.tokens?.access;
      const refresh_token = res.data.refresh_token || res.data.refresh || res.data.tokens?.refresh;

      setAccessToken(access_token);
      localStorage.setItem("protech_refresh_token", refresh_token);

      // Refresh the full profile (roles / permissions / staff flags) so the
      // admin panel can correctly gate access right after login.
      try {
        const userRes = await getUserMeApi();
        updateUserState(userRes.data);
        return { success: true, user: userRes.data };
      } catch (err) {
        updateUserState(res.data.user);
        return { success: true, user: res.data.user };
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Google Sign-In failed.";
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem("protech_refresh_token");
    updateUserState(null);
  }, []);

  const updateProfile = async (data) => {
    try {
      const res = await updateUserMeApi(data);
      updateUserState(res.data);
      return { success: true, user: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to update profile.";
      return { success: false, error: errorMsg };
    }
  };

  const verifyEmail = async (token) => {
    try {
      const res = await verifyEmailApi(token);
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || "Email verification failed." };
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      const res = await requestPasswordResetApi(email);
      return {
        success: true,
        message: res.data.message,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || "Failed to request password reset." };
    }
  };

  const resetPassword = async (token, newPassword, confirmPassword) => {
    try {
      const res = await resetPasswordApi(token, newPassword, confirmPassword);
      return { success: true, message: res.data?.message || "Password has been reset successfully." };
    } catch (err) {
      let errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data?.detail;

      if (!errorMsg && err.response?.data && typeof err.response.data === "object") {
        const firstKey = Object.keys(err.response.data)[0];
        const val = err.response.data[firstKey];
        if (Array.isArray(val) && val.length > 0) {
          errorMsg = `${val[0]}`;
        } else if (typeof val === "string") {
          errorMsg = val;
        }
      }
      return { success: false, error: errorMsg || "Password reset failed." };
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: isAdminUser(user),
    isLoading,
    authError,
    login,
    register,
    googleLogin,
    logout,
    updateProfile,
    updateUser: updateProfile,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const isAdminUser = (user) => {
  if (!user) return false;
  if (user.is_superuser || user.is_staff) return true;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => String(r.name).toLowerCase() === "admin")) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes("view_dashboard")) return true;
  return false;
};
