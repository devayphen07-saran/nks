import {
  GET_USER_DETAILS,
  GET_USER_PREFERENCES,
  UPDATE_THEME,
  UPDATE_TIMEZONE,
  UPDATE_USER_DETAILS,
  UPDATE_USER_PREFERENCES,
  VERIFY_USER_EMAIL,
} from "./api-data";
import {
  UpdateThemeRequest,
  UpdateTimezoneRequest,
  UpdateUserDetailsRequest,
  UpdateUserPreferencesRequest,
  VerifyUserEmailRequest,
} from "./request-dto";

export const getUserDetails = GET_USER_DETAILS.generateAsyncThunk(
  "user/getUserDetails",
);

export const updateUserDetails =
  UPDATE_USER_DETAILS.generateAsyncThunk<UpdateUserDetailsRequest>(
    "user/updateUserDetails",
  );

export const verifyUserEmail =
  VERIFY_USER_EMAIL.generateAsyncThunk<VerifyUserEmailRequest>(
    "user/verifyUserEmail",
  );

export const getUserPreferences = GET_USER_PREFERENCES.generateAsyncThunk(
  "user/getUserPreferences",
);

export const updateUserPreferences =
  UPDATE_USER_PREFERENCES.generateAsyncThunk<UpdateUserPreferencesRequest>(
    "user/updateUserPreferences",
  );

export const updateTheme =
  UPDATE_THEME.generateAsyncThunk<UpdateThemeRequest>("user/updateTheme");

export const updateTimezone =
  UPDATE_TIMEZONE.generateAsyncThunk<UpdateTimezoneRequest>(
    "user/updateTimezone",
  );
