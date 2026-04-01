import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export class AuthSession extends Model {
  static table = "auth_sessions";

  @field("user_id") userId!: number;
  @text("session_id") sessionId!: string;
  @text("access_token") accessToken!: string;
  @text("refresh_token") refreshToken!: string;
  @text("token_type") tokenType!: string;
  @field("access_expires_at") accessExpiresAt!: number;
  @field("refresh_expires_at") refreshExpiresAt!: number;
  @field("absolute_expiry") absoluteExpiry!: number;
  @field("is_active") isActive!: boolean;
  @text("mechanism") mechanism!: string;
  @date("created_at") createdAt!: Date;
  @date("last_used_at") lastUsedAt?: Date;

  isAccessTokenExpired(): boolean {
    return Date.now() > this.accessExpiresAt;
  }

  isRefreshTokenExpired(): boolean {
    return Date.now() > this.refreshExpiresAt;
  }

  isAbsolutelyExpired(): boolean {
    return Date.now() > this.absoluteExpiry;
  }

  needsRefresh(): boolean {
    const fiveMinutesMs = 5 * 60 * 1000;
    return Date.now() > this.accessExpiresAt - fiveMinutesMs;
  }
}
