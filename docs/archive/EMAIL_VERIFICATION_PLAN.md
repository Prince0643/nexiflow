# Email Verification Implementation Plan

## Overview
This document outlines the steps required to implement email verification for new user signups in NexiFlow.

## Current Status
**NOT IMPLEMENTED** - The email verification feature was previously started but has been reverted and is not currently active in the codebase.

---

## Implementation Steps

### 1. Database Schema Updates

#### Add `email_verified` column to `users` table
```sql
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0;
```

#### Create `email_verification_tokens` table
```sql
CREATE TABLE email_verification_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_verification_user_id (user_id),
  INDEX idx_email_verification_token_hash (token_hash)
);
```

**Files to update:**
- `mysql-schema.sql`
- `schema.sql`

---

### 2. Backend Implementation

#### A. Update Signup Endpoint (`/api/auth/signup`)
- Set `email_verified = 0` when creating new user
- Generate verification token (24-hour expiry)
- Store token hash in `email_verification_tokens` table
- Send verification email with link
- **Do not return JWT token** - only return `requiresEmailVerification: true`

#### B. Update Login Endpoint (`/api/auth/login`)
- Add check for `email_verified === 0`
- Return 403 error with message: "Please verify your email before signing in."
- Include `emailVerified: boolean` in user data response

#### C. Create New Endpoints

**POST `/api/auth/verify-email`**
- Accept `token` from request body
- Verify token hash exists and is not expired/used
- Mark user as `email_verified = 1`
- Mark token as used
- Return success response

**POST `/api/auth/resend-verification`**
- Accept `email` from request body
- Find unverified user by email
- Generate new verification token
- Send verification email
- Return generic success (don't leak if email exists)

#### D. Email Service Updates
Add `sendEmailVerificationEmail(user, verifyLink)` function to `billingEmailService.js`:
- Sends HTML email with verification button
- Includes 24-hour expiry notice
- Plain text fallback

---

### 3. Frontend Implementation

#### A. Update EmailVerification Page (`src/pages/EmailVerification.tsx`)
- Extract `token` from URL query parameters (`?token=xyz`)
- Call `POST /api/auth/verify-email` with token
- Handle states:
  - Verifying (loading)
  - Success → auto-redirect to login
  - Error (expired/invalid) → show "Resend" button
- Add "Resend verification email" functionality

#### B. Update MySQLAuthContext (`src/contexts/MySQLAuthContext.tsx`)
- Store `emailVerified` from API response in auth state
- Update `login()` to handle 403 "email not verified" error
- Update `signup()` to handle `requiresEmailVerification` response

#### C. Update Login/Signup UI
- Show specific error message when login blocked due to unverified email
- After signup, redirect to "Check your email" page instead of auto-logging in

---

### 4. Environment Configuration

Ensure these environment variables are set:
```
FRONTEND_URL=https://nexiflow-new.nexistrydigitalsolutions.com
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=NexiFlow <support@nexiflow.com>
```

---

### 5. Testing Checklist

- [ ] Signup creates user with `email_verified = 0`
- [ ] Verification email is sent with valid link
- [ ] Clicking verification link marks user as verified
- [ ] Unverified user cannot login (gets 403 error)
- [ ] Verified user can login normally
- [ ] Resend verification works for unverified users
- [ ] Expired/used tokens show appropriate error
- [ ] Frontend handles all states correctly

---

## Files to Modify

1. **Database Schema**
   - `mysql-schema.sql`
   - `schema.sql`

2. **Backend**
   - `api/index.js` - Signup, Login, Verify-email, Resend-verification endpoints
   - `api/services/billingEmailService.js` - Add `sendEmailVerificationEmail()`

3. **Frontend**
   - `src/pages/EmailVerification.tsx` - Complete rewrite for API integration
   - `src/contexts/MySQLAuthContext.tsx` - Add emailVerified handling
   - `src/pages/Login.tsx` - Handle unverified email error
   - `src/pages/Signup.tsx` - Handle verification required flow

---

## Next Action

Start with **Step 1: Database Schema Updates** - add the `email_verified` column and create the `email_verification_tokens` table in both schema files.
