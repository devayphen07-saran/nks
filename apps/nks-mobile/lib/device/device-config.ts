/**
 * Device Configuration
 *
 * Runtime configuration flags for device-specific behavior.
 */

/**
 * Whether this device is shared among multiple users.
 * When true, database keys and sensitive data are deleted on logout
 * to prevent other users from accessing cached credentials.
 *
 * Set to false for single-user devices (phones).
 * Set to true for shared devices (iPads, tablets, shared kiosks).
 *
 * TODO: Drive this from a runtime config (e.g. MDM profile, env var, or
 * device enrollment API) rather than a build-time constant. A hardcoded
 * false means shared-device deployments require a separate build.
 */
export const IS_SHARED_DEVICE = false;
