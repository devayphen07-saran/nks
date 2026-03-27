# RBAC Quick Reference

## 🚀 What's Ready Now

### 1. Use @RequirePermission in Controllers

```typescript
import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';

@Controller('customers')
export class CustomersController {
  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'view')
  async getAll() { }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'create')
  async create(@Body() dto: CreateCustomerDto) { }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) { }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('customers', 'delete')
  async delete(@Param('id') id: string) { }
}
```

### 2. Check Permissions in Services

```typescript
// Inject RolesService
constructor(private rolesService: RolesService) {}

// Check permission
const hasPermission = await this.rolesService.checkUserPermission(
  userId,
  'resource',
  'action'
);

// Get all user permissions
const permissions = await this.rolesService.getUserPermissions(userId);

// Check if super admin
const isSuperAdmin = await this.rolesService.isSuperAdmin(userId);
```

### 3. Permission Names Format

```
<resource>.<action>

Examples:
- customers.view
- customers.create
- customers.edit
- customers.delete
- customers.view_reports
- suppliers.view
- products.create
- invoices.delete
- reports.export
```

---

## 📋 Default Role Structure

| Role | Scope | Can Do |
|------|-------|--------|
| SUPER_ADMIN | Global | Everything (all permissions) |
| ADMIN | Global | Manage company, users, roles, permissions |
| MANAGER | Store | Manage store operations, staff |
| STAFF | Store | Basic operations (view, create limited) |
| CUSTOMER | Global | View own data only |

---

## 🔧 Setup Checklist

### Backend Setup

- [x] Permission Guard implemented
- [x] @RequirePermission Decorator created
- [x] RolesService methods added
- [x] RolesRepository methods added
- [ ] TODO: Implement RolesController endpoints
- [ ] TODO: Create permission seeding script
- [ ] TODO: Create role seeding script
- [ ] TODO: Add migration for application_entity table

### Frontend Setup (Later Phase)

- [ ] Role management page
- [ ] Permission assignment UI
- [ ] Dynamic navigation
- [ ] Show/hide UI elements based on permissions

---

## 📁 File Locations

### Core Files
- **Permission Guard**: `/src/common/guards/permission.guard.ts`
- **Permission Decorator**: `/src/common/decorators/require-permission.decorator.ts`
- **Roles Service**: `/src/modules/roles/roles.service.ts`
- **Roles Repository**: `/src/modules/roles/roles.repository.ts`
- **Error Codes**: `/src/common/constants/error-codes.constants.ts`

### Schema Files
- **Roles**: `/src/core/database/schema/roles/`
- **Permissions**: `/src/core/database/schema/permissions/`
- **Role-Permission Mapping**: `/src/core/database/schema/role-permission-mapping/`
- **User-Role Mapping**: `/src/core/database/schema/user-role-mapping/`
- **Application Entity**: `/src/core/database/schema/application-entity/` (NEW)
- **Routes**: `/src/core/database/schema/routes/`

---

## 🎯 Common Use Cases

### Case 1: Protect Admin Endpoint
```typescript
@Post('admin/users')
@UseGuards(PermissionGuard)
@RequirePermission('users', 'create')
async createUser(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

### Case 2: Conditional Delete
```typescript
async deleteCustomer(id: string, userId: number) {
  const hasPermission = await this.rolesService.checkUserPermission(
    userId,
    'customers',
    'delete'
  );

  if (!hasPermission) {
    throw new ForbiddenException('Cannot delete customers');
  }

  return this.repo.delete(id);
}
```

### Case 3: Super Admin Only
```typescript
async dangerousOperation(userId: number) {
  const isSuperAdmin = await this.rolesService.isSuperAdmin(userId);

  if (!isSuperAdmin) {
    throw new ForbiddenException('Super admin access required');
  }

  // Perform dangerous operation
}
```

### Case 4: Multiple Permissions
```typescript
async approveInvoice(id: string, userId: number) {
  const canView = await this.rolesService.checkUserPermission(
    userId,
    'invoices',
    'view'
  );

  const canApprove = await this.rolesService.checkUserPermission(
    userId,
    'invoices',
    'approve'
  );

  if (!canView || !canApprove) {
    throw new ForbiddenException('Missing required permissions');
  }

  return this.repo.approve(id);
}
```

---

## 📊 Data Model

### Tables
```
roles
├── id (PK)
├── code (UNIQUE per store scope)
├── roleName
├── storeFk (NULL = global role)
├── isActive
└── createdBy, modifiedBy, deletedAt

permissions
├── id (PK)
├── code (UNIQUE) - e.g., "customers.view"
├── resource - e.g., "customers"
├── action - e.g., "view"
└── description

role_permission_mapping
├── id (PK)
├── roleFk → roles.id
├── permissionFk → permissions.id
└── assignedBy

user_role_mapping
├── id (PK)
├── userFk → users.id
├── roleFk → roles.id
├── storeFk (NULL = global assignment)
└── assignedBy
```

---

## ⚠️ Important Notes

### SUPER_ADMIN Users
- Automatically have ALL permissions
- Don't need individual permission assignments
- Cannot revoke SUPER_ADMIN from themselves
- Check with `isSuperAdmin()` for shortcuts

### Store Scoping
- `storeFk: null` = Global role (all stores)
- `storeFk: <number>` = Store-specific role
- Users can have same role in multiple stores

### Permission Checking
- Always returns `true` for SUPER_ADMIN
- Checks role-based permissions
- Also checks direct user permissions (if implemented)
- Case-sensitive: "customers.view" ≠ "Customers.View"

---

## 🔄 Implementation Timeline

**Phase 1 (Done)** ✅
- Guard & decorator implementation
- Service methods
- Repository methods

**Phase 2 (Next)** 🔄
- Admin API endpoints
- Permission seeding
- Role seeding

**Phase 3 (Later)** 📅
- Frontend UI
- Permission caching
- Role templates

---

## 🆘 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `PERMISSION_DENIED` | User lacks permission | Assign permission to role |
| `ROLE_NOT_FOUND` | Role doesn't exist | Check role ID exists |
| `UNAUTHORIZED` | No user context | Ensure AuthGuard runs first |
| `Property not exist on RolesRepository` | Method missing | Check repo has method |

---

## 📞 Support

Refer to: `/RBAC_IMPLEMENTATION_GUIDE.md` for detailed documentation
