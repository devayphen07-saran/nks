export const SessionEvents = {
  REVOKE_ALL_FOR_USER: 'session.revoke-all-for-user',
} as const;

export interface SessionRevokeAllPayload {
  userId: number;
  reason: string;
}
