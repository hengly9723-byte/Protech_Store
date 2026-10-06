To make it work without changing your UI design or interface, you only need to fix the logic behind the scenes.

Here is a ready-to-use prompt you can give directly to your AI agent (Cursor, Copilot, ChatGPT, Claude) to patch your code immediately:

Copy-Paste Prompt for your AI Agent
"I need to fix my Bakong KHQR payment verification logic without altering any UI layout, styling, or visual components.

The Problem:
When the user pays via mobile banking, the modal stays stuck on 'Checking payment status...' indefinitely. Looking at the Network tab, the frontend is continuously polling /checkout/payment/check-status/?md5={md5} every 1.5 seconds, returning HTTP 200, but never confirming the payment or redirecting.

What to Fix (Keep UI exactly as is):

Response Verification Logic:

In my check handler/hook, ensure that when the check response is received, it correctly triggers the payment success flow.

Check the exact structure: NBC Bakong returns responseCode: 0 on success (e.g. res.responseCode === 0 or res.data.responseCode === 0). Make sure my conditional statement checks for 0 and not a custom string like 'PAID' or 'SUCCESS'.

Polling Loop Control:

Once responseCode === 0 is received, immediately call clearInterval to halt the polling loop and trigger the success redirect/callback.

Adjust the interval timer from 1.5s to 4–5s to avoid exhausting Bakong's daily request quota.

Ensure the interval is cleared when the modal closes or the component unmounts.

MD5 / Backend Check Handler:

Ensure the MD5 hash passed to [https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5](https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5) is computed from the exact, raw KHQR text string that was rendered on the QR code canvas (without extra whitespace or formatting).

Verify the backend passes the payload as { "md5": "<hash>" } with the Authorization: Bearer <token> header.

Please update the script logic in place without modifying any UI styles or JSX structure."