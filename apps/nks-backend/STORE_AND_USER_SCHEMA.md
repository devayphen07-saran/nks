# Store & User Data Schema

## Core Tables Overview

```
┌─────────────────────┐
│      users          │  Personal/User Data
├─────────────────────┤
│ id (PK)             │
│ iam_user_id         │
│ name                │
│ email               │
│ phone_number        │
│ image (avatar)      │
│ kyc_level           │
│ profile_completed   │
│ is_blocked          │
│ last_login_at       │
│ language_preference │
│ ...audit fields     │
└──────────┬──────────┘
           │ 1:N relationship
           ↓
┌──────────────────────────────────┐
│     store_user_mapping           │  Linking Table
├──────────────────────────────────┤
│ id (PK)                          │
│ store_fk  → store.id             │
│ user_fk   → users.id             │
│ is_primary (True = Owner)        │
│ joined_date                      │
│ designation_fk                   │
│ assigned_by (who added them)     │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│      store                       │  Store/Company Data
├──────────────────────────────────┤
│ id (PK)                          │
│ owner_fk → users.id              │
│ store_name                       │
│ store_code                       │
│ store_status                     │
│ kyc_level                        │
│ is_verified                      │
│ timezone                         │
│ country_fk                       │
│ logo_url                         │
│ parent_store_fk (hierarchy)      │
│ ...audit fields                  │
└──────────────────────────────────┘
```

---

## 📋 User Table (Personal Data)

**Location**: `/src/core/database/schema/users/users.table.ts`

### Fields

| Field | Type | Purpose | Key Info |
|-------|------|---------|----------|
| `id` | BIGINT (PK) | Unique user identifier | Auto-increment |
| `iamUserId` | VARCHAR(64), UNIQUE | Auth provider ID | From BetterAuth |
| `name` | VARCHAR(255), NOT NULL | User's full name | Display name |
| `email` | VARCHAR(255), UNIQUE | Email address | Login identifier |
| `emailVerified` | BOOLEAN | Email verification status | Default: false |
| `phoneNumber` | VARCHAR(20), UNIQUE | Phone number | Optional |
| `phoneNumberVerified` | BOOLEAN | Phone verification | Default: false |
| `image` | TEXT | Profile picture URL | Avatar/profile pic |
| `kycLevel` | SMALLINT | KYC verification level | 0 (none) to 5 (full) |
| `languagePreference` | VARCHAR(5) | User's language | Default: 'en' |
| `whatsappOptedIn` | BOOLEAN | WhatsApp notification opt-in | Default: true |
| `profileCompleted` | BOOLEAN | Onboarding completion flag | Default: false |
| `profileCompletedAt` | TIMESTAMP | When profile was completed | Null until completed |
| `isBlocked` | BOOLEAN | Account blocked status | Default: false |
| `blockedReason` | TEXT | Why account was blocked | Null if not blocked |
| `blockedAt` | TIMESTAMP | When account was blocked | Null if not blocked |
| `accountLockedUntil` | TIMESTAMP | Temporary lockout end time | For brute-force protection |
| `blockedBy` | BIGINT FK | User who blocked this account | Null if not blocked |
| `primaryLoginMethod` | VARCHAR | Login method (email, phone, oauth) | From authMethodEnum |
| `loginCount` | INTEGER | Total login count | Default: 0 |
| `failedLoginAttempts` | INTEGER | Failed login count (resets on success) | Default: 0 |
| `lastLoginAt` | TIMESTAMP | Last successful login | Null before first login |
| `lastActiveAt` | TIMESTAMP | Last activity time | Updated on token refresh |
| `createdAt` | TIMESTAMP | Account creation time | Auto-set |
| `createdBy` | BIGINT FK | Who created this account | Audit trail |
| `updatedAt` | TIMESTAMP | Last update time | Audit trail |
| `modifiedBy` | BIGINT FK | Who last modified | Audit trail |
| `deletedAt` | TIMESTAMP | Soft delete timestamp | Null if active |
| `deletedBy` | BIGINT FK | Who deleted | Audit trail |

### Indexes

```sql
-- Fast lookups by login method
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_phone_number_idx ON users(phone_number);

-- Unique auth provider ID
CREATE UNIQUE INDEX users_iam_user_id_idx ON users(iam_user_id);

-- Find who blocked a user
CREATE INDEX users_blocked_by_idx ON users(blocked_by);

-- Find incomplete profiles
CREATE INDEX users_profile_completed_idx ON users(profile_completed);
```

