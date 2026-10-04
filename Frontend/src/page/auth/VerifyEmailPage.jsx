import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const { verifyEmail } = useAuth();

  const [token, setToken] = useState(searchParams.get("token") || "");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [message, setMessage] = useState("");

  const handleVerify = async (tokenToVerify) => {
    if (!tokenToVerify) {
      setStatus("error");
      setMessage("Please provide a valid verification token.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const result = await verifyEmail(tokenToVerify);
    if (result.success) {
      setStatus("success");
      setMessage(result.message || "Your email has been verified successfully!");
    } else {
      setStatus("error");
      setMessage(result.error || "Email verification failed or token has expired.");
    }
  };

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      handleVerify(urlToken);
    }
  }, [searchParams]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />

        {status === "loading" && (
          <div className="py-8">
            <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Verifying Email...</h2>
            <p className="text-sm text-gray-500 mt-1">Please wait while we confirm your account.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
              <i className="bi bi-patch-check-fill" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Email Verified!</h2>
            <p className="text-sm text-gray-600 mt-2">{message}</p>
            <div className="mt-8">
              <Link
                to="/login"
                className="inline-flex w-full py-3.5 px-4 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md transition-all justify-center"
              >
                Continue to Sign In
              </Link>
            </div>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div>
            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto text-2xl mb-4 shadow-inner">
              <i className="bi bi-shield-check" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Verify Your Email</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Enter the verification token received in your registration email.
            </p>

            {status === "error" && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 text-xs text-left flex items-start gap-2.5">
                <i className="bi bi-exclamation-triangle-fill text-base text-red-500 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify(token);
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste verification token here"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-mono text-center focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Verify Token
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-400">
              Need help?{" "}
              <Link to="/login" className="font-semibold text-sky-600 hover:underline">
                Back to Sign In
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
