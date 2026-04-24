# Ayphen → NKS Gap Analysis

**Date:** 2026-04-22  
**Purpose:** What NKS can adopt from Ayphen's battle-tested Java/Spring Boot codebase — fields, flows, and patterns.

---

## TL;DR

NKS is already **ahead of Ayphen** in most areas (RS256 JWT, per-table soft-delete, append-only audit log, device fingerprinting, offline sync). There are **4 concrete gaps** to close and **5 field additions** worth adding.

---

## 1. What Ayphen Has → What NKS Has (Feature Parity Matrix)

| Ayphen Feature           | Ayphen Implementation                                                          | NKS Equivalent                                          | Status        |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------- |
| Brute-force protection   | `failedLoginAttempts`, `accountLockedUntil` on Users                           | Same fields on `users` table                            | ✅ DONE       |
| Email verification       | `isVerified` + `/auth/verify-email` endpoint                                   | `emailVerified` boolean on `users`                      | ✅ DONE       |
| Session tracking         | `UserSession` entity (deviceInfo, ipAddress)                                   | `user_session` table with full device fingerprint       | ✅ NKS BETTER |
| Refresh token storage    | `RefreshToken` entity with `isRevoked`                                         | `refreshTokenRevokedAt` + `revokedReason` on sessions   | ✅ NKS BETTER |
| Pagination               | `PaginationRequest` / `PaginationResponse` (1-indexed)                         | `PaginationQuery` + `ApiResponse.paginated()`           | ✅ DONE       |
| Staff invitations        | `Invitation` entity (sent/accepted/rejected/revoked/expired)                   | `staff_invite` table with token + status lifecycle      | ✅ DONE       |
| Role permissions         | `RolePermissionMapping` (canView/canCreate/canEdit/canDelete/allow)            | `role_entity_permission` (same flags + canExport)       | ✅ NKS BETTER |
| User-to-location mapping | `UserLocationMapping` (user → company location)                                | `store_user_mapping` (user → store, with designationFk) | ✅ DONE       |
| General audit log        | `ActivityLog` (prefix/suffix change tracking)                                  | `audit_log` (oldValues/newValues as JSONB)              | ✅ NKS BETTER |
| CreatedBy/ModifiedBy     | `BaseEntity.createdBy`, `modifiedBy`                                           | `auditFields()` adds createdBy/modifiedBy/deletedBy     | ✅ DONE       |
| User profile             | `UserProfile.bio/website/socialLinks`                                          | `user_preferences` (theme, timezone, notifications)     | ⚠️ PARTIAL    |
| Profile completion       | `getProfileCompletion()` returns percentage DTO                                | `profileCompleted: boolean` only                        | ⚠️ GAP        |
| API response wrapper     | `CustomResponse<T>` (success, statusCode, errorCode, message, body, timestamp) | `ApiResponse<T>` (same fields + details, meta)          | ✅ NKS BETTER |
| Password reset flow      | `/auth/forgot-password` + `/auth/reset-password`                               | Exists in OTP service                                   | ✅ DONE       |
| Soft delete              | `isActive` flag                                                                | `deletedAt` timestamp (richer — captures when)          | ✅ NKS BETTER |
| Multi-tenant isolation   | `Company` as tenant, `tenant-ids` JWT claim                                    | `Store` as tenant, `activeStoreId` in session           | ✅ DONE       |
| Re-invite                | `reInviteEmployee()` endpoint                                                  | Not found                                               | ❌ GAP        |
| Ownership transfer       | `transferCompany()` endpoint                                                   | Not found                                               | ❌ GAP        |
| Permission `allow` flag  | `RolePermissionMapping.allow` (master gate)                                    | No equivalent master gate                               | ❌ GAP        |
| Profile sub-fields       | User: `gender`, `dateOfBirth`, `referralCode`                                  | Not on user record                                      | ⚠️ CONSIDER   |

---

## 2. Where NKS is Already Better Than Ayphen

### JWT Security

