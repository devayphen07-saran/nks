import { Injectable, Logger } from '@nestjs/common';

/**
 * SyncCursorService parses and builds compound cursors for paginated pulls.
 *
 * Cursor format: "<milliseconds>:<uuid>"
 * Example: "1725800000000:a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *
 * The cursor encodes the last row's (updated_at, id) tuple. On next pull,
 * the query fetches rows where:
 *   updated_at > cursorTs OR (updated_at = cursorTs AND id > cursorId)
 *
 * This handles the edge case where 1000+ rows share the same updated_at
 * timestamp without skipping rows or creating infinite loops.
 */
@Injectable()
export class SyncCursorService {
  private readonly logger = new Logger(SyncCursorService.name);

  /**
   * Initial cursor (epoch + zero UUID) means "start from the beginning".
   * Mobile sends null or omitted cursor on first pull; we treat it as INITIAL_CURSOR.
   */
  readonly INITIAL_CURSOR = '0:00000000-0000-0000-0000-000000000000';

  /**
   * Parse a cursor string into components.
   *
   * @param cursor - Cursor string or null/undefined (treated as initial)
   * @returns { ts: Date, id: string }
   */
  parse(cursor: string | null | undefined): { ts: Date; id: string } {
    const toParse = cursor || this.INITIAL_CURSOR;
    const [msStr, id] = toParse.split(':');

    const ms = parseInt(msStr, 10);
    if (isNaN(ms)) {
      // Fallback to epoch if parsing fails
      return { ts: new Date(0), id: '00000000-0000-0000-0000-000000000000' };
    }

    return {
      ts: new Date(ms),
      id: id || '00000000-0000-0000-0000-000000000000',
    };
  }

  /**
   * Build a cursor from a row's updated_at timestamp and id.
   *
   * Called after fetching the last row of a page to create next_cursor.
   *
   * @param updatedAt - The row's updated_at timestamp
   * @param id - The row's id (UUID)
   * @returns Cursor string
   */
  build(updatedAt: Date, id: string): string {
    return `${updatedAt.getTime()}:${id}`;
  }
}
