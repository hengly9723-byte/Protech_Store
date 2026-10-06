import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { checkKhqrStatusApi, getGuestEmail } from "../../services/api";
import { formatMoney } from "../../utils/format";
import bakongLogo from "../../assets/image.png";

const POLL_INTERVAL_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 3;

const BAKONG_APP_STORE = "https://apps.apple.com/kh/app/bakong/id1440829141";
const BAKONG_PLAY_STORE =
  "https://play.google.com/store/apps/details?id=kh.org.nbc.bakongapp";

/**
 * Bakong KHQR payment modal.
 *
 * Displays the generated Bakong QR code and polls
 * /api/payments/khqr/check-status/ every 4-5 seconds until Bakong reports the
 * transaction as PAID (responseCode === 0, paid === true, or status === 'SUCCESS'),
 * then immediately stops polling and calls onPaid(order) so the parent can redirect.
 *
 * The polling loop lives in a single useEffect keyed on md5. The status
 * callback is referentially stable (latest values via refs) so the effect never
 * re-runs on render, concurrent checks are deduped, and after 3 consecutive
 * network failures polling pauses automatically (QR stays visible) with a
 * resume button.
 */
const KhqrPaymentModal = ({
  order,
  qrPayload,
  deepLink,
  paymentData,
  md5,
  onPaid,
  onClose,
}) => {
  const [status, setStatus] = useState("pending"); // pending | checking | paid
  const [checkError, setCheckError] = useState(null);
  const [pollPaused, setPollPaused] = useState(false);

  const intervalRef = useRef(null);
  const checkingRef = useRef(false);
  const failureCountRef = useRef(0);

  // Latest values via refs so checkStatus stays referentially stable and the
  // polling effect never re-runs (which is what caused the infinite loop).
  const statusRef = useRef(status);
  statusRef.current = status;
  const md5Ref = useRef(md5);
  md5Ref.current = md5;
  const orderRef = useRef(order);
  orderRef.current = order;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleModalClose = useCallback(() => {
    stopPolling();
    if (onClose) onClose();
  }, [stopPolling, onClose]);

  const handlePaid = useCallback(
    (paidOrder) => {
      stopPolling();
      setStatus("paid");
      setCheckError(null);
      if (onPaidRef.current) onPaidRef.current(paidOrder);
    },
    [stopPolling],
  );

  const checkStatus = useCallback(async () => {
    const md5Value = md5Ref.current;
    if (!md5Value || statusRef.current === "paid") return;
    if (checkingRef.current) return; // never overlap checks
    checkingRef.current = true;

    setStatus("checking");
    setCheckError(null);

    try {
      const params = {};
      const guestEmail = getGuestEmail();
      if (guestEmail) params.guest_email = guestEmail;
      const res = await checkKhqrStatusApi(md5Value, params);

      // A real server response (even "still pending") resets the failure counter.
      failureCountRef.current = 0;
      setPollPaused(false);

      const responsePayload = res?.data || res || {};
      const resData = responsePayload.data || {};

      // NBC Bakong returns responseCode: 0 on success
      // (e.g. res.responseCode === 0, res.data.responseCode === 0, or res.data.data.responseCode === 0).
      const responseCode =
        responsePayload.responseCode ??
        res?.responseCode ??
        resData.responseCode ??
        responsePayload.bakong_response_code ??
        responsePayload.bakong_code ??
        null;

      const isSuccessCode = responseCode === 0 || responseCode === "0";
      const isPaidFlag =
        responsePayload.paid === true ||
        responsePayload.status === "SUCCESS" ||
        responsePayload.status === "PAID" ||
        resData.status === "PAID";

      const paid = isSuccessCode || isPaidFlag;

      if (paid) {
        // Once responseCode === 0 is received, immediately halt the polling loop and trigger success flow
        stopPolling();
        handlePaid(responsePayload.order || resData.order || orderRef.current);
        return;
      } else if (responsePayload.status === "FAILED" || responsePayload.error_code === "TRANSACTION_FAILED") {
        stopPolling();
        setPollPaused(true);
        setCheckError(
          "Payment was declined or failed. Please check your transaction and try again.",
        );
      } else {
        setStatus("pending");
      }
    } catch (err) {
      failureCountRef.current += 1;
      setStatus("pending");

      // Server-side auth configuration failure (missing/expired Bakong token).
      // This is NOT a payment status — stop polling and surface it clearly so
      // it is never confused with "still waiting for payment".
      if (err.response?.data?.error_code === "AUTH_CONFIG_ERROR") {
        stopPolling();
        setPollPaused(true);
        setCheckError(
          "Payment verification is temporarily unavailable due to a server " +
            "configuration error. Your QR code is still valid — please contact " +
            "support or try again later.",
        );
        return;
      }

      const message =
        err.response?.data?.error || "Payment status check failed. Retrying...";
      setCheckError(message);

      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        stopPolling();
        setPollPaused(true);
        setCheckError(
          "Automatic status checking was paused after repeated failures. " +
            "Your QR code is still valid — resume checking below to re-verify.",
        );
      }
    } finally {
      checkingRef.current = false;
    }
  }, [handlePaid, stopPolling]);

  // Automatic payment completion polling: check every 4-5 seconds until paid.
  useEffect(() => {
    if (!md5) return undefined;

    const interval = setInterval(() => {
      checkStatus();
    }, POLL_INTERVAL_MS);

    intervalRef.current = interval;
    checkStatus();

    return () => {
      stopPolling();
    };
  }, [md5, checkStatus, stopPolling]);

  // Always ensure interval timer is cleared when component unmounts
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const resumePolling = useCallback(() => {
    failureCountRef.current = 0;
    setPollPaused(false);
    setCheckError(null);
    checkStatus();
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => checkStatus(), POLL_INTERVAL_MS);
    }
  }, [checkStatus]);

  const isPaid = status === "paid";
  const isChecking = status === "checking";

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const fallbackDeepLink = qrPayload
    ? `bakong://qr?data=${encodeURIComponent(qrPayload)}`
    : null;
  const activeDeepLink =
    deepLink ||
    paymentData?.deep_link ||
    paymentData?.deeplink ||
    paymentData?.deepLink ||
    fallbackDeepLink;

  const handleOpenBankingApp = () => {
    if (!activeDeepLink) return;

    if (activeDeepLink.startsWith("https://")) {
      window.location.href = activeDeepLink;
      return;
    }

    if (activeDeepLink.startsWith("bakong://")) {
      if (!isMobile) {
        alert(
          "Please scan the QR code using the Bakong app on your mobile phone.",
        );
        return;
      }

      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const storeUrl = isIOS ? BAKONG_APP_STORE : BAKONG_PLAY_STORE;

      const startTime = Date.now();
      window.location.href = activeDeepLink;

      setTimeout(() => {
        // If time elapsed is short, user stayed in browser (app did not open or not installed)
        if (Date.now() - startTime < 2000) {
          window.location.href = storeUrl;
        }
      }, 1500);
      return;
    }

    window.location.href = activeDeepLink;
  };

  console.log("[DEBUG Modal Props] paymentData:", paymentData);
  console.log("[DEBUG Modal Props] deepLink prop:", deepLink);
  console.log("[DEBUG Modal Props] activeDeepLink resolved:", activeDeepLink);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-orbitron font-extrabold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-x flex items-center justify-center">
              <img className="rounded-xl" src={bakongLogo} alt="Bakong-logo" />
            </span>
            Bakong KHQR Payment
          </h3>
          <button
            type="button"
            onClick={handleModalClose}
            disabled={isPaid}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {isPaid ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <i className="bi bi-check-circle text-4xl text-emerald-500" />
            </div>
            <h4 className="text-xl font-black text-gray-900 mb-2">
              Payment Successful!
            </h4>
            <p className="text-sm text-gray-500">
              Redirecting to your order confirmation...
            </p>
            <div className="mt-6 w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="inline-block p-4 rounded-3xl bg-white border border-gray-200 shadow-sm mb-4">
                <QRCodeSVG value={qrPayload || ""} size={220} level="M" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">
                Scan with the Bakong app to pay
              </p>
              <p className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                {formatMoney(order?.total, order?.currency)}
              </p>
              <p className="text-[11px] text-gray-400 mb-4">
                Order {order?.order_number} · Payment expires in 30 minutes
              </p>

              {activeDeepLink &&
                (isMobile || activeDeepLink.startsWith("https://") ? (
                  <button
                    type="button"
                    onClick={handleOpenBankingApp}
                    className="mt-3 w-full inline-flex justify-center items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all text-sm cursor-pointer"
                  >
                    <i className="bi bi-phone-fill text-base" />
                    Open Banking App
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                    <i className="bi bi-phone text-gray-400" />
                    Scan with your mobile banking app to pay
                  </p>
                ))}
            </div>

            <div className="mt-5 p-3 rounded-2xl bg-slate-50 border border-gray-100 flex items-center gap-3">
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {isChecking ? (
                  <span className="w-4 h-4 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                ) : (
                  <i className="bi bi-hourglass-split text-sky-500 text-sm leading-none" />
                )}
              </span>
              <p className="text-xs text-gray-600">
                {isChecking
                  ? "Checking payment status..."
                  : pollPaused
                    ? "Automatic checking paused."
                    : "Waiting for payment. Checking every 5 seconds..."}
              </p>
            </div>

            {checkError && (
              <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-amber-500" />
                <span>{checkError}</span>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {pollPaused ? (
                <button
                  type="button"
                  onClick={resumePolling}
                  className="w-full py-2.5 rounded-2xl border border-amber-300 hover:border-amber-400 hover:bg-amber-50 text-amber-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <i className="bi bi-play-circle mr-1" />
                  Resume automatic checking
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="w-full py-2.5 rounded-2xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50 text-gray-600 hover:text-rose-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel Payment
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default KhqrPaymentModal;
