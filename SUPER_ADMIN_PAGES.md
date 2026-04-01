# Super Admin Dashboard Pages — Complete Feature Analysis

Based on backend analysis of the NKS system, here are all the pages that can be created for the Super Admin dashboard.

---

## 🎯 Dashboard Overview

**Current Status:** SUPER_ADMIN role is the only role that can access admin endpoints
**Protected by:** `@Roles('SUPER_ADMIN')` + `RBACGuard` + `AuthGuard`
**Base Route:** `/api/v1/admin/*` and `/api/v1/roles/*`

---

## 📋 PAGES BY CATEGORY

### 1️⃣ USERS MANAGEMENT

#### 1.1 Users List Page
**Route:** `GET /api/v1/admin/users`
**Purpose:** View all users in the system

**Features:**
- ✅ Pagination (page, pageSize)
- ✅ Search (by name, email, phone)
- ✅ Sort (by createdAt, name, email, phoneNumber, loginCount)
- ✅ Display fields:
  - User ID, Name, Email, Phone
  - Email Verified status
  - Phone Verified status
  - Block status
  - Login count
  - Created/Updated dates

**UI Components:**
- Data table with pagination controls
- Search bar with filter dropdown
- Sort/Order toggle buttons
- User action buttons (View, Edit, Block/Unblock)

**Page Design:**
```
┌─────────────────────────────────────────┐
│ 🔍 Search Users    [Sort ▼]  [Filter ▼] │
├─────────────────────────────────────────┤
│ ID │ Name │ Email │ Phone │ Status │ ... │
├─────────────────────────────────────────┤
│    │      │       │       │        │ ... │
│    │      │       │       │        │ ... │
├─────────────────────────────────────────┤
│ ◀ Prev  [Page 1 of N]  Next ▶           │
└─────────────────────────────────────────┘
```

---

#### 1.2 User Detail Page
**Route:** `GET /api/v1/admin/users/:userId`
**Purpose:** View detailed user information

**Display Information:**
- User ID (iamUserId, internal ID)
- Name, Email, Phone
- Verification status (email, phone)
- Account status (active/blocked)
- Login statistics (count, last login, last active)
- Account creation/update timestamps

**Associated Data:**
- **User Roles** (from `GET /api/v1/roles/users/:userId/roles`)
  - Assigned roles per user
  - Roles by store context
  - Suspend/Restore role options

- **User Permissions** (from `GET /api/v1/roles/users/:userId/permissions`)
  - All permissions aggregated from roles
  - Resource-based permission display

- **User Sessions** (audit trail)
  - Device info (device type, device name, app version)
  - Session creation date
  - Last activity timestamp

---

#### 1.3 User Edit Page
**Route:** `PATCH /api/v1/admin/users/:userId`
**Purpose:** Modify user details

**Editable Fields:**
- ✅ Name
- ✅ Email Verified (boolean toggle)
- ✅ Phone Number Verified (boolean toggle)
- ✅ Block Status (toggle with reason/comment)

**Actions:**
- Save changes
- Reset password (NOT in current API, could add)
- View audit log (login attempts, role changes)
- View active sessions

**UI Components:**
- Form fields for each editable property
- Toggle switches for verification/block status
- Comment field for blocking reason
- Confirmation modal before blocking
- Success notification on save

---

### 2️⃣ STORES MANAGEMENT

#### 2.1 Stores List Page
**Route:** `GET /api/v1/admin/stores`
**Purpose:** View all stores in the system

**Features:**
- ✅ Pagination (page, pageSize)
- ✅ Search (by store name, code, registration number, tax number)
- ✅ Sort (by createdAt, storeName, storeCode)
- ✅ Display fields:
  - Store ID, Code, Name
  - Legal Type, Category
  - Registration Number, Tax Number
  - Deleted status
  - Created/Updated dates

**UI Components:**
- Data table with pagination
- Search bar
- Sort controls
- Store action buttons (View, Edit, Delete/Restore)

---

#### 2.2 Store Detail Page
**Route:** `GET /api/v1/admin/stores/:storeId`
**Purpose:** View detailed store information

