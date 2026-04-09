# ZodValidationPipe Usage Guide

**Status:** ✅ Recommended Pattern for Query/Body Validation
**Date:** 2026-04-09

---

## Overview

The NKS backend uses **ZodValidationPipe** with Zod schemas for validating HTTP request parameters. This is the standard NestJS approach integrated with the existing validation infrastructure.

**Benefits:**
- ✅ Type-safe query parameters and request bodies
- ✅ Declarative validation via Zod schemas
- ✅ Automatic DTO instantiation (unlike custom decorators)
- ✅ Consistent error handling with GlobalExceptionFilter
- ✅ Reusable across all endpoints

---

## How It Works

### 1. Define a Zod Schema

In your DTO file, export a Zod schema:

```typescript
// modules/users/dto/users-response.dto.ts
export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().min(2).max(100).optional(),
});

export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
```

### 2. Use ZodValidationPipe in Controller

```typescript
// modules/users/users.controller.ts
async listUsers(
  @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: ListUsersQueryDto,
): Promise<ApiResponse<{ items: UserResponseDto[] }>> {
  // query is now validated and type-safe
  return this.usersService.listUsers(query);
}
```

---

## Current Implementations

### ✅ Query Parameters (3 Endpoints)

| Controller | Endpoint | Query DTO |
|-----------|----------|-----------|
| UsersController | `GET /users` | ListUsersQueryDto |
| StatusController | `GET /statuses/all` | GetAllStatusesQueryDto |
| CodesController | `GET /codes/:categoryCode` | GetCodeValuesQueryDto |

### ✅ Request Body

All POST/PUT endpoints use ZodValidationPipe automatically via `@nestjs-zod` global setup:

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
async createStatus(
  @Body() dto: CreateStatusDto,  // Automatically validated
  @CurrentUser() user: SessionUser,
) {
  // CreateStatusDto is already validated
}
```

---

## Validation Rules Applied

### Query Parameters Example: ListUsersQuerySchema

| Parameter | Validation | Default |
|-----------|-----------|---------|
| `page` | Positive integer | 1 |
| `pageSize` | 1-100 | 20 |
| `search` | 2-100 chars (optional) | undefined |

### Zod Features Used

```typescript
z.coerce.number()  // Coerce string to number (from query string)
.int()             // Must be integer
.positive()        // Must be > 0
.max(100)          // Upper bound
.default(1)        // Default value
.optional()        // Makes field optional
```

---

## Error Handling

### Valid Request
```bash
GET /users?page=1&pageSize=10&search=john
# ✅ Returns 200 with validated data
```

### Invalid Pagination
```bash
GET /users?page=0&pageSize=150
# ❌ Returns 400 with Zod error details
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "page": ["Number must be greater than 0"],
    "pageSize": ["Number must be less than or equal to 100"]
  }
}
```

### Missing Optional Parameter
```bash
GET /users?page=1&pageSize=10
# ✅ Returns 200, search is undefined (not sent)
```

---

## Adding Validation to New Endpoints

### Step 1: Create Schema + DTO

```typescript
// modules/products/dto/products-request.dto.ts
export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});

export class ListProductsQueryDto extends createZodDto(ListProductsQuerySchema) {}
```

### Step 2: Use in Controller

```typescript
// modules/products/products.controller.ts
@Get()
async list(
  @Query(new ZodValidationPipe(ListProductsQuerySchema))
  query: ListProductsQueryDto,
): Promise<ApiResponse<ProductResponse[]>> {
  return this.service.list(query);
}
```

---

## Why Not Custom Decorators?

Custom decorators like `@ValidatedQuery()` seem convenient but have issues:

❌ **Hardcoded field names** — Assumes `page`, `limit`, `startDate` — doesn't work for cursor-based pagination or custom date fields

❌ **Type safety broken** — Decorator returns raw JS objects, not DTO instances. TypeScript lies about the type.

❌ **Duplicate work** — Reinvents what ZodValidationPipe already does.

❌ **Scales poorly** — Each endpoint has different query param names and validation rules.

---

## Testing Query Validation

### Unit Test Example

```typescript
describe('UsersController', () => {
  it('should reject invalid page parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/users?page=0&pageSize=10')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });

  it('should accept valid pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/users?page=1&pageSize=10&search=test')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
```

---

## Integration with Validators

QueryValidator and other custom validators are used **inside services** for domain-specific logic, not for HTTP parameter validation:

```typescript
// ✅ Good: DTOs handle HTTP validation, services handle business rules
async listUsers(query: ListUsersQueryDto) {
  // query.page, query.pageSize already validated by Zod
  // Service may apply additional checks (e.g., user permissions)
  AuthorizationValidator.validateQueryAccess(this.user);
  return this.repository.list(query);
}
```

---

## Summary

✅ **Use ZodValidationPipe** for all query/body validation
✅ **Export schemas** so they can be referenced in controllers
✅ **Type-safe** — DTO instances with proper methods
✅ **Consistent** — Same pattern across all endpoints
✅ **Extensible** — Easy to add custom validation with Zod

---

## References

- [Zod Documentation](https://zod.dev/)
- [NestJS Pipes](https://docs.nestjs.com/pipes)
- [nestjs-zod Integration](https://github.com/anatine/zod-plugins/tree/main/packages/zod)
