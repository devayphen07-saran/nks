import { APIState, UserProfile } from "@nks/shared-types";

export interface UserDetailsState extends APIState {
  response: UserProfile | undefined;
}

export interface UserProfileState {
  getUserDetail:    APIState;
  updateUserDetail: APIState;
  verifyUserEmail:  APIState;
}
