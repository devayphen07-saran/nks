# Phase 2: Admin APIs & Seeding - Implementation Guide

## ✅ What's Implemented

### 1. **Seeding Scripts** (NEW)
```
✅ /src/modules/roles/seeders/seed-permissions.ts
   - Seeds ~50+ default permissions
   - Format: resource.action (e.g., customers.view)
   - Covers all modules: Customers, Suppliers, Products, Orders, Invoices, etc.

✅ /src/modules/roles/seeders/seed-roles.ts
   - Seeds 5 system roles: SUPER_ADMIN, ADMIN, MANAGER, STAFF, CUSTOMER
   - Auto-assigns appropriate permissions to each role
   - Prevents duplicate seeding

✅ /src/modules/roles/seeders/run-seeders.ts
   - Main runner for all RBAC seeders
   - Runs in correct order (permissions → roles → mappings)
```

### 2. **Admin API Endpoints** (UPDATED)
```
✅ Existing endpoints:
   GET    /roles                              - List all roles
   GET    /roles/:id                          - Get role details
   POST   /roles                              - Create role
   PATCH  /roles/:id                          - Update role
   DELETE /roles/:id                          - Delete role
   GET    /roles/:id/permissions              - Get role permissions
   POST   /roles/:id/permissions              - Assign permission to role
   DELETE /roles/:id/permissions/:permissionId - Revoke permission
   GET    /roles/permissions/all              - List all permissions
   POST   /roles/permissions                  - Create permission

✅ NEW endpoints added:
   GET    /roles/users/:userId/permissions         - Get user's permissions
   GET    /roles/users/:userId/roles               - Get user's roles
   POST   /roles/users/:userId/roles               - Assign role to user
   DELETE /roles/users/:userId/roles/:roleId       - Revoke role from user
   GET    /roles/users/:userId/has-permission     - Check permission
   GET    /roles/users/:userId/is-super-admin     - Check super admin status
```

---

## 🚀 How to Run Seeders

### Method 1: Run from Main App Boot

Add to your `main.ts` or app initialization:

```typescript
import { runRBACSeeds } from './modules/roles/seeders';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Initialize database connection
  const db = app.get('YOUR_DB_CONNECTION_KEY');

  // Run RBAC seeders (only if database is empty)
  const existingRoles = await db.query.roles.findFirst();
  if (!existingRoles) {
    console.log('Running RBAC seeders...');
    await runRBACSeeds(db);
  }

  // Continue with app startup
  await app.listen(3000);
}

bootstrap();
```

### Method 2: Create Seeder Command

Create a NestJS command:

```typescript
import { Command, CommandRunner } from 'nest-commander';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { runRBACSeeds } from '../seeders';

@Command({
  name: 'seed:rbac',
  description: 'Seed RBAC system (roles and permissions)',
})
export class SeedRbacCommand implements CommandRunner {
  constructor(@InjectDb() private db: NodePgDatabase<typeof schema>) {}

  async run(): Promise<void> {
    await runRBACSeeds(this.db);
  }
}
```

Then run:
```bash
npm run seed:rbac
# or
npx nest-commander seed:rbac
```

### Method 3: One-Time HTTP Endpoint

Create a seeding endpoint (for local dev only):

```typescript
@Post('seed-rbac')
@ApiOperation({ summary: 'Seed RBAC (DEV ONLY - remove in production)' })
async seedRbac() {
  if (process.env.NODE_ENV === 'production') {
    throw new ForbiddenException('Seeding not allowed in production');
  }

  await runRBACSeeds(this.db);
  return ApiResponse.ok(null, 'RBAC seeded successfully');
}
```

---

## 📊 What Gets Seeded