**Display Information:**
- Store ID, Code, Name
- Legal Type (Pvt Ltd, Sole Proprietor, etc.)
- Store Category
- Registration Number, Tax Number
- Deleted status
- Creation/Update dates

**Associated Data:**
- **Store Users** (staff and owners)
  - User mapping to store
  - Roles assigned per user in this store

- **Store Operating Hours**
  - Business hours configuration
  - Days of operation
  - Opening/Closing times

- **Store Documents**
  - Registered documents
  - Document upload history

- **Store Location**
  - Address information
  - Contact persons
  - Communication details

- **Tax Registration**
  - Tax agency registrations
  - Tax ID numbers
  - Tax status per agency

---

#### 2.3 Store Edit Page
**Route:** `PATCH /api/v1/admin/stores/:storeId`
**Purpose:** Modify store details

**Editable Fields:**
- ✅ Store Name
- ✅ Registration Number
- ✅ Tax Number

**Additional Management:**
- View/Manage users in store
- View/Modify operating hours
- View/Manage tax registrations
- Soft delete store (mark as deleted)

---

### 3️⃣ ROLES & PERMISSIONS MANAGEMENT

#### 3.1 Roles List Page
**Route:** `GET /api/v1/roles`
**Purpose:** View all roles in the system

**Features:**
- ✅ Search roles by name
- ✅ Pagination
- ✅ Display:
  - Role ID, Code, Name
  - Description
  - System flag (system roles are immutable)
  - Active status
  - Created by (user who created)
  - Created/Updated dates

**System Roles (Read-Only):**
- SUPER_ADMIN
- STORE_OWNER
- STORE_MANAGER
- CASHIER
- DELIVERY
- CUSTOMER

**Custom Roles:** Can be created/modified

**UI Components:**
- Roles table
- "Create Role" button
- Edit/Delete buttons per role (disabled for system roles)

---

#### 3.2 Role Detail Page
**Route:** `GET /api/v1/roles/:id`
**Purpose:** View role details with permissions

**Display Information:**
- Role ID, Code, Name, Description
- System flag, Active status
- Created by, Created/Updated timestamps

**Associated Data:**
- **Assigned Permissions** (from `GET /api/v1/roles/:id/permissions`)
  - List of all permissions assigned to this role
  - Permission code, name, description, resource
  - Assigned/Revoked date

- **Users with This Role** (count and list)
  - User ID, Name, Email
  - Store context if applicable
  - Activation status (active/suspended)

---

#### 3.3 Role Create/Edit Page
**Route:** `POST /api/v1/roles` or `PATCH /api/v1/roles/:id`
**Purpose:** Create or modify roles

**Editable Fields:**
- Role Name (unique)
- Role Code (unique)
- Description
- Active status

**Permission Assignment:**
- **Assign Permissions** (POST `/api/v1/roles/:id/permissions`)
  - Multi-select from available permissions
  - Filter by resource (users, stores, tax, etc.)
  - Preview what each permission allows

- **Revoke Permissions** (DELETE `/api/v1/roles/:id/permissions/:permissionId`)
  - Remove permission from role
  - Audit trail of who removed it

**Constraints:**
- System roles (SUPER_ADMIN, STORE_OWNER, etc.) cannot be edited/deleted
- Permission changes take effect immediately

---

#### 3.4 Permissions Management Page
**Route:** `GET /api/v1/roles/permissions/all`
**Purpose:** View and manage all permissions

**Features:**
- ✅ List all permissions
- ✅ Filter by resource (users, stores, tax, reports, etc.)
- ✅ Display:
  - Permission ID, Code, Name
  - Description, Resource
  - Which roles have this permission (count)
  - Active/Archived status

**Create Permission:**
- `POST /api/v1/roles/permissions`
- Fields: Code, Name, Description, Resource
- Will be available for assignment to roles

---

#### 3.5 User-Role Assignment Page
**Route:** Various
**Purpose:** Manage which roles are assigned to users

**Features:**
- **Assign Role to User**
  - `POST /api/v1/roles/assign-user`
  - Body: { userId, roleId }
  - Optional: storeId (for store-specific roles)

- **Revoke Role from User**
  - `DELETE /api/v1/roles/revoke-user`
  - Body: { userId, roleId }

