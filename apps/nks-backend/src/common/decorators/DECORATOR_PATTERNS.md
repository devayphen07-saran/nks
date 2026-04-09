# NKS Backend Decorator Patterns Guide

## Overview

This guide documents standard patterns for using decorators to enforce Record-Level Security (RLS) and input validation in NKS backend endpoints.

---

## Pattern 1: Store-Scoped Data Access

**When to use:** Endpoints that read/modify store-specific data (invoices, products, customers, etc.)

**Decorators:**
- `@UseGuards(AuthGuard, RBACGuard)` — Verify authentication + permissions
- `@Roles('STORE_OWNER', 'MANAGER')` — Check role
- `@CurrentStore()` — Get validated store ID from session

**Example:**

```typescript
@Get('/:invoiceId')
@UseGuards(AuthGuard, RBACGuard)
@Roles('STORE_OWNER', 'STORE_MANAGER', 'CASHIER')
@ApiOperation({ summary: 'Get invoice details' })
async getInvoice(
  @Param('invoiceId') invoiceId: string,
  @CurrentStore() storeId: number,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<InvoiceResponseDto>> {
  // RBACGuard already validated user has permission in storeId
  // storeId comes from user's activeStoreId (not from request params)

  const invoice = await this.invoiceService.getInvoice(
    invoiceId,
    storeId,
    user.userId,
  );

  return ApiResponse.ok(invoice, 'Invoice retrieved successfully');
}
```