- **Ayphen:** HS512 with shared secret (`jwt.secret` in yml). Any server that knows the secret can forge tokens.
- **NKS:** RS256 asymmetric. Private key signs (backend only). Public key verifies (mobile can verify offline). Cannot be forged without the private key.

### Session Revocation

- **Ayphen:** Refresh token stored in DB, checked on each refresh call. Access tokens live until natural expiry (~15 min).
- **NKS:** JTI blocklist (`jti_blocklist` table) + refresh token revocation with reason (`ROTATION`, `TOKEN_REUSE`, `LOGOUT`, `PASSWORD_CHANGE`, `ADMIN_FORCE_LOGOUT`). Immediate invalidation of access tokens too.

### Audit Log

- **Ayphen:** `ActivityLog` with `prefix1/2`, `suffix1/2` (before/after as separate lookup rows). Complex to query.
- **NKS:** `audit_log` with `oldValues JSONB`, `newValues JSONB`, `ipAddress INET`, `userAgent TEXT`, `deviceId`, `isSuccess`, `failureReason`. Append-only. Richer and easier to query.

### Device Fingerprinting

- **Ayphen:** Stores raw `deviceInfo: String` on UserSession.
- **NKS:** Stores `ipHash` (HMAC-SHA256), `roleHash`, `deviceId`, `deviceName`, `deviceType`, `platform`, `appVersion`. Can detect IP changes, role changes, device swaps.

### Offline Sync

- **Ayphen:** No offline capability. Pure REST.
- **NKS:** Custom pull+push sync engine with expo-sqlite, compound cursor, idempotency keys, mutation queue with retry/quarantine.

---

## 3. Concrete Gaps — What to Adopt from Ayphen

### GAP 1: Re-invite Staff (`reInviteEmployee`)

**What Ayphen has:**  
When an invitation expires or was rejected, the manager can re-invite without creating a new invitation from scratch. Status resets to PENDING, expiry extended.

**What NKS needs:**

```
PATCH /stores/:storeGuuid/invitations/:inviteToken/resend
```

- Check invite status is `EXPIRED` or `REVOKED`
- Reset `status → PENDING`
- Generate new `token`
- Set `expiresAt = now + 7 days`
- Re-send email

**Files to update:**

- `staff-invite.table.ts` — already has the fields
- Add `resendInvitation()` in the staff invite service
- Add controller endpoint

---

### GAP 2: Store Ownership Transfer (`transferCompany`)

**What Ayphen has:**  
`POST /companies/:tenantId/transfer` — current owner transfers company to another user. The new owner gets OWNER role, old owner reverts to MANAGER (or leaves).

**What NKS needs:**

```
POST /stores/:storeGuuid/transfer
Body: { newOwnerGuuid: string }
```

- Guard: current user must be STORE_OWNER of that store
- Verify newOwnerGuuid is an active member of the store
- Swap `store.ownerFk` (if that field exists) OR update role mappings
- Audit log the transfer

**Files to create/update:**

- Add endpoint in `stores.controller.ts`
- Add `transferOwnership()` in `stores.service.ts`

---

### GAP 3: `isAllowed` Master Permission Gate

**What Ayphen has:**  
`RolePermissionMapping.allow` — a master gate that controls whether the role has any access to an entity at all, before checking canView/canCreate/canEdit/canDelete. If `allow = false`, the role is explicitly denied even if individual flags are true.

**What NKS needs:**  
Add `isDenied: boolean DEFAULT false` to `role_entity_permission` table. When `isDenied = true`, the entity is blocked regardless of other flags. This enables "deny-by-exception" policies (e.g., a manager role that normally has full access but is explicitly denied one entity).

NKS already has this modeled in `PermissionsSnapshot`:

```ts
[entityCode: string]: {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deny?: boolean;  // ← already exists but not persisted
}
```

**Action:** Add `isDenied boolean DEFAULT false` column to `role_entity_permission` and wire it through the permission-checking pipeline.

