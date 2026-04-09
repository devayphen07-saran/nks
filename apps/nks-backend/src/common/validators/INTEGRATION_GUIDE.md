# Validator Integration Guide

## Overview
Three critical validators have been implemented to handle security and data integrity:

1. **SanitizerValidator** - Input cleaning and XSS prevention
2. **QueryValidator** - Pagination, sorting, filtering validation
3. **AuthorizationValidator** - Permission and access control checks

---

## 1. SanitizerValidator - Input Cleaning

### Purpose
Cleans user input to prevent injection attacks and normalize data.

### Methods
```typescript
SanitizerValidator.sanitizeEmail(email)           // trim, lowercase, remove spaces
SanitizerValidator.sanitizePhoneNumber(phone)     // remove non-digits except +
SanitizerValidator.sanitizeName(name)             // proper case, normalize spaces
SanitizerValidator.escapeHtml(text)               // XSS prevention
SanitizerValidator.sanitizeSqlInput(input)        // SQL injection prevention (backup)
SanitizerValidator.sanitizeString(text, maxLen)   // trim and limit length
SanitizerValidator.removeControlCharacters(text)  // remove null bytes
```

### Usage Example
```typescript
// In AuthService.register()
async register(dto: RegisterDto) {
  // SANITIZE FIRST
  dto.email = SanitizerValidator.sanitizeEmail(dto.email);
  dto.name = SanitizerValidator.sanitizeName(dto.name);

  // THEN VALIDATE
  EmailValidator.validate(dto.email);
  PasswordValidator.validateStrength(dto.password);

  // Then business logic
  return this.db.create(user);
}

// In OtpService.sendOtp()
async sendOtp(dto: SendOtpDto) {
  let phone = dto.phone;

  // Sanitize
  phone = SanitizerValidator.sanitizePhoneNumber(phone);

  // Validate
  PhoneValidator.validate(phone);

  // Send OTP
  return this.msg91.sendOtp(phone);
}
```

### Integration Points
- AuthService: register() method ✅
- OtpService: sendOtp() method ✅
- Add to: UserService, ProfileService, StoreService for all text inputs

---

## 2. QueryValidator - Query Parameter Validation

### Purpose
Validates pagination, sorting, filtering, and search parameters to prevent invalid queries.

### Methods
```typescript
QueryValidator.validatePagination(page, limit)           // Validate page/limit
QueryValidator.validateSortField(field, allowedFields)   // Validate sort field
QueryValidator.validateSortDirection(direction)          // Validate ASC/DESC
QueryValidator.validateDateRange(startDate, endDate)     // Validate date range
QueryValidator.validateSearchQuery(query, min, max)      // Validate search length
QueryValidator.validateFilterValue(field, value, allowed) // Validate filter value
QueryValidator.validateNumericFilter(field, value, min, max) // Validate numeric filters
QueryValidator.validateFullQuery(query, sortFields)      // Validate all at once
```

### Usage Example - Controller with All Query Params
```typescript
import { QueryValidator } from '../../common/validators/query.validator';

@Get()
async listUsers(
  @Query('page') page?: number,
  @Query('limit') limit?: number,
  @Query('sort') sort?: string,
  @Query('direction') direction?: string,
  @Query('search') search?: string,
  @Query('status') status?: string,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
) {
  // Validate all query parameters
  QueryValidator.validateFullQuery(
    { page, limit, sort, direction, search, startDate, endDate },
    ['name', 'email', 'createdAt', 'status'] // allowed sort fields
  );

  // Validate specific filters
  if (status) {
    QueryValidator.validateFilterValue('status', status, ['ACTIVE', 'INACTIVE']);
  }

  return this.userService.list(page, limit, sort, direction, search, status);
}

// Or validate individually
@Get()
async searchUsers(
  @Query('search') search?: string,
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 10,
) {
  QueryValidator.validatePagination(page, limit);
  QueryValidator.validateSearchQuery(search);

  return this.userService.search(search, page, limit);
}
```

### Integration Points
- All list/search endpoints in every controller
- Apply before: userController.list(), storeController.list(), roleController.list()

---

## 3. AuthorizationValidator - Permission Checks

### Purpose
Validates authorization and permission checks for business logic beyond route guards.

### Methods
```typescript
AuthorizationValidator.validateOwnResource(ownerId, requestingUserId, isSuperAdmin)
  // Check user can only modify own resource (unless admin)

AuthorizationValidator.validateUserRole(userRole, requiredRole)
  // Check user has specific role(s)

AuthorizationValidator.validateNoPrivilegeEscalation(userRole, targetRole, isSuperAdmin)
  // Prevent assigning higher role to other users

AuthorizationValidator.validateStoreAccess(userStores, targetStoreId, isSuperAdmin)
  // Check user has access to store

AuthorizationValidator.validateEmailVerified(isEmailVerified, isRequired)
  // Check email verification status

AuthorizationValidator.validateAccountStatus(status, allowedStatuses)
  // Check account is in valid state

AuthorizationValidator.validateUserActive(deletedAt)
  // Check user is not deactivated

AuthorizationValidator.validateCannotModifySuperAdmin(targetRole, isSuperAdmin)
  // Prevent modifying SUPER_ADMIN users
```