---

## 🏢 Store Table (Company/Store Data)

**Location**: `/src/core/database/schema/store/store.table.ts`

### Fields

| Field | Type | Purpose | Key Info |
|-------|------|---------|----------|
| `id` | BIGINT (PK) | Unique store identifier | Auto-increment |
| `storeName` | VARCHAR(255), NOT NULL | Store/company name | Display name |
| `storeCode` | VARCHAR(50), UNIQUE | Unique store code | e.g., "ABC001" |
| `ownerFk` | BIGINT FK, NOT NULL | Owner user ID | Cannot be NULL |
| `storeLegalTypeFk` | BIGINT FK, NOT NULL | Legal entity type | e.g., Pvt Ltd, Sole Prop |
| `storeCategoryFk` | BIGINT FK, NOT NULL | Business category | e.g., GROCERY, PHARMACY |
| `storeStatus` | ENUM | Lifecycle state | ACTIVE, INACTIVE, SUSPENDED, ARCHIVED |
| `registrationNumber` | VARCHAR(100) | Business registration # | For KYC |
| `taxNumber` | VARCHAR(100) | Tax ID (GST/VAT) | For tax compliance |
| `kycLevel` | SMALLINT | KYC verification level | 0 (none) to 5 (full) |
| `isVerified` | BOOLEAN | KYC verification status | Default: false |
| `countryFk` | BIGINT FK | Country of operation | For currency/timezone |
| `timezone` | VARCHAR(60), NOT NULL | IANA timezone | Default: 'UTC' (e.g., 'Asia/Kolkata') |
| `defaultTaxRate` | NUMERIC(5,2) | Default tax % | e.g., 18.00 = 18% |
| `logoUrl` | TEXT | Store logo/brand image | For UI display |
| `parentStoreFk` | BIGINT FK | Parent store (hierarchy) | Null for top-level stores |
| `createdAt` | TIMESTAMP | Store creation time | Auto-set |
| `createdBy` | BIGINT FK | Who created store | Audit trail |
| `updatedAt` | TIMESTAMP | Last update time | Audit trail |
| `modifiedBy` | BIGINT FK | Who last modified | Audit trail |
| `deletedAt` | TIMESTAMP | Soft delete timestamp | Null if active |
| `deletedBy` | BIGINT FK | Who deleted | Audit trail |

### Constraints

```sql
-- Store status and isActive must always be in sync
CHECK (store_status = 'ACTIVE') = is_active

-- Exactly one primary owner per store
UNIQUE INDEX store_user_mapping_one_primary_idx
  ON store_user_mapping(store_fk)
  WHERE is_primary = true
```

---

## 🔗 Store-User Mapping Table (Linking Table)

**Location**: `/src/core/database/schema/store-user-mapping/store-user-mapping.table.ts`

### Purpose
Connects users to stores and determines their relationship:
- **Owner** = `isPrimary = TRUE`
- **Staff** = `isPrimary = FALSE`

### Fields

| Field | Type | Purpose | Key Info |
|-------|------|---------|----------|
| `id` | BIGINT (PK) | Mapping ID | Auto-increment |
| `storeFk` | BIGINT FK, NOT NULL | Store ID | References store.id |
| `userFk` | BIGINT FK, NOT NULL | User ID | References users.id |
| `isPrimary` | BOOLEAN, NOT NULL | Is user the primary owner? | Default: false |
| `joinedDate` | TIMESTAMP | When user joined store | Auto-set (now) |
| `designationFk` | BIGINT FK | User's job title/role | e.g., Manager, Cashier |
| `assignedBy` | BIGINT FK | Who assigned this user | Audit trail |
| `createdAt` | TIMESTAMP | Record creation time | Auto-set |
| `createdBy` | BIGINT FK | Who created this record | Audit trail |
| `updatedAt` | TIMESTAMP | Last update time | Audit trail |
| `modifiedBy` | BIGINT FK | Who last modified | Audit trail |
| `deletedAt` | TIMESTAMP | Soft delete timestamp | Null if active |
| `deletedBy` | BIGINT FK | Who deleted | Audit trail |

### Indexes

