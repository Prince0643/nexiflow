# Paymongo Integration Implementation Plan

## Overview

This document outlines the implementation plan for integrating **Paymongo** (Philippine payment gateway) into Nexiflow for handling subscription upgrades. When customers upgrade their plan, their company status will change from `'solo'` to `'office'` or `'enterprise'` depending on the selected plan.

---

## 1. What is Paymongo?

**Paymongo** is a Philippine-based payment gateway that allows businesses to accept online payments via:

### Supported Payment Methods
- **Credit/Debit Cards** (Visa, Mastercard, JCB, Diners Club)
- **E-Wallets**: GCash, Maya, GrabPay
- **QR Ph** (Philippine QR standard - multi-bank/e-wallet support)
- **Online Banking** (via Brankas)
- **Buy Now Pay Later** (BillEase)

### Key Features
- **Checkout API** - Hosted checkout page (easiest integration)
- **Payment Intents API** - For custom payment flows
- **Webhooks** - Real-time payment status notifications
- **Test Mode** - Sandbox environment for development
- **PHP Currency** - All amounts in Philippine Peso centavos (e.g., ₱500 = 50000)

---

## 2. Implementation Approach

### Recommended: Checkout API
We'll use the **Checkout API** because:
- ✅ Easiest to implement (minimal code)
- ✅ Paymongo hosts the payment page (secure, PCI compliant)
- ✅ Supports all payment methods automatically
- ✅ Mobile-responsive checkout page
- ✅ Automatic receipt emails

### Flow Overview
```
User clicks "Upgrade to Office" 
    ↓
Backend creates Checkout Session (amount: ₱9/user/month)
    ↓
Redirect user to Paymongo checkout_url
    ↓
User completes payment on Paymongo
    ↓
Paymongo redirects to success_url
    ↓
Webhook notifies backend of successful payment
    ↓
Backend updates company.pricing_level = 'office'
    ↓
User sees upgraded features
```

---

## 3. Database Schema Updates

### New Table Only

We already have `pricing_level`, `billing_email`, `billing_address`, and `subscription_status` columns in the `companies` table. We only need to add one table to track Paymongo payments:

```sql
-- Payment transactions (Paymongo)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(255) PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,
    checkout_session_id VARCHAR(255), -- Paymongo checkout session ID (cs_xxxxx)
    payment_intent_id VARCHAR(255), -- Paymongo payment intent ID (pi_xxxxx)
    amount INT NOT NULL, -- Amount in centavos (PHP 500 = 50000)
    currency VARCHAR(3) DEFAULT 'PHP',
    status VARCHAR(50) NOT NULL, -- 'pending', 'paid', 'failed', 'refunded'
    payment_method VARCHAR(50), -- 'card', 'gcash', 'maya', 'grabpay'
    payment_method_details JSON, -- Store payment method-specific data
    metadata JSON, -- Store custom data (user count, plan type, etc.)
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_checkout_session (checkout_session_id),
    INDEX idx_company_status (company_id, status)
);
```

### Existing Companies Columns (Already Present)

Your `companies` table already has these columns - no migration needed:
- `pricing_level` (enum: 'solo', 'office', 'enterprise') - **use this for plan status**
- `billing_email` (varchar)
- `billing_address` (longtext)
- `subscription_status` (varchar) - e.g., 'active', 'cancelled'

---

## 4. Backend Implementation

### Environment Variables
```bash
# .env file
PAYMONGO_SECRET_KEY=sk_test_YOUR_KEY_HERE  # Test key for dev - get from Paymongo dashboard
PAYMONGO_PUBLIC_KEY=pk_test_YOUR_KEY_HERE  # Public key (if needed)
PAYMONGO_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE  # For webhook verification
PAYMONGO_API_URL=https://api.paymongo.com/v1

# Pricing (in centavos - PHP)
PRICE_OFFICE_PER_USER=900    # ₱9.00 per user/month
PRICE_ENTERPRISE_PER_USER=1200  # ₱12.00 per user/month
```

### Install Dependencies
```bash
# Backend (Node.js)
npm install axios  # For API calls to Paymongo
```

### API Endpoints

