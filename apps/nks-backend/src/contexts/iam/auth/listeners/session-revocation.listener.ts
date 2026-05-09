import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionEvents } from '../../../../common/events/session.events';
import type { SessionRevokeAllPayload } from '../../../../common/events/session.events';
import { SessionRevocationRepository } from '../repositories/session-revocation.repository';

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

  constructor(private readonly sessionRevocationRepository: SessionRevocationRepository) {}

  @OnEvent(SessionEvents.REVOKE_ALL_FOR_USER, { async: true, suppressErrors: false })
  async handle(payload: SessionRevokeAllPayload): Promise<void> {
    try {
      await this.sessionRevocationRepository.revokeAllForUser(payload.userId, payload.reason);
      this.logger.log(
        `Background revocation complete — reason=${payload.reason} userId=${payload.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `Background revocation failed — reason=${payload.reason} userId=${payload.userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
