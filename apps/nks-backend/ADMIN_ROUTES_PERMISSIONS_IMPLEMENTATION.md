# GET /admin/routes-permissions Endpoint - Implementation Summary

## ✅ What Was Implemented

### 1. DTOs (Data Transfer Objects)

**File**: `/src/modules/routes/dto/route-response.dto.ts`

```typescript
RouteResponseDto {
  id: number,
  routePath: string,
  routeName: string,
  description: string | null,
  iconName: string | null,
  routeType: 'screen' | 'sidebar' | 'modal' | 'tab',
  appCode: string | null,
  isPublic: boolean,
  parentRouteFk: number | null,
  fullPath: string,
  sortOrder: number,
}

AdminRoutesPermissionsResponseDto {
  routes: RouteResponseDto[],
  permissions: PermissionResponseDto[]
}
```

**Used**: Zod for validation + nestjs-zod for DTO generation

---

### 2. Routes Service

**File**: `/src/modules/routes/routes.service.ts`

**Methods**:
- `getAdminRoutes()` - Fetches all system routes ordered by sortOrder
- `getAdminPermissions()` - Fetches all permissions ordered by resource/action
- `getAdminRoutesAndPermissions()` - Combines both and formats with mappers

**Database Queries**:
```sql
-- Get admin routes
SELECT id, routePath, routeName, description, iconName, routeType,
       appCode, isPublic, parentRouteFk, fullPath, sortOrder
FROM routes
WHERE deleted_at IS NULL
ORDER BY sort_order ASC;

-- Get admin permissions
SELECT id, code, name, resource, action, description
FROM permissions
ORDER BY resource ASC, action ASC;
```

**Key Features**:
- ✅ Uses @InjectDb() decorator for database injection
- ✅ Filters deleted routes (soft delete)
- ✅ Ordered by sortOrder for proper navigation display
- ✅ Returns formatted DTOs via mappers

---

### 3. Route Mappers

**File**: `/src/modules/routes/mapper/route.mapper.ts`

**Classes**:
- `RouteMapper` - Maps Route entity → RouteResponseDto
- `PermissionMapper` - Maps Permission entity → response object

**Features**:
- ✅ Handles null values for optional fields
- ✅ Type conversion for enums (routeType)
- ✅ Batch mapping methods

---

### 4. Auth Controller Endpoint

**File**: `/src/modules/auth/controllers/auth.controller.ts`

**Endpoint**:
```
GET /auth/admin/routes-permissions
Authorization: Bearer {token}

Guards:
  - AuthGuard (validates JWT token)
  - RBACGuard (validates role)

Roles:
  - SUPER_ADMIN only
```

**Response**:
```json
{
  "statusCode": 200,
  "message": "Admin routes and permissions retrieved",
  "data": {
    "routes": [
      {
        "id": 1,
        "routePath": "/admin/dashboard",
        "routeName": "Admin Dashboard",
        "iconName": "LayoutDashboard",
        "routeType": "screen",
        "sortOrder": 1,
        ...
      }
    ],
    "permissions": [
      {
        "id": 1,
        "code": "users.view",
        "name": "View Users",
        "resource": "users",
        "action": "view",
        ...
      }
    ]
  }
}
```

---

### 5. Routes Module

**File**: `/src/modules/routes/routes.module.ts`

```typescript
@Module({
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
```

**Purpose**: Encapsulates routes-related logic and exports service for use in other modules

---

### 6. Updated Auth Module

**File**: `/src/modules/auth/auth.module.ts`

**Changes**:
- Added `RoutesModule` to imports
- Allows AuthController to inject RoutesService

---

## 📊 File Structure

```
src/modules/routes/
├── dto/
│   ├── index.ts
│   └── route-response.dto.ts
├── mapper/
│   ├── index.ts
│   └── route.mapper.ts
├── routes.module.ts
└── routes.service.ts
```

---

## 🔐 Authorization

**Guards Applied**:
1. **AuthGuard** - Validates JWT token is valid
2. **RBACGuard** - Checks if user has required role
3. **@Roles('SUPER_ADMIN')** - Only SUPER_ADMIN can access

**Database Check**:
```sql
SELECT 1 FROM user_role_mapping urm
JOIN roles r ON urm.role_fk = r.id
WHERE urm.user_fk = ?
  AND r.code = 'SUPER_ADMIN'
  AND r.store_fk IS NULL  -- Global role
LIMIT 1;
```

---

## 📝 Usage Example

### Frontend (React/Redux)

```typescript
// After SUPER_ADMIN login
const fetchAdminRoutesPermissions = async () => {
  const response = await fetch('/auth/admin/routes-permissions', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  // Store in Redux
  dispatch(setAdminRoutes(data.data.routes));
  dispatch(setAdminPermissions(data.data.permissions));

  // Render admin navigation based on routes
  routes.forEach(route => {
    addAdminMenuItem({
      path: route.routePath,
      label: route.routeName,
      icon: route.iconName,
      sortOrder: route.sortOrder,
      parent: route.parentRouteFk,
    });
  });
};
```

---

## 🧪 Testing the Endpoint

### Using cURL:

```bash
# 1. Login as SUPER_ADMIN
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'

# Response includes: token, isSuperAdmin: true

# 2. Call admin routes endpoint
curl -X GET http://localhost:3000/auth/admin/routes-permissions \
  -H "Authorization: Bearer {token_from_login}"

# Response:
{
  "statusCode": 200,
  "message": "Admin routes and permissions retrieved",
  "data": {
    "routes": [...],
    "permissions": [...]
  }
}
```

---

## ✅ Implementation Checklist

- [x] Created RouteResponseDto
- [x] Created AdminRoutesPermissionsResponseDto
- [x] Created RoutesService with database queries
- [x] Created RouteMapper for entity → DTO conversion
- [x] Created PermissionMapper for entity → DTO conversion
- [x] Added GET /auth/admin/routes-permissions endpoint
- [x] Applied AuthGuard + RBACGuard + @Roles('SUPER_ADMIN')
- [x] Created RoutesModule
- [x] Imported RoutesModule in AuthModule
- [x] Proper error handling (soft deletes)
- [x] Ordered results for display (sortOrder)

---

## 🚀 Next Steps

### To Complete the Flow:

1. **Create GET /store/:id/routes-permissions** endpoint
   - For regular users with a selected store
   - Filter routes by user's role/permissions in that store
   - Return user's actual permissions

2. **Verify store selection endpoints**:
   - `GET /store/my-stores`
   - `GET /store/invited`
   - `POST /auth/store/select`

3. **Update frontend**:
   - Call `/admin/routes-permissions` for SUPER_ADMIN
   - Call `/store/:id/routes-permissions` for regular users
   - Store results in Redux
   - Render navigation based on returned routes

---

## 📌 Key Design Decisions

1. **Service Layer**: RoutesService handles all database queries
2. **Mappers**: Clean separation of entity → DTO conversion
3. **Module Structure**: Separate RoutesModule for reusability
4. **Guards**: Layered security (Auth → Role → Specific Role)
5. **Soft Deletes**: Always filter `WHERE deleted_at IS NULL`
6. **Ordering**: Routes ordered by `sortOrder` for UI consistency

---

## 🔗 Related Files

- Routes schema: `/src/core/database/schema/routes/routes.table.ts`
- Permissions schema: `/src/core/database/schema/permissions/permissions.table.ts`
- Auth controller: `/src/modules/auth/controllers/auth.controller.ts`
- Auth module: `/src/modules/auth/auth.module.ts`
- RBAC flow docs: `/ROUTING_AUTHENTICATION_FLOW.md`