#### 1. Create Checkout Session
```javascript
// POST /api/billing/create-checkout-session
// Authentication required

const axios = require('axios');

async function createCheckoutSession(req, res) {
    const { plan, userCount, successUrl, cancelUrl } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    // Calculate amount based on plan and user count
    const pricePerUser = plan === 'office' ? 900 : 1200; // centavos
    const totalAmount = pricePerUser * userCount;
    
    // Create line items for Paymongo
    const lineItems = [
        {
            name: `Nexiflow ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            amount: totalAmount,
            currency: 'PHP',
            description: `Subscription for ${userCount} user(s)`,
            quantity: 1,
            images: [] // Optional: URL to product image
        }
    ];
    
    try {
        // Create checkout session with Paymongo
        const response = await axios.post(
            'https://api.paymongo.com/v1/checkout_sessions',
            {
                data: {
                    attributes: {
                        billing: {
                            name: req.user.name,
                            email: req.user.email,
                            phone: req.user.phone || null
                        },
                        line_items: lineItems,
                        payment_method_types: ['card', 'gcash', 'maya', 'grabpay'], // Enable all
                        success_url: successUrl || `${process.env.FRONTEND_URL}/billing/success`,
                        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`,
                        description: `Upgrade to ${plan} plan`,
                        send_email_receipt: true,
                        show_description: true,
                        show_line_items: true,
                        metadata: {
                            company_id: companyId,
                            user_id: userId,
                            plan: plan,
                            user_count: userCount,
                            internal_transaction_id: generateUUID() // Your internal ID
                        }
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const checkoutData = response.data.data;
        
        // Store transaction in database
        await db.query(
            `INSERT INTO payment_transactions 
             (id, company_id, checkout_session_id, amount, currency, status, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                checkoutData.attributes.metadata.internal_transaction_id,
                companyId,
                checkoutData.id, // Paymongo checkout session ID
                totalAmount,
                'PHP',
                'pending',
                JSON.stringify({
                    pricing_level: plan,  // Store as pricing_level to match DB column
                    user_count: userCount,
                    price_per_user: pricePerUser
                })
            ]
        );
        
        // Return checkout URL to frontend
        res.json({
            checkoutUrl: checkoutData.attributes.checkout_url,
            checkoutSessionId: checkoutData.id,
            transactionId: checkoutData.attributes.metadata.internal_transaction_id
        });
        
    } catch (error) {
        console.error('Paymongo checkout error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
}
```

#### 2. Webhook Handler
```javascript
// POST /api/billing/webhook
// Public endpoint (Paymongo calls this)
// IMPORTANT: Must verify webhook signature for security

const crypto = require('crypto');

async function handleWebhook(req, res) {
    const payload = req.body;
    const signature = req.headers['paymongo-signature'];
    
    // Verify webhook signature (security check)
    const isValid = verifyWebhookSignature(payload, signature, process.env.PAYMONGO_WEBHOOK_SECRET);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Store webhook event for logging/debugging
    const eventId = payload.data.id;
    const eventType = payload.data.attributes.type;
    
    await db.query(
        `INSERT INTO webhook_events (id, event_type, paymongo_event_id, payload, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [generateUUID(), eventType, eventId, JSON.stringify(payload)]
    );
    
    // Handle different event types
    switch (eventType) {
        case 'checkout_session.payment.paid':
        case 'payment.paid':
            await handlePaymentSuccess(payload);
            break;
            
        case 'payment.failed':
            await handlePaymentFailure(payload);
            break;
            
        case 'payment.refunded':
            await handlePaymentRefund(payload);
            break;
    }
    
    // Acknowledge receipt (important!)
    res.status(200).json({ received: true });
}

async function handlePaymentSuccess(payload) {
    const checkoutSession = payload.data.attributes.data;
    const metadata = checkoutSession.attributes.metadata;
    
    const companyId = metadata.company_id;
    const pricingLevel = metadata.pricing_level;  // Use pricing_level not plan
    const checkoutSessionId = checkoutSession.id;
    
    // Update transaction status
    await db.query(
        `UPDATE payment_transactions 
         SET status = 'paid', 
             paid_at = NOW(),
             payment_method = ?,
             payment_method_details = ?
         WHERE checkout_session_id = ?`,
        [
            checkoutSession.attributes.payment_intent?.attributes?.payment_method?.type || 'unknown',
            JSON.stringify(checkoutSession.attributes.payment_intent?.attributes?.payment_method || {}),
            checkoutSessionId
        ]
    );
    
    // Update company pricing_level
    await db.query(
        `UPDATE companies 
         SET pricing_level = ?, subscription_status = 'active', updated_at = NOW()
         WHERE id = ?`,
        [pricingLevel, companyId]
    );
    
    // Insert/update company subscription record
    await db.query(
        `INSERT INTO company_subscriptions 
         (id, company_id, plan, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         plan = VALUES(plan),
         status = VALUES(status),
         current_period_start = VALUES(current_period_start),
         current_period_end = VALUES(current_period_end),
         updated_at = VALUES(updated_at)`,
        [generateUUID(), companyId, plan]
    );
    
    // Mark webhook as processed
    await db.query(
        `UPDATE webhook_events SET processed = TRUE, processed_at = NOW() WHERE paymongo_event_id = ?`,
        [payload.data.id]
    );
    
    // Optional: Send email notification to company admin
    // await sendUpgradeConfirmationEmail(companyId, pricingLevel);
}

async function handlePaymentFailure(payload) {
    const checkoutSession = payload.data.attributes.data;
    const checkoutSessionId = checkoutSession.id;
    const failureMessage = checkoutSession.attributes.payment_intent?.attributes?.last_payment_error?.message || 'Payment failed';
    
    await db.query(
        `UPDATE payment_transactions 
         SET status = 'failed', 
             failed_at = NOW(),
             failure_message = ?
         WHERE checkout_session_id = ?`,
        [failureMessage, checkoutSessionId]
    );
}

function verifyWebhookSignature(payload, signature, secret) {
    // Paymongo webhook signature verification
    // Reference: https://developers.paymongo.com/docs/creating-webhook
    const timestamp = signature.split(',')[0].split('=')[1];
    const testModeSignature = signature.split(',')[1]?.split('=')[1];
    const liveModeSignature = signature.split(',')[2]?.split('=')[1];
    
    const signedPayload = timestamp + '.' + JSON.stringify(payload);
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
    
    return expectedSignature === testModeSignature || expectedSignature === liveModeSignature;
}
```

#### 3. Check Transaction Status
```javascript
// GET /api/billing/transaction/:id
// For frontend to poll/check payment status

async function getTransactionStatus(req, res) {
    const { id } = req.params;
    const companyId = req.user.companyId;
    
    const [rows] = await db.query(
        `SELECT * FROM payment_transactions 
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
    );
    
    if (rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(rows[0]);
}
```

#### 4. Get Billing History
```javascript
// GET /api/billing/history
// List all transactions for the company

async function getBillingHistory(req, res) {
    const companyId = req.user.companyId;
    
    const [rows] = await db.query(
        `SELECT * FROM payment_transactions 
         WHERE company_id = ? 
         ORDER BY created_at DESC`,
        [companyId]
    );
    
    res.json(rows);
}
```

---

## 5. Frontend Implementation

### Upgrade Page (Already Exists - Enhance It)

```typescript
// src/pages/Upgrade.tsx - Enhanced version

import { useState } from 'react';
import { useMySQLAuth } from '../contexts/MySQLAuthContext';
import { buildingStore } from '../store/buildingStore';

export default function Upgrade() {
    const { currentUser, currentCompany } = useMySQLAuth();
    const [loading, setLoading] = useState(false);
    const [userCount, setUserCount] = useState(5); // Default user count
    
    const handleUpgrade = async (plan: 'office' | 'enterprise') => {
        setLoading(true);
        try {
            const response = await fetch('/api/billing/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    plan,
                    userCount,
                    successUrl: `${window.location.origin}/billing/success`,
                    cancelUrl: `${window.location.origin}/billing/cancel`
                })
            });
            
            const data = await response.json();
            
            if (data.checkoutUrl) {
                // Redirect to Paymongo checkout
                window.location.href = data.checkoutUrl;
            }
        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Failed to initiate upgrade. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    // Calculate prices
    const officeTotal = 9 * userCount;
    const enterpriseTotal = 12 * userCount;
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Choose Your Plan</h1>
            
            {/* User count selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Number of users: {userCount}
                </label>
                <input
                    type="range"
                    min="1"
                    max="100"
                    value={userCount}
                    onChange={(e) => setUserCount(parseInt(e.target.value))}
                    className="w-full"
                />
            </div>
            
            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Solo Plan */}
                <div className={`card ${currentCompany?.pricing_level === 'solo' ? 'border-2 border-green-500' : ''}`}>
                    <h3 className="text-xl font-bold">Solo</h3>
                    <p className="text-3xl font-bold my-4">₱0</p>
                    <p className="text-gray-500 mb-4">Free forever</p>
                    {currentCompany?.pricing_level === 'solo' ? (
                        <button className="btn-secondary w-full" disabled>
                            Current Plan
                        </button>
                    ) : (
                        <button 
                            className="btn-secondary w-full"
                            onClick={() => handleDowngrade('solo')}
                        >
                            Downgrade
                        </button>
                    )}
                </div>
                
                {/* Office Plan */}
                <div className={`card ${currentCompany?.pricing_level === 'office' ? 'border-2 border-green-500' : ''}`}>
                    <div className="badge badge-primary mb-2">Most Popular</div>
                    <h3 className="text-xl font-bold">Office</h3>
                    <p className="text-3xl font-bold my-4">₱{officeTotal}</p>
                    <p className="text-gray-500 mb-4">₱9 per user/month</p>
                    {currentCompany?.pricing_level === 'office' ? (
                        <button className="btn-secondary w-full" disabled>
                            Current Plan
                        </button>
                    ) : (
                        <button 
                            className="btn-primary w-full"
                            onClick={() => handleUpgrade('office')}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Upgrade to Office'}
                        </button>
                    )}
                </div>
                
                {/* Enterprise Plan */}
                <div className={`card ${currentCompany?.pricing_level === 'enterprise' ? 'border-2 border-green-500' : ''}`}>
                    <h3 className="text-xl font-bold">Enterprise</h3>
                    <p className="text-3xl font-bold my-4">₱{enterpriseTotal}</p>
                    <p className="text-gray-500 mb-4">₱12 per user/month</p>
                    {currentCompany?.pricing_level === 'enterprise' ? (
                        <button className="btn-secondary w-full" disabled>
                            Current Plan
                        </button>
                    ) : (
                        <button 
                            className="btn-primary w-full"
                            onClick={() => handleUpgrade('enterprise')}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Upgrade to Enterprise'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
```

### Success/Cancel Pages

```typescript
// src/pages/BillingSuccess.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BillingSuccess() {
    const navigate = useNavigate();
    
    useEffect(() => {
        // Optionally verify the transaction status
        // The actual upgrade happens via webhook, but we can show confirmation
        
        const timer = setTimeout(() => {
            navigate('/settings'); // Or wherever appropriate
        }, 5000);
        
        return () => clearTimeout(timer);
    }, []);
    
    return (
        <div className="p-6 text-center">
            <div className="card max-w-md mx-auto">
                <div className="text-green-500 mb-4">
                    <CheckCircle className="h-16 w-16 mx-auto" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
                <p className="text-gray-600 mb-6">
                    Thank you for upgrading. Your plan will be activated shortly.
                </p>
                <p className="text-sm text-gray-500">
                    Redirecting to settings...
                </p>
            </div>
        </div>
    );
}
```

---

## 6. Security Considerations

### 1. Webhook Signature Verification
**CRITICAL**: Always verify webhook signatures to ensure requests are from Paymongo.

### 2. API Key Security
- Store `PAYMONGO_SECRET_KEY` in environment variables only
- Never expose secret keys in frontend code
- Use test keys in development, live keys in production

### 3. Idempotency
- Store `checkout_session_id` to prevent duplicate processing
- Check transaction status before updating company plan

### 4. HTTPS Only
- Webhook endpoint must use HTTPS in production
- Paymongo will not send webhooks to HTTP URLs in live mode

### 5. Rate Limiting
```javascript
// Add rate limiting to webhook endpoint
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many webhook requests'
});

app.post('/api/billing/webhook', webhookLimiter, handleWebhook);
```

---

## 7. Testing

### Test Mode
Use Paymongo test keys for development. Test card numbers:

| Card Number | Brand | Result |
|-------------|-------|--------|
| 4343434343434343 | Visa | Success |
| 4444333322221111 | Visa | Success |
| 5454545454545454 | Mastercard | Success |
| 4234234234234234 | Visa | Decline |

### GCash/Maya Test Mode
In test mode, e-wallet payments are simulated and will always succeed.

### Testing Webhooks Locally
Use ngrok to expose local server:
```bash
ngrok http 3001
# Use the HTTPS URL as webhook endpoint in Paymongo dashboard
```

---

## 8. Deployment Checklist

- [ ] Create Paymongo account (test mode first)
- [ ] Generate API keys from Paymongo dashboard
- [ ] Add environment variables to server
- [ ] Run database migrations (new tables)
- [ ] Configure webhook URL in Paymongo dashboard
- [ ] Test payment flow in test mode
- [ ] Switch to live API keys
- [ ] Configure live webhook URL
- [ ] Monitor webhook events and transactions

---

## 9. Paymongo Pricing

Paymongo charges per transaction:
- **Credit/Debit Cards**: 3.5% + ₱15
- **GCash**: 2.5%
- **Maya**: 2.5%
- **GrabPay**: 2.5%
- **QR Ph**: 1.5%

These fees are deducted automatically from the payment amount before payout to your account.

---

## 10. References

- [Paymongo Developers](https://developers.paymongo.com/)
- [Checkout API Docs](https://developers.paymongo.com/docs/checkout-api)
- [Webhook Docs](https://developers.paymongo.com/docs/webhooks)
- [API Reference](https://developers.paymongo.com/reference)
- [Testing Guide](https://developers.paymongo.com/docs/testing)

---

## Summary

This implementation uses Paymongo's **Checkout API** for the simplest integration:
1. Backend creates checkout session with Paymongo
2. Frontend redirects to Paymongo-hosted checkout page
3. Customer completes payment
4. Paymongo sends webhook to backend
5. Backend updates company `pricing_level` from 'solo' to 'office'/'enterprise'
6. Customer gets immediate access to upgraded features

The entire flow is secure, PCI-compliant, and supports all major Philippine payment methods.
