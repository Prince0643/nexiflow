# PayPal Integration Status (NexiFlow)

This document summarizes what was implemented for PayPal payments, and what you should test to validate the upgrade flow.

## What’s implemented

### Frontend

- **Upgrade page payment method selector**
  - File: `src/pages/UpgradeCTA.tsx`
  - Added `selectedPaymentMethod` state with options:
    - `paymongo` (existing)
    - `paypal` (new)
  - When PayPal is selected:
    - Calls `POST /api/billing/create-paypal-order`
    - Redirects the browser to the returned `approvalUrl`

- **PayPal success/cancel pages**
  - Files:
    - `src/pages/billing/PayPalSuccess.tsx`
    - `src/pages/billing/PayPalCancel.tsx`
  - `PayPalSuccess.tsx`:
    - Reads the PayPal return query param `token` (PayPal order id)
    - Calls `POST /api/billing/capture-paypal-order`
    - Redirects to `/settings` after success

- **Routes added**
  - File: `src/App.tsx`
  - Added protected routes:
    - `/billing/paypal-success` → `PayPalSuccess`
    - `/billing/paypal-cancel` → `PayPalCancel`

### Backend

- **PayPal SDK added**
  - File: `api/package.json`
  - Dependency: `@paypal/checkout-server-sdk`

- **PayPal configuration helpers**
  - File: `api/index.js`
  - Added:
    - `paypalEnvironment()`
    - `getPayPalClient()`

- **PayPal endpoints added**
  - File: `api/index.js`
  - Added endpoints:
    - `POST /api/billing/create-paypal-order`
      - Creates a PayPal order (intent `CAPTURE`)
      - Inserts a `pending` row in `payment_transactions`
      - Uses PayPal `orderId` as `checkout_session_id`
      - Stores metadata including:
        - `payment_provider: "paypal"`
        - `paypal_order_id`
        - `type`: `plan_upgrade` or `seat_addon`
    - `POST /api/billing/capture-paypal-order`
      - Captures the PayPal order
      - Updates `payment_transactions` to `paid`
      - Updates `companies` similarly to existing PayMongo webhook logic
    - `POST /api/billing/paypal-webhook`
      - Basic webhook handler that can mark transactions `paid`/`failed`
      - Note: no signature verification added yet

### Env var documentation

- File: `.env.example`
  - Added:
    - `PAYPAL_CLIENT_ID`
    - `PAYPAL_CLIENT_SECRET`
    - `PAYPAL_ENVIRONMENT` (`sandbox` or `live`)

- File: `.env`
  - Added placeholder values for the PayPal vars (replace with your real sandbox creds)

## What to test (manual QA checklist)

## 0) Pre-flight setup

- **Set PayPal sandbox credentials** in `.env`:
  - `PAYPAL_CLIENT_ID=<sandbox client id>`
  - `PAYPAL_CLIENT_SECRET=<sandbox secret>`
  - `PAYPAL_ENVIRONMENT=sandbox`

- **Start backend + frontend**
  - Use your normal startup (e.g. `npm run dev:full`) and confirm:
    - Frontend can reach backend (`VITE_API_BASE_URL` correct)

## 1) PayPal plan upgrade (Office)

- Go to `/upgrade`
- Select **PayPal**
- Click **Upgrade to Office**
- Expected:
  - You are redirected to PayPal approval page
  - After approving, PayPal redirects back to:
    - `/billing/paypal-success?token=<orderId>`
  - UI shows “Processing Payment…” then success
  - Redirects to `/settings`

- Validate in DB:
  - `payment_transactions`
    - row exists with `checkout_session_id = <orderId>`
    - status transitions `pending` → `paid`
    - `paid_at` is set
  - `companies`
    - `pricing_level` becomes `office`
    - `max_members` becomes `1` (current implementation uses `user_count` = 1 for upgrade)
    - `next_billing_date` set (~30 days from capture time)
    - `billing_status = 'active'`

## 2) PayPal plan upgrade (Enterprise)

Repeat test #1 but choose **Enterprise**.

- Validate in DB:
  - `pricing_level` becomes `enterprise`
  - `max_members` updated similarly

## 3) PayPal cancel flow

- Start PayPal checkout from `/upgrade`
- On PayPal approval page, **cancel**
- Expected:
  - Redirect to `/billing/paypal-cancel`
  - No `companies` changes
  - The `payment_transactions` row likely remains `pending` (unless PayPal sends a failure webhook and the webhook is wired/working)

## 4) Unauthorized access checks

- Log in as a non-company user (or simulate missing `companyId`)
- Try creating PayPal order
- Expected:
  - API returns `400 User must belong to a company`

## 5) Missing PayPal env vars

- Temporarily unset `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`
- Try PayPal checkout
- Expected:
  - API returns `503 PayPal is not configured`

## 6) Webhook sanity check (optional)

- If you configure PayPal webhook delivery:
  - Send a test event
  - Ensure endpoint responds `200`
  - Verify it doesn’t crash on unexpected payloads

## Known gaps / follow-ups

- **SDK deprecation warning**: `@paypal/checkout-server-sdk` is deprecated; PayPal recommends `@paypal/paypal-server-sdk`.
- **No webhook signature verification**: the `/api/billing/paypal-webhook` endpoint does not validate authenticity.
- **Seats included per plan not reflected**:
  - The PayMongo backend currently stores `user_count = 1` for upgrades.
  - If you want Office=10 seats / Enterprise=100 seats by default, we should align backend update logic.
- **SuperAdminSignup flow** still uses PayMongo (`create-checkout-session`) and does not provide PayPal choice.