---

### GAP 4: Profile Completion Percentage

**What Ayphen has:**  
`getProfileCompletion()` returns a `ProfileCompletionDTO`:

```java
{
  totalFields: int,
  completedFields: int,
  completionPercentage: double,  // 0.0 – 100.0
  missingFields: List<String>
}
```

**What NKS has:**  
Only `profileCompleted: boolean`. No granularity on what's missing.

**What NKS needs:**

```
GET /users/me/profile-completion
→ { percentage: number, missingFields: string[], isComplete: boolean }
```

Fields to check: `name`, `email`, `phoneNumber`, `emailVerified`, `phoneNumberVerified`, `image`, `kycLevel >= 1`

**Files to create/update:**

- Add method in `auth-users.service.ts` (or a new profile service)
- Add route in `auth.controller.ts`

---

## 4. Optional Field Additions (Low Priority)

These Ayphen fields don't exist in NKS but are worth considering based on product roadmap:

| Field                | Ayphen Entity             | Add to NKS?                 | Note                             |
| -------------------- | ------------------------- | --------------------------- | -------------------------------- |
| `gender`             | `Users.gender` (lookup)   | Maybe                       | Needed for KYC Level 2           |
| `dateOfBirth`        | `Users.dateOfBirth`       | Maybe                       | Needed for KYC Level 2           |
| `referralCode`       | `Users.referralCode`      | Yes                         | Growth/referral feature          |
| `bio` / `website`    | `UserProfile.bio/website` | No                          | Not relevant for retail staff    |
| `socialLinks`        | `UserProfile.socialLinks` | No                          | Not relevant for retail staff    |
| `timezone` on User   | `Users.timezone`          | Already in user_preferences | OK as-is                         |
| `InvitationLocation` | Sub-entity of Invitation  | Maybe                       | If stores have multiple branches |

### Recommendation for KYC Level 2:

Add `gender` (lookup FK) and `dateOfBirth` (date) directly to the `users` table alongside the existing KYC fields (`kycLevel`, `isBlocked`). Do not create a separate `UserProfile` entity — NKS already uses `user_preferences` for extensible fields.

---

## 5. Patterns NKS Should NOT Copy from Ayphen

| Ayphen Pattern                             | Why NOT to Copy                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| HS512 JWT with shared secret               | RS256 is superior for mobile (offline verification without secret exposure) |
| ThreadLocal for user context               | Not safe in async/reactive contexts. NKS's `request.user` is cleaner        |
| `isActive` soft-delete                     | `deletedAt` timestamp captures WHEN it was deleted. Use what NKS has.       |
| ActivityLog prefix/suffix lookup rows      | JSONB oldValues/newValues is simpler and queryable                          |
| ApplicationEntity hierarchy (parent-child) | Over-engineered for NKS's scale. Route-based permission system is cleaner.  |
| Company-as-tenant in JWT claims            | Store-as-tenant is correct for NKS's multi-store model                      |
| 1-indexed pagination                       | Already using 1-indexed in NKS's PaginationQuery — consistent               |

---

## Implementation Priority

| Priority | Item                              | Effort                              | Impact                                |
| -------- | --------------------------------- | ----------------------------------- | ------------------------------------- |
| HIGH     | GAP 3: `isDenied` permission flag | Small (add 1 column + wire through) | High (enables deny-by-exception)      |
| HIGH     | GAP 1: Re-invite staff            | Medium (endpoint + email re-send)   | High (UX: expired invites are common) |
| MEDIUM   | GAP 4: Profile completion %       | Small (calculation only, no schema) | Medium (onboarding flow)              |
| MEDIUM   | GAP 2: Store ownership transfer   | Medium (endpoint + role swap)       | Medium (operations team need)         |
| LOW      | `referralCode` on users           | Tiny (1 column)                     | Low (future growth feature)           |
| LOW      | `gender`/`dateOfBirth` on users   | Small (2 columns)                   | Low (KYC Level 2 only)                |
