# RBAC Implementation Guide

## ✅ Completed Components

### 1. **Schema Tables**
- ✅ `roles` - User roles (with store scoping)
- ✅ `permissions` - Permissions/actions
- ✅ `role_permission_mapping` - Map permissions to roles
- ✅ `user_role_mapping` - Assign roles to users
- ✅ `application_entity` - NEW: Feature/module definitions
- ✅ `routes` - UI routes and navigation

### 2. **Database Layer (RolesRepository)**
- ✅ `findUserRoles()` - Get all roles for a user
- ✅ `findPermissionsByRoleIds()` - Get permissions from roles
- ✅ `checkUserPermission()` - Check if user has permission
- ✅ `getUserPermissions()` - Get all user permissions
- ✅ `isSuperAdmin()` - Check if user is super admin
- ✅ `assignPermissionToRole()` - Assign permission to role
- ✅ `assignRoleToUser()` - Assign role to user
- ✅ `revokePermissionFromRole()` - Remove permission from role
- ✅ `revokeRoleFromUser()` - Remove role from user

### 3. **Service Layer (RolesService)**
- ✅ `checkUserPermission()` - Public API for permission checks
- ✅ `getUserPermissions()` - Get user's permissions
- ✅ `isSuperAdmin()` - Check super admin status
- ✅ Plus all existing role management methods

### 4. **Guards & Decorators**
- ✅ `PermissionGuard` - Validates endpoint permissions
- ✅ `@RequirePermission()` - Decorator to specify required permission

---

## How to Use

### A. Protecting Endpoints with Permissions

#### 1. **Simple Permission Check**

```typescript
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { UseGuards } from '@nestjs/common';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  // Allow only users with 'customers.view' permission
  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'view')
  async listCustomers() {
    return this.service.list();
  }

  // Allow only users with 'customers.create' permission
  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'create')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  // Allow only users with 'customers.edit' permission
  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'edit')
  async updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  // Allow only users with 'customers.delete' permission
  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'delete')
  async deleteCustomer(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // Allow only users with 'customers.view_reports' permission
  @Get('reports')
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'view_reports')
  async getReports() {
    return this.service.getReports();
  }
}
```

#### 2. **Manual Permission Check in Service**

```typescript
import { Injectable } from '@nestjs/common';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class CustomersService {
  constructor(private readonly rolesService: RolesService) {}

  async deleteCustomer(id: string, userId: number) {
    // Check if user has permission
    const hasPermission = await this.rolesService.checkUserPermission(
      userId,
      'customers',
      'delete',
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_DENIED',
        message: 'You do not have permission to delete customers',
      });
    }

    // Proceed with deletion
    return this.repo.delete(id);
  }

  async getUSerReports(userId: number) {
    const hasPermission = await this.rolesService.checkUserPermission(
      userId,
      'customers',
      'view_reports',
    );

    if (!hasPermission) {
      throw new ForbiddenException('Cannot view reports');
    }

    return this.repo.getReports();
  }
}
```

---

### B. Default Roles & Permissions

#### **System Roles**
```
SUPER_ADMIN:
  - Has ALL permissions automatically
  - Cannot be revoked from super users
  - Can manage all other roles and permissions

ADMIN:
  - Company-wide admin
  - Can manage customers, suppliers, products
  - Can manage users within the company
  - Can view reports and analytics

MANAGER:
  - Department/store manager
  - Can manage customers and suppliers
  - Can view reports for their store
  - Limited user management

STAFF:
  - Basic staff member
  - Can view customers and suppliers
  - Can create orders/invoices
  - Limited edit permissions

CUSTOMER:
  - External customer portal access
  - Can view own orders and invoices
  - Can submit payments
  - Cannot access admin features
```

#### **Standard Permissions**

