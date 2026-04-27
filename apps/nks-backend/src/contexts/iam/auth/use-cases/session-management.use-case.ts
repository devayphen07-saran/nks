import { Injectable } from '@nestjs/common';
import { AuthCommandService } from '../services/session/auth-command.service';
import { AuthQueryService } from '../services/session/auth-query.service';
import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';

/**
 * Orchestrates session lifecycle operations: logout, status checks,
 * and multi-device session management.
 */
@Injectable()
export class SessionManagementUseCase {
  constructor(
    private readonly authCommand: AuthCommandService,
    private readonly authQuery: AuthQueryService,
    private readonly sessionCommand: SessionCommandService,
    private readonly sessionQuery: SessionQueryService,
  ) {}

  logout(token: string, userId: number) {
    return this.authCommand.logout(token, userId);
  }

  checkStatus(token: string) {
    return this.authQuery.checkSessionStatus(token);
  }

  getUserSessions(userId: number) {
    return this.sessionQuery.getUserSessions(userId);
  }

  terminateSession(userId: number, sessionGuuid: string) {
    return this.sessionCommand.terminateSession(userId, sessionGuuid);
  }

  terminateAllSessions(userId: number) {
    return this.sessionCommand.terminateAllSessions(userId);
  }
}
