require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { BakongKHQR } = require('bakong-khqr');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Configuration ---
const BAKONG_ACCOUNT_USERNAME = process.env.BAKONG_ACCOUNT_USERNAME;
const BAKONG_ACCOUNT_NAME = process.env.BAKONG_ACCOUNT_NAME;
const BAKONG_TOKEN = process.env.BAKONG_TOKEN;
const BAKONG_BASE_URL = process.env.BAKONG_BASE_URL || 'https://api-bakong.nbc.gov.kh';

// In-memory storage for payment orders (in production, use a database)
const paymentOrders = {};

/// --- Helper: generate KHQR payload ///
const generateKhqrPayload = (amount, currency) => {
  const khqr = new BakongKHQR();
  const currencyCode = currency === 'USD' ? khqr.currency.usd : khqr.currency.khr;

  const response = khqr.generateIndividual({
    bakongAccountID: BAKONG_ACCOUNT_USERNAME,
    accountName: BAKONG_ACCOUNT_NAME,
    currency: currencyCode,
    amount: Number(amount),
    expirationTimestamp: Date.now() + 2 * 60 * 1000, // 2 minutes expiry
  });

  return {
    qr: response.data.qr,
    md5: response.data.md5,
  };
};

/// --- Helper: check transaction by MD5 via Bakong API ///
const checkTransactionByMd5 = async (md5) => {
  const baseUrl = BAKONG_BASE_URL.replace(/\/+$/, '');

  try {
    const response = await axios.post(
      `${baseUrl}/v1/check_transaction_by_md5`,
      { md5 },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${BAKONG_TOKEN}`,
          'X-Device-Id': `protech-node-payments-${Date.now()}`,
          'X-Request-Id': require('crypto').randomUUID(),
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    // Handle axios errors gracefully
    if (error.response) {
      // Server responded with a non-2xx status
      return {
        success: false,
        error: error.response.status,
        message: error.response.data
          ? error.response.data.responseMessage || error.response.data.errorMessage
          : 'Bakong API error',
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'No response from Bakong server. Please try again.',
      };
    } else {
      // Something else triggered the error
      return {
        success: false,
        error: 'REQUEST_ERROR',
        message: error.message || 'Request failed',
      };
    }
  }
};

// --- Endpoint 1: Generate KHQR ---
// POST /api/payment/generate
// Body: { amount: number, currency: "USD" | "KHR" }
app.post('/api/payment/generate', (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (amount === undefined || amount === null || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number.',
      });
    }

    if (!currency || (currency !== 'USD' && currency !== 'KHR')) {
      return res.status(400).json({
        success: false,
        error: 'Currency must be "USD" or "KHR".',
      });
    }

    // Generate KHQR using the SDK
    const { qr, md5 } = generateKhqrPayload(amount, currency);

    // Create a new order/record with PENDING status
    const orderId = `order_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    paymentOrders[orderId] = {
      status: 'PENDING',
      amount,
      currency,
      qr,
      md5,
      createdAt: new Date(),
    };

    console.log(
      `[BACKEND] Generated KHQR for order ${orderId}, md5: ${md5}`
    );

    return res.json({
      success: true,
      qr,
      md5,
      orderId,
    });
  } catch (error) {
    console.error('[BACKEND] Error generating KHQR:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate KHQR.',
    });
  }
});

// --- Endpoint 2: Check Payment Status ---
// POST /api/payment/check
// Body: { orderId?: string, md5?: string }
app.post('/api/payment/check', async (req, res) => {
  try {
    const { orderId, md5 } = req.body;

    // Determine the MD5 hash:
    // 1. If md5 is sent directly (legacy frontend format), use it
    // 2. If orderId is sent, extract md5 from the payment record
    // 3. Otherwise, fail
    let transactionMd5;

    if (md5) {
      // Legacy format: frontend sends { md5: "hash" }
      transactionMd5 = md5;
    } else if (orderId) {
      // New format: fetch md5 from payment record
      const order = paymentOrders[orderId];
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found.',
        });
      }
      transactionMd5 = order.md5;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either orderId or md5 must be provided.',
      });
    }

    if (!transactionMd5) {
      return res.status(400).json({
        success: false,
        error: 'MD5 hash not found.',
      });
    }

    console.log(`[BACKEND] Checking payment, using MD5: ${transactionMd5}`);

    // Call Bakong's check transaction by MD5 endpoint
    const result = checkTransactionByMd5(transactionMd5);

    console.log('Bakong API Response:', result);

    // Handle the result
    if (result.success && result.data) {
      const responseData = result.data;
      const responseCode =
        responseData.responseCode ?? responseData?.responseCode ?? null;
      const errorCode =
        responseData.errorCode ?? responseData?.errorCode ?? null;
      const responseMessage =
        responseData.responseMessage ??
        responseData?.responseMessage ??
        '';

      // If Bakong returns responseCode === 0 AND data exists (Success = paid)
      // Reference: checkpayment.controller.js:51 — require data.data?.hash presence
      if (responseCode === 0 && responseData?.data) {
        // Find the order and update status to PAID with full response data
        const order = paymentOrders[orderId || ''];
        if (order) {
          order.status = 'PAID';
          order.paidAt = new Date();
          order.bakongHash = responseData.data.hash;
          order.fromAccountId = responseData.data.fromAccountId;
          order.toAccountId = responseData.data.toAccountId;
          order.currency = responseData.data.currency;
          order.amount = responseData.data.amount;
          order.description = responseData.data.description;
          order.transaction_id = responseData.data.hash;
        }

        console.log(
          `[BACKEND] Payment confirmed for order ${orderId || 'unknown'}, md5: ${transactionMd5}`
        );

        return res.json({
          success: true,
          status: 'PAID',
          paid: true,
          data: responseData.data,
          orderId: orderId || null,
        });
      }

      // Transaction not found or still pending (responseCode == 1)
      // Return PENDING so the frontend continues polling
      console.log(
        `[BACKEND] Payment still pending for md5: ${transactionMd5}, responseCode: ${responseCode}`
      );

      return res.json({
        status: 'PENDING',
        paid: false,
      });
    }

    // SDK call failed - return PENDING so frontend keeps polling
    console.warn(
      `[BACKEND] SDK check failed (returning PENDING): ${result.message}`
    );

    return res.json({
      status: 'PENDING',
      paid: false,
    });
  } catch (error) {
    // Safe exception handling at the route level - never crash the server
    console.error('[BACKEND] Unexpected error in check endpoint:', error);
    return res.json({
      status: 'PENDING',
      paid: false,
    });
  }
});

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bakong KHQR API is running.' });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`[SERVER] Bakong KHQR backend running on http://localhost:${PORT}`);
});

module.exports = app;