```
Customers Module:
  - customers.view      → View customer list and details
  - customers.create    → Create new customers
  - customers.edit      → Edit customer information
  - customers.delete    → Delete customers
  - customers.view_reports → View customer reports and analytics

Suppliers Module:
  - suppliers.view      → View supplier list and details
  - suppliers.create    → Create new suppliers
  - suppliers.edit      → Edit supplier information
  - suppliers.delete    → Delete suppliers
  - suppliers.view_reports → View supplier reports

Products Module:
  - products.view       → View product catalog
  - products.create     → Create new products
  - products.edit       → Edit product information
  - products.delete     → Delete products
  - products.manage_pricing → Manage product prices

Orders/Invoices:
  - orders.view         → View orders
  - orders.create       → Create orders
  - orders.edit         → Edit orders
  - invoices.view       → View invoices
  - invoices.create     → Create invoices

Accounting:
  - accounting.view     → View accounting reports
  - accounting.create_entry → Create journal entries
  - accounting.approve_entry → Approve pending entries
  - accounting.view_reports → View financial reports

Reports:
  - reports.view        → View reports
  - reports.export      → Export reports to CSV/PDF
  - reports.schedule    → Schedule automated reports

User Management:
  - users.view          → View users
  - users.create        → Create users
  - users.edit          → Edit users
  - users.delete        → Delete users

Roles Management:
  - roles.view          → View roles
  - roles.create        → Create roles
  - roles.edit          → Edit roles
  - roles.delete        → Delete roles
  - roles.manage_permissions → Assign permissions to roles
```

---

### C. Role Management APIs

#### **1. Create a Role**
```typescript
POST /api/admin/roles
Content-Type: application/json

{
  "code": "MANAGER",
  "name": "Store Manager",
  "description": "Manager for store operations",
  "storeId": null  // null = global role, number = store-specific role
}

Response: 201 Created
{
  "id": 1,
  "code": "MANAGER",
  "roleName": "Store Manager",
  "description": "Manager for store operations",
  "storeFk": null,
  "isActive": true,
  "createdAt": "2024-03-26T10:00:00Z"
}
```

#### **2. List All Roles**
```typescript
GET /api/admin/roles

Response: 200 OK
[
  {
    "id": 1,
    "code": "SUPER_ADMIN",
    "roleName": "Super Administrator",
    "isActive": true
  },
  {
    "id": 2,
    "code": "ADMIN",
    "roleName": "Administrator",
    "isActive": true
  },
  {
    "id": 3,
    "code": "MANAGER",
    "roleName": "Store Manager",
    "isActive": true
  }
]
```

#### **3. Get Role Details**
```typescript
GET /api/admin/roles/1

Response: 200 OK
{
  "id": 1,
  "code": "SUPER_ADMIN",
  "roleName": "Super Administrator",
  "description": "Full access to system",
  "isSystem": true,
  "isActive": true,
  "permissions": [
    {
      "id": 1,
      "name": "All Access",
      "code": "*.*",
      "resource": "*",
      "action": "*"
    }
  ]
}
```

#### **4. Update Role**
```typescript
PUT /api/admin/roles/3
Content-Type: application/json

{
  "name": "Store Manager (Updated)",
  "description": "Manages store operations and staff"
}

Response: 200 OK
```

#### **5. Delete Role** (only non-system roles)
```typescript
DELETE /api/admin/roles/3

Response: 204 No Content
```

---

### D. Permission Management APIs

#### **1. List All Permissions**
```typescript
GET /api/admin/permissions
// Optional query: ?resource=customers

Response: 200 OK
[
  {
    "id": 1,
    "name": "View Customers",
    "code": "customers.view",
    "resource": "customers",
    "action": "view",
    "description": "View customer list and details"
  },
  {
    "id": 2,
    "name": "Create Customer",
    "code": "customers.create",
    "resource": "customers",
    "action": "create",
    "description": "Create new customers"
  }
]
```

