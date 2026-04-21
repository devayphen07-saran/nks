export interface AuditLogResponseDto {
  id: number;
  userFk: number | null;
  storeFk: number | null;
  sessionFk: number | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  meta: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  deviceType: string | null;
  isSuccess: boolean;
  failureReason: string | null;
  createdAt: string;
}