- **Suspend User Role** (Soft revoke)
  - `PATCH /api/v1/roles/users/:userId/roles/:roleId/suspend`
  - Keeps audit trail, marks as inactive

- **Restore User Role**
  - `PATCH /api/v1/roles/users/:userId/roles/:roleId/restore`
  - Reactivates previously suspended role

**UI Components:**
- User-Role assignment table
- Add/Remove buttons
- Suspend/Restore toggles
- Effective date column
- Change log

---

#### 3.6 Permission Checker Page
**Route:** `GET /api/v1/roles/users/:userId/has-permission`
**Purpose:** Verify user permissions

**Features:**
- Select a user
- Enter Resource + Action
- Check if user has permission
- Displays:
  - User roles
  - Roles with this permission
  - Effective permissions

**Common Checks:**
- Can user "create_store"?
- Can user "manage_users"?
- Can user "view_reports"?

---

### 4️⃣ TAX & COMPLIANCE

#### 4.1 Tax Configuration Page
**Route:** `GET /api/v1/tax/agencies/country/:countryId`
**Purpose:** Manage tax configuration by country

**Available Tax Data:**
- **Tax Agencies** (country-specific)
  - Agency code, name, country
  - Example: SARS (South Africa), GST (India), VAT (EU)

- **Tax Names** (by agency)
  - Tax type codes and names
  - Example: VAT, GST, Sales Tax, Excise Duty

- **Tax Levels** (tax-names mapping)
  - Tax rate tiers
  - Example: VAT Standard (15%), VAT Reduced (10%), Zero-rated

- **Tax Rate Master**
  - Rate percentages
  - Effective dates
  - Commodity mappings

**UI Components:**
- Country selector dropdown
- Accordion for each tax agency
- Tax codes and rates table
- Edit tax rate modal
- Effective date picker

---

#### 4.2 Commodity Code Management Page
**Route:** `GET /api/v1/tax/commodity-codes`
**Purpose:** Manage commodity classifications

**Features:**
- List all commodity codes
- Code, Description, Tax classification
- Link to tax rate master
- Used for automatic tax calculation

**UI Components:**
- Searchable commodity codes table
- Tax rate assignments
- Batch upload capability (potential)

---

#### 4.3 Tax Registrations Page
**Route:** Tax registration data (associated with stores)
**Purpose:** View store tax registrations

**Display:**
- Per store: Tax agency registrations
- Tax ID numbers
- Registration status
- Effective dates
- Compliance status

---

#### 4.4 Tax Reports Page
**Route:** `GET /api/v1/tax/daily-tax-summary`
**Purpose:** View tax collection summaries

**Features:**
- Daily tax summary by store
- Aggregated tax amounts by type
- Tax level breakdown
- Compliance verification
- Export capability

---

### 5️⃣ LOCATION & GEOGRAPHIC DATA

#### 5.1 Countries Management Page
**Route:** `GET /api/v1/location/countries`
**Purpose:** View and manage countries

**Display:**
- Country code, name, dial code
- Currency (embedded in country)
- Active status
- Timezone (if applicable)

**Associated Data:**
- States/Provinces per country
- Cities per state

---

#### 5.2 States/Provinces Page
**Route:** `GET /api/v1/location/countries/:countryId/states`
**Purpose:** Manage states within countries

**Display:**
- State code, name
- Country reference
- Admin division info
- Active status

---

#### 5.3 Cities Management Page
**Route:** `GET /api/v1/location/states/:stateId/cities`
**Purpose:** Manage cities within states

**Display:**
- City code, name
- State reference
- Postal codes
- Active status

---

### 6️⃣ LOOKUP TABLES & MASTER DATA

#### 6.1 Store Legal Types Page
**Route:** `GET /api/v1/lookups/store-legal-types`
**Purpose:** Manage legal entity types

**Data:**
- Pvt Ltd, Sole Proprietor, Partnership, Public Ltd, etc.
- Description
- Used during store registration

#### 6.2 Store Categories Page
**Route:** `GET /api/v1/lookups/store-categories`
**Purpose:** Manage store classification categories

**Data:**
- Retail, Wholesale, Food, Pharmacy, etc.
- Description
- Used for store classification

