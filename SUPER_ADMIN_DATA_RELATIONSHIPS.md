# Super Admin Data Relationships & Database Context

Quick visual reference for understanding how super admin manages interconnected data.

---

## 📊 Core Relationships

### User ↔ Roles ↔ Permissions

```
┌─────────┐
│  Users  │
├─────────┤
│ id      │
│ email   │ ─────┐
│ phone   │      │
│ name    │      │  ┌──────────────────────┐
│ blocked │      │  │ user_role_mapping    │
└─────────┘      │  ├──────────────────────┤
                 │  │ user_fk              │ (user.id)
                 │  │ role_fk              │ (role.id)
                 │  │ store_fk             │ (store.id, nullable)
                 └──│ is_active            │
                    │ suspended_at         │
                    └──────────────────────┘
                            │
                            │ (role.id)
                            ▼
                    ┌─────────────┐
                    │    Roles    │
                    ├─────────────┤
                    │ id          │
                    │ code        │ (SUPER_ADMIN, STORE_OWNER)
                    │ name        │
                    │ is_system   │ (immutable if true)
                    │ is_active   │
                    └─────────────┘
                            │
                            │ (role.id)
                            ▼
                    ┌──────────────────┐
                    │ role_permission   │
                    │ _mapping          │
                    ├──────────────────┤
                    │ role_fk           │
                    │ permission_fk     │
                    └──────────────────┘
                            │
                            │ (permission.id)
                            ▼
                    ┌──────────────┐
                    │ Permissions  │
                    ├──────────────┤
                    │ id           │
                    │ code         │ (users:create)
                    │ resource     │ (users, stores, tax)
                    │ action       │ (create, read, update, delete)
                    └──────────────┘
```

---

### Users ↔ Stores ↔ Staff Mapping

```
┌──────────┐
│  Users   │
│(Staff)   │
└────┬─────┘
     │
     │ (user_fk)
     ▼
┌──────────────────────┐
│ store_user_mapping   │
├──────────────────────┤
│ user_fk              │ (user.id)
│ store_fk             │ (store.id)
│ role_fk              │ (role.id) — role within this store
│ isPrimaryStore       │
└──────────────────────┘
     │ (store_fk)
     ▼
┌──────────────┐
│   Stores     │
├──────────────┤
│ id           │
│ storeName    │
│ storeCode    │
│ legalType_fk │ ────┐
│ category_fk  │ ─┐  │
│ deleted      │  │  │
└──────────────┘  │  │
                  │  │
        ┌─────────┘  │
        ▼            ▼
   ┌──────────────┐  ┌──────────────────┐
   │ StoreLegal   │  │ StoreCategory    │
   │ Type         │  ├──────────────────┤
   ├──────────────┤  │ id               │
   │ Pvt Ltd      │  │ name             │
   │ Sole Prop.   │  │ description      │
   │ Partnership  │  │ code             │
   └──────────────┘  └──────────────────┘
```

---

### Stores ↔ Tax ↔ Location

```
┌──────────────┐
│   Stores     │
└──────┬───────┘
       │
       ├──────────────────┬──────────────────┐
       │                  │                  │
    (store_fk)         (store_fk)         (store_fk)
       │                  │                  │
       ▼                  ▼                  ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
  │ store_user   │  │ store_        │  │ tax_registrations│
  │ _mapping     │  │ operating_    │  ├──────────────────┤
  │ (Staff)      │  │ hours         │  │ tax_agency_fk    │
  └──────────────┘  │ (Business hrs)│  │ registration_num │
                    └──────────────┘  │ tax_id           │
                                      └──────────────────┘
                                              │ (tax_agency_fk)
                                              ▼
                                      ┌──────────────────┐
                                      │ tax_agencies     │
                                      ├──────────────────┤
                                      │ country_fk       │
                                      │ code (SARS, VAT) │
                                      │ name             │
                                      └──────────────────┘

Location Context:
┌──────────────┐
│   Stores     │ ──(polymorphic via entity_fk)──┐
└──────────────┘                                  │
                                                  ▼
                                        ┌──────────────────┐
                                        │   Address        │
                                        ├──────────────────┤
                                        │ entity_type      │ (store)
                                        │ entity_fk        │ (store.id)
                                        │ addressType_fk   │
                                        │ country_fk       │ ────┐
                                        │ state_fk         │ ──┐ │
                                        │ city_fk          │ ┐ │ │
                                        │ postalCode_fk    │ │ │ │
                                        └──────────────────┘ │ │ │
                                                             │ │ │
                                    ┌────────────────────────┘ │ │
                                    ▼                          │ │
                                ┌──────────┐                 │ │
                                │Countries │◄────────────────┘ │
                                ├──────────┤                    │
                                │ code     │                    │
                                │ currency │                    │
                                └──────────┘                    │
                                    │                           │
                                    │ (country_fk)              │
                                    ▼                           │
                                ┌──────────┐   ┌─────────┐    │
                                │ States   │◄──│ Cities  │    │
                                └──────────┘   └────┬────┘    │
                                                    │          │
                                                    └──────────┘
```

