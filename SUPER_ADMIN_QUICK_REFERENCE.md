# Super Admin — Quick Reference Guide

**TL;DR: What can a Super Admin manage in NKS?**

---

## 🎯 At a Glance

| Feature | Available | Notes |
|---------|-----------|-------|
| **Manage Users** | ✅ | View, edit, verify, block/unblock |
| **Manage Stores** | ✅ | View, edit, manage location, staff |
| **Manage Roles** | ✅ | Create custom roles, assign permissions |
| **Manage Permissions** | ✅ | View resource-action permissions |
| **Assign Users to Roles** | ✅ | Per-user, per-store role assignment |
| **Tax Configuration** | ✅ | By country, agency, tax type, rates |
| **Location Management** | ✅ | Countries, states, cities |
| **Audit Logging** | ✅ | View user actions and system changes |
| **Master Data** | ✅ | Legal types, categories, designations, etc. |
| **Reports** | ⏳ | Available via API, UI pending |

---

## 📱 10 Main Pages

```
1. 👥 Users
   ├─ List: /admin/users (search, paginate, sort)
   └─ Detail: /admin/users/:id (view, edit, block)

2. 🏪 Stores
   ├─ List: /admin/stores (search, paginate, sort)
   └─ Detail: /admin/stores/:id (view, edit, location, tax, staff)

3. 🔐 Roles
   ├─ List: /admin/roles (search, paginate)
   ├─ Detail: /admin/roles/:id (view permissions)
   └─ Create/Edit: /admin/roles/create or :id/edit

4. ✋ Permissions
   └─ List: /admin/permissions (filter by resource)

5. 👤 User Roles
   └─ Assignment UI: Assign roles to users per store

6. 💰 Tax Configuration
   ├─ Agencies: /admin/tax/agencies (by country)
   ├─ Tax Rates: /admin/tax/rates
   └─ Registrations: /admin/tax/registrations (per store)

7. 🌍 Location
   ├─ Countries: /admin/location/countries
   ├─ States: /admin/location/states/:countryId
   └─ Cities: /admin/location/cities/:stateId

8. 📋 Master Data (Lookups)
   ├─ Legal Types
   ├─ Store Categories
   ├─ Designations
   └─ Communication/Address/Contact Types

9. 📊 Audit & Monitoring
   ├─ Audit Logs (who did what)
   └─ Login Attempts (failed, IP, device)

10. 📈 Dashboard
    └─ Overview with key metrics
```

---

## 🔌 Quick API Reference

### Users
```bash
GET    /api/v1/admin/users?page=1&pageSize=20&search=john
GET    /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId { name, isBlocked, emailVerified, phoneNumberVerified }
```

### Stores
```bash
GET    /api/v1/admin/stores?page=1&pageSize=20&search=store
GET    /api/v1/admin/stores/:storeId
PATCH  /api/v1/admin/stores/:storeId { storeName, registrationNumber, taxNumber }
```

### Roles
```bash
GET    /api/v1/roles?search=manager&page=1
POST   /api/v1/roles { code, name, description }
GET    /api/v1/roles/:roleId
PATCH  /api/v1/roles/:roleId { name, description }
DELETE /api/v1/roles/:roleId  (system roles immutable)
```

### Permissions
```bash
GET    /api/v1/roles/permissions/all?resource=users
POST   /api/v1/roles/permissions { code, name, resource, action }
GET    /api/v1/roles/:roleId/permissions
POST   /api/v1/roles/:roleId/permissions { permissionId }
DELETE /api/v1/roles/:roleId/permissions/:permissionId
```

### Role-User Assignment
```bash
POST   /api/v1/roles/assign-user { userId, roleId }
DELETE /api/v1/roles/revoke-user { userId, roleId }
PATCH  /api/v1/roles/users/:userId/roles/:roleId/suspend
PATCH  /api/v1/roles/users/:userId/roles/:roleId/restore
GET    /api/v1/roles/users/:userId/permissions
GET    /api/v1/roles/users/:userId/has-permission?resource=users&action=create
```

