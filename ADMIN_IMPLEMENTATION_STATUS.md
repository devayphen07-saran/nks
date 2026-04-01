# Admin Dashboard Implementation Status

**Current Date:** April 1, 2026
**Status:** ⚠️ PARTIALLY IMPLEMENTED

---

## 📊 Implementation Summary

| Section | Status | Details |
|---------|--------|---------|
| **Users List Page** | ✅ DONE | Fully implemented with search, sort, pagination |
| **Stores List Page** | ✅ DONE | Fully implemented with search, sort, pagination |
| **Lookup Configuration** | ✅ DONE | Legal types, store categories, salutations, designations |
| **User Detail/Edit Page** | ❌ TODO | Edit form, block/unblock, verification toggles |
| **Store Detail/Edit Page** | ❌ TODO | Edit form, location management, staff assignment |
| **Roles Management** | ❌ TODO | List, create, edit, permissions assignment |
| **Permissions Management** | ❌ TODO | List, create, resource filtering |
| **Role-User Assignment** | ❌ TODO | Assign/revoke roles per user per store |
| **Tax Configuration** | ❌ TODO | Agencies, rates, registrations by country |
| **Audit Logs** | ❌ TODO | User actions, entity changes, filtering |
| **Admin Dashboard** | ❌ TODO | Overview, metrics, navigation |

---

## ✅ COMPLETED FEATURES

### 1. Users List Page
**Location:** `/admin/users`
**Files:**
- [page.tsx](apps/nks-web/src/app/(protected)/admin/users/page.tsx) — Page component
- [users-table.tsx](apps/nks-web/src/components/admin/users-table.tsx) — Table component
- [use-admin-users.ts](apps/nks-web/src/hooks/use-admin-users.ts) — Hook for API calls

**Features Implemented:**
- ✅ Fetch users with pagination (20 per page)
- ✅ Search by name, email, phone
- ✅ Sort by: createdAt, name, email, loginCount
- ✅ Display columns:
  - Name with first-name priority
  - Email with verification badge
  - Phone with verification badge
  - Status (Active/Blocked)
  - Login count
  - Created date
- ✅ Pagination controls (Previous/Next)
- ✅ Loading state with spinner
- ✅ Error handling and display
- ✅ Empty state handling
- ✅ Edit button (placeholder for detail page)

**Code Quality:**
- ✅ Client component with 'use client'
- ✅ Proper error handling
- ✅ Loading states
- ✅ Type-safe interfaces
- ✅ Uses @nks/web-ui-components

---

### 2. Stores List Page
**Location:** `/admin/stores`
**Files:**
- [page.tsx](apps/nks-web/src/app/(protected)/admin/stores/page.tsx) — Page component
- [stores-table.tsx](apps/nks-web/src/components/admin/stores-table.tsx) — Table component
- [use-admin-stores.ts](apps/nks-web/src/hooks/use-admin-stores.ts) — Hook for API calls

**Features Implemented:**
- ✅ Fetch stores with pagination (20 per page)
- ✅ Search by store name or code
- ✅ Sort by: createdAt, storeName, storeCode
- ✅ Display columns:
  - Store Code
  - Store Name
  - Legal Type
  - Category
  - Status (Active/Deleted)
  - Created date
- ✅ Pagination controls
- ✅ Loading, error, empty states
- ✅ Edit button (placeholder)

---

### 3. Lookup Configuration Pages
**Location:** `/admin/lookup-configuration`
**Files:**
- Page: [lookup-configuration/page.tsx](apps/nks-web/src/app/(protected)/admin/lookup-configuration/page.tsx)
- Tab controller: [lookup-configuration-tabs.tsx](apps/nks-web/src/components/admin/lookup-configuration-tabs.tsx)
- Components:
  - [store-legal-types-table.tsx](apps/nks-web/src/components/admin/lookup/store-legal-types-table.tsx)
  - [store-categories-table.tsx](apps/nks-web/src/components/admin/lookup/store-categories-table.tsx)
  - [salutations-table.tsx](apps/nks-web/src/components/admin/lookup/salutations-table.tsx)
  - [designations-table.tsx](apps/nks-web/src/components/admin/lookup/designations-table.tsx)