### Usage Example 1 - Own Resource Protection
```typescript
import { AuthorizationValidator } from '../../common/validators/authorization.validator';

// In UserPreferencesService
async update(userId: number, data: any, modifiedBy: number, isSuperAdmin: boolean) {
  // User can only modify own preferences (unless admin)
  AuthorizationValidator.validateOwnResource(userId, modifiedBy, isSuperAdmin);

  // Continue with update
  return this.db.update(schema.userPreferences)
    .set(data)
    .where(eq(schema.userPreferences.userFk, userId));
}

// In UserController
@Put(':userId/preferences')
async updateUserPreferences(
  @Param('userId') userId: number,
  @Body() dto: any,
  @CurrentUser() user: AuthenticatedUser,
) {
  await this.userPreferencesService.update(
    userId,
    dto,
    user.id,
    user.isSuperAdmin
  );
}
```

### Usage Example 2 - Role-Based Authorization
```typescript
// In RoleService
async assignRole(userId: number, newRole: string, assigningUserId: number, isSuperAdmin: boolean) {
  // Check user has role assignment permission
  AuthorizationValidator.validateUserRole(
    userRole,
    ['SUPER_ADMIN', 'ADMIN'] // Only admins can assign roles
  );

  // Prevent privilege escalation
  AuthorizationValidator.validateNoPrivilegeEscalation(
    userRole,
    newRole,
    isSuperAdmin
  );

  // Prevent modifying SUPER_ADMIN
  AuthorizationValidator.validateCannotModifySuperAdmin(newRole, isSuperAdmin);

  return this.db.update(...);
}
```

### Usage Example 3 - Store Access Validation
```typescript
// In StoreService
async getStoreSettings(storeId: number, user: AuthenticatedUser) {
  // Check user has access to store
  AuthorizationValidator.validateStoreAccess(
    user.storeIds, // User's accessible stores
    storeId,
    user.isSuperAdmin
  );

  return this.db.select().from(schema.stores)
    .where(eq(schema.stores.id, storeId));
}
```

### Integration Points
- UserPreferencesService.update() ✅
- Add to: RoleService, StoreService, UserService for authorization checks
- Use in controllers before sensitive operations

---

## Integration Checklist

### Immediate (Already Done)
- [x] AuthService.register() - Sanitize email & name
- [x] OtpService.sendOtp() - Sanitize phone
- [x] UserPreferencesService.update() - Authorize own resource

### High Priority (Next)
- [ ] All list endpoints - Add QueryValidator
- [ ] User update endpoints - Add SanitizerValidator
- [ ] Role assignment - Add AuthorizationValidator
- [ ] Store access - Add QueryValidator + AuthorizationValidator

### Medium Priority
- [ ] Profile update - Sanitize name, description
- [ ] Email/phone change - Sanitize then validate
- [ ] Search endpoints - Add QueryValidator
- [ ] Filter endpoints - Add QueryValidator

---

## Best Practices

### 1. Order of Operations
```
1. SANITIZE (clean input)
2. VALIDATE (format/existence)
3. AUTHORIZE (permission check)
4. EXECUTE (business logic)
```

### 2. Error Handling
All validators throw with error codes. Exception filter catches and returns structured response:
```json
{
  "status": "error",
  "statusCode": 400,
  "errorCode": "GEN-INVALID-INPUT",
  "message": "Search query must be between 2 and 100 characters",
  "timestamp": "2026-04-09T12:00:00Z"
}
```

### 3. Reuse Pattern
```typescript
// DON'T do this in every service
if (!userEmail || !userEmail.includes('@')) throw new Error(...);

// DO use validators
SanitizerValidator.sanitizeEmail(email);
EmailValidator.validate(email);
```

### 4. Service Layer
Place validators at the start of service methods, before any database queries:
```typescript
async createUser(dto: CreateUserDto, currentUser: User) {
  // 1. Sanitize
  dto.email = SanitizerValidator.sanitizeEmail(dto.email);
  dto.name = SanitizerValidator.sanitizeName(dto.name);

  // 2. Validate format
  EmailValidator.validate(dto.email);

  // 3. Check authorization
  AuthorizationValidator.validateUserRole(currentUser.role, 'ADMIN');

  // 4. Business logic
  const user = await this.db.create(...);
  return user;
}
```

---

## Testing

### Unit Test Example
```typescript
describe('SanitizerValidator', () => {
  it('should sanitize email', () => {
    const result = SanitizerValidator.sanitizeEmail('  TEST@EXAMPLE.COM  ');
    expect(result).toBe('test@example.com');
  });

  it('should sanitize phone', () => {
    const result = SanitizerValidator.sanitizePhoneNumber('+91 98765 43210');
    expect(result).toBe('+919876543210');
  });
});

describe('QueryValidator', () => {
  it('should throw on invalid page', () => {
    expect(() => QueryValidator.validatePagination(0, 10))
      .toThrow(BadRequestException);
  });

  it('should throw on invalid sort direction', () => {
    expect(() => QueryValidator.validateSortDirection('INVALID'))
      .toThrow(BadRequestException);
  });
});

describe('AuthorizationValidator', () => {
  it('should throw if user modifying other user without admin', () => {
    expect(() => AuthorizationValidator.validateOwnResource(5, 10, false))
      .toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN to bypass', () => {
    expect(() => AuthorizationValidator.validateOwnResource(5, 10, true))
      .not.toThrow();
  });
});
```

---

## Migration Path

1. **Week 1** - Implement in critical paths (auth, user preferences)
2. **Week 2** - Add to all list endpoints (query validators)
3. **Week 3** - Add to all update endpoints (authorization checks)
4. **Week 4** - Add comprehensive coverage to remaining services

---

## References
- Error Codes: `src/core/constants/error-codes.ts`
- Exception Filter: `src/common/filters/global-exception.filter.ts`
- Validators: `src/common/validators/`
