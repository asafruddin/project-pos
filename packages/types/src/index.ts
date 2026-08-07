/** Shared auth / identity DTOs for API + Dashboard. */

export type PlaceholderId = string;

/** Account roles — AD-11 / FR-32 */
export type Role = "cashier" | "catalog_admin";

export type LoginRequest = {
  /** Username or email (same login field for Phase 1). */
  login: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "Bearer";
  user_id: string;
  role: Role;
};

export type AuthMeResponse = {
  user_id: string;
  role: Role;
};

export type ApiErrorBody = {
  code: string;
  message: string;
};
