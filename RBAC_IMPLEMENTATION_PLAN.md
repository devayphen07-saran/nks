# RBAC Implementation Plan

## Current State
✅ Already Implemented:
- `roles` table (with store-scoping)
- `permissions` table
- `role_permission_mapping` table
- `user_role_mapping` table
- Basic roles service and controller

## Missing Components
❌ Need to Implement:
1. **application_entity** table (modules/features mapping)
2. **routes** table (UI navigation)
3. **role_application_mapping** table (which roles can access which apps)
4. **application_entity_map_status** table (status workflows)
5. **Permission Guard** (enforce permissions on endpoints)
6. **Permission Decorator** (@RequirePermission)
7. **Routes Service** (manage UI navigation dynamically)
8. **Enhanced Role Service** (with permission assignment)
9. **Seeding System** (pre-populate roles and permissions)

## Architecture

### Database Schema
```
User → UserRoleMapping → Role → RolePermissionMapping → Permission
                         ↓
                    (store_fk)
```

### Key Entities
1. **Application** - Different apps (NKS Web, NKS Mobile)
2. **ApplicationEntity** - Features/Modules (Customers, Suppliers, Products)
3. **Route** - UI Routes with permissions
4. **Role** - User roles (Admin, Manager, Staff)
5. **Permission** - Actions (view, create, edit, delete, view_reports)

### Permission Model
```typescript
interface Permission {
  resource: string;  // 'customers', 'suppliers', 'products'
  action: string;    // 'view', 'create', 'edit', 'delete'
}
// Full permission name: "customers.view", "suppliers.edit"
```

## Implementation Phases

### Phase 1: Schema & Seeding
- [x] Roles table (already exists)
- [x] Permissions table (already exists)
- [ ] Add migration for application_entity table
- [ ] Add migration for routes table
- [ ] Seed system roles
- [ ] Seed system permissions

### Phase 2: Services
- [ ] ApplicationEntityService
- [ ] RoutesService
- [ ] Enhanced RolesService (with permission assignment)
- [ ] PermissionService

### Phase 3: Guards & Decorators
- [ ] PermissionGuard (validate endpoint access)
- [ ] @RequirePermission(resource, action) decorator
- [ ] @AllowedRoutes decorator

### Phase 4: Admin Panel APIs
- [ ] POST /admin/roles (create role)
- [ ] GET /admin/roles (list roles)
- [ ] PUT /admin/roles/:id (update role)
- [ ] POST /admin/roles/:id/permissions (assign permissions)
- [ ] DELETE /admin/roles/:id/permissions/:permissionId (revoke permission)
- [ ] POST /admin/users/:id/roles (assign role to user)
- [ ] DELETE /admin/users/:id/roles/:roleId (revoke role from user)

### Phase 5: Frontend Integration
- [ ] Role Management UI
- [ ] Permission Assignment UI
- [ ] Dynamic Navigation (based on routes table)
- [ ] Permission Checks on UI elements

## Default Roles & Permissions

### System Roles
1. **SUPER_ADMIN** - Full access to everything
2. **ADMIN** - Company admin (limited to company scope)
3. **MANAGER** - Department/store manager
4. **STAFF** - Basic staff member
5. **CUSTOMER** - External customer portal

### Base Permissions
```
Customers:
  - customers.view
  - customers.create
  - customers.edit
  - customers.delete
  - customers.view_reports

Suppliers:
  - suppliers.view
  - suppliers.create
  - suppliers.edit
  - suppliers.delete
  - suppliers.view_reports

Products:
  - products.view
  - products.create
  - products.edit
  - products.delete
  - products.manage_pricing

Accounting:
  - accounting.view
  - accounting.create_entry
  - accounting.approve_entry
  - accounting.view_reports

Reports:
  - reports.view
  - reports.export
  - reports.schedule
```

## Endpoints to Implement

### Role Management
```
POST   /api/admin/roles                    Create role
GET    /api/admin/roles                    List roles
GET    /api/admin/roles/:id                Get role details
PUT    /api/admin/roles/:id                Update role
DELETE /api/admin/roles/:id                Delete role
```

### Permission Management
```
POST   /api/admin/roles/:id/permissions              Assign permission
GET    /api/admin/roles/:id/permissions              List role permissions
DELETE /api/admin/roles/:id/permissions/:permissionId Revoke permission
```

### User Role Management
```
POST   /api/admin/users/:id/roles/:roleId            Assign role to user
GET    /api/admin/users/:id/roles                    List user roles
DELETE /api/admin/users/:id/roles/:roleId            Revoke role from user
```

### Routes Management
```
GET    /api/admin/routes                   Get available routes (for navigation)
GET    /api/admin/application-entities     List all entities
```

## Code Examples

### Using @RequirePermission Decorator
```typescript
@Post('customers')
@RequirePermission('customers', 'create')
async createCustomer(@Body() dto: CreateCustomerDto) {
  // Only users with 'customers.create' permission can execute
}

@Get('customers/:id/reports')
@RequirePermission('customers', 'view_reports')
async getCustomerReports(@Param('id') id: string) {
  // Only users with 'customers.view_reports' permission
}
```

### Checking Permissions in Service
```typescript
async deleteCustomer(id: string, userId: number) {
  // Check permission first
  const hasPermission = await this.permissionService.checkPermission(
    userId,
    'customers.delete'
  );

  if (!hasPermission) {
    throw new ForbiddenException('You do not have permission to delete customers');
  }

  // Proceed with deletion
  return this.repo.delete(id);
}
```

## Next Steps
1. Create application_entity schema
2. Create routes schema
3. Implement ApplicationEntityService
4. Implement RoutesService
5. Create PermissionGuard
6. Create @RequirePermission decorator
7. Seed default roles and permissions
8. Implement admin APIs
