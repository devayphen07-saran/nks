import {
  GET_CODE_CATEGORIES,
  GET_CODE_VALUES,
  CREATE_CODE_CATEGORY,
  CREATE_CODE_VALUE,
  UPDATE_CODE_VALUE,
  DELETE_CODE_VALUE,
} from "./api-data";
import {
  CreateCodeCategoryRequest,
  CreateCodeValueRequest,
  UpdateCodeValueRequest,
} from "./request-dto";

// ─── Code Categories ──────────────────────────────────────────────────────

export const getCodeCategories = GET_CODE_CATEGORIES.generateAsyncThunk(
  "codes/getCategories"
);

export const getCodeValues = GET_CODE_VALUES.generateAsyncThunk<{
  categoryCode: string;
  storeId?: number;
}>("codes/getValues");

export const createCodeCategory =
  CREATE_CODE_CATEGORY.generateAsyncThunk<CreateCodeCategoryRequest>(
    "codes/createCategory"
  );

// ─── Code Values ──────────────────────────────────────────────────────────

export const createCodeValue = CREATE_CODE_VALUE.generateAsyncThunk<
  CreateCodeValueRequest & { categoryCode: string }
>("codes/createValue");

export const updateCodeValue = UPDATE_CODE_VALUE.generateAsyncThunk<
  UpdateCodeValueRequest & { guuid: string }
>("codes/updateValue");

export const deleteCodeValue = DELETE_CODE_VALUE.generateAsyncThunk<{
  guuid: string;
}>("codes/deleteValue");