### Location
```bash
GET    /api/v1/location/countries
GET    /api/v1/location/countries/:countryId/states
GET    /api/v1/location/states/:stateId/cities
```

### Lookups
```bash
GET    /api/v1/lookups/store-legal-types
GET    /api/v1/lookups/store-categories
GET    /api/v1/lookups/salutations
GET    /api/v1/lookups/designations
```

### Tax
```bash
GET    /api/v1/tax/agencies/:code
GET    /api/v1/tax/agencies/country/:countryId
GET    /api/v1/tax/names/:code
```

---

## 👥 User Management Flow

```
┌─ List Users
│  ├─ Search by: name, email, phone
│  ├─ Sort by: createdAt, name, email, loginCount
│  ├─ Paginate: 20 per page
│  └─ Filter: active/blocked
│
├─ View User Detail
│  ├─ Name, Email, Phone
│  ├─ Verification status (email, phone)
│  ├─ Account status (active/blocked)
│  ├─ Login count, created date
│  ├─ View assigned roles
│  └─ View all permissions (aggregated from roles)
│
└─ Edit User
   ├─ Update name
   ├─ Toggle email/phone verified
   ├─ Block/Unblock account
   └─ Assign/Remove roles
```

---

## 🏪 Store Management Flow

```
┌─ List Stores
│  ├─ Search by: name, code, registration #, tax #
│  ├─ Sort by: createdAt, storeName
│  ├─ Paginate: 20 per page
│  └─ Filter: active/deleted
│
├─ View Store Detail
│  ├─ Store ID, Code, Name
│  ├─ Legal Type, Category
│  ├─ Registration #, Tax #
│  ├─ Location (address, country, state, city)
│  ├─ Operating Hours
│  ├─ Staff/Users assigned
│  ├─ Tax Registrations (by agency)
│  └─ Documents
│
└─ Edit Store
   ├─ Store Name
   ├─ Registration #
   ├─ Tax #
   ├─ Location details
   ├─ Operating hours
   └─ Tax registration updates
```

---

## 🔐 Role & Permission Flow

```
┌─ List Roles
│  ├─ Search: by name
│  ├─ Show: Code, Name, Description, System flag
│  ├─ Filter: System roles (immutable), Custom roles
│  └─ Paginate: 20 per page
│
├─ View Role Detail
│  ├─ Role metadata (code, name, description)
│  ├─ Assigned permissions (list)
│  ├─ Users with this role (count, list)
│  └─ System role? (YES = immutable)
│
├─ Create Role
│  ├─ Code (unique, immutable)
│  ├─ Name
│  ├─ Description
│  ├─ Select permissions to assign
│  └─ Active flag
│
├─ Edit Role
│  ├─ Name, Description (NOT code for system roles)
│  ├─ Add/Remove permissions
│  └─ Cannot modify SUPER_ADMIN, STORE_OWNER, etc.
│
└─ Assign Roles to Users
   ├─ Select user
   ├─ Select role
   ├─ Optional: Select store (for store-scoped roles)
   ├─ Set effective date
   └─ User permissions update immediately
```

---

## 📊 System Roles (Built-in, Immutable)

| Role | Purpose | Permissions |
|------|---------|-------------|
| **SUPER_ADMIN** | System administration | All (users, stores, roles, tax, etc.) |
| **STORE_OWNER** | Own and manage a store | Store management, staff, orders |
| **STORE_MANAGER** | Manage store operations | Orders, inventory, reports (not staff mgmt) |
| **CASHIER** | Process transactions | POS, Orders, Payments |
| **DELIVERY** | Manage deliveries | Delivery list, status updates |
| **CUSTOMER** | Buy from stores | Browse, Order, Track |

---

## 🎨 Data Relationships (Bird's Eye View)

```
Users ←→ Roles ←→ Permissions
  │                    │
  │ (per store)        │
  ▼                    │
Stores ◄────────────────┘
  │
  ├─→ Location (Country, State, City)
  ├─→ Staff (User-Store mapping)
  ├─→ Tax Registrations
  └─→ Operating Hours

Audit Trail:
  └─→ Who did what, when, and the changes
```

