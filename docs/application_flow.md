# NKS Application Flow
## Master System Architecture & User Flow: Hybrid POS + Personal Wallet

---

## 1. Core Tech Stack & Authentication Strategy

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) — Offline-First |
| Local DB | SQLite / WatermelonDB |
| Authentication | Better Auth (TypeScript) |
| Backend | NestJS + Drizzle ORM + PostgreSQL |
| SMS Gateway | MSG91 / Fast2SMS (DLT-compliant) |
| Payments | UPI Intent (GPay, PhonePe) + UPI AutoPay |

### Better Auth Plugins Used
- `phoneNumber` – Universal identity via phone number
- `organization` – B2B Store/Staff multi-tenancy
- `emailAndPassword` – Credential linking for business accounts

### Security Model
Sessions are managed natively by Better Auth: secure bearer tokens, auto-refresh, and cryptographic signing. No session data is exposed to the client beyond what is strictly necessary.

---

## 2. Phase 1: Universal Onboarding (The Master Identity)

> **Every user enters the same way.** Phone number is the primary key for the entire system.

### Steps
1. User downloads the app and lands on the **Phone Entry Screen**.
2. User enters their **10-digit mobile number**.
3. App calls `POST /auth/otp/send` → backend validates and sends SMS via MSG91.
4. **Cost Control**: Backend enforces max **3 OTP requests/hour per phone number** at the DB level.
5. User enters the **4–6 digit OTP** on the verification screen.
6. App calls `POST /auth/otp/verify` → backend verifies with MSG91.
7. On success: Better Auth creates (or retrieves) the **master User record** and issues a session token.
8. Session token is persisted to device SecureStore. User is now authenticated.

### Result
- A single verified `User` record exists in the DB, keyed by phone number.
- Device holds a secure session token valid for 30 days.

---

## 3. Phase 2: The Dashboard Split

> Immediately after OTP verification, user sees two options.

```
┌─────────────────────────────────┐
│      What would you like?       │
│                                 │
│   [ 👤 Personal ]  [ 🏪 Store ] │
└─────────────────────────────────┘
```

This screen is `/(workspace)/account-type`.

---

## 4. Phase 3: The "Personal" Path (B2C Consumer Flow)

> Zero-friction access for shoppers to view digital receipts.

### Steps
1. User taps **"Personal"**.
2. Backend assigns the `PERSONAL` role (`userRoleMapping`).
3. App immediately opens the **Expense / Receipt Dashboard**.
4. No password or additional setup required.

### The Auto-Sync Magic
- Any store using NKS POS that generates an invoice for a phone number matching this user will automatically push the receipt to this dashboard.
- Routing logic: `invoice.customerPhone === user.phoneNumber` → auto-link receipt.

### Optional Step
- App prompts the user to enable **Biometric Unlock** (Fingerprint / Face ID) for faster future access.

### Result
- User has immediate access to their digital wallet / receipt history.

---

## 5. Phase 4: The "Store" Gateway (B2B Business Security Gate)

> Strict security firewall before accessing any business data.

### Steps
1. User taps **"Store"**.
2. Backend checks if an **Email is linked** to this Better Auth profile.
3. **If no email linked:**
   - App prompts: *"Secure your business profile"*
   - User inputs **Email Address** and creates a **Password** (min 8 chars).
   - Better Auth sends an **Email Verification OTP / Magic Link**.
   - User verifies email.
   - Master `User` profile is updated: now has verified phone **AND** verified email.
4. **If email already verified:** Skip directly to Phase 5.

### Result
- User profile now has dual-verified credentials: phone number + email.
- This unlocks access to the Store Hub.

---

## 6. Phase 5: Store Routing — Own vs. Staff

> After email verification, the user enters the Store Hub with two tabs.

```
┌──────────────────────────┐
│  Store Hub               │
│  [ Own ] │ [ Staff ]     │
└──────────────────────────┘
```

---

### Path A: "Staff" Tab (Cashier Flow)