```sql
-- Get all stores a user belongs to (e.g., for /store/my-stores, /store/invited)
CREATE INDEX store_user_mapping_user_idx ON store_user_mapping(user_fk);

-- Get all staff with a specific designation
CREATE INDEX store_user_mapping_designation_idx ON store_user_mapping(designation_fk);

-- Audit trail: who assigned users
CREATE INDEX store_user_mapping_assigned_by_idx ON store_user_mapping(assigned_by);

-- Prevent duplicate mappings
UNIQUE INDEX store_user_mapping_unique_idx
  ON store_user_mapping(store_fk, user_fk);

-- Enforce exactly one primary owner per store
UNIQUE INDEX store_user_mapping_one_primary_idx
  ON store_user_mapping(store_fk)
  WHERE is_primary = true;
```

---

## 📊 Query Examples

### 1. **Get User's Personal Information**

```sql
-- User's personal data
SELECT id, name, email, phone_number, image, kyc_level, profile_completed
FROM users
WHERE id = ?;
```

**Use Case**: Display user profile, check if onboarding is complete, verify KYC status

---

### 2. **Get User's Owned Stores (Personal Stores)**

```sql
-- Stores where user is the PRIMARY OWNER
SELECT
  s.id,
  s.store_name,
  s.store_code,
  s.store_status,
  s.kyc_level,
  s.is_verified,
  s.timezone,
  s.logo_url,
  sum.is_primary,
  'OWNER' as user_role
FROM store s
INNER JOIN store_user_mapping sum ON s.id = sum.store_fk
WHERE sum.user_fk = ?
  AND sum.is_primary = true
  AND s.deleted_at IS NULL
  AND sum.deleted_at IS NULL
ORDER BY sum.joined_date DESC;
```

**Use Case**: `/store/my-stores` endpoint - shows stores user owns

---

### 3. **Get User's Invited Stores (Staff Stores)**

```sql
-- Stores where user is INVITED/STAFF (not primary owner)
SELECT
  s.id,
  s.store_name,
  s.store_code,
  s.store_status,
  s.kyc_level,
  s.is_verified,
  s.timezone,
  s.logo_url,
  d.code as designation_code,
  d.name as designation_name,
  'STAFF' as user_role
FROM store s
INNER JOIN store_user_mapping sum ON s.id = sum.store_fk
LEFT JOIN designation d ON sum.designation_fk = d.id
WHERE sum.user_fk = ?
  AND sum.is_primary = false
  AND s.deleted_at IS NULL
  AND sum.deleted_at IS NULL
ORDER BY sum.joined_date DESC;
```

**Use Case**: `/store/invited` endpoint - shows stores user is staff in

---

### 4. **Get All Staff in a Store**

```sql
-- All staff/users in a specific store
SELECT
  u.id,
  u.name,
  u.email,
  u.phone_number,
  u.image,
  d.code as designation_code,
  d.name as designation_name,
  sum.is_primary,
  sum.joined_date
FROM store_user_mapping sum
INNER JOIN users u ON sum.user_fk = u.id
LEFT JOIN designation d ON sum.designation_fk = d.id
WHERE sum.store_fk = ?
  AND sum.deleted_at IS NULL
  AND u.deleted_at IS NULL
ORDER BY sum.is_primary DESC, u.name;
```

**Use Case**: Staff management dashboard, invite staff, assign roles

---

### 5. **Get Store Owner Information**

```sql
-- Get the owner's details for a store
SELECT
  u.id,
  u.name,
  u.email,
  u.phone_number,
  u.image,
  s.id as store_id,
  s.store_name
FROM store s
INNER JOIN users u ON s.owner_fk = u.id
WHERE s.id = ?
  AND s.deleted_at IS NULL
  AND u.deleted_at IS NULL;
```

**Use Case**: Display store owner info, verify ownership, send notifications

---

### 6. **Count User's Stores**

```sql
-- How many stores does a user own vs staff in?
SELECT
  SUM(CASE WHEN is_primary = true THEN 1 ELSE 0 END) as owned_stores,
  SUM(CASE WHEN is_primary = false THEN 1 ELSE 0 END) as invited_stores,
  COUNT(*) as total_stores
FROM store_user_mapping
WHERE user_fk = ?
  AND deleted_at IS NULL;
```

**Use Case**: Dashboard summary, analytics, mobile app stats

---

### 7. **Check if User Can Access a Store**

```sql
-- Verify user has access to a specific store
SELECT 1 FROM store_user_mapping
WHERE store_fk = ?
  AND user_fk = ?
  AND deleted_at IS NULL
LIMIT 1;
```

**Use Case**: Authorization check, access control, prevent unauthorized access

---

## 🔐 How Selection Works

### Personal (Owned) Store Selection

