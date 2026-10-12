# Stripe Integration

Stripe is the third payment provider (alongside PayMongo and PayPal), used for global card payments in **USD**.

> **Secrets are NOT stored in this file or in git.** Actual key values live only in the gitignored `.env`
> (local) and the production server's `.env`. Get them from the Stripe Dashboard → Developers → API keys / Webhooks.

## Payment model

- One-time payments via Stripe hosted Checkout (`mode: 'payment'`), not subscriptions.
- Renewals continue to be handled by `api/billingScheduler.js`, same as PayMongo/PayPal.
- Pricing (inline `price_data`, no Stripe Price IDs needed): Office **$9**/active user, Enterprise **$12**/active user,
  billed on active users capped at the plan limit.
- Stripe API version pinned: `2025-06-30.basil`.

## Environment variables

| Variable | Value format | Where to get it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` / `sk_live_...` | Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` / `pk_live_...` | Dashboard → Developers → API keys (not used by hosted Checkout, kept for future) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Dashboard → Workbench → Webhooks → your destination → Signing secret |

Test and live mode have **different** keys and **different** webhook signing secrets. `stripe listen` (local) prints its
own `whsec_...`, different from the dashboard endpoint's.

Current status (2026-10-12):
- Test-mode `sk_test`, `pk_test`, and dashboard webhook secret are set in local `.env`.
- **No `sk_live` key has been provided yet** — the "live" set shared earlier contained an `sk_test` key. Get the real
  `sk_live_...` before going live.
- All keys were shared in a chat session and are scheduled for rotation. Rotate before accepting real payments.

## Webhook destination

- URL: `https://nexi-flow.com/api/billing/stripe-webhook` (no `www` — redirects break delivery)
- Scope: Your account · Payload: Snapshot · API version: `2025-06-30.basil`
- Events (only these 6):
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `charge.dispute.created`
- A test-mode destination exists. A separate **live-mode** destination must be created at go-live (it gets its own secret).

## Code map

| Piece | Location |
| --- | --- |
| Stripe client (`getStripeClient`) + routes | `api/index.js` |
| Finalize / webhook event handling (idempotent) | `api/stripeBilling.cjs` |
| `POST /api/billing/create-stripe-checkout` | creates Checkout Session + pending `payment_transactions` row |
| `GET /api/billing/stripe-return` | success redirect; finalizes if paid → `/settings?billing=stripe_success` |
| `POST /api/billing/stripe-webhook` | signature-verified via `req.rawBody`; exempt from `/api/` rate limiter |
| Provider picker | `src/components/billing/PaymentProviderPickerModal.tsx` |
| Checkout redirect | `src/pages/UpgradeCTA.tsx`, `src/components/auth/SuperAdminSignupForm.tsx` |
| Result banner | `src/components/billing/StripeReturnBanner.tsx` (Settings + Upgrade pages) |
| Tests | `src/utils/stripeBilling.test.ts` |

Behavior notes:
- Return redirect and webhook share one idempotent finalize (row lock, no-op if already `paid`), reusing `applyPaidPlanUpgrade`.
- Refunds/disputes set `stripe_refunded` / `stripe_disputed` flags in transaction metadata; status stays `paid` and the
  company is **not** auto-downgraded.
- Webhook returns 500 on processing errors so Stripe retries (safe due to idempotency); 400 on bad signature;
  500 if `STRIPE_WEBHOOK_SECRET` is unset.

## Local testing

```bash
stripe listen --forward-to localhost:3001/api/billing/stripe-webhook   # put printed whsec_ in local .env
npm run dev:full
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Deployment checklist

1. Deploy code (backend image runs `npm ci` in `api/`, which installs `stripe`; `api/stripeBilling.cjs` is copied with `api/`).
2. On the production server, add to `.env` (used via `env_file` in `docker-compose.prod.yml`):
   `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Restart the backend container.
4. In the Stripe Dashboard, "Send test event" to the destination and confirm a 200 response.
5. Run one test-mode checkout end to end and confirm the company plan upgrades.
6. Go-live: get `sk_live`, create the live-mode webhook destination (same URL + 6 events), swap the three env vars to
   live values, restart, and rotate any keys that were shared in chat.
