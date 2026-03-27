export interface RegisterStoreRequest {
  storeName:          string;
  storeCode:          string;
  storeTypeCode:      string;
  registrationNumber?: string;
  taxNumber?:          string;
}

export interface RegisterStoreResponse {
  storeId:   number;
  storeCode: string | null;
  role:      string;
}

export interface InviteStaffRequest {
  inviteeEmail:  string;
  roleCode:      string;
  permissionIds: number[];
}

export interface InviteStaffResponse {
  token:        string;
  inviteeEmail: string;
  expiresAt:    string;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface StaffMember {
  userId:        number;
  userName:      string;
  userEmail:     string;
  roleCode:      string;
  roleName:      string;
  permissionIds: number[];
  acceptedAt:    string | null;
}

export interface UpdateStaffPermissionsRequest {
  permissionIds: number[];
}

export interface SetupPersonalResponse {
  roles:       string[];
  permissions: string[];
  storeId:     number | null;
  userType:    string;
}
