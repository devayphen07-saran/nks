# NKS Web — Implementation Plan

**App:** `apps/nks-web` (Next.js 16, React 19, Tailwind CSS 4)
**Role:** SUPER_ADMIN only — company-level platform management
**Stack:** Next.js App Router · Server Actions / fetch · `@nks/web-ui-components` · cookie-based session

---

## Architecture Overview

```
src/
  app/
    (auth)/
      login/            ← email + password
      setup/            ← first-time SUPER_ADMIN creation (one-time)
    (dashboard)/
      overview/         ← platform metrics
      users/            ← user management
      stores/           ← store management
      store-types/      ← store category CRUD
      invites/          ← invite token management
      admins/           ← super admin accounts
      notifications/    ← push notification composer
      otp-logs/         ← OTP activity logs
      audit-logs/       ← platform audit trail
      settings/         ← platform settings
  features/             ← screen logic (thin-wrapper pattern)
  lib/
    api.ts              ← fetch client with token injection + 401 redirect
    session.ts          ← read/write session cookie (httpOnly)
  middleware.ts         ← route guard
```

---

## Auth Flow

```
First visit ever (no SUPER_ADMIN exists)
  GET /api/auth/setup/status → { setupComplete: false }
  → middleware redirects all (dashboard) routes → /setup

/setup
  → fill name + email + password
  → POST /auth/setup → creates user + assigns SUPER_ADMIN role + issues token
  → save token in httpOnly cookie
  → redirect /overview

/login (subsequent visits)
  → fill email + password
  → POST /auth/login → verifies credentials → issues token
  → check userType === "SUPER_ADMIN" — reject all others
  → save token in httpOnly cookie
  → redirect /overview

Protected routes
  → middleware reads cookie → validates token
  → no token → redirect /login
  → token valid but not SUPER_ADMIN → redirect /login with error
```

---

## Shared Infrastructure (build first)

### 1. API Client — `lib/api.ts`
- `fetch` wrapper that injects `Authorization: Bearer <token>` from cookie
- On 401 → clear cookie → redirect `/login`
- On 403 → show toast "Access denied"

### 2. Session — `lib/session.ts`
- `getSession()` — reads httpOnly cookie server-side (for middleware + server components)
- `setSession(token)` — writes cookie after login/setup
- `clearSession()` — clears cookie on logout

### 3. Middleware — `middleware.ts`
```
matcher: /(dashboard)/*
  → no session cookie → redirect /login
  → session valid but userType !== SUPER_ADMIN → redirect /login
matcher: /setup
  → setupComplete === true → redirect /overview
```

### 4. Common UI Components (reuse across all modules)
| Component | Purpose |
|---|---|
| `DataTable` | Sortable, filterable, paginated table |
| `DetailDrawer` | Slide-over panel for record detail |
| `ConfirmDialog` | Confirmation for destructive actions |
| `StatusBadge` | active / suspended / expired / pending chips |
| `PageHeader` | Title + action button row |
| `EmptyState` | Zero-data placeholder |

---

## Module 1 — Authentication

**Routes:** `(auth)/login` · `(auth)/setup`
**Status:** UI exists, no backend wired

### What to build
- Delete `/register` page — not needed
- Wire `/login` form → `POST /auth/login` → store token in cookie
- Wire `/setup` form → `POST /auth/setup` → store token in cookie
- On login success: verify `userType === "SUPER_ADMIN"` — show error for others
- `middleware.ts` protects all `(dashboard)/*` routes

### Key files
| File | Purpose |
|---|---|
| `app/(auth)/login/page.tsx` | Email + password form (UI done) |
| `app/(auth)/setup/page.tsx` | First-time setup form (UI done) |
| `lib/api.ts` | Fetch client |
| `lib/session.ts` | Cookie helpers |
| `middleware.ts` | Route guard |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `POST /auth/login` | Email + password → token |
| `POST /auth/setup` | One-time first admin creation |
| `GET /auth/setup/status` | Check if setup is needed |
| `POST /auth/logout` | Invalidate token |
| `GET /auth/get-session` | Refresh permissions |

---

## Module 2 — Platform Overview

**Route:** `(dashboard)/overview`
**Status:** Mock data exists

