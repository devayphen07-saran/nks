# Phase 3 Quick Start — Using the Sync Infrastructure

## What Was Implemented

**7 files created (Phase 3):**
- 3 type definitions
- 3 services
- 1 handler interface
- 1 base handler class
- 2 module/index exports

**Total: 740 lines across 16 files** (includes Phase 1-2)

---

## How to Use Phase 3 Components

### 1. Types (Import as Needed)

```typescript
import type { DeviceContext, SyncResult, SyncOperation } from '@contexts/sync';

// DeviceContext — passed to every sync operation
const device: DeviceContext = {
  deviceId: 'a1b2c3d4-...',
  userId: 123,
  storeId: 456,
};

// SyncResult — response from an operation
const result: SyncResult = {
  status: 'ok',
  client_op_id: 'op-uuid',
  server_id: 'entity-uuid',
  version: 2,
};
```

### 2. Using SyncCursorService

```typescript
import { SyncCursorService } from '@contexts/sync';

constructor(private cursorService: SyncCursorService) {}

// Parse a cursor from mobile
const cursor = "1725800000000:a1b2c3d4-...";
const { ts, id } = this.cursorService.parse(cursor);

// Build next cursor from last row
const nextCursor = this.cursorService.build(lastRow.updated_at, lastRow.id);
```

### 3. Using IdempotencyService

```typescript
import { IdempotencyService } from '@contexts/sync';

constructor(private idempotency: IdempotencyService) {}

// Check cache
const cached = await this.idempotency.find(op.client_op_id);
if (cached) {
  return cached; // Skip processing, return cached result
}

// Process operation...

// Save result (only terminal results are cached)
await this.idempotency.save(
  op.client_op_id,
  device.deviceId,
  'product',
  result
);
```

### 4. Using DispatcherService

```typescript
import { DispatcherService } from '@contexts/sync';

// Domain module (e.g., ProductsModule)
export class ProductsModule implements OnModuleInit {
  constructor(
    private dispatcher: DispatcherService,
    private productSync: ProductsSyncService,
  ) {}

  onModuleInit() {
    this.dispatcher.register('product', this.productSync);
  }
}

// Sync service looks up handler
const handler = this.dispatcher.getHandler('product');
if (!handler) {
  return { status: 'error', reason: 'Unknown entity' };
}
```

### 5. Extending BaseSyncHandler

```typescript
import { BaseSyncHandler } from '@contexts/sync';

@Injectable()
export class ProductsSyncService extends BaseSyncHandler<Product> {
  readonly entity = 'product';

  constructor(private repo: ProductsRepository) {
    super();
  }

  // Domain-specific create logic
  async applyCreate(op, device, tx): Promise<SyncResult> {
    // Check for duplicate
    const existing = await tx.findOne(Product, { where: { id: op.client_id } });
    if (existing) {
      return {
        status: 'duplicate',
        client_op_id: op.client_op_id,
        server_id: existing.id,
        version: existing.version,
      };
    }

    // Create new entity
    const product = tx.create(Product, {
      id: op.client_id,
      ...op.payload,
      version: 1,
      store_fk: device.storeId,
      created_by_device: device.deviceId,
      updated_at: new Date(),
    });
    await tx.save(product);

    return {
      status: 'ok',
      client_op_id: op.client_op_id,
      server_id: product.id,
      version: 1,
    };
  }

  // Convert DB row to API response
  toWireFormat(entity: Product): Record<string, unknown> {
    return {
      id: entity.id,
      name: entity.name,
      price: entity.price,
      version: entity.version,
    };
  }

  // Find with FOR UPDATE lock
  protected async findByIdForUpdate(
    id: string,
    storeId: number,
    tx: any,
  ): Promise<Product | null> {
    return tx
      .createQueryBuilder(Product, 'p')
      .where('p.id = :id', { id })
      .andWhere('p.store_fk = :storeId', { storeId })
      .setLock('pessimistic_write')
      .getOne();
  }

  // Pagination query with compound cursor
  protected async queryChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    tx: any,
  ): Promise<Product[]> {
    return tx
      .createQueryBuilder(Product, 'p')
      .where('p.store_fk = :storeId', { storeId })
      .andWhere(
        '(p.updated_at > :cursorTs OR (p.updated_at = :cursorTs AND p.id > :cursorId))',
        { cursorTs, cursorId },
      )
      .orderBy('p.updated_at', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Save entity
  protected async saveEntity(entity: Product, tx: any): Promise<void> {
    await tx.save(entity);
  }
}
```

