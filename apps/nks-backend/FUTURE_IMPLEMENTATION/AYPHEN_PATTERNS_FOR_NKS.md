# Ayphen Patterns for NKS Implementation Guide

**Date:** April 29, 2026  
**Purpose:** Detailed specification for implementing Ayphen architectural patterns into NKS  
**Target:** Enhance NKS maturity from 9.35/10 to 9.8+/10 by adopting proven Ayphen patterns  
**Effort Estimate:** 4-6 weeks total (prioritized phases)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Comparative Analysis](#comparative-analysis)
3. [Pattern 1: Persistent Audit Trail](#pattern-1-persistent-audit-trail)
4. [Pattern 2: Base Entity Audit Fields](#pattern-2-base-entity-audit-fields)
5. [Pattern 3: CustomResponse API Wrapper](#pattern-3-customresponse-api-wrapper)
6. [Pattern 4: Service Interface Contracts](#pattern-4-service-interface-contracts)
7. [Pattern 5: Comprehensive Exception Hierarchy](#pattern-5-comprehensive-exception-hierarchy)
8. [Pattern 6: Service-Level Authorization](#pattern-6-service-level-authorization)
9. [Pattern 7: DTO Transformation Mappers](#pattern-7-dto-transformation-mappers)
10. [Pattern 8: Query Projections](#pattern-8-query-projections)
11. [Pattern 9: Business Rule Validators](#pattern-9-business-rule-validators)
12. [Pattern 10: Enhanced Event Handling](#pattern-10-enhanced-event-handling)
13. [Implementation Roadmap](#implementation-roadmap)
14. [Testing Strategy](#testing-strategy)
15. [Migration Checklist](#migration-checklist)

---

## Executive Summary

### Current State (NKS)
- **Architecture Score:** 9.35/10
- **Strengths:** Excellent modular design, focused repositories, explicit service segregation
- **Gaps:** 
  - Event-driven logging only (no persistent audit trail)
  - No base entity pattern for audit fields
  - Raw API responses without wrapping
  - Implicit service contracts (no interfaces)
  - Ad-hoc exception handling

### Target State (Post-Implementation)
- **Architecture Score:** 9.8+/10
- **Gains:**
  - Persistent audit trail for compliance
  - Automatic audit fields on all entities
  - Standardized API responses
  - Explicit service contracts
  - Comprehensive exception hierarchy
  - Production-grade security validation

### ROI Analysis
| Aspect | Effort | Impact | Payoff |
|--------|--------|--------|--------|
| Persistent Audit | 2-3 days | 10/10 | Compliance, debugging, forensics |
| Audit Fields | 2 days | 9/10 | Data governance, change tracking |
| Tenant Validation | 1-2 days | 9/10 | Security, data isolation |
| Response Wrapper | 1 day | 8/10 | API consistency, i18n support |
| Exception Hierarchy | 1-2 days | 8/10 | Error handling, debugging |
| Service Interfaces | 2-3 days | 7/10 | Testability, loose coupling |
| Other Patterns | 4-5 days | 6-7/10 | Polish, maintainability |
| **TOTAL** | **4-6 weeks** | **8.9/10 avg** | **9.8+/10 final** |

---

## Comparative Analysis

### Architecture Foundation Comparison

#### NKS (Current)
```
┌─────────────────────────────────────────┐
│ AuthModule (44 providers → 25 reduced)   │
├─────────────────────────────────────────┤
│ ├─ OtpModule (4 services)               │
│ ├─ SessionModule (9 services)           │
│ │  ├─ SessionRepository (CRUD)          │
│ │  ├─ SessionTokenRepository (Tokens)   │
│ │  ├─ SessionRevocationRepository       │
│ │  └─ SessionContextRepository (JOINs)  │
│ └─ TokenModule (6 services)             │
├─────────────────────────────────────────┤
│ Strengths:                              │
│ ✓ Explicit repository segregation       │
│ ✓ Clear service responsibilities        │
│ ✓ Command/Query separation              │
│ ✓ Type-safe Drizzle ORM                 │
│ ✓ Advisory locks for concurrency        │
│                                         │
│ Gaps:                                   │
│ ✗ No persistent audit trail             │
│ ✗ No base entity pattern                │
│ ✗ Raw API responses                     │
│ ✗ Implicit service contracts            │
│ ✗ Ad-hoc exception handling             │
└─────────────────────────────────────────┘
```

#### Ayphen (Reference)
```
┌─────────────────────────────────────────┐
│ Spring Boot Traditional Layered          │
├─────────────────────────────────────────┤
│ ├─ Controller (@RestController)         │
│ ├─ Service (@Service with interfaces)   │
│ ├─ Repository (JpaRepository + custom)  │
│ ├─ Entity (@Entity with inheritance)    │
│ └─ Mapper (@Mapper with MapStruct)      │
├─────────────────────────────────────────┤
│ Strengths:                              │
│ ✓ Persistent ActivityLog table          │
│ ✓ BaseEntity with audit fields          │
│ ✓ CustomResponse<T> wrapper             │
│ ✓ Service interfaces as contracts       │
│ ✓ Comprehensive exception hierarchy     │
│ ✓ Service-level authorization           │
│ ✓ DTO mapper pattern                    │
│ ✓ Query projections                     │
│                                         │
│ Gaps:                                   │
│ ✗ Less explicit service segregation     │
│ ✗ Potential N+1 query issues            │
│ ✗ Heavier framework coupling            │
└─────────────────────────────────────────┘
```

### Layer-by-Layer Comparison

#### Repository Pattern

**NKS (Drizzle):**
```typescript
// 4 focused repositories for session operations
SessionRepository (CRUD)
  ├─ create()
  ├─ findById()
  ├─ update()
  └─ delete()

SessionTokenRepository (Token lifecycle)
  ├─ rotateToken() [CAS pattern]
  ├─ setRefreshTokenData()
  └─ findByTokenWithJtiCheck()

SessionRevocationRepository (Revocation)
  ├─ revokeSession()
  ├─ revokeAllForUser()
  └─ findJtisByUserId()

SessionContextRepository (Complex queries)
  ├─ findSessionAuthContext() [5-table JOIN]
  ├─ createWithinLimit() [advisory lock]
  └─ deleteExpired() [batch]
```

**Ayphen (JPA):**
```java
// Single repository with query methods
TransactionRepository extends JpaRepository + JpaSpecificationExecutor
  ├─ findById()
  ├─ findByStatusAndCompanyId()
  ├─ Custom @Query methods
  ├─ Specification-based queries
  └─ Pagination support

// Advantage: Dynamic queries via Specification API
// Disadvantage: Less explicit segregation
```

**Recommendation for NKS:** 
✓ Keep current Drizzle pattern (superior)  
✓ Add query projection methods (Ayphen borrowing)

#### Service Pattern

**NKS (Current):**
```typescript
SessionCommandService
  → injected: SessionRepository, SessionContextRepository, SessionRevocationRepository
  → methods: create(), delete(), revokeSession(), revokeAllForUser()

SessionQueryService
  → injected: SessionRepository
  → methods: findById(), findByUserId(), findActiveByUserId()

// Issue: No explicit interfaces, implicit contracts
```

**Ayphen (Recommended):**
```java
interface SessionService {
  Session createSession(User user, Map metadata);
  Session findById(Long sessionId);
  void revokeSession(Long sessionId, String reason);
}

class SessionServiceImpl implements SessionService {
  // Implementation with injected dependencies
}

// Benefit: Explicit contracts, testability, loose coupling
```

**Recommendation for NKS:**
✓ Add interfaces for SessionCommandService, SessionQueryService  
✓ Add interfaces for other critical services (AuthContextService, TokenService)

---

## Pattern 1: Persistent Audit Trail

### Problem Statement

**Current NKS Implementation:**
```typescript
// SessionRevocationListener (event-driven)
@Injectable()
export class SessionRevocationListener {
  @OnEvent('session.revoked')
  async handleSessionRevoked(event: SessionRevokedEvent) {
    console.log(`Session ${event.sessionId} revoked`);  // ← Only console, not persisted
    // No database record if listener fails
  }
}
```

**Issues:**
- ❌ Event listeners are transient (if listener crashes, no audit)
- ❌ No queryable history
- ❌ Cannot comply with SOX, GDPR audit requirements
- ❌ Debugging security incidents requires log files instead of database
- ❌ No visibility into who made what change when

### Solution Architecture

#### 1. Create ActivityLog Table

```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,                    -- LOGIN, CREATE_SESSION, ROTATE_TOKEN, REVOKE_SESSION
  entity_type VARCHAR(50) NOT NULL,                -- SESSION, TOKEN, USER, ROLE
  entity_id INT,                                   -- ID of affected entity
  details JSONB,                                   -- {sessionId: 123, reason: "logout", ipAddress: "..."}
  ip_address INET,                                 -- Request IP
  user_agent TEXT,                                 -- Browser/device info
  company_id INT NOT NULL REFERENCES stores(id),  -- Multi-tenancy
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indices for common queries
  CREATE INDEX idx_activity_user_id_created ON activity_logs(user_id, created_at DESC);
  CREATE INDEX idx_activity_action_created ON activity_logs(action, created_at DESC);
  CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
  CREATE INDEX idx_activity_company_created ON activity_logs(company_id, created_at DESC);
);
```

#### 2. Create ActivityLog Schema in Drizzle

**File:** `src/core/database/schema/audit/activity-log.table.ts`

```typescript
import { pgTable, serial, integer, varchar, jsonb, inet, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/users/users.table';
import { store } from '../store/store/store.table';

export const activityLog = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  details: jsonb('details'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  companyId: integer('company_id').notNull().references(() => store.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idxUser: index('idx_activity_user_id_created').on(table.userId, table.createdAt.desc()),
  idxAction: index('idx_activity_action_created').on(table.action, table.createdAt.desc()),
  idxEntity: index('idx_activity_entity').on(table.entityType, table.entityId),
  idxCompany: index('idx_activity_company_created').on(table.companyId, table.createdAt.desc()),
}));

export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
```

#### 3. Create ActivityLogRepository

**File:** `src/contexts/audit/repositories/activity-log.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../core/database/base.repository';
import * as schema from '../../../core/database/schema';
import type { NewActivityLog } from '../../../core/database/schema/audit/activity-log';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ActivityLogRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  /**
   * Log an activity - used by all services to create audit trail
   */
  async log(
    userId: number,
    action: string,
    entityType: string,
    entityId?: number,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
    companyId?: number,
  ): Promise<void> {
    await this.db.insert(schema.activityLog).values({
      userId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress as any,
      userAgent,
      companyId,
      createdAt: new Date(),
    });
  }

  /**
   * Find all activities for a user
   */
  async findByUserId(userId: number, limit = 100, offset = 0) {
    return await this.db
      .select()
      .from(schema.activityLog)
      .where(eq(schema.activityLog.userId, userId))
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find all activities for a company
   */
  async findByCompanyId(companyId: number, limit = 500, offset = 0) {
    return await this.db
      .select()
      .from(schema.activityLog)
      .where(eq(schema.activityLog.companyId, companyId))
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find activities by action type (e.g., "LOGIN", "REVOKE_SESSION")
   */
  async findByAction(action: string, companyId: number, limit = 100) {
    return await this.db
      .select()
      .from(schema.activityLog)
      .where(and(
        eq(schema.activityLog.action, action),
        eq(schema.activityLog.companyId, companyId),
      ))
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(limit);
  }

  /**
   * Find activities for a specific entity
   */
  async findByEntity(entityType: string, entityId: number, companyId: number) {
    return await this.db
      .select()
      .from(schema.activityLog)
      .where(and(
        eq(schema.activityLog.entityType, entityType),
        eq(schema.activityLog.entityId, entityId),
        eq(schema.activityLog.companyId, companyId),
      ))
      .orderBy(desc(schema.activityLog.createdAt));
  }

  /**
   * Find activities in date range (for compliance reports)
   */
  async findByDateRange(companyId: number, startDate: Date, endDate: Date, limit = 1000) {
    return await this.db
      .select()
      .from(schema.activityLog)
      .where(and(
        eq(schema.activityLog.companyId, companyId),
        gte(schema.activityLog.createdAt, startDate),
        lte(schema.activityLog.createdAt, endDate),
      ))
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(limit);
  }

  /**
   * Retention cleanup: delete logs older than N days
   */
  async deleteOlderThanDays(days: number = 365): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(schema.activityLog)
      .where(lte(schema.activityLog.createdAt, cutoffDate));
    return result.rowCount ?? 0;
  }
}
```

#### 4. Create AuditModule

**File:** `src/contexts/audit/audit.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { ActivityLogRepository } from './repositories/activity-log.repository';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  providers: [ActivityLogRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

#### 5. Create AuditService

**File:** `src/contexts/audit/services/audit.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ActivityLogRepository } from '../repositories/activity-log.repository';
import { TenantContextService } from '../../shared/services/tenant-context.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Log authentication event
   */
  async logLogin(userId: number, request: Request): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      'LOGIN',
      'USER',
      userId,
      {
        success: true,
        timestamp: new Date(),
      },
      request.ip,
      request.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Log logout event
   */
  async logLogout(userId: number, request: Request): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      'LOGOUT',
      'USER',
      userId,
      { timestamp: new Date() },
      request.ip,
      request.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Log session creation
   */
  async logSessionCreated(
    userId: number,
    sessionId: number,
    request: Request,
  ): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      'CREATE_SESSION',
      'SESSION',
      sessionId,
      { sessionId, createdAt: new Date() },
      request.ip,
      request.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Log session revocation
   */
  async logSessionRevoked(
    userId: number,
    sessionId: number,
    reason: string,
    request?: Request,
  ): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      'REVOKE_SESSION',
      'SESSION',
      sessionId,
      { sessionId, reason, revokedAt: new Date() },
      request?.ip,
      request?.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Log token rotation
   */
  async logTokenRotated(
    userId: number,
    sessionId: number,
    request?: Request,
  ): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      'ROTATE_TOKEN',
      'TOKEN',
      sessionId,
      { sessionId, rotatedAt: new Date() },
      request?.ip,
      request?.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(email: string, request: Request): Promise<void> {
    await this.activityLogRepository.log(
      0, // System user
      'FAILED_LOGIN',
      'USER',
      null,
      { email, reason: 'Invalid credentials' },
      request.ip,
      request.get('user-agent'),
      this.tenantContext.getTenantId(),
    );
  }

  /**
   * Generic log method for custom events
   */
  async log(
    userId: number,
    action: string,
    entityType: string,
    entityId: number | null,
    details?: any,
  ): Promise<void> {
    await this.activityLogRepository.log(
      userId,
      action,
      entityType,
      entityId || undefined,
      details,
      undefined,
      undefined,
      this.tenantContext.getTenantId(),
    );
  }
}
```

#### 6. Integrate into SessionRevocationRepository

**File:** `src/contexts/iam/auth/repositories/session-revocation.repository.ts` (Modified)

```typescript
import { Injectable } from '@nestjs/common';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import { AuditService } from '../../../../contexts/audit/services/audit.service';
import * as schema from '../../../../core/database/schema';
import type { UserSession } from '../../../../core/database/schema/auth/user-session';

@Injectable()
export class SessionRevocationRepository extends BaseRepository {
  constructor(
    @InjectDb() db: NodePgDatabase<typeof schema>,
    private readonly txService: TransactionService,
    private readonly auditService: AuditService,  // ← ADD THIS
  ) {
    super(db);
  }

  async revokeSession(
    sessionId: number,
    reason: string,
    jti?: string,
  ): Promise<void> {
    return this.txService.run(async (tx) => {
      // Get session before revocation for audit log
      const [session] = await tx
        .select()
        .from(schema.userSession)
        .where(eq(schema.userSession.id, sessionId));

      if (!session) return;

      // Revoke refresh token
      await tx
        .update(schema.userSession)
        .set({
          refreshTokenRevokedAt: new Date(),
          modifiedAt: new Date(),
        })
        .where(eq(schema.userSession.id, sessionId));

      // Add JTI to blocklist (atomic with revocation)
      if (jti) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await tx.insert(schema.jtiBlocklist).values({
          jti,
          expiresAt,
          companyId: session.companyId,
        });
      }

      // ← ADD AUDIT LOGGING
      await this.auditService.logSessionRevoked(
        session.userId,
        sessionId,
        reason,
      );
    }, { name: 'SessionRevocationRepo.revokeSession' });
  }

  async revokeAllForUser(
    userId: number,
    reason: string,
    jtis?: string[],
  ): Promise<void> {
    return this.txService.run(async (tx) => {
      // Get all sessions for audit
      const sessions = await tx
        .select()
        .from(schema.userSession)
        .where(eq(schema.userSession.userId, userId));

      // Revoke all sessions
      await tx
        .update(schema.userSession)
        .set({
          refreshTokenRevokedAt: new Date(),
          modifiedAt: new Date(),
        })
        .where(eq(schema.userSession.userId, userId));

      // Revoke all JTIs
      if (jtis && jtis.length > 0) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await tx.insert(schema.jtiBlocklist).values(
          jtis.map(jti => ({
            jti,
            expiresAt,
            companyId: sessions[0]?.companyId || 0,
          }))
        );
      }

      // ← ADD AUDIT LOGGING for each session
      for (const session of sessions) {
        await this.auditService.logSessionRevoked(
          session.userId,
          session.id,
          reason,
        );
      }
    }, { name: 'SessionRevocationRepo.revokeAllForUser' });
  }

  // ... rest of methods unchanged
}
```

### Implementation Checklist

- [ ] Create `activity_logs` table (schema migration)
- [ ] Create `activity-log.table.ts` in schema
- [ ] Create `activity-log.repository.ts`
- [ ] Create `audit.service.ts`
- [ ] Create `audit.module.ts` as @Global()
- [ ] Update `session-revocation.repository.ts` to inject AuditService
- [ ] Update `SessionRevocationListener` to use AuditService
- [ ] Create audit retention cleanup scheduler
- [ ] Add ActivityLog API endpoints for compliance reporting
- [ ] Test persistent logging with repository failure scenarios

### Benefits

✅ **Compliance:** SOX, GDPR, HIPAA audit trail  
✅ **Security:** Forensic investigation of breaches  
✅ **Debugging:** Complete session lifecycle history  
✅ **Analytics:** User behavior patterns, threat detection  
✅ **Queryable:** Database queries vs log file grepping  

---

## Pattern 2: Base Entity Audit Fields

### Problem Statement

**Current NKS:**
```typescript
// UserSession has no audit fields except createdAt
export const userSession = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  token: varchar('token', {length: 500}),
  createdAt: timestamp('created_at').defaultNow(),
  // Missing: createdBy, modifiedAt, modifiedBy, isActive, deletedAt
});
```

**Issues:**
- ❌ No tracking of who created/modified each record
- ❌ No soft-delete capability
- ❌ Hard to implement change tracking
- ❌ No standard audit pattern across entities

### Solution Architecture

#### 1. Create Base Fields Utility

**File:** `src/core/database/schema/base-fields.ts`

```typescript
import { timestamp, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Standard audit fields for all entities
 * Provides: createdBy, createdAt, modifiedBy, modifiedAt, isActive, deletedAt
 */
export const baseFields = {
  createdBy: integer('created_by'),                           // userId who created
  createdAt: timestamp('created_at').notNull().defaultNow(),  // Creation timestamp
  modifiedBy: integer('modified_by'),                         // userId who last modified
  modifiedAt: timestamp('modified_at').defaultNow(),          // Last modification timestamp
  isActive: boolean('is_active').default(true),               // Soft delete flag
  deletedAt: timestamp('deleted_at'),                         // When soft-deleted
};

/**
 * Create audit fields with references to users table
 */
export function createAuditFields(usersTable: any) {
  return {
    createdBy: integer('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    modifiedBy: integer('modified_by').references(() => usersTable.id, { onDelete: 'set null' }),
    modifiedAt: timestamp('modified_at').defaultNow(),
    isActive: boolean('is_active').default(true),
    deletedAt: timestamp('deleted_at'),
  };
}
```

#### 2. Update UserSession Table

**File:** `src/core/database/schema/auth/user-session/user-session.table.ts` (Modified)

```typescript
import { pgTable, serial, integer, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { createAuditFields } from '../../base-fields';
import { users } from '../users/users.table';

export const userSession = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  guuid: uuid('guuid').defaultRandom().unique(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer('company_id').notNull(),
  
  // Session data
  token: varchar('token', { length: 500 }).notNull().unique(),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).unique(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  refreshTokenRevokedAt: timestamp('refresh_token_revoked_at'),
  csrfSecret: varchar('csrf_secret', { length: 255 }),
  jti: varchar('jti', { length: 255 }).unique(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // Optional metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  activeStoreId: integer('active_store_id'),
  
  // ← ADD BASE AUDIT FIELDS
  ...createAuditFields(users),
  
}, (table) => ({
  idxUserId: index('idx_user_session_user_id').on(table.userId),
  idxToken: index('idx_user_session_token').on(table.token),
  idxActive: index('idx_user_session_is_active').on(table.isActive),
  idxCompanyId: index('idx_user_session_company_id').on(table.companyId),
}));

export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;
```

#### 3. Create BaseRepository Utilities

**File:** `src/core/database/base.repository.ts` (Extended)

```typescript
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import type { SQL } from 'drizzle-orm';

export abstract class BaseRepository {
  constructor(protected readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Soft delete: mark as inactive and set deletedAt
   */
  protected async softDelete(
    table: any,
    id: number,
    userId: number,
  ): Promise<void> {
    await this.db
      .update(table)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: userId,
        modifiedAt: new Date(),
      })
      .where(eq(table.id, id));
  }

  /**
   * Restore soft-deleted record
   */
  protected async restore(
    table: any,
    id: number,
    userId: number,
  ): Promise<void> {
    await this.db
      .update(table)
      .set({
        isActive: true,
        deletedAt: null,
        modifiedBy: userId,
        modifiedAt: new Date(),
      })
      .where(eq(table.id, id));
  }

  /**
   * Mark record as modified with current user
   */
  protected setModificationFields(userId: number) {
    return {
      modifiedBy: userId,
      modifiedAt: new Date(),
    };
  }

  /**
   * Set creation fields
   */
  protected setCreationFields(userId: number) {
    return {
      createdBy: userId,
      createdAt: new Date(),
    };
  }

  /**
   * Filter to exclude soft-deleted records
   */
  protected isActive(table: any): SQL {
    return isNull(table.deletedAt);
  }
}
```

#### 4. Update SessionRepository to Use Audit Fields

**File:** `src/contexts/iam/auth/repositories/session.repository.ts` (Modified)

```typescript
@Injectable()
export class SessionRepository extends BaseRepository {
  constructor(
    @InjectDb() db: NodePgDatabase<typeof schema>,
    private readonly userContextService: UserContextService, // Get current userId
  ) {
    super(db);
  }

  /**
   * Create session with audit fields
   */
  async create(data: NewUserSession, userId?: number): Promise<UserSession | null> {
    const currentUserId = userId || this.userContextService.getCurrentUserId();
    
    const [session] = await this.db
      .insert(schema.userSession)
      .values({
        ...data,
        createdBy: currentUserId,
        createdAt: new Date(),
        isActive: true,
      })
      .returning();

    return session || null;
  }

  /**
   * Update session with modification tracking
   */
  async update(
    sessionId: number,
    data: Partial<UserSession>,
    userId?: number,
  ): Promise<UserSession | null> {
    const currentUserId = userId || this.userContextService.getCurrentUserId();
    
    const [updated] = await this.db
      .update(schema.userSession)
      .set({
        ...data,
        modifiedBy: currentUserId,
        modifiedAt: new Date(),
      })
      .where(eq(schema.userSession.id, sessionId))
      .returning();

    return updated || null;
  }

  /**
   * Soft delete session
   */
  async delete(sessionId: number, userId?: number): Promise<number> {
    const currentUserId = userId || this.userContextService.getCurrentUserId();
    
    const result = await this.db
      .update(schema.userSession)
      .set({
        isActive: false,
        deletedAt: new Date(),
        modifiedBy: currentUserId,
        modifiedAt: new Date(),
      })
      .where(eq(schema.userSession.id, sessionId));

    return result.rowCount ?? 0;
  }

  /**
   * Find only active sessions (exclude soft-deleted)
   */
  async findById(sessionId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(and(
        eq(schema.userSession.id, sessionId),
        isNull(schema.userSession.deletedAt), // ← Exclude soft-deleted
      ));

    return session || null;
  }

  /**
   * Find session including soft-deleted (for auditing)
   */
  async findByIdIncludingDeleted(sessionId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.id, sessionId));

    return session || null;
  }

  // ... other methods updated similarly
}
```

#### 5. Create Migration File

**File:** `src/core/database/migrations/2026-04-29-add-audit-fields.ts`

```typescript
import { sql } from 'drizzle-orm';

/**
 * Add audit fields to user_sessions table and all other entity tables
 */
export async function up(db: any) {
  // Add audit fields to user_sessions
  await db.schema.alterTable('user_sessions').addColumn(
    'created_by',
    sql`INTEGER REFERENCES users(id) ON DELETE SET NULL`
  );
  await db.schema.alterTable('user_sessions').addColumn(
    'modified_by',
    sql`INTEGER REFERENCES users(id) ON DELETE SET NULL`
  );
  await db.schema.alterTable('user_sessions').addColumn(
    'is_active',
    sql`BOOLEAN DEFAULT true`
  );
  await db.schema.alterTable('user_sessions').addColumn(
    'deleted_at',
    sql`TIMESTAMP`
  );

  // Update modified_at to track all changes
  await db.execute(sql`
    ALTER TABLE user_sessions
    ADD TRIGGER user_sessions_modified_at_trigger
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_at()
  `);

  // Create index for soft-delete queries
  await db.schema.createIndex('idx_user_sessions_is_active')
    .on('user_sessions')
    .column('is_active');
}

export async function down(db: any) {
  await db.schema.alterTable('user_sessions').dropColumn('created_by');
  await db.schema.alterTable('user_sessions').dropColumn('modified_by');
  await db.schema.alterTable('user_sessions').dropColumn('is_active');
  await db.schema.alterTable('user_sessions').dropColumn('deleted_at');
  await db.schema.dropIndex('idx_user_sessions_is_active');
}
```

### Implementation Checklist

- [ ] Create `base-fields.ts` utility
- [ ] Update `user-session.table.ts` to include audit fields
- [ ] Update `session.repository.ts` to set/use audit fields
- [ ] Extend `BaseRepository` with soft-delete utilities
- [ ] Create migration for existing tables
- [ ] Update all entity tables (users, roles, stores, etc.)
- [ ] Update all repositories to track createdBy/modifiedBy
- [ ] Add tests for soft-delete functionality
- [ ] Create reporting endpoint for deleted records

### Benefits

✅ **Change Tracking:** Know who changed what and when  
✅ **Soft Delete:** Compliance-friendly record retention  
✅ **Consistency:** Standard pattern across all entities  
✅ **Reporting:** Audit reports by user, entity, date range  
✅ **Recovery:** Restore deleted records easily  

---

## Pattern 3: CustomResponse API Wrapper

### Problem Statement

**Current NKS:**
```typescript
// Controllers return raw data
@Post('login')
async login(@Body() credentials: LoginDto) {
  const result = await this.authFlowUseCase.login(credentials);
  return result; // ← Raw response
}

// Error handling returns inconsistent structure
// GlobalExceptionFilter catches but no error code wrapping
```

**Issues:**
- ❌ Inconsistent response structure
- ❌ No error codes for frontend i18n
- ❌ No standardized timestamp format
- ❌ No success flag for UI logic

### Solution Architecture

#### 1. Create ApiResponse Wrapper

**File:** `src/common/dtos/api-response.dto.ts`

```typescript
/**
 * Standardized API response wrapper for all endpoints
 * 
 * Success: { success: true, body: {...}, timestamp: "..." }
 * Error:   { success: false, errorCode: "...", message: "...", timestamp: "..." }
 */
export class ApiResponse<T = any> {
  success: boolean;
  errorCode?: string;
  message?: string;
  body?: T;
  timestamp: string;

  constructor(
    success: boolean,
    body?: T,
    errorCode?: string,
    message?: string,
  ) {
    this.success = success;
    this.body = body;
    this.errorCode = errorCode;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Success response
   */
  static success<T>(body: T, message?: string): ApiResponse<T> {
    return new ApiResponse(true, body, undefined, message);
  }

  /**
   * Error response
   */
  static error(errorCode: string, message: string): ApiResponse<null> {
    return new ApiResponse(false, null, errorCode, message);
  }

  /**
   * Paginated response
   */
  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
  ): ApiResponse<{ items: T[]; pagination: any }> {
    return ApiResponse.success({
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  }

  /**
   * List response
   */
  static list<T>(items: T[]): ApiResponse<T[]> {
    return ApiResponse.success(items);
  }
}
```

#### 2. Create GlobalExceptionFilter

**File:** `src/common/filters/global-exception.filter.ts`

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiResponse } from '../dtos/api-response.dto';
import { ApplicationException } from '../exceptions/application.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    // Handle custom ApplicationException
    if (exception instanceof ApplicationException) {
      status = exception.statusCode;
      errorCode = exception.errorCode;
      message = exception.message;

      this.logger.warn(
        `${errorCode} - ${message}`,
        ApplicationException.name,
      );
    }
    // Handle NestJS HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const { error, message: httpMessage } = exceptionResponse as any;
        errorCode = error?.code || error || 'HTTP_ERROR';
        message = httpMessage || exception.message;
      } else {
        message = exceptionResponse as string;
      }

      this.logger.warn(`${status} - ${message}`, exception.constructor.name);
    }
    // Handle validation errors
    else if (exception instanceof Error && exception.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'VALIDATION_FAILED';
      message = exception.message;

      this.logger.warn(`${errorCode} - ${message}`);
    }
    // Generic error handling
    else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = exception.message || 'Unknown error occurred';

      this.logger.error(`${errorCode} - ${message}`, exception.stack);
    }

    response.status(status).json(
      ApiResponse.error(errorCode, message),
    );
  }
}
```

#### 3. Create Exception Base Class

**File:** `src/common/exceptions/application.exception.ts`

```typescript
/**
 * Base exception class for all application-specific exceptions
 */
export abstract class ApplicationException extends Error {
  abstract readonly errorCode: string;
  abstract readonly statusCode: number;
  readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

#### 4. Create Specific Exceptions

**File:** `src/contexts/iam/auth/exceptions/auth.exceptions.ts`

```typescript
import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from '../../../../common/exceptions/application.exception';

export class SessionNotFoundException extends ApplicationException {
  readonly errorCode = 'SESSION_NOT_FOUND';
  readonly statusCode = HttpStatus.NOT_FOUND;

  constructor(sessionId?: number) {
    super(
      sessionId
        ? `Session with ID ${sessionId} not found`
        : 'Session not found or has expired',
    );
  }
}

export class SessionLimitExceededException extends ApplicationException {
  readonly errorCode = 'SESSION_LIMIT_EXCEEDED';
  readonly statusCode = HttpStatus.TOO_MANY_REQUESTS;

  constructor(maxSessions: number) {
    super(
      `Maximum ${maxSessions} concurrent sessions allowed per user. Please log out from another session.`,
    );
  }
}

export class InvalidTokenException extends ApplicationException {
  readonly errorCode = 'INVALID_TOKEN';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(reason?: string) {
    super(`Token is invalid${reason ? `: ${reason}` : ''}`);
  }
}

export class TokenExpiredException extends ApplicationException {
  readonly errorCode = 'TOKEN_EXPIRED';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(tokenType: string = 'Token') {
    super(`${tokenType} has expired. Please log in again.`);
  }
}

export class UnauthorizedException extends ApplicationException {
  readonly errorCode = 'UNAUTHORIZED';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}

export class TokenTheftDetectedException extends ApplicationException {
  readonly errorCode = 'TOKEN_THEFT_DETECTED';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor() {
    super('Suspicious activity detected. All sessions have been revoked.');
  }
}
```

#### 5. Update Controllers to Use ApiResponse

**File:** `src/contexts/iam/auth/controllers/auth.controller.ts` (Modified)

```typescript
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiResponse } from '../../../../common/dtos/api-response.dto';
import { AuthFlowUseCase } from '../use-cases/auth-flow.use-case';
import { LoginDto } from '../dtos/login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authFlowUseCase: AuthFlowUseCase) {}

  @Post('login')
  async login(
    @Body() credentials: LoginDto,
    @Req() request: Request,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authFlowUseCase.login(credentials, request);
    return ApiResponse.success(result, 'Login successful');
  }

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authFlowUseCase.register(registerDto, request);
    return ApiResponse.success(result, 'Registration successful');
  }

  @Post('refresh')
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Req() request: Request,
  ): Promise<ApiResponse<TokenPairDto>> {
    const result = await this.authFlowUseCase.refresh(refreshToken, request);
    return ApiResponse.success(result, 'Token refreshed successfully');
  }

  @Post('logout')
  async logout(
    @Body('sessionId') sessionId: number,
    @Req() request: Request,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.authFlowUseCase.logout(sessionId, request);
    return ApiResponse.success({ message: 'Logged out successfully' });
  }
}
```

#### 6. Register GlobalExceptionFilter in Module

**File:** `src/app.module.ts` (Modified)

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AuthModule } from './contexts/iam/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
```

### Response Examples

**Success Response:**
```json
{
  "success": true,
  "body": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe"
    }
  },
  "message": "Login successful",
  "timestamp": "2026-04-29T10:30:00.123Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "errorCode": "SESSION_LIMIT_EXCEEDED",
  "message": "Maximum 5 concurrent sessions allowed per user. Please log out from another session.",
  "timestamp": "2026-04-29T10:30:00.123Z"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "body": {
    "items": [
      {"id": 1, "name": "Session 1"},
      {"id": 2, "name": "Session 2"}
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "pageSize": 10,
      "totalPages": 5
    }
  },
  "timestamp": "2026-04-29T10:30:00.123Z"
}
```

### Implementation Checklist

- [ ] Create `api-response.dto.ts` with success/error factories
- [ ] Create `application.exception.ts` base class
- [ ] Create auth-specific exceptions in `auth.exceptions.ts`
- [ ] Create `global-exception.filter.ts`
- [ ] Update all controllers to return `ApiResponse<T>`
- [ ] Register GlobalExceptionFilter in AppModule
- [ ] Update frontend to parse error codes
- [ ] Test all error scenarios
- [ ] Add error code documentation

### Benefits

✅ **Consistency:** All responses have same structure  
✅ **i18n Support:** Error codes for translations  
✅ **Frontend Logic:** `success` flag for conditional handling  
✅ **Debugging:** Standardized error codes and messages  
✅ **Pagination:** Built-in support for list endpoints  

---

## Pattern 4: Service Interface Contracts

### Why This Matters

**Current NKS:** Concrete services without interfaces
```typescript
@Injectable()
export class SessionCommandService { ... } // ← No contract

// Hard to test - must mock entire service
// Hard to swap implementations (e.g., in-memory vs database)
// Implicit contract vs explicit interface
```

**Ayphen Pattern:** Service interfaces as contracts
```java
interface TransactionService {
  Transaction createTransaction(Request req);
  void approveTransaction(Long id);
  List<Transaction> findByStatus(Status status);
}

class TransactionServiceImpl implements TransactionService {
  // Implementation
}
```

### Implementation

#### 1. Create Session Service Interfaces

**File:** `src/contexts/iam/auth/services/session/session-command.service.interface.ts`

```typescript
import type { CreateSessionDto } from '../../dtos/create-session.dto';
import type { UserSession } from '../../../../core/database/schema/auth/user-session';

export interface ISessionCommandService {
  /**
   * Create a new session, enforcing max session limit
   */
  create(
    userId: number,
    maxSessions: number,
    data: CreateSessionDto,
  ): Promise<UserSession | null>;

  /**
   * Delete a session (soft delete)
   */
  delete(sessionId: number): Promise<number>;

  /**
   * Revoke a single session
   */
  revokeSession(sessionId: number, reason: string, jti?: string): Promise<void>;

  /**
   * Revoke all sessions for a user
   */
  revokeAllForUser(
    userId: number,
    reason: string,
    jtis?: string[],
  ): Promise<void>;

  /**
   * Update session active store
   */
  setActiveStore(sessionId: number, storeId: number): Promise<void>;

  /**
   * Clear session active store
   */
  clearActiveStore(sessionId: number): Promise<void>;
}
```

**File:** `src/contexts/iam/auth/services/session/session-query.service.interface.ts`

```typescript
import type { UserSession } from '../../../../core/database/schema/auth/user-session';
import type { SessionDto } from '../../dtos/session.dto';

export interface ISessionQueryService {
  /**
   * Find session by ID
   */
  findById(sessionId: number): Promise<UserSession | null>;

  /**
   * Find all sessions for a user
   */
  findByUserId(userId: number): Promise<UserSession[]>;

  /**
   * Find active sessions for a user (excluding revoked)
   */
  findActiveByUserId(userId: number): Promise<UserSession[]>;

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(userId: number): Promise<number>;

  /**
   * Get paginated sessions for a user
   */
  findSessionsForUser(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{ items: SessionDto[]; total: number }>;
}
```

#### 2. Update SessionCommandService Implementation

**File:** `src/contexts/iam/auth/services/session/session-command.service.ts` (Modified)

```typescript
import { Injectable } from '@nestjs/common';
import { ISessionCommandService } from './session-command.service.interface';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { SessionRevocationRepository } from '../../repositories/session-revocation.repository';
import { AuditService } from '../../../../contexts/audit/services/audit.service';
import type { CreateSessionDto } from '../../dtos/create-session.dto';
import type { UserSession } from '../../../../core/database/schema/auth/user-session';

@Injectable()
export class SessionCommandService implements ISessionCommandService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionContextRepository: SessionContextRepository,
    private readonly sessionRevocationRepository: SessionRevocationRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    userId: number,
    maxSessions: number,
    data: CreateSessionDto,
  ): Promise<UserSession | null> {
    // Atomic: check limit + create in transaction
    return await this.sessionContextRepository.createWithinLimit(
      userId,
      maxSessions,
      {
        ...data,
        userId,
        createdBy: userId,
        createdAt: new Date(),
        isActive: true,
      },
    );
  }

  async delete(sessionId: number): Promise<number> {
    return await this.sessionRepository.delete(sessionId);
  }

  async revokeSession(sessionId: number, reason: string, jti?: string): Promise<void> {
    await this.sessionRevocationRepository.revokeSession(sessionId, reason, jti);
  }

  async revokeAllForUser(
    userId: number,
    reason: string,
    jtis?: string[],
  ): Promise<void> {
    await this.sessionRevocationRepository.revokeAllForUser(userId, reason, jtis);
  }

  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    await this.sessionRepository.update(sessionId, { activeStoreId: storeId } as any, userId);
  }

  async clearActiveStore(sessionId: number): Promise<void> {
    await this.sessionRepository.update(sessionId, { activeStoreId: null } as any, userId);
  }
}
```

#### 3. Create SessionModule with Providers

**File:** `src/contexts/iam/auth/modules/session.module.ts` (Modified)

```typescript
import { Module } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { SessionRevocationRepository } from '../repositories/session-revocation.repository';
import { SessionContextRepository } from '../repositories/session-context.repository';

import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';
import { SessionBootstrapService } from '../services/session/session-bootstrap.service';
import { SessionCleanupService } from '../services/session/session-cleanup.service';
import { AuthContextService } from '../services/auth/auth-context.service';

import { ISessionCommandService } from '../services/session/session-command.service.interface';
import { ISessionQueryService } from '../services/session/session-query.service.interface';

@Module({
  providers: [
    // Repositories
    SessionRepository,
    SessionTokenRepository,
    SessionRevocationRepository,
    SessionContextRepository,

    // Services
    SessionCommandService,
    SessionQueryService,
    SessionBootstrapService,
    SessionCleanupService,
    AuthContextService,

    // Interface bindings
    {
      provide: 'ISessionCommandService',
      useClass: SessionCommandService,
    },
    {
      provide: 'ISessionQueryService',
      useClass: SessionQueryService,
    },
  ],
  exports: [
    // Export both concrete and interface providers
    SessionCommandService,
    SessionQueryService,
    SessionBootstrapService,
    SessionCleanupService,
    AuthContextService,
    'ISessionCommandService',
    'ISessionQueryService',
  ],
})
export class SessionModule {}
```

#### 4. Use Interfaces in Other Services

**File:** `src/contexts/iam/auth/services/auth/auth-context.service.ts` (Modified)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ISessionQueryService } from '../session/session-query.service.interface';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { SessionRevocationRepository } from '../../repositories/session-revocation.repository';

@Injectable()
export class AuthContextService {
  constructor(
    @Inject('ISessionQueryService')
    private readonly sessionQueryService: ISessionQueryService,
    private readonly sessionTokenRepository: SessionTokenRepository,
    private readonly sessionRevocationRepository: SessionRevocationRepository,
  ) {}

  async loadAuthContext(token: string) {
    // Use interface instead of concrete service
    const session = await this.sessionQueryService.findByToken(token);
    
    if (!session) {
      return null;
    }

    // ... rest of logic
  }
}
```

### Implementation Checklist

- [ ] Create service interfaces (ISessionCommandService, ISessionQueryService)
- [ ] Implement services with interface decorators
- [ ] Add interface providers to modules
- [ ] Update dependent services to inject interfaces
- [ ] Create mock implementations for testing
- [ ] Update unit tests to use mock interfaces
- [ ] Document all interface contracts
- [ ] Add JSDoc comments to interface methods

### Benefits

✅ **Loose Coupling:** Services depend on abstractions  
✅ **Testability:** Easy to mock interfaces  
✅ **Multiple Implementations:** Swap in-memory, database, etc.  
✅ **Contracts:** Explicit method signatures  
✅ **Flexibility:** Change implementation without breaking consumers  

---

## Pattern 5: Comprehensive Exception Hierarchy

### Implementation

**File:** `src/common/exceptions/exception-hierarchy.ts`

```typescript
import { HttpStatus } from '@nestjs/common';

/**
 * Application Exception Hierarchy
 * 
 * ApplicationException
 *   ├─ AuthenticationException
 *   │   ├─ InvalidTokenException
 *   │   ├─ TokenExpiredException
 *   │   ├─ InvalidCredentialsException
 *   │   └─ MfaRequiredException
 *   ├─ AuthorizationException
 *   │   ├─ PermissionDeniedException
 *   │   ├─ RoleRequiredException
 *   │   └─ TenantAccessDeniedException
 *   ├─ ValidationException
 *   │   ├─ FieldValidationException
 *   │   ├─ BusinessRuleViolationException
 *   │   └─ UniqueConstraintViolationException
 *   ├─ ResourceException
 *   │   ├─ ResourceNotFoundException
 *   │   ├─ ResourceAlreadyExistsException
 *   │   └─ ResourceConflictException
 *   ├─ ConflictException
 *   │   ├─ SessionLimitExceededException
 *   │   ├─ TokenTheftDetectedException
 *   │   └─ ConcurrentModificationException
 *   └─ InternalException
 *       ├─ DatabaseException
 *       ├─ ConfigurationException
 *       └─ UnexpectedException
 */

export abstract class ApplicationException extends Error {
  abstract readonly errorCode: string;
  abstract readonly statusCode: number;
  readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Authentication Exceptions
export class InvalidTokenException extends ApplicationException {
  readonly errorCode = 'INVALID_TOKEN';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(reason?: string) {
    super(`Token is invalid${reason ? `: ${reason}` : ''}`);
  }
}

export class TokenExpiredException extends ApplicationException {
  readonly errorCode = 'TOKEN_EXPIRED';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(tokenType: string = 'Token') {
    super(`${tokenType} has expired. Please log in again.`);
  }
}

export class InvalidCredentialsException extends ApplicationException {
  readonly errorCode = 'INVALID_CREDENTIALS';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor() {
    super('Invalid email or password');
  }
}

export class MfaRequiredException extends ApplicationException {
  readonly errorCode = 'MFA_REQUIRED';
  readonly statusCode = HttpStatus.FORBIDDEN;

  constructor(mfaMethod: string) {
    super(`Multi-factor authentication via ${mfaMethod} is required`);
  }
}

// Authorization Exceptions
export class PermissionDeniedException extends ApplicationException {
  readonly errorCode = 'PERMISSION_DENIED';
  readonly statusCode = HttpStatus.FORBIDDEN;

  constructor(action: string = 'access this resource') {
    super(`You do not have permission to ${action}`);
  }
}

export class RoleRequiredException extends ApplicationException {
  readonly errorCode = 'ROLE_REQUIRED';
  readonly statusCode = HttpStatus.FORBIDDEN;

  constructor(requiredRole: string) {
    super(`Role '${requiredRole}' is required to perform this action`);
  }
}

export class TenantAccessDeniedException extends ApplicationException {
  readonly errorCode = 'TENANT_ACCESS_DENIED';
  readonly statusCode = HttpStatus.FORBIDDEN;

  constructor() {
    super('You do not have access to this tenant or organization');
  }
}

// Validation Exceptions
export class ValidationException extends ApplicationException {
  readonly errorCode = 'VALIDATION_FAILED';
  readonly statusCode = HttpStatus.BAD_REQUEST;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

export class BusinessRuleViolationException extends ApplicationException {
  readonly errorCode = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = HttpStatus.BAD_REQUEST;

  constructor(rule: string) {
    super(`Business rule violation: ${rule}`);
  }
}

export class UniqueConstraintViolationException extends ApplicationException {
  readonly errorCode = 'UNIQUE_CONSTRAINT_VIOLATION';
  readonly statusCode = HttpStatus.CONFLICT;

  constructor(fieldName: string) {
    super(`${fieldName} already exists`);
  }
}

// Resource Exceptions
export class ResourceNotFoundException extends ApplicationException {
  readonly errorCode = 'RESOURCE_NOT_FOUND';
  readonly statusCode = HttpStatus.NOT_FOUND;

  constructor(resourceType: string, identifier?: string | number) {
    super(
      identifier
        ? `${resourceType} '${identifier}' not found`
        : `${resourceType} not found`
    );
  }
}

export class ResourceAlreadyExistsException extends ApplicationException {
  readonly errorCode = 'RESOURCE_ALREADY_EXISTS';
  readonly statusCode = HttpStatus.CONFLICT;

  constructor(resourceType: string) {
    super(`${resourceType} already exists`);
  }
}

// Conflict Exceptions
export class SessionLimitExceededException extends ApplicationException {
  readonly errorCode = 'SESSION_LIMIT_EXCEEDED';
  readonly statusCode = HttpStatus.TOO_MANY_REQUESTS;

  constructor(maxSessions: number) {
    super(
      `Maximum ${maxSessions} concurrent sessions allowed. Please log out from another session.`
    );
  }
}

export class TokenTheftDetectedException extends ApplicationException {
  readonly errorCode = 'TOKEN_THEFT_DETECTED';
  readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor() {
    super('Suspicious activity detected. All sessions have been revoked for security.');
  }
}

export class ConcurrentModificationException extends ApplicationException {
  readonly errorCode = 'CONCURRENT_MODIFICATION';
  readonly statusCode = HttpStatus.CONFLICT;

  constructor(resource: string) {
    super(`${resource} was modified by another user. Please refresh and try again.`);
  }
}

// Internal Exceptions
export class DatabaseException extends ApplicationException {
  readonly errorCode = 'DATABASE_ERROR';
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor(message: string = 'Database operation failed') {
    super(message);
  }
}

export class ConfigurationException extends ApplicationException {
  readonly errorCode = 'CONFIGURATION_ERROR';
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

export class UnexpectedException extends ApplicationException {
  readonly errorCode = 'UNEXPECTED_ERROR';
  readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor(originalError?: Error) {
    super(
      'An unexpected error occurred',
      originalError ? { message: originalError.message, stack: originalError.stack } : undefined
    );
  }
}
```

### Usage Example

```typescript
// In SessionCommandService
async create(userId: number, maxSessions: number, data: CreateSessionDto) {
  const currentCount = await this.sessionRepository.getActiveSessionCount(userId);
  
  if (currentCount >= maxSessions) {
    throw new SessionLimitExceededException(maxSessions);
  }

  try {
    return await this.sessionRepository.create(data);
  } catch (error) {
    throw new DatabaseException('Failed to create session');
  }
}

// In AuthContextService
async loadContext(token: string) {
  if (!token) {
    throw new InvalidTokenException('Token is required');
  }

  const context = await this.sessionContextRepository.findSessionAuthContext(token);
  
  if (!context.session) {
    throw new ResourceNotFoundException('Session', token);
  }

  if (context.revokedJti) {
    throw new TokenTheftDetectedException();
  }

  return context;
}
```

---

## Pattern 6: Service-Level Authorization

### Problem Statement

**Current NKS:**
Repository validates tenant, but service doesn't verify user ownership before operations.

```typescript
// Currently:
SessionRepository.delete(sessionId) ← Validates company_id
// But:
SessionCommandService.delete(sessionId) ← Doesn't verify ownership
```

### Solution

```typescript
// Enhanced: Service validates before repository
async delete(sessionId: number, userId: number): Promise<number> {
  const tenantId = this.tenantContext.getTenantId();
  
  // Verify session belongs to user
  const session = await this.sessionRepository.findById(sessionId);
  if (!session) {
    throw new SessionNotFoundException(sessionId);
  }

  // Defense-in-depth: verify tenant
  if (session.companyId !== tenantId) {
    throw new TenantAccessDeniedException();
  }

  // Additional: verify user owns session (optional, depends on flow)
  if (session.userId !== userId && !this.authPolicyService.isAdmin(userId)) {
    throw new PermissionDeniedException('delete this session');
  }

  return await this.sessionRepository.delete(sessionId);
}
```

---

## Pattern 7: DTO Transformation Mappers

### Implementation

**File:** `src/contexts/iam/auth/mappers/session.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import type { UserSession } from '../../../core/database/schema/auth/user-session';
import type { User } from '../../../core/database/schema/auth/users/users.table';
import { SessionDto } from '../dtos/session.dto';
import { SessionDetailDto } from '../dtos/session-detail.dto';

@Injectable()
export class SessionMapper {
  /**
   * Map UserSession entity to minimal DTO (for lists)
   */
  async toDTO(entity: UserSession): Promise<SessionDto> {
    return {
      id: entity.id,
      sessionId: entity.guuid,
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt,
      isActive: !entity.deletedAt,
      ipAddress: entity.ipAddress,
    };
  }

  /**
   * Map UserSession + User to detailed DTO
   */
  async toDetailDTO(entity: UserSession, user: User): Promise<SessionDetailDto> {
    return {
      id: entity.id,
      sessionId: entity.guuid,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      createdAt: entity.createdAt,
      expiresAt: entity.expiresAt,
      refreshTokenExpiresAt: entity.refreshTokenExpiresAt,
      ipAddress: entity.ipAddress,
      userAgent: entity.userAgent,
      isActive: !entity.deletedAt,
    };
  }

  /**
   * Map list of entities to DTOs
   */
  async toDTOList(entities: UserSession[]): Promise<SessionDto[]> {
    return Promise.all(entities.map(e => this.toDTO(e)));
  }
}
```

---

## Pattern 8: Query Projections

### Implementation

```typescript
// In SessionContextRepository
async findSessionsForUser(userId: number): Promise<SessionListItemProjection[]> {
  return await this.db
    .select({
      id: schema.userSession.id,
      sessionId: schema.userSession.guuid,
      createdAt: schema.userSession.createdAt,
      expiresAt: schema.userSession.expiresAt,
      isActive: isNull(schema.userSession.deletedAt),
    })
    .from(schema.userSession)
    .where(and(
      eq(schema.userSession.userId, userId),
      isNull(schema.userSession.deletedAt),
    ));
}
```

---

## Pattern 9: Business Rule Validators

### Implementation

**File:** `src/contexts/iam/auth/validators/session.validator.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionNotFoundException, SessionLimitExceededException } from '../exceptions/auth.exceptions';

@Injectable()
export class SessionValidator {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async validateSessionExists(sessionId: number): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
  }

  async validateSessionWithinLimit(userId: number, maxSessions: number): Promise<void> {
    const activeCount = await this.sessionRepository.getActiveSessionCount(userId);
    if (activeCount >= maxSessions) {
      throw new SessionLimitExceededException(maxSessions);
    }
  }
}
```

---

## Pattern 10: Enhanced Event Handling

### Implementation

```typescript
// Enhance existing SessionRevocationListener
@Injectable()
export class SessionRevokedEventHandler {
  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly activityLogRepository: ActivityLogRepository,
  ) {}

  @OnEvent('session.revoked')
  async handleSessionRevoked(event: SessionRevokedEvent) {
    // Audit log
    await this.auditService.logSessionRevoked(
      event.userId,
      event.sessionId,
      event.reason,
    );

    // Notify user
    await this.notificationService.notifySessionRevoked(
      event.userId,
      event.reason,
    );

    // Analytics
    await this.activityLogRepository.log(
      event.userId,
      'SESSION_REVOKED',
      'SESSION',
      event.sessionId,
      { reason: event.reason },
    );
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) ← START HERE

**Priority: 🔴 HIGH**

- [ ] Implement Pattern 1: Persistent Audit Trail
  - Create `activity_logs` table
  - Create `ActivityLogRepository` + `AuditService`
  - Update `SessionRevocationRepository` to call audit service
  - Create retention cleanup job

- [ ] Implement Pattern 2: Base Entity Audit Fields
  - Create `base-fields.ts` utility
  - Update `user-session.table.ts`
  - Create migration
  - Update `SessionRepository` to set audit fields
  - Extend `BaseRepository` with soft-delete utilities

- [ ] Implement Pattern 3: CustomResponse + Exception Hierarchy
  - Create `ApiResponse<T>` wrapper
  - Create exception base class
  - Create auth-specific exceptions
  - Create `GlobalExceptionFilter`
  - Update all controllers to use ApiResponse
  - Register filter in AppModule

**Effort:** 2-3 days  
**Team:** 2 developers  
**Risk:** Low (isolated to persistence + API layer)

### Phase 2: Service Layer (Week 2)

**Priority: 🟠 MEDIUM**

- [ ] Implement Pattern 4: Service Interfaces
  - Create `ISessionCommandService` interface
  - Create `ISessionQueryService` interface
  - Update implementations to implement interfaces
  - Add interface providers to modules
  - Update dependent services

- [ ] Implement Pattern 6: Service-Level Authorization
  - Add `TenantContextService`
  - Add authorization checks in all services
  - Create `AuthorizationValidator`

- [ ] Implement Pattern 9: Business Rule Validators
  - Create `SessionValidator`
  - Create `TokenValidator`
  - Integrate into services

**Effort:** 2-3 days  
**Team:** 2 developers  
**Risk:** Low (refactoring, no behavior changes)

### Phase 3: Enhancements (Week 3)

**Priority: 🟠 MEDIUM**

- [ ] Implement Pattern 7: DTO Mappers
  - Create `SessionMapper`
  - Create mapper interfaces
  - Update service layer

- [ ] Implement Pattern 8: Query Projections
  - Add projection methods to repositories
  - Update controllers to use projections

- [ ] Implement Pattern 10: Enhanced Events
  - Create event handlers for all major operations
  - Add email/notification handlers

**Effort:** 2-3 days  
**Team:** 1-2 developers  
**Risk:** Low (non-critical enhancements)

### Phase 4: Testing & Documentation (Week 4)

**Priority: 🟡 MEDIUM**

- [ ] Unit tests for all new patterns
- [ ] Integration tests for auth flows
- [ ] Load testing for audit trail
- [ ] Documentation updates
- [ ] Developer guide

**Effort:** 2-3 days  
**Team:** 2 developers  
**Risk:** Low

---

## Testing Strategy

### Unit Testing

```typescript
describe('SessionCommandService', () => {
  let service: SessionCommandService;
  let mockSessionRepository: jest.Mock;
  let mockAuditService: jest.Mock;

  beforeEach(() => {
    mockSessionRepository = jest.fn();
    mockAuditService = jest.fn();
    service = new SessionCommandService(
      mockSessionRepository,
      mockAuditService,
    );
  });

  describe('create', () => {
    it('should create session when within limit', async () => {
      // Arrange
      mockSessionRepository.getActiveSessionCount.mockResolvedValue(2);
      mockSessionRepository.create.mockResolvedValue({ id: 1 });

      // Act
      const result = await service.create(1, 5, {});

      // Assert
      expect(result.id).toBe(1);
      expect(mockAuditService.logSessionCreated).toHaveBeenCalled();
    });

    it('should throw when session limit exceeded', async () => {
      // Arrange
      mockSessionRepository.getActiveSessionCount.mockResolvedValue(5);

      // Act & Assert
      await expect(service.create(1, 5, {}))
        .rejects
        .toThrow(SessionLimitExceededException);
    });
  });
});
```

### Integration Testing

```typescript
describe('Auth Flow Integration', () => {
  it('should login user and create audit log', async () => {
    // Arrange
    const loginDto = { email: 'user@example.com', password: 'password' };

    // Act
    const response = await authController.login(loginDto, mockRequest);

    // Assert
    expect(response.success).toBe(true);

    // Verify audit log created
    const auditLog = await activityLogRepository.findByAction('LOGIN', companyId);
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].userId).toBe(user.id);
  });
});
```

---

## Migration Checklist

- [ ] **Schema Migrations**
  - [ ] Create `activity_logs` table
  - [ ] Add audit fields to `user_sessions`
  - [ ] Add audit fields to other entities (users, roles, etc.)
  - [ ] Create indices for audit queries

- [ ] **Code Changes**
  - [ ] Create exception hierarchy
  - [ ] Create `ApiResponse` wrapper
  - [ ] Register `GlobalExceptionFilter`
  - [ ] Update all controllers
  - [ ] Create audit service + repository
  - [ ] Create base entity utilities
  - [ ] Update SessionRepository
  - [ ] Create service interfaces
  - [ ] Create validators
  - [ ] Create mappers

- [ ] **Testing**
  - [ ] Unit tests for exceptions
  - [ ] Unit tests for validators
  - [ ] Integration tests for auth flows
  - [ ] Audit trail verification tests

- [ ] **Documentation**
  - [ ] API response format doc
  - [ ] Error codes reference
  - [ ] Service interface contracts doc
  - [ ] Migration guide for frontend

- [ ] **Deployment**
  - [ ] Review changes with team
  - [ ] Stage testing
  - [ ] Run production migration
  - [ ] Monitor audit trail creation
  - [ ] Verify all endpoints return ApiResponse

---

## Summary & Expected Outcomes

### Before Implementation (9.35/10)
- ✅ Excellent modular architecture
- ❌ Event-driven logging only
- ❌ Raw API responses
- ❌ Implicit service contracts

### After Implementation (9.8+/10)
- ✅ Persistent audit trail
- ✅ Base entity audit fields
- ✅ Standardized API responses
- ✅ Explicit service contracts
- ✅ Comprehensive exception hierarchy
- ✅ Service-level authorization
- ✅ DTO mapper pattern
- ✅ Query projections
- ✅ Business validators
- ✅ Enhanced event handling

### Measurable Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Audit Trail | Event logs | Persistent DB | ✅ 100% reliable |
| API Response Consistency | 60% | 100% | ✅ 40% improvement |
| Error Code Coverage | 40 codes | 80+ codes | ✅ 2x coverage |
| Service Testability | 70% | 95% | ✅ 25% improvement |
| Exception Handling | Ad-hoc | Hierarchical | ✅ Unified |
| Architecture Score | 9.35/10 | 9.8+/10 | ✅ +0.45 improvement |

---

## References

- **Ayphen BaseEntity:** `/Users/saran/ayphen/projects/src/main/java/com/ayphen/api/domain/common/entity/BaseEntity.java`
- **Ayphen ActivityLog:** `/Users/saran/ayphen/projects/src/main/java/com/ayphen/api/entity/ActivityLog.java`
- **Ayphen CustomResponse:** `/Users/saran/ayphen/projects/src/main/java/com/ayphen/api/payload/response/CustomResponse.java`
- **Ayphen Exception Handling:** `/Users/saran/ayphen/projects/src/main/java/com/ayphen/api/exception/*.java`
- **NKS SessionsRepository Refactoring:** `/Users/saran/ayphen/projects/nks/apps/nks-backend/SESSION_REPOSITORY_REFACTORING_COMPLETE.md`

---

**Document Version:** 1.0  
**Last Updated:** April 29, 2026  
**Status:** Ready for Implementation  
**Approval:** Pending Team Review

