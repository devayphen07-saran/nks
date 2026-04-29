export interface AuditLogResponseDto {
  guuid: string;
  userGuuid: string | null;
  /** External identifier of the actor — null for unauthenticated events. */
  userIamUserId: string | null;
  storeGuuid: string | null;
  sessionGuuid: string | null;
  /** Guuid of the affected entity, or null if not resolvable from entityType. */
  entityGuuid: string | null;
  action: string;
  entityType: string | null;
  meta: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  deviceType: string | null;
  isSuccess: boolean;
  failureReason: string | null;
  createdAt: string;
}

/** Repository row — includes resolved guuids from JOIN. */
export interface AuditLogRow {
  id: number;
  guuid: string;
  userGuuid: string | null;
  userIamUserId: string | null;
  storeGuuid: string | null;
  sessionGuuid: string | null;
  action: string;
  entityType: string | null;
  meta: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  deviceType: string | null;
  isSuccess: boolean;
  failureReason: string | null;
  createdAt: Date;
}
