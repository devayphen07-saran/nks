/**
 * Location Mapper
 *
 * Handles transformation of database location entities to response DTOs
 * Includes mapping logic for:
 * - States (to StateResponse)
 * - Districts (to DistrictResponse)
 * - Pincodes (to PincodeResponse)
 */

/**
 * Static mapper class for location entities
 * Use this class to transform raw database rows to typed response objects
 */
export class LocationMapper {
  /**
   * Note: Location entities are currently returned directly from repository
   * as they already match response DTO shape. This mapper is provided
   * for consistency and future extensibility.
   */
}