#### 6.3 Designations Page
**Route:** Designation lookup
**Purpose:** Manage job titles/designations

**Data:**
- Designation codes and names
- Used for staff management

#### 6.4 Salutations Page
**Route:** `GET /api/v1/lookups/salutations`
**Purpose:** Manage address prefixes

**Data:**
- Mr., Mrs., Dr., Prof., Ms., etc.
- Used in contact person management

#### 6.5 Contact Person Types Page
**Route:** Contact person type lookup
**Purpose:** Manage contact role types

**Data:**
- Owner, Manager, Accountant, Representative, etc.

#### 6.6 Communication Types Page
**Route:** Communication type lookup
**Purpose:** Manage communication channels

**Data:**
- Email, Phone, Mobile, Fax, Website, etc.

#### 6.7 Address Types Page
**Route:** Address type lookup
**Purpose:** Manage address classifications

**Data:**
- Registered Address, Operating Address, Billing Address, etc.

#### 6.8 Notes Types Page
**Route:** Notes type lookup
**Purpose:** Manage note categories

**Data:**
- Internal Note, Customer Note, Compliance Note, etc.

---

### 7️⃣ AUDIT & COMPLIANCE

#### 7.1 Audit Log Page
**Route:** `GET /api/v1/audit-logs` (if endpoint exists)
**Purpose:** View system activity log

**Display:**
- User action logs
- Entity changes (users, stores, roles)
- Timestamp, IP address
- Change details (before/after values)
- Filter by:
  - User
  - Entity type
  - Action (Create, Update, Delete)
  - Date range

**UI Components:**
- Audit log table
- Filter panel
- Detail view modal
- Export to CSV

---

#### 7.2 Login Audit Page
**Route:** `GET /api/v1/login-audit` (if endpoint exists)
**Purpose:** Monitor user login attempts

**Display:**
- User email/phone
- Login timestamp
- IP address, device info
- Login status (success/failed)
- Failed attempt count
- Account locked status

**UI Components:**
- Login attempts table
- Filter by user, date, status
- Blocking/unblocking UI

---

### 8️⃣ NOTIFICATIONS & TEMPLATES

#### 8.1 Notification Templates Page
**Route:** Notification template management
**Purpose:** Manage notification message templates

**Features:**
- Template types (email, SMS, push, in-app)
- Placeholder variables
- Template content editor
- Preview functionality

---

#### 8.2 Notification Types Page
**Route:** Notification type management
**Purpose:** Manage notification categories

**Data:**
- Type name, description
- Associated template
- Delivery channels

---

### 9️⃣ ROUTES & NAVIGATION

#### 9.1 Routes Management Page
**Route:** `GET /api/v1/routes/admin`
**Purpose:** Manage application routes/menu structure

**Features:**
- Route path, name, icon
- Role-based visibility
- Route ordering
- Active/Inactive toggle

**Associated Data:**
- Which roles can see this route
- Route hierarchy (parent/child)
- URL patterns

---

## 📊 DASHBOARD ANALYTICS

### 10.1 Admin Dashboard (Main Page)
**Purpose:** Overview and key metrics

**Metrics to Display:**
- Total users (active, blocked)
- Total stores (active, deleted)
- Active roles
- Recent login attempts
- System health
- Users by verification status
- Stores by category
- Tax compliance status

**Charts:**
- User registration trend (30-day chart)
- Store creation trend
- Login attempts (successful vs failed)
- Roles distribution

---

## 🔌 API ENDPOINT SUMMARY

### Users Management APIs
```
GET    /api/v1/admin/users                    # List users
GET    /api/v1/admin/users/:userId            # Get user detail
PATCH  /api/v1/admin/users/:userId            # Update user
```

### Stores Management APIs
```
GET    /api/v1/admin/stores                   # List stores
GET    /api/v1/admin/stores/:storeId          # Get store detail
PATCH  /api/v1/admin/stores/:storeId          # Update store
```

