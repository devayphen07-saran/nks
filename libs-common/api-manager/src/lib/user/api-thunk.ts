import { GET_USER_DETAILS, UPDATE_USER_DETAILS, VERIFY_USER_EMAIL } from "./api-data";
import { UpdateUserDetailsRequest, VerifyUserEmailRequest } from "./request-dto";

export const getUserDetails = GET_USER_DETAILS.generateAsyncThunk(
  "user/getUserDetails",
);

export const updateUserDetails = UPDATE_USER_DETAILS.generateAsyncThunk<UpdateUserDetailsRequest>(
  "user/updateUserDetails",
);

export const verifyUserEmail = VERIFY_USER_EMAIL.generateAsyncThunk<VerifyUserEmailRequest>(
  "user/verifyUserEmail",
);