---

### Audit Trail

```
┌──────────────┐
│   Users      │
└────┬─────────┘
     │ (modified_by)
     ▼
┌──────────────────────┐
│  audit_log           │
├──────────────────────┤
│ id                   │
│ entity_type          │ (users, stores, roles)
│ entity_id            │
│ action               │ (CREATE, UPDATE, DELETE)
│ modified_by          │ (user.id)
│ old_values           │ (JSON)
│ new_values           │ (JSON)
│ timestamp            │
│ ip_address           │
└──────────────────────┘

┌──────────────────────┐
│  login_audit         │
├──────────────────────┤
│ user_fk              │
│ login_timestamp      │
│ success_flag         │
│ ip_address           │
│ device_info          │
│ failed_attempts      │
│ account_locked_flag  │
└──────────────────────┘
```

---

## 📋 Data Management Workflows

### User Management Workflow
```
1. Create User
   └─> Assign roles to user
       └─> (Optional) Assign store-specific roles
           └─> Permissions automatically derived from roles

2. Modify User
   └─> Edit name, email, phone
   └─> Verify/Unverify email or phone
   └─> Block/Unblock account
   └─> View all audit changes

3. Role Assignment
   └─> Select user
   └─> Select role
   └─> (Optional) Select store context
   └─> Set effective date
   └─> Option to suspend vs. revoke

4. Permission Checking
   └─> Query: Does user X have resource:action permission?
   └─> System checks all user's roles
   └─> Returns: YES/NO + which roles grant it
```

### Store Management Workflow
```
1. View Store
   └─> See basic info: name, code, legal type, category
   └─> See location (address, country, state, city)
   └─> See tax registrations (by agency)
   └─> See operating hours
   └─> See assigned staff (user_store_mapping)

2. Edit Store
   └─> Update name, registration number, tax number
   └─> Update location details
   └─> Update operating hours
   └─> Add/Remove tax registrations

3. Manage Store Staff
   └─> Add user to store
   └─> Assign role within store
   └─> Suspend/Restore role for this user in this store
   └─> View all store staff with their roles and permissions
```

### Role & Permission Workflow
```
1. Create Custom Role
   └─> Enter name, code, description
   └─> Assign permissions
   └─> Set active status
   └─> Save audit trail (who created, when)

2. Modify Role
   └─> Edit name, description (NOT code for system roles)
   └─> Add/Remove permissions
   └─> Cannot modify system roles (SUPER_ADMIN, STORE_OWNER, etc.)
   └─> Audit log all changes

3. Assign Role to User
   └─> Search user
   └─> Select role
   └─> Optionally: Select store (for store-scoped roles)
   └─> Set effective date
   └─> Confirm assignment
   └─> User's permissions updated immediately

4. Check User Permissions
   └─> System aggregates all roles assigned to user
   └─> For each role: get all assigned permissions
   └─> Return union of all permissions
   └─> Can filter by resource (users, stores, tax, etc.)
```

---

## 🔍 Query Patterns Super Admin Uses

### List All Users in System
```sql
SELECT u.*,
       urm.role_id, r.code as role_code,
       urm.store_id
FROM users u
LEFT JOIN user_role_mapping urm ON u.id = urm.user_fk
LEFT JOIN roles r ON urm.role_fk = r.id
WHERE urm.is_active = true
ORDER BY u.created_at DESC
```

### Get User's All Permissions
```sql
SELECT DISTINCT p.*
FROM permissions p
JOIN role_permission_mapping rpm ON p.id = rpm.permission_fk
JOIN user_role_mapping urm ON rpm.role_fk = urm.role_fk
WHERE urm.user_fk = :userId
AND urm.is_active = true
```

### Get All Stores with Staff Count
```sql
SELECT s.*, COUNT(urm.user_fk) as staff_count
FROM stores s
LEFT JOIN store_user_mapping urm ON s.id = urm.store_fk
WHERE s.is_deleted = false
GROUP BY s.id
```

