import { Injectable, Logger } from '@nestjs/common';
import type { SessionUser } from '../../interfaces/session-user.interface';
import { AuthContextService } from '../session/auth-context.service';
import { SessionMapper } from '../../mapper/session.mapper';
import type { UserRow, RoleRow } from '../../../../../common/guards/services/session-validator.service';

export interface UserContext {
  sessionUser: SessionUser;
  /** Raw isActive flag from the users table — needed by AuthPolicyService. */
  isActive: boolean;
}

/**
 * Loads the full user context for an authenticated session.
 *
 * Accepts the pre-fetched user row and role assignments from SessionValidatorService
 * (which already retrieved them in the single-query auth context), then builds the
 * SessionUser DTO and resolves stale store state: if the session's activeStoreFk no
 * longer corresponds to a live role assignment the field is nulled in-memory and
 * cleared in the DB before the identity is attached to the request.
 *
 * Stale-store resolution lives here — not in SessionValidatorService — because
 * this is an identity-building concern, not a session-token-validity concern.
 */
@Injectable()
export class UserContextLoaderService {
  private readonly logger = new Logger(UserContextLoaderService.name);

  constructor(private readonly authContext: AuthContextService) {}

  async load(
    user: UserRow,
    roleRows: RoleRow[],
    activeStoreFk: number | null,
    sessionId: number,
  ): Promise<UserContext> {
    const resolvedStoreFk = await this.resolveActiveStore(
      activeStoreFk,
      sessionId,
      user.id as number,
      roleRows,
    );

    const sessionUser = SessionMapper.buildSessionUser(user, roleRows, resolvedStoreFk);
    return { sessionUser, isActive: user.isActive ?? true };
  }

  /**
   * Returns the active store FK if the user still holds a role in that store;
   * otherwise nulls the session row and returns null.
   */
  private async resolveActiveStore(
    activeStoreFk: number | null,
    sessionId: number,
    userFk: number,
    roleRows: RoleRow[],
  ): Promise<number | null> {
    if (activeStoreFk === null) return null;

    const hasRole = roleRows.some((r) => r.storeFk === activeStoreFk);
    if (hasRole) return activeStoreFk;

    this.logger.warn(
      `Cleared stale activeStoreId ${activeStoreFk} for user ${userFk} — no current role assignment.`,
    );
    await this.authContext.clearActiveStore(sessionId);
    return null;
  }
}
