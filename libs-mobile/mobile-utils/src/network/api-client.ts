/**
 * @deprecated Use `API` from `@nks/api-manager` directly.
 * This module re-exports the canonical Axios instance to avoid duplicate
 * instances with inconsistent interceptor / refresh-queue behaviour.
 */
export { API as apiClient } from "@nks/api-manager";