### Get Store's Location Details
```sql
SELECT s.*, a.*, c.name as country, st.name as state, cy.name as city
FROM stores s
JOIN address a ON s.id = a.entity_fk AND a.entity_type = 'store'
JOIN countries c ON a.country_fk = c.id
LEFT JOIN state_region_province st ON a.state_fk = st.id
LEFT JOIN cities cy ON a.city_fk = cy.id
WHERE s.id = :storeId
```

### Check User Permission
```sql
SELECT COUNT(*) > 0 as has_permission
FROM permissions p
JOIN role_permission_mapping rpm ON p.id = rpm.permission_fk
JOIN user_role_mapping urm ON rpm.role_fk = urm.role_fk
WHERE urm.user_fk = :userId
AND p.resource = :resource
AND p.action = :action
AND urm.is_active = true
```

---

## 📊 Data Cardinality

| Relationship | Cardinality | Notes |
|---|---|---|
| User → Roles | 1:N | User can have multiple roles |
| User → Role (per Store) | 1:N | Different roles in different stores |
| Role → Permissions | N:M | Many roles, many permissions |
| Store → Users | N:M | Multiple staff per store |
| User → Stores | N:M | User can be staff in multiple stores |
| Store → Operating Hours | 1:N | Multiple hours (days of week) per store |
| Store → Address | 1:1 | One registered address per store |
| Store → Location | 1:1 | Country/State/City reference |
| Store → Tax Registrations | 1:N | Multiple tax agencies per store |
| Country → States | 1:N | Multiple states per country |
| State → Cities | 1:N | Multiple cities per state |
| Country → Tax Agencies | 1:N | Multiple tax agencies per country |

---

## 🎯 Data Access Patterns (Super Admin)

```
┌─────────────────────────────────────────────┐
│         Super Admin Dashboard               │
├─────────────────────────────────────────────┤
│                                             │
│  [Users]  [Stores]  [Roles]  [Tax]  [Loc]  │
│     │         │         │       │      │    │
│     └────┬────┴────┬────┴──┬────┴─┬───┘    │
│          │         │       │      │        │
│          ▼         ▼       ▼      ▼        │
│    ┌──────────────────────────────────┐   │
│    │   SUPER_ADMIN Role              │   │
│    │   Permissions:                  │   │
│    │  • users:read                   │   │
│    │  • users:create                 │   │
│    │  • users:update                 │   │
│    │  • users:delete                 │   │
│    │  • roles:read                   │   │
│    │  • roles:create                 │   │
│    │  • roles:update                 │   │
│    │  • roles:delete                 │   │
│    │  • stores:read                  │   │
│    │  • stores:create                │   │
│    │  • stores:update                │   │
│    │  • stores:delete                │   │
│    │  • tax:read                     │   │
│    │  • tax:update                   │   │
│    │  • audit:read                   │   │
│    └──────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

---

## 💾 Data Retention Policies

| Entity | Retention | Policy |
|---|---|---|
| Users | Forever (soft delete) | Deactivate, never hard delete |
| Roles | Forever (soft delete) | System roles immutable |
| Permissions | Forever | Archived only |
| Stores | Forever (soft delete) | Is_deleted flag |
| Audit Logs | 1 Year | Compliance: keep for audit |
| Login Audit | 6 Months | Security: track failed attempts |
| OTP Requests | 30 Days | Temporary, auto-cleanup |
| Sessions | 30 Days | Or until logout |

---

## 🔐 Soft Delete Strategy

**Soft deletes are used throughout to maintain audit trail:**

```
Schema:
- users.is_blocked (not deleted, just blocked)
- stores.is_deleted (soft delete)
- roles.is_active (soft delete via active flag)
- permissions.is_active (soft delete via active flag)

Audit Benefit:
- Can restore deleted data
- Maintains referential integrity
- Audit log shows who deleted and when
- Reports can include historical deleted entities
```

---

## 📈 Reporting Entities Available

Super Admin can generate reports from:

1. **User Reports**
   - Active users, blocked users, new registrations
   - Login frequency, last login date
   - Role distribution

2. **Store Reports**
   - Store count by legal type, category
   - Active vs deleted stores
   - Staff per store
   - Tax compliance status

3. **Role & Permission Reports**
   - Permission matrix (which roles have what permissions)
   - User permission distribution
   - Role usage statistics

4. **Tax Reports**
   - Tax collected by type, by store
   - Daily tax summary
   - Commodity code usage

5. **Audit Reports**
   - User activity logs
   - Failed login attempts
   - System changes history
   - Who modified what and when

