import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionEvents } from '../../../../common/events/session.events';
import type { SessionRevokeAllPayload } from '../../../../common/events/session.events';
import { SessionsRepository } from '../repositories/sessions.repository';

/**
 * Handles fan-out session revocation off the hot request path.
 *
 * AuthPolicyService revokes the triggering session synchronously (prevents
 * immediate replay), then emits this event for the remaining sessions.
 * Processing here is async so blocked/inactive account enforcement never
 * blocks the 403 response on a multi-session user.
 */
@Injectable()
export class SessionRevocationListener {
  private readonly logger = new Logger(SessionRevocationListener.name);

  constructor(private readonly sessionsRepository: SessionsRepository) {}

  @OnEvent(SessionEvents.REVOKE_ALL_FOR_USER, { async: true, suppressErrors: false })
  async handle(payload: SessionRevokeAllPayload): Promise<void> {
    try {
      // The triggering session is already deleted; this picks up only the remaining ones.
      const jtis = await this.sessionsRepository.findJtisByUserId(payload.userId);
      await this.sessionsRepository.revokeAllForUser(payload.userId, payload.reason, jtis);
      this.logger.log(
        `Background revocation complete — reason=${payload.reason} userId=${payload.userId} sessions=${jtis.length}`,
      );
    } catch (err) {
      this.logger.error(
        `Background revocation failed — reason=${payload.reason} userId=${payload.userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
