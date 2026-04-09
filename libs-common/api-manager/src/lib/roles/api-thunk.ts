import {
  GET_ROLE,
  CREATE_ROLE,
  UPDATE_ROLE,
} from "./api-data";
import {
  CreateRoleRequest,
  UpdateRoleRequest,
} from "./request-dto";

// ─── Roles ─────────────────────────────────────────────────────────────────

export const getRole = GET_ROLE.generateAsyncThunk<{
  id: number;
}>("roles/getRole");

export const createRole = CREATE_ROLE.generateAsyncThunk<CreateRoleRequest>(
  "roles/createRole"
);

export const updateRole = UPDATE_ROLE.generateAsyncThunk<
  UpdateRoleRequest & { id: number }
>("roles/updateRole");
