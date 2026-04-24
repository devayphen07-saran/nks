# Ayphen Identifier Strategy — guuid vs userId vs iamUserId

**Date:** 2026-04-22  
**Source:** Deep analysis of `/Users/saran/ayphen/projects/src` (Java/Spring Boot)  
**Purpose:** Understand when/where each type of identifier is used and why.

---

## The Three Identifiers

Every entity in the Ayphen system carries up to three distinct identifiers. Each serves a different boundary.

| Identifier | Type | Defined In | Purpose |
|---|---|---|---|
| `id` | `Long` (auto-increment) | Every entity via `@GeneratedValue(IDENTITY)` | Internal DB primary key; FK joins |
| `guuid` | `UUID` | `BaseEntity` (inherited by all entities) | External/public-facing; globally unique; non-updatable |
| `iamUserId` | `String` (UUID string) | `Users` entity only | IAM auth context; links user record to identity provider |

---

## BaseEntity — The Root of All Entities

Every entity extends `BaseEntity` which provides:

```java
@Column(unique = true, updatable = false)
private UUID guuid = UUID.randomUUID();   // generated at object creation

@Column(name = "created_by")
private Long createdBy;                   // numeric user ID — who created this

@Column(name = "modified_by")
private Long modifiedBy;                  // numeric user ID — who last modified
```

Key facts:
- `guuid` is set on Java object creation, before the DB sees it
- `createdBy` / `modifiedBy` store **numeric IDs**, not UUIDs
- `id` is DB-generated (IDENTITY strategy) — unavailable until after `INSERT`

---

## Users Entity (Special Case)

`Users` has an extra field beyond the BaseEntity pattern:

```java
@Id @GeneratedValue(strategy = IDENTITY)
private Long id;               // DB PK

private UUID guuid;            // inherited — globally unique user record ID

@Column(name = "iam_user_id")
private String iamUserId;      // UUID.randomUUID().toString() — IAM system identity
```

`iamUserId` exists because a user's **IAM identity** (who they authenticate as) is deliberately decoupled from their **record identity** (`guuid`). This allows:
- Users to be re-provisioned or migrated while preserving their auth identity
- IAM lookups without exposing the internal DB guuid

---

## The Design Rule

```
External boundary (API request/response, JWT claims)  →  guuid / iamUserId
Internal boundary (DB queries, FK joins, audit trail) →  numeric id
Auth/session context (who is calling)                 →  iamUserId (Users only)
```

### JWT Claims — All Three Packed In

```java
claims.put("userId",    user.getId());               // Long  — numeric
claims.put("userGuuid", user.getGuuid().toString());  // UUID  — string form
claims.put("iamUserId", user.getIamUserId());         // IAM UUID string
```

Token subject is `username` (email/phone), not an ID.

---

## Repository Query Patterns

Two parallel query families exist for the same entity:

```java
// API-facing — UUID-based
Optional<Users> findByGuuidAndIsActiveTrue(UUID uuid);
Optional<Users> findByIamUserIdAndIsActiveTrue(String iamUserId);

// Internal — numeric-based
Optional<Users> findByIdAndIsActiveTrue(Long userRecordId);

// Multi-tenant — mixes Company UUID + IAM string
Optional<CompanyUser> findByCompanyGuuidAndUserIamUserIdAndIsActiveTrue(UUID tenantId, String iamUserId);
```

FK relationships always use the numeric `id` at the DB level even if the query arrives via UUID.

---

## DTO Exposure

Almost every DTO exposes **both** identifiers:

```java
// CompanyDTO, RolesDTO, UserPermissionMapDTO, etc.
private Long id;      // numeric — always present
private UUID guuid;   // UUID — always present
```

Clients can use either. This is for backward compatibility — older integrations that had the numeric ID before UUIDs were added still work.

---

## Audit Trail

`BaseEntity.createdBy` / `modifiedBy` use **numeric user IDs only**.

This means:
- Audit logs cross-reference `Users.id` (not `Users.guuid`)
- To resolve "who created this" from an audit log you need the numeric user ID, not the UUID
- There is no UUID in the audit trail — numeric only

---

## Controller / API Exposure (Inconsistency)

The intended rule is UUIDs on all public API paths. In practice, controllers are mixed:

```java
// UUID-based (correct pattern)
@PathVariable UUID groupGuuid
@PathVariable UUID tenantId
@PathVariable UUID customerId

// Numeric (legacy / inconsistency)
@PathVariable("categoryId") Long categoryId
@PathVariable Long productId
@PathVariable("id") Long id
```

No enforced convention — older controllers use numeric, newer ones use UUID.

---

## DTO Inconsistencies

Most DTOs type `guuid` as `UUID`. A few older ones use `String`:

| DTO | Type of guuid | Issue |
|---|---|---|
| `CompanyDTO` | `UUID` | Correct |
| `RolesDTO` | `UUID` | Correct |
| `BundleProductsViewDTO` | `String` | Inconsistent |
| `ProductDTO` | `String` | Inconsistent |

---

## Summary — When to Use Which

| Situation | Use |
|---|---|
| DB FK column | `id` (numeric) |
| Audit trail (`createdBy`, `modifiedBy`) | `id` (numeric) |
| Repository query from API input | `guuid` or `iamUserId` |
| JWT claim — resource owner | `userGuuid` |
| JWT claim — calling user identity | `iamUserId` |
| API path param (best practice) | `guuid` |
| API response field | both `id` + `guuid` (current practice) |
| Multi-tenant isolation | Company `guuid` |

---

## Relevance to NKS

NKS (the NestJS backend in this monorepo) follows a similar split:

- Numeric `id` internally (Drizzle ORM, FK columns named `*_fk`)
- `guuid` (TEXT, UUID string) exposed on public-facing responses and API paths
- Session/auth context carries numeric `userId` in the JWT payload (from `req.user.userId`)

The main difference: NKS does **not** have a separate `iamUserId` — the session token itself is the IAM handle. The `guuid` on the `user` table serves as the external identity.
