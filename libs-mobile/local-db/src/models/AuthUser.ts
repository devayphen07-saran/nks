import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export class AuthUser extends Model {
  static table = "auth_users";

  @field("user_id") userId!: number;
  @text("name") name!: string;
  @text("email") email?: string;
  @text("phone_number") phoneNumber?: string;
  @text("image") image?: string;
  @field("is_super_admin") isSuperAdmin!: boolean;
  @field("email_verified") emailVerified!: boolean;
  @field("phone_verified") phoneVerified!: boolean;
  @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @date("last_login_at") lastLoginAt?: Date;

  isStale(): boolean {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - this.updatedAt.getTime() > oneDayMs;
  }
}