### What to build
- Replace mock stats with real API calls
- Stats cards: Total Users · Total Stores · New Signups (7d) · Active Sessions
- Line chart: user signups over time (daily / weekly toggle)
- Bar chart: stores by category type
- Recent activity feed: last 10 platform events (audit log entries)

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/overview/page.tsx` | Thin wrapper |
| `features/overview/OverviewScreen.tsx` | Stats + charts layout |
| `features/overview/StatsCard.tsx` | Single metric card |
| `features/overview/ActivityFeed.tsx` | Recent events list |

### API endpoints
| Endpoint | Data |
|---|---|
| `GET /admin/stats/users` | Counts by role |
| `GET /admin/stats/stores` | Counts by status + category |
| `GET /admin/stats/signups?period=7d` | Signup trend |
| `GET /admin/activity?limit=10` | Recent platform events |

---

## Module 3 — User Management

**Route:** `(dashboard)/users`

### What to build
- Paginated table: Name · Phone/Email · Role · Linked Store · Joined · Status
- Filters: role, status, date range
- Search: by phone, email, or name
- Row actions via drawer:
  - View full profile + session history
  - Suspend / Reactivate
  - Force logout (invalidate all sessions)
  - Promote to SUPER_ADMIN (confirmation required)
- Bulk: suspend selected · export CSV

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/users/page.tsx` | Thin wrapper |
| `features/users/UsersScreen.tsx` | Table + filters |
| `features/users/UserDrawer.tsx` | Profile detail panel |
| `features/users/useUsers.ts` | Data fetching hook |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/users?page&limit&role&status&search` | List users |
| `GET /admin/users/:id` | User detail + sessions |
| `PATCH /admin/users/:id/suspend` | Suspend user |
| `PATCH /admin/users/:id/reactivate` | Reactivate user |
| `DELETE /admin/users/:id/sessions` | Force logout |
| `PATCH /admin/users/:id/promote` | Assign SUPER_ADMIN role |

---

## Module 4 — Store Management

**Route:** `(dashboard)/stores`

### What to build
- Paginated table: Store Name · Code · Category · Owner · Staff Count · Created · Status
- Filters: category, status, date range
- Search: by store name or code
- Row actions via drawer with tabs:
  - **Info** — name, code, category, owner details
  - **Staff** — staff list with roles
  - **Invites** — active invite tokens + expiry
  - **Activity** — recent store-level events
- Actions: Suspend / Reactivate · Revoke all staff (emergency, with confirmation)

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/stores/page.tsx` | Thin wrapper |
| `features/stores/StoresScreen.tsx` | Table + filters |
| `features/stores/StoreDrawer.tsx` | Tabbed detail panel |
| `features/stores/useStores.ts` | Data fetching hook |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/stores?page&limit&category&status&search` | List stores |
| `GET /admin/stores/:id` | Store detail |
| `GET /admin/stores/:id/staff` | Staff list |
| `GET /admin/stores/:id/invites` | Active invite tokens |
| `PATCH /admin/stores/:id/suspend` | Suspend store |
| `PATCH /admin/stores/:id/reactivate` | Reactivate store |
| `DELETE /admin/stores/:id/staff` | Revoke all staff access |

---

## Module 5 — Store Type Management

**Route:** `(dashboard)/store-types`

### What to build
- List: Code · Label · Store Count · Created Date
- Create modal: Code (uppercase) · Label · Description
- Edit label / description inline
- Delete: blocked if stores exist with that type (show count in tooltip)

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/store-types/page.tsx` | Thin wrapper |
| `features/store-types/StoreTypesScreen.tsx` | List + actions |
| `features/store-types/StoreTypeModal.tsx` | Create / edit form |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/store-types` | List all |
| `POST /admin/store-types` | Create |
| `PATCH /admin/store-types/:code` | Update label / description |
| `DELETE /admin/store-types/:code` | Delete if unused |

---

## Module 6 — Invite Management

**Route:** `(dashboard)/invites`

### What to build
- Table: Token (masked) · Store · Created By · Created · Expiry · Status
- Filters: status (active / used / expired), store, date range
- Stats bar: active / used / expired counts this month
- Row actions: Revoke active token · View accepted-by user

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/invites/page.tsx` | Thin wrapper |
| `features/invites/InvitesScreen.tsx` | Table + filters + stats bar |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/invites?page&status&storeId` | List invites |
| `GET /admin/invites/:token` | Token detail |
| `DELETE /admin/invites/:token` | Revoke token |

---

## Module 7 — Push Notifications

**Route:** `(dashboard)/notifications`

### What to build
- Compose and send push notifications to targeted users:
  - **Broadcast** — all users
  - **By role** — STORE_OWNER, STAFF, CUSTOMER
  - **By store** — all users in a specific store
  - **Individual** — single user by ID / phone
- Notification history table: Title · Body · Target · Sent At · Delivered / Failed counts
- Template library: save reusable notification templates
- Schedule: send now or schedule for a future time

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/notifications/page.tsx` | Thin wrapper |
| `features/notifications/NotificationsScreen.tsx` | Composer + history tabs |
| `features/notifications/ComposeForm.tsx` | Target selector + message form |
| `features/notifications/NotificationHistory.tsx` | Sent notifications table |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `POST /admin/notifications/send` | Send notification (immediate) |
| `POST /admin/notifications/schedule` | Schedule notification |
| `GET /admin/notifications?page` | Notification history |
| `GET /admin/notifications/:id` | Delivery stats |
| `POST /admin/notifications/templates` | Save template |
| `GET /admin/notifications/templates` | List templates |

