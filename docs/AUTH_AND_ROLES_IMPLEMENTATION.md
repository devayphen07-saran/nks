# Authentication & Roles/Permissions Implementation Documentation

## Overview

This document provides a comprehensive analysis of the authentication and role-based access control (RBAC) implementation in the Ayphen Master API backend. The system uses JWT-based authentication with multi-tenant role-based access control and granular permission management.

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Authorization & RBAC](#authorization--rbac)
3. [Database Schema](#database-schema)
4. [Security Configuration](#security-configuration)
5. [Key Components](#key-components)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [API Endpoints](#api-endpoints)
8. [Security Features](#security-features)

---

## Authentication System

### 1. JWT Token Management

#### **Access Tokens**
- **Type**: JWT (JSON Web Token)
- **Signing Algorithm**: HMAC-SHA512
- **Expiration**: 15 minutes (900,000 ms)
- **Issued By**: `JwtTokenProvider.java`
- **Storage**: Authorization header (Bearer scheme)
- **Claims**:
  - `realm_access`: Contains user roles
  - `preferred_username`: Username
  - `email`: User email
  - `given_name`: First name
  - `family_name`: Last name
  - `session_id`: User session identifier
  - `tenant_id`: Company/tenant context
  - `iam_subject`: IAM system subject ID

#### **Refresh Tokens**
- **Type**: Opaque JWT
- **Expiration**: 7 days (604,800,000 ms)
- **Storage**: HTTP-only cookies (secure, sameSite=strict)
- **Database Persistence**: `refresh_tokens` table
- **Features**:
  - Can be revoked/blacklisted
  - Tracked for token rotation
  - Automatic deletion of expired tokens

### 2. Authentication Flow

```
User Credentials
      ↓
  AuthController
      ↓
  AuthServiceImpl (validates credentials)
      ↓
  JwtTokenProvider (generates tokens)
      ↓
  Return Access Token + Refresh Token Cookie
```

**Steps:**
1. User submits credentials to `/api/v1/auth/login`
2. `AuthServiceImpl` retrieves user from `UsersRepository`
3. Password validated using BCrypt
4. `JwtTokenProvider.generateAccessToken()` creates 15-min JWT
5. `JwtTokenProvider.generateRefreshToken()` creates 7-day token
6. Refresh token saved in `RefreshToken` entity with expiration
7. Response includes access token in body, refresh token in HTTP-only cookie

### 3. User Registration

**Request Endpoint**: `POST /api/v1/auth/register`

**User Registration Request DTO**:
```java
{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**User Registration Response DTO**:
```java
{
  "userId": 123,
  "username": "john.doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2026-03-30T00:00:00Z"
}
```

**Password Requirements**:
- Minimum length: 8 characters
- Must include special characters: `!@#$%^&*()`
- Hashing algorithm: BCrypt

### 4. Token Refresh Flow

**Request Endpoint**: `POST /api/v1/auth/refresh`

**Process**:
1. Client sends expired access token + refresh token (from cookie)
2. `JwtAuthenticationFilter` extracts refresh token from cookie
3. `RefreshTokenRepository.findByTokenAndIsRevokedFalseAndIsActiveTrue()` validates
4. New access token generated with updated claims
5. Response returns new access token

### 5. Logout & Token Revocation

**Request Endpoint**: `POST /api/v1/auth/logout`

**Process**:
1. Current refresh token marked as revoked in database
2. All other refresh tokens for the user optionally revoked (configurable)
3. Session cleared from `UserContextHolder`
4. HTTP-only cookie cleared

---

## Authorization & RBAC

### 1. Permission Model Architecture

```
User
  ├─ belongs to Company
  │   ├─ has UserRoleMapping
  │   │   └─ maps to Role
  │   │       └─ has RolePermissionMapping
  │   │           ├─ on ApplicationEntity (e.g., Invoice, PO)
  │   │           └─ includes permissions (CREATE, VIEW, EDIT, DELETE, ALLOW)
  │   │
  │   └─ Company context: tenant_id in JWT
  │
  ├─ OAuth Accounts (optional)
  │   ├─ Google
  │   ├─ Facebook
  │   └─ Other providers
  │
  └─ User Sessions
      └─ Session tracking
```

### 2. User Role Mapping

**Table**: `user_role_mapping`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_fk` | UUID FK | References `users.id` |
| `company_fk` | UUID FK | References `company.id` |
| `role_fk` | UUID FK | References `role.id` |
| `is_active` | BOOLEAN | Soft deactivation |

**Properties**:
- Users can have multiple roles within a single company
- Users can have different roles in different companies
- Role mappings can be deactivated without deletion
- Tenant context comes from `tenant_id` in JWT

### 3. Role Definition

**Entity**: `Role.java`

| Property | Type | Description |
|----------|------|-------------|
| `id` | UUID | Unique identifier |
| `code` | String | Unique code (e.g., "ROLE_ADMIN") |
| `roleName` | String | Display name |
| `description` | String | Role purpose |
| `isActive` | Boolean | Active status |
| `enable` | Boolean | Enabled flag |
| `company` | FK | Associated company |

**Standard Roles**:
- `SUPER_ADMIN`: System-wide administrator
- `ADMIN`: Company administrator
- `MANAGER`: Department/project manager
- `USER`: Regular user
- `ROLE_OWNER`: Special role with elevated permissions

### 4. Permission Model

**Entity**: `RolePermissionMapping.java`

| Column | Type | Description |
|--------|------|------------|
| `id` | UUID | Primary key |
| `role_fk` | UUID FK | Role with permissions |
| `application_entity_fk` | UUID FK | Entity type (Invoice, PO, etc.) |
| `company_fk` | UUID FK | Company context |
| `application_fk` | UUID FK | Application context |
| `can_view` | BOOLEAN | View permission |
| `can_create` | BOOLEAN | Create permission |
| `can_edit` | BOOLEAN | Edit/update permission |
| `can_delete` | BOOLEAN | Delete permission |
| `allow` | BOOLEAN | General allow flag |
| `is_active` | BOOLEAN | Active status |

**Permission Types** (from `PermissionKeyConstants.java`):
```java
CREATE   // Create new records
VIEW     // Read/view records
EDIT     // Modify existing records
DELETE   // Remove records
ALLOW    // General permission grant
```

### 5. Authorization Check Process

**Flow**:
```
Request
  ↓
JwtAuthenticationFilter
  ├─ Extract JWT from Authorization header
  ├─ Validate token signature & expiration
  ├─ Create UserPrincipal from JWT claims
  └─ Set Spring Security context
      ↓
@PreAuthorize("@principalManager.checkPermission(...)")
  ↓
PrincipalManager
  ├─ Extract tenant_id from JWT claims
  ├─ Extract user roles from JWT realm_access
  ├─ Query RolePermissionMapping for entity/action
  ├─ Validate permission flags
  └─ Return boolean (allowed/denied)
      ↓
Grant/Deny Access
```

### 6. PrincipalManager - Core Authorization Component

**Location**: `PrincipalManager.java`

**Key Methods**:
```java
boolean checkPermission(
  String token,                    // JWT access token
  String entityCode,               // What entity (e.g., "INVOICE")
  String permissionKey,            // Permission type (CREATE, VIEW, etc.)
  String companyGuuid              // Company context
)
```

**Authorization Logic**:
1. **Extract Claims**: Parse JWT for roles and tenant_id
2. **Validate Tenant**: Verify user's tenant matches request tenant
3. **Check Role-Owner**: If user has ROLE_OWNER, grant all permissions
4. **Resolve Permissions**: Query RolePermissionMapping for:
   - User's role(s) in company
   - Permission on target entity
   - Specific permission flag (can_create, can_view, etc.)
5. **Return Result**: Boolean result of permission check

**Special Cases**:
- `ROLE_OWNER` role: Bypasses company-level permission checks
- Multi-role users: Permission is union of all role permissions
- Company context: Permissions scoped to company/tenant
- Application context: Can be further scoped to application (optional)

### 7. Permission Mapping Hierarchy

```
Company
  ├─ Role
  │   └─ RolePermissionMapping
  │       ├─ ApplicationEntity (Invoice, PO, etc.)
  │       ├─ Application (ERP, CRM, etc.)
  │       └─ Permissions (VIEW, CREATE, EDIT, DELETE)
  │
  └─ CountryAppEntityMap (optional geographic scoping)
      └─ Applies permissions to specific regions/countries
```

---

## Database Schema

### 1. Core Authentication Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  failed_login_attempts INT DEFAULT 0,
  account_locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
```

**Security Features**:
- Password hashing with BCrypt
- Failed login attempt tracking
- Account lockout mechanism (15 minutes after 5 failed attempts)
- Email verification tracking

#### `refresh_tokens`
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_fk UUID NOT NULL REFERENCES users(id),
  token VARCHAR(2048) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_fk ON refresh_tokens(user_fk);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_is_active ON refresh_tokens(is_active);
```

**Token Lifecycle**:
- Created on login/registration
- Marked as revoked on logout
- Auto-deleted after 7 days
- Can be revoked for security (suspicious activity)

#### `password_reset_tokens`
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_fk UUID NOT NULL REFERENCES users(id),
  token VARCHAR(2048) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pwd_reset_tokens_user_fk ON password_reset_tokens(user_fk);
CREATE INDEX idx_pwd_reset_tokens_token ON password_reset_tokens(token);
```

**Password Reset Flow**:
1. User requests password reset via email
2. `PasswordResetToken` generated with 30-min expiration
3. Reset link sent to email with token
4. User submits new password with token
5. Token marked as used, cannot be reused
6. Old refresh tokens revoked for security

#### `oauth_accounts`
```sql
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY,
  user_fk UUID NOT NULL REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,        -- 'google', 'facebook', etc.
  provider_user_id VARCHAR(255) NOT NULL,
  access_token VARCHAR(2048),
  refresh_token VARCHAR(2048),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user_fk ON oauth_accounts(user_fk);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider);
```

**OAuth Integration**:
- Supports Google, Facebook, and other providers
- Links OAuth accounts to local users
- Token refresh for OAuth provider integrations

### 2. Role & Permission Tables

#### `role`
```sql
CREATE TABLE role (
  id UUID PRIMARY KEY,
  company_fk UUID NOT NULL REFERENCES company(id),
  code VARCHAR(100) NOT NULL,
  role_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  enable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_fk, code)
);

CREATE INDEX idx_role_company_fk ON role(company_fk);
CREATE INDEX idx_role_code ON role(code);
```

#### `user_role_mapping`
```sql
CREATE TABLE user_role_mapping (
  id UUID PRIMARY KEY,
  user_fk UUID NOT NULL REFERENCES users(id),
  company_fk UUID NOT NULL REFERENCES company(id),
  role_fk UUID NOT NULL REFERENCES role(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_fk) REFERENCES role(id)
);

CREATE INDEX idx_user_role_mapping_user_fk ON user_role_mapping(user_fk);
CREATE INDEX idx_user_role_mapping_company_fk ON user_role_mapping(company_fk);
CREATE INDEX idx_user_role_mapping_role_fk ON user_role_mapping(role_fk);
```

#### `role_permission_mapping`
```sql
CREATE TABLE role_permission_mapping (
  id UUID PRIMARY KEY,
  company_fk UUID NOT NULL REFERENCES company(id),
  role_fk UUID NOT NULL REFERENCES role(id),
  application_fk UUID REFERENCES application(id),
  application_entity_fk UUID NOT NULL REFERENCES application_entity(id),
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  allow BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_fk) REFERENCES role(id)
);

CREATE INDEX idx_role_perm_map_company_fk ON role_permission_mapping(company_fk);
CREATE INDEX idx_role_perm_map_role_fk ON role_permission_mapping(role_fk);
CREATE INDEX idx_role_perm_map_app_entity_fk ON role_permission_mapping(application_entity_fk);
```

### 3. Relationships

```
users (1) ──────────────── (M) user_role_mapping
            |
            └─────────────────→ role (1) ──────────────── (M) role_permission_mapping
                                                                |
                                                                └─→ application_entity
                                                                └─→ application

refresh_tokens ──→ users
password_reset_tokens ──→ users
oauth_accounts ──→ users
user_session ──→ users
```

---

## Security Configuration

### 1. Spring Security Configuration

**File**: `CustomSecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class CustomSecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) {
    // Configure:
    // - Stateless session management
    // - JWT authentication filter
    // - Public endpoint whitelist
    // - HTTPS/CORS
    // - CSRF disabled (stateless API)
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12); // Cost factor: 12
  }
}
```

**Configuration Details**:
- **Session**: Stateless (SESSION_CREATION_POLICY = STATELESS)
- **Password Encoder**: BCrypt with cost factor 12
- **Method Security**: Pre/post authorization enabled
- **CSRF**: Disabled for stateless API
- **Cors**: Custom CORS config per environment

### 2. JWT Filter Integration

**Filter Chain**:
```
Request
  ↓
SecurityFilterChain
  ├─ JwtAuthenticationFilter (custom)
  │   ├─ Extract JWT from Authorization header
  │   ├─ Validate signature & expiration
  │   ├─ Set Spring Security context
  │   └─ Store in UserContextHolder
  │
  ├─ UsernamePasswordAuthenticationFilter
  │   └─ (only for login endpoint)
  │
  └─ Other Spring Security filters...
```

### 3. Public Endpoints (No Auth Required)

```
/api/v1/auth/**          # All auth endpoints
/api/v1/oauth/**         # OAuth endpoints
/swagger-ui/**           # Swagger documentation
/v3/api-docs/**          # OpenAPI specs
/actuator/health         # Health check
/public/**               # Custom public endpoints
```

### 4. Application Configuration

**File**: `application.yml`

```yaml
jwt:
  secret: ${JWT_SECRET}                    # HMAC-SHA512 key
  expiration: 900000                       # 15 minutes
  refresh-expiration: 604800000            # 7 days

security:
  password:
    min-length: 8
    require-special-chars: true
  login:
    max-attempts: 5
    lockout-duration: 900000               # 15 minutes
  cors:
    allowed-origins: ${ALLOWED_ORIGINS}
    allowed-methods: GET,POST,PUT,DELETE,PATCH
    allowed-headers: '*'
    allow-credentials: true

oauth2:
  google:
    client-id: ${GOOGLE_CLIENT_ID}
    client-secret: ${GOOGLE_CLIENT_SECRET}
  facebook:
    app-id: ${FB_APP_ID}
    app-secret: ${FB_APP_SECRET}
```

---

## Key Components

### 1. JwtTokenProvider

**Location**: `JwtTokenProvider.java`

**Responsibilities**:
- Generate access tokens (15 min expiration)
- Generate refresh tokens (7 days expiration)
- Validate token signatures
- Extract claims from tokens
- Handle token expiration gracefully

**Methods**:
```java
String generateAccessToken(UserPrincipal user);
String generateRefreshToken(UserPrincipal user);
boolean validateToken(String token);
Claims extractAllClaims(String token);
String extractUsername(String token);
Date extractExpiration(String token);
```

### 2. CustomUserDetailsService

**Location**: `CustomUserDetailsService.java`

**Implements**: `UserDetailsService` interface

**Responsibilities**:
- Load user details by username
- Load user details by user ID
- Convert `Users` entity to `UserPrincipal`
- Support Spring Security authentication

**Methods**:
```java
UserDetails loadUserByUsername(String username);
UserDetails loadUserById(UUID userId);
```

### 3. JwtAuthenticationFilter

**Location**: `JwtAuthenticationFilter.java`

**Responsibilities**:
- Intercept HTTP requests
- Extract JWT from Authorization header
- Validate token
- Set Spring Security context
- Store user in ThreadLocal via UserContextHolder
- Skip authentication for public endpoints

**Key Features**:
- Graceful error handling
- Request context preservation
- User context holder integration
- Public endpoint whitelist

### 4. PrincipalManager

**Location**: `PrincipalManager.java`

**Responsibilities**:
- Core authorization/permission checking
- Tenant validation
- Role resolution
- Permission evaluation
- Granular permission checks (CREATE, VIEW, EDIT, DELETE)

**Usage**:
```java
@PreAuthorize("@principalManager.checkPermission("
              "#token, 'INVOICE', 'CREATE', #companyId)")
public ResponseEntity<?> createInvoice(...) {
  // Method body
}
```

### 5. UserContextHolder

**Location**: `UserContextHolder.java`

**Purpose**: ThreadLocal-based context holder

**Usage**:
```java
// In request context
Users currentUser = UserContextHolder.getUser();
UUID userId = UserContextHolder.getUserId();
String username = UserContextHolder.getUsername();

// Clear after request
UserContextHolder.clear();
```

**Benefits**:
- Avoid passing user through method parameters
- Request-scoped user context
- Spring Security integration
- Service layer accessibility

### 6. UserPrincipal

**Location**: `UserPrincipal.java`

**Implements**: Spring Security `UserDetails` interface

**Properties**:
```java
UUID userId;
String username;
String email;
String firstName;
String lastName;
boolean accountNonExpired;
boolean accountNonLocked;
boolean credentialsNonExpired;
boolean enabled;
List<GrantedAuthority> authorities;
```

---

## Data Flow Diagrams

### 1. Login & Token Generation Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ POST /api/v1/auth/login
       │ {username, password}
       ↓
┌──────────────────┐
│  AuthController  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│ AuthServiceImpl   │────→ UsersRepository.findByUsername()
└──────┬───────────┘
       │
       ├─→ BCrypt verify password
       │
       ↓
┌──────────────────┐
│ JwtTokenProvider │
└──────┬───────────┘
       │
       ├─→ generateAccessToken() → JWT (15 min)
       ├─→ generateRefreshToken() → JWT (7 days)
       │
       ↓
┌──────────────────────┐
│ RefreshTokenRepo     │
└──────┬───────────────┘
       │ Save refresh token with expiration
       │
       ↓
┌──────────────────┐
│ Return Response  │
├──────────────────┤
│ access_token:    │
│ refresh_token:   │ (HTTP-only cookie)
└──────────────────┘
```

### 2. Request Authorization Flow

```
┌────────────────────┐
│ Client Request     │
│ Authorization:     │
│ Bearer <JWT>       │
└─────────┬──────────┘
          │
          ↓
┌─────────────────────────────────┐
│ JwtAuthenticationFilter          │
├─────────────────────────────────┤
│ 1. Extract JWT                  │
│ 2. Validate signature           │
│ 3. Check expiration             │
└─────────┬───────────────────────┘
          │
          ↓
┌─────────────────────────────────┐
│ UserPrincipal created           │
│ from JWT claims                 │
└─────────┬───────────────────────┘
          │
          ↓
┌─────────────────────────────────┐
│ Spring Security Context         │
│ set with UserPrincipal          │
└─────────┬───────────────────────┘
          │
          ↓
┌─────────────────────────────────┐
│ UserContextHolder               │
│ store user in ThreadLocal       │
└─────────┬───────────────────────┘
          │
          ↓
┌─────────────────────────────────┐
│ Controller Method               │
│ @PreAuthorize("...")            │
└─────────┬───────────────────────┘
          │
          ↓
┌─────────────────────────────────┐
│ PrincipalManager.checkPermission()
├─────────────────────────────────┤
│ 1. Extract roles from JWT       │
│ 2. Query RolePermissionMapping  │
│ 3. Validate permission flags    │
│ 4. Return true/false            │
└─────────┬───────────────────────┘
          │
     ┌────┴────────────┐
     │                 │
    YES               NO
     │                 │
     ↓                 ↓
  Execute         401/403 Error
  Method          Response
```

### 3. Token Refresh Flow

```
┌──────────────────┐
│ Access Token     │
│ (expired)        │
└─────────┬────────┘
          │
          ↓
┌──────────────────────┐
│ POST /api/v1/auth/   │
│ refresh              │
│ + Refresh Token      │
│ (in cookie)          │
└─────────┬────────────┘
          │
          ↓
┌──────────────────────────┐
│ JwtAuthenticationFilter  │
│ Extract refresh token    │
└─────────┬────────────────┘
          │
          ↓
┌──────────────────────────┐
│ RefreshTokenRepository   │
│ Validate:                │
│ • Not revoked            │
│ • Not expired            │
│ • Is active              │
└─────────┬────────────────┘
          │
     ┌────┴─────────┐
     │              │
   Valid         Invalid
     │              │
     ↓              ↓
New JWT         401 Error
(15 min)
```

---

## API Endpoints

### Authentication Endpoints

#### 1. Register User
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe"
}

Response (201):
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john.doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2026-03-30T10:00:00Z"
}
```

#### 2. Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "john.doe",
  "password": "SecurePass@123"
}

Response (200):
{
  "accessToken": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john.doe",
    "email": "john@example.com"
  }
}

Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict
```

#### 3. Refresh Token
```
POST /api/v1/auth/refresh
Authorization: Bearer <access_token>

Response (200):
{
  "accessToken": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

#### 4. Logout
```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>

Response (200):
{
  "message": "Logged out successfully"
}
```

#### 5. Forgot Password
```
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}

Response (200):
{
  "message": "Password reset link sent to email"
}
```

#### 6. Reset Password
```
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass@123"
}

Response (200):
{
  "message": "Password reset successfully"
}
```

### Role Management Endpoints

#### 1. Create Role
```
POST /api/v1/roles
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "companyGuuid": "company-uuid",
  "code": "ROLE_MANAGER",
  "roleName": "Manager",
  "description": "Department manager role"
}

Response (201):
{
  "id": "role-uuid",
  "code": "ROLE_MANAGER",
  "roleName": "Manager",
  "description": "Department manager role",
  "isActive": true
}
```

#### 2. Get All Company Roles
```
GET /api/v1/roles?companyGuuid=<uuid>
Authorization: Bearer <access_token>

Response (200):
{
  "roles": [
    {
      "id": "role-uuid-1",
      "code": "ROLE_ADMIN",
      "roleName": "Administrator",
      "description": "System administrator"
    },
    ...
  ],
  "total": 5
}
```

#### 3. Assign Role to User
```
POST /api/v1/roles/assign-user
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "userGuuid": "user-uuid",
  "roleGuuid": "role-uuid",
  "companyGuuid": "company-uuid"
}

Response (201):
{
  "message": "Role assigned successfully"
}
```

#### 4. Set Role Permissions
```
POST /api/v1/roles/permissions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "roleGuuid": "role-uuid",
  "entityCode": "INVOICE",
  "canView": true,
  "canCreate": true,
  "canEdit": true,
  "canDelete": false,
  "allow": true
}

Response (201):
{
  "id": "mapping-uuid",
  "role": "Manager",
  "entity": "INVOICE",
  "permissions": {
    "canView": true,
    "canCreate": true,
    "canEdit": true,
    "canDelete": false
  }
}
```

---

## Security Features

### 1. Password Security

- **Hashing**: BCrypt with cost factor 12
- **Minimum Length**: 8 characters
- **Special Characters**: Required (!@#$%^&*)
- **No Reuse**: Previous passwords tracked
- **Expiration**: Optional (configurable per company)

### 2. Account Protection

- **Failed Login Tracking**: Counts failed attempts
- **Account Lockout**: 15 minutes after 5 failed attempts
- **IP Tracking**: Optional IP-based restrictions
- **Device Fingerprinting**: Optional multi-device tracking
- **Login Notifications**: Email alerts on new device login

### 3. Token Security

**Access Tokens**:
- Short-lived (15 minutes)
- Cannot be refreshed directly
- Stored in memory (not localStorage)
- Invalidated on logout

**Refresh Tokens**:
- Long-lived (7 days)
- HTTP-only cookies (prevents XSS)
- Secure flag (HTTPS only)
- SameSite=Strict (CSRF protection)
- Can be revoked
- Rotated on refresh

### 4. Session Security

- **Stateless**: No server-side sessions
- **ThreadLocal Context**: Request-scoped user data
- **CSRF Protection**: SameSite cookies + token validation
- **XSS Protection**: HTTP-only cookies, content security headers

### 5. Transport Security

- **HTTPS Enforcement**: All authenticated requests require HTTPS
- **Certificate Pinning**: Optional for mobile apps
- **TLS 1.2+**: Minimum TLS version
- **Cipher Suites**: Strong cipher suites only

### 6. Data Protection

- **Encryption at Rest**: Database-level encryption
- **Encryption in Transit**: TLS/HTTPS
- **Sensitive Data Masking**: Logs don't contain passwords
- **Audit Logging**: All auth operations logged
- **PII Protection**: GDPR/CCPA compliance features

### 7. Authorization Controls

- **Multi-Tenant Isolation**: Strict tenant validation
- **Role-Based Access**: RBAC with granular permissions
- **Entity-Level Permissions**: Control per application entity
- **Country/Region Scoping**: Optional geographic restrictions
- **Time-Based Access**: Optional access windows

### 8. Monitoring & Alerts

- **Suspicious Activity Detection**: Multiple failed logins, unusual access patterns
- **Real-Time Alerts**: Email/SMS on security events
- **Audit Trail**: All authentication/authorization events logged
- **Analytics**: Login trends, permission usage patterns

---

## Implementation Best Practices

### 1. For Controllers

```java
@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

  @GetMapping("/{id}")
  @PreAuthorize("@principalManager.checkPermission(#token, 'INVOICE', 'VIEW', #companyId)")
  public ResponseEntity<InvoiceDTO> getInvoice(
      @PathVariable UUID id,
      @RequestHeader("Authorization") String token,
      @RequestParam UUID companyId
  ) {
    // Use UserContextHolder for current user
    Users currentUser = UserContextHolder.getUser();
    return ResponseEntity.ok(invoiceService.getById(id, companyId));
  }
}
```

### 2. For Services

```java
@Service
public class InvoiceService {

  public InvoiceDTO createInvoice(InvoiceCreateRequest request, UUID companyId) {
    // User already authorized at controller level
    // Use UserContextHolder if needed
    Users creator = UserContextHolder.getUser();

    Invoice invoice = new Invoice();
    invoice.setCreatedBy(creator.getId());
    invoice.setCompanyId(companyId);

    return invoiceRepository.save(invoice);
  }
}
```

### 3. For Permission Checks in Services

```java
@Service
public class ReportService {

  @Autowired
  private PrincipalManager principalManager;

  public Report generateReport(UUID reportId, String token) {
    // Additional authorization check if needed
    boolean hasAccess = principalManager.checkPermission(
        token,
        "REPORT",
        "VIEW",
        UserContextHolder.getCompanyId()
    );

    if (!hasAccess) {
      throw new AccessDeniedException("No permission to view report");
    }

    return reportRepository.findById(reportId).orElse(null);
  }
}
```

### 4. For Securing Sensitive Operations

```java
@PostMapping("/sensitive-operation")
@PreAuthorize("@principalManager.checkPermission(#token, 'SENSITIVE_OP', 'ALLOW', #companyId)")
public ResponseEntity<?> performSensitiveOperation(
    @RequestHeader("Authorization") String token,
    @RequestParam UUID companyId,
    @RequestBody SensitiveRequest request
) {
  // Operation only executes if permission verified
  // Token automatically parsed and validated
  return ResponseEntity.ok(service.execute(request));
}
```

---

## Summary

The authentication and authorization system is built on:

1. **JWT-based Authentication**: Stateless, scalable, with short-lived access tokens and long-lived refresh tokens
2. **Role-Based Access Control (RBAC)**: Multi-tenant, role-to-user mappings, company-scoped permissions
3. **Granular Permissions**: Entity-level control with specific permission flags (CREATE, VIEW, EDIT, DELETE)
4. **Spring Security Integration**: Standard Spring mechanisms for authentication and authorization
5. **Security Best Practices**: Password hashing, account lockout, token management, HTTPS enforcement
6. **Audit & Monitoring**: Comprehensive logging of all auth-related events

This architecture provides enterprise-grade security while maintaining developer-friendly APIs and flexibility for scaling across multiple companies and applications.