### Permissions (~50+)
```
Customers Module:
  - customers.view, customers.create, customers.edit, customers.delete
  - customers.view_reports

Suppliers Module:
  - suppliers.view, suppliers.create, suppliers.edit, suppliers.delete
  - suppliers.view_reports

Products Module:
  - products.view, products.create, products.edit, products.delete
  - products.manage_pricing

Orders & Invoices:
  - orders.view, orders.create, orders.edit, orders.cancel
  - invoices.view, invoices.create, invoices.edit, invoices.send
  - invoices.mark_paid

Accounting & Reports:
  - accounting.view, accounting.create_entry, accounting.approve_entry
  - accounting.view_reports, accounting.export_reports
  - reports.view, reports.create, reports.export, reports.schedule

Users & Roles:
  - users.view, users.create, users.edit, users.delete, users.manage_roles
  - roles.view, roles.create, roles.edit, roles.delete
  - roles.manage_permissions

Settings:
  - settings.view, settings.edit
```

### Roles (5 default)
```
SUPER_ADMIN:
  - All permissions automatically
  - Cannot be deleted
  - Cannot be modified

ADMIN:
  - All permissions except system settings
  - Full feature access
  - Can manage users and roles

MANAGER:
  - View + Create permissions
  - Can view reports
  - Can edit orders/invoices
  - Limited staff management

STAFF:
  - View and view_reports permissions only
  - Read-only access to most features
  - Can create basic records

CUSTOMER:
  - Limited to own data
  - Can view own orders and invoices
  - Can submit payments
```

---

## 🔌 Using Admin APIs

### 1. **List All Roles**
```bash
curl -X GET http://localhost:3000/roles \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "statusCode": 200,
  "message": "Roles retrieved",
  "data": [
    {
      "id": 1,
      "code": "SUPER_ADMIN",
      "roleName": "Super Administrator",
      "description": "Full access to all system features",
      "isActive": true
    },
    ...
  ]
}
```

### 2. **Create a Custom Role**
```bash
curl -X POST http://localhost:3000/roles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ACCOUNTANT",
    "name": "Accountant",
    "description": "Accounting department staff"
  }'

Response:
{
  "statusCode": 201,
  "message": "Role created",
  "data": {
    "id": 6,
    "code": "ACCOUNTANT",
    "roleName": "Accountant",
    "isActive": true
  }
}
```

### 3. **Assign Permission to Role**
```bash
curl -X POST http://localhost:3000/roles/6/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionId": 10
  }'

Response:
{
  "statusCode": 200,
  "message": "Permission assigned"
}
```

### 4. **Get Role Permissions**
```bash
curl -X GET http://localhost:3000/roles/6/permissions \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "statusCode": 200,
  "data": [
    {
      "id": 10,
      "code": "accounting.view",
      "name": "View Accounting",
      "resource": "accounting",
      "action": "view"
    },
    ...
  ]
}
```

### 5. **Assign Role to User**
```bash
curl -X POST http://localhost:3000/roles/users/5/roles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": 3
  }'

Response:
{
  "statusCode": 200,
  "message": "Role assigned to user"
}
```

### 6. **Get User Permissions**
```bash
curl -X GET http://localhost:3000/roles/users/5/permissions \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "statusCode": 200,
  "data": [
    {
      "code": "customers.view",
      "name": "View Customers"
    },
    ...
  ]
}
```

### 7. **Check User Permission**
```bash
curl -X GET "http://localhost:3000/roles/users/5/has-permission?resource=customers&action=delete" \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "statusCode": 200,
  "data": {
    "hasPermission": false,
    "resource": "customers",
    "action": "delete",
    "userId": 5
  }
}
```

### 8. **Check Super Admin Status**
```bash
curl -X GET http://localhost:3000/roles/users/5/is-super-admin \
  -H "Authorization: Bearer YOUR_TOKEN"

Response:
{
  "statusCode": 200,
  "data": {
    "isSuperAdmin": false,
    "userId": 5
  }
}
```

---

## 📋 Default Role Permissions Matrix

