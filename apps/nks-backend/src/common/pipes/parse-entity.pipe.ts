import { Injectable, NotFoundException, PipeTransform, Type, Inject, mixin } from '@nestjs/common';

/**
 * Contract every repository must satisfy to work with ParseEntityPipe.
 * All existing repositories that extend BaseRepository already have findByGuuid.
 */
export interface GuuidLookup {
  findByGuuid(guuid: string): Promise<unknown>;
}

/**
 * Factory that creates an injectable pipe which:
 *   1. Receives a guuid string from @Param()
 *   2. Fetches the entity via the given repository
 *   3. Throws NotFoundException (with the supplied payload) if not found
 *   4. Returns the full entity — controller receives it typed and ready
 *
 * Usage:
 *   export const ParseStatusPipe = ParseEntityPipe(StatusRepository, errPayload(ErrorCode.STA_STATUS_NOT_FOUND));
 *
 *   @Param('guuid', ParseStatusPipe) status: Status
 *
 * The service then receives the entity directly — no more findByGuuid + null check.
 */
export function ParseEntityPipe<TRepo extends GuuidLookup>(
  RepoClass: Type<TRepo>,
  notFoundPayload: object,
): Type<PipeTransform> {
  @Injectable()
  class ParseEntityMixin implements PipeTransform {
    constructor(@Inject(RepoClass) private readonly repo: TRepo) {}

    async transform(guuid: string) {
      const entity = await this.repo.findByGuuid(guuid);
      if (!entity) throw new NotFoundException(notFoundPayload);
      return entity;
    }
  }

  return mixin(ParseEntityMixin);
}