---

## Module 8 — Super Admin Management

**Route:** `(dashboard)/admins`

### What to build
- List all SUPER_ADMIN accounts: Name · Email · Created · Last Login · Status
- Invite new admin: enter email → system sends invite email → they register via invite link
- Revoke admin access (demote, with confirmation)
- Cannot revoke your own account (button disabled with tooltip)

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/admins/page.tsx` | Thin wrapper |
| `features/admins/AdminsScreen.tsx` | List + invite form |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/admins` | List all SUPER_ADMINs |
| `POST /admin/admins/invite` | Send invite email |
| `DELETE /admin/admins/:id` | Revoke admin role |

---

## Module 9 — OTP Logs

**Route:** `(dashboard)/otp-logs`

### What to build
- Table: Phone · Action (send/verify) · Status (sent/verified/failed/expired) · Timestamp · IP
- Filters: status, date range, phone search
- Abuse highlight: phones with > N failed verifications in last hour shown in red
- Stats bar: total sent / verified / failed today

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/otp-logs/page.tsx` | Thin wrapper |
| `features/otp-logs/OtpLogsScreen.tsx` | Table + abuse highlights |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/otp-logs?page&status&phone&from&to` | List OTP events |
| `GET /admin/otp-logs/stats` | Abuse / failure summary |

---

## Module 10 — Audit Log

**Route:** `(dashboard)/audit-logs`

### What to build
- Immutable table: Actor · Action · Target · Old → New Value · Timestamp · IP
- Filters: actor, action type, date range
- Export to CSV
- Read-only — no actions from this screen
- Written server-side automatically on every admin action

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/audit-logs/page.tsx` | Thin wrapper |
| `features/audit-logs/AuditLogsScreen.tsx` | Table + export |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/audit-logs?page&actor&action&from&to` | List entries |
| `GET /admin/audit-logs/export` | CSV download |

---

## Module 11 — Platform Settings

**Route:** `(dashboard)/settings`

### What to build
Tabbed settings page — all changes auto-saved, destructive toggles need confirmation:

**General**
- Platform name · Support email · Default OTP expiry (minutes) · OTP retry limit per hour

**Registration**
- Toggle: allow personal account creation
- Toggle: allow self-service store registration
- Toggle: require admin approval for new stores

**Limits**
- Max staff per store · Max stores per owner · Max active invite tokens per store

**Notifications**
- FCM Server Key / APNS config (for push notification delivery)
- Default notification sender name

**Danger Zone**
- Maintenance mode toggle (blocks all non-admin logins)

### Key files
| File | Purpose |
|---|---|
| `app/(dashboard)/settings/page.tsx` | Thin wrapper |
| `features/settings/SettingsScreen.tsx` | Tabbed form |

### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /admin/settings` | Load all settings |
| `PATCH /admin/settings` | Partial update |

---

## Implementation Order

| Priority | Module | Depends on |
|---|---|---|
| 1 | Shared infrastructure (api.ts, session.ts, middleware) | — |
| 2 | Authentication (login + setup) | Infrastructure |
| 3 | Platform Overview | Auth |
| 4 | User Management | Auth |
| 5 | Store Management | Auth |
| 6 | Store Type Management | Auth |
| 7 | Invite Management | Store Management |
| 8 | Push Notifications | Auth, User Management |
| 9 | Super Admin Management | Auth |
| 10 | OTP Logs | Auth |
| 11 | Audit Log | All write modules |
| 12 | Platform Settings | Auth |

---

## Notes

- **No OTP on web** — SUPER_ADMINs authenticate with email + password only
- **No public register** — first admin via `/setup`, additional admins via invite from `/admins`
- **Session storage** — httpOnly cookie (not localStorage) so JS cannot read the token
- **Audit log** — written server-side on every admin action, never from the frontend
- **Push notifications** — uses FCM for Android + APNS for iOS; tokens stored in `push_tokens` table
- **All destructive actions** — require a `ConfirmDialog` showing the entity name before proceeding
- **Table pattern** — every list module uses the same `DataTable` component with pagination, search, and column filters
