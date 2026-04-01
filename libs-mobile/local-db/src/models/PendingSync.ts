import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export class PendingSync extends Model {
  static table = "pending_sync";

  @text("action") action!: string;
  @text("endpoint") endpoint!: string;
  @text("idempotency_key") idempotencyKey!: string;
  @text("payload") payload!: string;
  @text("status") status!: string;
  @text("data_hash") dataHash?: string;
  @field("retries") retries!: number;
  @field("max_retries") maxRetries!: number;
  @field("next_retry_at") nextRetryAt?: number;
  @field("last_error_code") lastErrorCode?: number;
  @text("last_error_message") lastErrorMessage?: string;
  @date("created_at") createdAt!: Date;
  @date("synced_at") syncedAt?: Date;
  @date("failed_at") failedAt?: Date;
  @field("expires_at") expiresAt?: number;
  @text("user_id") userId!: string;
  @field("store_id") storeId?: number;
  @text("device_id") deviceId!: string;
  @date("deleted_at") deletedAt?: Date;
  @field("sync_attempts") syncAttempts!: number;

  canRetry(): boolean {
    return this.retries < this.maxRetries && this.status !== "synced";
  }

  isPending(): boolean {
    return this.status === "pending";
  }

  isInProgress(): boolean {
    return this.status === "in_progress";
  }

  isSynced(): boolean {
    return this.status === "synced";
  }

  isFailed(): boolean {
    return this.status === "failed";
  }

  isQuarantined(): boolean {
    return this.status === "quarantined";
  }
}