| Permission | SUPER_ADMIN | ADMIN | MANAGER | STAFF | CUSTOMER |
|------------|:-----------:|:-----:|:-------:|:-----:|:--------:|
| customers.view | ✅ | ✅ | ✅ | ✅ | ❌ |
| customers.create | ✅ | ✅ | ✅ | ❌ | ❌ |
| customers.edit | ✅ | ✅ | ✅ | ❌ | ❌ |
| customers.delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| customers.view_reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| accounting.view | ✅ | ✅ | ✅ | ✅ | ❌ |
| accounting.create_entry | ✅ | ✅ | ❌ | ❌ | ❌ |
| accounting.approve_entry | ✅ | ✅ | ❌ | ❌ | ❌ |
| reports.view | ✅ | ✅ | ✅ | ✅ | ❌ |
| reports.export | ✅ | ✅ | ❌ | ❌ | ❌ |
| users.manage_roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| roles.manage_permissions | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 Security Notes

### ✅ Protected Endpoints
- All role endpoints require `SUPER_ADMIN` role
- All permission changes are audit-logged
- System roles cannot be modified or deleted
- Cannot revoke SUPER_ADMIN from yourself

### ✅ Permission Checking
- Every endpoint checks `AuthGuard` first
- Then checks `RBACGuard` for role requirements
- Then `PermissionGuard` for specific permissions

### ✅ Audit Trail
- Every role change records `createdBy`, `modifiedBy`
- Soft deletes preserve history
- Permission assignments log `assignedBy`

---

## 🚨 Common Operations

### Add Accounting Permissions to ACCOUNTANT Role
```bash
# First get permission IDs for accounting
curl -X GET "http://localhost:3000/roles/permissions/all?resource=accounting" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Then assign each permission
curl -X POST http://localhost:3000/roles/6/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionId": 24}'  # accounting.view

curl -X POST http://localhost:3000/roles/6/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionId": 25}'  # accounting.create_entry

curl -X POST http://localhost:3000/roles/6/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionId": 26}'  # accounting.approve_entry
```

### Assign ACCOUNTANT Role to User
```bash
curl -X POST http://localhost:3000/roles/users/5/roles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": 6
  }'

# Verify user has accounting permissions
curl -X GET http://localhost:3000/roles/users/5/permissions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📖 Files Created/Updated

### New Files
```
✅ /src/modules/roles/seeders/seed-permissions.ts
✅ /src/modules/roles/seeders/seed-roles.ts
✅ /src/modules/roles/seeders/run-seeders.ts
✅ /src/modules/roles/seeders/index.ts
```

### Updated Files
```
✅ /src/modules/roles/roles.controller.ts
   - Added 6 new endpoint handlers
   - All endpoints follow existing patterns
   - Maintain backward compatibility
```

---

## 🎯 Next Steps (Phase 3)

1. **Apply @RequirePermission to modules:**
   - CustomersController
   - SuppliersController
   - ProductsController
   - OrdersController
   - InvoicesController
   - etc.

2. **Test permission enforcement:**
   - Create test users with different roles
   - Verify they can/cannot access expected endpoints
   - Check permission error messages

3. **Create frontend role management UI:**
   - List roles
   - Create/edit roles
   - Assign permissions to roles
   - Assign users to roles

---

## 🆘 Troubleshooting

### Seeders Not Running
1. Check database connection is working
2. Verify drizzle-orm is properly configured
3. Check for existing data (seeders skip duplicates)
4. Run: `npm run seed:rbac` or call endpoint

### Permission Not Assigned
1. Verify permission exists: `GET /roles/permissions/all`
2. Verify role exists: `GET /roles`
3. Verify mapping wasn't created: `GET /roles/:id/permissions`
4. Try assigning again: `POST /roles/:id/permissions`

### User Can't Access Endpoint
1. Check user has role assigned: `GET /roles/users/:id/roles`
2. Check role has permission: `GET /roles/:roleId/permissions`
3. Check permission matches: `GET /roles/users/:id/has-permission?resource=X&action=Y`

---

## 📞 Status

**Phase 2**: ✅ COMPLETE
- ✅ Seeding scripts implemented
- ✅ Admin API endpoints added
- ✅ Documentation complete

**Phase 3**: 🔄 NEXT (Apply to modules)