1. Better Auth's **Organization plugin** scans for pending invitations sent to this user's verified email.
2. User sees a list of pending **Store Invites**.
3. User taps **"Accept"** on an invite.
4. App prompts the user to create a **4-digit local PIN** for this device.
5. The PIN is stored locally (encrypted) for fast POS unlock.

**Result:** User enters the **POS Register** with `STAFF / CASHIER` permissions.

---

### Path B: "Own" Tab (Store Owner Flow)

1. User taps **"Create Store"**.

#### Validation Paywall
2. App displays a **₹100 one-time setup fee** for the Basic POS Plan.
   - Rationale: Filters out spam registrations and bots.
3. User completes payment via **UPI Intent** (GPay, PhonePe).
4. Backend receives a **Webhook confirmation** from the payment gateway.
5. Only on confirmed payment does store creation proceed.

#### Store Creation
6. User inputs:
   - Store Name
   - Address (with map pin)
   - GST Number (optional at setup, required for tax invoicing)
7. Better Auth's Organization plugin creates the **Organization record**.
8. User is assigned the `STORE_OWNER` / `OWNER` role for this organization.
9. App prompts creation of a **4-digit local PIN**.

**Result:** Owner enters the **Admin Dashboard** with full permissions for their Store.

---

## 7. Phase 6: Daily POS Operations & Offline Mode

> Designed for high-speed retail and poor-connectivity environments.

### Fast Shift Unlock
1. Returning Cashier / Owner opens the app.
2. App detects an active session token in SecureStore.
3. Session is restored **without OTP or Email re-entry**.
4. User enters their **4-digit local PIN** to unlock the POS register.

### Offline-First Operation
| State | Behaviour |
|---|---|
| Online | Inventory and invoices read/written to cloud DB in real-time. |
| Offline | App reads inventory from **local SQLite/WatermelonDB**. |
| Invoice Generation | Invoices are created and stored in a **local queue**. |
| Reconnect | Better Auth silently refreshes the session. App pushes queued invoices to cloud. |
| Customer Auto-Sync | Queued invoices are matched to customer phone numbers and synced to Personal Wallets. |

---

## 8. Phase 7: SaaS Monetization (The Feature Gate)

### Tier Structure

| Tier | Price | Included |
|---|---|---|
| **Basic** | ₹100 one-time | Basic invoicing, 1 Staff member |
| **Pro (Monthly)** | TBD | Unlimited staff, advanced analytics, multi-store |
| **Pro (Yearly)** | TBD | Same as Pro Monthly, discounted |

### Upgrade Trigger
- Owner attempts a **gated action** (e.g., inviting a 2nd staff member, accessing analytics).
- App displays an **in-app paywall** with the Pro plan options.
- Owner subscribes via **UPI AutoPay** (recurring mandate).
- Backend webhook confirms subscription activation and updates the organization's plan tier.
- Feature is now unlocked.

---

## Flow Diagram Summary

```
App Open
   │
   ▼
Phone Entry → OTP Verify
   │
   ▼
Account Type Selection
   ├──► Personal → Receipt Dashboard (immediate access)
   │
   └──► Store
           │
           ▼
        Email Verification (one-time)
           │
           ▼
        Store Hub
           ├──► Staff Tab → Accept Invite → PIN Setup → POS Register
           │
           └──► Own Tab  → ₹100 UPI Payment → Store Creation → PIN Setup → Admin Dashboard
```

---

## Session Lifecycle

```
OTP Verify
   │── persistLogin() ──► SecureStore (token + AuthResponse)
   │── tokenManager.set() ──► In-Memory token
   │
App Restart
   │── initializeAuth() ──► loadSession() from SecureStore
   │── tokenManager.set(token) ──► Restore in-memory token
   │── dispatch(setCredentials) ──► isAuthenticated = true
   │
   └── If stale (>15 min) ──► refreshSession() → GET /auth/get-session
           ├── Success: update stored session
           └── 401 Only: clear session + force logout
```

---

*Last updated: 2026-03-24*