**Features Implemented:**
- ✅ Tabbed interface for lookup tables
- ✅ Store Legal Types (Pvt Ltd, Sole Proprietor, etc.)
- ✅ Store Categories (Retail, Food, Pharmacy, etc.)
- ✅ Salutations (Mr., Mrs., Dr., etc.)
- ✅ Designations (job titles)
- ✅ CRUD modals for each lookup
- ✅ Search functionality
- ✅ Create/Edit/Delete operations

---

### 4. Admin Navigation & Layout
**Files:**
- [admin-page-template.tsx](apps/nks-web/src/components/admin/admin-page-template.tsx) — Layout wrapper
- Admin navigation (in layout.tsx)

**Features:**
- ✅ Admin section sidebar
- ✅ Page title and description
- ✅ Consistent styling
- ✅ Card-based layout

---

## ❌ TODO FEATURES

### Priority 1: Core User/Store Management

#### 1. User Detail & Edit Page
**What's needed:**
- Route: `/admin/users/[id]` — view user details
- Components:
  - User detail panel (name, email, phone, status, created date, last login)
  - Edit form with fields:
    - Name (editable)
    - Email verified (toggle)
    - Phone verified (toggle)
    - Block user (toggle with reason)
  - Assigned roles section (shows roles assigned to this user)
  - User permissions section (aggregated from roles)
  - Actions:
    - Save changes
    - Cancel
    - Confirm before blocking

**Backend Ready:**
- ✅ `GET /api/v1/admin/users/:userId`
- ✅ `PATCH /api/v1/admin/users/:userId`
- ✅ `GET /api/v1/roles/users/:userId/permissions`
- ✅ `GET /api/v1/roles/users/:userId/roles`

---