---

## Integration Checklist (for Phase 4)

Phase 4 will wire Phase 3 components into HTTP endpoints. Checklist:

- [ ] Create `src/contexts/sync/sync.service.ts`
  - Inject: IdempotencyService, DispatcherService, SyncCursorService
  - Implement: `applyOperation()`, `pullEntity()`

- [ ] Create `src/contexts/sync/sync.controller.ts`
  - Routes: `POST /sync/push`, `GET /sync/pull`
  - Guards: DeviceAuthGuard (not yet created)
  - Decorators: @CurrentDevice() (not yet created)

- [ ] Create `src/contexts/sync/guards/device-auth.guard.ts`
  - Validates device registration from DB
  - Populates DeviceContext

- [ ] Create `src/contexts/sync/decorators/current-device.decorator.ts`
  - Extracts DeviceContext from request

- [ ] Create DTOs
  - `src/contexts/sync/dto/push-request.dto.ts` (Zod)
  - `src/contexts/sync/dto/push-response.dto.ts`
  - `src/contexts/sync/dto/pull-query.dto.ts` (Zod)
  - `src/contexts/sync/dto/pull-response.dto.ts`

- [ ] Update `src/app.module.ts`
  - Import SyncModule
  - Call SyncModule.forRoot([...tombstoneTargets])

---

## Key Principles

### Explicit Over Implicit
- No magic. Every behavior is documented.
- DeviceContext is passed explicitly, not hidden in request context.
- Cursor parsing is straightforward parsing, not opaque.

### Clear Error Handling
- SyncResult is a discriminated union. Status determines available fields.
- DispatcherService returns undefined (doesn't throw) for missing handlers.
- BaseSyncHandler throws only for unimplemented abstract methods.

### No Surprises
- Idempotency only caches terminal results. Errors are never cached.
- Soft deletes are the only delete option at the application layer.
- Version checking is pessimistic locking + optimistic concurrency.

### Extensibility
- Domain handlers only override what they need.
- New sync columns are added to existing tables via migrations.
- New entities require one handler file + one registration call.

---

## File Structure

```
src/contexts/sync/
├── types/
│   ├── device-context.ts       (interface)
│   ├── sync-result.ts          (discriminated union)
│   ├── sync-operation.ts       (interface)
│   └── index.ts                (re-exports)
├── services/
│   ├── sync-cursor.service.ts  (pagination cursors)
│   ├── idempotency.service.ts  (deduplication)
│   ├── dispatcher.service.ts   (handler registry)
│   └── index.ts                (re-exports)
├── handlers/
│   ├── sync-handler.interface.ts (contract)
│   ├── base-sync-handler.ts     (base class)
│   └── index.ts                 (re-exports)
├── schedulers/
│   ├── idempotency-cleanup.scheduler.ts (Phase 2)
│   └── tombstone-gc.scheduler.ts        (Phase 2)
├── sync.constants.ts            (Phase 2)
├── sync.module.ts               (Phase 2+3 wiring)
└── index.ts                     (barrel export)
```

---

## Next Steps

1. **Review** — Read PHASE3_IMPLEMENTATION.md for detailed architecture
2. **Test** — Write unit tests for services (IdempotencyService, SyncCursorService, etc.)
3. **Phase 4** — Implement SyncService, SyncController, DTOs, guards
4. **Phase 5** — Wire device registration into login flow
5. **Domain Handlers** — ProductsSyncService, CustomersSyncService, etc.

---

## Questions?

- See PHASE3_IMPLEMENTATION.md for full architecture
- See sync-implementation-plan.md (v5) for requirements
- Each file has inline documentation explaining design decisions
