import { Model } from "@nozbe/watermelondb";
import { field, text, date } from "@nozbe/watermelondb/decorators";

export class AuthFlags extends Model {
  static table = "auth_flags";

  @text("flag_code") flagCode!: string;
  @text("flag_name") flagName!: string;
  @field("is_enabled") isEnabled!: boolean;
  @text("value") value?: string;
  @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;

  isOn(): boolean {
    return this.isEnabled;
  }

  getValue(): string | null {
    return this.value || null;
  }
}