```
User logs in
    ↓
Query: GET owned_stores WHERE is_primary = true
    ↓
Display "My Stores" section with OWNER/ADMIN role badge
    ↓
User clicks store
    ↓
API call: POST /auth/store/select { storeId }
    ↓
Backend updates user.access.activeStoreId
    ↓
Frontend redirects to dashboard
    ↓
All subsequent API calls use activeStoreId context
```

### Invited Store Selection

```
User logs in
    ↓
Query: GET invited_stores WHERE is_primary = false
    ↓
Display "Invited Stores" section with MANAGER/STAFF role badge
    ↓
User clicks store
    ↓
API call: POST /auth/store/select { storeId }
    ↓
Backend validates user has access to store
    ↓
Backend checks user's role in that store (via user_role_mapping)
    ↓
Returns LIMITED permissions based on role
    ↓
Frontend redirects to dashboard with role-based features
```

---

## 📈 Relationships Summary

```
USER (Personal Data)
  │
  ├─ 1:N ──→ STORE via store.owner_fk (User can own multiple stores)
  │
  └─ N:M ──→ STORE via STORE_USER_MAPPING
     │
     ├─ is_primary = TRUE  → User is OWNER (personal store)
     └─ is_primary = FALSE → User is STAFF (invited store)
```

---

## 🎯 Key Design Patterns

### 1. **Owner Enforcement (Store Creation)**
```typescript
// When creating a store:
const newStore = await db.insert(schema.store).values({
  storeName: "My Store",
  ownerFk: userId,  // ← MUST set owner
  // ... other fields
});

// Automatically create store_user_mapping with is_primary = true
await db.insert(schema.storeUserMapping).values({
  storeFk: newStore.id,
  userFk: userId,
  isPrimary: true,  // ← Primary owner relationship
});
```

### 2. **Staff Invitation**
```typescript
// When inviting staff:
await db.insert(schema.storeUserMapping).values({
  storeFk: storeId,
  userFk: newStaffUserId,
  isPrimary: false,  // ← Not the owner
  designationFk: designationId,  // ← Job title
  assignedBy: invitingUserId,  // ← Audit trail
});
```

### 3. **Querying User Stores**
```typescript
// Get personal stores
const ownedStores = await db.select()
  .from(schema.store)
  .innerJoin(schema.storeUserMapping,
    eq(schema.store.id, schema.storeUserMapping.storeFk))
  .where(
    and(
      eq(schema.storeUserMapping.userFk, userId),
      eq(schema.storeUserMapping.isPrimary, true),
      isNull(schema.store.deletedAt)
    )
  );

// Get invited stores
const invitedStores = await db.select()
  .from(schema.store)
  .innerJoin(schema.storeUserMapping,
    eq(schema.store.id, schema.storeUserMapping.storeFk))
  .where(
    and(
      eq(schema.storeUserMapping.userFk, userId),
      eq(schema.storeUserMapping.isPrimary, false),
      isNull(schema.store.deletedAt)
    )
  );
```

---

## 🔄 Integration with RBAC

The store selection feeds into role-based access:

```
User selects store (storeSelect)
    ↓
Backend queries user_role_mapping for that store
    ↓
Looks up role permissions based on role_code + store context
    ↓
Returns AuthResponse with:
    {
      activeStoreId: selected_store_id,
      roles: [
        {
          roleCode: "MANAGER",
          storeId: selected_store_id,
          storeName: "store_name",
          isPrimary: true/false
        }
      ]
    }
    ↓
Frontend restricts UI based on role permissions
```

---

## ✅ Implementation Checklist

- [x] `users` table - Personal user data (completed)
- [x] `store` table - Store/company data (completed)
- [x] `store_user_mapping` table - Linking & ownership (completed)
- [ ] API endpoints:
  - [ ] GET `/store/my-stores` - Get user's owned stores
  - [ ] GET `/store/invited` - Get user's invited stores
  - [ ] POST `/store` - Create new store (auto-set ownerFk & isPrimary)
  - [ ] POST `/store/{id}/invite` - Invite staff to store
  - [ ] DELETE `/store/{id}/staff/{userId}` - Remove staff
  - [ ] POST `/auth/store/select` - Select active store
- [ ] Services:
  - [ ] StoreService - CRUD operations
  - [ ] StoreUserService - Manage staff relationships
  - [ ] AuthService - Update on store selection
- [ ] Frontend:
  - [ ] Select-store page component
  - [ ] Store card component
  - [ ] Integration with Redux store/auth slices