#### **2. Assign Permission to Role**
```typescript
POST /api/admin/roles/3/permissions
Content-Type: application/json

{
  "permissionId": 1  // customers.view
}

Response: 200 OK
{
  "message": "Permission assigned successfully"
}
```

#### **3. Get Role Permissions**
```typescript
GET /api/admin/roles/3/permissions

Response: 200 OK
[
  {
    "id": 1,
    "name": "View Customers",
    "code": "customers.view"
  },
  {
    "id": 2,
    "name": "Create Customer",
    "code": "customers.create"
  }
]
```

#### **4. Revoke Permission from Role**
```typescript
DELETE /api/admin/roles/3/permissions/1

Response: 204 No Content
```

---

### E. User Role Management APIs

#### **1. Assign Role to User**
```typescript
POST /api/admin/users/5/roles
Content-Type: application/json

{
  "roleId": 3,        // Role ID
  "storeId": null     // Optional: scope to specific store
}

Response: 200 OK
{
  "message": "Role assigned successfully"
}
```

#### **2. Get User Roles**
```typescript
GET /api/admin/users/5/roles

Response: 200 OK
[
  {
    "id": 3,
    "code": "MANAGER",
    "roleName": "Store Manager",
    "storeFk": 1,
    "storeName": "Main Store"
  },
  {
    "id": 4,
    "code": "STAFF",
    "roleName": "Staff Member",
    "storeFk": 1,
    "storeName": "Main Store"
  }
]
```

#### **3. Get User Permissions**
```typescript
GET /api/admin/users/5/permissions

Response: 200 OK
[
  {
    "id": 1,
    "code": "customers.view"
  },
  {
    "id": 2,
    "code": "customers.create"
  },
  {
    "id": 5,
    "code": "customers.edit"
  }
]
```

#### **4. Check User Permission**
```typescript
GET /api/admin/users/5/has-permission?resource=customers&action=delete

Response: 200 OK
{
  "hasPermission": false,
  "resource": "customers",
  "action": "delete",
  "userId": 5
}
```

#### **5. Revoke Role from User**
```typescript
DELETE /api/admin/users/5/roles/3

Response: 204 No Content
```

---

## Implementation Status

### Phase 1: ✅ COMPLETE
- [x] Schema tables (roles, permissions, mappings)
- [x] Repository methods
- [x] Service methods
- [x] Permission guard
- [x] @RequirePermission decorator
- [x] Error codes

### Phase 2: 🔄 IN PROGRESS
- [ ] Admin API endpoints (controller methods)
- [ ] Role seeding (default roles)
- [ ] Permission seeding (default permissions)
- [ ] Examples for all modules

### Phase 3: 📋 PENDING
- [ ] Frontend role management UI
- [ ] Frontend permission assignment UI
- [ ] Dynamic navigation based on permissions
- [ ] Permission caching/optimization

---

## Next Steps

1. **Update RolesController** - Add API endpoints
2. **Create seeding scripts** - Populate default roles/permissions
3. **Add to example modules** - Implement in Customers, Suppliers, Products
4. **Frontend integration** - Show/hide UI elements based on permissions
5. **Testing** - Unit tests for guards and decorators

---

## Permission Format

All permissions follow the format: `<resource>.<action>`

Examples:
- `customers.view` - View customers
- `suppliers.create` - Create suppliers
- `products.edit` - Edit products
- `invoices.delete` - Delete invoices
- `reports.export` - Export reports
- `*.*` - ALL permissions (super admin only)

---

## Troubleshooting

### User Cannot Access Endpoint
1. Check user is authenticated
2. Verify user has the role assigned
3. Verify role has the permission assigned
4. Check permission code matches exactly

### Permission Denied Error
- User doesn't have required permission
- Check user roles via `/api/admin/users/:id/permissions`
- Check role permissions via `/api/admin/roles/:id/permissions`

### SUPER_ADMIN Users
- Have ALL permissions automatically
- Don't need individual permission assignments
- Cannot be deleted or demoted by themselves