#### 2. Store Detail & Edit Page
**What's needed:**
- Route: `/admin/stores/[id]` — view store details
- Components:
  - Store detail panel (code, name, legal type, category, tax #, registration #)
  - Location section (address, country, state, city)
  - Operating hours section
  - Staff section (list of users assigned to this store)
  - Tax registrations (by agency)
  - Edit form with editable fields:
    - Store name
    - Registration number
    - Tax number
  - Location editor
  - Operating hours editor

**Backend Ready:**
- ✅ `GET /api/v1/admin/stores/:storeId`
- ✅ `PATCH /api/v1/admin/stores/:storeId`
- ✅ Store-related location and tax data exists

---

### Priority 2: Role & Permission Management

#### 3. Roles List Page
**What's needed:**
- Route: `/admin/roles`
- Components:
  - Roles table with columns:
    - Code, Name, Description
    - System role? (badge)
    - Active status
    - Users count
    - Created by
  - Search, sort, pagination
  - "Create Role" button
  - Edit/Delete buttons (disabled for system roles)

**Backend Ready:**
- ✅ `GET /api/v1/roles`
- ✅ All role CRUD endpoints

---

#### 4. Role Detail & Edit Page
**What's needed:**
- Route: `/admin/roles/[id]`
- Components:
  - Role metadata display
  - Permissions section (current permissions assigned)
  - Add permission modal
  - Users with this role section
  - Edit form (name, description — NOT code)
  - Immutability warning for system roles

**Backend Ready:**
- ✅ `GET /api/v1/roles/:id`
- ✅ `PATCH /api/v1/roles/:id`
- ✅ `GET /api/v1/roles/:id/permissions`
- ✅ `POST /api/v1/roles/:id/permissions` (assign)
- ✅ `DELETE /api/v1/roles/:id/permissions/:permissionId` (revoke)

---

#### 5. Permissions List Page
**What's needed:**
- Route: `/admin/permissions`
- Components:
  - Permissions table with columns:
    - Code, Name, Description
    - Resource, Action
    - Roles count (how many roles have it)
  - Filter by resource dropdown
  - Create permission button (modal)
  - Pagination

**Backend Ready:**
- ✅ `GET /api/v1/roles/permissions/all?resource=...`
- ✅ `POST /api/v1/roles/permissions`

---

#### 6. User-Role Assignment Page
**What's needed:**
- Route: `/admin/users/:id/roles` (within user detail)
- Components:
  - Current roles table
  - "Assign Role" modal
  - "Revoke Role" button per role
  - "Suspend Role" / "Restore Role" buttons
  - Store-scoped role selector

**Backend Ready:**
- ✅ `POST /api/v1/roles/assign-user`
- ✅ `DELETE /api/v1/roles/revoke-user`
- ✅ `PATCH /api/v1/roles/users/:userId/roles/:roleId/suspend`
- ✅ `PATCH /api/v1/roles/users/:userId/roles/:roleId/restore`

---

### Priority 3: Advanced Features

#### 7. Tax Configuration Pages
**What's needed:**
- Route: `/admin/tax`
- Sub-routes:
  - `/admin/tax/agencies` — By country
  - `/admin/tax/rates` — Tax rate master
  - `/admin/tax/registrations` — Store registrations

**Backend Ready:**
- ✅ All tax endpoints exist

---

#### 8. Audit Logs Page
**What's needed:**
- Route: `/admin/audit-logs`
- Components:
  - Audit log table
  - Filter by: user, entity type, action, date range
  - Detail view modal (show before/after values)
  - Export to CSV

**Backend Ready:**
- ✅ Audit logs exist in database
- ✅ Need API endpoint if not present

---

#### 9. Admin Dashboard
**What's needed:**
- Route: `/admin` or `/admin/dashboard`
- Components:
  - Metric cards:
    - Total users (active/blocked)
    - Total stores (active/deleted)
    - Active roles
    - Last login activity
  - Charts:
    - User registration trend (30-day)
    - Store creation trend
    - Login attempts (success/failed)
  - Quick access buttons to main sections

**Backend Ready:**
- ✅ Can aggregate from existing endpoints

---

## 📁 File Structure (Current)

```
apps/nks-web/src/
├── app/(protected)/admin/
│   ├── _layout.tsx          [exists - but check if super admin guarded]
│   ├── users/
│   │   └── page.tsx         ✅ DONE
│   ├── stores/
│   │   └── page.tsx         ✅ DONE
│   ├── lookup-configuration/
│   │   └── page.tsx         ✅ DONE
│   ├── dashboard/
│   │   └── page.tsx         [stub only]
│   ├── billing/
│   │   └── page.tsx         [not implemented]
│   ├── subscriptions/
│   │   └── page.tsx         [not implemented]
│   ├── system-settings/
│   │   └── page.tsx         [not implemented]
│   └── roles/               ❌ TODO
│       ├── page.tsx
│       └── [id]/page.tsx
├── components/admin/
│   ├── users-table.tsx      ✅ DONE
│   ├── stores-table.tsx     ✅ DONE
│   ├── admin-page-template.tsx ✅ DONE
│   ├── lookup/              ✅ DONE (4 tables)
│   ├── roles/               ❌ TODO
│   │   ├── roles-table.tsx
│   │   ├── role-form.tsx
│   │   └── permission-picker.tsx
│   └── permissions/         ❌ TODO
│       ├── permissions-table.tsx
│       └── permission-form.tsx
└── hooks/
    ├── use-admin-users.ts   ✅ DONE
    ├── use-admin-stores.ts  ✅ DONE
    ├── use-admin-roles.ts   ❌ TODO
    ├── use-admin-permissions.ts ❌ TODO
    └── use-pagination.ts    ❌ TODO (reusable)
```

---

## 🚀 Quick Implementation Guide

### To Add User Detail/Edit Page:

1. **Create route file:**
   ```typescript
   // apps/nks-web/src/app/(protected)/admin/users/[id]/page.tsx

   'use client';

   import { useParams } from 'next/navigation';
   import { UserDetailPage } from '@/components/admin/users/user-detail';

   export default function Page() {
     const params = useParams();
     return <UserDetailPage userId={Number(params.id)} />;
   }
   ```

2. **Create hook for user operations:**
   ```typescript
   // apps/nks-web/src/hooks/use-admin-user-detail.ts

   // GET /api/v1/admin/users/:userId
   // PATCH /api/v1/admin/users/:userId
   ```

3. **Create components:**
   - `UserDetail.tsx` — Display user info
   - `UserEditForm.tsx` — Edit form
   - Both use the hook

4. **Update users-table.tsx:**
   ```typescript
   <Link href={`/admin/users/${user.id}`}>
     <Button variant="ghost" size="sm">Edit</Button>
   </Link>
   ```

---

## 🔐 Security Check

**Current Status:**
- ⚠️ Need to verify `/admin` routes are protected with `SUPER_ADMIN` role check
- ⚠️ Check if `_layout.tsx` has super admin guard
- ⚠️ All API calls should use authenticated API client

**Verification:**
```bash
# Check if admin layout has super admin guard
grep -r "SUPER_ADMIN\|isSuperAdmin" /Users/saran/ayphen/projects/nks/apps/nks-web/src/app/\(protected\)/admin/
```

---

## 📋 Implementation Checklist

### Phase 1: User & Store Management (2 weeks)
- [ ] User Detail page
- [ ] User Edit form
- [ ] Block/Unblock functionality
- [ ] Email/Phone verification toggles
- [ ] Store Detail page
- [ ] Store Edit form
- [ ] Location management
- [ ] Operating hours management

### Phase 2: Role & Permission Management (2 weeks)
- [ ] Roles List page
- [ ] Role Detail page
- [ ] Create Role form
- [ ] Edit Role form
- [ ] Permissions List page
- [ ] Create Permission form
- [ ] Permission Picker component
- [ ] Role-Permission mapping UI
- [ ] User-Role Assignment UI

### Phase 3: Advanced (2 weeks)
- [ ] Tax Configuration pages
- [ ] Audit Logs page
- [ ] Admin Dashboard with metrics
- [ ] Export to CSV functionality
- [ ] Batch operations (bulk user actions)

### Phase 4: Polish (1 week)
- [ ] Confirmation modals
- [ ] Success/error notifications
- [ ] Loading optimizations
- [ ] Mobile responsiveness
- [ ] Accessibility audit

---

## 🧪 Testing Notes

### Users List Page
```bash
# Test endpoints
curl http://localhost:4000/api/v1/admin/users?page=1&pageSize=20&search=john

# Expected: List of users with pagination
```

### Stores List Page
```bash
# Test endpoints
curl http://localhost:4000/api/v1/admin/stores?page=1&pageSize=20

# Expected: List of stores with pagination
```

---

## 📝 Notes

1. **Auth Guard:** Verify all admin routes require `SUPER_ADMIN` role
2. **API Client:** Using `ApiClient` class from `@/lib/api-client`
3. **Components:** Using `@nks/web-ui-components` for UI
4. **State:** Using local state with hooks (not Redux for admin pages)
5. **Error Handling:** Implemented in both hooks and components
6. **Pagination:** Already implemented in users & stores list

---

## 🎯 Next Immediate Steps

1. **Verify super admin route protection** — Check `_layout.tsx`
2. **Create User Detail page** — Most critical feature
3. **Create User Edit form** — Allow admins to modify users
4. **Create Store Detail page** — Same pattern as users
5. **Test Edit operations** — PATCH endpoints

These would provide full CRUD for users and stores (the most critical admin functions).

