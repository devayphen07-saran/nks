import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import type { EntityName } from '../../../common/constants/entity-names.constants';

/**
 * EntityRegistryService
 *
 * Resolves the polymorphic `entity` table's name → id mapping.
 *
 * Tables like `address`, `communication`, `files`, `notes` use
 * (entity_fk, record_id) to identify their owner. `entity_fk` references
 * `entity.id`, which is a static, seed-driven registry. To filter by owner
 * type in a query you need the numeric id matching `entity.entity_name`.
 *
 * The cache is loaded once at startup. New entity rows added at runtime
 * (very rare — they require a seed change) require a process restart or
 * an explicit `refresh()` call.
 */
@Injectable()
export class EntityRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EntityRegistryService.name);

  private nameToId = new Map<string, number>();

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const rows = await this.db
      .select({
        id:         schema.entity.id,
        entityName: schema.entity.entityName,
      })
      .from(schema.entity)
      .where(
        and(
          eq(schema.entity.isActive, true),
          isNull(schema.entity.deletedAt),
        ),
      );

    const next = new Map<string, number>();
    for (const row of rows) {
      next.set(row.entityName, row.id);
    }
    this.nameToId = next;
    this.logger.log(`Entity registry loaded: ${next.size} entities`);
  }

  /**
   * Returns the entity id for a known name, or throws if missing.
   * Use this when the name is a hard-coded constant (`EntityNames.STORE`)
   * and a missing row indicates a deployment/seed bug.
   */
  getIdOrThrow(name: EntityName | string): number {
    const id = this.nameToId.get(name);
    if (id === undefined) {
      this.logger.error(`Entity name not found in registry: ${name}`);
      throw new NotFoundException(errPayload(ErrorCode.NOT_FOUND));
    }
    return id;
  }

  /**
   * Returns the entity id for a name, or null when unknown.
   * Use this for runtime/user-supplied names where missing is a normal case.
   */
  getId(name: string): number | null {
    return this.nameToId.get(name) ?? null;
  }
}