**Why this works:**
1. `AuthGuard` validates the JWT token
2. `RBACGuard` checks user has required role + entity permission in their activeStore
3. `@CurrentStore()` provides the validated store ID (can't be spoofed)
4. Service receives both invoiceId and storeId for double-checking

---

## Pattern 2: Cross-Store Lookup (Admin Only)

**When to use:** Admins need to access data from ANY store (audit, support, etc.)

**Decorators:**
- `@UseGuards(AuthGuard, RBACGuard)`
- `@Roles('SUPER_ADMIN')` — Only SUPER_ADMIN
- `@Param('storeId')` — Accept store ID from URL (admin request)

**Example:**

```typescript
@Get('/admin/stores/:storeId/invoices/:invoiceId')
@UseGuards(AuthGuard, RBACGuard)
@Roles('SUPER_ADMIN')
@ApiOperation({ summary: 'Admin: View any store invoice' })
async adminGetInvoice(
  @Param('storeId') storeId: number,
  @Param('invoiceId') invoiceId: string,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<InvoiceResponseDto>> {
  // SUPER_ADMIN can access any store — no @CurrentStore() needed
  // But should still log the access for audit trail

  const invoice = await this.invoiceService.getInvoice(
    invoiceId,
    storeId,
    user.userId,
  );

  // Log admin access
  await this.auditService.logSuperAdminAction(
    user.userId,
    'VIEW_INVOICE',
    'invoice',
    invoiceId,
    { storeId },
  );

  return ApiResponse.ok(invoice, 'Invoice retrieved successfully');
}
```

---

## Pattern 3: Bulk Store Data (User's Store Only)

**When to use:** List, filter, search operations on store data

**Decorators:**
- `@UseGuards(AuthGuard, RBACGuard)`
- `@Roles('STORE_OWNER', 'MANAGER')`
- `@CurrentStore()` — Always use user's store
- `@Query()` — For filters (search, page, sort)

**Example:**

```typescript
@Get('/invoices')
@UseGuards(AuthGuard, RBACGuard)
@Roles('STORE_OWNER', 'MANAGER', 'CASHIER')
@RequireEntityPermission('INVOICE', 'view')
@ApiOperation({ summary: 'List invoices for current store' })
async listInvoices(
  @CurrentStore() storeId: number,
  @Query() query: ListInvoicesQueryDto, // { page, pageSize, search, dateFrom, dateTo }
  @CurrentUser('userId') userId: number,
): Promise<ApiResponse<{ items: InvoiceResponseDto[]; total: number }>> {
  // storeId is validated from session
  // Query filters applied by service
  // Audit: listed invoices for user

  const result = await this.invoiceService.listInvoices(storeId, userId, query);

  return ApiResponse.paginated(
    result.items,
    query.page,
    query.pageSize,
    result.total,
    'Invoices retrieved successfully',
  );
}
```

---

## Pattern 4: Create Store Data

**When to use:** POST endpoints that create new store records

**Decorators:**
- `@UseGuards(AuthGuard, RBACGuard)`
- `@Roles('STORE_OWNER', 'MANAGER')`
- `@RequireEntityPermission('INVOICE', 'create')`
- `@CurrentStore()` — Ensure record created in user's store
- `@CurrentUser('userId')` — Track who created it

**Example:**

```typescript
@Post('/invoices')
@UseGuards(AuthGuard, RBACGuard)
@Roles('STORE_OWNER', 'MANAGER', 'CASHIER')
@RequireEntityPermission('INVOICE', 'create')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create new invoice' })
async createInvoice(
  @Body() dto: CreateInvoiceDto,
  @CurrentStore() storeId: number,
  @CurrentUser('userId') userId: number,
): Promise<ApiResponse<InvoiceResponseDto>> {
  // ❌ WRONG: const storeId = dto.storeId (user could specify any store!)
  // ✅ CORRECT: storeId from @CurrentStore() (validated from session)

  const invoice = await this.invoiceService.createInvoice(
    {
      ...dto,
      storeId, // Use validated storeId, not from DTO
    },
    userId,
  );

  return ApiResponse.created(invoice, 'Invoice created successfully');
}
```

---

## Pattern 5: Update/Delete with Ownership Check

**When to use:** PUT/DELETE endpoints on store-specific resources

**Decorators:**
- `@UseGuards(AuthGuard, RBACGuard)`
- `@Roles('STORE_OWNER', 'MANAGER')`
- `@RequireEntityPermission('INVOICE', 'edit')`
- `@CurrentStore()` — Validate owner matches current store

**Example:**

```typescript
@Put('/:invoiceId')
@UseGuards(AuthGuard, RBACGuard)
@Roles('STORE_OWNER', 'MANAGER')
@RequireEntityPermission('INVOICE', 'edit')
@ApiOperation({ summary: 'Update invoice' })
async updateInvoice(
  @Param('invoiceId') invoiceId: string,
  @Body() dto: UpdateInvoiceDto,
  @CurrentStore() storeId: number,
  @CurrentUser('userId') userId: number,
): Promise<ApiResponse<InvoiceResponseDto>> {
  // Service verifies:
  // 1. Invoice exists
  // 2. Invoice belongs to storeId (double-check)
  // 3. Invoice is editable (not locked/completed)

  const invoice = await this.invoiceService.updateInvoice(
    invoiceId,
    storeId,
    dto,
    userId,
  );

  return ApiResponse.ok(invoice, 'Invoice updated successfully');
}
```

---

## Anti-Patterns ❌

### Anti-Pattern 1: Reading storeId from Request

```typescript
// ❌ WRONG: User controls storeId
@Get('/invoices/:storeId')
async getInvoices(@Param('storeId') storeId: number) {
  // User can request /invoices/999 (other store!)
}

// ✅ CORRECT: storeId from authenticated session
@Get('/invoices')
async getInvoices(@CurrentStore() storeId: number) {
  // storeId always = user's activeStoreId
}
```

---

### Anti-Pattern 2: Trusting DTO for Store Context

```typescript
// ❌ WRONG: User could change storeId in body
@Post('/invoices')
async createInvoice(@Body() dto: CreateInvoiceDto) {
  const invoice = await this.service.createInvoice(dto);
  // User could have passed storeId: 999 in body
}

// ✅ CORRECT: Remove storeId from DTO, inject from session
@Post('/invoices')
async createInvoice(
  @Body() dto: Omit<CreateInvoiceDto, 'storeId'>,
  @CurrentStore() storeId: number,
) {
  const invoice = await this.service.createInvoice({
    ...dto,
    storeId, // Validated from session
  });
}
```

---

### Anti-Pattern 3: No Guard on Store-Scoped Endpoint

```typescript
// ❌ WRONG: No permission check
@Get('/:id')
async get(@Param('id') id: string) {
  // Anyone with JWT token can access any store data
}

// ✅ CORRECT: Apply guards + role check
@Get('/:id')
@UseGuards(AuthGuard, RBACGuard)
@Roles('STORE_OWNER', 'MANAGER')
@RequireEntityPermission('ENTITY_CODE', 'view')
async get(
  @Param('id') id: string,
  @CurrentStore() storeId: number,
) {
  // User must have STORE_OWNER/MANAGER role + VIEW permission
}
```

---

## Decorator Reference

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@CurrentStore()` | Get validated user's store ID | `@CurrentStore() storeId: number` |
| `@CurrentUser()` | Get authenticated user | `@CurrentUser() user: SessionUser` |
| `@Param()` | Get URL parameter | `@Param('id') id: string` |
| `@Query()` | Get query string | `@Query() query: QueryDto` |
| `@Body()` | Get request body | `@Body() dto: CreateDto` |
| `@Roles()` | Check role requirement | `@Roles('STORE_OWNER')` |
| `@RequireEntityPermission()` | Check entity permission | `@RequireEntityPermission('INVOICE', 'create')` |
| `@UseGuards()` | Apply guards | `@UseGuards(AuthGuard, RBACGuard)` |
| `@Public()` | Skip auth (public endpoint) | `@Public()` |

---

## Testing Your Endpoint

### Test 1: Valid Access (Should Pass)

```typescript
const token = loginAs('cashier@store1');
const response = await api.get('/invoices', {
  headers: { Authorization: `Bearer ${token}` },
});
// ✅ Should return Store-1 invoices
```

### Test 2: Cross-Store Access (Should Fail)

```typescript
const token = loginAs('cashier@store1');
const response = await api.get('/invoices?storeId=2', {
  headers: { Authorization: `Bearer ${token}` },
});
// ✅ Should return 403 Forbidden or ignore storeId=2 param
```

### Test 3: No Auth (Should Fail)

```typescript
const response = await api.get('/invoices');
// ✅ Should return 401 Unauthorized
```

### Test 4: Insufficient Permission (Should Fail)

```typescript
const token = loginAs('viewer@store1'); // No CREATE permission
const response = await api.post('/invoices', { ... }, {
  headers: { Authorization: `Bearer ${token}` },
});
// ✅ Should return 403 Forbidden
```

---

## Audit Logging for Store-Scoped Access

Record-level security requires audit trails to track who accessed what data in which store. Use the `AuditService` to log all store-scoped operations.

**For sensitive data access (recommended):**

```typescript
// In your endpoint handler, after successful operation:

constructor(
  private readonly service: MyService,
  private readonly auditService: AuditService, // Inject audit service
) {}

async getInvoice(
  @Param('invoiceId') invoiceId: string,
  @CurrentStore() storeId: number,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<InvoiceResponseDto>> {
  const invoice = await this.service.getInvoice(invoiceId, storeId, user.userId);

  // Log store data access
  await this.auditService.logStoreDataAccess(
    user.userId,
    storeId,
    'read',           // action: 'read' | 'create' | 'update' | 'delete'
    'invoice',        // entityType
    invoiceId,        // entityId (optional but recommended)
    { invoiceNumber: invoice.invoiceNumber }, // additional details
  );

  return ApiResponse.ok(invoice, 'Invoice retrieved successfully');
}
```

**Audit logging guidelines:**
- Log all **create** operations (data modifications)
- Log all **update** operations (data modifications)
- Log all **delete** operations (data modifications)
- Log sensitive **read** operations (financial data, personal info) — optional for high-volume reads
- Always include: `storeId`, `action`, `entityType`, and `entityId` (if applicable)
- Store ID in metadata provides forensic trail for multi-store access control

**Audit event querying:**
```bash
# Review store data access logs
SELECT * FROM audit_logs
WHERE action = 'STORE_DATA_ACCESS'
  AND meta->'storeId' = '42'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Checklist for New Endpoints

- [ ] Added `@UseGuards(AuthGuard, RBACGuard)` decorator
- [ ] Added `@Roles()` with required roles
- [ ] Added `@RequireEntityPermission()` if needed
- [ ] Used `@CurrentStore()` for store context (not `@Param('storeId')`)
- [ ] Service validates store ownership again (defense-in-depth)
- [ ] Service validates user has permission again (defense-in-depth)
- [ ] Added audit logging for sensitive operations
- [ ] Tested cross-store access attempts → 403 Forbidden
- [ ] Tested with no auth token → 401 Unauthorized
- [ ] Tested with insufficient role → 403 Forbidden

---

## Questions?

See `/modules/roles/roles.controller.ts` for complete examples of all patterns in action.
