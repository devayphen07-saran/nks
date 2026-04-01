import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export class AuthRoles extends Model {
  static table = "auth_roles";

  @field("user_id") userId!: number;
  @field("store_id") storeId?: number;
  @text("role_code") roleCode!: string;
  @text("role_name") roleName!: string;
  @text("permissions") permissions!: string;
  @field("is_active") isActive!: boolean;
  @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;

  getPermissions(): string[] {
    try {
      return JSON.parse(this.permissions);
    } catch {
      return [];
    }
  }

  hasPermission(permission: string): boolean {
    return this.getPermissions().includes(permission);
  }

  isStoreRole(): boolean {
    return this.storeId != null && this.storeId > 0;
  }

  isGlobalRole(): boolean {
    return !this.isStoreRole();
  }
}