---

## 🛡️ Security Rules

✅ **All admin pages require:**
- Authentication (valid session token)
- SUPER_ADMIN role
- RBAC Guard validation
- Audit logging of changes

✅ **Data Protection:**
- Soft deletes (no hard deletes)
- Immutable system roles
- Change history tracked
- User actions logged

---

## ⏱️ Implementation Timeline

**Week 1-2:** Users & Stores Management
**Week 3-4:** Roles & Permissions Management
**Week 5:** Lookup Tables & Location
**Week 6+:** Tax, Audit Logs, Analytics

---

## 📚 Documentation Files

1. **SUPER_ADMIN_PAGES.md** — Detailed page specifications
2. **SUPER_ADMIN_DATA_RELATIONSHIPS.md** — Database schema & relationships
3. **SUPER_ADMIN_IMPLEMENTATION_GUIDE.md** — Frontend implementation code
4. **SUPER_ADMIN_QUICK_REFERENCE.md** — This file

---

## 🚀 Getting Started

1. **Backend**: ✅ Already implemented and tested
   - All APIs are live at `/api/v1/admin/*` and `/api/v1/roles/*`
   - Protected by `@Roles('SUPER_ADMIN')` + `RBACGuard`
   - Full CRUD for users, stores, roles, permissions

2. **Frontend**: ⏳ Ready to build
   - Create Redux thunks for API calls
   - Build pages with tables, forms, modals
   - Use existing UI components from `@nks/web-ui-components`
   - Implement role-based access checks

3. **Testing**: Next step
   - Test all CRUD operations
   - Test permission checks
   - Test audit logging
   - Test user-role assignments across stores

---

## 📞 Common Tasks

### "How do I add a new permission?"
1. API: `POST /api/v1/roles/permissions`
2. Body: `{ code, name, resource, action }`
3. Then assign to roles via: `POST /api/v1/roles/:roleId/permissions`

### "How do I create a custom role?"
1. API: `POST /api/v1/roles`
2. Body: `{ code, name, description }`
3. Then assign permissions: `POST /api/v1/roles/:roleId/permissions`
4. Then assign to users: `POST /api/v1/roles/assign-user { userId, roleId }`

### "How do I check if user has permission?"
1. API: `GET /api/v1/roles/users/:userId/has-permission?resource=users&action=create`
2. Returns: `{ hasPermission: true/false, resource, action, userId }`

### "How do I move a user to a different store?"
1. Revoke from old store: `DELETE /api/v1/roles/revoke-user { userId, roleId }`
2. Assign to new store: `POST /api/v1/roles/assign-user { userId, roleId }`
   - (Include `storeId` if applicable)

### "How do I block a user?"
1. API: `PATCH /api/v1/admin/users/:userId`
2. Body: `{ isBlocked: true }`
3. User's all sessions become invalid

### "How do I verify a user's email?"
1. API: `PATCH /api/v1/admin/users/:userId`
2. Body: `{ emailVerified: true }`

---

## 🔍 What's Next?

After implementing all admin pages:

1. **Analytics Dashboard** — User signups, store creation trends, login patterns
2. **Audit Dashboard** — Filter and search audit logs by user, entity, date
3. **Batch Operations** — Bulk user actions (block multiple users, etc.)
4. **Export/Import** — Export data to CSV, import bulk user/store data
5. **Webhook Notifications** — Notify external systems of important changes
6. **Compliance Reports** — Tax compliance, user security, audit reports

---

## 🐛 Debugging Checklist

- [ ] Token valid? Check browser console for 401 errors
- [ ] Super admin role assigned? Check `GET /api/v1/roles/users/:userId/is-super-admin`
- [ ] Permission available? Check `GET /api/v1/roles/permissions/all`
- [ ] Audit log shows change? Check database `audit_log` table
- [ ] User permissions updated? Check `GET /api/v1/roles/users/:userId/permissions`

---

**Last Updated:** April 1, 2026
**Status:** Backend ✅ Complete | Frontend ⏳ Ready to Build