### Roles Management APIs
```
GET    /api/v1/roles                          # List roles
GET    /api/v1/roles/:id                      # Get role detail
POST   /api/v1/roles                          # Create role
PATCH  /api/v1/roles/:id                      # Update role
DELETE /api/v1/roles/:id                      # Delete role

GET    /api/v1/roles/:id/permissions          # Get role permissions
POST   /api/v1/roles/:id/permissions          # Assign permission
DELETE /api/v1/roles/:id/permissions/:pId    # Revoke permission

POST   /api/v1/roles/assign-user              # Assign role to user
DELETE /api/v1/roles/revoke-user              # Revoke role from user
PATCH  /api/v1/roles/users/:uId/roles/:rId/suspend   # Suspend role
PATCH  /api/v1/roles/users/:uId/roles/:rId/restore   # Restore role
```

### Permissions Management APIs
```
GET    /api/v1/roles/permissions/all          # List all permissions
POST   /api/v1/roles/permissions              # Create permission
GET    /api/v1/roles/users/:userId/permissions # Get user permissions
GET    /api/v1/roles/users/:userId/has-permission # Check permission
GET    /api/v1/roles/users/:userId/is-super-admin # Check super admin
```

### Lookup APIs
```
GET    /api/v1/lookups/store-legal-types      # Store legal types
GET    /api/v1/lookups/store-categories       # Store categories
GET    /api/v1/lookups/salutations            # Salutations
GET    /api/v1/lookups/designations           # Designations
GET    /api/v1/lookups/contact-types          # Contact types
```

### Location APIs
```
GET    /api/v1/location/countries             # Countries
GET    /api/v1/location/countries/:id/states  # States
GET    /api/v1/location/states/:id/cities     # Cities
```

### Tax APIs
```
GET    /api/v1/tax/agencies/:code             # Tax agency
GET    /api/v1/tax/agencies/country/:countryId
GET    /api/v1/tax/names/:code                # Tax name
```

---

## 🎨 UI ARCHITECTURE RECOMMENDATIONS

### Navigation Structure
```
Admin Dashboard
├── 👥 Users Management
│   ├── All Users (List)
│   └── User Details (View/Edit)
├── 🏪 Stores Management
│   ├── All Stores (List)
│   └── Store Details (View/Edit)
├── 🔐 Access Control
│   ├── Roles (List/Create/Edit)
│   ├── Permissions (List/Create)
│   ├── Role-Permission Mapping
│   └── User-Role Assignment
├── 🌍 Location & Master Data
│   ├── Countries
│   ├── States/Provinces
│   ├── Cities
│   ├── Legal Types
│   ├── Store Categories
│   ├── Designations
│   └── Lookups
├── 💰 Tax & Compliance
│   ├── Tax Agencies
│   ├── Tax Rates
│   ├── Commodity Codes
│   ├── Tax Registrations
│   └── Tax Reports
├── 📋 Audit & Monitoring
│   ├── Audit Log
│   ├── Login Audit
│   └── System Health
└── ⚙️ Configuration
    ├── Routes/Navigation
    ├── Notification Templates
    └── Settings
```

---

## 💡 IMPLEMENTATION PRIORITY

### Phase 1 (Core) — Weeks 1-2
1. ✅ Users List & Detail
2. ✅ Users Edit & Blocking
3. ✅ Stores List & Detail
4. ✅ Stores Edit

### Phase 2 (RBAC) — Weeks 3-4
1. Roles Management (CRUD)
2. Permissions Management (CRUD)
3. Role-Permission Mapping
4. User-Role Assignment

### Phase 3 (Lookups) — Week 5
1. Lookup tables (legal types, categories, etc.)
2. Location management (countries, states, cities)

### Phase 4 (Advanced) — Week 6+
1. Tax configuration
2. Audit logging dashboard
3. Analytics & reports
4. Notification templates

---

## 🔒 SECURITY CONSIDERATIONS

All pages require:
- ✅ Authentication (httpOnly cookie or Bearer token)
- ✅ SUPER_ADMIN role verification
- ✅ RBAC Guard validation
- ✅ Audit logging of changes
- ✅ Soft deletes (no hard deletes)
- ✅ Change history/audit trail
- ✅ Rate limiting on sensitive operations

---

## 📱 RESPONSIVE DESIGN

All admin pages should:
- Desktop-first design (admin dashboards are desktop-centric)
- Responsive tables (stack on mobile)
- Collapsible navigation
- Mobile-friendly forms
- Touch-friendly buttons/spacing

